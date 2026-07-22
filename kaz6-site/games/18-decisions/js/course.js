/* =========================================================================
   course.js  —  THE COURSE (geometry + surface detection)
   -------------------------------------------------------------------------
   Plane coordinates in YARDS. Tee at (0,0); forward = +y (toward the green);
   lateral = x (+right). Each hole is a fairway corridor (a poly-line with a
   width), a green circle, and hazards placed as circles. surfaceAt(x,y) is
   what the simulation queries to learn what a landing ball found.

   wind = [wx, wy] mph:  +wy helps (toward green), -wy is into;
                         +wx blows right, -wx blows left.
   ========================================================================= */
(function (root) {
  const ROUGH = 12, TREES = 17, FRINGE = 2.5;       // bands outside the fairway
  const greenR = { S: 12, M: 15, L: 18 };

  const HOLES = [
    { num: 1,  par: 4, yards: 446, name: "Opener",       w: 34, shape: "straight", green: "M", wind: [0, -12], hz: [{ t: "bunker", s: "L", at: 0.60, sz: 0.5 }] },
    { num: 2,  par: 5, yards: 538, name: "Temptation",   w: 38, shape: "straight", green: "M", wind: [-6, 10], hz: [{ t: "bunker", s: "L", at: 0.50, sz: 0.45 }, { t: "water", s: "R", at: 0.86, sz: 0.6 }] },
    { num: 3,  par: 3, yards: 188, name: "Long Three",   w: 30, shape: "straight", green: "L", wind: [8, 0],   hz: [{ t: "bunker", s: "R", at: 0.82, sz: 0.5 }] },
    { num: 4,  par: 4, yards: 372, name: "Short Stuff",  w: 30, shape: "doglegR", green: "S", wind: [0, -2],  hz: [{ t: "bunker", s: "C", at: 0.82, sz: 0.55 }, { t: "ob", s: "R", at: 0.70, sz: 0.4 }] },
    { num: 5,  par: 4, yards: 421, name: "The Elbow",    w: 33, shape: "doglegL", green: "M", wind: [-9, 1],  hz: [{ t: "trees", s: "L", at: 0.52, sz: 0.6 }, { t: "bunker", s: "R", at: 0.70, sz: 0.4 }] },
    { num: 6,  par: 3, yards: 161, name: "Carry",        w: 30, shape: "straight", green: "M", wind: [0, -13], hz: [{ t: "water", s: "C", at: 0.40, sz: 0.7 }, { t: "bunker", s: "L", at: 0.86, sz: 0.4 }] },
    { num: 7,  par: 5, yards: 567, name: "Three-Shotter", w: 38, shape: "doglegR", green: "M", wind: [-10, 0], hz: [{ t: "water", s: "R", at: 0.60, sz: 0.6 }, { t: "bunker", s: "L", at: 0.78, sz: 0.4 }] },
    { num: 8,  par: 4, yards: 408, name: "Pinch",        w: 33, shape: "straight", green: "M", wind: [0, -3],  hz: [{ t: "bunker", s: "L", at: 0.60, sz: 0.4 }, { t: "bunker", s: "R", at: 0.62, sz: 0.4 }] },
    { num: 9,  par: 4, yards: 455, name: "The Climb",    w: 28, shape: "straight", green: "S", wind: [0, -15], hz: [{ t: "bunker", s: "R", at: 0.80, sz: 0.45 }] },
    { num: 10, par: 4, yards: 389, name: "Fork",         w: 32, shape: "doglegL", green: "M", wind: [9, -2],  hz: [{ t: "water", s: "C", at: 0.55, sz: 0.5 }, { t: "bunker", s: "R", at: 0.72, sz: 0.4 }] },
    { num: 11, par: 3, yards: 207, name: "Iron Test",    w: 30, shape: "straight", green: "L", wind: [0, -4],  hz: [{ t: "bunker", s: "L", at: 0.84, sz: 0.5 }] },
    { num: 12, par: 4, yards: 338, name: "The Gamble",   w: 30, shape: "doglegR", green: "S", wind: [3, 12],   hz: [{ t: "bunker", s: "C", at: 0.70, sz: 0.55 }, { t: "water", s: "R", at: 0.82, sz: 0.45 }] },
    { num: 13, par: 5, yards: 602, name: "The Marathon", w: 37, shape: "doglegL", green: "M", wind: [8, 1],    hz: [{ t: "bunker", s: "R", at: 0.55, sz: 0.4 }, { t: "water", s: "L", at: 0.82, sz: 0.55 }] },
    { num: 14, par: 4, yards: 433, name: "Watershed",    w: 33, shape: "straight", green: "M", wind: [0, -2],  hz: [{ t: "water", s: "L", at: 0.60, sz: 0.7 }, { t: "bunker", s: "R", at: 0.75, sz: 0.4 }] },
    { num: 15, par: 4, yards: 401, name: "The Bombsite", w: 33, shape: "straight", green: "M", wind: [2, 12],   hz: [{ t: "bunker", s: "C", at: 0.65, sz: 0.55 }] },
    { num: 16, par: 3, yards: 178, name: "The Island",   w: 30, shape: "straight", green: "M", wind: [6, -6],  hz: [{ t: "water", s: "C", at: 0.52, sz: 0.9 }] },
    { num: 17, par: 4, yards: 472, name: "The Beast",    w: 28, shape: "doglegR", green: "S", wind: [-8, -13], hz: [{ t: "bunker", s: "L", at: 0.70, sz: 0.4 }, { t: "water", s: "R", at: 0.85, sz: 0.5 }] },
    { num: 18, par: 5, yards: 540, name: "Decision",     w: 36, shape: "straight", green: "M", wind: [9, -16], hz: [{ t: "water", s: "R", at: 0.60, sz: 0.9 }, { t: "bunker", s: "L", at: 0.90, sz: 0.4 }] },
  ];

  /* ---- centerline waypoints (yards) --------------------------------- */
  function waypoints(h) {
    const L = h.yards;
    if (h.shape === "doglegL") return [[0, 0], [0, L * 0.55], [-L * 0.19, L * 0.93]];
    if (h.shape === "doglegR") return [[0, 0], [0, L * 0.55], [L * 0.19, L * 0.93]];
    return [[0, 0], [0, L]];
  }
  function segs(h) {
    const wp = waypoints(h), out = [];
    for (let i = 0; i < wp.length - 1; i++) {
      const a = wp[i], b = wp[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      out.push({ a, b, dx, dy, len, ux: dx / len, uy: dy / len });
    }
    return out;
  }
  const teePos = () => [0, 0];
  function pinPos(h) { const wp = waypoints(h); return wp[wp.length - 1].slice(); }

  function pointAlong(h, frac) {
    const s = segs(h), total = s.reduce((a, q) => a + q.len, 0);
    let d = Math.max(0, Math.min(1, frac)) * total;
    for (const q of s) { if (d <= q.len) return { p: [q.a[0] + q.ux * d, q.a[1] + q.uy * d], ux: q.ux, uy: q.uy }; d -= q.len; }
    const last = s[s.length - 1]; return { p: last.b.slice(), ux: last.ux, uy: last.uy };
  }
  // distance from point to the corridor centerline (clamped to segments)
  function corridorDist(h, x, y) {
    let best = Infinity;
    for (const q of segs(h)) {
      let t = ((x - q.a[0]) * q.dx + (y - q.a[1]) * q.dy) / (q.len * q.len);
      t = Math.max(0, Math.min(1, t));
      const px = q.a[0] + t * q.dx, py = q.a[1] + t * q.dy;
      best = Math.min(best, Math.hypot(x - px, y - py));
    }
    return best;
  }
  // precomputed hazard circles in plane coords
  function hazards(h) {
    return h.hz.map((z) => {
      const at = pointAlong(h, z.at);
      const perpR = [at.uy, -at.ux];                 // right of travel = +x
      const sign = z.s === "R" ? 1 : z.s === "L" ? -1 : 0;
      const r = 7 + z.sz * 15;
      const off = h.w / 2 + r * 0.7;
      return { t: z.t, r, x: at.p[0] + perpR[0] * sign * off, y: at.p[1] + perpR[1] * sign * off };
    });
  }

  /* ---- surface under a point ---------------------------------------- */
  function surfaceAt(h, x, y) {
    const pin = pinPos(h), gr = greenR[h.green];
    const dg = Math.hypot(x - pin[0], y - pin[1]);
    if (dg <= gr) return "green";
    for (const z of hazards(h)) { if (Math.hypot(x - z.x, y - z.y) <= z.r) return z.t; }
    if (dg <= gr + FRINGE) return "fringe";
    if (Math.hypot(x, y) < 4) return "tee";
    const cd = corridorDist(h, x, y);
    if (cd <= h.w / 2) return "fairway";
    if (cd <= h.w / 2 + ROUGH) return "rough";
    if (cd <= h.w / 2 + ROUGH + TREES) return "trees";
    return "ob";
  }

  const Course = { HOLES, ROUGH, TREES, FRINGE, greenR, waypoints, segs, teePos, pinPos, pointAlong, corridorDist, hazards, surfaceAt };
  if (typeof module !== "undefined" && module.exports) module.exports = Course;
  root.Course = Course;
})(typeof window !== "undefined" ? window : globalThis);
