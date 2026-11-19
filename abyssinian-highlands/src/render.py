"""Shared rendering: natural-colour stretch (one gain for all three bands, so hue is untouched) and field geometry in window pixels."""
import sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(__file__)); from common import *
from PIL import Image, ImageDraw
import pyarrow.parquet as pq, shapely
from pyproj import Transformer

def rgb(key, season):
    a = np.load(f"{RAW}/{key}_{season}.npy").astype("float32")[:3]
    lum = a.mean(0); lo, hi = np.percentile(lum, [1, 99.5])
    v = np.clip((a - lo) / (hi - lo), 0, 1) ** (1/1.6)
    return (v.transpose(1, 2, 0) * 255).astype("uint8")

def fields(key, year=2025):
    """Field polygons as shapely geometries in window pixel coordinates (x right, y down), 1 px = 10 m."""
    meta = json.load(open(f"{RAW}/{key}.json")); x0, y0, x1, y1 = meta["bounds"]
    t = pq.read_table(f"{RAW}/{key}_ftw.parquet").to_pandas()
    t = t[t["determination:datetime"].dt.year == year]
    g = shapely.from_wkb(t["geometry"].values)
    tr = Transformer.from_crs(4326, meta["epsg"], always_xy=True)
    def f(c):
        x, y = tr.transform(c[:, 0], c[:, 1]); return np.column_stack([(x - x0) / 10, (y1 - y) / 10])
    g = shapely.transform(g, f)
    c = shapely.centroid(g); cx, cy = shapely.get_x(c), shapely.get_y(c)
    keep = (cx >= 0) & (cx < PX) & (cy >= 0) & (cy < PX)
    return g[keep], t["metrics:area"].values[keep], t["metrics:perimeter"].values[keep]

def outline(geoms, scale=1, color=(255, 255, 255, 255), size=PX, width=1):
    im = Image.new("RGBA", (size*scale, size*scale), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for p in geoms:
        for part in (p.geoms if p.geom_type == "MultiPolygon" else [p]):
            d.line([(x*scale, y*scale) for x, y in part.exterior.coords], fill=color, width=width)
    return im
if __name__ == "__main__":
    S = sys.argv[1]; os.makedirs(S, exist_ok=True)
    for key, *_ in SITES:
        for season in ("after_rains", "dry"):
            Image.fromarray(rgb(key, season)).save(f"{S}/{key}_{season}.jpg", quality=88)
        if key == "yosemite": continue
        g, a, p = fields(key); im = Image.fromarray(rgb(key, "after_rains")).convert("RGBA")
        crop = (300, 300, 700, 700)
        z = im.crop(crop).resize((1200, 1200), Image.LANCZOS)
        ov = outline(g, 3, (255, 240, 0, 255), width=1).crop((900, 900, 2100, 2100))
        pair = Image.new("RGB", (2400, 1200)); pair.paste(z.convert("RGB"), (0, 0)); pair.paste(Image.alpha_composite(z, ov).convert("RGB"), (1200, 0))
        pair.save(f"{S}/{key}_check.jpg", quality=85); print(key, len(g))
