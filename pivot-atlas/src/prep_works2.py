"""Pack part 2: Toshka tile composition (B7), canal traced from Sentinel-2 water pixels (B5),
farm clusters with yearly stats (B3), Toshka small-multiple crops (B8), Egypt field table (many works)."""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.graph import route_through_array
sys.path.insert(0, "src"); from common import load
OUT = "works/pack"; man = json.load(open(f"{OUT}/manifest.json"))
s, src, m = load("data/stack_36QUL_2025-03.npz"); a = s.astype(np.float32)/1e4; valid = s[2] > 0
ndwi = (a[1]-a[3])/(a[1]+a[3]+1e-6); water = (ndwi > 0.05) & valid & (a[3] < 0.15)
recs = json.load(open("atlas/36QUL/records.json"))["records"]; t = m["transform"]
piv_area = sum(np.pi*r["radius_m"]**2 for r in recs)
px_area = 400.0; tile = valid.sum()*px_area; wat = water.sum()*px_area
man["composition_36QUL"] = dict(valid_km2=round(tile/1e6,1), water_km2=round(wat/1e6,1), pivot_km2=round(piv_area/1e6,1),
    other_km2=round((tile-wat-piv_area)/1e6,1), n_fields=len(recs), method="water = NDWI>0.05 and NIR<0.15 on 2025-03 composite; pivots = sum of catalog circle areas; other = remainder (desert, roads, non-pivot farms)")
# canal: least-cost path through water from lake edge to the western farm area
lab, n = ndi.label(water); sizes = ndi.sum(water, lab, range(1, n+1))
cost = np.where(water, 1.0, 60.0); cost[~valid] = 1e4
small = cost[::4, ::4]
# start: point on Lake Nasser (largest water body near the SE), end: canal head near the Toshka farms (manual anchor, labelled)
lake = lab == (1+int(np.argmax(sizes))); ys, xs = np.nonzero(lake[::4, ::4])
start = (int(np.median(ys[xs > np.percentile(xs, 80)])), int(np.percentile(xs, 90)))
end = (int(3300/4), int(1350/4))
path, c = route_through_array(small, start, end, fully_connected=True, geometric=True)
P = (np.array(path)*4).tolist()
man["canal"] = dict(px20=P[::6], tile="36QUL", method="least-cost path through NDWI water pixels between a Lake Nasser point and a manually placed end point near the western farms; route = traced, not surveyed", cost=float(c))
# small multiples crops
X0, Y0, W = 0, 1250, 4200
yrs = list(range(2017, 2025)) + [2025]
for y in yrs:
    p = f"data/epochs/stack_36QUL_{y}-03.npz" if y < 2025 else "data/stack_36QUL_2025-03.npz"
    st, _, mm = load(p); im = (np.clip(st[[2,1,0], Y0:Y0+W, X0:X0+W].astype(np.float32)/1e4/0.55, 0, 1)**0.9*255).astype(np.uint8).transpose(1,2,0)
    Image.fromarray(im).resize((600,600), Image.LANCZOS).save(f"{OUT}/toshka_{y}.jpg", quality=84)
man["smallmult"] = dict(px20_box=[X0, Y0, W], years=yrs, tile_transform=t, crs=m["crs"])
# canal preview
im = Image.open(f"{OUT}/toshka_2025.jpg")
man["canal"]["in_crop"] = [[(x-X0)/W, (y-Y0)/W] for y, x in P[::6] if 0 <= x-X0 < W and 0 <= y-Y0 < W]
json.dump(man, open(f"{OUT}/manifest.json","w"), indent=1); print(man["composition_36QUL"], len(man["canal"]["in_crop"]))
