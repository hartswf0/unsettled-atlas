/* PERSPECTIVAL GROUND — the beings.

   This is the game. Not the map, not the drawing — this.

   Every being is a function from the same ground to a different topology.
   Nothing here labels an edge a ladder or a chute. A being only says what a
   piece of ground costs it, and everything else is a consequence:

     cost is Infinity  ->  the ground does not exist for you
     cost is cheap     ->  it carries you (a ladder)
     cost is dear      ->  it takes from you (a chute)

   So the same line a player draws is genuinely three different things to
   three different travellers, and it is three different things because of
   what it physically IS — its fall, its width, its kerb — never because
   somebody tagged it. There is nothing to read. You find out by going. */

import { G, CLS_MOTORWAY, CLS_PRIMARY, CLS_SECONDARY, CLS_RAIL, CLS_MARK, CLS_GHOST } from "./graph.js";

/* A multiplier on metres. 1 is ordinary going. */
export const LADDER = 0.62;    /* at or below this, the ground is carrying you */
export const CHUTE_AT = 1.85;  /* at or above this, the ground is taking from you */
const CHUTE = CHUTE_AT;

/* How hard the traffic on an edge presses back. Roads silt up with use; paths
   are worn open by it. The same number, read opposite ways. */
function press(e) { return Math.min(1, G.euse[e] / 26); }

function make(def) {
  const b = {
    ...def,
    hMul: def.hMul ?? 0.8,
    /* what this being makes of a piece of ground, in one word it never says */
    read(e, forward) {
      const c = b.cost(e, forward);
      if (!isFinite(c)) return { live: false, kind: "none", ratio: Infinity };
      const r = G.elen[e] > 0 ? c / G.elen[e] : 1;
      return {
        live: true,
        kind: r <= LADDER ? "ladder" : r >= CHUTE ? "chute" : "plain",
        ratio: r,
      };
    },
  };
  return b;
}

/* ============================================================
   CAR
   Sees road. Does not see the creek it drives over, does not see the stair,
   does not see the line somebody drew unless it is wide enough to drive on.
   Its ladder is the interstate. Its chute is everybody else also driving.
   ============================================================ */
export const CAR = make({
  id: "car", name: "CAR", glyph: "▰",
  ink: { live: "#3a403a", ladder: "#bf4526", chute: "#8a6a2f", dead: "#c9c2b2" },
  speed: 260,
  cost(e, forward) {
    const cls = G.ec[e], len = G.elen[e];
    if (cls === CLS_RAIL) return Infinity;
    if (cls === CLS_MARK && G.ewidth[e] < 3) return Infinity;  /* too narrow to drive */
    let m;
    if (cls === CLS_MOTORWAY) m = 0.42;
    else if (cls === CLS_PRIMARY) m = 0.74;
    else if (cls === CLS_SECONDARY) m = 1.0;
    else if (cls === CLS_GHOST) m = 0.88;
    else m = 1.15;
    /* the road silts up with everything that has used it */
    m *= 1 + press(e) * 1.9;
    return len * m;
  },
});

/* ============================================================
   RAIN
   Does not see road at all. Sees fall. It cannot go up, ever, so most of the
   city simply is not there. A kerb is a wall it must pool against; a culvert
   is the fastest thing in the world.
   ============================================================ */
export const RAIN = make({
  id: "rain", name: "RAIN", glyph: "◈",
  ink: { live: "#2f7d84", ladder: "#0f6f70", chute: "#7a2f4e", dead: "#cfc8b8" },
  speed: 420,
  hMul: 0.4,
  cost(e, forward) {
    const len = G.elen[e];
    /* grade is signed a->b; going the other way flips the hill */
    const grade = forward ? G.egrade[e] : -G.egrade[e];
    if (grade > 0.25) return Infinity;      /* water does not climb */
    const fall = -grade;                    /* 0 .. 18 */
    if (G.ecul[e]) return len * 0.28;       /* a real culvert under a real road */
    /* steeper is faster; flat ground behind a high kerb is where rain stands */
    const m = (1.02 - Math.min(0.75, fall * 0.5)) * (1 + G.ecurb[e] * 0.95);
    return len * Math.max(0.3, m);
  },
});

/* ============================================================
   WHEELCHAIR
   Sees grade, kerb, width — and almost nothing else. The interstate is not
   slow for it, it is absent. The steepest ground in the city is a wall. What
   it needs most is the thing nobody draws on purpose: a wide, gentle line
   that touches down where the kerb is.
   ============================================================ */
export const CHAIR = make({
  id: "chair", name: "WHEELCHAIR", glyph: "◍",
  ink: { live: "#484e47", ladder: "#19a08a", chute: "#bf4526", dead: "#d2ccbd" },
  speed: 95,
  cost(e, forward) {
    const cls = G.ec[e], len = G.elen[e];
    if (cls === CLS_MOTORWAY || cls === CLS_RAIL) return Infinity;
    if (G.ewidth[e] < 1.15) return Infinity;          /* will not fit */
    if (G.epitch[e] > 0.93) return Infinity;          /* the steepest ground here is a wall */
    if (G.ecurb[e] >= 0.7) return Infinity;           /* a kerb with no cut */
    let m = 0.92 + Math.pow(G.epitch[e], 1.6) * 2.4;
    if (cls === CLS_MARK || cls === CLS_GHOST) {
      /* somebody laid a gentle wide line. this is the whole point. */
      m = G.epitch[e] < 0.72 ? 0.5 : 1.7;
    }
    m *= 1 + G.ecurb[e] * 0.75;
    return len * m;
  },
});

/* ============================================================
   FOOT
   Sees the most and is slowest at it. Walks the rail corridor, cuts the
   drawn line, and is the being whose repeated detours become the desire
   lines everybody else eventually inherits.
   ============================================================ */
export const FOOT = make({
  id: "foot", name: "FOOT", glyph: "⏦",
  ink: { live: "#5d635c", ladder: "#bf4526", chute: "#9a9083", dead: "#d2ccbd" },
  speed: 78,
  cost(e, forward) {
    const cls = G.ec[e], len = G.elen[e];
    if (cls === CLS_MOTORWAY) return Infinity;        /* nobody walks the Connector */
    let m;
    if (cls === CLS_RAIL) m = 1.15;                   /* the corridor is a path here */
    else if (cls === CLS_MARK) m = 0.78;
    else if (cls === CLS_GHOST) m = 0.6;              /* worn open by everyone before you */
    else if (cls === CLS_PRIMARY) m = 1.5;            /* wide, loud, no shade */
    else m = 1.0;
    m *= 1 + G.epitch[e] * 0.5;
    /* a path is made better by being used, not worse */
    m *= 1 - press(e) * 0.3;
    return len * m;
  },
});

export const BEINGS = [CAR, RAIN, CHAIR, FOOT];
export const byId = (id) => BEINGS.find((b) => b.id === id) || CAR;

/* The order you become things. Never the same twice running, and never a
   being whose board is the one you just left. */
export function nextBeing(cur, rand = Math.random) {
  const others = BEINGS.filter((b) => b.id !== cur.id);
  return others[Math.floor(rand() * others.length)];
}

/* ---------- what a being is trying to do ----------
   Used for the travellers the ground supplies when nobody else is here, and
   for proposing somewhere to go. Rain wants the bottom. Everyone else wants
   somewhere that is a real distance away. */
export function wants(being, fromNode) {
  if (being.id === "rain") return { downhill: true };
  return { far: true };
}
