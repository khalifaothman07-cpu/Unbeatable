/* =========================================================================
   boardGeometry.ts — where a space is, in either layout
   -------------------------------------------------------------------------
   FAREEJ has two board renderers: a square for desktop and a strip for the
   phone. That is a decision with a cost — two things that must agree forever
   — and this module is how the cost is paid. Everything that is TRUE OF A
   SPACE regardless of layout lives here: which side of the square it is on,
   what colour its group is, how its name should be abbreviated, what marks
   sit on it.

   The renderers own nothing but pixels. If a rule about presentation can be
   stated without saying "square" or "strip", it belongs in this file.
   ========================================================================= */

import { BOARD, LAP } from "../game/board";
import type { ColourGroup, Group, Space } from "../game/types";

/* -------------------------------------------------------------------------
   GROUP COLOUR
   Deliberately in the same running order as the property game everyone has
   already played — brown, pale blue, rose, orange, red, yellow, green, deep
   blue — because a player who has seen one of these boards already knows
   what a dark blue space means. The hues are pulled toward the site's warm
   palette rather than the primary-colour original.
   ------------------------------------------------------------------------- */
export const GROUP_COLOUR: Record<Group, string> = {
  dilmun:   "#8c6239",
  pearling: "#6fbcc4",
  forts:    "#b5657f",
  souqs:    "#d1873a",
  culture:  "#b4433a",
  sport:    "#d6b13f",
  malls:    "#4f8f52",
  skyline:  "#2a4a72",
  crossings: "#4a4038",
  ewa:       "#7d8a91",
};

/** Ink that reads on top of the group colour — measured, not guessed.
    Anything below 0.5 relative luminance takes white; the rest take the
    dark ink the rest of the site uses. */
export const GROUP_INK: Record<Group, string> = Object.fromEntries(
  (Object.keys(GROUP_COLOUR) as Group[]).map((g) => [g, luminance(GROUP_COLOUR[g]) > 0.45 ? "#2a211a" : "#f4f1ea"]),
) as Record<Group, string>;

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/* -------------------------------------------------------------------------
   THE SQUARE
   Forty spaces round a ring of eleven by eleven cells. Index 0 is the
   bottom-right corner and the lap runs anticlockwise — which is how every
   board of this kind is laid out, and going the other way makes a player who
   knows the genre feel like they are reading it in a mirror.
   ------------------------------------------------------------------------- */
export type Side = "bottom" | "left" | "top" | "right";

export interface Cell {
  /** 0-based column and row in the 11×11 ring */
  col: number;
  row: number;
  side: Side;
  corner: boolean;
}

export const RING = 11;

export function cellFor(index: number): Cell {
  const i = ((index % LAP) + LAP) % LAP;
  if (i <= 10) {
    /* bottom edge, right to left: 0 at (10,10), 10 at (0,10) */
    return { col: 10 - i, row: 10, side: i === 0 || i === 10 ? "bottom" : "bottom", corner: i === 0 || i === 10 };
  }
  if (i <= 20) {
    /* left edge, bottom to top */
    return { col: 0, row: 10 - (i - 10), side: "left", corner: i === 20 };
  }
  if (i <= 30) {
    /* top edge, left to right */
    return { col: i - 20, row: 0, side: "top", corner: i === 30 };
  }
  /* right edge, top to bottom */
  return { col: 10, row: i - 30, side: "right", corner: false };
}

export const isCorner = (index: number): boolean => index % 10 === 0;

/** Which way the group band faces on the square — always toward the middle
    of the board, the way a real one is printed. */
export function bandSide(index: number): Side {
  const { side } = cellFor(index);
  return side === "bottom" ? "top" : side === "top" ? "bottom" : side === "left" ? "right" : "left";
}

/* -------------------------------------------------------------------------
   LABELS
   A space is 35px wide on a phone-sized square and about 86px in the strip,
   so board.ts carries a shortName for anything that will not fit. This is
   the only place that decides which one to use.
   ------------------------------------------------------------------------- */
export function label(space: Space, room: "tight" | "roomy"): string {
  if (room === "roomy") return space.name;
  return space.shortName ?? space.name;
}

/** Corners are set in caps; everything else keeps its own casing. */
export const isCornerSpace = (space: Space): boolean =>
  ["go", "causeway", "gahwa", "borderCheck"].includes(space.kind);

/* -------------------------------------------------------------------------
   WHAT SITS ON A SPACE
   Both renderers draw the same four things, so both ask the same question.
   ------------------------------------------------------------------------- */
export interface SpaceMarks {
  /** villas standing, 0–4 */
  villas: number;
  tower: boolean;
  mortgaged: boolean;
  /** seat that owns it, or null */
  owner: number | null;
}

export const TOWER_LEVEL = 5;

export function marksFor(
  level: number, owner: number | null, mortgaged: boolean,
): SpaceMarks {
  return {
    villas: level === TOWER_LEVEL ? 0 : level,
    tower: level === TOWER_LEVEL,
    mortgaged,
    owner,
  };
}

/** Every space, once, in lap order — so a renderer never rebuilds the list. */
export const SPACES: Space[] = BOARD;

/** The colour band a space shows, or null for the ones that have no group. */
export function bandColour(space: Space): string | null {
  return space.group ? GROUP_COLOUR[space.group] : null;
}

/** Group colours as an array in ladder order, for legends and the lobby. */
export const LADDER: ColourGroup[] = [
  "dilmun", "pearling", "forts", "souqs", "culture", "sport", "malls", "skyline",
];
