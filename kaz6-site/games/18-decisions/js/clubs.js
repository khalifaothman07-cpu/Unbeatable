/* =========================================================================
   clubs.js  —  THE 14-CLUB BAG
   -------------------------------------------------------------------------
   carry  : stock carry in yards at full (1.0) power, off a clean lie
   disp   : 1-sigma offline dispersion in yards at full power (skill spread)
   roll   : typical run-out on a firm landing, yards
   A standard 14: driver, 3 woods/hybrid, irons 4-9, three wedges, putter.
   ========================================================================= */
const CLUBS = [
  { id: "D",  name: "Driver",        carry: 290, disp: 22,  roll: 18 },
  { id: "3W", name: "3 Wood",        carry: 255, disp: 18,  roll: 14 },
  { id: "5W", name: "5 Wood",        carry: 232, disp: 16,  roll: 11 },
  { id: "3H", name: "3 Hybrid",      carry: 215, disp: 14,  roll: 9  },
  { id: "4I", name: "4 Iron",        carry: 200, disp: 13,  roll: 8  },
  { id: "5I", name: "5 Iron",        carry: 188, disp: 12,  roll: 7  },
  { id: "6I", name: "6 Iron",        carry: 175, disp: 11,  roll: 6  },
  { id: "7I", name: "7 Iron",        carry: 162, disp: 10,  roll: 5  },
  { id: "8I", name: "8 Iron",        carry: 150, disp: 9,   roll: 4  },
  { id: "9I", name: "9 Iron",        carry: 137, disp: 8,   roll: 3  },
  { id: "PW", name: "Pitching Wedge", carry: 123, disp: 6.5, roll: 3 },
  { id: "GW", name: "Gap Wedge",     carry: 108, disp: 5.5, roll: 2  },
  { id: "SW", name: "Sand Wedge",    carry: 92,  disp: 4.5, roll: 2  },
  { id: "PT", name: "Putter",        carry: 0,   disp: 0,   roll: 0, putter: true },
];
const CLUB_BY_ID = Object.fromEntries(CLUBS.map((c) => [c.id, c]));

(function (root) { root.CLUBS = CLUBS; root.CLUB_BY_ID = CLUB_BY_ID; })(typeof window !== "undefined" ? window : globalThis);
if (typeof module !== "undefined" && module.exports) module.exports = { CLUBS, CLUB_BY_ID };
