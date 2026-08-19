/* =========================================================================
   store.test.ts — the turn, and the phases it passes through
   -------------------------------------------------------------------------
   The store is the one place where a correct rule can still produce a wrong
   game: rent that is right but charged to the wrong seat, a debt that lets
   play continue, a doubles roll that ends the turn anyway. All of it looks
   like normal play from the outside.
   ========================================================================= */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { k } from "../game/money";
import { BAIL, SALARY, STARTING_CASH } from "../game/board";
import { TOWER } from "../game/rules";
import { useGame } from "./store";

const BARBAR = 1, AALI = 3, SH_ISA = 6, SIYADI = 8, BU_MAHER = 9;
const CAUSEWAY = 10, VAT = 4, GAHWA = 20, BORDER_CHECK = 30;

const g = () => useGame.getState();

/** Force the dice. Returns a restore function. */
function fixDice(a: number, b: number) {
  /* roll() takes two independent Math.random() calls, in order */
  const seq = [(a - 1) / 6 + 0.001, (b - 1) / 6 + 0.001];
  let i = 0;
  return vi.spyOn(Math, "random").mockImplementation(() => seq[i++ % 2]);
}

function startLocalGame() {
  useGame.getState().newGame({ openingDeal: false, lapLimit: 0 });
  useGame.getState().startGame();
}

beforeEach(() => {
  vi.restoreAllMocks();
  startLocalGame();
});

describe("setting the table", () => {
  it("starts four seats on the same cash, at Bab Al Bahrain", () => {
    for (const p of g().players) {
      expect(p.cash).toBe(STARTING_CASH);
      expect(p.at).toBe(0);
      expect(p.bankrupt).toBe(false);
    }
    expect(g().phase).toBe("roll");
    expect(g().current).toBe(0);
  });

  it("gives every seat a different token and colour", () => {
    expect(new Set(g().players.map((p) => p.token)).size).toBe(4);
    expect(new Set(g().players.map((p) => p.colour)).size).toBe(4);
  });

  it("won't let seats be changed once the game has started", () => {
    g().setSeatType(1, "bot");
    expect(g().seats[1].type).toBe("local");
  });

  it("deals two deeds a seat when the opening deal is on", () => {
    useGame.getState().newGame({ openingDeal: true, lapLimit: 0 });
    useGame.getState().startGame();
    const owned = Object.values(g().estate.owner);
    expect(owned).toHaveLength(8);
    for (let seat = 0; seat < 4; seat++) {
      expect(owned.filter((o) => o === seat)).toHaveLength(2);
    }
  });
});

describe("rolling and landing", () => {
  it("moves the active seat by the dice and offers an unowned space", () => {
    fixDice(1, 2); // 3 -> A'ali Burial Mounds
    g().roll();
    expect(g().players[0].at).toBe(AALI);
    expect(g().phase).toBe("buy");
    expect(g().offer).toBe(AALI);
  });

  it("buys at the printed price", () => {
    fixDice(1, 2);
    g().roll();
    g().buy();
    expect(g().estate.owner[AALI]).toBe(0);
    expect(g().players[0].cash).toBe(STARTING_CASH - k(60));
    expect(g().phase).toBe("manage");
  });

  it("sends a declined space to auction rather than skipping it", () => {
    fixDice(1, 2);
    g().roll();
    g().declineBuy();
    expect(g().phase).toBe("auction");
    expect(g().auction?.index).toBe(AALI);
    expect(g().auction?.live).toHaveLength(4);
  });

  it("charges rent to the lander and pays the owner", () => {
    useGame.setState({ estate: { owner: { [AALI]: 1 }, level: {}, mortgaged: {} } });
    fixDice(1, 2);
    g().roll();
    expect(g().players[0].cash).toBe(STARTING_CASH - k(4));
    expect(g().players[1].cash).toBe(STARTING_CASH + k(4));
    expect(g().phase).toBe("manage");
  });

  it("charges nothing on a mortgaged space", () => {
    useGame.setState({ estate: { owner: { [AALI]: 1 }, level: {}, mortgaged: { [AALI]: true } } });
    fixDice(1, 2);
    g().roll();
    expect(g().players[0].cash).toBe(STARTING_CASH);
  });

  it("does nothing at all on Gahwa", () => {
    useGame.setState({ players: g().players.map((p) => (p.id === 0 ? { ...p, at: GAHWA - 3 } : p)) });
    fixDice(1, 2);
    g().roll();
    expect(g().players[0].at).toBe(GAHWA);
    expect(g().players[0].cash).toBe(STARTING_CASH);
    expect(g().phase).toBe("manage");
  });
});

describe("passing Bab Al Bahrain", () => {
  it("pays the salary and counts a lap", () => {
    useGame.setState({ players: g().players.map((p) => (p.id === 0 ? { ...p, at: 38 } : p)) });
    fixDice(2, 2); // 38 + 4 = 42 -> 2
    g().roll();
    expect(g().players[0].at).toBe(2);
    expect(g().players[0].cash).toBe(STARTING_CASH + SALARY);
    expect(g().players[0].laps).toBe(1);
  });

  it("pays nothing for going backwards past it", () => {
    /* the Shamal "back three" card must never pay a salary */
    useGame.setState({ players: g().players.map((p) => (p.id === 0 ? { ...p, at: 1 } : p)) });
    const before = g().players[0].cash;
    useGame.setState({ players: g().players.map((p) => (p.id === 0 ? { ...p, at: 38 } : p)) });
    expect(g().players[0].cash).toBe(before);
    expect(g().players[0].laps).toBe(0);
  });
});

describe("the Causeway queue", () => {
  it("sends you there from Border Check, without paying a salary on the way", () => {
    useGame.setState({ players: g().players.map((p) => (p.id === 0 ? { ...p, at: BORDER_CHECK - 3 } : p)) });
    fixDice(1, 2);
    g().roll();
    expect(g().players[0].at).toBe(CAUSEWAY);
    expect(g().players[0].stuck).toBe(3);
    expect(g().players[0].cash).toBe(STARTING_CASH);
  });

  it("lets you out on doubles, and does not grant another roll for it", () => {
    useGame.setState({ players: g().players.map((p) => (p.id === 0 ? { ...p, at: CAUSEWAY, stuck: 3 } : p)) });
    /* ten spaces on lands them on Gahwa, which resolves to `manage` with no
       decision pending — so the turn can actually be ended and the "no extra
       roll" rule is what the test is measuring, not the landing */
    fixDice(5, 5);
    g().roll();
    expect(g().players[0].stuck).toBe(0);
    expect(g().players[0].at).toBe(GAHWA);
    expect(g().doubles).toBe(0);
    expect(g().phase).toBe("manage");
    g().endTurn();
    expect(g().current).toBe(1);
  });

  it("counts the turns down and charges the fine on the third", () => {
    useGame.setState({ players: g().players.map((p) => (p.id === 0 ? { ...p, at: CAUSEWAY, stuck: 1 } : p)) });
    fixDice(2, 5);
    g().roll();
    expect(g().players[0].stuck).toBe(0);
    expect(g().players[0].cash).toBe(STARTING_CASH - BAIL);
    expect(g().players[0].at).toBe(CAUSEWAY); // fine paid, but you don't move
  });

  it("takes bail on demand", () => {
    useGame.setState({ players: g().players.map((p) => (p.id === 0 ? { ...p, at: CAUSEWAY, stuck: 3 } : p)) });
    g().payBail();
    expect(g().players[0].stuck).toBe(0);
    expect(g().players[0].cash).toBe(STARTING_CASH - BAIL);
  });

  it("spends a held pass instead, and puts the card back under its deck", () => {
    const before = g().decks.shamal.length;
    useGame.setState({
      players: g().players.map((p) => (p.id === 0 ? { ...p, at: CAUSEWAY, stuck: 3, passes: ["sh-08"] } : p)),
      decks: { ...g().decks, shamal: g().decks.shamal.filter((id) => id !== "sh-08") },
    });
    g().usePass();
    expect(g().players[0].stuck).toBe(0);
    expect(g().players[0].passes).toHaveLength(0);
    expect(g().players[0].cash).toBe(STARTING_CASH);
    expect(g().decks.shamal).toHaveLength(before);
  });
});

describe("doubles", () => {
  it("gives another roll", () => {
    fixDice(2, 2);
    g().roll();
    expect(g().doubles).toBe(1);
    g().endTurn();
    expect(g().current).toBe(0);
    expect(g().phase).toBe("roll");
  });

  it("sends you to the Causeway on the third in a row", () => {
    useGame.setState({ doubles: 2 });
    fixDice(4, 4);
    g().roll();
    expect(g().players[0].at).toBe(CAUSEWAY);
    expect(g().players[0].stuck).toBe(3);
  });

  it("does not grant an extra roll once you're in the queue", () => {
    useGame.setState({ doubles: 2 });
    fixDice(4, 4);
    g().roll();
    g().endTurn();
    expect(g().current).toBe(1);
  });
});

describe("debt", () => {
  it("opens a debt rather than letting a balance go negative", () => {
    useGame.setState({
      estate: { owner: { [AALI]: 1 }, level: { [AALI]: TOWER }, mortgaged: {} },
      players: g().players.map((p) => (p.id === 0 ? { ...p, cash: k(10) } : p)),
    });
    fixDice(1, 2);
    g().roll();
    expect(g().phase).toBe("debt");
    expect(g().debt?.seat).toBe(0);
    expect(g().debt?.to).toBe(1);
    expect(g().players[0].cash).toBe(k(10)); // nothing taken yet
  });

  it("settles once the money has been raised", () => {
    useGame.setState({
      estate: { owner: { [AALI]: 1 }, level: { [AALI]: TOWER }, mortgaged: {} },
      players: g().players.map((p) => (p.id === 0 ? { ...p, cash: k(10) } : p)),
    });
    fixDice(1, 2);
    g().roll();
    const owed = g().debt!.amount;
    useGame.setState({ players: g().players.map((p) => (p.id === 0 ? { ...p, cash: owed } : p)) });
    g().settleDebt();
    expect(g().phase).toBe("manage");
    expect(g().debt).toBeNull();
    expect(g().players[1].cash).toBe(STARTING_CASH + owed);
  });

  it("hands everything to the creditor on bankruptcy", () => {
    useGame.setState({
      estate: { owner: { [AALI]: 1, [BARBAR]: 0 }, level: { [AALI]: TOWER }, mortgaged: {} },
      players: g().players.map((p) => (p.id === 0 ? { ...p, cash: k(10) } : p)),
    });
    fixDice(1, 2);
    g().roll();
    g().declareBankrupt();
    expect(g().players[0].bankrupt).toBe(true);
    expect(g().players[0].cash).toBe(0);
    expect(g().estate.owner[BARBAR]).toBe(1);
    expect(g().players[1].cash).toBe(STARTING_CASH + k(10));
  });

  it("returns deeds to the bank when the debt was to the bank", () => {
    useGame.setState({
      estate: { owner: { [BARBAR]: 0 }, level: {}, mortgaged: {} },
      players: g().players.map((p) => (p.id === 0 ? { ...p, cash: 0, at: VAT - 1 } : p)),
    });
    fixDice(1, 0 + 1); // land exactly on VAT
    useGame.setState({ players: g().players.map((p) => (p.id === 0 ? { ...p, at: VAT - 2 } : p)) });
    fixDice(1, 1);
    g().roll();
    expect(g().phase).toBe("debt");
    g().declareBankrupt();
    expect(g().estate.owner[BARBAR]).toBeUndefined();
  });

  it("ends the game when only one seat is left standing", () => {
    useGame.setState({
      players: g().players.map((p) => (p.id === 0 ? { ...p, cash: 0 } : p.id === 1 ? p : { ...p, bankrupt: true })),
      estate: { owner: { [AALI]: 1 }, level: { [AALI]: TOWER }, mortgaged: {} },
    });
    fixDice(1, 2);
    g().roll();
    g().declareBankrupt();
    expect(g().phase).toBe("over");
    expect(g().winner).toBe(1);
  });
});

describe("building through the store", () => {
  beforeEach(() => {
    useGame.setState({
      estate: { owner: { [SH_ISA]: 0, [SIYADI]: 0, [BU_MAHER]: 0 }, level: {}, mortgaged: {} },
      phase: "manage",
    });
  });

  it("puts a villa up and takes the cash", () => {
    g().build(SH_ISA);
    expect(g().estate.level[SH_ISA]).toBe(1);
    expect(g().players[0].cash).toBe(STARTING_CASH - k(50));
  });

  it("refuses to break the even-build rule", () => {
    g().build(SH_ISA);
    g().build(SH_ISA);
    expect(g().estate.level[SH_ISA]).toBe(1);
  });

  it("sells a building back for half", () => {
    g().build(SH_ISA);
    const after = g().players[0].cash;
    g().sellBuilding(SH_ISA);
    expect(g().estate.level[SH_ISA]).toBe(0);
    expect(g().players[0].cash).toBe(after + k(25));
  });

  it("mortgages for half and clears for ten per cent more", () => {
    g().mortgage(SH_ISA);
    expect(g().estate.mortgaged[SH_ISA]).toBe(true);
    expect(g().players[0].cash).toBe(STARTING_CASH + k(50));
    g().unmortgage(SH_ISA);
    expect(g().estate.mortgaged[SH_ISA]).toBeUndefined();
    expect(g().players[0].cash).toBe(STARTING_CASH + k(50) - k(55));
  });
});

describe("the auction", () => {
  beforeEach(() => {
    fixDice(1, 2);
    g().roll();
    g().declineBuy();
  });

  it("goes to the last seat still bidding", () => {
    g().bid(k(30));          // seat 0
    g().foldBid();           // seat 1
    g().foldBid();           // seat 2
    g().foldBid();           // seat 3 — seat 0 is alone and leading
    expect(g().auction).toBeNull();
    expect(g().estate.owner[AALI]).toBe(0);
    expect(g().players[0].cash).toBe(STARTING_CASH - k(30));
  });

  it("leaves the space with the bank if nobody bids at all", () => {
    for (let i = 0; i < 4; i++) g().foldBid();
    expect(g().auction).toBeNull();
    expect(g().estate.owner[AALI]).toBeUndefined();
    expect(g().phase).toBe("manage");
  });

  it("refuses a bid below the standing one, or above the bidder's cash", () => {
    g().bid(k(30));
    const before = g().auction!.bid;
    g().bid(k(20));
    expect(g().auction!.bid).toBe(before);
    g().bid(k(99_999));
    expect(g().auction!.bid).toBe(before);
  });

  it("passes the turn round the live bidders", () => {
    expect(g().auction!.live[g().auction!.turn]).toBe(0);
    g().bid(k(10));
    expect(g().auction!.live[g().auction!.turn]).toBe(1);
  });
});

describe("turn order", () => {
  it("moves to the next seat and skips anyone who is out", () => {
    useGame.setState({
      phase: "manage",
      players: g().players.map((p) => (p.id === 1 ? { ...p, bankrupt: true } : p)),
    });
    g().endTurn();
    expect(g().current).toBe(2);
  });

  it("wraps back round to the first seat", () => {
    useGame.setState({ phase: "manage", current: 3 });
    g().endTurn();
    expect(g().current).toBe(0);
  });
});

describe("short mode", () => {
  it("ends on the lap limit and ranks on net worth", () => {
    useGame.setState({
      toggles: { openingDeal: false, lapLimit: 2 },
      phase: "manage",
      players: g().players.map((p) => ({ ...p, laps: 2, cash: k(100) * (p.id + 1) })),
    });
    g().endTurn();
    expect(g().phase).toBe("over");
    expect(g().winner).toBe(3); // richest
  });

  it("does not end early while someone is still short of the limit", () => {
    useGame.setState({
      toggles: { openingDeal: false, lapLimit: 2 },
      phase: "manage",
      players: g().players.map((p) => ({ ...p, laps: p.id === 3 ? 1 : 2 })),
    });
    g().endTurn();
    expect(g().phase).toBe("roll");
  });

  it("plays to bankruptcy when there is no lap limit", () => {
    useGame.setState({
      toggles: { openingDeal: false, lapLimit: 0 },
      phase: "manage",
      players: g().players.map((p) => ({ ...p, laps: 99 })),
    });
    g().endTurn();
    expect(g().phase).toBe("roll");
  });
});
