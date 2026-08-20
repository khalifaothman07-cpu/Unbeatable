/* ============================================================
   admin.js  ·  THE PRIVATE DASHBOARD
   ------------------------------------------------------------
   Reads public.visits and public.profiles with the signed-in
   owner's token. There is no secret here and no service key:
   the RLS policy on visits grants SELECT only to an account
   listed in public.admins, so this page shows a stranger
   exactly nothing. Anyone may open it; only one person sees
   data in it.

   AGGREGATION HAPPENS IN THE BROWSER. PostgREST cannot GROUP BY
   without a view or an RPC, and adding either means more SQL
   surface reachable with the publishable key. At this site's
   volume a month of rows is a few thousand at most, which is
   nothing to sort in JS. WINDOW_CAP below is the honest ceiling
   — if it is ever hit the page says so rather than quietly
   drawing a chart of the most recent slice and calling it the
   month.
   ============================================================ */

import account from "./account.js";

const SUPABASE_URL = "https://ngtpeamcaxdtghimdspz.supabase.co";
const SUPABASE_KEY = "sb_publishable_Td08KXJimYLQIbwS3fpPEA_-AfRp_Jl";

const DAYS = 30;
const WINDOW_CAP = 5000;

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* ---------- data ---------------------------------------------------------- */

async function query(path) {
  const token = await account.token();
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

/* ---------- shaping ------------------------------------------------------- */

const dayKey = (iso) => new Date(iso).toISOString().slice(0, 10);

function lastDays(n) {
  const out = [];
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

function tally(rows, pick) {
  const m = new Map();
  for (const r of rows) {
    const k = pick(r);
    if (k == null || k === "") continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/** A referrer is only interesting as where-they-came-from, so it collapses
    to a host. Ten rows of the same site with different query strings tells
    you less than one row with a count of ten. */
function host(url) {
  try { return new URL(url).host.replace(/^www\./, ""); } catch (e) { return url; }
}

/* ---------- marks --------------------------------------------------------- */

let tip = null;
function showTip(text, x, y) {
  if (!tip) { tip = el("div", "adm-tip"); document.body.appendChild(tip); }
  tip.textContent = text;
  tip.classList.add("on");
  /* keep it on screen near the right edge */
  const w = tip.offsetWidth || 90;
  tip.style.left = `${Math.min(x + 12, window.innerWidth - w - 8)}px`;
  tip.style.top = `${y - 34}px`;
}
function hideTip() { if (tip) tip.classList.remove("on"); }

const SVG = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs) => {
  const n = document.createElementNS(SVG, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

/**
 * A column chart of counts on discrete days.
 * Bars rather than a line: these are daily totals, and a line drawn between
 * two days with a gap between them describes traffic that did not happen.
 */
function timeChart(days, counts, label, width) {
  /* The viewBox width is a parameter because these charts appear at two
     sizes. The first draft used one 720-wide box for both and stretched it
     with preserveAspectRatio="none", which scales TEXT too — the axis
     labels in the half-width pair came out horizontally squashed. Scaling
     proportionally and choosing a narrower box for the small multiples
     keeps type at its real proportions in both. */
  const W = width || 720, H = 150, PAD_B = 18, PAD_T = 10;
  const max = Math.max(1, ...counts);
  const n = days.length;
  const slot = W / n;
  const GAP = 2;                       // the 2px surface gap between marks
  const bw = Math.max(2, slot - GAP);
  const plot = H - PAD_B - PAD_T;

  const svg = svgEl("svg", {
    class: "adm-chart", viewBox: `0 0 ${W} ${H}`, role: "img",
    "aria-label": `${label}: ${counts.reduce((a, b) => a + b, 0)} across ${n} days, peak ${max}`,
  });

  // recessive baseline, no grid — at this height a grid is more ink than data
  svg.appendChild(svgEl("line", { class: "adm-rule", x1: 0, y1: H - PAD_B, x2: W, y2: H - PAD_B }));

  days.forEach((d, i) => {
    const v = counts[i];
    const x = i * slot + GAP / 2;
    if (v > 0) {
      const h = Math.max(2, (v / max) * plot);
      const y = H - PAD_B - h;
      /* 4px rounded data-end, square where it meets the baseline: the round
         corner marks where the value STOPS, so rounding both ends would
         round the zero too. */
      const r = Math.min(4, bw / 2, h);
      const bar = svgEl("path", {
        class: "adm-bar",
        d: `M${x},${H - PAD_B} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + bw - r},${y} Q${x + bw},${y} ${x + bw},${y + r} L${x + bw},${H - PAD_B} Z`,
      });
      svg.appendChild(bar);
    }
    /* a hit target the full height of the plot — a 3px bar is not something
       you can point at, and an empty day should still answer "zero" */
    const hit = svgEl("rect", { class: "adm-bar-hit", x: i * slot, y: PAD_T, width: slot, height: plot });
    const pretty = new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, {
      weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
    });
    hit.addEventListener("pointerenter", (e) => showTip(`${pretty} · ${v}`, e.clientX, e.clientY));
    hit.addEventListener("pointermove", (e) => showTip(`${pretty} · ${v}`, e.clientX, e.clientY));
    hit.addEventListener("pointerleave", hideTip);
    svg.appendChild(hit);
  });

  // first and last date only. Thirty rotated labels is a wall, not an axis.
  const fmt = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
  const a = svgEl("text", { class: "adm-axis", x: 0, y: H - 5 });
  a.textContent = fmt(days[0]);
  const b = svgEl("text", { class: "adm-axis", x: W, y: H - 5, "text-anchor": "end" });
  b.textContent = fmt(days[n - 1]);
  const peak = svgEl("text", { class: "adm-axis", x: 0, y: PAD_T + 2 });
  peak.textContent = `peak ${max}`;
  svg.append(a, b, peak);
  return svg;
}

/** A ranked horizontal bar list. Every row carries its own number, so the
    chart never depends on reading a bar against an axis. */
function rankList(entries, limit, emptyText) {
  const box = el("div", "adm-rank");
  if (!entries.length) {
    box.appendChild(el("p", "adm-empty", emptyText));
    return box;
  }
  const max = entries[0][1];
  for (const [k, v] of entries.slice(0, limit)) {
    const row = el("div", "adm-row");
    const key = el("span", "adm-row-k", k);
    key.title = k;
    const bar = el("div", "adm-row-bar");
    const fill = el("div", "adm-row-fill");
    fill.style.width = `${Math.max(2, (v / max) * 100)}%`;
    bar.appendChild(fill);
    row.append(key, el("span", "adm-row-v", String(v)), bar);
    box.appendChild(row);
  }
  return box;
}

function figure(title, note, body) {
  const f = el("figure", "adm-fig");
  const h = el("div", "adm-fig-h");
  h.append(el("figcaption", "adm-fig-t", title), el("span", "adm-fig-n", note || ""));
  f.append(h, body);
  return f;
}

/* ---------- render -------------------------------------------------------- */

function gate(title, body, withButton) {
  const box = el("div", "adm-gate");
  box.append(el("h2", null, title), el("p", null, body));
  if (withButton) {
    const b = el("button", "adm-signin", "Sign in with Google");
    b.type = "button";
    b.addEventListener("click", () => account.signIn());
    box.appendChild(b);
  }
  $("#admBody").replaceChildren(box);
}

function relative(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

async function draw() {
  const since = new Date(Date.now() - DAYS * 86400000).toISOString();
  const [visits, profiles] = await Promise.all([
    query(`visits?select=at,path,title,game,device,referrer,visitor_id,user_id&at=gte.${since}&order=at.desc&limit=${WINDOW_CAP}`),
    query("profiles?select=id,full_name,email,avatar_url,visitor_id"),
  ]);

  if (visits === null) {
    gate(
      "Not your dashboard",
      "You’re signed in, but this account isn’t the owner. There’s nothing to show you here — " +
      "the database refuses the read, not just this page.",
      false
    );
    return;
  }

  const body = $("#admBody");
  body.replaceChildren();

  if (!visits.length) {
    body.appendChild(el("p", "adm-empty",
      "No visits recorded yet. Open the site in another browser and this fills up."));
    return;
  }

  /* --- who is who ------------------------------------------------------- */
  const byId = new Map((profiles || []).map((p) => [p.id, p]));
  const byVisitor = new Map();
  for (const p of profiles || []) if (p.visitor_id) byVisitor.set(p.visitor_id, p);
  /* A visit gets a name from its own user_id, or — and this is the point of
     keeping visitor_id across a sign-in — from the profile that later
     claimed that browser. That is how visits from BEFORE someone signed in
     end up with their name on them. */
  const nameFor = (v) => byId.get(v.user_id) || byVisitor.get(v.visitor_id) || null;

  /* --- tiles -------------------------------------------------------------
     A null visitor_id means that person had not answered the consent bar,
     so nothing was stored on their device and this view cannot be joined to
     any other. Those views are REAL and are counted in the totals, but they
     can never be counted as visitors — adding them in would inflate the
     figure with people we cannot actually distinguish. They get their own
     line instead. */
  const identified = visits.filter((v) => v.visitor_id);
  const anonymous = visits.length - identified.length;
  const visitors = new Set(identified.map((v) => v.visitor_id));
  const known = new Set(visits.map(nameFor).filter(Boolean).map((p) => p.id));
  /* "returning" within this window: seen on more than one distinct day.
     Defined against the window, not all of history, so it stays computable
     from what is on screen. */
  const daysSeen = new Map();
  for (const v of identified) {
    if (!daysSeen.has(v.visitor_id)) daysSeen.set(v.visitor_id, new Set());
    daysSeen.get(v.visitor_id).add(dayKey(v.at));
  }
  const returners = [...daysSeen.values()].filter((s) => s.size > 1).length;
  const pct = visitors.size ? Math.round((returners / visitors.size) * 100) : 0;

  const tiles = el("div", "adm-tiles");
  const tile = (k, v, n) => {
    const t = el("div", "adm-tile");
    t.append(el("span", "adm-tile-k", k), el("div", "adm-tile-v", String(v)), el("span", "adm-tile-n", n));
    return t;
  };
  tiles.append(
    tile("Visitors", visitors.size, `distinct browsers, ${DAYS} days`),
    tile("Views", visits.length, anonymous
      ? `${anonymous} of them uncounted as visitors`
      : "pages and games opened"),
    tile("Signed in", known.size, known.size === 1 ? "person with a name" : "people with names"),
    tile("Returning", `${pct}%`, "came back on another day")
  );
  body.appendChild(tiles);

  /* --- time --------------------------------------------------------------- */
  const days = lastDays(DAYS);
  const idx = new Map(days.map((d, i) => [d, i]));

  const uniqPerDay = days.map(() => new Set());
  for (const v of identified) {
    const i = idx.get(dayKey(v.at));
    if (i != null) uniqPerDay[i].add(v.visitor_id);
  }

  /* First day we see a browser inside this window counts as new; every later
     day it returns. Both are relative to the window, and the note says so. */
  const firstDay = new Map();
  for (const v of [...identified].reverse()) {
    if (!firstDay.has(v.visitor_id)) firstDay.set(v.visitor_id, dayKey(v.at));
  }
  const newPerDay = days.map(() => 0);
  const retPerDay = days.map(() => 0);
  uniqPerDay.forEach((set, i) => {
    for (const vid of set) {
      if (firstDay.get(vid) === days[i]) newPerDay[i]++;
      else retPerDay[i]++;
    }
  });

  const figs = el("div", "adm-figs");
  figs.appendChild(figure(
    "Visitors a day",
    `${DAYS} days`,
    timeChart(days, uniqPerDay.map((s) => s.size), "Visitors a day")
  ));

  /* Two charts rather than two colours. The site has exactly one accent, and
     inventing a second hue to stack these would look like a different site;
     small multiples say the same thing and need no legend. */
  const pair = el("div", "adm-pair");
  pair.append(
    figure("New", "first seen in the window", timeChart(days, newPerDay, "New visitors a day", 360)),
    figure("Returning", "seen on an earlier day", timeChart(days, retPerDay, "Returning visitors a day", 360))
  );
  figs.appendChild(pair);
  body.appendChild(figs);

  /* --- ranked ------------------------------------------------------------- */
  const games = tally(visits, (v) => v.game);
  const pages = tally(visits.filter((v) => !v.game), (v) => v.path);
  const refs = tally(visits, (v) => (v.referrer ? host(v.referrer) : null));
  const devices = tally(visits, (v) => v.device);

  const grid = el("div", "adm-grid");
  grid.append(
    figure("Games opened", "by views", rankList(games, 8, "No games opened yet.")),
    figure("Pages", "site only", rankList(pages, 8, "No page views yet.")),
    figure("Came from", "external referrers", rankList(refs, 8, "Everyone arrived directly or with the referrer stripped.")),
    figure("Devices", "by views", rankList(devices, 4, "—"))
  );
  body.appendChild(grid);

  /* --- recent -------------------------------------------------------------- */
  const wrap = el("div", "adm-tablewrap");
  const table = el("table", "adm-table");
  const thead = el("thead");
  const hr = el("tr");
  for (const h of ["When", "Who", "What", "Device"]) hr.appendChild(el("th", null, h));
  thead.appendChild(hr);
  const tbody = el("tbody");

  for (const v of visits.slice(0, 40)) {
    const tr = el("tr");
    const whenCell = el("td");
    whenCell.appendChild(el("span", "adm-when", relative(v.at)));
    tr.appendChild(whenCell);

    const whoCell = el("td");
    const p = nameFor(v);
    if (p) {
      const who = el("span", "adm-who");
      if (p.avatar_url) {
        const img = el("img");
        img.src = p.avatar_url; img.alt = ""; img.referrerPolicy = "no-referrer";
        img.addEventListener("error", () => img.remove());
        who.appendChild(img);
      }
      who.appendChild(document.createTextNode(p.full_name || p.email || "Signed in"));
      whoCell.appendChild(who);
    } else if (v.visitor_id) {
      const anon = el("span", "adm-anon", v.visitor_id.slice(0, 8));
      anon.title = "Anonymous visitor — this is their browser's id";
      whoCell.appendChild(anon);
    } else {
      /* no id at all: they had not answered the consent bar, so nothing was
         stored and this view stands alone */
      const none = el("span", "adm-anon", "—");
      none.title = "Hadn’t answered the consent bar, so nothing was stored on their device. This view can’t be linked to any other.";
      whoCell.appendChild(none);
    }
    tr.appendChild(whoCell);

    const what = el("td");
    what.appendChild(el("div", null, v.title || v.path));
    what.appendChild(el("div", "adm-path", v.path));
    tr.appendChild(what);

    tr.appendChild(el("td", "adm-anon", v.device || "—"));
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);
  wrap.appendChild(table);
  body.appendChild(figure("Recently", `last ${Math.min(40, visits.length)}`, wrap));

  const notes = [];
  if (visits.length >= WINDOW_CAP) {
    notes.push(`Showing the most recent ${WINDOW_CAP} views — the window is full, so the totals above are a floor, not the whole month.`);
  }
  notes.push("New and returning are measured against this 30-day window, not all of history.");
  notes.push("A visitor is one browser. The same person on a phone and a laptop counts twice until they sign in on both.");
  if (anonymous) {
    notes.push(
      `${anonymous} view${anonymous === 1 ? "" : "s"} shown as “—” came from someone who hadn’t answered ` +
      "the consent bar, so nothing was stored on their device. They count in Views and in the page and " +
      "referrer lists, and they can never count as visitors — there is no way to tell whether two of them " +
      "were the same person. Anyone who declined outright isn’t here at all."
    );
  }
  body.appendChild(el("p", "adm-note", notes.join(" ")));
}

/* ---------- boot ---------------------------------------------------------- */

account.ready.then(async () => {
  if (!account.isSignedIn()) {
    gate(
      "Sign in to see this",
      "This page is the visit log for kaz6 — who opened the site and the games, and when. " +
      "It only ever opens for the owner’s account.",
      true
    );
    return;
  }
  try {
    await draw();
  } catch (err) {
    gate("Something broke", `The dashboard could not be drawn: ${err.message}`, false);
  }
});
