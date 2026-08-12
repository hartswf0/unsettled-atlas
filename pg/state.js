/* PERSPECTIVAL GROUND — what persists.

   The city is given. Everything else in here was made by somebody passing
   through, and it outlives them. Marks become ground. Journeys become
   pressure. Pressure becomes ghost road. Nothing is ever deleted, because
   the whole point is that the used world accumulates.

   Multiplayer with no server: every tab on this device shares one cloth over
   a BroadcastChannel, and the cloth is written to localStorage so it is still
   there tomorrow. When nobody else is on the ground, travellers.js supplies
   travellers — but they write to the same cloth as a person would. */

import { G, addWay, CLS_MARK, CLS_GHOST, wear } from "./graph.js";
import { byId, CAR, BEINGS } from "./beings.js";

const KEY = "pg.cloth.v1";
const CH = "pg.cloth";

/* ---------- events ----------
   Modules talk through here and never import each other, which is what lets
   them be rebuilt one at a time. */
const handlers = new Map();
export function on(ev, fn) {
  let a = handlers.get(ev);
  if (!a) handlers.set(ev, a = []);
  a.push(fn);
  return () => { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
}
export function emit(ev, payload) {
  const a = handlers.get(ev);
  if (a) for (const fn of a.slice()) fn(payload);
}

/* ---------- identity ---------- */
function rid() { return Math.random().toString(36).slice(2, 9); }
function ls(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } }
export const ME = (() => {
  let m = ls("pg.me", "");
  if (!m) { m = rid(); try { localStorage.setItem("pg.me", m); } catch {} }
  return m;
})();

/* ---------- the state ---------- */
export const S = {
  me: ME,
  being: CAR,
  turn: 0,

  /* what people drew. each has become edges in G. */
  marks: [],
  /* every completed passage, as a polyline. this is the ghost-road archive. */
  journeys: [],
  /* where travel stopped because the ground offered nothing: {x,y,n,being} */
  pressure: [],
  /* travellers currently on the ground, mine and everyone else's */
  travellers: [],

  /* the one the player is */
  you: null,

  /* set when a mark of yours is used by somebody who is not you */
  witness: null,

  /* the crossing */
  goal: null,
  rival: null,
  allowance: 1500,

  seq: 0,
  ready: false,
};

/* ---------- the log ----------
   Ops, not snapshots, so two tabs can merge without either winning. */
let ops = [];
const seen = new Set();

function opId() { return ME + "." + (++S.seq).toString(36); }

export function apply(op, { local = true } = {}) {
  if (!op || seen.has(op.id)) return false;
  seen.add(op.id);
  ops.push(op);

  if (op.k === "mark") {
    const mark = {
      id: op.id, pts: op.pts, width: op.w, by: op.by, being: op.b, t: op.t,
      edges: [], use: 0, users: [],
    };
    mark.edges = addWay(op.pts, CLS_MARK, mark);
    S.marks.push(mark);
    emit("mark", mark);
  } else if (op.k === "journey") {
    const j = { id: op.id, pts: op.pts, by: op.by, being: op.b, t: op.t };
    S.journeys.push(j);
    if (op.e) wear(op.e, 1);
    emit("journey", j);
  } else if (op.k === "balk") {
    /* tx,ty is where the body was trying to get to. It is what makes a bruise
       into a desire line later, so it is kept even though nothing reads it yet. */
    const p = { x: op.x, y: op.y, tx: op.tx, ty: op.ty, n: 1, being: op.b, t: op.t };
    const near = S.pressure.find((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.0000045);
    if (near) {
      near.n++;
      if (near.tx == null) { near.tx = p.tx; near.ty = p.ty; }
    } else S.pressure.push(p);
    emit("balk", near || p);
  } else if (op.k === "ghost") {
    const g = { id: op.id, pts: op.pts, t: op.t, edges: [] };
    g.edges = addWay(op.pts, CLS_GHOST, null);
    S.journeys.push({ ...g, ghost: true });
    emit("ghost", g);
  }

  if (local) { broadcast(op); save(); }
  return true;
}

/* ---------- writing into the cloth ---------- */
export function layMark(pts, width, being) {
  return apply({ k: "mark", id: opId(), pts, w: width, by: ME, b: being.id, t: Date.now() });
}
export function logJourney(pts, edges, being) {
  return apply({ k: "journey", id: opId(), pts, e: edges, by: ME, b: being.id, t: Date.now() });
}
export function logBalk(x, y, being, tx, ty) {
  return apply({ k: "balk", id: opId(), x, y, tx, ty, b: being.id, t: Date.now() });
}
export function layGhost(pts) {
  return apply({ k: "ghost", id: opId(), pts, t: Date.now() });
}

/* ---------- persistence ---------- */
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const keep = ops.slice(-2400);
      localStorage.setItem(KEY, JSON.stringify(keep));
    } catch {}
  }, 400);
}
export function load() {
  let raw = [];
  try { raw = JSON.parse(ls(KEY, "[]")) || []; } catch {}
  for (const op of raw) apply(op, { local: false });
  S.ready = true;
  emit("loaded", raw.length);
  return raw.length;
}

/* ---------- other tabs are other players ---------- */
let chan = null;
export function connect() {
  try {
    chan = new BroadcastChannel(CH);
    chan.onmessage = (e) => {
      const m = e.data;
      if (!m) return;
      if (m.t === "op") apply(m.op, { local: false });
      else if (m.t === "here") emit("peer", m);
    };
  } catch {}
}
function broadcast(op) { try { chan && chan.postMessage({ t: "op", op }); } catch {} }
export function announce(x, y, beingId) {
  try { chan && chan.postMessage({ t: "here", me: ME, x, y, b: beingId, at: Date.now() }); } catch {}
}

/* ---------- becoming ---------- */
export function become(b) {
  const prev = S.being;
  S.being = b;
  S.turn++;
  emit("become", { from: prev, to: b, turn: S.turn });
}

/* ---------- who used what ----------
   The moment the game is about: somebody who is not you crossed your line,
   and it did something to them it would not have done to you. */
export function creditMark(mark, traveller) {
  if (!mark) return;
  mark.use++;
  if (!mark.users.includes(traveller.being.id)) mark.users.push(traveller.being.id);
  if (mark.by === ME && traveller.by !== ME) {
    S.witness = { mark, traveller, at: Date.now() };
    emit("witness", S.witness);
  }
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch {}
  location.reload();
}
