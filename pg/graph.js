/* PERSPECTIVAL GROUND — the operative topology.

   There is one geometry and many topologies. This module holds the geometry:
   every node, every edge, every real junction of the real city, plus whatever
   the players have since drawn into it. It never decides what is passable.
   That is the being's job (see beings.js), and it is the whole game.

   An edge is not a road. It is a piece of ground with properties — a class, a
   length, a grade, a width, a pitch relative to the rest of this city, whether
   it bridges water. Ask CAR and it is a road. Ask RAIN and it is a channel
   with a fall. Ask WHEELCHAIR and it may be a wall. */

import { GRAPH } from "./graph.data.js";
import { distToSeg, metres, units, M_PER_UNIT } from "./geo.js";

/* ---------- ASCII varint, the inverse of the compiler's ---------- */
function dec(str) {
  const out = [];
  let i = 0;
  const n = str.length;
  while (i < n) {
    let sh = 0, r = 0, b;
    do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20 && i < n);
    out.push((r & 1) ? ~(r >> 1) : (r >> 1));
  }
  return out;
}
function undelta(list, scale) {
  const out = new Float64Array(list.length);
  let acc = 0;
  for (let i = 0; i < list.length; i++) { acc += list[i]; out[i] = acc / scale; }
  return out;
}

/* ---------- edge classes ---------- */
/* The four the city came with, then the two the players make. */
export const CLS_MOTORWAY = 0, CLS_PRIMARY = 1, CLS_SECONDARY = 2, CLS_RAIL = 3;
export const CLS_MARK = 4;   /* something a player drew */
export const CLS_GHOST = 5;  /* a desire line that enough traffic has hardened */
export const CLS_NAME = ["motorway", "primary", "secondary", "rail", "mark", "ghost"];

/* ---------- the graph ---------- */
export const G = {
  n: 0,
  nx: null, ny: null, nh: null,   /* node mercator x, y, height in metres */
  adj: null,                      /* node -> [edge index, ...] */

  /* edges, struct-of-arrays so the render loop can stay cheap */
  ea: [], eb: [], ec: [], elen: [], egrade: [], epitch: [], ecul: [],
  ewidth: [],   /* metres; how much room the ground gives you */
  ecurb: [],    /* 0..1; how hard the edge is to get onto from beside it */
  euse: [],     /* traversals, all beings, ever — this is what makes ghosts */
  emark: [],    /* the mark object, for edges a player drew */
  e: 0,
};

let built = false;

export function loadGraph() {
  if (built) return G;
  built = true;

  const nx = undelta(dec(GRAPH.nx), GRAPH.nq);
  const ny = undelta(dec(GRAPH.ny), GRAPH.nq);
  const nh = undelta(dec(GRAPH.nh), 2);
  G.n = GRAPH.n;
  /* room to grow: players will add nodes all game */
  G.nx = Array.from(nx); G.ny = Array.from(ny); G.nh = Array.from(nh);

  const ea = dec(GRAPH.ea), eb = dec(GRAPH.eb);
  let a = 0;
  const culv = new Set();
  {
    let acc = 0;
    for (const d of dec(GRAPH.ev)) { acc += d; culv.add(acc); }
  }

  G.adj = Array.from({ length: G.n }, () => []);
  for (let i = 0; i < GRAPH.e; i++) {
    a += ea[i];
    const b = a + eb[i];
    const cls = GRAPH.ec.charCodeAt(i) - 48;
    pushEdge(a, b, cls, culv.has(i) ? 1 : 0, null);
  }

  derivePitch();
  buildIndex();
  return G;
}

/* Width and curb are not in OSM at this scale, so they come from what the
   class of ground actually is. A motorway is wide and its edge is a barrier;
   a drawn line is as wide as the hand that drew it. */
const CLS_WIDTH = [14, 10, 7, 4, 1.6, 2.4];
const CLS_CURB = [1.0, 0.75, 0.45, 0.9, 0.0, 0.1];

function pushEdge(a, b, cls, culvert, mark) {
  const i = G.e++;
  G.ea.push(a); G.eb.push(b); G.ec.push(cls);
  const dx = G.nx[b] - G.nx[a], dy = G.ny[b] - G.ny[a];
  const len = metres(Math.hypot(dx, dy));
  G.elen.push(len);
  const g = len > 12 ? ((G.nh[b] - G.nh[a]) / len) * 100 : 0;
  G.egrade.push(Math.max(-18, Math.min(18, g)));
  G.epitch.push(0);
  G.ecul.push(culvert);
  G.ewidth.push(mark ? mark.width : CLS_WIDTH[cls]);
  G.ecurb.push(CLS_CURB[cls]);
  G.euse.push(0);
  G.emark.push(mark || null);
  G.adj[a].push(i); G.adj[b].push(i);
  return i;
}

/* How steep is this, for here? The real creeks are sparse, so absolute grade
   is gentle everywhere; what a traveller actually reads is whether this is
   among the steep ground of this city. That is a rank, and it is honest. */
function derivePitch() {
  const abs = G.egrade.map(Math.abs).sort((p, q) => p - q);
  for (let i = 0; i < G.e; i++) {
    const v = Math.abs(G.egrade[i]);
    let lo = 0, hi = abs.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (abs[mid] < v) lo = mid + 1; else hi = mid; }
    G.epitch[i] = lo / abs.length;
  }
}

/* ---------- adding ground ----------
   When a player draws, the drawing becomes ground. Not a decoration on the
   ground — ground, with the same rights as the interstate beside it. */
export function addNode(x, y, h) {
  const i = G.n++;
  G.nx.push(x); G.ny.push(y);
  G.nh.push(h != null ? h : heightAt(x, y));
  G.adj.push([]);
  return i;
}

/* Height between the surveyed nodes: whatever the nearest known ground says. */
export function heightAt(x, y) {
  const near = nearestNode(x, y, units(400));
  return near >= 0 ? G.nh[near] : 30;
}

/* Lay a polyline into the graph as real, traversable ground.
   Returns the edge indices it became. */
export function addWay(pts, cls, mark) {
  const out = [];
  if (pts.length < 4) return out;
  const ends = [];
  let prev = snapOrAdd(pts[0], pts[1]);
  ends.push(prev);
  for (let i = 2; i + 1 < pts.length; i += 2) {
    const cur = snapOrAdd(pts[i], pts[i + 1]);
    if (cur === prev) continue;
    const e = pushEdge(prev, cur, cls, 0, mark || null);
    gradeBuilt(e);
    indexEdge(e);
    out.push(e);
    prev = cur;
  }
  ends.push(prev);

  /* TIE IT IN.

     A line that touches nothing is not infrastructure, it is a doodle. Welding
     only where a vertex happens to land within a few metres of an existing
     node leaves a way stranded exactly when it matters most — drawn out of a
     body that is stuck precisely because there is no ground near it. So both
     ends reach for the nearest real ground and, if it is within a walk, run a
     short connector out to meet it. */
  for (const end of ends) {
    const near = nearestNodeOther(G.nx[end], G.ny[end], units(REACH), ends);
    if (near < 0) continue;
    const d = metres(Math.hypot(G.nx[near] - G.nx[end], G.ny[near] - G.ny[end]));
    if (d < 1) continue;
    const e = pushEdge(end, near, cls, 0, mark || null);
    gradeBuilt(e);
    indexEdge(e);
    out.push(e);
  }
  return out;
}

/* how far a drawn way will reach to find ground to join */
const REACH = 260;

/* A built way is built: somebody laid it, so it is graded, and it is not read
   against the ranked steepness of ground that simply happened. This is why a
   ramp you draw is a ramp and not another hill. */
function gradeBuilt(e) {
  G.egrade[e] = Math.max(-4, Math.min(4, G.egrade[e]));
  G.epitch[e] = 0.2;
}

/* nearest node that is not part of the way we just laid */
function nearestNodeOther(x, y, tol, exclude) {
  const R = Math.max(1, Math.ceil(tol / CELL));
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  let best = -1, bd = tol;
  for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
    const b = nodeCells.get(ckey(cx + dx, cy + dy));
    if (!b) continue;
    for (const i of b) {
      if (exclude.includes(i)) continue;
      const d = Math.hypot(G.nx[i] - x, G.ny[i] - y);
      if (d < bd) { bd = d; best = i; }
    }
  }
  return best;
}
let pitchTable = null;
function pitchOf(v) {
  if (!pitchTable) pitchTable = G.egrade.map(Math.abs).sort((p, q) => p - q);
  let lo = 0, hi = pitchTable.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (pitchTable[mid] < v) lo = mid + 1; else hi = mid; }
  return lo / pitchTable.length;
}

/* A drawn line that ends near existing ground joins it. This is why what you
   draw becomes infrastructure and not graffiti. */
const JOIN = units(45);
function snapOrAdd(x, y) {
  const n = nearestNode(x, y, JOIN);
  if (n >= 0) return n;
  const i = addNode(x, y);
  indexNode(i);
  return i;
}

/* ---------- spatial index ---------- */
const CELL = 1 / Math.pow(2, 16);
const nodeCells = new Map();
const edgeCells = new Map();
const ckey = (cx, cy) => cx * 2097152 + cy;

function indexNode(i) {
  const k = ckey(Math.floor(G.nx[i] / CELL), Math.floor(G.ny[i] / CELL));
  let b = nodeCells.get(k);
  if (!b) nodeCells.set(k, b = []);
  b.push(i);
}
function indexEdge(i) {
  const a = G.ea[i], b = G.eb[i];
  const cx0 = Math.floor(Math.min(G.nx[a], G.nx[b]) / CELL), cx1 = Math.floor(Math.max(G.nx[a], G.nx[b]) / CELL);
  const cy0 = Math.floor(Math.min(G.ny[a], G.ny[b]) / CELL), cy1 = Math.floor(Math.max(G.ny[a], G.ny[b]) / CELL);
  for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
    const k = ckey(cx, cy);
    let bb = edgeCells.get(k);
    if (!bb) edgeCells.set(k, bb = []);
    bb.push(i);
  }
}
function buildIndex() {
  for (let i = 0; i < G.n; i++) indexNode(i);
  for (let i = 0; i < G.e; i++) indexEdge(i);
}

/* Which pieces of ground are on screen right now.
   The render loop must never walk the whole city to find out what it can see;
   it asks here and gets back only what falls in the box. Edges straddle cells,
   so a generation stamp does the de-duplicating without allocating a Set. */
let vpStamp = null, vpGen = 0;
export function edgesInBox(x0, y0, x1, y1, out, filter) {
  out = out || [];
  out.length = 0;
  if (!vpStamp || vpStamp.length < G.e) {
    const next = new Int32Array(Math.max(4096, G.e * 2));
    if (vpStamp) next.set(vpStamp);
    vpStamp = next;
  }
  const gen = ++vpGen;
  const cx0 = Math.floor(x0 / CELL), cx1 = Math.floor(x1 / CELL);
  const cy0 = Math.floor(y0 / CELL), cy1 = Math.floor(y1 / CELL);
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) {
      const b = edgeCells.get(ckey(cx, cy));
      if (!b) continue;
      for (let i = 0; i < b.length; i++) {
        const e = b[i];
        if (vpStamp[e] === gen) continue;
        vpStamp[e] = gen;
        if (filter && !filter(e)) continue;
        out.push(e);
      }
    }
  }
  return out;
}

export function nearestNode(x, y, tol) {
  const R = Math.max(1, Math.ceil((tol || CELL) / CELL));
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  let best = -1, bd = tol != null ? tol : Infinity;
  for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
    const b = nodeCells.get(ckey(cx + dx, cy + dy));
    if (!b) continue;
    for (const i of b) {
      const d = Math.hypot(G.nx[i] - x, G.ny[i] - y);
      if (d < bd) { bd = d; best = i; }
    }
  }
  return best;
}

/* The nearest ground a given being can actually stand on. A destination that
   only a car can reach is not a destination when you are rain. */
export function nearestNodeFor(x, y, being, tol) {
  const R = Math.max(2, Math.ceil((tol || CELL * 3) / CELL));
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  let best = -1, bd = Infinity;
  for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
    const b = nodeCells.get(ckey(cx + dx, cy + dy));
    if (!b) continue;
    for (const i of b) {
      if (being && !nodeLives(i, being)) continue;
      const d = Math.hypot(G.nx[i] - x, G.ny[i] - y);
      if (d < bd) { bd = d; best = i; }
    }
  }
  return best;
}
function nodeLives(i, being) {
  for (const e of G.adj[i]) if (isFinite(being.cost(e, G.ea[e] === i))) return true;
  return false;
}

export function nearestEdge(x, y, tol, filter) {
  const R = Math.max(1, Math.ceil((tol || CELL) / CELL));
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  let best = -1, bd = tol != null ? tol : Infinity, bp = null;
  const seen = new Set();
  for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
    const b = edgeCells.get(ckey(cx + dx, cy + dy));
    if (!b) continue;
    for (const i of b) {
      if (seen.has(i)) continue;
      seen.add(i);
      if (filter && !filter(i)) continue;
      const a = G.ea[i], c = G.eb[i];
      const r = distToSeg(x, y, G.nx[a], G.ny[a], G.nx[c], G.ny[c]);
      if (r.d < bd) { bd = r.d; best = i; bp = r; }
    }
  }
  return best < 0 ? null : { edge: best, d: bd, ...bp };
}

/* ---------- routing ----------
   A* over whatever topology the being can see. If a being's cost is Infinity
   the edge is not slow for it — it does not exist for it. */
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(node, f) {
    const a = this.a;
    a.push({ node, f });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

const MAX_EXPAND = 24000;

/* route(from, to, being) -> {nodes, edges, dist, cost, balk} | null
   balk is the interesting failure: where the being got closest before the
   ground stopped offering it anything. A balk is not an error, it is a
   discovery, and it is what the player is invited to draw across. */
export function route(from, to, being) {
  if (from < 0 || to < 0) return null;
  if (from === to) return { nodes: [from], edges: [], dist: 0, cost: 0, balk: null };

  const gScore = new Map(), cameFrom = new Map(), cameEdge = new Map();
  const open = new Heap();
  const tx = G.nx[to], ty = G.ny[to];
  const h = (n) => metres(Math.hypot(G.nx[n] - tx, G.ny[n] - ty)) * being.hMul;

  gScore.set(from, 0);
  open.push(from, h(from));
  const closed = new Set();
  let expanded = 0;
  let nearest = from, nearD = Infinity;

  while (open.size) {
    const { node: cur } = open.pop();
    if (closed.has(cur)) continue;
    closed.add(cur);
    if (++expanded > MAX_EXPAND) break;

    const d = Math.hypot(G.nx[cur] - tx, G.ny[cur] - ty);
    if (d < nearD) { nearD = d; nearest = cur; }

    if (cur === to) {
      const nodes = [cur], edges = [];
      let n = cur;
      while (cameFrom.has(n)) { edges.push(cameEdge.get(n)); n = cameFrom.get(n); nodes.push(n); }
      nodes.reverse(); edges.reverse();
      let dist = 0;
      for (const e of edges) dist += G.elen[e];
      return { nodes, edges, dist, cost: gScore.get(cur), balk: null };
    }

    const gc = gScore.get(cur);
    for (const e of G.adj[cur]) {
      const forward = G.ea[e] === cur;
      const nxt = forward ? G.eb[e] : G.ea[e];
      if (closed.has(nxt)) continue;
      const c = being.cost(e, forward);
      if (!isFinite(c)) continue;
      const ng = gc + c;
      if (ng < (gScore.get(nxt) ?? Infinity)) {
        gScore.set(nxt, ng);
        cameFrom.set(nxt, cur);
        cameEdge.set(nxt, e);
        open.push(nxt, ng + h(nxt));
      }
    }
  }

  /* Nowhere left to go. Hand back how far it got and where it stopped. */
  const nodes = [nearest], edges = [];
  let n = nearest;
  while (cameFrom.has(n)) { edges.push(cameEdge.get(n)); n = cameFrom.get(n); nodes.push(n); }
  nodes.reverse(); edges.reverse();
  let dist = 0;
  for (const e of edges) dist += G.elen[e];
  return {
    nodes, edges, dist, cost: gScore.get(nearest) ?? 0,
    balk: { node: nearest, x: G.nx[nearest], y: G.ny[nearest], toX: tx, toY: ty, gap: metres(nearD) },
  };
}

/* ---------- what a turn can afford ----------
   A turn is not a distance, it is an effort. The same effort carries a car two
   miles down the interstate and a wheelchair four hundred metres up a hill,
   because the interstate costs a car almost nothing and the hill costs the
   chair almost everything. Chutes and ladders were never a separate mechanic:
   they are what a cost function looks like when you only get so much.

   Returns the part of the route the traveller can pay for, and whether it had
   to be cut short. */
export function afford(r, being, budget) {
  if (!r || !r.edges.length) return { r, cut: false, spent: 0 };
  let spent = 0, i = 0;
  for (; i < r.edges.length; i++) {
    const e = r.edges[i];
    const forward = G.ea[e] === r.nodes[i];
    const c = being.cost(e, forward);
    if (!isFinite(c)) break;
    if (spent + c > budget && i > 0) break;
    spent += c;
  }
  if (i >= r.edges.length) return { r, cut: false, spent };

  const nodes = r.nodes.slice(0, i + 1);
  const edges = r.edges.slice(0, i);
  let dist = 0;
  for (const e of edges) dist += G.elen[e];
  return {
    r: { nodes, edges, dist, cost: spent, balk: null, short: true },
    cut: true, spent,
  };
}

/* the polyline a route draws on the ground */
export function routePoints(r) {
  const pts = [];
  for (const n of r.nodes) pts.push(G.nx[n], G.ny[n]);
  return pts;
}

/* ---------- traces ----------
   Every passage is remembered by the ground it passed over. */
export function wear(edges, amount = 1) {
  for (const e of edges) G.euse[e] += amount;
}
