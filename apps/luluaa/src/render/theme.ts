/* =========================================================================
   theme.ts — desert-sunset palette (art direction, §12)
   ========================================================================= */

import type { Terrain } from "../game/types";

export const PALETTE = {
  sand: "#e8d9c0",
  sandDeep: "#d9c4a3",
  terracotta: "#b4623f",
  turquoise: "#1c7d84",
  turquoiseDeep: "#125c62",
  coralTan: "#cbaa82",
  pearl: "#f4f1ea",
  pearlGlow: "#dff3f2",
  ink: "#2a211a",
  inkSoft: "rgba(42, 33, 26, 0.62)",
  night: "#1c1712",
} as const;

/** Fill per terrain — each should read as its landscape at a glance. */
export const TERRAIN_FILL: Record<Terrain, string> = {
  palmGrove: "#6f8f4a",
  quarryFlats: "#c3ac8a",
  oasis: "#a8763c",
  gulfWaters: PALETTE.turquoise,
  pearlBank: "#8fc9c6",
  sabkha: "#e6e0d2",
};

/** Sabkha reads as bleached salt, so it needs darker type than the rest. */
export const TERRAIN_INK: Record<Terrain, string> = {
  palmGrove: PALETTE.pearl,
  quarryFlats: PALETTE.ink,
  oasis: PALETTE.pearl,
  gulfWaters: PALETTE.pearl,
  pearlBank: PALETTE.ink,
  sabkha: PALETTE.inkSoft,
};
