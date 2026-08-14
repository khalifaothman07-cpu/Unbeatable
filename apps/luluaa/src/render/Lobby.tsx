/* =========================================================================
   Lobby.tsx — the page before the game
   -------------------------------------------------------------------------
   Sitting down at a board game normally comes with someone explaining it.
   A web page has to do that itself, and the moment to do it is BEFORE the
   first decision matters — not in a rules link nobody opens once they're
   already lost.

   Three jobs, in the order a new player needs them:
     1. what this game is and how you win
     2. who is playing, and how the table works when they aren't in the room
     3. start

   The seat controls live here and nowhere else. Once the game begins they
   are gone for good, so a stray tap two hours in can't reset the table.
   ========================================================================= */

import { useState } from "react";
import { COST } from "../game/rules";
import type { Resource } from "../game/types";
import { useGame } from "../state/store";
import { SeatBar } from "./SeatBar";

const SHORT: Record<Resource, string> = {
  palmWood: "Wood", limestone: "Stone", dates: "Dates", fish: "Fish", pearls: "Pearls",
};

function Cost({ of }: { of: Partial<Record<Resource, number>> }) {
  return (
    <span className="cost">
      {(Object.keys(of) as Resource[]).map((r) => (
        <span key={r} className="cost-part">
          <i className={`sw sw-${r}`} />{of[r]}&nbsp;{SHORT[r]}
        </span>
      ))}
    </span>
  );
}

function Section({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [show, setShow] = useState(open);
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
          A trading and settlement game on a Bahraini island. You collect five goods — palm wood,
          limestone, dates, fish and pearls — and spend them building huts and trade routes along the
          coast. <b>First to 10 points wins.</b>
        </p>
      </div>

      <Section title="How a turn works" open>
        <ol className="steps">
          <li><b>Roll two dice.</b> Every tile showing that number pays out, to everyone with a
            building on its corners. A hut earns 1, a qasr earns 2.</li>
          <li><b>Build, or trade.</b> Spend goods on the things below, swap with the bank, or offer
            a deal to the rest of the table.</li>
          <li><b>End your turn.</b></li>
        </ol>
        <p className="muted">
          Roll a <b>7</b> and nobody collects: the Shamal — a sandstorm — moves to a tile of your
          choosing and blocks it until someone shifts it again. You take a card from a player
          building there, and anyone holding 8 or more cards drops half.
        </p>
      </Section>

      <Section title="What you can build">
        <table className="ref">
          <tbody>
            <tr>
              <th>Trade route</th>
              <td><Cost of={COST.route} /></td>
              <td className="muted">Extends your reach. Longest run of 5+ is worth 2 points.</td>
            </tr>
            <tr>
              <th>Barasti</th>
              <td><Cost of={COST.barasti} /></td>
              <td className="muted">A palm hut. <b>1 point</b>, and collects from its three tiles.</td>
            </tr>
            <tr>
              <th>Qasr</th>
              <td><Cost of={COST.qasr} /></td>
              <td className="muted">Upgrades a barasti. <b>2 points</b>, and collects double.</td>
            </tr>
            <tr>
              <th>Dhow card</th>
              <td><Cost of={COST.dhow} /></td>
              <td className="muted">A hidden pearl is a point. Others move the Shamal, take goods,
                or lay free routes.</td>
            </tr>
          </tbody>
        </table>
        <p className="muted">
          A new barasti must sit two corners away from any other building, and connect to your own
          routes.
        </p>
      </Section>

      <Section title="Trading">
        <p className="muted">
          The bank swaps <b>4 of one good for 1 of any other</b>. Build on a <b>trade post</b> on the
          coast and it gets cheaper: <b>3:1</b> at a general post, <b>2:1</b> at one that deals in
          that specific good. Posts are marked around the edge of the board.
        </p>
        <p className="muted">
          You can also offer a deal to the other players on your turn — anything for anything, and
          they choose whether to take it.
        </p>
      </Section>

      <Section title="Playing with people who aren't here">
        <p className="muted">
          <b>This device is the table.</b> Whoever sets the game up holds it — there's no server, so
          the host's browser is what keeps the game alive. Leave this page open and everyone else
          stays in the game; close it and the table closes with it.
        </p>
        <ol className="steps">
          <li>Set a seat to <b>Open online</b> below. That creates the table and gives you a link.</li>
          <li><b>Send the link</b> to whoever is taking that seat — or let them scan the QR code
            if they're with you.</li>
          <li>They open it, pick their seat and they're in. Empty seats can be
            <b> bots</b>, so you never need a full four.</li>
        </ol>
        <p className="muted">
          It goes over the internet, not your wifi, so friends anywhere can play. Everyone sees the
          board update as it's played, and only ever sees their own cards.
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
