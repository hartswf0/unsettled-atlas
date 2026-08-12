/* Photograph a becoming, frame by frame, on a clock we own.
   node pg/tools/.becomeshots.mjs <url> <outdir> [desktop] */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const url = process.argv[2];
const dir = process.argv[3];
const phone = process.argv[4] !== "desktop";
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({
  viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 860 },
  deviceScaleFactor: phone ? 2 : 1.5,
  isMobile: phone, hasTouch: phone,
});
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

/* a clock the harness turns by hand, so a 1.1s event can be looked at */
await page.addInitScript(() => {
  let T = 1000;
  const P = performance;
  P.now = () => T;
  const q = [];
  window.requestAnimationFrame = (fn) => { q.push(fn); return q.length; };
  window.cancelAnimationFrame = () => {};
  window.__step = (dt, n) => {
    for (let i = 0; i < (n || 1); i++) {
      T += dt;
      const c = q.splice(0, q.length);
      for (const f of c) { try { f(T); } catch (e) { console.error(e); } }
    }
    return T;
  };
});

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.evaluate(() => window.__step(16, 60));
await page.waitForTimeout(400);
await page.evaluate(() => window.__step(16, 30));

/* go somewhere first so the cloth has a journey on it */
const mid = phone ? { x: 195, y: 422 } : { x: 640, y: 430 };
await page.mouse.click(mid.x + 90, mid.y - 190);
await page.evaluate(() => window.__step(16, 40));
await page.mouse.click(mid.x + 90, mid.y - 190);
for (let i = 0; i < 24; i++) {
  await page.evaluate(() => window.__step(16, 10));
  await page.waitForTimeout(30);
}
await page.evaluate(() => window.__step(16, 60));
await page.screenshot({ path: `${dir}/00-before.png` });

await page.evaluate(() => { window.PG.organs.become.turn(); });
const marks = [0, 60, 120, 190, 260, 340, 430, 540, 680, 860, 1050, 1200];
let prev = 0;
for (const m of marks) {
  const d = m - prev; prev = m;
  if (d > 0) await page.evaluate((ms) => window.__step(16, Math.round(ms / 16)), d);
  await page.screenshot({ path: `${dir}/${String(m).padStart(4, "0")}.png` });
}

/* real-time cost: a fresh page with a real clock, and an honest turn */
const p2 = await browser.newPage({
  viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 860 },
  deviceScaleFactor: phone ? 3 : 2, isMobile: phone, hasTouch: phone,
});
p2.on("pageerror", (e) => errors.push("p2 pageerror: " + e.message));
p2.on("console", (m) => { if (m.type() === "error") errors.push("p2 console: " + m.text()); });
await p2.goto(url, { waitUntil: "networkidle" });
await p2.waitForTimeout(2200);
const page2 = p2;
const fps = await page2.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else res(n); };
  requestAnimationFrame(tick);
}));
const turnFps = await page2.evaluate(() => new Promise((res) => {
  let n = 0, worst = 0, last = performance.now();
  window.PG.organs.become.turn();
  const t0 = last;
  const tick = () => {
    const t = performance.now();
    worst = Math.max(worst, t - last); last = t; n++;
    if (t - t0 < 1200) requestAnimationFrame(tick);
    else res({ frames: n, span: Math.round(t - t0), worstFrameMs: Math.round(worst) });
  };
  requestAnimationFrame(tick);
}));

console.log(JSON.stringify({ dir, fps, turnFps, errors }, null, 2));
await browser.close();
