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

/** The durable anonymous id for this browser. Created on first arrival. */
function getVisitorId() {
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
  try {
    await rest(`profiles?id=eq.${profile.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ visitor_id: getVisitorId(), last_seen_at: new Date().toISOString() }),
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
