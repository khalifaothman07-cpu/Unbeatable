/* =========================================================================
   money.test.ts
   -------------------------------------------------------------------------
   The whole reason this module exists is that two parts of a screen must
   never disagree about what a number is. So the tests are mostly about the
   boundaries where a rounding choice could make them differ.
   ========================================================================= */

import { describe, expect, it } from "vitest";
import { bare, full, k, short } from "./money";

describe("k()", () => {
  it("stores whole dinars, not thousands", () => {
    expect(k(60)).toBe(60_000);
    expect(k(1500)).toBe(1_500_000);
    expect(k(0)).toBe(0);
  });
});

describe("short(), for board spaces and buttons", () => {
  it("writes thousands and millions", () => {
    expect(short(60_000)).toBe("60k");
    expect(short(1_500_000)).toBe("1.5M");
  });

  it("drops a trailing zero rather than writing 2.0M", () => {
    expect(short(2_000_000)).toBe("2M");
    expect(short(200_000)).toBe("200k");
  });

  it("keeps one decimal where it carries information", () => {
    expect(short(1_250_000)).toBe("1.3M");
    expect(short(62_500)).toBe("62.5k");
  });

  it("leaves small change alone", () => {
    expect(short(0)).toBe("0");
    expect(short(999)).toBe("999");
  });

  it("marks a negative with a real minus sign, not a hyphen", () => {
    expect(short(-150_000)).toBe("−150k");
  });

  it("switches units exactly at the boundary", () => {
    expect(short(999_999)).toBe("1000k");
    expect(short(1_000_000)).toBe("1M");
  });
});

describe("full(), for deeds and the wallet", () => {
  it("groups the digits and leads with the currency", () => {
    expect(full(1_500_000)).toBe("BD 1,500,000");
    expect(full(60_000)).toBe("BD 60,000");
    expect(full(0)).toBe("BD 0");
  });

  it("puts the minus outside the currency mark", () => {
    expect(full(-60_000)).toBe("−BD 60,000");
  });
});

describe("bare(), for tables that head their own column", () => {
  it("groups without repeating the currency on every row", () => {
    expect(bare(1_500_000)).toBe("1,500,000");
    expect(bare(-250)).toBe("−250");
  });
});

describe("the two forms never contradict each other", () => {
  it("rounds to the same underlying figure", () => {
    /* short() is allowed to lose precision; it must never round to a
       different order of magnitude than full() reports */
    for (const n of [60_000, 1_500_000, 999_999, 1_000_000, 2_000_000, 33_000]) {
      const digits = bare(n).replace(/,/g, "").length;
      const unit = short(n).endsWith("M") ? 7 : short(n).endsWith("k") ? 4 : 1;
      expect(digits).toBeGreaterThanOrEqual(unit);
    }
  });
});
