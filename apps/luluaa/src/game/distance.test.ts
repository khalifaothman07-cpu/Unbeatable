import { describe, it, expect } from "vitest";
import { generateBoard, freshSeed } from "./board";
import { buildGeometry } from "./geometry";
import { canPlaceBarasti, type Buildings } from "./rules";

describe("distance rule", () => {
  it("never allows two buildings on adjacent vertices", () => {
    for (let run = 0; run < 40; run++) {
      const board = generateBoard(undefined, freshSeed());
      const geo = buildGeometry(board);
      const buildings: Buildings = {};
      // greedily fill every legal spot
      for (const v of Object.keys(geo.vertices)) {
        if (canPlaceBarasti(v, 0, buildings, {}, geo, true)) buildings[v] = { player: 0, type: "barasti" };
      }
      for (const v of Object.keys(buildings)) {
        for (const n of geo.vertexNeighbours[v]) {
          expect(buildings[n], `${v} and neighbour ${n} both built`).toBeUndefined();
        }
      }
    }
  });

  it("shortest path between any two buildings is at least 2 edges", () => {
    const board = generateBoard(undefined, freshSeed());
    const geo = buildGeometry(board);
    const buildings: Buildings = {};
    for (const v of Object.keys(geo.vertices)) {
      if (canPlaceBarasti(v, 0, buildings, {}, geo, true)) buildings[v] = { player: 0, type: "barasti" };
    }
    const ids = Object.keys(buildings);
    for (const a of ids) {
      // BFS one step: no built vertex within 1 hop
      expect(geo.vertexNeighbours[a].filter((n: string) => buildings[n])).toHaveLength(0);
    }
    expect(ids.length).toBeGreaterThan(5);
  });

  it("each vertex has 2 or 3 neighbours (a real hex lattice)", () => {
    const board = generateBoard(undefined, freshSeed());
    const geo = buildGeometry(board);
    for (const v of Object.keys(geo.vertices)) {
      const n = geo.vertexNeighbours[v].length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(3);
    }
  });
});
