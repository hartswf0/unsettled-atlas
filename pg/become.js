/* PERSPECTIVAL GROUND — becoming.

   The signature move, and the one thing that must never feel like a filter
   being applied. The camera does not move. The city does not move. Your
   position does not move. What changes is which of it is ground.

   The moment is built out of one refusal and one difference.

   THE REFUSAL. The instant before the turn the screen is photographed, and the
   photograph is held over everything, pinned to the ground it was taken of.
   Ahead of the front, Atlanta is exactly, pixel for pixel, the city you were
   just standing in. It is not dissolving, it is not sliding, it is not being
   replaced. It has simply not been re-read yet.

   THE DIFFERENCE. A front leaves you and crosses the cloth, and behind it the
   ground is asked again — and answers at once, at full strength, so that the
   board is never a pale version of itself. Every fibre the old body could use
   and the new one cannot lets go: it sags under its own weight, greys, and is
   gone. Every fibre that was not there a moment ago comes up slack out of the
   paper and pulls taut into existence in the new body's ink. Everything else
   stands exactly where it stood and is simply worth something else now.

   Nothing moves except tension. That difference is the whole content of the
   moment, and it is never named: the thread that dies for one traveller is the
   thread that arrives for the next, and the only way to learn which is which
   is to have been both. */

import { View, sx, sy, clamp, lerp, ease, hash01, viewBounds, pxPerM } from "./geo.js";
import { S, on, become } from "./state.js";
import { nextBeing } from "./beings.js";
import { G, edgesInBox } from "./graph.js";

const PAPER_LIT = "#f7f3e8", LIGHT = "#fffdf4";

/* Some people cannot take a screen that keeps moving. They still become — the
   board still reorganises — it simply does it without the sweep. */
const MOTION = (() => {
  try { return matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1; }
  catch { return 1; }
})();

/* the shape of a turn, in milliseconds */
const HOLD = 70;      /* the breath in: it gathers at the one place it happens to */
const SWEEP = 420;    /* the front leaves you and reaches the far corner */
const LOST_MS = 430;  /* a fibre going slack and inert */
const GAIN_MS = 430;  /* a fibre coming up out of the paper and pulling taut */
const HAND = 780;     /* by here the cloth is carrying the new board on its own */
const DUR = 1160;

/* ============================================================
   the turn cycle

   One turn is one completed passage — including the passages that failed,
   which are the ones worth having. But a turn is never allowed to talk over
   the player: one that comes due while a finger is down, while a way is drawn
   and waiting to be taken, or while a hand is laying a line, simply waits.
   That is the whole difference between earned and imposed.
   ============================================================ */
let due = 0;          /* when the ground is ready to hand you on. 0 = never */
let planAt = 0;       /* a way is on screen, unconfirmed, since when */
let tripping = false;
const fingers = new Set();
let ctxRef = null;

export function init(ctx) {
  ctxRef = ctx;
  on("plan", () => { planAt = performance.now(); });
  on("depart", () => { tripping = true; planAt = 0; });
  on("arrive", (info) => {
    tripping = false;
    planAt = 0;
    /* a balk has already had its long, loud hold. it does not need another. */
    due = performance.now() + (info && info.balk ? 220 : 400);
  });
  /* fingers are watched, never claimed — main.js owns the gesture */
  const cv = ctx.cv;
  cv.addEventListener("pointerdown", (e) => fingers.add(e.pointerId), { passive: true });
  const up = (e) => fingers.delete(e.pointerId);
  cv.addEventListener("pointerup", up, { passive: true });
  cv.addEventListener("pointercancel", up, { passive: true });
  /* the photograph is of a screen that no longer exists. drop it and let the
     cloth finish the turn on its own rather than hold up a torn city. */
  on("resize", () => { t0 = 0; });
}

function ready(now) {
  if (!due || now < due || t0) return false;
  if (fingers.size > 0 || tripping) return false;
  if (ctxRef && ctxRef.mode !== "travel") return false;   /* a hand is drawing */
  /* a way is drawn and waiting to be taken: it is theirs, not the ground's.
     abandoned long enough, though, and the turn takes it back. */
  if (planAt && now - planAt < 4500) return false;
  return true;
}

/* ============================================================
   the photograph — the city, refusing to have changed
   ============================================================ */
let snap = null, sctx = null;
let snapX = 0, snapY = 0, snapZ = 0;

function photograph(cv) {
  if (!cv.width || !cv.height) return false;
  if (!snap) { snap = document.createElement("canvas"); sctx = snap.getContext("2d"); }
  if (snap.width !== cv.width || snap.height !== cv.height) {
    snap.width = cv.width; snap.height = cv.height;
  }
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, snap.width, snap.height);
  sctx.drawImage(cv, 0, 0);
  snapX = View.x; snapY = View.y; snapZ = View.z;
  return true;
}

/* Where the photograph belongs now. It is pinned to the ground and not to the
   glass, so a camera still settling from the last arrival cannot tear it. */
function snapRect() {
  const s = Math.pow(2, View.z - snapZ);
  const ws = 256 * Math.pow(2, View.z);
  return {
    x: View.w / 2 * (1 - s) + (snapX - View.x) * ws,
    y: View.h / 2 * (1 - s) + (snapY - View.y) * ws,
    w: View.w * s, h: View.h * s,
  };
}

/* ============================================================
   the difference

   Asked once, at the turn, of every piece of ground on this screen: what were
   you, and what are you now. Three answers matter — it is gone, it is here,
   it stands. Each edge keeps how long the front takes to reach it, so a frame
   only ever touches what is in flight.
   ============================================================ */
const LOST = 0, GAINED = 1, STANDS = 2;
const NBUCK = 8, NSLOT = 4, NGROUP = 3 * NSLOT * 2, NBIN = NGROUP * NBUCK;

let N = 0;
let EAX = null, EAY = null, EBX = null, EBY = null;   /* the ends, in the world */
let EDEL = null, EGRP = null;
let PSX = null, PSY = null, PQX = null, PQY = null, PCX = null, PCY = null;
let ORDER = null, KEY = null, COUNT = null, START = null, CUR = null;

let LOSTC = null, NEWC = null, DEADC = null;
let originX = 0, originY = 0, maxD = 1, phase = 0;
let t0 = 0, fromB = null, held = false;

function rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function css(c) { return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; }
function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

/* what a being makes of a piece of ground, both ways round: ground you could
   only leave by is still ground you have */
function kindOf(be, e) {
  const a = be.read(e, true), b = be.read(e, false);
  const ra = a.live ? a.ratio : Infinity, rb = b.live ? b.ratio : Infinity;
  const r = ra <= rb ? a : b;
  return !r.live ? 0 : r.kind === "ladder" ? 2 : r.kind === "chute" ? 3 : 1;
}

function room(n) {
  if (EAX && EAX.length >= n) return;
  const s = Math.max(1024, 1 << Math.ceil(Math.log2(n)));
  EAX = new Float64Array(s); EAY = new Float64Array(s);
  EBX = new Float64Array(s); EBY = new Float64Array(s);
  EDEL = new Float32Array(s); EGRP = new Uint8Array(s);
  PSX = new Float32Array(s); PSY = new Float32Array(s);
  PQX = new Float32Array(s); PQY = new Float32Array(s);
  PCX = new Float32Array(s); PCY = new Float32Array(s);
  ORDER = new Int32Array(s); KEY = new Int16Array(s);
  if (!COUNT) { COUNT = new Int32Array(NBIN); START = new Int32Array(NBIN); CUR = new Int32Array(NBIN); }
}

const _box = [];
const _pri = [];

function survey(from, to, quality) {
  /* a big screen holds more ground than a phone, and a hole in the new board
     is worse to look at than the cost of covering it */
  const cap = Math.round((quality > 0.7 ? 2200 : 1000) *
    clamp((View.w * View.h) / (390 * 844), 1, 2.2));
  const b = viewBounds(50);
  edgesInBox(b.x0, b.y0, b.x1, b.y1, _box);

  /* the front leaves the traveller, because the change is happening to them */
  const y = S.you;
  originX = y ? sx(y.x) : View.w / 2;
  originY = y ? sy(y.y) : View.h / 2;
  maxD = 1;
  for (let i = 0; i < 4; i++) {
    const cx = (i & 1) * View.w, cy = (i >> 1) * View.h;
    maxD = Math.max(maxD, Math.hypot(cx - originX, cy - originY));
  }

  room(_box.length + 8);
  N = 0;
  _pri.length = 0;
  for (let i = 0; i < _box.length; i++) {
    const e = _box[i];
    const ok = kindOf(from, e), nk = kindOf(to, e);
    if (ok === 0 && nk === 0) continue;

    let cat, slot;
    if (nk === 0) { cat = LOST; slot = ok - 1; }
    else if (ok === 0) { cat = GAINED; slot = nk - 1; }
    else { cat = STANDS; slot = (nk === 2 && ok !== 2) ? 3 : nk - 1; }

    const a = G.ea[e], z = G.eb[e];
    const ax = sx(G.nx[a]), ay = sy(G.ny[a]), bx = sx(G.nx[z]), by = sy(G.ny[z]);
    if ((ax < -40 && bx < -40) || (ax > View.w + 40 && bx > View.w + 40) ||
        (ay < -40 && by < -40) || (ay > View.h + 40 && by > View.h + 40)) continue;

    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const wide = G.ec[e] <= 1 ? 1 : 0;
    EAX[N] = G.nx[a]; EAY[N] = G.ny[a]; EBX[N] = G.nx[z]; EBY[N] = G.ny[z];
    /* exactly when the front arrives here — the inverse of frontR */
    const d = clamp(Math.hypot(mx - originX, my - originY) / (maxD * OVER), 0, 0.999);
    EDEL[N] = HOLD + SWEEP * (1 - Math.pow(1 - d, 1 / 1.45));
    EGRP[N] = (cat * NSLOT + slot) * 2 + wide;
    /* what a screen can lose first: ground that only stands there */
    _pri.push((cat === STANDS ? 0 : 1e7) + Math.hypot(bx - ax, by - ay));
    N++;
  }

  if (N > cap) {
    const idx = Array.from({ length: N }, (_, i) => i);
    idx.sort((p, q) => _pri[q] - _pri[p]);
    idx.length = cap;
    idx.sort((p, q) => EDEL[p] - EDEL[q]);
    const ax = EAX.slice(0, N), ay = EAY.slice(0, N), bx = EBX.slice(0, N), by = EBY.slice(0, N);
    const dl = EDEL.slice(0, N), gp = EGRP.slice(0, N);
    for (let i = 0; i < cap; i++) {
      const j = idx[i];
      EAX[i] = ax[j]; EAY[i] = ay[j]; EBX[i] = bx[j]; EBY[i] = by[j];
      EDEL[i] = dl[j]; EGRP[i] = gp[j];
    }
    N = cap;
  }

  LOSTC = [rgb(from.ink.live), rgb(from.ink.ladder), rgb(from.ink.chute), rgb(from.ink.ladder)];
  NEWC = [rgb(to.ink.live), rgb(to.ink.ladder), rgb(to.ink.chute), rgb(to.ink.ladder)];
  DEADC = rgb(from.ink.dead);
  phase = hash01(S.turn * 13.7 + 3) * 6.283185;
}

/* ============================================================
   the turn
   ============================================================ */
export function turn() {
  const ctx = ctxRef;
  fromB = S.being;
  const to = nextBeing(S.being);
  held = !!(ctx && ctx.cv && photograph(ctx.cv));
  survey(fromB, to, ctx ? ctx.quality : 1);
  become(to);
  due = 0;
  t0 = performance.now();
}

/* ============================================================
   the front
   ============================================================ */
/* it runs a little past the far corner, so no sliver of the old board is ever
   left standing in a corner the wobble did not quite reach */
const OVER = 1.16;
function frontR(t) {
  const u = clamp((t - HOLD) / SWEEP, 0, 1);
  return maxD * OVER * (1 - Math.pow(1 - u, 1.45));
}

const NC = 80;
function contour(c, R) {
  for (let i = 0; i <= NC; i++) {
    const th = i / NC * 6.283185;
    /* cloth, not radar: the front comes apart at the scale of the weave */
    const r = R * (1 + 0.055 * Math.sin(th * 3 + phase) + 0.032 * Math.sin(th * 7 - phase * 1.7)
      + 0.018 * Math.sin(th * 13 + 1.1));
    const X = originX + Math.cos(th) * r, Y = originY + Math.sin(th) * r;
    if (i === 0) c.moveTo(X, Y); else c.lineTo(X, Y);
  }
  c.closePath();
}

/* How much of the new board the cloth is not yet carrying. cloth.js brings the
   ground a being can use up over its own turn; behind the front it has to be
   all the way there, so whatever is missing is made up here and handed back. */
function shortfall(t) {
  const k = clamp(t / HAND, 0, 1);
  const rise = ease(0.3 + k * 0.7);
  return clamp((0.97 - rise) / (1 - rise + 0.0001), 0, 1);
}

/* ============================================================
   the frame
   ============================================================ */
export function draw(ctx, now) {
  if (ready(now)) turn();
  if (!t0) return;
  const t = now - t0;
  if (t > DUR) { t0 = 0; return; }
  const c = ctx.c;

  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";

  if (!MOTION) {
    const k = clamp(t / 320, 0, 1);
    if (held && k < 1) {
      const r = snapRect();
      c.globalAlpha = 1 - ease(k);
      c.drawImage(snap, r.x, r.y, r.w, r.h);
      c.globalAlpha = 1;
    }
    threads(c, t, ctx.quality, true);
    name(c, t);
    c.restore();
    return;
  }

  const R = frontR(t);

  threads(c, t, ctx.quality, false);

  /* the city, refusing. everything the front has not reached is untouched. */
  if (held && R < maxD * (OVER + 0.02)) {
    const r = snapRect();
    c.save();
    c.beginPath();
    c.rect(-2, -2, View.w + 4, View.h + 4);
    contour(c, R);
    c.clip("evenodd");
    c.globalAlpha = 1;
    c.drawImage(snap, r.x, r.y, r.w, r.h);
    c.restore();
  }

  front(c, t, R, ctx.quality);
  name(c, t);

  c.globalAlpha = 1;
  c.restore();
}

/* ---------- the front itself ----------
   A band where the cloth is neither board: bare lit paper with the fibre ends
   still showing where they have just been let go of.
   ---------- */
function front(c, t, R, q) {
  if (t < HOLD) {
    /* it gathers at the one place it is happening to, and lets go */
    const u = clamp(t / HOLD, 0, 1);
    c.globalAlpha = u * 0.8;
    c.fillStyle = LIGHT;
    c.beginPath();
    c.arc(originX, originY, 3 + u * 12, 0, 6.283185);
    c.fill();
    c.globalAlpha = 1;
    return;
  }
  if (R <= 0.5) return;
  const u = clamp((t - HOLD) / SWEEP, 0, 1);
  const fade = (1 - u * 0.28) * (1 - clamp((u - 0.84) / 0.16, 0, 1));
  if (fade <= 0.01) return;

  c.strokeStyle = PAPER_LIT;
  if (q > 0.5) {
    c.globalAlpha = 0.17 * fade;
    c.lineWidth = 38;
    c.beginPath(); contour(c, R - 11); c.stroke();
  }
  c.globalAlpha = 0.34 * fade;
  c.lineWidth = 15;
  c.beginPath(); contour(c, R - 3); c.stroke();

  c.globalAlpha = 0.6 * fade;
  c.strokeStyle = LIGHT;
  c.lineWidth = 2.4;
  c.beginPath(); contour(c, R); c.stroke();

  /* the ends of what has just been let go of */
  if (q > 0.55) {
    c.globalAlpha = 0.34 * fade;
    c.strokeStyle = "#9a9083";
    c.lineWidth = 1.1;
    c.beginPath();
    for (let i = 0; i < 52; i++) {
      const th = (i / 52) * 6.283185 + phase * 0.3;
      const j = hash01(i * 31.7 + 5);
      const r = R * (1 + 0.055 * Math.sin(th * 3 + phase) + 0.032 * Math.sin(th * 7 - phase * 1.7));
      const ca = Math.cos(th), sa = Math.sin(th);
      const i0 = -3 - j * 9, i1 = 2 + hash01(i * 7.3) * 10;
      c.moveTo(originX + ca * (r + i0), originY + sa * (r + i0));
      c.lineTo(originX + ca * (r + i1), originY + sa * (r + i1));
    }
    c.stroke();
  }
  c.globalAlpha = 1;
}

/* ---------- the fibres ----------
   Everything in flight this frame, counting-sorted into a handful of paths, so
   that two thousand fibres cost a dozen strokes.
   ---------- */
function threads(c, t, q, flat) {
  if (!N) return;
  const sup = shortfall(t);
  COUNT.fill(0);
  let live = 0;

  for (let i = 0; i < N; i++) {
    const tl = flat ? 1e4 : t - EDEL[i];
    if (tl < 0) continue;
    const g = EGRP[i];
    const cat = (g >> 3);
    let bk;
    if (cat === STANDS) {
      /* it does not arrive. it was always there. it is only read again. */
      if (sup <= 0.02) continue;
      bk = Math.min(NBUCK - 1, (tl / 9) | 0);
    } else {
      const span = cat === LOST ? LOST_MS : GAIN_MS;
      if (tl >= span) continue;
      bk = Math.min(NBUCK - 1, ((tl / span) * NBUCK) | 0);
    }

    const ax = sx(EAX[i]), ay = sy(EAY[i]), bx = sx(EBX[i]), by = sy(EBY[i]);
    const mx = (ax + bx) / 2, my = (ay + by) / 2;

    if (cat === STANDS) {
      PSX[i] = ax; PSY[i] = ay; PQX[i] = bx; PQY[i] = by;
      PCX[i] = mx; PCY[i] = my;
    } else {
      /* A piece of this city is short — a block, twenty pixels — so a bow
         alone would say nothing. What a fibre losing its tension does is come
         away from its junctions, shorten, fall and sag, all at once, and the
         whole board visibly comes apart at the seams. Arriving is that run
         backwards: a short slack fragment lying low in the paper that reaches
         out to its neighbours, rises, and pulls straight. */
      const dx = bx - ax, dy = by - ay;
      const L = Math.hypot(dx, dy) || 1;
      /* of the two perpendiculars, the one pointing down the screen */
      let px = -dy / L, py = dx / L;
      if (py < 0) { px = -px; py = -py; }
      const pull = 0.42 + 0.58 * py;
      const p = tl / (cat === LOST ? LOST_MS : GAIN_MS);

      let hold, drop, bow;
      if (cat === LOST) {
        hold = 1 - 0.5 * ease(p);
        drop = (2 + 16 * p * p) * pull;
        bow = Math.min(22, L * 0.34) * Math.pow(p, 1.3) * pull;
      } else {
        const taut = 1 - Math.pow(1 - clamp(p / 0.62, 0, 1), 2.6);
        hold = 0.5 + 0.5 * taut;
        drop = 7.5 * (1 - taut) * pull;
        bow = Math.min(20, L * 0.3) * (1 - taut) * pull - Math.sin(taut * 3.14159) * 1.8;
      }
      PSX[i] = mx + (ax - mx) * hold + px * drop;
      PSY[i] = my + (ay - my) * hold + py * drop;
      PQX[i] = mx + (bx - mx) * hold + px * drop;
      PQY[i] = my + (by - my) * hold + py * drop;
      PCX[i] = mx + px * (drop + bow * 2);
      PCY[i] = my + py * (drop + bow * 2);
    }

    const key = g * NBUCK + bk;
    KEY[i] = key;
    COUNT[key]++;
    live++;
  }
  if (!live) return;

  let acc = 0;
  for (let b = 0; b < NBIN; b++) { START[b] = acc; CUR[b] = acc; acc += COUNT[b]; }
  for (let i = 0; i < N; i++) {
    const tl = flat ? 1e4 : t - EDEL[i];
    if (tl < 0) continue;
    const cat = EGRP[i] >> 3;
    if (cat === STANDS) { if (sup <= 0.02) continue; }
    else if (tl >= (cat === LOST ? LOST_MS : GAIN_MS)) continue;
    ORDER[CUR[KEY[i]]++] = i;
  }

  const zt = clamp((View.z - 10.5) / 6.5, 0, 1);
  const ppm = pxPerM();

  for (let b = 0; b < NBIN; b++) {
    const n = COUNT[b];
    if (!n) continue;
    const bk = b % NBUCK, g = (b / NBUCK) | 0;
    const cat = g >> 3, wide = g & 1, slot = (g >> 1) & 3;
    const p = (bk + 0.5) / NBUCK;

    /* near enough to what the cloth will lay for the same ground, so that the
       hand-back is a settling and never a step */
    const base = wide
      ? Math.max(lerp(1.15, 3.15, zt), 12 * ppm * 0.9)
      : Math.max(lerp(0.72, 1.95, zt), 6 * ppm * 0.78);
    const kmul = (slot === 1 || slot === 3) ? 1.7 : slot === 2 ? 1.05 : 1.25;
    /* what drags on you was never laid as heavily as what carries you, in this
       cloth or any other; matching that here is what makes the hand-back mute */
    const ka = slot === 2 ? 0.6 : slot === 0 ? 0.95 : 1;

    let col, alpha, w;
    if (cat === LOST) {
      col = css(mix(LOSTC[slot], DEADC, Math.pow(p, 0.6)));
      alpha = Math.pow(1 - p, 1.15) * 0.95 * ka;
      w = Math.max(0.8, base * kmul * (1 - p * 0.55));
    } else if (cat === GAINED) {
      /* it is there at once, and slack; what takes the time is the tightening */
      const rise = clamp(p / 0.14, 0, 1);
      const taut = clamp(p / 0.62, 0, 1);
      const gone = clamp((p - 0.7) / 0.3, 0, 1);
      alpha = rise * (1 - gone * (1 - sup * 0.9)) * (0.62 + 0.38 * taut) * ka;
      col = css(NEWC[slot]);
      w = Math.max(0.9, base * kmul * (0.45 + 0.55 * taut));
    } else {
      col = css(NEWC[slot]);
      alpha = sup * Math.min(1, (bk + 1) / 3) * 0.86 * ka;
      w = Math.max(0.9, base * kmul);
    }
    if (alpha <= 0.015) continue;

    c.globalAlpha = alpha;
    c.strokeStyle = col;
    c.lineWidth = w;
    c.beginPath();
    const s0 = START[b];
    if (cat === STANDS) {
      /* ground that stands is straight, and a straight line is a cheaper thing
         to rasterise than a curve — which matters, because this is the bulk */
      for (let k = 0; k < n; k++) {
        const i = ORDER[s0 + k];
        c.moveTo(PSX[i], PSY[i]);
        c.lineTo(PQX[i], PQY[i]);
      }
    } else {
      for (let k = 0; k < n; k++) {
        const i = ORDER[s0 + k];
        c.moveTo(PSX[i], PSY[i]);
        c.quadraticCurveTo(PCX[i], PCY[i], PQX[i], PQY[i]);
      }
    }
    c.stroke();

    if (q > 0.45) {
      /* the instant a fibre goes taut, it rings */
      if (cat === GAINED && bk === 4) {
        c.globalAlpha = alpha * 0.75;
        c.strokeStyle = LIGHT;
        c.lineWidth = Math.max(0.7, w * 0.3);
        c.stroke();
      }
      /* ground that has only just started carrying you blooms out of the
         cloth, and so does ground that carries you and is about to stop */
      if (slot === 3 || (cat !== STANDS && slot === 1)) {
        c.globalAlpha = alpha * (slot === 3 ? 0.24 : 0.13);
        c.strokeStyle = col;
        c.lineWidth = w * (slot === 3 ? 3.4 : 2.6);
        c.stroke();
      }
    }
  }
  c.globalAlpha = 1;
}

/* ============================================================
   the name

   The sentence does not change. Only the noun does — the old one lets go and
   spreads apart as it leaves, the new one arrives loose and draws itself in.
   It is a name and nothing else: no gloss, no list, no key.
   ============================================================ */
function runWord(c, s, x, y, sp, stroke) {
  let X = x;
  for (let i = 0; i < s.length; i++) {
    if (stroke) c.strokeText(s[i], X, y); else c.fillText(s[i], X, y);
    X += c.measureText(s[i]).width + sp;
  }
}
function runWidth(c, s, sp) {
  let w = 0;
  for (let i = 0; i < s.length; i++) w += c.measureText(s[i]).width + sp;
  return w - sp;
}

function name(c, t) {
  const to = S.being;
  if (!to || !fromB) return;
  const size = clamp(View.w * 0.062, 23, 34);
  const out = ease(clamp((t - 800) / 340, 0, 1));
  const a = 1 - out;
  if (a <= 0.01) return;

  const inn = ease(clamp((t - 120) / 300, 0, 1));
  const preA = a * ease(clamp(t / 200, 0, 1)) * 0.5;
  const oldOut = ease(clamp((t - 30) / 260, 0, 1));

  const pre = "you are";
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.lineJoin = "round";

  c.font = `italic ${size * 0.56}px Georgia, serif`;
  const preW = c.measureText(pre).width;

  c.font = `italic ${size}px Georgia, serif`;
  const nName = to.name.toLowerCase();
  const spNew = lerp(size * 0.2, size * 0.055, inn);
  const nW = runWidth(c, nName, spNew);

  const gap = size * 0.44;
  const x0 = (View.w - (preW + gap + nW)) / 2;
  const y = View.h * 0.315 + (1 - inn) * 6;
  const xN = x0 + preW + gap;

  c.font = `italic ${size * 0.56}px Georgia, serif`;
  c.globalAlpha = preA * 1.5;
  c.strokeStyle = PAPER_LIT; c.lineWidth = 5;
  c.strokeText(pre, x0, y - size * 0.03);
  c.globalAlpha = preA;
  c.fillStyle = "#1d201d";
  c.fillText(pre, x0, y - size * 0.03);

  /* what you were, letting go */
  if (oldOut < 1) {
    const spOld = lerp(size * 0.055, size * 0.3, oldOut);
    c.font = `italic ${size}px Georgia, serif`;
    c.globalAlpha = (1 - oldOut) * 0.85;
    c.strokeStyle = PAPER_LIT; c.lineWidth = 5;
    runWord(c, fromB.name.toLowerCase(), xN, y - oldOut * 7, spOld, true);
    c.globalAlpha = (1 - oldOut) * 0.55;
    c.fillStyle = fromB.ink.live;
    runWord(c, fromB.name.toLowerCase(), xN, y - oldOut * 7, spOld, false);
  }

  /* what you are, drawing itself in */
  c.font = `italic ${size}px Georgia, serif`;
  c.globalAlpha = a * inn * 0.9;
  c.strokeStyle = PAPER_LIT; c.lineWidth = 6;
  runWord(c, nName, xN, y, spNew, true);
  c.globalAlpha = a * inn;
  c.fillStyle = to.ink.live;
  runWord(c, nName, xN, y, spNew, false);

  /* one hairline, drawn under it at the speed the word tightens */
  c.globalAlpha = a * inn * 0.45;
  c.strokeStyle = to.ink.ladder;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(xN, y + size * 0.24);
  c.lineTo(xN + nW * inn, y + size * 0.24);
  c.stroke();

  c.globalAlpha = 1;
}
