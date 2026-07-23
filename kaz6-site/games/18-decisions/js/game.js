/* =========================================================================
   game.js  —  18 DECISIONS · GAME (choices, juice, flow)
   -------------------------------------------------------------------------
   Two-step decision, no aiming: pick a CLUB from the full 14-club bag, then
   pick one of THREE shots for that club (Full / Controlled / Punch — or three
   putt reads on the green). Risk and reward are measured against the real
   hole. Strike feedback, birdie celebrations, a heater streak, 9-or-18, and a
   saved best. Intro -> holes -> scorecard.
   ========================================================================= */
(function () {
  const Course = window.Course, Sim = window.Sim, Renderer = window.Renderer, Choices = window.Choices, CLUBS = window.CLUBS;
  const HOLES = Course.HOLES;
  const app = document.getElementById("app");
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const G = { screen: "intro", holes: 18, hi: 0, hole: null, ball: [0, 0], lie: "tee", shots: 0, scores: [], phase: "bag", bag: null, club: null, shots3: [], selShot: 0, anim: null, burst: null, raf: null, busy: false, streak: 0 };

  const SURF = { tee: "Tee", fairway: "Fairway", fringe: "Fringe", rough: "Rough", bunker: "Bunker", trees: "Trees", green: "Green", water: "Water", ob: "O.B." };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtPar = (n) => (n === 0 ? "E" : n > 0 ? "+" + n : "\u2212" + Math.abs(n));
  const scoreName = (v) => ({ "-3": "Albatross", "-2": "Eagle", "-1": "Birdie", "0": "Par", "1": "Bogey", "2": "Double Bogey", "3": "Triple Bogey" })[String(v)] || (v < -3 ? "Albatross" : "+" + v);
  const scoreClass = (v) => (v <= -2 ? "eagle" : v === -1 ? "birdie" : v === 0 ? "par" : v === 1 ? "bogey" : "double");
  const parThrough = (n) => HOLES.slice(0, n).reduce((a, h) => a + h.par, 0);
  const toPar = () => G.scores.reduce((a, s, i) => a + (s - HOLES[i].par), 0);

  function getBest(h) { try { const v = localStorage.getItem("kaz6_18d_best" + h); return v == null ? null : +v; } catch (e) { return null; } }
  function setBest(h, tp) { try { const c = getBest(h); if (c == null || tp < c) { localStorage.setItem("kaz6_18d_best" + h, String(tp)); return true; } } catch (e) {} return false; }
  function grade(tp, holes) {
    const per = tp / holes;
    if (per <= -0.55) return { l: "LEGENDARY", b: "A round that doesn't happen." };
    if (per <= -0.22) return { l: "EXCEPTIONAL", b: "You took the course apart." };
    if (per < 0) return { l: "UNDER PAR", b: "Read it, managed it, beat it." };
    if (per === 0) return { l: "LEVEL PAR", b: "Steady. The course gave nothing away." };
    if (per <= 0.34) return { l: "SOLID", b: "A few gambles bit back." };
    if (per <= 0.8) return { l: "OVER PAR", b: "Pick the percentage play more often." };
    return { l: "ROUGH DAY", b: "Course management is the whole game." };
  }
  const arrow = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const riskMeter = (r) => { let b = ""; for (let i = 1; i <= 4; i++) b += `<span class="rb ${i <= r.lvl ? "on l" + r.lvl : ""}"></span>`; return `<span class="risk"><span class="rbars">${b}</span><span class="rlbl l${r.lvl}">${esc(r.label)}</span></span>`; };

  /* ---------------- INTRO ---------------- */
  function showIntro() {
    G.screen = "intro"; stopLoop();
    const b = getBest(G.holes);
    app.innerHTML = `
      <section class="screen intro">
        <div class="introWrap motif-fairway">
          <a class="kaz6-home" href="../../index.html">← KAZ6</a>
          <p class="eyebrow">KAZ6 Studio \u00b7 Golf</p>
          <h1 class="wordmark">18 Decisions</h1>
          <p class="tagline">Eighteen holes, fourteen clubs, one decision a shot. Chase the green or play the percentages \u2014 then live with the bounce.</p>
          <div class="specStrip" aria-hidden="true">D \u00b7 3W \u00b7 5W \u00b7 3H \u00b7 4I \u00b7 5I \u00b7 6I \u00b7 7I \u00b7 8I \u00b7 9I \u00b7 PW \u00b7 GW \u00b7 SW \u00b7 PT</div>
          <div class="startRow">
            <div class="rounds"><span class="rLbl">Round</span>
              <div class="seg" id="seg">
                <button class="segBtn ${G.holes === 9 ? "on" : ""}" data-h="9">9</button>
                <button class="segBtn ${G.holes === 18 ? "on" : ""}" data-h="18">18</button>
              </div>
            </div>
            <button class="start" id="play">Begin round ${arrow}</button>
          </div>
          <p class="best">${b != null ? `Best \u00b7 ${G.holes === 9 ? "Front 9" : "Full 18"} <b>${fmtPar(b)}</b>` : "No round saved yet"}</p>
        </div>
      </section>`;
    document.querySelectorAll("#seg .segBtn").forEach((x) => x.onclick = () => { G.holes = +x.dataset.h; showIntro(); });
    document.getElementById("play").onclick = () => startRound();
  }
  function startRound() { G.hi = 0; G.scores = []; G.streak = 0; beginHole(); }

  /* ---------------- HOLE ---------------- */
  function beginHole() {
    G.screen = "play"; G.hole = HOLES[G.hi]; G.ball = Course.teePos(); G.lie = "tee"; G.shots = 0; G.anim = null; G.burst = null; G.busy = false;
    enterBag();
    renderPlay();
    Renderer.init(document.getElementById("field")); Renderer.resize();
    loop();
  }

  /* compute the current options for where the ball lies */
  function enterBag() {
    G.lie = Course.surfaceAt(G.hole, G.ball[0], G.ball[1]);
    if (G.lie === "green") { G.phase = "putt"; G.club = "PT"; G.shots3 = Choices.buildPutts(G.hole, G.ball); G.bag = null; }
    else { G.phase = "bag"; G.club = null; G.bag = Choices.buildBag(G.hole, G.ball); G.shots3 = []; }
    G.selShot = 0;
  }
  function pickClub(id) {
    if (G.busy || !G.bag) return; const c = G.bag.clubs.find((x) => x.id === id); if (!c || c.disabled) return;
    G.club = id; G.shots3 = Choices.buildShots(G.hole, G.ball, id); G.phase = "shots"; G.selShot = 0; renderBottom();
  }
  function backToBag() { if (G.busy) return; G.phase = "bag"; G.club = null; renderBottom(); }

  /* ---------------- PLAY SCREEN ---------------- */
  function renderPlay() {
    const h = G.hole, closing = G.hi === G.holes - 1;
    app.innerHTML = `
      <div id="hudTop">
        <button class="ghost" id="quit" aria-label="Quit">\u2039</button>
        <div class="htHole">${closing ? '<em>FINAL</em> ' : ""}HOLE <b>${h.num}</b> · PAR ${h.par} <span>· ${esc(h.name)}</span></div>
        <div id="streak"></div>
        <div class="htScore ${toPar() < 0 ? "under" : toPar() > 0 ? "over" : ""}" id="htScore">${fmtPar(toPar())}</div>
        <div class="htWind"><svg class="wa" id="wa" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M6 11l6-6 6 6"/></svg><b id="wmph">0</b><small>mph</small></div>
      </div>
      <canvas id="field"></canvas>
      <div id="hudBottom">
        <div class="hbInfo">
          <div class="pill"><span>Lie</span><b id="iLie">\u2014</b></div>
          <div class="pill big"><span>To pin</span><b id="iDist">\u2014<i>y</i></b></div>
          <div class="pill"><span>Stroke</span><b id="iStroke">1</b></div>
        </div>
        <div id="bottom"></div>
      </div>
      <div id="toast" hidden></div>`;
    document.getElementById("quit").onclick = () => { if (confirm("Quit this round?")) showIntro(); };
    bindCanvas();
    const [wx, wy] = h.wind, mph = Math.round(Math.hypot(wx, wy));
    document.getElementById("wmph").textContent = mph;
    document.getElementById("wa").style.transform = `rotate(${Math.atan2(wx, wy) * 180 / Math.PI}deg)`;
    renderBottom();
    showStreak();
    if (closing) maybeCloseBanner();
  }

  function paintHud() {
    G.lie = Course.surfaceAt(G.hole, G.ball[0], G.ball[1]);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
    set("iLie", esc(SURF[G.lie] || G.lie));
    set("iDist", `${Math.round(Sim.distToPin(G.hole, G.ball))}<i>y</i>`);
    set("iStroke", G.shots + 1);
    const sc = document.getElementById("htScore"); if (sc) { sc.textContent = fmtPar(toPar()); sc.className = "htScore " + (toPar() < 0 ? "under" : toPar() > 0 ? "over" : ""); }
  }

  /* ---- bottom panel: bag grid OR three shots ---- */
  function renderBottom() {
    const wrap = document.getElementById("bottom"); if (!wrap) return;
    wrap.innerHTML = G.phase === "bag" ? bagHTML() : shotsHTML();
    wireBottom();
    paintHud();
  }
  function bagHTML() {
    const b = G.bag; if (!b || b.green) return "";
    const chips = b.clubs.map((c) => {
      const sub = c.disabled ? '<i class="cx">\u2014</i>' : (c.putter ? `<i>${c.leave != null ? "~" + c.leave + "y" : "putt"}</i>` : `<i>${c.carry}y</i>`);
      const leave = (!c.disabled && !c.putter && c.leave != null) ? `<u>\u2192 ${c.leave}y</u>` : "";
      const dot = (c.risk && !c.disabled) ? `<span class="cdot l${c.risk.lvl}"></span>` : "";
      return `<button class="club ${c.suggested ? "sug" : ""} ${c.disabled ? "off" : ""}" data-c="${c.id}" ${c.disabled ? "disabled" : ""}><b>${c.id}</b>${sub}${leave}${dot}</button>`;
    }).join("");
    return `<p class="cue">Pick a club <span>\u00b7 ${b.dist}y to pin</span></p><div class="bag">${chips}</div>`;
  }
  function shotsHTML() {
    const arr = G.shots3, onGreen = G.phase === "putt";
    const head = onGreen
      ? `<p class="cue">On the green <span>\u00b7 ${Math.round(Sim.distToPin(G.hole, G.ball) * 3)} ft</span></p>`
      : `<div class="shotHead"><button class="backClub" id="backC">\u2039 Clubs</button><span class="selClub"><b>${esc(G.club)}</b> ${esc((CLUBS.find((c) => c.id === G.club) || {}).name || "")} \u00b7 ${b_dist()}y</span></div>`;
    const cards = arr.map((p, i) => `
      <button class="shot ${i === G.selShot ? "sel" : ""}" data-i="${i}">
        <span class="sTop"><span class="sLabel">${esc(p.label)}</span>${riskMeter(p.risk)}</span>
        <span class="sDesc">${esc(p.desc || "")}</span>
        <span class="sFoot">${p.putt ? "" : `<span class="sNum">${p.carry}y carry</span>`}<span class="sLeave">${esc(p.reward)}</span></span>
      </button>`).join("");
    return head + `<div class="shots">${cards}</div>`;
  }
  function b_dist() { return Math.round(Sim.distToPin(G.hole, G.ball)); }
  function wireBottom() {
    if (G.phase === "bag") {
      document.querySelectorAll("#bottom .club").forEach((b) => { b.onclick = () => pickClub(b.dataset.c); });
    } else {
      const back = document.getElementById("backC"); if (back) back.onclick = backToBag;
      document.querySelectorAll("#bottom .shot").forEach((b) => {
        const i = +b.dataset.i;
        b.onclick = () => commit(G.shots3[i]);
        b.onmouseenter = () => { G.selShot = i; document.querySelectorAll("#bottom .shot").forEach((x) => x.classList.toggle("sel", +x.dataset.i === i)); };
      });
    }
  }

  function showStreak() {
    const el = document.getElementById("streak"); if (!el) return;
    el.innerHTML = G.streak >= 2 ? `<span class="heat">Heater <b>\u00d7${G.streak}</b></span>` : "";
  }
  function maybeCloseBanner() {
    const best = getBest(G.holes); if (best == null) return;
    const need = best - toPar();
    if (need > 4) return;
    flash(need <= 0 ? "Final hole — make it count" : `Final hole — play it in ${fmtPar(need - 1)} or better to beat your best`, "info", 2200);
  }

  function bindCanvas() {
    const cv = document.getElementById("field");
    const loc = (e) => { const r = cv.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return [t.clientX - r.left, t.clientY - r.top]; };
    cv.addEventListener("pointerdown", (e) => {
      if (G.busy || (G.phase !== "shots" && G.phase !== "putt")) return;
      const [sx, sy] = loc(e);
      let best = null, bd = 34;
      G.shots3.forEach((p) => { const ps = Renderer.toS(p.preview[0], p.preview[1]); const d = Math.hypot(ps[0] - sx, ps[1] - sy); if (d < bd) { bd = d; best = p; } });
      if (best) commit(best);
    });
  }

  /* ---------------- COMMIT / RESOLVE ---------------- */
  function commit(play) {
    if (G.busy || !play) return; G.busy = true;
    const res = Sim.resolveShot(G.hole, G.ball, play.club, play.aim, play.power, Math.random, play.opts || {});
    G.anim = Renderer.makeShotAnim(res.from, res.end, res.putt);
    G.anim.onDone = () => {
      G.shots += res.strokes; G.ball = res.end; G.lie = res.surface; G.anim = null;
      if (res.penalty === "water") flash("Water \u2014 penalty drop", "bad");
      else if (res.penalty === "ob") flash("Out of bounds \u2014 penalty", "bad");
      else flash(shotMessage(res), strikeTone(res), 1500);
      if (res.holed) return holeDone(res);
      enterBag(); renderBottom(); G.busy = false;
    };
  }
  function strikeTone(res) { if (res.putt) return res.surface === "green" ? "solid" : "off"; return res.strike ? res.strike.tier : "solid"; }
  function shotMessage(res) {
    if (res.putt) { const d = Math.round(Sim.distToPin(G.hole, G.ball) * 3); return res.surface === "green" ? (d <= 4 ? "Cozied it to a gimme" : `Left ${d} ft`) : "Ran it off the green"; }
    const where = { fairway: "found the fairway", fringe: "just off the green", rough: "into the rough", bunker: "found the sand", trees: "into the trees", green: "onto the green", tee: "" }[res.surface] || "";
    const dft = res.surface === "green" ? `, ${Math.round(Sim.distToPin(G.hole, G.ball) * 3)} ft` : "";
    return `${res.strike.label} \u2014 ${where}${dft}`;
  }

  function holeDone(res) {
    G.scores[G.hi] = G.shots;
    const v = G.shots - G.hole.par;
    if (v <= -1) { G.streak++; G.burst = { x: Course.pinPos(G.hole)[0], y: Course.pinPos(G.hole)[1] }; } else G.streak = 0;
    const t = document.getElementById("toast");
    t.className = "show " + scoreClass(v); t.hidden = false;
    const heat = G.streak >= 2 ? `<span class="tHeat">Heater \u00d7${G.streak}</span>` : "";
    t.innerHTML = `<div class="toastIn">
      ${heat}<span class="tScore">${esc(scoreName(v))}</span>
      <span class="tNet">${G.shots} strokes \u00b7 ${fmtPar(v)} \u00b7 total ${fmtPar(toPar())}</span>
      <button class="btn" id="next">${G.hi === G.holes - 1 ? "See scorecard" : "Next hole"} ${arrow}</button></div>`;
    document.getElementById("htScore").textContent = fmtPar(toPar());
    document.getElementById("next").onclick = () => { G.hi++; if (G.hi >= G.holes) showCard(); else beginHole(); };
    G.busy = true;
  }

  /* ---------------- LOOP ---------------- */
  function loop() {
    stopLoop();
    const step = (now) => {
      if (G.screen !== "play") return;
      const focus = G.anim ? G.anim.to : null;
      Renderer.drawHole(G.hole, G.ball, focus);
      if (G.anim) {
        const done = Renderer.drawShot(G.anim, now);
        if (done && G.anim.onDone) { const cb = G.anim.onDone; G.anim.onDone = null; cb(); }
      } else {
        if (!G.busy && (G.phase === "shots" || G.phase === "putt") && G.shots3.length) Renderer.drawPreviews(G.hole, G.ball, G.shots3, G.shots3[G.selShot] ? G.shots3[G.selShot].key : null);
        Renderer.drawBall(G.ball, 0);
      }
      if (G.burst) { const fin = Renderer.drawBurst(G.burst, now); if (fin) G.burst = null; }
      G.raf = requestAnimationFrame(step);
    };
    G.raf = requestAnimationFrame(step);
  }
  function stopLoop() { if (G.raf) cancelAnimationFrame(G.raf); G.raf = null; }

  function flash(msg, tone, ms) {
    const t = document.getElementById("toast"); if (!t || t.className.startsWith("show")) return;
    t.className = "flash " + (tone || "solid"); t.hidden = false;
    t.innerHTML = `<div class="flashIn">${esc(msg)}</div>`;
    const tag = t.innerHTML;
    setTimeout(() => { if (t.innerHTML === tag && t.className.startsWith("flash")) { t.hidden = true; t.innerHTML = ""; } }, ms || 1400);
  }

  /* ---------------- SCORECARD ---------------- */
  function showCard() {
    G.screen = "card"; stopLoop();
    const par = parThrough(G.holes), strokes = G.scores.reduce((a, b) => a + b, 0), tp = strokes - par;
    const isBest = setBest(G.holes, tp), prevBest = getBest(G.holes), g = grade(tp, G.holes);
    const nine = (a, b) => {
      if (a >= G.holes) return "";
      let out = "", sp = 0, ss = 0;
      for (let i = a; i < b && i < G.holes; i++) { sp += HOLES[i].par; ss += G.scores[i]; const v = G.scores[i] - HOLES[i].par; out += `<div class="scCol ${scoreClass(v)}"><span class="scH">${HOLES[i].num}</span><span class="scP">${HOLES[i].par}</span><span class="scS">${G.scores[i]}</span></div>`; }
      return `<div class="scNine"><div class="scCols">${out}</div><div class="scTot"><span>${a === 0 ? "OUT" : "IN"}</span><b>${ss}</b><small>par ${sp}</small></div></div>`;
    };
    app.innerHTML = `
      <section class="screen card">
        <a class="kaz6-home" href="../../index.html">← KAZ6</a>
        <p class="eyebrow">${G.holes === 9 ? "Front nine" : "Full round"} complete</p>
        ${isBest ? '<div class="bestTag">New best round</div>' : ""}
        <div class="cardFinal ${tp < 0 ? "under" : tp > 0 ? "over" : ""}">${fmtPar(tp)}</div>
        <p class="cardStrokes">${strokes} strokes \u00b7 par ${par}${prevBest != null && !isBest ? ` \u00b7 best ${fmtPar(prevBest)}` : ""}</p>
        <h2 class="cardGrade">${g.l}</h2>
        <p class="cardBlurb">${g.b}</p>
        <div class="scoreCard">${nine(0, 9)}${nine(9, 18)}</div>
        <div class="cardBtns"><button class="btn big" id="again">Play again ${arrow}</button></div>
      </section>`;
    document.getElementById("again").onclick = showIntro;
  }

  showIntro();
})();
