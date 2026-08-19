import { useMemo, useState } from "react";
import { BoardSquare } from "./render/BoardSquare";
import { BoardStrip } from "./render/BoardStrip";
import { Deed } from "./render/Deed";
import { TokenIcon } from "./render/Tokens";
import { GROUP_COLOUR, LADDER } from "./render/boardGeometry";
import { BAIL, SALARY, STARTING_CASH } from "./game/board";
import { full, short } from "./game/money";
import { GROUP_LABEL } from "./game/types";
import {
  TOWER, canBuild, canMortgage, canSellBuilding, canUnmortgage, completeGroups,
  holdings, isMortgaged, levelOf, liquidatableTotal, netWorth, spaceAt,
} from "./game/rules";
import { TOKEN_LABEL, activeSeat, playableSeat, solvent, useGame } from "./state/store";

export function App() {
  const s = useGame();
  const me = s.players[s.current];
  const [openDeed, setOpenDeed] = useState<number | null>(null);
  const [showLog, setShowLog] = useState(false);

  const myTurn = playableSeat(s, activeSeat(s));
  /* What the board should be looking at: the space under auction if there
     is one, otherwise the active seat's token. */
  const boardFocus = s.phase === "auction" ? s.auction!.index : me.at;
  const mine = useMemo(() => holdings(s.estate, s.current), [s.estate, s.current]);

  /* One line saying what the table is waiting for. Every phase answers it. */
  const banner = (() => {
    if (s.phase === "over") return `${s.players[s.winner!].name} takes it`;
    if (s.phase === "debt") {
      const d = s.debt!;
      return `${s.players[d.seat].name} owes ${short(d.amount)} — raise it or fold`;
    }
    if (s.phase === "auction") {
      const a = s.auction!;
      return `Auction: ${spaceAt(a.index).name} — ${s.players[a.live[a.turn]].name} to bid`;
    }
    if (s.drawn) return "Read the card";
    if (s.phase === "buy") return `${spaceAt(s.offer!).name} is unowned`;
    if (s.phase === "roll") return me.stuck > 0 ? `${me.name} — stuck on the Causeway` : `${me.name} — roll`;
    if (s.phase === "manage") return `${me.name} — build, or end the turn`;
    return me.name;
  })();

  if (!s.started) return <Lobby />;

  return (
    <div className="shell">
      <a className="kaz6-home" href="../../index.html">← KAZ6</a>

      <header className="head">
        <p className="eyebrow">The Whole Street</p>
        <h1 className="wordmark">FAREEJ</h1>
      </header>

      <div className="scoreboard">
        {s.players.map((p) => {
          const worth = netWorth(s.estate, p.cash, p.id);
          const groups = completeGroups(s.estate, p.id);
          return (
            <div key={p.id} className={`seat ${p.id === s.current ? "on" : ""} ${p.bankrupt ? "out" : ""}`}>
              <TokenIcon token={p.token} fill={p.colour} size={26} />
              <span className="seat-who">
                <b>{p.name}</b>
                <span className="muted">{p.bankrupt ? "out" : full(p.cash)}</span>
              </span>
              <span className="seat-worth">
                {short(worth)}<i>worth</i>
              </span>
              {groups.length > 0 && (
                <span className="seat-groups">
                  {groups.map((gr) => (
                    <i key={gr} title={GROUP_LABEL[gr]} style={{ background: GROUP_COLOUR[gr] }} />
                  ))}
                </span>
              )}
              {p.stuck > 0 && <span className="tag2">queue {p.stuck}</span>}
            </div>
          );
        })}
      </div>

      <p className={`banner ${myTurn ? "mine" : ""}`}>{banner}</p>

      {/* Two renderers, one at a time, chosen in CSS rather than in JS: a
          width-watching hook would remount the board on every resize and
          lose the strip's scroll position. Both read the same geometry. */}
      <BoardSquare estate={s.estate} players={s.players} focus={boardFocus} onPick={setOpenDeed} />
      <BoardStrip estate={s.estate} players={s.players} focus={boardFocus} onPick={setOpenDeed} />

      {openDeed !== null && (
        <Deed index={openDeed} estate={s.estate} players={s.players} onClose={() => setOpenDeed(null)} />
      )}

      {/* ---- a card is face up ---- */}
      {s.drawn && (
        <div className="panel panel--urgent card-drawn">
          <div className="panel-head"><span>{s.drawn.deck === "shamal" ? "Shamal" : "Sandooq"}</span></div>
          <p className="card-text">{s.drawn.text}</p>
          <button className="btn" onClick={s.acknowledge}>Take it</button>
        </div>
      )}

      {/* ---- roll ---- */}
      {s.phase === "roll" && !s.drawn && (
        <div className="panel panel--turn">
          <button className="btn" disabled={!myTurn} onClick={s.roll}>
            {me.stuck > 0 ? "Roll for doubles" : "Roll"}
          </button>
          {s.dice && <span className="dice">{s.dice[0]} + {s.dice[1]} = {s.dice[0] + s.dice[1]}</span>}
          {me.stuck > 0 && myTurn && (
            <>
              <button className="btn small ghost" disabled={me.cash < BAIL} onClick={s.payBail}>
                Pay {short(BAIL)}
              </button>
              {me.passes.length > 0 && (
                <button className="btn small ghost" onClick={s.usePass}>Use a pass</button>
              )}
            </>
          )}
        </div>
      )}

      {/* ---- buy or auction it ---- */}
      {s.phase === "buy" && s.offer !== null && (
        <div className="panel panel--turn">
          <div className="panel-head"><span>{spaceAt(s.offer).name}</span></div>
          <div className="row">
            <button
              className="btn"
              disabled={!myTurn || me.cash < spaceAt(s.offer).deed!.price}
              onClick={s.buy}
            >
              Buy · {short(spaceAt(s.offer).deed!.price)}
            </button>
            <button className="btn small ghost" disabled={!myTurn} onClick={s.declineBuy}>
              Send to auction
            </button>
          </div>
          <p className="muted hint">
            Passing doesn&rsquo;t skip it — everyone gets to bid, including you.
          </p>
        </div>
      )}

      {/* ---- auction ---- */}
      {s.phase === "auction" && s.auction && (
        <AuctionPanel />
      )}

      {/* ---- debt ---- */}
      {s.phase === "debt" && s.debt && (
        <div className="panel panel--urgent">
          <div className="panel-head">
            <span>{s.players[s.debt.seat].name} owes {full(s.debt.amount)}</span>
            <span className="dice">{s.debt.reason}</span>
          </div>
          <p className="muted">
            Holding {full(s.players[s.debt.seat].cash)}. Selling and mortgaging everything raises{" "}
            {full(liquidatableTotal(s.estate, s.players[s.debt.seat].cash, s.debt.seat))}.
          </p>
          <div className="row">
            <button
              className="btn"
              disabled={s.players[s.debt.seat].cash < s.debt.amount}
              onClick={s.settleDebt}
            >
              Pay {short(s.debt.amount)}
            </button>
            <button className="btn small ghost" onClick={s.declareBankrupt}>Fold</button>
          </div>
        </div>
      )}

      {/* ---- manage ---- */}
      {(s.phase === "manage" || s.phase === "debt") && mine.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span>{s.players[s.current].name}&rsquo;s street</span>
            <span className="dice">{mine.length} held</span>
          </div>
          <div className="holdings">
            {mine.map((index) => {
              const space = spaceAt(index);
              const level = levelOf(s.estate, index);
              const mortgaged = isMortgaged(s.estate, index);
              const build = canBuild(s.estate, s.current, index, me.cash);
              const sell = canSellBuilding(s.estate, s.current, index);
              const mort = canMortgage(s.estate, s.current, index);
              const clear = canUnmortgage(s.estate, s.current, index, me.cash);
              return (
                <div key={index} className={`hold ${mortgaged ? "mortgaged" : ""}`}>
                  <i className="hold-band" style={{ background: space.group ? GROUP_COLOUR[space.group] : "#7d8a91" }} />
                  <span className="hold-name">
                    <b>{space.shortName ?? space.name}</b>
                    <span className="muted">
                      {mortgaged ? "mortgaged"
                        : level === TOWER ? "tower"
                        : level > 0 ? `${level} villa${level === 1 ? "" : "s"}`
                        : "bare"}
                    </span>
                  </span>
                  <span className="hold-acts">
                    {space.kind === "property" && (
                      <>
                        <button className="btn tiny" disabled={!build.ok} title={build.reason} onClick={() => s.build(index)}>
                          Build
                        </button>
                        <button className="btn tiny ghost" disabled={!sell.ok} title={sell.reason} onClick={() => s.sellBuilding(index)}>
                          Sell
                        </button>
                      </>
                    )}
                    {mortgaged
                      ? <button className="btn tiny ghost" disabled={!clear.ok} title={clear.reason} onClick={() => s.unmortgage(index)}>Clear</button>
                      : <button className="btn tiny ghost" disabled={!mort.ok} title={mort.reason} onClick={() => s.mortgage(index)}>Mortgage</button>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {s.phase === "manage" && (
        <div className="panel panel--turn">
          <button className="btn" disabled={!myTurn} onClick={s.endTurn}>
            {s.doubles > 0 && me.stuck === 0 ? "Roll again" : "End turn"}
          </button>
        </div>
      )}

      {s.phase === "over" && (
        <div className="panel panel--turn">
          <button className="btn" onClick={() => s.newGame()}>New table</button>
        </div>
      )}

      <div className="panel panel--log">
        <div className="panel-head">
          <span>Last move</span>
          <button className="btn tiny ghost" aria-expanded={showLog} onClick={() => setShowLog((v) => !v)}>
            {showLog ? "Hide history" : "History"}
          </button>
        </div>
        <ul className="log">
          {s.log.slice(0, showLog ? 14 : 1).map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function AuctionPanel() {
  const s = useGame();
  const a = s.auction!;
  const seat = a.live[a.turn];
  const bidder = s.players[seat];
  /* Bid steps rather than a free-text box: typing a six-figure number on a
     phone, against a clock, with three people watching, is not a thing
     anybody wants to do. */
  const steps = [10_000, 25_000, 50_000, 100_000];

  return (
    <div className="panel panel--urgent">
      <div className="panel-head">
        <span>Auction · {spaceAt(a.index).name}</span>
        <span className="dice">
          {a.leader === null ? "no bids yet" : `${s.players[a.leader].name} leads ${short(a.bid)}`}
        </span>
      </div>
      <p className="muted">
        {bidder.name} to bid. Holding {full(bidder.cash)}.
      </p>
      <div className="row">
        {steps.map((step) => {
          const next = a.bid + step;
          return (
            <button
              key={step}
              className="btn small"
              disabled={next > bidder.cash}
              onClick={() => s.bid(next)}
            >
              {short(next)}
            </button>
          );
        })}
        <button className="btn small ghost" onClick={s.foldBid}>Out</button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   A minimal lobby for now — the real one, with the invite card and the
   short-mode explanations, lands with the online seats.
   ------------------------------------------------------------------------- */
function Lobby() {
  const s = useGame();

  return (
    <div className="shell">
      <a className="kaz6-home" href="../../index.html">← KAZ6</a>
      <header className="head">
        <p className="eyebrow">The Whole Street</p>
        <h1 className="wordmark">FAREEJ</h1>
      </header>

      <div className="panel panel--lead">
        <p className="lede">
          Buy the island one landmark at a time. Charge rent, build villas, put up towers,
          and take everybody else&rsquo;s money until there is nobody left.
        </p>
        <div className="ladder">
          {LADDER.map((gr) => (
            <span key={gr} className="rung">
              <i style={{ background: GROUP_COLOUR[gr] }} />
              {GROUP_LABEL[gr]}
            </span>
          ))}
        </div>
        <p className="muted">
          Everyone starts with {full(STARTING_CASH)} and collects {full(SALARY)} each time they
          pass Bab Al Bahrain.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head"><span>Seats</span></div>
        <div className="row">
          {s.seats.map((seat, i) => (
            <span key={i} className="seatctl">
              <TokenIcon token={s.players[i].token} fill={s.players[i].colour} size={20} />
              <b>{TOKEN_LABEL[s.players[i].token]}</b>
              <span className={`tag2 ${seat.type}`}>{seat.type === "bot" ? "bot" : "this device"}</span>
              <button
                className="btn tiny ghost"
                onClick={() => s.setSeatType(i, seat.type === "bot" ? "local" : "bot")}
              >
                {seat.type === "bot" ? "Take over" : "Add bot"}
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><span>Length</span></div>
        <label className="opt">
          <input
            type="checkbox"
            checked={s.toggles.openingDeal}
            onChange={(e) => s.setToggles({ openingDeal: e.target.checked })}
          />
          <span>
            <b>Opening deal</b>
            <span className="muted">Two landmarks to every seat before the first roll, so the slow opening lap disappears.</span>
          </span>
        </label>
        <label className="opt">
          <input
            type="checkbox"
            checked={s.toggles.lapLimit > 0}
            onChange={(e) => s.setToggles({ lapLimit: e.target.checked ? 8 : 0 })}
          />
          <span>
            <b>Stop after eight laps</b>
            <span className="muted">Richest wins when everyone has been round eight times. Without it, play runs until one seat is left.</span>
          </span>
        </label>
      </div>

      <div className="panel panel--start">
        <button className="btn" onClick={s.startGame}>Start the game</button>
        <span className="muted">
          {solvent(s).length} seats, all on this device unless you sit a bot down.
        </span>
      </div>
    </div>
  );
}
