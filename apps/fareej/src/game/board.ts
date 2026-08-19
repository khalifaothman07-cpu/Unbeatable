/* =========================================================================
   board.ts — the island, as data
   -------------------------------------------------------------------------
   SINGLE SOURCE OF TRUTH for content, the way kaz6-site/js/data.js is for
   the site. Every landmark name, price and rent figure is here and nowhere
   else. rules.ts and the store never mention Bahrain.

   THE LADDER runs in eight groups, cheapest to dearest, and the order is a
   story: Dilmun (four thousand years ago) → the Pearling Path (Muharraq
   when the island dived for a living) → the Forts → the Souqs → Culture →
   Sport → the Malls → the Skyline. Where you are on the board is where you
   are in the island's history.

   TWO THINGS STAY OFF THIS BOARD, deliberately:
     · the Pearl/Lulu Roundabout — removed in 2011 and politically loaded
     · any security, government or military facility
   Heritage, culture, sport, commerce and infrastructure only. If a landmark
   is ever added, hold it to the same line.

   PRICES are realistic Bahraini scale — BD 60,000 to BD 400,000 — stored as
   whole dinars via k(). Rent tables are the classic ratios at that scale,
   which is what makes the economy behave the way players expect.
   ========================================================================= */

import { k, type Dinars } from "./money";
import type { ColourGroup, Space } from "./types";

/** Collected for passing Bab Al Bahrain. */
export const SALARY: Dinars = k(200);
/** What each seat starts with. */
export const STARTING_CASH: Dinars = k(1500);
/** Bail, and the fine you may pay instead of using a card. */
export const BAIL: Dinars = k(50);

/** Villas per plot before it becomes a tower. */
export const VILLAS_PER_TOWER = 4;
/** The bank's stock. Running out is a real constraint in the classic game
    and it is what stops a runaway leader building everywhere at once. */
export const BANK_VILLAS = 32;
export const BANK_TOWERS = 12;

/** What one villa costs, per group. The tower costs the same again on top
    of the four villas it replaces. */
export const BUILD_COST: Record<ColourGroup, Dinars> = {
  dilmun: k(50), pearling: k(50),
  forts: k(100), souqs: k(100),
  culture: k(150), sport: k(150),
  malls: k(200), skyline: k(200),
};

/* Crossings pay by how many of the four you hold; EWA by the dice roll. */
export const CROSSING_RENT: Dinars[] = [k(25), k(50), k(100), k(200)];
export const EWA_MULTIPLIER = { one: 4, both: 10 } as const;

/** A colour-group deed in one line: price, the six rent tiers, build cost. */
const deed = (group: ColourGroup, price: number, rent: number[]) => ({
  price: k(price),
  rent: rent.map(k),
  buildCost: BUILD_COST[group],
});

export const BOARD: Space[] = [
  {
    index: 0, kind: "go", name: "Bab Al Bahrain", shortName: "BAB AL BAHRAIN",
    note: "The gate into old Manama. Pass through and collect your salary.",
  },
  {
    index: 1, kind: "property", name: "Barbar Temple", shortName: "Barbar",
    group: "dilmun", deed: deed("dilmun", 60, [2, 10, 30, 90, 160, 250]),
    note: "Three temples stacked on each other, built over a freshwater spring.",
  },
  { index: 2, kind: "sandooq", name: "Sandooq" },
  {
    index: 3, kind: "property", name: "A'ali Burial Mounds", shortName: "A'ali",
    group: "dilmun", deed: deed("dilmun", 60, [4, 20, 60, 180, 320, 450]),
    note: "Thousands of Dilmun tombs. People built their houses between them.",
  },
  {
    index: 4, kind: "tax", name: "VAT", shortName: "VAT",
    amount: k(200), percent: 10,
    note: "Ten per cent, since 2022. Pay the flat charge or the percentage.",
  },
  {
    index: 5, kind: "crossing", name: "King Fahd Causeway", shortName: "Causeway",
    group: "crossings", deed: { price: k(200), rent: [], buildCost: 0 },
    note: "Twenty-five kilometres to Saudi Arabia. The island's front door.",
  },
  {
    index: 6, kind: "property", name: "Sheikh Isa bin Ali House", shortName: "Sh. Isa House",
    group: "pearling", deed: deed("pearling", 100, [6, 30, 90, 270, 400, 550]),
    note: "Wind towers and gypsum. Cooled without a single machine.",
  },
  { index: 7, kind: "shamal", name: "Shamal" },
  {
    index: 8, kind: "property", name: "Siyadi House", shortName: "Siyadi",
    group: "pearling", deed: deed("pearling", 100, [6, 30, 90, 270, 400, 550]),
    note: "A pearl merchant's house, from when a good pearl bought a street.",
  },
  {
    index: 9, kind: "property", name: "Bu Maher Fort", shortName: "Bu Maher",
    group: "pearling", deed: deed("pearling", 120, [8, 40, 100, 300, 450, 600]),
    note: "Where the pearling boats left from. The Pearling Path starts here.",
  },
  {
    index: 10, kind: "causeway", name: "Stuck on the Causeway", shortName: "CAUSEWAY",
    note: "Border queue. Everyone else is just passing through.",
  },
  {
    index: 11, kind: "property", name: "Riffa Fort", shortName: "Riffa Fort",
    group: "forts", deed: deed("forts", 140, [10, 50, 150, 450, 625, 750]),
    note: "On the ridge above Hunanaiya valley, watching the whole approach.",
  },
  {
    index: 12, kind: "utility", name: "Al Dur Power & Water Station", shortName: "Al Dur",
    group: "ewa", deed: { price: k(150), rent: [], buildCost: 0 },
    note: "Power and desalination on the south-east coast.",
  },
  {
    index: 13, kind: "property", name: "Arad Fort", shortName: "Arad Fort",
    group: "forts", deed: deed("forts", 140, [10, 50, 150, 450, 625, 750]),
    note: "Squat, square and Omani-built, sat in shallow water off Muharraq.",
  },
  {
    index: 14, kind: "property", name: "Qal'at Al Bahrain", shortName: "Qal'at",
    group: "forts", deed: deed("forts", 160, [12, 60, 180, 500, 700, 900]),
    note: "The capital of Dilmun, then everyone since. Dug down through all of it.",
  },
  {
    index: 15, kind: "crossing", name: "Bahrain International Airport", shortName: "Airport",
    group: "crossings", deed: { price: k(200), rent: [], buildCost: 0 },
    note: "Muharraq. Everyone who isn't driving arrives here.",
  },
  {
    index: 16, kind: "property", name: "Manama Souq", shortName: "Manama Souq",
    group: "souqs", deed: deed("souqs", 180, [14, 70, 200, 550, 750, 950]),
    note: "Behind Bab Al Bahrain. Spice, cloth, and everything else.",
  },
  { index: 17, kind: "sandooq", name: "Sandooq" },
  {
    index: 18, kind: "property", name: "Muharraq Souq", shortName: "Muharraq Souq",
    group: "souqs", deed: deed("souqs", 180, [14, 70, 200, 550, 750, 950]),
    note: "Older, narrower, and still the place to eat at night.",
  },
  {
    index: 19, kind: "property", name: "Gold City", shortName: "Gold City",
    group: "souqs", deed: deed("souqs", 200, [16, 80, 220, 600, 800, 1000]),
    note: "Manama's gold souq. Sold by weight, argued over by the gram.",
  },
  {
    index: 20, kind: "gahwa", name: "Gahwa", shortName: "GAHWA",
    note: "Coffee, dates, and nobody asking you for anything.",
  },
  {
    index: 21, kind: "property", name: "Bahrain National Museum", shortName: "National Museum",
    group: "culture", deed: deed("culture", 220, [18, 90, 250, 700, 875, 1050]),
    note: "On the reclaimed shore, holding everything the island dug up.",
  },
  { index: 22, kind: "shamal", name: "Shamal" },
  {
    index: 23, kind: "property", name: "Beit Al Qur'an", shortName: "Beit Al Qur'an",
    group: "culture", deed: deed("culture", 220, [18, 90, 250, 700, 875, 1050]),
    note: "Manuscripts from everywhere, in a building shaped like the script.",
  },
  {
    index: 24, kind: "property", name: "Bahrain National Theatre", shortName: "National Theatre",
    group: "culture", deed: deed("culture", 240, [20, 100, 300, 750, 925, 1100]),
    note: "A thousand seats under a woven canopy, out over the lagoon.",
  },
  {
    index: 25, kind: "crossing", name: "Khalifa Bin Salman Port", shortName: "KBS Port",
    group: "crossings", deed: { price: k(200), rent: [], buildCost: 0 },
    note: "Hidd. Everything on a shelf in Bahrain came through here.",
  },
  {
    index: 26, kind: "property", name: "Bahrain National Stadium", shortName: "National Stadium",
    group: "sport", deed: deed("sport", 260, [22, 110, 330, 800, 975, 1150]),
    note: "Isa Town. Thirty thousand, and loud for every one of them.",
  },
  {
    index: 27, kind: "property", name: "Khalifa Sports City", shortName: "Sports City",
    group: "sport", deed: deed("sport", 260, [22, 110, 330, 800, 975, 1150]),
    note: "Isa Town again. Where the island trains.",
  },
  {
    index: 28, kind: "utility", name: "Hidd Power Station", shortName: "Hidd Power",
    group: "ewa", deed: { price: k(150), rent: [], buildCost: 0 },
    note: "The other half of the grid, and most of the drinking water.",
  },
  {
    index: 29, kind: "property", name: "Bahrain International Circuit", shortName: "The Circuit",
    group: "sport", deed: deed("sport", 280, [24, 120, 360, 850, 1025, 1200]),
    note: "Sakhir. Desert on every side, and one weekend the world watches.",
  },
  {
    index: 30, kind: "borderCheck", name: "Border Check", shortName: "BORDER CHECK",
    note: "Pulled over. Straight to the back of the Causeway queue.",
  },
  {
    index: 31, kind: "property", name: "Seef Mall", shortName: "Seef Mall",
    group: "malls", deed: deed("malls", 300, [26, 130, 390, 900, 1100, 1275]),
    note: "The original. A whole generation's Thursday night.",
  },
  {
    index: 32, kind: "property", name: "City Centre Bahrain", shortName: "City Centre",
    group: "malls", deed: deed("malls", 300, [26, 130, 390, 900, 1100, 1275]),
    note: "Seef. Big enough to have a water park inside it.",
  },
  { index: 33, kind: "sandooq", name: "Sandooq" },
  {
    index: 34, kind: "property", name: "The Avenues", shortName: "The Avenues",
    group: "malls", deed: deed("malls", 320, [28, 150, 450, 1000, 1200, 1400]),
    note: "Built along the water in Bahrain Bay, open to the sea breeze.",
  },
  {
    index: 35, kind: "crossing", name: "Bahrain Ferry Terminal", shortName: "Ferry Terminal",
    group: "crossings", deed: { price: k(200), rent: [], buildCost: 0 },
    note: "Out of Hidd, across to Qatar and back.",
  },
  { index: 36, kind: "shamal", name: "Shamal" },
  {
    index: 37, kind: "property", name: "Bahrain World Trade Center", shortName: "World Trade Ctr",
    group: "skyline", deed: deed("skyline", 350, [35, 175, 500, 1100, 1300, 1500]),
    note: "Twin sails with three wind turbines slung between them.",
  },
  {
    index: 38, kind: "tax", name: "Municipality Fee", shortName: "Muni Fee",
    amount: k(100),
    note: "Ten per cent of the rent, collected whether you like it or not.",
  },
  {
    index: 39, kind: "property", name: "Bahrain Financial Harbour", shortName: "Financial Harbour",
    group: "skyline", deed: deed("skyline", 400, [50, 200, 600, 1400, 1700, 2000]),
    note: "Two towers on reclaimed water. The most expensive address on the island.",
  },
];

/** Board positions, by the things rules.ts needs to jump to. */
export const GO_INDEX = 0;
export const CAUSEWAY_INDEX = 10;
export const LAP = BOARD.length;

/** Every space in a group, in board order. */
export function spacesInGroup(group: string): Space[] {
  return BOARD.filter((s) => s.group === group);
}

/** How many spaces make up a group — 2 or 3 for colours, 4 crossings, 2 EWA. */
export function groupSize(group: string): number {
  return spacesInGroup(group).length;
}
