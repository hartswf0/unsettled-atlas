/* ICOSA DRIVE — the verification the theory demands (ICOSA-DRIVE.md §Verification).
 *
 * Run it:
 *   python3 -m http.server 8811          # from the repo root
 *   node icosa-drive.test.mjs            # needs playwright + chromium
 *
 * The two tile services are mocked with REAL PNGs generated here, so the
 * terrarium decode (R·256 + G + B/256 − 32768) is exercised for real, not
 * stubbed. Every law of the theory is asserted, plus the seam between the
 * two modes: landing resumes the pose you rose from, rising mid-crossing
 * stays risen, and Enter/Escape walk between selector and drive.
 */
import zlib from 'node:zlib';
const pw = await (async () => {
  try { return await import('playwright'); }
  catch { return await import('/opt/node22/lib/node_modules/playwright/index.js'); }
})();
const { chromium } = pw.default || pw;
const BASE = process.env.ICOSA_URL || 'http://127.0.0.1:8811';

/* ---- a minimal PNG encoder (RGB, filter 0) ---- */
const CRCT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = CRCT[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0; };
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])), 8 + data.length);
  return out;
}
function png(w, h, px) {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 3);
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x, y);
      raw[row + 1 + x * 3] = r; raw[row + 2 + x * 3] = g; raw[row + 3 + x * 3] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// terrarium: 220 m + rolling hills, encoded (E+32768) → R·256+G
const terrTile = png(256, 256, (x, y) => {
  const v = Math.round(220 + 40 * Math.sin(x / 40) + 30 * Math.cos(y / 40)) + 32768;
  return [(v >> 8) & 255, v & 255, 0];
});
const imgTile = png(256, 256, (x, y) => (x % 64 < 2 || y % 64 < 2) ? [40, 60, 40] : [70, 110, 60]);

const claims = [];
let failures = 0;
const claim = (name, pass, detail = '') => {
  if (!pass) failures++;
  claims.push(`${pass ? '  ok  ' : ' FAIL '} ${name.padEnd(52)} ${detail}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1000, height: 800 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
let s3Count = 0, tileDelay = 0;
await p.route('**/s3.amazonaws.com/**', async (r) => { s3Count++;
  if (tileDelay) await sleep(tileDelay);
  r.fulfill({ status: 200, contentType: 'image/png',
    headers: { 'access-control-allow-origin': '*' }, body: terrTile }); });
await p.route('**/server.arcgisonline.com/**', async (r) => {
  if (tileDelay) await sleep(tileDelay);
  r.fulfill({ status: 200, contentType: 'image/png',
    headers: { 'access-control-allow-origin': '*' }, body: imgTile }); });

await p.goto(BASE + '/icosa-drive.html');
await p.waitForTimeout(1300);

/* ---- boot ---- */
const boot = await p.evaluate(() => ({
  gone: document.getElementById('boot').classList.contains('gone'),
  planet: document.getElementById('aSlug').textContent }));
claim('boot leaves, the planet is offered', boot.gone && boot.planet === 'THE PLANET');

/* ---- law 2 · derivations from depth ---- */
const dv = await p.evaluate(() => {
  const ID = window.ICOSA_DRIVE;
  const s12 = ID.cellAtGeo(33.7756, -84.3963, 12);
  const s15 = ID.cellAtGeo(33.7756, -84.3963, 15);
  const s6 = ID.cellAtGeo(33.7756, -84.3963, 6);
  const w12 = ID.windowOf(s12), w15 = ID.windowOf(s15);
  ID.select(s6);
  const btn = document.getElementById('bLand');
  return { s12, s15, w12, w15,
    shallowRefused: btn.disabled && /descend/.test(btn.textContent) };
});
claim('depth 12 derives its window', Math.round(dv.w12.halfM) === 1068 && dv.w12.ez === 14 && dv.w12.iz === 16,
  `halfM ${Math.round(dv.w12.halfM)}`);
claim('depth 15 floors at the street standard', Math.round(dv.w15.halfM) === 147 && +dv.w15.S.toFixed(2) === 1.84);
claim('the containment chain holds in the address', dv.s15.startsWith(dv.s12));
claim('a shallow cell refuses to land', dv.shallowRefused);

/* ---- laws 1, 4, 6 · LAND ---- */
await p.evaluate(() => window.ICOSA_DRIVE.select(window.ICOSA_DRIVE.cellAtGeo(33.7756, -84.3963, 12)));
await p.waitForTimeout(300);
await p.evaluate(() => window.ICOSA_DRIVE.land());
await p.waitForTimeout(600);
const ld = await p.evaluate(() => {
  const ID = window.ICOSA_DRIVE, pk = ID.pack();
  let cached = false;
  try { cached = (JSON.parse(localStorage.getItem('icosa.landcache.v1') || '[]')).length > 0; } catch (_) {}
  return { mode: ID.mode(), slug: ID.slug(), g0: ID.ground(0, 0),
    elev: ID.elevM(0, 0), fmt: pk.format, cell: pk.cell,
    tex: /^data:image\/jpeg/.test(pk.tex), cached, hash: location.hash };
});
claim('LAND mounts and the mode is drive', ld.mode === 'drive');
claim('the ground answers, datum at the spawn', Math.abs(ld.g0) < 1e-6);
claim('absolute elevation is the mocked hills', Math.abs(ld.elev - 220) < 90, `${Math.round(ld.elev)} m`);
claim('the pack is the THUNDER format + cell', ld.fmt === 'unsettled.landpack/v1' && ld.cell === ld.slug);
claim('the pack is cached on first fetch', ld.cached);
claim('the address is the deed, in the URL', ld.hash === '#' + ld.slug + '@drive');

/* ---- law 3 · DRIVE: the chart inverts every frame ---- */
const before = await p.evaluate(() => {
  const C = window.ICOSA_DRIVE.car; return { x: C.x, z: C.z, lat: C.lat, lon: C.lon };
});
await p.evaluate(() => { window.ICOSA_DRIVE.input.up = true; });
await p.waitForTimeout(1500);
await p.evaluate(() => { window.ICOSA_DRIVE.input.up = false; });
const dr = await p.evaluate((prev) => {
  const ID = window.ICOSA_DRIVE, C = ID.car;
  const rt = ID.geoAt(C.x, C.z);
  return { moved: Math.hypot(C.x - prev.x, C.z - prev.z),
    geoMoved: Math.abs(C.lat - prev.lat) + Math.abs(C.lon - prev.lon) > 1e-6,
    honest: Math.abs(rt[0] - C.lat) < 1e-9 && Math.abs(rt[1] - C.lon) < 1e-9,
    onGround: Math.abs(C.y - ID.ground(C.x, C.z)) < 0.01 };
}, before);
claim('throttle moves the car on the ground', dr.moved > 3 && dr.onGround, `${dr.moved.toFixed(1)} u`);
claim('the car lives on the sphere (chart honest)', dr.geoMoved && dr.honest);

/* ---- law 5 · CROSS: containment failure names the neighbour ---- */
const cr = await p.evaluate(() => {
  const ID = window.ICOSA_DRIVE, s0 = ID.slug();
  for (let d = 2; d < 79; d += 1) {
    for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const g = ID.geoAt(ux * d, uz * d);
      if (!ID.contains(s0, g[0], g[1])) {
        const gd = ID.geoAt(ux * (d + 1), uz * (d + 1));
        ID.teleport(ux * (d + 1), uz * (d + 1));
        return { from: s0, carried: gd };
      }
    }
  }
  return null;
});
claim('an edge exists inside the window', !!cr);
await p.waitForFunction((from) =>
  window.ICOSA_DRIVE.mode() === 'drive' && window.ICOSA_DRIVE.slug() !== from,
  cr.from, { timeout: 10000 });
const xr = await p.evaluate((c) => {
  const ID = window.ICOSA_DRIVE, C = ID.car;
  return { slug: ID.slug(),
    trueNeighbour: ID.slug() === ID.cellAtGeo(c.carried[0], c.carried[1], c.from.split('.')[1].length),
    continuous: Math.abs(C.lat - c.carried[0]) < 5e-4 && Math.abs(C.lon - c.carried[1]) < 5e-4,
    contained: ID.contains(ID.slug(), C.lat, C.lon),
    packFollows: ID.pack().cell === ID.slug(), hash: location.hash };
}, cr);
claim('the neighbour is named by cellAt itself', xr.trueNeighbour, `${cr.from} → ${xr.slug}`);
claim('the geographic point carries continuously', xr.continuous && xr.contained);
claim('the deed and the URL follow the crossing', xr.packFollows && xr.hash === '#' + xr.slug + '@drive');

/* ---- the seam · RISE→LAND resumes the pose, from cache, zero network ---- */
const pose = await p.evaluate(() => {
  const C = window.ICOSA_DRIVE.car; return { lat: C.lat, lon: C.lon, yaw: C.yaw };
});
const s3Before = s3Count;
await p.evaluate(() => window.ICOSA_DRIVE.rise());
await p.waitForTimeout(300);
const risen = await p.evaluate(() => ({ mode: window.ICOSA_DRIVE.mode(),
  geoHidden: document.getElementById('geo').style.display === 'none',
  padHidden: document.getElementById('pad').style.display === 'none' }));
claim('RISE returns to the selector cleanly', risen.mode === 'select' && risen.geoHidden && risen.padHidden);
await p.evaluate(() => window.ICOSA_DRIVE.land());
await p.waitForTimeout(500);
const rm = await p.evaluate((pv) => {
  const ID = window.ICOSA_DRIVE, C = ID.car;
  return { mode: ID.mode(),
    resumed: Math.abs(C.lat - pv.lat) < 5e-5 && Math.abs(C.lon - pv.lon) < 5e-5
          && Math.abs(C.yaw - pv.yaw) < 1e-6,
    wire: document.getElementById('wire').textContent };
}, pose);
claim('LAND remounts from cache, zero network', rm.mode === 'drive' && s3Count === s3Before);
claim('the round trip resumes where you stood', rm.resumed, rm.wire.includes('resumed') ? 'wire says so' : '');

/* ---- the seam · Escape rises, Enter lands ---- */
await p.keyboard.press('Escape');
await p.waitForTimeout(250);
const esc = await p.evaluate(() => window.ICOSA_DRIVE.mode());
claim('Escape rises', esc === 'select');
await p.keyboard.press('Enter');
await p.waitForTimeout(500);
const ent = await p.evaluate(() => window.ICOSA_DRIVE.mode());
claim('Enter lands again', ent === 'drive');

/* ---- the seam · rising MID-CROSSING stays risen (no yank-back) ---- */
await p.evaluate(() => localStorage.removeItem('icosa.landcache.v1'));  // force a real fetch
tileDelay = 500;
const cr2 = await p.evaluate(() => {
  const ID = window.ICOSA_DRIVE, s0 = ID.slug();
  for (let d = 2; d < 79; d += 1) {
    for (const [ux, uz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const g = ID.geoAt(ux * d, uz * d);
      if (!ID.contains(s0, g[0], g[1])) { ID.teleport(ux * (d + 1), uz * (d + 1)); return s0; }
    }
  }
  return null;
});
await p.waitForTimeout(200);                     // the crossing is now fetching, slowly
const midMode = await p.evaluate(() => window.ICOSA_DRIVE.mode());
await p.evaluate(() => window.ICOSA_DRIVE.rise());
await p.waitForTimeout(1400);                    // the delayed fetch lands after the rise
const after = await p.evaluate(() => ({ mode: window.ICOSA_DRIVE.mode(),
  geoHidden: document.getElementById('geo').style.display === 'none' }));
claim('a crossing was in flight when we rose', midMode === 'crossing' || midMode === 'landing', midMode);
claim('rising mid-crossing stays risen', after.mode === 'select' && after.geoHidden);
tileDelay = 0;
await p.evaluate(() => window.ICOSA_DRIVE.land());
await p.waitForTimeout(800);
claim('landing works again after the bail-out', await p.evaluate(() => window.ICOSA_DRIVE.mode()) === 'drive');

/* ---- law 6 · SAVE: the deed leaves under its address ---- */
const dl = p.waitForEvent('download', { timeout: 4000 }).catch(() => null);
await p.evaluate(() => document.getElementById('bSave').click());
const got = await dl;
claim('SAVE offers <slug>.landpack.json', !!got && /^F\d+\.[0-3]+\.landpack\.json$/.test(got.suggestedFilename()),
  got ? got.suggestedFilename() : 'no download');

claim('no page errors anywhere', errs.length === 0, errs.join(' | '));
console.log(claims.join('\n'));
console.log(failures ? `\n${failures} FAILED` : '\nall claims hold');
await b.close();
process.exit(failures ? 1 : 0);
