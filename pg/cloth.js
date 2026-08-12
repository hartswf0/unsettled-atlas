/* PERSPECTIVAL GROUND — the cloth.

   Atlanta is not a picture under the game. It is fibre in the same cloth the
   game is woven into: water, rail and road are threads already laid, and what
   anybody draws today passes among them.

   Two passes, and the difference between them is the whole visual argument:
     1. the city, always, in its own quiet colour — so you never lose your block
     2. the ground THIS being can actually use, brought forward out of it
   Nothing is hidden in pass 2. The city does not disappear when you become
   something else; it stops being *for* you, which is a different thing and
   should look like a different thing. */

import { GROUND } from "./ground.data.js";
import { View, sx, sy, worldSize, viewBounds, clamp, lerp, hash01, mercX, mercY } from "./geo.js";
import { G } from "./graph.js";
import { S, on } from "./state.js";

const PAPER = "#efeadd", PAPER_LIT = "#f4f0e5";

/* how the city is inked when it is nobody's in particular */
const INK = {
  boundary: { col: "#9a9083", w: [0.6, 1.2], a: 0.26, dash: 1 },
  rail:     { col: "#6e736d", w: [0.5, 1.4], a: 0.24, dash: 1 },
  secondary:{ col: "#5d635c", w: [0.5, 1.6], a: 0.26 },
  water:    { col: "#7fa9b0", w: [1.4, 6.0], a: 0.60 },
  primary:  { col: "#484e47", w: [0.8, 2.9], a: 0.38 },
  motorway: { col: "#3a403a", w: [1.3, 4.8], a: 0.50 },
};
const ORDER = ["boundary", "rail", "secondary", "water", "primary", "motorway"];

let LAYERS = {}, PLACES = [];

function decode(str) {
  const out = [];
  let i = 0;
  const n = str.length;
  while (i < n) {
    let lat = 0, lng = 0;
    const pts = [];
    while (i < n && str[i] !== "|") {
      let sh = 0, r = 0, b;
      do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
      lng += (r & 1) ? ~(r >> 1) : (r >> 1);
      sh = 0; r = 0;
      do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
      lat += (r & 1) ? ~(r >> 1) : (r >> 1);
      pts.push(mercX(lng / 1e5), mercY(lat / 1e5));
    }
    i++;
    if (pts.length >= 4) out.push(Float64Array.from(pts));
  }
  return out;
}

let paperTile = null;
function makePaper() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = PAPER;
  x.fillRect(0, 0, 128, 128);
  const im = x.getImageData(0, 0, 128, 128), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (hash01(i * 0.37) - 0.5) * 13;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8;
  }
  x.putImageData(im, 0, 0);
  return c;
}

export function init() {
  for (const k in GROUND.layers) LAYERS[k] = decode(GROUND.layers[k]);
  PLACES = (GROUND.places || []).map((p) => ({
    name: p[0], kind: p[1], x: mercX(p[2] / 1e5), y: mercY(p[3] / 1e5),
  }));
  paperTile = makePaper();
}

export function draw(ctx) {
  const c = ctx.c;
  const zt = clamp((View.z - 10.5) / 6.5, 0, 1);

  /* paper */
  const pat = c.createPattern(paperTile, "repeat");
  c.fillStyle = pat || PAPER;
  c.fillRect(0, 0, View.w, View.h);

  const b = viewBounds(90);

  /* pass 1 — the city, as itself */
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const name of ORDER) {
    const lines = LAYERS[name];
    if (!lines) continue;
    if (name === "rail" && View.z < 11.5) continue;
    if (name === "secondary" && View.z < 11.2) continue;
    const st = INK[name];
    const lw = lerp(st.w[0], st.w[1], zt);
    c.strokeStyle = st.col;
    c.globalAlpha = st.a;
    c.lineWidth = lw;
    c.setLineDash(st.dash && lw > 0.8 ? [lw * 2.6, lw * 2.2] : []);
    c.beginPath();
    for (const p of lines) {
      let on = false, started = false;
      for (let j = 0; j < p.length; j += 2) {
        if (p[j] > b.x0 && p[j] < b.x1 && p[j + 1] > b.y0 && p[j + 1] < b.y1) on = true;
        const X = sx(p[j]), Y = sy(p[j + 1]);
        if (!started) { c.moveTo(X, Y); started = true; } else c.lineTo(X, Y);
      }
      if (!on) { /* keep the path simple; off-screen lines cost little here */ }
    }
    c.stroke();
  }
  c.setLineDash([]);

  /* pass 2 — the ground this being can use, brought forward */
  drawOperative(ctx, zt);

  /* places, so you always know where you are */
  drawPlaces(c);
  c.globalAlpha = 1;
}

function drawOperative(ctx, zt) {
  const c = ctx.c;
  const being = S.being;
  if (!being) return;
  const b = viewBounds(60);
  const lw = lerp(1.1, 3.4, zt);

  const buckets = { ladder: [], plain: [], chute: [] };
  for (let e = 0; e < G.e; e++) {
    const a = G.ea[e], z = G.eb[e];
    const ax = G.nx[a], ay = G.ny[a];
    if (ax < b.x0 || ax > b.x1 || ay < b.y0 || ay > b.y1) continue;
    const r = being.read(e, true);
    if (!r.live) continue;
    buckets[r.kind].push(e);
  }

  for (const kind of ["plain", "chute", "ladder"]) {
    const list = buckets[kind];
    if (!list.length) continue;
    c.strokeStyle = being.ink[kind === "plain" ? "live" : kind];
    c.globalAlpha = kind === "plain" ? 0.5 : 0.8;
    c.lineWidth = kind === "ladder" ? lw * 1.5 : lw;
    c.beginPath();
    for (const e of list) {
      const a = G.ea[e], z = G.eb[e];
      c.moveTo(sx(G.nx[a]), sy(G.ny[a]));
      c.lineTo(sx(G.nx[z]), sy(G.ny[z]));
    }
    c.stroke();
  }
  c.globalAlpha = 1;
}

function drawPlaces(c) {
  if (View.z < 11.4) return;
  const b = viewBounds(0);
  c.globalAlpha = 0.62;
  c.fillStyle = "#1d201d";
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const p of PLACES) {
    if (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1) continue;
    const big = p.kind === "city";
    if (!big && View.z < 12.6) continue;
    c.font = `italic ${big ? 14 : 11}px Georgia, serif`;
    c.fillText(p.name, sx(p.x), sy(p.y));
  }
  c.globalAlpha = 1;
}
