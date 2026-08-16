/* =========================================================================
   TradePanel.tsx — player-to-player trading
   -------------------------------------------------------------------------
   One standing offer at a time, posted by the seat whose turn it is. Anyone
   else may accept it; the store re-checks both hands at accept time, so a
   stale offer fails cleanly rather than conjuring cards.

   Who may press "accept" depends on the table shape. On a host device with
   local seats the person holding the phone taps for whichever seat is
   answering, so every seat gets a button. On a remote device you only ever
   drive your own seat, so only yours appears. That mirrors how the board
   itself decides what is clickable.
   ========================================================================= */

import { useState } from "react";
import type { Resource } from "../game/types";
import { handHidden, playableSeat, useGame } from "../state/store";
import { ResIcon } from "./Icons";

const RESOURCES: Resource[] = ["palmWood", "limestone", "dates", "fish", "pearls"];
const SHORT: Record<Resource, string> = {
  palmWood: "Wood", limestone: "Stone", dates: "Dates", fish: "Fish", pearls: "Pearls",
};

type Basket = Partial<Record<Resource, number>>;
const empty: Basket = {};

function basketText(b: Basket) {
  const parts = (Object.keys(b) as Resource[])
    .filter((r) => (b[r] ?? 0) > 0)
    .map((r) => `${b[r]} ${SHORT[r]}`);
  return parts.length ? parts.join(" + ") : "nothing";
}

/** One resource's −/count/+ control. `max` caps the give side at what's held. */
function Stepper({
  res, value, max, onChange,
}: { res: Resource; value: number; max: number; onChange: (n: number) => void }) {
  return (
    <span className={`stepper ${value > 0 ? "on" : ""}`}>
      <ResIcon res={res} size={20} />
      <span className="stepper-label">{SHORT[res]}</span>
      <button
        className="step"
        aria-label={`One less ${SHORT[res]}`}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <b className="stepper-n">{value}</b>
      <button
        className="step"
        aria-label={`One more ${SHORT[res]}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </span>
  );
}

export function TradePanel() {
  const s = useGame();
  const [give, setGive] = useState<Basket>(empty);
  const [want, setWant] = useState<Basket>(empty);

  if (s.phase !== "main") return null;

  const me = s.players[s.current];
  const offer = s.offer;

  /* a bot answers its own offers — see useBot */
  const drives = (seat: number) => playableSeat(s, seat);
  const myTurn = drives(s.current);

  const total = (b: Basket) => (Object.keys(b) as Resource[]).reduce((n, r) => n + (b[r] ?? 0), 0);
  const clear = () => { setGive(empty); setWant(empty); };

  /* ---------- a live offer replaces the composer ---------- */
  if (offer) {
    const from = s.players[offer.from];
    const wantKeys = (Object.keys(offer.want) as Resource[]).filter((r) => (offer.want[r] ?? 0) > 0);
    const answering = s.players.filter((p) => p.id !== offer.from);

    return (
      <div className="panel panel--offer">
        <div className="panel-head"><span>Offer on the table</span></div>

        <p className="offer-line">
          <span className="dot" style={{ background: from.colour }} />
          <b>{from.name}</b> gives <b>{basketText(offer.give)}</b> for <b>{basketText(offer.want)}</b>
        </p>

        <div className="row">
          {answering.map((p) => {
            const covers = wantKeys.every((r) => p.hand[r] >= (offer.want[r] ?? 0));
            const declined = offer.declined.includes(p.id);
            if (!drives(p.id)) {
              return (
                <span key={p.id} className="muted">
                  {p.name}: {declined ? "declined" : covers ? "can accept" : "can't cover"}
                </span>
              );
            }
            return (
              <span key={p.id} className="answer">
                <b>{p.name}</b>
                {declined ? (
                  <span className="muted">declined</span>
                ) : (
                  <>
                    <button
                      className="btn tiny"
                      disabled={!covers}
                      title={covers ? "" : "Not enough in hand"}
                      onClick={() => s.acceptTrade(p.id)}
                    >
                      Accept
                    </button>
                    <button className="btn tiny ghost" onClick={() => s.declineTrade(p.id)}>Decline</button>
                  </>
                )}
              </span>
            );
          })}

          {myTurn && (
            <button className="btn tiny ghost" onClick={s.cancelTrade}>Withdraw</button>
          )}
        </div>
      </div>
    );
  }

  /* ---------- composer, active seat only ---------- */
  if (!myTurn) return null;
  /* The give side is capped by what's in hand, so showing it while the
     privacy screen is up would print the hand for the whole room.

     It has to be the SAME test the hand panel uses. Asking only whether the
     hand had been revealed meant a player on their own phone — who has no
     privacy screen to lift, and so never taps "reveal" — could never open
     the composer. From the table it looked like the host was the only person
     allowed to trade. */
  if (handHidden(s)) return null;

  const giveN = total(give);
  const wantN = total(want);
  /* asking for what you're also offering is a no-op the store rejects — say
     why here rather than let "Post offer" fail silently */
  const overlap = RESOURCES.filter((r) => (give[r] ?? 0) > 0 && (want[r] ?? 0) > 0);
  const ready = giveN > 0 && wantN > 0 && !overlap.length;

  return (
    <div className="panel">
      <div className="panel-head">
        <span>Trade with the table</span>
        {(giveN > 0 || wantN > 0) && <button className="btn tiny ghost" onClick={clear}>Clear</button>}
      </div>

      <p className="trade-leg">You give</p>
      <div className="trade-row">
        {RESOURCES.map((r) => (
          <Stepper
            key={r}
            res={r}
            value={give[r] ?? 0}
            max={me.hand[r]}
            onChange={(n) => setGive({ ...give, [r]: n })}
          />
        ))}
      </div>

      <p className="trade-leg">You want</p>
      <div className="trade-row">
        {RESOURCES.map((r) => (
          <Stepper
            key={r}
            res={r}
            value={want[r] ?? 0}
            max={9}
            onChange={(n) => setWant({ ...want, [r]: n })}
          />
        ))}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="btn small"
          disabled={!ready}
          onClick={() => { s.proposeTrade(give, want); clear(); }}
        >
          Post offer
        </button>
        <span className="muted">
          {overlap.length
            ? `${overlap.map((r) => SHORT[r]).join(" and ")} is on both sides — pick something different.`
            : ready
              ? `${basketText(give)} → ${basketText(want)}`
              : "Pick at least one on each side."}
        </span>
      </div>
    </div>
  );
}
