"""Pivot detection cascade on a 20 m stack.
  1 candidates : Hough (gradient) circles on a contrast image, tiled with overlap   [high recall]
  2 confirm    : rim support = fraction of rim angles with a consistent radial step  [structure, not greenness]
  3 reject     : water (low NIR inside), rim-less blobs
  4 refine     : local search of (cx,cy,r) maximizing rim support
  5 NMS        : merge duplicates across tile seams
Writes candidates with all scores so thresholds can be audited, not hidden."""
import sys, json, numpy as np, cv2
sys.path.insert(0, __file__.rsplit("/",1)[0]); from common import *
import os
P = dict(rmin=7, rmax=int(os.environ.get("RMAX", 32)), tile=768, ovl=80, hough_param2=0.55, support_min=0.5, step_min=0.015, mean_step_min=0.03, overlap_max=0.80)
NA = 96
ANG = np.linspace(0, 2*np.pi, NA, endpoint=False)

CH_W = (1.0, 0.4)
def feature(stack):
    """(2,H,W): ch0 brightness (VIS+SWIR; crops, wet & tilled soil darker than sand),
    ch1 0.4*SWIR/NIR (lower inside fallow/ghost circles: residual moisture/organics; measured on dev window)."""
    s = stack.astype(np.float32) / 10000.0
    b = 0.5*s[[0,1,2]].mean(0) + 0.5*s[4]
    q = CH_W[1] * s[4] / (s[3] + 1e-3)
    f = np.stack([b, q]); f[:, stack[2]==0] = np.nan
    return f

def ring(f, cx, cy, r, d):
    xs = cx + (r+d)*np.cos(ANG); ys = cy + (r+d)*np.sin(ANG)
    xi = np.clip(xs.round().astype(int), 0, f.shape[1]-1); yi = np.clip(ys.round().astype(int), 0, f.shape[0]-1)
    return f[yi, xi]

def rim_score(f, cx, cy, r):
    k = max(2, r*0.25)
    inner = np.nanmean([ring(f,cx,cy,r,-k*a) for a in (1,1.5,2)], 0)
    outer = np.nanmean([ring(f,cx,cy,r, k*a) for a in (1,1.5,2)], 0)
    step = outer - inner                        # >0: field darker than surroundings
    sgn = np.sign(np.nanmedian(step))
    s = step*sgn
    support = np.nanmean(s > P["step_min"])
    return float(support), float(np.nanmedian(step)), s

def steps_batch(f, cx, cy, r):
    """cx,cy,r arrays (n,) -> signed step per angle (n, NA): mean(outer band) - mean(inner band)."""
    k = np.maximum(2.0, r*0.18)[:,None,None]
    offs = np.array([0.6,1.2,1.8])[None,:,None]
    c, s_ = np.cos(ANG)[None,None,:], np.sin(ANG)[None,None,:]
    def samp(rad):
        xs = cx[:,None,None] + rad*c; ys = cy[:,None,None] + rad*s_
        xi = np.clip(np.rint(xs).astype(int), 0, f.shape[-1]-1); yi = np.clip(np.rint(ys).astype(int), 0, f.shape[-2]-1)
        return np.nanmean(f[:, yi, xi], 2)       # (C, n, NA)
    R = r[:,None,None]
    return samp(R + k*offs) - samp(R - k*offs)

def magnitude(st):
    """st (C,n,NA) -> per-angle rim magnitude (n,NA): each channel oriented by its own dominant sign,
    so a half-planted circle (dark half + SWIR/NIR-contrast fallow half) scores on its whole rim."""
    sg = np.sign(np.nanmedian(st, 2, keepdims=True))
    return np.sqrt(np.sum(np.clip(st*sg, 0, 0.25)**2, 0)), sg[:, :, 0]

def refine(f, cx, cy, r):
    bx, by, br = cx, cy, r
    for span, step in ((0.35, 0.07), (0.06, 0.02)):
        d = np.arange(-span, span+1e-9, step) * br
        DX, DY, DR = [a.ravel() for a in np.meshgrid(d, d, d, indexing="ij")]
        rr = np.maximum(P["rmin"], br + DR)
        m, _ = magnitude(steps_batch(f, bx+DX, by+DY, rr))
        i = int(np.nanargmax(np.nanmean(m, 1))); bx, by, br = bx+DX[i], by+DY[i], rr[i]
    st = steps_batch(f, np.array([bx]), np.array([by]), np.array([br]))
    m, sg = magnitude(st); m = m[0]
    return float(np.nanmean(m > P["step_min"])), float(np.nanmean(m)), float(sg[0,0]), bx, by, br, float(np.nanmedian(st[0,0]))

def candidates(F):
  out = []
  for f in F:
    out += _candidates(f)
  return out

def _candidates(f):
    g = np.nan_to_num(f, nan=np.nanmedian(f))
    g8 = np.clip((g - np.percentile(g,1)) / (np.percentile(g,99.5)-np.percentile(g,1)) * 255, 0, 255).astype(np.uint8)
    g8 = cv2.GaussianBlur(g8, (0,0), 1.2)
    H, W = g8.shape; T, O = P["tile"], P["ovl"]; out = []
    for y0 in range(0, H, T):
        for x0 in range(0, W, T):
            ya, xa = max(0,y0-O), max(0,x0-O)
            sub = g8[ya:min(H,y0+T+O), xa:min(W,x0+T+O)]
            for rlo, rhi in ((P["rmin"],16),(14,P["rmax"])):
                c = cv2.HoughCircles(sub, cv2.HOUGH_GRADIENT_ALT, dp=1.0, minDist=rlo*1.2,
                                     param1=60, param2=P["hough_param2"], minRadius=rlo, maxRadius=rhi)
                if c is not None:
                    for cx, cy, r in c[0]: out.append((cx+xa, cy+ya, r))
    return out

def nms(recs):
    """Pivots touch but do not overlap: suppress a circle overlapping a stronger one by > overlap_max."""
    recs = sorted(recs, key=lambda d: -(d["support"]*d["step"])); keep = []
    for d in recs:
        if all(np.hypot(d["px"]-k["px"], d["py"]-k["py"]) > P["overlap_max"]*(d["pr"]+k["pr"]) for k in keep): keep.append(d)
    return keep

def run(stack_path, out_path):
    stack, src, meta = load(stack_path); f = feature(stack)
    nir = stack[3].astype(np.float32)/10000.0
    cands = candidates(f); print("hough candidates", len(cands), flush=True)
    recs = []
    for cx, cy, r in cands:
        sup, step, sgn, cx2, cy2, r2, bstep = refine(f, float(cx), float(cy), float(r))
        yy, xx = np.ogrid[-int(r2):int(r2)+1, -int(r2):int(r2)+1]
        m = (xx**2+yy**2) <= (0.8*r2)**2
        y0, x0 = int(cy2)-int(r2), int(cx2)-int(r2)
        if y0 < 0 or x0 < 0 or y0+m.shape[0] > f.shape[-2] or x0+m.shape[1] > f.shape[-1]: continue
        nin = float(np.nanmean(nir[y0:y0+m.shape[0], x0:x0+m.shape[1]][m]))
        sid = int(np.bincount(src[y0:y0+m.shape[0], x0:x0+m.shape[1]][m]).argmax())
        recs.append(dict(px=float(cx2), py=float(cy2), pr=float(r2), support=sup, step=step, sign=sgn, bstep=bstep, nir_in=nin, scene_idx=sid))
    print("refined", len(recs), flush=True)
    for d in recs:
        d["is_water"] = d["nir_in"] < 0.12
        d["accept"] = (d["support"] >= P["support_min"]) and d["step"] >= P["mean_step_min"] and not d["is_water"] and d["scene_idx"] != 255
    acc = nms([d for d in recs if d["accept"]])
    print("accepted after NMS", len(acc), flush=True)
    json.dump(dict(params=P, stack=stack_path, n_candidates=len(cands), all=recs, accepted=acc), open(out_path,"w"))
if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2])
