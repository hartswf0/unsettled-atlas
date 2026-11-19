"""Find the real ground that best matches the invented Ahiya Highlands circuit of make-photo (DONKEY WATER, 2086).
The game's four stops keep their exact plan layout (metres, 1:1). We search every highland window for the position and
rotation where real Copernicus GLO-30 heights best reproduce the game's sculpted relative heights. Then: route legs,
line of sight to the beacon, a window-wide viewshed, and a drop-in height patch in game coordinates."""
import sys, os, json, math, numpy as np
sys.path.insert(0, os.path.dirname(__file__)); from common import *
from scipy.ndimage import map_coordinates
from PIL import Image
# game plan coordinates (x east, z south in the game's ground plane) and sculpted height above the pump, from night-post.js
STOPS = dict(basalt=(-1453.0, 769.0, 0.0), beacon=(-1603.0, 601.0, 52.0), hill=(-1765.0, 552.5, 43.0), compound=(-1679.0, 783.5, 18.0))
ORDER = ["basalt", "beacon", "hill", "compound"]; MAST = 40.0
P = np.array([STOPS[k][:2] for k in ORDER]); H = np.array([STOPS[k][2] for k in ORDER]); C = P.mean(0); Q = P - C
def samp(dem, x, y):  # x east, y south in metres from window NW corner
    x = np.atleast_1d(np.asarray(x, float)); y = np.atleast_1d(np.asarray(y, float))
    return map_coordinates(dem, [y/10.0, x/10.0], order=1, mode="nearest")
best = None
for key in ("simien", "gheralta", "gorge", "fogera", "adaa", "pawe"):
    dem = np.load(f"{RAW}/{key}_dem.npy"); gy, gx = np.gradient(dem, 10.0); slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    gxs = np.arange(600, 11400, 30.0); X, Y = np.meshgrid(gxs, gxs)
    for deg in range(0, 360, 10):
        a = math.radians(deg); R = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]]); q = Q @ R.T
        z = np.stack([samp(dem, X + q[i, 0], Y + q[i, 1]) for i in range(4)]); s = np.stack([samp(slope, X + q[i, 0], Y + q[i, 1]) for i in range(4)])
        rel = z - z[0]; err = np.sqrt(((rel - H[:, None, None])**2).mean(0)); err[(s > 12).any(0)] = 1e9
        i, j = np.unravel_index(err.argmin(), err.shape)
        if best is None or err[i, j] < best[0]: best = (float(err[i, j]), key, deg, float(X[i, j]), float(Y[i, j]), rel[:, i, j].tolist(), z[:, i, j].tolist())
err, key, deg, cx, cy, rel, z = best; print("best", best)
meta = json.load(open(f"{RAW}/{key}.json")); dem = np.load(f"{RAW}/{key}_dem.npy"); x0, y0, x1, y1 = meta["bounds"]
a = math.radians(deg); R = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
def game_to_win(g): return (np.asarray(g) - C) @ R.T + np.array([cx, cy])
W = game_to_win(P); lon, lat = rtransform(f"EPSG:{meta['epsg']}", "EPSG:4326", (x0 + W[:, 0]).tolist(), (y1 - W[:, 1]).tolist())
def los(p, hp, q, hq, n=200):
    t = np.linspace(0, 1, n)[1:-1]; g = samp(dem, p[0] + (q[0]-p[0])*t, p[1] + (q[1]-p[1])*t); ray = hp + (hq - hp)*t; return bool((ray > g).all())
zb = float(samp(dem, W[1, 0], W[1, 1])[0]) + MAST; stops = []
for i, k in enumerate(ORDER):
    j = (i + 1) % 4; n = 60; t = np.linspace(0, 1, n); prof = samp(dem, W[i, 0] + (W[j, 0]-W[i, 0])*t, W[i, 1] + (W[j, 1]-W[i, 1])*t); d = np.diff(prof)
    stops.append(dict(id=k, game_xz=list(STOPS[k][:2]), game_rel_m=STOPS[k][2], win_xy_m=[round(float(W[i, 0]), 1), round(float(W[i, 1]), 1)], lat=round(lat[i], 5), lon=round(lon[i], 5),
        elev_m=round(z[i], 1), real_rel_m=round(rel[i], 1), sees_beacon_top=True if k == "beacon" else los(W[i], z[i] + 1.6, W[1], zb),
        leg_to=ORDER[j], leg_m=round(float(np.hypot(*(W[j]-W[i]))), 1), leg_up_m=round(float(d[d > 0].sum()), 1), leg_down_m=round(float(-d[d < 0].sum()), 1)))
# viewshed of the beacon top over the whole window at 30 m
gy_, gx_ = np.mgrid[0:400, 0:400]; tx = gx_*30.0 + 15; ty = gy_*30.0 + 15; T = np.linspace(0, 1, 160)[1:-1]
vis = np.ones((400, 400), bool); zt = samp(dem, tx, ty) + 1.6
for t in T:
    g = samp(dem, W[1, 0] + (tx - W[1, 0])*t, W[1, 1] + (ty - W[1, 1])*t); vis &= (zb + (zt - zb)*t) > g
im = np.zeros((400, 400, 4), "uint8"); im[vis] = (60, 220, 255, 110); Image.fromarray(im).save(os.path.join(ROOT, "web", "img", "ahiya_viewshed.png"), optimize=True)
# drop-in patch: real height (m above the pump) on a 10 m grid in GAME coordinates, 900 m square around the circuit centre
n = 91; gx = C[0] - 450 + np.arange(n)*10.0; gz = C[1] - 450 + np.arange(n)*10.0; GX, GZ = np.meshgrid(gx, gz)
wp = game_to_win(np.stack([GX.ravel(), GZ.ravel()], 1)); hp = (samp(dem, wp[:, 0], wp[:, 1]) - z[0]).reshape(n, n)
js = ("/* Real ground for the Ahiya Highlands circuit. Copernicus GLO-30 heights (30 m data, bilinear), metres above the Basalt Pump.\n"
      f"   Place: {key} window, {lat[0]:.5f} N {lon[0]:.5f} E at the pump; layout rotated {deg} deg; fit error {err:.1f} m RMS. Untested inside the game. */\n"
      f"window.AHIYA_REAL={{x0:{gx[0]},z0:{gz[0]},step:10,n:{n},pumpElevation:{z[0]:.1f},h:{json.dumps(np.round(hp, 1).ravel().tolist(), separators=(',', ':'))},\n"
      " groundY(x,z,baseY){const u=Math.min(this.n-1.001,Math.max(0,(x-this.x0)/this.step)),v=Math.min(this.n-1.001,Math.max(0,(z-this.z0)/this.step)),i=u|0,j=v|0,a=u-i,b=v-j,H=this.h,n=this.n;\n"
      "  return (baseY||0)+(H[j*n+i]*(1-a)+H[j*n+i+1]*a)*(1-b)+(H[(j+1)*n+i]*(1-a)+H[(j+1)*n+i+1]*a)*b}};\n")
open(os.path.join(ROOT, "worldtext", "ahiya_real_terrain.js"), "w").write(js)
out = dict(window=key, rotation_deg=deg, fit_rms_m=round(err, 1), mast_m=MAST, visible_share_of_window=round(float(vis.mean()), 3), stops=stops,
           route_m=round(sum(s["leg_m"] for s in stops), 1), route_up_m=round(sum(s["leg_up_m"] for s in stops), 1))
json.dump(out, open(os.path.join(ROOT, "worldtext", "ahiya_fit.json"), "w"), indent=1); print(json.dumps(out)[:1500])
