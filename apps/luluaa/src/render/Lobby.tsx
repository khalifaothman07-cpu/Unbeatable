/* =========================================================================
   Lobby.tsx — the page before the game
   -------------------------------------------------------------------------
   The first version of this page tried to teach the whole game before
   anyone had seen a board, and playtesters said the same thing about it
   that they'd said about having no lobby at all: too long, too complicated,
   hard to understand. Five open sections of prose is a rulebook, and nobody
   reads a rulebook to start a game on a phone.

   So it now says the least it can:
     1. what you are doing and how you win — four lines, always visible
     2. seats, and Start
     3. everything else behind two folds, shut by default

   The seat controls live here and nowhere else. Once the game begins they
   are gone for good, so a stray tap two hours in can't reset the table.
   ========================================================================= */

import { useState } from "react";
import { COST } from "../game/rules";
import type { Resource } from "../game/types";
import { useGame } from "../state/store";
import { ResIcon, RES_SHORT } from "./Icons";
import { SeatBar } from "./SeatBar";

const GOODS: Resource[] = ["palmWood", "limestone", "dates", "fish", "pearls"];

function Cost({ of }: { of: Partial<Record<Resource, number>> }) {
  return (
    <span className="cost">
      {(Object.keys(of) as Resource[]).map((r) => (
        <span key={r} className="cost-part">
          <ResIcon res={r} size={17} />{of[r]}
        </span>
      ))}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`fold ${show ? "on" : ""}`}>
      <button className="fold-head" aria-expanded={show} onClick={() => setShow((v) => !v)}>
        <span>{title}</span>
        <span className="fold-mark">{show ? "−" : "+"}</span>
      </button>
      {show && <div className="fold-body">{children}</div>}
    </div>
  );
}

export function Lobby() {
  const s = useGame();
  const joined = s.mySeat !== null && s.mySeat >= 0;

  return (
    <>
      <div className="panel panel--lead">
        <p className="lede">
          Collect goods, build along the coast. <b>First to 10 points wins.</b>
        </p>
        <div className="goods-strip">
          {GOODS.map((r) => (
            <span key={r} className="good">
              <ResIcon res={r} size={30} />
              {RES_SHORT[r]}
            </span>
          ))}
        </div>
        <ol className="steps steps--tight">
          <li><b>Roll.</b> Every tile with that number pays whoever built on its corners.</li>
          <li><b>Spend.</b> Build, swap with the bank, or offer the table a deal.</li>
          <li><b>End turn.</b></li>
        </ol>
      </div>

      <Section title="What things cost">
        <table className="ref">
          <tbody>
            <tr>
              <th>Trade route</th>
              <td><Cost of={COST.route} /></td>
              <td className="muted">Longest run of 5+ is worth 2 points.</td>
            </tr>
            <tr>
              <th>Barasti</th>
              <td><Cost of={COST.barasti} /></td>
              <td className="muted"><b>1 point.</b> Collects from its three tiles.</td>
            </tr>
            <tr>
              <th>Qasr</th>
              <td><Cost of={COST.qasr} /></td>
              <td className="muted"><b>2 points.</b> Upgrades a barasti and collects double.</td>
            </tr>
            <tr>
              <th>Dhow card</th>
              <td><Cost of={COST.dhow} /></td>
              <td className="muted">A hidden pearl is a point; the rest do something.</td>
            </tr>
          </tbody>
        </table>
        <p className="muted">
          A new barasti sits two corners clear of any other, and must touch your own routes.
          Roll a <b>7</b> and nobody collects — the Shamal moves to a tile of your choosing
          and blocks it, you take a card from someone building there, and anyone holding 8 or
          more drops half.
        </p>
      </Section>

      <Section title="Playing with friends who aren’t here">
        <p className="muted">
          <b>This device is the table.</b> Open a seat below, send the link, they pick that seat.
          Keep this page open — close it and the table closes with it. Empty seats can be
          <b> bots</b>, so you never need a full four.
        </p>
      </Section>

      <SeatBar />

      {joined ? (
        <div className="panel">
          <p className="muted">
            You&rsquo;re in as Seat {s.mySeat! + 1}. The game begins when the host starts it —
            the board will appear here.
          </p>
        </div>
      ) : (
        <div className="panel panel--start">
          <button className="btn" onClick={s.startGame}>Start the game</button>
          <span className="muted">
            {s.seats.filter((x) => x.type === "bot").length > 0
              ? "Bots will play their own seats."
              : "Everyone plays from this device unless you open a seat online."}
          </span>
        </div>
      )}
    </>
  );
}
