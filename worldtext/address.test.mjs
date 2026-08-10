/* The addressing claims, checked rather than asserted.
 *
 * The strongest test is Euler's formula. If every triangle at depth n names
 * its three edges canonically, then across the whole closed surface each
 * edge must be named by exactly two triangles and the counts must satisfy
 *
 *     F = 20·4ⁿ      E = 3F/2      V = 2 + E − F
 *
 * Nothing but correct seam canonicalisation produces those numbers: a
 * duplicated name shows up immediately as an edge counted once, and a
 * collision as one counted three or more times.
 */
import { kernel } from './address.mjs';

globalThis.window = {};
await import('./icosa.data.js');
const D = window.ICOSA_WORLD_DATA;
const K = kernel(D.ico.vertices, D.ico.faces);

let failures = 0;
const claim = (name, pass, detail) => {
  if (!pass) failures++;
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${name.padEnd(52)} ${detail}`);
};

function allCells(depth) {
  let out = [];
  for (let f = 0; f < K.NF; f++) out.push({ f, path: [] });
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const c of out) for (let k = 0; k < 4; k++) next.push({ f: c.f, path: c.path.concat([k]) });
    out = next;
  }
  return out;
}

for (const depth of [0, 1, 2, 3]) {
  const cells = allCells(depth);
  const edgeCount = new Map(), vertSet = new Set();
  for (const c of cells) {
    for (const x of K.cellEdges(c.f, c.path)) edgeCount.set(x, (edgeCount.get(x) || 0) + 1);
    for (const v of K.cellVertices(c.f, c.path)) vertSet.add(v);
  }
  const F = cells.length, E = edgeCount.size, Vn = vertSet.size;
  const shared = [...edgeCount.values()];
  claim(`depth ${depth}: every edge named by exactly two faces`,
    shared.every((n) => n === 2),
    `${F} faces, ${E} edges, worst count ${Math.max(...shared)}/${Math.min(...shared)}`);
  claim(`depth ${depth}: E = 3F/2`, E === (3 * F) / 2, `${E} vs ${(3 * F) / 2}`);
  claim(`depth ${depth}: V − E + F = 2 (Euler)`, Vn - E + F === 2, `${Vn} − ${E} + ${F} = ${Vn - E + F}`);
  claim(`depth ${depth}: V = 10·4^n + 2`, Vn === 10 * Math.pow(4, depth) + 2, `${Vn}`);
}

// EDGE(A,B) === EDGE(B,A)
{
  let bad = 0, n = 0;
  for (const c of allCells(2)) {
    const t = K.cellLattice(c.f, c.path);
    for (let e = 0; e < 3; e++) {
      const a = t[e], b = t[(e + 1) % 3];
      const A = [c.f, a[0], a[1], a[2]], B = [c.f, b[0], b[1], b[2]];
      n++;
      if (K.fmtX(A, B) !== K.fmtX(B, A)) bad++;
    }
  }
  claim('an edge reads the same from either end', bad === 0, `${n} edges, ${bad} disagreed`);
}

// the same vertex met at a deeper resolution is the same vertex
{
  let bad = 0, n = 0;
  for (let f = 0; f < K.NF; f++) {
    for (let i = 0; i <= 8; i++) for (let j = 0; j + i <= 8; j++) {
      const k = 8 - i - j;
      const a = K.fmtV(K.canonVertex(f, i, j, k));
      const b = K.fmtV(K.canonVertex(f, i * 4, j * 4, k * 4));
      n++;
      if (a !== b) bad++;
    }
  }
  claim('a vertex has one address at every depth', bad === 0, `${n} points, ${bad} drifted`);
}

// the twelve original vertices survive as twelve
{
  const base = new Set();
  for (let f = 0; f < K.NF; f++) for (const v of K.cellVertices(f, [])) base.add(v);
  claim('the twelve planetary vertices are twelve', base.size === 12, `${base.size}`);
}

// distinct points must not collide onto one address
{
  const seen = new Map();
  let collisions = 0;
  for (let f = 0; f < K.NF; f++) {
    for (let i = 0; i <= 4; i++) for (let j = 0; j + i <= 4; j++) {
      const k = 4 - i - j;
      const addr = K.fmtV(K.canonVertex(f, i, j, k));
      const p = K.point(f, i, j, k);
      if (seen.has(addr)) {
        const q = seen.get(addr);
        const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        if (d > 1e-9) collisions++;
      } else seen.set(addr, p);
    }
  }
  claim('two different points never share an address', collisions === 0,
    `${seen.size} distinct addresses, ${collisions} collisions`);
}

console.log(failures ? `\n${failures} FAILED` : '\nall addressing claims hold');
process.exit(failures ? 1 : 0);
