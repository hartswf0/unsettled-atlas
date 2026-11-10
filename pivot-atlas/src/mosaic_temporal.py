"""TEMPORAL mode: same dot arrangement as a finished mosaic, each dot redrawn from its own field's
imagery in every March epoch (20 m stack, same declared rendering as chips). A dot whose field is
outside that epoch's valid swath is left as open sand (not interpolated)."""
import sys, json, glob, numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit("/",1)[0]); from common import *
from skimage.color import lab2rgb
man = json.load(open(sys.argv[1])); out = sys.argv[2]; scale = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
RHI, RG = 0.55, 0.9
recs = {}
for t in ("36QUL", "35QPF"):
    for r in json.load(open(f"atlas/{t}/records.json"))["records"]: r["tile"] = t; recs[r["id"]] = r
W, H = int(man["width"]*scale), int(man["height"]*scale)
sand = lab2rgb(np.array(man["sand_lab"])[None,None])[0,0]
years = sorted({int(f.split("_")[-1][:4]) for f in glob.glob("data/epochs/stack_*_*-03.npz")}) + [2025]
stacks = {}
for y in years:
    canvas = np.ones((H, W, 3), np.float32)*sand; n_ok = 0
    for t in ("36QUL", "35QPF"):
        p = f"data/epochs/stack_{t}_{y}-03.npz" if y != 2025 else f"data/stack_{t}_2025-03.npz"
        stacks[t] = load(p)
    for d in man["dots"]:
        r = recs.get(d["id"]); 
        if r is None: continue
        stack, src, meta = stacks[r["tile"]]; tr = meta["transform"]
        cx, cy, rr = (r["utm"][0]-tr[2])/tr[0], (r["utm"][1]-tr[5])/tr[4], r["radius_m"]/20
        h = int(np.ceil(rr*1.04)); x0, y0 = int(round(cx))-h, int(round(cy))-h
        A = stack[[2,1,0], y0:y0+2*h, x0:x0+2*h]
        if A.shape[1] != 2*h or A.shape[2] != 2*h or (A[0] == 0).mean() > 0.02: continue
        rgbc = (np.clip(A.astype(np.float32)/1e4/RHI, 0, 1)**RG*255).astype(np.uint8).transpose(1,2,0)
        yy, xx = np.mgrid[0:2*h, 0:2*h]; dist = np.hypot(xx+0.5-(cx-x0), yy+0.5-(cy-y0))
        al = (np.clip((rr-dist)*2+0.5, 0, 1)*255).astype(np.uint8)
        dpx = max(2, int(round(d["d"]*scale)))
        im = Image.fromarray(np.dstack([rgbc, al])).resize((dpx*4, dpx*4), Image.BICUBIC).rotate(-d["rot"], resample=Image.BICUBIC).resize((dpx, dpx), Image.LANCZOS)
        c = np.asarray(im).astype(np.float32)/255; rgb, a = c[...,:3], c[...,3:]
        X0, Y0 = int(round(d["x"]*scale - dpx/2)), int(round(d["y"]*scale - dpx/2))
        xa, ya, xb, yb = max(0,X0), max(0,Y0), min(W,X0+dpx), min(H,Y0+dpx)
        if xb <= xa or yb <= ya: continue
        s_ = (slice(ya-Y0, yb-Y0), slice(xa-X0, xb-X0))
        canvas[ya:yb, xa:xb] = canvas[ya:yb, xa:xb]*(1-a[s_]) + rgb[s_]*a[s_]; n_ok += 1
    Image.fromarray((canvas*255).astype(np.uint8)).save(f"{out}_{y}.jpg", quality=86)
    print(y, "dots drawn", n_ok, "/", len(man["dots"]), flush=True)
