"""Stage 6c: rock rejection + geometry selection (response to independent audit, round 1).
REJECT bare & non-circular: interior NDVI median < 0.12 AND fit_resid > 0.095  (rock outcrops, gaps).
GEOMETRY: use the sub-pixel half-max fit when it is clean (fit_resid <= 0.07, fit_rays >= 0.6);
otherwise (typically partial fields whose bare half has little edge contrast) keep rim-search geometry."""
import sys, json, numpy as np
sys.path.insert(0, __file__.rsplit("/",1)[0]); from common import *
G = dict(ndvi_bare=0.12, resid_noncirc=0.095, resid_clean=0.07, rays_clean=0.6)
stack, src, meta = load(sys.argv[1]); det = json.load(open(sys.argv[2]))
s = stack.astype(np.float32)/1e4; ndvi = (s[3]-s[2])/(s[3]+s[2]+1e-6); keep = []; rej = 0; geo = {"fit":0, "rim":0}
for d in det["accepted"]:
    r = d["pr0"]; yy, xx = np.ogrid[-int(r):int(r)+1, -int(r):int(r)+1]; mk = (xx**2+yy**2) <= (0.75*r)**2
    y0, x0 = int(d["py0"])-int(r), int(d["px0"])-int(r)
    d["ndvi_in"] = float(np.median(ndvi[y0:y0+mk.shape[0], x0:x0+mk.shape[1]][mk]))
    fr = d["fit_resid"] if d["fit_resid"] is not None else 1.0
    if d["ndvi_in"] < G["ndvi_bare"] and fr > G["resid_noncirc"]: rej += 1; continue
    if fr <= G["resid_clean"] and d["fit_rays"] >= G["rays_clean"]: d["geometry"] = "subpixel_fit"; geo["fit"] += 1
    else: d.update(px=d["px0"], py=d["py0"], pr=d["pr0"], geometry="rim_search"); geo["rim"] += 1
    keep.append(d)
det.update(accepted=keep, finalize=G); json.dump(det, open(sys.argv[3], "w"))
print("rejected bare+non-circular", rej, "kept", len(keep), geo)
