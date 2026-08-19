/* =========================================================================
   cards.test.ts
   -------------------------------------------------------------------------
   Card ids travel inside a snapshot between two phones, and a "go to space
   19" that points at a deck square instead of Gold City is the kind of bug
   that only shows up when someone happens to draw it mid-game.
   ========================================================================= */

import { describe, expect, it } from "vitest";
import { ALL_CARDS, SANDOOQ_CARDS, SHAMAL_CARDS, cardById, cardsFor } from "./cards";
import { BOARD, LAP } from "./board";
import { isOwnable } from "./types";

describe("the decks", () => {
  it("are sixteen cards each", () => {
    expect(SHAMAL_CARDS).toHaveLength(16);
    expect(SANDOOQ_CARDS).toHaveLength(16);
  });

  it("tag every card with the deck it belongs to", () => {
    for (const c of SHAMAL_CARDS) expect(c.deck).toBe("shamal");
    for (const c of SANDOOQ_CARDS) expect(c.deck).toBe("sandooq");
  });

  it("are reachable by name", () => {
    expect(cardsFor("shamal")).toBe(SHAMAL_CARDS);
    expect(cardsFor("sandooq")).toBe(SANDOOQ_CARDS);
  });
});

describe("card ids", () => {
  it("are unique across both decks", () => {
    const ids = ALL_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("look each other up, because a snapshot names a card by id", () => {
    for (const c of ALL_CARDS) expect(cardById(c.id)).toBe(c);
    expect(cardById("nope")).toBeUndefined();
  });
});

describe("card text", () => {
  it("says something on every card", () => {
    for (const c of ALL_CARDS) expect(c.text.trim().length, c.id).toBeGreaterThan(10);
  });

  it("never repeats itself", () => {
    const texts = ALL_CARDS.map((c) => c.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe("movement cards point somewhere real", () => {
  it("sends you only to spaces that exist", () => {
    for (const c of ALL_CARDS) {
      if (c.effect.kind !== "goTo") continue;
      expect(c.effect.index, c.id).toBeGreaterThanOrEqual(0);
      expect(c.effect.index, c.id).toBeLessThan(LAP);
    }
  });

  it("never sends you to a deck square, which would draw again forever", () => {
    for (const c of ALL_CARDS) {
      if (c.effect.kind !== "goTo") continue;
      const target = BOARD[c.effect.index];
      expect(["shamal", "sandooq"], `${c.id} targets ${target.name}`).not.toContain(target.kind);
    }
  });

  it("names the landmark it sends you to, so the card and the board agree", () => {
    for (const c of ALL_CARDS) {
      if (c.effect.kind !== "goTo") continue;
      const target = BOARD[c.effect.index];
      const first = target.name.split(" ")[0];
      expect(c.text, `${c.id} doesn't mention ${target.name}`).toContain(first);
    }
  });

  it("steps by a small number of spaces, forwards or back", () => {
    for (const c of ALL_CARDS) {
      if (c.effect.kind !== "step") continue;
      expect(Math.abs(c.effect.spaces), c.id).toBeLessThanOrEqual(5);
      expect(c.effect.spaces, c.id).not.toBe(0);
    }
  });
});

describe("the shape of each deck", () => {
  it("gives each deck exactly one keep-until-needed card", () => {
    for (const deck of [SHAMAL_CARDS, SANDOOQ_CARDS]) {
      expect(deck.filter((c) => c.effect.kind === "getOutFree")).toHaveLength(1);
    }
  });

  it("gives each deck a way to send you to the Causeway", () => {
    for (const deck of [SHAMAL_CARDS, SANDOOQ_CARDS]) {
      expect(deck.filter((c) => c.effect.kind === "toCauseway").length).toBeGreaterThanOrEqual(1);
    }
  });

  it("leans SHAMAL toward movement and SANDOOQ toward cash", () => {
    const moves = (d: typeof SHAMAL_CARDS) =>
      d.filter((c) => ["goTo", "step", "toCauseway"].includes(c.effect.kind)).length;
    const cash = (d: typeof SHAMAL_CARDS) =>
      d.filter((c) => ["collect", "pay", "payEach", "collectEach"].includes(c.effect.kind)).length;
    expect(moves(SHAMAL_CARDS)).toBeGreaterThan(moves(SANDOOQ_CARDS));
    expect(cash(SANDOOQ_CARDS)).toBeGreaterThan(cash(SHAMAL_CARDS));
  });

  it("keeps every amount positive — the sign is the effect's job, not the number's", () => {
    for (const c of ALL_CARDS) {
      const e = c.effect;
      if ("amount" in e) expect(e.amount, c.id).toBeGreaterThan(0);
      if (e.kind === "repairs") {
        expect(e.perVilla, c.id).toBeGreaterThan(0);
        expect(e.perTower, c.id).toBeGreaterThan(e.perVilla);
      }
    }
  });

  it("balances roughly — neither deck is a pure tax nor a pure gift", () => {
    for (const deck of [SHAMAL_CARDS, SANDOOQ_CARDS]) {
      const good = deck.filter((c) => ["collect", "collectEach", "getOutFree"].includes(c.effect.kind)).length;
      const bad = deck.filter((c) => ["pay", "payEach", "repairs", "toCauseway"].includes(c.effect.kind)).length;
      expect(good).toBeGreaterThan(0);
      expect(bad).toBeGreaterThan(0);
      expect(Math.abs(good - bad)).toBeLessThanOrEqual(4);
    }
  });
});

describe("cards line up with the board", () => {
  it("only sends you to landmarks you could actually buy, or to Bab Al Bahrain", () => {
    for (const c of ALL_CARDS) {
      if (c.effect.kind !== "goTo") continue;
      const target = BOARD[c.effect.index];
      expect(isOwnable(target) || target.kind === "go", `${c.id} → ${target.name}`).toBe(true);
    }
  });
});
