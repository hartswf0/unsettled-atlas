"""Shared data pack for the 26 works. Every image is a windowed read of an open Sentinel-2 L2A COG at
10 m, same rendering everywhere (B04/B03/B02, 0-0.55, gamma 0.9; false colour B08/B04/B03 declared)."""
import sys, os, json, re, urllib.request, numpy as np, rasterio
from rasterio.windows import Window
from pyproj import Transformer
from PIL import Image
sys.path.insert(0, "src"); import s2
from common import load
OUT = "works/pack"; os.makedirs(OUT, exist_ok=True)
REC = {t: json.load(open(f"atlas/{t}/records.json"))["records"] for t in ("36QUL","35QPF","13SGV","37RDP","11TLL")}
def render(stack, fc=False):
    a = stack.astype(np.float32)/1e4
    return (np.clip(a/0.55, 0, 1)**0.9*255).astype(np.uint8).transpose(1,2,0)
def window_read(sid, lon, lat, half_m, bands=("red","green","blue")):
    it = s2.item(sid); arr = []
    for b in bands:
        with rasterio.open(s2.href(it, b)) as ds:
            X, Y = Transformer.from_crs("EPSG:4326", ds.crs, always_xy=True).transform(lon, lat)
            col, row = ~ds.transform * (X, Y); px = half_m/abs(ds.transform.a)
            w = ds.read(1, window=Window(int(col-px), int(row-px), int(2*px), int(2*px)), boundless=True, fill_value=0,
                        out_shape=(int(2*half_m/10), int(2*half_m/10)))
            arr.append(w)
    return np.stack(arr)
def list_month(tile, y, m):
    t = f"{tile[:2]}/{tile[2]}/{tile[3:]}"
    xml = urllib.request.urlopen(f"{s2.BUCKET}/?list-type=2&prefix=sentinel-s2-l2a-cogs/{t}/{y}/{m}/&delimiter=/", context=s2._ctx).read().decode()
    return [p.rstrip('/').split('/')[-1] for p in re.findall(r"<Prefix>([^<]*L2A/)</Prefix>", xml)]
def best(tile, y, m, maxcc=3):
    b = None
    for sid in list_month(tile, y, m):
        try: it = s2.item(sid); p = it["properties"]
        except Exception: continue
        if "sentinel-cogs" not in it["assets"]["red"]["href"]: continue
        sc = p.get("eo:cloud_cover",100) + 0.3*p.get("s2:nodata_pixel_percentage",100)
        if p.get("eo:cloud_cover",100) <= maxcc and (b is None or sc < b[0]): b = (sc, sid)
    return b[1] if b else None
def densest(recs, k=60):
    P = np.array([[r["lon"], r["lat"]] for r in recs]); best_i, bn = 0, 0
    for i in range(0, len(P), 7):
        n = (np.hypot((P[:,0]-P[i,0])*np.cos(np.radians(P[i,1])), P[:,1]-P[i,1]) < 0.03).sum()
        if n > bn: bn, best_i = n, i
    return P[best_i]
man = {}
what = sys.argv[1:] or ["seasons","marey","ghost","farm","grids"]
if "seasons" in what:   # A5: a year over Al Jawf, true and false colour
    lon, lat = densest(REC["37RDP"]); frames = []
    for m in range(1, 13):
        y = 2025 if m <= 10 else 2024
        sid = best("37RDP", y, m)
        if not sid: continue
        a = window_read(sid, lon, lat, 4000, ("nir","red","green","blue"))
        Image.fromarray(render(a[[1,2,3]])).save(f"{OUT}/jawf_{y}{m:02d}_tc.jpg", quality=86)
        Image.fromarray(render(a[[0,1,2]])).save(f"{OUT}/jawf_{y}{m:02d}_fc.jpg", quality=86)
        frames.append(dict(month=f"{y}-{m:02d}", scene=sid)); print("seasons", y, m, sid, flush=True)
    man["seasons"] = dict(lon=float(lon), lat=float(lat), half_m=4000, frames=frames)
if "marey" in what:     # B6: one field, every clear March 2025 date
    r = max((r for r in REC["36QUL"] if r["geometry"] == "subpixel_fit" and r["obs"]["cls"] == "active"), key=lambda r: r["radius_m"])
    fr = []
    for sid in sorted(list_month("36QUL", 2025, 3)):
        try: p = s2.item(sid)["properties"]
        except Exception: continue
        if p.get("eo:cloud_cover",100) > 10: continue
        a = window_read(sid, r["lon"], r["lat"], r["radius_m"]*1.3)
        if (a[0] == 0).mean() > 0.05: continue
        Image.fromarray(render(a)).resize((360,360), Image.LANCZOS).save(f"{OUT}/marey_{sid}.jpg", quality=90); fr.append(sid); print("marey", sid, flush=True)
    man["marey"] = dict(id=r["id"], lon=r["lon"], lat=r["lat"], radius_m=r["radius_m"], scenes=fr)
if "ghost" in what:     # A3: one ghost field, nine Marches, 10 m
    cands = [r for t in ("36QUL","35QPF") for r in REC[t] if r.get("lifecycle",{}).get("status") == "ghost" and r["lifecycle"].get("epochs_valid",0) >= 8]
    def score(r):
        h = [e for e in r["history"] if e.get("valid")]; return max(e["planted_frac"] for e in h[:4]) - max(e["planted_frac"] for e in h[-2:])
    r = max(cands, key=score); out = []
    for e in sorted(r["history"], key=lambda e: e["year"]):
        if not e.get("valid"): continue
        a = window_read(e["scene"], r["lon"], r["lat"], r["radius_m"]*1.6)
        Image.fromarray(render(a)).resize((300,300), Image.LANCZOS).save(f"{OUT}/ghost_{e['year']}.jpg", quality=90)
        out.append(dict(year=e["year"], scene=e["scene"], planted_frac=e["planted_frac"], present=e["present"], rim_support=e["rim_support"])); print("ghost", e["year"], flush=True)
    man["ghost"] = dict(id=r["id"], lon=r["lon"], lat=r["lat"], radius_m=r["radius_m"], lifecycle=r["lifecycle"], history=out)
if "farm" in what:      # D1/A1: one East Oweinat farm, 10 m, plus its fields
    lon, lat = densest(REC["35QPF"]); sid = REC["35QPF"][0]["obs"]["scene_id"]; half = 3500
    a = window_read(sid, lon, lat, half); Image.fromarray(render(a)).save(f"{OUT}/farm_oweinat.jpg", quality=90)
    s, _, m = load("data/stack_35QPF_2025-03.npz"); tr = Transformer.from_crs("EPSG:4326", m["crs"], always_xy=True); X0, Y0 = tr.transform(lon, lat)
    f = []
    for r in REC["35QPF"]:
        dx, dy = r["utm"][0]-X0, r["utm"][1]-Y0
        if abs(dx) < half and abs(dy) < half:
            f.append(dict(id=r["id"], x=(dx+half)/(2*half), y=(half-dy)/(2*half), r=r["radius_m"]/(2*half), cls=r["obs"]["cls"], pf=r["obs"]["planted_frac"],
                          arcs=r["obs"]["planted_arcs_deg"], status=r.get("lifecycle",{}).get("status"), lon=r["lon"], lat=r["lat"], radius_m=r["radius_m"]))
    man["farm"] = dict(lon=float(lon), lat=float(lat), half_m=half, scene=sid, fields=f); print("farm", len(f), flush=True)
if "grids" in what:     # D2: Texas sections vs Egypt lattice
    for key, t in (("texas","13SGV"), ("egypt","36QUL")):
        lon, lat = densest(REC[t]); sid = REC[t][0]["obs"]["scene_id"]; half = 4000
        a = window_read(sid, lon, lat, half); Image.fromarray(render(a)).save(f"{OUT}/grid_{key}.jpg", quality=88)
        s_, _, m = load(f"data/stack_{t}_2025.npz" if t == "13SGV" else f"data/stack_{t}_2025-03.npz")
        tr = Transformer.from_crs("EPSG:4326", m["crs"], always_xy=True); X0, Y0 = tr.transform(lon, lat)
        f = [dict(x=(r["utm"][0]-X0+half)/(2*half), y=(half-(r["utm"][1]-Y0))/(2*half), r=r["radius_m"]/(2*half)) for r in REC[t] if abs(r["utm"][0]-X0) < half and abs(r["utm"][1]-Y0) < half]
        man[f"grid_{key}"] = dict(lon=float(lon), lat=float(lat), half_m=half, scene=sid, fields=f); print("grid", key, len(f), flush=True)
old = json.load(open(f"{OUT}/manifest.json")) if os.path.exists(f"{OUT}/manifest.json") else {}
old.update(man); json.dump(old, open(f"{OUT}/manifest.json","w"), indent=1)
