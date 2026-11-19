"""Second check, added because the edge test has little power where edges are dense and units are drawn one pixel inside the edge.
 E uniform: is the image more uniform inside a unit (>= 0.1 ha) than inside the same shape displaced 70 m? ratio = displaced spread / actual spread.
 A' edge with one pixel of tolerance. Results are merged into web/verify.json and the verdict is recomputed with rules stated here."""
import sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(__file__)); from common import *; from render import *
from PIL import Image, ImageDraw
from scipy.ndimage import sobel, gaussian_filter, maximum_filter
V = json.load(open(os.path.join(ROOT, "web", "verify.json")))
def spread(lab, img, n):
    m = lab > 0; l = lab[m]; v = img[m]; c = np.bincount(l, minlength=n+1).astype(float); c[c == 0] = 1
    mu = np.bincount(l, v, n+1) / c; var = np.bincount(l, v*v, n+1) / c - mu*mu; return np.sqrt(np.clip(var[1:], 0, None))
for key in V:
    g, a, _ = fields(key, 2025); idx = np.where(a >= 1000)[0]
    im = Image.new("I", (PX, PX), 0); d = ImageDraw.Draw(im); ln = Image.new("L", (PX, PX), 0); dl = ImageDraw.Draw(ln)
    for k, i in enumerate(idx):
        p = g[i]
        for part in (p.geoms if p.geom_type == "MultiPolygon" else [p]): d.polygon(list(part.exterior.coords), fill=k+1)
    for p in g:
        for part in (p.geoms if p.geom_type == "MultiPolygon" else [p]): dl.line(list(part.exterior.coords), fill=1)
    lab = np.array(im); line = np.array(ln, bool); un, ed = [], []
    for season in ("after_rains", "dry"):
        s = np.load(f"{RAW}/{key}_{season}.npy").astype("float32"); ndvi = (s[3] - s[0]) / (s[3] + s[0] + 1e-6); lum = s[:3].mean(0)
        act = spread(lab, ndvi, len(idx)); sh = [spread(np.roll(np.roll(lab, dy, 0), dx, 1), ndvi, len(idx)) for dx, dy in ((7,0),(-7,0),(0,7),(0,-7))]
        un.append(float(np.median(np.mean(sh, 0)) / np.median(act)))
        gs = gaussian_filter(lum, .7); G = maximum_filter(np.hypot(sobel(gs, 0), sobel(gs, 1)), 3)
        ed.append(float(G[line].mean() / np.mean([G[np.roll(np.roll(line, dy, 0), dx, 1)].mean() for dx, dy in ((7,0),(-7,0),(0,7),(0,-7),(7,7),(-7,-7))])))
    r = V[key]; r["uniform_ratio"] = [round(x, 2) for x in un]; r["edge_tol_ratio"] = [round(x, 2) for x in ed]
    u = min(un); c = r["cover"]["cropland"]
    # verdict: units must be (1) on cropland, (2) more uniform inside than displaced copies, (3) repeated in the other year
    r["verdict"] = ("false" if c < 0.2 else "supported" if c >= 0.6 and u >= 1.25 and r["repeat"] >= 0.35 else
                    "weak" if u < 1.1 or r["repeat"] < 0.25 else "partly supported")
    print(key, r["uniform_ratio"], r["edge_tol_ratio"], r["repeat"], c, r["verdict"])
json.dump(V, open(os.path.join(ROOT, "web", "verify.json"), "w"), indent=1)
