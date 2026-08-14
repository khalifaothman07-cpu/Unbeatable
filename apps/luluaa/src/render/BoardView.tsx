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

import { memo } from "react";
import { axialToPixel, hexCorners } from "../game/hex";
import { TERRAIN_LABEL, type Board, type Tile } from "../game/types";
import type { Port } from "../game/geometry";

const HEX_SIZE = 52;
const GAP = 0.955;

const isHot = (n: number | null) => n === 6 || n === 8;

/** A hex outline at an arbitrary radius, centred on (0,0). */
const ringPts = (r: number) =>
  hexCorners({ x: 0, y: 0 }, r).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
const pipsFor = (n: number) => 6 - Math.abs(7 - n);

/* ---------- terrain artwork ---------------------------------------------
   Each returns marks drawn INSIDE a hex centred on (0,0), so the caller can
   just translate. Kept deliberately sparse — the number token sits on top
   and legibility beats decoration. */

function WaterMarks({ pearl }: { pearl: boolean }) {
  return (
    <g>
      {/* surface chop, densest at the top where the light hits */}
      <g fill="none" stroke="#ffffff" strokeLinecap="round">
        {[-27, -19, -9, 3, 15, 25].map((dy, i) => (
          <path
            key={i}
            d={`M -30 ${dy} q 8 -4 15 0 q 7 4 15 0 q 8 -4 15 0`}
            strokeOpacity={0.3 - i * 0.03}
            strokeWidth={1.7 - i * 0.12}
          />
        ))}
      </g>
      {/* sun glint — one bright band, off-centre, so the water has a light
          source rather than being evenly textured */}
      <ellipse cx={-8} cy={-16} rx={17} ry={4} fill="#ffffff" opacity={0.14} />

      {pearl ? (
        <g>
          {/* sea floor: ripple ridges under the shells */}
          <g fill="none" stroke="#0d5f5c" strokeOpacity={0.22} strokeWidth={1.4}>
            <path d="M -26 18 q 10 -4 20 0 q 10 4 20 0" />
            <path d="M -24 27 q 10 -4 20 0 q 10 4 20 0" />
          </g>
          {[
            { x: -14, y: 9, r: 14, s: 1 },
            { x: 13, y: 3, r: -16, s: 0.9 },
            { x: -1, y: 23, r: 6, s: 0.82 },
          ].map((sh, i) => (
            <g key={i} transform={`translate(${sh.x} ${sh.y}) rotate(${sh.r}) scale(${sh.s})`}>
              <ellipse cy={1.5} rx={11} ry={8} fill="#0a4a4e" opacity={0.28} />
              <ellipse rx={11} ry={8} fill="#f0ece0" stroke="#b9a88c" strokeWidth={0.9} />
              <ellipse rx={11} ry={8} fill="url(#shellSheen)" opacity={0.75} />
              {/* the fluted ribs that make a shell read as a shell */}
              <g fill="none" stroke="#c3b191" strokeWidth={0.6} opacity={0.85}>
                <path d="M 0 -7.4 q -4 4 -6.5 7" />
                <path d="M 0 -7.6 q 0 4 0 7.4" />
                <path d="M 0 -7.4 q 4 4 6.5 7" />
              </g>
              <path d="M -11 0 q 11 5 22 0" fill="none" stroke="#b9a88c" strokeWidth={0.8} opacity={0.8} />
              <circle r={3.1} fill="url(#pearlGrad)" />
              <circle r={3.1} fill="none" stroke="#8aa9a6" strokeWidth={0.5} opacity={0.7} />
              <circle cx={-1} cy={-1} r={0.9} fill="#ffffff" opacity={0.9} />
            </g>
          ))}
          {/* diver's bubbles rising */}
          <g fill="#ffffff" opacity={0.4}>
            <circle cx={22} cy={16} r={1.8} />
            <circle cx={25} cy={9} r={1.2} />
            <circle cx={22.5} cy={3} r={0.8} />
          </g>
        </g>
      ) : (
        <g>
          {/* a shoal, seen from above — this is the tile that yields fish */}
          {[
            { x: -16, y: 17, s: 1.25, o: 0.72 },
            { x: 3, y: 24, s: 1.05, o: 0.62 },
            { x: 18, y: 14, s: 1.15, o: 0.66 },
            { x: -4, y: 9, s: 0.9, o: 0.5 },
          ].map((f, i) => (
            <g key={i} transform={`translate(${f.x} ${f.y}) scale(${f.s})`} opacity={f.o}>
              <path d="M -7 0 q 5 -4.5 10 0 q -5 4.5 -10 0 z" fill="#06333a" />
              <path d="M -7 0 l -4.5 -3.5 l 0 7 z" fill="#06333a" />
              <circle cx={1.5} cy={-1} r={0.8} fill="#cfeeea" opacity={0.9} />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

function PalmMarks() {
  const palm = (x: number, y: number, sc: number, lean: number) => (
    <g transform={`translate(${x} ${y}) scale(${sc}) rotate(${lean})`}>
      {/* shadow pooled at the base, so the tree stands on something */}
      <ellipse cy={1} rx={7} ry={2.2} fill="#2f4420" opacity={0.35} />
      <path d="M 0 0 q -2 -10 1 -19" stroke="#5c4326" strokeWidth={2.6} fill="none" strokeLinecap="round" />
      {/* trunk rings */}
      <g stroke="#3f2d19" strokeWidth={0.7} opacity={0.7}>
        <path d="M -1.2 -5 l 2.6 -0.5" />
        <path d="M -0.6 -10 l 2.6 -0.5" />
        <path d="M 0 -15 l 2.4 -0.5" />
      </g>
      {[-74, -40, -12, 16, 46, 78].map((a) => (
        <path
          key={a}
          d="M 0 0 q 9 -5 17 -1 q -9 0 -17 5 z"
          transform={`translate(1 -19) rotate(${a})`}
          fill={a % 2 ? "#2f5c2a" : "#3a6d31"}
        />
      ))}
      <circle cx={1} cy={-19} r={1.8} fill="#4a3520" />
    </g>
  );
  return (
    <g>
      {/* scrub between the trunks — a grove, not three specimens */}
      <g fill="#3f6b2f" opacity={0.4}>
        {[[-18, 24], [4, 27], [22, 23], [-32, 18], [32, 15]].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx={6} ry={2.4} />
        ))}
      </g>
      {palm(-27, 16, 1.05, -6)}
      {palm(-9, 24, 0.86, 3)}
      {palm(12, 18, 1, 5)}
      {palm(29, 25, 0.78, -4)}
      {palm(1, 6, 0.7, -2)}
    </g>
  );
}

function QuarryMarks() {
  /* coral-stone (farrouj) cut from a working face: courses of sawn block
     below, the cut bench they came out of above */
  const block = (x: number, y: number, w: number, h: number) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={0.8} fill="#efe2cc" />
      <rect width={w} height={h} rx={0.8} fill="none" stroke="#a08c6c" strokeWidth={0.9} />
      <rect width={w} height={h * 0.34} rx={0.8} fill="#ffffff" opacity={0.4} />
      {/* saw kerf */}
      <path d={`M 2 ${h * 0.66} L ${w - 2} ${h * 0.66}`} stroke="#c4b193" strokeWidth={0.5} opacity={0.8} />
    </g>
  );
  return (
    <g>
      {/* the cut face, stepped back */}
      <g opacity={0.55}>
        <path d="M -30 -20 L -8 -20 L -8 -12 L 12 -12 L 12 -4 L 30 -4"
              fill="none" stroke="#9c8663" strokeWidth={2} strokeLinejoin="round" />
        <path d="M -30 -20 L -8 -20 L -8 -12 L 12 -12 L 12 -4 L 30 -4 L 30 -26 L -30 -26 Z"
              fill="#d8c6a4" opacity={0.5} />
      </g>
      {/* chisel marks in the face */}
      <g stroke="#9c8663" strokeWidth={0.7} opacity={0.5}>
        {[-24, -18, 0, 6, 20, 26].map((x, i) => (
          <path key={i} d={`M ${x} ${-22 + (i % 3) * 3} l 0 4`} />
        ))}
      </g>
      {block(-26, 2, 17, 9)}
      {block(-7, 2, 17, 9)}
      {block(12, 2, 15, 9)}
      {block(-17, 13, 17, 9)}
      {block(2, 13, 17, 9)}
      {block(-27, 24, 15, 8)}
      {block(-10, 24, 15, 8)}
    </g>
  );
}

function DateMarks() {
  const tree = (x: number, y: number, sc: number) => (
    <g transform={`translate(${x} ${y}) scale(${sc})`}>
      <ellipse cy={1} rx={8} ry={2.4} fill="#5a3f18" opacity={0.3} />
      <path d="M 0 0 q -3 -13 1 -25" stroke="#5c4326" strokeWidth={3} fill="none" strokeLinecap="round" />
      <g stroke="#3f2d19" strokeWidth={0.8} opacity={0.65}>
        {[-6, -11, -16, -21].map((dy) => <path key={dy} d={`M -1.4 ${dy} l 3 -0.6`} />)}
      </g>
      {[-78, -46, -16, 14, 44, 76].map((a) => (
        <path key={a} d="M 0 0 q 10 -6 19 -1 q -10 0 -19 6 z"
              transform={`translate(1 -25) rotate(${a})`}
              fill={a % 2 ? "#3f6b2f" : "#4a7d38"} />
      ))}
      {/* the crop itself, hanging in bunches under the crown */}
      {[[-7, -18], [7, -19], [0, -15]].map(([bx, by], i) => (
        <g key={i} transform={`translate(${bx} ${by})`}>
          {[0, 2.6, 5.2, 7.8].map((dy, k) => (
            <ellipse key={k} cy={dy} rx={1.9} ry={2.5} fill={k % 2 ? "#7a3f1d" : "#8f4d22"} />
          ))}
        </g>
      ))}
    </g>
  );
  return (
    <g>
      {/* the spring the grove exists for */}
      <g>
        {/* damp ground first, then the water — a spring in a hollow rather
            than a blue disc dropped on the sand */}
        <ellipse cx={3} cy={27} rx={22} ry={8} fill="#7d5626" opacity={0.55} />
        <ellipse cx={3} cy={27} rx={15} ry={5} fill="#2f8f92" opacity={0.45} />
        <path d="M -5 26 q 5 -1.5 10 0" fill="none" stroke="#ffffff" strokeOpacity={0.3} strokeWidth={1} />
      </g>
      {tree(-16, 20, 1)}
      {tree(15, 22, 0.86)}
      {tree(0, 10, 0.66)}
    </g>
  );
}

function SabkhaMarks() {
  /* salt crust: polygon plates with lifted, brighter edges — nothing grows,
     and that emptiness is the point */
  const plates = [
    "M -30 -8 L -12 -14 L 2 -6 L -6 6 L -26 4 Z",
    "M 2 -6 L 22 -12 L 30 -2 L 18 8 L -6 6 Z",
    "M -26 4 L -6 6 L -2 20 L -20 22 Z",
    "M -2 20 L 18 8 L 28 16 L 14 26 Z",
  ];
  return (
    <g>
      {plates.map((d, i) => (
        <g key={i}>
          <path d={d} fill="#ffffff" opacity={0.16} />
          <path d={d} fill="none" stroke="#b7ae98" strokeWidth={1.1} opacity={0.6} strokeLinejoin="round" />
        </g>
      ))}
      {/* crystal glitter along the ridges */}
      <g fill="#ffffff" opacity={0.7}>
        {[[-18, -9], [6, -8], [-12, 12], [16, 14], [24, -4]].map(([x, y], i) => (
          <path key={i} d={`M ${x} ${y - 2.4} L ${x + 1.6} ${y} L ${x} ${y + 2.4} L ${x - 1.6} ${y} Z`} />
        ))}
      </g>
    </g>
  );
}

/* The Shamal — the north wind, carrying dust. Weather, not a raider: a
   rolling dust head with wind torn off the top of it. */
function ShamalToken() {
  return (
    <g>
      <circle r={21} fill="#2a231c" opacity={0.35} />
      <circle r={20} fill="#cdbfa6" stroke="#6d6459" strokeWidth={1.6} />
      <circle r={20} fill="url(#metalSheen)" opacity={0.55} />
      {/* billowing dust lobes */}
      <g fill="#b8a88b" opacity={0.9}>
        <circle cx={-6} cy={3} r={8} />
        <circle cx={5} cy={5} r={6.5} />
        <circle cx={0} cy={-4} r={7} />
        <circle cx={9} cy={-3} r={5} />
      </g>
      <g fill="#e0d5bd" opacity={0.75}>
        <circle cx={-7} cy={0} r={5} />
        <circle cx={2} cy={-6} r={4} />
      </g>
      {/* wind, streaming off the head */}
      <g fill="none" stroke="#6d6459" strokeWidth={1.5} strokeLinecap="round" opacity={0.8}>
        <path d="M -19 -10 q 9 -4 17 -1" />
        <path d="M -16 -15 q 11 -5 21 -1" />
        <path d="M -12 12 q 10 4 19 1" />
      </g>
    </g>
  );
}

const TileArt = memo(function TileArt({ tile }: { tile: Tile }) {
  switch (tile.terrain) {
    case "gulfWaters": return <WaterMarks pearl={false} />;
    case "pearlBank": return <WaterMarks pearl />;
    case "palmGrove": return <PalmMarks />;
    case "quarryFlats": return <QuarryMarks />;
    case "oasis": return <DateMarks />;
    case "sabkha": return <SabkhaMarks />;
  }
});

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

      {hasShamal && (
        <>
          {/* The token alone was too polite: players couldn't tell the tile
              had stopped producing. The shroud is the actual information. */}
          <polygon points={pts} fill="#1c1712" opacity={0.55} />
          <polygon points={pts} fill="none" stroke="#e9e6df" strokeWidth={2} strokeDasharray="5 4" opacity={0.85}>
            <animate attributeName="stroke-dashoffset" values="0;18" dur="1.6s" repeatCount="indefinite" />
          </polygon>
          <ShamalToken />
        </>
      )}

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


/* ---------- open water ---------------------------------------------------
   The sea can't be an empty field or the eye slides straight off it. These
   sit UNDER the island, so anything that lands beneath the tiles is simply
   hidden — no need to know where the coastline falls. */

function DistantDhow({ x, y, s: sc, flip }: { x: number; y: number; s: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -sc : sc} ${sc})`} opacity={0.5}>
      <path d="M -13 0 q 13 7 26 0 q -6 5 -13 5 q -7 0 -13 -5 z" fill="#0a3d44" />
      <path d="M 0 -1 L 0 -20 L 13 -2 Z" fill="#0a3d44" opacity={0.85} />
      <path d="M -1 -1 L -1 -14 L -10 -2 Z" fill="#0a3d44" opacity={0.6} />
    </g>
  );
}

const SeaLife = memo(function SeaLife({ minX, minY, width, height }: { minX: number; minY: number; width: number; height: number }) {
  const x0 = minX + 26, y0 = minY + 26, w = width - 52, h = height - 52;
  const at = (fx: number, fy: number) => ({ x: x0 + w * fx, y: y0 + h * fy });

  const boats = [
    { ...at(0.11, 0.12), s: 1.15, flip: false },
    { ...at(0.89, 0.18), s: 0.9, flip: true },
    { ...at(0.16, 0.88), s: 0.85, flip: true },
    { ...at(0.85, 0.85), s: 1.0, flip: false },
  ];
  const birds = [at(0.32, 0.07), at(0.38, 0.05), at(0.44, 0.08), at(0.66, 0.94), at(0.72, 0.92)];

  return (
    <g>
      {/* long depth ripples, wider apart than the swell so the two read as
          different distances rather than one busy texture */}
      <g fill="none" stroke="#cfeeea" strokeOpacity={0.13} strokeWidth={2} strokeLinecap="round">
        {[0.06, 0.24, 0.5, 0.72, 0.94].map((f, i) => (
          <path key={i} d={`M ${x0 - 20} ${y0 + h * f} q ${w * 0.25} ${i % 2 ? -14 : 14} ${w * 0.5} 0 q ${w * 0.25} ${i % 2 ? 14 : -14} ${w * 0.55} 0`} />
        ))}
      </g>
      {boats.map((b, i) => <DistantDhow key={i} {...b} />)}
      <g fill="none" stroke="#dff5f2" strokeOpacity={0.35} strokeWidth={1.6} strokeLinecap="round">
        {birds.map((b, i) => (
          <path key={i} d={`M ${b.x - 7} ${b.y} q 3.5 -4 7 0 q 3.5 -4 7 0`} />
        ))}
      </g>
    </g>
  );
});

/* A compass rose, because every sea chart has one and it tells the eye this
   is a map rather than a grid. */
const CompassRose = memo(function CompassRose({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={0.4}>
      <circle r={30} fill="none" stroke="#dff5f2" strokeWidth={1.2} strokeOpacity={0.5} />
      <circle r={22} fill="none" stroke="#dff5f2" strokeWidth={0.8} strokeOpacity={0.35} />
      {[0, 90, 180, 270].map((a) => (
        <path key={a} d="M 0 -29 L 5.5 0 L 0 29 L -5.5 0 Z" transform={`rotate(${a})`}
              fill="#eaf7f4" fillOpacity={a === 0 ? 0.85 : 0.4} />
      ))}
      {[45, 135, 225, 315].map((a) => (
        <path key={a} d="M 0 -18 L 3 0 L 0 18 L -3 0 Z" transform={`rotate(${a})`}
              fill="#eaf7f4" fillOpacity={0.25} />
      ))}
      <text y={-34} textAnchor="middle" fontSize={11} fontWeight={700}
            fontFamily="ui-monospace, monospace" fill="#eaf7f4" fillOpacity={0.8}>N</text>
    </g>
  );
});

/* ---------- TRADE POSTS ---------------------------------------------------
   A moored dhow rather than a disc. The ship is the thing a Catan board
   uses to say "you can trade here", and it does the job better than a badge
   because it reads at a glance even when the board is 350px wide on a
   phone: hull, lateen sail, a line back to the shore it serves.

   The rate goes ON the sail — the one surface big enough to hold two
   characters at this scale — and the resource it deals in is carried by the
   hull pennant, colour-matched to the swatches in your hand. */
function TradePost({ port }: { port: Port }) {
  const RES_FILL: Record<string, string> = {
    palmWood: "#6f8f4a", limestone: "#c3ac8a", dates: "#a8763c",
    fish: "#1c7d84", pearls: "#8fc9c6",
  };
  const out = 30;
  const cx = port.x + port.nx * out;
  const cy = port.y + port.ny * out;
  /* face the ship along the shore's normal, so it always sits bow-out to
     open water instead of sailing into the island */
  const angle = (Math.atan2(port.ny, port.nx) * 180) / Math.PI + 90;
  const flag = port.resource ? RES_FILL[port.resource] : "#efe7d6";

  return (
    <g className="port">
      {/* mooring line back to the shore it serves */}
      <line
        x1={port.x} y1={port.y} x2={cx} y2={cy}
        stroke="#f0e3c6" strokeWidth={1.6} strokeLinecap="round"
        strokeDasharray="3 3" opacity={0.5}
      />
      <g transform={`translate(${cx} ${cy}) rotate(${angle})`}>
        {/* wake */}
        <ellipse cy={9} rx={20} ry={5} fill="#eaf7f4" opacity={0.16} />

        {/* hull — the raised stern of a Gulf dhow, not a rowing boat */}
        <path
          d="M -19 0 q 4 10 19 10 q 15 0 19 -10 q -6 3 -19 3 q -13 0 -19 -3 z"
          fill="url(#hull)" stroke="#31200f" strokeWidth={1} strokeLinejoin="round"
        />
        <path d="M 17 0 q 4 -6 6 -12 q -5 3 -8 10 z" fill="#5e3a1c" stroke="#31200f" strokeWidth={0.8} />
        {/* gunwale highlight */}
        <path d="M -17 0.5 q 17 4 34 0" fill="none" stroke="#c99a63" strokeWidth={1.1} opacity={0.7} />

        {/* mast + lateen sail, raked forward the way a settee rig sits */}
        <line x1={-2} y1={0} x2={-2} y2={-27} stroke="#3f2712" strokeWidth={1.6} strokeLinecap="round" />
        <path
          d="M -2 -26 L 15 -3 L -2 -1 Z"
          fill="url(#sailCloth)" stroke="#8a6a3c" strokeWidth={0.9} strokeLinejoin="round"
        />
        <path d="M -2 -26 L 15 -3" fill="none" stroke="#8a6a3c" strokeWidth={1.1} opacity={0.8} />

        {/* the rate, upright regardless of how the hull is turned */}
        <g transform={`rotate(${-angle}) translate(0 -1)`}>
          <text
            textAnchor="middle" y={3.2}
            fontSize={9.5} fontWeight={700} fontFamily="ui-monospace, monospace"
            fill="#2a211a" stroke="#fdf8ec" strokeWidth={2.6} paintOrder="stroke"
          >
            {port.resource ? "2:1" : "3:1"}
          </text>
        </g>

        {/* pennant — which good this post deals in */}
        <path d="M -2 -27 L 10 -23 L -2 -19 Z" fill={flag} stroke="#31200f" strokeWidth={0.7} />
      </g>
    </g>
  );
}

export function BoardView({
  board, shamalTile, onTile, tileTargets, ports, children,
}: {
  board: Board;
  shamalTile?: string;
  onTile?: (id: string) => void;
  tileTargets?: Set<string>;
  ports?: Port[];
  children?: React.ReactNode;
}) {
  const placed = board.tiles.map((tile) => ({ tile, ...axialToPixel(tile.hex, HEX_SIZE) }));
  const shamalId = shamalTile ?? board.tiles.find((t) => t.terrain === "sabkha")?.id;

  const xs = placed.map((p) => p.x);
  const ys = placed.map((p) => p.y);
  /* The moored dhows hang off the coastline — hull, mast and pennant reach
     roughly a hex and a half beyond the last tile — so the frame has to
     leave room or the ships get sliced in half by the viewBox. The wider
     margin also gives the island open water to sit in, which is most of
     why it reads as a place rather than a grid. */
  const pad = HEX_SIZE * 2.42;
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
        {/* THE GULF — deep offshore at the edges, shallow over the island
            shelf. Two stops would read as a flat wash; the middle stop is
            what makes it look like water with a bottom under it. */}
        <radialGradient id="sea" cx="50%" cy="46%" r="72%">
          <stop offset="0" stopColor="#3fb0b2" />
          <stop offset="0.42" stopColor="#1f8b93" />
          <stop offset="0.78" stopColor="#0e565e" />
          <stop offset="1" stopColor="#07363d" />
        </radialGradient>
        <radialGradient id="shelf" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#8fd8d2" stopOpacity="0.95" />
          <stop offset="1" stopColor="#8fd8d2" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="beach" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0e3c6" />
          <stop offset="1" stopColor="#dcc79f" />
        </linearGradient>
        {/* swell — one tile of paired crests, repeated across the whole sea
            so the water has direction instead of being a colour field */}
        <pattern id="swell" width="86" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
          <path d="M -6 12 q 12 -7 24 0 q 12 7 24 0 q 12 -7 24 0 q 12 7 24 0"
                fill="none" stroke="#dff5f2" strokeOpacity="0.17" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M -6 33 q 12 -7 24 0 q 12 7 24 0 q 12 -7 24 0 q 12 7 24 0"
                fill="none" stroke="#dff5f2" strokeOpacity="0.10" strokeWidth="1.3" strokeLinecap="round" />
        </pattern>
        <linearGradient id="sailCloth" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#fdf8ec" />
          <stop offset="1" stopColor="#e4d3ae" />
        </linearGradient>
        <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5a33" />
          <stop offset="1" stopColor="#4e3018" />
        </linearGradient>

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
      {/* ---- THE GULF ----------------------------------------------------
          The island has to sit IN something. A flat ground made the tiles
          look like samples on a table; water gives them a shore, and the
          shore is what makes a board read as a place. Everything in here is
          clipped to the inner panel so the frame stays clean. */}
      <clipPath id="sea-clip">
        <rect x={minX + 26} y={minY + 26} width={width - 52} height={height - 52} rx={4} />
      </clipPath>
      <g clipPath="url(#sea-clip)">
        <rect x={minX + 26} y={minY + 26} width={width - 52} height={height - 52} fill="url(#sea)" />
        <rect x={minX + 26} y={minY + 26} width={width - 52} height={height - 52} fill="url(#swell)" />

        {/* open water, before the island is laid over it */}
        <SeaLife minX={minX} minY={minY} width={width} height={height} />

        {/* Shelf, beach, then the tiles. Each is the same hex field drawn a
            little larger, so the union of thirty hexes gives the island its
            outline for free — no polygon merging, and the seams vanish
            under identical fills. */}
        <g opacity={0.75}>
          {placed.map(({ tile, x, y }) => (
            <polygon key={`sh-${tile.id}`} points={ringPts(HEX_SIZE * 1.34)}
                     transform={`translate(${x} ${y})`} fill="url(#shelf)" />
          ))}
        </g>
        {placed.map(({ tile, x, y }) => (
          <polygon key={`sf-${tile.id}`} points={ringPts(HEX_SIZE * 1.1)}
                   transform={`translate(${x} ${y})`} fill="#7ec9c4" opacity={0.85} />
        ))}
        {placed.map(({ tile, x, y }) => (
          <polygon key={`bh-${tile.id}`} points={ringPts(HEX_SIZE * 1.045)}
                   transform={`translate(${x} ${y})`} fill="url(#beach)" />
        ))}
        {/* the wet line where the sand meets the water */}
        {placed.map(({ tile, x, y }) => (
          <polygon key={`cl-${tile.id}`} points={ringPts(HEX_SIZE * 1.045)}
                   transform={`translate(${x} ${y})`} fill="none"
                   stroke="#b99b73" strokeWidth={1.4} opacity={0.35} />
        ))}

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
        {ports?.map((p) => <TradePost key={p.id} port={p} />)}
        <CompassRose x={minX + 26 + 52} y={minY + height - 26 - 52} />
      </g>
      {children}
    </svg>
  );
}
