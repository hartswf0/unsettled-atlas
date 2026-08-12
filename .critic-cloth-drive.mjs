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

await page.evaluate(async () => {
  const B = await import("./pg/beings.js");
  window.__B = B;
});

const fps = async () => page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else res(n); };
  requestAnimationFrame(tick);
}));

const info = async () => page.evaluate(() => ({
  being: PG.S.being && PG.S.being.id, z: +PG.View.z.toFixed(2),
  q: +PG.ctx.quality.toFixed(2), node: PG.S.you && PG.S.you.node,
  marks: PG.S.marks.length, journeys: PG.S.journeys.length, edges: PG.G.e,
}));

const log = [];
async function snap(name) {
  await page.screenshot({ path: OUT + name + ".png" });
  log.push({ name, ...(await info()) });
}

await snap("d-01-car");

for (const id of ["rain", "chair", "foot"]) {
  await page.evaluate((id) => { PG.S.being = window.__B.byId(id); PG.emit("become", PG.S.being); }, id);
  await page.waitForTimeout(1400);
  await snap("d-02-" + id);
}
log.push({ fpsAfterBecome: await fps() });

// back to car, zoom in to street level
await page.evaluate(() => { PG.S.being = window.__B.byId("car"); PG.emit("become", PG.S.being); });
await page.waitForTimeout(900);
await page.evaluate(() => { PG.View.z = 16.4; PG.emit("resize"); });
await page.waitForTimeout(700);
await snap("d-03-car-z16");
await page.evaluate(() => { PG.S.being = window.__B.byId("chair"); PG.emit("become", PG.S.being); });
await page.waitForTimeout(1200);
await snap("d-04-chair-z16");
await page.evaluate(() => { PG.S.being = window.__B.byId("rain"); PG.emit("become", PG.S.being); });
await page.waitForTimeout(1200);
await snap("d-05-rain-z16");

// zoom out to metro
await page.evaluate(() => { PG.S.being = window.__B.byId("car"); PG.emit("become", PG.S.being); PG.View.z = 10.7; PG.emit("resize"); });
await page.waitForTimeout(1200);
await snap("d-06-metro");
log.push({ fpsMetro: await fps() });

console.log(JSON.stringify({ log, errors }, null, 2));
await browser.close();
