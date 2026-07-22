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
      .map(
        (r) => `
        <div class="row">
          <span class="k">${esc(r.k)}</span>
          <span class="lead-dots" aria-hidden="true"></span>
          <span class="v">${esc(r.v)}</span>
        </div>`
      )
      .join("");
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
  host.innerHTML = `
    <div class="ref-grid">
      <span class="ref-amount">${esc(r.amount)}</span>
      <div class="ref-copy">
        <h2 class="ref-head">${esc(r.headline)}</h2>
        <p class="ref-body">${esc(r.body)}</p>
        <p class="ref-terms">${esc(r.terms)}</p>
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
      .map((row) => `<li><span class="k">${esc(row.k)}:</span> ${esc(row.v)}</li>`)
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
  renderPricing();
  renderReferral();
  renderFollowMedia();
  renderLinks();
  renderFooter();
  renderStaticBits();
}
