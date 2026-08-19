/* =========================================================================
   store.ts — the whole game, as one Zustand store
   -------------------------------------------------------------------------
   Four seats, all local by default (pass-and-play). Nothing here touches
   the network until a seat is opened online, so a purely local game has no
   backend dependency at all — the same lazy activation LU'LU'A uses.

   PHASES. A turn is not one step, and pretending it is produces the classic
   bug where a player rolls again while an auction is still open. The phase
   is the single answer to "what is the table waiting for":

     lobby     seats being set up; no game yet
     roll      the seat to play must roll
     resolve   they have landed; the space is being dealt with
     buy       an unowned space is on offer to whoever landed
     auction   nobody bought it, so everyone bids
     debt      someone owes more than they hold and must raise it or fold
     manage    build, mortgage, trade, then end the turn
     over      somebody won

   Jail is not a phase — it is a property of a seat. A jailed seat still
   rolls, and treating it as a phase means writing the whole turn twice.
   ========================================================================= */

import { create } from "zustand";
import {
  claimSeat, createRoom, fetchRoom, makeRoomCode, pollRoom, pushSnapshot,
  remoteConfigured, subscribeRoom, type Claims, type LinkStatus, type Room, type Snapshot,
} from "./sync";
import {
  BAIL, BANK_TOWERS, BANK_VILLAS, BOARD, CAUSEWAY_INDEX, LAP, SALARY, STARTING_CASH,
  VILLAS_PER_TOWER, spacesInGroup,
} from "../game/board";
import { SANDOOQ_CARDS, SHAMAL_CARDS, cardById } from "../game/cards";
import { full, short, type Dinars } from "../game/money";
import {
  TOWER, buildingCounts, buildingRefund, canBuild, canMortgage, canSellBuilding,
  canTrade, canUnmortgage, emptyEstate, holdings, isMortgaged, levelOf, liquidatableTotal,
  mortgageValue, netWorth, ownerOf, rentFor, spaceAt, unmortgageCost,
  type Estate, type Trade,
} from "../game/rules";
import { isOwnable, type Card, type Deck } from "../game/types";

/* -------------------------------------------------------------------------
   SEATS
   Same model as LU'LU'A: a seat is played from this device, from someone
   else's, or by the machine. Only ONE device may drive a seat — two drivers
   means two publishers and a lost move.
   ------------------------------------------------------------------------- */
export type SeatType = "local" | "remote" | "bot";
export interface Seat { type: SeatType; code: string | null }

export const TOKENS = ["dallah", "dhow", "car", "pearl"] as const;
export type Token = (typeof TOKENS)[number];
export const TOKEN_LABEL: Record<Token, string> = {
  dallah: "Dallah", dhow: "Dhow", car: "Racer", pearl: "Pearl",
};

const COLOURS = ["#b4623f", "#1c7d84", "#7a6a2f", "#5c4e7a"];
const NAMES = ["Seat 1", "Seat 2", "Seat 3", "Seat 4"];

export interface Player {
  id: number;
  name: string;
  colour: string;
  token: Token;
  cash: Dinars;
  /** board index 0–39 */
  at: number;
  /** turns left in the Causeway queue; 0 means free */
  stuck: number;
  /** card ids being held back for exactly that */
  passes: string[];
  /** out of the game, everything already handed over */
  bankrupt: boolean;
  /** laps completed, for the short-mode limit */
  laps: number;
}

export type Phase = "lobby" | "roll" | "resolve" | "buy" | "auction" | "debt" | "manage" | "over";

/** A live auction. Everyone still in bids or folds; last one standing pays. */
export interface Auction {
  index: number;
  bid: Dinars;
  /** null until somebody has actually bid */
  leader: number | null;
  /** seats still able to bid, in turn order from `turn` */
  live: number[];
  turn: number;
}

/** A debt that has to be settled before the game can continue. */
export interface Debt {
  seat: number;
  amount: Dinars;
  /** who gets paid — null means the bank */
  to: number | null;
  reason: string;
}

export interface Toggles {
  /** deal every seat two random deeds before the first roll */
  openingDeal: boolean;
  /** stop after this many laps and rank on net worth; 0 = play to bankruptcy */
  lapLimit: number;
}

export const DEFAULT_TOGGLES: Toggles = { openingDeal: false, lapLimit: 0 };

/* -------------------------------------------------------------------------
   RNG — seeded, so a board and its card order can be reproduced from a
   snapshot rather than shipped. Same mulberry32 LU'LU'A uses.
   ------------------------------------------------------------------------- */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

/* ------------------------------------------------------------------------- */

export interface GameState {
  seed: number;
  players: Player[];
  estate: Estate;
  current: number;
  phase: Phase;
  dice: [number, number] | null;
  /** consecutive doubles this turn; three sends you to the Causeway */
  doubles: number;
  /** true once the active seat has rolled and moved this turn */
  rolled: boolean;
  turnNo: number;
  log: string[];
  winner: number | null;
  toggles: Toggles;
  started: boolean;

  /** draw piles, as card ids; drawn cards go to the bottom */
  decks: Record<Deck, string[]>;
  /** the card currently face up, waiting to be acknowledged */
  drawn: Card | null;

  /** the space on offer to whoever just landed */
  offer: number | null;
  auction: Auction | null;
  debt: Debt | null;
  /** one standing offer at a time — a table with four live offers on it is
      a negotiation nobody can follow */
  trade: Trade | null;
  /** offers posted by the seat whose turn it is, reset each turn. A bot
      reads this so it tries a deal once rather than re-proposing the same
      swap forever after it is declined. */
  offersMade: number;

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
  lastPushedAt: string | null;

  newGame: (toggles?: Toggles) => void;
  startGame: () => void;
  setSeatType: (seat: number, type: SeatType) => void;
  setToggles: (t: Partial<Toggles>) => void;

  roll: () => void;
  buy: () => void;
  declineBuy: () => void;
  bid: (amount: Dinars) => void;
  foldBid: () => void;
  acknowledge: () => void;
  build: (index: number) => void;
  sellBuilding: (index: number) => void;
  mortgage: (index: number) => void;
  unmortgage: (index: number) => void;
  payBail: () => void;
  usePass: () => void;
  settleDebt: () => void;
  declareBankrupt: () => void;
  proposeTrade: (t: Trade) => void;
  acceptTrade: () => void;
  declineTrade: () => void;
  endTurn: () => void;

  openSeat: (seat: number) => Promise<void>;
  closeSeat: (seat: number) => void;
  joinRoom: (code: string, seat: number) => Promise<boolean>;
  startSync: () => void;
  stopSync: () => void;
  snapshot: () => Snapshot;
  applySnapshot: (snap: Snapshot) => void;
  acceptRoom: (room: Room) => void;
  publish: () => void;
}

export type LinkState = "offline" | "connecting" | "live" | "error";

const say = (log: string[], msg: string) => [msg, ...log].slice(0, 60);

function makePlayers(): Player[] {
  return NAMES.map((name, id) => ({
    id, name, colour: COLOURS[id], token: TOKENS[id],
    cash: STARTING_CASH, at: 0, stuck: 0, passes: [], bankrupt: false, laps: 0,
  }));
}

function freshDecks(rng: () => number): Record<Deck, string[]> {
  return {
    shamal: shuffle(SHAMAL_CARDS.map((c) => c.id), rng),
    sandooq: shuffle(SANDOOQ_CARDS.map((c) => c.id), rng),
  };
}

/** Seats still in the game. */
export const solvent = (s: GameState): Player[] => s.players.filter((p) => !p.bankrupt);

/** Whose turn it is — the only seat allowed to act, bar an auction. */
export const activeSeat = (s: GameState): number => s.current;

/* Same ownership rule as LU'LU'A, and for the same reason. */
export function drivesSeat(s: Pick<GameState, "roomCode" | "mySeat" | "seats">, seat: number): boolean {
  const type = s.seats[seat]?.type;
  if (!s.roomCode) return true;
  if (s.mySeat === null || s.mySeat < 0) return type === "local" || type === "bot";
  return s.mySeat === seat;
}

/** Whether a PERSON at this device may act for a seat. */
export function playableSeat(s: Pick<GameState, "roomCode" | "mySeat" | "seats">, seat: number): boolean {
  return drivesSeat(s, seat) && s.seats[seat]?.type !== "bot";
}

export const useGame = create<GameState>((rawSet, get) => {
  /* -----------------------------------------------------------------------
     ONE CHOKE POINT FOR PUBLISHING
     Sprinkling publish() through twenty actions guarantees somebody forgets
     one and a seat silently desyncs. Instead every set() that touches TABLE
     state publishes, and the keys that describe only THIS DEVICE are listed
     out so writing them never does.
     ----------------------------------------------------------------------- */
  const LOCAL_ONLY = new Set([
    "syncing", "mySeat", "lastPushedAt", "roomCode", "link", "rev", "claims",
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

  /* ---- helpers that read and write through set/get ---- */

  /** Move cash. Negative `amount` takes it. Never lets a balance go under
      zero silently — a shortfall becomes a debt the phase machine handles. */
  function pay(seat: number, amount: Dinars) {
    set({ players: get().players.map((p) => (p.id === seat ? { ...p, cash: p.cash + amount } : p)) });
  }

  /** Charge a seat. Returns true if it went through; false means they are
      short and a debt has been opened. */
  function charge(seat: number, amount: Dinars, to: number | null, reason: string): boolean {
    const s = get();
    const p = s.players[seat];
    if (p.cash >= amount) {
      pay(seat, -amount);
      if (to !== null) pay(to, amount);
      return true;
    }
    set({ phase: "debt", debt: { seat, amount, to, reason } });
    return false;
  }

  /** Advance a seat, paying salary for each pass of Bab Al Bahrain. */
  function moveTo(seat: number, target: number, collectSalary = true) {
    const s = get();
    const from = s.players[seat].at;
    const passed = target < from || (target === 0 && from !== 0);
    set({
      players: s.players.map((p) => {
        if (p.id !== seat) return p;
        const laps = passed && collectSalary ? p.laps + 1 : p.laps;
        const cash = passed && collectSalary ? p.cash + SALARY : p.cash;
        return { ...p, at: target, laps, cash };
      }),
    });
    if (passed && collectSalary) {
      set({ log: say(get().log, `${s.players[seat].name} passes Bab Al Bahrain — ${full(SALARY)}.`) });
    }
  }

  function sendToCauseway(seat: number) {
    const s = get();
    set({
      players: s.players.map((p) => (p.id === seat ? { ...p, at: CAUSEWAY_INDEX, stuck: 3 } : p)),
      doubles: 0,
      log: say(s.log, `${s.players[seat].name} is stuck on the Causeway.`),
    });
  }

  /** Draw the top card of a deck, sending it to the bottom.
      EXCEPT the keep-until-needed card: that one leaves the pile entirely
      while somebody is holding it, or two seats end up holding the same
      card and the deck quietly hands out more passes than it contains. */
  function draw(deck: Deck): Card {
    const s = get();
    const pile = s.decks[deck];
    const id = pile[0];
    const card = cardById(id)!;
    const rest = pile.slice(1);
    set({ decks: { ...s.decks, [deck]: card.effect.kind === "getOutFree" ? rest : [...rest, id] } });
    return card;
  }

  /** Put a held pass back under its deck. */
  function returnCard(id: string) {
    const card = cardById(id);
    if (!card) return;
    const s = get();
    set({ decks: { ...s.decks, [card.deck]: [...s.decks[card.deck], id] } });
  }

  return {
    seed: freshSeed(),
    players: makePlayers(),
    estate: emptyEstate(),
    current: 0,
    phase: "lobby",
    dice: null,
    doubles: 0,
    rolled: false,
    turnNo: 0,
    log: ["Set the table, then start."],
    winner: null,
    toggles: { ...DEFAULT_TOGGLES },
    started: false,
    decks: freshDecks(makeRng(1)),
    drawn: null,
    offer: null,
    auction: null,
    debt: null,
    trade: null,
    offersMade: 0,
    seats: [0, 1, 2, 3].map(() => ({ type: "local" as SeatType, code: null })),
    roomCode: null,
    mySeat: null,
    syncing: false,
    link: "offline" as LinkState,
    rev: 0,
    claims: {} as Claims,
    lastPushedAt: null,

    newGame: (toggles) => {
      /* leave the old table first, or its snapshots keep arriving and stamp
         the abandoned game back over the fresh board */
      get().stopSync();
      const seed = freshSeed();
      set({
        seed,
        players: makePlayers(),
        estate: emptyEstate(),
        current: 0,
        phase: "lobby",
        dice: null,
        doubles: 0,
        rolled: false,
        turnNo: 0,
        log: ["Set the table, then start."],
        winner: null,
        toggles: toggles ?? get().toggles,
        started: false,
        decks: freshDecks(makeRng(seed)),
        drawn: null,
        offer: null,
        auction: null,
        debt: null,
        trade: null,
        offersMade: 0,
        seats: [0, 1, 2, 3].map(() => ({ type: "local" as SeatType, code: null })),
        roomCode: null,
        mySeat: null,
        syncing: false,
        link: "offline",
        rev: 0,
        claims: {},
        lastPushedAt: null,
      });
    },

    setSeatType: (seat, type) => {
      const s = get();
      if (s.started) return;
      if (s.seats[seat]?.type === type) return;
      if (s.seats[seat]?.type === "remote" || type === "remote") return;
      set({
        seats: s.seats.map((x, i) => (i === seat ? { ...x, type } : x)),
        log: say(s.log, type === "bot" ? `Seat ${seat + 1} is played by a bot.` : `Seat ${seat + 1} is yours again.`),
      });
    },

    setToggles: (t) => {
      if (get().started) return;
      set({ toggles: { ...get().toggles, ...t } });
    },

    /* Leaving the lobby is one-way, same as LU'LU'A: seat setup stays out of
       reach for the rest of the game so a stray tap can't reset it. */
    startGame: () => {
      const s = get();
      if (s.started) return;
      const rng = makeRng(s.seed);
      let estate = s.estate;
      let log = s.log;

      if (s.toggles.openingDeal) {
        /* Two deeds each, dealt at random from everything ownable. Skips the
           slow opening lap where nothing happens but landing on empty
           squares. */
        const pool = shuffle(BOARD.filter(isOwnable).map((x) => x.index), rng);
        estate = { ...emptyEstate() };
        pool.slice(0, s.players.length * 2).forEach((index, n) => {
          estate.owner[index] = n % s.players.length;
        });
        log = say(log, "Opening deal — two deeds to every seat.");
      }

      set({
        started: true,
        estate,
        phase: "roll",
        log: say(log, `Table is set. ${s.players[0].name} to roll.`),
      });
    },

    roll: () => {
      const s = get();
      if (s.phase !== "roll") return;
      const me = s.players[s.current];
      const d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      const total = d1 + d2;
      const isDouble = d1 === d2;

      /* --- stuck on the Causeway --- */
      if (me.stuck > 0) {
        if (isDouble) {
          set({
            dice: [d1, d2], rolled: true, doubles: 0,
            players: s.players.map((p) => (p.id === s.current ? { ...p, stuck: 0 } : p)),
            log: say(s.log, `${me.name} rolls ${d1}+${d2} — doubles, and through the queue.`),
          });
          moveTo(s.current, (me.at + total) % LAP);
          get().acknowledge();
          return;
        }
        const left = me.stuck - 1;
        set({
          dice: [d1, d2], rolled: true,
          players: s.players.map((p) => (p.id === s.current ? { ...p, stuck: left } : p)),
          phase: "manage",
          log: say(s.log, left > 0
            ? `${me.name} rolls ${d1}+${d2} — still in the queue, ${left} turn${left === 1 ? "" : "s"} left.`
            : `${me.name} pays the fine and clears the queue next turn.`),
        });
        if (left === 0) charge(s.current, BAIL, null, "Causeway fine");
        return;
      }

      /* --- three doubles in a row --- */
      const runningDoubles = isDouble ? s.doubles + 1 : 0;
      if (runningDoubles >= 3) {
        set({ dice: [d1, d2], rolled: true, log: say(s.log, `${me.name} rolls a third double — pulled over.`) });
        sendToCauseway(s.current);
        set({ phase: "manage" });
        return;
      }

      set({
        dice: [d1, d2],
        doubles: runningDoubles,
        rolled: true,
        log: say(s.log, `${me.name} rolls ${d1} + ${d2} = ${total}${isDouble ? " (doubles)" : ""}.`),
      });
      moveTo(s.current, (me.at + total) % LAP);
      get().acknowledge();
    },

    /* Deal with wherever the active seat has landed. Also the button that
       clears a face-up card. */
    acknowledge: () => {
      const s = get();
      if (s.drawn) {
        const card = s.drawn;
        set({ drawn: null });
        applyCard(card);
        return;
      }
      const me = s.players[s.current];
      const space = spaceAt(me.at);

      if (isOwnable(space)) {
        const owner = ownerOf(s.estate, me.at);
        if (owner === null) {
          set({ phase: "buy", offer: me.at, log: say(s.log, `${me.name} lands on ${space.name} — unowned.`) });
          return;
        }
        if (owner === s.current) {
          set({ phase: "manage", log: say(s.log, `${me.name} is home at ${space.name}.`) });
          return;
        }
        if (isMortgaged(s.estate, me.at)) {
          set({ phase: "manage", log: say(s.log, `${space.name} is mortgaged — nothing to pay.`) });
          return;
        }
        const roll = s.dice ? s.dice[0] + s.dice[1] : 7;
        const rent = rentFor(s.estate, me.at, roll, s.current);
        set({ log: say(s.log, `${me.name} owes ${s.players[owner].name} ${full(rent)} at ${space.name}.`) });
        if (charge(s.current, rent, owner, `rent at ${space.name}`)) set({ phase: "manage" });
        return;
      }

      switch (space.kind) {
        case "shamal":
        case "sandooq": {
          const card = draw(space.kind);
          set({ drawn: card, log: say(get().log, `${me.name} draws ${space.kind === "shamal" ? "Shamal" : "Sandooq"}.`) });
          return;
        }
        case "tax": {
          const flat = space.amount!;
          /* VAT offers the percentage as an alternative; the Municipality
             Fee is flat. Taking the cheaper of the two automatically is the
             kindest reading and avoids a prompt nobody enjoys. */
          const owed = space.percent
            ? Math.min(flat, Math.round((netWorth(s.estate, me.cash, s.current) * space.percent) / 100))
            : flat;
          set({ log: say(s.log, `${me.name} pays ${space.name} — ${full(owed)}.`) });
          if (charge(s.current, owed, null, space.name)) set({ phase: "manage" });
          return;
        }
        case "borderCheck":
          sendToCauseway(s.current);
          set({ phase: "manage" });
          return;
        case "go":
        case "gahwa":
        case "causeway":
        default:
          set({ phase: "manage" });
      }
    },

    buy: () => {
      const s = get();
      if (s.phase !== "buy" || s.offer === null) return;
      const index = s.offer;
      const space = spaceAt(index);
      const price = space.deed!.price;
      const me = s.players[s.current];
      if (me.cash < price) return;
      pay(s.current, -price);
      set({
        estate: { ...s.estate, owner: { ...s.estate.owner, [index]: s.current } },
        offer: null,
        phase: "manage",
        log: say(s.log, `${me.name} buys ${space.name} for ${full(price)}.`),
      });
    },

    /* Declining does NOT skip the space — it goes to auction, which is the
       rule that stops a cash-poor table from stalling and is the single most
       commonly dropped rule in the original. */
    declineBuy: () => {
      const s = get();
      if (s.phase !== "buy" || s.offer === null) return;
      const index = s.offer;
      const live = solvent(s).map((p) => p.id);
      set({
        offer: null,
        phase: "auction",
        auction: { index, bid: 0, leader: null, live, turn: 0 },
        log: say(s.log, `${spaceAt(index).name} goes to auction.`),
      });
    },

    bid: (amount) => {
      const s = get();
      const a = s.auction;
      if (!a) return;
      const seat = a.live[a.turn];
      if (amount <= a.bid || amount > s.players[seat].cash) return;
      set({
        auction: { ...a, bid: amount, leader: seat, turn: (a.turn + 1) % a.live.length },
        log: say(s.log, `${s.players[seat].name} bids ${short(amount)}.`),
      });
    },

    foldBid: () => {
      const s = get();
      const a = s.auction;
      if (!a) return;
      const seat = a.live[a.turn];
      const live = a.live.filter((x) => x !== seat);
      const log = say(s.log, `${s.players[seat].name} is out.`);

      if (live.length === 0) {
        /* everyone folded without a bid — the space stays with the bank */
        set({ auction: null, phase: "manage", log: say(log, "Nobody bids. It stays with the bank.") });
        return;
      }
      if (live.length === 1 && a.leader !== null) {
        const winner = a.leader;
        pay(winner, -a.bid);
        set({
          estate: { ...s.estate, owner: { ...s.estate.owner, [a.index]: winner } },
          auction: null,
          phase: "manage",
          log: say(log, `${s.players[winner].name} takes ${spaceAt(a.index).name} for ${full(a.bid)}.`),
        });
        return;
      }
      /* keep the turn pointing at whoever is now in that slot */
      const turn = a.turn % live.length;
      set({ auction: { ...a, live, turn }, log });
    },

    build: (index) => {
      const s = get();
      const me = s.players[s.current];
      if (!canBuild(s.estate, s.current, index, me.cash).ok) return;
      const cost = spaceAt(index).deed!.buildCost;
      const level = levelOf(s.estate, index) + 1;
      pay(s.current, -cost);
      set({
        estate: { ...s.estate, level: { ...s.estate.level, [index]: level } },
        log: say(s.log, level === TOWER
          ? `${me.name} raises a tower at ${spaceAt(index).name}.`
          : `${me.name} builds villa ${level} at ${spaceAt(index).name}.`),
      });
    },

    sellBuilding: (index) => {
      const s = get();
      if (!canSellBuilding(s.estate, s.current, index).ok) return;
      const level = levelOf(s.estate, index) - 1;
      pay(s.current, buildingRefund(index));
      set({
        estate: { ...s.estate, level: { ...s.estate.level, [index]: level } },
        log: say(s.log, `${s.players[s.current].name} sells a building at ${spaceAt(index).name}.`),
      });
    },

    mortgage: (index) => {
      const s = get();
      if (!canMortgage(s.estate, s.current, index).ok) return;
      pay(s.current, mortgageValue(index));
      set({
        estate: { ...s.estate, mortgaged: { ...s.estate.mortgaged, [index]: true } },
        log: say(s.log, `${s.players[s.current].name} mortgages ${spaceAt(index).name} for ${full(mortgageValue(index))}.`),
      });
    },

    unmortgage: (index) => {
      const s = get();
      const me = s.players[s.current];
      if (!canUnmortgage(s.estate, s.current, index, me.cash).ok) return;
      pay(s.current, -unmortgageCost(index));
      const mortgaged = { ...s.estate.mortgaged };
      delete mortgaged[index];
      set({
        estate: { ...s.estate, mortgaged },
        log: say(s.log, `${me.name} clears the mortgage on ${spaceAt(index).name}.`),
      });
    },

    payBail: () => {
      const s = get();
      const me = s.players[s.current];
      if (me.stuck <= 0 || me.cash < BAIL) return;
      pay(s.current, -BAIL);
      set({
        players: get().players.map((p) => (p.id === s.current ? { ...p, stuck: 0 } : p)),
        log: say(s.log, `${me.name} pays ${full(BAIL)} and clears the queue.`),
      });
    },

    usePass: () => {
      const s = get();
      const me = s.players[s.current];
      if (me.stuck <= 0 || me.passes.length === 0) return;
      const used = me.passes[0];
      set({
        players: s.players.map((p) => (p.id === s.current ? { ...p, stuck: 0, passes: p.passes.slice(1) } : p)),
        log: say(s.log, `${me.name} talks their way through.`),
      });
      returnCard(used);
    },

    /* The debt phase ends one of two ways: they raise the money by selling
       and mortgaging, or they fold. Nothing else can happen meanwhile. */
    settleDebt: () => {
      const s = get();
      const d = s.debt;
      if (!d) return;
      const p = s.players[d.seat];
      if (p.cash < d.amount) return;
      pay(d.seat, -d.amount);
      if (d.to !== null) pay(d.to, d.amount);
      set({ debt: null, phase: "manage", log: say(s.log, `${p.name} settles ${full(d.amount)}.`) });
    },

    declareBankrupt: () => {
      const s = get();
      const d = s.debt;
      if (!d) return;
      const p = s.players[d.seat];
      const estate = { owner: { ...s.estate.owner }, level: { ...s.estate.level }, mortgaged: { ...s.estate.mortgaged } };
      const mine = holdings(s.estate, d.seat);

      if (d.to !== null) {
        /* everything transfers, buildings sold back to the bank first */
        let refund = 0;
        for (const i of mine) {
          const lvl = levelOf(s.estate, i);
          if (lvl > 0) { refund += (lvl === TOWER ? TOWER : lvl) * buildingRefund(i); delete estate.level[i]; }
          estate.owner[i] = d.to;
        }
        pay(d.to, p.cash + refund);
      } else {
        /* to the bank: the deeds come back, unowned and undeveloped */
        for (const i of mine) { delete estate.owner[i]; delete estate.level[i]; delete estate.mortgaged[i]; }
      }

      for (const id of p.passes) returnCard(id);
      const players = get().players.map((x) =>
        x.id === d.seat ? { ...x, cash: 0, bankrupt: true, passes: [] } : x);
      set({
        players, estate, debt: null,
        log: say(s.log, `${p.name} is out${d.to !== null ? `, and everything goes to ${s.players[d.to].name}` : ""}.`),
      });
      finishOrContinue();
      /* The seat that just folded was the one whose turn it was, and nothing
         has moved the turn on. Leaving it here parks the table in the debt
         phase with no debt in it and nobody able to act — which is exactly
         the shape of failure four bots playing each other are here to find. */
      if (get().phase !== "over") passTurn();
    },

    /* --- TRADING ---------------------------------------------------------
       Composed by one seat, accepted by another, and re-checked in between.
       The offer is a description of a swap, never a promise that it is
       still possible: a 7 between composing and accepting can empty the
       wallet the offer was counting on. */
    proposeTrade: (t) => {
      const s = get();
      if (s.phase !== "manage" && s.phase !== "debt") return;
      const cash = (seat: number) => s.players[seat].cash;
      const v = canTrade(s.estate, cash, t);
      if (!v.ok) { set({ log: say(s.log, v.reason!) }); return; }
      set({
        trade: t,
        offersMade: s.offersMade + 1,
        log: say(s.log, `${s.players[t.from].name} offers ${s.players[t.to].name} a deal.`),
      });
    },

    declineTrade: () => {
      const s = get();
      if (!s.trade) return;
      set({ trade: null, log: say(s.log, `${s.players[s.trade.to].name} says no.`) });
    },

    acceptTrade: () => {
      const s = get();
      const t = s.trade;
      if (!t) return;
      /* the check that matters: everything is re-read now, not as it was
         when the offer went up */
      const cash = (seat: number) => s.players[seat].cash;
      const v = canTrade(s.estate, cash, t);
      if (!v.ok) {
        set({ trade: null, log: say(s.log, `The deal lapsed — ${v.reason!.toLowerCase()}`) });
        return;
      }
      const owner = { ...s.estate.owner };
      for (const i of t.giveDeeds) owner[i] = t.to;
      for (const i of t.wantDeeds) owner[i] = t.from;
      const players = s.players.map((p) => {
        if (p.id === t.from) return { ...p, cash: p.cash - t.giveCash + t.wantCash };
        if (p.id === t.to) return { ...p, cash: p.cash + t.giveCash - t.wantCash };
        return p;
      });
      set({
        estate: { ...s.estate, owner },
        players,
        trade: null,
        log: say(s.log, `${s.players[t.to].name} takes the deal.`),
      });
    },

    /* --- TABLE / SEATS ---------------------------------------------------
       Flipping the first seat to remote is what creates the row; until then
       the game is purely local and never touches the network. */
    openSeat: async (seatId: number) => {
      const s = get();
      if (s.started) return;
      if (!remoteConfigured) {
        set({ log: say(s.log, "Online seats aren't configured on this build.") });
        return;
      }
      const code = s.roomCode ?? makeRoomCode();
      const seats = s.seats.map((x, i) => (i === seatId ? { ...x, type: "remote" as SeatType, code } : x));
      const first = !s.roomCode;
      set({ seats, roomCode: code, syncing: true, link: "connecting", mySeat: s.mySeat ?? -1 });

      /* Don't announce a room code until the row actually exists. Showing
         one optimistically means handing friends a link to a table that was
         never created, and nobody can tell why it doesn't work. */
      const wrote = first
        ? await createRoom(code, get().snapshot())
        : (await pushSnapshot(code, get().snapshot(), s.rev + 1)) === "ok";

      if (!wrote) {
        set({
          seats: s.seats, roomCode: s.roomCode, syncing: s.syncing, link: "error", mySeat: s.mySeat,
          log: say(s.log, "Couldn't reach the table server — the seat is still local."),
        });
        return;
      }
      if (first) set({ rev: 1 });
      set({ log: say(get().log, `Seat ${seatId + 1} opened online — room code ${code}.`) });
      get().startSync();
    },

    closeSeat: (seatId: number) => {
      const s = get();
      if (s.started) return;
      set({
        seats: s.seats.map((x, i) => (i === seatId ? { ...x, type: "local" as SeatType } : x)),
        log: say(s.log, `Seat ${seatId + 1} is local again.`),
      });
    },

    joinRoom: async (code: string, seatId: number) => {
      if (!remoteConfigured) return false;
      const room = code.toUpperCase();
      const got = await fetchRoom(room);
      if (!got) return false;
      get().applySnapshot(got.snapshot);
      set({ rev: got.rev, claims: got.claims });

      /* Only a seat the host actually opened can be joined. Taking one that
         is still local would leave two devices driving it, each silently
         overwriting the other's moves. */
      if (get().seats[seatId]?.type !== "remote") {
        set({ log: say(get().log, `Seat ${seatId + 1} isn't open online.`) });
        return false;
      }

      /* Claim through the database, not through a snapshot push: a joining
         device is by definition not the one whose turn it is, so anything it
         wrote to the game state would be a stale overwrite. The RPC is
         atomic and refuses a seat that is already taken. */
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
      const unsubLive = subscribeRoom(s.roomCode, take, (st: LinkStatus) =>
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

    /** The serialisable slice. The board is fixed, so nothing is derived and
        everything that matters travels. */
    snapshot: (): Snapshot => {
      const s = get();
      return {
        v: 1,
        updatedAt: new Date().toISOString(),
        state: {
          players: s.players, estate: s.estate, current: s.current, phase: s.phase,
          dice: s.dice, doubles: s.doubles, rolled: s.rolled, turnNo: s.turnNo,
          log: s.log, winner: s.winner, toggles: s.toggles, started: s.started,
          decks: s.decks, drawn: s.drawn, offer: s.offer, auction: s.auction,
          debt: s.debt, trade: s.trade, offersMade: s.offersMade, seats: s.seats,
        },
      };
    },

    applySnapshot: (snap: Snapshot) => {
      applying = true;
      try {
        set({ ...(snap.state as object), lastPushedAt: snap.updatedAt });
      } finally {
        applying = false;
      }
    },

    /** Adopt a room read. Older or equal revisions are our own echo, or a
        device that has fallen behind — either way, not news. */
    acceptRoom: (room: Room) => {
      const s = get();
      /* claims are server-owned and monotonic, so they are worth taking even
         when the snapshot alongside them is one we already have */
      if (room.claims) set({ claims: room.claims });
      if (room.rev <= s.rev) return;
      s.applySnapshot(room.snapshot);
      set({ rev: room.rev });
    },

    publish: () => {
      const s = get();
      if (!s.roomCode || !s.syncing) return;
      const code = s.roomCode;
      const next = s.rev + 1;
      const snap = s.snapshot();
      set({ lastPushedAt: snap.updatedAt, rev: next });
      void pushSnapshot(code, snap, next).then((res) => {
        /* Someone else advanced the table first. Our snapshot described a
           board that no longer exists, so take theirs rather than retry ours
           — retrying is exactly the overwrite this guard exists to stop. */
        if (res !== "stale") return;
        void fetchRoom(code).then((room) => { if (room) get().acceptRoom(room); });
      });
    },

    endTurn: () => {
      const s = get();
      if (s.phase !== "manage") return;

      /* doubles roll again — unless they landed you in the queue */
      const me = s.players[s.current];
      if (s.doubles > 0 && me.stuck === 0) {
        set({ phase: "roll", rolled: false, log: say(s.log, `${me.name} rolled doubles — again.`) });
        return;
      }

      passTurn();
      finishOrContinue();
    },
  };

  /* ---------------------------------------------------------------------
     Card effects and end conditions live down here because they are called
     from several places and reading them inline would bury the turn.
     --------------------------------------------------------------------- */

  function applyCard(card: Card) {
    const s = get();
    const seat = s.current;
    const me = s.players[seat];
    const e = card.effect;
    set({ log: say(s.log, `${me.name}: ${card.text}`) });

    switch (e.kind) {
      case "goTo":
        moveTo(seat, e.index, e.collectSalary !== false);
        get().acknowledge();
        return;
      case "step": {
        const target = (me.at + e.spaces + LAP) % LAP;
        /* stepping back past Bab Al Bahrain does not pay — you did not
           pass it going forward */
        moveTo(seat, target, false);
        get().acknowledge();
        return;
      }
      case "collect":
        pay(seat, e.amount);
        set({ phase: "manage" });
        return;
      case "pay":
        if (charge(seat, e.amount, null, card.text)) set({ phase: "manage" });
        return;
      case "collectEach": {
        const others = solvent(get()).filter((p) => p.id !== seat);
        let taken = 0;
        for (const o of others) {
          const give = Math.min(o.cash, e.amount);
          pay(o.id, -give);
          taken += give;
        }
        pay(seat, taken);
        set({ phase: "manage" });
        return;
      }
      case "payEach": {
        const others = solvent(get()).filter((p) => p.id !== seat);
        const total = e.amount * others.length;
        if (!charge(seat, total, null, card.text)) return;
        for (const o of others) pay(o.id, e.amount);
        set({ phase: "manage" });
        return;
      }
      case "repairs": {
        const { villas, towers } = buildingCounts(get().estate, seat);
        const owed = villas * e.perVilla + towers * e.perTower;
        if (owed === 0) { set({ phase: "manage" }); return; }
        if (charge(seat, owed, null, "repairs")) set({ phase: "manage" });
        return;
      }
      case "toCauseway":
        sendToCauseway(seat);
        set({ phase: "manage" });
        return;
      case "getOutFree":
        set({
          players: get().players.map((p) => (p.id === seat ? { ...p, passes: [...p.passes, card.id] } : p)),
          phase: "manage",
        });
        return;
    }
  }

  /** Hand the turn to the next seat still standing. */
  function passTurn() {
    const s = get();
    const n = s.players.length;
    let next = s.current;
    for (let i = 1; i <= n; i++) {
      const cand = (s.current + i) % n;
      if (!s.players[cand].bankrupt) { next = cand; break; }
    }
    set({
      current: next,
      phase: "roll",
      dice: null,
      doubles: 0,
      rolled: false,
      /* an offer does not outlive the turn it was made on */
      trade: null,
      offersMade: 0,
      turnNo: s.turnNo + 1,
      log: say(s.log, `${s.players[next].name} to roll.`),
    });
  }

  /** Called after anything that could end the game. */
  function finishOrContinue() {
    const s = get();
    const left = solvent(s);

    if (left.length === 1) {
      set({ phase: "over", winner: left[0].id, log: say(s.log, `${left[0].name} owns the island.`) });
      return;
    }

    const limit = s.toggles.lapLimit;
    if (limit > 0 && left.every((p) => p.laps >= limit)) {
      /* Everyone has finished the same number of laps, so nobody gets an
         extra turn's worth of rent that the others did not. */
      const ranked = [...left].sort(
        (a, b) => netWorth(s.estate, b.cash, b.id) - netWorth(s.estate, a.cash, a.id));
      set({
        phase: "over",
        winner: ranked[0].id,
        log: say(s.log, `${limit} laps done — ${ranked[0].name} is richest.`),
      });
    }
  }
});

/* -------------------------------------------------------------------------
   APPLYING A BOT'S DECISION
   -------------------------------------------------------------------------
   Lives here rather than in bot.ts so that bot.ts can stay pure — it decides
   what to do, this turns that into a call. The self-play test drives the
   game through this exact function, so the bots in a test are running the
   same code path as the bots on the page.
   ------------------------------------------------------------------------- */
export function applyBotAction(s: GameState, action: import("../game/bot").BotAction): void {
  switch (action.kind) {
    case "roll": return s.roll();
    case "acknowledge": return s.acknowledge();
    case "buy": return s.buy();
    case "declineBuy": return s.declineBuy();
    case "bid": return s.bid(action.amount);
    case "foldBid": return s.foldBid();
    case "build": return s.build(action.index);
    case "sellBuilding": return s.sellBuilding(action.index);
    case "mortgage": return s.mortgage(action.index);
    case "unmortgage": return s.unmortgage(action.index);
    case "payBail": return s.payBail();
    case "usePass": return s.usePass();
    case "settleDebt": return s.settleDebt();
    case "declareBankrupt": return s.declareBankrupt();
    case "propose": return s.proposeTrade(action.trade);
    case "acceptTrade": return s.acceptTrade();
    case "declineTrade": return s.declineTrade();
    case "endTurn": return s.endTurn();
  }
}

/* Re-exported so the UI never has to import from two places. */
export {
  BANK_TOWERS, BANK_VILLAS, VILLAS_PER_TOWER, BOARD, SALARY, STARTING_CASH, BAIL, spacesInGroup,
};
export { netWorth, liquidatableTotal, holdings, levelOf, ownerOf, isMortgaged, spaceAt, TOWER };
export type { Estate };
