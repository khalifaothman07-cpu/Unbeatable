/* =========================================================================
   cards.ts — the SHAMAL and SANDOOQ decks
   -------------------------------------------------------------------------
   SHAMAL is the wind: it arrives from somewhere else and moves you, usually
   whether you wanted to go or not. Most of its cards are movement.

   SANDOOQ is the chest the neighbourhood keeps: money in, money out, and
   the occasional bill everyone shares. Most of its cards are cash.

   Card ids are STABLE and never renumbered. A snapshot travelling between
   two phones names the card a player is holding by id — renumber these and
   an in-progress game starts handing people the wrong card back.

   Every effect is declarative. Nothing here executes anything; rules.ts
   reads the effect and the store applies it, so a card can be tested
   without a game running.
   ========================================================================= */

import { k } from "./money";
import type { Card } from "./types";

/* Board indices the cards jump to, named rather than numbered inline —
   a bare 39 in a card is unreadable and breaks silently if the board
   ever moves. */
const BAB_AL_BAHRAIN = 0;
const AIRPORT = 15;
const GOLD_CITY = 19;
const NATIONAL_THEATRE = 24;
const CIRCUIT = 29;
const FINANCIAL_HARBOUR = 39;

export const SHAMAL_CARDS: Card[] = [
  {
    id: "sh-01", deck: "shamal",
    text: "The wind drops. Drive straight through to Bab Al Bahrain and collect your salary.",
    effect: { kind: "goTo", index: BAB_AL_BAHRAIN, collectSalary: true },
  },
  {
    id: "sh-02", deck: "shamal",
    text: "Race weekend. Take the highway to Bahrain International Circuit.",
    effect: { kind: "goTo", index: CIRCUIT, collectSalary: true },
  },
  {
    id: "sh-03", deck: "shamal",
    text: "Dust closes the runway. Make your way to Bahrain International Airport.",
    effect: { kind: "goTo", index: AIRPORT, collectSalary: true },
  },
  {
    id: "sh-04", deck: "shamal",
    text: "Gold prices spike. Get down to Gold City.",
    effect: { kind: "goTo", index: GOLD_CITY, collectSalary: true },
  },
  {
    id: "sh-05", deck: "shamal",
    text: "Opening night. Advance to the Bahrain National Theatre.",
    effect: { kind: "goTo", index: NATIONAL_THEATRE, collectSalary: true },
  },
  {
    id: "sh-06", deck: "shamal",
    text: "The wind carries you all the way to Bahrain Financial Harbour.",
    effect: { kind: "goTo", index: FINANCIAL_HARBOUR, collectSalary: true },
  },
  {
    id: "sh-07", deck: "shamal",
    text: "Pulled over at the border. Go to the Causeway queue.",
    effect: { kind: "toCauseway" },
  },
  {
    id: "sh-08", deck: "shamal",
    text: "You talk your way through. Keep this card until you need it.",
    effect: { kind: "getOutFree" },
  },
  {
    id: "sh-09", deck: "shamal",
    text: "Sand everywhere. Back up three spaces.",
    effect: { kind: "step", spaces: -3 },
  },
  {
    id: "sh-10", deck: "shamal",
    text: "Clear road behind the storm. Move forward three spaces.",
    effect: { kind: "step", spaces: 3 },
  },
  {
    id: "sh-11", deck: "shamal",
    text: "Grit in every window frame. Pay BD 25,000 a villa and BD 100,000 a tower.",
    effect: { kind: "repairs", perVilla: k(25), perTower: k(100) },
  },
  {
    id: "sh-12", deck: "shamal",
    text: "Your shipment lands early. Collect BD 150,000.",
    effect: { kind: "collect", amount: k(150) },
  },
  {
    id: "sh-13", deck: "shamal",
    text: "Flights grounded, deal missed. Pay BD 150,000.",
    effect: { kind: "pay", amount: k(150) },
  },
  {
    id: "sh-14", deck: "shamal",
    text: "You had the only generator on the street. Collect BD 50,000 from every player.",
    effect: { kind: "collectEach", amount: k(50) },
  },
  {
    id: "sh-15", deck: "shamal",
    text: "You left the majlis windows open. Pay every player BD 50,000.",
    effect: { kind: "payEach", amount: k(50) },
  },
  {
    id: "sh-16", deck: "shamal",
    text: "Fined for a hoarding blown into the road. Pay BD 100,000.",
    effect: { kind: "pay", amount: k(100) },
  },
];

export const SANDOOQ_CARDS: Card[] = [
  {
    id: "sq-01", deck: "sandooq",
    text: "The fareej clubs together for you. Collect BD 200,000.",
    effect: { kind: "collect", amount: k(200) },
  },
  {
    id: "sq-02", deck: "sandooq",
    text: "Your share of the pearl sale comes through. Collect BD 100,000.",
    effect: { kind: "collect", amount: k(100) },
  },
  {
    id: "sq-03", deck: "sandooq",
    text: "Rent refund from the municipality. Collect BD 75,000.",
    effect: { kind: "collect", amount: k(75) },
  },
  {
    id: "sq-04", deck: "sandooq",
    text: "A cheque you had forgotten about clears. Collect BD 50,000.",
    effect: { kind: "collect", amount: k(50) },
  },
  {
    id: "sq-05", deck: "sandooq",
    text: "Sale of a plot in Hidd. Collect BD 250,000.",
    effect: { kind: "collect", amount: k(250) },
  },
  {
    id: "sq-06", deck: "sandooq",
    text: "EWA bill, and it is worse than last quarter. Pay BD 100,000.",
    effect: { kind: "pay", amount: k(100) },
  },
  {
    id: "sq-07", deck: "sandooq",
    text: "School fees, all at once. Pay BD 150,000.",
    effect: { kind: "pay", amount: k(150) },
  },
  {
    id: "sq-08", deck: "sandooq",
    text: "The whole street is invited and you are hosting. Pay BD 50,000.",
    effect: { kind: "pay", amount: k(50) },
  },
  {
    id: "sq-09", deck: "sandooq",
    text: "Everyone chips in for your wedding. Collect BD 50,000 from every player.",
    effect: { kind: "collectEach", amount: k(50) },
  },
  {
    id: "sq-10", deck: "sandooq",
    text: "You owe the whole fareej a dinner. Pay every player BD 50,000.",
    effect: { kind: "payEach", amount: k(50) },
  },
  {
    id: "sq-11", deck: "sandooq",
    text: "Maintenance falls due. Pay BD 40,000 a villa and BD 115,000 a tower.",
    effect: { kind: "repairs", perVilla: k(40), perTower: k(115) },
  },
  {
    id: "sq-12", deck: "sandooq",
    text: "The neighbours vouch for you. Keep this card until you need it.",
    effect: { kind: "getOutFree" },
  },
  {
    id: "sq-13", deck: "sandooq",
    text: "Caught on the wrong side of a checkpoint. Go to the Causeway queue.",
    effect: { kind: "toCauseway" },
  },
  {
    id: "sq-14", deck: "sandooq",
    text: "Go back to Bab Al Bahrain and collect your salary.",
    effect: { kind: "goTo", index: BAB_AL_BAHRAIN, collectSalary: true },
  },
  {
    id: "sq-15", deck: "sandooq",
    text: "Insurance pays out on the old warehouse. Collect BD 125,000.",
    effect: { kind: "collect", amount: k(125) },
  },
  {
    id: "sq-16", deck: "sandooq",
    text: "A late assessment on last year's income. Pay BD 75,000.",
    effect: { kind: "pay", amount: k(75) },
  },
];

export const ALL_CARDS: Card[] = [...SHAMAL_CARDS, ...SANDOOQ_CARDS];

export function cardsFor(deck: "shamal" | "sandooq"): Card[] {
  return deck === "shamal" ? SHAMAL_CARDS : SANDOOQ_CARDS;
}

const BY_ID = new Map(ALL_CARDS.map((c) => [c.id, c]));
/** Look a card up by the id a snapshot carried. */
export function cardById(id: string): Card | undefined {
  return BY_ID.get(id);
}

export const DECK_LABEL = { shamal: "Shamal", sandooq: "Sandooq" } as const;
export const DECK_NOTE = {
  shamal: "The wind brings something. It rarely asks first.",
  sandooq: "The neighbourhood chest. Money in, money out.",
} as const;
