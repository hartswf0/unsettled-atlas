/* PERSPECTIVAL GROUND — laying a line into the ground.

   One control. Tap the pip, drag, and what you drew is ground now — with the
   same rights as the interstate beside it. It starts pulsing by itself the
   moment the ground refuses to carry you somewhere, which is the only tutorial
   this game gets.

   Everything in here is about the difference between drawing ON a map and
   laying a thread INTO cloth:

     THE THREAD LIES IN THE CLOTH. It opens a channel of bare paper around
     itself, it is bedded into the ground under it, and where it meets a fibre
     the city already has, it goes UNDER — the thread simply stops and the road
     runs on across it. Over and under is what makes cloth cloth.

     THE HAND IS IN THE THREAD. A deliberate hand pays out a wide thread; a
     hurried one pays out a thin one, and if you hold still the ink pools. You
     watch that happen live. Nothing says what a width is for. It is simply
     how much ground you laid, and later a car either fits or it doesn't.

     COMMITTING IS PHYSICAL. On release the thread drops: it steadies onto the
     streets under it, evens out to one gauge, and a press runs down its whole
     length from the hand that started it. Where it lands on ground that is
     already there it binds — a stitch, and a little of the new material runs
     out into the old.

   What it does NOT do is tell you what you made. No width readout, no preview
   of who could use this, no name for anything. You find out by watching a
   traveller. */

import {
  View, sx, sy, wx, wy, simplify, pathLength, units, metres,
  clamp, lerp, ease, hash01, pxPerM, TAU,
} from "./geo.js";
import { G, edgesInBox, nearestNode, nearestEdge, CLS_RAIL, CLS_MARK } from "./graph.js";
import { S, on, layMark } from "./state.js";

/* the cloth immediately around a thread, cleared of everything else */
const CHANNEL = "#fbf8ef";
/* the shadow a laid cord makes in the tooth of the paper */
const PRESS = "rgba(58,48,32,1)";

/* the thread before it is anything: raw fibre, nobody's colour. it warms into
   the colour of laid ground as it seats, so the handover to the cloth is a
   change of state and not a change of subject. */
const FIBRE = [84, 66, 42];
const SEATED = [122, 47, 78];
function fibreCol(t, a) {
  const r = Math.round(lerp(FIBRE[0], SEATED[0], t));
  const g = Math.round(lerp(FIBRE[1], SEATED[1], t));
  const b = Math.round(lerp(FIBRE[2], SEATED[2], t));
  return `rgba(${r},${g},${b},${a})`;
}

/* ============================================================
   THE PEN — how wide a thread the hand is paying out

   Width is not chosen. It is how the line was made: slow is wide, hurried is
   thin, and standing still lets the ink pool. Nothing here knows or cares that
   3 metres is where a car starts to fit (beings.js), and nothing tells the
   player. It is just what happens when you take your time.
   ============================================================ */
const W_MIN = 1.25, W_MAX = 7.2;         /* metres of ground */
const V_SLOW = 0.15, V_FAST = 1.6;       /* screen px per ms */
const POOL = 0.00012;                    /* how fast standing still pools ink */

function widthFor(v) {
  const d = clamp((V_FAST - v) / (V_FAST - V_SLOW), 0, 1);
  return W_MIN + (W_MAX - W_MIN) * Math.pow(d, 1.45);
}

/* How wide that is on this screen. Below street zoom a true-scale road is a
   third of a pixel, so the gauge reads as a ratio there and only becomes
   literal metres once you are close enough for metres to mean anything. */
function penPx(wm, zt, ppm) {
  const nominal = lerp(0.9, 2.2, zt) * (0.55 + wm / 4.6);
  return Math.max(1.25, Math.max(nominal, wm * ppm * 0.95));
}

/* how far a sample may be nudged onto ground that is already there: about
   seven screen pixels' worth, and never a correction bigger than a street */
function settleTol() { return units(clamp(7 / pxPerM(), 10, 34)); }

/* a thread pulled taut goes a little past where it lands and comes back */
function taut(x) {
  const u = x - 1;
  return 1 + 2.1 * u * u * u + 1.35 * u * u;
}

let calm = false;
try { calm = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch {}

/* ============================================================
   state
   ============================================================ */
let pip = null, armed = false, urgent = false, ctxRef = null;
let live = null;    /* the stroke in the hand */
let seat = null;    /* the stroke coming to rest */
let entry = null;   /* the needle going in */

/* ============================================================
   THE PIP

   One control, and it never becomes two. It is a bead of thread: press it and
   the next thing your finger does pays thread out. When the ground has balked
   it knocks on its own, which is the only instruction in the game.
   ============================================================ */
export function init(ctx) {
  ctxRef = ctx;
  pip = document.createElement("button");
  pip.id = "pip";
  pip.setAttribute("aria-label", "lay a line into the ground");
  pip.innerHTML = `<svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
    <path class="gl" d="M9 29.5c6.2 0 4.4-15 12.5-15s6.2 15 12.4 15" fill="none"
      stroke="currentColor" stroke-width="2.7" stroke-linecap="round"/>
    <circle class="knob" cx="9" cy="29.5" r="2.5" fill="currentColor"/>
  </svg>`;
  ctx.hud.appendChild(pip);

  /* every state of it lives in one rule, so that arming it can actually
     change how it looks — an inline style would outrank the class */
  const style = document.createElement("style");
  style.textContent = `
    #pip{
      position:fixed;left:50%;bottom:calc(22px + var(--sab));
      width:72px;height:72px;border-radius:50%;border:0;padding:0;
      display:grid;place-items:center;
      background:var(--paper-lit);color:var(--ink);
      box-shadow:inset 0 0 0 1px rgba(29,32,29,.34), 0 1px 3px rgba(29,32,29,.14);
      transform:translateX(-50%) scale(1);animation:none;
      transition:background .22s ease, color .22s ease,
                 box-shadow .22s ease, opacity .2s ease}
    #pip:active{transform:translateX(-50%) scale(.93)}
    #pip::after{
      content:"";position:absolute;inset:-5px;border-radius:50%;
      border:1.6px solid var(--signal);opacity:0;pointer-events:none}
    @keyframes pgbeat{
      0%,100%{transform:translateX(-50%) scale(1)}
      12%{transform:translateX(-50%) scale(1.075)}
      26%{transform:translateX(-50%) scale(.995)}
      38%{transform:translateX(-50%) scale(1.03)}
      56%{transform:translateX(-50%) scale(1)}}
    @keyframes pgknock{
      0%{transform:scale(.9);opacity:.55}
      70%{transform:scale(1.42);opacity:0}
      100%{transform:scale(1.42);opacity:0}}
    @keyframes pgseat{
      0%{transform:translateX(-50%) scale(.82)}
      44%{transform:translateX(-50%) scale(1.07)}
      100%{transform:translateX(-50%) scale(1)}}
    #pip.beat{animation:pgbeat 1.7s ease-in-out infinite}
    #pip.beat::after{animation:pgknock 1.7s ease-out infinite}
    #pip.beat:active{animation:none}
    #pip.on{
      background:var(--signal);color:var(--paper-lit);
      transform:translateX(-50%) scale(1.06);
      box-shadow:inset 0 0 0 1px rgba(29,32,29,.2), 0 3px 12px rgba(191,69,38,.3)}
    #pip.on:active{transform:translateX(-50%) scale(1)}
    #pip.on::after{animation:none;opacity:0}
    #pip.away{opacity:.26}
    #pip.seated{animation:pgseat .46s cubic-bezier(.2,.9,.25,1)}
    @media (prefers-reduced-motion:reduce){
      #pip.beat,#pip.beat::after,#pip.seated{animation:none}}`;
  document.head.appendChild(style);

  /* pointerdown so it answers the finger, click so it answers a keyboard */
  let swallow = false;
  pip.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    swallow = true;
    setTimeout(() => { swallow = false; }, 600);
    setArmed(!armed);
  });
  pip.addEventListener("click", () => { if (!swallow) setArmed(!armed); swallow = false; });
  pip.addEventListener("animationend", (e) => {
    if (e.animationName === "pgseat") pip.classList.remove("seated");
  });

  /* The ground itself asks for the line. Other bodies balk all day and the pip
     does not knock for them — this is the ground refusing to carry YOU. And a
     gap belongs to the ground, not to whoever found it, so becoming something
     else does not answer it; only arriving somewhere whole does, or drawing. */
  on("arrive", ({ balk }) => setAsking(!!balk));
  /* a body of yours that cannot move anywhere is the only instruction this
     game ever gives, and it gives it by knocking rather than by talking */
  on("stuck", (w) => { if (w && w.length) setAsking(true); });
  on("become", () => {
    if (live) { unpick(live); live = null; }
    if (armed) setArmed(false);
  });

  /* a second finger is the map's, never the thread's */
  addEventListener("pointerdown", (e) => {
    if (live && e.pointerId !== live.id) {
      unpick(live); live = null; pip.classList.remove("away"); knock();
    }
  }, true);
}

function setArmed(v) {
  armed = v;
  if (ctxRef) ctxRef.arm(v);
  pip.classList.toggle("on", v);
  knock();
}

/* how long the ground goes on asking before it gives up on being answered */
const ASK_MS = 13000;
let askTimer = 0;
function setAsking(v) {
  urgent = v;
  clearTimeout(askTimer);
  if (v) askTimer = setTimeout(() => { urgent = false; knock(); }, ASK_MS);
  knock();
}
/* the knock is the asking made visible, and it gets out of the way of a hand */
function knock() {
  pip.classList.toggle("beat", urgent && !armed && !live);
}
/* The little bob it makes when a line becomes ground. The class is taken off
   again the moment it is done, or it would outrank the knock. */
function seatedPip() {
  pip.classList.remove("seated");
  void pip.offsetWidth;
  pip.classList.add("seated");
}

/* ============================================================
   THE HAND
   ============================================================ */
export function onDown(ctx, p, e) {
  if (ctx.mode !== "draw") return false;
  const now = performance.now();
  live = {
    id: e ? e.pointerId : 0,
    xs: [wx(p.x)], ys: [wy(p.y)], ws: [W_MIN * 1.6], n: 1,
    px: p.x, py: p.y, lastT: now, v: 0.9,
    seed: (Math.random() * 90000) | 0,
    cross: [], caught: -1,
  };
  /* did the needle go in on ground that is already there? */
  live.caught = nearestNode(live.xs[0], live.ys[0], units(26));
  entry = { x: live.xs[0], y: live.ys[0], t0: now, bound: live.caught >= 0 };
  pip.classList.add("away");
  knock();
  return true;
}

export function onMove(ctx, p) {
  const L = live;
  if (!L) return;
  const d = Math.hypot(p.x - L.px, p.y - L.py);
  if (d < 2.2) return;
  const now = performance.now();
  const dt = Math.max(1, now - L.lastT);
  const v = d / dt;
  L.v = L.n < 3 ? v : lerp(L.v, v, 0.34);
  L.px = p.x; L.py = p.y; L.lastT = now;

  const x = wx(p.x), y = wy(p.y);
  crossingsOf(L, L.xs[L.n - 1], L.ys[L.n - 1], x, y);
  L.xs.push(x); L.ys.push(y); L.ws.push(widthFor(L.v)); L.n++;
  /* the first samples inherit the hand the gesture turned out to have */
  if (L.n === 4) { L.ws[0] = L.ws[3] * 0.9; L.ws[1] = L.ws[3] * 0.95; }
  L.caught = nearestNode(x, y, units(26));
}

/* Holding still lets the ink pool where the finger is standing. It swells the
   stretch just behind the tip rather than the tip itself, because the very end
   of the thread is still tapering off the needle and nothing shows there. */
function pool(now) {
  const L = live;
  if (!L || L.n < 3) return;
  const still = now - L.lastT;
  if (still < 110) return;
  const gain = Math.min(0.09, (still - 110) * POOL);
  for (let i = Math.max(0, L.n - 14); i < L.n; i++) {
    const k = 1 - (L.n - 1 - i) / 16;
    L.ws[i] = Math.min(W_MAX, L.ws[i] + gain * k);
  }
}

export function onUp(ctx, p) {
  const L = live;
  if (!L) return;
  live = null;
  pip.classList.remove("away");
  setArmed(false);

  const flat = [];
  for (let i = 0; i < L.n; i++) flat.push(L.xs[i], L.ys[i]);
  if (L.n < 4 || metres(pathLength(flat)) < 25) { unpick(L); return; }

  /* what the hand meant, without what the hand wobbled */
  const tol = units(clamp(6 / pxPerM(), 6, 30));
  const pts = simplify(flat, tol);
  if (pts.length < 4) { unpick(L); return; }

  /* the width of each kept point, carried over from the sample it came from:
     simplify() returns a subsequence, so one forward walk matches them up */
  const kw = new Float32Array(pts.length / 2);
  for (let i = 0, k = 0; i + 1 < pts.length; i += 2) {
    while (k < L.n - 1 && (L.xs[k] !== pts[i] || L.ys[k] !== pts[i + 1])) k++;
    kw[i / 2] = L.ws[Math.min(k, L.n - 1)];
    k++;
  }

  /* one gauge for the whole thing: mostly the hand's average, pulled some of
     the way toward its most deliberate stretch */
  let sum = 0, len = 0, top = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const s = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
    sum += (kw[i / 2] + kw[i / 2 + 1]) * 0.5 * s;
    len += s;
    if (kw[i / 2] > top) top = kw[i / 2];
  }
  const gauge = clamp((len > 0 ? sum / len : W_MIN) * 0.68 + top * 0.32, W_MIN, W_MAX);

  /* Given a body at graph scale, so that wherever it runs past a junction it
     has a vertex there to be tied by, and then dropped onto whatever is under
     it — a nudge, not a correction, so a deliberate cut across a car park
     stays a cut across a car park. */
  const dense = bodied(pts, kw);
  const fin = settleOnto(dense.xy);
  /* every place it will tie into ground that already exists, found BEFORE the
     mark is laid, or it would only find itself */
  const binds = bindsOf(fin);

  layMark(fin, gauge, S.being);
  try { navigator.vibrate && navigator.vibrate(14); } catch {}
  seatedPip();
  setAsking(false);

  seat = {
    kind: "seat", a: dense.xy, b: fin, wa: dense.w, wb: gauge,
    n: dense.xy.length / 2,
    /* where the city crosses the line it actually became, so the weave that
       was true in the hand is still true on the ground */
    binds, cross: crossingsAlong(fin), seed: L.seed, t0: performance.now(),
  };
}

/* A thread has to have a body before it can be tied into anything. The city's
   own ground has a junction about every eighty metres, so a line given a
   vertex at that scale meets the city wherever it actually runs past it —
   which is what makes a drawing infrastructure instead of a picture of one. */
function bodied(pts, kw) {
  const total = pathLength(pts);
  const step = Math.max(units(30), total / 64);
  const xy = [], w = [];
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3];
    const k = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      xy.push(lerp(ax, bx, t), lerp(ay, by, t));
      w.push(lerp(kw[i / 2], kw[i / 2 + 1], t));
    }
  }
  xy.push(pts[pts.length - 2], pts[pts.length - 1]);
  w.push(kw[kw.length - 1]);
  return { xy: Float64Array.from(xy), w: Float32Array.from(w) };
}

/* a stroke too short to be ground is taken back, not deleted: it shrinks into
   the paper so the hand can see that nothing was kept */
function unpick(L) {
  if (!L || L.n < 2) { entry = null; return; }
  const a = [];
  for (let i = 0; i < L.n; i++) a.push(L.xs[i], L.ys[i]);
  seat = {
    kind: "unpick", a, b: a, wa: Float32Array.from(L.ws), wb: 0, n: L.n,
    binds: [], cross: L.cross, seed: L.seed, t0: performance.now(),
  };
  pip.classList.remove("away");
}

/* ---------- settling ---------- */
function settleOnto(pts) {
  const tol = settleTol();
  const out = Float64Array.from(pts);
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const near = nearestEdge(pts[i], pts[i + 1], tol);
    if (!near) continue;
    out[i] = lerp(pts[i], near.x, 0.55);
    out[i + 1] = lerp(pts[i + 1], near.y, 0.55);
  }
  /* neighbouring samples catch on different streets, and a line that jinks
     between them is not settled, it is nervous. Two passes take the jink out
     and leave the pull. */
  const n = out.length;
  const t = Float64Array.from(out);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 2; i + 3 < n; i += 2) {
      out[i] = t[i] * 0.5 + t[i - 2] * 0.25 + t[i + 2] * 0.25;
      out[i + 1] = t[i + 1] * 0.5 + t[i - 1] * 0.25 + t[i + 3] * 0.25;
    }
    t.set(out);
  }
  return out;
}

/* Where a thread ties into ground that is already there. Both ends if they
   land on anything, and the strongest of whatever it crossed on the way. */
function bindsOf(pts) {
  const tol = units(26);
  const np = pts.length / 2;
  const found = [];
  for (let i = 0; i < np; i++) {
    const n = nearestNode(pts[i * 2], pts[i * 2 + 1], tol);
    if (n < 0) continue;
    if (found.length && found[found.length - 1].node === n) continue;
    const adj = G.adj[n];
    if (!adj || !adj.length) continue;
    const p = Math.max(0, i - 1), q = Math.min(np - 1, i + 1);
    found.push({
      node: n, x: G.nx[n], y: G.ny[n], edges: adj.slice(0, 5),
      /* how far down the thread this tie is, so the press reaches them in turn */
      u: np < 2 ? 0 : i / (np - 1),
      ang: Math.atan2(pts[q * 2 + 1] - pts[p * 2 + 1], pts[q * 2] - pts[p * 2]),
    });
  }
  /* a tie every hundred metres is a bound line; a tie every ten is a mess */
  if (found.length < 2) return found;
  const APART = units(110);
  const keep = [found[0]];
  for (let i = 1; i < found.length - 1 && keep.length < 3; i++) {
    const p = keep[keep.length - 1];
    if (Math.hypot(found[i].x - p.x, found[i].y - p.y) > APART) keep.push(found[i]);
  }
  const last = found[found.length - 1], p = keep[keep.length - 1];
  if (Math.hypot(last.x - p.x, last.y - p.y) > units(60)) keep.push(last);
  return keep;
}

/* ============================================================
   WHERE THE THREAD MEETS THE CITY

   A crossing is remembered as the stroke is made, one new segment at a time,
   so nothing walks the whole line every frame. The heavy fibres of the city
   go over the new thread; the fine ones go under it. Which is which is fixed
   by the ground itself, so a thread woven now looks the same tomorrow.
   ============================================================ */
const _eb = [];
function crossingsOf(L, ax, ay, bx, by) {
  if (L.cross.length > 56) return;
  const pad = units(4);
  edgesInBox(
    Math.min(ax, bx) - pad, Math.min(ay, by) - pad,
    Math.max(ax, bx) + pad, Math.max(ay, by) + pad, _eb, over);
  for (let i = 0; i < _eb.length; i++) {
    const e = _eb[i];
    const p = G.ea[e], q = G.eb[e];
    const h = hit(ax, ay, bx, by, G.nx[p], G.ny[p], G.nx[q], G.ny[q]);
    if (!h) continue;
    L.cross.push({ e, x: h.x, y: h.y, cls: G.ec[e] });
    if (L.cross.length > 56) return;
  }
}

/* the same question asked of a finished line, all at once */
function crossingsAlong(pts) {
  const L = { cross: [] };
  for (let i = 0; i + 3 < pts.length; i += 2) {
    crossingsOf(L, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
  }
  return L.cross;
}

/* the fibres the city laid first surface through the ones laid today */
function over(e) {
  const cls = G.ec[e];
  if (cls >= CLS_MARK) return false;
  if (cls === CLS_RAIL) return hash01(e * 7 + 3) > 0.2;
  if (cls === 2) return hash01(e * 13 + 5) > 0.36;
  return true;
}

function hit(ax, ay, bx, by, cx, cy, dx, dy) {
  const r1 = bx - ax, r2 = by - ay, s1 = dx - cx, s2 = dy - cy;
  const den = r1 * s2 - r2 * s1;
  if (!den) return null;
  const t = ((cx - ax) * s2 - (cy - ay) * s1) / den;
  const u = ((cx - ax) * r2 - (cy - ay) * r1) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: ax + r1 * t, y: ay + r2 * t };
}

/* how much of the thread one of those fibres hides */
const CITY_W = [[1.3, 3.6], [1.0, 2.7], [0.65, 1.9], [0.6, 1.5]];
const CITY_M = [14, 10, 7, 4], CITY_MET = [0.92, 0.88, 0.78, 0];
function hideRadius(cls, zt, ppm) {
  const w = Math.max(lerp(CITY_W[cls][0], CITY_W[cls][1], zt), CITY_M[cls] * ppm * CITY_MET[cls]);
  return clamp(w * 0.62 + 1.5, 3, 18);
}

/* ============================================================
   THE RIBBON — a thread is spun, not extruded
   ============================================================ */
let BX = new Float32Array(1024), BY = new Float32Array(1024);
let BW = new Float32Array(1024), BC = new Float32Array(1024);
let BH = new Uint8Array(1024);
let CX = new Float32Array(1024), CY = new Float32Array(1024), CW = new Float32Array(1024);
let BN = 0;

function room(n) {
  if (n <= BX.length) return;
  const s = 1 << Math.ceil(Math.log2(n));
  const g = (old, T) => { const a = new T(s); a.set(old); return a; };
  BX = g(BX, Float32Array); BY = g(BY, Float32Array);
  BW = g(BW, Float32Array); BC = g(BC, Float32Array);
  BH = g(BH, Uint8Array);
  CX = new Float32Array(s); CY = new Float32Array(s); CW = new Float32Array(s);
}

/* world -> screen, densified so a long straight has something to breathe at,
   and smoothed once so a hurried gesture reads as fibre and not as a polyline */
function project(xs, ys, ws, n, zt, ppm, step) {
  room(n + 8);
  BN = 0;
  let lx = -1e9, ly = -1e9;
  for (let i = 0; i < n; i++) {
    const X = sx(xs[i]), Y = sy(ys[i]);
    if (BN > 0 && i < n - 1 && Math.abs(X - lx) < 0.5 && Math.abs(Y - ly) < 0.5) continue;
    BX[BN] = X; BY[BN] = Y; BW[BN] = penPx(ws[i], zt, ppm) * 0.5; BN++;
    lx = X; ly = Y;
  }
  if (step) densify(step);
  if (BN > 5) smooth();
  cumulate();
}

function densify(step) {
  let need = 1;
  for (let i = 0; i + 1 < BN; i++) {
    need += Math.max(1, Math.min(26, Math.round(Math.hypot(BX[i + 1] - BX[i], BY[i + 1] - BY[i]) / step)));
  }
  if (need <= BN) return;
  room(need + 8);
  let m = 0;
  for (let i = 0; i + 1 < BN; i++) {
    const k = Math.max(1, Math.min(26, Math.round(Math.hypot(BX[i + 1] - BX[i], BY[i + 1] - BY[i]) / step)));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      CX[m] = lerp(BX[i], BX[i + 1], t);
      CY[m] = lerp(BY[i], BY[i + 1], t);
      CW[m] = lerp(BW[i], BW[i + 1], t);
      m++;
    }
  }
  CX[m] = BX[BN - 1]; CY[m] = BY[BN - 1]; CW[m] = BW[BN - 1]; m++;
  const tx = BX, ty = BY, tw = BW;
  BX = CX; BY = CY; BW = CW;
  CX = tx; CY = ty; CW = tw;
  BN = m;
}

function smooth() {
  for (let i = 0; i < BN; i++) { CX[i] = BX[i]; CY[i] = BY[i]; }
  for (let i = 1; i < BN - 1; i++) {
    BX[i] = CX[i] * 0.5 + CX[i - 1] * 0.25 + CX[i + 1] * 0.25;
    BY[i] = CY[i] * 0.5 + CY[i - 1] * 0.25 + CY[i + 1] * 0.25;
  }
}

function cumulate() {
  BC[0] = 0;
  for (let i = 1; i < BN; i++) BC[i] = BC[i - 1] + Math.hypot(BX[i] - BX[i - 1], BY[i] - BY[i - 1]);
}

let _off = 0, _mul = 1, _seed = 0, _tapPx = 20, _tapA = 1, _tapB = 1, _i0 = 0, _i1 = 0;
function hw(i) {
  let ends = 1;
  if (_tapA) ends *= Math.pow(clamp((BC[i] - BC[_i0]) / _tapPx, 0, 1), 0.62);
  if (_tapB) ends *= Math.pow(clamp((BC[_i1] - BC[i]) / _tapPx, 0, 1), 0.62);
  if (_tapA || _tapB) ends = Math.min(1, ends + 0.07);
  const u = BC[i] * 0.058;
  const s1 = hash01(_seed + Math.floor(u)) - 0.5;
  const s2 = hash01(_seed + 91 + Math.floor(u * 0.37)) - 0.5;
  return Math.max(0.3, BW[i] * _mul * ends * (1 + s1 * 0.30 + s2 * 0.20) + _off + 0.12);
}

function ribbon(c, i0, i1) {
  _i0 = i0; _i1 = i1;
  let ax, ay, len, w;
  for (let i = i0; i <= i1; i++) {
    w = hw(i);
    ax = BX[Math.min(i + 1, i1)] - BX[Math.max(i - 1, i0)];
    ay = BY[Math.min(i + 1, i1)] - BY[Math.max(i - 1, i0)];
    len = Math.hypot(ax, ay) || 1;
    if (i === i0) c.moveTo(BX[i] - ay / len * w, BY[i] + ax / len * w);
    else c.lineTo(BX[i] - ay / len * w, BY[i] + ax / len * w);
  }
  for (let i = i1; i >= i0; i--) {
    w = hw(i);
    ax = BX[Math.min(i + 1, i1)] - BX[Math.max(i - 1, i0)];
    ay = BY[Math.min(i + 1, i1)] - BY[Math.max(i - 1, i0)];
    len = Math.hypot(ax, ay) || 1;
    c.lineTo(BX[i] + ay / len * w, BY[i] - ax / len * w);
  }
  c.closePath();
}

/* the thread, in as many pieces as the city cut it into */
const _runs = [];
function runs(cross, zt, ppm, quality) {
  _runs.length = 0;
  let hidden = 0;
  for (let i = 0; i < BN; i++) BH[i] = 0;
  /* Only the length of this scan is worth trading away. The weave itself is
     what a thread IS, and there is only ever one thread in a hand, so it is
     not something a slow machine gets a version of the game without. */
  if (cross && cross.length) {
    const cap = Math.min(quality > 0.6 ? 48 : 18, cross.length);
    for (let k = 0; k < cap; k++) {
      const X = sx(cross[k].x), Y = sy(cross[k].y);
      const r = hideRadius(cross[k].cls, zt, ppm), r2 = r * r;
      for (let i = 0; i < BN; i++) {
        if (BH[i]) continue;
        const dx = BX[i] - X, dy = BY[i] - Y;
        if (dx * dx + dy * dy < r2) { BH[i] = 1; hidden++; }
      }
    }
  }
  /* a thread that is more under the city than over it has stopped being a
     weave and started being a dotted line, so it surfaces whole */
  if (hidden > BN * 0.5) { for (let i = 0; i < BN; i++) BH[i] = 0; }
  let s = -1;
  for (let i = 0; i < BN; i++) {
    if (!BH[i] && s < 0) s = i;
    else if (BH[i] && s >= 0) { if (i - 1 > s) _runs.push(s, i - 1); s = -1; }
  }
  if (s >= 0 && BN - 1 > s) _runs.push(s, BN - 1);
  return _runs;
}

/* one pass of the thread at a given swell, in every piece it survives in */
function lay(c, rs, off, mul, style, alpha) {
  if (alpha <= 0.004 || !rs.length) return;
  _off = off; _mul = mul;
  c.globalAlpha = alpha;
  c.fillStyle = style;
  c.beginPath();
  for (let i = 0; i < rs.length; i += 2) {
    _tapA = i === 0 ? 1 : 0;
    _tapB = i + 2 >= rs.length ? 1 : 0;
    ribbon(c, rs[i], rs[i + 1]);
  }
  c.fill();
  _off = 0; _mul = 1;
}

/* ---------- the whole thread, in the order cloth is made ----------
   Under it the paper is pressed; around it the paper is clear; in it the fibre
   sits, with a lit crown along the top of the cord so it reads as something
   lying in the cloth rather than a line printed on it. */
function layThread(c, rs, warm, a, q) {
  if (a <= 0.01) return;
  c.save();
  c.translate(0.6, 0.9);
  lay(c, rs, 1.5, 1, PRESS, 0.14 * a);
  c.restore();
  lay(c, rs, 1.9, 1, CHANNEL, 0.8 * a);
  layInk(c, rs, warm, a, q);
}

/* the material of the thread, on its own, so that a piece of it can be one
   thing while the rest of it is still another */
function layInk(c, rs, warm, a, q) {
  if (a <= 0.01 || !rs.length) return;
  const ink = fibreCol(warm, 1);
  lay(c, rs, 1.0, 1, ink, 0.13 * a);
  lay(c, rs, 0, 1, ink, 0.97 * a);
  if (q > 0.3) {
    c.save();
    c.translate(-0.35, -0.45);
    lay(c, rs, 0, 0.3, "rgba(228,216,192,1)", 0.22 * a);
    c.restore();
  }
}

/* the part of the thread the press has already been over */
const _behind = [];
function upTo(rs, i) {
  _behind.length = 0;
  for (let k = 0; k < rs.length; k += 2) {
    if (rs[k] > i) break;
    _behind.push(rs[k], Math.min(rs[k + 1], i));
  }
  if (_behind.length && _behind[_behind.length - 1] <= _behind[_behind.length - 2]) _behind.length -= 2;
  return _behind;
}

/* ============================================================
   the frame
   ============================================================ */
export function draw(ctx) {
  const c = ctx.c;
  const now = performance.now();
  const zt = clamp((View.z - 10.5) / 6.5, 0, 1);
  const ppm = pxPerM();
  c.lineCap = "round";
  c.lineJoin = "round";

  if (entry) drawEntry(c, now);
  if (live) { pool(now); drawLive(ctx, c, zt, ppm, now); }
  if (seat) drawSeat(ctx, c, zt, ppm, now);

  c.globalAlpha = 1;
  c.setLineDash([]);
}

/* ---------- the needle going in ---------- */
function drawEntry(c, now) {
  const k = (now - entry.t0) / (entry.bound ? 420 : 260);
  if (k >= 1) { entry = null; return; }
  const X = sx(entry.x), Y = sy(entry.y);
  const e = ease(clamp(k, 0, 1));
  c.globalAlpha = (1 - e) * 0.5;
  c.strokeStyle = fibreCol(0, 1);
  c.lineWidth = lerp(2.2, 0.5, e);
  c.beginPath();
  c.arc(X, Y, lerp(1.5, entry.bound ? 21 : 13, e), 0, TAU);
  c.stroke();
  c.globalAlpha = 1;
}

/* ---------- the thread in the hand ---------- */
function drawLive(ctx, c, zt, ppm, now) {
  const L = live;
  if (L.n < 2) return;
  const q = ctx.quality;
  project(L.xs, L.ys, L.ws, L.n, zt, ppm, 0);
  const rs = runs(L.cross, zt, ppm, q);
  _seed = L.seed;
  _tapPx = clamp(BC[BN - 1] * 0.22, 6, 22);

  layThread(c, rs, 0, 1, q);

  /* the tip: where the thread is still coming off the needle */
  const tx = BX[BN - 1], ty = BY[BN - 1], tw = Math.max(1.2, BW[BN - 1]);
  c.globalAlpha = 0.92;
  c.fillStyle = CHANNEL;
  c.beginPath(); c.arc(tx, ty, tw + 2.3, 0, TAU); c.fill();
  c.globalAlpha = 1;
  c.fillStyle = fibreCol(0, 1);
  c.beginPath(); c.arc(tx, ty, tw * 0.95, 0, TAU); c.fill();

  /* the tip is over ground that would take it */
  if (L.caught >= 0) {
    const cxp = sx(G.nx[L.caught]), cyp = sy(G.ny[L.caught]);
    const b = calm ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.009);
    c.globalAlpha = 0.16 + b * 0.16;
    c.strokeStyle = fibreCol(0, 1);
    c.lineWidth = 1.1;
    c.beginPath(); c.arc(cxp, cyp, 7.5 + b * 1.6, 0, TAU); c.stroke();
  }
  c.globalAlpha = 1;
}

/* ---------- the thread coming to rest ----------
   Three things happen at once and they are all the same event: the line drops
   onto the ground under it, its width evens out into one gauge of ground, and
   a press runs down it from the end the hand started at. */
const SETTLE = 320, HOLD = 620, FADE = 620, WAVE = 620, BIND = 1220;
function drawSeat(ctx, c, zt, ppm, now) {
  const S0 = seat;
  const t = now - S0.t0;
  const unpicking = S0.kind === "unpick";
  const life = unpicking ? 240 : Math.max(HOLD + FADE, WAVE, BIND);
  if (t > life) { seat = null; return; }
  const q = ctx.quality;

  const k = calm ? ease(clamp(t / SETTLE, 0, 1)) : taut(clamp(t / SETTLE, 0, 1));
  const n = S0.n;
  room(n + 8);

  /* the shape and the gauge arrive together */
  const xs = [], ys = [], ws = new Float32Array(n);
  if (unpicking) {
    const g = 1 - clamp(t / 240, 0, 1);
    for (let i = 0; i < n; i++) { xs.push(S0.a[i * 2]); ys.push(S0.a[i * 2 + 1]); ws[i] = S0.wa[i] * g; }
  } else {
    for (let i = 0; i < n; i++) {
      xs.push(lerp(S0.a[i * 2], S0.b[i * 2], k));
      ys.push(lerp(S0.a[i * 2 + 1], S0.b[i * 2 + 1], k));
      ws[i] = lerp(S0.wa[i], S0.wb, k);
    }
  }

  project(xs, ys, ws, n, zt, ppm, 6);
  const rs = runs(S0.cross, zt, ppm, q);
  _seed = S0.seed;
  _tapPx = clamp(BC[BN - 1] * 0.14, 6, 26);

  const a = unpicking
    ? Math.pow(1 - clamp(t / 240, 0, 1), 0.8)
    : 1 - ease(clamp((t - HOLD) / FADE, 0, 1));

  /* laid as raw fibre first, all of it */
  layThread(c, rs, 0, a, q);

  if (unpicking) { c.globalAlpha = 1; return; }

  /* THE PRESS — a hand running down the whole length, once, from the end the
     gesture started at. Where it passes the cloth takes the cord: the paper
     around it goes down in shadow, the thread comes up bright, and BEHIND it
     the thread is not thread any more. That is the whole event. It is not a
     colour change on a timer; it is the press doing it, a length at a time. */
  const wk = clamp(t / WAVE, 0, 1);
  const at = ease(wk) * BC[BN - 1];
  let wi = 1;
  while (wi < BN - 1 && BC[wi] < at) wi++;
  if (wk >= 1) wi = BN - 1;
  layInk(c, upTo(rs, wi), 1, a, q);

  if (wk < 1 && BN > 2) {
    const i = wi;
    const X = BX[i], Y = BY[i];
    const fade = Math.sin(Math.PI * Math.pow(wk, 0.8));
    const r = (7 + BW[i] * 3.4) * (0.7 + 0.5 * fade);
    const gr = c.createRadialGradient(X, Y, r * 0.15, X, Y, r);
    gr.addColorStop(0, `rgba(74,60,38,${0.30 * fade})`);
    gr.addColorStop(0.62, `rgba(74,60,38,${0.10 * fade})`);
    gr.addColorStop(1, "rgba(74,60,38,0)");
    c.globalAlpha = 1;
    c.fillStyle = gr;
    c.beginPath(); c.arc(X, Y, r, 0, TAU); c.fill();
    /* and the cord is momentarily proud of the cloth where it is pressed */
    const j0 = Math.max(0, i - 5), j1 = Math.min(BN - 1, i + 5);
    c.globalAlpha = 0.72 * fade;
    c.strokeStyle = fibreCol(0.5, 1);
    c.lineWidth = Math.max(1.2, BW[i] * 2.2);
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(BX[j0], BY[j0]);
    for (let j = j0 + 1; j <= j1; j++) c.lineTo(BX[j], BY[j]);
    c.stroke();
    c.globalAlpha = 0.5 * fade;
    c.strokeStyle = "rgba(236,226,204,1)";
    c.lineWidth = Math.max(0.6, BW[i] * 0.55);
    c.stroke();
  }

  /* the stitches: where it ties into ground that was already here */
  if (t < BIND) drawBinds(c, S0, t, zt, ppm, q);
  c.globalAlpha = 1;
}

/* THE BIND — the press reaches a place where the new thread lies over ground
   that was already here, and ties it down there. Two whipping stitches across
   the cord, and a little of the new material bled out into the old both ways,
   because from here on a body can come off one onto the other. */
const TIE = 560;
function drawBinds(c, S0, t, zt, ppm, q) {
  const gw = penPx(S0.wb, zt, ppm);
  for (let i = 0; i < S0.binds.length; i++) {
    const b = S0.binds[i];
    const bt = t - ease(b.u) * WAVE * 0.92;
    if (bt < 0 || bt > TIE) continue;
    const k = bt / TIE, e = ease(k), fade = Math.pow(1 - k, 0.75);
    const X = sx(b.x), Y = sy(b.y);
    if (X < -60 || Y < -60 || X > View.w + 60 || Y > View.h + 60) continue;

    /* a little of the new material runs out into the old */
    if (q > 0.3) {
      for (let j = 0; j < b.edges.length; j++) {
        const ed = b.edges[j];
        const o = G.ea[ed] === b.node ? G.eb[ed] : G.ea[ed];
        const dx = sx(G.nx[o]) - X, dy = sy(G.ny[o]) - Y;
        const L = Math.hypot(dx, dy) || 1;
        const reach = Math.min(L, lerp(4, 30, e));
        const ex = X + dx / L * reach, ey = Y + dy / L * reach;
        const gr = c.createLinearGradient(X, Y, ex, ey);
        gr.addColorStop(0, fibreCol(1, 0.62 * fade));
        gr.addColorStop(1, fibreCol(1, 0));
        c.globalAlpha = 1;
        c.strokeStyle = gr;
        c.lineWidth = gw * 0.85;
        c.beginPath(); c.moveTo(X, Y); c.lineTo(ex, ey); c.stroke();
      }
    }

    /* the tie closing */
    c.globalAlpha = fade * 0.5;
    c.strokeStyle = fibreCol(1, 1);
    c.lineWidth = lerp(2.1, 0.6, e);
    c.beginPath();
    c.arc(X, Y, lerp(1.5, 14, e), 0, TAU);
    c.stroke();

    /* the whipping: two stitches drawn across the cord, in turn */
    const ca = Math.cos(b.ang), sa = Math.sin(b.ang);
    const span = Math.max(3.4, gw * 1.15);
    c.lineCap = "round";
    for (let s = 0; s < 2; s++) {
      const kk = clamp((k - 0.06 - s * 0.16) / 0.3, 0, 1);
      if (kk <= 0) continue;
      const px = X + ca * (s ? 1 : -1) * span * 0.75;
      const py = Y + sa * (s ? 1 : -1) * span * 0.75;
      const r = span * 0.95 * kk;
      c.globalAlpha = fade * 0.85;
      c.strokeStyle = fibreCol(1, 1);
      c.lineWidth = Math.max(1.1, gw * 0.36);
      c.beginPath();
      c.moveTo(px + sa * r, py - ca * r);
      c.lineTo(px - sa * r, py + ca * r);
      c.stroke();
    }
  }
  c.globalAlpha = 1;
}
