/* Can this game be won at all? Play properly, and draw when a body is walled. */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errs = []; p.on("pageerror", e => errs.push(e.message));
await p.goto("http://localhost:8080/perspectival-ground.html", { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: "networkidle" });
await p.waitForFunction(() => window.PG?.organs?.turn?.state?.().tokens?.length, null, { timeout: 20000 });
await p.waitForTimeout(1200);

const st = () => p.evaluate(() => {
  const s = window.PG.organs.turn.state(), M = 30678000;
  return { phase: s.phase, turn: s.turnNo, over: s.over?.who || null,
    home: s.tokens.map(t => t.home ? "HOME" : Math.round(Math.hypot(t.x - s.home.x, t.y - s.home.y) * M)),
    rival: s.rivals.filter(t => t.home).length, marks: window.PG.S.marks.length };
});
const waitPhase = async (w, ms) => { const t0 = Date.now();
  while (Date.now() - t0 < ms) { if ((await p.evaluate(() => window.PG.organs.turn.state().phase)) === w) return true; await p.waitForTimeout(300); } return false; };

for (let turn = 1; turn <= 40; turn++) {
  if (!(await waitPhase("roll", 25000))) break;
  await p.click("#pgtray .pgdie.roll", { timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(600);

  /* if any body is walled, draw it a line toward home */
  const wall = await p.evaluate(() => {
    const t = window.PG.organs.turn, s = t.state(), v = window.PG.View;
    const ws = 256 * Math.pow(2, v.z);
    for (let i = 0; i < s.tokens.length; i++) {
      if (s.tokens[i].home) continue;
      if (t.gainFor(i) > 25) continue;
      const tok = s.tokens[i], H = window.PG.S.home;
      const P = (x, y) => ({ x: (x - v.x) * ws + v.w / 2, y: (y - v.y) * ws + v.h / 2 });
      return { a: P(tok.x, tok.y), b: P(H.x, H.y), who: tok.being.name };
    }
    return null;
  });
  if (wall) {
    const cl = q => ({ x: Math.max(26, Math.min(364, q.x)), y: Math.max(120, Math.min(660, q.y)) });
    const A = cl(wall.a), B = cl(wall.b);
    await p.evaluate(() => document.getElementById("pip")?.click());
    await p.waitForTimeout(220);
    await p.mouse.move(A.x, A.y); await p.mouse.down();
    for (let i = 1; i <= 18; i++) { await p.mouse.move(A.x + (B.x - A.x) * i / 18, A.y + (B.y - A.y) * i / 18); await p.waitForTimeout(22); }
    await p.mouse.up(); await p.waitForTimeout(1200);
  }

  for (let d = 0; d < 2; d++) {
    const pos = await p.evaluate(() => {
      const s = window.PG.organs.turn.state(), v = window.PG.View, ws = 256 * Math.pow(2, v.z);
      const taken = s.dice.filter(x => x.to !== null).map(x => x.to);
      const live = s.tokens.map((tk, i) => ({ tk, i })).filter(o => !o.tk.home && !taken.includes(o.i));
      if (!live.length) return null;
      const q = live[0].tk;
      return { x: (q.x - v.x) * ws + v.w / 2, y: (q.y - v.y) * ws + v.h / 2 };
    });
    if (!pos) break;
    await p.mouse.click(pos.x, pos.y); await p.waitForTimeout(280);
  }
  await p.click("#pgbar", { timeout: 4000 }).catch(() => {});
  await waitPhase("roll", 26000);
  const s = await st();
  if (turn % 4 === 0 || s.over) console.log("turn", String(turn).padStart(2), JSON.stringify(s));
  if (s.over) { console.log("WIN STATE REACHED:", s.over, "on turn", turn); break; }
}
console.log("final", JSON.stringify(await st()));
await p.screenshot({ path: "pg/shots/win.png" });
console.log("errors", errs.slice(0, 3));
await b.close();
