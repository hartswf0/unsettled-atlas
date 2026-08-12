/* PERSPECTIVAL GROUND — what passage leaves behind.

   Every journey is kept. Not as a score, as a mark on the ground. Where
   enough of them run together the cloth thickens, and past some threshold the
   worn line stops being a memory of travel and becomes travellable — a ghost
   road, which the next being to come through can use even though nobody
   planned it.

   The whole arc of the game is this layer slowly out-reading the city
   underneath it. */

import { View, sx, sy, viewBounds, clamp, lerp } from "./geo.js";
import { G, CLS_GHOST } from "./graph.js";
import { S, on, layGhost } from "./state.js";

const HARDEN = 4;   /* passages over the same balk before it becomes ground */

export function init() {
  on("balk", (p) => {
    if (p.n === HARDEN) tryHarden(p);
  });
}

function tryHarden(p) {
  /* a desire line: the shortest thing that would have made this passage work */
  const near = S.journeys.filter((j) => !j.ghost).slice(-40);
  if (!near.length) return;
  layGhost([p.x, p.y, p.x + 0.00002, p.y + 0.00002]);
}

export function draw(ctx) {
  const c = ctx.c;
  const b = viewBounds(60);

  /* the used world */
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const j of S.journeys) {
    const pts = j.pts;
    if (pts.length < 4) continue;
    c.strokeStyle = j.ghost ? "#bf4526" : "#8a8272";
    c.globalAlpha = j.ghost ? 0.5 : 0.16;
    c.lineWidth = j.ghost ? 3 : 2;
    c.beginPath();
    c.moveTo(sx(pts[0]), sy(pts[1]));
    for (let i = 2; i + 1 < pts.length; i += 2) c.lineTo(sx(pts[i]), sy(pts[i + 1]));
    c.stroke();
  }

  /* where the ground refused somebody, more than once */
  for (const p of S.pressure) {
    if (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1) continue;
    const r = 4 + Math.min(14, p.n * 2.2);
    c.globalAlpha = 0.3;
    c.strokeStyle = "#bf4526";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(sx(p.x), sy(p.y), r, 0, Math.PI * 2);
    c.stroke();
  }

  /* marks, which are ground now */
  for (const m of S.marks) {
    const pts = m.pts;
    if (pts.length < 4) continue;
    c.globalAlpha = 0.75;
    c.strokeStyle = "#7a2f4e";
    c.lineWidth = 2.5 + Math.min(5, m.use * 0.5);
    c.beginPath();
    c.moveTo(sx(pts[0]), sy(pts[1]));
    for (let i = 2; i + 1 < pts.length; i += 2) c.lineTo(sx(pts[i]), sy(pts[i + 1]));
    c.stroke();
  }
  c.globalAlpha = 1;
}
