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
await page.waitForTimeout(2600);
const log = [];
const shot = async (n) => { await page.screenshot({ path: OUT + n + ".png" }); log.push(n); };

// --- 30 second bar: tap a destination
await page.touchscreen.tap(120, 300);
await page.waitForTimeout(500);
await shot("g-01-plan");
// tap the pin to go
await page.touchscreen.tap(120, 300);
await page.waitForTimeout(900);
await shot("g-02-going");
await page.waitForTimeout(1400);
await shot("g-03-going2");

// --- fps during a fast flick (worst case for cloth reweave)
const flickFps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now(); const longs = [];
  let last = t0;
  const tick = () => {
    const now = performance.now();
    if (now - last > 24) longs.push(Math.round(now - last));
    last = now; n++;
    PG.View.x += 0.0000030; // ~ fast pan
    if (now - t0 < 1500) requestAnimationFrame(tick); else res({ fps: Math.round(n / 1.5), longFrames: longs.length, worst: Math.max(0, ...longs) });
  };
  requestAnimationFrame(tick);
}));
log.push({ flickFps });
await shot("g-04-after-flick");

// --- draw: arm the pip and drag
const pipBox = await page.evaluate(() => {
  const el = document.querySelector("#hud .pip") || document.querySelector(".pip") || [...document.querySelectorAll("*")].find(e => e.className && String(e.className).includes("pip"));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
log.push({ pipBox });
if (pipBox) {
  await page.touchscreen.tap(pipBox.x, pipBox.y);
  await page.waitForTimeout(400);
  await shot("g-05-armed");
  // drag a line across the map
  await page.mouse.move(90, 420);
  await page.mouse.down();
  for (let i = 0; i <= 26; i++) {
    await page.mouse.move(90 + i * 9, 420 - Math.sin(i / 4) * 70);
    await page.waitForTimeout(14);
    if (i === 14) await shot("g-06-drawing-mid");
  }
  await page.mouse.up();
  await page.waitForTimeout(900);
  await shot("g-07-drawn");
}

// --- become, mid-transition
await page.evaluate(() => PG.organs.become.turn && PG.organs.become.turn());
await page.waitForTimeout(320);
await shot("g-08-become-mid");
await page.waitForTimeout(400);
await shot("g-09-become-mid2");
await page.waitForTimeout(1600);
await shot("g-10-become-done");
log.push({ being: await page.evaluate(() => PG.S.being.id) });

// --- pinch zoom out then in via wheel
await page.mouse.move(195, 420);
for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(30); }
await page.waitForTimeout(600);
await shot("g-11-zoomed-out");
for (let i = 0; i < 26; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(30); }
await page.waitForTimeout(600);
await shot("g-12-zoomed-in");

console.log(JSON.stringify({ log, errors }, null, 2));
await browser.close();
