/* Does the turn actually play, and can it be won? */
import { chromium } from "playwright";
const [, , url, prefix, turnsArg] = process.argv;
const TURNS = Number(turnsArg || 8);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => window.PG?.organs?.turn?.state?.().tokens?.length, null, { timeout: 20000 });
await page.waitForTimeout(1200);

const peek = () => page.evaluate(() => {
  const st = window.PG.organs.turn.state();
  const M = 30678000;
  return {
    phase: st.phase, turn: st.turnNo,
    dice: st.dice.map((d) => d.v + (d.to !== null ? "→" + st.tokens[d.to].being.name[0] : "")).join(" "),
    being: window.PG.S.being.name,
    home: st.tokens.map((t) => t.home ? "HOME" : Math.round(Math.hypot(t.x - st.home.x, t.y - st.home.y) * M)),
    rival: st.rivals.filter((t) => t.home).length,
    over: st.over?.who || null,
    marks: window.PG.S.marks.length,
  };
});
const waitPhase = async (want, ms) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if ((await page.evaluate(() => window.PG.organs.turn.state().phase)) === want) return true;
    await page.waitForTimeout(300);
  }
  return false;
};

const log = [{ step: "start", ...(await peek()) }];
for (let t = 1; t <= TURNS; t++) {
  if (!(await waitPhase("roll", 20000))) break;
  await page.click("#pgtray .pgdie.roll", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  for (let d = 0; d < 2; d++) {
    const pos = await page.evaluate(() => {
      const st = window.PG.organs.turn.state();
      const v = window.PG.View, ws = 256 * Math.pow(2, v.z);
      const open = st.dice.findIndex((x) => x.to === null);
      if (open < 0) return null;
      const taken = st.dice.filter((x) => x.to !== null).map((x) => x.to);
      const live = st.tokens.map((tk, i) => ({ tk, i })).filter((o) => !o.tk.home && !taken.includes(o.i));
      if (!live.length) return null;
      const q = live[0].tk;
      return { x: (q.x - v.x) * ws + v.w / 2, y: (q.y - v.y) * ws + v.h / 2 };
    });
    if (!pos) break;
    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(350);
  }
  log.push({ step: `t${t}:assigned`, ...(await peek()) });
  if (t === 1) await page.screenshot({ path: `${prefix}-assigned.png` });
  await page.click("#pgbar", { timeout: 5000 }).catch(() => {});
  await waitPhase("roll", 26000);
  log.push({ step: `t${t}:done`, ...(await peek()) });
  const st = await peek();
  if (st.over) break;
}
await page.screenshot({ path: `${prefix}-late.png` });
console.log(JSON.stringify({ log, errors }, null, 2));
await b.close();
