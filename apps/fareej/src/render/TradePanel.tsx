/* =========================================================================
   TradePanel.tsx — one standing offer at a time
   -------------------------------------------------------------------------
   Trading is where a property game is actually played, and it is also the
   thing that is hardest to do on a phone: two sets of deeds, cash in both
   directions, and a running sense of whether the deal is any good.

   Three decisions carry the whole panel:

     ONE OFFER AT A TIME. Four live offers on a table is a negotiation
     nobody can follow, and on a shared device it is unreadable.

     DEEDS ARE TOGGLES, NOT A LIST TO DRAG. Tapping a deed puts it in or
     takes it out. Nothing to drop, nothing to mis-drag.

     CASH MOVES IN STEPS. Typing "150000" on a phone keypad, against a
     clock, with three people watching, is not something anyone wants to do.

   The balance line at the bottom is the honest bit: it says, in dinars,
   what the side being asked comes out with on paper. It is not advice —
   a group you complete is worth far more than its printed price — but it
   stops anyone accidentally handing over a landmark for nothing.
   ========================================================================= */

import { useState } from "react";
import { full, short } from "../game/money";
import {
  canTrade, canTradeDeed, emptyTrade, holdings, spaceAt, tradeBalance, tradeIsEmpty,
  type Trade,
} from "../game/rules";
import { playableSeat, solvent, useGame } from "../state/store";
import { GROUP_COLOUR } from "./boardGeometry";

const STEPS = [10_000, 50_000, 100_000];

export function TradePanel() {
  const s = useGame();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Trade | null>(null);

  const standing = s.trade;
  const canOffer = (s.phase === "manage" || s.phase === "debt") && !standing;

  /* ---- an offer is on the table ---- */
  if (standing) {
    const theirs = playableSeat(s, standing.to);
    const balance = tradeBalance(s.estate, standing, standing.to);
    return (
      <div className="panel panel--urgent">
        <div className="panel-head">
          <span>{s.players[standing.from].name} → {s.players[standing.to].name}</span>
          <span className="dice">{balance >= 0 ? "+" : ""}{short(balance)} on paper</span>
        </div>
        <Summary trade={standing} />
        <div className="row">
          <button className="btn" disabled={!theirs} onClick={s.acceptTrade}>
            {s.players[standing.to].name} accepts
          </button>
          <button className="btn small ghost" onClick={s.declineTrade}>Decline</button>
        </div>
      </div>
    );
  }

  if (!canOffer) return null;

  if (!open) {
    return (
      <div className="panel">
        <div className="panel-head"><span>Trade</span></div>
        <button
          className="btn small"
          onClick={() => {
            const other = solvent(s).find((p) => p.id !== s.current);
            if (!other) return;
            setDraft(emptyTrade(s.current, other.id));
            setOpen(true);
          }}
        >
          Offer somebody a deal
        </button>
      </div>
    );
  }

  const t = draft!;
  const cash = (seat: number) => s.players[seat].cash;
  const verdict = canTrade(s.estate, cash, t);
  const mineDeeds = holdings(s.estate, t.from);
  const theirDeeds = holdings(s.estate, t.to);
  const balance = tradeBalance(s.estate, t, t.to);

  const toggle = (side: "giveDeeds" | "wantDeeds", index: number) =>
    setDraft({
      ...t,
      [side]: t[side].includes(index) ? t[side].filter((i) => i !== index) : [...t[side], index],
    });

  const bump = (side: "giveCash" | "wantCash", by: number) =>
    setDraft({ ...t, [side]: Math.max(0, Math.min(cash(side === "giveCash" ? t.from : t.to), t[side] + by)) });

  return (
    <div className="panel">
      <div className="panel-head">
        <span>Trade</span>
        <button className="btn tiny ghost" onClick={() => { setOpen(false); setDraft(null); }}>Close</button>
      </div>

      {/* who with */}
      <div className="row trade-who">
        {solvent(s).filter((p) => p.id !== t.from).map((p) => (
          <button
            key={p.id}
            className={`btn tiny ${t.to === p.id ? "" : "ghost"}`}
            onClick={() => setDraft({ ...emptyTrade(t.from, p.id), giveDeeds: t.giveDeeds, giveCash: t.giveCash })}
          >
            <i className="dot" style={{ background: p.colour }} />{p.name}
          </button>
        ))}
      </div>

      <TradeSide
        title="You give"
        deeds={mineDeeds}
        picked={t.giveDeeds}
        onToggle={(i) => toggle("giveDeeds", i)}
        cash={t.giveCash}
        purse={cash(t.from)}
        onBump={(by) => bump("giveCash", by)}
      />

      <TradeSide
        title={`${s.players[t.to].name} gives`}
        deeds={theirDeeds}
        picked={t.wantDeeds}
        onToggle={(i) => toggle("wantDeeds", i)}
        cash={t.wantCash}
        purse={cash(t.to)}
        onBump={(by) => bump("wantCash", by)}
      />

      <p className="muted trade-balance">
        {tradeIsEmpty(t)
          ? "Put something on at least one side."
          : <>On paper {s.players[t.to].name} comes out <b>{balance >= 0 ? "up" : "down"} {short(Math.abs(balance))}</b>. A group they complete is worth more than that says.</>}
      </p>

      <div className="row">
        <button
          className="btn"
          disabled={!verdict.ok}
          title={verdict.reason}
          onClick={() => { s.proposeTrade(t); setOpen(false); setDraft(null); }}
        >
          Post the offer
        </button>
        {!verdict.ok && !tradeIsEmpty(t) && <span className="muted">{verdict.reason}</span>}
      </div>
    </div>
  );
}

function TradeSide({
  title, deeds, picked, onToggle, cash, purse, onBump,
}: {
  title: string;
  deeds: number[];
  picked: number[];
  onToggle: (index: number) => void;
  cash: number;
  purse: number;
  onBump: (by: number) => void;
}) {
  const s = useGame();
  return (
    <div className="trade-side">
      <div className="panel-head"><span>{title}</span><span className="dice">{full(purse)} in hand</span></div>

      {deeds.length === 0
        ? <p className="muted">Nothing to offer yet.</p>
        : (
          <div className="deedpick">
            {deeds.map((index) => {
              const space = spaceAt(index);
              const on = picked.includes(index);
              const allowed = canTradeDeed(s.estate, index);
              return (
                <button
                  key={index}
                  className={`chipdeed ${on ? "on" : ""}`}
                  disabled={!allowed.ok}
                  title={allowed.reason ?? space.name}
                  onClick={() => onToggle(index)}
                >
                  <i style={{ background: space.group ? GROUP_COLOUR[space.group] : "#7d8a91" }} />
                  {space.shortName ?? space.name}
                </button>
              );
            })}
          </div>
        )}

      <div className="row trade-cash">
        <span className="dice">Cash {short(cash)}</span>
        {STEPS.map((step) => (
          <button key={step} className="btn tiny ghost" onClick={() => onBump(step)}>+{short(step)}</button>
        ))}
        <button className="btn tiny ghost" disabled={cash === 0} onClick={() => onBump(-cash)}>Clear</button>
      </div>
    </div>
  );
}

/** What an offer contains, in one readable line per side. */
function Summary({ trade }: { trade: Trade }) {
  const s = useGame();
  const side = (deeds: number[], cash: number) => {
    const parts = deeds.map((i) => spaceAt(i).shortName ?? spaceAt(i).name);
    if (cash > 0) parts.push(short(cash));
    return parts.length ? parts.join(" + ") : "nothing";
  };
  return (
    <div className="trade-summary">
      <p><b>{s.players[trade.from].name}</b> gives {side(trade.giveDeeds, trade.giveCash)}</p>
      <p><b>{s.players[trade.to].name}</b> gives {side(trade.wantDeeds, trade.wantCash)}</p>
    </div>
  );
}
