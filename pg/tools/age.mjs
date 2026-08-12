/* Age a world.

   The central claim of this game is that over time the used world becomes more
   visible than the planned world. That is a claim about hour three, and nobody
   is going to play for three hours to check it. So: drive the real build, run
   thousands of real routes for real beings through the real graph, and take a
   picture of the result.

   node pg/tools/age.mjs <url> <outPrefix> [trips] [--phone]
*/
import { chromium } from "playwright";

const [, , url, prefix, tripsArg, ...rest] = process.argv;
const TRIPS = Number(tripsArg || 1200);
const phone = rest.includes("--phone");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({
  viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 860 },
  deviceScaleFactor: phone ? 3 : 2,
  isMobile: phone, hasTouch: phone,
});
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.PG && window.PG.S && window.PG.S.ready, null, { timeout: 15000 });

/* young */
await page.waitForTimeout(1200);
await page.screenshot({ path: `${prefix}-young.png` });

/* Run real traffic. Every trip is a real route for a real being between two
   real pieces of ground, and it wears the ground exactly as a player would. */
const stats = await page.evaluate(async (TRIPS) => {
  const { G, S } = window.PG;
  const gm = await import("./pg/graph.js");
  const bm = await import("./pg/beings.js");
  const st = await import("./pg/state.js");
  const geo = await import("./pg/geo.js");

  const beings = bm.BEINGS;
  let arrived = 0, balked = 0, ghosts0 = S.journeys.filter((j) => j.ghost).length;

  /* keep the traffic near the visible city, the way real traffic is */
  const b = geo.viewBounds(0);
  const span = (b.x1 - b.x0) * 2.2;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const pick = (being) => {
    for (let k = 0; k < 12; k++) {
      const x = cx + (Math.random() - 0.5) * span;
      const y = cy + (Math.random() - 0.5) * span;
      const n = gm.nearestNodeFor(x, y, being, geo.units(900));
      if (n >= 0) return n;
    }
    return -1;
  };

  for (let i = 0; i < TRIPS; i++) {
    const being = beings[i % beings.length];
    const a = pick(being), z = pick(being);
    if (a < 0 || z < 0 || a === z) continue;
    const r = gm.route(a, z, being);
    if (!r || r.edges.length === 0) continue;
    gm.wear(r.edges, 1);
    const pts = gm.routePoints(r);
    S.journeys.push({ pts, by: "aged", being: being.id, t: Date.now() });
    for (const e of r.edges) { const m = G.emark[e]; if (m) st.creditMark(m, { being, by: "aged" }); }
    if (r.balk) {
      balked++;
      st.logBalk(r.balk.x, r.balk.y, being, r.balk.toX, r.balk.toY);
    } else arrived++;
  }
  window.PG.emit("journey", null);

  let worn = 0, heavy = 0;
  for (let e = 0; e < G.e; e++) { if (G.euse[e] > 0) worn++; if (G.euse[e] >= 8) heavy++; }
  const ghosts = S.journeys.filter((j) => j.ghost).length;
  return {
    arrived, balked, journeys: S.journeys.length,
    edgesWorn: worn, edgesWornPct: +(worn / G.e * 100).toFixed(1),
    edgesHeavy: heavy, bruises: S.pressure.length,
    ghostRoadsFormed: ghosts - ghosts0, ghostRoads: ghosts,
    marks: S.marks.length,
  };
}, TRIPS);

await page.waitForTimeout(1400);
await page.screenshot({ path: `${prefix}-aged.png` });

const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else res(n); };
  requestAnimationFrame(tick);
}));

console.log(JSON.stringify({ trips: TRIPS, ...stats, fpsAfterAging: fps, errors }, null, 2));
await browser.close();
if (errors.length) process.exitCode = 2;
