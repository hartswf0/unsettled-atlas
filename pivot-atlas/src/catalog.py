"""Stage 7: records + attributes + chips.
For each accepted circle: map coords (UTM -> WGS84), radius m, polar unwrap of NDVI and brightness
(72 angular bins x radius 0.25–0.9 r) -> planted sector fraction, sector arcs, wedge-edge angle;
class active|partial|fallow; CIELAB mean of 10 m true-colour chip; alpha-masked RGBA chip (10 m TCI).
Chips are DERIVED artifacts, regenerable from (scene_id, center, radius)."""
import sys, json, os, numpy as np, rasterio
from rasterio.windows import Window
from pyproj import Transformer
from PIL import Image
from skimage.color import rgb2lab
sys.path.insert(0, __file__.rsplit("/",1)[0]); from common import *; import s2
NB = 72; NDVI_PLANT = 0.30; RHI = 0.55; RG = 0.9
RENDER = dict(bands=["B04","B03","B02"], product="L2A BOA reflectance", gsd_m=10, reflectance_max=RHI, gamma=RG)
def polar(a, cx, cy, r):
    th = np.linspace(0, 2*np.pi, NB, endpoint=False); rr = np.linspace(0.25, 0.9, 8)*r
    xs = cx + rr[:,None]*np.cos(th)[None]; ys = cy + rr[:,None]*np.sin(th)[None]
    return a[np.clip(np.rint(ys).astype(int),0,a.shape[0]-1), np.clip(np.rint(xs).astype(int),0,a.shape[1]-1)]
def arcs(mask):
    """runs of True in circular bool array -> list of [start_deg, end_deg] (0 deg = east, clockwise in image = south)"""
    if mask.all(): return [[0.0, 360.0]]
    if not mask.any(): return []
    k = int(np.argmin(mask)); m = np.roll(mask, -k); out = []; i = 0
    while i < NB:
        if m[i]:
            j = i
            while j < NB and m[j]: j += 1
            out.append([((i+k)%NB)*360/NB, ((j+k)%NB)*360/NB or 360.0]); i = j
        else: i += 1
    return out
def run(stack_path, det_path, out_dir, tag):
    stack, src, meta = load(stack_path); det = json.load(open(det_path))
    s = stack.astype(np.float32)/1e4; ndvi = (s[3]-s[2])/(s[3]+s[2]+1e-6)
    tr = Transformer.from_crs(meta["crs"], "EPSG:4326", always_xy=True)
    os.makedirs(f"{out_dir}/chips", exist_ok=True)
    vis = {}
    for k, sid in enumerate(meta["scenes"]):
        it = s2.item(sid); bands = []
        for b in ("red", "green", "blue"):          # 10 m L2A surface reflectance
            with rasterio.open(s2.href(it, b)) as ds: bands.append(ds.read(1))
        # RENDERING (declared, identical for every chip): reflectance 0..RHI -> 0..255, gamma RG, no per-band balance
        vis[k] = (np.clip(np.stack(bands).astype(np.float32)/1e4/RHI, 0, 1)**RG * 255).astype(np.uint8)
        del bands; print("loaded L2A RGB", sid, flush=True)
    recs = []
    for d in det["accepted"]:
        cx, cy, r = d["px"], d["py"], d["pr"]
        X, Y = px2map(meta, cx+0.5, cy+0.5); lon, lat = tr.transform(X, Y)   # pixel-centre -> corner-based transform
        pn = polar(ndvi, cx, cy, r); pb = polar(s[[0,1,2]].mean(0), cx, cy, r)
        planted = np.median(pn, 0) > NDVI_PLANT
        frac = float(planted.mean())
        cls = "active" if frac >= 0.9 else ("partial" if frac >= 0.1 else "fallow")
        t = np.diff(np.r_[planted, planted[:1]].astype(int)); edges = (np.nonzero(t)[0]*360/NB).tolist()
        k = d["scene_idx"]; sid = meta["scenes"][k]
        # 10 m chip: 20 m px -> 10 m px is x2 (same tile grid origin)
        c10x, c10y, r10 = cx*2+1.0, cy*2+1.0, r*2          # 20 m pixel-centre -> 10 m corner units
        h = int(np.ceil(r10*1.04)); x0, y0 = int(round(c10x))-h, int(round(c10y))-h
        A = vis[k][:, max(0,y0):y0+2*h, max(0,x0):x0+2*h]
        if A.shape[1] != 2*h or A.shape[2] != 2*h or (A.astype(int).sum(0)==0).mean() > 0.02: continue
        rgbc = A.transpose(1,2,0)
        yy, xx = np.mgrid[0:2*h, 0:2*h]; dist = np.hypot(xx+0.5-(c10x-x0), yy+0.5-(c10y-y0))
        alpha = np.clip((r10 - dist)*2 + 0.5, 0, 1)
        lab = rgb2lab(rgbc[None].astype(np.float32)/255)[0][alpha > 0.99].mean(0)
        pid = f"PV-{tag}-{lon:+09.4f}{lat:+08.4f}".replace("+","E" if lon>=0 else "W",1)
        pid = f"PV-{tag}-{abs(lon):08.4f}{'E' if lon>=0 else 'W'}-{abs(lat):07.4f}{'N' if lat>=0 else 'S'}"
        Image.fromarray(np.dstack([rgbc, (alpha*255).astype(np.uint8)])).save(f"{out_dir}/chips/{pid}.png", optimize=True)
        recs.append(dict(id=pid, lon=round(lon,6), lat=round(lat,6), radius_m=round(r*20,1),
            utm=[round(X,1), round(Y,1)], crs=meta["crs"], tier=d["tier"], origin=d["origin"],
            rim_support=round(d["support"],3), rim_step=round(d["step"],4), geometry=d.get("geometry"), fit_resid=d.get("fit_resid"),
            obs=dict(scene_id=sid, date=f"{sid.split('_')[2][:4]}-{sid.split('_')[2][4:6]}-{sid.split('_')[2][6:]}",
                     sensor="Sentinel-2 L2A", gsd_m=10, cls=cls, planted_frac=round(frac,3),
                     planted_arcs_deg=arcs(planted), sector_edges_deg=edges,
                     ndvi_median=round(float(np.median(pn)),3), brightness=round(float(pb.mean()),4),
                     lab=[round(float(v),2) for v in lab]),
            chip=f"chips/{pid}.png", license_imagery="Copernicus Sentinel data 2025 (modified), free & open"))
    print("records", len(recs), {c: sum(r["obs"]["cls"]==c for r in recs) for c in ("active","partial","fallow")})
    json.dump(dict(stack=stack_path, detections=det_path, chip_rendering=RENDER, n=len(recs), records=recs), open(f"{out_dir}/records.json","w"))
if __name__ == "__main__":
    run(*sys.argv[1:5])
