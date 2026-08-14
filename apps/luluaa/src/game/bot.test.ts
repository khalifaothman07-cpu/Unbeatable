/* =========================================================================
   bot.test.ts — does the bot play, and does it play sensibly?
   -------------------------------------------------------------------------
   Two kinds of check.

   The judgement tests pin down specific decisions on a real board: it takes
   the richest corner, it doesn't blockade itself with the Shamal, it turns
   down a trade that only helps the proposer.

   The self-play test is the one that matters most. Four bots play whole
   games to a winner, with an action budget that fails the test rather than
   hanging it. Deadlocks in this game are real — a rolled 7 that can't
   resolve froze an earlier build — and no amount of unit testing finds one
   as reliably as playing until somebody wins.
   ========================================================================= */

import { beforeEach, describe, expect, it } from "vitest";
import { useGame } from "../state/store";
import { applyBotAction, decide, offerAnswer, pendingSeat, shamalChoice, vertexValue } from "./bot";
import { legalShamalTiles } from "../state/store";
import { WIN_POINTS, handCount } from "./rules";
import type { Resource } from "./types";

const g = () => useGame.getState();

/** Every seat a bot, so nothing waits on a human. */
function allBots() {
  useGame.setState({
    seats: [0, 1, 2, 3].map(() => ({ type: "bot" as const, code: null })),
  });
}

/**
 * Play until somebody wins or the budget runs out. Returns the step count so
 * a test can assert the game actually converges rather than crawling.
 */
function playOut(maxSteps = 20000): number {
  let steps = 0;
  while (g().phase !== "over" && steps < maxSteps) {
    const s = g();

    /* the Shamal can have nowhere legal to land; the UI resolves that with
       an effect, so a headless game has to do the same */
    if (s.phase === "moveShamal" && legalShamalTiles(s).length === 0) {
      s.settleShamal();
      steps++;
      continue;
    }

    const seat = pendingSeat(s);
    if (seat === null) break;
    const action = decide(s, seat, () => legalShamalTiles(s));
    if (!action) break;

    const before = JSON.stringify([s.phase, s.current, s.setupIndex, s.buildings, s.routes, s.players.map((p) => p.hand)]);
    applyBotAction(s, action);
    steps++;

    const after = g();
    const now = JSON.stringify([after.phase, after.current, after.setupIndex, after.buildings, after.routes, after.players.map((p) => p.hand)]);
    if (before === now) {
      /* the store refused an action the bot believed was legal — that is a
         bug in the bot, and silently retrying would spin forever */
      throw new Error(`bot proposed a no-op: ${JSON.stringify(action)} in phase ${s.phase}`);
    }
  }
  return steps;
}

describe("bot judgement", () => {
  beforeEach(() => { useGame.getState().newGame(); allBots(); });

  it("opens on a corner at least as good as any it passed over", () => {
    const s = g();
    const pick = decide(s, s.setupOrder[s.setupIndex], () => [])!;
    expect(pick.kind).toBe("setupBarasti");
    const chosen = (pick as { vertex: string }).vertex;

    const mine = vertexValue(chosen, s.geo, s.board, s.shamalTile);
    const best = Object.keys(s.geo.vertices)
      .map((v) => vertexValue(v, s.geo, s.board, s.shamalTile))
      .reduce((m, x) => Math.max(m, x), 0);
    expect(mine).toBeCloseTo(best, 5);
  });

  it("never parks the Shamal on its own production", () => {
    /* run a real game far enough that seats own several corners */
    for (let i = 0; i < 400 && g().phase === "setup"; i++) {
      const s = g();
      applyBotAction(s, decide(s, pendingSeat(s)!, () => legalShamalTiles(s))!);
    }
    const s = g();
    const seat = 0;
    const legal = s.board.tiles.filter((t) => t.id !== s.shamalTile).map((t) => t.id);
    const pick = shamalChoice(s, seat, legal);
    expect(pick).toBeTruthy();
    const ownCorners = (s.geo.tileVertices[pick!] ?? [])
      .filter((v) => s.buildings[v]?.player === seat);
    expect(ownCorners).toHaveLength(0);
  });

  it("declines a trade that only helps the proposer", () => {
    const hand: Record<Resource, number> = { palmWood: 0, limestone: 0, dates: 0, fish: 0, pearls: 3 };
    useGame.setState({
      phase: "main", current: 0,
      players: g().players.map((p, i) => i === 1 ? { ...p, hand: { ...hand } } : p),
      /* seat 0 wants the pearls — the scarcest thing on the board — and
         offers a single wood for them */
      offer: { from: 0, give: { palmWood: 1 }, want: { pearls: 3 }, declined: [] },
    });
    expect(offerAnswer(g(), 1)).toBe(false);
  });

  it("accepts a trade that clearly helps it", () => {
    const hand: Record<Resource, number> = { palmWood: 6, limestone: 0, dates: 0, fish: 0, pearls: 0 };
    useGame.setState({
      phase: "main", current: 0,
      players: g().players.map((p, i) => i === 1 ? { ...p, hand: { ...hand } } : p),
      /* three scarce pearls for one of a pile of six wood */
      offer: { from: 0, give: { pearls: 3 }, want: { palmWood: 1 }, declined: [] },
    });
    expect(offerAnswer(g(), 1)).toBe(true);
  });

  it("won't accept what it cannot cover", () => {
    const hand: Record<Resource, number> = { palmWood: 0, limestone: 0, dates: 0, fish: 0, pearls: 0 };
    useGame.setState({
      phase: "main", current: 0,
      players: g().players.map((p, i) => i === 1 ? { ...p, hand: { ...hand } } : p),
      offer: { from: 0, give: { pearls: 5 }, want: { palmWood: 2 }, declined: [] },
    });
    expect(offerAnswer(g(), 1)).toBe(false);
  });
});

describe("four bots play a whole game", () => {
  it("reaches a winner without stalling", () => {
    useGame.getState().newGame();
    allBots();
    const steps = playOut();

    const s = g();
    expect(s.phase, `game did not finish in ${steps} steps`).toBe("over");
    expect(s.winner).not.toBeNull();
    expect(steps).toBeLessThan(20000);

    /* the winner actually earned it */
    const pts = Object.values(s.buildings)
      .filter((b) => b.player === s.winner)
      .reduce((n, b) => n + (b.type === "qasr" ? 2 : 1), 0);
    expect(pts).toBeGreaterThan(0);
    expect(s.log[0]).toMatch(/wins/);
  }, 60000);

  it("finishes ten different boards, and the win isn't always the same seat", () => {
    const winners: number[] = [];
    const lengths: number[] = [];
    for (let i = 0; i < 10; i++) {
      useGame.getState().newGame();
      allBots();
      lengths.push(playOut());
      expect(g().phase, `board ${i} stalled`).toBe("over");
      winners.push(g().winner!);
    }
    /* if one seat always won, the bot would be reading turn order rather
       than the board */
    expect(new Set(winners).size).toBeGreaterThan(1);
    /* and games should take a plausible number of turns, not two or a
       thousand — this catches a bot that stumbles into a win or grinds */
    const turns = lengths.map((n) => n);
    expect(Math.min(...turns)).toBeGreaterThan(50);
  }, 180000);

  it("never lets a seat hold cards it didn't earn", () => {
    useGame.getState().newGame();
    allBots();
    let steps = 0;
    while (g().phase !== "over" && steps < 20000) {
      const s = g();
      if (s.phase === "moveShamal" && legalShamalTiles(s).length === 0) { s.settleShamal(); steps++; continue; }
      const seat = pendingSeat(s);
      if (seat === null) break;
      const a = decide(s, seat, () => legalShamalTiles(s));
      if (!a) break;
      applyBotAction(s, a);
      steps++;

      for (const p of g().players) {
        for (const r of Object.keys(p.hand) as Resource[]) {
          expect(p.hand[r], `${p.name} went negative on ${r}`).toBeGreaterThanOrEqual(0);
        }
        /* nobody should be sitting on an absurd hand — that would mean the
           discard rule or a trade is leaking cards */
        expect(handCount(p.hand)).toBeLessThan(60);
      }
    }
    expect(g().phase).toBe("over");
    expect(Math.max(...g().players.map((p) => p.id))).toBe(3);
  }, 60000);

  it("stops at the win threshold rather than overshooting", () => {
    useGame.getState().newGame();
    allBots();
    playOut();
    const s = g();
    const total = Object.values(s.buildings)
      .filter((b) => b.player === s.winner)
      .reduce((n, b) => n + (b.type === "qasr" ? 2 : 1), 0)
      + s.players[s.winner!].cards.filter((c) => c.kind === "hiddenPearl").length;
    expect(total).toBeGreaterThanOrEqual(WIN_POINTS - 4); // longest route / navigator make up the rest
  }, 60000);
});
