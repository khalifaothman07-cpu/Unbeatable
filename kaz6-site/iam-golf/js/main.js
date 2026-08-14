/* =========================================================================
   main.js  —  IAM GOLF · INTERACTIONS
   -------------------------------------------------------------------------
   Runs renderAll(), then wires scroll-reveal and the scroll progress bar.
   No content here — content lives in data.js.
   ========================================================================= */

(function () {
  renderAll();

  /* ---- THEME ------------------------------------------------------------
     Same three states and the same storage key as the parent site, so a
     choice made on KAZ6 carries into IAM GOLF and back. A copy of the
     apply step runs inline in <head> before first paint; this half owns
     the button and the system-change listener. */
  (function theme() {
    const KEY = "kaz6.theme";
    const ORDER = ["auto", "light", "dark"];
    const LABEL = { auto: "Auto", light: "Light", dark: "Dark" };
    let t = "auto";
    try {
      const v = localStorage.getItem(KEY);
      if (ORDER.indexOf(v) >= 0) t = v;
    } catch (e) { /* storage off */ }

    function apply() {
      const root = document.documentElement;
      if (t === "auto") root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", t);
      const bg = getComputedStyle(root).getPropertyValue("--paper").trim();
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && bg) meta.setAttribute("content", bg);
      const btn = document.getElementById("themeBtn");
      if (btn) btn.textContent = LABEL[t];
    }

    apply();
    const btn = document.getElementById("themeBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        t = ORDER[(ORDER.indexOf(t) + 1) % ORDER.length];
        try { localStorage.setItem(KEY, t); } catch (e) { /* storage off */ }
        apply();
      });
    }
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = function () { if (t === "auto") apply(); };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  })();

  /* currency picker — render.js owns the state and the re-render, this
     just forwards the choice. Delegated off the container so it survives
     renderPricing() replacing the ledger underneath it. */
  const curHost = document.getElementById("price-currency");
  if (curHost) {
    curHost.addEventListener("change", (e) => {
      if (e.target && e.target.id === "cur-select") setCurrency(e.target.value);
    });
  }

  /* scroll-reveal */
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  /* scroll progress bar + nav state (flips off the dark hero) */
  const bar = document.getElementById("progress");
  const nav = document.querySelector(".nav");
  const hero = document.querySelector(".hero");
  const onScroll = () => {
    const h = document.documentElement;
    if (bar) {
      const max = h.scrollHeight - h.clientHeight;
      bar.style.transform = `scaleX(${max > 0 ? h.scrollTop / max : 0})`;
    }
    if (nav && hero) {
      nav.classList.toggle("scrolled", h.scrollTop > hero.offsetHeight - 80);
    }
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
