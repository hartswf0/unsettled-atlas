import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export function loadIcosaWorldData(path = join(HERE, '..', 'icosa-world.data.js')) {
  const src = readFileSync(path, 'utf8');
  const marker = 'window.ICOSA_WORLD_DATA = ';
  const at = src.indexOf(marker);
  if (at < 0) throw new Error(`cannot find ${marker.trim()} in ${path}`);
  let json = src.slice(at + marker.length).trim();
  if (json.endsWith(';')) json = json.slice(0, -1);
  return JSON.parse(json);
}

const D2R = Math.PI / 180;
const norm = p => {
  const n = Math.hypot(p[0], p[1], p[2]) || 1;
  return [p[0] / n, p[1] / n, p[2] / n];
};

export function toVec(lon, lat) {
  const p = lat * D2R, l = lon * D2R;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}

function inverseForFace(V, face) {
  const a = V[face[0]], b = V[face[1]], c = V[face[2]];
  const det = a[0] * (b[1] * c[2] - b[2] * c[1])
            - b[0] * (a[1] * c[2] - a[2] * c[1])
            + c[0] * (a[1] * b[2] - a[2] * b[1]);
  return [
    [(b[1] * c[2] - c[1] * b[2]) / det, (c[0] * b[2] - b[0] * c[2]) / det, (b[0] * c[1] - c[0] * b[1]) / det],
    [(c[1] * a[2] - a[1] * c[2]) / det, (a[0] * c[2] - c[0] * a[2]) / det, (c[0] * a[1] - a[0] * c[1]) / det],
    [(a[1] * b[2] - b[1] * a[2]) / det, (b[0] * a[2] - a[0] * b[2]) / det, (a[0] * b[1] - b[0] * a[1]) / det]
  ];
}

export function createAddressor(data = loadIcosaWorldData()) {
  const V = data.ico.vertices;
  const FACES = data.ico.faces;
  const BINV = FACES.map(f => inverseForFace(V, f));

  function baryRaw(f, p) {
    const m = BINV[f];
    return [
      m[0][0] * p[0] + m[0][1] * p[1] + m[0][2] * p[2],
      m[1][0] * p[0] + m[1][1] * p[1] + m[1][2] * p[2],
      m[2][0] * p[0] + m[2][1] * p[1] + m[2][2] * p[2]
    ];
  }

  function baryOf(f, p) {
    const r = baryRaw(f, p), s = r[0] + r[1] + r[2];
    return [r[0] / s, r[1] / s, r[2] / s];
  }

  function faceOf(p) {
    let best = 0, bestMin = -Infinity;
    for (let f = 0; f < FACES.length; f++) {
      const r = baryRaw(f, p), s = r[0] + r[1] + r[2];
      if (s <= 0) continue;
      const m = Math.min(r[0], r[1], r[2]) / s;
      if (m >= -1e-12) return f;
      if (m > bestMin) { bestMin = m; best = f; }
    }
    return best;
  }

  function descend(w) {
    if (w[0] >= 0.5) return [0, [2 * w[0] - 1, 2 * w[1], 2 * w[2]]];
    if (w[1] >= 0.5) return [1, [2 * w[0], 2 * w[1] - 1, 2 * w[2]]];
    if (w[2] >= 0.5) return [2, [2 * w[0], 2 * w[1], 2 * w[2] - 1]];
    return [3, [1 - 2 * w[2], 1 - 2 * w[0], 1 - 2 * w[1]]];
  }

  function cellAtVec(p, depth = 10) {
    const f = faceOf(p), path = [];
    let w = baryOf(f, p);
    for (let d = 0; d < depth; d++) {
      const r = descend(w);
      path.push(r[0]);
      w = r[1];
    }
    return { f, path, depth };
  }

  function slug(cell) {
    return 'F' + String(cell.f).padStart(2, '0') + (cell.path.length ? '.' + cell.path.join('') : '');
  }

  function addressPoint(lon, lat, depth = 10) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
    return slug(cellAtVec(toVec(lon, lat), depth));
  }

  function baryPoint(f, w) {
    const a = V[FACES[f][0]], b = V[FACES[f][1]], c = V[FACES[f][2]];
    return norm([
      a[0] * w[0] + b[0] * w[1] + c[0] * w[2],
      a[1] * w[0] + b[1] * w[1] + c[1] * w[2],
      a[2] * w[0] + b[2] * w[1] + c[2] * w[2]
    ]);
  }

  return { V, FACES, baryRaw, baryOf, faceOf, descend, cellAtVec, slug, addressPoint, baryPoint };
}
