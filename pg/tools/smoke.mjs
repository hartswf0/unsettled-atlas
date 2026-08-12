/* Does the premise hold? Four beings, one Atlanta, four different boards. */
import { loadGraph, G, route, nearestNodeFor, addWay, CLS_MARK } from "../graph.js";
import { BEINGS } from "../beings.js";
import { mercX, mercY, metres } from "../geo.js";

const t0 = Date.now();
loadGraph();
console.log(`load+derive ${Date.now() - t0} ms — ${G.n} nodes, ${G.e} edges\n`);

/* how much of the city each being can even see */
console.log("WHAT EACH BEING SEES OF THE SAME GROUND");
const live = {};
for (const b of BEINGS) {
  let n = 0, ladder = 0, chute = 0;
  for (let e = 0; e < G.e; e++) {
    const r = b.read(e, true);
    if (!r.live) continue;
    n++;
    if (r.kind === "ladder") ladder++;
    else if (r.kind === "chute") chute++;
  }
  live[b.id] = n;
  console.log(
    `  ${b.name.padEnd(11)} ${String(n).padStart(6)} of ${G.e} edges ` +
    `(${((n / G.e) * 100).toFixed(0).padStart(3)}%)   ladders ${String(ladder).padStart(5)}   chutes ${String(chute).padStart(5)}`
  );
}

/* do they overlap, or is it the same board wearing hats? */
console.log("\nOVERLAP — share of edges both can use");
for (let i = 0; i < BEINGS.length; i++) {
  for (let j = i + 1; j < BEINGS.length; j++) {
    const A = BEINGS[i], B = BEINGS[j];
    let both = 0, either = 0;
    for (let e = 0; e < G.e; e++) {
      const a = isFinite(A.cost(e, true)), b = isFinite(B.cost(e, true));
      if (a && b) both++;
      if (a || b) either++;
    }
    console.log(`  ${A.name.padEnd(11)} ∩ ${B.name.padEnd(11)} ${((both / either) * 100).toFixed(0).padStart(3)}% of the ground they jointly touch`);
  }
}

/* a real trip across a real piece of Atlanta */
const FROM = { lng: -84.3880, lat: 33.7490 };  /* Five Points */
const TO = { lng: -84.3630, lat: 33.7620 };    /* Old Fourth Ward */
const fx = mercX(FROM.lng), fy = mercY(FROM.lat);
const tx = mercX(TO.lng), ty = mercY(TO.lat);

console.log("\nONE TRIP, FOUR TRAVELLERS  (Five Points -> Old Fourth Ward)");
for (const b of BEINGS) {
  const a = nearestNodeFor(fx, fy, b, 0.0006);
  const z = nearestNodeFor(tx, ty, b, 0.0006);
  if (a < 0 || z < 0) { console.log(`  ${b.name.padEnd(11)} cannot even stand here`); continue; }
  const t1 = Date.now();
  const r = route(a, z, b);
  const ms = Date.now() - t1;
  if (!r) { console.log(`  ${b.name.padEnd(11)} no route`); continue; }
  const kinds = { ladder: 0, chute: 0, plain: 0 };
  for (const e of r.edges) kinds[b.read(e, true).kind]++;
  console.log(
    `  ${b.name.padEnd(11)} ${r.balk ? "BALKED after" : "arrived in"} ${String(Math.round(r.dist)).padStart(5)} m ` +
    `over ${String(r.edges.length).padStart(3)} edges  ` +
    `[${kinds.ladder} ladder / ${kinds.chute} chute]  ${ms}ms` +
    (r.balk ? `  gap ${Math.round(r.balk.gap)} m` : "")
  );
}

/* THE TEST THAT MATTERS: draw one line. does it mean four different things? */
console.log("\nONE DRAWN LINE, FOUR READINGS");
/* a gentle wide line laid across a block near the start */
const A = { x: mercX(-84.3800), y: mercY(33.7530) };
const B = { x: mercX(-84.3770), y: mercY(33.7545) };
const mark = { width: 2.4, by: "test" };
const made = addWay([A.x, A.y, B.x, B.y], CLS_MARK, mark);
console.log(`  the line became ${made.length} edge(s), ${Math.round(made.reduce((s, e) => s + G.elen[e], 0))} m,` +
  ` grade ${G.egrade[made[0]].toFixed(1)}%, pitch ${(G.epitch[made[0]] * 100).toFixed(0)}th percentile, width ${G.ewidth[made[0]]} m`);
for (const b of BEINGS) {
  const r = b.read(made[0], true);
  const back = b.read(made[0], false);
  const say = (x) => x.live ? `${x.kind.toUpperCase()} (×${x.ratio.toFixed(2)})` : "DOES NOT EXIST";
  console.log(`  ${b.name.padEnd(11)} ->  ${say(r).padEnd(22)} | reversed: ${say(back)}`);
}
