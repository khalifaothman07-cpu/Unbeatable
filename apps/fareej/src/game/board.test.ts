/* =========================================================================
   board.test.ts — the board is content, so test it like content
   -------------------------------------------------------------------------
   Everything here would be a silent failure in play rather than a crash: a
   group with four plots, a price ladder that dips, a rent table one entry
   short. The game would run, and it would just be subtly wrong forever.
   ========================================================================= */

import { describe, expect, it } from "vitest";
import { BOARD, BUILD_COST, CAUSEWAY_INDEX, GO_INDEX, LAP, groupSize, spacesInGroup } from "./board";
import { COLOUR_GROUPS, isOwnable, type ColourGroup } from "./types";

describe("the lap", () => {
  it("is forty spaces, indexed 0 to 39 in order", () => {
    expect(BOARD).toHaveLength(40);
    expect(LAP).toBe(40);
    BOARD.forEach((s, i) => expect(s.index).toBe(i));
  });

  it("puts the four corners where a lap expects them", () => {
    expect(BOARD[GO_INDEX].kind).toBe("go");
    expect(BOARD[CAUSEWAY_INDEX].kind).toBe("causeway");
    expect(BOARD[20].kind).toBe("gahwa");
    expect(BOARD[30].kind).toBe("borderCheck");
  });

  it("deals the two decks evenly around the board", () => {
    expect(BOARD.filter((s) => s.kind === "shamal")).toHaveLength(3);
    expect(BOARD.filter((s) => s.kind === "sandooq")).toHaveLength(3);
    expect(BOARD.filter((s) => s.kind === "tax")).toHaveLength(2);
  });

  it("names every space, and never the same name twice among the ownable", () => {
    for (const s of BOARD) expect(s.name.length, `space ${s.index} has no name`).toBeGreaterThan(0);
    const owned = BOARD.filter(isOwnable).map((s) => s.name);
    expect(new Set(owned).size).toBe(owned.length);
  });
});

describe("the groups", () => {
  it("has eight colour groups sized 2/3/3/3/3/3/3/2", () => {
    expect(COLOUR_GROUPS).toHaveLength(8);
    const sizes = COLOUR_GROUPS.map(groupSize);
    expect(sizes).toEqual([2, 3, 3, 3, 3, 3, 3, 2]);
  });

  it("has four crossings and two EWA stations", () => {
    expect(groupSize("crossings")).toBe(4);
    expect(groupSize("ewa")).toBe(2);
  });

  it("adds up to twenty-two plots and twenty-eight ownable spaces", () => {
    expect(BOARD.filter((s) => s.kind === "property")).toHaveLength(22);
    expect(BOARD.filter(isOwnable)).toHaveLength(28);
  });

  it("gives every colour group a build cost, rising with the ladder", () => {
    const costs = COLOUR_GROUPS.map((g) => BUILD_COST[g]);
    for (const c of costs) expect(c).toBeGreaterThan(0);
    /* never falls: a later group may match its neighbour but not undercut it */
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThanOrEqual(costs[i - 1]);
  });
});

describe("the price ladder", () => {
  it("never dips as you go round", () => {
    const prices = BOARD.filter((s) => s.kind === "property").map((s) => s.deed!.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i], `plot ${i} is cheaper than the one before it`).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it("runs from BD 60,000 to BD 400,000", () => {
    const prices = BOARD.filter((s) => s.kind === "property").map((s) => s.deed!.price);
    expect(Math.min(...prices)).toBe(60_000);
    expect(Math.max(...prices)).toBe(400_000);
  });

  it("prices every crossing and station the same as its siblings", () => {
    const crossings = spacesInGroup("crossings").map((s) => s.deed!.price);
    expect(new Set(crossings).size).toBe(1);
    const ewa = spacesInGroup("ewa").map((s) => s.deed!.price);
    expect(new Set(ewa).size).toBe(1);
  });
});

describe("rent tables", () => {
  it("gives every plot six tiers — bare, four villas, tower", () => {
    for (const s of BOARD.filter((x) => x.kind === "property")) {
      expect(s.deed!.rent, `${s.name} has the wrong number of rent tiers`).toHaveLength(6);
    }
  });

  it("never falls as you develop", () => {
    for (const s of BOARD.filter((x) => x.kind === "property")) {
      const r = s.deed!.rent;
      for (let i = 1; i < r.length; i++) {
        expect(r[i], `${s.name} pays less at tier ${i} than at ${i - 1}`).toBeGreaterThan(r[i - 1]);
      }
    }
  });

  it("leaves crossings and stations without a table, since they compute rent", () => {
    for (const s of BOARD.filter((x) => x.kind === "crossing" || x.kind === "utility")) {
      expect(s.deed!.rent).toHaveLength(0);
      expect(s.deed!.buildCost).toBe(0);
    }
  });

  it("makes a bare tower worth more than a bare plot in a dearer group", () => {
    /* sanity on the shape of the economy: the cheapest group fully built
       should still beat the dearest group left bare, or there is no reason
       to ever develop the cheap end */
    const dilmun = spacesInGroup("dilmun")[1].deed!;
    const skyline = spacesInGroup("skyline")[1].deed!;
    expect(dilmun.rent[5]).toBeGreaterThan(skyline.rent[0]);
  });
});

describe("what is deliberately not on this board", () => {
  it("names no roundabout, and no security or government facility", () => {
    /* The Pearl/Lulu Roundabout was removed in 2011 and is politically
       loaded; ministries, bases and police stations are not somewhere this
       game goes. A landmark added later has to clear the same line. */
    const banned = /roundabout|lulu|pearl monument|ministry|police|barracks|base|prison|embassy/i;
    for (const s of BOARD) {
      expect(banned.test(s.name), `"${s.name}" is off-limits for this board`).toBe(false);
    }
  });
});

describe("group metadata", () => {
  it("labels and annotates every group the board actually uses", () => {
    const used = new Set(BOARD.map((s) => s.group).filter(Boolean) as string[]);
    expect(used.size).toBe(10); // eight colours + crossings + EWA
    for (const g of COLOUR_GROUPS) expect(BUILD_COST[g as ColourGroup]).toBeGreaterThan(0);
  });
});
