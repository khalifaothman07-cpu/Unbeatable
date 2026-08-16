/* =========================================================================
   Icons.tsx — artwork for the five goods and the five dhow cards
   -------------------------------------------------------------------------
   The hand used to be five coloured squares. Players reported not being able
   to tell what anything was, which is exactly what a colour swatch gets you:
   it distinguishes without naming. Two of the five goods are blue-green, and
   at a glance on a phone "teal square" and "paler teal square" are the same
   object.

   So each good gets a drawn thing — a log, cut blocks, a bunch of dates, a
   fish, an oyster — and each dhow card gets a mark for what it DOES rather
   than a name to read. The board imports the same glyphs for its trade
   posts, so the ship at a 2:1 post shows the same fish you are holding.

   Drawn in a 24×24 box with no fixed size or stroke width baked in, so the
   same path serves a 16px chip in a table and a 26px badge on the board.
   ========================================================================= */

import { memo } from "react";
import type { Resource } from "../game/types";
import type { DhowKind } from "../state/store";

/** Body colour. Matches the tile gradients and the trade-post pennants. */
export const RES_FILL: Record<Resource, string> = {
  palmWood: "#6f8f4a", limestone: "#c3ac8a", dates: "#a8763c",
  fish: "#1c7d84", pearls: "#8fc9c6",
};

/** Line and shadow colour — the same hue driven down, so a glyph still
    reads when it is 16px tall and the fill is doing almost nothing. */
export const RES_DARK: Record<Resource, string> = {
  palmWood: "#39521f", limestone: "#8a7350", dates: "#653f1a", fish: "#0a444a", pearls: "#3f807d",
};

export const RES_SHORT: Record<Resource, string> = {
  palmWood: "Wood", limestone: "Stone", dates: "Dates", fish: "Fish", pearls: "Pearls",
};

/* -------------------------------------------------------------------------
   The goods. Each is the contents of a 24×24 box, origin top-left.
   ------------------------------------------------------------------------- */

function PalmWood({ f, d }: { f: string; d: string }) {
  /* a cut length of palm trunk, with two fronds so it isn't just a barrel */
  return (
    <g>
      <path d="M 7 9 Q 9.5 3.5 15.5 2.2" fill="none" stroke={d} strokeWidth={1.3} strokeLinecap="round" />
      <g fill={f}>
        <path d="M 9 7.4 q 3 -3 6.6 -3.6 q -3 2.6 -6.4 4.4 z" />
        <path d="M 7.6 9.2 q 1.4 -3.8 4.6 -5.8 q -1.4 3.6 -3.4 6.2 z" />
      </g>
      <rect x={2.5} y={10} width={15} height={9.4} rx={4.7} fill={f} />
      <rect x={2.5} y={10} width={15} height={3.2} rx={1.6} fill="#ffffff" opacity={0.22} />
      <ellipse cx={17.5} cy={14.7} rx={4} ry={4.7} fill={d} />
      <ellipse cx={17.5} cy={14.7} rx={2.4} ry={2.9} fill={f} />
      <ellipse cx={17.5} cy={14.7} rx={0.95} ry={1.15} fill={d} />
    </g>
  );
}

function Limestone({ f, d }: { f: string; d: string }) {
  /* three sawn blocks of farrouj, coursed the way a wall goes up */
  const block = (x: number, y: number, w: number, h: number) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1} fill={f} stroke={d} strokeWidth={1.1} />
      <rect x={x} y={y} width={w} height={h * 0.36} rx={1} fill="#ffffff" opacity={0.3} />
    </g>
  );
  return (
    <g>
      {block(2.2, 13.2, 9.2, 7.6)}
      {block(12.6, 13.2, 9.2, 7.6)}
      {block(7.4, 4.4, 9.2, 7.6)}
    </g>
  );
}

function Dates({ f, d }: { f: string; d: string }) {
  /* a bunch on the stem, under a pair of fronds */
  return (
    <g>
      <path d="M 12 2.6 L 12 8.4" stroke={d} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M 12 4 Q 6.5 3.4 4 6.6" fill="none" stroke={d} strokeWidth={1.3} strokeLinecap="round" />
      <path d="M 12 4 Q 17.5 3.4 20 6.6" fill="none" stroke={d} strokeWidth={1.3} strokeLinecap="round" />
      <g fill={f} stroke={d} strokeWidth={0.7}>
        <ellipse cx={8.8} cy={11.4} rx={2.7} ry={3.3} />
        <ellipse cx={15.2} cy={11.4} rx={2.7} ry={3.3} />
        <ellipse cx={12} cy={14.6} rx={2.7} ry={3.3} />
        <ellipse cx={8.8} cy={17.6} rx={2.5} ry={3} />
        <ellipse cx={15.2} cy={17.6} rx={2.5} ry={3} />
      </g>
      <g fill="#ffffff" opacity={0.34}>
        <ellipse cx={7.9} cy={10.2} rx={0.9} ry={1.2} />
        <ellipse cx={14.3} cy={10.2} rx={0.9} ry={1.2} />
        <ellipse cx={11.1} cy={13.4} rx={0.9} ry={1.2} />
      </g>
    </g>
  );
}

function Fish({ f, d }: { f: string; d: string }) {
  return (
    <g>
      <path d="M 6 12 L 1.6 7.6 L 1.6 16.4 Z" fill={d} />
      <ellipse cx={12.6} cy={12} rx={7.4} ry={5} fill={f} />
      <path d="M 10 7.6 q 2.6 -3.2 5.6 -1.6 q -2.6 0.9 -4.4 2.6 z" fill={d} />
      <path d="M 10 16.4 q 2.6 3.2 5.6 1.6 q -2.6 -0.9 -4.4 -2.6 z" fill={d} opacity={0.75} />
      <path d="M 8.4 9.6 q 2.2 2.4 0 4.8" fill="none" stroke={d} strokeWidth={0.9} opacity={0.6} />
      <circle cx={16.4} cy={10.4} r={1.5} fill="#ffffff" />
      <circle cx={16.4} cy={10.4} r={0.75} fill={d} />
    </g>
  );
}

function Pearls({ f, d }: { f: string; d: string }) {
  /* an open oyster with the pearl sitting in it — the shell is what tells
     you this is the pearl bank and not simply "a light blue circle" */
  return (
    <g>
      <path d="M 2.6 13.6 A 9.4 7.4 0 0 0 21.4 13.6 Z" fill={f} stroke={d} strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M 3.4 12.4 A 8.6 5.6 0 0 1 20.6 12.4 Z" fill={f} stroke={d} strokeWidth={1.1} strokeLinejoin="round" opacity={0.9} />
      <g fill="none" stroke={d} strokeWidth={0.65} opacity={0.65}>
        <path d="M 12 13.6 L 8.2 18.6" />
        <path d="M 12 13.6 L 12 19.4" />
        <path d="M 12 13.6 L 15.8 18.6" />
      </g>
      <circle cx={12} cy={12.6} r={3.5} fill="#ffffff" stroke={d} strokeWidth={0.9} />
      <circle cx={10.8} cy={11.4} r={1.15} fill="#ffffff" />
      <circle cx={10.8} cy={11.4} r={1.15} fill={f} opacity={0.35} />
    </g>
  );
}

/** The bare glyph, for dropping into an SVG that is already open (the board).
    Draw it inside a `translate/scale` — it fills 0,0 → 24,24. */
export const ResGlyph = memo(function ResGlyph({ res }: { res: Resource }) {
  const f = RES_FILL[res];
  const d = RES_DARK[res];
  switch (res) {
    case "palmWood": return <PalmWood f={f} d={d} />;
    case "limestone": return <Limestone f={f} d={d} />;
    case "dates": return <Dates f={f} d={d} />;
    case "fish": return <Fish f={f} d={d} />;
    case "pearls": return <Pearls f={f} d={d} />;
  }
});

/** The glyph as its own element, for use in HTML. */
export function ResIcon({ res, size = 18 }: { res: Resource; size?: number }) {
  return (
    <svg className="rico" width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <ResGlyph res={res} />
    </svg>
  );
}

/* -------------------------------------------------------------------------
   Dhow cards. These are actions, not objects, so each mark shows the EFFECT
   — wind pushing, a hand sweeping the stall, a road being laid. A player who
   has never read the rules should still be able to guess what happens.
   ------------------------------------------------------------------------- */

const CARD_INK = "#8d4326";
const CARD_SOFT = "#c78a5f";

function Windbreaker() {
  return (
    <g fill="none" stroke={CARD_INK} strokeWidth={1.9} strokeLinecap="round">
      <path d="M 2.5 8 h 10.5 a 2.8 2.8 0 1 0 -2.8 -2.8" />
      <path d="M 2.5 12.6 h 14.5 a 3 3 0 1 1 -3 3" />
      <path d="M 3.5 17.4 h 8" stroke={CARD_SOFT} />
    </g>
  );
}

function HiddenPearl() {
  return (
    <g>
      <circle cx={12} cy={13} r={6.4} fill="#f2f7f6" stroke={CARD_INK} strokeWidth={1.5} />
      <circle cx={9.8} cy={10.8} r={2} fill="#ffffff" />
      <g fill={CARD_INK}>
        <path d="M 19.4 3.4 l 1.1 2.6 l 2.6 1.1 l -2.6 1.1 l -1.1 2.6 l -1.1 -2.6 l -2.6 -1.1 l 2.6 -1.1 z" />
        <path d="M 4.4 4.6 l 0.7 1.7 l 1.7 0.7 l -1.7 0.7 l -0.7 1.7 l -0.7 -1.7 l -1.7 -0.7 l 1.7 -0.7 z" opacity={0.6} />
      </g>
    </g>
  );
}

function BountifulTide() {
  return (
    <g>
      <g fill={CARD_SOFT}>
        <circle cx={8} cy={6.4} r={2.9} />
        <circle cx={15.6} cy={5.4} r={2.9} />
      </g>
      <g fill="none" stroke={CARD_INK} strokeWidth={1.9} strokeLinecap="round">
        <path d="M 2.5 14 q 3.2 -3.4 6.4 0 q 3.2 3.4 6.4 0 q 3.2 -3.4 6.2 0" />
        <path d="M 2.5 19 q 3.2 -3.4 6.4 0 q 3.2 3.4 6.4 0 q 3.2 -3.4 6.2 0" />
      </g>
    </g>
  );
}

function SouqCorner() {
  return (
    <g>
      {/* a striped stall canopy, being swept clear */}
      <path d="M 2.5 9.5 q 2.4 -4 4.8 0 q 2.4 -4 4.8 0 q 2.4 -4 4.8 0 q 2.4 -4 4.6 0 z"
            fill={CARD_SOFT} stroke={CARD_INK} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M 4.6 9.5 v 11" stroke={CARD_INK} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M 19.4 9.5 v 11" stroke={CARD_INK} strokeWidth={1.6} strokeLinecap="round" />
      <g fill={CARD_INK}>
        <circle cx={9} cy={15} r={2.1} />
        <circle cx={14.2} cy={15} r={2.1} />
        <circle cx={11.6} cy={18.6} r={2.1} />
      </g>
    </g>
  );
}

function CaravanRoute() {
  return (
    <g>
      <path d="M 3 19 Q 8 19 11 13 Q 14 7 21 6"
            fill="none" stroke={CARD_INK} strokeWidth={2} strokeLinecap="round" strokeDasharray="3.4 3.2" />
      <g fill={CARD_SOFT} stroke={CARD_INK} strokeWidth={1.1}>
        <rect x={1.4} y={16.2} width={4.4} height={4.4} rx={1} />
        <rect x={18.2} y={3.4} width={4.4} height={4.4} rx={1} />
      </g>
    </g>
  );
}

export function DhowIcon({ kind, size = 24 }: { kind: DhowKind; size?: number }) {
  return (
    <svg className="dico" width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      {kind === "windbreaker" ? <Windbreaker />
        : kind === "hiddenPearl" ? <HiddenPearl />
        : kind === "bountifulTide" ? <BountifulTide />
        : kind === "souqCorner" ? <SouqCorner />
        : <CaravanRoute />}
    </svg>
  );
}

/** The face-down back of a dhow card — the deck, and anyone else's cards. */
export function DhowBack({ size = 24 }: { size?: number }) {
  return (
    <svg className="dico" width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <rect x={3.5} y={2.5} width={17} height={19} rx={2} fill={CARD_SOFT} stroke={CARD_INK} strokeWidth={1.3} />
      {/* a lateen sail, the mark the deck carries */}
      <path d="M 12 6 L 12 17.5" stroke={CARD_INK} strokeWidth={1.2} strokeLinecap="round" />
      <path d="M 12 6.6 L 17.4 16.4 L 12 17 Z" fill="#fdf8ec" stroke={CARD_INK} strokeWidth={1} strokeLinejoin="round" />
      <path d="M 6.6 18.4 q 5.4 2.4 10.8 0" fill="none" stroke={CARD_INK} strokeWidth={1.3} strokeLinecap="round" />
    </svg>
  );
}
