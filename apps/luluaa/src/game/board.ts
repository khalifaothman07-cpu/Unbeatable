/* =========================================================================
   board.ts — octagon layout + per-game randomisation
   -------------------------------------------------------------------------
   Every new game regenerates the board from scratch. The seed is derived
   from crypto/Date.now() (never fixed), but generation is deterministic
   GIVEN a seed — so the seed alone is enough to rebuild an identical board
   on reconnect, without shipping the whole tile array around.
   ========================================================================= */

import { axialKey, isAdjacent, type Axial } from "./hex";
import { DEFAULT_BOARD, type Board, type BoardConfig, type Terrain, type Tile } from "./types";

/* ---- RNG ---------------------------------------------------------------
   mulberry32: tiny, fast, deterministic from a 32-bit seed. We only need
   "unpredictable between games", not cryptographic quality — but the SEED
   itself is drawn from crypto where available. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function freshSeed(): string {
  const buf = new Uint32Array(2);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    buf[0] = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    buf[1] = (Math.random() * 0xffffffff) >>> 0;
  }
  return `${buf[0].toString(36)}-${buf[1].toString(36)}`;
}

/** FNV-1a over the seed string. Exported so anything else derived from the
    board — trade posts, for one — can take its own independent stream from
    the same seed and still land identically on every device. */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ---- shuffling ---------------------------------------------------------- */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ---- layout -------------------------------------------------------------
   Build the octagon coordinate slots from the row profile. Rows are only
   roughly centred here; the renderer normalises by bounding box, which
   keeps this function honest about layout and nothing else. */
export function layoutHexes(rows: number[]): Axial[] {
  const centreRow = (rows.length - 1) / 2;
  const hexes: Axial[] = [];
  rows.forEach((count, i) => {
    const r = Math.round(i - centreRow);
    const qStart = -Math.floor((count - 1) / 2) - Math.floor(r / 2);
    for (let k = 0; k < count; k++) hexes.push({ q: qStart + k, r });
  });
  return hexes;
}

/* ---- number tokens ------------------------------------------------------
   Pip weighting: 6 & 8 are 5-pip (most likely), down to 2 & 12 at 1 pip.
   The pool is built PROPORTIONALLY to pips and then sized to the tile count
   by largest-remainder, so changing the board size keeps the probability
   curve intact instead of needing a new hardcoded list. */
export const PIPS: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
  8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

/** Numbers that must never touch each other — the high-production ones. */
export const HOT_NUMBERS = new Set([6, 8]);

export function buildNumberPool(count: number): number[] {
  const numbers = Object.keys(PIPS).map(Number);
  const totalPips = numbers.reduce((s, n) => s + PIPS[n], 0);

  const exact = numbers.map((n) => ({ n, want: (count * PIPS[n]) / totalPips }));
  const alloc = new Map(exact.map((e) => [e.n, Math.floor(e.want)]));
  let assigned = [...alloc.values()].reduce((s, v) => s + v, 0);

  /* hand out the remainder by largest fractional part */
  const byFrac = exact
    .map((e) => ({ n: e.n, frac: e.want - Math.floor(e.want) }))
    .sort((a, b) => b.frac - a.frac || PIPS[b.n] - PIPS[a.n]);
  let i = 0;
  while (assigned < count) {
    const n = byFrac[i % byFrac.length].n;
    alloc.set(n, (alloc.get(n) ?? 0) + 1);
    assigned++;
    i++;
  }
  /* if rounding overshot, trim from the rarest numbers first */
  const byPipAsc = numbers.slice().sort((a, b) => PIPS[a] - PIPS[b]);
  let j = 0;
  while (assigned > count) {
    const n = byPipAsc[j % byPipAsc.length];
    if ((alloc.get(n) ?? 0) > 0) {
      alloc.set(n, (alloc.get(n) as number) - 1);
      assigned--;
    }
    j++;
  }

  const pool: number[] = [];
  alloc.forEach((c, n) => {
    for (let k = 0; k < c; k++) pool.push(n);
  });
  return pool;
}

/** Every pair of adjacent tile indices, precomputed once per layout. */
function adjacencyPairs(hexes: Axial[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let a = 0; a < hexes.length; a++) {
    for (let b = a + 1; b < hexes.length; b++) {
      if (isAdjacent(hexes[a], hexes[b])) pairs.push([a, b]);
    }
  }
  return pairs;
}

/** A board is legal when no two hot numbers (6/8) share an edge. */
export function findHotAdjacencies(tiles: Tile[], pairs: [number, number][]): [number, number][] {
  return pairs.filter(([a, b]) => {
    const ta = tiles[a].token;
    const tb = tiles[b].token;
    return ta !== null && tb !== null && HOT_NUMBERS.has(ta) && HOT_NUMBERS.has(tb);
  });
}

/* Swap offending tokens with cold ones until nothing hot touches anything
   hot. Bounded — if a layout somehow can't be repaired we regenerate rather
   than loop forever. */
function repairHotAdjacency(tiles: Tile[], pairs: [number, number][], rng: () => number): boolean {
  const MAX_PASSES = 400;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const bad = findHotAdjacencies(tiles, pairs);
    if (bad.length === 0) return true;

    const [a, b] = bad[Math.floor(rng() * bad.length)];
    const victim = rng() < 0.5 ? a : b;

    /* candidates: numbered tiles holding a cold token, not adjacent to any hot tile */
    const candidates = tiles
      .map((t, i) => ({ t, i }))
      .filter(({ t, i }) => {
        if (t.token === null || HOT_NUMBERS.has(t.token)) return false;
        if (i === victim) return false;
        const wouldTouchHot = pairs.some(([x, y]) => {
          const other = x === i ? y : y === i ? x : -1;
          if (other === -1 || other === victim) return false;
          const tok = tiles[other].token;
          return tok !== null && HOT_NUMBERS.has(tok);
        });
        return !wouldTouchHot;
      });

    if (candidates.length === 0) return false;
    const pick = candidates[Math.floor(rng() * candidates.length)].i;
    const tmp = tiles[victim].token;
    tiles[victim].token = tiles[pick].token;
    tiles[pick].token = tmp;
  }
  return findHotAdjacencies(tiles, pairs).length === 0;
}

/* ---- generation --------------------------------------------------------- */

export function generateBoard(config: BoardConfig = DEFAULT_BOARD, seed: string = freshSeed()): Board {
  const hexes = layoutHexes(config.rows);
  const totalTiles = hexes.length;

  const terrainBag: Terrain[] = [];
  (Object.keys(config.terrainCounts) as Terrain[]).forEach((t) => {
    for (let i = 0; i < config.terrainCounts[t]; i++) terrainBag.push(t);
  });
  if (terrainBag.length !== totalTiles) {
    throw new Error(
      `Board config mismatch: ${terrainBag.length} terrain tiles for ${totalTiles} slots. ` +
        `Row profile [${config.rows.join(",")}] and terrainCounts must agree.`
    );
  }

  const pairs = adjacencyPairs(hexes);

  /* Retry the whole board on the rare occasion repair can't converge —
     cheaper and simpler than backtracking, and effectively never hit. */
  for (let attempt = 0; attempt < 50; attempt++) {
    const rng = makeRng(hashSeed(seed) + attempt);
    const terrains = shuffle(terrainBag, rng);

    const tiles: Tile[] = hexes.map((hex, i) => ({
      id: axialKey(hex),
      hex,
      terrain: terrains[i],
      token: null,
    }));

    const numbered = tiles.filter((t) => t.terrain !== "sabkha");
    const pool = shuffle(buildNumberPool(numbered.length), rng);
    numbered.forEach((t, i) => (t.token = pool[i]));

    if (repairHotAdjacency(tiles, pairs, rng)) {
      return { tiles, config, seed };
    }
  }
  throw new Error("Could not generate a legal board — check the row profile and terrain counts.");
}
