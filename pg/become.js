/* PERSPECTIVAL GROUND — becoming.

   The signature move, and the one thing that must never feel like a filter
   being applied. The camera does not move. The city does not move. Your
   position does not move. What changes is which of it is ground.

   Everything you have ever done stays exactly where it was; it simply means
   something else now. */

import { View, sx, sy, clamp, ease } from "./geo.js";
import { S, on, emit, become } from "./state.js";
import { nextBeing } from "./beings.js";

let t0 = 0, from = null, dur = 900;

export function init() {
  /* one turn is one completed passage */
  on("arrive", () => setTimeout(turn, 700));
}

export function turn() {
  from = S.being;
  become(nextBeing(S.being));
  t0 = performance.now();
}

export function draw(ctx, now) {
  if (!t0) return;
  const k = clamp((now - t0) / dur, 0, 1);
  if (k >= 1) { t0 = 0; return; }
  const c = ctx.c;
  const e = ease(k);

  /* a band of unweaving that crosses the screen and leaves a different board */
  c.save();
  c.globalAlpha = (1 - e) * 0.5;
  c.fillStyle = "#efeadd";
  c.fillRect(0, 0, View.w, View.h);
  c.globalAlpha = 1;

  c.textAlign = "center";
  c.textBaseline = "middle";
  c.globalAlpha = Math.sin(k * Math.PI) * 0.9;
  c.fillStyle = S.being.ink.ladder;
  c.font = "italic 30px Georgia, serif";
  c.fillText("you are " + S.being.name.toLowerCase(), View.w / 2, View.h * 0.42);
  c.restore();
  c.globalAlpha = 1;
}
