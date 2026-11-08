// SCION Family works — shared helpers. Everything drawn comes from real Sentinel-2 fields; helpers never alter field pixels.
const K = (() => {
  const $ = s => document.querySelector(s), css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const memo = {}; const json = u => memo[u] || (memo[u] = fetch(u).then(r => r.json()));
  const img = u => memo[u] || (memo[u] = new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = u; }));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ease = u => u < .5 ? 2*u*u : 1 - Math.pow(-2*u + 2, 2)/2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a)*u;
  const fmt = n => Math.round(n).toLocaleString();
  function stage(canvas, aspect = 16/9) {
    const dpr = Math.min(2, devicePixelRatio || 1); const o = { c: canvas, g: canvas.getContext("2d"), dpr, W: 0, H: 0, aspect };
    o.fit = () => { const w = canvas.parentElement.getBoundingClientRect().width; canvas.style.aspectRatio = `${o.aspect}`; canvas.width = Math.round(w*dpr); canvas.height = Math.round(w/o.aspect*dpr); o.W = canvas.width; o.H = canvas.height; };
    o.fit(); return o;
  }
  function labels(el, on) {
    const ALL = [["GEOGRAPHIC", "positions are real coordinates"], ["COMPOSED", "arrangement is the work's; each dot is still a real field"], ["OBSERVED", "what the imagery shows"], ["NOT SEEN", "needs another instrument or record"], ["DRAWN", "an annotation, not imagery"]];
    el.innerHTML = ALL.map(([k, d]) => `<span class="lab ${on.includes(k) ? "on" : ""} ${k === "NOT SEEN" ? "ns" : ""}" title="${d}">${k}</span>`).join("");
  }
  async function scion(el) {
    let t = ""; try { t = await (await fetch("scion.json")).json(); } catch (e) { return; }
    el.innerHTML = `<summary><span>The SCION instruction for this work</span><button class="btn" id="cp" type="button">Copy full instruction</button></summary><pre></pre>`;
    el.querySelector("pre").textContent = t;
    el.querySelector("#cp").addEventListener("click", ev => { ev.preventDefault(); const b = ev.currentTarget;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => b.textContent = "Copied", () => { el.open = true; const r = document.createRange(); r.selectNodeContents(el.querySelector("pre")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Selected; press copy"; }); });
  }
  // film player: chapters [{t, name}], duration seconds, draw(t)
  function player(el, { duration, chapters = [], draw, onTime }) {
    el.innerHTML = `<button class="btn primary" id="pp" type="button">Play</button><input type="range" id="sc" min="0" max="${duration}" step="0.01" value="0" aria-label="Time"><span class="mono" id="tc"></span><span class="ctrl" id="ch"></span>`;
    let t = 0, playing = false, last = 0, raf = 0; const pp = el.querySelector("#pp"), sc = el.querySelector("#sc"), tc = el.querySelector("#tc");
    el.querySelector("#ch").innerHTML = chapters.map((c, i) => `<button class="btn" type="button" data-i="${i}">${c.name}</button>`).join("");
    const show = () => { sc.value = t; tc.textContent = `${t.toFixed(1)} / ${duration}s`; const ci = chapters.reduce((a, c, i) => t >= c.t ? i : a, 0);
      el.querySelectorAll("#ch button").forEach((b, i) => b.setAttribute("aria-pressed", i === ci)); draw(t); onTime && onTime(t); };
    const loop = now => { if (!playing) return; t += (now - last)/1000; last = now; if (t >= duration) { t = duration; playing = false; pp.textContent = "Replay"; } show(); if (playing) raf = requestAnimationFrame(loop); };
    pp.onclick = () => { if (playing) { playing = false; pp.textContent = "Play"; return; } if (t >= duration) t = 0; playing = true; pp.textContent = "Pause"; last = performance.now(); raf = requestAnimationFrame(loop); };
    sc.oninput = () => { t = +sc.value; playing = false; pp.textContent = "Play"; show(); };
    el.querySelectorAll("#ch button").forEach(b => b.onclick = () => { t = chapters[+b.dataset.i].t + 0.01; show(); });
    return { seek: v => { t = v; show(); }, redraw: show, get t() { return t; } };
  }
  // bank glyphs (40 px sheets); draws a real field clipped to its circle
  let BANK = null; const sheets = {};
  async function bank() { if (!BANK) { BANK = await json("bank.json"); BANK.c = Object.fromEntries(BANK.cols.map((n, i) => [n, i])); } return BANK; }
  async function ensure(ids) { await bank(); const ks = [...new Set(ids.map(i => Math.floor(i/(BANK.per_row**2))))]; await Promise.all(ks.map(async k => { sheets[k] = sheets[k] || await img(`sheet40_${k}.jpg`); })); }
  function chip(g, i, x, y, d, rot = 0) { const k = Math.floor(i/(BANK.per_row**2)), im = sheets[k]; if (!im) return false;
    const S = BANK.glyph_px/2, pr = BANK.per_row, c = i % (pr*pr), inner = S/1.04, off = (S - inner)/2;
    g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.beginPath(); g.arc(0, 0, d/2, 0, 7); g.clip(); g.drawImage(im, (c % pr)*S + off, Math.floor(c/pr)*S + off, inner, inner, -d/2, -d/2, d, d); g.restore(); return true; }
  // circle crop of an image (field from a scene image) — positions in image-normalised units
  function circ(g, im, nx, ny, nr, x, y, d) { g.save(); g.beginPath(); g.arc(x, y, d/2, 0, 7); g.clip(); const W = im.width, H = im.height;
    g.drawImage(im, (nx - nr)*W, (ny - nr)*H, 2*nr*W, 2*nr*H, x - d/2, y - d/2, d, d); g.restore(); }
  return { $, css, json, img, reduced, ease, clamp, lerp, fmt, stage, labels, scion, player, bank, ensure, chip, circ };
})();
