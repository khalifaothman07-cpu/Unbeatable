/* =========================================================================
   BoardView.tsx — SVG board renderer
   -------------------------------------------------------------------------
   Pixel positions derive from axial (q, r); the whole board is normalised by
   bounding box so any row profile centres itself.

   Art direction follows the physical-board reference: carved wood frame,
   sadu-weave band, resin-turquoise water with oyster shells, coral-stone
   blocks, palm groves. It is illustrated rather than photoreal — a hex SVG
   can carry texture, depth and iconography, but not resin and grain.
   ========================================================================= */

import { axialToPixel, hexCorners } from "../game/hex";
import { TERRAIN_LABEL, type Board, type Tile } from "../game/types";
import { PALETTE } from "./theme";

const HEX_SIZE = 52;
const GAP = 0.955;

const isHot = (n: number | null) => n === 6 || n === 8;
const pipsFor = (n: number) => 6 - Math.abs(7 - n);

/* ---------- terrain artwork ---------------------------------------------
   Each returns marks drawn INSIDE a hex centred on (0,0), so the caller can
   just translate. Kept deliberately sparse — the number token sits on top
   and legibility beats decoration. */

function WaterMarks({ pearl }: { pearl: boolean }) {
  return (
    <g opacity={0.85}>
      {[-16, 2, 20].map((dy, i) => (
        <path
          key={i}
          d={`M -26 ${dy} q 9 -5 18 0 q 9 5 18 0`}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.28}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      ))}
      {pearl && (
        <g>
          {[
            { x: -13, y: 10, r: 1 },
            { x: 12, y: 4, r: -1 },
            { x: -2, y: 24, r: 0.4 },
          ].map((s, i) => (
            <g key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.r * 18})`}>
              {/* oyster shell, opened, pearl seated in it */}
              <ellipse rx={11} ry={8} fill="#f0ece0" stroke="#b9a88c" strokeWidth={0.9} />
              <ellipse rx={11} ry={8} fill="url(#shellSheen)" opacity={0.75} />
              <path d="M -11 0 q 11 5 22 0" fill="none" stroke="#b9a88c" strokeWidth={0.8} opacity={0.8} />
              <circle r={3.1} fill="url(#pearlGrad)" />
              <circle r={3.1} fill="none" stroke="#8aa9a6" strokeWidth={0.5} opacity={0.7} />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

function PalmMarks() {
  const palm = (x: number, y: number, s: number) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M 0 0 q -1.6 -9 0.6 -17" stroke="#5c4326" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      {[-62, -28, 0, 28, 62].map((a) => (
        <path
          key={a}
          d="M 0 0 q 8 -4 15 -1 q -8 -1 -15 4 z"
          transform={`translate(0.6 -17) rotate(${a})`}
          fill="#2f5c2a"
          opacity={0.92}
        />
      ))}
    </g>
  );
  return (
    <g opacity={0.95}>
      {palm(-26, 14, 1.05)}
      {palm(24, 16, 0.95)}
      {palm(0, 20, 0.85)}
    </g>
  );
}

function QuarryMarks() {
  /* coral-stone (farrouj) blocks, stacked and offset like real courses */
  const block = (x: number, y: number, w: number, h: number) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={1} fill="#efe2cc"  />
      <rect width={w} height={h} rx={1} fill="none" stroke="#a08c6c" strokeWidth={0.9} />
      <rect width={w} height={h * 0.34} rx={1} fill="#ffffff" opacity={0.35} />
    </g>
  );
  return (
    <g opacity={0.92}>
      {block(-24, 4, 17, 9)}
      {block(-5, 4, 17, 9)}
      {block(-15, 15, 17, 9)}
      {block(4, 15, 17, 9)}
      {block(-24, -7, 17, 9)}
      {block(-5, -7, 17, 9)}
    </g>
  );
}

function DateMarks() {
  return (
    <g opacity={0.95}>
      <path d="M 0 22 q -2 -12 1 -22" stroke="#5c4326" strokeWidth={2.6} fill="none" strokeLinecap="round" />
      {[-70, -34, 0, 34, 70].map((a) => (
        <path
          key={a}
          d="M 0 0 q 9 -5 17 -1 q -9 -1 -17 5 z"
          transform={`translate(1 0) rotate(${a})`}
          fill="#3f6b2f"
          opacity={0.9}
        />
      ))}
      {/* date clusters — the crop, not just the tree */}
      {[
        [-7, 7],
        [7, 6],
        [0, 12],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          {[0, 3.4, 6.8].map((dy, k) => (
            <ellipse key={k} cy={dy} rx={2} ry={2.7} fill="#7a3f1d" opacity={0.95} />
          ))}
        </g>
      ))}
    </g>
  );
}

function SabkhaMarks() {
  /* salt crust: polygonal crack lines, no crop, nothing grows */
  return (
    <g opacity={0.55} stroke="#b7ae98" strokeWidth={1} fill="none" strokeLinecap="round">
      <path d="M -28 -6 L -10 -12 L 6 -4 L 24 -10" />
      <path d="M -24 10 L -6 4 L 10 12 L 26 6" />
      <path d="M -10 -12 L -6 4" />
      <path d="M 6 -4 L 10 12" />
    </g>
  );
}

/** The Shamal — a wind swirl, weather rather than a raider. */
function ShamalToken() {
  return (
    <g>
      <circle r={19} fill="#e9e6df" stroke="#6d6459" strokeWidth={1.6} />
      <circle r={19} fill="url(#metalSheen)" opacity={0.8} />
      {[0, 120, 240].map((a) => (
        <path
          key={a}
          d="M 0 0 q 10 -3 12 -11 q 4 9 -3 15 q -6 5 -9 -4 z"
          transform={`rotate(${a})`}
          fill="#8d8378"
          opacity={0.95}
        />
      ))}
      <circle r={3} fill="#efece5" stroke="#6d6459" strokeWidth={1} />
    </g>
  );
}

function TileArt({ tile }: { tile: Tile }) {
  switch (tile.terrain) {
    case "gulfWaters": return <WaterMarks pearl={false} />;
    case "pearlBank": return <WaterMarks pearl />;
    case "palmGrove": return <PalmMarks />;
    case "quarryFlats": return <QuarryMarks />;
    case "oasis": return <DateMarks />;
    case "sabkha": return <SabkhaMarks />;
  }
}

function TileShape({
  tile, cx, cy, hasShamal, targetable, onPick,
}: {
  tile: Tile; cx: number; cy: number; hasShamal: boolean;
  targetable?: boolean; onPick?: (id: string) => void;
}) {
  const pts = hexCorners({ x: 0, y: 0 }, HEX_SIZE * GAP)
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
  const hot = isHot(tile.token);

  return (
    <g
      transform={`translate(${cx.toFixed(2)} ${cy.toFixed(2)})`}
      onClick={targetable && onPick ? () => onPick(tile.id) : undefined}
      style={targetable ? { cursor: "pointer" } : undefined}
    >
      <title>
        {TERRAIN_LABEL[tile.terrain]}
        {tile.token !== null ? ` · ${tile.token}` : " · produces nothing"}
      </title>

      {/* seated depth — the tile reads as a piece set into the board */}
      <polygon points={pts} transform="translate(0 3)" fill="#000000" opacity={0.22} />
      <polygon points={pts} fill={`url(#t-${tile.terrain})`} stroke="#5f5142" strokeWidth={1.6} />

      {/* art is pushed to the lower band of the hex — the number token owns
          the centre, and terrain you cannot see is just wasted drawing */}
      <g clipPath={`url(#clip-hex)`} transform="translate(0 12)">
        <TileArt tile={tile} />
      </g>

      {/* inner bevel */}
      <polygon points={pts} fill="none" stroke="#ffffff" strokeOpacity={0.22} strokeWidth={1.2} transform="scale(0.94)" />

      {targetable && (
        <polygon points={pts} fill="#ffffff" opacity={0.28} stroke="#ffffff" strokeWidth={3}>
          <animate attributeName="opacity" values="0.14;0.4;0.14" dur="1.4s" repeatCount="indefinite" />
        </polygon>
      )}

      {hasShamal && <ShamalToken />}

      {tile.token !== null && !hasShamal && (
        <g>
          <circle r={15.5} cy={1} fill="#000" opacity={0.18} />
          <circle r={15.5} fill="url(#tokenGrad)" stroke="#7a6a52" strokeWidth={1.2} />
          <text
            y={-2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={16}
            fontWeight={800}
            fill={hot ? "#a8321f" : "#31261c"}
            fontFamily="ui-monospace, monospace"
          >
            {tile.token}
          </text>
          {(() => {
            const n = pipsFor(tile.token);
            return Array.from({ length: n }, (_u, i) => (
              <circle
                key={i}
                cx={(i - (n - 1) / 2) * 4.3}
                cy={8.5}
                r={1.45}
                fill={hot ? "#a8321f" : "rgba(49,38,28,0.6)"}
              />
            ));
          })()}
        </g>
      )}
    </g>
  );
}

export function BoardView({
  board, shamalTile, onTile, tileTargets, children,
}: {
  board: Board;
  shamalTile?: string;
  onTile?: (id: string) => void;
  tileTargets?: Set<string>;
  children?: React.ReactNode;
}) {
  const placed = board.tiles.map((tile) => ({ tile, ...axialToPixel(tile.hex, HEX_SIZE) }));
  const shamalId = shamalTile ?? board.tiles.find((t) => t.terrain === "sabkha")?.id;

  const xs = placed.map((p) => p.x);
  const ys = placed.map((p) => p.y);
  const pad = HEX_SIZE * 1.35;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const height = Math.max(...ys) - Math.min(...ys) + pad * 2;

  const hexClip = hexCorners({ x: 0, y: 0 }, HEX_SIZE * GAP)
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  return (
    <svg
      className="board"
      viewBox={`${minX.toFixed(1)} ${minY.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}`}
      role="img"
      aria-label={`LU'LU'A board, ${board.tiles.length} tiles`}
    >
      <defs>
        <clipPath id="clip-hex">
          <polygon points={hexClip} />
        </clipPath>

        <linearGradient id="t-gulfWaters" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2ba0a6" />
          <stop offset="1" stopColor="#116066" />
        </linearGradient>
        <linearGradient id="t-pearlBank" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fd3ce" />
          <stop offset="1" stopColor="#2e9490" />
        </linearGradient>
        <linearGradient id="t-palmGrove" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8aa957" />
          <stop offset="1" stopColor="#4f6f34" />
        </linearGradient>
        <linearGradient id="t-quarryFlats" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dcc7a3" />
          <stop offset="1" stopColor="#b99b73" />
        </linearGradient>
        <linearGradient id="t-oasis" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cf9a52" />
          <stop offset="1" stopColor="#94642c" />
        </linearGradient>
        <linearGradient id="t-sabkha" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2eee2" />
          <stop offset="1" stopColor="#ded7c4" />
        </linearGradient>

        <radialGradient id="pearlGrad" cx="34%" cy="30%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#e6f6f4" />
          <stop offset="100%" stopColor="#93c2be" />
        </radialGradient>
        <linearGradient id="shellSheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="50%" stopColor="#ffe9f2" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#cfe9e6" stopOpacity="0.6" />
        </linearGradient>
        <radialGradient id="metalSheen" cx="35%" cy="28%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#a49a8d" stopOpacity="0.25" />
        </radialGradient>
        <radialGradient id="tokenGrad" cx="36%" cy="30%">
          <stop offset="0" stopColor="#fbf6e9" />
          <stop offset="100%" stopColor="#e4d6b8" />
        </radialGradient>

        {/* sadu weave — the woven band that frames a real Gulf board */}
        <pattern id="sadu" width="34" height="17" patternUnits="userSpaceOnUse">
          <rect width="34" height="17" fill="#7d2b25" />
          <path d="M0 8.5 L8.5 0 L17 8.5 L8.5 17 Z" fill="#efe6d4" />
          <path d="M17 8.5 L25.5 0 L34 8.5 L25.5 17 Z" fill="#1d1b18" />
          <rect y="0" width="34" height="1.4" fill="#efe6d4" opacity="0.8" />
          <rect y="15.6" width="34" height="1.4" fill="#efe6d4" opacity="0.8" />
        </pattern>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9c6f42" />
          <stop offset="0.5" stopColor="#7d5730" />
          <stop offset="1" stopColor="#5f4023" />
        </linearGradient>
      </defs>

      {/* carved wood frame + woven band, drawn behind the tiles */}
      <rect x={minX} y={minY} width={width} height={height} rx={10} fill="url(#wood)" />
      <rect
        x={minX + 9}
        y={minY + 9}
        width={width - 18}
        height={height - 18}
        rx={6}
        fill="url(#sadu)"
        opacity={0.95}
      />
      <rect
        x={minX + 26}
        y={minY + 26}
        width={width - 52}
        height={height - 52}
        rx={4}
        fill={PALETTE.sand}
      />
      <rect
        x={minX + 26}
        y={minY + 26}
        width={width - 52}
        height={height - 52}
        rx={4}
        fill="none"
        stroke="#5f4023"
        strokeWidth={1.5}
        opacity={0.5}
      />

      {placed.map(({ tile, x, y }) => (
        <TileShape
          key={tile.id}
          tile={tile}
          cx={x}
          cy={y}
          hasShamal={tile.id === shamalId}
          targetable={!!tileTargets?.has(tile.id)}
          onPick={onTile}
        />
      ))}
      {children}
    </svg>
  );
}
