"""Independent audit packets (seeded, reproducible).
DETECTION sample: n random accepted records -> 3r context crop, detected circle drawn, numbered.
EMPTY-SPACE sample: m random 3 km windows inside the farm envelope that contain NO detection centre
  (or partially empty) — the auditor looks for missed pivots there. Excludes sealed GT chip areas."""
import sys, json, os, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
sys.path.insert(0, __file__.rsplit("/",1)[0]); from common import *
stack_path, rec_path, out, n, m, seed = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
gt_index = sys.argv[7] if len(sys.argv) > 7 else None
stack, src, meta = load(stack_path); R = rgb(stack); H = R.shape[0]
recs = json.load(open(rec_path))["records"]; rng = np.random.default_rng(seed)
os.makedirs(out, exist_ok=True)
t = meta["transform"]
P = np.array([[(r["utm"][0]-t[2])/t[0], (r["utm"][1]-t[5])/t[4], r["radius_m"]/20] for r in recs])
gtbox = []
if gt_index:
    for c in json.load(open(gt_index))["chips"]: gtbox.append((c["x0"], c["y0"], c["size_px20"]))
def in_gt(x, y): return any(x0-150 <= x < x0+s+150 and y0-150 <= y < y0+s+150 for x0,y0,s in gtbox)
items = []
sel = [i for i in rng.permutation(len(recs)) if not in_gt(*P[i,:2])][:n]
for k, i in enumerate(sel):
    x, y, r = P[i]; h = int(3*r); x0, y0 = int(x)-h, int(y)-h
    crop = R[max(0,y0):y0+2*h, max(0,x0):x0+2*h]
    im = Image.fromarray(crop).resize((450, 450), Image.LANCZOS); s = 450/(2*h); d = ImageDraw.Draw(im)
    X, Y = (x-max(0,x0))*s, (y-max(0,y0))*s
    d.ellipse([X-r*s, Y-r*s, X+r*s, Y+r*s], outline=(0,255,255), width=2)
    name = f"det_{k:03d}"; im.save(f"{out}/{name}.png"); items.append(dict(packet=name, kind="detection", record=recs[i]["id"]))
# empty-space: farm envelope = dilated detection density
occ = np.zeros((H//10+1, H//10+1)); 
for x, y, r in P: occ[int(y)//10, int(x)//10] = 1
env = ndi.binary_dilation(occ, iterations=40)
W = 150   # 3 km window at 20 m
cand = np.argwhere(env); rng.shuffle(cand); k = 0
for cy, cx in cand:
    x0, y0 = cx*10 - W//2, cy*10 - W//2
    if x0 < 0 or y0 < 0 or x0+W > H or y0+W > H or in_gt(x0+W/2, y0+W/2) or (stack[2, y0:y0+W, x0:x0+W]==0).mean() > 0.05: continue
    inside = ((P[:,0] > x0-P[:,2]) & (P[:,0] < x0+W+P[:,2]) & (P[:,1] > y0-P[:,2]) & (P[:,1] < y0+W+P[:,2]))
    im = Image.fromarray(R[y0:y0+W, x0:x0+W]).resize((600,600), Image.LANCZOS); s = 600/W; d = ImageDraw.Draw(im)
    for x, y, r in P[inside]:
        d.ellipse([(x-x0-r)*s, (y-y0-r)*s, (x-x0+r)*s, (y-y0+r)*s], outline=(0,255,255), width=2)
    for g in range(0, 601, 100): d.line([(g,0),(g,600)], fill=(255,0,255)); d.line([(0,g),(600,g)], fill=(255,0,255))
    name = f"space_{k:03d}"; im.save(f"{out}/{name}.png")
    items.append(dict(packet=name, kind="space", x0=int(x0), y0=int(y0), n_detected_overlapping=int(inside.sum()))); k += 1
    if k == m: break
json.dump(dict(stack=stack_path, records=rec_path, seed=seed, items=items), open(f"{out}/index.json","w"), indent=1)
print(len(items))
