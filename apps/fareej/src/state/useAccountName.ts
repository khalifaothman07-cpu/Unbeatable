/* =========================================================================
   useAccountName.ts — your name on your seat
   -------------------------------------------------------------------------
   This is the whole reason anybody would bother signing in. Tracking works
   without an account; a name on a chair is what an account BUYS. "Waiting
   for Sara…" is a game. "Waiting for Seat 3…" is a form.

   Which seat gets the name is the same question the board already answers
   for what is clickable, so it uses the same rule:

     - joined somebody else's table on your own phone → your seat
     - hosting, and this device plays exactly one chair → that chair
     - hosting several chairs on a shared phone → NONE of them, because
       "Khalifa" on one of four seats you are all passing around is a lie
       about who is playing

   Lobby only. Once the game starts the seat labels are part of a live
   snapshot and a cosmetic write has no business touching it.
   ========================================================================= */

import { useEffect } from "react";
import { account, signedInName } from "./account";
import { playableSeat, useGame } from "./store";

export function useAccountName(): void {
  const started = useGame((s) => s.started);
  const mySeat = useGame((s) => s.mySeat);
  const seats = useGame((s) => s.seats);
  const roomCode = useGame((s) => s.roomCode);

  /* Loading the client is also what records the visit, so it must happen on
     every mount — including one that lands straight into a game already in
     progress, where the rename effect below returns early. An earlier
     version only loaded it on the lobby path, which quietly stopped
     counting anyone who reloaded mid-game. */
  useEffect(() => { void account(); }, []);

  useEffect(() => {
    if (started) return;
    let cancelled = false;

    void (async () => {
      const name = await signedInName();
      if (cancelled || !name) return;

      const s = useGame.getState();
      if (s.started) return;

      let seat: number | null = null;
      if (s.mySeat !== null && s.mySeat >= 0) {
        seat = s.mySeat;
      } else {
        const own = s.seats.map((_x, i) => i).filter((i) => playableSeat(s, i));
        if (own.length === 1) seat = own[0];
      }
      if (seat !== null) s.renameSeat(seat, name);
    })();

    return () => { cancelled = true; };
    /* seats/roomCode are in the list because taking or opening a chair
       changes which one this device plays, and the name should follow it */
  }, [started, mySeat, seats, roomCode]);
}
