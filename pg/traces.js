/* PERSPECTIVAL GROUND — what passage leaves behind.

   The city was planned by somebody who is not here. Everything in this layer
   was made by going, and going is the only thing that makes it.

   There are three states and a passage moves through all of them:

     WEAR      every journey darkens the ground it crossed. One passage is
               almost nothing. Forty passages over the same block is a road
               that no one drew.

     PRESSURE  where a body wanted to go and the ground offered it nothing,
               a bruise. Bruises in the same place stack.

     GHOST     past a threshold the bruise gives way: the line the traffic
               kept wanting becomes ground, and the next body through can
               simply use it. Nobody planned it. It is the most valuable
               thing on the map and it is made of other people's failures.

   The visual argument of the whole game lives here. Early on this layer is
   nothing and Atlanta is everything. Late on, the paper is written over by
   use, and the planned city reads as the faint thing underneath. That
   inversion is the point, so it is drawn with more care than anything else. */

import {
  View, sx, sy, worldSize, viewBounds, clamp, lerp, ease, hash01,
  units, metres, pathLength, distToSeg,
} from "./geo.js";
import { G, nearestNode } from "./graph.js";
import { S, on, emit, layGhost } from "./state.js";


/* how many times a body has to be refused in one place before the ground
   gives way and the wanted line becomes real */
const HARDEN = 3;

/* the wear layer is redrawn onto its own cloth and blitted, because it grows
   without bound and must not cost a frame */
const MARGIN = 150;
let layer = null, lctx = null;
let lx = NaN, ly = NaN, lz = NaN, lw = 0, lh = 0;
let dirty = true;

/* The colour of use itself — not any being's, everybody's. Deliberately warm,
   where the city's ink is cool grey: wear has to read as earth worn open
   rather than as more road, or the two layers collapse into one another and
   Atlanta stops being legible under its own traffic. */
const WORN = "94,66,44";
const GHOST_INK = "#8a5a3c";

/* Wear thickens ground in proportion to what that ground already is, so a
   busy side street never grows into something that reads like the Connector.
   The city's hierarchy has to survive its own traffic. */
const CLASS_BODY = [1.0, 0.78, 0.55, 0.42, 0.4, 0.6];

export function init() {
  on("balk", (p) => { dirty = true; if (p.n >= HARDEN && !p.hardened) harden(p); });
  on("journey", () => { dirty = true; });
  on("ghost", () => { dirty = true; });
  on("mark", () => { dirty = true; });
  on("loaded", () => { dirty = true; });
  on("resize", () => { layer = null; dirty = true; });
}

/* ---------- a bruise becomes ground ----------
   The desire line is not invented. It is the piece the traffic kept asking
   for: from where bodies actually got stuck, to the ground they were trying
   to reach, tied at both ends into what already exists. */
function harden(p) {
  const a = nearestNode(p.x, p.y, units(140));
  if (a < 0 || p.tx == null) return;

  /* Where the traffic kept wanting to be, tied into whatever ground is
     actually there. The desire line is not invented — it is the piece that
     was missing, and the bodies named it by failing at it. */
  const z = nearestNode(p.tx, p.ty, units(400));
  if (z < 0 || z === a) return;

  const gap = metres(Math.hypot(G.nx[z] - G.nx[a], G.ny[z] - G.ny[a]));
  if (gap < 15 || gap > 900) return;
  p.hardened = true;

  layGhost([G.nx[a], G.ny[a], G.nx[z], G.ny[z]]);
  emit("hardened", { x: G.nx[a], y: G.ny[a], tx: G.nx[z], ty: G.ny[z], at: performance.now() });
  dirty = true;
}

/* ---------- how much has happened here ----------
   Used by the rest of the game to know whether the world is young or old. */
export function era() {
  let worn = 0;
  for (let e = 0; e < G.e; e++) if (G.euse[e] > 0) worn++;
  return clamp(worn / Math.max(1, G.e * 0.22), 0, 1);
}

/* ============================================================
   the cloth of use
   ============================================================ */
function ensure() {
  const w = Math.ceil(View.w + MARGIN * 2), h = Math.ceil(View.h + MARGIN * 2);
  if (!layer || lw !== w || lh !== h) {
    layer = document.createElement("canvas");
    lw = w; lh = h;
    layer.width = Math.round(w * View.dpr);
    layer.height = Math.round(h * View.dpr);
    lctx = layer.getContext("2d");
    dirty = true;
  }
}

/* has the camera moved far enough that the blit would lie? */
function stale() {
  if (lz !== View.z) return true;
  const ws = worldSize();
  const dx = (View.x - lx) * ws, dy = (View.y - ly) * ws;
  return Math.abs(dx) > MARGIN - 8 || Math.abs(dy) > MARGIN - 8;
}

function reweave() {
  const c = lctx;
  c.setTransform(View.dpr, 0, 0, View.dpr, 0, 0);
  c.clearRect(0, 0, lw, lh);
  lx = View.x; ly = View.y; lz = View.z;

  const ws = worldSize();
  const ox = MARGIN + View.w / 2, oy = MARGIN + View.h / 2;
  const X = (mx) => (mx - lx) * ws + ox;
  const Y = (my) => (my - ly) * ws + oy;

  const b = {
    x0: lx - (ox) / ws, x1: lx + (lw - ox) / ws,
    y0: ly - (oy) / ws, y1: ly + (lh - oy) / ws,
  };

  c.lineCap = "round";
  c.lineJoin = "round";

  /* ---- 1. wear ----
     Journeys are drawn faint and they are drawn on top of each other. Nothing
     computes a heat value; the heat IS the overlap, the way a path in grass is
     the overlap of everyone who cut the corner. */
  const zt = clamp((View.z - 11) / 6, 0, 1);
  const base = lerp(2.4, 7.5, zt);
  const js = S.journeys;
  const start = Math.max(0, js.length - 2600);
  for (let i = start; i < js.length; i++) {
    const j = js[i];
    if (j.ghost) continue;
    const pts = j.pts;
    if (!pts || pts.length < 4) continue;
    if (!crosses(pts, b)) continue;

    /* the older a passage the more it has settled into the ground */
    const age = clamp((js.length - i) / 260, 0, 1);
    c.strokeStyle = `rgba(${WORN},${0.055 + age * 0.05})`;
    c.lineWidth = base * (0.62 + age * 0.5);
    c.beginPath();
    c.moveTo(X(pts[0]), Y(pts[1]));
    for (let k = 2; k + 1 < pts.length; k += 2) c.lineTo(X(pts[k]), Y(pts[k + 1]));
    c.stroke();
  }

  /* ---- 2. the ground that use has actually changed ----
     Edges carry a count. Past a certain amount of traffic a piece of ground
     stops being a road somebody drew and becomes a road everybody made, and
     it is drawn like fibre, not like a highlight. */
  /* How busy is busy? Against an absolute scale, an hour of play saturates
     every arterial and the whole city goes one flat colour — the difference
     between used and unused disappears exactly when it should be loudest. So
     busy is a rank among the ground that is used at all: a tenth of the
     traffic reads heavy whether this world is an hour old or a week old. */
  const busy = wearScale();
  for (let e = 0; e < G.e; e++) {
    const u = G.euse[e];
    if (u < 2) continue;
    const a = G.ea[e], z = G.eb[e];
    const ax = G.nx[a], ay = G.ny[a];
    if (ax < b.x0 || ax > b.x1 || ay < b.y0 || ay > b.y1) continue;
    const k = busy(u);
    c.strokeStyle = `rgba(${WORN},${0.04 + k * k * 0.30})`;
    c.lineWidth = base * CLASS_BODY[G.ec[e]] * (0.34 + k * 1.0);
    c.beginPath();
    c.moveTo(X(ax), Y(ay));
    c.lineTo(X(G.nx[z]), Y(G.ny[z]));
    c.stroke();
  }

  /* ---- 3. what people drew, and what the drawing became ---- */
  for (const m of S.marks) {
    const pts = m.pts;
    if (!pts || pts.length < 4 || !crosses(pts, b)) continue;
    const used = clamp(m.use / 9, 0, 1);
    /* a mark nobody has used is a thin intention; a used one is infrastructure */
    c.strokeStyle = `rgba(122,47,78,${0.5 + used * 0.42})`;
    c.lineWidth = lerp(2.0, 6.4, zt) * (0.7 + used * 0.9);
    strokePts(c, pts, X, Y);
    if (used > 0) {
      c.strokeStyle = `rgba(247,243,232,${0.35 * used})`;
      c.lineWidth = lerp(0.7, 2.0, zt);
      strokePts(c, pts, X, Y);
    }
  }

  /* ---- 4. ghost roads ----
     Drawn last and drawn as real ground, because that is what they are. */
  for (const j of S.journeys) {
    if (!j.ghost || !j.pts || j.pts.length < 4) continue;
    if (!crosses(j.pts, b)) continue;
    c.strokeStyle = `rgba(138,90,60,.30)`;
    c.lineWidth = lerp(5, 13, zt);
    strokePts(c, j.pts, X, Y);
    c.strokeStyle = GHOST_INK;
    c.lineWidth = lerp(1.6, 4.2, zt);
    strokePts(c, j.pts, X, Y);
    /* it was made of many passes, so it is drawn as many strands */
    c.strokeStyle = `rgba(247,243,232,.5)`;
    c.lineWidth = lerp(0.5, 1.3, zt);
    c.setLineDash([lerp(2, 6, zt), lerp(3, 9, zt)]);
    strokePts(c, j.pts, X, Y);
    c.setLineDash([]);
  }

  dirty = false;
}

/* the distribution of traffic, rebuilt when the cloth is rewoven */
function wearScale() {
  const used = [];
  for (let e = 0; e < G.e; e++) if (G.euse[e] >= 2) used.push(G.euse[e]);
  if (used.length < 8) return (u) => clamp(Math.log2(u) / 5.2, 0, 1);
  used.sort((a, z) => a - z);
  return (u) => {
    let lo = 0, hi = used.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (used[mid] < u) lo = mid + 1; else hi = mid; }
    return lo / used.length;
  };
}

function strokePts(c, pts, X, Y) {
  c.beginPath();
  c.moveTo(X(pts[0]), Y(pts[1]));
  for (let k = 2; k + 1 < pts.length; k += 2) c.lineTo(X(pts[k]), Y(pts[k + 1]));
  c.stroke();
}

function crosses(pts, b) {
  for (let i = 0; i + 1 < pts.length; i += 2) {
    if (pts[i] > b.x0 && pts[i] < b.x1 && pts[i + 1] > b.y0 && pts[i + 1] < b.y1) return true;
  }
  return false;
}

/* ============================================================
   draw
   ============================================================ */
export function draw(ctx, now) {
  ensure();
  if (dirty || stale()) reweave();

  const c = ctx.c;
  const ws = worldSize();
  const ox = MARGIN + View.w / 2, oy = MARGIN + View.h / 2;
  const dx = (lx - View.x) * ws + View.w / 2 - ox;
  const dy = (ly - View.y) * ws + View.h / 2 - oy;

  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(layer, Math.round(dx * View.dpr), Math.round(dy * View.dpr));
  c.restore();
  c.setTransform(View.dpr, 0, 0, View.dpr, 0, 0);

  /* bruises breathe, so they are live rather than baked */
  drawPressure(c, now);
}

/* A bruise is a small, quiet thing. It has to be findable without being
   decoration, and above all it must not tile the city in rings — the ground
   is what the player is here to read. So: only the ones that are actually
   close to giving way get any weight, only a handful are drawn at all, and a
   bruise that has already become a road is simply gone. */
const SHOWN = 8;

function drawPressure(c, now) {
  const b = viewBounds(30);
  const live = [];
  for (const p of S.pressure) {
    if (p.hardened || p.n < 2) continue;
    if (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1) continue;
    live.push(p);
  }
  /* the ground gives way where it has been asked most, so that is what shows */
  live.sort((a, z) => z.n - a.n);

  for (let i = 0; i < Math.min(SHOWN, live.length); i++) {
    const p = live[i];
    const X = sx(p.x), Y = sy(p.y);
    const k = clamp((p.n - 1) / HARDEN, 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(now / 700 + p.x * 9e4);
    const r = lerp(5, 10, k);

    c.globalAlpha = (0.16 + k * 0.3) * (0.55 + pulse * 0.45);
    c.strokeStyle = "#bf4526";
    c.lineWidth = 1.3;
    c.beginPath();
    c.arc(X, Y, r, 0, Math.PI * 2);
    c.stroke();

    /* one refusal away from becoming ground: the ring starts to break open */
    if (p.n >= HARDEN - 1) {
      c.setLineDash([2.5, 5]);
      c.globalAlpha = 0.45 * pulse;
      c.beginPath();
      c.arc(X, Y, r + 5, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
  }
  c.globalAlpha = 1;
}
