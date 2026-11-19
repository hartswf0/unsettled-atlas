"""Are the FTW field units real? Four checks against data the field model did not produce.
 A edge:   do unit boundaries sit on image edges (two independent Sentinel-2 dates) more than the same outlines displaced?
 B repeat: does the 2025 unit reappear in the independent 2024 prediction (IoU >= 0.5), versus a displaced 2024?
 C cover:  how much unit area lies on ESA WorldCover 2021 cropland, and how much lies on tree cover / water / built-up?
 D slope:  how much unit area lies on ground steeper than 30 degrees (Copernicus GLO-30)?
Verdict thresholds are fixed here, before looking at results."""
import sys, os, json, math, numpy as np, shapely
sys.path.insert(0, os.path.dirname(__file__)); from common import *; from render import *
from PIL import Image, ImageDraw
from scipy.ndimage import sobel, gaussian_filter
WC = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map"

def worldcover(bounds, epsg):
    x0, y0, x1, y1 = bounds; lons, lats = rtransform(f"EPSG:{epsg}", "EPSG:4326", [x0, x1, x0, x1], [y0, y0, y1, y1])
    dst = np.zeros((PX, PX), "uint8"); T = from_origin(x0, y1, 10, 10)
    for la in {3*math.floor(v/3) for v in (min(lats), max(lats))}:
        for lo in {3*math.floor(v/3) for v in (min(lons), max(lons))}:
            n = f"ESA_WorldCover_10m_2021_v200_N{la:02d}E{lo:03d}_Map.tif"
            with rasterio.open(f"/vsicurl/{WC}/{n}") as ds:
                tmp = np.zeros((PX, PX), "uint8"); reproject(rasterio.band(ds, 1), tmp, dst_transform=T, dst_crs=f"EPSG:{epsg}", resampling=Resampling.nearest)
                dst = np.where(dst == 0, tmp, dst)
    return dst

def raster(geoms, fill):
    im = Image.new("L", (PX, PX), 0); d = ImageDraw.Draw(im)
    for p in geoms:
        for part in (p.geoms if p.geom_type == "MultiPolygon" else [p]):
            c = list(part.exterior.coords)
            d.polygon(c, fill=1) if fill else d.line(c, fill=1, width=1)
    return np.array(im, bool)

def grad(a):
    a = gaussian_filter(a.astype("float32"), 0.7); g = np.hypot(sobel(a, 0), sobel(a, 1)); return g / (np.median(g) + 1e-9)

SHIFTS = [(dx, dy) for dx in (-7, 0, 7) for dy in (-7, 0, 7) if (dx, dy) != (0, 0)]
def shifted(m, dx, dy): return np.roll(np.roll(m, dy, 0), dx, 1)

res = {}
for key, name, *_ in SITES:
    if key == "yosemite": continue
    meta = json.load(open(f"{RAW}/{key}.json")); g25, a25, _ = fields(key, 2025); g24, a24, _ = fields(key, 2024)
    line = raster(g25, False); inter = raster(g25, True)
    # A: edge agreement on two dates, luminance and NDVI
    ratios = []
    for season in ("after_rains", "dry"):
        s = np.load(f"{RAW}/{key}_{season}.npy").astype("float32"); lum = s[:3].mean(0); ndvi = (s[3] - s[0]) / (s[3] + s[0] + 1e-6)
        G = np.maximum(grad(lum), grad(ndvi))
        null = [G[shifted(line, dx, dy)].mean() for dx, dy in SHIFTS]
        ratios.append((float(G[line].mean() / np.mean(null)), float((G[line].mean() - np.mean(null)) / (np.std(null) + 1e-9))))
    # B: persistence between independent yearly predictions, units >= 0.1 ha
    big = np.where(a25 >= 1000)[0]; tree = shapely.STRtree(g24)
    def best_iou(geoms, off=0.0):
        out = []
        for p in geoms:
            q = shapely.affinity.translate(p, off, off) if off else p; b = 0.0
            for j in tree.query(q):
                o = g24[j]
                try: i = q.intersection(o).area
                except Exception: continue
                if i > 0: b = max(b, i / (q.area + o.area - i))
            out.append(b)
        return np.array(out)
    import shapely.affinity
    rng = np.random.default_rng(1); pick = big if len(big) <= 3000 else rng.choice(big, 3000, replace=False)
    g24v = shapely.make_valid(g24); tree = shapely.STRtree(g24v); g24 = g24v
    iou = best_iou(shapely.make_valid(g25[pick])); iou0 = best_iou(shapely.make_valid(g25[pick]), 7.0)
    # C: land cover under the units
    wc = worldcover(meta["bounds"], meta["epsg"]); tot = inter.sum()
    cov = {n: float((inter & (wc == c)).sum() / tot) for n, c in dict(cropland=40, tree=10, shrub=20, grass=30, built=50, bare=60, water=80).items()}
    crop_share_window = float((wc == 40).mean()); recall = float((inter & (wc == 40)).sum() / max((wc == 40).sum(), 1))
    # D: slope
    dem = np.load(f"{RAW}/{key}_dem.npy"); gy, gx = np.gradient(dem, 10.0); slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    steep = float((inter & (slope > 30)).sum() / tot)
    edge = min(r[0] for r in ratios); rep = float((iou >= 0.5).mean()); rep0 = float((iou0 >= 0.5).mean())
    verdict = ("supported" if edge >= 1.5 and rep >= 0.4 and cov["cropland"] >= 0.6 else
               "not supported" if edge < 1.15 or cov["cropland"] < 0.3 else "mixed")
    res[key] = dict(edge_ratio=[round(r[0], 2) for r in ratios], edge_z=[round(r[1], 1) for r in ratios], repeat=round(rep, 3), repeat_null=round(rep0, 3),
                    n_repeat_tested=int(len(pick)), cover={k: round(v, 3) for k, v in cov.items()}, window_cropland=round(crop_share_window, 3),
                    cropland_outlined=round(recall, 3), steep=round(steep, 3), tiny=round(float((a25 < 400).mean()), 3), verdict=verdict)
    print(key, json.dumps(res[key]))
json.dump(res, open(os.path.join(ROOT, "web", "verify.json"), "w"), indent=1)
