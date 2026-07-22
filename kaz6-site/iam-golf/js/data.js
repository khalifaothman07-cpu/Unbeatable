/* =========================================================================
   data.js  —  IAM GOLF · SINGLE SOURCE OF TRUTH
   -------------------------------------------------------------------------
   Premium pre-owned golf clubs, sourced in Kuala Lumpur, delivered across
   the Gulf. Edit content ONLY here — never in render.js or index.html.
   ========================================================================= */

/* ▓▓▓ AGENT HANDOFF — READ FIRST. NOT RENDERED. ▓▓▓
   CANON: system "GALLERY" (v3) — light, airy, gallery-forward layout
   (per KO ref image "GOLF MASTER" vibe, "in our colors"). Warm paper
   ground, big rounded panels, centered chapters, ONE dark feature
   panel + dark footer. Strict brand monochrome (no hue — olive in the
   ref was just the mockup mat, NOT applied). Archivo 700–900, IBM Plex
   Mono labels/ledger. Own tokens/base/media/golf CSS — shares NO visual
   layer with the parent. Supersedes "MATTE" v2 / "CLUBHOUSE" v1.
   DELIBERATELY NOT COPIED from the ref (would be untrue): booking form
   + "BOOK NOW" bars (IAM is a pre-launch reseller, not a booking
   service) → real CTA is Follow + price anchor. Ref is photo-heavy;
   IAM has ~no photos → ONE intentional dark feature panel (reversed
   mark when empty), photo-OPTIONAL model cards, honest awaiting states.
   featureMedia/pillars[].img/followMedia now hold real Pexels photos
   (feature/pillar-01..03/follow.jpg, web-compressed ~1MB total). KIT
   plate stays AWAITING — no matte-black-box shot yet (kit.jpg pending).
   NOTE: pillar-02 (Titleist ball) + follow (Callaway bag) show third-
   party logos — kept under nominative use / first-sale, backed by the
   footer disclaimer; swap to grayscale/awaiting if KO objects. A 6th
   upload (purple-shoe putt) was dropped as off-brand. Full colour by
   default; duotone is a one-line option if tighter mono is wanted.
   STANDALONE RULE (per KO): this page must NEVER mention KAZ6, Khalifa,
   or link back to the parent. It ships INSIDE the parent deploy at
   /iam-golf/ but presents as an independent company. Parent → golf links
   are allowed; golf → parent is not. `parent` and `studioUrl` fields are
   intentionally deleted — do not re-add.
   PRICING is PUBLIC: full kit 850–900 BD, BD only (raised from 500–700
   to match true sale price). "exactly 50%" softened to "roughly half" —
   literal 50% only holds vs a full-MSRP top-tier new bag, so the precise
   claim was dropped to stay defensible. ½ monument kept as slogan.
   Sourcing cost, landed cost, and per-unit margin stay INTERNAL — NEVER
   rendered and never left in comments (shipped JS is readable source).
   REFERRAL: public CTA only (50 BD off next order, both sides). Redemption
   caps/expiry/glove-stacking and the margin model are INTERNAL — they do
   NOT live in this deploy. If a real referral/margin tracker is built it
   is a separate, non-public app.
   PENDING: brand-text only, NO real brand logos (nominative-use risk);
   footer disclaimer is load-bearing — keep it verbatim.
   WORDMARK: now REAL TEXT (Archivo 900, .wordmark) — the constructed
   SVG mark was retired (its M ran the centre-V to the baseline and read
   as two split humps; KO rejected it). Favicon SVG is separate/kept.
   MEDIA: kit plate renders under pricing; awaiting-state until
   assets/media/kit.jpg is dropped in. Favicon is now LOCAL
   (assets/favicon.svg) — never point at the parent's.
   META: canonical/og still use the placeholder domain (go-live swap list);
   visible page carries zero parent traces.
   DRAFT until KO says "website completed". */

const IAM = {
  brand: "IAM GOLF",
  brandSpoken: "I A M Golf", /* IAM = initials — read letter by letter, never "I am" */
  tagline:
    "Premium pre-owned golf clubs — hand-picked in Kuala Lumpur, delivered across the Gulf. Mint condition, trusted brands, and a luxury unboxing nobody else in this market offers.",
  status: "Launching 2026",

  /* --- Feature panel (drop-in: assets/media/feature.jpg) -------------- */
  /* Empty = intentional dark panel w/ reversed mark. Add src to fill. */
  featureMedia: { src: "assets/media/feature.jpg", cap: "Kuala Lumpur → Gulf" },

  /* --- The trusted brands (what gets sourced) ------------------------ */
  brands: ["TaylorMade", "Titleist", "Callaway", "Ping"],

  /* --- The model, in three moves ------------------------------------- */
  pillars: [
    {
      k: "01",
      img: "assets/media/pillar-01.jpg",
      title: "Hand-picked",
      desc: "Mint-condition used clubs, selected in person from Kuala Lumpur's golf shops and markets — one of the most active pre-owned markets in Asia. Nothing sourced blind.",
    },
    {
      k: "02",
      img: "assets/media/pillar-02.jpg",
      title: "Trusted brands",
      desc: "TaylorMade, Titleist, Callaway, Ping — the names Gulf golfers already know and want. The clubs that hold their value and their reputation.",
    },
    {
      k: "03",
      img: "assets/media/pillar-03.jpg",
      title: "Luxury delivered",
      desc: "Every order ships in a matte-black box with a head cover and brush — a premium unboxing built to feel like a flagship purchase, sent direct to your door by DHL.",
    },
  ],

  /* --- The price rule (public, per KO) -------------------------------- */
  pricing: {
    headline: "Half of retail",
    sub: "Every kit priced at roughly half of what the same clubs cost new. All prices in BD. Buy a single club or a full kit.",
    ledger: [
      { k: "Single club", v: "≈ half of new" },
      { k: "Full kit", v: "850–900 BD" },
      { k: "Currency", v: "BD only" },
    ],
    includes: [
      "Mint pre-owned set",
      "Ball",
      "Golf bag",
      "Towel",
      "Cleaning brush",
      "IAM GOLF tees",
      "Matte-black box",
      "DHL delivery",
    ],
    branded: "Tees & brush carry the IAM GOLF mark",
    local: "The cleaning brush is function, not filler — Gulf play is hard on gear.",
  },

  /* --- Referral (PUBLIC CTA only — no economics on this page) --------- */
  referral: {
    headline: "Bring a friend into the game",
    amount: "50 BD",
    body:
      "Refer another golfer and you both get 50 BD off your next order — a thank-you for sending real players our way.",
    terms:
      "One use per referred customer · valid 90 days · applies to a future order, not the first purchase.",
  },

  /* --- The kit, on camera (drop-in: assets/media/kit.jpg) ------------ */
  kitMedia: {
    type: "image",
    src: "assets/media/kit.jpg",
    alt: "The kit — matte-black box",
    cap: "FIG. 01 · The kit",
  },

  /* --- Why it exists -------------------------------------------------- */
  why:
    "The Gulf pre-owned golf market is active and growing — buying a quality used club is a completely normal purchase. What doesn't exist yet is a trusted, premium, locally-run source with a real brand behind it. IAM GOLF fills that gap.",

  /* --- Contact / follow (only the real channel — no invented email/phone) */
  links: [
    { name: "Instagram", handle: "@iam_golfgcc", url: "https://www.instagram.com/iam_golfgcc" },
  ],
  contact: [
    { label: "Instagram", value: "@iam_golfgcc", url: "https://www.instagram.com/iam_golfgcc" },
  ],

  /* --- Follow reel image (drop-in) ----------------------------------- */
  followMedia: { src: "assets/media/follow.jpg", alt: "On the course at sunrise" },

  /* --- Footer: house line + legal disclaimer -------------------------- */
  /* Disclaimer rebuts any implied-endorsement claim — independent
     reseller, marks owned by others. Keep verbatim. */
  footTag: "Kuala Lumpur → Gulf",
  disclaimer:
    "IAM GOLF is an independent reseller. Not affiliated with, authorised by, or endorsed by TaylorMade, Titleist, Callaway, or Ping. All trademarks belong to their respective owners.",
};
