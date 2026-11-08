"""Round-2 audit: re-render the SAME detection sites judged in round 1 against the new catalog.
For each round-1 det packet, find the new record whose centre is within 0.6 r of the old centre;
if none, emit a 'rejected' packet (site shown with no circle) so the auditor confirms removals."""
import sys, json, os, numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer
sys.path.insert(0, __file__.rsplit("/",1)[0]); from common import *
tile, old, out = sys.argv[1], sys.argv[2], sys.argv[3]
stack, src, meta = load(f"data/stack_{tile}_2025-03.npz"); R = rgb(stack); t = meta["transform"]
tr = Transformer.from_crs("EPSG:4326", meta["crs"], always_xy=True)
recs = json.load(open(f"atlas/{tile}/records.json"))["records"]
P = np.array([[(r["utm"][0]-t[2])/t[0], (r["utm"][1]-t[5])/t[4], r["radius_m"]/20] for r in recs])   # corner units
os.makedirs(out, exist_ok=True); items = []
for it in json.load(open(f"{old}/index.json"))["items"]:
    if it["kind"] != "detection": continue
    p = it["record"].split("-"); X, Y = tr.transform(float(p[2][:-1]), float(p[3][:-1]))
    x, y = (X-t[2])/t[0], (Y-t[5])/t[4]            # old record centre (it was half a pixel NW)
    dd = np.hypot(P[:,0]-x, P[:,1]-y); j = int(np.argmin(dd)); hit = dd[j] < 0.6*P[j,2]
    cx, cy, r = (P[j] if hit else (x, y, 20.0))
    if not hit:   # use old radius estimate from neighbours for framing
        r = float(np.median(P[np.argsort(dd)[:6], 2]))
    h = int(3*r); x0, y0 = int(cx)-h, int(cy)-h
    crop = R[max(0,y0):y0+2*h, max(0,x0):x0+2*h]
    im = Image.fromarray(crop).resize((450,450), Image.LANCZOS); s = 450/(2*h); d = ImageDraw.Draw(im)
    if hit:
        X_, Y_ = (cx-max(0,x0))*s, (cy-max(0,y0))*s; d.ellipse([X_-r*s, Y_-r*s, X_+r*s, Y_+r*s], outline=(0,255,255), width=2)
    items.append(dict(packet=it["packet"], kind="detection" if hit else "rejected_site", record=recs[j]["id"] if hit else None))
    im.save(f"{out}/{it['packet']}.png")
json.dump(dict(round=2, tile=tile, items=items), open(f"{out}/index.json","w"), indent=1)
print(tile, sum(i["kind"]=="detection" for i in items), "kept", sum(i["kind"]=="rejected_site" for i in items), "rejected")
