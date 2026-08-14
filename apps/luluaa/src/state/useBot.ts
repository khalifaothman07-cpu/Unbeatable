/* =========================================================================
   useBot.ts — the hand that moves the bot's pieces
   -------------------------------------------------------------------------
   Watches the table and, when a bot seat owes an action, waits a beat and
   plays it. One action per tick: every action changes the state, which
   re-runs this effect, which asks the bot again. That loop ends when the
   bot says "end turn", because the turn then belongs to somebody else.

   Two rules keep it from misbehaving:

   ONLY THE HOST RUNS BOTS. drivesSeat() already says so — bots are driven
   by the device holding the table. If a joined phone also ran them, both
   devices would publish the same move and one would be thrown away.

   NEVER LOOP SILENTLY. If a decision doesn't change the state — an action
   the store refuses for a reason the bot didn't foresee — the effect won't
   re-run and the bot would sit forever. A budget per turn catches that and
   ends the turn rather than freezing the game for everyone else.
   ========================================================================= */

import { useEffect, useRef } from "react";
import { applyBotAction, decide, pendingSeat } from "../game/bot";
import { drivesSeat, legalShamalTiles, useGame } from "./store";

/** Long enough to read as a decision, short enough not to be a wait. */
const THINK_MS = 620;
const QUICK_MS = 260;   // dice, discards — mechanical, not deliberative
/** Actions one seat may take in a single turn before we call it stuck. */
const BUDGET = 40;

export function useBot() {
  const s = useGame();
  /* budget is per (seat, turn); a fresh turn always gets a fresh allowance */
  const spent = useRef({ key: "", n: 0 });

  useEffect(() => {
    if (s.phase === "over") return;

    /* A bot may owe an answer to someone else's trade offer even when it is
       not its turn, so look for that before falling back to whose turn it
       is. */
    const answering = s.phase === "main" && s.offer
      ? s.players.find((p) =>
          s.seats[p.id]?.type === "bot" &&
          p.id !== s.offer!.from &&
          !s.offer!.declined.includes(p.id) &&
          drivesSeat(s, p.id))?.id ?? null
      : null;

    const seat = answering ?? pendingSeat(s);
    if (seat === null) return;
    if (s.seats[seat]?.type !== "bot") return;
    if (!drivesSeat(s, seat)) return;

    const key = `${seat}:${s.turnNo}:${s.phase === "setup" ? s.setupIndex : "x"}`;
    if (spent.current.key !== key) spent.current = { key, n: 0 };
    if (spent.current.n >= BUDGET) {
      /* Something the bot wanted wasn't allowed and it stopped making
         progress. Bail out of the turn instead of hanging the table. */
      if (s.phase === "main") s.endTurn();
      return;
    }

    const action = decide(s, seat, () => legalShamalTiles(s));
    if (!action) return;

    const quick = action.kind === "roll" || action.kind === "discard" || action.kind === "answerOffer";
    const id = window.setTimeout(() => {
      spent.current.n += 1;
      applyBotAction(s, action);
    }, quick ? QUICK_MS : THINK_MS);

    return () => window.clearTimeout(id);
  }, [s]);
}
