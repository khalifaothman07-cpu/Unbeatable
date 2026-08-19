/* =========================================================================
   BoardSquare.tsx — the desktop board
   -------------------------------------------------------------------------
   The iconic square: forty spaces round an 11×11 ring, index 0 at the
   bottom-right, running anticlockwise. Going the other way makes anyone who
   knows the genre feel like they are reading it in a mirror.

   Same contract as the strip and for the same reason: it is a MAP, NOT A
   CONTROL SURFACE. Clicking a space opens its deed; nothing here spends
   money. Everything either renderer needs to agree about — which side a
   space is on, its group colour, how its name abbreviates, what marks sit
   on it — comes from boardGeometry.ts, so the two cannot drift.

   Drawn in HTML rather than SVG. A CSS grid gives the ring for free, the
   text reflows and stays selectable, and the group bands are one rule
   rather than forty transforms.
   ========================================================================= */

import { short } from "../game/money";
import { isOwnable } from "../game/types";
import { isMortgaged, levelOf, ownerOf, type Estate } from "../game/rules";
import type { Player } from "../state/store";
import {
  GROUP_COLOUR, RING, SPACES, TOWER_LEVEL, bandSide, cellFor, isCornerSpace, label,
} from "./boardGeometry";
import { TokenIcon } from "./Tokens";

export function BoardSquare({
  estate, players, focus, onPick,
}: {
  estate: Estate;
  players: Player[];
  focus: number;
  onPick: (index: number) => void;
}) {
  return (
    <div className="square" role="group" aria-label="The board">
      {SPACES.map((space) => {
        const { col, row } = cellFor(space.index);
        const owner = ownerOf(estate, space.index);
        const level = levelOf(estate, space.index);
        const mortgaged = isMortgaged(estate, space.index);
        const standing = players.filter((p) => !p.bankrupt && p.at === space.index);
        const colour = space.group ? GROUP_COLOUR[space.group] : null;
        const corner = isCornerSpace(space);

        return (
          <button
            key={space.index}
            className={[
              "sq",
              `sq--${bandSide(space.index)}`,
              corner ? "sq--corner" : "",
              space.index === focus ? "on" : "",
              mortgaged ? "mortgaged" : "",
            ].filter(Boolean).join(" ")}
            style={{
              gridColumn: col + 1,
              gridRow: row + 1,
              ...(owner !== null ? { boxShadow: `inset 0 0 0 2px ${players[owner].colour}` } : null),
            }}
            onClick={() => onPick(space.index)}
            title={space.name}
          >
            <span
              className={`sq-band ${colour ? "" : "none"}`}
              style={colour ? { background: colour } : undefined}
            />
            <span className="sq-body">
              <span className="sq-name">{label(space, corner ? "tight" : "tight")}</span>
              {isOwnable(space) && owner === null && (
                <span className="sq-price">{short(space.deed!.price)}</span>
              )}
              {level > 0 && (
                <span className="sq-built">
                  {level === TOWER_LEVEL
                    ? <i className="tower" />
                    : Array.from({ length: level }, (_x, i) => <i key={i} className="villa" />)}
                </span>
              )}
              <span className="sq-tokens">
                {standing.map((p) => <TokenIcon key={p.id} token={p.token} fill={p.colour} size={15} />)}
              </span>
            </span>
          </button>
        );
      })}

      {/* the middle of a board is where its name goes */}
      <div className="square-middle" style={{ gridColumn: `2 / ${RING}`, gridRow: `2 / ${RING}` }}>
        <p className="eyebrow">The Whole Street</p>
        <h2>FAREEJ</h2>
        <p className="muted">Buy the island one landmark at a time.</p>
      </div>
    </div>
  );
}
