"""Pack part 4: fields recorded by the inventory in 2015-2024 with no field at that spot in 2025
('gone'), per tile, deduplicated across years, with first and last year recorded."""
import json, glob, sys, numpy as np, shapefile
from pyproj import Transformer, Geod
from scipy.spatial import cKDTree
sys.path.insert(0, "src"); from common import load
B = "data/external/africa_hyperarid_cpis"; geod = Geod(ellps="WGS84"); inv = json.load(open("works/pack/inventory.json"))
def shp_for(y):
    if y == 2017: return f"{B}/y2017/africa_hyperarid_cpis_2017"
    f = glob.glob(f"{B}/years/y{y}/*.shp"); return f[0][:-4] if f else None
tiles = {t: load(f"data/stack_{t}_2025-03.npz") for t in ("36QUL", "35QPF")}
out = {}
for t, (s, _, m) in tiles.items():
    valid = s[2] > 0; tr_ = m["transform"]; tf = Transformer.from_crs("EPSG:4326", m["crs"], always_xy=True)
    now = np.array([[a, b, r] for a, b, r, _ in inv["first_year"][t]]); lat0 = np.radians(now[:,1].mean())
    K = lambda a: np.c_[np.asarray(a)[:,0]*np.cos(lat0)*111.32, np.asarray(a)[:,1]*110.57]
    tnow = cKDTree(K(now)); gone = []
    for y in range(2015, 2025):
        p = shp_for(y)
        if not p: continue
        for sh in shapefile.Reader(p).iterShapes():
            P = np.array(sh.points)
            for k, st in enumerate(sh.parts):
                en = sh.parts[k+1] if k+1 < len(sh.parts) else len(P); q = P[st:en]
                if len(q) < 4: continue
                lon, lat = q[:,0].mean(), q[:,1].mean()
                if not (27.5 < lon < 32.5 and 21.5 < lat < 24): continue
                X, Y = tf.transform(lon, lat); px, py = (X-tr_[2])/tr_[0], (Y-tr_[5])/tr_[4]
                if not (0 <= px < valid.shape[1] and 0 <= py < valid.shape[0] and valid[int(py), int(px)]): continue
                A = abs(geod.polygon_area_perimeter(q[:,0], q[:,1])[0]); r = np.sqrt(A/np.pi)
                if A < 1e4 or 4*np.pi*A/max(1, geod.polygon_area_perimeter(q[:,0], q[:,1])[1])**2 < 0.8: continue
                d, _ = tnow.query(K([[lon, lat]]))
                if d[0] < 0.5*r/1000: continue
                gone.append([lon, lat, r, y])
    g = np.array(gone); keep = []
    if len(g):
        tg = cKDTree(K(g)); used = np.zeros(len(g), bool)
        for i in np.argsort(g[:,3]):
            if used[i]: continue
            idx = tg.query_ball_point(K(g[i:i+1])[0], 0.5*g[i,2]/1000); used[idx] = True
            keep.append([round(g[i,0],5), round(g[i,1],5), round(g[i,2]), int(g[idx,3].min()), int(g[idx,3].max())])
    out[t] = keep; print(t, "gone fields", len(keep), flush=True)
inv["gone"] = out; inv["gone_note"] = "circular (4πA/P² ≥ 0.8) inventory fields seen in 2015-2024 with no 2025 inventory field within half a radius; [lon, lat, r_m, first_year, last_year]"
json.dump(inv, open("works/pack/inventory.json","w"), separators=(",",":"))
