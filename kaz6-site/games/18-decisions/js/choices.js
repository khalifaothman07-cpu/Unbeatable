/* =========================================================================
   choices.js  —  THE DECISION ENGINE (per-club plays)
   -------------------------------------------------------------------------
   No aiming. Each shot, this builds 2-3 distinct club PLAYS — Attack /
   Position / Safe — each headlined by a real club. Risk and reward are not
   authored: they're measured by simulating that exact play against the hole's
   real hazards. So picking the club IS the decision, and the percentage play
   can still find the water.
   ========================================================================= */
(function (root) {
  const Course = root.Course, Sim = root.Sim, CLUBS = root.CLUBS, CLUB_BY_ID = root.CLUB_BY_ID;
  const SAMPLES = 110;

  const pathLen = (h) => Course.segs(h).reduce((a, q) => a + q.len, 0);
  function currentFrac(h, ball) { let bf = 0, bd = 1e9; for (let f = 0; f <= 1.0001; f += 0.02) { const p = Course.pointAlong(h, f).p; const d = Math.hypot(ball[0] - p[0], ball[1] - p[1]); if (d < bd) { bd = d; bf = f; } } return bf; }
  function centerlineTarget(h, ball, yardsAhead) { const f = currentFrac(h, ball); const tf = Math.min(1, f + yardsAhead / pathLen(h)); return Course.pointAlong(h, tf).p; }
  const fitClub = (yards) => { const hit = CLUBS.filter((c) => !c.putter); let best = hit[0]; for (const c of hit) if (Math.abs(c.carry - yards) < Math.abs(best.carry - yards)) best = c; return best; };
  const oneMore = (club) => { const hit = CLUBS.filter((c) => !c.putter); const i = hit.findIndex((c) => c.id === club.id); return hit[Math.max(0, i - 1)]; }; // longer (bag is long->short)

  // deterministic landing (no execution noise) — for the on-field preview marker
  function predictEnd(h, ball, clubId, aim, power, opts) {
    opts = opts || {}; const windMul = opts.windMul ?? 1, rollMul = opts.rollMul ?? 1;
    const club = CLUB_BY_ID[clubId];
    if (club.putter) { const a0 = aim * Math.PI / 180; const rolled = power * Sim.MAX_PUTT; return [ball[0] + Math.sin(a0) * rolled, ball[1] + Math.cos(a0) * rolled]; }
    const lie = Sim.LIE[Course.surfaceAt(h, ball[0], ball[1])] || Sim.LIE.fairway;
    const a = aim * Math.PI / 180, fwd = [Math.sin(a), Math.cos(a)], right = [Math.cos(a), -Math.sin(a)], w = h.wind;
    let carry = club.carry * power * lie.dist; const tf = carry / 170; carry += (w[0] * fwd[0] + w[1] * fwd[1]) * 0.6 * tf * windMul;
    const off = (w[0] * right[0] + w[1] * right[1]) * 0.5 * tf * windMul;
    const pre = [ball[0] + fwd[0] * carry + right[0] * off, ball[1] + fwd[1] * carry + right[1] * off];
    const ps = Course.surfaceAt(h, pre[0], pre[1]);
    const ROLL = { fairway: 1, fringe: 1, green: 1.25, rough: 0.35, bunker: 0, trees: 0.15, tee: 1, ob: 0.1 };
    const roll = club.roll * (ROLL[ps] ?? 0.2) * (0.6 + 0.4 * power) * rollMul;
    return [pre[0] + fwd[0] * roll, pre[1] + fwd[1] * roll];
  }

  // simulate a play many times against the real hole
  function sample(h, ball, clubId, aim, power, opts, n) {
    const pin = Course.pinPos(h); let bust = 0, green = 0, sum = 0, near = 0; const N = n || SAMPLES;
    for (let i = 0; i < N; i++) {
      const r = Sim.resolveShot(h, ball, clubId, aim, power, Math.random, opts);
      if (r.penalty) bust++;
      const d = Math.hypot(r.end[0] - pin[0], r.end[1] - pin[1]); sum += d;
      if (r.surface === "green") green++;
      if (d < 9) near++;
    }
    return { bust: bust / N, green: green / N, avg: sum / N, near: near / N };
  }

  function riskTier(bust) {
    if (bust < 0.05) return { lvl: 1, label: "Low risk" };
    if (bust < 0.16) return { lvl: 2, label: "Some risk" };
    if (bust < 0.34) return { lvl: 3, label: "Risky" };
    return { lvl: 4, label: "Dangerous" };
  }
  function rewardLabel(s, d) {
    if (s.green > 0.55) return "Hits the green";
    if (s.green > 0.3) return "Chance at the green";
    if (s.avg < 30) return "Inside " + Math.round(s.avg) + "y";
    return "Leaves ~" + Math.round(s.avg) + "y";
  }

  /* ------- build the plays for a shot ------- */
  function buildPlays(h, ball) {
    if (Course.surfaceAt(h, ball[0], ball[1]) === "green") return buildPutts(h, ball);
    const pin = Course.pinPos(h), d = Sim.distToPin(h, ball), aimPin = Sim.angleTo(ball, pin);
    const hit = CLUBS.filter((c) => !c.putter), driver = hit[0];
    const lieDist = (Sim.LIE[Course.surfaceAt(h, ball[0], ball[1])] || Sim.LIE.fairway).dist;
    const maxC = driver.carry * lieDist;
    const cands = [];

    // ATTACK
    if (d <= maxC * 1.03) {
      const c = [...hit].reverse().find((c) => c.carry * lieDist >= d) || driver;
      cands.push({ key: "attack", club: c.id, aim: aimPin, power: Math.max(0.55, Math.min(1, d / (c.carry * lieDist))), intent: "Go for the green" });
    } else {
      const far = centerlineTarget(h, ball, driver.carry);
      cands.push({ key: "attack", club: driver.id, aim: Sim.angleTo(ball, far), power: 1, intent: "Chase it as far as you can" });
    }
    // POSITION
    {
      const ahead = d > 170 ? d - 108 : d * 0.6;
      const t = centerlineTarget(h, ball, ahead);
      const club = fitClub(Math.hypot(t[0] - ball[0], t[1] - ball[1]));
      cands.push({ key: "position", club: club.id, aim: Sim.angleTo(ball, t), power: Math.max(0.5, Math.min(1, Math.hypot(t[0] - ball[0], t[1] - ball[1]) / club.carry)), intent: d > 170 ? "Lay up to a full wedge" : "Controlled to the heart" });
    }
    // SAFE lay-back
    {
      const ahead = Math.min(d * 0.5, 145);
      const t = centerlineTarget(h, ball, ahead);
      const club = fitClub(Math.hypot(t[0] - ball[0], t[1] - ball[1]));
      cands.push({ key: "safe", club: club.id, aim: Sim.angleTo(ball, t), power: Math.max(0.45, Math.min(1, Math.hypot(t[0] - ball[0], t[1] - ball[1]) / club.carry)), intent: "Take the safe route" });
    }

    // sample + annotate
    let plays = cands.map((c) => {
      const s = sample(h, ball, c.club, c.aim, c.power);
      const club = CLUB_BY_ID[c.club];
      const carry = Math.round(club.carry * c.power * lieDist);
      return { ...c, club: c.club, clubName: club.name, carry, stat: s, risk: riskTier(s.bust), reward: rewardLabel(s, d), preview: predictEnd(h, ball, c.club, c.aim, c.power), putt: false };
    });
    // dedupe by club (keep the most aggressive framing) + collapse near-identical
    const seen = new Set(); const out = [];
    for (const p of plays) { if (seen.has(p.club)) continue; seen.add(p.club); out.push(p); }
    // if attack already reaches green safely, drop the redundant 3rd
    return out.slice(0, 3);
  }

  /* ------- putting plays ------- */
  function buildPutts(h, ball) {
    const pin = Course.pinPos(h), d = Sim.distToPin(h, ball), aim = Sim.angleTo(ball, pin);
    if (d <= Sim.GIMME * 1.1) return [{ key: "tap", club: "PT", short: "TAP", aim, power: Math.max(0.04, d / Sim.MAX_PUTT), label: "Tap in", desc: "Knock it in", clubName: "Putter", carry: 0, leave: 0, reward: "Gimme range", risk: { lvl: 1, label: "Gimme" }, stat: { make: 0.99 }, preview: pin, putt: true, single: true }];
    const mk = (power) => { let made = 0, three = 0, sum = 0; for (let i = 0; i < 150; i++) { const r = Sim.resolvePutt(h, ball, aim, power, Math.random); const d2 = Math.hypot(r.end[0] - pin[0], r.end[1] - pin[1]); sum += d2; if (r.holed && !r.gimme) made++; else if (!r.holed && d2 > Sim.GIMME) three++; } return { make: made / 150, three: three / 150, avg: sum / 150 }; };
    const defs = [
      { key: "firm", label: "Firm", short: "FIRM", mult: 1.06, desc: "Takes the break out \u2014 charges the cup" },
      { key: "std", label: "Standard", short: "STD", mult: 1.0, desc: "Dead weight at the hole" },
      { key: "soft", label: "Soft", short: "SOFT", mult: 0.94, desc: "Dies it in \u2014 safe two-putt" },
    ];
    return defs.map((p) => {
      const power = Math.min(1, (d / Sim.MAX_PUTT) * p.mult);
      const s = mk(power);
      const risk = p.key === "firm" ? (s.three > 0.18 ? { lvl: 3, label: "3-putt risk" } : { lvl: 2, label: "Goes for it" }) : p.key === "soft" ? { lvl: 1, label: "Two-putt" } : (s.three > 0.16 ? { lvl: 2, label: "Some risk" } : { lvl: 1, label: "Solid" });
      return { key: p.key, label: p.label, short: p.short, desc: p.desc, club: "PT", clubName: "Putter", aim, power, carry: 0, leave: Math.round(s.avg), reward: Math.round(s.make * 100) + "% to hole it", risk, stat: s, preview: predictEnd(h, ball, "PT", aim, power), putt: true };
    });
  }

  /* ------- NEW: 14-club bag, then 3 shots per club ------- */
  function clubAim(h, ball, club, lieDist) {
    const pin = Course.pinPos(h), dPin = Sim.distToPin(h, ball);
    const full = club.carry * lieDist;
    if (full >= dPin * 0.92) return Sim.angleTo(ball, pin);
    return Sim.angleTo(ball, centerlineTarget(h, ball, full));
  }
  function buildBag(h, ball) {
    const lie = Course.surfaceAt(h, ball[0], ball[1]);
    if (lie === "green") return { green: true };
    const dPin = Sim.distToPin(h, ball);
    const lieDist = (Sim.LIE[lie] || Sim.LIE.fairway).dist;
    const cleanLie = (lie === "fairway" || lie === "tee" || lie === "fringe");
    const out = [];
    for (const club of CLUBS) {
      if (club.putter) {
        const puttable = cleanLie && dPin <= Sim.MAX_PUTT * 1.05;
        let leave = null;
        if (puttable) { const aim = Sim.angleTo(ball, Course.pinPos(h)); leave = Math.round(sample(h, ball, "PT", aim, Math.min(1, dPin / Sim.MAX_PUTT), {}, 40).avg); }
        out.push({ id: "PT", name: club.name, carry: 0, leave, reach: false, risk: puttable ? { lvl: 1, label: "Putt" } : null, green: 0, disabled: !puttable, putter: true });
        continue;
      }
      const aim = clubAim(h, ball, club, lieDist);
      const s = sample(h, ball, club.id, aim, 1, {}, 40);
      out.push({ id: club.id, name: club.name, carry: Math.round(club.carry * lieDist), leave: Math.round(s.avg), reach: club.carry * lieDist >= dPin * 0.92, risk: riskTier(s.bust), green: s.green, disabled: false, putter: false });
    }
    let sug = null; for (const c of out) { if (c.disabled || c.putter || c.leave == null) continue; if (!sug || c.leave < sug.leave) sug = c; }
    if (sug) sug.suggested = true;
    return { green: false, dist: Math.round(dPin), lie, clubs: out };
  }
  const SHOTS = [
    { key: "full", label: "Full swing", short: "FULL", power: 1.0, opts: {}, desc: "Most distance, least control" },
    { key: "smooth", label: "Controlled", short: "CTRL", power: 0.86, opts: { dispMul: 0.7, windMul: 0.9, rollMul: 0.8 }, desc: "Three-quarter \u2014 tighter, stops softer" },
    { key: "punch", label: "Punch", short: "PNCH", power: 0.72, opts: { dispMul: 0.62, windMul: 0.48, rollMul: 1.5 }, desc: "Low knockdown \u2014 beats wind, runs out" },
  ];
  function buildShots(h, ball, clubId) {
    if (clubId === "PT") return buildPutts(h, ball);
    const club = CLUB_BY_ID[clubId];
    const lie = Course.surfaceAt(h, ball[0], ball[1]);
    const lieDist = (Sim.LIE[lie] || Sim.LIE.fairway).dist;
    const aim = clubAim(h, ball, club, lieDist), d = Sim.distToPin(h, ball);
    return SHOTS.map((sh) => {
      const s = sample(h, ball, clubId, aim, sh.power, sh.opts);
      return { key: sh.key, label: sh.label, short: sh.short, desc: sh.desc, club: clubId, clubName: club.name, aim, power: sh.power, opts: sh.opts, carry: Math.round(club.carry * sh.power * lieDist), leave: Math.round(s.avg), stat: s, risk: riskTier(s.bust), reward: rewardLabel(s, d), preview: predictEnd(h, ball, clubId, aim, sh.power, sh.opts), putt: false };
    });
  }
  const Choices = { buildPlays, buildBag, buildShots, buildPutts, predictEnd };
  if (typeof module !== "undefined" && module.exports) module.exports = Choices;
  root.Choices = Choices;
})(typeof window !== "undefined" ? window : globalThis);
