/* =========================================================================
   render.js  —  CANVAS RENDERER (top-down hole + shot animation)
   -------------------------------------------------------------------------
   Draws the playing field on a high-DPI canvas: rough/trees/fairway bands,
   mowing stripes, green, water/sand hazards, flag, tee, ball, the aim line
   with a live dispersion cone, and the flying-ball animation. Pure drawing —
   it reads a state object the game hands it each frame.
   ========================================================================= */
(function (root) {
  const Course = root.Course, Sim = root.Sim, CLUB_BY_ID = root.CLUB_BY_ID;
  const C = {
    ob: "#0b1610", trees: "#15331e", rough: "#1f5733", fairway: "#2f8a4d",
    fairwayHi: "#37a05a", green: "#4cb46d", greenHi: "#5fc980", greenRing: "#2c6f43",
    water: "#2f86c4", waterDk: "#1f5e93", sand: "#e4cd92", sandSh: "#cbb074",
    ball: "#f6f8f7", flag: "#f2f2f5", tee: "#9aa0aa", aim: "#ffffff", cone: "rgba(255,255,255,0.12)",
  };
  let cv, ctx, W = 0, H = 0, DPR = 1, cam = { x: 0, y: 0, s: 1 };

  function init(canvas) {
    cv = canvas; ctx = cv.getContext("2d"); resize();
    window.addEventListener("resize", resize);
  }
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  const W_ = () => W, H_ = () => H;

  /* camera: fit a world box (ball, pin, focus) into the canvas, undistorted */
  function setCamera(h, ball, focus) {
    const pin = Course.pinPos(h);
    const xs = [ball[0], pin[0], focus ? focus[0] : ball[0]];
    const ys = [ball[1], pin[1], focus ? focus[1] : ball[1]];
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const padX = 34, padY = 30;
    x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
    const bw = Math.max(60, x1 - x0), bh = Math.max(80, y1 - y0);
    const s = Math.min(W / bw, H / bh);
    cam = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, s };
  }
  function toS(wx, wy) { return [W / 2 + (wx - cam.x) * cam.s, H / 2 - (wy - cam.y) * cam.s]; }
  function toW(sx, sy) { return [cam.x + (sx - W / 2) / cam.s, cam.y - (sy - H / 2) / cam.s]; }

  function centerlinePath(h) {
    const wp = Course.waypoints(h);
    ctx.beginPath();
    wp.forEach((p, i) => { const s = toS(p[0], p[1]); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); });
  }

  function drawHole(h, ball, focus) {
    setCamera(h, ball, focus);
    // base (OB)
    ctx.fillStyle = C.ob; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const px = (yd) => yd * cam.s;
    // concentric corridor bands: trees -> rough -> fairway
    centerlinePath(h); ctx.strokeStyle = C.trees; ctx.lineWidth = px(h.w + 2 * (Course.ROUGH + Course.TREES)); ctx.stroke();
    centerlinePath(h); ctx.strokeStyle = C.rough; ctx.lineWidth = px(h.w + 2 * Course.ROUGH); ctx.stroke();
    centerlinePath(h); ctx.strokeStyle = C.fairway; ctx.lineWidth = px(h.w); ctx.stroke();
    // mowing stripes — clip to fairway, shade alternating forward bands
    ctx.save();
    centerlinePath(h); ctx.lineWidth = px(h.w); ctx.strokeStyle = "#000"; ctx.stroke(); ctx.clip();
    const L = h.yards, band = 16;
    for (let y = 0; y < L + band; y += band) {
      if (((y / band) | 0) % 2 === 0) continue;
      const a = toS(-200, y), b = toS(200, y);
      ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = px(band);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.restore();

    // green
    const pin = Course.pinPos(h), gr = Course.greenR[h.green], gc = toS(pin[0], pin[1]);
    const grad = ctx.createRadialGradient(gc[0] - px(gr) * 0.3, gc[1] - px(gr) * 0.3, px(gr) * 0.2, gc[0], gc[1], px(gr));
    grad.addColorStop(0, C.greenHi); grad.addColorStop(1, C.green);
    ctx.beginPath(); ctx.arc(gc[0], gc[1], px(gr), 0, 7); ctx.fillStyle = grad; ctx.fill();
    ctx.lineWidth = Math.max(1, px(1)); ctx.strokeStyle = C.greenRing; ctx.stroke();

    // hazards
    for (const z of Course.hazards(h)) {
      const c = toS(z.x, z.y), r = px(z.r);
      if (z.t === "water") {
        const wg = ctx.createLinearGradient(c[0], c[1] - r, c[0], c[1] + r);
        wg.addColorStop(0, C.water); wg.addColorStop(1, C.waterDk);
        ctx.beginPath(); ctx.ellipse(c[0], c[1], r, r * 0.82, 0, 0, 7); ctx.fillStyle = wg; ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(c[0] - r * 0.5, c[1] + i * r * 0.28); ctx.lineTo(c[0] + r * 0.5, c[1] + i * r * 0.28); ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1; }
      } else if (z.t === "bunker") {
        ctx.beginPath(); ctx.ellipse(c[0], c[1], r, r * 0.7, 0, 0, 7); ctx.fillStyle = C.sand; ctx.fill();
        ctx.strokeStyle = C.sandSh; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (z.t === "trees") {
        for (let i = 0; i < 7; i++) { const a = i / 7 * 7, rr = r * (0.5 + (i % 3) * 0.12); ctx.beginPath(); ctx.arc(c[0] + Math.cos(a) * r * 0.5, c[1] + Math.sin(a) * r * 0.5, rr * 0.5, 0, 7); ctx.fillStyle = i % 2 ? "#1c3f26" : "#244e30"; ctx.fill(); }
      } else if (z.t === "ob") {
        ctx.setLineDash([px(3), px(3)]); ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      }
    }

    // tee marker
    const tee = toS(0, 0);
    ctx.fillStyle = C.tee; ctx.fillRect(tee[0] - px(2.2), tee[1] - px(1.4), px(4.4), px(2.8));

    // pin + flag + cup
    ctx.beginPath(); ctx.arc(gc[0], gc[1], Math.max(2, px(1.1)), 0, 7); ctx.fillStyle = "#0c2418"; ctx.fill();
    const flagH = Math.max(14, px(10));
    ctx.strokeStyle = "#e9eaee"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(gc[0], gc[1]); ctx.lineTo(gc[0], gc[1] - flagH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gc[0], gc[1] - flagH); ctx.lineTo(gc[0] + flagH * 0.7, gc[1] - flagH * 0.78); ctx.lineTo(gc[0], gc[1] - flagH * 0.56); ctx.closePath(); ctx.fillStyle = C.flag; ctx.fill();
  }

  /* aim overlay: line, predicted-carry ring, dispersion cone */
  function drawAim(h, ball, aimDeg, clubId, power, lie) {
    const club = CLUB_BY_ID[clubId]; if (!club || club.putter) return drawPuttAim(h, ball, aimDeg, power);
    const a = aimDeg * Math.PI / 180, fwd = [Math.sin(a), Math.cos(a)], right = [Math.cos(a), -Math.sin(a)];
    const lf = (Sim.LIE[lie] || Sim.LIE.fairway);
    const carry = club.carry * power * lf.dist;
    const land = [ball[0] + fwd[0] * carry, ball[1] + fwd[1] * carry];
    const sigma = club.disp * lf.disp * (0.55 + 0.35 * power) * 0.82;
    const bs = toS(ball[0], ball[1]), ls = toS(land[0], land[1]);
    // cone
    const lp = [land[0] + right[0] * sigma * 2, land[1] + right[1] * sigma * 2];
    const lm = [land[0] - right[0] * sigma * 2, land[1] - right[1] * sigma * 2];
    const lps = toS(lp[0], lp[1]), lms = toS(lm[0], lm[1]);
    ctx.beginPath(); ctx.moveTo(bs[0], bs[1]); ctx.lineTo(lps[0], lps[1]); ctx.lineTo(lms[0], lms[1]); ctx.closePath();
    ctx.fillStyle = C.cone; ctx.fill();
    // aim line
    ctx.setLineDash([6, 5]); ctx.strokeStyle = C.aim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bs[0], bs[1]); ctx.lineTo(ls[0], ls[1]); ctx.stroke(); ctx.setLineDash([]);
    // landing ring
    ctx.beginPath(); ctx.arc(ls[0], ls[1], Math.max(5, sigma * cam.s), 0, 7); ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(ls[0], ls[1], 3, 0, 7); ctx.fillStyle = C.aim; ctx.fill();
  }
  function drawPuttAim(h, ball, aimDeg, power) {
    const a = aimDeg * Math.PI / 180, fwd = [Math.sin(a), Math.cos(a)];
    const rolled = power * Sim.MAX_PUTT;
    const land = [ball[0] + fwd[0] * rolled, ball[1] + fwd[1] * rolled];
    const bs = toS(ball[0], ball[1]), ls = toS(land[0], land[1]);
    ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bs[0], bs[1]); ctx.lineTo(ls[0], ls[1]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(ls[0], ls[1], 4, 0, 7); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function drawBall(ball, lift) {
    const s = toS(ball[0], ball[1]); lift = lift || 0;
    const sh = Math.max(1.5, 4.6 - lift * 0.08);
    ctx.beginPath(); ctx.ellipse(s[0], s[1] + 2, sh, sh * 0.62, 0, 0, 7); ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fill();
    ctx.beginPath(); ctx.arc(s[0], s[1] - lift, 4.6, 0, 7); ctx.fillStyle = C.ball; ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1; ctx.stroke();
  }

  // animate ball from->to; calls onDone. returns a stepper the game RAF drives.
  function makeShotAnim(from, to, putt) {
    const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const dur = Math.min(1100, 420 + d * 2.2);
    const peak = putt ? 0 : Math.min(28, 7 + d * 0.1);
    return { from, to, dur, peak, t0: null, putt, trail: [] };
  }
  function drawShot(an, now) {
    if (an.t0 == null) an.t0 = now;
    const k = Math.min(1, (now - an.t0) / an.dur);
    const x = an.from[0] + (an.to[0] - an.from[0]) * k;
    const y = an.from[1] + (an.to[1] - an.from[1]) * k;
    const lift = an.peak * Math.sin(Math.PI * k) / cam.s; // world-units lift for shadow scaling
    an.trail.push(toS(x, y)); if (an.trail.length > 14) an.trail.shift();
    ctx.beginPath(); an.trail.forEach((p, i) => { i ? ctx.lineTo(p[0], p[1] - (an.peak * Math.sin(Math.PI * (k)) * (i / an.trail.length))) : ctx.moveTo(p[0], p[1]); });
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2; ctx.stroke();
    drawBall([x, y], an.peak * Math.sin(Math.PI * k));
    return k >= 1;
  }

  const RISKC = { 1: "#f2f2f5", 2: "#bdbdc4", 3: "#8a8a93", 4: "#616169" };
  function drawPreviews(h, ball, previews, selKey) {
    const bs = toS(ball[0], ball[1]);
    previews.forEach((p) => {
      const col = RISKC[p.risk ? p.risk.lvl : 2] || "#b6d24a";
      const ps = toS(p.preview[0], p.preview[1]);
      const sel = p.key === selKey;
      ctx.setLineDash([5, 5]); ctx.strokeStyle = sel ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.22)"; ctx.lineWidth = sel ? 2.2 : 1.2;
      ctx.beginPath(); ctx.moveTo(bs[0], bs[1]); ctx.lineTo(ps[0], ps[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(ps[0], ps[1], sel ? 9 : 7, 0, 7); ctx.fillStyle = "rgba(8,16,11,.72)"; ctx.fill();
      ctx.lineWidth = sel ? 2.6 : 2; ctx.strokeStyle = col; ctx.stroke();
      ctx.beginPath(); ctx.arc(ps[0], ps[1], 2.4, 0, 7); ctx.fillStyle = col; ctx.fill();
      ctx.font = "700 11px 'JetBrains Mono',monospace"; ctx.textAlign = "center"; ctx.fillStyle = sel ? "#fff" : "rgba(255,255,255,.85)";
      ctx.fillText(p.short || p.club, ps[0], ps[1] - (sel ? 14 : 12));
    });
    ctx.textAlign = "start";
  }
  function drawBurst(b, now) {
    if (!b) return true;
    if (b.t0 == null) b.t0 = now;
    const k = (now - b.t0) / 720; if (k >= 1) return true;
    const c = toS(b.x, b.y);
    ctx.beginPath(); ctx.arc(c[0], c[1], 6 + k * 42, 0, 7); ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 3 * (1 - k) + 1; ctx.stroke();
    for (let i = 0; i < 11; i++) { const a = i / 11 * 7, rr = k * 48; ctx.beginPath(); ctx.arc(c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, (1 - k) * 3 + 0.5, 0, 7); ctx.fillStyle = (i % 2 ? "rgba(255,255,255," : "rgba(190,190,200,") + (1 - k) + ")"; ctx.fill(); }
    return false;
  }

  const Renderer = { init, resize, drawHole, drawAim, drawBall, makeShotAnim, drawShot, drawPreviews, drawBurst, toW, toS, W_, H_, cam: () => cam };
  if (typeof module !== "undefined" && module.exports) module.exports = Renderer;
  root.Renderer = Renderer;
})(typeof window !== "undefined" ? window : globalThis);
