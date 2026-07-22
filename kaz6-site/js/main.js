/* ============================================================
   main.js  ·  BEHAVIOUR (runs after render)
   nav scroll state + scroll progress bar. That's the whole file —
   the site's one orchestrated motion moment (the index hero
   scorewall) runs on pure CSS at load, not scroll; everything
   else on the page is static by design.
   ============================================================ */
(function () {
  function boot() {
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
