#!/usr/bin/env node
// ICOSA · gazetteer compiler
//
// The map showed less the deeper you went, which is the opposite of what a
// map is for. The cause was the source: Natural Earth 110m carries 243
// settlements and 13 rivers, so past continental scale there was nothing
// left to draw and a triangle became an empty tan field with a grid on it.
//
// This compiles the 10m tier instead — 7,342 settlements, named physical
// regions, named seas, airports, ports, rivers — plus country polygons, so
// a triangle can answer two questions it could not answer before:
//
//     what is in here
//     who would a concern about it be addressed to
//
// Output is a separate file from icosa-world.data.js: the instrument stays
// lean, and only the pages that need the weight pay for it.
//
// Run:  node icosa-gazetteer.build.mjs

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '.cache');
const OUT = join(HERE, 'icosa-gazetteer.data.js');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';

const SOURCES = {
  places: 'ne_10m_populated_places_simple.geojson',
  regions: 'ne_10m_geography_regions_points.geojson',
  marine: 'ne_10m_geography_marine_polys.geojson',
  airports: 'ne_10m_airports.geojson',
  ports: 'ne_10m_ports.geojson',
  rivers: 'ne_10m_rivers_lake_centerlines.geojson',
  countries: 'ne_50m_admin_0_countries.geojson',
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

/* --------------------------------------------------------------- helpers */

const q = (v, s) => Math.round(v * s);

// delta-encoded integer stream; the decoder is four lines
function encodePoints(xs, ys, scale) {
  const out = [];
  let px = 0, py = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = q(xs[i], scale), y = q(ys[i], scale);
    out.push(x - px, y - py);
    px = x; py = y;
  }
  return out.join(',');
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
function centroid(coords) {                 // rough, for a label point
  let sx = 0, sy = 0, n = 0;
  const walk = (a) => {
    if (typeof a[0] === 'number') { sx += a[0]; sy += a[1]; n++; return; }
    for (const b of a) walk(b);
  };
  walk(coords);
  return [sx / n, sy / n];
}
class Table {                                // shared strings, stored once
  constructor() { this.list = []; this.idx = new Map(); }
  id(s) {
    s = s || '';
    if (!this.idx.has(s)) { this.idx.set(s, this.list.length); this.list.push(s); }
    return this.idx.get(s);
  }
}

/* --------------------------------------------------------------- compile */

const t0 = Date.now();
const [places, regions, marine, airports, ports, rivers, countries] = await Promise.all(
  ['places', 'regions', 'marine', 'airports', 'ports', 'rivers', 'countries'].map(source)
);

// ---- settlements: the reason the deep view was empty -------------------
const adm0 = new Table(), adm1 = new Table(), kind = new Table();
const P = { n: [], x: [], y: [], p: [], a0: [], a1: [], k: [] };
for (const f of places.features) {
  const pr = f.properties;
  const [lon, lat] = f.geometry.coordinates;
  P.n.push(pr.name || pr.nameascii || '');
  P.x.push(lon); P.y.push(lat);
  P.p.push(Math.max(0, pr.pop_max | 0));
  P.a0.push(adm0.id(pr.adm0name));
  P.a1.push(adm1.id(pr.adm1name));
  P.k.push(kind.id(pr.featurecla));
}

// ---- named ground and named water --------------------------------------
const R = { n: [], x: [], y: [], t: [] };
const rkind = new Table();
for (const f of regions.features) {
  const pr = f.properties;
  if (!pr.name) continue;
  const c = f.geometry.type === 'Point' ? f.geometry.coordinates : centroid(f.geometry.coordinates);
  R.n.push(pr.name); R.x.push(c[0]); R.y.push(c[1]); R.t.push(rkind.id(pr.featurecla || pr.region || ''));
}
const M = { n: [], x: [], y: [] };
for (const f of marine.features) {
  const pr = f.properties;
  if (!pr.name) continue;
  const c = (pr.label_x != null && pr.label_y != null)
    ? [pr.label_x, pr.label_y] : centroid(f.geometry.coordinates);
  M.n.push(pr.name); M.x.push(c[0]); M.y.push(c[1]);
}

// ---- infrastructure: things with an operator you could write to --------
const A = { n: [], x: [], y: [], c: [] };
for (const f of airports.features) {
  const pr = f.properties;
  const c = f.geometry.type === 'Point' ? f.geometry.coordinates : centroid(f.geometry.coordinates);
  A.n.push(pr.name || ''); A.x.push(c[0]); A.y.push(c[1]); A.c.push(pr.iata_code || pr.abbrev || '');
}
const O = { n: [], x: [], y: [] };
for (const f of ports.features) {
  const pr = f.properties;
  const c = f.geometry.type === 'Point' ? f.geometry.coordinates : centroid(f.geometry.coordinates);
  O.n.push(pr.name || ''); O.x.push(c[0]); O.y.push(c[1]);
}

// ---- rivers: named only, simplified ------------------------------------
const riverLines = [], riverName = [], riverIdx = [];
for (const f of rivers.features) {
  const name = f.properties.name_en || f.properties.name;
  if (!name) continue;
  const g = f.geometry;
  const parts = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
  const from = riverLines.length;
  for (const part of parts) {
    const s = simplify(part, 0.05);
    if (s.length > 1) riverLines.push(s);
  }
  if (riverLines.length > from) { riverName.push(name); riverIdx.push([from, riverLines.length]); }
}

// ---- jurisdiction: who a concern would be addressed to -----------------
const C = { n: [], iso: [], box: [], idx: [] };
const countryRings = [];
for (const f of countries.features) {
  const pr = f.properties;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const from = countryRings.length;
  let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
  for (const poly of polys) {
    for (const ring of poly) {
      // A small country must not be simplified out of existence. Back the
      // tolerance off until the ring survives rather than dropping it —
      // losing a state here means losing the answer to who governs there.
      let s = simplify(ring, 0.15);
      if (s.length < 4) s = simplify(ring, 0.04);
      if (s.length < 4) s = simplify(ring, 0.01);
      if (s.length < 4) s = ring;
      if (s.length < 4) continue;
      countryRings.push(s);
      for (const [x, y] of s) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (countryRings.length === from) continue;
  C.n.push(pr.NAME || pr.ADMIN || '');
  C.iso.push(pr.ISO_A2 || pr.ISO_A2_EH || '');
  C.box.push([q(x0, 50), q(y0, 50), q(x1, 50), q(y1, 50)]);
  C.idx.push([from, countryRings.length]);
}

const payload = {
  meta: {
    built: 'icosa-gazetteer.build.mjs',
    sources: 'Natural Earth 10m (places, regions, marine, airports, ports, rivers) '
           + 'and 50m (admin-0 countries), public domain',
    why: 'A triangle has to be able to say what is inside it and who governs it, '
       + 'or descending into it shows less rather than more.',
    counts: {
      settlements: P.n.length, regions: R.n.length, seas: M.n.length,
      airports: A.n.length, ports: O.n.length, rivers: riverName.length, countries: C.n.length,
    },
  },
  adm0: adm0.list, adm1: adm1.list, kind: kind.list, rkind: rkind.list,
  places: { n: P.n, g: encodePoints(P.x, P.y, 1e3), p: P.p, a0: P.a0, a1: P.a1, k: P.k },
  regions: { n: R.n, g: encodePoints(R.x, R.y, 1e3), t: R.t },
  marine: { n: M.n, g: encodePoints(M.x, M.y, 1e3) },
  airports: { n: A.n, g: encodePoints(A.x, A.y, 1e3), c: A.c },
  ports: { n: O.n, g: encodePoints(O.x, O.y, 1e3) },
  rivers: { n: riverName, idx: riverIdx, g: encodeLines(riverLines, 1e3) },
  countries: { n: C.n, iso: C.iso, box: C.box, idx: C.idx, g: encodeLines(countryRings, 50) },
};

const js = `/* ICOSA · compiled gazetteer
   Generated by icosa-gazetteer.build.mjs — do not edit by hand.
   Natural Earth 10m and 50m, public domain.
   The answer to "what is actually in this triangle, and who governs it". */
window.ICOSA_GAZETTEER = ${JSON.stringify(payload)};
`;
writeFileSync(OUT, js);

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
process.stderr.write(
  `\nwrote ${OUT} (${kb(js.length)}) in ${((Date.now() - t0) / 1000).toFixed(1)}s\n` +
  Object.entries(payload.meta.counts).map(([k, v]) => `  ${k.padEnd(12)} ${v}\n`).join('') +
  `  admin-1 names ${adm1.list.length}\n`
);
