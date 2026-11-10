"""Independent external check: Chen et al. Hyper-Arid Africa CPIS inventory (CC BY 4.0, Landsat-based,
annual). For each inventory polygon whose centroid falls in a tile's valid 20 m footprint: centroid,
equivalent radius sqrt(A/pi), circularity 4piA/P^2. Match to catalog records (centre distance < 0.5 r).
Reports both directions: inventory polygons we found (recall vs inventory) and our records the
inventory contains (agreement). Disagreements are written out for visual adjudication."""
import sys, json, numpy as np, shapefile
from pyproj import Transformer
sys.path.insert(0, __file__.rsplit("/",1)[0]); from common import *
from scipy.spatial import cKDTree
shp, tile, year = sys.argv[1], sys.argv[2], int(sys.argv[3])
stack, src, meta = load(f"data/stack_{tile}_2025-03.npz" if year == 2025 else f"data/epochs/stack_{tile}_{year}-03.npz")
valid = stack[2] > 0; t = meta["transform"]; tr = Transformer.from_crs("EPSG:4326", meta["crs"], always_xy=True)
recs = json.load(open(f"atlas/{tile}/records.json"))["records"]
if year == 2025: mine = [(r["utm"][0], r["utm"][1], r["radius_m"], r["id"]) for r in recs]
else:
    mine = [(r["utm"][0], r["utm"][1], r["radius_m"], r["id"]) for r in recs
            if any(e["year"] == year and e.get("valid") and e.get("present") for e in r.get("history", []))]
M = np.array([m[:3] for m in mine]); tree = cKDTree(M[:, :2])
ext = []
for s in shapefile.Reader(shp).iterShapes():
    b = s.bbox
    if b[2] < 27.5 or b[0] > 32.5 or b[3] < 21.5 or b[1] > 24: continue
    pts = np.array(s.points); X, Y = tr.transform(pts[:,0], pts[:,1])
    for k, st in enumerate(s.parts):
        en = s.parts[k+1] if k+1 < len(s.parts) else len(pts); x, y = np.array(X[st:en]), np.array(Y[st:en])
        A = 0.5*abs(np.dot(x, np.roll(y,1)) - np.dot(y, np.roll(x,1))); P = np.hypot(np.diff(x), np.diff(y)).sum()
        if A < 1e4: continue
        cx, cy = x.mean(), y.mean(); px, py = (cx-t[2])/t[0], (cy-t[5])/t[4]
        if not (0 <= px < valid.shape[1] and 0 <= py < valid.shape[0]) or not valid[int(py), int(px)]: continue
        ext.append((cx, cy, np.sqrt(A/np.pi), 4*np.pi*A/P**2))
E = np.array(ext); circ = E[:,3] >= 0.85          # single circular polygons (dissolved multi-field blobs are not)
hit = np.array([len(tree.query_ball_point(e[:2], 0.5*e[2])) > 0 for e in E])
etree = cKDTree(E[:, :2]); back = np.array([len(etree.query_ball_point(m[:2], max(0.5*m[2], 1))) > 0 for m in M])
# radius agreement on matched, circular polygons
rr = []
for e, h in zip(E, hit):
    if h and e[3] >= 0.85:
        d, j = tree.query(e[:2]); rr.append(M[j, 2] / e[2])
res = dict(inventory="Chen et al., Africa hyper-arid CPIS v1.0 (CC BY 4.0)", year=year, tile=tile,
    inventory_polygons=int(len(E)), inventory_circular=int(circ.sum()),
    recall_vs_inventory_circular=float(hit[circ].mean()), recall_vs_inventory_all=float(hit.mean()),
    catalog_records=int(len(M)), catalog_in_inventory=float(back.mean()),
    radius_ratio_catalog_over_inventory_median=float(np.median(rr)) if rr else None)
print(json.dumps(res, indent=1))
miss = E[circ & ~hit]; extra = [mine[i] for i in np.nonzero(~back)[0]]
json.dump(dict(summary=res, inventory_missed_by_catalog=miss[:, :3].round(1).tolist(),
               catalog_not_in_inventory=[[m[0], m[1], m[2], m[3]] for m in extra]),
          open(f"data/external/check_{tile}_{year}.json", "w"))
