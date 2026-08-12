/* THE test: play until a body is walled in, draw across its wall, and ask
   whether a line made by a hand changed what that body can do. */
import { chromium } from "playwright";
const [, , url] = process.argv;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => window.PG?.organs?.turn?.state?.().tokens?.length, null, { timeout: 20000 });
await page.waitForTimeout(1200);

const wi = await page.evaluate(() =>
  window.PG.organs.turn.state().tokens.findIndex((x) => x.being.name === "WHEELCHAIR"));
const phase = () => page.evaluate(() => window.PG.organs.turn.state().phase);
const gain = () => page.evaluate((wi) => window.PG.organs.turn.gainFor(wi), wi);

/* play until the wheelchair is walled */
let turns = 0, g = 9999;
while (turns < 12) {
  while ((await phase()) !== "roll" && turns < 40) await page.waitForTimeout(400);
  await page.click("#pgtray .pgdie.roll", { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(700);
  g = await gain();
  if (g <= 25) break;
  for (let d = 0; d < 2; d++) {
    const pos = await page.evaluate(() => {
      const st = window.PG.organs.turn.state();
      const v = window.PG.View, ws = 256 * Math.pow(2, v.z);
      const taken = st.dice.filter((x) => x.to !== null).map((x) => x.to);
      const live = st.tokens.map((tk, i) => ({ tk, i })).filter((o) => !o.tk.home && !taken.includes(o.i));
      if (!live.length) return null;
      const q = live[0].tk;
      return { x: (q.x - v.x) * ws + v.w / 2, y: (q.y - v.y) * ws + v.h / 2 };
    });
    if (!pos) break;
    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(300);
  }
  await page.click("#pgbar", { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1200);
  turns++;
}

const before = await gain();
const wall = await page.evaluate((wi) => {
  const w = window.PG.organs.turn.wallFor(wi);
  const v = window.PG.View, ws = 256 * Math.pow(2, v.z);
  const P = (x, y) => ({ x: (x - v.x) * ws + v.w / 2, y: (y - v.y) * ws + v.h / 2 });
  return w ? { a: P(w.ex, w.ey), b: P(w.tx, w.ty) } : null;
}, wi);
await page.screenshot({ path: "pg/shots/stuck-before.png" });

let drew = false;
if (wall) {
  /* clamp the wall into the glass so the whole stroke lands on the city */
  const clamp = (p) => ({ x: Math.max(30, Math.min(360, p.x)), y: Math.max(110, Math.min(700, p.y)) });
  const A = clamp(wall.a), B = clamp(wall.b);
  await page.evaluate(() => document.getElementById("pip")?.click());
  await page.waitForTimeout(300);
  await page.mouse.move(A.x, A.y);
  await page.mouse.down();
  for (let i = 1; i <= 18; i++) {
    const t = i / 18;
    await page.mouse.move(A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t);
    await page.waitForTimeout(26);
  }
  await page.mouse.up();
  await page.waitForTimeout(1500);
  drew = true;
}

const after = await gain();
const st = await page.evaluate(() => ({ marks: window.PG.S.marks.length, edges: window.PG.G.e }));
await page.screenshot({ path: "pg/shots/stuck-after.png" });
console.log(JSON.stringify({ turnsPlayed: turns, wheelchairGainBefore: before, wheelchairGainAfter: after, drew, ...st, errors }, null, 2));
await b.close();
