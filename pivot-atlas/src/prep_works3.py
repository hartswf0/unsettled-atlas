"""Pack part 3, from Chen et al. Africa hyper-arid CPIS (annual, CC BY 4.0): per-year field counts and
area inside each tile's valid footprint, the Africa-wide yearly totals, and for every 2025 inventory field
inside Toshka/East Oweinat the first year the inventory records a field there."""
import json, glob, os, sys, numpy as np, shapefile
from pyproj import Transformer, Geod
from scipy.spatial import cKDTree
sys.path.insert(0, "src"); from common import load
B = "data/external/africa_hyperarid_cpis"; geod = Geod(ellps="WGS84")
def shp_for(y):
    if y == 2025: return f"{B}/y2025/2025_total_dissolve_whole_year"
    if y == 2017: return f"{B}/y2017/africa_hyperarid_cpis_2017"
    f = glob.glob(f"{B}/years/y{y}/*.shp"); return f[0][:-4] if f else None
tiles = {}
for t in ("36QUL", "35QPF"):
    s, _, m = load(f"data/stack_{t}_2025-03.npz"); tiles[t] = (s[2] > 0, m["transform"], Transformer.from_crs("EPSG:4326", m["crs"], always_xy=True))
years = [y for y in range(1972, 2026) if y not in (1974, 2012)]
counts = {t: {} for t in tiles}; africa = {}; pts = {t: {} for t in tiles}
for y in years:
    p = shp_for(y)
    if not p: continue
    tot_n, tot_a = 0, 0.0
    for sh in shapefile.Reader(p).iterShapes():
        P = np.array(sh.points)
        for k, st in enumerate(sh.parts):
            en = sh.parts[k+1] if k+1 < len(sh.parts) else len(P); q = P[st:en]
            if len(q) < 4: continue
            A = abs(geod.polygon_area_perimeter(q[:,0], q[:,1])[0])
            if A < 1e4: continue
            tot_n += 1; tot_a += A; lon, lat = q[:,0].mean(), q[:,1].mean()
            if not (27.5 < lon < 32.5 and 21.5 < lat < 24): continue
            for t, (valid, tr_, tf) in tiles.items():
                X, Y = tf.transform(lon, lat); px, py = (X-tr_[2])/tr_[0], (Y-tr_[5])/tr_[4]
                if 0 <= px < valid.shape[1] and 0 <= py < valid.shape[0] and valid[int(py), int(px)]:
                    c = counts[t].setdefault(y, [0, 0.0]); c[0] += 1; c[1] += A; pts[t].setdefault(y, []).append((lon, lat, np.sqrt(A/np.pi)))
    africa[y] = [tot_n, round(tot_a/1e6, 1)]; print(y, tot_n, {t: counts[t].get(y, [0])[0] for t in tiles}, flush=True)
first = {}
for t in tiles:
    cur = np.array(pts[t][2025]); fy = np.full(len(cur), 2025)
    lat0 = np.radians(cur[:,1].mean()); K = lambda a: np.c_[a[:,0]*np.cos(lat0)*111.32, a[:,1]*110.57]
    for y in sorted(pts[t], reverse=True)[1:]:
        old = np.array(pts[t][y]); tr = cKDTree(K(old)); d, _ = tr.query(K(cur))
        hit = d < 0.5*cur[:,2]/1000; fy[hit] = y
    first[t] = [[round(a,5), round(b,5), round(r), int(f)] for (a,b,r), f in zip(cur.tolist(), fy.tolist())]
json.dump(dict(source="Chen et al., Annual Center Pivot Irrigation System dataset of Africa's Hyper-Arid Regions (1972-2025) v1.0, CC BY 4.0",
               note="polygons >= 1 ha; touching fields may be dissolved into one polygon; 1974 and 2012 have no Landsat data",
               tiles={t: {str(y): [c[0], round(c[1]/1e6,1)] for y, c in sorted(counts[t].items())} for t in tiles},
               africa={str(y): v for y, v in africa.items()}, first_year=first), open("works/pack/inventory.json","w"), separators=(",",":"))
print("first-year", {t: len(v) for t, v in first.items()})
