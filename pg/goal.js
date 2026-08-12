/* PERSPECTIVAL GROUND — the crossing.

   Without this file the rest is a world. This is the game.

   THE CROSSING. Somewhere across Atlanta there is a real place. You are trying
   to reach it. So is somebody else, and they are as fast as you are.

   THE TURN. A turn is not a distance, it is an effort — and what an effort buys
   depends entirely on what you have become. The interstate costs a car almost
   nothing, so as a car one turn is two miles. A hill costs a wheelchair almost
   everything, so as a wheelchair the same turn is four hundred metres. That is
   chutes and ladders, and it was already sitting in the cost function; all this
   does is give you only so much of it.

   WHY DRAWING MATTERS. Three reasons, and none of them is explained anywhere in
   the game:
     - past a balk it is the only move you have.
     - a good line is a ladder for the body that needs it, so the ramp you lay
       today is the reason a later turn covers three kilometres instead of four
       hundred metres. Drawing is how you buy future speed.
     - your rival can use it too. Everything you lay into the ground is laid
       into their ground. Sometimes the honest move is not to build.

   You draw the world without knowing who it will serve. Here that stops being
   a theme and starts costing you the crossing. */

import { GROUND } from "./ground.data.js";
import {
  View, sx, sy, mercX, mercY, metres, units, clamp, lerp, ease, TAU,
  worldSize, viewBounds,
} from "./geo.js";
import { G, route, routePoints, nearestNodeFor, afford, wear } from "./graph.js";
import { BEINGS, nextBeing, byId } from "./beings.js";
import { S, on, emit, creditMark, logBalk } from "./state.js";

/* one turn's worth of going */
const ALLOWANCE = 1500;
/* how near is arrived */
const ARRIVE = 260;

const AMBER = "#c98a2e", AMBER_DEEP = "#8a5a12";

/* Three places. Both of you run the same course, in the same order, and you
   will be a different body for each of them — so the crossing has to be made
   by a car AND by whatever cannot use what a car uses. That is the whole
   argument of the game turned into a win condition. */
const LEGS = 3;

let course = [];        /* the three places, in order */
let leg = 0;            /* which one you are on */
let rivalLeg = 0;
let goal = null;        /* course[leg] */
let rival = null;       /* {node,x,y,being,trip} */
let over = null;        /* {who, turns} */
let turns = 0;
let banner = null;      /* {text, t0, life} */

export function init(ctx) {
  S.allowance = ALLOWANCE;
  on("boot", () => setTimeout(start, 60));
  on("arrive", () => { if (!over) setTimeout(rivalTurn, 520); });
  on("become", () => { turns++; });
  /* the moment the game is actually about */
  on("witness", (w) => {
    say(`${w.traveller.being.name.toLowerCase()} took your line`);
  });
}

/* ---------- setting up a crossing ---------- */
function start() {
  const me = S.you;
  if (!me) { setTimeout(start, 120); return; }

  /* a real place, far enough that it is a journey and near enough that it is
     not a joke. the name is real; nothing about it is a legend. */
  const places = (GROUND.places || [])
    .map((p) => ({ name: p[0], kind: p[1], x: mercX(p[2] / 1e5), y: mercY(p[3] / 1e5) }));

  /* a course of three, each a real journey from the last */
  course = [];
  let from = { x: me.x, y: me.y };
  for (let i = 0; i < LEGS; i++) {
    const cands = places
      .filter((p) => !course.some((c) => c.name === p.name))
      .map((p) => ({ ...p, d: metres(Math.hypot(p.x - from.x, p.y - from.y)) }))
      .filter((p) => p.d > 2200 && p.d < 6500)
      .sort((a, b) => a.d - b.d);
    if (!cands.length) break;
    const pick = cands[Math.floor(Math.random() * Math.min(3, cands.length))];
    const n = nearestNodeFor(pick.x, pick.y, null, units(1400));
    course.push(n >= 0
      ? { x: G.nx[n], y: G.ny[n], node: n, name: pick.name }
      : { x: pick.x, y: pick.y, node: -1, name: pick.name });
    from = pick;
  }
  if (!course.length) { goal = null; return; }

  leg = 0; rivalLeg = 0;
  goal = course[0];

  /* the other one starts where you start. the ground is the only advantage
     either of you gets. */
  rival = { x: me.x, y: me.y, node: me.node, being: nextBeing(S.being), trip: null };
  S.rival = rival;
  S.goal = goal;
  S.course = course;
  S.leg = 0;
  over = null; turns = 0;
  say(goal.name.toLowerCase());
  emit("crossing", { goal, course, rival });
}

function say(text) { banner = { text, t0: performance.now(), life: 2400 }; }

/* ---------- the other one ----------
   It plays by your rules exactly: it becomes something, it gets one turn's
   effort, it takes what the ground will give it, and it uses whatever anybody
   has drawn. It is not cheating and it is not being kind. */
function rivalTurn() {
  if (!rival || !course.length || over) return;
  rival.being = nextBeing(rival.being);

  const from = nearestNodeFor(rival.x, rival.y, rival.being, units(900));
  if (from < 0) return checkOver();
  rival.node = from;

  const g = course[rivalLeg] || goal;
  const to = g.node >= 0 ? g.node : nearestNodeFor(g.x, g.y, rival.being, units(1200));
  if (to < 0) return checkOver();

  const full = route(from, to, rival.being);
  if (!full || full.nodes.length < 2) return checkOver();
  const { r } = afford(full, rival.being, ALLOWANCE);
  if (!r || r.nodes.length < 2) return checkOver();

  wear(r.edges, 1);
  for (const e of r.edges) {
    const m = G.emark[e];
    if (m) creditMark(m, { being: rival.being, by: "rival" });
  }
  if (full.balk) logBalk(full.balk.x, full.balk.y, rival.being, full.balk.toX, full.balk.toY);

  const pts = routePoints(r);
  S.journeys.push({ pts, by: "rival", being: rival.being.id, t: Date.now() });
  rival.trip = { pts, at: 0, T: 1500, e: 0, last: r.nodes[r.nodes.length - 1] };
}

function checkOver() {
  if (over || !course.length) return;
  const me = S.you;

  if (me && leg < course.length) {
    const g = course[leg];
    if (metres(Math.hypot(me.x - g.x, me.y - g.y)) < ARRIVE) {
      leg++; S.leg = leg;
      emit("leg", { who: "you", leg, of: course.length });
      if (leg >= course.length) {
        over = { who: "you", turns };
        say("you made every crossing");
        emit("crossing-over", over);
        return;
      }
      goal = course[leg];
      S.goal = goal;
      say(goal.name.toLowerCase());
    }
  }

  if (rival && rivalLeg < course.length) {
    const g = course[rivalLeg];
    if (metres(Math.hypot(rival.x - g.x, rival.y - g.y)) < ARRIVE) {
      rivalLeg++;
      emit("leg", { who: "rival", leg: rivalLeg, of: course.length });
      if (rivalLeg >= course.length) {
        over = { who: "rival", turns };
        say("it made every crossing");
        emit("crossing-over", over);
      }
    }
  }
}

/* ============================================================
   drawing
   ============================================================ */
export function draw(ctx, now) {
  const c = ctx.c;
  if (rival && rival.trip) stepRival(ctx);
  checkOver();

  if (goal) drawGoal(c, now);
  if (rival) drawRival(c, now);
  if (banner) drawBanner(c, now);
}

function stepRival(ctx) {
  const t = rival.trip;
  t.e += ctx.dt;
  const k = clamp(t.e / t.T, 0, 1);
  const s = ease(k);
  /* walk the polyline */
  let total = 0;
  for (let i = 0; i + 3 < t.pts.length; i += 2) {
    total += Math.hypot(t.pts[i + 2] - t.pts[i], t.pts[i + 3] - t.pts[i + 1]);
  }
  let want = total * s, acc = 0;
  for (let i = 0; i + 3 < t.pts.length; i += 2) {
    const seg = Math.hypot(t.pts[i + 2] - t.pts[i], t.pts[i + 3] - t.pts[i + 1]);
    if (acc + seg >= want || i + 5 >= t.pts.length) {
      const u = seg > 0 ? clamp((want - acc) / seg, 0, 1) : 0;
      rival.x = lerp(t.pts[i], t.pts[i + 2], u);
      rival.y = lerp(t.pts[i + 1], t.pts[i + 3], u);
      break;
    }
    acc += seg;
  }
  if (k >= 1) { rival.node = t.last; rival.trip = null; }
}

/* The place you are both going. A real name on real ground, standing there
   whether or not anybody can reach it. */
function drawGoal(c, now) {
  const X = sx(goal.x), Y = sy(goal.y);
  const on = X > -80 && X < View.w + 80 && Y > -80 && Y < View.h + 80;
  const pulse = 0.5 + 0.5 * Math.sin(now / 900);

  if (on) {
    c.save();
    c.globalAlpha = 0.24 + pulse * 0.12;
    c.strokeStyle = "#1d201d";
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(X, Y, 20 + pulse * 5, 0, TAU);
    c.stroke();

    c.globalAlpha = 1;
    c.fillStyle = "#1d201d";
    c.beginPath();
    c.arc(X, Y, 5.5, 0, TAU);
    c.fill();
    c.strokeStyle = "#f6f2e8";
    c.lineWidth = 2;
    c.stroke();

    c.font = "italic 14px Georgia, serif";
    c.textAlign = "center";
    c.textBaseline = "bottom";
    c.lineWidth = 3.5;
    c.strokeStyle = "rgba(246,242,232,.9)";
    c.strokeText(goal.name, X, Y - 26);
    c.fillStyle = "#1d201d";
    c.fillText(goal.name, X, Y - 26);
    c.restore();
    return;
  }

  /* off screen: it still exists, and it is still that way. an arrow at the
     edge of the glass, because losing the thing you are racing for is not a
     difficulty worth having. */
  const cx = View.w / 2, cy = View.h / 2;
  const a = Math.atan2(Y - cy, X - cx);
  const m = 40;
  const rx = Math.min(cx - m, Math.abs(Math.cos(a)) > 1e-4 ? Math.abs((cx - m) / Math.cos(a)) : 1e9);
  const ry = Math.min(cy - m, Math.abs(Math.sin(a)) > 1e-4 ? Math.abs((cy - m) / Math.sin(a)) : 1e9);
  const rr = Math.min(rx, ry);
  const ex = cx + Math.cos(a) * rr, ey = cy + Math.sin(a) * rr;

  c.save();
  c.translate(ex, ey);
  c.rotate(a);
  c.globalAlpha = 0.8;
  c.fillStyle = "#1d201d";
  c.beginPath();
  c.moveTo(9, 0); c.lineTo(-6, 5.5); c.lineTo(-6, -5.5);
  c.closePath();
  c.fill();
  c.restore();

  c.save();
  c.globalAlpha = 0.7;
  c.font = "italic 12px Georgia, serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  const lx = cx + Math.cos(a) * (rr - 22), ly = cy + Math.sin(a) * (rr - 22);
  c.lineWidth = 3;
  c.strokeStyle = "rgba(246,242,232,.9)";
  c.strokeText(goal.name, lx, ly);
  c.fillStyle = "#1d201d";
  c.fillText(goal.name, lx, ly);
  c.restore();
}

/* The other one. Amber, square, and always drawn — if it is off screen it is
   pinned to the edge, because the whole tension is knowing where it is. */
function drawRival(c, now) {
  const X = sx(rival.x), Y = sy(rival.y);
  const on = X > -40 && X < View.w + 40 && Y > -40 && Y < View.h + 40;
  c.save();
  if (on) {
    if (rival.trip) {
      c.globalAlpha = 0.3;
      c.strokeStyle = AMBER;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(sx(rival.trip.pts[0]), sy(rival.trip.pts[1]));
      for (let i = 2; i + 1 < rival.trip.pts.length; i += 2) {
        c.lineTo(sx(rival.trip.pts[i]), sy(rival.trip.pts[i + 1]));
      }
      c.stroke();
    }
    c.globalAlpha = 1;
    c.translate(X, Y);
    c.fillStyle = AMBER;
    c.strokeStyle = AMBER_DEEP;
    c.lineWidth = 2;
    c.beginPath();
    c.rect(-7, -7, 14, 14);
    c.fill();
    c.stroke();
  } else {
    const cx = View.w / 2, cy = View.h / 2;
    const a = Math.atan2(Y - cy, X - cx);
    const m = 26;
    const rx = Math.abs(Math.cos(a)) > 1e-4 ? Math.abs((cx - m) / Math.cos(a)) : 1e9;
    const ry = Math.abs(Math.sin(a)) > 1e-4 ? Math.abs((cy - m) / Math.sin(a)) : 1e9;
    const rr = Math.min(rx, ry, Math.max(cx, cy));
    c.globalAlpha = 0.75;
    c.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    c.fillStyle = AMBER;
    c.strokeStyle = AMBER_DEEP;
    c.lineWidth = 1.5;
    c.beginPath();
    c.rect(-5, -5, 10, 10);
    c.fill();
    c.stroke();
  }
  c.restore();
}

/* The only words the game says, and it says each of them once. */
function drawBanner(c, now) {
  const k = (now - banner.t0) / banner.life;
  if (k >= 1) { banner = null; return; }
  const a = k < 0.12 ? k / 0.12 : k > 0.75 ? (1 - k) / 0.25 : 1;
  c.save();
  c.globalAlpha = clamp(a, 0, 1) * 0.9;
  c.font = "italic 17px Georgia, serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  const y = View.h * 0.17;
  c.lineWidth = 4;
  c.strokeStyle = "rgba(246,242,232,.92)";
  c.strokeText(banner.text, View.w / 2, y);
  c.fillStyle = over ? "#bf4526" : "#1d201d";
  c.fillText(banner.text, View.w / 2, y);
  c.restore();
}

/* tapping after it is over starts another crossing, from where you stand */
export function onTap(ctx, p) {
  if (!over) return false;
  start();
  return true;
}

export const state = () => ({ goal, course, leg, rivalLeg, rival, over, turns, legs: LEGS });
