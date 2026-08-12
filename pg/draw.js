/* PERSPECTIVAL GROUND — laying a line into the ground.

   One control. Tap the pip, drag, and what you drew is ground now — with the
   same rights as the interstate beside it. It starts pulsing by itself the
   moment the ground refuses to carry you somewhere, which is the only tutorial
   this game gets. */

import { View, sx, sy, wx, wy, simplify, pathLength, units, metres } from "./geo.js";
import { S, on, emit, layMark } from "./state.js";

let pip = null, armed = false, urgent = false;
let stroke = null;

export function init(ctx) {
  pip = document.createElement("button");
  pip.id = "pip";
  pip.setAttribute("aria-label", "lay a line into the ground");
  pip.innerHTML = `<svg viewBox="0 0 44 44" width="44" height="44">
    <path class="gl" d="M8 30c7 0 5-16 14-16s7 16 14 16" fill="none" stroke="currentColor"
      stroke-width="2.6" stroke-linecap="round"/></svg>`;
  Object.assign(pip.style, {
    position: "fixed", left: "50%", transform: "translateX(-50%)",
    bottom: "calc(22px + var(--sab))", width: "72px", height: "72px",
    borderRadius: "50%", border: "0", background: "var(--paper-lit)",
    color: "var(--ink)", display: "grid", placeItems: "center",
    boxShadow: "inset 0 0 0 1px rgba(29,32,29,.34), 0 1px 3px rgba(29,32,29,.14)",
    transition: "transform .16s cubic-bezier(.2,.8,.3,1), background .2s, color .2s",
  });
  ctx.hud.appendChild(pip);
  pip.addEventListener("click", () => setArmed(!armed, ctx));

  const style = document.createElement("style");
  style.textContent = `
    @keyframes pgbeat{0%,100%{transform:translateX(-50%) scale(1)}45%{transform:translateX(-50%) scale(1.08)}}
    #pip.beat{animation:pgbeat 1.4s ease-in-out infinite}
    #pip.on{background:var(--signal);color:var(--paper-lit)}
    @media (prefers-reduced-motion:reduce){#pip.beat{animation:none}}`;
  document.head.appendChild(style);

  /* the ground itself asks for the line */
  on("arrive", ({ balk }) => setUrgent(!!balk));
  on("become", () => setUrgent(false));
}

function setArmed(v, ctx) {
  armed = v;
  ctx.arm(v);
  pip.classList.toggle("on", v);
}
function setUrgent(v) {
  urgent = v;
  pip.classList.toggle("beat", v);
}

export function onDown(ctx, p) {
  if (ctx.mode !== "draw") return false;
  stroke = [wx(p.x), wy(p.y)];
  return true;
}
export function onMove(ctx, p) {
  if (!stroke) return;
  const x = wx(p.x), y = wy(p.y);
  const n = stroke.length;
  if (n >= 2 && Math.hypot(x - stroke[n - 2], y - stroke[n - 1]) < units(4)) return;
  stroke.push(x, y);
}
export function onUp(ctx, p) {
  if (!stroke) return;
  const pts = simplify(stroke, units(9));
  stroke = null;
  setArmed(false, ctx);
  setUrgent(false);
  if (pts.length < 4 || metres(pathLength(pts)) < 25) return;
  /* how wide a line is is how fast the hand was: a considered line is wider */
  layMark(pts, 2.4, S.being);
}

export function draw(ctx) {
  if (!stroke || stroke.length < 4) return;
  const c = ctx.c;
  c.strokeStyle = S.being.ink.ladder;
  c.lineWidth = 6;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.globalAlpha = 0.9;
  c.beginPath();
  c.moveTo(sx(stroke[0]), sy(stroke[1]));
  for (let i = 2; i + 1 < stroke.length; i += 2) c.lineTo(sx(stroke[i]), sy(stroke[i + 1]));
  c.stroke();
  c.globalAlpha = 1;
}
