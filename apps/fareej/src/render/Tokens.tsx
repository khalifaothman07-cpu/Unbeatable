/* =========================================================================
   Tokens.tsx — the four playing pieces
   -------------------------------------------------------------------------
   Everyone remembers the pieces from a property game, so these have to read
   as objects rather than as coloured dots. They are also the smallest thing
   on the board — four of them can share one 86px space — so each is drawn
   for SILHOUETTE first: a viewer should tell them apart at 18px, in one
   colour, before any detail lands.

   The seat's colour fills the body; the outline is always the same dark ink
   so a pale token still has an edge against pale sand.
   ========================================================================= */

import { memo } from "react";
import type { Token } from "../state/store";

const INK = "#2a211a";

function Dallah({ fill }: { fill: string }) {
  /* The coffee pot. Its silhouette is the long curved spout and the tall
     finial — so both are drawn as SOLID shapes rather than strokes, because
     a 1.3px line disappears entirely at 18px and leaves an orange blob. */
  return (
    <g>
      {/* body */}
      <path d="M 7.5 21 q -1.4 -8.4 1.8 -11.6 l 7.4 0 q 3.2 3.2 1.8 11.6 z"
            fill={fill} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      {/* spout, thick enough to survive being small */}
      <path d="M 16.8 10.4 q 4.6 -1.4 5.4 -6.6 q -1.2 0.2 -2.2 1 q -1 2.6 -3.8 3.8 z"
            fill={fill} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      {/* handle */}
      <path d="M 8.6 11.4 q -5 2.6 -1 7 l 2 -1.2 q -2.4 -2.8 0.6 -4.4 z"
            fill={fill} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      {/* lid and finial */}
      <path d="M 8.4 9.4 q 4 -2.6 8.4 0 z" fill={fill} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M 12 8.6 L 12 4.6" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={12} cy={3.4} r={1.8} fill={fill} stroke={INK} strokeWidth={1.2} />
      {/* base */}
      <path d="M 6 21.4 h 12" stroke={INK} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

function Dhow({ fill }: { fill: string }) {
  /* hull and lateen sail — the same rig as the trade posts in LU'LU'A */
  return (
    <g>
      <path d="M 3 14.5 L 12.5 14.5 L 12.5 3 Z"
            fill={fill} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M 12.5 3 L 12.5 17" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      <path d="M 2.5 16.5 q 5 6 10 6 q 5 0 10 -6 q -5 2 -10 2 q -5 0 -10 -2 z"
            fill={fill} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
    </g>
  );
}

function Racer({ fill }: { fill: string }) {
  /* open-wheel car, seen from the side. Sakhir is on this board. */
  return (
    <g>
      <path d="M 1.5 15 L 6 15 L 8.5 11 L 14 11 L 16 15 L 22.5 15 L 22.5 17.5 L 1.5 17.5 Z"
            fill={fill} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M 9.5 11 L 11 7.5 L 13.5 7.5 L 13.5 11 Z" fill={fill} stroke={INK} strokeWidth={1.2} />
      <circle cx={6} cy={17.5} r={3.4} fill={INK} />
      <circle cx={6} cy={17.5} r={1.3} fill={fill} />
      <circle cx={17.5} cy={17.5} r={3.4} fill={INK} />
      <circle cx={17.5} cy={17.5} r={1.3} fill={fill} />
    </g>
  );
}

function Pearl({ fill }: { fill: string }) {
  /* an oyster holding one. The island's whole first economy. */
  return (
    <g>
      <path d="M 2.5 14 A 9.5 7.5 0 0 0 21.5 14 Z"
            fill={fill} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M 3.4 12.8 A 8.6 5.4 0 0 1 20.6 12.8 Z"
            fill={fill} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      <g fill="none" stroke={INK} strokeWidth={0.8} opacity={0.6}>
        <path d="M 12 14 L 8 19" /><path d="M 12 14 L 12 20" /><path d="M 12 14 L 16 19" />
      </g>
      <circle cx={12} cy={12.6} r={3.6} fill="#ffffff" stroke={INK} strokeWidth={1.1} />
      <circle cx={10.8} cy={11.4} r={1.1} fill="#ffffff" />
    </g>
  );
}

/** The bare glyph, for dropping into an SVG that is already open. */
export const TokenGlyph = memo(function TokenGlyph({ token, fill }: { token: Token; fill: string }) {
  switch (token) {
    case "dallah": return <Dallah fill={fill} />;
    case "dhow": return <Dhow fill={fill} />;
    case "car": return <Racer fill={fill} />;
    case "pearl": return <Pearl fill={fill} />;
  }
});

/** The piece as its own element, for HTML. */
export function TokenIcon({ token, fill, size = 22 }: { token: Token; fill: string; size?: number }) {
  return (
    <svg className="tok" width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <TokenGlyph token={token} fill={fill} />
    </svg>
  );
}
