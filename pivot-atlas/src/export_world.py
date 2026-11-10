"""World map data: land outline (Natural Earth 50m via world-atlas, public domain), every cataloged field
(this project), the Chen et al. Africa hyper-arid CPIS 2025 inventory (CC BY 4.0) as centroids+radius,
and the unscanned hotspot list. Integer-encoded to keep files small."""
import json, sys, numpy as np, shapefile
from pyproj import Geod
TOPO = sys.argv[1]; OUT = "web3/data"
t = json.load(open(TOPO)); sc, tr = t["transform"]["scale"], t["transform"]["translate"]
arcs = []
for a in t["arcs"]:
    x = y = 0; pts = []
    for dx, dy in a: x += dx; y += dy; pts.append((x*sc[0]+tr[0], y*sc[1]+tr[1]))
    arcs.append(pts)
def ring(ids):
    out = []
    for i in ids:
        p = arcs[i] if i >= 0 else arcs[~i][::-1]
        out += p if not out else p[1:]
    return out
rings = []
for g in t["objects"]["land"]["geometries"]:
    polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
    for poly in polys:
        for r in poly[:1]:                       # outer rings only
            pts = np.array(ring(r))
            if len(pts) < 4: continue
            q = np.round(pts*10).astype(int); keep = np.r_[True, np.any(np.diff(q, axis=0) != 0, axis=1)]
            rings.append(q[keep].ravel().tolist())
json.dump(rings, open(f"{OUT}/land.json", "w"), separators=(",", ":"))
# our fields
BI = {"36QUL":"Toshka, Egypt","35QPF":"East Oweinat, Egypt","11TLL":"Columbia Basin, USA","13SGV":"Texas Panhandle, USA","23LMG":"Western Bahia, Brazil","37RDP":"Al Jawf, Saudi Arabia"}
ours = []
for k,(t_,name) in enumerate(BI.items()):
    for r in json.load(open(f"atlas/{t_}/records.json"))["records"]:
        ours.append([round(r["lon"]*1e4), round(r["lat"]*1e4), round(r["radius_m"]), k, r["id"], r["obs"]["date"], r["obs"]["cls"]])
json.dump(dict(basins=list(BI.values()), excluded=["Western Bahia, Brazil"], rows=ours), open(f"{OUT}/ours.json","w"), separators=(",",":"))
# Africa inventory 2025 centroids
geod = Geod(ellps="WGS84"); inv = []
for s in shapefile.Reader("data/external/africa_hyperarid_cpis/y2025/2025_total_dissolve_whole_year").iterShapes():
    pts = np.array(s.points)
    for k, st in enumerate(s.parts):
        en = s.parts[k+1] if k+1 < len(s.parts) else len(pts); p = pts[st:en]
        if len(p) < 4: continue
        A, _ = geod.polygon_area_perimeter(p[:,0], p[:,1]); A = abs(A)
        if A < 1e4: continue
        inv.append([round(p[:,0].mean()*1e4), round(p[:,1].mean()*1e4), round(np.sqrt(A/np.pi))])
inv = np.array(inv); json.dump(inv.ravel().tolist(), open(f"{OUT}/africa2025.json","w"), separators=(",",":"))
HOT = [["Kufra, Libya",23.31,24.18],["As-Sarir, Libya",21.5,27.6],["Adrar, Algeria",-0.28,27.87],["El Oued, Algeria",6.86,33.37],["Northern State, Sudan",30.5,19.2],
       ["Wadi ad-Dawasir, Saudi Arabia",44.78,20.46],["Tabuk, Saudi Arabia",36.6,28.4],["Hail, Saudi Arabia",41.7,27.5],["Disi, Jordan",35.5,29.8],
       ["Nebraska Sandhills, USA",-99.5,41.0],["SW Kansas, USA",-100.9,37.6],["Snake River Plain, USA",-114.0,42.7],["San Luis Valley, USA",-106.0,37.7],
       ["Western Bahia, Brazil",-45.6,-12.2],["Minas Gerais (Unaí), Brazil",-46.9,-16.4],["Cordoba, Argentina",-63.5,-33.0],["Orange River / Karoo, South Africa",23.77,-29.05],
       ["Mkushi, Zambia",29.4,-13.6],["Riverina, Australia",145.9,-34.6],["Ningxia / Inner Mongolia, China",106.4,38.6],["Kazakhstan (Almaty)",77.0,43.6],["Konya, Turkey",32.5,37.9],["La Mancha, Spain",-2.7,39.2]]
json.dump(HOT, open(f"{OUT}/hotspots.json","w"))
print("land rings", len(rings), "ours", len(ours), "africa", len(inv))
