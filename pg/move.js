/* PERSPECTIVAL GROUND — going somewhere.

   Google Maps grammar and nothing cleverer: tap the ground, the way appears,
   you go. The only thing that is not Google Maps is that the way is computed
   for whatever you currently are, so the same tap on the same corner gives a
   different line — or no line at all — depending on who is asking. */

import { View, sx, sy, wx, wy, centerOn, alongPath, pathLength, lerp, clamp, units, metres } from "./geo.js";
import { G, route, routePoints, nearestNodeFor, wear } from "./graph.js";
import { S, on, emit, logJourney, logBalk } from "./state.js";

let you = null;       /* {node, x, y} */
let plan = null;      /* {r, pts, len} */
let trip = null;      /* {pts, len, at, speed} */

export function init(ctx) {
  on("boot", () => place());
  on("become", () => { plan = null; trip = null; if (you) reseat(); });
}

function place() {
  const n = nearestNodeFor(View.x, View.y, S.being, 0.004);
  if (n < 0) return;
  you = { node: n, x: G.nx[n], y: G.ny[n] };
  S.you = you;
  centerOn(you.x, you.y);
}
/* when you become something else you do not teleport — you stay where you are
   standing, on whatever ground the new body can stand on nearest to it */
function reseat() {
  const n = nearestNodeFor(you.x, you.y, S.being, 0.004);
  if (n >= 0) { you.node = n; you.x = G.nx[n]; you.y = G.ny[n]; }
}

export function onTap(ctx, p) {
  if (ctx.mode !== "travel" || !you) return false;
  const tx = wx(p.x), ty = wy(p.y);

  /* tapping the way you were already shown means: go */
  if (plan && near(p, plan)) { go(); return true; }

  const to = nearestNodeFor(tx, ty, S.being, units(700));
  if (to < 0) return true;
  const r = route(you.node, to, S.being);
  if (!r) return true;
  plan = { r, pts: routePoints(r), to };
  emit("plan", plan);
  return true;
}

function near(p, pl) {
  const last = pl.pts.length - 2;
  return Math.hypot(sx(pl.pts[last]) - p.x, sy(pl.pts[last + 1]) - p.y) < 46;
}

function go() {
  if (!plan || plan.pts.length < 4) return;
  trip = { pts: plan.pts, len: pathLength(plan.pts), at: 0, r: plan.r };
  emit("depart", trip);
  plan = null;
}

export function draw(ctx, now) {
  const c = ctx.c;
  if (trip) advance(ctx);

  if (plan) drawWay(c, plan.pts, S.being.ink.ladder, plan.r.balk);
  if (trip) drawWay(c, trip.pts, S.being.ink.live, null);

  if (you) {
    const X = sx(you.x), Y = sy(you.y);
    c.beginPath();
    c.arc(X, Y, 9, 0, Math.PI * 2);
    c.fillStyle = S.being.ink.ladder;
    c.fill();
    c.lineWidth = 2.5;
    c.strokeStyle = "#f6f2e8";
    c.stroke();
  }
}

function drawWay(c, pts, col, balk) {
  c.strokeStyle = col;
  c.lineWidth = 5;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.globalAlpha = 0.85;
  c.beginPath();
  c.moveTo(sx(pts[0]), sy(pts[1]));
  for (let i = 2; i + 1 < pts.length; i += 2) c.lineTo(sx(pts[i]), sy(pts[i + 1]));
  c.stroke();
  c.globalAlpha = 1;

  if (balk) {
    /* the ground stopped offering anything. this is the invitation. */
    const X = sx(balk.x), Y = sy(balk.y);
    c.setLineDash([4, 7]);
    c.strokeStyle = "#bf4526";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(X, Y);
    c.lineTo(sx(balk.toX), sy(balk.toY));
    c.stroke();
    c.setLineDash([]);
  }
}

function advance(ctx) {
  const speed = S.being.speed * (ctx.dt / 1000) * 0.35;
  trip.at += units(speed);
  const q = alongPath(trip.pts, trip.at);
  you.x = q.x; you.y = q.y;
  centerOn(q.x, q.y);
  if (q.done) {
    const last = trip.r.nodes[trip.r.nodes.length - 1];
    you.node = last;
    wear(trip.r.edges, 1);
    logJourney(trip.pts, trip.r.edges, S.being);
    if (trip.r.balk) logBalk(trip.r.balk.x, trip.r.balk.y, S.being);
    emit("arrive", { balk: trip.r.balk });
    trip = null;
  }
}

export const state = () => ({ you, plan, trip });
