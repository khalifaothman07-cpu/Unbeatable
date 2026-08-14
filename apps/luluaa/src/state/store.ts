/* =========================================================================
   store.ts — the whole game, as one Zustand store.
   -------------------------------------------------------------------------
   All four seats are local (pass-and-play). Per the spec's Table model this
   is the zero-network default: nothing here touches Supabase, so a purely
   local game has no backend dependency at all.
   ========================================================================= */

import { create } from "zustand";
import * as fx from "./feedback";
import { claimSeat, createRoom, fetchRoom, makeRoomCode, pollRoom, pushSnapshot, remoteConfigured, subscribeRoom, type Claims, type Room, type Snapshot } from "./sync";
import { generateBoard, freshSeed, shuffle, makeRng } from "../game/board";
import { buildGeometry, type Geometry } from "../game/geometry";
import { DEFAULT_BOARD, RESOURCE_LABEL, TERRAIN_YIELD, type Board, type BoardConfig, type Resource } from "../game/types";
import {
  COST, LIMITS, WIN_POINTS, canAfford, pay, emptyHand, handCount,
  canPlaceBarasti, canPlaceRoute, canUpgradeQasr, longestRoute, scoreOf,
  type Buildings, type Hand, type Routes,
} from "../game/rules";

export type DhowKind = "windbreaker" | "hiddenPearl" | "bountifulTide" | "souqCorner" | "caravanRoute";

export const DHOW_LABEL: Record<DhowKind, string> = {
  windbreaker: "Windbreaker",
  hiddenPearl: "Hidden Pearl",
  bountifulTide: "Bountiful Tide",
  souqCorner: "Souq Corner",
  caravanRoute: "Caravan Route",
};

export interface DhowCard { uid: string; kind: DhowKind; boughtOnTurn: number }

export interface Player {
  id: number;
  name: string;
  colour: string;
  hand: Hand;
  cards: DhowCard[];
  knightsPlayed: number;
}

export type Phase =
  | "setup"        // snake draft
  | "roll"         // must roll
  | "main"         // build / trade / play card
  | "discard"      // 7 rolled, players over the limit must discard
  | "moveShamal"   // choose a tile
  | "steal"        // choose a victim
  | "over";

export type PendingBuild = null | "route" | "barasti" | "qasr" | "caravan";

const COLOURS = ["#b4623f", "#1c7d84", "#7a6a2f", "#5c4e7a"];
const NAMES = ["Seat 1", "Seat 2", "Seat 3", "Seat 4"];

function buildDeck(rng: () => number): DhowCard[] {
  const spec: [DhowKind, number][] = [
    ["windbreaker", 14], ["hiddenPearl", 5], ["bountifulTide", 2],
    ["souqCorner", 2], ["caravanRoute", 2],
  ];
  const out: DhowCard[] = [];
  spec.forEach(([kind, n]) => {
    for (let i = 0; i < n; i++) out.push({ uid: `${kind}-${i}`, kind, boughtOnTurn: -1 });
  });
  return shuffle(out, rng);
}

/* snake draft: 0,1,2,3,3,2,1,0 */
const snake = (n: number) => [...Array.from({ length: n }, (_, i) => i), ...Array.from({ length: n }, (_, i) => n - 1 - i)];

/** A standing offer from the active seat to the rest of the table. */
export interface TradeOffer {
  from: number;
  give: Partial<Record<Resource, number>>;
  want: Partial<Record<Resource, number>>;
  /** seats that have declined; purely informational */
  declined: number[];
}

export type SeatType = "local" | "remote";
/* No `claimed` here on purpose: who holds a seat is server-owned state in
   the room's `claims` column, not something a device asserts in a snapshot
   it publishes. See joinRoom. */
export interface Seat { type: SeatType; code: string | null }

export type LinkState = "offline" | "connecting" | "live" | "error";

/* -------------------------------------------------------------------------
   WHO MAY ACT FOR A SEAT
   -------------------------------------------------------------------------
   The single rule the board, the trade panel and the action buttons all ask.
   Getting this wrong is what makes multi-device play feel haunted: if the
   host keeps driving a seat someone else has taken, both devices act for it,
   both publish, and the loser's move silently vanishes on the next snapshot.

     no room yet .... this device is the whole table
     host ........... only the seats still marked local
     joined device .. only its own seat
   ------------------------------------------------------------------------- */
export function drivesSeat(
  s: Pick<GameState, "roomCode" | "mySeat" | "seats">,
  seat: number,
): boolean {
  if (!s.roomCode) return true;
  if (s.mySeat === null || s.mySeat < 0) return s.seats[seat]?.type === "local";
  return s.mySeat === seat;
}

/** The seat this device should be watching — for banners and prompts. */
export function activeSeat(s: Pick<GameState, "phase" | "setupOrder" | "setupIndex" | "current">): number {
  return s.phase === "setup" ? s.setupOrder[s.setupIndex] : s.current;
}

export interface GameToggles { gentleShamal: boolean; calmTides: boolean; privacyScreen: boolean }

interface GameState {
  board: Board;
  geo: Geometry;
  players: Player[];
  buildings: Buildings;
  routes: Routes;
  shamalTile: string;
  current: number;
  phase: Phase;
  setupOrder: number[];
  setupIndex: number;
  setupStage: "barasti" | "route";
  lastSetupVertex: string | null;
  dice: [number, number] | null;
  deck: DhowCard[];
  log: string[];
  winner: number | null;
  toggles: GameToggles;
  turnNo: number;
  turnsTaken: number[];
  pending: PendingBuild;
  caravanLeft: number;
  discardQueue: number[];
  discardTargets: Record<number, number>;
  playedCardThisTurn: boolean;
  handRevealed: boolean;

  /* --- table / seats (spec §9) --- */
  seats: Seat[];
  roomCode: string | null;
  /** which seat THIS device controls; null = host holding all local seats */
  mySeat: number | null;
  syncing: boolean;
  /** live state of the realtime channel, for the "connected" light */
  link: LinkState;
  /** server revision this device has seen; writes below it are rejected */
  rev: number;
  /** which seats are taken. Server-owned — never part of a published snapshot. */
  claims: Claims;

  newGame: (config?: BoardConfig, toggles?: GameToggles) => void;
  roll: () => void;
  setPending: (p: PendingBuild) => void;
  clickVertex: (v: string) => void;
  clickEdge: (e: string) => void;
  clickTile: (t: string) => void;
  settleShamal: () => void;
  buyDhow: () => void;
  playDhow: (uid: string, arg?: Resource) => void;
  bankTrade: (give: Resource, get: Resource) => void;
  discard: (r: Resource) => void;
  stealFrom: (playerId: number) => void;
  endTurn: () => void;
  revealHand: () => void;
  openSeat: (seatId: number) => Promise<void>;
  closeSeat: (seatId: number) => void;
  joinRoom: (code: string, seatId: number) => Promise<boolean>;
  startSync: () => void;
  stopSync: () => void;
  snapshot: () => Snapshot;
  applySnapshot: (snap: Snapshot) => void;
  /** adopt a room read, if it is genuinely newer than what we hold */
  acceptRoom: (room: Room) => void;
  publish: () => void;
  lastPushedAt: string | null;
  offer: TradeOffer | null;
  proposeTrade: (give: Partial<Record<Resource, number>>, want: Partial<Record<Resource, number>>) => void;
  cancelTrade: () => void;
  acceptTrade: (accepter: number) => void;
  declineTrade: (decliner: number) => void;
}

const say = (log: string[], msg: string) => [msg, ...log].slice(0, 60);

function makePlayers(): Player[] {
  return NAMES.map((name, id) => ({
    id, name, colour: COLOURS[id], hand: emptyHand(), cards: [], knightsPlayed: 0,
  }));
}

/** Longest route holder: 5+ and strictly more than anyone else. */
function longestHolder(routes: Routes, buildings: Buildings, geo: Geometry, players: Player[]): number | null {
  let best = 4, holder: number | null = null;
  for (const p of players) {
    const len = longestRoute(p.id, routes, buildings, geo);
    if (len >= 5 && len > best) { best = len; holder = p.id; }
  }
  return holder;
}

function navigatorHolder(players: Player[]): number | null {
  let best = 2, holder: number | null = null;
  for (const p of players) {
    if (p.knightsPlayed >= 3 && p.knightsPlayed > best) { best = p.knightsPlayed; holder = p.id; }
  }
  return holder;
}

export function publicScore(s: GameState, id: number): number {
  return scoreOf({
    player: id, buildings: s.buildings,
    hiddenPearls: 0,
    hasLongest: longestHolder(s.routes, s.buildings, s.geo, s.players) === id,
    hasNavigator: navigatorHolder(s.players) === id,
  }, false);
}

export function totalScore(s: GameState, id: number): number {
  const pearls = s.players[id].cards.filter((c) => c.kind === "hiddenPearl").length;
  return scoreOf({
    player: id, buildings: s.buildings, hiddenPearls: pearls,
    hasLongest: longestHolder(s.routes, s.buildings, s.geo, s.players) === id,
    hasNavigator: navigatorHolder(s.players) === id,
  }, true);
}


/** Tiles the Shamal may legally move to. Gentle Shamal shelters anyone on
    <=2 points; if that leaves nowhere, the spec says it returns to the
    Sabkha and steals nothing — without that fallback the opening deadlocks,
    because at the start EVERY seat is on 2 points. */
export function legalShamalTiles(s: GameState): string[] {
  const all = s.board.tiles.filter((t) => t.id !== s.shamalTile).map((t) => t.id);
  if (!s.toggles.gentleShamal) return all;
  const weak = s.players.filter((p) => p.id !== s.current && publicScore(s, p.id) <= 2).map((p) => p.id);
  return all.filter((t) => !s.geo.tileVertices[t].some((v) => {
    const b = s.buildings[v];
    return b && weak.includes(b.player);
  }));
}

export const useGame = create<GameState>((rawSet, get) => {
  /* One choke point: any state change that isn't purely local UI gets
     published. Sprinkling publish() through 15 actions guarantees someone
     forgets one and a seat silently desyncs. */
  /* Keys that describe THIS DEVICE rather than the game. Writing them must
     never publish: every extra publish is another chance for a device to
     stamp its own view over a newer one from whoever is actually playing.
     roomCode and link are addressing and plumbing, not table state. */
  const LOCAL_ONLY = new Set([
    "handRevealed", "pending", "syncing", "mySeat", "lastPushedAt", "roomCode", "link", "rev", "claims",
  ]);
  /* Guard against the echo loop: applying a received snapshot also calls
     set(), which would publish it straight back out, and two clients would
     ping-pong forever. Nothing publishes while we are applying. */
  let applying = false;
  const set: typeof rawSet = ((partial: object, replace?: boolean) => {
    (rawSet as (p: object, r?: boolean) => void)(partial, replace);
    if (applying) return;
    const keys = Object.keys(partial ?? {});
    if (keys.length && !keys.every((k) => LOCAL_ONLY.has(k))) {
      const st = get();
      if (st.roomCode && st.syncing) st.publish();
    }
  }) as typeof rawSet;

  return ({
  ...(() => {
    const board = generateBoard(DEFAULT_BOARD, freshSeed());
    return {
      board,
      geo: buildGeometry(board),
      players: makePlayers(),
      buildings: {} as Buildings,
      routes: {} as Routes,
      shamalTile: board.tiles.find((t) => t.terrain === "sabkha")!.id,
      current: 0,
      phase: "setup" as Phase,
      setupOrder: snake(4),
      setupIndex: 0,
      setupStage: "barasti" as const,
      lastSetupVertex: null,
      dice: null,
      deck: buildDeck(makeRng(Date.now())),
      log: ["Place your first barasti."],
      winner: null,
      toggles: { gentleShamal: true, calmTides: false, privacyScreen: true },
      turnNo: 0,
      turnsTaken: [0, 0, 0, 0],
      pending: null as PendingBuild,
      caravanLeft: 0,
      discardQueue: [] as number[],
      discardTargets: {} as Record<number, number>,
      playedCardThisTurn: false,
      handRevealed: false,
      seats: [0,1,2,3].map(() => ({ type: "local" as SeatType, code: null })),
      roomCode: null,
      mySeat: null,
      syncing: false,
      link: "offline" as LinkState,
      rev: 0,
      claims: {} as Claims,
      lastPushedAt: null,
      offer: null as TradeOffer | null,
    };
  })(),

  newGame: (config = DEFAULT_BOARD, toggles) => {
    /* leave the old table first — otherwise its snapshots keep arriving and
       stamp the abandoned game back over the fresh board */
    get().stopSync();
    const board = generateBoard(config, freshSeed());
    set({
      board,
      geo: buildGeometry(board),
      players: makePlayers(),
      buildings: {},
      routes: {},
      shamalTile: board.tiles.find((t) => t.terrain === "sabkha")!.id,
      current: 0,
      phase: "setup",
      setupOrder: snake(4),
      setupIndex: 0,
      setupStage: "barasti",
      lastSetupVertex: null,
      dice: null,
      deck: buildDeck(makeRng(Date.now())),
      log: ["New board dealt. Seat 1, place your first barasti."],
      winner: null,
      toggles: toggles ?? get().toggles,
      turnNo: 0,
      turnsTaken: [0, 0, 0, 0],
      pending: null,
      caravanLeft: 0,
      discardQueue: [],
      discardTargets: {},
      playedCardThisTurn: false,
      handRevealed: false,
      seats: [0,1,2,3].map(() => ({ type: "local" as SeatType, code: null })),
      roomCode: null,
      mySeat: null,
      syncing: false,
      link: "offline",
      rev: 0,
      claims: {},
      lastPushedAt: null,
      offer: null,
    });
  },

  revealHand: () => set({ handRevealed: true }),

  /* --- TABLE / SEATS -----------------------------------------------------
     Flipping the first seat to remote is what creates the row; until then
     the game is purely local and never touches the network. */
  openSeat: async (seatId: number) => {
    const s = get();
    if (!remoteConfigured) {
      set({ log: say(s.log, "Online seats aren't configured on this build.") });
      return;
    }
    const code = s.roomCode ?? makeRoomCode();
    const seats = s.seats.map((x, i) => i === seatId ? { ...x, type: "remote" as SeatType, code } : x);
    const first = !s.roomCode;
    set({ seats, roomCode: code, syncing: true, link: "connecting", mySeat: s.mySeat ?? -1 });

    /* Don't announce a room code until the row actually exists. Showing one
       optimistically means handing friends a link to a table that was never
       created — they get "no table with that code" and nobody can tell why. */
    const wrote = first
      ? await createRoom(code, get().snapshot())
      : (await pushSnapshot(code, get().snapshot(), s.rev + 1)) === "ok";

    if (!wrote) {
      set({
        seats: s.seats, roomCode: s.roomCode, syncing: s.syncing, link: "error", mySeat: s.mySeat,
        log: say(s.log, "Couldn't reach the table server — the seat is still local. Check the connection and try again."),
      });
      return;
    }

    if (first) set({ rev: 1 });
    set({ log: say(get().log, `Seat ${seatId + 1} opened online — room code ${code}.`) });
    get().startSync();
  },

  closeSeat: (seatId: number) => {
    const s = get();
    const seats = s.seats.map((x, i) => i === seatId ? { ...x, type: "local" as SeatType } : x);
    /* the set() above already publishes through the store wrapper — pushing
       again here would burn a revision and race the first write */
    set({ seats, log: say(s.log, `Seat ${seatId + 1} is local again.`) });
  },

  /** Join from another device: pull the room, then follow it. */
  joinRoom: async (code: string, seatId: number) => {
    if (!remoteConfigured) return false;
    const room = code.toUpperCase();
    const got = await fetchRoom(room);
    if (!got) return false;
    get().applySnapshot(got.snapshot);
    set({ rev: got.rev, claims: got.claims });

    /* Only a seat the host actually opened can be joined. Taking a seat that
       is still local would leave two devices driving it — the host's copy and
       this one — each overwriting the other's moves. */
    const seats = get().seats;
    if (seats[seatId]?.type !== "remote") {
      set({ log: say(get().log, `Seat ${seatId + 1} isn't open online.`) });
      return false;
    }

    /* Claim through the database, not through a snapshot push. A joining
       device is by definition not the one whose turn it is, so anything it
       writes to the game state would be a stale overwrite of somebody's
       move. The RPC is atomic and refuses a seat that is already taken. */
    const claims = await claimSeat(room, seatId);
    if (!claims) {
      set({ log: say(get().log, `Seat ${seatId + 1} was already taken.`) });
      return false;
    }

    set({ roomCode: room, mySeat: seatId, syncing: true, claims });
    get().startSync();
    return true;
  },

  startSync: () => {
    const s = get();
    if (!s.roomCode) return;
    const self = get() as unknown as { _unsub?: () => void };
    /* re-subscribing to a different room must drop the old channel, or the
       device keeps receiving snapshots from a table it has left */
    self._unsub?.();

    const take = (room: Room) => get().acceptRoom(room);

    const unsubLive = subscribeRoom(s.roomCode, take, (st) =>
      set({ link: st === "live" ? "live" : st === "connecting" ? "connecting" : "error" }));
    const unsubPoll = pollRoom(s.roomCode, take);
    self._unsub = () => { unsubLive(); unsubPoll(); };
  },

  stopSync: () => {
    const self = get() as unknown as { _unsub?: () => void };
    self._unsub?.();
    self._unsub = undefined;
    set({ syncing: false, link: "offline" });
  },

  /** The serialisable slice. Board travels as a seed, not as tiles. */
  snapshot: (): Snapshot => {
    const s = get();
    return {
      v: 1,
      seed: s.board.seed,
      rows: s.board.config.rows,
      updatedAt: new Date().toISOString(),
      state: {
        players: s.players, buildings: s.buildings, routes: s.routes,
        shamalTile: s.shamalTile, current: s.current, phase: s.phase,
        setupOrder: s.setupOrder, setupIndex: s.setupIndex, setupStage: s.setupStage,
        lastSetupVertex: s.lastSetupVertex, dice: s.dice, deck: s.deck, log: s.log,
        winner: s.winner, toggles: s.toggles, turnNo: s.turnNo, turnsTaken: s.turnsTaken,
        caravanLeft: s.caravanLeft, discardQueue: s.discardQueue, discardTargets: s.discardTargets,
        playedCardThisTurn: s.playedCardThisTurn, seats: s.seats, offer: s.offer,
      },
    };
  },

  applySnapshot: (snap: Snapshot) => {
    applying = true;
    const s = get();
    /* rebuild the board from its seed rather than trusting shipped tiles */
    const board = s.board.seed === snap.seed
      ? s.board
      : generateBoard({ ...DEFAULT_BOARD, rows: snap.rows }, snap.seed);
    const geo = board === s.board ? s.geo : buildGeometry(board);
    try {
      set({ board, geo, ...(snap.state as object), pending: null, handRevealed: false, lastPushedAt: snap.updatedAt });
    } finally {
      applying = false;
    }
  },

  /** Adopt a room read. Older or equal revisions are our own echo, or a
      device that has fallen behind — either way, not news. */
  acceptRoom: (room) => {
    const s = get();
    /* claims are server-owned and monotonic, so they are always worth taking
       even when the snapshot alongside them is one we already have */
    if (room.claims) set({ claims: room.claims });
    if (room.rev <= s.rev) return;
    s.applySnapshot(room.snapshot);
    set({ rev: room.rev });
  },

  /** Push after any local mutation, when the table has remote seats. */
  publish: () => {
    const s = get();
    if (!s.roomCode || !s.syncing) return;
    const code = s.roomCode;
    const next = s.rev + 1;
    const snap = s.snapshot();
    set({ lastPushedAt: snap.updatedAt, rev: next });
    void pushSnapshot(code, snap, next).then((res) => {
      /* Someone else advanced the table first. Our snapshot described a
         board that no longer exists, so take theirs rather than retry ours —
         retrying would be exactly the overwrite this guard exists to stop. */
      if (res !== "stale") return;
      void fetchRoom(code).then((room) => { if (room) get().acceptRoom(room); });
    });
  },

  setPending: (p) => set({ pending: get().pending === p ? null : p }),

  roll: () => {
    const s = get();
    if (s.phase !== "roll") return;
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    const total = d1 + d2;
    fx.diceRoll();

    /* Calm Tides: a 7 in a player's first two turns is rerolled */
    if (total === 7 && s.toggles.calmTides && s.turnsTaken[s.current] < 2) {
      set({ dice: [d1, d2], log: say(s.log, `Rolled 7 — Calm Tides, reroll.`) });
      setTimeout(() => get().roll(), 350);
      return;
    }

    if (total === 7) {
      const over = s.players.filter((p) => handCount(p.hand) >= 8).map((p) => p.id);
      const targets: Record<number, number> = {};
      over.forEach((id) => { targets[id] = Math.ceil(handCount(s.players[id].hand) / 2); });
      fx.loss();
      set({
        dice: [d1, d2],
        phase: over.length ? "discard" : "moveShamal",
        discardQueue: over,
        discardTargets: targets,
        log: say(s.log, over.length
          ? `Rolled 7 — the Shamal rises. ${over.length} seat(s) must discard.`
          : `Rolled 7 — the Shamal rises. Move it.`),
      });
      return;
    }

    /* production */
    const players = s.players.map((p) => ({ ...p, hand: { ...p.hand } }));
    const gained: string[] = [];
    for (const tile of s.board.tiles) {
      if (tile.token !== total) continue;
      if (tile.id === s.shamalTile) continue;
      const res = TERRAIN_YIELD[tile.terrain];
      if (!res) continue;
      for (const vid of s.geo.tileVertices[tile.id]) {
        const b = s.buildings[vid];
        if (!b) continue;
        const n = b.type === "qasr" ? 2 : 1;
        players[b.player].hand[res] += n;
        gained.push(`${players[b.player].name} +${n} ${RESOURCE_LABEL[res]}`);
      }
    }
    if (gained.length) fx.gain(); else fx.tap();
    set({
      dice: [d1, d2],
      players,
      phase: "main",
      log: say(s.log, `Rolled ${total}. ${gained.length ? gained.join(", ") : "No production."}`),
    });
  },

  clickVertex: (v) => {
    const s = get();

    if (s.phase === "setup" && s.setupStage === "barasti") {
      const pid = s.setupOrder[s.setupIndex];
      if (!canPlaceBarasti(v, pid, s.buildings, s.routes, s.geo, true)) return;
      const buildings: Buildings = { ...s.buildings, [v]: { player: pid, type: "barasti" } };

      /* second barasti pays out immediately */
      const isSecondRound = s.setupIndex >= s.players.length;
      let players = s.players;
      let bonus = "";
      if (isSecondRound) {
        players = s.players.map((p) => ({ ...p, hand: { ...p.hand } }));
        const got: Resource[] = [];
        for (const tid of s.geo.vertices[v].tiles) {
          const tile = s.board.tiles.find((t) => t.id === tid)!;
          const res = TERRAIN_YIELD[tile.terrain];
          if (!res) continue;
          players[pid].hand[res] += 1;
          got.push(res);
        }
        bonus = got.length ? ` and collects ${got.map((r) => RESOURCE_LABEL[r]).join(", ")}` : "";
      }
      fx.place();
      set({
        buildings, players, setupStage: "route", lastSetupVertex: v,
        log: say(s.log, `${s.players[pid].name} places a barasti${bonus}. Now a connected trade route.`),
      });
      return;
    }

    if (s.phase !== "main") return;

    if (s.pending === "barasti") {
      const p = s.players[s.current];
      const count = Object.values(s.buildings).filter((b) => b.player === s.current && b.type === "barasti").length;
      if (count >= LIMITS.barasti) return;
      if (!canAfford(p.hand, COST.barasti)) return;
      if (!canPlaceBarasti(v, s.current, s.buildings, s.routes, s.geo, false)) return;
      const players = s.players.map((x, i) => i === s.current ? { ...x, hand: pay(x.hand, COST.barasti) } : x);
      fx.place();
      set({
        buildings: { ...s.buildings, [v]: { player: s.current, type: "barasti" } },
        players, pending: null,
        log: say(s.log, `${p.name} builds a barasti.`),
      });
      return;
    }

    if (s.pending === "qasr") {
      const p = s.players[s.current];
      const count = Object.values(s.buildings).filter((b) => b.player === s.current && b.type === "qasr").length;
      if (count >= LIMITS.qasr) return;
      if (!canAfford(p.hand, COST.qasr)) return;
      if (!canUpgradeQasr(v, s.current, s.buildings)) return;
      const players = s.players.map((x, i) => i === s.current ? { ...x, hand: pay(x.hand, COST.qasr) } : x);
      fx.place();
      set({
        buildings: { ...s.buildings, [v]: { player: s.current, type: "qasr" } },
        players, pending: null,
        log: say(s.log, `${p.name} raises a qasr.`),
      });
      return;
    }
  },

  clickEdge: (e) => {
    const s = get();

    if (s.phase === "setup" && s.setupStage === "route") {
      const pid = s.setupOrder[s.setupIndex];
      const edge = s.geo.edges[e];
      const touches = s.lastSetupVertex && (edge.a === s.lastSetupVertex || edge.b === s.lastSetupVertex);
      if (!touches || s.routes[e] !== undefined) return;

      fx.place();
      const routes = { ...s.routes, [e]: pid };
      const nextIndex = s.setupIndex + 1;
      const done = nextIndex >= s.setupOrder.length;
      set({
        routes,
        setupIndex: nextIndex,
        setupStage: "barasti",
        lastSetupVertex: null,
        phase: done ? "roll" : "setup",
        current: done ? 0 : s.current,
        log: say(s.log, done
          ? "Setup complete. Seat 1 — roll the dice."
          : `${s.players[s.setupOrder[nextIndex]].name}, place a barasti.`),
      });
      return;
    }

    if (s.phase !== "main") return;

    const isCaravan = s.pending === "caravan" && s.caravanLeft > 0;
    if (s.pending !== "route" && !isCaravan) return;

    const p = s.players[s.current];
    const count = Object.values(s.routes).filter((r) => r === s.current).length;
    if (count >= LIMITS.route) return;
    if (!isCaravan && !canAfford(p.hand, COST.route)) return;
    if (!canPlaceRoute(e, s.current, s.buildings, s.routes, s.geo)) return;

    fx.place();
    const players = isCaravan ? s.players : s.players.map((x, i) => i === s.current ? { ...x, hand: pay(x.hand, COST.route) } : x);
    const left = isCaravan ? s.caravanLeft - 1 : 0;
    set({
      routes: { ...s.routes, [e]: s.current },
      players,
      caravanLeft: left,
      pending: isCaravan && left > 0 ? "caravan" : null,
      log: say(s.log, `${p.name} lays a trade route${isCaravan ? ` (caravan, ${left} left)` : ""}.`),
    });
  },

  clickTile: (t) => {
    const s = get();
    if (s.phase !== "moveShamal") return;
    if (!legalShamalTiles(s).includes(t)) return;

    const victims = [...new Set(
      s.geo.tileVertices[t]
        .map((v) => s.buildings[v])
        .filter((b): b is NonNullable<typeof b> => !!b && b.player !== s.current && handCount(s.players[b.player].hand) > 0)
        .map((b) => b.player)
    )];

    set({
      shamalTile: t,
      phase: victims.length ? "steal" : "main",
      log: say(s.log, victims.length ? "Shamal moved. Choose who to take from." : "Shamal moved. Nothing to take."),
    });
  },

  /** Called when the Shamal phase opens; resolves immediately if boxed in. */
  settleShamal: () => {
    const s = get();
    if (s.phase !== "moveShamal") return;
    if (legalShamalTiles(s).length > 0) return;
    const sabkha = s.board.tiles.find((t) => t.terrain === "sabkha")!.id;
    set({
      shamalTile: sabkha,
      phase: "main",
      log: say(s.log, "No tile is open to the Shamal — it falls back to the sabkha, taking nothing."),
    });
  },

  stealFrom: (victim) => {
    const s = get();
    if (s.phase !== "steal") return;
    const vhand = s.players[victim].hand;
    const pool: Resource[] = [];
    (Object.keys(vhand) as Resource[]).forEach((r) => { for (let i = 0; i < vhand[r]; i++) pool.push(r); });
    if (!pool.length) { set({ phase: "main" }); return; }
    const taken = pool[Math.floor(Math.random() * pool.length)];
    const players = s.players.map((p, i) => {
      if (i === victim) return { ...p, hand: { ...p.hand, [taken]: p.hand[taken] - 1 } };
      if (i === s.current) return { ...p, hand: { ...p.hand, [taken]: p.hand[taken] + 1 } };
      return p;
    });
    fx.loss();
    set({ players, phase: "main", log: say(s.log, `${s.players[s.current].name} takes a card from ${s.players[victim].name}.`) });
  },

  discard: (r) => {
    const s = get();
    if (s.phase !== "discard") return;
    const pid = s.discardQueue[0];
    if (pid === undefined) return;
    const p = s.players[pid];
    if (p.hand[r] <= 0) return;

    /* discard half rounded down === keep ceil(n/2). The target is fixed
       from the hand size at the moment the 7 was rolled, so it can't drift
       as cards leave. */
    const keep = s.discardTargets[pid];
    const players = s.players.map((x, i) => i === pid ? { ...x, hand: { ...x.hand, [r]: x.hand[r] - 1 } } : x);
    const held = handCount(players[pid].hand);

    if (held > keep) {
      set({ players, log: say(s.log, `${p.name} discards ${RESOURCE_LABEL[r]} (${held - keep} more).`) });
      return;
    }
    const rest = s.discardQueue.slice(1);
    set({
      players,
      discardQueue: rest,
      phase: rest.length ? "discard" : "moveShamal",
      log: say(s.log, rest.length ? `${p.name} is done discarding.` : "Discards done — move the Shamal."),
    });
  },

  buyDhow: () => {
    const s = get();
    if (s.phase !== "main" || !s.deck.length) return;
    const p = s.players[s.current];
    if (!canAfford(p.hand, COST.dhow)) return;
    const [card, ...deck] = s.deck;
    const players = s.players.map((x, i) => i === s.current
      ? { ...x, hand: pay(x.hand, COST.dhow), cards: [...x.cards, { ...card, boughtOnTurn: s.turnNo }] }
      : x);
    set({ deck, players, log: say(s.log, `${p.name} buys a dhow card.`) });
  },

  playDhow: (uid, arg) => {
    const s = get();
    if (s.phase !== "main" || s.playedCardThisTurn) return;
    const p = s.players[s.current];
    const card = p.cards.find((c) => c.uid === uid);
    if (!card || card.kind === "hiddenPearl") return;
    if (card.boughtOnTurn === s.turnNo) return; // not the turn it was bought

    const strip = (x: Player) => ({ ...x, cards: x.cards.filter((c) => c.uid !== uid) });

    if (card.kind === "windbreaker") {
      const players = s.players.map((x, i) => i === s.current ? { ...strip(x), knightsPlayed: x.knightsPlayed + 1 } : x);
      set({ players, phase: "moveShamal", playedCardThisTurn: true, log: say(s.log, `${p.name} plays Windbreaker.`) });
      return;
    }
    if (card.kind === "bountifulTide") {
      const r = arg ?? "pearls";
      const players = s.players.map((x, i) => i === s.current
        ? { ...strip(x), hand: { ...x.hand, [r]: x.hand[r] + 2 } } : x);
      set({ players, playedCardThisTurn: true, log: say(s.log, `${p.name} takes 2 ${RESOURCE_LABEL[r]} on the Bountiful Tide.`) });
      return;
    }
    if (card.kind === "souqCorner") {
      const r = arg ?? "pearls";
      let taken = 0;
      const players = s.players.map((x, i) => {
        if (i === s.current) return strip(x);
        taken += x.hand[r];
        return { ...x, hand: { ...x.hand, [r]: 0 } };
      });
      players[s.current] = { ...players[s.current], hand: { ...players[s.current].hand, [r]: players[s.current].hand[r] + taken } };
      set({ players, playedCardThisTurn: true, log: say(s.log, `Souq Corner — ${p.name} corners ${RESOURCE_LABEL[r]} and takes ${taken}.`) });
      return;
    }
    if (card.kind === "caravanRoute") {
      const players = s.players.map((x, i) => i === s.current ? strip(x) : x);
      set({ players, playedCardThisTurn: true, pending: "caravan", caravanLeft: 2, log: say(s.log, `${p.name} opens a Caravan Route — 2 free routes.`) });
      return;
    }
  },

  /* --- PLAYER-TO-PLAYER TRADING -------------------------------------
     The active seat posts one standing offer; anyone who can cover it may
     accept. Both sides are re-checked at accept time, because the offer
     may have been posted before a 7 emptied someone's hand. */
  proposeTrade: (give, want) => {
    const s = get();
    if (s.phase !== "main") return;
    const p = s.players[s.current];
    const gives = (Object.keys(give) as Resource[]).filter((r) => (give[r] ?? 0) > 0);
    const wants = (Object.keys(want) as Resource[]).filter((r) => (want[r] ?? 0) > 0);
    if (!gives.length || !wants.length) return;
    /* a resource on both sides is a no-op dressed up as a deal — reject it
       rather than let someone post "1 Wood for 1 Wood" */
    if (gives.some((r) => wants.includes(r))) { fx.nope(); return; }
    if (!gives.every((r) => p.hand[r] >= (give[r] ?? 0))) { fx.nope(); return; }
    set({
      offer: { from: s.current, give, want, declined: [] },
      log: say(s.log, `${p.name} offers ${gives.map((r) => `${give[r]} ${RESOURCE_LABEL[r]}`).join(" + ")} for ${wants.map((r) => `${want[r]} ${RESOURCE_LABEL[r]}`).join(" + ")}.`),
    });
  },

  cancelTrade: () => {
    const s = get();
    if (!s.offer) return;
    set({ offer: null, log: say(s.log, "Offer withdrawn.") });
  },

  declineTrade: (decliner) => {
    const s = get();
    if (!s.offer || s.offer.declined.includes(decliner)) return;
    set({ offer: { ...s.offer, declined: [...s.offer.declined, decliner] } });
  },

  acceptTrade: (accepter) => {
    const s = get();
    const o = s.offer;
    if (!o || accepter === o.from) return;
    const from = s.players[o.from];
    const to = s.players[accepter];

    /* re-validate BOTH sides now — hands move between offer and accept */
    const giveKeys = Object.keys(o.give) as Resource[];
    const wantKeys = Object.keys(o.want) as Resource[];
    if (!giveKeys.every((r) => from.hand[r] >= (o.give[r] ?? 0))) {
      fx.nope();
      set({ offer: null, log: say(s.log, "Offer lapsed — the offering seat no longer holds it.") });
      return;
    }
    if (!wantKeys.every((r) => to.hand[r] >= (o.want[r] ?? 0))) {
      fx.nope();
      set({ log: say(s.log, `${to.name} can't cover that offer.`) });
      return;
    }

    const players = s.players.map((x) => ({ ...x, hand: { ...x.hand } }));
    giveKeys.forEach((r) => { players[o.from].hand[r] -= o.give[r] ?? 0; players[accepter].hand[r] += o.give[r] ?? 0; });
    wantKeys.forEach((r) => { players[accepter].hand[r] -= o.want[r] ?? 0; players[o.from].hand[r] += o.want[r] ?? 0; });

    fx.gain();
    set({
      players, offer: null,
      log: say(s.log, `${to.name} accepts ${from.name}'s offer.`),
    });
  },

  bankTrade: (give, get_) => {
    const s = get();
    if (s.phase !== "main" || give === get_) return;
    const p = s.players[s.current];
    if (p.hand[give] < 4) return;
    const players = s.players.map((x, i) => i === s.current
      ? { ...x, hand: { ...x.hand, [give]: x.hand[give] - 4, [get_]: x.hand[get_] + 1 } } : x);
    set({ players, log: say(s.log, `${p.name} trades 4 ${RESOURCE_LABEL[give]} for 1 ${RESOURCE_LABEL[get_]}.`) });
  },

  endTurn: () => {
    const s = get();
    if (s.phase !== "main") return;

    /* win is checked on your own turn, hidden pearls included */
    const total = totalScore(s, s.current);
    if (total >= WIN_POINTS) {
      fx.fanfare();
      set({ phase: "over", winner: s.current, log: say(s.log, `${s.players[s.current].name} reaches ${total} points and wins.`) });
      return;
    }

    const next = (s.current + 1) % s.players.length;
    const turnsTaken = [...s.turnsTaken];
    turnsTaken[s.current] += 1;
    set({
      current: next,
      phase: "roll",
      dice: null,
      pending: null,
      caravanLeft: 0,
      playedCardThisTurn: false,
      handRevealed: false,
      offer: null,
      turnNo: s.turnNo + 1,
      turnsTaken,
      log: say(s.log, `${s.players[next].name} to roll.`),
    });
  },
});
});

export { longestHolder, navigatorHolder };
