import { useEffect, useMemo, useState } from "react";
import { BoardView } from "./render/BoardView";
import { BuildingLayer, RouteLayer } from "./render/Pieces";
import { SeatBar } from "./render/SeatBar";
import { TradePanel } from "./render/TradePanel";
import * as fx from "./state/feedback";
import { RESOURCE_LABEL, type Resource } from "./game/types";
import {
  COST, LIMITS, canAfford, canPlaceBarasti, canPlaceRoute, canUpgradeQasr, handCount,
} from "./game/rules";
import { DHOW_LABEL, activeSeat, drivesSeat, legalShamalTiles, publicScore, totalScore, useGame } from "./state/store";

const RESOURCES: Resource[] = ["palmWood", "limestone", "dates", "fish", "pearls"];
const SHORT: Record<Resource, string> = {
  palmWood: "Wood", limestone: "Stone", dates: "Dates", fish: "Fish", pearls: "Pearls",
};

function costText(c: Partial<Record<Resource, number>>) {
  return (Object.keys(c) as Resource[]).map((r) => `${c[r]} ${SHORT[r]}`).join(" + ");
}

export function App() {
  const s = useGame();
  const me = s.players[activeSeat(s)];
  const [muted, setMuted] = useState(fx.isMuted());

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

  /* One rule for every device: act only for seats this device owns. The
     host keeps the seats still marked local; a joined phone keeps its own. */
  const myTurn = drivesSeat(s, activeSeat(s));

  const hideHand = s.toggles.privacyScreen && !s.handRevealed && s.phase !== "setup" && s.phase !== "over";

  const banner = (() => {
    if (s.phase === "over") return `${s.players[s.winner!].name} wins with ${totalScore(s, s.winner!)} points`;
    if (s.phase === "setup") return `${me.name} — place a ${s.setupStage === "barasti" ? "barasti" : "connected trade route"}`;
    if (s.phase === "roll") return `${me.name} — roll the dice`;
    if (s.phase === "discard") return `${s.players[s.discardQueue[0]].name} must discard down to ${s.discardTargets[s.discardQueue[0]]}`;
    if (s.phase === "moveShamal") return "Move the Shamal — pick a tile";
    if (s.phase === "steal") return "Take a card — pick a seat";
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
        <button
          className="btn tiny ghost sound-toggle"
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
      </header>

      <div className="scoreboard">
        {s.players.map((p) => (
          <div key={p.id} className={`seat ${p.id === s.current && s.phase !== "setup" ? "on" : ""}`}>
            <span className="dot" style={{ background: p.colour }} />
            <b>{p.name}</b>
            <span className="pts">{publicScore(s, p.id)} pts</span>
            <span className="cards">{handCount(p.hand)}c · {p.cards.length}d</span>
          </div>
        ))}
      </div>

      <p className="banner">{banner}</p>

      <BoardView
        board={s.board}
        shamalTile={s.shamalTile}
        onTile={s.clickTile}
        tileTargets={myTurn ? tileTargets : new Set()}
      >
        <RouteLayer geo={s.geo} routes={s.routes} legal={myTurn ? edgeTargets : new Set()} onPick={s.clickEdge} />
        <BuildingLayer geo={s.geo} buildings={s.buildings} legal={myTurn ? vertexTargets : new Set()} onPick={s.clickVertex} />
      </BoardView>

      {/* ---- hand ---- */}
      {s.phase !== "setup" && s.phase !== "over" && (
        <div className="panel">
          <div className="panel-head">
            <span>{me.name}&rsquo;s hand</span>
            {hideHand && <button className="btn small" onClick={s.revealHand}>Tap to reveal</button>}
          </div>
          {hideHand ? (
            <p className="muted">Hidden — pass the device to {me.name}.</p>
          ) : (
            <div className="hand">
              {RESOURCES.map((r) => (
                <span key={r} className="res">
                  <i className={`sw sw-${r}`} />{SHORT[r]} <b>{me.hand[r]}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- discard ---- */}
      {s.phase === "discard" && (
        <div className="panel">
          <div className="panel-head"><span>Discard</span></div>
          <div className="row">
            {RESOURCES.filter((r) => s.players[s.discardQueue[0]].hand[r] > 0).map((r) => (
              <button key={r} className="btn small" onClick={() => s.discard(r)}>
                {SHORT[r]} ({s.players[s.discardQueue[0]].hand[r]})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- steal ---- */}
      {s.phase === "steal" && (
        <div className="panel">
          <div className="panel-head"><span>Take from</span></div>
          <div className="row">
            {stealTargets.map((id) => (
              <button key={id} className="btn small" onClick={() => s.stealFrom(id)}>{s.players[id].name}</button>
            ))}
          </div>
        </div>
      )}

      {/* ---- player-to-player trade: visible to everyone, since anyone at
             the table may be the one answering an offer ---- */}
      <TradePanel />

      {/* ---- actions ---- */}
      {s.phase === "roll" && myTurn && (
        <div className="panel">
          <button className="btn" onClick={s.roll}>Roll 2d6</button>
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
            <div className="row">
              <button
                className={`btn small ${s.pending === "route" ? "on" : ""}`}
                disabled={!canAfford(me.hand, COST.route) || routeCount >= LIMITS.route}
                onClick={() => s.setPending("route")}
              >
                Trade route · {costText(COST.route)}
              </button>
              <button
                className={`btn small ${s.pending === "barasti" ? "on" : ""}`}
                disabled={!canAfford(me.hand, COST.barasti) || built("barasti") >= LIMITS.barasti}
                onClick={() => s.setPending("barasti")}
              >
                Barasti · {costText(COST.barasti)}
              </button>
              <button
                className={`btn small ${s.pending === "qasr" ? "on" : ""}`}
                disabled={!canAfford(me.hand, COST.qasr) || built("qasr") >= LIMITS.qasr}
                onClick={() => s.setPending("qasr")}
              >
                Qasr · {costText(COST.qasr)}
              </button>
              <button
                className="btn small"
                disabled={!canAfford(me.hand, COST.dhow) || !s.deck.length}
                onClick={s.buyDhow}
              >
                Dhow card · {costText(COST.dhow)} ({s.deck.length})
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span>Bank · 4:1</span></div>
            <div className="row">
              {RESOURCES.filter((g) => me.hand[g] >= 4).map((give) => (
                <span key={give} className="trade">
                  <b>4 {SHORT[give]} →</b>
                  {RESOURCES.filter((r) => r !== give).map((get) => (
                    <button key={get} className="btn tiny" onClick={() => s.bankTrade(give, get)}>{SHORT[get]}</button>
                  ))}
                </span>
              ))}
              {!RESOURCES.some((g) => me.hand[g] >= 4) && <span className="muted">Need 4 of one kind to trade.</span>}
            </div>
          </div>

          {me.cards.length > 0 && !hideHand && (
            <div className="panel">
              <div className="panel-head"><span>Dhow cards</span></div>
              <div className="row">
                {me.cards.map((c) => {
                  const playable = c.kind !== "hiddenPearl" && c.boughtOnTurn !== s.turnNo && !s.playedCardThisTurn;
                  if (c.kind === "bountifulTide" || c.kind === "souqCorner") {
                    return (
                      <span key={c.uid} className="trade">
                        <b>{DHOW_LABEL[c.kind]} →</b>
                        {RESOURCES.map((r) => (
                          <button key={r} className="btn tiny" disabled={!playable} onClick={() => s.playDhow(c.uid, r)}>
                            {SHORT[r]}
                          </button>
                        ))}
                      </span>
                    );
                  }
                  return (
                    <button key={c.uid} className="btn small" disabled={!playable} onClick={() => s.playDhow(c.uid)}>
                      {DHOW_LABEL[c.kind]}{c.kind === "hiddenPearl" ? " (1 pt, hidden)" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="panel">
            <button className="btn" onClick={s.endTurn}>End turn</button>
          </div>
        </>
      )}

      {s.phase === "over" && (
        <div className="panel">
          <button className="btn" onClick={() => s.newGame()}>Play again</button>
        </div>
      )}

      <SeatBar />

      <div className="panel">
        <div className="panel-head"><span>Log</span>
          <button className="btn tiny" onClick={() => s.newGame()}>New game</button>
        </div>
        <ul className="log">
          {s.log.slice(0, 7).map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>

      <p className="seed">seed {s.board.seed} · {RESOURCE_LABEL.pearls} are scarcest by design</p>
    </div>
  );
}
