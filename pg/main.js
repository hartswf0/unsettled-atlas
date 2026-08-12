/* PERSPECTIVAL GROUND — the loop.

   main.js owns exactly three things: the canvas, the order the organs draw
   in, and which organ a finger currently belongs to. It owns no game rules.

   The gesture grammar, decided once and for all:
     tap ground          go there
     drag                move the map          (Google Maps, and nothing else)
     two fingers         zoom
     tap the pip, drag   lay a line into the ground
   There is no mode picker. The pip is one control, and it starts pulsing on
   its own the moment the ground refuses to carry you somewhere. */

import { View, fitCanvas, panBy, zoomAt, clamp } from "./geo.js";
import { loadGraph, G } from "./graph.js";
import { S, load, connect, on, emit } from "./state.js";
import { CAR } from "./beings.js";

import * as cloth from "./cloth.js";
import * as traces from "./traces.js";
import * as draw from "./draw.js";
import * as travellers from "./travellers.js";
import * as move from "./move.js";
import * as become from "./become.js";
import * as hud from "./hud.js";

const cv = document.getElementById("cv");
const g2 = cv.getContext("2d", { alpha: false });

/* what every organ is handed */
export const ctx = {
  c: g2, cv,
  quality: 1,        /* drops when frames run long; organs must respect it */
  now: 0, dt: 0,
  mode: "travel",    /* "travel" | "draw" — main owns this, draw.js requests it */
  hud: document.getElementById("hud"),
  arm(on) { ctx.mode = on ? "draw" : "travel"; emit("mode", ctx.mode); },
};

const ORGANS = [cloth, traces, draw, travellers, move, become, hud];

/* ---------- boot ---------- */
function boot() {
  loadGraph();
  connect();
  load();
  for (const o of ORGANS) o.init && o.init(ctx);
  emit("boot");
  resize();
  requestAnimationFrame(frame);
  setTimeout(() => document.getElementById("boot").classList.add("gone"), 260);
}

function resize() {
  fitCanvas(cv);
  g2.setTransform(View.dpr, 0, 0, View.dpr, 0, 0);
  emit("resize");
}
addEventListener("resize", resize);
addEventListener("orientationchange", () => setTimeout(resize, 120));

/* ---------- the loop ---------- */
let last = 0, slow = 0;
function frame(now) {
  ctx.dt = last ? Math.min(64, now - last) : 16;
  ctx.now = now;
  last = now;

  const t0 = performance.now();
  g2.setTransform(View.dpr, 0, 0, View.dpr, 0, 0);
  for (const o of ORGANS) if (o.draw) o.draw(ctx, now);
  const cost = performance.now() - t0;

  /* one honest quality dial rather than each organ guessing */
  slow = slow * 0.9 + cost * 0.1;
  if (slow > 13 && ctx.quality > 0.35) ctx.quality = Math.max(0.35, ctx.quality - 0.02);
  else if (slow < 7 && ctx.quality < 1) ctx.quality = Math.min(1, ctx.quality + 0.01);

  requestAnimationFrame(frame);
}

/* ---------- fingers ----------
   One place decides whether a gesture is the map's, the pip's or a tap. */
const pts = new Map();
let pan = null, pinch = null, claimed = null;
const TAP_SLOP = 9, TAP_MS = 320;

function xy(e) {
  const r = cv.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

cv.addEventListener("pointerdown", (e) => {
  cv.setPointerCapture(e.pointerId);
  const p = xy(e);
  pts.set(e.pointerId, { ...p, x0: p.x, y0: p.y, t: performance.now(), moved: false });

  if (pts.size === 2) { pan = null; pinch = spread(); return; }

  /* the organs get first refusal, in order; drawing wants the finger when armed */
  claimed = null;
  for (const o of ORGANS) {
    if (o.onDown && o.onDown(ctx, p, e)) { claimed = o; break; }
  }
  if (!claimed) pan = { ...p };
});

cv.addEventListener("pointermove", (e) => {
  const rec = pts.get(e.pointerId);
  if (!rec) return;
  const p = xy(e);
  if (Math.hypot(p.x - rec.x0, p.y - rec.y0) > TAP_SLOP) rec.moved = true;

  if (pts.size >= 2) {
    const d = spread();
    if (pinch && d.dist > 0) {
      zoomAt(d.cx, d.cy, Math.log2(d.dist / pinch.dist));
      pinch = d;
    }
    rec.x = p.x; rec.y = p.y;
    return;
  }

  if (claimed && claimed.onMove) claimed.onMove(ctx, p, e);
  else if (pan) { panBy(p.x - rec.x, p.y - rec.y); }
  rec.x = p.x; rec.y = p.y;
});

function up(e) {
  const rec = pts.get(e.pointerId);
  pts.delete(e.pointerId);
  if (pts.size < 2) pinch = null;
  if (!rec) return;
  const p = xy(e);
  const tap = !rec.moved && performance.now() - rec.t < TAP_MS * 3;

  if (claimed && claimed.onUp) claimed.onUp(ctx, p, e, { tap });
  else if (tap) {
    for (const o of ORGANS) if (o.onTap && o.onTap(ctx, p, e)) break;
  }
  claimed = null; pan = null;
}
cv.addEventListener("pointerup", up);
cv.addEventListener("pointercancel", up);

function spread() {
  const a = [...pts.values()];
  if (a.length < 2) return null;
  return {
    dist: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y),
    cx: (a[0].x + a[1].x) / 2, cy: (a[0].y + a[1].y) / 2,
  };
}

cv.addEventListener("wheel", (e) => {
  e.preventDefault();
  const r = cv.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, -e.deltaY * 0.0022);
}, { passive: false });

/* A handle for the harness: critics drive the real build through this, and
   pg/tools/age.mjs uses it to fast-forward a world so the late game can be
   looked at without playing it for an hour. Not used by the game itself. */
window.PG = { ctx, View, G, S, on, emit, organs: { cloth, traces, draw, travellers, move, become, hud } };

boot();
