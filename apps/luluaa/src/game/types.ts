/* =========================================================================
   types.ts — the LU'LU'A domain vocabulary, in one place
   ========================================================================= */

import type { Axial } from "./hex";

export type Resource = "palmWood" | "limestone" | "dates" | "fish" | "pearls";

export type Terrain =
  | "palmGrove"   // Palm Wood
  | "quarryFlats" // Limestone
  | "oasis"       // Dates
  | "gulfWaters"  // Fish
  | "pearlBank"   // Pearls
  | "sabkha";     // salt flat — produces nothing, the Shamal starts here

/* What each terrain yields. Sabkha yields nothing, hence null. */
export const TERRAIN_YIELD: Record<Terrain, Resource | null> = {
  palmGrove: "palmWood",
  quarryFlats: "limestone",
  oasis: "dates",
  gulfWaters: "fish",
  pearlBank: "pearls",
  sabkha: null,
};

export const RESOURCE_LABEL: Record<Resource, string> = {
  palmWood: "Palm Wood",
  limestone: "Limestone",
  dates: "Dates",
  fish: "Fish",
  pearls: "Pearls",
};

export const TERRAIN_LABEL: Record<Terrain, string> = {
  palmGrove: "Palm Grove",
  quarryFlats: "Quarry Flats",
  oasis: "Oasis",
  gulfWaters: "Gulf Waters",
  pearlBank: "Pearl Bank",
  sabkha: "Sabkha",
};

export interface Tile {
  id: string;
  hex: Axial;
  terrain: Terrain;
  /** 2–12 excluding 7. null on Sabkha, which never produces. */
  token: number | null;
}

export interface BoardConfig {
  /** Tiles per row, top to bottom. The default octagon is 2-4-6-6-6-4-2. */
  rows: number[];
  terrainCounts: Record<Terrain, number>;
}

/* Default 30-tile octagon. Note the flat-width plateau in the middle three
   rows — a true hexagon-of-hexes has only ONE row at max width, and it is
   those repeated max-width rows that give the silhouette its extra pair of
   straight edges. */
export const DEFAULT_BOARD: BoardConfig = {
  rows: [2, 4, 6, 6, 6, 4, 2],
  terrainCounts: {
    palmGrove: 6,
    quarryFlats: 6,
    oasis: 6,
    gulfWaters: 6,
    pearlBank: 5, // deliberately scarcest — and the key Qasr input
    sabkha: 1,
  },
};

/* Smaller board for 2–3 player quick games. */
export const SMALL_BOARD: BoardConfig = {
  rows: [2, 4, 4, 4, 2],
  terrainCounts: {
    palmGrove: 3,
    quarryFlats: 3,
    oasis: 3,
    gulfWaters: 3,
    pearlBank: 3,
    sabkha: 1,
  },
};

export interface Board {
  tiles: Tile[];
  config: BoardConfig;
  /** Recorded so a mid-game reconnect rebuilds this exact board. */
  seed: string;
}
