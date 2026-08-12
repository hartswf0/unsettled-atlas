/* PERSPECTIVAL GROUND — going somewhere.

   Google Maps grammar and nothing cleverer: tap the ground, the way appears,
   you go. The only thing that is not Google Maps is that the way is computed
   for whatever you currently are, so the same tap on the same corner gives a
   different line — or no line at all — depending on who is asking.

   Three things live in here and nothing else:

     THE WAY      a real route: paper halo, dark casing, bright core, chevrons
                  running toward a pin. It has to read as a route in one glance
                  or the tap did not land.

     THE CAMERA   a leash, not a lock. While you travel it holds you near the
                  middle; the moment a finger moves the map the leash goes
                  slack and the camera stops arguing. When the finger has been
                  still a while the leash tightens again. It is never possible
                  to be trapped and never possible to lose yourself.

     THE BALK     where the ground stopped offering this being anything. The
                  traveller hits it and stops — squashes, rebounds, rings out —
                  and the distance it fell short of is drawn as a measured gap
                  between two ticks, with the wanted place still standing there
                  unreached. Nothing is explained. You can see exactly how much
                  is missing, and the only thing in the world that can close it
                  is a line, which is the one thing your hand can make. */

import {
  View, sx, sy, wx, wy, centerOn, clampView, alongPath, pathLength, distToSeg,
  lerp, clamp, ease, units, metres, worldSize,
} from "./geo.js";
import { G, route, routePoints, nearestNodeFor, wear, afford } from "./graph.js";
import { S, on, emit, logJourney, logBalk } from "./state.js";

/* The route is the one thing in this world that is not of this world: it is an
   instruction, not ground. So it gets the one colour Atlanta never wears, and
   the destination gets the signal red every map has agreed on. */
const CORE = "#2c62ab", CASE = "#16304f", HALO = "rgba(246,242,232,.94)";
const SPENT = "#8f8d84";
const SIGNAL = "#bf4526", PAPER = "#f6f2e8", INK = "#1d201d";

const PAD = { t: 84, b: 132, x: 54 };

/* Some people cannot take a screen that keeps moving. Everything that only
   breathes or marches on the spot stops; the travelling itself does not. */
const MOTION = (() => {
  try { return matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1; }
  catch { return 1; }
})();

/* #rrggbb -> rgba(), so a being's own ink can fade out under it */
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

let you = null;       /* {node,x,y,ang} */
let plan = null;      /* {r,pts,to,t0,tx,ty} */
let trip = null;      /* {r,pts,len,at,T,e,hard,...} */
let balked = null;    /* {x,y,tx,ty,ang,t0,stale} */
const fx = [];        /* short-lived world-anchored flourishes */

/* ---------- the camera ----------
   It only ever owns three numbers, and it writes them last, after every organ
   has drawn with the ones from the frame before. */
const cam = {
  lx: NaN, ly: NaN, lz: NaN,   /* what we left View at, to notice a finger */
  userAt: -1e9,
  frame: null,                 /* {x,y,z} a place we are easing to */
  zHome: null,                 /* zoom to dive back to once we set off */
};

export function init(ctx) {
  on("boot", () => place());
  on("become", () => {
    plan = null; trip = null;
    /* the gap does not belong to the being that found it. it stays a while
       longer, quieter, and then the ground keeps it instead of the screen. */
    if (balked && !balked.stale) { balked.stale = true; balked.staleAt = performance.now(); }
    if (you) reseat();
  });
}

function place() {
  const n = nearestNodeFor(View.x, View.y, S.being, 0.004);
  if (n < 0) return;
  you = { node: n, x: G.nx[n], y: G.ny[n], ang: 0 };
  S.you = you;
  centerOn(you.x, you.y);
}
/* when you become something else you do not teleport — you stay where you are
   standing, on whatever ground the new body can stand on nearest to it */
function reseat() {
  const n = nearestNodeFor(you.x, you.y, S.being, 0.004);
  if (n >= 0) { you.node = n; you.x = G.nx[n]; you.y = G.ny[n]; }
}

/* ======================================================================
   tap
   ====================================================================== */
export function onTap(ctx, p) {
  if (ctx.mode !== "travel" || !you) return false;
  /* already going. the touch is felt but the journey is the journey. */
  if (trip) { ripple(wx(p.x), wy(p.y)); return true; }

  /* tapping the way you were shown means: go */
  if (plan && hitPlan(p)) { go(); return true; }

  const tx = wx(p.x), ty = wy(p.y);
  const to = nearestNodeFor(tx, ty, S.being, units(700));
  if (to < 0 || to === you.node) { ripple(tx, ty); return true; }

  const full = route(you.node, to, S.being);
  if (!full || full.nodes.length < 2) { ripple(tx, ty); return true; }

  /* You get one turn's worth of effort, and a ladder buys more of the city
     with it than a chute does. Whatever is past that is still drawn — you can
     see exactly where this body runs out — but you do not get there today. */
  const { r, cut } = afford(full, S.being, S.allowance);
  if (!r || r.nodes.length < 2) { ripple(tx, ty); return true; }

  balked = null;
  plan = {
    r, to, cut, full, restPts: cut ? routePoints(full) : null,
    pts: routePoints(r), t0: performance.now(),
    tx: G.nx[to], ty: G.ny[to],
  };
  frameFor(plan);
  emit("plan", plan);
  return true;
}

/* the pin, or anywhere along the way it drew */
function hitPlan(p) {
  const pts = plan.pts;
  if (Math.hypot(sx(plan.tx) - p.x, sy(plan.ty) - p.y - 12) < 42) return true;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const d = distToSeg(p.x, p.y, sx(pts[i]), sy(pts[i + 1]), sx(pts[i + 2]), sy(pts[i + 3])).d;
    if (d < 20) return true;
  }
  return false;
}

function go() {
  const len = pathLength(plan.pts);
  if (plan.pts.length < 4 || len <= 0) { plan = null; return; }
  const hard = !!plan.r.balk;
  const secs = clamp(metres(len) / (S.being.speed * 0.95), 1.5, 6.2);
  trip = {
    r: plan.r, pts: plan.pts, len, at: 0, e: 0, T: secs * 1000,
    hard, t0: performance.now(), vn: 0,
    tx: plan.r.balk ? plan.r.balk.toX : plan.tx,
    ty: plan.r.balk ? plan.r.balk.toY : plan.ty,
  };
  fx.push({ k: "off", x: you.x, y: you.y, t: 0, life: 520 });
  /* whatever the framing did to the zoom, dive back in as we set off */
  cam.frame = null;
  emit("depart", trip);
  plan = null;
}

function ripple(x, y) { fx.push({ k: "miss", x, y, t: 0, life: 640 }); }

/* ======================================================================
   the frame
   ====================================================================== */
function inComfort(X, Y) {
  return X > PAD.x && X < View.w - PAD.x && Y > PAD.t && Y < View.h - PAD.b;
}

/* never past legibility, and never argues with a finger */
function fitTo(coords, maxOut, maxIn) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < coords.length; i += 2) {
    if (coords[i] < x0) x0 = coords[i];
    if (coords[i] > x1) x1 = coords[i];
    if (coords[i + 1] < y0) y0 = coords[i + 1];
    if (coords[i + 1] > y1) y1 = coords[i + 1];
  }
  const w = Math.max(1e-9, x1 - x0), h = Math.max(1e-9, y1 - y0);
  const aw = Math.max(80, View.w - PAD.x * 2);
  const ah = Math.max(80, View.h - PAD.t - PAD.b);
  let z = clamp(Math.log2(Math.min(aw / w, ah / h) / 256), 12.2, 16.2);
  if (!maxIn) z = Math.min(z, View.z);
  else z = Math.min(z, View.z + maxIn);
  if (maxOut != null) z = Math.max(z, View.z - maxOut);
  const ws = 256 * Math.pow(2, z);
  return {
    x: (x0 + x1) / 2,
    y: (y0 + y1) / 2 - (PAD.t - PAD.b) / (2 * ws),
    z,
  };
}

function frameFor(pl) {
  if (performance.now() - cam.userAt < 260) return;
  const a = inComfort(sx(you.x), sy(you.y));
  const b = inComfort(sx(pl.tx), sy(pl.ty));
  if (a && b) return;                       /* it is already all on screen */
  if (cam.zHome == null) cam.zHome = View.z;
  cam.frame = fitTo([you.x, you.y, pl.tx, pl.ty], 2.6);
}

/* ======================================================================
   the loop
   ====================================================================== */
export function draw(ctx, now) {
  const c = ctx.c;
  const q = ctx.quality;

  /* 1. the world moves first, so everything drawn this frame agrees */
  if (trip) advance(ctx, now);
  for (let i = fx.length - 1; i >= 0; i--) {
    fx[i].t += ctx.dt;
    if (fx[i].t > fx[i].life) fx.splice(i, 1);
  }

  /* 2. draw with the camera every other organ already used */
  c.lineCap = "round";
  c.lineJoin = "round";

  if (balked) drawBalk(c, now, q);
  if (plan) drawPlan(c, now);
  if (trip) drawTrip(c, now);
  drawFx(c, q);
  if (you) drawYou(c, now, q);

  c.globalAlpha = 1;
  c.setLineDash([]);
  c.lineDashOffset = 0;

  /* 3. and move the camera last, for the frame after this one */
  camera(ctx, now);
}

/* ---------- travelling ---------- */
function advance(ctx, now) {
  trip.e += ctx.dt;
  const p = clamp(trip.e / trip.T, 0, 1);
  const prev = trip.at;
  trip.at = profile(p, trip.hard) * trip.len;
  const q = alongPath(trip.pts, trip.at);
  you.x = q.x; you.y = q.y; you.ang = q.a;
  /* speed relative to the trip's mean, for the camera's look-ahead */
  const inst = (trip.at - prev) / Math.max(1, ctx.dt);
  trip.vn = lerp(trip.vn, inst / (trip.len / trip.T), 0.18);

  if (p >= 1) arrive(now);
}

/* Pull away, cruise, settle. A short ease off the mark so the tap feels
   answered, a long steady middle so the going is watchable, and a decent
   deceleration into the pin — except when the ground ends, where there is no
   deceleration at all and the traveller simply runs out of world. */
function profile(p, hard) {
  const a = 0.10, b = hard ? 0 : 0.24;
  const I = 1 - a / 2 - b / 2;
  let s;
  if (p < a) s = (p * p) / (2 * a);
  else if (p <= 1 - b) s = a / 2 + (p - a);
  else { const u = 1 - p; s = I - (u * u) / (2 * b); }
  return clamp(s / I, 0, 1);
}

function arrive(now) {
  const r = trip.r;
  const last = r.nodes[r.nodes.length - 1];
  you.node = last;
  you.x = G.nx[last]; you.y = G.ny[last];
  wear(r.edges, 1);
  logJourney(trip.pts, r.edges, S.being);

  if (r.balk) {
    logBalk(r.balk.x, r.balk.y, S.being);
    balked = {
      x: r.balk.x, y: r.balk.y, tx: r.balk.toX, ty: r.balk.toY,
      ang: you.ang, gang: Math.atan2(r.balk.toY - r.balk.y, r.balk.toX - r.balk.x),
      t0: now, stale: false,
    };
    fx.push({ k: "stop", x: r.balk.x, y: r.balk.y, t: 0, life: 1200 });
    /* the gap becomes the whole picture: what you reached, what you wanted,
       and the exact amount of nothing in between */
    setTimeout(() => {
      if (!balked || balked.stale || performance.now() - cam.userAt < 1200) return;
      const D = Math.hypot(sx(balked.tx) - sx(balked.x), sy(balked.ty) - sy(balked.y));
      /* only reframe if you cannot already see the whole of what is missing */
      if (D > 110 && inComfort(sx(balked.tx), sy(balked.ty)) &&
          inComfort(sx(balked.x), sy(balked.y))) return;
      cam.zHome = null;
      cam.frame = fitTo([balked.x, balked.y, balked.tx, balked.ty], 1.8, 1.4);
    }, 420);
  } else {
    fx.push({ k: "land", x: you.x, y: you.y, t: 0, life: 820 });
  }

  const bk = r.balk;
  trip = null;
  /* on a balk the arrival is held back: the stop, the rebound, the gap drawing
     itself out and the traveller trying the wall twice are the event, and
     nothing is allowed to talk over them. */
  setTimeout(() => emit("arrive", { balk: bk }), bk ? 3200 : 420);
}

/* ======================================================================
   the way
   ====================================================================== */
function screenOf(pts) {
  const sp = new Float64Array(pts.length);
  for (let i = 0; i + 1 < pts.length; i += 2) { sp[i] = sx(pts[i]); sp[i + 1] = sy(pts[i + 1]); }
  return sp;
}
function pathOf(sp) {
  const p = new Path2D();
  p.moveTo(sp[0], sp[1]);
  for (let i = 2; i + 1 < sp.length; i += 2) p.lineTo(sp[i], sp[i + 1]);
  return p;
}
function cumOf(sp) {
  const n = sp.length / 2;
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    cum[i] = cum[i - 1] + Math.hypot(sp[i * 2] - sp[i * 2 - 2], sp[i * 2 + 1] - sp[i * 2 - 1]);
  }
  return cum;
}
function ptAt(sp, cum, d) {
  const n = cum.length;
  let lo = 0, hi = n - 1;
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
  const seg = cum[hi] - cum[lo] || 1;
  const t = clamp((d - cum[lo]) / seg, 0, 1);
  return {
    x: lerp(sp[lo * 2], sp[hi * 2], t),
    y: lerp(sp[lo * 2 + 1], sp[hi * 2 + 1], t),
    a: Math.atan2(sp[hi * 2 + 1] - sp[lo * 2 + 1], sp[hi * 2] - sp[lo * 2]),
  };
}

/* Stroke only the span [from,to] of a path, without rebuilding it. The dash is
   put back afterwards without fail — leaving it set silently swallows every
   small stroke drawn after this one, chevrons and pin outline included. */
function span(c, path, from, to, L) {
  const d = Math.max(0, from), e = Math.min(L, to);
  if (e - d < 0.4) return;
  c.setLineDash([e - d, L + d + 8]);
  c.lineDashOffset = -d;
  c.stroke(path);
  c.setLineDash([]);
  c.lineDashOffset = 0;
}

/* the three strokes that make a line read as a route and not as a road */
function laid(c, path, from, to, L, w, alpha) {
  c.globalAlpha = alpha;
  /* the halo is what lifts the way off a busy cloth. it is one more stroke of
     a path we have already built, so it survives every quality drop. */
  c.strokeStyle = HALO; c.lineWidth = w + 7.5;
  span(c, path, from, to, L);
  c.strokeStyle = CASE; c.lineWidth = w + 3.2;
  span(c, path, from, to, L);
  c.strokeStyle = CORE; c.lineWidth = w;
  span(c, path, from, to, L);
  c.globalAlpha = 1;
}

function chevrons(c, sp, cum, from, to, now) {
  const gap = 54;
  const drift = MOTION ? (now * 0.048) % gap : 0;
  c.strokeStyle = PAPER;
  c.lineWidth = 1.6;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.globalAlpha = 0.95;
  c.beginPath();
  for (let d = from + 26 + drift; d < to - 14; d += gap) {
    const q = ptAt(sp, cum, d);
    const ca = Math.cos(q.a), sa = Math.sin(q.a), s = 3.1;
    c.moveTo(q.x - ca * s + sa * s, q.y - sa * s - ca * s);
    c.lineTo(q.x + ca * s, q.y + sa * s);
    c.lineTo(q.x - ca * s - sa * s, q.y - sa * s + ca * s);
  }
  c.stroke();
  c.globalAlpha = 1;
}

function drawPlan(c, now) {
  const sp = screenOf(plan.pts);
  if (sp.length < 4) return;
  const path = pathOf(sp), cum = cumOf(sp);
  const L = cum[cum.length - 1];
  if (L < 1) return;

  const age = now - plan.t0;
  const rev = ease(clamp((age - 40) / 400, 0, 1));

  laid(c, path, 0, L * rev, L, 5.6, 1);
  if (rev > 0.6) chevrons(c, sp, cum, 0, L * rev, now);

  /* the ground told us it will not carry us all the way. show it now, before
     anybody sets off, as the tail of the intention rather than of the route. */
  if (plan.r.balk && rev > 0.55) {
    gapLine(c, sx(plan.r.balk.x), sy(plan.r.balk.y),
      sx(plan.r.balk.toX), sy(plan.r.balk.toY),
      clamp((age - 260) / 420, 0, 1), now, 0.75);
  }

  /* it is standing there waiting to be pressed, and says so by breathing */
  if (!plan.r.balk && age > 420) {
    const ph = MOTION ? ((age - 420) / 1900) % 1 : 0.45;
    c.globalAlpha = (1 - ph) * 0.26;
    c.strokeStyle = SIGNAL;
    c.lineWidth = 1.8;
    c.beginPath();
    c.arc(sx(plan.tx), sy(plan.ty), 8 + ph * 24, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 1;
  }

  pin(c, sx(plan.tx), sy(plan.ty), clamp(age / 380, 0, 1), now,
    plan.r.balk ? "wanting" : "solid");
}

function drawTrip(c, now) {
  const sp = screenOf(trip.pts);
  if (sp.length < 4) return;
  const path = pathOf(sp), cum = cumOf(sp);
  const L = cum[cum.length - 1];
  if (L < 1) return;
  const d = L * (trip.at / trip.len);

  /* behind you the way is spent; ahead of you it is still the way */
  c.globalAlpha = 0.34;
  c.strokeStyle = SPENT; c.lineWidth = 3.4;
  span(c, path, 0, d, L);
  c.globalAlpha = 1;

  laid(c, path, d, L, L, 5.6, 1);
  chevrons(c, sp, cum, d, L, now);

  if (!trip.hard) pin(c, sx(trip.tx), sy(trip.ty), 1, now, "solid");
  else {
    const b = trip.r.balk;
    gapLine(c, sx(b.x), sy(b.y), sx(b.toX), sy(b.toY), 1, now, 0.45);
    pin(c, sx(trip.tx), sy(trip.ty), 1, now, "wanting");
  }
}

/* ---------- the pin ---------- */
function pin(c, X, Y, k, now, mode, a = 1) {
  if (a <= 0.01) return;
  const e = 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  const lift = -34 * (1 - e);
  const breathe = mode === "solid" ? Math.sin(now * 0.0037) * 0.028 * MOTION : 0;
  const s = (0.6 + 0.4 * e) * (1 + breathe);
  const r = 9.4 * s, h = 25 * s;

  /* what it stands on */
  c.globalAlpha = 0.22 * e * a;
  c.fillStyle = INK;
  c.beginPath();
  c.ellipse(X, Y, 7.4 * s, 2.7 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = a;

  const ty = Y + lift;
  c.beginPath();
  c.moveTo(X, ty);
  c.quadraticCurveTo(X - r * 1.06, ty - h * 0.52, X - r, ty - h + r * 0.16);
  c.arc(X, ty - h + r * 0.16, r, Math.PI, 0, false);
  c.quadraticCurveTo(X + r * 1.06, ty - h * 0.52, X, ty);
  c.closePath();

  if (mode === "wanting") {
    /* it is still standing there. nothing reaches it. */
    c.fillStyle = PAPER; c.fill();
    c.setLineDash([3.2, 3.2]);
    c.strokeStyle = SIGNAL; c.lineWidth = 2;
    c.stroke();
    c.setLineDash([]);
    const ph = MOTION ? (now * 0.00042) % 1 : 0.4;
    c.globalAlpha = (1 - ph) * 0.5 * a;
    c.strokeStyle = SIGNAL; c.lineWidth = 1.5;
    c.beginPath();
    c.arc(X, Y, 5 + ph * 26, 0, Math.PI * 2);
    c.stroke();
  } else {
    c.fillStyle = SIGNAL; c.fill();
    c.strokeStyle = PAPER; c.lineWidth = 2.1; c.stroke();
    c.beginPath();
    c.arc(X, ty - h + r * 0.16, r * 0.34, 0, Math.PI * 2);
    c.fillStyle = PAPER; c.fill();
  }
  c.globalAlpha = 1;
}

/* ======================================================================
   the balk — the most important thing that can happen
   ====================================================================== */

/* A measured gap: two ticks and, between them, a line that is not there. It
   wavers the way a line does before a hand has made it, and it marches toward
   the place it wants to reach. There is no word for it anywhere on screen. */
function gapLine(c, ax, ay, bx, by, rev, now, alpha) {
  const fd = Math.hypot(bx - ax, by - ay);
  if (fd < 26) return;
  /* stand clear of the traveller and of the pin, so both ticks can be read */
  const inA = Math.min(15, fd * 0.16), inB = Math.min(12, fd * 0.14);
  const X0 = ax + (bx - ax) * (inA / fd), Y0 = ay + (by - ay) * (inA / fd);
  const X1 = bx - (bx - ax) * (inB / fd), Y1 = by - (by - ay) * (inB / fd);
  const dx = X1 - X0, dy = Y1 - Y0;
  const D = Math.hypot(dx, dy);
  if (D < 5) return;
  const px = -dy / D, py = dx / D;
  const r = ease(clamp(rev, 0, 1));
  const amp = Math.min(7, D * 0.055);
  const n = clamp(Math.round(D / 11), 3, 34);

  c.save();
  c.strokeStyle = SIGNAL;
  c.lineCap = "round";

  /* the line that is not there */
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = (r * i) / n;
    const w = Math.sin(t * Math.PI) * Math.sin(t * 7.4 + now * 0.0011 * MOTION) * amp;
    const X = X0 + dx * t + px * w, Y = Y0 + dy * t + py * w;
    if (i === 0) c.moveTo(X, Y); else c.lineTo(X, Y);
  }
  c.setLineDash([6, 6]);
  c.lineDashOffset = MOTION ? -((now * 0.036) % 12) : 0;
  c.globalAlpha = alpha * 0.30;
  c.lineWidth = 6.5;
  c.stroke();
  c.globalAlpha = alpha * (0.80 + 0.20 * Math.sin(now * 0.0027) * MOTION);
  c.lineWidth = 2.6;
  c.stroke();
  c.setLineDash([]);
  c.lineDashOffset = 0;

  /* the ticks are what make it a measurement rather than a scribble */
  c.globalAlpha = alpha;
  c.lineWidth = 2.6;
  c.beginPath();
  c.moveTo(X0 + px * 9, Y0 + py * 9); c.lineTo(X0 - px * 9, Y0 - py * 9);
  c.stroke();
  if (r > 0.985) {
    c.beginPath();
    c.moveTo(X1 + px * 9, Y1 + py * 9); c.lineTo(X1 - px * 9, Y1 - py * 9);
    c.stroke();
  }
  c.restore();
  c.globalAlpha = 1;
}

function drawBalk(c, now, q) {
  const age = now - balked.t0;
  const X = sx(balked.x), Y = sy(balked.y);
  const TX = sx(balked.tx), TY = sy(balked.ty);
  let dim = 1;
  if (balked.stale) {
    dim = 0.5 * (1 - clamp((now - balked.staleAt - 2600) / 7000, 0, 1));
    if (dim <= 0.01) { balked = null; return; }
  }

  /* the ground ends here, square across the way you wanted to keep going */
  const ca = Math.cos(balked.gang), sa = Math.sin(balked.gang);
  const set = ease(clamp(age / 260, 0, 1));
  const lean = pressing(age) * 2.4;
  const bx = X + ca * (14 + lean), by = Y + sa * (14 + lean);
  c.globalAlpha = dim;
  c.strokeStyle = SIGNAL;
  c.lineWidth = 4.4;
  c.beginPath();
  c.moveTo(bx - sa * 14 * set, by + ca * 14 * set);
  c.lineTo(bx + sa * 14 * set, by - ca * 14 * set);
  c.stroke();
  c.globalAlpha = 1;

  gapLine(c, X, Y, TX, TY, clamp((age - 200) / 620, 0, 1), now, 0.92 * dim);

  pin(c, TX, TY, 1, now, "wanting", dim);

  /* it keeps ringing. something is still wrong here. */
  if (!balked.stale && q > 0.25 && age < 30000) {
    for (let i = 0; i < 2; i++) {
      const ph = MOTION ? ((age - 120) / 2300 + i * 0.44) % 1 : 0.3 + i * 0.3;
      if (ph < 0 || ph > 1) continue;
      c.globalAlpha = (1 - ph) * 0.45;
      c.strokeStyle = SIGNAL;
      c.lineWidth = 1.8;
      c.beginPath();
      c.arc(X, Y, 7 + ph * 44, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
  }
}

/* how hard the traveller is leaning on the wall at this instant */
function pressing(age) {
  if (age < 760 || !MOTION) return 0;
  const t = (age - 760) % 2000;
  return Math.max(0, Math.sin(t / 200)) * Math.exp(-t / 460);
}

/* ======================================================================
   you
   ====================================================================== */
function drawYou(c, now, q) {
  let X = sx(you.x), Y = sy(you.y);
  const ink = S.being.ink;
  let sqx = 1, sqy = 1;

  if (trip) {
    const dep = clamp((now - trip.t0) / 300, 0, 1);
    const k = (1 - dep) * Math.sin(dep * Math.PI) * 0.55;
    sqx = 1 + k; sqy = 1 - k * 0.7;
    /* what you are pushing through */
    if (q > 0.3) {
      c.save();
      c.translate(X, Y); c.rotate(you.ang);
      const g = c.createLinearGradient(-30, 0, 4, 0);
      g.addColorStop(0, "rgba(44,98,171,0)");
      g.addColorStop(1, "rgba(44,98,171,.30)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(4, 0); c.lineTo(-30, -6.5); c.lineTo(-30, 6.5);
      c.closePath(); c.fill();
      c.restore();
    }
  } else if (balked && !balked.stale) {
    /* stopped dead — and then it goes on trying, which is the whole thing */
    const age = now - balked.t0;
    const d = Math.exp(-age / 300);
    const push = -6.6 * d * Math.cos(age / 62) + pressing(age) * 6.2;
    X += Math.cos(balked.gang) * push;
    Y += Math.sin(balked.gang) * push;
    const s = 0.24 * d + 0.16 * pressing(age);
    sqx = 1 - s; sqy = 1 + s;
  }

  /* the soft claim on the ground under you — and the only thing on screen
     that is the colour of what you currently are */
  if (q > 0.3) {
    const b = 0.5 + 0.5 * Math.sin(now * 0.0021) * MOTION;
    const rr = 17 + b * 4;
    const g = c.createRadialGradient(X, Y, 3, X, Y, rr);
    g.addColorStop(0, hexA(ink.ladder, 0.26));
    g.addColorStop(1, hexA(ink.ladder, 0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(X, Y, rr, 0, Math.PI * 2);
    c.fill();
  }

  c.save();
  c.translate(X, Y);
  if (trip) c.rotate(you.ang);
  else if (balked && !balked.stale) c.rotate(balked.gang);
  c.scale(sqx, sqy);
  /* paper is nearly the colour of the ground, so the ring needs an edge of
     its own or the traveller reads as a smudge instead of a body */
  c.beginPath();
  c.arc(0, 0.9, 10.4, 0, Math.PI * 2);
  c.fillStyle = "rgba(29,32,29,.20)";
  c.fill();
  c.beginPath();
  c.arc(0, 0, 10.1, 0, Math.PI * 2);
  c.fillStyle = PAPER;
  c.fill();
  c.beginPath();
  c.arc(0, 0, 6.7, 0, Math.PI * 2);
  c.fillStyle = ink.live;
  c.fill();
  c.lineWidth = 1.3;
  c.strokeStyle = "rgba(29,32,29,.42)";
  c.beginPath();
  c.arc(0, 0, 10.1, 0, Math.PI * 2);
  c.stroke();
  c.restore();
}

/* ---------- flourishes ---------- */
function drawFx(c, q) {
  for (const f of fx) {
    const k = f.t / f.life;
    const X = sx(f.x), Y = sy(f.y);
    if (f.k === "miss") {
      c.globalAlpha = (1 - k) * 0.5;
      c.strokeStyle = S.being.ink.dead;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(X, Y, 4 + ease(k) * 22, 0, Math.PI * 2);
      c.stroke();
    } else if (f.k === "off") {
      c.globalAlpha = (1 - k) * 0.55;
      c.strokeStyle = CORE;
      c.lineWidth = 2.4 * (1 - k) + 0.6;
      c.beginPath();
      c.arc(X, Y, 8 + ease(k) * 26, 0, Math.PI * 2);
      c.stroke();
    } else if (f.k === "land") {
      /* the pin takes you in and goes */
      c.globalAlpha = (1 - k) * 0.75;
      c.strokeStyle = SIGNAL;
      c.lineWidth = 2.6 * (1 - k) + 0.7;
      c.beginPath();
      c.arc(X, Y, 5 + ease(k) * 30, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
      c.save();
      c.translate(X, Y);
      c.scale(1, 1 - ease(k) * 0.9);
      pin(c, 0, 0, 1, 0, "solid", 1 - k * k);
      c.restore();
    } else if (f.k === "stop" && q > 0.25) {
      c.globalAlpha = (1 - k) * 0.85;
      c.strokeStyle = SIGNAL;
      c.lineWidth = 3.6 * (1 - k) + 0.6;
      c.beginPath();
      c.arc(X, Y, 3 + ease(k) * 46, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.globalAlpha = 1;
}

/* ======================================================================
   the camera
   ====================================================================== */
function camera(ctx, now) {
  /* did a finger move the world since we last wrote to it? */
  let moved = false;
  if (View.x !== cam.lx || View.y !== cam.ly || View.z !== cam.lz) {
    if (!Number.isNaN(cam.lx)) {
      moved = true;
      cam.userAt = now; cam.frame = null; cam.zHome = null;
    }
  }
  const dt = ctx.dt;
  const since = now - cam.userAt;

  /* the map moved under a finger this very frame. do not push back on it. */
  if (moved) { clampView(); cam.lx = View.x; cam.ly = View.y; cam.lz = View.z; return; }

  if (cam.frame) {
    const k = 1 - Math.exp(-dt / 260);
    View.x += (cam.frame.x - View.x) * k;
    View.y += (cam.frame.y - View.y) * k;
    View.z += (cam.frame.z - View.z) * k;
    const ws = worldSize();
    if (Math.abs(cam.frame.z - View.z) < 0.005 &&
        Math.hypot((cam.frame.x - View.x) * ws, (cam.frame.y - View.y) * ws) < 1.2) {
      View.x = cam.frame.x; View.y = cam.frame.y; View.z = cam.frame.z;
      cam.frame = null;
    }
  } else if (trip) {
    /* dive back to the zoom you were at before we showed you the whole route */
    if (cam.zHome != null) {
      const k = 1 - Math.exp(-dt / 520);
      View.z += (cam.zHome - View.z) * k;
      if (Math.abs(cam.zHome - View.z) < 0.006) { View.z = cam.zHome; cam.zHome = null; }
    }

    const ws = worldSize();
    /* look a little way up the road, further the faster you are going */
    const leadPx = Math.min(View.h * 0.15, 104) * clamp(trip.vn, 0, 1.5) / 1.5;
    const tx = you.x + Math.cos(you.ang) * leadPx / ws;
    const ty = you.y + Math.sin(you.ang) * leadPx / ws;

    /* The leash. Right after a finger it is long and lazy — it will only ever
       catch a traveller about to walk off the edge of the screen — and then
       over a second and a half it draws back in to a proper follow. */
    const back = ease(clamp((since - 1600) / 1500, 0, 1));
    const slack = lerp(Math.min(View.w, View.h) * 0.42, 9, back);
    const tau = lerp(1000, 250, back);

    const dx = tx - View.x, dy = ty - View.y;
    const dpx = Math.hypot(dx * ws, dy * ws);
    if (dpx > slack) {
      const pull = (dpx - slack) / dpx;
      const k = 1 - Math.exp(-dt / tau);
      View.x += dx * pull * k;
      View.y += dy * pull * k;
    }
  }

  clampView();
  cam.lx = View.x; cam.ly = View.y; cam.lz = View.z;
}

export const state = () => ({ you, plan, trip, balked });
