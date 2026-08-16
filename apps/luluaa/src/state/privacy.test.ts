/* =========================================================================
   privacy.test.ts — whose cards a device may show, and who may trade
   -------------------------------------------------------------------------
   Both of the rules under test failed silently in playtesting, which is why
   they're pinned here rather than left to the live suite:

     * a host watching a remote player's turn was offered a "tap to reveal"
       for that player's hand — the leak the privacy screen exists to stop,
       reintroduced by the online path
     * a player on their own phone could never open the trade composer,
       because it asked whether the privacy screen had been LIFTED rather
       than whether it was UP, and on a personal device it never goes up.
       From the table that looked like the host being the only person
       allowed to trade

   Neither shows up as an error. Both need a test that asserts the negative.
   ========================================================================= */

import { describe, expect, it } from "vitest";
import { handHidden, ownDevice, visibleSeat, type GameState, type Seat, type SeatType } from "./store";

const seats = (...types: SeatType[]): Seat[] => types.map((type) => ({ type, code: null }));

/** The union of what the two functions read, so one fixture serves both. */
type View = Pick<GameState,
  "roomCode" | "mySeat" | "seats" | "phase" | "setupOrder" | "setupIndex" | "current" | "toggles" | "handRevealed">;

/** The slice of state both functions read. Everything is main-phase and
    mid-turn, because that is when a hand is worth hiding. */
function table(over: Partial<{
  roomCode: string | null; mySeat: number | null; seats: Seat[];
  current: number; handRevealed: boolean; privacyScreen: boolean;
  phase: "setup" | "main" | "over";
}> = {}): View {
  const {
    roomCode = null, mySeat = null, seats: st = seats("local", "local", "local", "local"),
    current = 0, handRevealed = false, privacyScreen = true, phase = "main",
  } = over;
  return {
    roomCode, mySeat, seats: st, current, handRevealed, phase,
    setupOrder: [0, 1, 2, 3, 3, 2, 1, 0], setupIndex: 0,
    toggles: { gentleShamal: true, calmTides: false, privacyScreen },
  };
}

describe("whose hand a device may show", () => {
  it("shows the active seat when every seat is on this device", () => {
    for (const current of [0, 1, 2, 3]) {
      expect(visibleSeat(table({ current }))).toBe(current);
    }
  });

  it("shows only your own seat on a phone that joined, whoever is playing", () => {
    for (const current of [0, 1, 2, 3]) {
      const s = table({ roomCode: "PASK3", mySeat: 2, seats: seats("local", "remote", "remote", "remote"), current });
      expect(ownDevice(s)).toBe(true);
      expect(visibleSeat(s)).toBe(2);
    }
  });

  it("shows NOBODY's hand when the turn belongs to another device", () => {
    /* the host kept seats 1 and 2, gave 3 and 4 away. Seat 3 is up: that
       hand is not this device's to offer, not even behind a reveal button */
    const s = table({
      roomCode: "PASK3", mySeat: -1,
      seats: seats("local", "local", "remote", "remote"),
      current: 2,
    });
    expect(visibleSeat(s)).toBeNull();
  });

  it("never shows a bot's hand, online or off", () => {
    const online = table({
      roomCode: "PASK3", mySeat: -1,
      seats: seats("local", "local", "bot", "remote"), current: 2,
    });
    expect(visibleSeat(online)).toBeNull();

    /* and a purely local game with a bot in it leaks the same way if this
       falls through to the active seat */
    const offline = table({ seats: seats("local", "bot", "local", "local"), current: 1 });
    expect(visibleSeat(offline)).toBeNull();
  });

  it("falls back to the host's own seat when they only kept one", () => {
    /* one seat here, three online: while the others play there is exactly
       one hand this device may show, and it's the hand its owner wants */
    const s = table({
      roomCode: "PASK3", mySeat: -1,
      seats: seats("local", "remote", "remote", "remote"), current: 1,
    });
    expect(visibleSeat(s)).toBe(0);
  });
});

describe("the privacy screen", () => {
  it("stays down on a device that plays one seat — there is nobody to hide from", () => {
    /* your own phone */
    expect(handHidden(table({ roomCode: "PASK3", mySeat: 2, seats: seats("local", "remote", "remote", "remote") })))
      .toBe(false);
    /* the host, having kept a single seat */
    expect(handHidden(table({
      roomCode: "PASK3", mySeat: -1, seats: seats("local", "remote", "remote", "remote"),
    }))).toBe(false);
    /* bots don't count as somebody to hide from either */
    expect(handHidden(table({
      roomCode: "PASK3", mySeat: -1, seats: seats("local", "bot", "bot", "remote"),
    }))).toBe(false);
  });

  it("comes up when one device really is being passed around", () => {
    expect(handHidden(table())).toBe(true);
    expect(handHidden(table({ roomCode: "PASK3", mySeat: -1, seats: seats("local", "local", "remote", "remote") })))
      .toBe(true);
  });

  it("lifts once revealed, and never covers setup or the final score", () => {
    expect(handHidden(table({ handRevealed: true }))).toBe(false);
    expect(handHidden(table({ phase: "setup" }))).toBe(false);
    expect(handHidden(table({ phase: "over" }))).toBe(false);
    expect(handHidden(table({ privacyScreen: false }))).toBe(false);
  });
});
