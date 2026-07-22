/* =========================================================================
   data.js  —  IAM GOLF · SINGLE SOURCE OF TRUTH
   -------------------------------------------------------------------------
   A KAZ6 commerce studio. Premium pre-owned golf clubs, sourced in Kuala
   Lumpur, delivered across the Gulf. Pre-launch: this site sells the brand,
   not stock. No prices, no inventory counts until the business is live.
   Edit content ONLY here — never in render.js or index.html.
   ========================================================================= */

/* ▓▓▓ AGENT HANDOFF — READ FIRST. NOT RENDERED. ▓▓▓
   CANON: full monochrome; KAZ6 parent brand; IAM GOLF = commerce studio sibling
   to The Unbeatables (games). Master handoff block lives in kaz6-site/js/data.js.
   PENDING (this site): brand-text only, NO real brand logos (nominative-use risk);
   footer disclaimer is load-bearing — keep it. studioUrl is a relative path —
   swap for live KAZ6 URL when deployed as a separate Netlify site. */

const IAM = {
  brand: "IAM GOLF",
  parent: "A KAZ6 studio",
  statement: "I AM",
  tagline:
    "Premium pre-owned golf clubs — hand-picked in Kuala Lumpur, delivered across the Gulf. Mint condition, trusted brands, and a luxury unboxing nobody else in this market offers.",
  status: "Launching 2026",

  /* --- The trusted brands (what gets sourced) ------------------------ */
  brands: ["TaylorMade", "Titleist", "Callaway", "Ping"],

  /* --- The model, in three moves ------------------------------------- */
  pillars: [
    {
      k: "01",
      title: "Hand-picked",
      desc: "Mint-condition used clubs, selected in person from Kuala Lumpur's golf shops and markets — one of the most active pre-owned markets in Asia. Nothing sourced blind.",
    },
    {
      k: "02",
      title: "Trusted brands",
      desc: "TaylorMade, Titleist, Callaway, Ping — the names Gulf golfers already know and want. The clubs that hold their value and their reputation.",
    },
    {
      k: "03",
      title: "Luxury delivered",
      desc: "Every order ships in a matte-black box with a head cover and brush — a premium unboxing built to feel like a flagship purchase, sent direct to your door by DHL.",
    },
  ],

  /* --- Why it exists -------------------------------------------------- */
  why:
    "The Gulf pre-owned golf market is active and growing — buying a quality used club is a completely normal purchase. What doesn't exist yet is a trusted, premium, locally-run source with a real brand behind it. IAM GOLF fills that gap.",

  /* --- Contact / follow (only the real link) ------------------------- */
  links: [
    { name: "Instagram", handle: "@iam_golfgcc", url: "https://www.instagram.com/iam_golfgcc" },
  ],

  /* --- Footer: parent-brand credit + legal disclaimer ---------------- */
  /* studioUrl points back to the KAZ6 portfolio. disclaimer rebuts any
     implied-endorsement claim — independent reseller, marks owned by others. */
  studioUrl: "../kaz6-site/index.html", // relative for local; swap to live KAZ6 URL on deploy
  disclaimer:
    "IAM GOLF is an independent reseller. Not affiliated with, authorised by, or endorsed by TaylorMade, Titleist, Callaway, or Ping. All trademarks belong to their respective owners.",
};
