#!/usr/bin/env node
// ICOSA WORLD · world compiler
//
// The program owns no coordinates of its own. This script derives every
// constant that icosa-world.html depends on and writes them to
// icosa-world.data.js. Nothing in the map is hand-placed.
//
// What is derived here, and why it is derived rather than cited:
//
//   1. The icosahedron itself (12 vertices, 30 edges, 20 faces) from the
//      golden-ratio construction.
//   2. Its orientation on the Earth. Fuller chose an orientation whose
//      twelve vertices fall in water, so that no vertex punctures a
//      landmass. Rather than copy his published table we restate the
//      criterion and solve it: search SO(3) for the rotation that
//      maximises the minimum distance from any vertex to any land.
//   3. The unfolding tree. A net is a spanning tree of the face adjacency
//      graph; the eleven edges left out of the tree are the cuts. Fuller's
//      criterion again: cut where there is no land. We weight each of the
//      thirty edges by how much land its arc crosses and take a maximum
//      spanning tree, so the cuts land in ocean.
//   4. Land, lakes, rivers and cities, simplified and quantised.
//
// Source geometry: Natural Earth 110m (public domain), fetched on demand
// and cached under .cache/. Run:  node icosa-world.build.mjs
//
// Everything downstream of this file is topology. See ICOSA-WORLD.md.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '.cache');
const OUT = join(HERE, 'icosa-world.data.js');

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const SOURCES = {
  land: 'ne_110m_land.geojson',
  lakes: 'ne_110m_lakes.geojson',
  rivers: 'ne_110m_rivers_lake_centerlines.geojson',
  places: 'ne_110m_populated_places_simple.geojson',
};

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const EARTH_R = 6371.0088; // km, mean radius

/* ---------------------------------------------------------------- fetch -- */

async function source(key) {
  if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, SOURCES[key]);
  if (!existsSync(file)) {
    const url = NE + SOURCES[key];
    process.stderr.write(`fetch ${url}\n`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    writeFileSync(file, await res.text());
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

/* ------------------------------------------------------------- vectors -- */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function toVec(lon, lat) {
  const p = lat * D2R, l = lon * D2R;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}
function toLonLat(v) {
  return [Math.atan2(v[1], v[0]) * R2D, Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D];
}
const arcKm = (a, b) =>
  EARTH_R * Math.acos(Math.max(-1, Math.min(1, dot(a, b))));

function quatToMat(q) {
  const [x, y, z, w] = q;
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}
const applyMat = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];

function randomQuat(rnd) {
  // Shoemake: uniform over SO(3)
  const u1 = rnd(), u2 = rnd(), u3 = rnd();
  const s1 = Math.sqrt(1 - u1), s2 = Math.sqrt(u1);
  return [
    s1 * Math.sin(2 * Math.PI * u2), s1 * Math.cos(2 * Math.PI * u2),
    s2 * Math.sin(2 * Math.PI * u3), s2 * Math.cos(2 * Math.PI * u3),
  ];
}
function quatMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
function smallQuat(rnd, angle) {
  const axis = norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
  const h = angle / 2, s = Math.sin(h);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(h)];
}
// deterministic rng — the build must be reproducible
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------- icosahedron -- */

function icosahedron() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const raw = [];
  for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
    raw.push([0, s1, s2 * phi], [s1, s2 * phi, 0], [s2 * phi, 0, s1]);
  }
  const V = raw.map(norm);

  // edges: the twelve vertices have five nearest neighbours each
  let minD = Infinity;
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
    minD = Math.min(minD, len(sub(V[i], V[j])));
  }
  const isEdge = (i, j) => len(sub(V[i], V[j])) < minD * 1.1;
  const edges = [];
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if (isEdge(i, j)) edges.push([i, j]);

  // faces: triangles in the edge graph, wound counter-clockwise from outside
  const faces = [];
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) {
    if (!isEdge(i, j) || !isEdge(j, k) || !isEdge(i, k)) continue;
    const tri = [i, j, k];
    const n = cross(sub(V[j], V[i]), sub(V[k], V[i]));
    if (dot(n, add(add(V[i], V[j]), V[k])) < 0) tri.reverse();
    faces.push(tri);
  }
  if (V.length !== 12 || edges.length !== 30 || faces.length !== 20) {
    throw new Error(`degenerate icosahedron ${V.length}/${edges.length}/${faces.length}`);
  }
  return { V, edges, faces };
}

/* ------------------------------------------------------------ landmask -- */

// 2° cell grid, even-odd point-in-polygon in plate carrée. Natural Earth
// geometry is authored for plate carrée, so a planar test is the correct
// one here — including Antarctica, whose ring closes along lat -90.
function buildLandMask(land, step = 2) {
  const rings = [];
  for (const f of land.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) for (const ring of poly) rings.push(ring);
  }
  const inside = (lon, lat) => {
    let hit = false;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
      }
    }
    return hit;
  };
  const cells = [];
  for (let lat = -90 + step / 2; lat < 90; lat += step) {
    for (let lon = -180 + step / 2; lon < 180; lon += step) {
      if (inside(lon, lat)) cells.push(toVec(lon, lat));
    }
  }
  return { cells, step, inside };
}

// distance from a point to the nearest land, in km, floored at the mask
// resolution — good to a couple of hundred km, which is the scale the
// orientation question is asked at.
function clearanceKm(v, mask) {
  let best = Infinity;
  for (const c of mask.cells) {
    const d = dot(v, c);
    if (d > best) best = d;
  }
  return EARTH_R * Math.acos(Math.max(-1, Math.min(1, best)));
}
function clearanceOf(v, mask) {
  let bestDot = -1;
  for (const c of mask.cells) { const d = dot(v, c); if (d > bestDot) bestDot = d; }
  const km = EARTH_R * Math.acos(Math.max(-1, Math.min(1, bestDot)));
  const [lon, lat] = toLonLat(v);
  return mask.inside(lon, lat) ? -km : km;
}

/* -------------------------------------------- orientation on the Earth -- */

function solveOrientation(V, mask) {
  const score = (m) => {
    let worst = Infinity;
    for (const v of V) {
      const c = clearanceOf(applyMat(m, v), mask);
      if (c < worst) worst = c;
      if (worst < -1) break; // a vertex on land is already disqualifying
    }
    return worst;
  };
  const rnd = mulberry32(20260808);
  let bestQ = [0, 0, 0, 1], bestS = score(quatToMat(bestQ));
  for (let i = 0; i < 4000; i++) {
    const q = randomQuat(rnd), s = score(quatToMat(q));
    if (s > bestS) { bestS = s; bestQ = q; }
  }
  for (let angle = 0.35; angle > 0.0004; angle *= 0.86) {
    for (let i = 0; i < 220; i++) {
      const q = quatMul(smallQuat(rnd, angle * (0.3 + rnd())), bestQ);
      const s = score(quatToMat(q));
      if (s > bestS) { bestS = s; bestQ = q; }
    }
  }
  return { quat: bestQ, mat: quatToMat(bestQ), minClearanceKm: bestS };
}

/* --------------------------------------------------- the unfolding net -- */

function faceAdjacency(faces) {
  const key = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const byEdge = new Map();
  faces.forEach((f, i) => {
    for (let e = 0; e < 3; e++) {
      const k = key(f[e], f[(e + 1) % 3]);
      if (!byEdge.has(k)) byEdge.set(k, []);
      byEdge.get(k).push({ face: i, edge: e, v: [f[e], f[(e + 1) % 3]] });
    }
  });
  const links = [];
  const adj = faces.map(() => [null, null, null]);
  for (const [, pair] of byEdge) {
    if (pair.length !== 2) throw new Error('non-manifold icosahedron');
    const [a, b] = pair;
    const id = links.length;
    links.push({ id, a: a.face, b: b.face, ea: a.edge, eb: b.edge, v: a.v });
    adj[a.face][a.edge] = { face: b.face, edge: b.edge, link: id };
    adj[b.face][b.edge] = { face: a.face, edge: a.edge, link: id };
  }
  return { links, adj };
}

// how much land an edge's arc crosses, sampled along the great circle
function edgeLandCost(V, link, mask) {
  const a = V[link.v[0]], b = V[link.v[1]];
  let hits = 0;
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = norm(add(mul(a, 1 - t), mul(b, t)));
    const [lon, lat] = toLonLat(p);
    if (mask.inside(lon, lat)) hits++;
  }
  return hits / (N + 1);
}

// unfold onto the plane: each face is the same equilateral triangle,
// reflected across the hinge it shares with its parent
const SQ3 = Math.sqrt(3);
function layoutNet(faces, adj, root, parentOf, hingeOf) {
  const base = [[0, 0], [1, 0], [0.5, SQ3 / 2]];
  const pos = new Array(faces.length).fill(null);
  pos[root] = base.map((p) => [...p]);
  const order = [root];
  const queue = [root];
  while (queue.length) {
    const f = queue.shift();
    for (let e = 0; e < 3; e++) {
      const nb = adj[f][e].face;
      if (parentOf[nb] !== f || pos[nb]) continue;
      // reflect the far corner of f across the shared edge
      const A = pos[f][e], B = pos[f][(e + 1) % 3], C = pos[f][(e + 2) % 3];
      const dx = B[0] - A[0], dy = B[1] - A[1];
      const dd = dx * dx + dy * dy;
      const t = ((C[0] - A[0]) * dx + (C[1] - A[1]) * dy) / dd;
      const px = A[0] + t * dx, py = A[1] + t * dy;
      const C2 = [2 * px - C[0], 2 * py - C[1]];
      // neighbour's shared edge runs the other way
      const eb = adj[f][e].edge;
      const p = [null, null, null];
      p[eb] = B; p[(eb + 1) % 3] = A; p[(eb + 2) % 3] = C2;
      pos[nb] = p;
      order.push(nb);
      queue.push(nb);
    }
  }
  return { pos, order };
}

function netOverlaps(pos) {
  const seen = new Set();
  for (const p of pos) {
    if (!p) return true;
    const cx = (p[0][0] + p[1][0] + p[2][0]) / 3;
    const cy = (p[0][1] + p[1][1] + p[2][1]) / 3;
    const k = `${Math.round(cx * 1e4)}:${Math.round(cy * 1e4)}`;
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
}

function solveNet(V, faces, links, adj, mask) {
  const cost = links.map((l) => edgeLandCost(V, l, mask));
  const rnd = mulberry32(410);
  let best = null;

  const attempt = (jitter, root) => {
    // maximum spanning tree on land cost: keep land-crossing edges joined,
    // leave the ocean ones to be cut
    const idx = links.map((l, i) => i)
      .sort((a, b) => (cost[b] + jitter[b]) - (cost[a] + jitter[a]));
    const parent = new Array(faces.length).fill(-1);
    const find = (x) => { while (parent[x] >= 0) x = parent[x]; return x; };
    const tree = [];
    for (const i of idx) {
      const ra = find(links[i].a), rb = find(links[i].b);
      if (ra === rb) continue;
      parent[ra] = rb;
      tree.push(i);
      if (tree.length === faces.length - 1) break;
    }
    const inTree = new Set(tree);
    // root the tree
    const nbrs = faces.map(() => []);
    for (const i of tree) { nbrs[links[i].a].push(links[i].b); nbrs[links[i].b].push(links[i].a); }
    const parentOf = new Array(faces.length).fill(-1);
    const hingeOf = new Array(faces.length).fill(-1);
    const seen = new Set([root]);
    const q = [root];
    while (q.length) {
      const f = q.shift();
      for (let e = 0; e < 3; e++) {
        const nb = adj[f][e];
        if (!inTree.has(nb.link) || seen.has(nb.face)) continue;
        seen.add(nb.face);
        parentOf[nb.face] = f;
        hingeOf[nb.face] = nb.edge; // edge index on the child
        q.push(nb.face);
      }
    }
    if (seen.size !== faces.length) return null;
    const { pos, order } = layoutNet(faces, adj, root, parentOf, hingeOf);
    if (netOverlaps(pos)) return null;
    const cut = links.map((l, i) => i).filter((i) => !inTree.has(i));
    const cutLand = cut.reduce((s, i) => s + cost[i], 0);
    // compactness: a net that sprawls is harder to hold on a phone
    const xs = pos.flat().map((p) => p[0]), ys = pos.flat().map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    return { root, parentOf, hingeOf, pos, order, tree, cut, cutLand, w, h };
  };

  for (let root = 0; root < faces.length; root++) {
    for (let trial = 0; trial < 40; trial++) {
      const jitter = links.map(() => (trial === 0 ? 0 : (rnd() - 0.5) * 0.14));
      const r = attempt(jitter, root);
      if (!r) continue;
      // primary: cut no land. secondary: stay compact.
      r.score = -r.cutLand * 100 - Math.max(r.w / r.h, r.h / r.w);
      if (!best || r.score > best.score) best = r;
    }
  }
  if (!best) throw new Error('no non-overlapping net found');
  best.cost = cost;
  return best;
}

/* ------------------------------------------------------ line geometry -- */

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
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  }
  return Math.abs(a / 2);
};

// quantise to 1/100° and delta-encode; the decoder is six lines
function encodeLines(lines, q = 100) {
  return lines.map((pts) => {
    const out = [];
    let px = 0, py = 0;
    for (const [lon, lat] of pts) {
      const x = Math.round(lon * q), y = Math.round(lat * q);
      out.push(x - px, y - py);
      px = x; py = y;
    }
    return out.join(',');
  }).join(';');
}

/* ------------------------------------------------------------ councils -- */
//
// The same solid, used twice. The map spends the icosahedron on space: 20
// faces of Earth, 12 vertices in the sea. A syntegration spends it on
// discourse: the 30 edges are 30 people, the 12 vertices are 12 topics,
// every person sits in exactly two rooms, and the geometry rather than a
// chairperson guarantees that everything said reverberates.
//
// Two findings this block derives rather than assumes, because the design
// stands on both:
//
//   1. A council cannot be scaled by subdividing the world. Every geodesic
//      subdivision of an icosahedron has exactly twelve five-valent
//      vertices and all the rest six-valent, at any frequency, forever —
//      Euler's formula, the same fact that puts twelve pentagons on a
//      football. Topic size IS vertex degree, so a subdivided council would
//      permanently seat twelve people in smaller rooms than everybody else.
//      Change solid; never change frequency.
//
//   2. The icosahedron is the largest solid in this family in which every
//      pair of topics still shares a person. Above it, closure stops being
//      a property of the object and becomes a statistic. Larger solids buy
//      headcount and pay for it in reverberation.
//
// It also assigns a register of description to every strut, so that the
// solid enforces the epistemology instead of the facilitator: each strut is
// critiqued by the register incommensurable with its own, and no room is
// ever all one kind of description. "Data versus anecdote" becomes
// structurally unavailable.

// Registers are ways of describing a place, not people. Nothing here
// simulates a resident: synthesising testimony and attaching it to a real
// place is the laundering this whole apparatus exists to expose.
const REGISTERS = [
  { id: 'COORDINATE', opposite: 'BODY',
    may: 'report what the administrative and measured record contains, with its source',
    mayNot: 'say anything the record does not contain' },
  { id: 'BODY', opposite: 'COORDINATE',
    may: 'derive the bodily consequence of a cited fact, marked as a derivation',
    mayNot: 'invent testimony or speak in the first person for anyone' },
  { id: 'RECORD', opposite: 'ABSENCE',
    may: 'speak only with a citation, and stay silent otherwise',
    mayNot: 'assert anything uncited' },
  { id: 'ABSENCE', opposite: 'RECORD',
    may: 'name the schema slots that have no entries for this cell',
    mayNot: 'explain why they are empty' },
  { id: 'CATEGORY', opposite: 'RECURSION',
    may: 'name the classification in force here and who authored it',
    mayNot: 'say the classification is correct' },
  { id: 'RECURSION', opposite: 'CATEGORY',
    may: 'point to a description in the record that has already returned as environment',
    mayNot: 'predict' },
];
const OPPOSED = [['COORDINATE', 'BODY'], ['RECORD', 'ABSENCE'], ['CATEGORY', 'RECURSION']];

function solidFamily() {
  const P = (1 + Math.sqrt(5)) / 2;
  const cyc = (v) => [[v[0], v[1], v[2]], [v[1], v[2], v[0]], [v[2], v[0], v[1]]];
  const spread = (base, sx, sy, sz, doCyc) => {
    const out = [];
    for (const s0 of (sx ? [-1, 1] : [1])) for (const s1 of (sy ? [-1, 1] : [1])) for (const s2 of (sz ? [-1, 1] : [1])) {
      const v = [base[0] * s0, base[1] * s1, base[2] * s2];
      for (const c of (doCyc ? cyc(v) : [v])) out.push(c);
    }
    return out;
  };
  const dedupe = (vs) => {
    const m = new Map();
    for (const v of vs) m.set(v.map((x) => x.toFixed(9)).join(','), norm(v));
    return [...m.values()];
  };
  return {
    tetrahedron: dedupe([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]),
    octahedron: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
    cube: dedupe(spread([1, 1, 1], 1, 1, 1, false)),
    cuboctahedron: dedupe(spread([1, 1, 0], 1, 1, 0, true)),
    icosahedron: dedupe(spread([0, 1, P], 0, 1, 1, true)),
    dodecahedron: dedupe([...spread([1, 1, 1], 1, 1, 1, false), ...spread([0, 1 / P, P], 0, 1, 1, true)]),
    rhombicuboctahedron: dedupe(spread([1, 1, 1 + Math.SQRT2], 1, 1, 1, true)),
    icosidodecahedron: dedupe([...spread([0, 0, P], 0, 0, 1, true),
                               ...spread([0.5, P / 2, P * P / 2], 1, 1, 1, true)]),
  };
}

// A council needs: equal-sized topics, and an antipodal partner for every
// strut so that critic seats exist and are the furthest seats away.
function analyseCouncil(name, V, edgesIn) {
  let minD = Infinity;
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
    minD = Math.min(minD, len(sub(V[i], V[j])));
  }
  const E = edgesIn || (() => {
    const out = [];
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
      if (len(sub(V[i], V[j])) < minD * 1.02) out.push([i, j]);
    }
    return out;
  })();

  const members = V.map(() => []);
  E.forEach((e, i) => { members[e[0]].push(i); members[e[1]].push(i); });
  const sizes = [...new Set(members.map((m) => m.length))];

  // the critic seat: the strut diametrically opposite this one
  const mid = (e) => mul(add(V[e[0]], V[e[1]]), 0.5);
  const partner = E.map((e, i) => {
    const m = mid(e);
    let best = -1, bd = Infinity;
    E.forEach((f, j) => {
      if (i === j) return;
      const d = len(add(m, mid(f)));
      if (d < bd) { bd = d; best = j; }
    });
    return bd < 1e-9 ? best : -1;
  });
  const paired = partner.every((p) => p >= 0);
  const critics = E.map((e, i) => (partner[i] >= 0 ? E[partner[i]] : null));
  const fourDistinct = E.every((e, i) => critics[i] && new Set([...e, ...critics[i]]).size === 4);

  // closure: does every pair of topics share at least one person?
  const touch = E.map((e, i) => new Set(critics[i] ? [...e, ...critics[i]] : e));
  let pairs = 0, covered = 0, least = Infinity;
  for (let a = 0; a < V.length; a++) for (let b = a + 1; b < V.length; b++) {
    pairs++;
    let c = 0;
    touch.forEach((t) => { if (t.has(a) && t.has(b)) c++; });
    if (c > 0) covered++;
    least = Math.min(least, c);
  }
  // how many rooms apart can two topics be
  const adj = V.map(() => []);
  E.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  let diameter = 0;
  for (let s = 0; s < V.length; s++) {
    const d = new Array(V.length).fill(-1); d[s] = 0;
    const q = [s];
    while (q.length) { const u = q.shift(); for (const v of adj[u]) if (d[v] < 0) { d[v] = d[u] + 1; q.push(v); } }
    d.forEach((x) => { if (x > diameter) diameter = x; });
  }
  return {
    name, people: E.length, topics: V.length,
    perTopic: sizes.length === 1 ? sizes[0] : sizes.sort((a, b) => a - b),
    equalTopics: sizes.length === 1,
    criticSeats: paired && fourDistinct,
    closure: covered === pairs, covered, pairs, leastShared: least === Infinity ? 0 : least,
    diameter, edges: E, critics, partner, members,
  };
}

// Seat the registers so the geometry does the arguing: opposites face each
// other across the solid, and every room hears as many different kinds of
// description as it has seats.
function assignRegisters(c, seed) {
  if (!c.criticSeats) return null;
  const pairs = [];
  const seen = new Set();
  c.partner.forEach((p, i) => { if (seen.has(i)) return; seen.add(i); seen.add(p); pairs.push([i, p]); });
  const build = (choice) => {
    const a = new Array(c.people);
    pairs.forEach(([x, y], k) => {
      const [p, o] = choice[k];
      a[x] = OPPOSED[p][o]; a[y] = OPPOSED[p][1 - o];
    });
    return a;
  };
  const want = Math.min(c.equalTopics ? c.perTopic : Math.min(...c.perTopic), REGISTERS.length);
  const score = (a) => {
    let full = 0, worst = 99;
    for (const m of c.members) {
      const k = new Set(m.map((i) => a[i])).size;
      if (k >= want) full++;
      worst = Math.min(worst, k);
    }
    return [full, worst];
  };
  const rnd = mulberry32(seed);
  let best = null;
  for (let restart = 0; restart < 3000 && (!best || best.full < c.topics); restart++) {
    const choice = pairs.map(() => [Math.floor(rnd() * 3), rnd() < 0.5 ? 0 : 1]);
    let cur = build(choice), [full, worst] = score(cur);
    for (let step = 0; step < 2500 && full < c.topics; step++) {
      const k = Math.floor(rnd() * pairs.length);
      const old = choice[k].slice();
      choice[k] = [Math.floor(rnd() * 3), rnd() < 0.5 ? 0 : 1];
      const cand = build(choice), [f2, w2] = score(cand);
      if (f2 > full || (f2 === full && w2 > worst)) { cur = cand; full = f2; worst = w2; }
      else choice[k] = old;
    }
    if (!best || full > best.full) best = { full, worst, seats: cur };
  }
  const opposedOk = c.partner.every((p, i) =>
    OPPOSED.some((o) => (o[0] === best.seats[i] && o[1] === best.seats[p]) ||
                        (o[1] === best.seats[i] && o[0] === best.seats[p])));
  const tally = {};
  best.seats.forEach((r) => { tally[r] = (tally[r] || 0) + 1; });
  return {
    seats: best.seats, wanted: want, roomsFullyMixed: best.full, fewestKinds: best.worst,
    opposedAcross: opposedOk, perRegister: tally,
  };
}

// Finding 1, checked rather than recited: twelve fives at every frequency.
function subdivisionDegeneracy(V0, F0, steps) {
  let V = V0.map((v) => [...v]), F = F0.map((f) => [...f]);
  const out = [];
  for (let s = 0; s <= steps; s++) {
    const deg = new Map();
    const key = (i) => V[i].map((x) => x.toFixed(7)).join(',');
    const link = (a, b) => {
      for (const [p, q] of [[a, b], [b, a]]) {
        const k = key(p);
        if (!deg.has(k)) deg.set(k, new Set());
        deg.get(k).add(key(q));
      }
    };
    for (const f of F) { link(f[0], f[1]); link(f[1], f[2]); link(f[0], f[2]); }
    const hist = {};
    for (const set of deg.values()) hist[set.size] = (hist[set.size] || 0) + 1;
    let people = 0;
    for (const set of deg.values()) people += set.size;
    out.push({ frequency: Math.pow(2, s), topics: deg.size, people: people / 2, degrees: hist });
    if (s === steps) break;
    const idx = new Map(V.map((v, i) => [v.map((x) => x.toFixed(7)).join(','), i]));
    const nf = [];
    const midx = (a, b) => {
      const m = norm(mul(add(V[a], V[b]), 0.5));
      const k = m.map((x) => x.toFixed(7)).join(',');
      if (!idx.has(k)) { idx.set(k, V.length); V.push(m); }
      return idx.get(k);
    };
    for (const [a, b, c] of F) {
      const ab = midx(a, b), bc = midx(b, c), ca = midx(c, a);
      nf.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    F = nf;
  }
  return out;
}

// A council has to be seatable in the ground it governs, or it is not that
// ground's council. Two of the solids embed in a triangle exactly, and the
// embedding puts their topics on the points a cell SHARES with its
// neighbours — so adjacent councils hold topics in common, which is the
// reverberation between rooms that a single solid cannot supply.
//
//   tetrahedron ≅ 3 corners + centroid          every pair joined
//   octahedron  ≅ 3 corners + 3 edge midpoints  each corner opposite the
//                                               midpoint of the far edge
//
// The cube does not embed: 3 corners + 3 midpoints + a centroid is seven
// points, not eight. It stays in the family table as evidence and off the
// ladder — which costs nothing, since the octahedron seats the same twelve
// people with better closure (every topic pair shares 4 rather than 2) and
// a shorter diameter.
//
// The icosahedron is the exception and the top of the ladder: its twelve
// topics are the world's own vertices and its thirty struts are the world's
// own edges, so it seats the planet rather than any one cell.
const B_A = [1, 0, 0], B_B = [0, 1, 0], B_C = [0, 0, 1];
const bmid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
const EMBEDDINGS = {
  world: {
    solid: 'icosahedron',
    seats: 'the world\'s twelve vertices and thirty edges',
    points: null,                       // the icosahedron itself
  },
  'corners+midpoints': {
    solid: 'octahedron',
    seats: 'the three corners and three edge midpoints of the cell',
    // canonical octahedron order (+x,−x,+y,−y,+z,−z), so the three
    // non-adjacent pairs are (0,1) (2,3) (4,5): corner ↔ opposite midpoint
    points: [B_A, bmid(B_B, B_C), B_B, bmid(B_A, B_C), B_C, bmid(B_A, B_B)],
    labels: ['A', 'mBC', 'B', 'mAC', 'C', 'mAB'],
  },
  'corners+centroid': {
    solid: 'tetrahedron',
    seats: 'the three corners and the centroid of the cell',
    points: [B_A, B_B, B_C, [1 / 3, 1 / 3, 1 / 3]],
    labels: ['A', 'B', 'C', 'centre'],
  },
};

const LADDER = [
  { scale: 'EARTH',         minKm: 2500,  solid: 'icosahedron', seating: 'world' },
  { scale: 'CONTINENTAL',   minKm: 700,   solid: 'octahedron',  seating: 'corners+midpoints' },
  { scale: 'REGIONAL',      minKm: 150,   solid: 'octahedron',  seating: 'corners+midpoints' },
  { scale: 'METROPOLITAN',  minKm: 20,    solid: 'octahedron',  seating: 'corners+midpoints' },
  { scale: 'NEIGHBOURHOOD', minKm: 4,     solid: 'octahedron',  seating: 'corners+midpoints' },
  { scale: 'BLOCK',         minKm: 0.8,   solid: 'tetrahedron', seating: 'corners+centroid' },
  { scale: 'BUILDING',      minKm: 0.06,  solid: null,          seating: null },
  { scale: 'ROOM',          minKm: 0.012, solid: null,          seating: null },
  { scale: 'OBJECT',        minKm: 0.003, solid: null,          seating: null },
  { scale: 'EVENT',         minKm: 0,     solid: null,          seating: null },
];

// The embedding is a claim about a graph, so check it as one: the struts the
// geometry hands us must be exactly the struts the triangle rule hands us.
function checkEmbedding(key, council) {
  const emb = EMBEDDINGS[key];
  if (!emb.points) return { key, solid: emb.solid, exact: true, note: 'the world itself' };
  const n = emb.points.length;
  if (n !== council.topics) throw new Error(`${key}: ${n} points for ${council.topics} topics`);
  const same = (p, q) => p.every((x, i) => Math.abs(x - q[i]) < 1e-12);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (same(emb.points[i], emb.points[j])) throw new Error(`${key}: two topics at one point`);
  }
  const have = new Set(council.edges.map(([a, b]) => (a < b ? a + ',' + b : b + ',' + a)));
  // the triangle rule: every pair joined, except a corner and the midpoint
  // of the edge opposite it — which is exactly non-adjacency in the solid
  const want = new Set();
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const opposite = emb.labels[i][0] === 'm'
      ? emb.labels[i].slice(1).indexOf(emb.labels[j]) < 0 && emb.labels[j].length === 1
      : emb.labels[j][0] === 'm' && emb.labels[j].slice(1).indexOf(emb.labels[i]) < 0;
    if (!opposite) want.add(i + ',' + j);
  }
  const exact = have.size === want.size && [...want].every((k) => have.has(k));
  if (!exact) throw new Error(`${key} does not embed in a triangle: ${[...have]} vs ${[...want]}`);
  return { key, solid: emb.solid, exact: true, topics: n, struts: council.edges.length, note: emb.seats };
}

function buildCouncils(icoV, icoFaces, links) {
  const family = solidFamily();
  const seated = new Set(LADDER.map((l) => l.solid).filter(Boolean));
  const seatingOf = {};
  LADDER.forEach((l) => { if (l.solid) seatingOf[l.solid] = l.seating; });
  const all = [], detail = {}, embeds = [];
  let seed = 7;
  for (const [name, V] of Object.entries(family)) {
    // the icosahedron reuses the map's own edge numbering, so strut i here
    // is ico.edges[i] there and the two halves of the solid stay addressable
    const c = analyseCouncil(name, V, name === 'icosahedron' ? links.map((l) => l.v) : null);
    all.push({
      name: c.name, people: c.people, topics: c.topics, perTopic: c.perTopic,
      equalTopics: c.equalTopics, criticSeats: c.criticSeats,
      closure: c.closure, covered: c.covered + '/' + c.pairs,
      leastShared: c.leastShared, diameter: c.diameter,
    });
    if (!seated.has(name)) continue;
    const reg = assignRegisters(c, seed += 101);
    const key = seatingOf[name];
    embeds.push(checkEmbedding(key, c));
    detail[name] = {
      seating: key,
      barycentric: EMBEDDINGS[key].points,
      labels: EMBEDDINGS[key].labels || null,
      vertices: V.map((v) => v.map((x) => +x.toFixed(9))),
      struts: c.edges.map((e, i) => ({
        topics: e, critiques: c.critics[i], register: reg ? reg.seats[i] : null,
      })),
      members: c.members,
      registers: reg,
    };
  }
  return { family: all, seated: detail, embeddings: embeds };
}

/* ------------------------------------------------------------- compile -- */

const t0 = Date.now();
const [land, lakes, rivers, places] = await Promise.all(
  ['land', 'lakes', 'rivers', 'places'].map(source)
);

process.stderr.write('landmask…\n');
const mask = buildLandMask(land, 2);

process.stderr.write('icosahedron…\n');
const { V: V0, edges, faces } = icosahedron();

process.stderr.write('orientation…\n');
const orient = solveOrientation(V0, mask);
const V = V0.map((v) => norm(applyMat(orient.mat, v)));
const vertexLonLat = V.map(toLonLat);
const vertexClearance = V.map((v) => Math.round(clearanceOf(v, mask)));

process.stderr.write('net…\n');
const { links, adj } = faceAdjacency(faces);
const net = solveNet(V, faces, links, adj, mask);

process.stderr.write('councils…\n');
const councils = buildCouncils(V, faces, links);
const geodesic = subdivisionDegeneracy(V, faces, 3);

// The two findings are load-bearing, so the build fails if they stop holding.
{
  const ico = councils.family.find((c) => c.name === 'icosahedron');
  const seat = councils.seated.icosahedron.registers;
  if (!ico.closure) throw new Error('the icosahedron lost closure');
  if (!ico.criticSeats) throw new Error('a strut has no opposite, so critic seats vanish');
  if (!seat.opposedAcross) throw new Error('a strut is not critiqued by its opposed register');
  if (seat.roomsFullyMixed !== ico.topics) {
    throw new Error(`only ${seat.roomsFullyMixed}/${ico.topics} rooms hear every kind of description`);
  }
  for (const g of geodesic) {
    if (g.degrees[5] !== 12) {
      throw new Error(`frequency ${g.frequency} has ${g.degrees[5]} five-valent topics, not twelve`);
    }
  }
  if (!councils.embeddings.every((e) => e.exact)) throw new Error('a council does not fit its cell');
  const bigger = councils.family.filter((c) => c.people > ico.people && c.closure);
  if (bigger.length) {
    throw new Error(`the closure ceiling moved: ${bigger.map((c) => c.name).join(', ')}`);
  }
}

process.stderr.write('geometry…\n');
const landRings = [];
for (const f of land.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) for (const ring of poly) {
    const s = simplify(ring, 0.055);
    if (s.length > 3 && ringArea(s) > 0.25) landRings.push(s);
  }
}
const lakeRings = [];
for (const f of lakes.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) for (const ring of poly) {
    const s = simplify(ring, 0.06);
    if (s.length > 3 && ringArea(s) > 1.2) lakeRings.push(s);
  }
}
const riverLines = [], riverIndex = [];
for (const f of rivers.features) {
  const g = f.geometry;
  const parts = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
  const first = riverLines.length;
  for (const part of parts) {
    const s = simplify(part, 0.035);
    if (s.length > 1) riverLines.push(s);
  }
  if (riverLines.length > first) {
    riverIndex.push({ name: f.properties.name_en || f.properties.name, from: first, to: riverLines.length });
  }
}

const cityList = places.features
  .map((f) => ({
    name: f.properties.name,
    country: f.properties.adm0name,
    lon: +f.properties.longitude.toFixed(4),
    lat: +f.properties.latitude.toFixed(4),
    pop: f.properties.pop_max | 0,
    cap: f.properties.adm0cap ? 1 : 0,
  }))
  .sort((a, b) => b.pop - a.pop);

const payload = {
  meta: {
    built: 'icosa-world.build.mjs',
    sources: 'Natural Earth 110m (public domain) — land, lakes, rivers, populated places',
    note: 'Every constant below is derived, not transcribed. See ICOSA-WORLD.md.',
    landPoints: landRings.reduce((s, r) => s + r.length, 0),
    riverPoints: riverLines.reduce((s, r) => s + r.length, 0),
  },
  ico: {
    // vertices in Earth-fixed coordinates: x through (0°N,0°E), z through the pole
    vertices: V.map((v) => v.map((c) => +c.toFixed(9))),
    faces,
    edges: links.map((l) => [l.a, l.b, l.ea, l.eb, l.v[0], l.v[1]]),
    vertexLonLat: vertexLonLat.map(([lon, lat]) => [+lon.toFixed(4), +lat.toFixed(4)]),
    vertexClearanceKm: vertexClearance,
    minClearanceKm: Math.round(orient.minClearanceKm),
    quat: orient.quat.map((c) => +c.toFixed(9)),
  },
  net: {
    root: net.root,
    parent: net.parentOf,
    hinge: net.hingeOf,
    order: net.order,
    layout: net.pos.map((p) => p.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)])),
    cuts: net.cut.map((i) => [links[i].a, links[i].b]),
    cutLand: +net.cutLand.toFixed(4),
    edgeLandCost: net.cost.map((c) => +c.toFixed(3)),
  },
  council: {
    note: 'The same solid used twice: for space above, for discourse here. '
        + 'Registers are ways of describing a place, never simulated people.',
    registers: REGISTERS,
    ladder: LADDER,
    embeddings: councils.embeddings,
    family: councils.family,
    seated: councils.seated,
    geodesic,
  },
  land: encodeLines(landRings),
  lakes: encodeLines(lakeRings),
  rivers: encodeLines(riverLines),
  riverIndex,
  cities: cityList,
};

const js = `/* ICOSA WORLD · compiled world data
   Generated by icosa-world.build.mjs — do not edit by hand.
   Source geometry: Natural Earth 110m, public domain.
   Icosahedron orientation and unfolding net are solved, not transcribed. */
window.ICOSA_WORLD_DATA = ${JSON.stringify(payload)};
`;
writeFileSync(OUT, js);

process.stderr.write(
  `\nwrote ${OUT} (${(js.length / 1024).toFixed(0)} KB) in ${((Date.now() - t0) / 1000).toFixed(1)}s\n` +
  `  min vertex clearance : ${Math.round(orient.minClearanceKm)} km\n` +
  `  vertex clearances    : ${vertexClearance.join(', ')}\n` +
  `  net root face        : ${net.root}\n` +
  `  land crossed by cuts : ${net.cutLand.toFixed(3)} (0 = every cut falls in water)\n` +
  `  net extent           : ${net.w.toFixed(2)} × ${net.h.toFixed(2)} edge lengths\n` +
  `  land / river points  : ${payload.meta.landPoints} / ${payload.meta.riverPoints}\n` +
  `  cities               : ${cityList.length}\n` +
  `\n  councils\n` +
  councils.family.map((c) =>
    `    ${c.name.padEnd(21)} ${String(c.people).padStart(3)} people, ${String(c.topics).padStart(2)} topics, `
    + `${String(c.perTopic).padStart(2)} per topic, closure ${c.covered.padStart(9)}`
    + `${c.closure ? ' ✓' : ''}`).join('\n') + '\n' +
  `    seated: ${Object.keys(councils.seated).join(', ')}\n` +
  councils.embeddings.map((e) => `      ${e.solid.padEnd(12)} ${e.note}\n`).join('') +
  `    icosahedron rooms hearing every register: ${councils.seated.icosahedron.registers.roomsFullyMixed}/12\n` +
  `    subdivision keeps five-valent topics at: ${geodesic.map((g) => g.degrees[5]).join(', ')} (twelve, forever)\n`
);
