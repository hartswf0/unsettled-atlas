/* PERSPECTIVAL GROUND — the almost-nothing on screen.

   Two facts and one link, and that is the entire interface.

   WHAT YOU ARE. Not what it means, not what it can use, not what any mark does
   for it. That is found out by going.

   HOW FAR ALONG. Three crossings to make, three to beat you to them. Pips,
   because a pip is the fastest thing in the world to read and because you
   should be able to tell whether you are winning without reading a word.

   THE GROUND KEY. A ground is a link. Anybody holding it is on the same cloth,
   and their lines arrive in yours as they draw them. */

import { View } from "./geo.js";
import { S, on } from "./state.js";
import { GID, groundLink, net, peers } from "./net.js";

let who = null, pips = null, key = null, wrap = null;

export function init(ctx) {
  wrap = document.createElement("div");
  wrap.id = "pgtop";
  ctx.hud.appendChild(wrap);

  const style = document.createElement("style");
  style.textContent = `
    #pgtop{
      position:fixed;left:0;right:0;top:0;
      padding:calc(10px + var(--sat)) 12px 0;
      display:flex;align-items:flex-start;justify-content:space-between;
      gap:10px;pointer-events:none}
    #pgtop > *{pointer-events:auto}
    #pgwho{
      font:italic 15px/1.15 Georgia,serif;letter-spacing:.03em;
      color:var(--ink);opacity:.8;padding-top:3px}
    #pgpips{display:flex;flex-direction:column;gap:5px;align-items:flex-end}
    .pgrow{display:flex;gap:5px;align-items:center}
    .pgpip{
      width:11px;height:11px;border:1.6px solid var(--ink);
      background:transparent;border-radius:1px;transition:background .3s ease}
    .pgpip.on{background:var(--ink)}
    .pgrow.rival .pgpip{border-color:#8a5a12}
    .pgrow.rival .pgpip.on{background:#c98a2e}
    #pgkey{
      position:fixed;right:16px;bottom:calc(152px + var(--sab));
      width:42px;height:42px;border-radius:50%;border:0;padding:0;
      background:var(--paper-lit);color:var(--ink);display:grid;place-items:center;
      box-shadow:inset 0 0 0 1px rgba(29,32,29,.3);
      font:600 9px/1.1 ui-monospace,monospace;letter-spacing:.06em;
      opacity:.8;transition:opacity .2s, background .2s}
    #pgkey.live{background:#dff0ea;box-shadow:inset 0 0 0 1.5px #2f7d84;opacity:1}
    #pgkey.busy{opacity:.55}
    #pgkey.off{opacity:.5}
    #pgkey b{display:block;font-size:13px;font-weight:700}
    #pgkey.copied{background:var(--signal);color:var(--paper-lit)}
    @media (max-width:380px){#pgwho{font-size:13.5px}}`;
  document.head.appendChild(style);

  who = document.createElement("div");
  who.id = "pgwho";
  wrap.appendChild(who);

  pips = document.createElement("div");
  pips.id = "pgpips";
  wrap.appendChild(pips);

  /* the ground key: one tap copies the link that IS this ground */
  key = document.createElement("button");
  key.id = "pgkey";
  key.title = "copy this ground's link";
  ctx.hud.appendChild(key);
  key.addEventListener("click", async () => {
    const url = groundLink();
    try { await navigator.clipboard.writeText(url); }
    catch {
      const t = document.createElement("textarea");
      t.value = url; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch {}
      t.remove();
    }
    key.classList.add("copied");
    setTimeout(() => key.classList.remove("copied"), 1200);
  });

  const setWho = () => { who.textContent = S.being ? "you are " + S.being.name.toLowerCase() : ""; };
  on("boot", setWho);
  on("become", setWho);
  on("crossing", render);
  on("leg", render);
  on("crossing-over", render);
  on("net", render);
  on("peer", render);
  setWho();
  render();
  setInterval(render, 2000);
}

function row(cls, done, total) {
  const r = document.createElement("div");
  r.className = "pgrow " + cls;
  for (let i = 0; i < total; i++) {
    const p = document.createElement("span");
    p.className = "pgpip" + (i < done ? " on" : "");
    r.appendChild(p);
  }
  return r;
}

function render() {
  if (!pips) return;
  const st = window.PG?.organs?.turn?.state?.();
  pips.innerHTML = "";
  if (st && st.tokens?.length) {
    pips.appendChild(row("you", st.tokens.filter((t) => t.home).length, st.tokens.length));
    pips.appendChild(row("rival", st.rivals.filter((t) => t.home).length, st.rivals.length));
  }

  /* Say plainly what is true. A cryptic badge is how "multiplayer does not
     work" and "nobody else has opened the link yet" look identical. */
  const others = peers().length;
  const link = net.state;
  key.classList.toggle("live", link === "open");
  key.classList.toggle("busy", link === "connecting");
  key.classList.toggle("off", link === "local");
  if (link === "open") {
    key.innerHTML = others ? `<b>${others + 1}</b>here` : `<b>1</b>here`;
    key.title = others
      ? `${others + 1} on this ground — tap to copy the link`
      : "on this ground, alone — tap to copy the link and bring somebody";
  } else if (link === "connecting") {
    key.innerHTML = `<b>·</b>join`;
    key.title = "looking for this ground's meeting point";
  } else {
    key.innerHTML = `<b>—</b>solo`;
    key.title = "no meeting point reachable from this network — playing alone";
  }
}
