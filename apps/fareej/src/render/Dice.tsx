/* =========================================================================
   Dice.tsx — two dice, with pips
   -------------------------------------------------------------------------
   The old version rendered a roll as the string "3 + 4 = 7". That is a
   calculation, not a throw, and it is most of why the game read as a form.

   These are objects: a lit top face, a shaded edge, real pips, and a tumble
   when the numbers change. The tumble is keyed on the roll so a repeated
   4+4 still animates — keying on the value alone means the dice sit
   perfectly still on doubles, which is exactly when a player is watching.
   ========================================================================= */

import { memo } from "react";

/* Pip positions on a 3×3 grid, per face. Reading them out beats computing
   them: the 6 is two columns of three, not a formula. */
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

function Die({ value, size = 46 }: { value: number; size?: number }) {
  const pips = PIPS[value] ?? PIPS[1];
  /* The face runs 4..68 in this 72 box. Pips sit on a grid inset from that,
     or a 6 reads as four blobs jammed into the corners. */
  const first = 17, step = 19, r = 5.6;
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" className="die" role="img" aria-label={`Die showing ${value}`}>
      <defs>
        <linearGradient id={`dieFace${value}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#fffdf6" />
          <stop offset="1" stopColor="#e2d7bd" />
        </linearGradient>
      </defs>
      {/* the shadow it casts on the felt */}
      <rect x="6" y="10" width="60" height="60" rx="13" fill="#000" opacity="0.4" />
      <rect x="4" y="4" width="64" height="64" rx="13" fill={`url(#dieFace${value})`} />
      {/* a lit top edge, so it reads as a cube rather than a card */}
      <path d="M 17 4 H 55 A 13 13 0 0 1 68 17 V 21 A 13 13 0 0 0 55 8 H 17 Z" fill="#fff" opacity="0.7" />
      <rect x="4" y="4" width="64" height="64" rx="13" fill="none" stroke="#b0a184" strokeWidth="1.6" />
      {pips.map(([cx, cy], i) => (
        <g key={i}>
          {/* drilled, not printed: the pip, then a light rim on its lower
              edge. The first version drew a DARK copy on top and every face
              came out looking smudged. */}
          <circle cx={first + cx * step} cy={first + cy * step} r={r} fill="#2b2118" />
          <circle cx={first + cx * step} cy={first + cy * step + 0.9} r={r} fill="#fff" opacity="0.22" />
          <circle cx={first + cx * step} cy={first + cy * step} r={r - 0.9} fill="#2b2118" />
        </g>
      ))}
    </svg>
  );
}

const MemoDie = memo(Die);

export function Dice({ roll, nonce, size = 46 }: {
  /** the two faces, or null before anything has been thrown */
  roll: [number, number] | null;
  /** changes on every throw, so doubles still tumble */
  nonce: number;
  size?: number;
}) {
  if (!roll) return null;
  const total = roll[0] + roll[1];
  return (
    <span className="dice-tray" key={nonce}>
      <span className="die-wrap"><MemoDie value={roll[0]} size={size} /></span>
      <span className="die-wrap die-wrap--b"><MemoDie value={roll[1]} size={size} /></span>
      <b className="dice-total">{total}</b>
    </span>
  );
}
