/* =========================================================================
   Pieces.tsx — interactive overlay: routes, buildings, and the click
   targets for placing them. Drawn above the tiles.
   ========================================================================= */

import type { Geometry } from "../game/geometry";
import type { Buildings, Routes } from "../game/rules";

export function RouteLayer({
  geo, routes, legal, onPick,
}: { geo: Geometry; routes: Routes; legal: Set<string>; onPick: (id: string) => void }) {
  return (
    <g>
      {Object.values(geo.edges).map((e) => {
        const owner = routes[e.id];
        const isLegal = legal.has(e.id);
        if (owner === undefined && !isLegal) return null;
        return (
          <g key={e.id}>
            {owner !== undefined ? (
              <line
                x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                stroke="#2a211a" strokeWidth={9} strokeLinecap="round" opacity={0.35}
              />
            ) : null}
            <line
              x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke={owner !== undefined ? COLOURS[owner] : "#ffffff"}
              strokeWidth={owner !== undefined ? 7 : 5}
              strokeLinecap="round"
              opacity={owner !== undefined ? 1 : 0.55}
              strokeDasharray={owner === undefined ? "3 6" : undefined}
              className={isLegal ? "hit" : undefined}
              onClick={isLegal ? () => onPick(e.id) : undefined}
              style={isLegal ? { cursor: "pointer" } : undefined}
            />
          </g>
        );
      })}
    </g>
  );
}

const COLOURS = ["#b4623f", "#1c7d84", "#7a6a2f", "#5c4e7a"];

/** Barasti — palm-frond hut: a simple pitched roof. */
function Barasti({ colour }: { colour: string }) {
  return (
    <g>
      <path d="M -9 4 L 0 -8 L 9 4 Z" fill={colour} stroke="#2a211a" strokeWidth={1.4} strokeLinejoin="round" />
      <rect x={-7} y={4} width={14} height={7} fill={colour} stroke="#2a211a" strokeWidth={1.4} />
    </g>
  );
}

/** Qasr — coral-stone keep with wind towers, per the reference. */
function Qasr({ colour }: { colour: string }) {
  return (
    <g>
      <rect x={-12} y={-3} width={24} height={14} fill={colour} stroke="#2a211a" strokeWidth={1.4} />
      <rect x={-12} y={-11} width={7} height={9} fill={colour} stroke="#2a211a" strokeWidth={1.3} />
      <rect x={5} y={-11} width={7} height={9} fill={colour} stroke="#2a211a" strokeWidth={1.3} />
      <rect x={-3} y={-14} width={6} height={12} fill={colour} stroke="#2a211a" strokeWidth={1.3} />
    </g>
  );
}

export function BuildingLayer({
  geo, buildings, legal, onPick,
}: { geo: Geometry; buildings: Buildings; legal: Set<string>; onPick: (id: string) => void }) {
  return (
    <g>
      {Object.values(geo.vertices).map((v) => {
        const b = buildings[v.id];
        const isLegal = legal.has(v.id);
        if (!b && !isLegal) return null;
        return (
          <g
            key={v.id}
            transform={`translate(${v.x} ${v.y})`}
            onClick={isLegal ? () => onPick(v.id) : undefined}
            style={isLegal ? { cursor: "pointer" } : undefined}
          >
            {isLegal && (
              <circle r={11} fill="#ffffff" opacity={0.6} stroke="#2a211a" strokeWidth={1.4} strokeDasharray="3 3">
                <animate attributeName="opacity" values="0.35;0.75;0.35" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
            {b && (b.type === "qasr" ? <Qasr colour={COLOURS[b.player]} /> : <Barasti colour={COLOURS[b.player]} />)}
          </g>
        );
      })}
    </g>
  );
}
