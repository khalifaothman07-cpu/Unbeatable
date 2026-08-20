/* =========================================================================
   rename.test.ts — a real name on a seat, and only where it is safe
   -------------------------------------------------------------------------
   Putting the signed-in player's name on their chair is cosmetic, which is
   exactly why it needs pinning: a cosmetic write that lands mid-game is
   still a write. Names travel inside the synced snapshot, so a rename
   during somebody's turn bumps the room's revision and makes a label change
   race a real move — a bug that would surface as a move silently vanishing,
   with nothing in the log connecting it to a rename.

   The guard is "lobby only". These tests assert the negative, because the
   failure is silent everywhere else.
   ========================================================================= */

import { beforeEach, describe, expect, it } from "vitest";
import { useGame } from "./store";

/* The default labels differ between the two games this file is shared by —
   LU'LU'A seats are "Seat 1..4", FAREEJ names players after their piece.
   Reading the defaults back rather than spelling them out keeps one copy of
   the test honest in both, and stops it failing for a renamed default when
   what it is actually guarding is the lobby-only rule. */
let DEFAULTS: string[] = [];

const reset = () => {
  useGame.getState().newGame();
  DEFAULTS = useGame.getState().players.map((p) => p.name);
};

describe("renameSeat", () => {
  beforeEach(reset);

  it("names a seat in the lobby", () => {
    useGame.getState().renameSeat(1, "Sara");
    expect(useGame.getState().players[1].name).toBe("Sara");
  });

  it("leaves the other seats alone", () => {
    useGame.getState().renameSeat(2, "Khalifa");
    const names = useGame.getState().players.map((p) => p.name);
    expect(names).toEqual([DEFAULTS[0], DEFAULTS[1], "Khalifa", DEFAULTS[3]]);
  });

  it("REFUSES once the game has started", () => {
    useGame.getState().startGame();
    expect(useGame.getState().started).toBe(true);
    useGame.getState().renameSeat(0, "Sara");
    expect(useGame.getState().players[0].name).toBe(DEFAULTS[0]);
  });

  it("ignores an empty or blank name rather than clearing the label", () => {
    useGame.getState().renameSeat(0, "   ");
    expect(useGame.getState().players[0].name).toBe(DEFAULTS[0]);
  });

  it("trims and caps the length, so a seat banner can't be blown open", () => {
    useGame.getState().renameSeat(0, "   Bartholomew Fitzgerald III   ");
    const name = useGame.getState().players[0].name;
    expect(name).toBe("Bartholomew Fi");
    expect(name.length).toBeLessThanOrEqual(14);
  });

  it("ignores a seat index that isn't a seat", () => {
    expect(() => useGame.getState().renameSeat(9, "Nobody")).not.toThrow();
    expect(useGame.getState().players).toHaveLength(4);
  });

  it("is a no-op when the name already matches, so it can be called freely", () => {
    useGame.getState().renameSeat(1, "Sara");
    const before = useGame.getState().players;
    useGame.getState().renameSeat(1, "Sara");
    /* identity, not equality: the effect that drives this re-runs whenever
       seats change, and a fresh array each time would republish the
       snapshot for no reason */
    expect(useGame.getState().players).toBe(before);
  });
});
