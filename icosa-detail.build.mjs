#!/usr/bin/env node
// ICOSA · detail compiler
//
// The settlements were upgraded to Natural Earth 10m and the coastline was
// not, so at regional scale the shore was still 110m simplified to about six
// kilometres — chunky, and indistinguishable from land because both were
// painted nearly the same colour. You could not tell sea from ground.
//
// This compiles the detail tier: a real coastline, lakes, the built-up
// areas that are the only honest way to paint "city" as an area rather than
// a dot, and the major road network. It is a third file, loaded only once
// you descend past continental scale — detail arrives where attention is.
//
// Run:  node icosa-detail.build.mjs

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '.cache');
const OUTDIR = join(HERE, 'detail');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const SOURCES = {
  land: 'ne_10m_land.geojson',
  lakes: 'ne_10m_lakes.geojson',
  urban: 'ne_10m_urban_areas.geojson',
  roads: 'ne_10m_roads.geojson',
};

async function source(key) {
  if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, SOURCES[key]);
  if (!existsSync(file)) {
    process.stderr.write(`fetch ${SOURCES[key]}\n`);
    const res = await fetch(NE + SOURCES[key]);
    if (!res.ok) throw new Error(`${SOURCES[key]} → ${res.status}`);
    writeFileSync(file, await res.text());
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

const q = (v, s) => Math.round(v * s);

/* ---- the icosahedron, so detail can be cut to the face that owns it ---- */
globalThis.window = {};
await import('./icosa-world.data.js');
const ICO = window.ICOSA_WORLD_DATA.ico;
const V = ICO.vertices, FACES = ICO.faces, NF = FACES.length;
const D2R = Math.PI / 180;
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const vec3 = (lon, lat) => {
  const p = lat * D2R, l = lon * D2R;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
};
const PLANES = FACES.map((f) => [nrm3(cross3(V[f[0]], V[f[1]])),
                                 nrm3(cross3(V[f[1]], V[f[2]])),
                                 nrm3(cross3(V[f[2]], V[f[0]]))]);
const BINV = FACES.map((f) => {
  const a = V[f[0]], b = V[f[1]], c = V[f[2]];
  const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - b[0] * (a[1] * c[2] - a[2] * c[1]) + c[0] * (a[1] * b[2] - a[2] * b[1]);
  return [
    [(b[1] * c[2] - b[2] * c[1]) / det, (c[0] * b[2] - b[0] * c[2]) / det, (b[0] * c[1] - c[0] * b[1]) / det],
    [(c[1] * a[2] - a[1] * c[2]) / det, (a[0] * c[2] - c[0] * a[2]) / det, (c[0] * a[1] - a[0] * c[1]) / det],
    [(a[1] * b[2] - b[1] * a[2]) / det, (b[0] * a[2] - a[0] * b[2]) / det, (a[0] * b[1] - b[0] * a[1]) / det]];
});
function bary(f, p) {
  const m = BINV[f];
  const a = dot3(m[0], p), b = dot3(m[1], p), c = dot3(m[2], p), s = a + b + c;
  return [a / s, b / s];
}
// straight in lon/lat is not straight on a sphere
function densify(pts, maxDeg) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    out.push(vec3(pts[i][0], pts[i][1]));
    if (i === pts.length - 1) break;
    const a = pts[i], b = pts[i + 1];
    const dl = b[0] - a[0], dp = b[1] - a[1];
    if (Math.abs(dl) > 180) continue;
    const n = Math.ceil(Math.max(Math.abs(dl), Math.abs(dp)) / maxDeg);
    for (let k = 1; k < n; k++) out.push(vec3(a[0] + dl * k / n, a[1] + dp * k / n));
  }
  return out;
}
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function clipPoly(poly, f) {
  let cur = poly;
  for (let i = 0; i < 3 && cur.length; i++) {
    const n = PLANES[f][i], next = [];
    for (let j = 0; j < cur.length; j++) {
      const a = cur[j], b = cur[(j + 1) % cur.length];
      const da = dot3(a, n), db = dot3(b, n);
      if (da >= 0) next.push(a);
      if ((da >= 0) !== (db >= 0)) next.push(nrm3(lerp3(a, b, da / (da - db))));
    }
    cur = next;
  }
  return cur;
}
function clipLine(line, f) {
  let parts = [line];
  for (let i = 0; i < 3; i++) {
    const n = PLANES[f][i], next = [];
    for (const seg of parts) {
      let run = [];
      for (let j = 0; j < seg.length - 1; j++) {
        const a = seg[j], b = seg[j + 1], da = dot3(a, n), db = dot3(b, n);
        if (da >= 0 && db >= 0) { if (!run.length) run.push(a); run.push(b); }
        else if (da >= 0) {
          if (!run.length) run.push(a);
          run.push(nrm3(lerp3(a, b, da / (da - db))));
          if (run.length > 1) next.push(run);
          run = [];
        } else if (db >= 0) run = [nrm3(lerp3(a, b, da / (da - db))), b];
      }
      if (run.length > 1) next.push(run);
    }
    parts = next;
  }
  return parts;
}
// barycentric, delta-encoded — two numbers per point, the third is implied
function encodeBary(f, groups, scale) {
  return groups.map((pts) => {
    const out = [];
    let px = 0, py = 0;
    for (const p of pts) {
      const w = bary(f, p);
      const x = q(w[0], scale), y = q(w[1], scale);
      out.push(x - px, y - py);
      px = x; py = y;
    }
    return out.join(',');
  }).join(';');
}

function encodeLines(lines, scale) {
  return lines.map((pts) => {
    const out = [];
    let px = 0, py = 0;
    for (const [lon, lat] of pts) {
      const x = q(lon, scale), y = q(lat, scale);
      out.push(x - px, y - py);
      px = x; py = y;
    }
    return out.join(',');
  }).join(';');
}
function simplify(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let far = -1, fd = tol;
    const [ax, ay] = points[i], [bx, by] = points[j];
    const dx = bx - ax, dy = by - ay, dd = dx * dx + dy * dy;
    for (let k = i + 1; k < j; k++) {
      const [px, py] = points[k];
      let t = dd ? ((px - ax) * dx + (py - ay) * dy) / dd : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > fd) { fd = d; far = k; }
    }
    if (far > 0) { keep[far] = 1; stack.push([i, far], [far, j]); }
  }
  return points.filter((_, i) => keep[i]);
}
const ringArea = (r) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return Math.abs(a / 2);
};
function rings(feature, tol, minArea) {
  const g = feature.geometry, out = [];
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) for (const ring of poly) {
    let s = simplify(ring, tol);
    if (s.length < 4) s = simplify(ring, tol / 6);
    if (s.length < 4 || ringArea(s) < minArea) continue;
    out.push(s);
  }
  return out;
}

const t0 = Date.now();
const [land, lakes, urban, roads] = await Promise.all(
  ['land', 'lakes', 'urban', 'roads'].map(source)
);

// the coastline, at a resolution that survives being looked at closely
const coast = [];
for (const f of land.features) coast.push(...rings(f, 0.012, 0.00004));

const lake = [];
for (const f of lakes.features) lake.push(...rings(f, 0.012, 0.0004));

// built-up land: the only honest way to paint a city as an area
const town = [];
for (const f of urban.features) {
  if ((f.properties.scalerank | 0) > 8) continue;
  town.push(...rings(f, 0.008, 0.00002));
}

// the road network people actually navigate by, not every track
const KEEP = { 'Major Highway': 1, 'Beltway': 1, 'Secondary Highway': 1 };
const road = [];
for (const f of roads.features) {
  if (!KEEP[f.properties.type]) continue;
  const g = f.geometry;
  const parts = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
  for (const part of parts) {
    const s = simplify(part, 0.01);
    if (s.length > 1) road.push(s);
  }
}

// cut everything to the face that owns it, so a reader downloads the
// ground they are looking at and not the rest of the planet
const layers = {
  coast: { rings: coast, poly: true, dens: 0.35 },
  lakes: { rings: lake, poly: true, dens: 0.35 },
  urban: { rings: town, poly: true, dens: 0.35 },
  roads: { rings: road, poly: false, dens: 0.35 },
};
for (const L of Object.values(layers)) L.pre = L.rings.map((r) => densify(r, L.dens));

if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });
let total = 0;
const report = [];
for (let f = 0; f < NF; f++) {
  const out = { face: f };
  for (const [name, L] of Object.entries(layers)) {
    const got = [];
    for (const pre of L.pre) {
      if (L.poly) { const c = clipPoly(pre, f); if (c.length > 2) got.push(c); }
      else for (const part of clipLine(pre, f)) got.push(part);
    }
    out[name] = encodeBary(f, got, 1e5);
  }
  const js = `window.ICOSA_DETAIL_${String(f).padStart(2, '0')} = ${JSON.stringify(out)};\n`;
  const path = join(OUTDIR, `f${String(f).padStart(2, '0')}.js`);
  writeFileSync(path, js);
  total += js.length;
  report.push(`  f${String(f).padStart(2, '0')}  ${(js.length / 1024).toFixed(0).padStart(5)} KB`);
}
process.stderr.write(
  `\nwrote ${NF} face files to ${OUTDIR} (${(total / 1024).toFixed(0)} KB total, ` +
  `${(total / NF / 1024).toFixed(0)} KB average) in ${((Date.now() - t0) / 1000).toFixed(1)}s\n` +
  `  coast ${coast.length}  lakes ${lake.length}  urban ${town.length}  roads ${road.length}\n` +
  report.join('\n') + '\n'
);
