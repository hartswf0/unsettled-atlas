/* PERSPECTIVAL GROUND — the cloth.

   Atlanta is not a picture under the game. It is fibre in the same cloth the
   game is woven into: water, rail and road are threads already laid, and what
   anybody draws today passes among them.

   Two passes, and the difference between them is the whole visual argument.

     1. THE CITY, woven into paper and never touched by who you are. Every
        road, every creek, the Connector, your block. It is woven once into an
        offscreen cloth and only rewoven when the camera has really moved.

     2. THE GROUND THIS BEING CAN USE, lifted out of that cloth. A live thread
        opens a channel of bare paper around itself and lies in it at full
        strength; the city it lies across is still entirely there, just set
        back a step.

   So becoming something else never hides Atlanta — it changes which of Atlanta
   is raised and which is pressed flat. Raised and flat is a different thing
   from present and absent, and it looks like a different thing.

   Nothing here labels anything. A thread that carries you blooms, a thread
   that drags on you is worn through by the paper coming back, and ground that
   is not yours is simply not lifted. You find out by going. */

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

/* How the city is inked when it is nobody's in particular. It is read through
   the veil, so it is stronger here than it ends up on the screen. */
const CITY = [
  /* CLS_MOTORWAY  */ { col: "#3b423b", w: [1.3, 3.6], a: 0.84, gap: 2.6, met: 0.92, bed: 0.10 },
  /* CLS_PRIMARY   */ { col: "#4b524a", w: [1.0, 2.7], a: 0.74, gap: 2.0, met: 0.88, bed: 0.07 },
  /* CLS_SECONDARY */ { col: "#5e655c", w: [0.65, 1.9], a: 0.60, gap: 1.3, met: 0.78, bed: 0 },
  /* CLS_RAIL      */ { col: "#6e736d", w: [0.6, 1.5], a: 0.52, gap: 0.0, met: 0, stitch: 1 },
];
/* how wide these pieces of ground are on the earth, in metres */
const CLS_M = [14, 10, 7, 4];
/* laid weakest first, so the interstate surfaces through everything */
const CITY_ORDER = [CLS_RAIL, CLS_SECONDARY, CLS_PRIMARY, CLS_MOTORWAY];

const WATER = { col: "#6f9fa8", w: [1.8, 6.4], a: 0.78 };
const BOUND = { col: "#9a9083", w: [0.6, 1.1], a: 0.24 };

/* how far back the city sits when it is not yours */
const VEIL = 0.34, VEIL_TURN = 0.56, TURN_MS = 760;

/* the margin of extra cloth woven either side of the screen, in CSS px, so
   that panning is a blit and not a reweave */
const MARGIN = 64;

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
   PAPER

   Correlated grain so that ink has something to sit in, warp and weft so that
   it is cloth and not stone, and under both of those the wide soft stains that
   stop the ground being one flat tone. All three live in one tile, because a
   whole screen of cloth has to be laid in a single fill.
   ============================================================ */
const PAPER_TILE = 384;
let paperTile = null, sheet = null;
const sheets = new Map();

/* one sheet of made paper, a whole screen and a tile wider, kept between frames */
function ensureSheet(w, h) {
  const key = w + "x" + h;
  sheet = sheets.get(key);
  if (sheet) return;
  sheet = document.createElement("canvas");
  sheet.width = w + PAPER_TILE; sheet.height = h + PAPER_TILE;
  const s = sheet.getContext("2d", { alpha: false });
  s.fillStyle = s.createPattern(paperTile, "repeat") || PAPER;
  s.fillRect(0, 0, sheet.width, sheet.height);
  if (sheets.size > 2) sheets.delete(sheets.keys().next().value);
  sheets.set(key, sheet);
}

/* value noise on a lattice that wraps, so the tile has no seam */
function wrapNoise(L, salt) {
  const lat = new Float32Array((L + 1) * (L + 1));
  for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) lat[i * (L + 1) + j] = hash01(i * 131 + j * 977 + salt);
  for (let i = 0; i < L; i++) { lat[i * (L + 1) + L] = lat[i * (L + 1)]; lat[L * (L + 1) + i] = lat[i]; }
  lat[L * (L + 1) + L] = lat[0];
  return lat;
}
function sampleWrap(lat, L, s, x, y) {
  const k = s / L, fx = x / k, fy = y / k;
  const x0 = fx | 0, y0 = fy | 0;
  let tx = fx - x0, ty = fy - y0;
  const a = lat[y0 * (L + 1) + x0], b = lat[y0 * (L + 1) + x0 + 1];
  const c = lat[(y0 + 1) * (L + 1) + x0], d = lat[(y0 + 1) * (L + 1) + x0 + 1];
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

function makePaper() {
  const s = PAPER_TILE, c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  const tooth = wrapNoise(96, 7), stain = wrapNoise(6, 411), broad = wrapNoise(3, 53);
  const im = g.createImageData(s, s), d = im.data;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const t = sampleWrap(tooth, 96, s, x, y);
      const st = sampleWrap(stain, 6, s, x, y);
      const br = sampleWrap(broad, 3, s, x, y);
      const fine = hash01(x * 7919 + y * 104729) + hash01(x * 3079 + y * 6151 + 11) * 0.7;
      const weave = Math.sin(x * 1.5708) * 1.4 + Math.sin(y * 1.5708) * 1.0
        + Math.sin((x + y) * 0.19) * 1.2;
      /* the paper of this game, not a grey: warm, and it varies */
      const v = 231 + t * 12 + fine * 6 + weave - st * 10 - br * 8;
      const o = (y * s + x) * 4;
      d[o] = v + 7; d[o + 1] = v + 1; d[o + 2] = v - 13 - st * 4; d[o + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

/* ============================================================
   THE POOL

   Every fibre that reaches the screen is projected exactly once a frame into
   one flat pair of arrays, and every pass after that reads out of it. Nothing
   below ever calls sx()/sy() twice for the same point.
   ============================================================ */
let PX = new Float32Array(1 << 15), PY = new Float32Array(1 << 15);
let _cum = new Float32Array(1 << 12);
let pcur = 0, _seed = 0;

function poolRoom(n) {
  if (n <= PX.length) return;
  const s = 1 << Math.ceil(Math.log2(n));
  const nx = new Float32Array(s), ny = new Float32Array(s);
  nx.set(PX); ny.set(PY);
  PX = nx; PY = ny;
}
function cumRoom(n) { if (n > _cum.length) _cum = new Float32Array(1 << Math.ceil(Math.log2(n))); }

/* project a chain of the graph; returns where it landed in the pool */
function poolChain(ch) {
  poolRoom(pcur + ch.np + 2);
  const o = pcur;
  let n = 0, lx = -1e9, ly = -1e9;
  for (let i = 0; i < ch.np; i++) {
    const X = sx(ch.px[i]), Y = sy(ch.py[i]);
    if (n > 0 && i < ch.np - 1 && Math.abs(X - lx) < 0.5 && Math.abs(Y - ly) < 0.5) continue;
    PX[o + n] = X; PY[o + n] = Y; lx = X; ly = Y; n++;
  }
  pcur = o + n;
  return n;
}

/* project a run of one of the drawn city layers */
function poolRun(r) {
  poolRoom(pcur + (r.e - r.s) + 3);
  const o = pcur;
  let n = 0, lx = -1e9, ly = -1e9;
  for (let i = r.s; i <= r.e; i++) {
    const X = sx(r.p[i * 2]), Y = sy(r.p[i * 2 + 1]);
    if (n > 0 && i < r.e && Math.abs(X - lx) < 0.5 && Math.abs(Y - ly) < 0.5) continue;
    PX[o + n] = X; PY[o + n] = Y; lx = X; ly = Y; n++;
  }
  pcur = o + n;
  return n;
}

/* A fibre only reads as spun if it varies over a distance the eye can see, so
   the variation is measured in screen pixels — and a long straight run is
   given points of its own to vary at. Written past the end of the pool, where
   it can be overwritten by the next fibre that needs it. */
const SPUN = 19;
function densify(off, n, at) {
  if (n < 2) return n;
  let need = 1;
  for (let i = 0; i < n - 1; i++) {
    need += Math.min(18, Math.max(1, Math.round(Math.hypot(PX[off + i + 1] - PX[off + i], PY[off + i + 1] - PY[off + i]) / SPUN)));
  }
  if (need <= n) {
    if (at !== off) for (let i = 0; i < n; i++) { PX[at + i] = PX[off + i]; PY[at + i] = PY[off + i]; }
    return n;
  }
  poolRoom(at + need + 2);
  let m = 0;
  for (let i = 0; i < n - 1; i++) {
    const x0 = PX[off + i], y0 = PY[off + i], x1 = PX[off + i + 1], y1 = PY[off + i + 1];
    const k = Math.min(18, Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / SPUN)));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      PX[at + m] = x0 + (x1 - x0) * t; PY[at + m] = y0 + (y1 - y0) * t; m++;
    }
  }
  PX[at + m] = PX[off + n - 1]; PY[at + m] = PY[off + n - 1]; m++;
  return m;
}

/* ============================================================
   THREADS — a fibre is a ribbon, not a slab
   ============================================================ */
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
function ribbon(c, off, n, w, tapA, tapB) {
  cumRoom(n);
  let total = 0;
  _cum[0] = 0;
  for (let i = 1; i < n; i++) {
    total += Math.hypot(PX[off + i] - PX[off + i - 1], PY[off + i] - PY[off + i - 1]);
    _cum[i] = total;
  }
  const k = 1 / SPUN;
  let i, hw, ax, ay, len;
  for (i = 0; i < n; i++) {
    const t = n < 2 ? 1 : i / (n - 1);
    hw = halfWidth(t, _cum[i] * k, w, tapA, tapB);
    ax = PX[off + Math.min(i + 1, n - 1)] - PX[off + Math.max(i - 1, 0)];
    ay = PY[off + Math.min(i + 1, n - 1)] - PY[off + Math.max(i - 1, 0)];
    len = Math.hypot(ax, ay) || 1;
    if (i === 0) c.moveTo(PX[off] - ay / len * hw, PY[off] + ax / len * hw);
    else c.lineTo(PX[off + i] - ay / len * hw, PY[off + i] + ax / len * hw);
  }
  for (i = n - 1; i >= 0; i--) {
    const t = n < 2 ? 1 : i / (n - 1);
    hw = halfWidth(t, _cum[i] * k, w, tapA, tapB);
    ax = PX[off + Math.min(i + 1, n - 1)] - PX[off + Math.max(i - 1, 0)];
    ay = PY[off + Math.min(i + 1, n - 1)] - PY[off + Math.max(i - 1, 0)];
    len = Math.hypot(ax, ay) || 1;
    c.lineTo(PX[off + i] + ay / len * hw, PY[off + i] - ax / len * hw);
  }
  c.closePath();
}

function trace(c, off, n) {
  c.moveTo(PX[off], PY[off]);
  for (let i = 1; i < n; i++) c.lineTo(PX[off + i], PY[off + i]);
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
    CHAINS.push({
      cls, np, px, py, e: Int32Array.from(edges), x0, y0, x1, y1,
      seed: (CHAINS.length * 48271) % 99991, off: -1, n: 0,
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
        if (skipClass(ch.cls)) continue;
        out.push(ch);
      }
    }
  }
  return out;
}

/* zoomed far enough out, the fine ground stops being information */
function skipClass(cls) {
  if (cls === CLS_RAIL && View.z < 11.5) return true;
  if (cls === CLS_SECONDARY && View.z < 11.2) return true;
  return false;
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
  buildChains();

  /* whatever changes what the ground is worth changes what is lifted */
  const restate = () => { reachDirty = true; };
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
   or when traffic changes what the ground is worth. Both ways round are asked:
   ground you could only leave by is still ground you can use.
   ============================================================ */
/* Ground you cannot get to is not ground you can use.

   So the cloth does not ask each piece of ground in the abstract whether this
   being could stand on it — it walks out from where the being actually is and
   finds what the ground offers, which for RAIN is the basin it would run down
   and for WHEELCHAIR is everything this side of the kerb. An edge remembers
   which way round you would arrive at it, because for water that is the whole
   difference between a channel and a wall.

   Only recomputed when you have moved to a new junction, become something
   else, or somebody has changed what the ground is worth. */
let reachDir = null, reachFrom = -2, reachBeing = null, reachOK = false, reachDirty = true;
function computeReach() {
  const being = S.being, start = S.you ? S.you.node : -1;
  reachOK = false;
  if (!reachDir || reachDir.length < G.e) reachDir = new Int8Array(Math.max(4096, G.e * 2));
  if (start < 0 || start >= G.n || !being) return;
  reachDir.fill(-1, 0, G.e);
  const seen = new Uint8Array(G.n);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const n = stack.pop();
    const adj = G.adj[n];
    for (let i = 0; i < adj.length; i++) {
      const e = adj[i];
      const fwd = G.ea[e] === n;
      if (!isFinite(being.cost(e, fwd))) continue;
      if (reachDir[e] < 0) reachDir[e] = fwd ? 1 : 0;
      const o = fwd ? G.eb[e] : G.ea[e];
      if (!seen[o]) { seen[o] = 1; stack.push(o); }
    }
  }
  reachOK = true;
}

function syncReach() {
  const node = S.you ? S.you.node : -1;
  if (!reachDirty && node === reachFrom && S.being === reachBeing) return;
  reachFrom = node; reachBeing = S.being; reachDirty = false;
  computeReach();
  kGen = kGen > 2e9 ? 1 : kGen + 1;
}

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
  let r;
  if (reachOK) {
    const d = reachDir[e];
    if (d < 0) { kStamp[e] = kGen; kVal[e] = 0; return 0; }
    r = being.read(e, d === 1);
  } else {
    /* before anybody is standing anywhere, ground counts either way round */
    const a = being.read(e, true), b = being.read(e, false);
    r = (a.live ? a.ratio : Infinity) <= (b.live ? b.ratio : Infinity) ? a : b;
  }
  const k = !r.live ? 0 : r.kind === "ladder" ? 2 : r.kind === "chute" ? 3 : 1;
  kStamp[e] = kGen; kVal[e] = k;
  return k;
}

/* ============================================================
   PASS 1 — the city, woven once

   Everything of one kind goes into one path and is laid in one stroke, because
   a thousand small strokes is what makes a canvas slow.
   ============================================================ */
let base = null, bctx = null, baseDirty = true;
let bx = 0, by = 0, bz = -1, bw = 0, bh = 0, bdpr = 0;
const _vis = [];

function inkWidth(cls, zt, ppm) {
  const st = CITY[cls];
  const w = lerp(st.w[0], st.w[1], zt);
  return st.met ? Math.max(w, CLS_M[cls] * ppm * st.met) : w;
}

function renderBase(dpr) {
  const M = MARGIN;
  const w = Math.round((View.w + M * 2) * dpr), h = Math.round((View.h + M * 2) * dpr);
  if (!base) { base = document.createElement("canvas"); bctx = base.getContext("2d", { alpha: false }); }
  if (base.width !== w || base.height !== h) { base.width = w; base.height = h; }
  const c = bctx, ws = worldSize();

  /* Paper first, and it belongs to the ground rather than to the screen: the
     tooth is anchored in the city, so panning slides the cloth and not the
     grain. A whole sheet of it is kept made up, one device pixel to one grain,
     so laying the ground down again is a copy and never a weave. */
  ensureSheet(w, h);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  const ax = ((View.x * ws - View.w / 2 - M) * dpr) % PAPER_TILE;
  const ay = ((View.y * ws - View.h / 2 - M) * dpr) % PAPER_TILE;
  const ox = Math.round(((ax % PAPER_TILE) + PAPER_TILE) % PAPER_TILE);
  const oy = Math.round(((ay % PAPER_TILE) + PAPER_TILE) % PAPER_TILE);
  c.drawImage(sheet, ox, oy, w, h, 0, 0, w, h);

  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.translate(M, M);

  c.lineCap = "round";
  c.lineJoin = "round";

  const zt = clamp((View.z - 10.5) / 6.5, 0, 1);
  const ppm = pxPerM();
  const b = viewBounds(M + 60);
  pcur = 0;

  drawBoundary(c, b, zt);
  drawWater(c, b, zt);

  const vis = chainsInView(b, _vis);
  /* project every corridor once; the four passes below all read the same points */
  let load = 0;
  for (let i = 0; i < vis.length; i++) {
    const ch = vis[i];
    ch.off = pcur;
    ch.n = poolChain(ch);
    load += ch.n;
  }
  /* a crowded screen is woven plainly, or the weave costs more than it says */
  const fine = load < 3000;

  for (const cls of CITY_ORDER) {
    const st = CITY[cls];
    const lw = inkWidth(cls, zt, ppm);
    let any = false;
    for (let i = 0; i < vis.length; i++) if (vis[i].cls === cls && vis[i].n > 1) { any = true; break; }
    if (!any) continue;

    /* a strong fibre is bedded into the cloth before it is drawn on it */
    if (fine && st.bed) {
      c.globalAlpha = st.bed;
      c.strokeStyle = st.col;
      c.lineWidth = lw * 2.5;
      c.beginPath();
      for (let i = 0; i < vis.length; i++) {
        const ch = vis[i];
        if (ch.cls === cls && ch.n > 1) trace(c, ch.off, ch.n);
      }
      c.stroke();
    }
    /* the channel of bare paper that lets one fibre pass over another */
    if (fine && st.gap > 0) {
      c.globalAlpha = 0.9;
      c.strokeStyle = PAPER_LIT;
      c.lineWidth = lw + st.gap;
      c.beginPath();
      for (let i = 0; i < vis.length; i++) {
        const ch = vis[i];
        if (ch.cls === cls && ch.n > 1) trace(c, ch.off, ch.n);
      }
      c.stroke();
    }
    /* the fibre itself */
    c.globalAlpha = st.a;
    c.strokeStyle = st.col;
    c.fillStyle = st.col;
    c.beginPath();
    const mark = pcur;
    for (let i = 0; i < vis.length; i++) {
      const ch = vis[i];
      if (ch.cls !== cls || ch.n < 2) continue;
      if (fine) {
        _seed = ch.seed;
        ribbon(c, mark, densify(ch.off, ch.n, mark), lw, 0, 0);
      } else {
        trace(c, ch.off, ch.n);
      }
    }
    if (fine) c.fill(); else { c.lineWidth = lw; c.stroke(); }

    /* the sleepers: paper shows through the rail at intervals */
    if (st.stitch && lw > 0.75) {
      c.globalAlpha = st.a * 0.85;
      c.strokeStyle = PAPER_LIT;
      c.lineWidth = lw * 0.72;
      c.setLineDash([lw * 0.9, lw * 2.8]);
      c.beginPath();
      for (let i = 0; i < vis.length; i++) {
        const ch = vis[i];
        if (ch.cls === cls && ch.n > 1) trace(c, ch.off, ch.n);
      }
      c.stroke();
      c.setLineDash([]);
    }
  }

  c.globalAlpha = 1;
  bx = View.x; by = View.y; bz = View.z; bw = View.w; bh = View.h; bdpr = dpr;
  baseDirty = false;
}

function drawWater(c, b, zt) {
  const lw = lerp(WATER.w[0], WATER.w[1], zt);
  const mark = pcur;
  let any = false;
  /* the damp around a creek, so it reads before the line does */
  c.globalAlpha = 0.11;
  c.strokeStyle = WATER.col;
  c.lineWidth = lw * 3.4;
  c.beginPath();
  for (const r of WATER_RUNS) {
    if (r.x1 < b.x0 || r.x0 > b.x1 || r.y1 < b.y0 || r.y0 > b.y1) continue;
    r.off = pcur;
    r.n = poolRun(r);
    if (r.n < 2) continue;
    any = true;
    trace(c, r.off, r.n);
  }
  if (!any) { pcur = mark; return; }
  c.stroke();
  c.globalAlpha = WATER.a;
  c.fillStyle = WATER.col;
  c.beginPath();
  const scratch = pcur;
  for (const r of WATER_RUNS) {
    if (r.x1 < b.x0 || r.x0 > b.x1 || r.y1 < b.y0 || r.y0 > b.y1 || r.n < 2) continue;
    _seed = r.seed;
    ribbon(c, scratch, densify(r.off, r.n, scratch), lw, 0, 0);
  }
  c.fill();
  pcur = mark;
}

function drawBoundary(c, b, zt) {
  const lw = lerp(BOUND.w[0], BOUND.w[1], zt);
  const mark = pcur;
  let any = false;
  c.globalAlpha = BOUND.a;
  c.strokeStyle = BOUND.col;
  c.lineWidth = lw;
  c.setLineDash([lw * 3.2, lw * 3.6]);
  c.beginPath();
  for (const r of BOUND_RUNS) {
    if (r.x1 < b.x0 || r.x0 > b.x1 || r.y1 < b.y0 || r.y0 > b.y1) continue;
    const off = pcur, n = poolRun(r);
    if (n < 2) continue;
    any = true;
    trace(c, off, n);
  }
  if (any) c.stroke();
  c.setLineDash([]);
  pcur = mark;
}

/* ============================================================
   PASS 2 — the ground this being can use, lifted out of the cloth
   ============================================================ */
let turnAt = 0;
/* runs, as parallel columns: corridor, first edge, last edge, kind, group */
const _rCh = [], _rA = [], _rB = [], _rK = [], _rG = [];
let _rN = 0;
const _dyn = [];

/* 0 dead, 1 plain, 2 ladder, 3 chute */
const KIND_COL = ["dead", "live", "ladder", "chute"];

function gather(vis) {
  _rN = 0;
  let live = 0;
  pcur = 0;
  for (let vi = 0; vi < vis.length; vi++) {
    const ch = vis[vi];
    ch.n = 0;
    const ne = ch.e.length;
    const before = _rN;
    let start = -1, kind = 0;
    for (let i = 0; i <= ne; i++) {
      const k = i < ne ? kindAt(ch.e[i]) : 0;
      if (k !== kind) {
        if (kind !== 0 && start >= 0) {
          _rCh[_rN] = ch; _rA[_rN] = start; _rB[_rN] = i - 1;
          _rK[_rN] = kind; _rG[_rN] = ch.cls * 4 + kind; _rN++;
          live += i - start;
        }
        start = k !== 0 ? i : -1;
        kind = k;
      }
    }
    if (_rN > before) {
      ch.off = pcur;
      /* every point of the corridor, in order, so an edge index is a point index */
      poolRoom(pcur + ch.np + 2);
      for (let i = 0; i < ch.np; i++) { PX[pcur] = sx(ch.px[i]); PY[pcur] = sy(ch.py[i]); pcur++; }
      ch.n = ch.np;
    }
    /* a corridor with nothing of this being's in it is never projected at all */
  }
  return live;
}

function liveWidth(cls, kind, zt, ppm) {
  const w = inkWidth(cls, zt, ppm);
  return Math.max(1.15, w * (kind === 2 ? 1.75 : kind === 3 ? 1.05 : 1.25));
}

function drawLive(ctx, vis) {
  const being = S.being;
  if (!being) return;
  const c = ctx.c;
  const zt = clamp((View.z - 10.5) / 6.5, 0, 1);
  const ppm = pxPerM();

  syncReach();
  const live = gather(vis);
  if (!live) { drawDynamic(ctx, zt, ppm, 1); return; }
  /* How much cloth this machine can actually afford. ctx.quality is main's
     view of it; ease is what the frames themselves are saying. */
  const room = ctx.quality * ease(clamp((27 - slowness) / 9, 0, 1));
  const fine = live < 2400 * room && room > 0.25;
  const hazeAll = fine && live < 700 * room;
  const hazeLadder = fine && live < 1900 * room;

  /* how long since the board reorganised: the new ground arrives, it does not
     cut in */
  const k = turnAt ? clamp((performance.now() - turnAt) / TURN_MS, 0, 1) : 1;
  const rise = turnAt ? ease(0.3 + k * 0.7) : 1;
  if (k >= 1) turnAt = 0;

  c.lineCap = "round";
  c.lineJoin = "round";

  /* which corridor-and-kind pairs are actually on this screen */
  const groups = [];
  for (let r = 0; r < _rN; r++) if (groups.indexOf(_rG[r]) < 0) groups.push(_rG[r]);

  /* 1. the channel of bare paper. this is what makes live ground read as lying
        ON the city rather than mixed into it. On a screen holding the whole
        metro there is no room between threads for a channel, so there is none. */
  if (fine) {
    c.globalAlpha = 0.66 * rise;
    c.strokeStyle = PAPER_LIT;
    for (const g of groups) {
      const cls = g >> 2, kind = g & 3;
      c.lineWidth = liveWidth(cls, kind, zt, ppm) + 2.9;
      c.beginPath();
      for (let r = 0; r < _rN; r++) {
        if (_rG[r] !== g) continue;
        const ch = _rCh[r];
        trace(c, ch.off + _rA[r], _rB[r] - _rA[r] + 2);
      }
      c.stroke();
    }
  }

  /* 2. every live thread sits in a haze of its own fibre, and what carries you
        blooms out of the cloth altogether */
  if (fine) {
    for (const g of groups) {
      const cls = g >> 2, kind = g & 3;
      if (kind === 2 ? !hazeLadder : !hazeAll) continue;
      c.globalAlpha = (kind === 2 ? 0.17 : 0.08) * rise;
      c.strokeStyle = being.ink[KIND_COL[kind]];
      c.lineWidth = liveWidth(cls, kind, zt, ppm) * (kind === 2 ? 3.5 : 2.4);
      c.beginPath();
      for (let r = 0; r < _rN; r++) {
        if (_rG[r] !== g) continue;
        const ch = _rCh[r];
        trace(c, ch.off + _rA[r], _rB[r] - _rA[r] + 2);
      }
      c.stroke();
    }
  }

  /* 3. the threads themselves, dearest first so the cheap ground sits on top */
  const scratch = pcur;
  for (const kind of [3, 1, 2]) {
    const col = being.ink[KIND_COL[kind]];
    c.strokeStyle = col;
    c.fillStyle = col;
    c.globalAlpha = (kind === 3 ? 0.62 : kind === 2 ? 1 : 0.95) * rise;
    if (fine) {
      c.beginPath();
      for (let r = 0; r < _rN; r++) {
        if (_rK[r] !== kind) continue;
        const ch = _rCh[r], i0 = _rA[r], i1 = _rB[r];
        _seed = ch.seed + kind * 977;
        /* a thread frays out where the ground stops being yours */
        ribbon(c, scratch, densify(ch.off + i0, i1 - i0 + 2, scratch),
          liveWidth(ch.cls, kind, zt, ppm), i0 > 0 ? 1 : 0, i1 < ch.e.length - 1 ? 1 : 0);
      }
      c.fill();
    } else {
      for (const g of groups) {
        if ((g & 3) !== kind) continue;
        c.lineWidth = liveWidth(g >> 2, kind, zt, ppm);
        c.beginPath();
        for (let r = 0; r < _rN; r++) {
          if (_rG[r] !== g) continue;
          const ch = _rCh[r];
          trace(c, ch.off + _rA[r], _rB[r] - _rA[r] + 2);
        }
        c.stroke();
      }
    }
    /* what drags on you is worn thin: the paper keeps coming back through it */
    if (kind === 3 && fine) {
      c.globalAlpha = 0.5 * rise;
      c.strokeStyle = PAPER_LIT;
      for (const g of groups) {
        if ((g & 3) !== 3) continue;
        const lw = liveWidth(g >> 2, 3, zt, ppm);
        c.lineWidth = lw * 0.5;
        c.setLineDash([lw * 0.45, lw * 1.15]);
        c.beginPath();
        for (let r = 0; r < _rN; r++) {
          if (_rG[r] !== g) continue;
          const ch = _rCh[r];
          trace(c, ch.off + _rA[r], _rB[r] - _rA[r] + 2);
        }
        c.stroke();
      }
      c.setLineDash([]);
    }
  }
  pcur = scratch;

  drawDynamic(ctx, zt, ppm, rise);
  c.globalAlpha = 1;
}

/* Ground the players laid is not in the cloth — it arrives during the game, so
   it is asked for straight from the index every frame. There is never much of
   it on one screen, and it is the ground that matters most. */
function drawDynamic(ctx, zt, ppm, rise) {
  const c = ctx.c, being = S.being;
  const b = viewBounds(40);
  edgesInBox(b.x0, b.y0, b.x1, b.y1, _dyn, (e) => G.ec[e] >= CLS_MARK);
  if (!_dyn.length) return;
  c.lineCap = "round";
  c.lineJoin = "round";
  /* the hand that drew it decided how wide it is, so widths vary; they are
     rounded into a handful of gauges and each gauge is laid in one stroke */
  const gauge = (e) => Math.round(Math.max(1.5, Math.max(lerp(1.0, 2.4, zt), G.ewidth[e] * ppm * 0.9)) * 2) / 2;
  const seen = [];
  for (let i = 0; i < _dyn.length; i++) {
    const e = _dyn[i], kind = kindAt(e);
    if (!kind) continue;
    const key = kind * 64 + Math.min(63, gauge(e) * 2);
    if (seen.indexOf(key) < 0) seen.push(key);
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const key of seen) {
      const kind = (key / 64) | 0, g = (key % 64) / 2;
      const w = g * (kind === 2 ? 1.8 : kind === 3 ? 1.05 : 1.3);
      if (pass === 0) {
        c.globalAlpha = 0.75 * rise;
        c.strokeStyle = PAPER_LIT;
        c.lineWidth = w + 3.2;
      } else {
        c.globalAlpha = (kind === 3 ? 0.8 : 1) * rise;
        c.strokeStyle = being.ink[KIND_COL[kind]];
        c.lineWidth = w;
      }
      c.beginPath();
      for (let i = 0; i < _dyn.length; i++) {
        const e = _dyn[i];
        if (kindAt(e) !== kind || Math.min(63, gauge(e) * 2) !== key % 64) continue;
        const a = G.ea[e], z = G.eb[e];
        c.moveTo(sx(G.nx[a]), sy(G.ny[a]));
        c.lineTo(sx(G.nx[z]), sy(G.ny[z]));
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
  if (View.z < 10.4 || !PLACES.length) return;
  const b = viewBounds(0);
  _drawn.length = 0;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineJoin = "round";
  for (const p of PLACES) {
    if (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1) continue;
    const big = p.kind === "city";
    if (!big && View.z < 11.9) continue;
    const X = sx(p.x), Y = sy(p.y);
    let clash = false;
    for (let i = 0; i < _drawn.length; i += 2) {
      if (Math.abs(_drawn[i] - X) < 84 && Math.abs(_drawn[i + 1] - Y) < 20) { clash = true; break; }
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
/* What the frames themselves say about how much the machine has left. The
   canvas does its real work after the loop has stopped timing itself, so the
   only honest measure of a heavy cloth is the length of the frame it caused. */
let slowness = 16;

export function draw(ctx) {
  const c = ctx.c;
  const ws = worldSize();
  slowness = slowness * 0.9 + Math.min(70, ctx.dt || 16) * 0.1;

  /* The city is rewoven only when the camera has run past the spare cloth at
     the edge of the screen. Everything between is one straight copy. */
  if (baseDirty || bz !== View.z || bw !== View.w || bh !== View.h || bdpr !== View.dpr ||
      Math.abs((bx - View.x) * ws) > MARGIN - 8 || Math.abs((by - View.y) * ws) > MARGIN - 8) {
    renderBase(View.dpr);
  }

  /* the city, blitted whole, in one opaque copy */
  c.globalAlpha = 1;
  const px = MARGIN - (bx - View.x) * ws, py = MARGIN - (by - View.y) * ws;
  c.drawImage(base, px * bdpr, py * bdpr, View.w * bdpr, View.h * bdpr, 0, 0, View.w, View.h);

  /* and set back a step, because it is not yours */
  const k = turnAt ? clamp((performance.now() - turnAt) / TURN_MS, 0, 1) : 1;
  c.globalAlpha = turnAt ? lerp(VEIL_TURN, VEIL, ease(k)) : VEIL;
  c.fillStyle = PAPER;
  c.fillRect(0, 0, View.w, View.h);
  c.globalAlpha = 1;

  drawLive(ctx, chainsInView(viewBounds(60), _vis));
  drawPlaces(c);
  c.globalAlpha = 1;
}
