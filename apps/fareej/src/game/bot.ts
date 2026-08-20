/* =========================================================================
   bot.ts — a seat played by the machine
   -------------------------------------------------------------------------
   PURE, and React-free on purpose: decide() takes a game state and returns
   one action. That is what lets four bots play ten thousand games in a test
   without a browser, which is the single most valuable test in the suite —
   it is what catches a phase that can never be left.

   WHAT THIS BOT IS HONESTLY GOOD AT: the deterministic half. Buying on a
   valuation, bidding up to it and no further, building under the even-build
   rule, mortgaging when short, and folding when the arithmetic says it is
   over. It plays those properly.

   TRADING, AND WHY IT HAD TO EXIST. The plan for this file said bots would
   answer offers but never make them. Self-play proved that unshippable: with
   nobody proposing, groups never complete, so nothing is ever built, so
   rents stay smaller than the salary and NO GAME EVER ENDS. Twenty seeds,
   eleven of them still going at 60,000 moves with every seat rich and not a
   single villa on the board.

   So a bot proposes exactly two deals — the two a person makes without
   thinking. A mutual swap, where each side hands over the deed that
   completes the other's group; and buying the one deed it still needs, at
   triple the ticket. It does not counter-offer, it does not haggle, and it
   tries once a turn. That is a long way short of a person, and it is enough
   for a table to reach an ending.
   ========================================================================= */

import { BAIL, CROSSING_RENT, spacesInGroup } from "./board";
import type { Dinars } from "./money";
import {
  buildingRefund, canBuild, canMortgage, canSellBuilding, canTrade, holdings,
  isMortgaged, levelOf, liquidatableTotal, mortgageValue, ownedInGroup, ownerOf,
  ownsWholeGroup, spaceAt, tradeBalance, type Estate, type Trade,
} from "./rules";
import type { GameState } from "../state/store";
import { COLOUR_GROUPS, type ColourGroup } from "./types";

export type BotAction =
  | { kind: "roll" }
  | { kind: "acknowledge" }
  | { kind: "buy" }
  | { kind: "declineBuy" }
  | { kind: "bid"; amount: Dinars }
  | { kind: "foldBid" }
  | { kind: "build"; index: number }
  | { kind: "sellBuilding"; index: number }
  | { kind: "mortgage"; index: number }
  | { kind: "unmortgage"; index: number }
  | { kind: "payBail" }
  | { kind: "usePass" }
  | { kind: "settleDebt" }
  | { kind: "declareBankrupt" }
  | { kind: "propose"; trade: Trade }
  | { kind: "acceptTrade" }
  | { kind: "declineTrade" }
  | { kind: "endTurn" };

/** How much a bot likes to keep in hand for the next rent bill it lands on.
    Roughly one mid-board tower's rent — enough that a single unlucky
    landing does not immediately mean mortgaging the estate. */
const RESERVE: Dinars = 150_000;

/** Bids climb in this step. Small enough to be competitive, big enough that
    an auction between four bots cannot crawl. */
const BID_STEP: Dinars = 25_000;

/* -------------------------------------------------------------------------
   WHO THE TABLE IS WAITING ON
   Not always the seat whose turn it is: an auction rotates, a debt belongs
   to the debtor, and an offer is answered by the seat it was made to.
   ------------------------------------------------------------------------- */
export function pendingSeat(s: GameState): number | null {
  if (s.phase === "over" || s.phase === "lobby") return null;
  if (s.auction) return s.auction.live[s.auction.turn] ?? null;
  if (s.trade) return s.trade.to;
  if (s.debt) return s.debt.seat;
  return s.current;
}

/* -------------------------------------------------------------------------
   VALUATION
   What a space is worth to THIS seat, which is not the same as its price.
   The whole game is groups, so anything that completes one is worth a large
   multiple, and anything that denies one to somebody else is worth holding.
   ------------------------------------------------------------------------- */
export function valueOf(e: Estate, seat: number, index: number): Dinars {
  const space = spaceAt(index);
  const price = space.deed!.price;

  if (space.kind === "crossing") {
    const held = ownedInGroup(e, seat, "crossings");
    /* the fourth crossing is worth far more than the first: rent doubles
       at every step, so the last one bought is the one that pays */
    return Math.round(price * (1 + held * 0.55));
  }
  if (space.kind === "utility") {
    const held = ownedInGroup(e, seat, "ewa");
    return Math.round(price * (held === 1 ? 1.6 : 0.85));
  }

  const group = space.group as ColourGroup;
  const size = spacesInGroup(group).length;
  const held = ownedInGroup(e, seat, group);

  /* completing a group is the only thing in this game that multiplies rent,
     so it is worth well over the printed price */
  if (held === size - 1) return Math.round(price * 2.6);
  if (held > 0) return Math.round(price * 1.5);

  /* An untouched group is worth more than one somebody already has a piece
     of. Both stay at or above the printed price, though: in a property game
     the deed you did not buy is the one that beats you, and a multiplier
     that lands a hair under 1.0 produces a bot that declines everything on
     an empty board and then wonders why it owns nothing. */
  const contested = spacesInGroup(group).some((sp) => {
    const o = ownerOf(e, sp.index);
    return o !== null && o !== seat;
  });
  return Math.round(price * (contested ? 1.0 : 1.2));
}

/** Every group a seat can hold outright, colours plus the two that behave
    differently — four crossings is as much of a prize as three plots. */
const ALL_GROUPS: string[] = [...COLOUR_GROUPS, "crossings", "ewa"];

/** The estate as it would be once an offer went through. */
function afterTrade(e: Estate, t: Trade): Estate {
  const owner = { ...e.owner };
  for (const i of t.giveDeeds) owner[i] = t.to;
  for (const i of t.wantDeeds) owner[i] = t.from;
  return { ...e, owner };
}

/** Does this seat come out of the swap holding a group it did not hold
    going in? Asked of the RESULT rather than of a single deed, because a
    two-plot group split one-one is the case where looking at one deed lies:
    each side needs the other's card, and simply exchanging them leaves the
    group exactly as split as it was. Two bots did that to each other for
    seven hundred laps. */
function gainsGroup(before: Estate, after: Estate, seat: number): boolean {
  return ALL_GROUPS.some((g) => !ownsWholeGroup(before, seat, g) && ownsWholeGroup(after, seat, g));
}

/** Would buying this deed off the board complete a group? */
function completesByBuying(e: Estate, seat: number, index: number): boolean {
  const after: Estate = { ...e, owner: { ...e.owner, [index]: seat } };
  return gainsGroup(e, after, seat);
}

/* -------------------------------------------------------------------------
   RAISING MONEY
   The order matters and is not a preference: buildings first, because they
   sell back at half and are the only thing that can be un-sold by rebuilding;
   mortgages second, because they cost 10% to undo; and only then is it over.
   ------------------------------------------------------------------------- */
function raiseCash(s: GameState, seat: number): BotAction | null {
  const e = s.estate;
  const mine = holdings(e, seat);

  /* sell the tallest building anywhere — canSellBuilding enforces evenness */
  let best: { index: number; level: number } | null = null;
  for (const i of mine) {
    const level = levelOf(e, i);
    if (level > 0 && canSellBuilding(e, seat, i).ok && (!best || level > best.level)) {
      best = { index: i, level };
    }
  }
  if (best) return { kind: "sellBuilding", index: best.index };

  /* then mortgage, cheapest first — hold the expensive deeds as long as
     possible, since those are the ones that win the game later */
  const mortgageable = mine
    .filter((i) => canMortgage(e, seat, i).ok)
    .sort((a, b) => mortgageValue(a) - mortgageValue(b));
  if (mortgageable.length) return { kind: "mortgage", index: mortgageable[0] };

  return null;
}

/* -------------------------------------------------------------------------
   THE DECISION
   ------------------------------------------------------------------------- */
export function decide(s: GameState, seat: number): BotAction | null {
  if (pendingSeat(s) !== seat) return null;
  const me = s.players[seat];
  if (me.bankrupt) return null;

  /* ---- a card is face up ---- */
  if (s.drawn) return { kind: "acknowledge" };

  /* ---- somebody has offered us a deal ---- */
  if (s.trade && s.trade.to === seat) {
    const t = s.trade;
    const balance = tradeBalance(s.estate, t, seat);
    const after = afterTrade(s.estate, t);
    const gifting = gainsGroup(s.estate, after, t.from);
    const gaining = gainsGroup(s.estate, after, seat);
    if (gifting && !gaining) {
      /* Handing over the deed that completes somebody else's group is the
         whole game in one card, so it takes a price that is obviously worth
         it: everything asked for, plus twice its value again. Refusing at
         ANY price is what turns four bots into a stalemate. */
      const asked = t.wantDeeds.reduce((n, i) => n + spaceAt(i).deed!.price, 0);
      return balance >= asked * 2 ? { kind: "acceptTrade" } : { kind: "declineTrade" };
    }
    return balance > 0 || gaining ? { kind: "acceptTrade" } : { kind: "declineTrade" };
  }

  /* ---- in debt: raise it, settle it, or fold ---- */
  if (s.phase === "debt" && s.debt && s.debt.seat === seat) {
    const owed = s.debt.amount;
    if (me.cash >= owed) return { kind: "settleDebt" };
    if (liquidatableTotal(s.estate, me.cash, seat) < owed) return { kind: "declareBankrupt" };
    const raise = raiseCash(s, seat);
    /* nothing left to sell but the arithmetic said it was survivable — the
       only honest move left is to fold rather than spin */
    return raise ?? { kind: "declareBankrupt" };
  }

  /* ---- bidding ---- */
  if (s.phase === "auction" && s.auction) {
    const a = s.auction;
    const worth = valueOf(s.estate, seat, a.index);
    const next = a.bid + BID_STEP;
    if (a.leader === seat) return { kind: "foldBid" }; // never bid against yourself
    if (next <= Math.min(worth, me.cash)) return { kind: "bid", amount: next };
    return { kind: "foldBid" };
  }

  /* ---- an unowned space we have landed on ---- */
  if (s.phase === "buy" && s.offer !== null) {
    const index = s.offer;
    const price = spaceAt(index).deed!.price;
    if (me.cash < price) return { kind: "declineBuy" };
    const worth = valueOf(s.estate, seat, index);
    const completes = completesByBuying(s.estate, seat, index);
    /* the reserve is a comfort, not a rule: a deed that completes a group is
       worth going short for */
    if (completes || me.cash - price >= RESERVE) {
      return worth >= price ? { kind: "buy" } : { kind: "declineBuy" };
    }
    return { kind: "declineBuy" };
  }

  /* ---- rolling ---- */
  if (s.phase === "roll") {
    if (me.stuck > 0) {
      /* a held pass costs nothing; bail costs money for the privilege of
         landing on somebody's tower, so only pay it once the board is
         still quiet enough to be worth walking around */
      if (me.passes.length > 0) return { kind: "usePass" };
      const built = Object.keys(s.estate.level).length;
      if (built === 0 && me.cash > RESERVE + BAIL) return { kind: "payBail" };
    }
    return { kind: "roll" };
  }

  /* ---- building, then out ---- */
  if (s.phase === "manage") {
    /* one attempt at a deal per turn — re-proposing a swap that was just
       declined is an infinite loop with extra steps */
    if (s.offersMade === 0) {
      const deal = proposeDeal(s, seat);
      if (deal) return { kind: "propose", trade: deal };
    }

    /* clear a mortgage only when comfortable — the 10% is real */
    const heldMortgages = holdings(s.estate, seat).filter((i) => isMortgaged(s.estate, i));
    for (const i of heldMortgages) {
      const cost = Math.round(mortgageValue(i) * 1.1);
      if (me.cash - cost >= RESERVE * 3) return { kind: "unmortgage", index: i };
    }

    const build = bestBuild(s, seat);
    if (build !== null) return { kind: "build", index: build };

    return { kind: "endTurn" };
  }

  /* resolve and any other transient phase: nudge it along */
  return { kind: "acknowledge" };
}

/* -------------------------------------------------------------------------
   PROPOSING
   Two deals, both of them the obvious one a person would make.
   ------------------------------------------------------------------------- */

/** Groups this seat is exactly one deed short of, with who holds it. */
function oneAway(e: Estate, seat: number): { index: number; owner: number }[] {
  const out: { index: number; owner: number }[] = [];
  for (const group of COLOUR_GROUPS) {
    const spaces = spacesInGroup(group);
    const missing = spaces.filter((sp) => ownerOf(e, sp.index) !== seat);
    if (missing.length !== 1) continue;
    const owner = ownerOf(e, missing[0].index);
    /* still with the bank means buy it on the board, not across the table */
    if (owner === null || owner === seat) continue;
    out.push({ index: missing[0].index, owner });
  }
  return out;
}

export function proposeDeal(s: GameState, seat: number): Trade | null {
  const e = s.estate;
  const me = s.players[seat];
  const wants = oneAway(e, seat);
  if (!wants.length) return null;
  const cash = (x: number) => s.players[x].cash;
  const price = (i: number) => spaceAt(i).deed!.price;

  /* 1. THE MUTUAL SWAP. Each side hands over the deed that completes the
        other's group. It is the trade that actually gets made at a table,
        and it is the only one both bots will agree to on the merits. */
  for (const want of wants) {
    if (s.players[want.owner].bankrupt) continue;
    for (const theirs of oneAway(e, want.owner)) {
      if (ownerOf(e, theirs.index) !== seat) continue;
      const gap = price(want.index) - price(theirs.index);
      const trade: Trade = {
        from: seat, to: want.owner,
        giveDeeds: [theirs.index], giveCash: gap > 0 ? Math.min(gap, cash(seat)) : 0,
        wantDeeds: [want.index], wantCash: gap < 0 ? Math.min(-gap, cash(want.owner)) : 0,
      };
      /* both sides must actually END UP with a group. Without this the two
         halves of a split two-plot group trade their single deed back and
         forth every turn, forever, each time "completing" nothing. */
      const after = afterTrade(e, trade);
      if (!gainsGroup(e, after, seat) || !gainsGroup(e, after, want.owner)) continue;
      if (canTrade(e, cash, trade).ok) return trade;
    }
  }

  /* 2. BUY IT. Triple the ticket, which is the threshold the accept rule
        above will actually clear. Cheapest missing deed first, so a short
        wallet still gets a deal done. */
  const affordable = wants
    .filter((w) => !s.players[w.owner].bankrupt)
    .sort((a, b) => price(a.index) - price(b.index));
  for (const want of affordable) {
    const offer = price(want.index) * 3;
    /* the reserve is a comfort, and a completed group is worth being
       uncomfortable for — but not worth being unable to pay the offer */
    if (offer > me.cash) continue;
    const trade: Trade = {
      from: seat, to: want.owner,
      giveDeeds: [], giveCash: offer, wantDeeds: [want.index], wantCash: 0,
    };
    if (!gainsGroup(e, afterTrade(e, trade), seat)) continue;
    if (canTrade(e, cash, trade).ok) return trade;
  }
  return null;
}

/** Where the next villa should go: the completed group with the steepest
    jump in rent for the money, and within it the plot the even-build rule
    actually allows. Returns null when nothing is worth building. */
export function bestBuild(s: GameState, seat: number): number | null {
  const me = s.players[seat];
  let best: { index: number; gain: number } | null = null;

  for (const group of COLOUR_GROUPS) {
    if (!ownsWholeGroup(s.estate, seat, group)) continue;
    for (const space of spacesInGroup(group)) {
      const i = space.index;
      if (!canBuild(s.estate, seat, i, me.cash).ok) continue;
      const cost = space.deed!.buildCost;
      if (me.cash - cost < RESERVE) continue;
      const level = levelOf(s.estate, i);
      const rents = space.deed!.rent;
      /* what this one build actually adds, per dinar spent */
      const gain = (rents[level + 1] - (level === 0 ? rents[0] * 2 : rents[level])) / cost;
      if (!best || gain > best.gain) best = { index: i, gain };
    }
  }
  return best ? best.index : null;
}

/** Crossings are the one group whose value is pure arithmetic, so it is
    worth being able to state it — used by the tests to pin the valuation. */
export const crossingRentAt = (held: number): Dinars => CROSSING_RENT[Math.max(0, held - 1)] ?? 0;

/** Sell-back value, re-exported so a caller reasoning about a bot's options
    does not have to reach into rules.ts as well. */
export { buildingRefund };
