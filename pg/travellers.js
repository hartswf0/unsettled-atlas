/* PERSPECTIVAL GROUND — the others.

   Two kinds, drawn the same way, because to you they are the same thing:
   somebody else on your ground who is not built like you.

   REAL PEOPLE arrive over the ground key. You see where they are and what they
   currently are, and their lines land in your cloth as they draw them.

   THE ONES THE GROUND SUPPLIES turn up when nobody else is here, so the
   thirty-second bar holds for one person alone. They are not decoration and
   not opponents: they use the same graph, the same route(), the same beings
   and the same marks you do. They are the only way you find out that the line
   you laid is a ramp to one of them, a wall to the next, and nothing at all to
   a third — and when one of them takes something you drew, that line flares in
   THEIR colour, not yours. Nothing says why. */

import { View, sx, sy, alongPath, units, viewBounds, clamp, TAU, metres } from "./geo.js";
import { G, route, routePoints, nearestNodeFor, wear } from "./graph.js";
import { BEINGS, byId } from "./beings.js";
import { S, on, emit, creditMark, logBalk } from "./state.js";
import { peers, net } from "./net.js";

const WANT = 4;
let mob = [];
const flares = [];   /* {pts, col, t0, life} — a mark being used, right now */

export function init() {
  on("boot", () => { for (let i = 0; i < WANT; i++) spawn(i); });
  on("witness", (w) => {
    /* your line, somebody else's body. the flare is theirs. */
    if (!w || !w.mark) return;
    flares.push({
      pts: w.mark.pts, col: w.traveller.being.ink.ladder,
      t0: performance.now(), life: 1500,
    });
  });
}

function spawn(i) {
  const being = BEINGS[i % BEINGS.length];
  const b = viewBounds(0);
  const x = b.x0 + Math.random() * (b.x1 - b.x0);
  const y = b.y0 + Math.random() * (b.y1 - b.y0);
  const n = nearestNodeFor(x, y, being, units(1600));
  if (n < 0) return;
  mob.push({
    id: "t" + i, being, node: n, x: G.nx[n], y: G.ny[n], trip: null, by: "ground",
  });
  S.travellers = mob;
}

function pick(t) {
  const b = viewBounds(420);
  const x = b.x0 + Math.random() * (b.x1 - b.x0);
  const y = b.y0 + Math.random() * (b.y1 - b.y0);
  const to = nearestNodeFor(x, y, t.being, units(900));
  if (to < 0 || to === t.node) return;
  const r = route(t.node, to, t.being);
  if (!r || r.edges.length === 0) return;
  const pts = routePoints(r);
  let len = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) len += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
  t.trip = { r, pts, at: 0, len };
}

export function draw(ctx, now) {
  const c = ctx.c;

  /* the ones the ground supplies — quieter when real people are here */
  const busy = peers().length;
  for (const t of mob) {
    if (t.trip) step(ctx, t);
    else if (Math.random() < 0.015) pick(t);
    body(c, sx(t.x), sy(t.y), t.being.ink.live, busy ? 0.45 : 0.85, false);
  }

  /* real people */
  for (const p of peers()) {
    const be = byId(p.b);
    body(c, sx(p.x), sy(p.y), be.ink.ladder, 1, true);
  }

  drawFlares(c, now);
}

function body(c, X, Y, col, alpha, real) {
  if (X < -30 || X > View.w + 30 || Y < -30 || Y > View.h + 30) return;
  c.save();
  c.globalAlpha = alpha;
  c.beginPath();
  c.arc(X, Y, real ? 7 : 5, 0, TAU);
  c.fillStyle = col;
  c.fill();
  c.lineWidth = real ? 2.4 : 1.5;
  c.strokeStyle = "#f4f0e5";
  c.stroke();
  if (real) {
    c.globalAlpha = alpha * 0.35;
    c.beginPath();
    c.arc(X, Y, 13, 0, TAU);
    c.strokeStyle = col;
    c.lineWidth = 1.4;
    c.stroke();
  }
  c.restore();
}

function step(ctx, t) {
  t.trip.at += units(t.being.speed * (ctx.dt / 1000) * 0.34);
  const q = alongPath(t.trip.pts, t.trip.at);
  t.x = q.x; t.y = q.y;
  if (q.done || t.trip.at >= t.trip.len) {
    const r = t.trip.r;
    t.node = r.nodes[r.nodes.length - 1];
    wear(r.edges, 1);
    /* did they use something a person drew? */
    for (const e of r.edges) {
      const m = G.emark[e];
      if (m) creditMark(m, t);
    }
    if (r.balk) logBalk(r.balk.x, r.balk.y, t.being, r.balk.toX, r.balk.toY);
    S.journeys.push({ pts: t.trip.pts, by: "ground", being: t.being.id, t: Date.now() });
    emit("journey", null);
    t.trip = null;
  }
}

/* A line of yours, lighting up in the colour of whoever is using it. This is
   the only moment in the game where you learn what you built, and it does not
   come with a word attached. */
function drawFlares(c, now) {
  for (let i = flares.length - 1; i >= 0; i--) {
    const f = flares[i];
    const k = (now - f.t0) / f.life;
    if (k >= 1) { flares.splice(i, 1); continue; }
    const a = Math.sin(Math.min(1, k) * Math.PI);
    c.save();
    c.globalAlpha = a * 0.85;
    c.strokeStyle = f.col;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.lineWidth = 3 + a * 7;
    c.beginPath();
    c.moveTo(sx(f.pts[0]), sy(f.pts[1]));
    for (let j = 2; j + 1 < f.pts.length; j += 2) c.lineTo(sx(f.pts[j]), sy(f.pts[j + 1]));
    c.stroke();
    c.restore();
  }
}

export const all = () => mob;
