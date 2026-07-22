/* ============================================================
   data.js  ·  SINGLE SOURCE OF TRUTH  ·  KAZ6
   ------------------------------------------------------------
   HANDOFF — read first. Container wipes between chats; the zip
   KO uploads ALWAYS beats memory and project-knowledge files.

   STATE: v9 "GALLERY" — IAM GOLF aesthetic site-wide. Multi-page:
   index / about / record / games / ventures / contact. Warm paper,
   Archivo 800–900 uppercase display, IBM Plex Mono labels, big
   rounded white panels, one dark footer, strict monochrome.

   NEXT (v10): KO is shifting the aesthetic NIKE → APPLE. Read:
   from loud athletic (900-weight uppercase, shouty scale) to
   quiet premium — sentence case, lighter weights, generous
   whitespace, large soft media, restrained motion, soft/frosted
   surfaces. KEEP: monochrome discipline, multi-page IA, all
   structure below, data-driven content. At kickoff: propose the
   type system (SF Pro isn't licensable — Inter or similar), and
   confirm scope with KO: parent only, or IAM GOLF + game skins
   too. Fold the open background-texture and wordmark (Archivo
   type vs constructed six) decisions into the v10 pass.

   STRUCTURE (static, framework-free, Netlify drag-drop):
   /              six pages, shared css/ + js/
   /games/espana/ /games/europa/ /games/18-decisions/ — bundled
     self-contained subsites, edit in place, linked from data.js
   /iam-golf/     independent brand subsite — NEVER references
     KAZ6/Khalifa, never links back to parent (parent→golf OK)
   Content ONLY in the two data.js files (root + iam-golf).
   render.js fills [data-render="…"] mounts (multi-mount OK);
   main.js = behaviour; one concern per file, always.

   CONTENT TRUTHS (verified — never inflate):
   18 WSC debate medals · 5 MUN Best Council · 300K+ @k.a.z6 ·
   3 games shipped. Othello: Shakespeare, the NARRATOR (not the
   lead) — wrote his own speech, memorized it in two weeks,
   designed his own costume. IAM GOLF price line: "roughly half
   of retail" (never "exactly 50%"). Games: España 38·0 / Europa
   13·0 / 18 Decisions; no external game URLs remain.
   Education: on-site copy uses law-as-ambition framing. KO's
   profile states law student (foundation yr, ASU, partial
   scholarship) — confirm with KO before adding any enrollment
   claim to the site.

   OPEN (KO's calls):
   • football game INTERNALS still read "La Liga"/"Champions
     League" (fan-game disclaimers present) — rebrand or keep
   • kaz6.com placeholder domain (~5 files at deploy time) ·
     contact@kaz6.com mailbox is dead
   • originals owed: hero/portrait (603px stand-ins), iam-golf
     kit.jpg · Othello cast-photo consent before launch
   • espana/europa covers: real stadium crops in assets/media

   BUILD / DELIVERY NORMS:
   Every iteration ships BOTH: deployable zip + ONE self-contained
   preview HTML (all pages hash-routed in a single file; games and
   IAM GOLF open in an overlay iframe via srcdoc — builder is
   build_single.py pattern). GOTCHA: when embedding subsites in
   the master preview, encode EVERY "<" in the JSON blob as
   \u003c — a raw "</script>" breaks out of the script block and
   the embed's CSS hijacks the whole page (the all-black bug).
   18 Decisions uses its poster (not the 4MB mp4) in the preview;
   the real deploy keeps the video. iOS webviews force-dark:
   color-scheme only-light + !important backgrounds already sit
   in tokens.css/base.css. Scroll: nav toggle uses hysteresis
   (on >24 / off <4) + rAF + clamped scrollY; NEVER animate nav
   geometry (padding/height) on scroll — it wobbles on iOS.

   KO working style: terse changelogs · flag once, move on ·
   act on reversible calls, confirm destructive ones.
   DRAFT until KO says exactly: "website completed".
   ============================================================ */
const SITE = {
  name: "KAZ6",
  person: "Khalifa Othman",
  role: "Debate · Strategy games — Bahrain",
  tagline:
    "Competitive debater who builds strategy games — and argues a case the same way I build one: structure first, every counter anticipated.",
  email: "contact@kaz6.com",

  meta: {
    place: "Manama, Bahrain",
    coords: "26.22°N 50.58°E",
    year: "2026",
    status: "Open to work",
  },

  /* ── PAGES — drives nav + the home route list ──────────────
     file  = real page (Netlify). label = nav text. n = index tag.
     desc  = one line shown on the Home route rows.
     home:true marks the landing (not shown as a route to itself). */
  pages: [
    { file: "index.html",     label: "Home",     n: "00", home: true, desc: "" },
    { file: "about.html",     label: "About",    n: "01", desc: "The person behind the record, and the thread through all of it." },
    { file: "record.html",    label: "Record",   n: "02", desc: "Debate, Model UN, and an audience — the verifiable numbers." },
    { file: "games.html",     label: "Games",    n: "03", desc: "Three strategy games. Draft, manage, and chase a perfect run." },
    { file: "ventures.html",  label: "Ventures", n: "04", desc: "IAM GOLF — premium pre-owned clubs, delivered across the Gulf." },
    { file: "contact.html",   label: "Contact",  n: "05", desc: "Socials and a direct line." },
  ],

  heroMedia:  { type: "image", src: "assets/media/hero.jpg", alt: "Khalifa Othman" },
  portrait:   { type: "image", src: "assets/media/portrait.jpg", alt: "Khalifa Othman", cap: "FIG. 00 · Khalifa Othman" },

  /* keyword marquee under the home hero */
  marquee: ["Debate", "Model UN", "Strategy games", "Content", "Built in Bahrain", "Proof over promises"],

  stats: [
    { value: "18",    label: "Debate medals · World Scholars Cup" },
    { value: "300K+", label: "Followers · @k.a.z6" },
    { value: "5",     label: "MUN Best Council Awards" },
    { value: "3",     label: "Strategy games shipped" },
  ],

  about: [
    "I build strategy games and argue for sport — and I'm headed for law, with courtroom advocacy as the end goal. Everything runs on the same instinct: find the system, find the leverage, and play it to the end.",
    "Eighteen debate medals at the World Scholars Cup and five Best Council Awards at Model UN taught me to build a case the way I build a game — structure first, every counter anticipated, never relying on volume when logic will do.",
    "I also build audiences: past 300,000 followers as @k.a.z6, plus brand campaigns and a turn as Shakespeare — the narrator — in Othello. The thread through all of it is the same: systems, leverage, and the discipline to finish the hard thing.",
  ],

  arenas: [
    {
      title: "Competitive Debate",
      role: "World Scholars Cup · 18 medals",
      desc: "Adversarial reasoning under pressure — building arguments, anticipating every counter, and winning rooms on logic, not volume.",
      tags: ["Argumentation", "Strategy", "Persuasion"],
    },
    {
      title: "Model United Nations",
      role: "Delegate · 5 Best Council Awards",
      desc: "Five Best Council Awards across MUN conferences — building toward Secretary-General, recruiting and training a team strictly on merit.",
      tags: ["Leadership", "Diplomacy", "Speaking"],
    },
    {
      title: "Content Creator — K.a.z6",
      role: "300K+ followers · brand work",
      desc: "An audience past 300,000 on TikTok and 10K on Instagram, with sponsored campaigns for brands. Recognised as Best Young Influencer.",
      tags: ["Audience", "Content", "Brand"],
    },
  ],

  studio: { name: "The Unbeatables", tag: "Game studio · KAZ6" },

  games: [
    {
      id: "espana", title: "España 38·0", score: "38·0", scoreLabel: "Perfect season",
      desc: "A full 38-match league season built around one question: can you go unbeaten? Draft, manage, and grind out a flawless title.",
      tags: ["Strategy", "Football", "Season Sim"], live: true,
      url: "games/espana/index.html",
      media: { type: "image", src: "assets/media/espana-cover.jpg", alt: "Matchday crowd" },
    },
    {
      id: "europa", title: "Europa 13·0", score: "13·0", scoreLabel: "Knockout run",
      desc: "A 13-game continental knockout gauntlet from group stage to final. No second legs — every match is the whole tie.",
      tags: ["Strategy", "Football", "Knockout"], live: true,
      url: "games/europa/index.html",
      media: { type: "image", src: "assets/media/europa-cover.jpg", alt: "European night, under the lights" },
    },
    {
      id: "decisions", title: "18 Decisions", score: "18", scoreLabel: "One call a shot",
      desc: "Eighteen holes, fourteen clubs, one decision a shot. Chase the green or play the percentages — then live with the bounce.",
      tags: ["Strategy", "Golf", "Risk · Reward"], live: true,
      url: "games/18-decisions/index.html",
      media: { type: "video", src: "assets/media/decisions-loop.mp4", poster: "assets/media/decisions-poster.jpg", alt: "On the range" },
    },
  ],

  venture: {
    title: "IAM GOLF",
    role: "Founder · Commerce studio",
    desc: "Premium pre-owned golf clubs — TaylorMade, Titleist, Callaway, Ping — hand-picked in Kuala Lumpur, delivered across the Gulf. A luxury unboxing nobody else in the market offers.",
    tags: ["Commerce", "Brand", "Gulf market"],
    status: "Launching 2026",
    url: "iam-golf/index.html",
    cta: "Visit IAM GOLF",
    secondary: { url: "https://www.instagram.com/iam_golfgcc", label: "@iam_golfgcc" },
  },

  film: [
    { type: "image", src: "assets/media/othello-cast.jpg", alt: "The cast", cap: "Othello — the cast" },
  ],

  socials: [
    { name: "TikTok",    handle: "@k.a.z6",         url: "https://www.tiktok.com/@k.a.z6" },
    { name: "Instagram", handle: "@k.a.z6official",  url: "https://www.instagram.com/k.a.z6official" },
    { name: "LinkedIn",  handle: "Khalifa Othman",   url: "https://www.linkedin.com/in/khalifa-othman-81ba6b257" },
  ],
};
