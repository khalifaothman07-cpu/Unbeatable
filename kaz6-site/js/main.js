/* ============================================================
   main.js  ·  BEHAVIOUR (runs after render)
   nav scroll state · scroll progress bar · reveal-on-scroll.
   Transforms/opacity only. prefers-reduced-motion safe.
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

    // reveal-on-scroll
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = document.querySelectorAll(".reveal");
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => io.observe(el));
  }

  // render.js populates the DOM on DOMContentLoaded; run just after.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 0));
  } else {
    setTimeout(boot, 0);
  }
})();
