import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-unsettled-atlas/b4dd44f3-bac0-5361-9cf4-3f06f063c9d1/scratchpad/shots/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
});
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto("http://localhost:8141/perspectival-ground.html", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.evaluate(async () => { window.__B = await import("./pg/beings.js"); });

// instrument every organ's draw
await page.evaluate(() => {
  window.__T = {};
  for (const [name, o] of Object.entries(PG.organs)) {
    if (!o.draw) continue;
    const orig = o.draw.bind(o);
    window.__T[name] = { ms: 0, n: 0 };
    o.draw = (ctx, now) => {
      const t = performance.now();
      orig(ctx, now);
      const r = window.__T[name]; r.ms += performance.now() - t; r.n++;
    };
  }
});

const measure = async (label, extra = {}) => {
  await page.evaluate(() => { for (const k in window.__T) { window.__T[k].ms = 0; window.__T[k].n = 0; } });
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(Math.round(n / 1.5)); };
    requestAnimationFrame(tick);
  }));
  const T = await page.evaluate(() => {
    const o = {};
    for (const k in window.__T) { const r = window.__T[k]; o[k] = r.n ? +(r.ms / r.n).toFixed(2) : 0; }
    return o;
  });
  return { label, fps, msPerFrame: T, q: await page.evaluate(() => +PG.ctx.quality.toFixed(2)), ...extra };
};

const log = [];
log.push(await measure("idle car z14.6"));

// panning: cloth must reweave
await page.evaluate(() => { window.__pan = setInterval(() => { PG.View.x += 0.0000009; }, 16); });
await page.waitForTimeout(400);
log.push(await measure("panning"));
await page.evaluate(() => clearInterval(window.__pan));

// street zoom
await page.evaluate(() => { PG.View.z = 16.4; });
await page.waitForTimeout(600);
log.push(await measure("z16.4"));
// metro
await page.evaluate(() => { PG.View.z = 10.6; });
await page.waitForTimeout(800);
log.push(await measure("z10.6 metro"));
await page.evaluate(() => { PG.View.z = 14.6; });
await page.waitForTimeout(600);

// each being
for (const id of ["rain", "chair", "foot", "car"]) {
  await page.evaluate((id) => { PG.S.being = window.__B.byId(id); PG.emit("become", PG.S.being); }, id);
  await page.waitForTimeout(1300);
  log.push(await measure("being " + id));
}

// now stress: real marks and journeys via the graph
const stress = await page.evaluate(async () => {
  const gm = await import("./pg/graph.js");
  const st = await import("./pg/state.js");
  const geo = await import("./pg/geo.js");
  const b = geo.viewBounds(0);
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const x = b.x0 + Math.random() * (b.x1 - b.x0), y = b.y0 + Math.random() * (b.y1 - b.y0);
    const pts = [];
    let px = x, py = y;
    for (let k = 0; k < 6; k++) { pts.push(px, py); px += (Math.random() - .5) * geo.units(160); py += (Math.random() - .5) * geo.units(160); }
    try { st.layMark(Float64Array.from(pts), 1.2 + Math.random() * 3, PG.S.being); n++; } catch (e) { return { err: String(e) }; }
  }
  for (let i = 0; i < 2000; i++) {
    const x = b.x0 + Math.random() * (b.x1 - b.x0), y = b.y0 + Math.random() * (b.y1 - b.y0);
    try { st.logJourney([x, y, x + geo.units(300), y + geo.units(200)], null, PG.S.being); } catch (e) {}
  }
  return { marks: PG.S.marks.length, journeys: PG.S.journeys.length, edges: PG.G.e, n };
});
await page.waitForTimeout(900);
log.push(await measure("400 marks + 2000 journeys", { stress }));
await page.screenshot({ path: OUT + "p-stress.png" });

console.log(JSON.stringify({ log, errors }, null, 2));
await browser.close();
