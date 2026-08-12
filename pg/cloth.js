/* PERSPECTIVAL GROUND — the cloth.

   Atlanta is not a picture under the game. It is fibre in the same cloth the
   game is woven into: water, rail and road are threads already laid, and what
   anybody draws today passes among them.

   Two passes, and the difference between them is the whole visual argument.

     1. THE CITY, woven into paper and never touched by who you are. Every
        road, every creek, the Connector, your block. It is drawn once into an
        offscreen cloth and only rewoven when the camera has really moved.

     2. THE GROUND THIS BEING CAN USE, lifted out of that cloth. A live thread
        opens a channel of bare paper around itself and lies in it at full
        strength; the city it lies across is still entirely there, just set
        back a step.

   So becoming something else never hides Atlanta — it changes which of Atlanta
   is raised and which is pressed flat. Raised and flat is a different thing
   from present and absent, and it looks like a different thing.

   Nothing here labels anything. A thread that carries you blooms, a thread
   that drags on you is broken by the paper showing through, and ground that is
   not yours is simply not lifted. You find out by going. */

import { GROUND } from "./ground.data.js";
import {
  View, sx, sy, worldSize, viewBounds, clamp, lerp, ease, hash01,
  mercX, mercY, pxPerM,
} from "./geo.js";
import {
  G, edgesInBox, CLS_MOTORWAY, CLS_PRIMARY, CLS_SECONDARY, CLS_RAIL, CLS_MARK,
} from "./graph.js";
import { S, on } from "./state.js";

const PAPER = "#efeadd", PAPER_LIT = "#f7f3e8";

/* How the city is inked when it is nobody's in particular. These are read
   through the veil, so they are stronger here than they end up on screen. */
const CITY = [
  /* CLS_MOTORWAY  */ { col: "#3b423b", w: [1.3, 3.6], a: 0.82, gap: 2.6, met: 0.92, bed: 0.09 },
  /* CLS_PRIMARY   */ { col: "#4b524a", w: [1.0, 2.7], a: 0.72, gap: 2.0, met: 0.88, bed: 0.07 },
  /* CLS_SECONDARY */ { col: "#5e655c", w: [0.65, 1.9], a: 0.58, gap: 1.3, met: 0.78, bed: 0 },
  /* CLS_RAIL      */ { col: "#6e736d", w: [0.6, 1.5], a: 0.52, gap: 0.0, met: 0.0, stitch: 1 },
];
/* laid weakest first, so the interstate surfaces through everything */
const CITY_ORDER = [CLS_RAIL, CLS_SECONDARY, CLS_PRIMARY, CLS_MOTORWAY];

const WATER = { col: "#78a5ad", w: [1.6, 6.0], a: 0.66 };
const BOUND = { col: "#9a9083", w: [0.6, 1.1], a: 0.24 };

/* how far back the city sits when it is not yours */
const VEIL = 0.34, VEIL_TURN = 0.56, TURN_MS = 760;

/* the margin of extra cloth woven either side of the screen, in CSS px, so
   that panning is a blit and not a reweave */
const MARGIN = 168;

let LAYERS = {}, PLACES = [], WATER_RUNS = [], BOUND_RUNS = [];

/* ============================================================
   the encoded city
   ============================================================ */
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

/* chop a polyline into short runs with tight boxes, so that at street zoom the
   cloth only ever looks at the handful of fibres actually under the screen */
function runsOf(lines, span = 20) {
  const runs = [];
  if (!lines) return runs;
  for (let li = 0; li < lines.length; li++) {
    const p = lines[li];
    const np = p.length / 2;
    for (let s = 0; s < np - 1; s += span) {
      const e = Math.min(np - 1, s + span);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = s; i <= e; i++) {
        const x = p[i * 2], y = p[i * 2 + 1];
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      runs.push({ p, s, e, x0, y0, x1, y1, seed: (li * 7919 + s * 131) % 99991 });
    }
  }
  return runs;
}

/* ============================================================
   PAPER — correlated grain, so ink has something to sit in
   ============================================================ */
const PAPER_TILE = 168;
let paperTile = null, paperPat = null;
function makePaper() {
  const s = PAPER_TILE, L = 42, c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  const lat = new Float32Array((L + 1) * (L + 1));
  for (let i = 0; i <= L; i++) for (let j = 0; j <= L; j++) lat[i * (L + 1) + j] = hash01(i * 131 + j * 977 + 7);
  const im = g.createImageData(s, s), k = s / L, d = im.data;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const fx = x / k, fy = y / k;
      const x0 = fx | 0, y0 = fy | 0;
      let tx = fx - x0, ty = fy - y0;
      const a = lat[y0 * (L + 1) + x0], b = lat[y0 * (L + 1) + x0 + 1];
      const cc = lat[(y0 + 1) * (L + 1) + x0], dd = lat[(y0 + 1) * (L + 1) + x0 + 1];
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const nv = (a + (b - a) * tx) * (1 - ty) + (cc + (dd - cc) * tx) * ty;
      const fine = hash01(x * 7919 + y * 104729);
      /* warp and weft: the tooth of a cloth, not the tooth of a stone */
      const weave = Math.sin(x * 1.5708) * 1.5 + Math.sin(y * 1.5708) * 1.1
        + Math.sin((x + y) * 0.19) * 1.4;
      /* the paper of this game, not a grey: warm, and it varies */
      const v = 230 + nv * 15 + fine * 7 + weave;
      const o = (y * s + x) * 4;
      d[o] = v + 7; d[o + 1] = v + 1; d[o + 2] = v - 13; d[o + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

/* Cloth is not one tone. Under the tooth there are wide soft stains that belong
   to the city rather than to the screen, so they grow when you zoom in — the
   ground has depth to fall into. */
const WASH_TILE = 128, WASH_WORLD = 1 / 4096;
let washTile = null, washPat = null;
function makeWash() {
  const s = WASH_TILE, L = 8, c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  const lat = new Float32Array((L + 1) * (L + 1));
  for (let i = 0; i <= L; i++) for (let j = 0; j <= L; j++) {
    lat[i * (L + 1) + j] = hash01(i * 313 + (j % L) * 71 + 3) * (i === L || j === L ? 1 : 1);
  }
  /* wrap the lattice so the stain has no seam */
  for (let i = 0; i <= L; i++) { lat[i * (L + 1) + L] = lat[i * (L + 1)]; lat[L * (L + 1) + i] = lat[i]; }
  lat[L * (L + 1) + L] = lat[0];
  const im = g.createImageData(s, s), k = s / L, d = im.data;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const fx = x / k, fy = y / k;
      const x0 = fx | 0, y0 = fy | 0;
      let tx = fx - x0, ty = fy - y0;
      const a = lat[y0 * (L + 1) + x0], b = lat[y0 * (L + 1) + x0 + 1];
      const cc = lat[(y0 + 1) * (L + 1) + x0], dd = lat[(y0 + 1) * (L + 1) + x0 + 1];
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const nv = (a + (b - a) * tx) * (1 - ty) + (cc + (dd - cc) * tx) * ty;
      const o = (y * s + x) * 4;
      d[o] = 150; d[o + 1] = 128; d[o + 2] = 92;
      d[o + 3] = Math.round(6 + nv * 26);
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

/* ============================================================
   THREADS — a fibre is a ribbon, not a slab
   ============================================================ */
let _tx = new Float64Array(4096), _ty = new Float64Array(4096);
let _ux = new Float64Array(4096), _uy = new Float64Array(4096);
let _cum = new Float64Array(4096);
let _seed = 0;
function room(n) {
  if (n <= _tx.length) return;
  const s = 1 << Math.ceil(Math.log2(n));
  _tx = new Float64Array(s); _ty = new Float64Array(s);
  _ux = new Float64Array(s); _uy = new Float64Array(s); _cum = new Float64Array(s);
}

/* A fibre only reads as spun if it varies over a distance the eye can see, so
   the variation is measured in screen pixels — and a long straight run gets
   points of its own to vary at. */
const SPUN = 19;
function densify(n) {
  if (n < 2) return n;
  let need = 1;
  for (let i = 0; i < n - 1; i++) {
    const d = Math.hypot(_tx[i + 1] - _tx[i], _ty[i + 1] - _ty[i]);
    need += Math.min(20, Math.max(1, Math.round(d / SPUN)));
  }
  if (need <= n) return n;
  room(need + 4);
  let m = 0;
  for (let i = 0; i < n - 1; i++) {
    const x0 = _tx[i], y0 = _ty[i], x1 = _tx[i + 1], y1 = _ty[i + 1];
    const k = Math.min(20, Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / SPUN)));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      _ux[m] = x0 + (x1 - x0) * t; _uy[m] = y0 + (y1 - y0) * t; m++;
    }
  }
  _ux[m] = _tx[n - 1]; _uy[m] = _ty[n - 1]; m++;
  for (let i = 0; i < m; i++) { _tx[i] = _ux[i]; _ty[i] = _uy[i]; }
  return m;
}

function halfWidth(t, u, w, tapA, tapB) {
  let ends = 1;
  if (tapA) ends *= Math.pow(clamp(t / 0.22, 0, 1), 0.7);
  if (tapB) ends *= Math.pow(clamp((1 - t) / 0.22, 0, 1), 0.7);
  if (tapA || tapB) ends = Math.min(1, ends + 0.06);
  const slow = hash01(_seed + Math.floor(u)) - 0.5;
  const slow2 = hash01(_seed + 91 + Math.floor(u * 0.37)) - 0.5;
  return w * 0.5 * ends * (1 + slow * 0.26 + slow2 * 0.17) + 0.15;
}

/* the offset outline of a spun fibre: it swells and thins down its length */
function ribbon(c, n, w, tapA, tapB) {
  let total = 0;
  _cum[0] = 0;
  for (let i = 1; i < n; i++) {
    total += Math.hypot(_tx[i] - _tx[i - 1], _ty[i] - _ty[i - 1]);
    _cum[i] = total;
  }
  const k = 1 / SPUN;
  c.beginPath();
  let i, hw, ax, ay, len;
  for (i = 0; i < n; i++) {
    const t = n < 2 ? 1 : i / (n - 1);
    hw = halfWidth(t, _cum[i] * k, w, tapA, tapB);
    ax = _tx[Math.min(i + 1, n - 1)] - _tx[Math.max(i - 1, 0)];
    ay = _ty[Math.min(i + 1, n - 1)] - _ty[Math.max(i - 1, 0)];
    len = Math.hypot(ax, ay) || 1;
    const nx = -ay / len, ny = ax / len;
    if (i === 0) c.moveTo(_tx[i] + nx * hw, _ty[i] + ny * hw);
    else c.lineTo(_tx[i] + nx * hw, _ty[i] + ny * hw);
  }
  for (i = n - 1; i >= 0; i--) {
    const t = n < 2 ? 1 : i / (n - 1);
    hw = halfWidth(t, _cum[i] * k, w, tapA, tapB);
    ax = _tx[Math.min(i + 1, n - 1)] - _tx[Math.max(i - 1, 0)];
    ay = _ty[Math.min(i + 1, n - 1)] - _ty[Math.max(i - 1, 0)];
    len = Math.hypot(ax, ay) || 1;
    const nx = -ay / len, ny = ax / len;
    c.lineTo(_tx[i] - nx * hw, _ty[i] - ny * hw);
  }
  c.closePath();
}

function trace(c, n) {
  c.moveTo(_tx[0], _ty[0]);
  for (let i = 1; i < n; i++) c.lineTo(_tx[i], _ty[i]);
}

/* ============================================================
   CHAINS — the graph, read back as corridors

   The graph is the city, one short segment at a time. Nothing is beautiful one
   segment at a time, so the segments are followed through their junctions into
   corridors that can be spun as a single fibre. Every edge belongs to exactly
   one corridor, and a corridor remembers which way round each of its edges
   runs, because for RAIN that is the difference between a road and a wall.
   ============================================================ */
let CHAINS = [];
const CH_CELL = 1 / 16384;
const chainCells = new Map();
const ckey = (cx, cy) => cx * 2097152 + cy;
let chStamp = null, chGen = 0;

function buildChains() {
  const used = new Uint8Array(G.e);
  const MAXE = 40;
  for (let e0 = 0; e0 < G.e; e0++) {
    if (used[e0]) continue;
    const cls = G.ec[e0];
    if (cls > CLS_RAIL) continue;    /* what players lay is dynamic, not cloth */
    used[e0] = 1;
    const nodes = [G.ea[e0], G.eb[e0]], edges = [e0];
    grow(nodes, edges, cls, used, MAXE, true);
    grow(nodes, edges, cls, used, MAXE, false);
    const np = nodes.length;
    const px = new Float64Array(np), py = new Float64Array(np);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < np; i++) {
      const n = nodes[i];
      px[i] = G.nx[n]; py[i] = G.ny[n];
      if (px[i] < x0) x0 = px[i]; if (px[i] > x1) x1 = px[i];
      if (py[i] < y0) y0 = py[i]; if (py[i] > y1) y1 = py[i];
    }
    const ee = Int32Array.from(edges), fw = new Uint8Array(edges.length);
    let w = 0;
    for (let i = 0; i < edges.length; i++) {
      fw[i] = G.ea[edges[i]] === nodes[i] ? 1 : 0;
      if (G.ewidth[edges[i]] > w) w = G.ewidth[edges[i]];
    }
    CHAINS.push({
      cls, np, px, py, e: ee, fw, wide: w, x0, y0, x1, y1,
      seed: (CHAINS.length * 2654435761) % 99991, soff: -1,
    });
  }
  /* one coarse net over the corridors; the screen asks it what it covers */
  for (let i = 0; i < CHAINS.length; i++) {
    const ch = CHAINS[i];
    const cx0 = Math.floor(ch.x0 / CH_CELL), cx1 = Math.floor(ch.x1 / CH_CELL);
    const cy0 = Math.floor(ch.y0 / CH_CELL), cy1 = Math.floor(ch.y1 / CH_CELL);
    for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
      const k = ckey(cx, cy);
      let b = chainCells.get(k);
      if (!b) chainCells.set(k, b = []);
      b.push(i);
    }
  }
  chStamp = new Int32Array(CHAINS.length);
}

/* follow the straightest continuation of the same kind of ground */
function grow(nodes, edges, cls, used, cap, atEnd) {
  for (;;) {
    if (edges.length >= cap) return;
    const tip = atEnd ? nodes[nodes.length - 1] : nodes[0];
    const prev = atEnd ? nodes[nodes.length - 2] : nodes[1];
    const hx = G.nx[tip] - G.nx[prev], hy = G.ny[tip] - G.ny[prev];
    const hl = Math.hypot(hx, hy) || 1;
    let best = -1, bestDot = 0.5, bestOther = -1;
    const adj = G.adj[tip];
    for (let i = 0; i < adj.length; i++) {
      const e = adj[i];
      if (used[e] || G.ec[e] !== cls) continue;
      const other = G.ea[e] === tip ? G.eb[e] : G.ea[e];
      if (other === prev) continue;
      const dx = G.nx[other] - G.nx[tip], dy = G.ny[other] - G.ny[tip];
      const dl = Math.hypot(dx, dy) || 1;
      const dot = (hx * dx + hy * dy) / (hl * dl);
      if (dot > bestDot) { bestDot = dot; best = e; bestOther = other; }
    }
    if (best < 0) return;
    used[best] = 1;
    if (atEnd) { nodes.push(bestOther); edges.push(best); }
    else { nodes.unshift(bestOther); edges.unshift(best); }
  }
}

function chainsInView(b, out) {
  out.length = 0;
  if (!chStamp) return out;
  const gen = ++chGen;
  const cx0 = Math.floor(b.x0 / CH_CELL), cx1 = Math.floor(b.x1 / CH_CELL);
  const cy0 = Math.floor(b.y0 / CH_CELL), cy1 = Math.floor(b.y1 / CH_CELL);
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) {
      const bucket = chainCells.get(ckey(cx, cy));
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const ci = bucket[i];
        if (chStamp[ci] === gen) continue;
        chStamp[ci] = gen;
        const ch = CHAINS[ci];
        if (ch.x1 < b.x0 || ch.x0 > b.x1 || ch.y1 < b.y0 || ch.y0 > b.y1) continue;
        out.push(ci);
      }
    }
  }
  return out;
}

/* ============================================================
   init
   ============================================================ */
export function init() {
  for (const k in GROUND.layers) LAYERS[k] = decode(GROUND.layers[k]);
  WATER_RUNS = runsOf(LAYERS.water, 14);
  BOUND_RUNS = runsOf(LAYERS.boundary, 24);
  PLACES = (GROUND.places || []).map((p) => ({
    name: p[0], kind: p[1], x: mercX(p[2] / 1e5), y: mercY(p[3] / 1e5),
  }));
  paperTile = makePaper();
  washTile = makeWash();
  buildChains();

  /* whatever changes what the ground is worth, changes what is lifted */
  const restate = () => { kGen++; if (kGen > 2e9) kGen = 1; };
  on("become", () => { restate(); turnAt = performance.now(); });
  on("journey", restate);
  on("mark", restate);
  on("ghost", restate);
  on("loaded", restate);
  on("resize", () => { baseDirty = true; });
}

/* ============================================================
   what this being makes of a piece of ground

   Cached against a generation, because it only changes when the being changes
   or when traffic changes what the ground is worth. Both directions are asked:
   ground you could only leave by is still ground you can use.
   ============================================================ */
let kGen = 1, kStamp = null, kVal = null;
function kindAt(e) {
  if (!kStamp || kStamp.length < G.e) {
    const ns = new Int32Array(Math.max(4096, G.e * 2));
    const nv = new Uint8Array(ns.length);
    if (kStamp) { ns.set(kStamp); nv.set(kVal); }
    kStamp = ns; kVal = nv;
  }
  if (kStamp[e] === kGen) return kVal[e];
  const being = S.being;
  const a = being.read(e, true), b = being.read(e, false);
  const ra = a.live ? a.ratio : Infinity, rb = b.live ? b.ratio : Infinity;
  const r = ra <= rb ? a : b;
  const k = !r.live ? 0 : r.kind === "ladder" ? 2 : r.kind === "chute" ? 3 : 1;
  kStamp[e] = kGen; kVal[e] = k;
  return k;
}

/* ============================================================
   PASS 1 — the city, woven once
   ============================================================ */
let base = null, bctx = null, baseDirty = true;
let bx = 0, by = 0, bz = -1, bw = 0, bh = 0, bdpr = 0;
const _vis = [];

function inkWidth(cls, metres, zt, ppm) {
  const st = CITY[cls];
  const w = lerp(st.w[0], st.w[1], zt);
  return st.met ? Math.max(w, metres * ppm * st.met) : w;
}

function renderBase(ctx) {
  const M = MARGIN, dpr = View.dpr;
  const w = Math.round((View.w + M * 2) * dpr), h = Math.round((View.h + M * 2) * dpr);
  if (!base) { base = document.createElement("canvas"); bctx = base.getContext("2d", { alpha: false }); }
  if (base.width !== w || base.height !== h) { base.width = w; base.height = h; }
  const c = bctx;
  const ws = worldSize();

  /* Paper first, and it belongs to the ground rather than to the screen: the
     tooth is anchored in the city, so panning slides the cloth, not the grain.
     It is laid one device pixel to one grain of tooth, which is both the right
     texture and the only fill the machine can do at speed. */
  if (!paperPat) paperPat = c.createPattern(paperTile, "repeat");
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  const ax = ((View.x * ws - View.w / 2 - M) * dpr) % PAPER_TILE;
  const ay = ((View.y * ws - View.h / 2 - M) * dpr) % PAPER_TILE;
  const ox = -Math.round(((ax % PAPER_TILE) + PAPER_TILE) % PAPER_TILE);
  const oy = -Math.round(((ay % PAPER_TILE) + PAPER_TILE) % PAPER_TILE);
  c.translate(ox, oy);
  c.fillStyle = paperPat || PAPER;
  c.fillRect(0, 0, w - ox + PAPER_TILE, h - oy + PAPER_TILE);

  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.translate(M, M);

  /* the wide soft stains, laid as whole tiles rather than resampled per pixel */
  const wt = ws * WASH_WORLD;
  if (washTile && wt > 24) {
    const x0 = -M - (((View.x * ws - View.w / 2 - M) % wt) + wt) % wt;
    const y0 = -M - (((View.y * ws - View.h / 2 - M) % wt) + wt) % wt;
    for (let x = x0; x < View.w + M; x += wt) {
      for (let y = y0; y < View.h + M; y += wt) c.drawImage(washTile, x, y, wt, wt);
    }
  }

  c.lineCap = "round";
  c.lineJoin = "round";

  const zt = clamp((View.z - 10.5) / 6.5, 0, 1);
  const ppm = pxPerM();
  const b = viewBounds(M + 60);

  drawBoundary(c, b, zt);
  drawWater(c, b, zt);

  const vis = chainsInView(b, _vis);
  /* how full is this ground? a crowded screen is woven plainly, or the weave
     costs more than it says */
  let load = 0;
  for (let i = 0; i < vis.length; i++) {
    const ch = CHAINS[vis[i]];
    if (skipClass(ch.cls)) continue;
    load += ch.np;
  }
  const fine = load < 2600;

  for (const cls of CITY_ORDER) {
    if (skipClass(cls)) continue;
    const st = CITY[cls];
    let any = false;
    /* a strong fibre is bedded in the cloth before it is drawn on it */
    if (fine && st.bed) {
      c.globalAlpha = st.bed;
      c.strokeStyle = st.col;
      for (let i = 0; i < vis.length; i++) {
        const ch = CHAINS[vis[i]];
        if (ch.cls !== cls) continue;
        const n = project(ch);
        if (n < 2) continue;
        c.lineWidth = inkWidth(cls, ch.wide, zt, ppm) * 3.1;
        c.beginPath();
        trace(c, n);
        c.stroke();
      }
    }
    /* the channel of bare paper that lets one fibre pass over another */
    if (fine && st.gap > 0) {
      c.globalAlpha = 0.9;
      c.strokeStyle = PAPER_LIT;
      for (let i = 0; i < vis.length; i++) {
        const ch = CHAINS[vis[i]];
        if (ch.cls !== cls) continue;
        const n = project(ch);
        if (n < 2) continue;
        any = true;
        c.lineWidth = inkWidth(cls, ch.wide, zt, ppm) + st.gap;
        c.beginPath();
        trace(c, n);
        c.stroke();
      }
    }
    c.globalAlpha = st.a;
    c.strokeStyle = st.col;
    c.fillStyle = st.col;
    c.beginPath();
    for (let i = 0; i < vis.length; i++) {
      const ch = CHAINS[vis[i]];
      if (ch.cls !== cls) continue;
      let n = project(ch);
      if (n < 2) continue;
      any = true;
      const lw = inkWidth(cls, ch.wide, zt, ppm);
      if (fine) {
        _seed = ch.seed;
        n = densify(n);
        ribbon(c, n, lw, 0, 0);
        c.fill();
        c.beginPath();
      } else {
        c.lineWidth = lw;
        trace(c, n);
        c.stroke();
        c.beginPath();
      }
    }
    /* the sleepers: paper shows through the rail at intervals */
    if (any && st.stitch) {
      const lw = lerp(st.w[0], st.w[1], zt);
      if (lw > 0.75) {
        c.globalAlpha = st.a * 0.85;
        c.strokeStyle = PAPER_LIT;
        c.lineWidth = lw * 0.72;
        c.setLineDash([lw * 0.9, lw * 2.8]);
        c.beginPath();
        for (let i = 0; i < vis.length; i++) {
          const ch = CHAINS[vis[i]];
          if (ch.cls !== cls) continue;
          const n = project(ch);
          if (n < 2) continue;
          trace(c, n);
        }
        c.stroke();
        c.setLineDash([]);
      }
    }
  }

  c.globalAlpha = 1;
  bx = View.x; by = View.y; bz = View.z; bw = View.w; bh = View.h; bdpr = dpr;
  baseDirty = false;
}

/* zoomed far enough out, the fine ground stops being information */
function skipClass(cls) {
  if (cls === CLS_RAIL && View.z < 11.5) return true;
  if (cls === CLS_SECONDARY && View.z < 11.2) return true;
  return false;
}

function project(ch) {
  room(ch.np);
  let n = 0, lx = -1e9, ly = -1e9;
  for (let i = 0; i < ch.np; i++) {
    const X = sx(ch.px[i]), Y = sy(ch.py[i]);
    if (n > 0 && Math.abs(X - lx) < 0.55 && Math.abs(Y - ly) < 0.55 && i < ch.np - 1) continue;
    _tx[n] = X; _ty[n] = Y; lx = X; ly = Y; n++;
  }
  return n;
}

function projectRun(r) {
  const np = r.e - r.s + 1;
  room(np);
  let n = 0, lx = -1e9, ly = -1e9;
  for (let i = r.s; i <= r.e; i++) {
    const X = sx(r.p[i * 2]), Y = sy(r.p[i * 2 + 1]);
    if (n > 0 && Math.abs(X - lx) < 0.55 && Math.abs(Y - ly) < 0.55 && i < r.e) continue;
    _tx[n] = X; _ty[n] = Y; lx = X; ly = Y; n++;
  }
  return n;
}

function drawWater(c, b, zt) {
  const lw = lerp(WATER.w[0], WATER.w[1], zt);
  /* the damp around a creek, so it reads before the line does */
  c.globalAlpha = 0.10;
  c.strokeStyle = WATER.col;
  c.lineWidth = lw * 3.4;
  c.beginPath();
  let any = false;
  for (const r of WATER_RUNS) {
    if (r.x1 < b.x0 || r.x0 > b.x1 || r.y1 < b.y0 || r.y0 > b.y1) continue;
    const n = projectRun(r);
    if (n < 2) continue;
    any = true;
    trace(c, n);
  }
  if (any) c.stroke();
  if (!any) return;
  c.globalAlpha = WATER.a;
  c.fillStyle = WATER.col;
  for (const r of WATER_RUNS) {
    if (r.x1 < b.x0 || r.x0 > b.x1 || r.y1 < b.y0 || r.y0 > b.y1) continue;
    let n = projectRun(r);
    if (n < 2) continue;
    _seed = r.seed;
    n = densify(n);
    ribbon(c, n, lw, 0, 0);
    c.fill();
  }
}

function drawBoundary(c, b, zt) {
  const lw = lerp(BOUND.w[0], BOUND.w[1], zt);
  c.globalAlpha = BOUND.a;
  c.strokeStyle = BOUND.col;
  c.lineWidth = lw;
  c.setLineDash([lw * 3.2, lw * 3.6]);
  c.beginPath();
  let any = false;
  for (const r of BOUND_RUNS) {
    if (r.x1 < b.x0 || r.x0 > b.x1 || r.y1 < b.y0 || r.y0 > b.y1) continue;
    const n = projectRun(r);
    if (n < 2) continue;
    any = true;
    trace(c, n);
  }
  if (any) c.stroke();
  c.setLineDash([]);
}

/* ============================================================
   PASS 2 — the ground this being can use, lifted out of the cloth
   ============================================================ */
let turnAt = 0;
/* runs, as parallel columns: corridor, first edge, last edge, what it is */
const _rCh = [], _rA = [], _rB = [], _rK = [];
let _rN = 0;
const _dyn = [];
let spx = new Float32Array(16384), spy = new Float32Array(16384);

function pool(n) {
  if (n <= spx.length) return;
  const s = 1 << Math.ceil(Math.log2(n));
  const nx = new Float32Array(s), ny = new Float32Array(s);
  nx.set(spx); ny.set(spy);
  spx = nx; spy = ny;
}

/* 0 dead, 1 plain, 2 ladder, 3 chute */
const KIND_COL = ["dead", "live", "ladder", "chute"];

function gather(vis) {
  _rN = 0;
  let live = 0, cur = 0;
  for (let vi = 0; vi < vis.length; vi++) {
    const ch = CHAINS[vis[vi]];
    ch.soff = -1;
    if (skipClass(ch.cls)) continue;
    const ne = ch.e.length;
    const before = _rN;
    let start = -1, kind = 0;
    for (let i = 0; i <= ne; i++) {
      const k = i < ne ? kindAt(ch.e[i]) : 0;
      if (k !== kind) {
        if (kind !== 0 && start >= 0) {
          _rCh[_rN] = ch; _rA[_rN] = start; _rB[_rN] = i - 1; _rK[_rN] = kind; _rN++;
          live += i - start;
        }
        start = k !== 0 ? i : -1;
        kind = k;
      }
    }
    if (_rN > before) {
      /* projected once, shared by every pass that wants this corridor */
      pool(cur + ch.np);
      ch.soff = cur;
      for (let i = 0; i < ch.np; i++) { spx[cur] = sx(ch.px[i]); spy[cur] = sy(ch.py[i]); cur++; }
    }
  }
  return live;
}

function loadRun(r) {
  const ch = _rCh[r], i0 = _rA[r];
  const n = _rB[r] - i0 + 2;
  room(n);
  const o = ch.soff + i0;
  for (let i = 0; i < n; i++) { _tx[i] = spx[o + i]; _ty[i] = spy[o + i]; }
  return n;
}

function drawLive(ctx, vis) {
  const being = S.being;
  if (!being) return;
  const c = ctx.c;
  const zt = clamp((View.z - 10.5) / 6.5, 0, 1);
  const ppm = pxPerM();
  const q = ctx.quality;

  const live = gather(vis);
  if (!live) { drawDynamic(ctx, zt, ppm, null); return; }
  const fine = live < 1500 && q > 0.55;

  /* how long since the board reorganised: the new ground arrives, it does not
     cut in */
  const k = turnAt ? clamp((performance.now() - turnAt) / TURN_MS, 0, 1) : 1;
  const rise = turnAt ? ease(0.3 + k * 0.7) : 1;
  if (k >= 1) turnAt = 0;

  c.lineCap = "round";
  c.lineJoin = "round";

  /* 1. the channel of bare paper. this is what makes live ground read as
        lying ON the city rather than mixed into it. */
  c.globalAlpha = 0.66 * rise;
  c.strokeStyle = PAPER_LIT;
  for (let r = 0; r < _rN; r++) {
    const n = loadRun(r);
    if (n < 2) continue;
    c.lineWidth = liveWidth(_rCh[r], _rK[r], zt, ppm) + (fine ? 2.9 : 2.0);
    c.beginPath();
    trace(c, n);
    c.stroke();
  }

  /* 2. every live thread sits in a haze of its own fibre, and what carries you
        blooms out of the cloth altogether */
  if (fine) {
    for (let r = 0; r < _rN; r++) {
      const kind = _rK[r];
      const n = loadRun(r);
      if (n < 2) continue;
      const w = liveWidth(_rCh[r], kind, zt, ppm);
      c.globalAlpha = (kind === 2 ? 0.15 : 0.07) * rise;
      c.strokeStyle = being.ink[KIND_COL[kind]];
      c.lineWidth = w * (kind === 2 ? 3.8 : 2.5);
      c.beginPath();
      trace(c, n);
      c.stroke();
    }
  }

  /* 3. the threads themselves, dearest first so the cheap ground sits on top */
  for (const kind of [3, 1, 2]) {
    const col = being.ink[KIND_COL[kind]];
    c.strokeStyle = col;
    c.fillStyle = col;
    c.globalAlpha = (kind === 3 ? 0.62 : kind === 2 ? 1 : 0.95) * rise;
    for (let r = 0; r < _rN; r++) {
      if (_rK[r] !== kind) continue;
      let n = loadRun(r);
      if (n < 2) continue;
      const ch = _rCh[r];
      const lw = liveWidth(ch, kind, zt, ppm);
      if (fine) {
        /* a thread frays out where the ground stops being yours */
        _seed = ch.seed + kind * 977;
        n = densify(n);
        ribbon(c, n, lw, _rA[r] > 0 ? 1 : 0, _rB[r] < ch.e.length - 1 ? 1 : 0);
        c.fill();
      } else {
        c.lineWidth = lw;
        c.beginPath();
        trace(c, n);
        c.stroke();
      }
    }
    /* what drags on you is worn thin: the paper keeps coming back through it */
    if (kind === 3 && fine) {
      c.globalAlpha = 0.5 * rise;
      c.strokeStyle = PAPER_LIT;
      for (let r = 0; r < _rN; r++) {
        if (_rK[r] !== 3) continue;
        const n = loadRun(r);
        if (n < 2) continue;
        const lw = liveWidth(_rCh[r], 3, zt, ppm);
        c.lineWidth = lw * 0.5;
        c.setLineDash([lw * 0.45, lw * 1.15]);
        c.lineDashOffset = (_rCh[r].seed % 7) * 0.7;
        c.beginPath();
        trace(c, n);
        c.stroke();
      }
      c.setLineDash([]);
      c.lineDashOffset = 0;
    }
  }

  drawDynamic(ctx, zt, ppm, rise);
  c.globalAlpha = 1;
}

function liveWidth(ch, kind, zt, ppm) {
  const cls = ch.cls === undefined ? CLS_SECONDARY : ch.cls;
  const w = inkWidth(Math.min(cls, CLS_RAIL), ch.wide, zt, ppm);
  const s = kind === 2 ? 1.75 : kind === 3 ? 1.05 : 1.25;
  return Math.max(1.15, w * s);
}

/* Ground the players laid is not in the cloth — it arrives during the game, so
   it is asked for straight from the index every frame. There is never much of
   it on one screen, and it is the ground that matters most. */
function drawDynamic(ctx, zt, ppm, rise) {
  const c = ctx.c, being = S.being;
  const b = viewBounds(40);
  edgesInBox(b.x0, b.y0, b.x1, b.y1, _dyn, (e) => G.ec[e] >= CLS_MARK);
  if (!_dyn.length) return;
  const r = rise == null ? 1 : rise;
  c.lineCap = "round";
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < _dyn.length; i++) {
      const e = _dyn[i];
      const kind = kindAt(e);
      if (!kind) continue;
      const a = G.ea[e], z = G.eb[e];
      const w = Math.max(1.6, Math.max(lerp(1.1, 2.6, zt), G.ewidth[e] * ppm * 0.8)) *
        (kind === 2 ? 1.8 : kind === 3 ? 1.05 : 1.3);
      c.beginPath();
      c.moveTo(sx(G.nx[a]), sy(G.ny[a]));
      c.lineTo(sx(G.nx[z]), sy(G.ny[z]));
      if (pass === 0) {
        c.globalAlpha = 0.8 * r;
        c.strokeStyle = PAPER_LIT;
        c.lineWidth = w + 3.4;
      } else {
        c.globalAlpha = (kind === 3 ? 0.85 : 1) * r;
        c.strokeStyle = being.ink[KIND_COL[kind]];
        c.lineWidth = w;
      }
      c.stroke();
    }
  }
  c.globalAlpha = 1;
}

/* ============================================================
   PLACES — you always know where you are
   ============================================================ */
const _drawn = [];
function drawPlaces(c) {
  if (View.z < 11.0 || !PLACES.length) return;
  const b = viewBounds(0);
  _drawn.length = 0;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineJoin = "round";
  for (const p of PLACES) {
    if (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1) continue;
    const big = p.kind === "city";
    if (!big && View.z < 12.4) continue;
    const X = sx(p.x), Y = sy(p.y);
    let clash = false;
    for (let i = 0; i < _drawn.length; i += 2) {
      if (Math.abs(_drawn[i] - X) < 96 && Math.abs(_drawn[i + 1] - Y) < 22) { clash = true; break; }
    }
    if (clash) continue;
    _drawn.push(X, Y);
    c.font = `italic ${big ? 15 : 11.5}px Georgia, serif`;
    /* the name lifts off the cloth the same way a live thread does */
    c.globalAlpha = 0.85;
    c.strokeStyle = PAPER;
    c.lineWidth = 4;
    c.strokeText(p.name, X, Y);
    c.globalAlpha = big ? 0.66 : 0.5;
    c.fillStyle = "#1d201d";
    c.fillText(p.name, X, Y);
  }
  c.globalAlpha = 1;
}

/* ============================================================
   the frame
   ============================================================ */
export function draw(ctx) {
  const c = ctx.c;
  const ws = worldSize();

  const moved = Math.abs((bx - View.x) * ws), movedY = Math.abs((by - View.y) * ws);
  if (baseDirty || bz !== View.z || bw !== View.w || bh !== View.h || bdpr !== View.dpr ||
      moved > MARGIN - 8 || movedY > MARGIN - 8) {
    renderBase(ctx);
  }

  /* the city, blitted whole, in one opaque copy */
  const ox = -MARGIN + (bx - View.x) * ws, oy = -MARGIN + (by - View.y) * ws;
  c.globalAlpha = 1;
  c.drawImage(base, ox, oy, base.width / bdpr, base.height / bdpr);

  /* and set back a step, because it is not yours */
  const k = turnAt ? clamp((performance.now() - turnAt) / TURN_MS, 0, 1) : 1;
  c.globalAlpha = turnAt ? lerp(VEIL_TURN, VEIL, ease(k)) : VEIL;
  c.fillStyle = PAPER;
  c.fillRect(0, 0, View.w, View.h);
  c.globalAlpha = 1;

  const b = viewBounds(60);
  drawLive(ctx, chainsInView(b, _vis));
  drawPlaces(c);
  c.globalAlpha = 1;
}
