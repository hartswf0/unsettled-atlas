/* Screenshot harness. Critics use this; so does the progress page.
   node pg/tools/shot.mjs <url> <out.png> [--phone|--desktop] [--wait ms] [--script file.js] */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const [, , url, out, ...rest] = process.argv;
const phone = rest.includes("--phone");
const waitI = rest.indexOf("--wait");
const wait = waitI >= 0 ? Number(rest[waitI + 1]) : 1600;
const scriptI = rest.indexOf("--script");
const script = scriptI >= 0 ? readFileSync(rest[scriptI + 1], "utf8") : null;

/* this image ships a chromium; never download another one */
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({
  viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 860 },
  deviceScaleFactor: phone ? 3 : 2,
  isMobile: phone,
  hasTouch: phone,
});

const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(wait);
if (script) await page.evaluate(script);
await page.screenshot({ path: out });

/* how expensive is a frame here? */
const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0;
  const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else res(n); };
  requestAnimationFrame(tick);
}));

console.log(JSON.stringify({ url, out, viewport: phone ? "390x844" : "1280x860", fps, errors }, null, 2));
await browser.close();
if (errors.length) process.exitCode = 2;
