/* WORLDTEXT · the addressing kernel
 *
 * Faces were already addressable — @F/07/2/3 is a path down the four-way
 * subdivision and the address carries its own ancestry. Edges and vertices
 * were not, and that is the trap: two faces share an edge, so calling it
 * F07.e2 from one side and F12.e0 from the other invents two names for one
 * thing, and every claim attached to it splits in half.
 *
 * So this module gives every vertex and every edge, at every depth, ONE
 * canonical address that is derived rather than assigned — no registry, no
 * id counter, nothing to keep in sync.
 *
 *   @F/07/2/3            face: base face, then children
 *   @V/07/3.2.3          vertex: integer barycentric inside a base face
 *   @X/07/3.2.3|07/3.1.4 edge: its two vertices, canonically ordered
 *
 * A vertex address is (face, i, j, k) with i+j+k = 2^depth, so the depth is
 * recoverable from the address and never has to be written down. Two rules
 * make it canonical:
 *
 *   REDUCE   (6,4,6) and (3,2,3) are the same point found at different
 *            depths, so divide through while every coordinate is even. A
 *            vertex has one address no matter how deep you were when you
 *            met it.
 *
 *   SEAM     a point on a face boundary can be named by both faces, and a
 *            base corner by five. Take the smallest (face, i, j, k). The
 *            seam stops being able to duplicate anything.
 */

export function kernel(V, FACES) {
  const NF = FACES.length;

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };

  // inverse of [v0 v1 v2] per face — a direction becomes three weights
  const BINV = FACES.map((f) => {
    const a = V[f[0]], b = V[f[1]], c = V[f[2]];
    const det = a[0] * (b[1] * c[2] - b[2] * c[1])
              - b[0] * (a[1] * c[2] - a[2] * c[1])
              + c[0] * (a[1] * b[2] - a[2] * b[1]);
    return [
      [(b[1] * c[2] - b[2] * c[1]) / det, (c[0] * b[2] - b[0] * c[2]) / det, (b[0] * c[1] - c[0] * b[1]) / det],
      [(c[1] * a[2] - a[1] * c[2]) / det, (a[0] * c[2] - c[0] * a[2]) / det, (c[0] * a[1] - a[0] * c[1]) / det],
      [(a[1] * b[2] - b[1] * a[2]) / det, (b[0] * a[2] - a[0] * b[2]) / det, (a[0] * b[1] - b[0] * a[1]) / det],
    ];
  });
  const baryRaw = (f, p) => [dot(BINV[f][0], p), dot(BINV[f][1], p), dot(BINV[f][2], p)];

  // a lattice point: integer barycentric inside a base face
  function point(f, i, j, k) {
    const a = V[FACES[f][0]], b = V[FACES[f][1]], c = V[FACES[f][2]];
    return norm([a[0] * i + b[0] * j + c[0] * k,
                 a[1] * i + b[1] * j + c[1] * k,
                 a[2] * i + b[2] * j + c[2] * k]);
  }

  function reduce(i, j, k) {
    while (i % 2 === 0 && j % 2 === 0 && k % 2 === 0 && i + j + k > 1) { i /= 2; j /= 2; k /= 2; }
    return [i, j, k];
  }
  const before = (a, b) =>
    a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] !== b[2] ? a[2] < b[2] : a[3] < b[3];

  // THE canonical vertex: reduced, then the smallest naming among every
  // face that can see it
  function canonVertex(f, i, j, k) {
    [i, j, k] = reduce(i, j, k);
    const scale = i + j + k;
    const p = point(f, i, j, k);
    let best = [f, i, j, k];
    for (let g = 0; g < NF; g++) {
      if (g === f) continue;
      const r = baryRaw(g, p), s = r[0] + r[1] + r[2];
      if (s <= 0) continue;
      const b = [r[0] / s, r[1] / s, r[2] / s];
      if (Math.min(b[0], b[1], b[2]) < -1e-9) continue;
      const gi = Math.round(b[0] * scale), gj = Math.round(b[1] * scale), gk = Math.round(b[2] * scale);
      if (gi + gj + gk !== scale || gi < 0 || gj < 0 || gk < 0) continue;
      // it must really be the same point, not a rounding coincidence
      const q = point(g, gi, gj, gk);
      if (Math.abs(dot(p, q) - 1) > 1e-12) continue;
      const cand = [g, gi, gj, gk];
      if (before(cand, best)) best = cand;
    }
    return best;
  }

  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  const fmtV = (v) => `@V/${pad2(v[0])}/${v[1]}.${v[2]}.${v[3]}`;
  function parseV(str) {
    const m = /^@?V\/(\d{1,2})\/(\d+)\.(\d+)\.(\d+)$/.exec(String(str).trim());
    if (!m) return null;
    return [+m[1], +m[2], +m[3], +m[4]];
  }
  const depthOfV = (v) => Math.log2(v[1] + v[2] + v[3]);

  // EDGE(A,B) === EDGE(B,A), always, or a dependency splits into two
  function fmtX(vA, vB) {
    const a = fmtV(canonVertex(...vA)), b = fmtV(canonVertex(...vB));
    const [lo, hi] = a < b ? [a, b] : [b, a];
    return `@X/${lo.slice(3)}|${hi.slice(3)}`;
  }
  function parseX(str) {
    const m = /^@?X\/(.+)\|(.+)$/.exec(String(str).trim());
    if (!m) return null;
    const a = parseV('@V/' + m[1]), b = parseV('@V/' + m[2]);
    return a && b ? [a, b] : null;
  }

  /* ---- faces ---- */
  const fmtF = (f, path) => `@F/${pad2(f)}${path.length ? '/' + path.join('/') : ''}`;
  function parseF(str) {
    const m = /^@?F\/(\d{1,2})((?:\/[0-3])*)$/.exec(String(str).trim());
    if (!m) return null;
    const path = m[2] ? m[2].slice(1).split('/').map(Number) : [];
    return { f: +m[1], path };
  }

  // a cell's three corners as integer barycentric at its own depth
  function cellLattice(f, path) {
    const n = path.length, scale = Math.pow(2, n);
    let t = [[scale, 0, 0], [0, scale, 0], [0, 0, scale]];
    for (const c of path) {
      const m01 = [(t[0][0] + t[1][0]) / 2, (t[0][1] + t[1][1]) / 2, (t[0][2] + t[1][2]) / 2];
      const m12 = [(t[1][0] + t[2][0]) / 2, (t[1][1] + t[2][1]) / 2, (t[1][2] + t[2][2]) / 2];
      const m02 = [(t[0][0] + t[2][0]) / 2, (t[0][1] + t[2][1]) / 2, (t[0][2] + t[2][2]) / 2];
      t = c === 0 ? [t[0], m01, m02]
        : c === 1 ? [m01, t[1], m12]
        : c === 2 ? [m02, m12, t[2]]
        : [m01, m12, m02];
    }
    return t;
  }
  const cellVertices = (f, path) =>
    cellLattice(f, path).map((c) => fmtV(canonVertex(f, c[0], c[1], c[2])));
  function cellEdges(f, path) {
    const t = cellLattice(f, path);
    return [0, 1, 2].map((e) => {
      const a = t[e], b = t[(e + 1) % 3];
      return fmtX([f, a[0], a[1], a[2]], [f, b[0], b[1], b[2]]);
    });
  }

  // point → the cell of that depth holding it. Descending by weights, so
  // the cost is the depth rather than the number of cells in the world.
  function cellAt(p, depth) {
    let f = 0, w = null;
    for (let g = 0; g < NF; g++) {
      const r = baryRaw(g, p), s = r[0] + r[1] + r[2];
      if (s <= 0) continue;
      const b = [r[0] / s, r[1] / s, r[2] / s];
      if (Math.min(b[0], b[1], b[2]) >= -1e-12) { f = g; w = b; break; }
    }
    if (!w) return null;
    const path = [];
    for (let d = 0; d < depth; d++) {
      if (w[0] >= 0.5) { path.push(0); w = [2 * w[0] - 1, 2 * w[1], 2 * w[2]]; }
      else if (w[1] >= 0.5) { path.push(1); w = [2 * w[0], 2 * w[1] - 1, 2 * w[2]]; }
      else if (w[2] >= 0.5) { path.push(2); w = [2 * w[0], 2 * w[1], 2 * w[2] - 1]; }
      else { path.push(3); w = [1 - 2 * w[2], 1 - 2 * w[0], 1 - 2 * w[1]]; }
    }
    return { f, path };
  }

  return { point, cellAt, canonVertex, fmtV, parseV, depthOfV, fmtX, parseX,
           fmtF, parseF, cellLattice, cellVertices, cellEdges, baryRaw, NF, V, FACES };
}
