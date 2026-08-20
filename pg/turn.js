/* PERSPECTIVAL GROUND — the turn.

   Chance, then agency. The two are never the same move and that is the whole
   game:

     THE DICE decide how much going you get. You do not choose them.
     THE ASSIGNMENT decides who does the going. You choose that, entirely.

   You have three bodies on one city — a car, a wheelchair, a walker — and all
   three have to get home. Not the convenient one. All three. So the question
   every turn is not "where do I go" but "which of these three can do the most
   with a four", and the answer depends on ground that means something
   different to each of them.

   PICKING UP A BODY IS BECOMING. The instant a die is over the wheelchair, the
   city re-reads as the wheelchair's city: the interstate stops existing, the
   kerbs come up as walls, and the gentle line somebody drew last turn is
   suddenly the fastest thing on screen. The board reorganises under your thumb
   while you are still deciding. That is what a perspective costs and what it
   buys, and nothing anywhere says a word about it.

   THE GHOSTS show where each die would land each body — including the drop
   through a chute and the ride up a ladder — before you commit to anything.
   Perceiving the possibilities is the skill. Owning the consequence is the
   game. */

import {
  View, sx, sy, wx, wy, clamp, lerp, ease, units, metres, TAU, distToSeg,
  centerOn, worldSize,
} from "./geo.js";
import { G, route, routePoints, nearestNodeFor, afford, wear } from "./graph.js";
import { CAR, CHAIR, FOOT, BEINGS, LADDER, CHUTE_AT } from "./beings.js";
import { S, on, emit, become, creditMark, logBalk } from "./state.js";
import { travelToken, setToken, busy } from "./move.js";
import { shareCrossing, groundCrossing } from "./net.js";

/* what one pip is worth, in effort */
const PIP = 300;
/* how near home is home */
const HOME = 260;

const AMBER = "#c98a2e", AMBER_DEEP = "#8a5a12";

/* some people cannot take a screen that keeps moving */
const MOVING = (() => {
  try { return !matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return true; }
})();

/* Your three. They are fixed bodies, not costumes: the wheelchair is always
   the wheelchair, and it is always the one that cannot take the bridge. */
const BODIES = [CAR, CHAIR, FOOT];

let tokens = [];       /* [{being,node,x,y,home,ang}] */
let rivals = [];
let dice = [];         /* [{v,to,dead}] */
let phase = "roll";    /* roll | assign | resolving | over */
let sel = -1;          /* which die is in the hand */
let hover = -1;        /* which body it is over */
let over = null;
let turnNo = 0;
let stuck = [];
let ctxRef = null;

let tray = null, bar = null, endCard = null;
let drag = null;      /* a die in the air, see carry() */

/* ============================================================
   setting out
   ============================================================ */
export function init(ctx) {
  ctxRef = ctx;
  buildTray(ctx);
  on("boot", () => setTimeout(setUp, 80));
  on("arrive", () => setTimeout(next, 260));
  /* somebody else opened this ground first: play THEIR crossing, not one of
     our own, or a shared link is three separate games sharing drawings */
  on("ground", ({ home }) => {
    if (home == null || turnNo > 0 || home >= G.n) return;
    if (S.home && S.home.node === home) return;
    S.home = { x: G.nx[home], y: G.ny[home], node: home };
    S.homeNode = home;
    clearGhosts();
    frameAll();
    render();
  });
}

function setUp() {
  const start = nearestNodeFor(View.x, View.y, CAR, units(2000));
  if (start < 0) { setTimeout(setUp, 150); return; }

  tokens = seatOut(start);
  S.tokens = tokens;

  /* home: a real place, far enough to be a journey */
  S.homeNode = groundCrossing != null ? adoptHome(groundCrossing) : pickHome(start);
  rivals = seatOut(start);

  select(0);
  phase = "roll";
  over = null; turnNo = 0;
  render();
  emit("crossing", { home: S.home });
}

/* Three bodies standing on one another are one body. Each starts on ground it
   can actually use, near the others but never on top of them, so you can tell
   them apart and put a die on the one you mean. */
function seatOut(start) {
  const used = [];
  return BODIES.map((be) => {
    let at = -1;
    for (const reach of [90, 200, 380, 700, 1400]) {
      const n = nearestNodeFor(G.nx[start], G.ny[start], be, units(reach));
      if (n < 0) continue;
      const clear = (i) => !used.some((u) =>
        metres(Math.hypot(G.nx[u] - G.nx[i], G.ny[u] - G.ny[i])) < 150);
      if (clear(n)) { at = n; break; }
      let alt = -1, best = 1e9;
      for (const e of G.adj[n]) {
        const o = G.ea[e] === n ? G.eb[e] : G.ea[e];
        if (!isFinite(be.cost(e, G.ea[e] === n))) continue;
        if (!clear(o)) continue;
        const d = metres(Math.hypot(G.nx[o] - G.nx[start], G.ny[o] - G.ny[start]));
        if (d < best) { best = d; alt = o; }
      }
      if (alt >= 0) { at = alt; break; }
    }
    if (at < 0) at = start;
    used.push(at);
    return { being: be, node: at, x: G.nx[at], y: G.ny[at], home: false, ang: 0 };
  });
}

/* Where home is decides whether this is a game or a wall.

   Standing near a place is not the same as being able to get to it, so every
   candidate is actually routed, not merely measured. The car and the walker
   must genuinely be able to arrive, or there is no game. The wheelchair is
   deliberately NOT required to — if it can already get there the crossing
   costs nobody anything, and if it cannot, the only thing in the world that
   can change that is a line somebody draws. That is the whole game, and it is
   decided right here. */
function reaches(be, from, to) {
  const a = nearestNodeFor(G.nx[from], G.ny[from], be, units(400));
  const b = nearestNodeFor(G.nx[to], G.ny[to], be, units(400));
  if (a < 0 || b < 0) return false;
  const r = route(a, b, be);
  return !!(r && !r.balk && r.nodes.length > 1);
}

function adoptHome(node) {
  S.home = { x: G.nx[node], y: G.ny[node], node };
  return node;
}

function pickHome(start) {
  const cands = [];
  for (let k = 0; k < 900 && cands.length < 26; k++) {
    const i = Math.floor(Math.random() * G.n);
    const d = metres(Math.hypot(G.nx[i] - G.nx[start], G.ny[i] - G.ny[start]));
    if (d < 1300 || d > 2900) continue;
    cands.push({ i, d });
  }
  cands.sort((a, b) => b.d - a.d);

  let best = -1, fallback = -1;
  for (const c of cands) {
    if (!reaches(CAR, start, c.i)) continue;
    if (fallback < 0) fallback = c.i;
    if (!reaches(FOOT, start, c.i)) continue;
    best = c.i;
    break;
  }
  if (best < 0) best = fallback;
  if (best < 0) best = start;
  S.home = { x: G.nx[best], y: G.ny[best], node: best };
  /* First one here names the crossing for everybody who follows — but not
     instantly: a ground that already has one is still sending it, and the
     record on the ground beats a guess made a second ago. */
  setTimeout(() => shareCrossing(best), 1900);
  return best;
}

/* selecting a body IS becoming: the city re-reads as that body's city */
function select(i) {
  if (i < 0 || i >= tokens.length) return;
  sel = sel;
  if (S.being !== tokens[i].being) become(tokens[i].being);
  setToken(tokens[i], false);
  S.selToken = i;
}

/* ============================================================
   the dice
   ============================================================ */
const d6 = () => 1 + Math.floor(Math.random() * 6);

/* To decide, you have to be able to see what you are deciding between. The
   camera follows whoever is going while they go, and comes back to the whole
   board the moment it is your turn to think — which is also the only time a
   body you cannot see would be a body you cannot choose. */
function frameAll() {
  const live = tokens.filter((t) => !t.home);
  if (!live.length) return;
  const xs = live.map((t) => t.x), ys = live.map((t) => t.y);
  if (S.home) { xs.push(S.home.x); ys.push(S.home.y); }
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const padX = Math.max(90, View.w * 0.16), padT = 96, padB = 150;
  const aw = Math.max(80, View.w - padX * 2);
  const ah = Math.max(80, View.h - padT - padB);
  const w = Math.max(1e-9, x1 - x0), h = Math.max(1e-9, y1 - y0);
  const z = clamp(Math.log2(Math.min(aw / w, ah / h) / 256), 11.6, 16.0);
  const ws = 256 * Math.pow(2, z);
  centerOn((x0 + x1) / 2, (y0 + y1) / 2 - (padT - padB) / (2 * ws), z);
}

function roll() {
  if (phase !== "roll") return;
  turnNo++;
  frameAll();
  dice = [{ v: d6(), to: null, dead: false }, { v: d6(), to: null, dead: false }];
  phase = "assign";
  markDead();
  sel = firstOpen();
  if (sel >= 0) hoverBody(preferredFor(sel));
  render();
}

const firstOpen = () => dice.findIndex((d) => d.to === null && !d.dead);

/* A die that no body can do anything with is dead. It is still shown — you
   should see the roll you were given and what it was worth — but it does not
   hold the turn hostage. */
function markDead() {
  clearGhosts();
  for (let i = 0; i < dice.length; i++) {
    if (dice[i].to !== null) continue;
    let any = false;
    for (let t = 0; t < tokens.length; t++) {
      if (tokens[t].home || !allowed(i, t)) continue;
      const g = ghost(i, t);
      if (g && g.gain > 25) { any = true; break; }
    }
    dice[i].dead = !any;
  }
  tellStuck();
}

/* A body with nowhere to go is the loudest thing this game has to say, and it
   is not allowed to say it in words. It knocks on the pip instead: the only
   move left is a line, and the hand is the only thing that can make one. */
function tellStuck() {
  const walled = [];
  for (let t = 0; t < tokens.length; t++) {
    if (tokens[t].home) continue;
    let best = null;
    for (let i = 0; i < dice.length; i++) {
      const g = ghost(i, t);
      if (g && g.gain > 25) { best = g; break; }
      if (g && g.balk && !best) best = g;
    }
    if (!best || best.gain <= 25) walled.push({ token: tokens[t], ghost: best });
  }
  stuck = walled;
  emit("stuck", walled);
}

/* which body a die would do most for — only used to put the hand somewhere
   sensible, never to decide for the player */
function preferredFor(di) {
  let best = -1, bd = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].home || !allowed(di, i)) continue;
    const g = ghost(di, i);
    if (g && g.gain > bd) { bd = g.gain; best = i; }
  }
  return best;
}

function hoverBody(i) {
  if (i === hover) return;
  hover = i;
  if (i >= 0) select(i);
  if (!drag) render();
}

/* ---------- the ghost: where this die puts this body ---------- */
const ghosts = new Map();
function gkey(di, ti) { return di * 8 + ti; }

function ghost(di, ti) {
  const k = gkey(di, ti);
  if (ghosts.has(k)) return ghosts.get(k);
  const d = dice[di], t = tokens[ti];
  let g = null;
  if (d && t && !t.home && S.homeNode >= 0) {
    const from = nearestNodeFor(t.x, t.y, t.being, units(700));
    const to = nearestNodeFor(S.home.x, S.home.y, t.being, units(900));
    if (from >= 0 && to >= 0) {
      const full = route(from, to, t.being);
      if (full && full.nodes.length >= 2) {
        const { r, cut } = afford(full, t.being, d.v * PIP);
        if (r && r.nodes.length >= 2) {
          const end = r.nodes[r.nodes.length - 1];
          /* Progress is ground covered along the way home, not distance across
             the map. A car truncated halfway down a ramp is further from home
             as the crow flies and much closer as the car drives, and the crow
             is not playing. */
          g = {
            r, pts: routePoints(r), from,
            ex: G.nx[end], ey: G.ny[end],
            gain: r.dist,
            remain: Math.max(0, full.dist - r.dist),
            balk: full.balk,
            arrives: !cut && !full.balk,
            runs: null,   /* filled below, once we know what the die bought */
          };
          /* What the die actually bought this body, per pip. This is the
             chute-or-ladder, and it always exists: the same four carries a car
             most of a mile and a wheelchair to the end of the block. */
          const perPip = g.gain / Math.max(1, d.v);
          g.perPip = Math.round(perPip);
          g.kind = perPip >= LADDER_PER_PIP ? "ladder"
                 : perPip <= CHUTE_PER_PIP ? "chute" : "plain";
          g.runs = g.kind === "plain" ? runsOf(r, t.being)
                                      : [{ kind: g.kind, pts: g.pts }];
        }
      }
    }
  }
  ghosts.set(k, g);
  return g;
}

/* metres of ground a single pip is worth. above the first this body is being
   carried; below the second it is being taken from. */
const LADDER_PER_PIP = 300, CHUTE_PER_PIP = 130;
function clearGhosts() { ghosts.clear(); }

/* Where this way carries this body and where it takes from it.

   A ladder and a chute are not marks on the map — they are what this
   particular ground does to this particular body, so they can only be drawn
   onto a way once somebody is on it. Consecutive edges of the same kind are
   gathered into one run so a ladder reads as a ladder and not as forty
   opinions about forty segments. */
function runsOf(r, be) {
  const n = r.edges.length;
  if (!n) return [];

  /* Every edge, as what it costs this body per metre of it. */
  const ratio = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const e = r.edges[i];
    const c = be.cost(e, G.ea[e] === r.nodes[i]);
    ratio[i] = G.elen[e] > 0 && isFinite(c) ? c / G.elen[e] : 1;
  }

  /* A ladder is only a ladder next to something. Absolute thresholds barely
     ever fire — for a car only the interstate clears them, so a whole journey
     across arterials reported nothing at all. So the journey is also read
     against ITSELF: the stretches that carry you further than the rest of this
     particular way, and the ones that take more out of you than the rest of
     it. Both readings are true and both are shown. */
  const sorted = Array.from(ratio).sort((p, q) => p - q);
  const mid = sorted[sorted.length >> 1] || 1;
  const fast = Math.min(LADDER, mid * 0.8);
  const slow = Math.max(CHUTE_AT, mid * 1.35);

  const kinds = new Uint8Array(n);   /* 0 plain, 1 ladder, 2 chute */
  for (let i = 0; i < n; i++) {
    if (ratio[i] <= fast) kinds[i] = 1;
    else if (ratio[i] >= slow) kinds[i] = 2;
  }

  const out = [];
  let cur = null;
  for (let i = 0; i < n; i++) {
    const k = kinds[i];
    const ax = G.nx[r.nodes[i]], ay = G.ny[r.nodes[i]];
    const bx = G.nx[r.nodes[i + 1]], by = G.ny[r.nodes[i + 1]];
    if (bx === undefined) break;
    if (!k) { cur = null; continue; }
    const kind = k === 1 ? "ladder" : "chute";
    if (cur && cur.kind === kind) { cur.pts.push(bx, by); continue; }
    cur = { kind, pts: [ax, ay, bx, by] };
    out.push(cur);
  }
  /* drawRun drops anything too short to read on screen, so nothing else has
     to guess here */
  return out;
}

/* ============================================================
   input — tap a die, tap a body, commit
   ============================================================ */
export function onTap(ctx, p) {
  if (ctx.mode !== "travel") return false;
  if (over) { setUp(); return true; }
  if (phase !== "assign" || busy()) return true;

  /* tapping a body assigns the die in hand to it */
  const ti = bodyAt(p);
  if (ti >= 0 && sel >= 0 && allowed(sel, ti)) {
    dice[sel].to = ti;
    pop(tokens[ti]);
    select(ti);
    markDead();
    const nxt = firstOpen();
    sel = nxt;
    if (nxt >= 0) hoverBody(preferredFor(nxt));
    render();
    return true;
  }
  if (ti >= 0) { hoverBody(ti); return true; }
  return true;
}

/* One die to a body while there is more than one body left to move. Letting
   both land on the same one would quietly delete the only choice in the game. */
function allowed(di, ti) {
  if (!tokens[ti] || tokens[ti].home) return false;
  const live = tokens.filter((t) => !t.home).length;
  if (live <= 1) return true;
  return !dice.some((d, i) => i !== di && d.to === ti);
}

function bodyAt(p, reach) {
  let best = -1, bd = reach || 56;
  tokens.forEach((t, i) => {
    if (t.home) return;
    if (sel >= 0 && !allowed(sel, i)) return;
    const off = seat(t, tokens);
    const d = Math.hypot(sx(t.x) + off.dx - p.x, sy(t.y) + off.dy - p.y);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

/* ============================================================
   resolving
   ============================================================ */
let queue = [];

function commit() {
  if (phase !== "assign") return;
  queue = dice.map((d, i) => ({ d, i })).filter((x) => x.d.to !== null);
  /* a turn where nothing fitted is still a turn: it passes, and the other
     three keep coming */
  if (!queue.length) { finishTurn(); return; }
  phase = "resolving";
  render();
  step();
}

function step() {
  if (!queue.length) return finishTurn();
  const { d } = queue.shift();
  const ti = d.to;
  const t = tokens[ti];
  clearGhosts();
  select(ti);
  const g = ghost(dice.indexOf(d), ti) || ghostFresh(d, ti);
  if (!g) return step();
  if (!travelToken(t, g.r)) return step();
}

/* after a body has moved, the next body's ghost is stale */
function ghostFresh(d, ti) {
  clearGhosts();
  const t = tokens[ti];
  const from = nearestNodeFor(t.x, t.y, t.being, units(700));
  const to = nearestNodeFor(S.home.x, S.home.y, t.being, units(900));
  if (from < 0 || to < 0) return null;
  const full = route(from, to, t.being);
  if (!full || full.nodes.length < 2) return null;
  const { r } = afford(full, t.being, d.v * PIP);
  return r && r.nodes.length >= 2 ? { r } : null;
}

function next() {
  if (phase !== "resolving") return;
  clearGhosts();
  checkHome();
  if (queue.length) { step(); return; }
  finishTurn();
}

function finishTurn() {
  checkHome();
  clearGhosts();
  if (over) { render(); return; }
  rivalTurn();
  dice = [];
  phase = "roll";
  sel = -1;
  clearGhosts();
  render();
}

function checkHome() {
  for (const t of tokens) {
    if (t.home) continue;
    if (metres(Math.hypot(t.x - S.home.x, t.y - S.home.y)) < HOME) {
      t.home = true;
      burstAt(t.x, t.y);
      emit("leg", { who: "you" });
    }
  }
  for (const t of rivals) {
    if (t.home) continue;
    if (metres(Math.hypot(t.x - S.home.x, t.y - S.home.y)) < HOME) t.home = true;
  }
  /* An ending has to be shown the moment it happens. checkHome runs inside
     the draw loop, which never calls render on its own, so a game could be
     won and nothing on screen would ever say so. */
  if (!over && tokens.every((t) => t.home)) {
    over = { who: "you", turnNo };
    emit("crossing-over", over);
    render();
  } else if (!over && rivals.every((t) => t.home)) {
    over = { who: "rival", turnNo };
    emit("crossing-over", over);
    render();
  }
}

/* the other three, same dice, same ground, same marks */
function rivalTurn() {
  const rd = [d6(), d6()];
  for (const v of rd) {
    let best = null;
    for (const t of rivals) {
      if (t.home) continue;
      const from = nearestNodeFor(t.x, t.y, t.being, units(900));
      const to = nearestNodeFor(S.home.x, S.home.y, t.being, units(900));
      if (from < 0 || to < 0) continue;
      const full = route(from, to, t.being);
      if (!full || full.nodes.length < 2) continue;
      const { r } = afford(full, t.being, v * PIP);
      if (!r || r.nodes.length < 2) continue;
      const end = r.nodes[r.nodes.length - 1];
      if (!best || r.dist > best.gain) best = { t, r, gain: r.dist, end };
    }
    if (!best) continue;
    wear(best.r.edges, 1);
    for (const e of best.r.edges) {
      const m = G.emark[e];
      if (m) creditMark(m, { being: best.t.being, by: "rival" });
    }
    S.journeys.push({ pts: routePoints(best.r), by: "rival", being: best.t.being.id, t: Date.now() });
    best.t.node = best.end;
    best.t.x = G.nx[best.end]; best.t.y = G.ny[best.end];
  }
  checkHome();
}

/* ============================================================
   the tray — two dice and a bar, and nothing else
   ============================================================ */
function buildTray(ctx) {
  const style = document.createElement("style");
  style.textContent = `
    #pgtray{
      position:fixed;left:0;right:0;bottom:0;
      padding:9px 10px calc(9px + var(--sab));
      display:flex;align-items:center;justify-content:center;gap:12px;
      background:linear-gradient(to top,rgba(239,234,221,.97),rgba(239,234,221,.72) 70%,transparent);
      pointer-events:none}
    #pgtray > *{pointer-events:auto}
    .pgdie{
      width:56px;height:56px;border:2.5px solid var(--ink);background:var(--paper-lit);
      border-radius:7px;display:grid;place-items:center;
      font:700 27px/1 Georgia,serif;color:var(--ink);
      box-shadow:0 1px 3px rgba(29,32,29,.16);
      transition:transform .16s cubic-bezier(.2,.8,.3,1),background .18s,opacity .18s}
    .pgdie.hand{background:var(--ink);color:var(--paper-lit);transform:translateY(-5px) scale(1.06)}
    .pgdie.spent{opacity:.42;border-style:dashed}
    .pgdie.dead{opacity:.34;border-style:dotted;text-decoration:line-through}
    .pgdie.lifted{opacity:.2}
    .pgdie.carrying{
      position:fixed;z-index:60;pointer-events:none;margin:0;opacity:.94;
      box-shadow:0 10px 24px rgba(29,32,29,.34)}
    .pgdie.roll{font:700 12px/1.3 ui-monospace,monospace;letter-spacing:.13em;width:auto;padding:0 22px}
    #pgbar{
      border:0;border-radius:7px;padding:0 20px;height:56px;
      font:700 12px/1 ui-monospace,monospace;letter-spacing:.15em;
      background:var(--ink);color:var(--paper-lit)}
    #pgbar[disabled]{background:transparent;color:var(--ink);opacity:.4;
      box-shadow:inset 0 0 0 2px rgba(29,32,29,.3)}
    #pgend{
      position:fixed;inset:0;z-index:40;display:none;
      align-items:center;justify-content:center;padding:26px;
      background:rgba(239,234,221,.93);backdrop-filter:blur(3px);
      -webkit-backdrop-filter:blur(3px)}
    #pgend.show{display:flex;animation:pgfade .5s ease}
    @keyframes pgfade{from{opacity:0}to{opacity:1}}
    #pgend .card{max-width:31ch;text-align:center;display:grid;gap:18px;justify-items:center}
    #pgend h1{
      font:400 clamp(26px,8vw,38px)/1.12 Georgia,serif;margin:0;letter-spacing:-.01em}
    #pgend .sub{font:italic 15px/1.65 Georgia,serif;color:var(--ink-soft);margin:0}
    #pgend .tally{
      display:flex;gap:0;border:1px solid rgba(29,32,29,.2);border-radius:5px;overflow:hidden}
    #pgend .tally div{padding:9px 14px;border-right:1px solid rgba(29,32,29,.15)}
    #pgend .tally div:last-child{border-right:0}
    #pgend .tally dt{
      font:600 9.5px/1.4 ui-monospace,monospace;letter-spacing:.11em;
      text-transform:uppercase;color:var(--ink-soft)}
    #pgend .tally dd{margin:2px 0 0;font:19px/1 Georgia,serif;font-variant-numeric:tabular-nums}
    #pgend button{
      border:0;border-radius:7px;padding:15px 30px;background:var(--ink);
      color:var(--paper-lit);font:700 12px/1 ui-monospace,monospace;letter-spacing:.16em}
    /* the pip steps aside for the tray */
    #pip{bottom:calc(84px + var(--sab)) !important;left:auto !important;right:14px !important;
      transform:none !important;width:58px !important;height:58px !important}
    #pip:active{transform:scale(.93) !important}
    #pip.on{transform:scale(1.05) !important}
    @keyframes pgbeat{0%,100%{transform:none}12%{transform:scale(1.075)}
      26%{transform:scale(.995)}38%{transform:scale(1.03)}56%{transform:none}}`;
  document.head.appendChild(style);

  tray = document.createElement("div");
  tray.id = "pgtray";
  ctx.hud.appendChild(tray);

  endCard = document.createElement("div");
  endCard.id = "pgend";
  ctx.hud.appendChild(endCard);
}

/* the only part of the tray that may change while a die is in the air */
function refreshBar() {
  const b = tray && tray.querySelector("#pgbar");
  if (!b) return;
  const ready = dice.every((d) => d.to !== null || d.dead);
  const none = dice.every((d) => d.to === null);
  b.textContent = !ready ? "PUT A DIE ON A BODY" : none ? "NOTHING FITS · PASS" : "GO";
  b.disabled = !ready;
}

function showEnd() {
  if (!endCard) return;
  if (!over) { endCard.classList.remove("show"); endCard.innerHTML = ""; return; }
  const won = over.who === "you";
  const ghosts = S.journeys.filter((j) => j.ghost).length;
  const built = S.marks.length;
  endCard.innerHTML = `
    <div class="card">
      <h1>${won ? "All three got home." : "It got all three home first."}</h1>
      <p class="sub">${won
        ? (built
          ? "The car was always going to make it. The other two got there on ground you put down."
          : "The city already carried all three of them. Not every ground does.")
        : "Somewhere out there is a body that could not follow the one in front."}</p>
      <dl class="tally">
        <div><dt>turns</dt><dd>${over.turnNo}</dd></div>
        <div><dt>you laid</dt><dd>${built}</dd></div>
        <div><dt>ghost roads</dt><dd>${ghosts}</dd></div>
      </dl>
      <button type="button">CROSS AGAIN</button>
    </div>`;
  endCard.querySelector("button").addEventListener("click", () => {
    endCard.classList.remove("show");
    setUp();
  });
  endCard.classList.add("show");
}

function render() {
  showEnd();
  if (!tray) return;
  /* Never rebuild the tray while a die is being carried: the element in the
     hand is the element holding the pointer, and replacing it drops the die
     mid-air. This was why a die could not be placed at all. */
  if (drag) { refreshBar(); return; }
  tray.innerHTML = "";

  if (over) { tray.innerHTML = ""; return; }

  if (phase === "roll") {
    const d = document.createElement("button");
    d.className = "pgdie roll";
    d.textContent = "ROLL";
    d.addEventListener("click", roll);
    tray.appendChild(d);
    return;
  }

  if (phase === "resolving") {
    const s = document.createElement("div");
    s.id = "pgbar";
    s.textContent = "GOING";
    s.style.opacity = ".5";
    tray.appendChild(s);
    return;
  }

  dice.forEach((d, i) => {
    const el = document.createElement("button");
    el.className = "pgdie" + (d.to !== null ? " spent" : "") + (d.dead ? " dead" : "")
      + (sel === i ? " hand" : "");
    el.textContent = d.v;
    if (d.to !== null) el.style.borderColor = tokens[d.to].being.ink.ladder;
    carry(el, i);
    tray.appendChild(el);
  });

  const b = document.createElement("button");
  b.id = "pgbar";
  const ready = dice.every((d) => d.to !== null || d.dead);
  const none = dice.every((d) => d.to === null);
  b.textContent = !ready ? "PUT A DIE ON A BODY" : none ? "NOTHING FITS · PASS" : "GO";
  b.disabled = !ready;
  b.addEventListener("click", commit);
  tray.appendChild(b);
}

/* ============================================================
   CARRYING A DIE

   You pick the die up and put it on the body you mean. Tapping works, but a
   die is a physical thing and the hand expects to carry it, so it can be
   dragged — and while it is in the air over a body, that body's city is the
   city on screen. You are not previewing a move. You are standing in it, and
   letting go is the only thing that costs anything.
   ============================================================ */
function carry(el, i) {
  const grab = (e) => {
    if (phase !== "assign") return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch {}
    if (dice[i].to !== null) { dice[i].to = null; markDead(); }
    sel = i;
    const r = el.getBoundingClientRect();
    const ghostEl = el.cloneNode(true);
    ghostEl.className = "pgdie hand carrying";
    ghostEl.style.left = r.left + "px";
    ghostEl.style.top = r.top + "px";
    ghostEl.style.width = r.width + "px";
    ghostEl.style.height = r.height + "px";
    ghostEl.style.transform = "translate(0px,-62px) scale(.86)";
    document.body.appendChild(ghostEl);
    drag = { i, el, ghostEl, x0: e.clientX, y0: e.clientY, moved: false };
    el.classList.add("lifted");
    hoverBody(preferredFor(i));
    render();
  };
  const move = (e) => {
    if (!drag || drag.i !== i) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    /* carried above the thumb, never on top of the body being chosen */
    drag.ghostEl.style.transform = `translate(${dx}px,${dy - 62}px) scale(.86)`;
    const t = bodyAtClient(e.clientX, e.clientY);
    if (t >= 0 && t !== hover) hoverBody(t);
  };
  const drop = (e) => {
    if (!drag || drag.i !== i) return;
    const t = bodyAtClient(e.clientX, e.clientY);
    drag.ghostEl.remove();
    el.classList.remove("lifted");
    const wasMoved = drag.moved;
    drag = null;
    /* dropped on a body: it is theirs. dropped nowhere after a real drag:
       nothing happens. tapped without moving: the die is simply in hand, and
       the next tap on a body places it. */
    if (t >= 0 && allowed(i, t)) {
      dice[i].to = t;
      pop(tokens[t]);
      select(t);
      markDead();
      const nxt = firstOpen();
      sel = nxt;
      if (nxt >= 0) hoverBody(preferredFor(nxt));
    } else if (!wasMoved) {
      sel = i;
    }
    render();
  };
  el.addEventListener("pointerdown", grab);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", drop);
  el.addEventListener("pointercancel", drop);
}

/* client coordinates -> which body, with a thumb-sized target */
function bodyAtClient(cx, cy) {
  const r = ctxRef.cv.getBoundingClientRect();
  return bodyAt({ x: cx - r.left, y: cy - r.top }, 64);
}

/* ============================================================
   drawing — the bodies, home, and the ghosts of what a die would do
   ============================================================ */
export function draw(ctx, now) {
  const c = ctx.c;
  if (S.home) drawHome(c, now);

  /* the ghost of the die in hand, over every body it could go to */
  if (phase === "assign" && sel >= 0) {
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].home || !allowed(sel, i)) continue;
      const g = ghost(sel, i);
      if (g) drawGhost(c, g, tokens[i], i === hover, now);
    }
  }
  /* and the ones already placed */
  if (phase === "assign") {
    dice.forEach((d, di) => {
      if (d.to === null) return;
      const g = ghost(di, d.to);
      if (g) drawGhost(c, g, tokens[d.to], true, now, true);
    });
  }

  for (const t of rivals) drawBody(c, t, true, false, now);
  tokens.forEach((t, i) => drawBody(c, t, false, i === hover && phase === "assign", now));
  drawBursts(c, now);

  /* whatever is walled in, and exactly how much nothing is in the way */
  if (phase === "assign") {
    for (const w of stuck) {
      if (!w.ghost || !w.ghost.balk) continue;
      const b = w.ghost.balk;
      c.save();
      c.globalAlpha = 0.5 + 0.3 * Math.sin(now / 520);
      c.strokeStyle = "#bf4526";
      c.lineWidth = 2;
      c.setLineDash([4, 6]);
      c.beginPath();
      c.moveTo(sx(w.ghost.ex), sy(w.ghost.ey));
      c.lineTo(sx(b.toX), sy(b.toY));
      c.stroke();
      c.setLineDash([]);
      c.restore();
    }
  }
}

function drawHome(c, now) {
  const X = sx(S.home.x), Y = sy(S.home.y);
  const pulse = 0.5 + 0.5 * Math.sin(now / 950);
  c.save();
  c.globalAlpha = 0.9;
  c.strokeStyle = "#1d201d";
  c.lineWidth = 2.4;
  c.beginPath();
  c.arc(X, Y, 15, 0, TAU);
  c.stroke();
  c.globalAlpha = 0.3 + pulse * 0.2;
  c.beginPath();
  c.arc(X, Y, 22 + pulse * 5, 0, TAU);
  c.lineWidth = 1.2;
  c.stroke();
  c.globalAlpha = 1;
  c.fillStyle = "#1d201d";
  c.beginPath();
  c.arc(X, Y, 4.5, 0, TAU);
  c.fill();
  c.restore();
}

function drawGhost(c, g, tok, strong, now, placed) {
  const col = tok.being.ink.ladder;
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.globalAlpha = strong ? 0.9 : 0.3;
  c.strokeStyle = col;
  c.lineWidth = strong ? 4 : 2;
  c.setLineDash(placed ? [] : [9, 7]);
  c.beginPath();
  c.moveTo(sx(g.pts[0]), sy(g.pts[1]));
  for (let i = 2; i + 1 < g.pts.length; i += 2) c.lineTo(sx(g.pts[i]), sy(g.pts[i + 1]));
  c.stroke();
  c.setLineDash([]);

  /* where it would come to rest */
  const EX = sx(g.ex), EY = sy(g.ey);
  c.globalAlpha = strong ? 0.95 : 0.4;
  c.beginPath();
  c.arc(EX, EY, strong ? 11 : 7, 0, TAU);
  c.strokeStyle = col;
  c.lineWidth = strong ? 3 : 1.8;
  c.stroke();
  if (g.arrives) {
    c.beginPath();
    c.arc(EX, EY, strong ? 17 : 12, 0, TAU);
    c.lineWidth = 2;
    c.stroke();
  }

  /* what the ground does to this body, along the way it would take */
  if (g.runs && strong) for (const run of g.runs) drawRun(c, run, now);

  /* the ground ran out for this body. draw the exact amount of nothing that
     is in the way, and let the hand work out the rest. */
  if (g.balk && strong) {
    c.globalAlpha = 0.85;
    c.strokeStyle = "#bf4526";
    c.lineWidth = 2;
    c.setLineDash([4, 6]);
    c.beginPath();
    c.moveTo(EX, EY);
    c.lineTo(sx(g.balk.toX), sy(g.balk.toY));
    c.stroke();
    c.setLineDash([]);
    c.beginPath();
    c.arc(sx(g.balk.toX), sy(g.balk.toY), 6, 0, TAU);
    c.stroke();
  }
  c.restore();
}

/* ============================================================
   THE BODIES

   Three shapes you can tell apart at a glance and at arm's length, because
   the whole decision every turn is WHICH of them, and a decision you cannot
   see is not a decision. They are drawn, not lettered: a car is a car from
   the side, a wheelchair is a wheel, a walker is a person mid-stride.
   ============================================================ */
/* A ladder gets rails and rungs and they climb. A chute gets a smooth bed and
   arrows and they fall. Both are drawn ONTO the way itself, because a ladder
   is not a thing on the map — it is what this ground does to this body, and it
   only exists while somebody is on it. */
const LADDER_INK = "#12907c", CHUTE_INK = "#c0421f";

function drawRun(c, run, now) {
  const pts = run.pts;
  const up = run.kind === "ladder";
  const col = up ? LADDER_INK : CHUTE_INK;

  const P = [];
  for (let i = 0; i + 1 < pts.length; i += 2) P.push(sx(pts[i]), sy(pts[i + 1]));
  const seg = [];
  let L = 0;
  for (let i = 0; i + 3 < P.length; i += 2) {
    const d = Math.hypot(P[i + 2] - P[i], P[i + 3] - P[i + 1]);
    seg.push(d); L += d;
  }
  if (L < 16) return;

  const trace = () => {
    c.beginPath();
    c.moveTo(P[0], P[1]);
    for (let i = 2; i + 1 < P.length; i += 2) c.lineTo(P[i], P[i + 1]);
  };

  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";

  /* paper cleared either side, so the mark never fights the city under it */
  c.strokeStyle = "#f9f6ee";
  c.globalAlpha = 0.95;
  c.lineWidth = up ? 17 : 15;
  trace(); c.stroke();

  c.globalAlpha = 1;
  c.strokeStyle = col;
  c.lineWidth = up ? 11 : 9;
  trace(); c.stroke();

  /* rails, only on the ladder */
  if (up) {
    c.globalAlpha = 0.92;
    c.strokeStyle = "#f9f6ee";
    c.lineWidth = 1.6;
    for (const d of [-3.4, 3.4]) {
      c.beginPath();
      for (let i = 0; i + 3 < P.length; i += 2) {
        const ax = P[i], ay = P[i + 1], bx = P[i + 2], by = P[i + 3];
        const L2 = Math.hypot(bx - ax, by - ay) || 1;
        const nx = -(by - ay) / L2 * d, ny = (bx - ax) / L2 * d;
        if (i === 0) c.moveTo(ax + nx, ay + ny);
        c.lineTo(bx + nx, by + ny);
      }
      c.stroke();
    }
  }

  /* the marks that march: rungs climb toward you, arrows fall away */
  const STEP = up ? 15 : 22;
  const speed = up ? 700 : 460;
  const flow = MOVING ? ((now / speed) % 1) * (up ? -1 : 1) : 0;
  let walked = 0, si = 0;
  c.globalAlpha = 1;
  for (let d = ((flow * STEP) % STEP + STEP) % STEP; d < L; d += STEP) {
    while (si < seg.length - 1 && walked + seg[si] < d) { walked += seg[si]; si++; }
    const bx = P[si * 2 + 2];
    if (bx === undefined) break;
    const t = seg[si] > 0 ? (d - walked) / seg[si] : 0;
    const ax = P[si * 2], ay = P[si * 2 + 1], by = P[si * 2 + 3];
    const X = ax + (bx - ax) * t, Y = ay + (by - ay) * t;
    c.save();
    c.translate(X, Y);
    c.rotate(Math.atan2(by - ay, bx - ax));
    c.strokeStyle = "#f9f6ee";
    if (up) {
      c.lineWidth = 3.2;
      c.beginPath();
      c.moveTo(0, -4.4); c.lineTo(0, 4.4);
      c.stroke();
    } else {
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-4.6, -5); c.lineTo(2.6, 0); c.lineTo(-4.6, 5);
      c.stroke();
    }
    c.restore();
  }
  c.restore();
}

/* Side elevation, because that is how a car is a car: a roof line that drops
   at the bonnet, glass you can see through, and two wheels carrying it. */
function iconCar(c, r, ink, paper) {
  c.lineJoin = "round";
  c.fillStyle = ink;
  c.beginPath();
  c.moveTo(-r, r * 0.30);
  c.lineTo(-r, -r * 0.06);
  c.quadraticCurveTo(-r * 0.98, -r * 0.20, -r * 0.72, -r * 0.24);
  c.lineTo(-r * 0.40, -r * 0.66);
  c.quadraticCurveTo(-r * 0.32, -r * 0.80, -r * 0.14, -r * 0.80);
  c.lineTo(r * 0.30, -r * 0.80);
  c.quadraticCurveTo(r * 0.46, -r * 0.80, r * 0.54, -r * 0.66);
  c.lineTo(r * 0.76, -r * 0.24);
  c.quadraticCurveTo(r, -r * 0.20, r, -r * 0.02);
  c.lineTo(r, r * 0.30);
  c.closePath();
  c.fill();
  /* glass */
  c.fillStyle = paper;
  c.beginPath();
  c.moveTo(-r * 0.34, -r * 0.30);
  c.lineTo(-r * 0.12, -r * 0.66);
  c.lineTo(r * 0.24, -r * 0.66);
  c.lineTo(r * 0.40, -r * 0.30);
  c.closePath();
  c.fill();
  /* wheels, with hubs so they read as wheels and not as dots */
  c.fillStyle = ink;
  c.beginPath();
  c.arc(-r * 0.52, r * 0.40, r * 0.34, 0, TAU);
  c.arc(r * 0.56, r * 0.40, r * 0.34, 0, TAU);
  c.fill();
  c.fillStyle = paper;
  c.beginPath();
  c.arc(-r * 0.52, r * 0.40, r * 0.13, 0, TAU);
  c.fill();
  c.beginPath();
  c.arc(r * 0.56, r * 0.40, r * 0.13, 0, TAU);
  c.fill();
}

/* The big rear wheel with its handrim, a seated figure, and the small castor
   in front — the shape everybody already knows, drawn properly. */
function iconChair(c, r, ink, paper) {
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = ink;
  c.fillStyle = ink;

  const wx = r * 0.10, wy = r * 0.30, wr = r * 0.60;
  c.lineWidth = r * 0.15;
  c.beginPath();
  c.arc(wx, wy, wr, 0, TAU);
  c.stroke();
  c.lineWidth = r * 0.08;
  c.beginPath();
  c.arc(wx, wy, wr * 0.66, 0, TAU);
  c.stroke();
  /* castor */
  c.beginPath();
  c.arc(-r * 0.72, r * 0.72, r * 0.18, 0, TAU);
  c.fill();

  /* the person */
  c.beginPath();
  c.arc(-r * 0.18, -r * 0.74, r * 0.26, 0, TAU);
  c.fill();
  c.lineWidth = r * 0.18;
  c.beginPath();
  c.moveTo(-r * 0.16, -r * 0.44);
  c.lineTo(-r * 0.04, r * 0.02);
  c.stroke();
  c.beginPath();
  c.moveTo(-r * 0.04, r * 0.02);
  c.lineTo(-r * 0.62, r * 0.16);
  c.stroke();
  c.beginPath();
  c.moveTo(-r * 0.14, -r * 0.28);
  c.lineTo(r * 0.46, -r * 0.14);
  c.stroke();
}

/* Mid-stride, arms swinging: a walker has to look like it is going somewhere
   or it reads as a pin. */
function iconFoot(c, r, ink, paper) {
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = ink;
  c.fillStyle = ink;
  c.beginPath();
  c.arc(-r * 0.04, -r * 0.72, r * 0.27, 0, TAU);
  c.fill();
  c.lineWidth = r * 0.20;
  c.beginPath();
  c.moveTo(-r * 0.02, -r * 0.40);
  c.lineTo(r * 0.06, r * 0.10);
  c.stroke();
  /* legs */
  c.beginPath();
  c.moveTo(r * 0.06, r * 0.10);
  c.lineTo(-r * 0.44, r * 0.52);
  c.lineTo(-r * 0.56, r * 0.86);
  c.stroke();
  c.beginPath();
  c.moveTo(r * 0.06, r * 0.10);
  c.lineTo(r * 0.50, r * 0.50);
  c.lineTo(r * 0.66, r * 0.86);
  c.stroke();
  /* arms */
  c.lineWidth = r * 0.15;
  c.beginPath();
  c.moveTo(-r * 0.02, -r * 0.24);
  c.lineTo(-r * 0.52, -r * 0.02);
  c.stroke();
  c.beginPath();
  c.moveTo(-r * 0.02, -r * 0.24);
  c.lineTo(r * 0.48, -r * 0.34);
  c.stroke();
}
const ICON = { CAR: iconCar, WHEELCHAIR: iconChair, FOOT: iconFoot };

/* Three bodies standing on the same corner are three bodies, not one. */
function seat(t, list) {
  let n = 0, k = 0;
  for (const o of list) {
    if (o === t) { k = n; n++; continue; }
    if (Math.hypot(o.x - t.x, o.y - t.y) < units(120)) n++;
  }
  if (n < 2) return { dx: 0, dy: 0 };
  const a = -Math.PI / 2 + (k / n) * TAU;
  const r = 27;
  return { dx: Math.cos(a) * r, dy: Math.sin(a) * r };
}

/* ---------- motion ----------
   Nothing here is decoration. A body breathes so you can tell it is a body
   and not a marker; it takes the die with a jolt so you know the die landed;
   and it rings out when it gets home so an arrival is felt rather than
   noticed later in a row of pips. */
const bursts = [];
function pop(t) { t.popAt = performance.now(); }
export function burstAt(x, y) { bursts.push({ x, y, t0: performance.now() }); }

function spring(k) {
  if (k >= 1) return 1;
  return 1 + Math.sin(k * Math.PI * 2.2) * 0.26 * (1 - k);
}

function drawBody(c, t, rival, lit, now) {
  const off = seat(t, rival ? rivals : tokens);
  const idle = MOVING ? Math.sin(now / 1100 + (t.being.name.length * 1.7)) * 1.1 : 0;
  const X = sx(t.x) + off.dx, Y = sy(t.y) + off.dy + idle;
  if (X < -60 || X > View.w + 60 || Y < -60 || Y > View.h + 60) return;

  const base = rival ? 13 : 19;
  const k = t.popAt ? clamp((now - t.popAt) / 420, 0, 1) : 1;
  const R = base * (t.popAt ? spring(k) : 1);

  c.save();
  if (t.home) c.globalAlpha = 0.55;

  /* it sits on the cloth, so it casts a little */
  c.globalAlpha *= 1;
  c.beginPath();
  c.ellipse(X, Y + R * 0.92, R * 0.72, R * 0.26, 0, 0, TAU);
  c.fillStyle = "rgba(29,32,29,.16)";
  c.fill();

  if (lit) {
    const b = 0.5 + 0.5 * Math.sin(now / 300);
    c.save();
    c.globalAlpha = 0.28 + b * 0.4;
    c.strokeStyle = t.being.ink.ladder;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(X, Y, R + 11 + b * 4, 0, TAU);
    c.stroke();
    c.restore();
  }

  const ink = rival ? AMBER_DEEP : t.being.ink.ladder;
  const paper = rival ? "#f6efdc" : "#f9f6ee";

  c.beginPath();
  c.arc(X, Y, R, 0, TAU);
  c.fillStyle = paper;
  c.fill();
  c.lineWidth = rival ? 2.2 : 3;
  c.strokeStyle = ink;
  c.stroke();

  c.save();
  c.translate(X, Y);
  (ICON[t.being.name] || iconFoot)(c, R * 0.62, ink, paper);
  c.restore();

  if (t.home) {
    c.globalAlpha = 0.95;
    c.setLineDash([3.5, 4]);
    c.lineWidth = 1.8;
    c.beginPath();
    c.arc(X, Y, R + 7, 0, TAU);
    c.stroke();
    c.setLineDash([]);
  }
  c.restore();
}

function drawBursts(c, now) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    const k = (now - b.t0) / 1100;
    if (k >= 1) { bursts.splice(i, 1); continue; }
    const X = sx(b.x), Y = sy(b.y);
    c.save();
    for (let ring = 0; ring < 2; ring++) {
      const kk = clamp(k - ring * 0.16, 0, 1);
      if (kk <= 0) continue;
      c.globalAlpha = (1 - kk) * 0.7;
      c.strokeStyle = "#1d201d";
      c.lineWidth = 2.4 * (1 - kk) + 0.6;
      c.beginPath();
      c.arc(X, Y, 12 + ease(kk) * 52, 0, TAU);
      c.stroke();
    }
    c.restore();
  }
}

/* harness only: what a die would do to a body, runs and all */
export function probeGhost(di, ti) { return ghost(di, ti); }

/* the wall a body is standing at, for the harness */
export function wallFor(ti) {
  clearGhosts();
  for (let i = 0; i < dice.length; i++) {
    const g = ghost(i, ti);
    if (g && g.balk) return { ex: g.ex, ey: g.ey, tx: g.balk.toX, ty: g.balk.toY };
  }
  const t = tokens[ti];
  return t && S.home ? { ex: t.x, ey: t.y, tx: S.home.x, ty: S.home.y } : null;
}

/* how much ground the best die on the table would win this body */
export function gainFor(ti) {
  clearGhosts();
  let best = 0;
  for (let i = 0; i < dice.length; i++) {
    const g = ghost(i, ti);
    if (g && g.gain > best) best = g.gain;
  }
  return Math.round(best);
}

export const state = () => ({ tokens, rivals, dice, phase, over, turnNo, home: S.home });
