/* ============================================================
   main.js  ·  BEHAVIOUR (runs after render)
   nav scroll state + scroll progress bar. That's the whole file —
   the site's one orchestrated motion moment (the index hero
   scorewall) runs on pure CSS at load, not scroll; everything
   else on the page is static by design.
   ============================================================ */
(function () {
  /* ---- THEME -------------------------------------------------------------
     Three states, because "auto" is the one most people want: a phone that
     goes dark at sunset should take the site with it. Light and Dark are for
     when the room disagrees with the operating system.

     The choice is applied to <html data-theme> and remembered. A tiny copy of
     this runs inline in each page's <head> BEFORE first paint — without it a
     saved Dark flashes bone-white for a frame on every navigation, and this
     is a multi-page site, so that would be every single click. */
  const KEY = "kaz6.theme";
  const ORDER = ["auto", "light", "dark"];
  const LABEL = { auto: "Auto", light: "Light", dark: "Dark" };

  function readTheme() {
    try {
      const v = localStorage.getItem(KEY);
      return ORDER.indexOf(v) >= 0 ? v : "auto";
    } catch (e) { return "auto"; }
  }

  function applyTheme(t) {
    const root = document.documentElement;
    if (t === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", t);
    /* read the ground back off the page rather than restating it, so the
       browser chrome can never disagree with what is actually rendered */
    const bg = getComputedStyle(root).getPropertyValue("--paper").trim();
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    if (bg) meta.setAttribute("content", bg);
    const btn = document.getElementById("themeBtn");
    if (btn) {
      btn.textContent = LABEL[t];
      btn.setAttribute("data-theme-state", t);
    }
  }

  function bootTheme() {
    let t = readTheme();
    applyTheme(t);
    const btn = document.getElementById("themeBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        t = ORDER[(ORDER.indexOf(t) + 1) % ORDER.length];
        try { localStorage.setItem(KEY, t); } catch (e) { /* storage off */ }
        applyTheme(t);
      });
    }
    /* on auto, follow the device if it changes while the page is open */
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = function () { if (t === "auto") applyTheme("auto"); };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  function boot() {
    bootTheme();
    const nav = document.getElementById("nav");
    const bar = document.getElementById("progress");

    // nav state + progress — rAF-throttled; clamp rubber-band negatives;
    // hysteresis (on >24, off <4) so the class never flaps at the top
    let ticking = false;
    function update() {
      ticking = false;
      const y = Math.max(0, window.scrollY || 0);
      if (nav) {
        if (y > 24) nav.classList.add("scrolled");
        else if (y < 4) nav.classList.remove("scrolled");
      }
      if (bar) {
        const h = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = `scaleX(${h > 0 ? Math.min(y / h, 1) : 0})`;
      }
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
  }

  // render.js populates the DOM on DOMContentLoaded; run just after.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 0));
  } else {
    setTimeout(boot, 0);
  }
})();
