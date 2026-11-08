"""Stage 6b: sub-pixel geometry (response to independent audit finding #1).
Convention: detector pixel coordinates are PIXEL-CENTRE units (pixel i centred at i).
Per ray (96): sample both feature channels bilinearly from 0.5r to 1.5r; pick the channel with the
stronger inner/outer contrast; edge = half-max crossing nearest the prior radius. Robust algebraic
(Kasa) circle fit to edge points, MAD-trimmed, 3 iterations.
Outputs: refined px,py,pr; fit_resid (RMS of edge-point residuals / r) = circularity; fit_rays (fraction
of rays with a usable edge). Rock outcrops & irregular dark terrain show high fit_resid."""
import sys, json, numpy as np
from scipy.ndimage import map_coordinates
sys.path.insert(0, __file__.rsplit("/",1)[0]); from common import *; import detect as D
NA = 96; TH = np.linspace(0, 2*np.pi, NA, endpoint=False)
def kasa(x, y):
    A = np.c_[2*x, 2*y, np.ones_like(x)]; b = x*x + y*y
    c, *_ = np.linalg.lstsq(A, b, rcond=None); cx, cy = c[0], c[1]; r = np.sqrt(max(c[2] + cx*cx + cy*cy, 1e-6))
    return cx, cy, r
def fit_one(F, cx, cy, r):
    out = None
    for it in range(3):
        t = np.arange(0.5, 1.5001, 0.025) * r
        X = cx + t[None,:]*np.cos(TH)[:,None]; Y = cy + t[None,:]*np.sin(TH)[:,None]
        prof = np.stack([map_coordinates(F[c], [Y.ravel(), X.ravel()], order=1, mode="nearest").reshape(X.shape) for c in range(2)])
        tin = (t > 0.55*r) & (t < 0.8*r); tout = (t > 1.2*r) & (t < 1.45*r)
        inner = np.nanmedian(prof[:,:,tin], 2); outer = np.nanmedian(prof[:,:,tout], 2)
        con = outer - inner; ch = np.argmax(np.abs(con), 0); k = np.arange(NA)
        c_ = con[ch, k]; p = prof[ch, k]; lvl = ((inner + outer)/2)[ch, k]
        ex, ey = [], []
        for a in range(NA):
            if not np.isfinite(c_[a]) or abs(c_[a]) < 0.02: continue
            s = np.sign(p[a] - lvl[a]); cr = np.nonzero(np.diff(s) != 0)[0]
            cr = cr[(t[cr] > 0.75*r) & (t[cr] < 1.3*r)]
            if len(cr) == 0: continue
            i = cr[np.argmin(np.abs(t[cr] - r))]
            f0, f1 = p[a, i] - lvl[a], p[a, i+1] - lvl[a]; tt = t[i] + (t[i+1]-t[i]) * f0/(f0 - f1 + 1e-12)
            ex.append(cx + tt*np.cos(TH[a])); ey.append(cy + tt*np.sin(TH[a]))
        ex, ey = np.array(ex), np.array(ey); frac = len(ex)/NA
        if len(ex) < 0.35*NA: return out if out else (cx, cy, r, np.nan, frac)
        ncx, ncy, nr = kasa(ex, ey)
        for _ in range(2):
            res = np.hypot(ex-ncx, ey-ncy) - nr; mad = np.median(np.abs(res - np.median(res))) + 1e-6
            keep = np.abs(res) < max(2.5*1.4826*mad, 0.3)
            if keep.sum() < 0.3*NA: break
            ncx, ncy, nr = kasa(ex[keep], ey[keep])
        res = np.hypot(ex-ncx, ey-ncy) - nr
        if np.hypot(ncx-cx, ncy-cy) > 0.4*r or abs(nr-r) > 0.35*r: return out if out else (cx, cy, r, np.nan, frac)
        cx, cy, r = ncx, ncy, nr; out = (cx, cy, r, float(np.sqrt(np.mean(res**2)))/r, frac)
    return out
def run(stack_path, det_path, out_path):
    stack, src, meta = load(stack_path); F = D.feature(stack)
    for c in range(2): F[c] = np.where(np.isnan(F[c]), np.nanmedian(F[c]), F[c])
    det = json.load(open(det_path)); acc = det["accepted"]
    for d in acc:
        cx, cy, r, resid, frac = fit_one(F, d["px"], d["py"], d["pr"])
        d.update(px0=d["px"], py0=d["py"], pr0=d["pr"], px=float(cx), py=float(cy), pr=float(r),
                 fit_resid=None if not np.isfinite(resid) else float(resid), fit_rays=float(frac))
    det["geomfit"] = dict(rays=NA, method="half-max edge + MAD-trimmed Kasa", convention="pixel-centre")
    json.dump(det, open(out_path, "w"))
    rs = np.array([d["fit_resid"] for d in acc if d["fit_resid"] is not None])
    dr = np.array([d["pr"]/d["pr0"] for d in acc]); dc = np.array([np.hypot(d["px"]-d["px0"], d["py"]-d["py0"]) for d in acc])
    print(len(acc), "fit ok", len(rs), "resid pct [50,90,95,99]", np.percentile(rs,[50,90,95,99]).round(3),
          "r ratio median", np.median(dr).round(3), "centre shift median px", np.median(dc).round(2))
if __name__ == "__main__": run(*sys.argv[1:4])
