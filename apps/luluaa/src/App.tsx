import { useEffect, useMemo, useState } from "react";
import { BoardView } from "./render/BoardView";
import { BuildingLayer, RouteLayer } from "./render/Pieces";
import { TradePanel } from "./render/TradePanel";
import { Lobby } from "./render/Lobby";
import { InviteCard } from "./render/InviteCard";
import * as fx from "./state/feedback";
import { RESOURCE_LABEL, TERRAIN_LABEL, type Resource } from "./game/types";
import {
  COST, LIMITS, canAfford, canPlaceBarasti, canPlaceRoute, canUpgradeQasr, handCount, seatPorts, tradeRate,
} from "./game/rules";
import {
  DHOW_LABEL, activeSeat, handHidden, legalShamalTiles, ownDevice, playableSeat,
  publicScore, totalScore, useGame, visibleSeat,
} from "./state/store";
import { DhowBack, DhowIcon, ResIcon } from "./render/Icons";
import { useBot } from "./state/useBot";
import { useTheme } from "./state/useTheme";

const RESOURCES: Resource[] = ["palmWood", "limestone", "dates", "fish", "pearls"];
const SHORT: Record<Resource, string> = {
  palmWood: "Wood", limestone: "Stone", dates: "Dates", fish: "Fish", pearls: "Pearls",
};

/** A price, drawn rather than spelled — the build buttons are the place a
    player is deciding whether they can afford something, and matching icons
    to the ones in their hand answers that faster than reading two words. */
function Price({ of }: { of: Partial<Record<Resource, number>> }) {
  return (
    <i className="price">
      {(Object.keys(of) as Resource[]).map((r) => (
        <span key={r} className="price-part">
          <ResIcon res={r} size={15} />{of[r]}
        </span>
      ))}
    </i>
  );
}

/* Players said they couldn't tell what the cards did. Saying so on the card
   itself beats a rules page they'd have to leave the game to read. */
const DHOW_HELP: Record<string, string> = {
  windbreaker: "Move the Shamal and take a card",
  hiddenPearl: "Worth 1 point — kept secret until you win",
  bountifulTide: "Take 2 of any one good from the bank",
  souqCorner: "Take every card of one good from everyone",
  caravanRoute: "Lay 2 trade routes for free",
};

export function App() {
  const s = useGame();
  /* The seat whose TURN it is — used for prompts and the board. */
  const me = s.players[activeSeat(s)];
  /* The seat whose CARDS this device is entitled to see — or none. A device
     may only ever show a hand it plays: on a joined phone that is your own
     seat, on the host it is whichever local seat is up. When the turn belongs
     to somebody else's phone there is no hand to show at all, and saying so
     is the point. */
  const shown = visibleSeat(s);
  const mine = shown === null ? null : s.players[shown];
  const [muted, setMuted] = useState(fx.isMuted());
  const [showLog, setShowLog] = useState(false);
  const { theme, cycle, ground } = useTheme();

  /* bot seats play themselves; the hook is a no-op when there are none */
  useBot();

  /* One listener for every button on the page rather than a call at each
     onClick: the response belongs to the act of pressing, not to any
     particular action, and pointerdown fires before the state change so it
     lands with the finger instead of after the re-render.

     Listening on the document also means it covers buttons that appear
     later — the trade steppers, seat controls, dhow cards — without each
     one having to remember to ask. */
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("button");
      if (!el || (el as HTMLButtonElement).disabled) return;
      fx.press(el as HTMLElement, e.clientX, e.clientY);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  /* ---- legal targets, recomputed from the rules (never guessed) ---- */
  const vertexTargets = useMemo(() => {
    const out = new Set<string>();
    if (s.phase === "setup" && s.setupStage === "barasti") {
      for (const v of Object.keys(s.geo.vertices))
        if (canPlaceBarasti(v, me.id, s.buildings, s.routes, s.geo, true)) out.add(v);
    } else if (s.phase === "main" && s.pending === "barasti") {
      for (const v of Object.keys(s.geo.vertices))
        if (canPlaceBarasti(v, s.current, s.buildings, s.routes, s.geo, false)) out.add(v);
    } else if (s.phase === "main" && s.pending === "qasr") {
      for (const v of Object.keys(s.geo.vertices))
        if (canUpgradeQasr(v, s.current, s.buildings)) out.add(v);
    }
    return out;
  }, [s.phase, s.pending, s.setupStage, s.buildings, s.routes, s.geo, me.id, s.current]);

  const edgeTargets = useMemo(() => {
    const out = new Set<string>();
    if (s.phase === "setup" && s.setupStage === "route" && s.lastSetupVertex) {
      for (const e of s.geo.vertexEdges[s.lastSetupVertex])
        if (s.routes[e] === undefined) out.add(e);
    } else if (s.phase === "main" && (s.pending === "route" || s.pending === "caravan")) {
      for (const e of Object.keys(s.geo.edges))
        if (canPlaceRoute(e, s.current, s.buildings, s.routes, s.geo)) out.add(e);
    }
    return out;
  }, [s.phase, s.pending, s.setupStage, s.lastSetupVertex, s.buildings, s.routes, s.geo, s.current]);

  const tileTargets = useMemo(() => {
    if (s.phase !== "moveShamal") return new Set<string>();
    return new Set(legalShamalTiles(s));
  }, [s]);

  /* if the Shamal has nowhere legal to land, resolve it rather than stall */
  useEffect(() => {
    if (s.phase === "moveShamal" && tileTargets.size === 0) s.settleShamal();
  }, [s.phase, tileTargets.size, s]);

  const stealTargets = useMemo(() => {
    if (s.phase !== "steal") return [] as number[];
    const ids = s.geo.tileVertices[s.shamalTile]
      .map((v) => s.buildings[v])
      .filter((b) => b && b.player !== s.current && handCount(s.players[b.player].hand) > 0)
      .map((b) => b!.player);
    return [...new Set(ids)];
  }, [s.phase, s.shamalTile, s.buildings, s.geo, s.players, s.current]);

  const built = (type: "barasti" | "qasr") =>
    Object.values(s.buildings).filter((b) => b.player === s.current && b.type === type).length;
  const routeCount = Object.values(s.routes).filter((r) => r === s.current).length;

  /* One rule for every device: act only for seats this device owns, and
     never for a bot — it drives itself. */
  const myTurn = playableSeat(s, activeSeat(s));

  /* The privacy screen exists for one phone being passed around. On your own
     device the hand is yours, so there is nobody to hide it from. */
  const own = ownDevice(s);
  const hideHand = handHidden(s);
  /* When this device plays exactly one seat — your own phone, or a host who
     kept one chair and gave the rest away — the hand on screen is simply
     yours. Calling it "Seat 3's hand" then is needlessly third-person about
     the player's own cards. */
  const soleSeat = s.seats.filter((_x, i) => playableSeat(s, i)).length === 1;

  /* Where the Shamal is, in words — it moves on a 7 and the board alone
     never made clear what that had cost anyone. */
  const shamalTile = s.board.tiles.find((t) => t.id === s.shamalTile);
  const shamalWhere = shamalTile
    ? `${TERRAIN_LABEL[shamalTile.terrain]}${shamalTile.token ? ` ${shamalTile.token}` : ""}`
    : "the sabkha";
  const shamalHitsMe = mine !== null && (s.geo.tileVertices[s.shamalTile] ?? [])
    .some((v) => s.buildings[v]?.player === mine.id);

  const myPorts = seatPorts(s.current, s.buildings, s.geo);
  const joinUrl = typeof window !== "undefined" && s.roomCode
    ? (() => { const u = new URL(window.location.href); u.searchParams.set("room", s.roomCode!); u.hash = ""; return u.toString(); })()
    : "";

  const banner = (() => {
    if (s.phase === "over") return `${s.players[s.winner!].name} wins with ${totalScore(s, s.winner!)} points`;
    if (s.phase === "setup") return `${me.name} — place a ${s.setupStage === "barasti" ? "barasti" : "connected trade route"}`;
    if (s.phase === "roll") return `${me.name} — roll the dice`;
    if (s.phase === "discard") return `${s.players[s.discardQueue[0]].name} must discard down to ${s.discardTargets[s.discardQueue[0]]}`;
    if (s.phase === "moveShamal") return "Move the Shamal — pick a tile";
    if (s.phase === "steal") return "Take a card — pick a seat";
    if (s.seats[activeSeat(s)]?.type === "bot") return `${me.name} is thinking…`;
    if (!myTurn) return `Waiting for ${me.name}…`;
    if (s.pending) return `Placing: ${s.pending}. Pick a highlighted spot, or press again to cancel.`;
    return `${me.name} — build, trade, then end turn`;
  })();

  return (
    <div className="shell">
      <a className="kaz6-home" href="../../index.html">← KAZ6</a>

      <header className="head">
        <p className="eyebrow">Isle of Pearls</p>
        <h1 className="wordmark">LU&rsquo;LU&rsquo;A</h1>
        <div className="head-controls">
          <button
            className="btn tiny ghost"
            title={theme === "auto" ? `Following your device (${ground})` : `Always ${theme}`}
            onClick={cycle}
          >
            {theme === "auto" ? "Auto" : theme === "dark" ? "Dark" : "Light"}
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
            Sound {muted ? "off" : "on"}
          </button>
        </div>
      </header>

      {/* Everything about setting the table lives before the game and
          nowhere after it — see Lobby. */}
      {!s.started ? <Lobby /> : (
        <>
          <div className="scoreboard">
            {s.players.map((p) => (
              <div key={p.id} className={`seat ${p.id === activeSeat(s) ? "on" : ""} ${p.id === s.mySeat ? "you" : ""}`}>
                <span className="dot" style={{ background: p.colour }} />
                <b>{p.name}</b>
                {s.seats[p.id]?.type === "bot" && <span className="tag2">bot</span>}
                {p.id === s.mySeat && <span className="tag2 remote">you</span>}
                <span className="pts">{publicScore(s, p.id)}<i>pts</i></span>
                <span className="cards">
                  {handCount(p.hand)} card{handCount(p.hand) === 1 ? "" : "s"} · {p.cards.length} dhow
                </span>
              </div>
            ))}
          </div>

          <p className={`banner ${myTurn ? "mine" : ""}`}>{banner}</p>

          <BoardView
            board={s.board}
            shamalTile={s.shamalTile}
            onTile={s.clickTile}
            tileTargets={myTurn ? tileTargets : new Set()}
            ports={s.geo.ports}
          >
            <RouteLayer geo={s.geo} routes={s.routes} legal={myTurn ? edgeTargets : new Set()} onPick={s.clickEdge} />
            <BuildingLayer geo={s.geo} buildings={s.buildings} legal={myTurn ? vertexTargets : new Set()} onPick={s.clickVertex} />
          </BoardView>

          {/* The Shamal was the thing players said they couldn't follow: it
              moves, and nothing said what it had done. */}
          {s.started && s.phase !== "over" && (
            <p className="shamal-line">
              <span className="shamal-mark" aria-hidden />
              The Shamal blocks <b>{shamalWhere}</b>
              {shamalHitsMe ? <> — including one of <b>your</b> tiles</> : <> — that tile pays nobody until it moves</>}
            </p>
          )}

          {/* ---- hand ---- */}
          {s.phase !== "setup" && (
            <div className="panel">
              <div className="panel-head">
                <span>{mine === null ? "Hands" : soleSeat ? "Your hand" : `${mine.name}’s hand`}</span>
                {mine !== null && hideHand && <button className="btn small" onClick={s.revealHand}>Tap to reveal</button>}
              </div>

              {mine === null ? (
                /* Nothing on this device is entitled to this hand. Saying
                   whose it is and why it's closed beats an empty panel. */
                <p className="muted">
                  {s.seats[activeSeat(s)]?.type === "bot"
                    ? `${me.name} is a bot — its cards stay face down.`
                    : `${me.name} is playing on their own device. You only ever see your own cards.`}
                </p>
              ) : hideHand ? (
                <p className="muted">Hidden — pass the device to {mine.name}.</p>
              ) : (
                <>
                  <div className="hand">
                    {RESOURCES.map((r) => (
                      <span key={r} className={`res ${mine.hand[r] > 0 ? "has" : ""}`}>
                        <ResIcon res={r} size={22} />
                        <span className="res-name">{SHORT[r]}</span>
                        <b>{mine.hand[r]}</b>
                      </span>
                    ))}
                  </div>

                  {/* Dhow cards belong WITH the hand and are shown whether or
                      not it's your turn — players reported not knowing they
                      had any, because they only ever appeared mid-turn. */}
                  {mine.cards.length > 0 && (
                    <div className="dhows">
                      {mine.cards.map((c) => {
                        const playable = myTurn && s.phase === "main" && c.kind !== "hiddenPearl"
                          && c.boughtOnTurn !== s.turnNo && !s.playedCardThisTurn;
                        const picks = c.kind === "bountifulTide" || c.kind === "souqCorner";
                        return (
                          <div key={c.uid} className={`dhow ${playable ? "ready" : ""}`}>
                            <DhowIcon kind={c.kind} size={30} />
                            <span className="dhow-text">
                              <b>{DHOW_LABEL[c.kind]}</b>
                              <span className="muted">{DHOW_HELP[c.kind]}</span>
                            </span>
                            {picks ? (
                              <span className="row dhow-picks">
                                {RESOURCES.map((r) => (
                                  <button
                                    key={r} className="btn tiny" disabled={!playable}
                                    title={SHORT[r]} onClick={() => s.playDhow(c.uid, r)}
                                  >
                                    <ResIcon res={r} size={16} />{SHORT[r]}
                                  </button>
                                ))}
                              </span>
                            ) : c.kind !== "hiddenPearl" ? (
                              <button className="btn tiny" disabled={!playable} onClick={() => s.playDhow(c.uid)}>Play</button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ---- discard ---- */}
          {s.phase === "discard" && (
            <div className="panel panel--urgent">
              <div className="panel-head">
                <span>{s.players[s.discardQueue[0]].name} must discard</span>
                <span className="dice">down to {s.discardTargets[s.discardQueue[0]]}</span>
              </div>
              <div className="row">
                {RESOURCES.filter((r) => s.players[s.discardQueue[0]].hand[r] > 0).map((r) => (
                  <button key={r} className="btn small" onClick={() => s.discard(r)}>
                    <ResIcon res={r} size={18} />{SHORT[r]} ({s.players[s.discardQueue[0]].hand[r]})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ---- steal ---- */}
          {s.phase === "steal" && (
            <div className="panel panel--urgent">
              <div className="panel-head"><span>Take a card from</span></div>
              <div className="row">
                {stealTargets.map((id) => (
                  <button key={id} className="btn small" onClick={() => s.stealFrom(id)}>{s.players[id].name}</button>
                ))}
              </div>
            </div>
          )}

          <TradePanel />

          {/* ---- actions ---- */}
          {s.phase === "roll" && myTurn && (
            <div className="panel panel--turn">
              <button className="btn" onClick={s.roll}>Roll the dice</button>
              {s.dice && <span className="dice">{s.dice[0]} + {s.dice[1]} = {s.dice[0] + s.dice[1]}</span>}
            </div>
          )}

          {s.phase === "main" && myTurn && (
            <>
              <div className="panel">
                <div className="panel-head">
                  <span>Build</span>
                  {s.dice && <span className="dice">rolled {s.dice[0] + s.dice[1]}</span>}
                </div>
                <div className="build-row">
                  <button
                    className={`btn small ${s.pending === "route" ? "on" : ""}`}
                    disabled={!canAfford(me.hand, COST.route) || routeCount >= LIMITS.route}
                    onClick={() => s.setPending("route")}
                  >
                    Trade route<Price of={COST.route} />
                  </button>
                  <button
                    className={`btn small ${s.pending === "barasti" ? "on" : ""}`}
                    disabled={!canAfford(me.hand, COST.barasti) || built("barasti") >= LIMITS.barasti}
                    onClick={() => s.setPending("barasti")}
                  >
                    Barasti · 1pt<Price of={COST.barasti} />
                  </button>
                  <button
                    className={`btn small ${s.pending === "qasr" ? "on" : ""}`}
                    disabled={!canAfford(me.hand, COST.qasr) || built("qasr") >= LIMITS.qasr}
                    onClick={() => s.setPending("qasr")}
                  >
                    Qasr · 2pts<Price of={COST.qasr} />
                  </button>
                  <button
                    className="btn small"
                    disabled={!canAfford(me.hand, COST.dhow) || !s.deck.length}
                    onClick={s.buyDhow}
                  >
                    <span className="btn-line"><DhowBack size={17} />Dhow card</span>
                    <Price of={COST.dhow} />
                    <i className="price">{s.deck.length} left</i>
                  </button>
                </div>
                {s.pending && (
                  <p className="muted hint">
                    Pick a highlighted spot on the board, or press the button again to cancel.
                  </p>
                )}
              </div>

              <div className="panel">
                <div className="panel-head">
                  <span>Bank</span>
                  <span className="dice ports-held">
                    {myPorts.length
                      ? myPorts.map((p, i) => (
                          <span key={i} className="port-chip">
                            {p.resource ? <ResIcon res={p.resource} size={15} /> : null}
                            {p.resource ? "2:1" : "3:1 any"}
                          </span>
                        ))
                      : "4:1 — build on a trade post for better"}
                  </span>
                </div>
                <div className="row">
                  {RESOURCES.filter((g) => me.hand[g] >= tradeRate(s.current, g, s.buildings, s.geo)).map((give) => {
                    const rate = tradeRate(s.current, give, s.buildings, s.geo);
                    return (
                      <span key={give} className="trade">
                        <b><ResIcon res={give} size={17} />{rate} {SHORT[give]} →</b>
                        {RESOURCES.filter((r) => r !== give).map((get) => (
                          <button key={get} className="btn tiny" title={SHORT[get]} onClick={() => s.bankTrade(give, get)}>
                            <ResIcon res={get} size={16} />{SHORT[get]}
                          </button>
                        ))}
                      </span>
                    );
                  })}
                  {!RESOURCES.some((g) => me.hand[g] >= tradeRate(s.current, g, s.buildings, s.geo)) &&
                    <span className="muted">Not enough of any one good to swap yet.</span>}
                </div>
              </div>

              <div className="panel panel--turn">
                <button className="btn" onClick={s.endTurn}>End turn</button>
              </div>
            </>
          )}

          {s.phase === "over" && (
            <div className="panel panel--turn">
              <button className="btn" onClick={() => s.newGame()}>New table</button>
            </div>
          )}

          {/* A running table shows only what it needs: who is connected and
              how to get back in. Seat setup is finished business. */}
          {s.roomCode && (
            <div className="panel">
              <div className="panel-head">
                <span>Table</span>
                <span className="row" style={{ gap: 8 }}>
                  <span className="code">room {s.roomCode}</span>
                  {s.syncing && <span className={`link link--${s.link}`}><i className="link-dot" />{
                    s.link === "live" ? "live" : s.link === "connecting" ? "connecting…" : s.link === "error" ? "connection lost" : "not connected"
                  }</span>}
                </span>
              </div>
              {!own && <InviteCard url={joinUrl} code={s.roomCode} />}
            </div>
          )}

          {/* Seven lines of history was seven lines nobody was reading —
              the only one that matters is what happened since you last
              looked. The rest is there for an argument about who took what,
              and stays folded away until there is one. */}
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

          <p className="seed">seed {s.board.seed} · {RESOURCE_LABEL.pearls} are scarcest by design</p>
        </>
      )}
    </div>
  );
}
