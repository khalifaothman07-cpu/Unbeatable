/* =========================================================================
   rules.ts — what a position on the board is worth, and what you may do
   -------------------------------------------------------------------------
   Pure. Nothing here reads or writes the store, nothing here knows a single
   landmark by name, and nothing here has a side effect. That is what lets
   four bots play ten thousand games in a test without a browser.

   THE ONE MODEL: a plot's development is a single number 0–5 — bare, one to
   four villas, then the tower. It indexes straight into the six-entry rent
   table, so "what is the rent here" never becomes a branch on whether a
   tower counts as five villas or as something else.
   ========================================================================= */

import {
  BANK_TOWERS, BANK_VILLAS, BOARD, CROSSING_RENT, EWA_MULTIPLIER,
  VILLAS_PER_TOWER, spacesInGroup,
} from "./board";
import type { Dinars } from "./money";
import { COLOUR_GROUPS, isOwnable, type ColourGroup, type Space } from "./types";

/** The tower level. Four villas plus one more build gets you here. */
export const TOWER = 5;

/* -------------------------------------------------------------------------
   ESTATE — who owns what, how developed it is, what is mortgaged.
   Keyed by board index throughout. Sparse on purpose: an absent key means
   "the bank still has it", which is the honest default.
   ------------------------------------------------------------------------- */
export interface Estate {
  owner: Record<number, number>;
  /** 0 bare … 4 villas … 5 tower. Absent means 0. */
  level: Record<number, number>;
  mortgaged: Record<number, boolean>;
}

export const emptyEstate = (): Estate => ({ owner: {}, level: {}, mortgaged: {} });

export const spaceAt = (index: number): Space => BOARD[index];
export const ownerOf = (e: Estate, index: number): number | null =>
  e.owner[index] === undefined ? null : e.owner[index];
export const levelOf = (e: Estate, index: number): number => e.level[index] ?? 0;
export const isMortgaged = (e: Estate, index: number): boolean => Boolean(e.mortgaged[index]);

/** Every board index a seat owns, in board order. */
export function holdings(e: Estate, seat: number): number[] {
  return Object.keys(e.owner)
    .map(Number)
    .filter((i) => e.owner[i] === seat)
    .sort((a, b) => a - b);
}

/** How many of a group a seat holds. */
export function ownedInGroup(e: Estate, seat: number, group: string): number {
  return spacesInGroup(group).filter((s) => e.owner[s.index] === seat).length;
}

/** Whether a seat holds every space in a group — the condition for building,
    and for the doubled rent on a bare plot. */
export function ownsWholeGroup(e: Estate, seat: number, group: string): boolean {
  const spaces = spacesInGroup(group);
  return spaces.length > 0 && spaces.every((s) => e.owner[s.index] === seat);
}

/* -------------------------------------------------------------------------
   RENT
   ------------------------------------------------------------------------- */

/** What the seat landing here owes the owner. Zero if nobody owns it, if it
    is mortgaged, or if they own it themselves. `roll` is the dice total, and
    is only consulted for EWA. */
export function rentFor(e: Estate, index: number, roll: number, lander: number): Dinars {
  const space = spaceAt(index);
  if (!isOwnable(space)) return 0;
  const owner = ownerOf(e, index);
  if (owner === null || owner === lander) return 0;
  /* A mortgaged plot collects nothing. That is the whole cost of mortgaging
     it, and forgetting it is the classic house-rule drift. */
  if (isMortgaged(e, index)) return 0;

  if (space.kind === "crossing") {
    const held = ownedInGroup(e, owner, "crossings");
    return CROSSING_RENT[Math.max(0, held - 1)] ?? 0;
  }

  if (space.kind === "utility") {
    const held = ownedInGroup(e, owner, "ewa");
    const mult = held >= 2 ? EWA_MULTIPLIER.both : EWA_MULTIPLIER.one;
    /* EWA bills by consumption, and the dice are the meter. Multiplied up to
       the board's scale so it sits alongside the other rents. */
    return roll * mult * 1000;
  }

  const level = levelOf(e, index);
  const table = space.deed!.rent;
  if (level > 0) return table[level];
  /* Bare plot, but the owner holds the whole group: double. Note this asks
     about the OWNER's holdings, not the lander's. */
  return ownsWholeGroup(e, owner, space.group!) ? table[0] * 2 : table[0];
}

/* -------------------------------------------------------------------------
   BUILDING — the even-build rule
   -------------------------------------------------------------------------
   Levels within a group may never differ by more than one. So you may build
   only on a plot already at the group's minimum, and sell only from one at
   the maximum. Stated that way it is one comparison rather than a table of
   cases, and it gives the tower step (4 → 5) the same treatment for free.
   ------------------------------------------------------------------------- */

export interface Verdict { ok: boolean; reason?: string }
const no = (reason: string): Verdict => ({ ok: false, reason });
const yes: Verdict = { ok: true };

/** Villas and towers currently standing, for bank stock and for repairs. */
export function buildingCounts(e: Estate, seat?: number): { villas: number; towers: number } {
  let villas = 0, towers = 0;
  for (const key of Object.keys(e.level)) {
    const i = Number(key);
    if (seat !== undefined && e.owner[i] !== seat) continue;
    const lvl = e.level[i];
    if (lvl === TOWER) towers += 1;
    else villas += lvl;
  }
  return { villas, towers };
}

export function canBuild(e: Estate, seat: number, index: number, cash: Dinars): Verdict {
  const space = spaceAt(index);
  if (space.kind !== "property") return no("Only a plot can be built on.");
  const group = space.group as ColourGroup;
  if (ownerOf(e, index) !== seat) return no("You don't own it.");
  if (!ownsWholeGroup(e, seat, group)) return no(`You need the whole ${group} group first.`);

  const spaces = spacesInGroup(group);
  /* One mortgaged plot freezes the whole group — you cannot develop a street
     you have already borrowed against. */
  if (spaces.some((s) => isMortgaged(e, s.index))) return no("Something in this group is mortgaged.");

  const level = levelOf(e, index);
  if (level >= TOWER) return no("There's already a tower here.");

  const min = Math.min(...spaces.map((s) => levelOf(e, s.index)));
  if (level > min) return no("Build evenly — the rest of the group is behind.");

  if (cash < space.deed!.buildCost) return no("Not enough cash.");

  const { villas, towers } = buildingCounts(e);
  if (level === VILLAS_PER_TOWER) {
    if (towers >= BANK_TOWERS) return no("The bank is out of towers.");
  } else if (villas >= BANK_VILLAS) {
    return no("The bank is out of villas.");
  }
  return yes;
}

export function canSellBuilding(e: Estate, seat: number, index: number): Verdict {
  const space = spaceAt(index);
  if (space.kind !== "property") return no("Nothing to sell here.");
  if (ownerOf(e, index) !== seat) return no("You don't own it.");
  const level = levelOf(e, index);
  if (level <= 0) return no("Nothing built here.");

  const spaces = spacesInGroup(space.group!);
  const max = Math.max(...spaces.map((s) => levelOf(e, s.index)));
  if (level < max) return no("Sell evenly — take the tallest down first.");

  /* Knocking a tower back to four villas needs four villas in stock. If the
     bank hasn't got them the sale is blocked, exactly as at a real table. */
  if (level === TOWER) {
    const { villas } = buildingCounts(e);
    if (villas + VILLAS_PER_TOWER > BANK_VILLAS) return no("The bank is out of villas to break the tower into.");
  }
  return yes;
}

/** Half of what you paid for the building. */
export const buildingRefund = (index: number): Dinars => Math.round(spaceAt(index).deed!.buildCost / 2);

/* -------------------------------------------------------------------------
   MORTGAGES
   ------------------------------------------------------------------------- */

export const mortgageValue = (index: number): Dinars => Math.round(spaceAt(index).deed!.price / 2);
/** Ten per cent interest on the way back out. */
export const unmortgageCost = (index: number): Dinars => Math.round(mortgageValue(index) * 1.1);

export function canMortgage(e: Estate, seat: number, index: number): Verdict {
  const space = spaceAt(index);
  if (!isOwnable(space)) return no("Nothing to mortgage.");
  if (ownerOf(e, index) !== seat) return no("You don't own it.");
  if (isMortgaged(e, index)) return no("Already mortgaged.");
  /* You must sell the buildings off a whole group before you can borrow
     against any of it. */
  if (space.kind === "property") {
    const built = spacesInGroup(space.group!).some((s) => levelOf(e, s.index) > 0);
    if (built) return no("Sell this group's buildings first.");
  }
  return yes;
}

export function canUnmortgage(e: Estate, seat: number, index: number, cash: Dinars): Verdict {
  if (ownerOf(e, index) !== seat) return no("You don't own it.");
  if (!isMortgaged(e, index)) return no("It isn't mortgaged.");
  if (cash < unmortgageCost(index)) return no("Not enough cash.");
  return yes;
}

/* -------------------------------------------------------------------------
   NET WORTH — the VAT percentage, the short-mode ranking, and what a bot
   values a trade against.
   Official accounting: cash, plus unmortgaged property at its printed
   price, plus mortgaged property at half, plus buildings at what they cost.
   ------------------------------------------------------------------------- */
export function netWorth(e: Estate, cash: Dinars, seat: number): Dinars {
  let total = cash;
  for (const index of holdings(e, seat)) {
    const space = spaceAt(index);
    const price = space.deed!.price;
    total += isMortgaged(e, index) ? Math.round(price / 2) : price;
    const level = levelOf(e, index);
    if (level > 0) {
      const each = space.deed!.buildCost;
      /* a tower cost five payments: four villas and the upgrade */
      total += (level === TOWER ? TOWER : level) * each;
    }
  }
  return total;
}

/** Everything a seat could raise right now without trading: cash, half back
    on every building, and mortgage value on everything unmortgaged. This is
    what decides whether a debt is survivable or bankrupts them. */
export function liquidatableTotal(e: Estate, cash: Dinars, seat: number): Dinars {
  let total = cash;
  for (const index of holdings(e, seat)) {
    const level = levelOf(e, index);
    if (level > 0) total += (level === TOWER ? TOWER : level) * buildingRefund(index);
    if (!isMortgaged(e, index)) total += mortgageValue(index);
  }
  return total;
}

/** Groups this seat holds outright — what the scoreboard should show, and
    the thing a bot is actually playing for. */
export function completeGroups(e: Estate, seat: number): ColourGroup[] {
  return COLOUR_GROUPS.filter((g) => ownsWholeGroup(e, seat, g));
}

/* -------------------------------------------------------------------------
   TRADING
   -------------------------------------------------------------------------
   Deeds and cash, both directions, in one offer. The thing that makes this
   hard is not the swap — it is that an offer is composed at one moment and
   accepted at another, and in between a 7 can empty somebody's wallet or a
   building can go up. So the offer is a DESCRIPTION, validated again at the
   instant it is accepted, and never a promise.
   ------------------------------------------------------------------------- */

export interface Trade {
  from: number;
  to: number;
  giveDeeds: number[];
  giveCash: Dinars;
  wantDeeds: number[];
  wantCash: Dinars;
}

export const emptyTrade = (from: number, to: number): Trade => ({
  from, to, giveDeeds: [], giveCash: 0, wantDeeds: [], wantCash: 0,
});

export const tradeIsEmpty = (t: Trade): boolean =>
  t.giveDeeds.length === 0 && t.wantDeeds.length === 0 && t.giveCash === 0 && t.wantCash === 0;

/** A deed can only change hands with nothing standing on its group. Selling
    the buildings first is the rule, and it stops a group being handed over
    mid-development where the even-build rule could never be satisfied. */
export function canTradeDeed(e: Estate, index: number): Verdict {
  const space = spaceAt(index);
  if (!isOwnable(space)) return no("Not something you can own.");
  if (space.kind === "property") {
    const built = spacesInGroup(space.group!).some((s) => levelOf(e, s.index) > 0);
    if (built) return no(`Sell the buildings on ${space.group} first.`);
  }
  return yes;
}

/** The whole offer, checked from scratch. Called when it is composed AND
    again when it is accepted — the second call is the one that matters. */
export function canTrade(
  e: Estate,
  cash: (seat: number) => Dinars,
  t: Trade,
): Verdict {
  if (t.from === t.to) return no("Pick somebody else.");
  if (tradeIsEmpty(t)) return no("There's nothing in the offer.");
  if (t.giveCash < 0 || t.wantCash < 0) return no("Cash can't be negative.");

  for (const i of t.giveDeeds) {
    if (ownerOf(e, i) !== t.from) return no(`${spaceAt(i).name} isn't theirs to give.`);
    const v = canTradeDeed(e, i);
    if (!v.ok) return v;
  }
  for (const i of t.wantDeeds) {
    if (ownerOf(e, i) !== t.to) return no(`${spaceAt(i).name} isn't theirs to give.`);
    const v = canTradeDeed(e, i);
    if (!v.ok) return v;
  }
  if (cash(t.from) < t.giveCash) return no("They haven't got that much cash.");
  if (cash(t.to) < t.wantCash) return no("The other side hasn't got that much cash.");
  return yes;
}

/** What the offer is worth to whoever is being asked, in plain dinars:
    positive means they come out ahead on paper. Buildings are impossible
    here — a group with anything built on it cannot be traded — so a deed is
    worth its printed price, halved if it arrives mortgaged. */
export function tradeBalance(e: Estate, t: Trade, forSeat: number): Dinars {
  const value = (i: number) => {
    const price = spaceAt(i).deed!.price;
    return isMortgaged(e, i) ? Math.round(price / 2) : price;
  };
  const incoming = t.from === forSeat
    ? t.wantDeeds.reduce((n, i) => n + value(i), 0) + t.wantCash
    : t.giveDeeds.reduce((n, i) => n + value(i), 0) + t.giveCash;
  const outgoing = t.from === forSeat
    ? t.giveDeeds.reduce((n, i) => n + value(i), 0) + t.giveCash
    : t.wantDeeds.reduce((n, i) => n + value(i), 0) + t.wantCash;
  return incoming - outgoing;
}
