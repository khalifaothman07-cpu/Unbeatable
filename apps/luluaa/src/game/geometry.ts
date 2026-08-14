/* =========================================================================
   geometry.ts — vertices (building spots) and edges (route spots)
   -------------------------------------------------------------------------
   Derived from the tile corners rather than stored: each hex contributes 6
   corners, and corners shared by 2–3 hexes are the same vertex. Dedupe by
   rounded pixel position, which is exact enough at these scales and avoids
   a second coordinate system.
   ========================================================================= */

import { axialToPixel, hexCorners } from "./hex";
import { hashSeed, makeRng, shuffle } from "./board";
import type { Board, Resource, Tile } from "./types";

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
  /** coastal trade posts, derived from the board's seed */
  ports: Port[];
  /** vertex id -> the posts a building there can use */
  vertexPorts: Record<string, Port[]>;
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

  const geo: Geometry = {
    vertices, edges, vertexNeighbours, vertexEdges, tileVertices,
    ports: [], vertexPorts: {},
  };
  geo.ports = buildPorts(board, geo);
  for (const p of geo.ports) {
    for (const v of p.vertices) (geo.vertexPorts[v] ??= []).push(p);
  }
  return geo;
}

/** Coastal vertices (fewer than 3 adjacent tiles) — where Trade Posts sit. */
export function coastalVertices(geo: Geometry): string[] {
  return Object.values(geo.vertices)
    .filter((v) => v.tiles.length < 3)
    .map((v) => v.id);
}

/* =========================================================================
   TRADE POSTS
   -------------------------------------------------------------------------
   A post sits on an OUTER edge — one the sea is on one side of — and is
   used by a building on either of that edge's two corners. Which edges
   qualify falls out of the geometry: an edge belongs to two tiles inland
   and exactly one on the coast.

   Everything here is derived from the board, never stored, so two devices
   rebuilding from the same seed get the same posts in the same places —
   the same reason tiles travel as a seed rather than as thirty objects.
   ========================================================================= */

export interface Port {
  id: string;
  /** the two coastal corners that can use it */
  vertices: [string, string];
  /** null = 3:1 on anything; a resource = 2:1 on that one */
  resource: Resource | null;
  /** midpoint of the edge, and the outward direction, for drawing */
  x: number; y: number; nx: number; ny: number;
}

/** Tiles touching both ends of an edge: 2 inland, 1 on the coast. */
function edgeTiles(geo: Geometry, e: Edge): string[] {
  const a = geo.vertices[e.a]?.tiles ?? [];
  const b = geo.vertices[e.b]?.tiles ?? [];
  return a.filter((t) => b.includes(t));
}

/**
 * Nine posts around the coast: one 2:1 for each of the five resources and
 * four generic 3:1, spaced as evenly as the shoreline allows so no corner
 * of the board is a trading dead zone.
 */
export function buildPorts(board: Board, geo: Geometry): Port[] {
  const outer = Object.values(geo.edges)
    .filter((e) => edgeTiles(geo, e).length === 1)
    .sort((p, q) => p.id.localeCompare(q.id));   // deterministic before anything else
  if (!outer.length) return [];

  /* centre of the board, so posts can be ordered by their angle around it
     and then thinned evenly rather than clustering on one shore */
  const cx = Object.values(geo.vertices).reduce((n, v) => n + v.x, 0) / Object.keys(geo.vertices).length;
  const cy = Object.values(geo.vertices).reduce((n, v) => n + v.y, 0) / Object.keys(geo.vertices).length;

  const ring = outer
    .map((e) => {
      const mx = (e.x1 + e.x2) / 2, my = (e.y1 + e.y2) / 2;
      return { e, mx, my, angle: Math.atan2(my - cy, mx - cx) };
    })
    .sort((p, q) => p.angle - q.angle);

  const WANT = 9;
  const count = Math.min(WANT, ring.length);
  const step = ring.length / count;

  /* the seed decides which resource lands where, so the same board always
     has the same posts, and a different board doesn't */
  const bag: (Resource | null)[] =
    ["palmWood", "limestone", "dates", "fish", "pearls", null, null, null, null];
  const kinds: (Resource | null)[] = shuffle(
    bag,
    makeRng(hashSeed(board.seed + ":ports")),
  ).slice(0, count);

  const ports: Port[] = [];
  for (let i = 0; i < count; i++) {
    const { e, mx, my } = ring[Math.floor(i * step)];
    const len = Math.hypot(mx - cx, my - cy) || 1;
    ports.push({
      id: `port-${e.id}`,
      vertices: [e.a, e.b],
      resource: kinds[i] ?? null,
      x: mx, y: my,
      nx: (mx - cx) / len, ny: (my - cy) / len,
    });
  }
  return ports;
}
