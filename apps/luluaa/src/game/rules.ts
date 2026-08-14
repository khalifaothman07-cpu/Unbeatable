/* =========================================================================
   rules.ts — costs, legality, scoring. Pure functions, no state.
   ========================================================================= */

import type { Geometry, Port } from "./geometry";
import type { Resource } from "./types";

export type Hand = Record<Resource, number>;

export const emptyHand = (): Hand => ({ palmWood: 0, limestone: 0, dates: 0, fish: 0, pearls: 0 });

export const COST = {
  route:   { palmWood: 1, limestone: 1 } as Partial<Hand>,
  barasti: { palmWood: 1, limestone: 1, dates: 1, fish: 1 } as Partial<Hand>,
  qasr:    { dates: 2, pearls: 3 } as Partial<Hand>,
  dhow:    { dates: 1, pearls: 1, fish: 1 } as Partial<Hand>,
};

export const LIMITS = { route: 15, barasti: 5, qasr: 4 };
export const WIN_POINTS = 10;

export function canAfford(hand: Hand, cost: Partial<Hand>): boolean {
  return (Object.keys(cost) as Resource[]).every((r) => hand[r] >= (cost[r] ?? 0));
}

export function pay(hand: Hand, cost: Partial<Hand>): Hand {
  const out = { ...hand };
  (Object.keys(cost) as Resource[]).forEach((r) => (out[r] -= cost[r] ?? 0));
  return out;
}

export function handCount(hand: Hand): number {
  return (Object.values(hand) as number[]).reduce((s, v) => s + v, 0);
}

export interface Building { player: number; type: "barasti" | "qasr" }
export type Buildings = Record<string, Building>;
export type Routes = Record<string, number>; // edge id -> player

/* ---- placement legality ------------------------------------------------- */

/** Distance rule: no building on a vertex adjacent to an existing one. */
export function vertexOpen(v: string, buildings: Buildings, geo: Geometry): boolean {
  if (buildings[v]) return false;
  return geo.vertexNeighbours[v].every((n) => !buildings[n]);
}

/** During setup a barasti may go on any open vertex; afterwards it must
    also touch one of your own routes. */
export function canPlaceBarasti(
  v: string,
  player: number,
  buildings: Buildings,
  routes: Routes,
  geo: Geometry,
  setup: boolean
): boolean {
  if (!vertexOpen(v, buildings, geo)) return false;
  if (setup) return true;
  return geo.vertexEdges[v].some((e) => routes[e] === player);
}

/** A route must connect to your own building or your own route, and an
    opponent's building blocks the through-connection at that vertex. */
export function canPlaceRoute(
  e: string,
  player: number,
  buildings: Buildings,
  routes: Routes,
  geo: Geometry
): boolean {
  if (routes[e] !== undefined) return false;
  const edge = geo.edges[e];
  if (!edge) return false;
  return [edge.a, edge.b].some((v) => {
    const b = buildings[v];
    if (b && b.player === player) return true;
    if (b && b.player !== player) return false; // blocked through an enemy building
    return geo.vertexEdges[v].some((oe) => routes[oe] === player);
  });
}

export function canUpgradeQasr(v: string, player: number, buildings: Buildings): boolean {
  const b = buildings[v];
  return !!b && b.player === player && b.type === "barasti";
}

/* ---- longest trade route ------------------------------------------------
   Longest simple path through a player's own route network. Depth-first
   from every endpoint; boards are small enough that exhaustive search is
   both fast and exactly right, where a heuristic would quietly be wrong. */
export function longestRoute(player: number, routes: Routes, buildings: Buildings, geo: Geometry): number {
  const mine = Object.keys(routes).filter((e) => routes[e] === player);
  if (mine.length === 0) return 0;
  const mineSet = new Set(mine);

  /* an opponent's building severs a path at that vertex */
  const passable = (v: string) => {
    const b = buildings[v];
    return !b || b.player === player;
  };

  let best = 0;
  const walk = (v: string, used: Set<string>, len: number) => {
    if (len > best) best = len;
    if (!passable(v)) return;
    for (const e of geo.vertexEdges[v]) {
      if (!mineSet.has(e) || used.has(e)) continue;
      const edge = geo.edges[e];
      const next = edge.a === v ? edge.b : edge.a;
      used.add(e);
      walk(next, used, len + 1);
      used.delete(e);
    }
  };

  for (const e of mine) {
    const edge = geo.edges[e];
    for (const start of [edge.a, edge.b]) walk(start, new Set(), 0);
  }
  return best;
}

/* ---- scoring ------------------------------------------------------------ */

export interface ScoreInput {
  player: number;
  buildings: Buildings;
  hiddenPearls: number;
  hasLongest: boolean;
  hasNavigator: boolean;
}

/** Public points exclude Hidden Pearls — those only surface on a win. */
export function scoreOf(i: ScoreInput, includeHidden: boolean): number {
  let pts = 0;
  for (const b of Object.values(i.buildings)) {
    if (b.player !== i.player) continue;
    pts += b.type === "qasr" ? 2 : 1;
  }
  if (i.hasLongest) pts += 2;
  if (i.hasNavigator) pts += 2;
  if (includeHidden) pts += i.hiddenPearls;
  return pts;
}

/**
 * What the bank charges this seat for one card of `resource`.
 *
 * 4:1 by default, 3:1 from any trade post you have a building on, 2:1 from
 * a post that deals in that specific resource. Best rate wins — a seat
 * sitting on two posts uses whichever helps.
 */
export function tradeRate(
  seat: number, resource: Resource, buildings: Buildings, geo: Geometry,
): 2 | 3 | 4 {
  let rate: 2 | 3 | 4 = 4;
  for (const [v, b] of Object.entries(buildings)) {
    if (b.player !== seat) continue;
    for (const p of geo.vertexPorts[v] ?? []) {
      if (p.resource === resource) return 2;          // nothing beats this
      if (p.resource === null && rate > 3) rate = 3;
    }
  }
  return rate;
}

/** Every post this seat can currently use — for showing them their options. */
export function seatPorts(seat: number, buildings: Buildings, geo: Geometry): Port[] {
  const out = new Map<string, Port>();
  for (const [v, b] of Object.entries(buildings)) {
    if (b.player !== seat) continue;
    for (const p of geo.vertexPorts[v] ?? []) out.set(p.id, p);
  }
  return [...out.values()];
}
