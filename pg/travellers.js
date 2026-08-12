/* PERSPECTIVAL GROUND — the others.

   If nobody else is on the ground, the ground supplies travellers. They are
   not decoration and they are not opponents: they are the only way you ever
   find out that the line you laid is a ramp to one of them, a wall to the
   next, and nothing at all to a third. They use the same graph, the same
   route(), the same beings as you. They are you, being someone else. */

import { View, sx, sy, alongPath, pathLength, units, viewBounds } from "./geo.js";
import { G, route, routePoints, nearestNodeFor, wear } from "./graph.js";
import { BEINGS, byId } from "./beings.js";
import { S, on, emit, creditMark, logBalk } from "./state.js";

const WANT = 5;
let mob = [];

export function init() {
  on("boot", () => { for (let i = 0; i < WANT; i++) spawn(i); });
}

function spawn(i) {
  const being = BEINGS[i % BEINGS.length];
  const b = viewBounds(0);
  const x = b.x0 + Math.random() * (b.x1 - b.x0);
  const y = b.y0 + Math.random() * (b.y1 - b.y0);
  const n = nearestNodeFor(x, y, being, units(1400));
  if (n < 0) return;
  const t = { id: "t" + i + "." + Date.now().toString(36), being, node: n, x: G.nx[n], y: G.ny[n], trip: null, by: "ground" };
  mob.push(t);
  S.travellers = mob;
  pick(t);
}

function pick(t) {
  const b = viewBounds(260);
  const x = b.x0 + Math.random() * (b.x1 - b.x0);
  const y = b.y0 + Math.random() * (b.y1 - b.y0);
  const to = nearestNodeFor(x, y, t.being, units(900));
  if (to < 0 || to === t.node) return;
  const r = route(t.node, to, t.being);
  if (!r || r.edges.length === 0) return;
  t.trip = { r, pts: routePoints(r), at: 0 };
}

export function draw(ctx) {
  const c = ctx.c;
  for (const t of mob) {
    if (t.trip) step(ctx, t);
    else if (Math.random() < 0.02) pick(t);

    const X = sx(t.x), Y = sy(t.y);
    if (X < -30 || X > View.w + 30 || Y < -30 || Y > View.h + 30) continue;
    c.beginPath();
    c.arc(X, Y, 5, 0, Math.PI * 2);
    c.fillStyle = t.being.ink.live;
    c.fill();
    c.lineWidth = 1.5;
    c.strokeStyle = "#f4f0e5";
    c.stroke();
  }
}

function step(ctx, t) {
  t.trip.at += units(t.being.speed * (ctx.dt / 1000) * 0.3);
  const q = alongPath(t.trip.pts, t.trip.at);
  t.x = q.x; t.y = q.y;
  if (q.done) {
    const r = t.trip.r;
    t.node = r.nodes[r.nodes.length - 1];
    wear(r.edges, 1);
    /* did they use something a person drew? */
    for (const e of r.edges) {
      const m = G.emark[e];
      if (m) creditMark(m, t);
    }
    if (r.balk) logBalk(r.balk.x, r.balk.y, t.being);
    S.journeys.push({ pts: t.trip.pts, by: "ground", being: t.being.id, t: Date.now() });
    t.trip = null;
  }
}

export const all = () => mob;
