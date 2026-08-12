/* PERSPECTIVAL GROUND — the almost-nothing on screen.

   The only thing the player is ever told is what they currently are. Not what
   that means, not what it can use, not what any mark does for it. That is
   found out by going. */

import { View } from "./geo.js";
import { S, on } from "./state.js";

let who = null;

export function init(ctx) {
  who = document.createElement("div");
  Object.assign(who.style, {
    position: "fixed", left: "50%", transform: "translateX(-50%)",
    top: "calc(14px + var(--sat))",
    font: "italic 15px/1 Georgia, serif", letterSpacing: ".04em",
    color: "var(--ink)", opacity: ".75", pointerEvents: "none",
    transition: "opacity .4s ease",
  });
  ctx.hud.appendChild(who);
  const set = () => { who.textContent = S.being ? "you are " + S.being.name.toLowerCase() : ""; };
  on("boot", set);
  on("become", set);
  set();
}
