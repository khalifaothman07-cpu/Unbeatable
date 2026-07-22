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

const ARROW =
  '<svg class="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';

/* --- BRANDS (sourced names) ---------------------------------------- */
function renderBrands() {
  const m = document.getElementById("brands-row");
  if (!m) return;
  // duplicate once for a seamless marquee loop
  const one = IAM.brands.map((b) => `<span class="brand">${esc(b)}</span>`).join("");
  m.innerHTML = one + one;
}

/* --- PILLARS (the model) ------------------------------------------- */
function renderPillars() {
  const m = document.getElementById("pillars-grid");
  if (!m) return;
  m.innerHTML = IAM.pillars
    .map(
      (p, i) => `
      <article class="pillar reveal d${(i % 3) + 1}">
        <span class="pillar-k">${esc(p.k)}</span>
        <h3 class="pillar-title">${esc(p.title)}</h3>
        <p class="pillar-desc">${esc(p.desc)}</p>
      </article>`
    )
    .join("");
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
        <span class="link-handle">${esc(l.handle)} ${ARROW}</span>
      </a>`
    )
    .join("");
}

/* --- STATIC TEXT FROM DATA ----------------------------------------- */
function renderStaticBits() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("brand-mark", IAM.brand);
  set("brand-parent", IAM.parent);
  set("hero-statement", IAM.statement);
  set("hero-tagline", IAM.tagline);
  set("hero-status", IAM.status);
  set("why-copy", IAM.why);
  set("disclaimer", IAM.disclaimer);
  const studio = document.getElementById("studio-link");
  if (studio && IAM.studioUrl) { studio.setAttribute("href", IAM.studioUrl); }
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  document.querySelectorAll("[data-brand]").forEach((el) => (el.textContent = IAM.brand));
}

function renderAll() {
  renderBrands();
  renderPillars();
  renderLinks();
  renderStaticBits();
}
