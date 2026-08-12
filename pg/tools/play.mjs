/* Play the game the way a thumb does, and say whether it is a game.

   node pg/tools/play.mjs <url> <outPrefix> [--phone]
*/
import { chromium } from "playwright";

const [, , url, prefix, ...rest] = process.argv;
const phone = !rest.includes("--desktop");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({
  viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 860 },
  deviceScaleFactor: phone ? 2 : 2, isMobile: phone, hasTouch: phone,
});
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => window.PG?.S?.ready, null, { timeout: 15000 });
await page.waitForTimeout(1500);

const log = [];
const peek = () => page.evaluate(() => {
  const { S, organs } = window.PG;
  const g = organs.goal.state();
  const m = organs.move.state();
  const d = (a, b) => a && b ? Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 30678000) : null;
  return {
    being: S.being.name,
    allowance: S.allowance,
    youToGoal: d(S.you, g.goal),
    rivalToGoal: d(g.rival, g.goal),
    goal: g.goal?.name, over: g.over?.who || null,
    planCut: !!m.plan?.cut,
    planCost: m.plan ? Math.round(m.plan.r.cost) : null,
    planMetres: m.plan ? Math.round(m.plan.r.dist) : null,
    marks: S.marks.length, journeys: S.journeys.length,
    ghosts: S.journeys.filter((j) => j.ghost).length,
  };
});

log.push({ step: "start", ...(await peek()) });
await page.screenshot({ path: `${prefix}-1-start.png` });

const W = phone ? 390 : 1280, H = phone ? 844 : 860;

/* four turns of: tap somewhere, take the way, watch it become */
for (let turn = 1; turn <= 4; turn++) {
  /* tap toward the goal if we can see it, else just out ahead */
  const target = await page.evaluate(({ W, H }) => {
    const { organs } = window.PG;
    const g = organs.goal.state();
    const geo = window.PG.View;
    if (!g.goal) return { x: W * 0.5, y: H * 0.3 };
    /* project the goal; clamp into the glass so the tap lands on the city */
    const ws = 256 * Math.pow(2, geo.z);
    const X = (g.goal.x - geo.x) * ws + geo.w / 2;
    const Y = (g.goal.y - geo.y) * ws + geo.h / 2;
    const cx = W / 2, cy = H / 2;
    const dx = X - cx, dy = Y - cy;
    const s = Math.min(1, Math.min((W * 0.36) / (Math.abs(dx) || 1), (H * 0.3) / (Math.abs(dy) || 1)));
    return { x: cx + dx * s, y: cy + dy * s };
  }, { W, H });

  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(700);
  const planned = await peek();
  log.push({ step: `turn${turn}:planned`, ...planned });
  if (turn === 1) await page.screenshot({ path: `${prefix}-2-planned.png` });

  /* take it: tap the pin where the pin actually IS now, since framing the
     route may have moved it under the thumb */
  const pin = await page.evaluate(() => {
    const m = window.PG.organs.move.state();
    if (!m.plan) return null;
    const v = window.PG.View;
    const ws = 256 * Math.pow(2, v.z);
    return {
      x: (m.plan.tx - v.x) * ws + v.w / 2,
      y: (m.plan.ty - v.y) * ws + v.h / 2 + 12,
    };
  });
  if (pin) await page.mouse.click(pin.x, pin.y);
  await page.waitForTimeout(5200);
  log.push({ step: `turn${turn}:after`, ...(await peek()) });
  if (turn === 1) await page.screenshot({ path: `${prefix}-3-travelled.png` });
}

await page.screenshot({ path: `${prefix}-4-late.png` });

/* draw a line, and check it actually became ground */
const before = await page.evaluate(() => window.PG.G.e);
await page.evaluate(() => document.getElementById("pip")?.click());
await page.waitForTimeout(220);
await page.mouse.move(W * 0.32, H * 0.52);
await page.mouse.down();
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(W * (0.32 + i * 0.026), H * (0.52 - i * 0.012));
  await page.waitForTimeout(26);
}
await page.mouse.up();
await page.waitForTimeout(900);
const after = await page.evaluate(() => window.PG.G.e);
log.push({ step: "drew", newEdges: after - before, ...(await peek()) });
await page.screenshot({ path: `${prefix}-5-drawn.png` });

const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else res(n); };
  requestAnimationFrame(tick);
}));

console.log(JSON.stringify({ log, fps, errors }, null, 2));
await browser.close();
if (errors.length) process.exitCode = 2;
