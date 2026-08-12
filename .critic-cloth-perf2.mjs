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

// time an organ by calling its draw directly N times, flushing the canvas each round
await page.evaluate(() => {
  window.__time = (name, N) => {
    const o = PG.organs[name]; if (!o || !o.draw) return null;
    const c = PG.ctx.c, now = performance.now();
    o.draw(PG.ctx, now); // warm
    const t0 = performance.now();
    for (let i = 0; i < N; i++) o.draw(PG.ctx, performance.now());
    c.getImageData(0, 0, 1, 1); // flush
    return +((performance.now() - t0) / N).toFixed(2);
  };
  window.__ops = (name) => {
    const real = PG.ctx.c;
    let n = 0, paths = 0;
    const p = new Proxy(real, {
      get(t, k) {
        const v = t[k];
        if (typeof v === "function") return (...a) => { n++; if (k === "stroke" || k === "fill") paths++; return v.apply(t, a); };
        return v;
      },
      set(t, k, v) { n++; t[k] = v; return true; },
    });
    PG.ctx.c = p;
    PG.organs[name].draw(PG.ctx, performance.now());
    PG.ctx.c = real;
    return { calls: n, strokesFills: paths };
  };
});

const fps = async () => page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(Math.round(n / 1.5)); };
  requestAnimationFrame(tick);
}));

const row = async (label) => ({
  label, fps: await fps(),
  clothMs: await page.evaluate(() => window.__time("cloth", 30)),
  tracesMs: await page.evaluate(() => window.__time("traces", 30)),
  clothOps: await page.evaluate(() => window.__ops("cloth")),
  z: await page.evaluate(() => +PG.View.z.toFixed(2)),
  being: await page.evaluate(() => PG.S.being.id),
});

const log = [];
log.push(await row("idle car z14.6"));
await page.evaluate(() => { PG.S.being = window.__B.byId("rain"); PG.emit("become", PG.S.being); });
await page.waitForTimeout(1300);
log.push(await row("rain z14.6"));
await page.evaluate(() => { PG.View.z = 10.6; });
await page.waitForTimeout(900);
log.push(await row("rain metro z10.6"));
await page.evaluate(() => { PG.S.being = window.__B.byId("car"); PG.emit("become", PG.S.being); });
await page.waitForTimeout(1300);
log.push(await row("car metro z10.6"));
await page.evaluate(() => { PG.View.z = 12.4; });
await page.waitForTimeout(900);
log.push(await row("car z12.4"));
// forced reweave every frame (worst case pan)
const panMs = await page.evaluate(() => {
  const o = PG.organs.cloth, c = PG.ctx.c;
  o.draw(PG.ctx, performance.now());
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) { PG.View.x += 0.00002; o.draw(PG.ctx, performance.now()); }
  c.getImageData(0, 0, 1, 1);
  return +((performance.now() - t0) / 20).toFixed(2);
});
log.push({ label: "cloth ms while forced to reweave every frame @z12.4", panMs });

console.log(JSON.stringify({ log, errors }, null, 2));
await browser.close();
