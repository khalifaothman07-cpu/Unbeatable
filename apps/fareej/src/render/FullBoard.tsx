/* =========================================================================
   FullBoard.tsx — the whole lap, on a phone
   -------------------------------------------------------------------------
   The strip shows about four spaces at a time. That is the right control
   surface — spaces are wide enough to read and to hit — but it means a
   player cannot see the STATE of the game: where everyone is, who owns what,
   which groups are closing up.

   So the felt carries a live miniature of the whole board in its corner,
   and tapping it opens the real square full-screen. Two objects, one job
   each: the mini is a glance, the overlay is a study. Neither is a control
   surface — the overlay's spaces open a deed and commit nothing, same
   contract as the strip.

   The mini deliberately draws no text. At 8px a space, a name is noise; what
   carries is the group colour, the owner's ring, and the tokens.
   ========================================================================= */

import { useEffect } from "react";
import { isMortgaged, levelOf, ownerOf, type Estate } from "../game/rules";
import type { Player } from "../state/store";
import { GROUP_COLOUR, SPACES, cellFor } from "./boardGeometry";
import { BoardSquare } from "./BoardSquare";

/** The live thumbnail that sits on the felt. */
export function MiniBoard({
  estate, players, focus, onOpen,
}: {
  estate: Estate; players: Player[]; focus: number; onOpen: () => void;
}) {
  return (
    <button className="mini" onClick={onOpen} aria-label="Open the full board">
      <span className="mini-grid">
        {SPACES.map((space) => {
          const { col, row } = cellFor(space.index);
          const owner = ownerOf(estate, space.index);
          const here = players.filter((p) => !p.bankrupt && p.at === space.index);
          const colour = space.group ? GROUP_COLOUR[space.group] : null;
          return (
            <span
              key={space.index}
              className={`mini-cell ${space.index === focus ? "on" : ""}`}
              style={{
                gridColumn: col + 1,
                gridRow: row + 1,
                ...(colour ? { background: colour } : null),
                ...(owner !== null ? { boxShadow: `inset 0 0 0 1.5px ${players[owner].colour}` } : null),
              }}
            >
              {/* one dot per player standing here — the whole point of the
                  thumbnail is seeing where everybody is at once */}
              {here.map((p) => (
                <i key={p.id} className="mini-dot" style={{ background: p.colour }} />
              ))}
              {levelOf(estate, space.index) > 0 && <i className="mini-built" />}
              {isMortgaged(estate, space.index) && <i className="mini-mort" />}
            </span>
          );
        })}
      </span>
      <span className="mini-label">Full board</span>
    </button>
  );
}

/** The real square, full-screen. */
export function BoardOverlay({
  estate, players, focus, onPick, onClose,
}: {
  estate: Estate; players: Player[]; focus: number;
  onPick: (index: number) => void; onClose: () => void;
}) {
  /* Escape closes it, and the page behind must not scroll while it is open —
     a full-screen sheet you can scroll the page behind is how a phone ends up
     somewhere unexpected when it closes. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="The full board">
      <div className="overlay-bar">
        <span className="overlay-title">The whole lap</span>
        <button className="btn small ghost" onClick={onClose}>Close</button>
      </div>
      <div className="overlay-board" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="table overlay-table">
          <div className="felt">
            <BoardSquare estate={estate} players={players} focus={focus} onPick={onPick} tokenSize={14} />
          </div>
        </div>
      </div>
      <p className="overlay-hint muted">Tap any space for its deed. Pinch to zoom.</p>
    </div>
  );
}
