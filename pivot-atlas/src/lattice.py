"""Stage 6: lattice invariant.
Strong tier: inside darker, near-complete rim. Accepted on its own.
Weak tier (faint/fallow/partial, either contrast sign): accepted only if it sits on the local farm
lattice — >=2 strong neighbours of similar radius at centre spacing 1.9–2.7 r.
Lattice completion: empty lattice sites predicted from strong neighbour vectors are tested with the
weak rim test, recovering ghost circles Hough never proposed."""
import sys, json, numpy as np
sys.path.insert(0, __file__.rsplit("/",1)[0]); from common import *
import detect as D
from scipy.spatial import cKDTree
Q = dict(strong_support=0.85, strong_step=0.08, strong_bstep=0.04, weak_support=0.6, weak_step=0.025,
         sp_lo=1.9, sp_hi=2.7, r_tol=0.25, min_nb=2)
import os
ANY_SIGN = os.environ.get("STRONG_SIGN", "darker") == "any"   # non-desert basins: fields may be brighter than surroundings
def tier(d):
    if (abs(d["bstep"]) if ANY_SIGN else d["bstep"]) >= Q["strong_bstep"] and d["support"] >= Q["strong_support"] and d["step"] >= Q["strong_step"]: return "strong"
    if d["support"] >= Q["weak_support"] and d["step"] >= Q["weak_step"]: return "weak"
    return None
def lattice_neighbours(c, S, tree):
    idx = tree.query_ball_point([c["px"], c["py"]], Q["sp_hi"]*c["pr"]*1.05); out = []
    for j in idx:
        s = S[j]; dist = np.hypot(s["px"]-c["px"], s["py"]-c["py"])
        if abs(s["pr"]-c["pr"]) <= Q["r_tol"]*c["pr"] and Q["sp_lo"]*c["pr"] <= dist <= Q["sp_hi"]*c["pr"]: out.append(j)
    return out
def run(stack_path, det_path, out_path):
    stack, src, meta = load(stack_path); f = D.feature(stack); nir = stack[3].astype(np.float32)/1e4
    det = json.load(open(det_path))
    pool = [d for d in det["all"] if not d["is_water"] and d["scene_idx"] != 255]
    for d in pool: d["tier"] = tier(d); d["origin"] = "hough"
    strong = D.nms([d for d in pool if d["tier"]=="strong"])
    tree = cKDTree([[s["px"], s["py"]] for s in strong])
    weak = []
    for d in pool:
        if d["tier"] != "weak": continue
        nb = lattice_neighbours(d, strong, tree)
        if len(nb) >= Q["min_nb"]: d["lattice_nb"] = len(nb); weak.append(d)
    # lattice completion: predict sites
    occ = cKDTree([[s["px"], s["py"]] for s in strong + weak])
    sites = []
    for i, s in enumerate(strong):
        for j in lattice_neighbours(s, strong, tree):
            v = np.array([strong[j]["px"]-s["px"], strong[j]["py"]-s["py"]])
            p = np.array([s["px"], s["py"]]) - v           # opposite side of s from j
            if occ.query(p)[0] > 0.8*s["pr"]: sites.append((p[0], p[1], s["pr"]))
    sites = np.array(sites)
    if len(sites):   # dedupe predicted sites
        keep = []; t = []
        for p in sites:
            if all(np.hypot(p[0]-q[0], p[1]-q[1]) > 0.5*p[2] for q in keep): keep.append(p)
        sites = keep
    print("strong", len(strong), "weak-on-lattice", len(weak), "predicted empty sites", len(sites), flush=True)
    filled = []
    for x, y, r in sites:
        if not (r < x < f.shape[-1]-r and r < y < f.shape[-2]-r) or np.isnan(f[0, int(y), int(x)]): continue
        sup, step, sgn, cx, cy, rr, bstep = D.refine(f, x, y, r)
        if np.hypot(cx-x, cy-y) > 0.35*r or abs(rr-r) > Q["r_tol"]*r: continue
        yy, xx = np.ogrid[-int(rr):int(rr)+1, -int(rr):int(rr)+1]; m = (xx**2+yy**2) <= (0.8*rr)**2
        y0, x0 = int(cy)-int(rr), int(cx)-int(rr)
        if y0 < 0 or x0 < 0 or y0+m.shape[0] > f.shape[-2] or x0+m.shape[1] > f.shape[-1]: continue
        nin = float(np.nanmean(nir[y0:y0+m.shape[0], x0:x0+m.shape[1]][m]))
        sid = int(np.bincount(src[y0:y0+m.shape[0], x0:x0+m.shape[1]][m]).argmax())
        d = dict(px=float(cx), py=float(cy), pr=float(rr), support=sup, step=step, sign=sgn, bstep=bstep, nir_in=nin,
                 scene_idx=sid, is_water=nin < 0.12, tier="weak", origin="lattice_completion")
        if not d["is_water"] and sid != 255 and sup >= Q["weak_support"] and step >= Q["weak_step"]:
            filled.append(d)
    print("lattice-completion accepted", len(filled), flush=True)
    acc = D.nms(strong + weak + filled)
    # strong-first NMS: re-insert strong that a weak one may have displaced
    print("accepted", len(acc), {o: sum(a["origin"]==o for a in acc) for o in ("hough","lattice_completion")},
          {t: sum(a["tier"]==t for a in acc) for t in ("strong","weak")})
    det.update(accepted=acc, lattice_params=Q); json.dump(det, open(out_path, "w"))
if __name__ == "__main__":
    run(*sys.argv[1:4])
