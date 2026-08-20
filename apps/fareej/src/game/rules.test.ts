/* =========================================================================
   rules.test.ts — rent, building, mortgages, net worth
   -------------------------------------------------------------------------
   These are the rules people argue about at a real table, which is exactly
   why they are the ones an implementation gets subtly wrong: doubled rent on
   a bare monopoly, the even-build rule, whether a mortgaged plot still
   collects. All of it is silent when wrong.
   ========================================================================= */

import { describe, expect, it } from "vitest";
import { k } from "./money";
import { spacesInGroup } from "./board";
import {
  TOWER, buildingCounts, buildingRefund, canBuild, canMortgage, canSellBuilding,
  canUnmortgage, completeGroups, emptyEstate, holdings, liquidatableTotal,
  mortgageValue, netWorth, ownsWholeGroup, rentFor, unmortgageCost, type Estate,
} from "./rules";

/* Board indices used throughout, named so the tests read as rules. */
const BARBAR = 1, AALI = 3;                 // dilmun, the two-plot cheap group
const SH_ISA = 6, SIYADI = 8, BU_MAHER = 9; // pearling, a three-plot group
const CAUSEWAY_X = 5, AIRPORT = 15, PORT = 25, FERRY = 35;
const AL_DUR = 12, HIDD = 28;

/** An estate with the given indices owned by `seat`. */
function owned(seat: number, ...indices: number[]): Estate {
  const e = emptyEstate();
  for (const i of indices) e.owner[i] = seat;
  return e;
}

describe("rent on a plot", () => {
  it("is nothing when nobody owns it", () => {
    expect(rentFor(emptyEstate(), BARBAR, 7, 1)).toBe(0);
  });

  it("is nothing when you land on your own", () => {
    expect(rentFor(owned(0, BARBAR), BARBAR, 7, 0)).toBe(0);
  });

  it("is the bare rate when the owner holds only part of the group", () => {
    expect(rentFor(owned(0, BARBAR), BARBAR, 7, 1)).toBe(k(2));
  });

  it("DOUBLES on a bare plot once the owner holds the whole group", () => {
    const e = owned(0, BARBAR, AALI);
    expect(ownsWholeGroup(e, 0, "dilmun")).toBe(true);
    expect(rentFor(e, BARBAR, 7, 1)).toBe(k(4));
  });

  it("asks about the OWNER's group, not the lander's", () => {
    /* seat 0 holds the group; seat 1 landing must pay the doubled rate even
       though seat 1 owns nothing at all */
    const e = owned(0, BARBAR, AALI);
    expect(rentFor(e, AALI, 7, 1)).toBe(k(8)); // A'ali's bare rent is 4
  });

  it("climbs the table as villas go up, and tops out at the tower", () => {
    const e = owned(0, BARBAR, AALI);
    const tiers = [k(4) /* doubled bare */, k(10), k(30), k(90), k(160), k(250)];
    for (let level = 0; level <= TOWER; level++) {
      e.level[BARBAR] = level;
      expect(rentFor(e, BARBAR, 7, 1), `level ${level}`).toBe(tiers[level]);
    }
  });

  it("collects NOTHING while mortgaged, however developed", () => {
    const e = owned(0, BARBAR, AALI);
    e.level[BARBAR] = TOWER;
    e.mortgaged[BARBAR] = true;
    expect(rentFor(e, BARBAR, 7, 1)).toBe(0);
  });
});

describe("rent on the crossings", () => {
  it("rises with how many of the four the owner holds", () => {
    const rates = [k(25), k(50), k(100), k(200)];
    const all = [CAUSEWAY_X, AIRPORT, PORT, FERRY];
    for (let held = 1; held <= 4; held++) {
      const e = owned(0, ...all.slice(0, held));
      expect(rentFor(e, CAUSEWAY_X, 7, 1), `${held} held`).toBe(rates[held - 1]);
    }
  });

  it("counts only the owner's own crossings", () => {
    const e = owned(0, CAUSEWAY_X, AIRPORT);
    e.owner[PORT] = 1;
    e.owner[FERRY] = 1;
    expect(rentFor(e, CAUSEWAY_X, 7, 1)).toBe(k(50)); // seat 0 holds two
  });
});

describe("rent on EWA", () => {
  it("bills four times the roll on one station, ten times on both", () => {
    const one = owned(0, AL_DUR);
    expect(rentFor(one, AL_DUR, 9, 1)).toBe(9 * 4 * 1000);
    const both = owned(0, AL_DUR, HIDD);
    expect(rentFor(both, AL_DUR, 9, 1)).toBe(9 * 10 * 1000);
  });

  it("moves with the dice rather than being fixed", () => {
    const e = owned(0, AL_DUR);
    expect(rentFor(e, AL_DUR, 2, 1)).toBeLessThan(rentFor(e, AL_DUR, 12, 1));
  });
});

describe("the even-build rule", () => {
  const plenty = k(100_000);

  it("refuses to build without the whole group", () => {
    const e = owned(0, SH_ISA, SIYADI);
    expect(canBuild(e, 0, SH_ISA, plenty).ok).toBe(false);
  });

  it("allows a first villa anywhere once the group is complete", () => {
    const e = owned(0, SH_ISA, SIYADI, BU_MAHER);
    for (const i of [SH_ISA, SIYADI, BU_MAHER]) expect(canBuild(e, 0, i, plenty).ok).toBe(true);
  });

  it("refuses a second villa on a plot while a sibling is still bare", () => {
    const e = owned(0, SH_ISA, SIYADI, BU_MAHER);
    e.level[SH_ISA] = 1;
    expect(canBuild(e, 0, SH_ISA, plenty).ok).toBe(false);
    expect(canBuild(e, 0, SIYADI, plenty).ok).toBe(true);
  });

  it("lets the group climb one tier at a time all the way to towers", () => {
    const e = owned(0, SH_ISA, SIYADI, BU_MAHER);
    const group = [SH_ISA, SIYADI, BU_MAHER];
    for (let tier = 0; tier < TOWER; tier++) {
      for (const i of group) {
        expect(canBuild(e, 0, i, plenty).ok, `tier ${tier} on ${i}`).toBe(true);
        e.level[i] = tier + 1;
      }
    }
    expect(group.every((i) => e.level[i] === TOWER)).toBe(true);
    expect(canBuild(e, 0, SH_ISA, plenty).ok).toBe(false); // nothing above a tower
  });

  it("refuses to build on a group with anything mortgaged in it", () => {
    const e = owned(0, SH_ISA, SIYADI, BU_MAHER);
    e.mortgaged[BU_MAHER] = true;
    expect(canBuild(e, 0, SH_ISA, plenty).ok).toBe(false);
  });

  it("refuses when the cash isn't there", () => {
    const e = owned(0, SH_ISA, SIYADI, BU_MAHER);
    expect(canBuild(e, 0, SH_ISA, k(10)).ok).toBe(false);
  });

  it("stops when the bank runs out of villas", () => {
    const e = owned(0, SH_ISA, SIYADI, BU_MAHER);
    /* park 32 villas elsewhere on the board — the bank's whole stock */
    for (let i = 0; i < 8; i++) e.level[100 + i] = 4;
    for (let i = 0; i < 8; i++) e.owner[100 + i] = 1;
    expect(buildingCounts(e).villas).toBe(32);
    expect(canBuild(e, 0, SH_ISA, plenty).ok).toBe(false);
  });

  it("sells evenly too — the tallest comes down first", () => {
    const e = owned(0, SH_ISA, SIYADI, BU_MAHER);
    e.level[SH_ISA] = 2; e.level[SIYADI] = 1; e.level[BU_MAHER] = 1;
    expect(canSellBuilding(e, 0, SIYADI).ok).toBe(false);
    expect(canSellBuilding(e, 0, SH_ISA).ok).toBe(true);
  });

  it("refunds half of what a building cost", () => {
    expect(buildingRefund(SH_ISA)).toBe(k(25)); // pearling villas cost 50k
  });
});

describe("mortgages", () => {
  it("pays half the printed price", () => {
    expect(mortgageValue(BARBAR)).toBe(k(30));
  });

  it("costs ten per cent more to clear than it paid", () => {
    expect(unmortgageCost(BARBAR)).toBe(k(33));
  });

  it("refuses while the group still has buildings on it", () => {
    const e = owned(0, SH_ISA, SIYADI, BU_MAHER);
    e.level[SIYADI] = 1;
    expect(canMortgage(e, 0, SH_ISA).ok).toBe(false);
    delete e.level[SIYADI];
    expect(canMortgage(e, 0, SH_ISA).ok).toBe(true);
  });

  it("refuses to clear a mortgage you can't afford", () => {
    const e = owned(0, BARBAR);
    e.mortgaged[BARBAR] = true;
    expect(canUnmortgage(e, 0, BARBAR, k(10)).ok).toBe(false);
    expect(canUnmortgage(e, 0, BARBAR, k(33)).ok).toBe(true);
  });

  it("won't mortgage the same thing twice", () => {
    const e = owned(0, BARBAR);
    e.mortgaged[BARBAR] = true;
    expect(canMortgage(e, 0, BARBAR).ok).toBe(false);
  });
});

describe("net worth", () => {
  it("is cash alone when you own nothing", () => {
    expect(netWorth(emptyEstate(), k(1500), 0)).toBe(k(1500));
  });

  it("counts unmortgaged property at its printed price", () => {
    expect(netWorth(owned(0, BARBAR), k(1000), 0)).toBe(k(1060));
  });

  it("counts mortgaged property at half", () => {
    const e = owned(0, BARBAR);
    e.mortgaged[BARBAR] = true;
    expect(netWorth(e, k(1000), 0)).toBe(k(1030));
  });

  it("counts buildings at what they cost, tower as five", () => {
    const e = owned(0, SH_ISA, SIYADI, BU_MAHER);
    e.level[SH_ISA] = TOWER;
    /* three plots at 100+100+120, plus five 50k builds */
    expect(netWorth(e, 0, 0)).toBe(k(320) + k(250));
  });

  it("ignores other seats' holdings", () => {
    const e = owned(0, BARBAR);
    e.owner[AALI] = 1;
    expect(netWorth(e, 0, 0)).toBe(k(60));
    expect(netWorth(e, 0, 1)).toBe(k(60));
  });
});

describe("what a seat can raise before going under", () => {
  it("counts cash, half back on buildings, and mortgage value on the rest", () => {
    const e = owned(0, SH_ISA, SIYADI, BU_MAHER);
    e.level[SH_ISA] = 2;
    /* 2 villas at 25k back, plus half of 100+100+120 */
    expect(liquidatableTotal(e, k(100), 0)).toBe(k(100) + k(50) + k(160));
  });

  it("doesn't count mortgage value on something already mortgaged", () => {
    const e = owned(0, BARBAR);
    e.mortgaged[BARBAR] = true;
    expect(liquidatableTotal(e, k(100), 0)).toBe(k(100));
  });
});

describe("holdings and complete groups", () => {
  it("lists what a seat owns in board order", () => {
    expect(holdings(owned(0, BU_MAHER, BARBAR, SIYADI), 0)).toEqual([BARBAR, SIYADI, BU_MAHER]);
  });

  it("reports only the groups held outright", () => {
    const e = owned(0, BARBAR, AALI, SH_ISA);
    expect(completeGroups(e, 0)).toEqual(["dilmun"]);
    for (const s of spacesInGroup("pearling")) e.owner[s.index] = 0;
    expect(completeGroups(e, 0)).toEqual(["dilmun", "pearling"]);
  });
});
