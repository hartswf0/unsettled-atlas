#!/usr/bin/env node
/* ============================================================================
   basemap.mjs — REFERENCE GEOGRAPHY, and nothing else

     node seres/harness/basemap.mjs --city atlanta

   A field of claims with no ground under it is unreadable. Two hundred glowing
   points on a lat/lon grid tell you that something was said somewhere, and
   nothing else. This pulls a minimal vector basemap — boundary, water, the
   major road classes, rail, and a few orienting place names — so a reader can
   tell where a claim is.

   THIS IS NOT EVIDENCE
   --------------------
   Everything this writes is reference geometry. It is stored in its own key,
   never in `claims`, and both surfaces draw it in a neutral weight that cannot
   be mistaken for a claim. It answers "where am I", never "what was said".
   Under law 1 it locates anchors; it never locates what a claim is about.

   Source: OpenStreetMap via the Overpass API. ODbL 1.0, © OpenStreetMap
   contributors — the same licence the note corpus already travels under.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const CITY = arg("city", "atlanta");
const UA = "soft-cadastre/1.0 (perception-field research; contact via repository)";
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

const cityPath = path.join(ROOT, "cities", `${CITY}.json`);
if (!fs.existsSync(cityPath)) { console.error(`no cities/${CITY}.json`); process.exit(1); }
const city = JSON.parse(fs.readFileSync(cityPath, "utf8"));
const [lonMin, latMin, lonMax, latMax] = city.bbox;
const BB = `${latMin},${lonMin},${latMax},${lonMax}`;
const OUT = path.join(ROOT, "seres/atlas", `basemap-${CITY}.json`);

/* Simplification tolerances in degrees. Roughly: 0.0002 ≈ 22 m. A reference
   layer earns no more precision than it needs to be recognisable. */
const TOL = { boundary: 0.00035, water: 0.00035, motorway: 0.00018, primary: 0.00022, secondary: 0.00028, rail: 0.00025 };
const DP = 5;

const LAYERS = [
  { key: "boundary",  q: `relation["boundary"="administrative"]["admin_level"~"^(6|7|8)$"]["name"~"${city.name}",i](${BB});`, kind: "way" },
  { key: "water",     q: `way["natural"="water"](${BB});way["waterway"="river"](${BB});`, kind: "way" },
  { key: "motorway",  q: `way["highway"~"^(motorway|trunk)$"](${BB});`, kind: "way" },
  { key: "primary",   q: `way["highway"="primary"](${BB});`, kind: "way" },
  { key: "secondary", q: `way["highway"="secondary"](${BB});`, kind: "way" },
  { key: "rail",      q: `way["railway"~"^(rail|light_rail|subway)$"](${BB});`, kind: "way" },
];
const PLACES_Q = `node["place"~"^(city|town|suburb|neighbourhood)$"](${BB});`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Overpass is free and busy. A 504 means "come back later", not "no such data",
   and treating the two the same is how a map ends up quietly missing its rivers. */
async function overpass(body, tries = 3) {
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    for (const url of ENDPOINTS) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
          body: "data=" + encodeURIComponent(body),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()).elements || [];
      } catch (e) { lastErr = e; }
    }
    const wait = 4000 * Math.pow(2, attempt);
    process.stdout.write(`    (${lastErr.message}, retrying in ${wait / 1000}s) `);
    await sleep(wait);
  }
  throw lastErr;
}

/* Douglas–Peucker. Straight segments cost nothing to keep and everything to store. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  let maxD = 0, idx = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}

const round = pts => pts.map(([x, y]) => [+x.toFixed(DP), +y.toFixed(DP)]);

/* OSM splits a road into a new way at every intersection, speed-limit change and
   bridge. Simplifying those fragments individually is nearly useless: a 2-point
   fragment has nothing to drop. Chain them end-to-end first, then simplify the
   whole road — which is where Douglas–Peucker actually earns its keep. */
function chain(lines) {
  const key = p => p[0].toFixed(6) + "," + p[1].toFixed(6);
  const ends = new Map();
  lines.forEach((l, i) => {
    for (const k of [key(l[0]), key(l[l.length - 1])]) {
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push(i);
    }
  });
  const used = new Array(lines.length).fill(false), out = [];
  const grab = (k, from) => {
    for (const i of ends.get(k) || []) if (i !== from && !used[i]) return i;
    return -1;
  };
  for (let i = 0; i < lines.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let run = lines[i].slice();
    for (;;) {                                   // extend forwards
      const k = key(run[run.length - 1]), j = grab(k, -1);
      if (j < 0) break;
      used[j] = true;
      const seg = key(lines[j][0]) === k ? lines[j] : lines[j].slice().reverse();
      run = run.concat(seg.slice(1));
    }
    for (;;) {                                   // and backwards
      const k = key(run[0]), j = grab(k, -1);
      if (j < 0) break;
      used[j] = true;
      const seg = key(lines[j][lines[j].length - 1]) === k ? lines[j] : lines[j].slice().reverse();
      run = seg.slice(0, -1).concat(run);
    }
    out.push(run);
  }
  return out;
}

console.log(`BASEMAP · ${city.name} · ${BB}`);
const layers = {};
let rawPts = 0, keptPts = 0, failed = 0;
const smallDropped = {};

for (const L of LAYERS) {
  let els;
  try { els = await overpass(`[out:json][timeout:180];(${L.q});out geom;`); }
  catch (e) { failed++; console.log(`  ${L.key.padEnd(10)} FAILED  ${e.message}`); continue; }

  const frags = [];
  for (const el of els) {
    const g = el.geometry || (el.members || []).flatMap(m => m.geometry || []);
    if (!g || g.length < 2) continue;
    const pts = g.filter(p => p && isFinite(p.lon) && isFinite(p.lat)).map(p => [p.lon, p.lat]);
    if (pts.length >= 2) { rawPts += pts.length; frags.push(pts); }
  }
  /* A farm pond and a rail yard spur cost bytes and add clutter without helping
     anyone orient. Drop features below a minimum extent — and say how many, because
     a silent cap reads as "this is everything". */
  const MIN = { water: 0.0035, rail: 0.004, secondary: 0.002 }[L.key] || 0;
  const lines = [];
  let dropped = 0;
  for (const run of chain(frags)) {
    if (MIN) {
      const xs = run.map(p => p[0]), ys = run.map(p => p[1]);
      const span = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      if (span < MIN) { dropped++; continue; }
    }
    const s = round(simplify(run, TOL[L.key]));
    if (s.length >= 2) { lines.push(s); keptPts += s.length; }
  }
  if (dropped) smallDropped[L.key] = dropped;
  layers[L.key] = lines;
  console.log(`  ${L.key.padEnd(10)} ${String(frags.length).padStart(5)} fragments → ${String(lines.length).padStart(5)} chained lines${dropped ? `  (${dropped} below minimum extent, dropped)` : ""}`);
  await sleep(1200);                                   // be a good citizen
}

let places = [];
try {
  const els = await overpass(`[out:json][timeout:120];(${PLACES_Q});out;`);
  const rank = { city: 0, town: 1, suburb: 2, neighbourhood: 3 };
  places = els
    .filter(e => e.tags?.name && isFinite(e.lon) && isFinite(e.lat))
    .map(e => ({ name: e.tags.name, kind: e.tags.place, at: [+e.lon.toFixed(DP), +e.lat.toFixed(DP)] }))
    .sort((a, b) => rank[a.kind] - rank[b.kind])
    .slice(0, 90);
  console.log(`  ${"places".padEnd(10)} ${String(places.length).padStart(5)} names`);
} catch (e) { failed++; console.log(`  places     FAILED  ${e.message}`); }

const out = {
  schema: "seres/basemap/v1",
  part: `basemap-${CITY}`,
  built_at: new Date().toISOString(),
  city: { slug: city.slug, name: city.name, bbox: city.bbox },
  evidence: false,
  note: "REFERENCE GEOMETRY. Not evidence and not claims. Drawn in a neutral weight beneath the field so a reader can tell where a claim is. It answers 'where am I', never 'what was said'.",
  acquisition: {
    source: "OpenStreetMap via Overpass API",
    mode: "Public API",
    license: "ODbL 1.0",
    attribution: "© OpenStreetMap contributors",
    simplification: `Douglas–Peucker per layer, ${DP} decimal places`,
    tolerances_deg: TOL,
  },
  small_features_dropped: smallDropped,
  totals: { layers: Object.keys(layers).length, lines: Object.values(layers).reduce((a, l) => a + l.length, 0), points: keptPts, points_before_simplify: rawPts, places: places.length, layers_failed: failed },
  layers,
  places,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);

console.log(`\n${out.totals.lines} lines · ${keptPts} points (from ${rawPts}, ${(100 - keptPts / rawPts * 100).toFixed(0)}% dropped) · ${places.length} names`);
if (failed) console.log(`⚠ ${failed} layer(s) failed. The map will be missing them — re-run before publishing.`);
console.log(`wrote ${path.relative(ROOT, OUT)}  (${kb} KB)   next: node seres/harness/build-atlas.mjs`);
