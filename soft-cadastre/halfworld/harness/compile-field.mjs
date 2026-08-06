#!/usr/bin/env node
/* ============================================================================
   compile-field.mjs — STAGE 4 · COMPILE
   The deterministic half of the bargain. Takes atlas/extracted.json
   (relation programs, no coordinates) and OWNS THE GEOMETRY:

     mention  -> kernel on a local equirectangular grid (per relation family)
     comention-> Appleyard line between anchors
     possessive-> territory box at the unit's dominant anchor
     stance=deny -> refusal wall ring at the unit's dominant anchor

   Output atlas/compiled.json: sparse per-topic fields (8-level quantized at
   render time — DOT law), claim geometry, refusal walls, sanity numbers for
   gate 4. Pure node:fs + math. No model anywhere in this file.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const p = (...a) => path.join(ROOT, ...a);
const cfg = JSON.parse(fs.readFileSync(p("world.config.json"), "utf8"));
const EX = JSON.parse(fs.readFileSync(p("atlas", "extracted.json"), "utf8"));

/* ---- local meter grid (equirectangular around grid center) -------------- */
const G = cfg.grid;
const lat0 = (G.lat_min + G.lat_max) / 2;
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LON = 111320 * Math.cos(lat0 * Math.PI / 180);
const W = Math.round((G.lon_max - G.lon_min) * M_PER_DEG_LON / G.cell_m);
const H = Math.round((G.lat_max - G.lat_min) * M_PER_DEG_LAT / G.cell_m);
const toXY = (lat, lon) => [ (lon - G.lon_min) * M_PER_DEG_LON / G.cell_m,
                             (G.lat_max - lat) * M_PER_DEG_LAT / G.cell_m ];

const anchorXY = {};
for (const [id, a] of Object.entries(cfg.anchors)) {
  if (a.kind === "point") anchorXY[id] = { kind: "point", xy: toXY(a.lat, a.lon), rear: a.rear_bearing_deg ?? 0, label: a.label };
  else anchorXY[id] = { kind: "segment", pts: a.pts.map(([la, lo]) => toXY(la, lo)), label: a.label };
}

/* ---- kernel stampers (all in cell units; sigma in m / cell_m) ----------- */
const fields = {};                        // topic -> Float64Array(W*H)
const F = (topic) => fields[topic] ||= new Float64Array(W * H);
const stampGauss = (f, cx, cy, sx, sy, rot) => {
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const r = Math.ceil(Math.max(sx, sy) * 3);
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
      const dx = x - cx, dy = y - cy;
      const u = dx * cos + dy * sin, v = -dx * sin + dy * cos;
      f[y * W + x] += Math.exp(-0.5 * ((u / sx) ** 2 + (v / sy) ** 2));
    }
};
const segPoints = (pts, step = 1.5) => {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const d = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(d / step));
    for (let k = 0; k <= n; k++) out.push([x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n]);
  }
  return out;
};
const nearestOn = (pts, xy) => segPoints(pts, 1).reduce((best, q) =>
  Math.hypot(q[0] - xy[0], q[1] - xy[1]) < Math.hypot(best[0] - xy[0], best[1] - xy[1]) ? q : best);

function stampMention(m, unit) {
  const A = anchorXY[m.anchor];
  if (!A) return false;
  const rel = cfg.relations[m.relation] || cfg.relations.near;
  const cm = G.cell_m, f = F(m.topic || "general");
  if (A.kind === "segment") {                       // relations degrade to line/near on segments
    const s = (rel.sigma || 55) / cm;
    for (const [x, y] of segPoints(A.pts, 1.2)) stampGauss(f, x, y, s, s, 0);
    return true;
  }
  const [ax, ay] = A.xy;
  if (rel.kernel === "iso") { const s = rel.sigma / cm; stampGauss(f, ax, ay, s, s, 0); return true; }
  if (rel.kernel === "offset") {
    const bdeg = rel.bearing === "rear" ? A.rear : (A.rear + 180) % 360;
    const b = (bdeg - 90) * Math.PI / 180;          // 0deg=N -> screen angle; y axis points south
    const cx = ax + Math.cos(b) * rel.dist / cm, cy = ay + Math.sin(b) * rel.dist / cm;
    stampGauss(f, cx, cy, rel.sigma_along / cm, rel.sigma_across / cm, b);
    return true;
  }
  if (rel.kernel === "pair") {                       // between: midpoint to comention partner if any
    const s = rel.sigma / cm; stampGauss(f, ax, ay, s, s, 0); return true;
  }
  const s = 140 / cm; stampGauss(f, ax, ay, s, s, 0); return true;
}

/* ---- walk extraction records ------------------------------------------- */
const lines = [], boxes = [], walls = [], dropped = [], perUnit = [];
let stamped = 0, unresolved = 0;
for (const rec of EX) {
  if (!rec.ok) { perUnit.push({ id: rec.id, stamped: 0, err: rec.err }); continue; }
  let n = 0;
  const counts = {};
  for (const m of rec.mentions) {
    if (!m.anchor) { unresolved++; continue; }
    if (stampMention(m, rec)) { n++; stamped++; counts[m.anchor] = (counts[m.anchor] || 0) + 1; }
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const dominant = ranked[0]?.[0] || null;
  /* Walls and boxes need somewhere to sit, and only a point anchor can hold one.
     Dominance is decided by mention count, which rewards repetition — the regex
     tier used to win it by matching three overlapping aliases for one building.
     A cleaner extraction can therefore make a segment dominant and silently lose
     the refusal wall for a denial that was plainly stated. Prefer the dominant
     anchor; fall back to the best point anchor in the same unit; and if the unit
     has no point anchor at all, record the drop instead of swallowing it. */
  const site = (dominant && anchorXY[dominant].kind === "point")
    ? dominant
    : (ranked.find(([a]) => anchorXY[a]?.kind === "point")?.[0] || null);
  for (const [a, b] of rec.claims.comention || []) {
    const A = anchorXY[a], B = anchorXY[b];
    if (!A || !B) continue;
    const pa = A.kind === "point" ? A.xy : nearestOn(A.pts, B.kind === "point" ? B.xy : B.pts[0]);
    const pb = B.kind === "point" ? B.xy : nearestOn(B.pts, pa);
    lines.push({ unit: rec.id, a, b, from: pa, to: pb });
  }
  if ((rec.claims.possessive || []).length) {
    if (site) boxes.push({ unit: rec.id, anchor: site, at: anchorXY[site].xy,
                           spans: rec.claims.possessive, r_cells: 220 / G.cell_m });
    else dropped.push({ unit: rec.id, kind: "territory box", why: "unit resolved no point anchor to sit on", spans: rec.claims.possessive });
  }
  if (rec.stance === "deny") {
    if (site) walls.push({ unit: rec.id, anchor: site, at: anchorXY[site].xy, r_cells: 150 / G.cell_m });
    else dropped.push({ unit: rec.id, kind: "refusal wall", why: "unit resolved no point anchor to sit on" });
  }
  perUnit.push({ id: rec.id, stamped: n, dominant, site });
}

/* ---- normalize + sparsify ---------------------------------------------- */
const sparse = {};
for (const [topic, f] of Object.entries(fields)) {
  let max = 0;
  for (const v of f) if (v > max) max = v;
  if (!max || !isFinite(max)) continue;
  const cells = [];
  for (let i = 0; i < f.length; i++) {
    const v = f[i] / max;
    if (v > 0.02) cells.push([i % W, Math.floor(i / W), Math.round(v * 1000) / 1000]);
  }
  sparse[topic] = cells;
}

const anchorsOut = Object.fromEntries(Object.entries(anchorXY).map(([id, a]) =>
  [id, a.kind === "point" ? { kind: "point", xy: a.xy.map(v => Math.round(v * 10) / 10), label: a.label }
                          : { kind: "segment", pts: a.pts.map(q => q.map(v => Math.round(v * 10) / 10)), label: a.label }]));

const compiled = {
  meta: { title: cfg.title, W, H, cell_m: G.cell_m, bbox: G,
          built: new Date().toISOString(), provisional: true,
          note: "PROVISIONAL anchor geometry — verify against OSM before any real claim." },
  anchors: anchorsOut, fields: sparse, lines, boxes, walls, dropped, perUnit,
  sanity: { units: EX.length, stamped, unresolved,
            topics: Object.keys(sparse), lines: lines.length, boxes: boxes.length, walls: walls.length, dropped: dropped.length }
};
fs.writeFileSync(p("atlas", "compiled.json"), JSON.stringify(compiled));
fs.mkdirSync(p("ledger"), { recursive: true });
fs.appendFileSync(p("ledger", "compile.jsonl"),
  JSON.stringify({ t: new Date().toISOString(), ...compiled.sanity }) + "\n");
console.log(`COMPILED ${W}x${H} grid · ${stamped} kernel(s) · ${lines.length} line(s) · ${boxes.length} box(es) · ${walls.length} wall(s) · ${unresolved} unresolved mention(s) kept as data`);
for (const d of dropped) console.log(`  DROPPED ${d.kind} for ${d.unit} — ${d.why}`);
