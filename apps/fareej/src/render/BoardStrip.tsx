/* =========================================================================
   BoardStrip.tsx — the phone board
   -------------------------------------------------------------------------
   Forty spaces in a square is 35px a side on a phone, which is smaller than
   a fingertip and smaller than a legible word. The strip unrolls the same
   lap into a horizontal scroller, so a space gets 86px and can say its own
   name.

   It is a MAP, NOT A CONTROL SURFACE. Tapping a space opens its deed and
   commits nothing — the direct lesson from LU'LU'A's playtest, where the
   complaint was that everything was too small and too easy to hit by
   accident. Buying, building and rolling all happen in panels below.

   The whole lap is present and scrollable, so a player can look ahead at
   what they are about to land on. It just starts where their token is.
   ========================================================================= */

import { useEffect, useRef } from "react";
import { short } from "../game/money";
import { isOwnable } from "../game/types";
import type { Estate } from "../game/rules";
import { isMortgaged, levelOf, ownerOf } from "../game/rules";
import { TOKEN_LABEL, type Player } from "../state/store";
import { GROUP_COLOUR, SPACES, TOWER_LEVEL, isCornerSpace, label } from "./boardGeometry";
import { TokenIcon } from "./Tokens";
import { Buildings } from "./Buildings";

export function BoardStrip({
  estate, players, focus, onPick,
}: {
  estate: Estate;
  players: Player[];
  /** the space to keep in view — normally the active seat's token */
  focus: number;
  onPick: (index: number) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const here = useRef<HTMLButtonElement>(null);

  /* Follow the token rather than snapping the whole rail: a player who has
     scrolled ahead to look at something should not be yanked back on every
     re-render, only when the focus actually moves. */
  useEffect(() => {
    const el = here.current;
    const box = rail.current;
    if (!el || !box) return;
    const left = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
    box.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [focus]);

  return (
    <div className="strip" ref={rail} role="group" aria-label="The lap">
      {SPACES.map((space) => {
        const owner = ownerOf(estate, space.index);
        const level = levelOf(estate, space.index);
        const mortgaged = isMortgaged(estate, space.index);
        const standing = players.filter((p) => !p.bankrupt && p.at === space.index);
        const focused = space.index === focus;
        const colour = space.group ? GROUP_COLOUR[space.group] : null;

        return (
          <button
            key={space.index}
            ref={focused ? here : undefined}
            className={[
              "cellbtn",
              focused ? "on" : "",
              isCornerSpace(space) ? "corner" : "",
              mortgaged ? "mortgaged" : "",
              owner !== null ? "owned" : "",
            ].filter(Boolean).join(" ")}
            /* the owner's colour rides as a custom property so the ring, the
               name and anything else added later all read from one source */
            style={owner !== null ? ({ "--own": players[owner].colour } as React.CSSProperties) : undefined}
            onClick={() => onPick(space.index)}
          >
            {/* The band is the fastest read on the strip, so it always says
                something: a group colour where there is a group, and a
                hatched neutral where there isn't. An empty band just looked
                like the cell had failed to load. */}
            <span
              className={`cell-band ${colour ? "" : "none"}`}
              style={colour ? { background: colour } : undefined}
            />

            <span className="cell-name">{label(space, "tight")}</span>

            {isOwnable(space) && (
              owner === null
                ? <span className="cell-price">{short(space.deed!.price)}</span>
                : <span className="cell-owner">{mortgaged ? "mortgaged" : TOKEN_LABEL[players[owner].token]}</span>
            )}
            {space.kind === "tax" && <span className="cell-price">{short(space.amount!)}</span>}

            {/* what is built here — four villas, or the tower that replaces them */}
            {level > 0 && (
              <span className="cell-built">
                <Buildings level={level} tower={level === TOWER_LEVEL} />
              </span>
            )}

            {/* who is standing on it */}
            <span className="cell-tokens">
              {standing.map((p) => <TokenIcon key={p.id} token={p.token} fill={p.colour} size={22} />)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
