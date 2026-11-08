"""Per-circle history across March epochs, at fixed catalog geometry (same MGRS grid every year).
present  : rim magnitude support >= 0.5 and step >= 0.025, or planted_frac >= 0.1
active   : planted_frac >= 0.1
Lifecycle: first_seen (earliest present epoch; '<=2017' when present in the first epoch),
last_active, status in {active, ghost (present, not active in last two epochs), absent_now}."""
import sys, json, glob, numpy as np
sys.path.insert(0, __file__.rsplit("/",1)[0]); from common import *; import detect as D; import catalog as C
tile = sys.argv[1]; R = json.load(open(f"atlas/{tile}/records.json"))
files = sorted(glob.glob(f"data/epochs/stack_{tile}_*-03.npz")) + [R["stack"]]
hist = {r["id"]: [] for r in R["records"]}
for fpath in files:
    stack, src, meta = load(fpath); f = D.feature(stack); s = stack.astype(np.float32)/1e4
    ndvi = (s[3]-s[2])/(s[3]+s[2]+1e-6); t = meta["transform"]; sid = meta["scenes"][0]
    year = int(fpath.split("_")[-1][:4]) if "epochs" in fpath else 2025
    X = np.array([(r["utm"][0]-t[2])/t[0]-0.5 for r in R["records"]]); Y = np.array([(r["utm"][1]-t[5])/t[4]-0.5 for r in R["records"]])  # -> pixel-centre
    Rr = np.array([r["radius_m"]/20 for r in R["records"]])
    for i0 in range(0, len(X), 512):
        sl = slice(i0, i0+512); st = D.steps_batch(f, X[sl], Y[sl], Rr[sl]); m, _ = D.magnitude(st)
        sup = np.nanmean(m > D.P["step_min"], 1); stp = np.nanmean(m, 1)
        for j, i in enumerate(range(i0, min(i0+512, len(X)))):
            r = R["records"][i]; ok = stack[2, int(Y[i]), int(X[i])] > 0
            if not ok: hist[r["id"]].append(dict(year=year, scene=sid, valid=False)); continue
            pn = C.polar(ndvi, X[i], Y[i], Rr[i]); planted = np.median(pn, 0) > C.NDVI_PLANT; pf = float(planted.mean())
            hist[r["id"]].append(dict(year=year, scene=sid, valid=True, planted_frac=round(pf,3),
                ndvi_median=round(float(np.median(pn)),3), rim_support=round(float(sup[j]),3),
                present=bool((sup[j] >= 0.5 and stp[j] >= 0.025) or pf >= 0.1)))
    print(fpath, flush=True)
for r in R["records"]:
    h = sorted([e for e in hist[r["id"]] if e["valid"]], key=lambda e: e["year"]); r["history"] = hist[r["id"]]
    pres = [e["year"] for e in h if e["present"]]; act = [e["year"] for e in h if e["planted_frac"] >= 0.1]
    first = min(pres) if pres else None
    r["lifecycle"] = dict(first_seen=(f"<={first}" if first == h[0]["year"] else first) if first else None,
        last_active=max(act) if act else None, epochs_valid=len(h),
        status=("active" if act and max(act) >= h[-1]["year"]-1 else ("ghost" if pres else "absent_now")))
json.dump(R, open(f"atlas/{tile}/records.json", "w"))
from collections import Counter
print(Counter(r["lifecycle"]["status"] for r in R["records"]), Counter(str(r["lifecycle"]["first_seen"]) for r in R["records"]))
