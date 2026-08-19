/* =========================================================================
   useBot.ts — the driver that lets bot seats take their turn
   -------------------------------------------------------------------------
   All the judgement is in game/bot.ts, which is pure. This file does one
   thing: notice that the table is waiting on a bot, wait a beat so a human
   can see what happened, and apply one action.

   ONE ACTION AT A TIME, not a whole turn in a loop. A bot that resolved its
   entire turn inside a single tick would flash six state changes past a
   player in one frame, and any bug in the decision function would be an
   infinite loop rather than a stuck turn.
   ========================================================================= */

import { useEffect, useRef } from "react";
import { applyBotAction, useGame } from "./store";
import { decide, pendingSeat } from "../game/bot";

/** Long enough to read, short enough not to feel like waiting. */
const THINK_MS = 620;
/** Acknowledging a card or folding a bid needs no deliberation. */
const QUICK_MS = 240;
/** A hard ceiling per mount. If the decision function ever loops, the table
    stops rather than pinning the phone's CPU. */
const BUDGET = 4000;

export function useBot() {
  const spent = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const s = useGame.getState();
      if (!s.started || s.phase === "over" || s.phase === "lobby") return;

      const seat = pendingSeat(s);
      if (seat === null) return;
      if (s.seats[seat]?.type !== "bot") return;
      if (spent.current++ > BUDGET) {
        console.warn("[bot] budget spent — stopping so the table doesn't spin");
        return;
      }

      const action = decide(s, seat);
      if (!action) return;

      const quick = action.kind === "acknowledge" || action.kind === "foldBid"
        || action.kind === "bid" || action.kind === "declineTrade";
      timer = setTimeout(() => {
        /* Clearing the handle FIRST matters. It is also the gate the store
           subscription below uses to decide whether a chain is already
           running — leave it set and the chain stops the moment a human's
           turn interrupts it, and no bot ever moves again. */
        timer = null;
        if (stopped) return;
        applyBotAction(useGame.getState(), action);
        tick();
      }, quick ? QUICK_MS : THINK_MS);
    };

    /* run once now, and again on every state change — subscribing rather
       than depending on the whole store keeps this out of React's render
       path, where a setTimeout chain would be restarted constantly */
    tick();
    const unsub = useGame.subscribe(() => { if (!timer) tick(); });

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);
}
