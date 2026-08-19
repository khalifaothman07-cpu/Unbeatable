/* =========================================================================
   trade.test.ts — deeds and cash changing hands
   -------------------------------------------------------------------------
   An offer is composed at one moment and accepted at another. Everything
   worth testing here is about what can change in between: a wallet emptied
   by a 7, a building going up, a deed sold on. An implementation that
   validates only at compose time looks completely correct until the day it
   quietly conjures money out of nothing.
   ========================================================================= */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { k } from "../game/money";
import { STARTING_CASH } from "../game/board";
import { canTrade, emptyTrade, tradeBalance, tradeIsEmpty, type Trade } from "../game/rules";
import { useGame } from "./store";

const BARBAR = 1, AALI = 3, SH_ISA = 6, SIYADI = 8, BU_MAHER = 9;
const g = () => useGame.getState();
const cashOf = (seat: number) => g().players[seat].cash;

/** Seat 0 holds Barbar, seat 1 holds A'ali. Both are mid-turn for seat 0. */
function twoOwners() {
  useGame.getState().newGame({ openingDeal: false, lapLimit: 0 });
  useGame.getState().startGame();
  useGame.setState({
    phase: "manage",
    estate: { owner: { [BARBAR]: 0, [AALI]: 1 }, level: {}, mortgaged: {} },
  });
}

const deal = (over: Partial<Trade> = {}): Trade => ({ ...emptyTrade(0, 1), ...over });

beforeEach(() => {
  vi.restoreAllMocks();
  twoOwners();
});

describe("composing an offer", () => {
  it("refuses an empty one", () => {
    expect(tradeIsEmpty(deal())).toBe(true);
    expect(canTrade(g().estate, cashOf, deal()).ok).toBe(false);
  });

  it("refuses to trade with yourself", () => {
    expect(canTrade(g().estate, cashOf, deal({ to: 0, giveDeeds: [BARBAR] })).ok).toBe(false);
  });

  it("refuses a deed the giver doesn't own", () => {
    expect(canTrade(g().estate, cashOf, deal({ giveDeeds: [AALI] })).ok).toBe(false);
    expect(canTrade(g().estate, cashOf, deal({ wantDeeds: [BARBAR] })).ok).toBe(false);
  });

  it("refuses more cash than a side is holding", () => {
    expect(canTrade(g().estate, cashOf, deal({ giveCash: STARTING_CASH + 1 })).ok).toBe(false);
    expect(canTrade(g().estate, cashOf, deal({ wantCash: STARTING_CASH + 1 })).ok).toBe(false);
  });

  it("refuses negative cash — the direction is which side it's on", () => {
    expect(canTrade(g().estate, cashOf, deal({ giveCash: -k(50), wantDeeds: [AALI] })).ok).toBe(false);
  });

  it("accepts deeds one way and cash the other", () => {
    expect(canTrade(g().estate, cashOf, deal({ wantDeeds: [AALI], giveCash: k(100) })).ok).toBe(true);
  });

  it("refuses a deed whose group has anything built on it", () => {
    useGame.setState({
      estate: {
        owner: { [SH_ISA]: 0, [SIYADI]: 0, [BU_MAHER]: 0, [AALI]: 1 },
        level: { [SH_ISA]: 1 },
        mortgaged: {},
      },
    });
    /* even a bare plot in that group is frozen — the buildings come down first */
    expect(canTrade(g().estate, cashOf, deal({ giveDeeds: [SIYADI] })).ok).toBe(false);
    expect(canTrade(g().estate, cashOf, deal({ giveDeeds: [SH_ISA] })).ok).toBe(false);
  });

  it("allows a mortgaged deed to change hands", () => {
    useGame.setState({
      estate: { owner: { [BARBAR]: 0, [AALI]: 1 }, level: {}, mortgaged: { [BARBAR]: true } },
    });
    expect(canTrade(g().estate, cashOf, deal({ giveDeeds: [BARBAR] })).ok).toBe(true);
  });
});

describe("posting and accepting", () => {
  it("moves deeds and cash both ways at once", () => {
    g().proposeTrade(deal({ giveDeeds: [BARBAR], giveCash: k(20), wantDeeds: [AALI], wantCash: k(5) }));
    expect(g().trade).not.toBeNull();
    g().acceptTrade();

    expect(g().estate.owner[BARBAR]).toBe(1);
    expect(g().estate.owner[AALI]).toBe(0);
    expect(g().players[0].cash).toBe(STARTING_CASH - k(20) + k(5));
    expect(g().players[1].cash).toBe(STARTING_CASH + k(20) - k(5));
    expect(g().trade).toBeNull();
  });

  it("holds only one offer at a time", () => {
    g().proposeTrade(deal({ giveDeeds: [BARBAR] }));
    const first = g().trade;
    g().proposeTrade(deal({ wantDeeds: [AALI] }));
    /* the second replaces the first rather than queueing behind it */
    expect(g().trade).not.toBe(first);
    expect(g().trade!.wantDeeds).toEqual([AALI]);
  });

  it("throws the offer away on decline", () => {
    g().proposeTrade(deal({ giveDeeds: [BARBAR] }));
    g().declineTrade();
    expect(g().trade).toBeNull();
    expect(g().estate.owner[BARBAR]).toBe(0);
  });

  it("refuses to post an offer that was never valid", () => {
    g().proposeTrade(deal({ giveDeeds: [AALI] })); // not seat 0's to give
    expect(g().trade).toBeNull();
  });

  it("won't post outside a turn", () => {
    useGame.setState({ phase: "roll" });
    g().proposeTrade(deal({ giveDeeds: [BARBAR] }));
    expect(g().trade).toBeNull();
  });

  it("CAN be posted while in debt — that is how you raise the money", () => {
    useGame.setState({ phase: "debt", debt: { seat: 0, amount: k(500), to: 1, reason: "rent" } });
    g().proposeTrade(deal({ giveDeeds: [BARBAR], wantCash: k(80) }));
    expect(g().trade).not.toBeNull();
  });
});

describe("what can change between offering and accepting", () => {
  it("lapses if the cash promised has since gone", () => {
    g().proposeTrade(deal({ giveCash: k(1400), wantDeeds: [AALI] }));
    /* a 7 lands in between and empties seat 0 */
    useGame.setState({ players: g().players.map((p) => (p.id === 0 ? { ...p, cash: k(10) } : p)) });
    g().acceptTrade();
    expect(g().trade).toBeNull();
    expect(g().estate.owner[AALI]).toBe(1);       // nothing moved
    expect(g().players[0].cash).toBe(k(10));      // and no money was conjured
  });

  it("lapses if a deed in the offer has since changed hands", () => {
    g().proposeTrade(deal({ giveDeeds: [BARBAR], wantDeeds: [AALI] }));
    useGame.setState({ estate: { ...g().estate, owner: { [BARBAR]: 2, [AALI]: 1 } } });
    g().acceptTrade();
    expect(g().trade).toBeNull();
    expect(g().estate.owner[BARBAR]).toBe(2);
  });

  it("lapses if a building has since gone up on the group", () => {
    useGame.setState({
      estate: { owner: { [SH_ISA]: 0, [SIYADI]: 0, [BU_MAHER]: 0, [AALI]: 1 }, level: {}, mortgaged: {} },
    });
    g().proposeTrade(deal({ giveDeeds: [SH_ISA], wantDeeds: [AALI] }));
    expect(g().trade).not.toBeNull();
    useGame.setState({ estate: { ...g().estate, level: { [SIYADI]: 1 } } });
    g().acceptTrade();
    expect(g().trade).toBeNull();
    expect(g().estate.owner[SH_ISA]).toBe(0);
  });

  it("does not survive the end of the turn", () => {
    g().proposeTrade(deal({ giveDeeds: [BARBAR] }));
    g().endTurn();
    expect(g().trade).toBeNull();
  });
});

describe("the balance line", () => {
  it("counts a deed at its printed price", () => {
    const t = deal({ giveDeeds: [BARBAR] }); // 60k to seat 1
    expect(tradeBalance(g().estate, t, 1)).toBe(k(60));
    expect(tradeBalance(g().estate, t, 0)).toBe(-k(60));
  });

  it("halves a mortgaged deed, because that is what arrives", () => {
    useGame.setState({
      estate: { owner: { [BARBAR]: 0, [AALI]: 1 }, level: {}, mortgaged: { [BARBAR]: true } },
    });
    expect(tradeBalance(g().estate, deal({ giveDeeds: [BARBAR] }), 1)).toBe(k(30));
  });

  it("nets cash against deeds", () => {
    const t = deal({ giveDeeds: [BARBAR], wantDeeds: [AALI], wantCash: k(20) });
    /* seat 1 gets a 60k deed, gives a 60k deed and 20k */
    expect(tradeBalance(g().estate, t, 1)).toBe(-k(20));
  });

  it("is symmetrical — one side's gain is the other's loss", () => {
    const t = deal({ giveDeeds: [BARBAR], giveCash: k(15), wantDeeds: [AALI], wantCash: k(40) });
    expect(tradeBalance(g().estate, t, 0)).toBe(-tradeBalance(g().estate, t, 1));
  });
});
