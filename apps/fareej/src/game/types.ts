/* =========================================================================
   types.ts — the shape of the board and everything standing on it
   -------------------------------------------------------------------------
   The board is DATA. Nothing in rules.ts or the store knows the name of a
   single Bahraini landmark; they know a space has a group, a price and a
   rent table. Swapping the whole island out is a change to board.ts alone.
   ========================================================================= */

import type { Dinars } from "./money";

/* -------------------------------------------------------------------------
   GROUPS
   The eight colour groups, plus the two that behave differently: Crossings
   (rent by how many you hold) and EWA (rent by the dice). Keeping them in
   the same union means "which group is this?" is one question, not three.
   ------------------------------------------------------------------------- */
export type ColourGroup =
  | "dilmun" | "pearling" | "forts" | "souqs"
  | "culture" | "sport" | "malls" | "skyline";

export type Group = ColourGroup | "crossings" | "ewa";

export const COLOUR_GROUPS: ColourGroup[] = [
  "dilmun", "pearling", "forts", "souqs", "culture", "sport", "malls", "skyline",
];

export const GROUP_LABEL: Record<Group, string> = {
  dilmun: "Dilmun",
  pearling: "The Pearling Path",
  forts: "The Forts",
  souqs: "The Souqs",
  culture: "Culture",
  sport: "Sport",
  malls: "The Malls",
  skyline: "The Skyline",
  crossings: "Crossings",
  ewa: "EWA",
};

/** What the eight groups are FOR, in one line each — shown on the deed so a
    player who has never been to Bahrain still knows what they just bought. */
export const GROUP_NOTE: Record<Group, string> = {
  dilmun: "Four thousand years of it, out in the desert.",
  pearling: "Muharraq, back when the island dived for a living.",
  forts: "What was built when the island was worth taking.",
  souqs: "Where the island still does its trading.",
  culture: "What Bahrain keeps, and what it puts on.",
  sport: "Where the island shows up loudest.",
  malls: "Modern Bahrain's actual town square.",
  skyline: "The towers you can see from the Causeway.",
  crossings: "Every way on and off the island.",
  ewa: "Power and water. Nobody gets to opt out.",
};

/* -------------------------------------------------------------------------
   SPACES
   ------------------------------------------------------------------------- */
export type SpaceKind =
  | "go" | "property" | "crossing" | "utility"
  | "shamal" | "sandooq" | "tax" | "causeway" | "gahwa" | "borderCheck";

/** A space you can own. Rent is a full six-entry table for colour groups —
    bare, then one to four villas, then a tower — and empty for the two
    groups that compute rent instead of looking it up. */
export interface Deed {
  /** what it costs from the bank, and what a mortgage pays back at half */
  price: Dinars;
  /** [bare, 1 villa, 2, 3, 4, tower] — colour groups only */
  rent: Dinars[];
  /** cost of one villa, and of the tower that replaces four of them */
  buildCost: Dinars;
}

export interface Space {
  /** position on the lap, 0–39. Also the id — there is exactly one of each. */
  index: number;
  kind: SpaceKind;
  name: string;
  /** the short form for a board space too narrow for the full name */
  shortName?: string;
  group?: Group;
  deed?: Deed;
  /** flavour, one line, shown on the deed and when you land */
  note?: string;
  /** tax spaces only: the flat charge */
  amount?: Dinars;
  /** VAT only: the alternative percentage of net worth */
  percent?: number;
}

export const OWNABLE: SpaceKind[] = ["property", "crossing", "utility"];
export const isOwnable = (s: Space): boolean => OWNABLE.includes(s.kind);

/* -------------------------------------------------------------------------
   CARDS
   ------------------------------------------------------------------------- */
export type Deck = "shamal" | "sandooq";

export type CardEffect =
  /** move to a named space; collect salary if you pass Bab Al Bahrain */
  | { kind: "goTo"; index: number; collectSalary?: boolean }
  /** forward or back this many spaces, no salary either way */
  | { kind: "step"; spaces: number }
  | { kind: "collect"; amount: Dinars }
  | { kind: "pay"; amount: Dinars }
  /** pay every other solvent player this much each */
  | { kind: "payEach"; amount: Dinars }
  /** collect this much from every other player */
  | { kind: "collectEach"; amount: Dinars }
  /** repairs: per villa and per tower across everything you own */
  | { kind: "repairs"; perVilla: Dinars; perTower: Dinars }
  | { kind: "toCauseway" }
  | { kind: "getOutFree" };

export interface Card {
  /** stable across shuffles, so a snapshot can name the card it is holding */
  id: string;
  deck: Deck;
  text: string;
  effect: CardEffect;
}
