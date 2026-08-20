/* =========================================================================
   Buildings.tsx — villas and towers, as objects
   -------------------------------------------------------------------------
   These were 7px coloured squares, which is indistinguishable from a
   checkbox. A building on a property board is the thing you are playing
   for, so it gets a roof, a lit face and a shaded one.

   Drawn small on purpose — four villas have to fit across a 104px space
   with room to spare — so the silhouette does the work: a villa is a
   pitched roof on a box, a tower is a tall slab with floors and a crown.
   ========================================================================= */

import { memo } from "react";

export const Villa = memo(function Villa({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="villa" aria-hidden focusable="false">
      {/* footprint shadow */}
      <ellipse cx="8" cy="14.6" rx="6.4" ry="1.3" fill="#000" opacity="0.28" />
      {/* walls: a lit face and a turned one */}
      <path d="M 2 7 h 6 v 7 h -6 z" fill="#f0e7cf" />
      <path d="M 8 7 h 6 v 7 h -6 z" fill="#cdbf9e" />
      {/* pitched roof, same split */}
      <path d="M 8 1.6 L 1.2 7 h 6.8 z" fill="#3ea564" />
      <path d="M 8 1.6 L 14.8 7 h -6.8 z" fill="#2d7f4b" />
      <path d="M 1.2 7 h 13.6" stroke="#22623a" strokeWidth="0.7" />
      {/* one window, so the scale reads as a house */}
      <rect x="3.4" y="9" width="2.6" height="2.6" rx="0.4" fill="#8fa27e" />
    </svg>
  );
});

export const Tower = memo(function Tower({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="tower" aria-hidden focusable="false">
      <ellipse cx="8" cy="15" rx="5.6" ry="1.2" fill="#000" opacity="0.32" />
      {/* slab: lit front, shaded return */}
      <path d="M 3 4 h 5.5 v 11 h -5.5 z" fill="#e6603f" />
      <path d="M 8.5 4 h 4.5 v 11 h -4.5 z" fill="#b03f27" />
      {/* the crown */}
      <path d="M 8 0.8 L 2.6 4 h 10.8 z" fill="#f2f0e6" />
      <path d="M 8 0.8 L 13.4 4 h -5.4 z" fill="#cfcabb" />
      {/* floors — four bands, because it replaced four villas */}
      <g stroke="#7d2c1a" strokeWidth="0.55" opacity="0.75">
        <path d="M 3 6.6 h 10" /><path d="M 3 9 h 10" />
        <path d="M 3 11.4 h 10" /><path d="M 3 13.4 h 10" />
      </g>
    </svg>
  );
});

/** What is standing on one space: up to four villas, or a single tower. */
export function Buildings({ level, tower, size }: { level: number; tower: boolean; size?: number }) {
  if (tower) return <Tower size={size ? size + 4 : undefined} />;
  return (
    <>
      {Array.from({ length: level }, (_x, i) => <Villa key={i} size={size} />)}
    </>
  );
}
