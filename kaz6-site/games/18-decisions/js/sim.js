/* =========================================================================
   sim.js  —  SHOT PHYSICS (pure, no DOM)
   -------------------------------------------------------------------------
   Resolves a swing into a landing point. Distance = club carry x power x lie,
   nudged by wind; offline = club dispersion x lie x execution noise + crosswind.
   Then Course.surfaceAt decides what the ball found and the consequence.
   Aim convention: 0deg = straight at the green (+y); +deg aims right (+x).
   ========================================================================= */
(function (root) {
  const Course = root.Course || (typeof require !== "undefined" ? require("./course.js") : null);
  const { CLUB_BY_ID } = root.CLUB_BY_ID ? root : (typeof require !== "undefined" ? require("./clubs.js") : { CLUB_BY_ID: {} });

  const CUP = 0.42, GIMME = 1.4, MAX_PUTT = 30;     // yards
  const LIE = {
    tee:     { dist: 1.0,  disp: 1.0 },
    fairway: { dist: 1.0,  disp: 1.0 },
    fringe:  { dist: 1.0,  disp: 1.05 },
    rough:   { dist: 0.84, disp: 1.5 },
    bunker:  { dist: 0.70, disp: 1.7 },
    trees:   { dist: 0.52, disp: 2.2 },
    green:   { dist: 1.0,  disp: 1.0 },
  };
  const ROLL_MULT = { fairway: 1.0, fringe: 1.0, green: 1.25, rough: 0.35, bunker: 0.0, trees: 0.15, tee: 1.0, ob: 0.1 };

  /* gaussian via Box-Muller (rng injectable) */
  function gauss(rng) { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const rad = (d) => (d * Math.PI) / 180;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function angleTo(from, target) { return (Math.atan2(target[0] - from[0], target[1] - from[1]) * 180) / Math.PI; }

  function aimVecs(aimDeg) {
    const a = rad(aimDeg);
    return { fwd: [Math.sin(a), Math.cos(a)], right: [Math.cos(a), -Math.sin(a)] };
  }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];

  // project a point onto the corridor centerline (used for hazard relief drops)
  function nearestCenter(h, x, y) {
    let best = null, bd = Infinity;
    for (const q of Course.segs(h)) {
      let t = ((x - q.a[0]) * q.dx + (y - q.a[1]) * q.dy) / (q.len * q.len);
      t = Math.max(0, Math.min(1, t));
      const px = q.a[0] + t * q.dx, py = q.a[1] + t * q.dy, d = Math.hypot(x - px, y - py);
      if (d < bd) { bd = d; best = [px, py]; }
    }
    return best || [x, y];
  }

  /* ---- full swing --------------------------------------------------- */
  function resolveShot(h, ball, clubId, aimDeg, power, rng, opts) {
    rng = rng || Math.random;
    opts = opts || {}; const dispMul = opts.dispMul ?? 1, windMul = opts.windMul ?? 1, rollMul = opts.rollMul ?? 1;
    const club = CLUB_BY_ID[clubId];
    if (club.putter) return resolvePutt(h, ball, aimDeg, power, rng);
    const lie = LIE[Course.surfaceAt(h, ball[0], ball[1])] || LIE.fairway;
    const { fwd, right } = aimVecs(aimDeg);
    const wind = h.wind;

    let carry = club.carry * power * lie.dist * (1 + gauss(rng) * 0.025);
    const tf = carry / 170;                                  // flight-time proxy
    carry += dot(wind, fwd) * 0.6 * tf * windMul;          // head / tail
    const sigma = club.disp * lie.disp * (0.55 + 0.35 * power) * 0.82 * dispMul;
    const g = gauss(rng);
    const offline = g * sigma + dot(wind, right) * 0.5 * tf * windMul;

    const pre = [ball[0] + fwd[0] * carry + right[0] * offline, ball[1] + fwd[1] * carry + right[1] * offline];
    const preSurf = Course.surfaceAt(h, pre[0], pre[1]);
    const roll = club.roll * (ROLL_MULT[preSurf] ?? 0.2) * (0.6 + 0.4 * power) * rollMul;
    let end = [pre[0] + fwd[0] * roll, pre[1] + fwd[1] * roll];
    let surface = Course.surfaceAt(h, end[0], end[1]);

    let strokes = 1, penalty = null;
    if (surface === "water" || preSurf === "water") {
      penalty = "water"; strokes = 2;
      // step back to the water's edge, then take relief to the centerline
      let t = 1; for (; t > 0; t -= 0.04) { const px = ball[0] + (pre[0] - ball[0]) * t, py = ball[1] + (pre[1] - ball[1]) * t; if (Course.surfaceAt(h, px, py) !== "water") { end = [px, py]; break; } }
      end = nearestCenter(h, end[0], end[1]); surface = Course.surfaceAt(h, end[0], end[1]);
    } else if (surface === "ob") {
      penalty = "ob"; strokes = 2;                            // stroke + distance, simplified to a fairway drop
      end = nearestCenter(h, pre[0], pre[1]);
      // pull back ~12y so it isn't a free advance
      const back = Math.min(12, dist(ball, end) * 0.25); end = [end[0] - fwd[0] * back, end[1] - fwd[1] * back];
      surface = Course.surfaceAt(h, end[0], end[1]);
    }
    const holed = surface !== "water" && surface !== "ob" && dist(end, Course.pinPos(h)) <= CUP;
    return { kind: "shot", from: ball, carryPoint: pre, end, surface, strokes, penalty, holed, carryYds: Math.round(carry), club: clubId, putt: false, strike: strikeOf(g) };
  }
  function strikeOf(g) {
    const a = Math.abs(g);
    if (a < 0.45) return { label: "Flushed it", tier: "flush" };
    if (a < 0.95) return { label: "Solid strike", tier: "solid" };
    if (a < 1.7) return { label: g > 0 ? "Pushed it" : "Pulled it", tier: "off" };
    return { label: g > 0 ? "Blocked it right" : "Yanked it left", tier: "bad" };
  }

  /* ---- putting ------------------------------------------------------ */
  function resolvePutt(h, ball, aimDeg, power, rng) {
    rng = rng || Math.random;
    const { fwd, right } = aimVecs(aimDeg);
    const rolled = power * MAX_PUTT;
    const sigma = 0.4 + rolled * 0.03;
    const offline = gauss(rng) * sigma;
    const end = [ball[0] + fwd[0] * rolled + right[0] * offline, ball[1] + fwd[1] * rolled + right[1] * offline];
    const d = dist(end, Course.pinPos(h));
    let surface = Course.surfaceAt(h, end[0], end[1]);
    const holed = d <= CUP, gimme = !holed && d <= GIMME;
    return { kind: "putt", from: ball, end: gimme ? Course.pinPos(h) : end, surface, strokes: gimme ? 2 : 1, penalty: null, holed: holed || gimme, gimme, putt: true, leftFt: Math.round(d * 3) };
  }

  /* ---- helpers for defaults / the test bot -------------------------- */
  function distToPin(h, ball) { return dist(ball, Course.pinPos(h)); }
  function suggestClub(h, ball, clubsArr) {
    const d = distToPin(h, ball);
    const onGreen = Course.surfaceAt(h, ball[0], ball[1]) === "green";
    if (onGreen) return { id: "PT", power: Math.min(1, d / MAX_PUTT) };
    const hit = clubsArr.filter((c) => !c.putter);
    let best = hit[0];
    for (const c of hit) if (Math.abs(c.carry - d) < Math.abs(best.carry - d)) best = c;
    let power = 1;
    if (d < best.carry) power = Math.max(0.4, d / best.carry);
    return { id: best.id, power: Math.min(1.0, power) };
  }

  const Sim = { CUP, GIMME, MAX_PUTT, LIE, gauss, angleTo, distToPin, suggestClub, resolveShot, resolvePutt };
  if (typeof module !== "undefined" && module.exports) module.exports = Sim;
  root.Sim = Sim;
})(typeof window !== "undefined" ? window : globalThis);
