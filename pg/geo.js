/* PERSPECTIVAL GROUND — the ground under everything.

   One coordinate system, shared by every module: web mercator on the unit
   square, x east, y south. The camera is a point in that square plus a zoom.
   Nothing in this game stores pixels. */

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => t * t * (3 - 2 * t);
/* deterministic noise — the same ground must look the same on every phone */
export function hash01(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export const mercX = (lng) => (lng + 180) / 360;
export function mercY(lat) {
  const s = Math.sin(clamp(lat, -85.05, 85.05) * Math.PI / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}
export const unMercX = (x) => x * 360 - 180;
export const unMercY = (y) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - 2 * y)));

/* metres per mercator unit at Atlanta */
export const M_PER_UNIT = 40075016.686 * Math.cos(33.75 * Math.PI / 180);
export const metres = (u) => u * M_PER_UNIT;
export const units = (m) => m / M_PER_UNIT;

/* ---------- the camera ----------
   z is tile-zoom: worldSize = 256 * 2^z pixels across the whole earth. */
export const View = {
  x: mercX(-84.3880), y: mercY(33.7490), z: 14.6,
  w: 0, h: 0, dpr: 1,
  safeTop: 0, safeBottom: 0,
};

export const worldSize = () => 256 * Math.pow(2, View.z);
export const sx = (mx) => (mx - View.x) * worldSize() + View.w / 2;
export const sy = (my) => (my - View.y) * worldSize() + View.h / 2;
export const wx = (px) => (px - View.w / 2) / worldSize() + View.x;
export const wy = (py) => (py - View.h / 2) / worldSize() + View.y;
/* pixels per metre at the current zoom — how big a thing on the ground is */
export const pxPerM = () => (worldSize() / M_PER_UNIT);

export function viewBounds(pad = 0) {
  return {
    x0: wx(-pad), x1: wx(View.w + pad),
    y0: wy(-pad), y1: wy(View.h + pad),
  };
}

export function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  View.w = w; View.h = h; View.dpr = dpr;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const cs = getComputedStyle(document.documentElement);
  View.safeTop = parseFloat(cs.getPropertyValue("--sat")) || 0;
  View.safeBottom = parseFloat(cs.getPropertyValue("--sab")) || 0;
  return dpr;
}

/* ---------- camera moves ----------
   Everything the player does to the camera goes through here so that follow,
   fling and framing never fight each other. */
export function panBy(dxPx, dyPx) {
  const ws = worldSize();
  View.x -= dxPx / ws;
  View.y -= dyPx / ws;
  clampView();
}
export function zoomAt(px, py, dz) {
  const bx = wx(px), by = wy(py);
  View.z = clamp(View.z + dz, 10.5, 17.5);
  const ax = wx(px), ay = wy(py);
  View.x += bx - ax;
  View.y += by - ay;
  clampView();
}
/* Atlanta is the board. You cannot wander off it into empty mercator. */
export const BOUND = { x0: mercX(-84.55), y0: mercY(33.9), x1: mercX(-84.2), y1: mercY(33.62) };
export function clampView() {
  View.x = clamp(View.x, BOUND.x0, BOUND.x1);
  View.y = clamp(View.y, BOUND.y0, BOUND.y1);
}

export function centerOn(x, y, z) {
  View.x = x; View.y = y;
  if (z != null) View.z = clamp(z, 10.5, 17.5);
  clampView();
}

/* ---------- geometry helpers every module wants ---------- */
export function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px, qy = ay + dy * t - py;
  return { d: Math.hypot(qx, qy), t, x: ax + dx * t, y: ay + dy * t };
}

/* Ramer–Douglas–Peucker, for turning a finger's mess into a line. */
export function simplify(pts, tol) {
  if (pts.length < 6) return pts.slice();
  const keep = new Uint8Array(pts.length / 2);
  keep[0] = keep[pts.length / 2 - 1] = 1;
  const stack = [[0, pts.length / 2 - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    let worst = -1, wi = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const { d } = distToSeg(pts[i * 2], pts[i * 2 + 1], pts[i0 * 2], pts[i0 * 2 + 1], pts[i1 * 2], pts[i1 * 2 + 1]);
      if (d > worst) { worst = d; wi = i; }
    }
    if (worst > tol && wi > 0) { keep[wi] = 1; stack.push([i0, wi], [wi, i1]); }
  }
  const out = [];
  for (let i = 0; i < keep.length; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out;
}

export function pathLength(pts) {
  let L = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) L += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
  return L;
}

/* walk a distance along a polyline; returns position and heading */
export function alongPath(pts, dist) {
  let acc = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const seg = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
    if (acc + seg >= dist || i + 5 >= pts.length) {
      const t = seg > 0 ? clamp((dist - acc) / seg, 0, 1) : 0;
      return {
        x: lerp(pts[i], pts[i + 2], t),
        y: lerp(pts[i + 1], pts[i + 3], t),
        a: Math.atan2(pts[i + 3] - pts[i + 1], pts[i + 2] - pts[i]),
        done: dist >= acc + seg && i + 5 >= pts.length,
      };
    }
    acc += seg;
  }
  return { x: pts[0], y: pts[1], a: 0, done: true };
}
