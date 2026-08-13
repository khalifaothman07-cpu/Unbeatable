/* =========================================================================
   geometry.ts — vertices (building spots) and edges (route spots)
   -------------------------------------------------------------------------
   Derived from the tile corners rather than stored: each hex contributes 6
   corners, and corners shared by 2–3 hexes are the same vertex. Dedupe by
   rounded pixel position, which is exact enough at these scales and avoids
   a second coordinate system.
   ========================================================================= */

import { axialToPixel, hexCorners } from "./hex";
import type { Board, Tile } from "./types";

export const LAYOUT_SIZE = 52; // must match BoardView's HEX_SIZE

export interface Vertex {
  id: string;
  x: number;
  y: number;
  tiles: string[]; // ids of adjacent tiles — what produces here
}

export interface Edge {
  id: string;
  a: string; // vertex id
  b: string; // vertex id
  x1: number; y1: number; x2: number; y2: number;
}

export interface Geometry {
  vertices: Record<string, Vertex>;
  edges: Record<string, Edge>;
  /** vertex id -> ids of vertices one edge away */
  vertexNeighbours: Record<string, string[]>;
  /** vertex id -> ids of edges touching it */
  vertexEdges: Record<string, string[]>;
  /** tile id -> the 6 vertex ids around it */
  tileVertices: Record<string, string[]>;
}

const key = (x: number, y: number) => `${Math.round(x * 10)}:${Math.round(y * 10)}`;

export function buildGeometry(board: Board, size = LAYOUT_SIZE): Geometry {
  const vertices: Record<string, Vertex> = {};
  const edges: Record<string, Edge> = {};
  const tileVertices: Record<string, string[]> = {};

  const cornersOf = (t: Tile) => hexCorners(axialToPixel(t.hex, size), size);

  for (const tile of board.tiles) {
    const cs = cornersOf(tile);
    const ids = cs.map((c) => {
      const id = key(c.x, c.y);
      if (!vertices[id]) vertices[id] = { id, x: c.x, y: c.y, tiles: [] };
      if (!vertices[id].tiles.includes(tile.id)) vertices[id].tiles.push(tile.id);
      return id;
    });
    tileVertices[tile.id] = ids;

    for (let i = 0; i < 6; i++) {
      const a = ids[i];
      const b = ids[(i + 1) % 6];
      const eid = [a, b].sort().join("|");
      if (!edges[eid]) {
        edges[eid] = { id: eid, a, b, x1: vertices[a].x, y1: vertices[a].y, x2: vertices[b].x, y2: vertices[b].y };
      }
    }
  }

  const vertexNeighbours: Record<string, string[]> = {};
  const vertexEdges: Record<string, string[]> = {};
  for (const v of Object.keys(vertices)) {
    vertexNeighbours[v] = [];
    vertexEdges[v] = [];
  }
  for (const e of Object.values(edges)) {
    vertexNeighbours[e.a].push(e.b);
    vertexNeighbours[e.b].push(e.a);
    vertexEdges[e.a].push(e.id);
    vertexEdges[e.b].push(e.id);
  }

  return { vertices, edges, vertexNeighbours, vertexEdges, tileVertices };
}

/** Coastal vertices (fewer than 3 adjacent tiles) — where Trade Posts sit. */
export function coastalVertices(geo: Geometry): string[] {
  return Object.values(geo.vertices)
    .filter((v) => v.tiles.length < 3)
    .map((v) => v.id);
}
