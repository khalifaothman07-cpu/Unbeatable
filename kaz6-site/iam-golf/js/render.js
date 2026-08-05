/* =========================================================================
   render.js  —  IAM GOLF · RENDER LAYER
   -------------------------------------------------------------------------
   Reads from the global IAM object (data.js) and injects every repeating
   block. Pure DOM building — no event wiring (that lives in main.js).
   ========================================================================= */

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

/* --- BRANDS (sourced names) ---------------------------------------- */
function renderBrands() {
  const m = document.getElementById("brands-row");
  if (!m) return;
  // duplicate once for a seamless marquee loop
  const one = IAM.brands.map((b) => `<span class="brand">${esc(b)}</span>`).join("");
  m.innerHTML = one + one;
}

/* --- PILLARS (the model — a real I→III sequence) --------------------- */
function renderPillars() {
  const m = document.getElementById("pillars-grid");
  if (!m) return;
  m.innerHTML = IAM.pillars
    .map((p) => {
      const media = p.img
        ? `<figure class="media pillar-media"><img src="${esc(p.img)}" alt="${esc(p.title)}" loading="lazy" onerror="this.closest('.pillar-media').classList.add('awaiting')"><span class="media-await">Awaiting asset</span></figure>`
        : "";
      return `
      <article class="pillar reveal">
        ${media}
        <span class="pillar-k">${esc(p.k)}</span>
        <h3 class="pillar-title">${esc(p.title)}</h3>
        <p class="pillar-desc">${esc(p.desc)}</p>
      </article>`;
    })
    .join("");
}

/* --- CURRENCY -------------------------------------------------------
   BD is the currency of sale; everything else is an indicative
   conversion. State is a plain variable — it deliberately resets on
   reload rather than persisting (no localStorage in this build). */
let activeCurrency = (IAM.currency && IAM.currency.options[0]) || null;

function currencyByCode(code) {
  if (!IAM.currency) return null;
  return IAM.currency.options.find((o) => o.code === code) || null;
}

/* exposed for main.js — render layer owns the state, main.js owns events */
function setCurrency(code) {
  const next = currencyByCode(code);
  if (!next) return;
  activeCurrency = next;
  renderPricing();
  renderReferral();   /* the referral discount tracks the same currency */
}

/* Round to something a human would read off a price list. BD and OMR
   sit near parity so they keep their precision; the rest are big
   enough numbers that trailing digits would imply false accuracy. */
function roundAmount(n, cur) {
  if (cur.per <= 1.2) return Math.round(n);
  return Math.round(n / 5) * 5;
}

function formatAmount(range, cur) {
  const parts = range.map((v) => roundAmount(v * cur.per, cur).toLocaleString("en-US"));
  const span = parts[0] === parts[1] ? parts[0] : parts[0] + "–" + parts[1];
  return span + " " + cur.label;
}

function renderCurrencyPicker() {
  const host = document.getElementById("price-currency");
  const c = IAM.currency;
  if (!host || !c) return;
  const opts = c.options
    .map((o) => `<option value="${esc(o.code)}"${o.code === activeCurrency.code ? " selected" : ""}>${esc(o.label)}</option>`)
    .join("");
  host.innerHTML = `
    <label class="cur-label" for="cur-select">${esc(c.label)}</label>
    <select class="cur-select" id="cur-select">${opts}</select>`;
}

/* --- PRICING (the ledger) ------------------------------------------- */
function renderPricing() {
  const p = IAM.pricing;
  if (!p) return;
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("price-headline", p.headline);
  set("price-sub", p.sub);
  set("price-branded", p.branded);
  set("price-local", p.local);

  const ledger = document.getElementById("price-ledger");
  if (ledger) {
    ledger.innerHTML = p.ledger
      .map((r) => {
        const v = r.range && activeCurrency ? formatAmount(r.range, activeCurrency) : r.v;
        return `
        <div class="row">
          <span class="k">${esc(r.k)}</span>
          <span class="lead-dots" aria-hidden="true"></span>
          <span class="v">${esc(v)}</span>
        </div>`;
      })
      .join("");
  }

  /* the conversion caveat only earns its place once you're off BD */
  const note = document.getElementById("price-cur-note");
  if (note && IAM.currency) {
    const converted = activeCurrency && !activeCurrency.sale;
    note.textContent = converted ? IAM.currency.note : "";
    note.hidden = !converted;
  }

  const inc = document.getElementById("price-includes");
  if (inc) {
    inc.innerHTML = p.includes.map((it) => `<li>${esc(it)}</li>`).join("");
  }
}

/* --- KIT PLATE (media) ---------------------------------------------- */
function renderKitPlate() {
  const host = document.getElementById("kit-plate");
  const m = IAM.kitMedia;
  if (!host || !m) return;
  const inner = m.src
    ? `<img class="plate-media" src="${esc(m.src)}" alt="${esc(m.alt || "")}" loading="lazy"
         onerror="this.closest('.plate').classList.add('awaiting')">`
    : "";
  host.innerHTML = `
    <figure class="plate${m.src ? "" : " awaiting"}" style="margin-top:var(--s8)">
      <div class="plate-frame">${inner}<span class="plate-await">Awaiting asset · ${esc(m.src || "")}</span></div>
      <figcaption class="plate-cap"><span>${esc(m.cap || "")}</span><span class="plate-alt">${esc(m.alt || "")}</span></figcaption>
    </figure>`;
}


/* --- FOLLOW REEL IMAGE --------------------------------------------- */
function renderFollowMedia() {
  const host = document.getElementById("follow-media");
  const m = IAM.followMedia;
  if (!host) return;
  const has = m && m.src;
  const img = has
    ? `<img src="${esc(m.src)}" alt="${esc(m.alt || "")}" loading="lazy" onerror="this.closest('.media').classList.add('awaiting')">`
    : "";
  host.innerHTML = `<figure class="media follow-media${has ? "" : " awaiting"}">${img}<span class="media-await">Awaiting asset · launch reel</span></figure>`;
}

/* --- LINKS (real channels only) ------------------------------------ */
function renderLinks() {
  const m = document.getElementById("links-list");
  if (!m) return;
  m.innerHTML = IAM.links
    .map(
      (l) => `
      <a class="link-row" href="${esc(l.url)}" target="_blank" rel="noopener">
        <span class="link-name">${esc(l.name)}</span>
        <span class="lead-dots" aria-hidden="true"></span>
        <span class="link-handle">${esc(l.handle)} ↗</span>
      </a>`
    )
    .join("");
}



/* --- FEATURE PANEL (big rounded — intentional when empty) ---------- */
function renderFeature() {
  const host = document.getElementById("feature-panel");
  const f = IAM.featureMedia;
  if (!host) return;
  const has = f && f.src;
  const img = has
    ? `<img src="${esc(f.src)}" alt="" loading="lazy" onerror="this.closest('.feature-panel').classList.add('awaiting')">`
    : "";
  host.innerHTML = `
    <div class="feature-panel${has ? "" : " awaiting"}">
      ${img}
      <span class="feature-mark" data-brand-mono></span>
      <span class="feature-cap">${esc((f && f.cap) || "")}</span>
    </div>`;
}

/* --- REFERRAL (public CTA — one bold number) ----------------------- */
function renderReferral() {
  const host = document.getElementById("referral");
  const r = IAM.referral;
  if (!host || !r) return;
  /* the discount follows the pricing picker, so it never reads
     "2,260–2,395 USD" upstairs and "50 BD off" down here */
  const cur = activeCurrency || currencyByCode("BHD");
  const amount = formatAmount([r.amountBD, r.amountBD], cur);
  const terms = cur && !cur.sale && r.anchor ? r.terms + " · " + r.anchor : r.terms;
  host.innerHTML = `
    <div class="ref-grid">
      <span class="ref-amount">${esc(amount)}</span>
      <div class="ref-copy">
        <h2 class="ref-head">${esc(r.headline)}</h2>
        <p class="ref-body">${esc(r.body).replace("{amount}", esc(amount))}</p>
        <p class="ref-terms">${esc(terms)}</p>
      </div>
    </div>`;
}


/* --- FOOTER COLUMNS (contact + price-rule summary) ----------------- */
function renderFooter() {
  const c = document.getElementById("foot-contact");
  if (c && IAM.contact) {
    c.innerHTML = "<h4>Contact</h4>" + IAM.contact
      .map((x) => x.url
        ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.value)} ↗</a>`
        : `<p>${esc(x.value)}</p>`)
      .join("");
  }
  const fr = document.getElementById("foot-rule");
  if (fr && IAM.pricing && IAM.pricing.ledger) {
    fr.innerHTML = IAM.pricing.ledger
      .map((row) => {
        /* footer stays in BD — it's a static summary, not the live picker */
        const v = row.range ? formatAmount(row.range, currencyByCode("BHD")) : row.v;
        return `<li><span class="k">${esc(row.k)}:</span> ${esc(v)}</li>`;
      })
      .join("");
  }
}

/* --- STATIC TEXT FROM DATA ----------------------------------------- */
function renderStaticBits() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("hero-tagline", IAM.tagline);
  set("hero-status", IAM.status);
  set("why-copy", IAM.why);
  set("disclaimer", IAM.disclaimer);
  set("foot-tag", IAM.footTag);
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  document.querySelectorAll("[data-brand], [data-brand-mono]").forEach((el) => {
    el.textContent = IAM.brand;              /* real text, not constructed SVG */
    el.classList.add("wordmark");
    el.setAttribute("aria-label", IAM.brandSpoken || IAM.brand);
  });
}

function renderAll() {
  renderFeature();
  renderBrands();
  renderKitPlate();
  renderPillars();
  renderCurrencyPicker();
  renderPricing();
  renderReferral();
  renderFollowMedia();
  renderLinks();
  renderFooter();
  renderStaticBits();
}
