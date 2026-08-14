/* =========================================================================
   bot.ts — a seat the machine plays
   -------------------------------------------------------------------------
   Pure decision-making: `decide` looks at the table and names ONE action.
   It never touches the store, so every judgement in here can be tested
   against a board built by hand rather than by playing until the case shows
   up. The driver (useBot.ts) is what turns a named action into store calls.

   One action at a time, rather than a plan for the whole turn, because the
   table moves underneath a plan — a rolled 7, an accepted trade, a snapshot
   from another device — and a bot re-reading the board each step can never
   act on a world that has stopped existing.

   It plays a solid opening and a sensible middlegame. It is not trying to
   be a hard opponent; it is trying to be a fourth player who doesn't make
   the game worse.
   ========================================================================= */

import { PIPS } from "./board";
import type { Geometry } from "./geometry";
import { TERRAIN_YIELD, type Board, type Resource } from "./types";
import {
  COST, LIMITS, canAfford, canPlaceBarasti, canPlaceRoute, canUpgradeQasr, handCount, tradeRate,
  type Buildings, type Hand, type Routes,
} from "./rules";
import type { GameState } from "../state/store";

const RESOURCES: Resource[] = ["palmWood", "limestone", "dates", "fish", "pearls"];

/* Rough worth of a resource, from how much of it the cost table demands.
   Pearls are scarcest on the board AND the qasr wants three of them, so
   they carry the most; dates appear in three of the four costs. */
const WORTH: Record<Resource, number> = {
  palmWood: 1, limestone: 1, dates: 1.15, fish: 1, pearls: 1.4,
};

export type BotAction =
  | { kind: "setupBarasti"; vertex: string }
  | { kind: "setupRoute"; edge: string }
  | { kind: "roll" }
  | { kind: "build"; what: "barasti" | "qasr" | "route"; target: string }
  | { kind: "buyDhow" }
  | { kind: "playDhow"; uid: string; arg?: Resource }
  | { kind: "bankTrade"; give: Resource; want: Resource }
  | { kind: "endTurn" }
  | { kind: "discard"; res: Resource }
  | { kind: "moveShamal"; tile: string }
  | { kind: "steal"; victim: number }
  | { kind: "answerOffer"; seat: number; accept: boolean };

/* ---------- board reading ---------- */

/** token -> pips, with the Shamal's tile worth nothing while it sits there. */
function tilePips(board: Board, id: string, shamalTile: string): number {
  if (id === shamalTile) return 0;
  const t = board.tiles.find((x) => x.id === id);
  return t?.token ? (PIPS[t.token] ?? 0) : 0;
}

function tileResource(board: Board, id: string): Resource | null {
  const t = board.tiles.find((x) => x.id === id);
  return t ? TERRAIN_YIELD[t.terrain] : null;
}

/**
 * What a corner is worth to sit on. Pips carry it, but a corner touching
 * three different resources is worth more than a richer one touching the
 * same thing twice — a seat that can't cover a cost has to trade at 4:1,
 * which is how a strong-looking opening stalls.
 */
export function vertexValue(
  v: string, geo: Geometry, board: Board, shamalTile: string,
  hunger?: Partial<Record<Resource, number>>,
): number {
  let score = 0;
  const kinds = new Set<Resource>();
  for (const tid of geo.vertices[v]?.tiles ?? []) {
    const res = tileResource(board, tid);
    if (!res) continue;
    const pips = tilePips(board, tid, shamalTile);
    score += pips * WORTH[res] * (hunger?.[res] ?? 1);
    if (pips > 0) kinds.add(res);
  }
  return score + kinds.size * 1.4;
}

/** How badly this seat wants each resource, given what it's saving toward. */
function hungerFor(hand: Hand, target: Partial<Hand>): Partial<Record<Resource, number>> {
  const out: Partial<Record<Resource, number>> = {};
  for (const r of RESOURCES) {
    const short = Math.max(0, (target[r] ?? 0) - hand[r]);
    out[r] = 1 + short * 0.55;
  }
  return out;
}

/** What this seat still needs for a cost, after what it holds. */
function missing(hand: Hand, cost: Partial<Hand>): Partial<Record<Resource, number>> {
  const out: Partial<Record<Resource, number>> = {};
  for (const r of RESOURCES) {
    const short = (cost[r] ?? 0) - hand[r];
    if (short > 0) out[r] = short;
  }
  return out;
}

const built = (b: Buildings, seat: number, type: "barasti" | "qasr") =>
  Object.values(b).filter((x) => x.player === seat && x.type === type).length;

const routeCount = (r: Routes, seat: number) =>
  Object.values(r).filter((x) => x === seat).length;

/* ---------- opening ---------- */

export function bestSetupVertex(s: GameState, seat: number): string | null {
  /* second time round, lean toward what the first corner didn't cover */
  const owned = Object.entries(s.buildings).filter(([, b]) => b.player === seat).map(([v]) => v);
  const covered = new Set<Resource>();
  for (const v of owned) {
    for (const tid of s.geo.vertices[v]?.tiles ?? []) {
      const r = tileResource(s.board, tid);
      if (r && tilePips(s.board, tid, s.shamalTile) > 0) covered.add(r);
    }
  }
  const hunger: Partial<Record<Resource, number>> = {};
  for (const r of RESOURCES) hunger[r] = covered.has(r) ? 0.75 : 1.35;

  let best: string | null = null, bestScore = -Infinity;
  for (const v of Object.keys(s.geo.vertices)) {
    if (!canPlaceBarasti(v, seat, s.buildings, s.routes, s.geo, true)) continue;
    const score = vertexValue(v, s.geo, s.board, s.shamalTile, owned.length ? hunger : undefined);
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return best;
}

export function bestSetupRoute(s: GameState): string | null {
  const from = s.lastSetupVertex;
  if (!from) return null;
  let best: string | null = null, bestScore = -Infinity;
  for (const e of s.geo.vertexEdges[from] ?? []) {
    if (s.routes[e] !== undefined) continue;
    const edge = s.geo.edges[e];
    const far = edge.a === from ? edge.b : edge.a;
    /* the road is only worth what it opens: score where it lands, plus the
       best corner one step beyond, since that is the real destination */
    const onward = (s.geo.vertexNeighbours[far] ?? [])
      .map((n) => vertexValue(n, s.geo, s.board, s.shamalTile))
      .reduce((m, x) => Math.max(m, x), 0);
    const score = vertexValue(far, s.geo, s.board, s.shamalTile) + onward * 0.6;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

/* ---------- the turn ---------- */

/** The build this seat is saving toward, which drives trading and discards. */
function goal(s: GameState, seat: number): { what: "qasr" | "barasti" | "route"; cost: Partial<Hand> } {
  const canQasr = built(s.buildings, seat, "qasr") < LIMITS.qasr
    && Object.keys(s.buildings).some((v) => canUpgradeQasr(v, seat, s.buildings));
  if (canQasr) return { what: "qasr", cost: COST.qasr };

  const spot = bestBuildVertex(s, seat);
  if (spot && built(s.buildings, seat, "barasti") < LIMITS.barasti) {
    return { what: "barasti", cost: COST.barasti };
  }
  return { what: "route", cost: COST.route };
}

function bestBuildVertex(s: GameState, seat: number): string | null {
  let best: string | null = null, bestScore = -Infinity;
  for (const v of Object.keys(s.geo.vertices)) {
    if (!canPlaceBarasti(v, seat, s.buildings, s.routes, s.geo, false)) continue;
    const score = vertexValue(v, s.geo, s.board, s.shamalTile);
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return best;
}

function bestUpgrade(s: GameState, seat: number): string | null {
  let best: string | null = null, bestScore = -Infinity;
  for (const v of Object.keys(s.buildings)) {
    if (!canUpgradeQasr(v, seat, s.buildings)) continue;
    /* a qasr doubles this corner's output, so upgrade the busiest one */
    const score = vertexValue(v, s.geo, s.board, s.shamalTile);
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return best;
}

/** A route worth laying: one that opens ground we could build on next. */
function bestRoute(s: GameState, seat: number): string | null {
  let best: string | null = null, bestScore = -Infinity;
  for (const e of Object.keys(s.geo.edges)) {
    if (!canPlaceRoute(e, seat, s.buildings, s.routes, s.geo)) continue;
    const edge = s.geo.edges[e];
    const reach = [edge.a, edge.b].map((v) => {
      /* value of a corner we could actually take, one road from here */
      const here = canPlaceBarasti(v, seat, s.buildings, s.routes, s.geo, true)
        ? vertexValue(v, s.geo, s.board, s.shamalTile) : 0;
      const beyond = (s.geo.vertexNeighbours[v] ?? [])
        .filter((n) => canPlaceBarasti(n, seat, s.buildings, s.routes, s.geo, true))
        .map((n) => vertexValue(n, s.geo, s.board, s.shamalTile))
        .reduce((m, x) => Math.max(m, x), 0);
      return Math.max(here, beyond * 0.7);
    });
    const score = Math.max(...reach);
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return bestScore > 0 ? best : null;
}

/**
 * A 4:1 that actually moves us forward: spend from a pile we have spare
 * and can't use, to buy the thing standing between us and the goal.
 */
function bankMove(s: GameState, seat: number, target: Partial<Hand>):
  { give: Resource; want: Resource } | null {
  const hand = s.players[seat].hand;
  const need = missing(hand, target);
  const wanted = (Object.keys(need) as Resource[]).sort((a, b) => (need[b] ?? 0) - (need[a] ?? 0))[0];
  if (!wanted) return null;

  let give: Resource | null = null, spare = 0;
  for (const r of RESOURCES) {
    if (r === wanted) continue;
    /* never trade away what the goal itself needs, and use the seat's real
       rate — a 2:1 post makes trades worth taking that 4:1 never would */
    const rate = tradeRate(seat, r, s.buildings, s.geo);
    const keep = target[r] ?? 0;
    const free = hand[r] - keep;
    if (hand[r] >= rate && free >= rate && free > spare) { spare = free; give = r; }
  }
  return give ? { give, want: wanted } : null;
}

/** Which card to throw when a 7 lands: the least useful surplus. */
export function discardChoice(s: GameState, seat: number): Resource | null {
  const hand = s.players[seat].hand;
  const target = goal(s, seat).cost;
  let worst: Resource | null = null, worstScore = Infinity;
  for (const r of RESOURCES) {
    if (hand[r] <= 0) continue;
    /* keep what the goal needs; beyond that, keep the more valuable card */
    const needed = Math.min(hand[r], target[r] ?? 0);
    const score = needed * 10 + WORTH[r] - hand[r] * 0.2;
    if (score < worstScore) { worstScore = score; worst = r; }
  }
  return worst;
}

/** Where the Shamal hurts most — never on our own ground. */
export function shamalChoice(s: GameState, seat: number, legal: string[]): string | null {
  let best: string | null = null, bestScore = -Infinity;
  for (const t of legal) {
    const corners = s.geo.tileVertices[t] ?? [];
    if (corners.some((v) => s.buildings[v]?.player === seat)) continue; // don't blockade ourselves
    const pips = tilePips(s.board, t, "");
    let score = 0;
    for (const v of corners) {
      const b = s.buildings[v];
      if (!b || b.player === seat) continue;
      const weight = b.type === "qasr" ? 2 : 1;
      /* lean on whoever is ahead — points are the thing being raced for */
      score += pips * weight * (1 + scoreLead(s, b.player) * 0.25);
    }
    if (score > bestScore) { bestScore = score; best = t; }
  }
  /* every option touches us: take the least bad rather than stalling */
  if (!best && legal.length) return legal[0];
  return best;
}

function scoreLead(s: GameState, seat: number): number {
  const mine = Object.values(s.buildings).filter((b) => b.player === seat)
    .reduce((n, b) => n + (b.type === "qasr" ? 2 : 1), 0);
  const top = s.players
    .map((p) => Object.values(s.buildings).filter((b) => b.player === p.id)
      .reduce((n, b) => n + (b.type === "qasr" ? 2 : 1), 0))
    .reduce((m, x) => Math.max(m, x), 0);
  return top ? mine / top : 0;
}

/** Take from whoever can most afford to lose it. */
export function stealChoice(s: GameState, candidates: number[]): number | null {
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => {
    const hands = handCount(s.players[b].hand) - handCount(s.players[a].hand);
    if (hands !== 0) return hands;
    return scoreLead(s, b) - scoreLead(s, a);
  })[0];
}

/**
 * Answer a human's offer. Accept only when the swap genuinely helps: the
 * cards coming in are worth more toward the goal than the cards going out.
 * A bot that accepts anything is a vending machine, and a bot that refuses
 * everything may as well not be at the table.
 */
export function offerAnswer(s: GameState, seat: number): boolean {
  const o = s.offer;
  if (!o) return false;
  const hand = s.players[seat].hand;
  const target = goal(s, seat).cost;
  const hunger = hungerFor(hand, target);

  let gain = 0, loss = 0;
  for (const r of RESOURCES) {
    const inc = o.give[r] ?? 0;   // what the offerer hands over
    const out = o.want[r] ?? 0;   // what we'd give up
    if (out > hand[r]) return false;             // can't cover it
    gain += inc * WORTH[r] * (hunger[r] ?? 1);
    /* giving away something the goal needs costs extra */
    const stillNeeded = Math.max(0, (target[r] ?? 0) - (hand[r] - out));
    loss += out * WORTH[r] * (1 + stillNeeded * 0.8);
  }
  /* require a real margin — a coin-flip trade helps the proposer, who chose
     the terms and knows what they were fishing for */
  return gain > loss * 1.15;
}

/* ---------- the one decision ---------- */

/** Which seat owes the next action, across every phase. */
export function pendingSeat(s: GameState): number | null {
  if (s.phase === "over") return null;
  if (s.phase === "discard") return s.discardQueue[0] ?? null;
  return s.phase === "setup" ? s.setupOrder[s.setupIndex] : s.current;
}

/** Turn a named action into store calls. Kept here, next to the decision it
    executes, so a game can be played headlessly with no React involved. */
export function applyBotAction(s: GameState, a: BotAction) {
  switch (a.kind) {
    case "setupBarasti": s.clickVertex(a.vertex); break;
    case "setupRoute":   s.clickEdge(a.edge); break;
    case "roll":         s.roll(); break;
    case "build":
      /* pending is device-local, so this costs nothing on the wire */
      s.setPending(a.what);
      if (a.what === "route") s.clickEdge(a.target); else s.clickVertex(a.target);
      break;
    case "buyDhow":      s.buyDhow(); break;
    case "playDhow":     s.playDhow(a.uid, a.arg); break;
    case "bankTrade":    s.bankTrade(a.give, a.want); break;
    case "endTurn":      s.endTurn(); break;
    case "discard":      s.discard(a.res); break;
    case "moveShamal":   s.clickTile(a.tile); break;
    case "steal":        s.stealFrom(a.victim); break;
    case "answerOffer":
      if (a.accept) s.acceptTrade(a.seat); else s.declineTrade(a.seat);
      break;
  }
}

/**
 * The next thing this seat should do, or null if it's waiting.
 * `legalShamal` is passed in rather than computed, so this file stays free
 * of store logic.
 */
export function decide(s: GameState, seat: number, legalShamal: () => string[]): BotAction | null {
  /* answering a trade is the only thing a bot does out of turn */
  if (s.phase === "main" && s.offer && s.offer.from !== seat && !s.offer.declined.includes(seat)) {
    return { kind: "answerOffer", seat, accept: offerAnswer(s, seat) };
  }

  if (s.phase === "discard" && s.discardQueue[0] === seat) {
    const r = discardChoice(s, seat);
    return r ? { kind: "discard", res: r } : null;
  }

  if (s.phase === "setup" && s.setupOrder[s.setupIndex] === seat) {
    if (s.setupStage === "barasti") {
      const v = bestSetupVertex(s, seat);
      return v ? { kind: "setupBarasti", vertex: v } : null;
    }
    const e = bestSetupRoute(s);
    return e ? { kind: "setupRoute", edge: e } : null;
  }

  if (s.current !== seat) return null;

  if (s.phase === "roll") return { kind: "roll" };

  if (s.phase === "moveShamal") {
    const t = shamalChoice(s, seat, legalShamal());
    return t ? { kind: "moveShamal", tile: t } : null;
  }

  if (s.phase === "steal") {
    const ids = [...new Set((s.geo.tileVertices[s.shamalTile] ?? [])
      .map((v) => s.buildings[v])
      .filter((b) => b && b.player !== seat && handCount(s.players[b.player].hand) > 0)
      .map((b) => b!.player))];
    const victim = stealChoice(s, ids);
    return victim === null ? null : { kind: "steal", victim };
  }

  if (s.phase !== "main") return null;

  const hand = s.players[seat].hand;

  /* A windbreaker is worth playing when the Shamal is sitting on our own
     production — it moves the blockade AND counts toward Navigator. */
  const blocked = (s.geo.tileVertices[s.shamalTile] ?? [])
    .some((v) => s.buildings[v]?.player === seat);
  if (blocked && !s.playedCardThisTurn) {
    const wb = s.players[seat].cards.find((c) => c.kind === "windbreaker" && c.boughtOnTurn !== s.turnNo);
    if (wb) return { kind: "playDhow", uid: wb.uid };
  }

  /* points first: a qasr is two of them and doubles a corner */
  if (canAfford(hand, COST.qasr) && built(s.buildings, seat, "qasr") < LIMITS.qasr) {
    const v = bestUpgrade(s, seat);
    if (v) return { kind: "build", what: "qasr", target: v };
  }

  if (canAfford(hand, COST.barasti) && built(s.buildings, seat, "barasti") < LIMITS.barasti) {
    const v = bestBuildVertex(s, seat);
    if (v) return { kind: "build", what: "barasti", target: v };
  }

  if (canAfford(hand, COST.route) && routeCount(s.routes, seat) < LIMITS.route) {
    const e = bestRoute(s, seat);
    if (e) return { kind: "build", what: "route", target: e };
  }

  /* nothing to build: bank the surplus into a card rather than sit on it */
  if (canAfford(hand, COST.dhow) && s.deck.length && handCount(hand) >= 4) {
    return { kind: "buyDhow" };
  }

  const target = goal(s, seat).cost;
  const swap = bankMove(s, seat, target);
  if (swap) return { kind: "bankTrade", give: swap.give, want: swap.want };

  return { kind: "endTurn" };
}
