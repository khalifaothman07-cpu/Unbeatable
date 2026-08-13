/* =========================================================================
   hex.ts — axial hex coordinate math (pointy-top)
   -------------------------------------------------------------------------
   Every pixel position is DERIVED from (q, r) — nothing is hardcoded, so
   the board stays parametric and a different row profile just works.
   ========================================================================= */

export interface Axial {
  q: number;
  r: number;
}

export const axialKey = (h: Axial): string => `${h.q},${h.r}`;

/* The six neighbours of a hex in axial space. */
export const HEX_DIRECTIONS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function neighbours(h: Axial): Axial[] {
  return HEX_DIRECTIONS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
}

export function isAdjacent(a: Axial, b: Axial): boolean {
  const dq = b.q - a.q;
  const dr = b.r - a.r;
  return HEX_DIRECTIONS.some((d) => d.q === dq && d.r === dr);
}

/* Pointy-top axial → pixel. `size` is the hex circumradius (centre to corner). */
export function axialToPixel(h: Axial, size: number): { x: number; y: number } {
  return {
    x: size * Math.sqrt(3) * (h.q + h.r / 2),
    y: size * (3 / 2) * h.r,
  };
}

/* The six corner points of a pointy-top hex, for SVG polygons. */
export function hexCorners(centre: { x: number; y: number }, size: number): { x: number; y: number }[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return {
      x: centre.x + size * Math.cos(angle),
      y: centre.y + size * Math.sin(angle),
    };
  });
}
