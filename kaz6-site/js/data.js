/* ============================================================
   data.js  ·  SINGLE SOURCE OF TRUTH  ·  KAZ6
   ------------------------------------------------------------
   HANDOFF — read first. Container wipes between chats; the zip
   KO uploads ALWAYS beats memory and project-knowledge files.

   STATE: v12 "MASTHEAD" — a complete aesthetic redirection from
   v11 COURTROOM's dark-ink/red system (v10 Apple-quiet, v9
   GALLERY before that). Light editorial-brutalist: bone/greige
   paper ground (--paper #EAE7E0 — cool putty, NOT Apple gray,
   NOT warm cream), near-black ink type (--ink #141414), ONE
   inverted band — the nav, permanently solid ink, not a
   scroll-triggered flip (main.js's hysteresis handler still
   toggles nav.scrolled, it just adds a hairline/shadow now
   instead of a background change). Red (--red #C1121F) has
   exactly three jobs: a portion of display headlines (the second
   line of each phero-title, wrapped in <span class="accent">),
   the interpunct in every scoreline (38·0), and primary CTAs
   (.btn / .play-btn / .nav-cta). Nowhere else — ledger numerals,
   tags, hovers, focus rings all stay neutral ink. No gradients,
   no glow, no rounded corners anywhere (--r-card/-media/-chip
   all 0). Display face is Saira Condensed (700–900, uppercase via
   CSS text-transform — data.js copy itself stays sentence case),
   tight leading (0.88–0.92), filling the full column width. Body
   stays Inter; labels/captions/tabular scoreline figures run
   JetBrains Mono, tracked >=0.16em. Photography is grayscale via
   CSS filter on img/video (never baked into the asset files),
   hard-edged (radius 0), captioned "FIG. 00 — …" in tracked caps.
   UPDATE (same pass, KO's call): the paper ground read too close to
   white, and KO asked the grain back — --paper deepened to #E2DDCC
   (was #EAE7E0), and base.css's body::before grain overlay is back
   (static SVG noise, ~5% opacity, mix-blend-mode:multiply so it
   darkens instead of washing out — different from v11's overlay
   blend). Grit is now photography + hard edges + this texture
   together, not photography alone.

   BUG FIX (same pass): KO reported ghosted scrolled-past content
   flashing above the fixed nav on iOS Safari (visible in the status-
   bar strip during the address-bar collapse animation) — root cause
   was the parent's <meta viewport> missing viewport-fit=cover (the
   game subsites already had it). Fixed: added viewport-fit=cover to
   all six parent pages, and nav.css now pads .nav's top with
   env(safe-area-inset-top) so its solid fill extends under the
   notch/Dynamic Island instead of leaving a gap; .nav-spacer grows
   to match. Don't strip viewport-fit=cover or the safe-area padding
   without re-checking this on a real notched iPhone first.

   Cards are gone from record.html (arenas) and games.html (games) —
   both are now asymmetric full-width rows/dockets, never a
   3-equal-cards grid.
   Signature: index.html's hero — a huge uppercase name headline
   overlapping a hard-edged grayscale image block, with the
   scorewall (.scorewall, renderHeroScores() in render.js) as the
   dominant scoreline treatment underneath. Still the ONLY motion
   on the site: a one-shot CSS entrance on load, no scroll-linking,
   no reveal-on-scroll anywhere (unchanged from v11 — don't
   reintroduce .reveal/.d1-3 classes).

   TWO FUNCTIONAL CHANGES shipped this pass, both KO's explicit
   call and NOT reversible by re-reading old handoff text above:
   1) stats array below is ordered high-to-low by value (data
      order only — render.js/markup unchanged).
   2) IAM GOLF and all three games now carry a small "← KAZ6" /
      "← Home" link back to this parent's index.html, styled in
      each subsite's OWN local CSS (never the parent's shared
      css/js). This reverses the old "golf never links back" rule
      — see the updated CANON note in iam-golf/js/data.js. Do not
      revert either change without a fresh KO instruction.

   NEXT: no open aesthetic direction from KO yet — v12 is the
   current system. If another pass is requested, propose it fresh
   rather than assuming another pendulum swing back to v11/v10.

   BUILD STEP — the old "no build step / drag-drop" rule NO LONGER
   HOLDS (per KO: the site must stay live and fresh). The repo is
   git-connected to Netlify and netlify.toml now runs
   `node scripts/fetch-live.mjs` before publish, which bakes live FX
   rates into iam-golf/js/live.js. netlify/functions/daily-rebuild.mjs
   is a scheduled function that pokes a build hook once a day so the
   rates refresh without a push. Still true: zero npm dependencies,
   zero framework, pages are plain HTML/CSS/JS and open fine over
   file://. The fetch is fail-soft by design — it never fails a build
   and never overwrites good data with bad. NOTE the new failure mode
   a build step introduces: a broken build now means no deploy at all,
   so keep that script dependency-free and defensive.
   MANUAL SETUP still owed: create a Netlify build hook and expose it
   as the BUILD_HOOK_URL env var, or the daily refresh silently no-ops
   (it logs a warning rather than pretending it worked).

   STRUCTURE (static, framework-free, git-connected Netlify build):
   /              six pages, shared css/ + js/
   /games/espana/ /games/europa/ /games/18-decisions/ — bundled
     self-contained subsites, edit in place, linked from data.js.
     Each now has a small "← KAZ6" return link (local CSS only).
   /iam-golf/     brand subsite, own tokens/css — still never
     mentions "Khalifa" by name in its own copy, but as of this
     pass DOES link back to the parent (see CANON note there).
   Content ONLY in the two data.js files (root + iam-golf).
   render.js fills [data-render="…"] mounts (multi-mount OK);
   main.js = behaviour; one concern per file, always.

   CONTENT TRUTHS (verified — never inflate):
   18 WSC debate medals · 5 MUN Best Council · 300K+ @k.a.z6 ·
   4 games SHIPPED (LU'LU'A became playable and was counted in). Othello: Shakespeare, the NARRATOR (not the
   lead) — wrote his own speech, memorized it in two weeks,
   designed his own costume. IAM GOLF price line: "roughly half
   of retail" (never "exactly 50%"). Games: España 38·0 / Europa
   13·0 / 18 Decisions; no external game URLs remain.

   LU'LU'A — the fourth game, NOW PLAYABLE and counted as shipped.
   Source: /apps/luluaa (React+TS+Vite, the only npm-dependent thing
   in the repo). Built output is COMMITTED to kaz6-site/games/luluaa/
   and Netlify does NOT build it — that is the whole point: a broken
   game build must never block the site's deploy. Rebuild deliberately
   with `cd apps/luluaa && npm run build`, then COMMIT the output, or
   the live site keeps serving the previous bundle.
   PLAYABLE NOW (local pass-and-play, 4 seats on one device): snake
   setup draft, dice + production, barasti/qasr/route building with
   full placement legality, 4:1 bank trade, the full 25-card dhow
   deck, the Shamal (discard-on-7, move, steal), longest route and
   Master Navigator bonuses, and the win at 10 points.
   ONLINE SEATS are now built (spec §9). Each seat is independently
   local or remote and any mix is valid. Opening the FIRST remote seat
   is what creates the Supabase row — until then the game makes zero
   network calls and works with Supabase unreachable (lazy activation,
   §9.4). What syncs is a SNAPSHOT: board seed + rows + mutable state,
   never the derived tiles/geometry, so a reconnect rebuilds an
   identical board from the seed. Backend lives in KO's own Supabase
   project ngtpeamcaxdtghimdspz, table public.luluaa_games (jsonb
   snapshot keyed by room_code, realtime enabled, updated_at trigger).
   WHAT ANON MAY DO, exactly: select, insert, update — and nothing else.
   There is deliberately NO delete policy and the table grant is revoked,
   because the publishable key ships in the bundle by design and an open
   delete meant anyone holding it could wipe every game in progress.
   Closing a table goes through luluaa_close_room(code), which requires
   the code a bulk wipe by definition doesn't have. Rooms also expire:
   pg_cron runs luluaa_purge_stale(7) at 03:17 UTC, so a table nobody has
   touched in a week clears itself instead of living forever. That purge
   function is revoked from PUBLIC — note PUBLIC, not just anon: Postgres
   grants EXECUTE to PUBLIC by default, so revoking from anon alone does
   nothing and leaves a worse hole than the one being closed.
   SELECT stays open to anon and cannot be narrowed: Realtime evaluates
   RLS as the subscribing role, so revoking read would stop the far side
   ever hearing about a move. The room code remains the practical secret
   for FINDING a table, not a barrier to reading one — someone with the
   key can still enumerate rooms. Acceptable for a friends' game; don't
   put anything in a snapshot you wouldn't hand a stranger.
   Credentials sit in apps/luluaa/.env and are
   COMMITTED on purpose: it is the publishable key, it is already inside
   the committed bundle, and omitting it would silently produce rebuilds
   with online play disabled. NEVER put the service_role key there.
   VERIFICATION GAP — read before trusting it: the Supabase REST contract
   was verified directly (upsert/select/update/trigger/RLS all pass), and
   local play was regression-tested, but the BROWSER-to-Supabase leg was
   never exercised: this sandbox blocks outbound HTTPS from the browser
   even though the shell can reach it. Two-device sync is therefore
   UNTESTED end to end. Test it for real before relying on it.
   SHIPPED SINCE: player-to-player trading (one standing offer, both
   hands re-checked at accept time); 9 trade posts on the coast, derived
   from the board seed, cutting the bank rate to 3:1 generic / 2:1
   specific; bot seats; a lobby that gates the board and holds all the
   seat setup; light/dark; and a board that sits in the Gulf with moored
   dhows at every post.
   GOTCHA worth keeping: Gentle Shamal deadlocks the opening if you
   don't implement its fallback — at game start EVERY seat is on 2
   points, so every occupied tile is sheltered and the 7 can never
   resolve. legalShamalTiles() + settleShamal() handle it by sending
   the Shamal back to the sabkha with no steal. Don't remove that.
   39 tests cover generation, rules, the distance rule, QR encoding, bot
   self-play (four bots to a winner, which is what catches deadlocks) and
   a LIVE two-device sync suite that talks to the real Supabase and skips
   itself when unreachable. Run `npm test` there before touching either.
   Education: on-site copy uses law-as-ambition framing. KO's
   profile states law student (foundation yr, ASU, partial
   scholarship) — confirm with KO before adding any enrollment
   claim to the site.

   CONTACT — RESOLVED (per KO): there is NO email address. The dead
   contact@kaz6.com field was deleted from SITE rather than replaced;
   it had never been rendered, so nothing on the page changed. Reach
   is via DM, Instagram first (@k.a.z6official). Do NOT re-add an
   `email` field or a mailto: link anywhere — an address that drops
   mail is worse than no address. IAM GOLF already follows the same
   rule ("only the real channel — no invented email/phone").

   OPEN (KO's calls):
   • football games are now generically named (per KO): "La Liga" and
     "Champions League" are gone from both — España reads "the Spanish
     league", Europa "the European cup". Club names stay: naming the
     record holders is factual reference, a competition brand is not.
     The fan-game disclaimers remain load-bearing — keep them verbatim.
   • kaz6.com does not resolve (no A record). iam-golf's canonical +
     og:image now point at kaz6.netlify.app, because aiming them at a
     dead host broke link previews and told crawlers to canonicalise
     to a URL that never answers. Two lines in iam-golf/index.html —
     swap both back the day kaz6.com resolves.
   • originals owed: hero.jpg is 508x450 and portrait.jpg 320x450 —
     both soft on desktop; iam-golf kit.jpg; Othello cast-photo
     consent before launch
   • espana/europa covers: real stadium crops in assets/media
   • NETLIFY: BUILD_HOOK_URL is still unset, so the 04:00 UTC
     scheduled function logs "not configured" and returns. FX rates
     only refresh when something else triggers a build.

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
  /* no email by design — contact is by DM, Instagram first. see the
     CONTACT note above before adding one back. */

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
    { file: "games.html",     label: "Games",    n: "03", desc: "Four strategy games, three of them live. Draft, manage, and chase a perfect run." },
    { file: "ventures.html",  label: "Ventures", n: "04", desc: "IAM GOLF — premium pre-owned clubs, delivered across the Gulf." },
    { file: "contact.html",   label: "Contact",  n: "05", desc: "Socials and a direct line." },
  ],

  heroMedia:  { type: "image", src: "assets/media/hero.jpg", alt: "Khalifa Othman" },
  portrait:   { type: "image", src: "assets/media/portrait.jpg", alt: "Khalifa Othman", cap: "FIG. 00 · Khalifa Othman" },

  /* keyword marquee under the home hero */
  marquee: ["Debate", "Model UN", "Strategy games", "Content", "Built in Bahrain", "Proof over promises"],

  /* high-to-low by value: 300K+ -> 18 -> 5 -> 3. data order only, KO's call. */
  stats: [
    { value: "300K+", label: "Followers · @k.a.z6" },
    { value: "18",    label: "Debate medals · World Scholars Cup" },
    { value: "5",     label: "MUN Best Council Awards" },
    { value: "4",     label: "Strategy games shipped" },
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
    {
      /* Now genuinely playable end-to-end (local pass-and-play, 4 seats):
         setup draft, dice + production, building, bank trade, dhow cards,
         the Shamal, and the win at 10. Online seats are still to come, so
         the tag says "local play". */
      id: "luluaa", title: "LU'LU'A", score: "10", scoreLabel: "Points to win",
      desc: "Isle of Pearls — a Bahrain-themed trading and settlement game for four. Dive the pearl banks, run dhow routes, and build from barasti to qasr while the Shamal blows across the board. Pass-and-play on one device.",
      tags: ["Strategy", "Board game", "4 player"], live: true,
      url: "games/luluaa/index.html",
      media: { type: "image", src: "assets/media/luluaa-cover.jpg", alt: "A dealt LU'LU'A board" },
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
    disclaimer: "IAM GOLF is an independent reseller. Not affiliated with, authorised by, or endorsed by TaylorMade, Titleist, Callaway, or Ping. All trademarks belong to their respective owners.",
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
