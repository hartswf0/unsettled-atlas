/* PERSPECTIVAL GROUND — ground compiler.
   Turns the real Atlanta polylines into a routable graph, once, at build time,
   so the phone never pays for it.

   Everything here is derived from the real geometry. Nothing is invented:
   - junctions are real crossings of real ways
   - culverts are real places where a road crosses a real watercourse
   - height is distance from water, which is how Atlanta actually drains

   node build-graph.mjs   ->  ../graph.data.js
*/
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "graph.data.js");

/* ---------- the payload ---------- */
const groundSrc = readFileSync(join(HERE, "..", "ground.data.js"), "utf8");
const GROUND = JSON.parse(groundSrc.slice(groundSrc.indexOf("{"), groundSrc.lastIndexOf(";")));

/* ---------- web mercator, unit square ---------- */
const mercX = (lng) => (lng + 180) / 360;
const mercY = (lat) => {
  const s = Math.sin(Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
/* metres per unit of mercator at Atlanta's latitude */
const M_PER_UNIT = 40075016.686 * Math.cos(33.75 * Math.PI / 180);

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
    if (pts.length >= 4) out.push(pts);
  }
  return out;
}

const LAYERS = {};
for (const k in GROUND.layers) LAYERS[k] = decode(GROUND.layers[k]);

/* Ways we can travel on. Boundary is not ground you move along. */
const WAY_CLASSES = ["motorway", "primary", "secondary", "rail"];
const WATER = LAYERS.water || [];

/* ============================================================
   1. SEGMENTS
   Every polyline becomes a run of segments carrying its class.
   ============================================================ */
const segs = []; // {x0,y0,x1,y1,cls,line}
for (const cls of WAY_CLASSES) {
  const lines = LAYERS[cls] || [];
  for (let li = 0; li < lines.length; li++) {
    const p = lines[li];
    for (let j = 0; j + 3 < p.length; j += 2) {
      const x0 = p[j], y0 = p[j + 1], x1 = p[j + 2], y1 = p[j + 3];
      if (x0 === x1 && y0 === y1) continue;
      segs.push({ x0, y0, x1, y1, cls, line: cls + ":" + li });
    }
  }
}

/* ============================================================
   2. CROSSINGS
   Real ways crossing real ways become junctions; real ways crossing real
   water become culverts. Grid-bucketed so this stays quick.
   ============================================================ */
const CELL = 1 / Math.pow(2, 14); // ~2.4 km
const grid = new Map();
const keyOf = (cx, cy) => cx * 1e6 + cy;
function bucket(i, s) {
  const cx0 = Math.floor(Math.min(s.x0, s.x1) / CELL), cx1 = Math.floor(Math.max(s.x0, s.x1) / CELL);
  const cy0 = Math.floor(Math.min(s.y0, s.y1) / CELL), cy1 = Math.floor(Math.max(s.y0, s.y1) / CELL);
  for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
    const k = keyOf(cx, cy);
    let b = grid.get(k);
    if (!b) grid.set(k, b = []);
    b.push(i);
  }
}
segs.forEach((s, i) => bucket(i, s));

/* segment-segment intersection, returns parameters along each */
function cross(a, b) {
  const rx = a.x1 - a.x0, ry = a.y1 - a.y0;
  const sx = b.x1 - b.x0, sy = b.y1 - b.y0;
  const d = rx * sy - ry * sx;
  if (Math.abs(d) < 1e-15) return null;
  const qx = b.x0 - a.x0, qy = b.y0 - a.y0;
  const t = (qx * sy - qy * sx) / d;
  const u = (qx * ry - qy * rx) / d;
  if (t < 1e-9 || t > 1 - 1e-9 || u < 1e-9 || u > 1 - 1e-9) return null;
  return { t, u, x: a.x0 + rx * t, y: a.y0 + ry * t };
}

/* split points per segment */
const splits = segs.map(() => []);
const seen = new Set();
for (const [, b] of grid) {
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
    const A = b[i], B = b[j];
    if (segs[A].line === segs[B].line) continue;
    const pk = A < B ? A * 1e7 + B : B * 1e7 + A;
    if (seen.has(pk)) continue;
    seen.add(pk);
    const c = cross(segs[A], segs[B]);
    if (!c) continue;
    splits[A].push(c.t);
    splits[B].push(c.u);
  }
}

/* water crossings — where a way passes over a real watercourse */
const waterSegs = [];
for (const p of WATER) {
  for (let j = 0; j + 3 < p.length; j += 2) {
    waterSegs.push({ x0: p[j], y0: p[j + 1], x1: p[j + 2], y1: p[j + 3] });
  }
}
const culvertAt = []; // {x,y}
for (let i = 0; i < segs.length; i++) {
  for (const w of waterSegs) {
    if (Math.min(segs[i].x0, segs[i].x1) > Math.max(w.x0, w.x1)) continue;
    if (Math.max(segs[i].x0, segs[i].x1) < Math.min(w.x0, w.x1)) continue;
    if (Math.min(segs[i].y0, segs[i].y1) > Math.max(w.y0, w.y1)) continue;
    if (Math.max(segs[i].y0, segs[i].y1) < Math.min(w.y0, w.y1)) continue;
    const c = cross(segs[i], w);
    if (!c) continue;
    splits[i].push(c.t);
    culvertAt.push(c);
  }
}

/* ============================================================
   3. NODES + EDGES
   Weld coincident endpoints so separate OSM ways become one network.
   ============================================================ */
const WELD = 18 / M_PER_UNIT; // 18 m — these ways are simplified, weld generously
const nodes = [];
const nodeGrid = new Map();
const NCELL = WELD * 2;
function nodeAt(x, y) {
  const cx = Math.floor(x / NCELL), cy = Math.floor(y / NCELL);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const b = nodeGrid.get(keyOf(cx + dx, cy + dy));
    if (!b) continue;
    for (const id of b) {
      const n = nodes[id];
      if (Math.abs(n.x - x) < WELD && Math.abs(n.y - y) < WELD) return id;
    }
  }
  const id = nodes.length;
  nodes.push({ x, y });
  const k = keyOf(cx, cy);
  let b = nodeGrid.get(k);
  if (!b) nodeGrid.set(k, b = []);
  b.push(id);
  return id;
}

/* These ways are simplified: a single segment can run kilometres. Walk them at
   a human grain so travel is smooth and so height is sampled where you are,
   not only where OSM happened to put a vertex. */
const STEP = 85 / M_PER_UNIT;

const edges = []; // {a,b,cls}
for (let i = 0; i < segs.length; i++) {
  const s = segs[i];
  const ts = [...new Set([0, ...splits[i], 1])].sort((p, q) => p - q);
  for (let k = 0; k + 1 < ts.length; k++) {
    const t0 = ts[k], t1 = ts[k + 1];
    if (t1 - t0 < 1e-7) continue;
    const ax = s.x0 + (s.x1 - s.x0) * t0, ay = s.y0 + (s.y1 - s.y0) * t0;
    const bx = s.x0 + (s.x1 - s.x0) * t1, by = s.y0 + (s.y1 - s.y0) * t1;
    const runs = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / STEP));
    let prev = nodeAt(ax, ay);
    for (let r = 1; r <= runs; r++) {
      const u = r / runs;
      const nx2 = ax + (bx - ax) * u, ny2 = ay + (by - ay) * u;
      const cur = nodeAt(nx2, ny2);
      if (cur !== prev) edges.push({ a: prev, b: cur, cls: s.cls });
      prev = cur;
    }
  }
}

/* ============================================================
   4. HEIGHT
   Atlanta drains to its creeks. Distance from water is height — coarse, but
   it is the real hydrology of the real ground, and it makes RAIN's board.
   ============================================================ */
const wGrid = new Map();
const WCELL = 1 / Math.pow(2, 15);
waterSegs.forEach((w, i) => {
  const cx0 = Math.floor(Math.min(w.x0, w.x1) / WCELL), cx1 = Math.floor(Math.max(w.x0, w.x1) / WCELL);
  const cy0 = Math.floor(Math.min(w.y0, w.y1) / WCELL), cy1 = Math.floor(Math.max(w.y0, w.y1) / WCELL);
  for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
    const k = keyOf(cx, cy);
    let b = wGrid.get(k);
    if (!b) wGrid.set(k, b = []);
    b.push(i);
  }
});
function distToSeg(px, py, w) {
  const dx = w.x1 - w.x0, dy = w.y1 - w.y0;
  const L = dx * dx + dy * dy;
  let t = L ? ((px - w.x0) * dx + (py - w.y0) * dy) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = w.x0 + dx * t - px, qy = w.y0 + dy * t - py;
  return Math.hypot(qx, qy);
}
function waterDist(x, y) {
  let best = Infinity;
  const cx = Math.floor(x / WCELL), cy = Math.floor(y / WCELL);
  for (let r = 1; r <= 6; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const b = wGrid.get(keyOf(cx + dx, cy + dy));
      if (!b) continue;
      for (const i of b) best = Math.min(best, distToSeg(x, y, waterSegs[i]));
    }
    if (best < Infinity && r >= 2) break;
  }
  return best === Infinity ? WCELL * 6 : best;
}
/* Metres of rise.

   Distance from water is the shape of the terrain, but its raw magnitude is
   not: these are only the named creeks, so most of the metro sits far from
   any drawn line and any absolute curve saturates into a flat plateau. So we
   keep the field's shape and re-spread it across the city by rank. Creeks sit
   at zero, ridges near sixty, and — crucially — the ground keeps tilting the
   whole way between, which is what gives every traveller a slope to read. */
const dists = nodes.map((n) => waterDist(n.x, n.y) * M_PER_UNIT);
const sorted = Float64Array.from(dists).sort();
function pct(d) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < d) lo = mid + 1; else hi = mid; }
  return lo / sorted.length;
}
for (let i = 0; i < nodes.length; i++) {
  nodes[i].h = Math.round(62 * Math.pow(pct(dists[i]), 0.85) * 10) / 10;
}

/* edge geometry facts */
const culvertKeys = new Set();
for (const c of culvertAt) culvertKeys.add(nodeAt(c.x, c.y));
for (const e of edges) {
  const A = nodes[e.a], B = nodes[e.b];
  e.len = Math.round(Math.hypot(B.x - A.x, B.y - A.y) * M_PER_UNIT);
  /* percent, signed a->b. Clamped: welded vertices can sit on top of each
     other and a 3 m edge must not report a cliff. */
  const g = e.len > 12 ? ((B.h - A.h) / e.len) * 100 : 0;
  e.grade = Math.round(Math.max(-18, Math.min(18, g)) * 10) / 10;
  e.culvert = (culvertKeys.has(e.a) || culvertKeys.has(e.b)) ? 1 : 0;
}

/* ============================================================
   5. PRUNE
   Keep the largest connected component. An island nobody can reach is not
   ground, it is noise.
   ============================================================ */
const adj = nodes.map(() => []);
edges.forEach((e, i) => { adj[e.a].push(i); adj[e.b].push(i); });
const comp = new Int32Array(nodes.length).fill(-1);
let best = -1, bestN = 0, nc = 0;
for (let s = 0; s < nodes.length; s++) {
  if (comp[s] !== -1) continue;
  const stack = [s];
  comp[s] = nc;
  let count = 0;
  while (stack.length) {
    const v = stack.pop(); count++;
    for (const ei of adj[v]) {
      const o = edges[ei].a === v ? edges[ei].b : edges[ei].a;
      if (comp[o] === -1) { comp[o] = nc; stack.push(o); }
    }
  }
  if (count > bestN) { bestN = count; best = nc; }
  nc++;
}

const keepNode = new Int32Array(nodes.length).fill(-1);
const outNodes = [];
for (let i = 0; i < nodes.length; i++) {
  if (comp[i] !== best) continue;
  keepNode[i] = outNodes.length;
  outNodes.push(nodes[i]);
}
const outEdges = edges.filter((e) => keepNode[e.a] >= 0 && keepNode[e.b] >= 0)
  .map((e) => ({ ...e, a: keepNode[e.a], b: keepNode[e.b] }));

/* ============================================================
   6. EMIT
   ============================================================ */
const CLS = ["motorway", "primary", "secondary", "rail"];

/* Same ASCII varint the source polylines use: five bits a chunk, +63 so it
   stays printable. A phone should not download integers spelled out in JSON. */
function enc(list) {
  let s = "";
  for (let v of list) {
    v = v < 0 ? ~(v << 1) : (v << 1);
    while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    s += String.fromCharCode(v + 63);
  }
  return s;
}

/* nodes as deltas in mercator at ~0.3 m, walked in order */
const NQ = 1e7;
const nxs = [], nys = [], nhs = [];
let px = 0, py = 0, ph = 0;
for (const n of outNodes) {
  const qx = Math.round(n.x * NQ), qy = Math.round(n.y * NQ), qh = Math.round(n.h * 2);
  nxs.push(qx - px); nys.push(qy - py); nhs.push(qh - ph);
  px = qx; py = qy; ph = qh;
}

/* edges sorted so both endpoints delta well */
outEdges.sort((p, q) => (p.a - q.a) || (p.b - q.b));
const eas = [], ebs = [];
let pa = 0;
for (const e of outEdges) { eas.push(e.a - pa); ebs.push(e.b - e.a); pa = e.a; }
const ecs = outEdges.map((e) => CLS.indexOf(e.cls)).join("");
const culv = [];
let pv = 0;
outEdges.forEach((e, i) => { if (e.culvert) { culv.push(i - pv); pv = i; } });

/* len and grade are not stored: they fall out of the nodes at load. */
const data = {
  cls: CLS,
  nq: NQ,
  n: outNodes.length,
  e: outEdges.length,
  nx: enc(nxs), ny: enc(nys), nh: enc(nhs),
  ea: enc(eas), eb: enc(ebs), ec: ecs, ev: enc(culv),
  mPerUnit: M_PER_UNIT,
  bbox: GROUND.bbox,
};

writeFileSync(OUT,
  "/* PERSPECTIVAL GROUND — compiled ground graph.\n" +
  "   Generated by pg/tools/build-graph.mjs from pg/ground.data.js. Do not edit by hand.\n" +
  "   Junctions are real crossings of real ways. Culverts are real crossings of a\n" +
  "   way over a real watercourse. Height is the rank of distance from those\n" +
  "   watercourses, which is how this city drains.\n" +
  "   Coordinates are web-mercator unit-square deltas, ASCII varint. Edge length\n" +
  "   and grade are derived at load from the nodes — see pg/graph.js. */\n" +
  "export const GRAPH = " + JSON.stringify(data) + ";\n");

/* ---------- report ---------- */
const byCls = {};
for (const e of outEdges) byCls[e.cls] = (byCls[e.cls] || 0) + 1;
const lens = outEdges.map((e) => e.len).sort((a, b) => a - b);
const grades = outEdges.map((e) => Math.abs(e.grade)).sort((a, b) => a - b);
const deg = new Int32Array(outNodes.length);
for (const e of outEdges) { deg[e.a]++; deg[e.b]++; }
let junctions = 0;
for (const d of deg) if (d >= 3) junctions++;

console.log("components", nc, "kept largest with", bestN, "nodes");
console.log("nodes", outNodes.length, "edges", outEdges.length);
console.log("by class", byCls);
console.log("junctions (deg>=3)", junctions);
console.log("culvert edges", outEdges.filter((e) => e.culvert).length);
console.log("edge len m  p50", lens[lens.length >> 1], "p90", lens[Math.floor(lens.length * 0.9)], "max", lens[lens.length - 1]);
console.log("|grade| %  p50", grades[grades.length >> 1], "p90", grades[Math.floor(grades.length * 0.9)], "max", grades[grades.length - 1]);
const hs = outNodes.map((n) => n.h);
console.log("height m   min", Math.min(...hs), "max", Math.max(...hs));
console.log("out bytes", readFileSync(OUT).length);
