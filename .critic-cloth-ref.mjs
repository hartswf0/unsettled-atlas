import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-unsettled-atlas/b4dd44f3-bac0-5361-9cf4-3f06f063c9d1/scratchpad/shots/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
});
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.goto("file:///root/.claude/uploads/b4dd44f3-bac0-5361-9cf4-3f06f063c9d1/2deff8bf-livingmapmaker_1.html", { waitUntil: "load" });
await page.waitForTimeout(4000);
await page.screenshot({ path: OUT + "ref-01.png" });
// drag across the canvas to draw / pan
await page.mouse.move(180, 380);
await page.mouse.down();
for (let i = 0; i < 20; i++) { await page.mouse.move(180 + i * 8, 380 + Math.sin(i / 3) * 40); await page.waitForTimeout(16); }
await page.mouse.up();
await page.waitForTimeout(1800);
await page.screenshot({ path: OUT + "ref-02.png" });
await page.waitForTimeout(6000);
await page.screenshot({ path: OUT + "ref-03.png" });
const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else res(n); };
  requestAnimationFrame(tick);
}));
console.log(JSON.stringify({ fps, errors }, null, 2));
await browser.close();
