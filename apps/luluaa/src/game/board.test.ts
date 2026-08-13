import { describe, it, expect } from "vitest";
import {
  generateBoard,
  layoutHexes,
  buildNumberPool,
  findHotAdjacencies,
  freshSeed,
  PIPS,
  HOT_NUMBERS,
} from "./board";
import { DEFAULT_BOARD, SMALL_BOARD } from "./types";
import { isAdjacent, axialKey } from "./hex";

const pairsOf = (hexes: { q: number; r: number }[]) => {
  const out: [number, number][] = [];
  for (let a = 0; a < hexes.length; a++)
    for (let b = a + 1; b < hexes.length; b++) if (isAdjacent(hexes[a], hexes[b])) out.push([a, b]);
  return out;
};

describe("layout", () => {
  it("produces one hex per slot in the row profile", () => {
    expect(layoutHexes(DEFAULT_BOARD.rows)).toHaveLength(30);
    expect(layoutHexes(SMALL_BOARD.rows)).toHaveLength(16);
  });

  it("produces no duplicate coordinates", () => {
    const hexes = layoutHexes(DEFAULT_BOARD.rows);
    expect(new Set(hexes.map(axialKey)).size).toBe(hexes.length);
  });

  it("has a flat-width plateau — the thing that makes it an octagon, not a hexagon", () => {
    // A hexagon-of-hexes has exactly ONE row at max width. An octagon has several.
    const rows = DEFAULT_BOARD.rows;
    const max = Math.max(...rows);
    expect(rows.filter((n) => n === max).length).toBeGreaterThan(1);
  });
});

describe("number pool", () => {
  it("returns exactly the requested count", () => {
    for (const n of [15, 16, 29, 30, 44]) expect(buildNumberPool(n)).toHaveLength(n);
  });

  it("never contains a 7", () => {
    expect(buildNumberPool(29)).not.toContain(7);
  });

  it("keeps the probability curve — 6/8 more common than 2/12", () => {
    const pool = buildNumberPool(29);
    const count = (n: number) => pool.filter((x) => x === n).length;
    expect(count(6) + count(8)).toBeGreaterThan(count(2) + count(12));
    expect(count(5) + count(9)).toBeGreaterThanOrEqual(count(3) + count(11));
  });

  it("orders frequency by pip weight across the whole pool", () => {
    const pool = buildNumberPool(200);
    const count = (n: number) => pool.filter((x) => x === n).length;
    const nums = Object.keys(PIPS).map(Number);
    for (const a of nums)
      for (const b of nums)
        if (PIPS[a] > PIPS[b]) expect(count(a)).toBeGreaterThanOrEqual(count(b));
  });
});

describe("generateBoard", () => {
  it("fills every slot and matches the configured terrain counts", () => {
    const board = generateBoard();
    expect(board.tiles).toHaveLength(30);
    for (const [terrain, want] of Object.entries(DEFAULT_BOARD.terrainCounts)) {
      expect(board.tiles.filter((t) => t.terrain === terrain)).toHaveLength(want);
    }
  });

  it("gives every non-Sabkha tile a token, and Sabkha none", () => {
    const board = generateBoard();
    for (const t of board.tiles) {
      if (t.terrain === "sabkha") expect(t.token).toBeNull();
      else expect(t.token).not.toBeNull();
    }
  });

  it("never places 7 as a token", () => {
    const board = generateBoard();
    expect(board.tiles.map((t) => t.token)).not.toContain(7);
  });

  /* The headline constraint from the spec — worth hammering, since a rare
     failure here would only surface as a subtly unfair board months later. */
  it("never lets two hot numbers (6/6, 8/8, 6/8) share an edge — 300 boards", () => {
    for (let i = 0; i < 300; i++) {
      const board = generateBoard(DEFAULT_BOARD, freshSeed());
      const pairs = pairsOf(board.tiles.map((t) => t.hex));
      const bad = findHotAdjacencies(board.tiles, pairs);
      if (bad.length) {
        const detail = bad
          .map(([a, b]) => `${board.tiles[a].token}@${board.tiles[a].id} ~ ${board.tiles[b].token}@${board.tiles[b].id}`)
          .join(", ");
        throw new Error(`seed ${board.seed} produced hot adjacency: ${detail}`);
      }
    }
  });

  it("works for the small 2-3 player board too", () => {
    for (let i = 0; i < 100; i++) {
      const board = generateBoard(SMALL_BOARD, freshSeed());
      expect(board.tiles).toHaveLength(16);
      const pairs = pairsOf(board.tiles.map((t) => t.hex));
      expect(findHotAdjacencies(board.tiles, pairs)).toHaveLength(0);
    }
  });

  /* Reconnect requirement: the seed alone must rebuild the identical board. */
  it("is deterministic for a given seed", () => {
    const seed = freshSeed();
    const a = generateBoard(DEFAULT_BOARD, seed);
    const b = generateBoard(DEFAULT_BOARD, seed);
    expect(b.tiles).toEqual(a.tiles);
  });

  it("does not repeat layouts between games", () => {
    const fingerprint = (s: string) =>
      generateBoard(DEFAULT_BOARD, s)
        .tiles.map((t) => `${t.terrain}${t.token}`)
        .join("|");
    const seen = new Set(Array.from({ length: 200 }, () => fingerprint(freshSeed())));
    // allow a hair of collision tolerance, but 200 fresh seeds must not converge
    expect(seen.size).toBeGreaterThan(195);
  });

  it("rejects a config whose terrain counts don't fill the rows", () => {
    expect(() =>
      generateBoard({ rows: [2, 3, 2], terrainCounts: { ...DEFAULT_BOARD.terrainCounts } })
    ).toThrow(/mismatch/i);
  });

  it("keeps Pearl Bank the scarcest producing terrain", () => {
    const c = DEFAULT_BOARD.terrainCounts;
    const producing = [c.palmGrove, c.quarryFlats, c.oasis, c.gulfWaters];
    expect(Math.min(...producing)).toBeGreaterThan(c.pearlBank);
  });

  it("HOT_NUMBERS is exactly the 5-pip numbers", () => {
    const fivePip = Object.keys(PIPS).map(Number).filter((n) => PIPS[n] === 5);
    expect([...HOT_NUMBERS].sort()).toEqual(fivePip.sort());
  });
});
