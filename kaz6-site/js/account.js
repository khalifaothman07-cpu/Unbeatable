/* ============================================================
   account.js  ·  IDENTITY AND THE VISIT LOG
   ------------------------------------------------------------
   One file, loaded by every page on the site, by the three
   vanilla games, and by LU'LU'A and FAREEJ. There is no second
   copy to drift out of sync.

   WHY NO SDK. This talks to five Supabase endpoints. Pulling
   @supabase/supabase-js off a CDN to reach them would put a
   third-party script tag on every page of a site whose whole
   shape is "no build step, no framework, committed output" —
   and would add a version that can move under us. Five fetch
   calls are cheaper than that and we own them.

   TWO IDENTITIES, ON PURPOSE.
     visitorId  a uuid this browser mints on first arrival and
                keeps. Anonymous, durable, and there for every
                visitor from the very first page view.
     user       null until somebody signs in with Google.

   Because visitorId survives the sign-in, signing in names
   everything that visitor did BEFORE they signed in, not just
   afterwards. That is the whole trick, and it is why the login
   is optional: traffic is measured either way, and an account
   only adds a name to it.

   THE KEY BELOW IS PUBLISHABLE. It is designed to ship in
   browsers and is already in the committed game bundles.
   Safety comes from Row Level Security, not from hiding it:
   with this key you may INSERT a row about yourself into
   public.visits and you may never read one back. Reading the
   log requires an account that is in public.admins.
   ============================================================ */

const SUPABASE_URL = "https://ngtpeamcaxdtghimdspz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Td08KXJimYLQIbwS3fpPEA_-AfRp_Jl";

const VISITOR_KEY = "kaz6.visitor";
const SESSION_KEY = "kaz6.session";
const CONSENT_KEY = "kaz6.consent";

/* ---------- tiny storage helpers ------------------------------------------
   Every read is wrapped. Safari in private mode throws on localStorage
   rather than returning null, and an analytics module must never be the
   reason a page fails to render. */
function readStore(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* storage off */ }
}
function dropStore(key) {
  try { localStorage.removeItem(key); } catch (e) { /* storage off */ }
}

function uuid() {
  try {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) { /* fall through */ }
  /* older Safari: randomUUID landed in 15.4 */
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/* ---------- consent -------------------------------------------------------
   Three states, and the difference between them is REAL — this gates what
   is written to the device, not just what a banner says.

     null   nobody has answered yet. Nothing is stored. A view is still
            logged, but with no identifier, so it cannot be tied to any
            other view. You learn that a page was opened; you do not learn
            who opened it.
     "yes"  the tracking id is minted and kept. Full picture.
     "no"   nothing is logged at all, ever, and any id already held is
            thrown away.

   Two things deliberately DO NOT wait on this, because both are storage a
   visitor asked for by acting:
     - the login session, without which "sign in" cannot work
     - the theme choice, which is a preference they set themselves
   Under the EU rule the exemption is for storage strictly necessary to
   provide a service the user requested, and those two are exactly that.
   The tracking id is not, which is the whole reason this bar exists.

   Calling it a "cookie banner" would be wrong on the technicality — this
   site sets no cookies whatsoever — but the rule covers storing anything
   on someone's device, so the distinction buys nothing and the bar says
   what it actually does instead. */

function consentState() {
  const v = readStore(CONSENT_KEY);
  return v === "yes" || v === "no" ? v : null;
}

function setConsent(value) {
  writeStore(CONSENT_KEY, value);
  if (value === "no") {
    /* honour it properly: drop the id we may already be holding rather
       than merely stopping new writes */
    dropStore(VISITOR_KEY);
  } else if (value === "yes") {
    /* Mint it here, at the moment of agreement, rather than leaving it to
       whenever something next happens to ask. Lazily creating it meant that
       right after clicking yes there was still nothing stored, and the id
       only appeared on the next navigation — which works, but makes the
       stored state depend on which page you happened to click on. */
    getVisitorId();
  }
  renderConsent();
  /* Saying yes deliberately does NOT re-send the view already on screen.
     Re-sending it wrote a second row for one page load — an anonymous one
     and an identified one — which quietly inflated Views, the one number on
     the dashboard that should mean exactly "pages opened". The id applies
     from the next navigation instead, which on any visit longer than a
     single page is a few seconds away. An accurate total beats claiming one
     extra visitor. */
}

/** The durable id for this browser, or null when we are not allowed one.
    Never mints anything unless consent is "yes". */
function getVisitorId() {
  if (consentState() !== "yes") return null;
  let v = readStore(VISITOR_KEY);
  if (!v || v.length !== 36) {
    v = uuid();
    writeStore(VISITOR_KEY, v);
  }
  return v;
}

/* ---------- session ------------------------------------------------------- */

let session = null;   // { access_token, refresh_token, expires_at, user }
let profile = null;   // { id, full_name, email, avatar_url }

function loadSession() {
  const raw = readStore(SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || !s.access_token || !s.refresh_token) return null;
    return s;
  } catch (e) { return null; }
}

function saveSession(s) {
  if (!s) { dropStore(SESSION_KEY); session = null; return; }
  /* expires_in is seconds from now; store the absolute moment instead so a
     tab left open overnight can tell that it went stale. */
  session = {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
    user: s.user || (session && session.user) || null,
  };
  writeStore(SESSION_KEY, JSON.stringify(session));
}

async function refreshSession() {
  if (!session || !session.refresh_token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) {
      /* a refresh token is single-use and can be revoked; a failure here
         means signed out, not a transient error worth retrying */
      saveSession(null);
      return null;
    }
    const data = await res.json();
    saveSession(data);
    return session;
  } catch (e) {
    /* offline — keep what we have rather than signing the person out */
    return session;
  }
}

/** A valid access token, refreshing 60s before expiry, or null if signed out. */
async function getToken() {
  if (!session) return null;
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at - 60 <= now) {
    const s = await refreshSession();
    if (!s) return null;
  }
  return session.access_token;
}

/* ---------- REST ---------------------------------------------------------- */

async function rest(path, options) {
  const opts = options || {};
  const token = await getToken();
  const headers = Object.assign(
    {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token || SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    opts.headers || {}
  );
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, Object.assign({}, opts, { headers }));
}

/* ---------- sign in ------------------------------------------------------- */

/** Send the browser to Google. Returns here with tokens in the URL hash. */
function signIn() {
  const back = new URL(window.location.href);
  back.hash = "";
  const url = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  url.searchParams.set("provider", "google");
  url.searchParams.set("redirect_to", back.toString());
  window.location.assign(url.toString());
}

function signOut() {
  const token = session && session.access_token;
  saveSession(null);
  profile = null;
  /* best effort: tell the server too, but the local drop is what matters
     and must not wait on the network */
  if (token) {
    fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      keepalive: true,
    }).catch(() => {});
  }
  render();
}

/** Supabase returns from OAuth with the tokens in the fragment. Take them,
    then scrub the address bar — an access token must not sit in history,
    get bookmarked, or ride along in a Referer header. */
function consumeCallback() {
  if (!window.location.hash || window.location.hash.length < 2) return false;
  const frag = new URLSearchParams(window.location.hash.slice(1));
  const access = frag.get("access_token");
  const refresh = frag.get("refresh_token");
  if (!access || !refresh) return false;

  saveSession({
    access_token: access,
    refresh_token: refresh,
    expires_in: Number(frag.get("expires_in") || 3600),
  });
  history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
}

/* ---------- profile ------------------------------------------------------- */

async function loadProfile() {
  if (!session) { profile = null; return null; }
  try {
    const res = await rest("profiles?select=id,full_name,email,avatar_url&limit=1");
    if (!res.ok) return null;
    const rows = await res.json();
    profile = rows && rows[0] ? rows[0] : null;
    if (profile && !session.user) {
      session.user = { id: profile.id, email: profile.email };
      writeStore(SESSION_KEY, JSON.stringify(session));
    }
    return profile;
  } catch (e) { return null; }
}

/** Tie this browser's anonymous history to the account that just signed in,
    and note that they were here. One PATCH, fire and forget. */
async function stitchProfile() {
  if (!session || !profile) return;
  /* Only claim the browser when there is a browser id to claim. Without
     consent there is none, and writing null here would wipe a link made on
     an earlier visit when they HAD agreed. */
  const patch = { last_seen_at: new Date().toISOString() };
  const vid = getVisitorId();
  if (vid) patch.visitor_id = vid;
  try {
    await rest(`profiles?id=eq.${profile.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
  } catch (e) { /* not worth surfacing */ }
}

/* ---------- the visit log ------------------------------------------------- */

function deviceKind() {
  const w = window.innerWidth || 0;
  if (w && w < 700) return "phone";
  if (w && w < 1100) return "tablet";
  return "desktop";
}

/** Which game this page belongs to, or null for the site itself. Derived
    from the path so a new game under /games/ is counted without this file
    needing to learn its name. */
function gameFromPath(path) {
  const m = /\/games\/([^/]+)/.exec(path || "");
  return m ? m[1] : null;
}

let recorded = false;

/** Record one page view. Safe to call more than once — only the first
    lands, so a game that re-renders cannot inflate its own numbers. */
async function recordVisit(extra) {
  if (recorded) return;
  /* A refusal is a refusal. Not "log it without the id", not "log it just
     this once" — nothing leaves the browser. */
  if (consentState() === "no") return;
  recorded = true;

  const path = window.location.pathname || "/";
  const row = {
    visitor_id: getVisitorId(),
    user_id: session && session.user ? session.user.id : null,
    path: path.slice(0, 300),
    title: (document.title || "").slice(0, 200),
    game: gameFromPath(path),
    /* same-origin referrers are just internal navigation and would drown
       the one number that matters: where people arrive FROM */
    referrer: (() => {
      const r = document.referrer || "";
      if (!r) return null;
      try {
        if (new URL(r).host === window.location.host) return null;
      } catch (e) { /* unparseable — keep it */ }
      return r.slice(0, 500);
    })(),
    device: deviceKind(),
  };
  if (extra && extra.game) row.game = String(extra.game).slice(0, 40);

  try {
    await rest("visits", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
  } catch (e) { /* never let the log break the page */ }
}

/* ---------- the chip ------------------------------------------------------ */

/* The chip goes in [data-account] and nowhere else. An earlier version fell
   back to appending into #nav, which would have dropped an unstyled chip
   into any game that happened to use that id for its own bar. A page opts
   in by declaring the slot; a game with its own chrome declares nothing and
   still gets the visit logging. The UI is the optional half of this file. */
function slot() {
  return document.querySelector("[data-account]");
}

function render() {
  const host = slot();
  if (!host) return;

  let el = host.querySelector(".acct");
  if (!el) {
    el = document.createElement("div");
    el.className = "acct";
    host.appendChild(el);
  }

  if (!session) {
    el.innerHTML = "";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "acct-btn";
    btn.textContent = "Sign in";
    btn.addEventListener("click", signIn);
    el.appendChild(btn);
    return;
  }

  const name = (profile && (profile.full_name || profile.email)) || "Signed in";
  const first = String(name).trim().split(/\s+/)[0];

  el.innerHTML = "";
  const who = document.createElement("span");
  who.className = "acct-who";
  who.title = name;

  if (profile && profile.avatar_url) {
    const img = document.createElement("img");
    img.className = "acct-avatar";
    img.src = profile.avatar_url;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => img.remove());
    who.appendChild(img);
  }
  who.appendChild(document.createTextNode(first));

  const out = document.createElement("button");
  out.type = "button";
  out.className = "acct-btn acct-btn--quiet";
  out.textContent = "Sign out";
  out.addEventListener("click", signOut);

  el.append(who, out);
}

/* ---------- the consent bar ----------------------------------------------- */

/* Deliberately NOT a modal. A wall in front of a portfolio is the same
   mistake as a login wall: it costs you the visit it was meant to measure.
   This sits at the bottom, the page is fully usable behind it, and ignoring
   it forever is a valid answer — that state logs the view with no
   identifier and stores nothing. */
/* The bar carries its own styles rather than living in a stylesheet. It is
   the one piece of UI that appears on BOTH design systems — the site's
   paper-and-ink editorial pages and the games' dark lit table — and the
   games do not load the site's CSS at all. A dark plate with cream text
   reads as deliberate on either ground, and injecting it here keeps this
   module self-sufficient, which is the same reason there is only one copy
   of it. */
const CONSENT_CSS = `
.consent {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 9000;
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px;
  padding: 14px 18px calc(14px + env(safe-area-inset-bottom, 0px));
  background: #141414; color: #e8e5dc;
  border-top: 1px solid rgba(232,229,220,.22);
  box-shadow: 0 -10px 34px -14px rgba(0,0,0,.85);
  font-family: Inter, -apple-system, system-ui, sans-serif;
  animation: consent-in .32s cubic-bezier(.22,.9,.3,1) both;
}
@keyframes consent-in { from { transform: translateY(100%); } to { transform: none; } }
@media (prefers-reduced-motion: reduce) { .consent { animation: none; } }
.consent-text {
  flex: 1 1 22rem; min-width: 0; margin: 0;
  font-size: .84rem; line-height: 1.55; color: rgba(232,229,220,.82);
}
.consent-text a { color: #e8e5dc; text-underline-offset: 3px; }
.consent-acts { display: flex; gap: 8px; flex: 0 0 auto; }
.consent-btn {
  font: inherit; font-size: .78rem; font-weight: 600;
  padding: 9px 16px; cursor: pointer;
  color: #e8e5dc; background: transparent;
  border: 1px solid rgba(232,229,220,.34); border-radius: 3px;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.consent-btn:hover { border-color: #e8e5dc; }
.consent-btn:active { transform: translateY(1px); }
/* Neither answer is dressed up as the good one. Yes is legible, no is
   equally reachable — a "decline" hidden in grey 10px text is a dark
   pattern and would make the whole bar dishonest. */
.consent-btn--yes { background: #c1121f; border-color: #c1121f; color: #fff; }
.consent-btn--yes:hover { filter: brightness(1.1); border-color: #c1121f; }
@media (max-width: 560px) {
  .consent { padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px)); }
  .consent-acts { width: 100%; }
  .consent-acts .consent-btn { flex: 1; }
}
`;

function ensureConsentCss() {
  if (document.getElementById("kaz6-consent-css")) return;
  const style = document.createElement("style");
  style.id = "kaz6-consent-css";
  style.textContent = CONSENT_CSS;
  document.head.appendChild(style);
}

function renderConsent() {
  const existing = document.querySelector(".consent");
  if (consentState() !== null) { if (existing) existing.remove(); return; }
  if (existing || !document.body) return;
  ensureConsentCss();

  const bar = document.createElement("aside");
  bar.className = "consent";
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", "Visit counting");

  const text = document.createElement("p");
  text.className = "consent-text";
  text.innerHTML =
    "This site keeps a private count of who visits. Saying yes stores one " +
    "random number in your browser so two visits can be told apart — " +
    "nothing else, no cookies, and nobody else sees it. " +
    '<a href="/privacy.html">What’s stored</a>.';

  const acts = document.createElement("div");
  acts.className = "consent-acts";

  const yes = document.createElement("button");
  yes.type = "button";
  yes.className = "consent-btn consent-btn--yes";
  yes.textContent = "That’s fine";
  yes.addEventListener("click", () => setConsent("yes"));

  const no = document.createElement("button");
  no.type = "button";
  no.className = "consent-btn";
  no.textContent = "No thanks";
  no.addEventListener("click", () => setConsent("no"));

  acts.append(yes, no);
  bar.append(text, acts);
  document.body.appendChild(bar);
}

/* ---------- boot ---------------------------------------------------------- */

let ready = null;

/* This is a module, so it executes BEFORE DOMContentLoaded fires — while
   render.js builds the nav ON that event. Painting the chip straight away
   would therefore look for a slot that does not exist yet and silently do
   nothing. Wait for the document, then yield once more so render.js has
   had its turn, exactly as main.js does for the same reason. */
function whenReady() {
  return new Promise((resolve) => {
    const go = () => setTimeout(resolve, 0);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", go, { once: true });
    } else {
      go();
    }
  });
}

async function boot() {
  session = loadSession();
  const returned = consumeCallback();
  if (session) {
    await loadProfile();
    if (returned) await stitchProfile();
  }
  /* the visit does not wait on the DOM — it only needs the session, and a
     slow-rendering page should still be counted */
  recordVisit();
  await whenReady();
  render();
  renderConsent();
  return { visitorId: getVisitorId(), user: session ? session.user : null, profile };
}

/* One boot per page, shared by everything that imports this. */
ready = boot();

/* The public surface. LU'LU'A and FAREEJ read this off window; the site's
   own pages import it. Same object either way. */
const account = {
  ready,
  signIn,
  signOut,
  getVisitorId,
  recordVisit,
  isSignedIn: () => Boolean(session),
  /** "yes" | "no" | null. Exposed so the privacy page can show the current
      answer and offer to change it — a consent you cannot withdraw is not
      a consent. */
  consent: consentState,
  setConsent,
  /** A live access token for callers that query on the owner's behalf —
      the dashboard. Refreshes if it is about to expire; null when signed
      out, which is the dashboard's cue to show its sign-in prompt. */
  token: getToken,
  /** The signed-in person's display name, or null. Used by the games to put
      a real name on a seat instead of "Seat 2". */
  displayName: () => {
    if (!profile) return null;
    const n = profile.full_name || profile.email || "";
    return n ? String(n).trim().split(/\s+/)[0] : null;
  },
  profile: () => profile,
};

if (typeof window !== "undefined") window.kaz6account = account;

export default account;
export { signIn, signOut, getVisitorId, recordVisit, ready };
