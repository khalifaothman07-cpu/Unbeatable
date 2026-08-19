import { useEffect, useMemo, useState } from "react";
import { BoardSquare } from "./render/BoardSquare";
import { BoardStrip } from "./render/BoardStrip";
import { Dice } from "./render/Dice";
import { BoardOverlay, MiniBoard } from "./render/FullBoard";
import { Deed } from "./render/Deed";
import { TradePanel } from "./render/TradePanel";
import { SeatBar } from "./render/SeatBar";
import { InviteCard } from "./render/InviteCard";
import * as fx from "./state/feedback";
import { useTheme } from "./state/useTheme";
import { TokenIcon } from "./render/Tokens";
import { GROUP_COLOUR, LADDER } from "./render/boardGeometry";
import { BAIL, SALARY, STARTING_CASH } from "./game/board";
import { full, short } from "./game/money";
import { GROUP_LABEL } from "./game/types";
import {
  TOWER, canBuild, canMortgage, canSellBuilding, canUnmortgage, completeGroups,
  holdings, isMortgaged, levelOf, liquidatableTotal, spaceAt,
} from "./game/rules";
import { TOKEN_LABEL, activeSeat, playableSeat, useGame } from "./state/store";
import { useBot } from "./state/useBot";

export function App() {
  const s = useGame();
  const me = s.players[s.current];
  const [openDeed, setOpenDeed] = useState<number | null>(null);
  const [fullBoard, setFullBoard] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const [muted, setMuted] = useState(fx.isMuted());
  const { theme, cycle, ground } = useTheme();

  /* bot seats play themselves; the hook is a no-op when there are none */
  useBot();

  /* One listener for every button on the page rather than a call at each
     onClick: the response belongs to the act of pressing, not to any
     particular action, and pointerdown fires before the state change so it
     lands with the finger instead of after the re-render. Listening on the
     document also covers buttons that appear later — the auction steps, the
     trade chips — without each one having to remember to ask. */
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("button");
      if (!el || (el as HTMLButtonElement).disabled) return;
      fx.press(el as HTMLElement, e.clientX, e.clientY);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const myTurn = playableSeat(s, activeSeat(s));
  /* What the board should be looking at: the space under auction if there
     is one, otherwise the active seat's token. */
  const boardFocus = s.phase === "auction" ? s.auction!.index : me.at;
  const joinUrl = typeof window !== "undefined" && s.roomCode
    ? (() => { const u = new URL(window.location.href); u.searchParams.set("room", s.roomCode!); u.hash = ""; return u.toString(); })()
    : "";
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

  const dice = s.dice;
  /* The tumble is keyed on something that changes every action, so a
     repeated 4+4 still animates. Keyed on the value alone, the dice sit
     perfectly still on doubles — which is exactly when a player is watching. */
  const rollNonce = s.log.length;

  return (
    <div className="shell">
      <div className="topbar">
        <a className="kaz6-home" href="../../index.html">&larr; KAZ6</a>
        <div className="head-controls">
          <button
            className="btn tiny ghost"
            title={theme === "auto" ? `Following your device (${ground})` : `Always ${theme}`}
            onClick={cycle}
          >
            {theme === "auto" ? "Auto" : theme === "dark" ? "Night" : "Day"}
          </button>
          <button
            className="btn tiny ghost"
            aria-pressed={!muted}
            onClick={() => {
              const m = !muted;
              fx.setMuted(m);
              setMuted(m);
              /* Turning sound on answers a question the player can't otherwise
                 ask: iOS routes web audio through the ringer, so "I hear
                 nothing" might mean the switch on the side of the phone. A
                 confirmation chirp makes the toggle its own test. */
              if (!m) fx.gain();
            }}
          >
            {muted ? "Sound off" : "Sound on"}
          </button>
        </div>
      </div>

      {/* Four seats across the top like a scoreboard. Cash is the biggest
          thing in each, because cash is what everyone is actually watching. */}
      <div className="players">
        {s.players.map((p) => {
          const groups = completeGroups(s.estate, p.id);
          return (
            <div
              key={p.id}
              className={`pbanner ${p.id === s.current ? "on" : ""} ${p.bankrupt ? "out" : ""}`}
              style={{ "--seat-colour": p.colour } as React.CSSProperties}
            >
              <span className="pbanner-top">
                <TokenIcon token={p.token} fill={p.colour} size={20} />
                <span className="pbanner-name">{TOKEN_LABEL[p.token]}</span>
              </span>
              <span className="pbanner-cash">{p.bankrupt ? "out" : short(p.cash)}</span>
              <span className="pbanner-groups">
                {groups.map((gr) => (
                  <i key={gr} title={GROUP_LABEL[gr]} style={{ background: GROUP_COLOUR[gr] }} />
                ))}
              </span>
              {p.stuck > 0 && <span className="pbanner-jail">queue {p.stuck}</span>}
            </div>
          );
        })}
      </div>

      <p className={`call ${myTurn ? "mine" : ""}`}>{banner}</p>

      {/* Teak rail, teal felt, board on top. Three nested materials is what
          makes it read as an object on a surface rather than a div. */}
      <div className="table">
        <div className="felt">
          {/* Two renderers, one at a time, chosen in CSS rather than in JS: a
              width-watching hook would remount the board on every resize and
              lose the strip's scroll position. Both read the same geometry. */}
          <BoardSquare estate={s.estate} players={s.players} focus={boardFocus} onPick={setOpenDeed} />
          <div className="strip-wrap">
            <BoardStrip estate={s.estate} players={s.players} focus={boardFocus} onPick={setOpenDeed} />
            {/* The strip shows four spaces. This is how you see the other
                thirty-six — and everyone standing on them. */}
            <MiniBoard
              estate={s.estate} players={s.players} focus={boardFocus}
              onOpen={() => setFullBoard(true)}
            />
          </div>
        </div>
      </div>

      {fullBoard && (
        <BoardOverlay
          estate={s.estate}
          players={s.players}
          focus={boardFocus}
          onPick={(i) => { setFullBoard(false); setOpenDeed(i); }}
          onClose={() => setFullBoard(false)}
        />
      )}

      {openDeed !== null && (
        <Deed index={openDeed} estate={s.estate} players={s.players} onClose={() => setOpenDeed(null)} />
      )}

      {/* ---- your street ---- */}
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

      <TradePanel />

      {/* A running table shows only what it needs: who is connected and how
          to get back in. Seat setup is finished business. */}
      {s.roomCode && (
        <div className="panel">
          <div className="panel-head">
            <span>Table</span>
            <span className="row" style={{ gap: 8 }}>
              <span className="code">{s.roomCode}</span>
              {s.syncing && (
                <span className={`link link--${s.link}`}>
                  <i className="link-dot" />
                  {s.link === "live" ? "live" : s.link === "connecting" ? "connecting\u2026"
                    : s.link === "error" ? "connection lost" : "not connected"}
                </span>
              )}
            </span>
          </div>
          {s.mySeat === -1 && <InviteCard url={joinUrl} code={s.roomCode} />}
        </div>
      )}

      <div className="panel panel--log">
        <div className="panel-head">
          <span>Last move</span>
          <button className="btn tiny ghost" aria-expanded={showLog} onClick={() => setShowLog((v) => !v)}>
            {showLog ? "Hide" : "History"}
          </button>
        </div>
        <ul className="log">
          {s.log.slice(0, showLog ? 14 : 1).map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>

      {/* =====================================================================
          THE DOCK — where the turn actually happens.
          Sticky to the bottom of the viewport, so the thing you press is
          never the thing that scrolled off the screen.
          ===================================================================== */}
      <div className="dock">
        {s.drawn ? (
          <>
            <div className="panel-head"><span>{s.drawn.deck === "shamal" ? "Shamal" : "Sandooq"}</span></div>
            <p className="card-text">{s.drawn.text}</p>
            <div className="dock-row">
              <button className="btn" onClick={s.acknowledge}>Take it</button>
            </div>
          </>
        ) : s.phase === "roll" ? (
          <div className="dock-row">
            <Dice roll={dice} nonce={rollNonce} />
            <button className="btn" disabled={!myTurn} onClick={s.roll}>
              {me.stuck > 0 ? "Roll for doubles" : "Roll"}
            </button>
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
        ) : s.phase === "buy" && s.offer !== null ? (
          <>
            <div className="panel-head">
              <span>{spaceAt(s.offer).name}</span>
              <span className="dice">unowned</span>
            </div>
            <div className="dock-row">
              <button
                className="btn"
                disabled={!myTurn || me.cash < spaceAt(s.offer).deed!.price}
                onClick={s.buy}
              >
                Buy &middot; {short(spaceAt(s.offer).deed!.price)}
              </button>
              <button className="btn small ghost" disabled={!myTurn} onClick={s.declineBuy}>
                Auction it
              </button>
            </div>
            <p className="muted hint">
              Passing doesn&rsquo;t skip it &mdash; everyone gets to bid, including you.
            </p>
          </>
        ) : s.phase === "auction" && s.auction ? (
          <AuctionPanel />
        ) : s.phase === "debt" && s.debt ? (
          <>
            <div className="panel-head">
              <span>{s.players[s.debt.seat].name} owes {full(s.debt.amount)}</span>
              <span className="dice">{s.debt.reason}</span>
            </div>
            <p className="muted">
              Holding {full(s.players[s.debt.seat].cash)}. Selling and mortgaging everything raises{" "}
              {full(liquidatableTotal(s.estate, s.players[s.debt.seat].cash, s.debt.seat))}.
            </p>
            <div className="dock-row">
              <button
                className="btn"
                disabled={s.players[s.debt.seat].cash < s.debt.amount}
                onClick={s.settleDebt}
              >
                Pay {short(s.debt.amount)}
              </button>
              <button className="btn small ghost" onClick={s.declareBankrupt}>Fold</button>
            </div>
          </>
        ) : s.phase === "manage" ? (
          <div className="dock-row">
            <Dice roll={dice} nonce={rollNonce} />
            <button className="btn" disabled={!myTurn} onClick={s.endTurn}>
              {s.doubles > 0 && me.stuck === 0 ? "Roll again" : "End turn"}
            </button>
          </div>
        ) : s.phase === "over" ? (
          <div className="dock-row">
            <button className="btn" onClick={() => s.newGame()}>New table</button>
          </div>
        ) : null}
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

/* =========================================================================
   Lobby — the page before the game
   -------------------------------------------------------------------------
   Sitting down at a board game normally comes with somebody explaining it,
   and a web page has to do that itself. LU'LU'A's playtest settled how much:
   not much. Four lines that are always visible, and everything else folded
   shut. Five open sections of prose is a rulebook, and nobody reads a
   rulebook to start a game on a phone.

   The seat controls live here and nowhere else. Once the game begins they
   are gone for good, so a stray tap two hours in can't reset the table.
   ========================================================================= */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div className={`fold ${show ? "on" : ""}`}>
      <button className="fold-head" aria-expanded={show} onClick={() => setShow((v) => !v)}>
        <span>{title}</span>
        <span className="fold-mark">{show ? "\u2212" : "+"}</span>
      </button>
      {show && <div className="fold-body">{children}</div>}
    </div>
  );
}

function Lobby() {
  const s = useGame();
  const { theme, cycle, ground } = useTheme();
  const joined = s.mySeat !== null && s.mySeat >= 0;

  return (
    <div className="shell">
      <a className="kaz6-home" href="../../index.html">&larr; KAZ6</a>
      <header className="head">
        <p className="eyebrow">The Whole Street</p>
        <h1 className="wordmark">FAREEJ</h1>
        <div className="head-controls">
          <button
            className="btn tiny ghost"
            title={theme === "auto" ? `Following your device (${ground})` : `Always ${theme}`}
            onClick={cycle}
          >
            {theme === "auto" ? "Auto" : theme === "dark" ? "Dark" : "Light"}
          </button>
        </div>
      </header>

      <div className="panel panel--lead">
        <p className="lede">
          Buy the island one landmark at a time, charge rent on it, and build until
          nobody else can afford to land there. <b>Last one still solvent wins.</b>
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
          Eight groups, cheapest to dearest, and the order is a journey: four thousand years
          of Dilmun, then the pearling houses of Muharraq, the forts, the souqs, and out to
          the towers you can see from the Causeway. Everyone starts with {full(STARTING_CASH)}{" "}
          and collects {full(SALARY)} each time they pass Bab Al Bahrain.
        </p>
      </div>

      <Section title="How a turn works">
        <ol className="steps steps--tight">
          <li><b>Roll.</b> Land on something unowned and you can buy it — or send it to
            auction, where everyone bids and you can still win it cheaper.</li>
          <li><b>Pay up.</b> Land on somebody else&rsquo;s and you owe them rent. Hold a whole
            group and the rent on it doubles before you have built anything at all.</li>
          <li><b>Build, trade, end the turn.</b> Four villas on a plot, then a tower. You can
            only build on a group you hold outright, and only evenly across it.</li>
        </ol>
        <p className="muted">
          Roll doubles and you go again — three in a row and you are pulled over at the
          border. Owe more than you hold and you must sell buildings or mortgage deeds to
          cover it; if you cannot, you are out and everything you own goes to whoever you
          owed.
        </p>
      </Section>

      <Section title="Playing with people who aren&rsquo;t here">
        <p className="muted">
          <b>This device is the table.</b> Open a seat below, send the link, and whoever
          opens it picks that seat. Keep this page open — the host&rsquo;s browser is what
          holds the game, so closing it closes the table. Any seat nobody takes can be a
          <b> bot</b>, so you never need a full four.
        </p>
      </Section>

      <SeatBar />

      <div className="panel">
        <div className="panel-head"><span>How long</span></div>
        <label className="opt">
          <input
            type="checkbox" checked={s.toggles.openingDeal}
            onChange={(e) => s.setToggles({ openingDeal: e.target.checked })}
          />
          <span>
            <b>Opening deal</b>
            <span className="muted">
              Two landmarks dealt to every seat before the first roll, so the slow opening
              lap where nothing happens disappears.
            </span>
          </span>
        </label>
        <label className="opt">
          <input
            type="checkbox" checked={s.toggles.lapLimit > 0}
            onChange={(e) => s.setToggles({ lapLimit: e.target.checked ? 8 : 0 })}
          />
          <span>
            <b>Stop after eight laps</b>
            <span className="muted">
              Richest wins once everybody has been round eight times. Without it the game
              runs until one seat is left, which is the real ending and the longer one.
            </span>
          </span>
        </label>
      </div>

      {joined ? (
        <div className="panel">
          <p className="muted">
            You&rsquo;re in as {TOKEN_LABEL[s.players[s.mySeat!].token]}. The game begins when
            the host starts it — the board will appear here.
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

      <p className="seed">
        Independently made and not affiliated with any board game publisher. The landmarks
        are real places, used affectionately.
      </p>
    </div>
  );
}
