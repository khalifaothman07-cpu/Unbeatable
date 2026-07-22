/* =========================================================================
   main.js  —  IAM GOLF · INTERACTIONS
   -------------------------------------------------------------------------
   Runs renderAll(), then wires scroll-reveal and the scroll progress bar.
   No content here — content lives in data.js.
   ========================================================================= */

(function () {
  renderAll();

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
