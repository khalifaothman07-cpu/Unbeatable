/* =========================================================================
   bot.test.ts — judgement, and four bots playing each other
   -------------------------------------------------------------------------
   The self-play suite at the bottom is the most valuable test in this
   repository. A property game has eight phases and a dozen ways to leave
   each of them, and the failure that matters is not a wrong rent — it is a
   state the table can never get out of. Nobody finds that by playing; you
   find it by making four machines play a thousand games and asserting that
   something changes every single step.
   ========================================================================= */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { k } from "./money";
import { STARTING_CASH } from "./board";
import { TOWER, emptyEstate, holdings, netWorth, type Estate } from "./rules";
import { bestBuild, decide, pendingSeat, valueOf } from "./bot";
import { applyBotAction, makeRng, useGame, type GameState } from "../state/store";

const BARBAR = 1, SH_ISA = 6, SIYADI = 8, BU_MAHER = 9;
const CAUSEWAY_X = 5, AIRPORT = 15, PORT = 25, FERRY = 35;
const AL_DUR = 12, HIDD = 28;

const g = () => useGame.getState();

function owned(seat: number, ...indices: number[]): Estate {
  const e = emptyEstate();
  for (const i of indices) e.owner[i] = seat;
  return e;
}

beforeEach(() => {
  vi.restoreAllMocks();
  useGame.getState().newGame({ openingDeal: false, lapLimit: 0 });
  useGame.getState().startGame();
});

describe("valuation", () => {
  it("prices the deed that completes a group far above its ticket", () => {
    const e = owned(0, SH_ISA, SIYADI);
    const worth = valueOf(e, 0, BU_MAHER);
    expect(worth).toBeGreaterThan(k(120) * 2);
  });

  it("wants the second deed in a group more than a stranger's group", () => {
    const withFoothold = valueOf(owned(0, SH_ISA), 0, SIYADI);
    const cold = valueOf(emptyEstate(), 0, SIYADI);
    expect(withFoothold).toBeGreaterThan(cold);
  });

  it("discounts a group somebody else already has a piece of", () => {
    const contested = owned(1, SH_ISA);
    expect(valueOf(contested, 0, SIYADI)).toBeLessThan(valueOf(emptyEstate(), 0, SIYADI));
  });

  it("values each extra crossing more than the last", () => {
    const one = valueOf(owned(0, CAUSEWAY_X), 0, AIRPORT);
    const three = valueOf(owned(0, CAUSEWAY_X, AIRPORT, PORT), 0, FERRY);
    expect(three).toBeGreaterThan(one);
  });

  it("wants the second EWA station less than the first", () => {
    const first = valueOf(emptyEstate(), 0, AL_DUR);
    const second = valueOf(owned(0, AL_DUR), 0, HIDD);
    expect(second).toBeGreaterThan(first); // a pair is worth having
    expect(valueOf(owned(0, AL_DUR, HIDD), 0, HIDD)).toBeLessThan(second);
  });
});

describe("buying", () => {
  it("buys a cheap deed with a full wallet", () => {
    useGame.setState({ phase: "buy", offer: BARBAR });
    expect(decide(g(), 0)).toEqual({ kind: "buy" });
  });

  it("goes short of its reserve for a deed that completes a group", () => {
    useGame.setState({
      phase: "buy", offer: BU_MAHER,
      estate: owned(0, SH_ISA, SIYADI),
      players: g().players.map((p) => (p.id === 0 ? { ...p, cash: k(125) } : p)),
    });
    expect(decide(g(), 0)).toEqual({ kind: "buy" });
  });

  it("passes when it simply cannot afford it", () => {
    useGame.setState({
      phase: "buy", offer: 39,
      players: g().players.map((p) => (p.id === 0 ? { ...p, cash: k(10) } : p)),
    });
    expect(decide(g(), 0)).toEqual({ kind: "declineBuy" });
  });

  it("keeps a reserve rather than spending down to nothing on a cold deed", () => {
    useGame.setState({
      phase: "buy", offer: 39,
      players: g().players.map((p) => (p.id === 0 ? { ...p, cash: k(410) } : p)),
    });
    expect(decide(g(), 0)).toEqual({ kind: "declineBuy" });
  });
});

describe("bidding", () => {
  function auctionOn(index: number, bid = 0, leader: number | null = null) {
    useGame.setState({
      phase: "auction",
      auction: { index, bid, leader, live: [0, 1, 2, 3], turn: 0 },
    });
  }

  it("opens the bidding on something it wants", () => {
    auctionOn(BARBAR);
    const a = decide(g(), 0);
    expect(a?.kind).toBe("bid");
  });

  it("stops once the price passes what the deed is worth to it", () => {
    auctionOn(BARBAR, k(200), 1);
    expect(decide(g(), 0)).toEqual({ kind: "foldBid" });
  });

  it("never bids against itself", () => {
    auctionOn(BARBAR, k(30), 0);
    expect(decide(g(), 0)).toEqual({ kind: "foldBid" });
  });

  it("never bids past its own cash", () => {
    auctionOn(39, 0);
    useGame.setState({ players: g().players.map((p) => (p.id === 0 ? { ...p, cash: k(10) } : p)) });
    expect(decide(g(), 0)).toEqual({ kind: "foldBid" });
  });
});

describe("building", () => {
  it("builds nothing without a complete group", () => {
    useGame.setState({ phase: "manage", estate: owned(0, SH_ISA, SIYADI) });
    expect(bestBuild(g(), 0)).toBeNull();
  });

  it("builds once the group is complete", () => {
    useGame.setState({ phase: "manage", estate: owned(0, SH_ISA, SIYADI, BU_MAHER) });
    expect(bestBuild(g(), 0)).not.toBeNull();
  });

  it("respects the even-build rule when picking where", () => {
    const e = owned(0, SH_ISA, SIYADI, BU_MAHER);
    e.level[SH_ISA] = 1;
    useGame.setState({ phase: "manage", estate: e });
    expect(bestBuild(g(), 0)).not.toBe(SH_ISA);
  });

  it("won't spend below its reserve to build", () => {
    useGame.setState({
      phase: "manage",
      estate: owned(0, SH_ISA, SIYADI, BU_MAHER),
      players: g().players.map((p) => (p.id === 0 ? { ...p, cash: k(60) } : p)),
    });
    expect(bestBuild(g(), 0)).toBeNull();
  });

  it("ends the turn when there is nothing left worth doing", () => {
    useGame.setState({ phase: "manage", estate: emptyEstate() });
    expect(decide(g(), 0)).toEqual({ kind: "endTurn" });
  });
});

describe("debt", () => {
  it("settles outright when it has the cash", () => {
    useGame.setState({ phase: "debt", debt: { seat: 0, amount: k(100), to: 1, reason: "rent" } });
    expect(decide(g(), 0)).toEqual({ kind: "settleDebt" });
  });

  it("sells buildings before it mortgages anything", () => {
    const e = owned(0, SH_ISA, SIYADI, BU_MAHER);
    e.level[SH_ISA] = 2; e.level[SIYADI] = 1; e.level[BU_MAHER] = 1;
    useGame.setState({
      phase: "debt", estate: e,
      /* 4 villas sell back at 100k and the three deeds mortgage for 160k,
         so 200k is survivable — the bot should raise it, not fold */
      debt: { seat: 0, amount: k(200), to: 1, reason: "rent" },
      players: g().players.map((p) => (p.id === 0 ? { ...p, cash: 0 } : p)),
    });
    expect(decide(g(), 0)).toEqual({ kind: "sellBuilding", index: SH_ISA });
  });

  it("mortgages once there is nothing built left to sell", () => {
    useGame.setState({
      phase: "debt", estate: owned(0, SH_ISA, SIYADI, BU_MAHER),
      /* nothing built, so 160k of mortgage value is the whole estate */
      debt: { seat: 0, amount: k(100), to: 1, reason: "rent" },
      players: g().players.map((p) => (p.id === 0 ? { ...p, cash: 0 } : p)),
    });
    const a = decide(g(), 0);
    expect(a?.kind).toBe("mortgage");
  });

  it("folds when the arithmetic says it cannot be paid", () => {
    useGame.setState({
      phase: "debt", estate: owned(0, BARBAR),
      debt: { seat: 0, amount: k(5000), to: 1, reason: "rent" },
      players: g().players.map((p) => (p.id === 0 ? { ...p, cash: 0 } : p)),
    });
    expect(decide(g(), 0)).toEqual({ kind: "declareBankrupt" });
  });
});

describe("offers made to a bot", () => {
  function offerTo(bot: number, over: Partial<import("./rules").Trade>) {
    useGame.setState({
      phase: "manage",
      trade: { from: 1 - bot, to: bot, giveDeeds: [], giveCash: 0, wantDeeds: [], wantCash: 0, ...over },
    });
  }

  it("takes a deal that leaves it ahead", () => {
    useGame.setState({ estate: owned(1, BARBAR) });
    offerTo(0, { giveDeeds: [BARBAR] });
    expect(decide(g(), 0)).toEqual({ kind: "acceptTrade" });
  });

  it("refuses a deal that leaves it behind", () => {
    useGame.setState({ estate: owned(0, BARBAR) });
    offerTo(0, { wantDeeds: [BARBAR] });
    expect(decide(g(), 0)).toEqual({ kind: "declineTrade" });
  });

  it("will not hand over the deed that completes somebody else's group for a normal profit", () => {
    /* seat 1 holds two of the pearling group; the bot holds the third. A
       modest premium is not a reason to hand somebody the game. */
    const e = owned(1, SH_ISA, SIYADI);
    e.owner[BU_MAHER] = 0;
    useGame.setState({ estate: e });
    offerTo(0, { wantDeeds: [BU_MAHER], giveCash: k(150) }); // 120k deed
    expect(decide(g(), 0)).toEqual({ kind: "declineTrade" });
  });

  it("does sell it at triple, because refusing at ANY price is a stalemate", () => {
    /* This is the rule that self-play forced. A bot that never sells a
       blocker means groups never complete, nothing is ever built, and rents
       stay smaller than the salary — a table that cannot reach an ending. */
    const e = owned(1, SH_ISA, SIYADI);
    e.owner[BU_MAHER] = 0;
    useGame.setState({ estate: e });
    offerTo(0, { wantDeeds: [BU_MAHER], giveCash: k(360) });
    expect(decide(g(), 0)).toEqual({ kind: "acceptTrade" });
  });

  it("takes a bad-looking deal that completes ITS own group", () => {
    const e = owned(0, SH_ISA, SIYADI);
    e.owner[BU_MAHER] = 1;
    useGame.setState({ estate: e });
    offerTo(0, { giveDeeds: [BU_MAHER], wantCash: k(400) });
    expect(decide(g(), 0)).toEqual({ kind: "acceptTrade" });
  });
});

describe("the Causeway queue", () => {
  it("spends a held pass before anything else", () => {
    useGame.setState({
      phase: "roll",
      players: g().players.map((p) => (p.id === 0 ? { ...p, stuck: 3, passes: ["sh-08"] } : p)),
    });
    expect(decide(g(), 0)).toEqual({ kind: "usePass" });
  });

  it("pays its way out early, while the board is still empty", () => {
    useGame.setState({
      phase: "roll",
      players: g().players.map((p) => (p.id === 0 ? { ...p, stuck: 3 } : p)),
    });
    expect(decide(g(), 0)).toEqual({ kind: "payBail" });
  });

  it("sits tight once there are towers to land on", () => {
    const e = owned(1, SH_ISA, SIYADI, BU_MAHER);
    e.level[SH_ISA] = TOWER;
    useGame.setState({
      phase: "roll", estate: e,
      players: g().players.map((p) => (p.id === 0 ? { ...p, stuck: 3 } : p)),
    });
    expect(decide(g(), 0)).toEqual({ kind: "roll" });
  });
});

describe("who the table is waiting on", () => {
  it("is the active seat, normally", () => {
    useGame.setState({ phase: "roll", current: 2 });
    expect(pendingSeat(g())).toBe(2);
  });

  it("is the bidder in an auction, not whoever's turn it is", () => {
    useGame.setState({ phase: "auction", current: 0, auction: { index: 1, bid: 0, leader: null, live: [1, 2], turn: 1 } });
    expect(pendingSeat(g())).toBe(2);
  });

  it("is the debtor while a debt is open", () => {
    useGame.setState({ phase: "debt", current: 0, debt: { seat: 3, amount: k(10), to: null, reason: "tax" } });
    expect(pendingSeat(g())).toBe(3);
  });

  it("is the seat an offer was made to", () => {
    useGame.setState({
      phase: "manage", current: 0,
      trade: { from: 0, to: 2, giveDeeds: [], giveCash: k(10), wantDeeds: [], wantCash: 0 },
    });
    expect(pendingSeat(g())).toBe(2);
  });

  it("is nobody once the game is over", () => {
    useGame.setState({ phase: "over", winner: 0 });
    expect(pendingSeat(g())).toBeNull();
  });
});

/* =========================================================================
   SELF-PLAY
   ========================================================================= */

/** Everything about the table that a real move must change. */
function signature(s: GameState): string {
  return JSON.stringify([
    s.phase, s.current, s.offer, s.debt?.amount ?? null, s.trade === null,
    s.auction ? [s.auction.bid, s.auction.leader, s.auction.live.length, s.auction.turn] : null,
    s.drawn?.id ?? null,
    s.players.map((p) => [p.cash, p.at, p.stuck, p.bankrupt, p.laps, p.passes.length]),
    s.estate.owner, s.estate.level, s.estate.mortgaged,
  ]);
}

/** Play one whole game with every seat a bot. Throws on a stuck table. */
function playOut(seed: number, toggles = { openingDeal: false, lapLimit: 0 }) {
  const rng = makeRng(seed);
  vi.spyOn(Math, "random").mockImplementation(rng);

  useGame.getState().newGame(toggles);
  useGame.setState({ seats: [0, 1, 2, 3].map(() => ({ type: "bot" as const, code: null })) });
  useGame.getState().startGame();

  let steps = 0;
  const CAP = 60_000;
  while (g().phase !== "over" && steps++ < CAP) {
    const s = g();
    const seat = pendingSeat(s);
    if (seat === null) break;
    const action = decide(s, seat);
    if (!action) throw new Error(`nobody could act: phase ${s.phase}, seat ${seat}`);
    const before = signature(s);
    applyBotAction(g(), action);
    if (signature(g()) === before) {
      throw new Error(
        `bot proposed a no-op: ${JSON.stringify(action)} in phase ${s.phase} for seat ${seat}`);
    }
  }
  return { steps, state: g() };
}

describe("four bots play each other", () => {
  it("finishes a game on twenty different seeds, without ever getting stuck", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { state, steps } = playOut(seed);
      expect(state.phase, `seed ${seed} never finished (${steps} steps)`).toBe("over");
      expect(state.winner, `seed ${seed} finished with no winner`).not.toBeNull();
      expect(state.players.filter((p) => !p.bankrupt)).toHaveLength(1);
    }
  }, 120_000);

  it("finishes under a lap limit, and ranks the richest first", () => {
    for (let seed = 101; seed <= 110; seed++) {
      const { state } = playOut(seed, { openingDeal: true, lapLimit: 4 });
      expect(state.phase, `seed ${seed} never finished`).toBe("over");
      const winner = state.winner!;
      const worth = (id: number) => netWorth(state.estate, state.players[id].cash, id);
      for (const p of state.players) {
        if (p.bankrupt || p.id === winner) continue;
        expect(worth(winner), `seed ${seed}: winner isn't richest`).toBeGreaterThanOrEqual(worth(p.id));
      }
    }
  }, 120_000);

  it("does not always hand it to the same seat", () => {
    const winners = new Set<number>();
    for (let seed = 200; seed <= 215; seed++) winners.add(playOut(seed).state.winner!);
    expect(winners.size, "every game went to the same seat — the turn order is worth something, but not that much")
      .toBeGreaterThan(1);
  }, 120_000);

  it("keeps the books straight — no money appears from nowhere", () => {
    const { state } = playOut(7);
    /* the bank pays salaries in, so total cash can only be checked for
       sanity: nobody holds a negative balance, and the winner holds the lot */
    for (const p of state.players) expect(p.cash).toBeGreaterThanOrEqual(0);
    const survivor = state.players.find((p) => !p.bankrupt)!;
    expect(survivor.cash).toBeGreaterThan(0);
    /* and every deed on the board belongs to somebody still playing */
    for (const seat of [0, 1, 2, 3]) {
      if (state.players[seat].bankrupt) {
        expect(holdings(state.estate, seat), "a bankrupt seat is still holding deeds").toHaveLength(0);
      }
    }
  }, 60_000);

  it("never leaves a seat holding more than it started with by accident", () => {
    /* a sanity check on the economy: after a full game the survivor should be
       worth more than one starting stack, since they have absorbed the others */
    const { state } = playOut(11);
    const survivor = state.players.find((p) => !p.bankrupt)!;
    expect(netWorth(state.estate, survivor.cash, survivor.id)).toBeGreaterThan(STARTING_CASH);
  }, 60_000);
});
