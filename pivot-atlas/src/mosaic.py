"""THE ASSEMBLER. Renders a target image as a mosaic of real, audited pivot chips.
Modes
  faithful : unaltered chips; selection + rotation only.
  graded   : declared partial colour transfer toward the cell colour (alpha = --grade).
  halftone : (AM) dot size from tone — a darker cell requests a LARGER real field; every chip is
             drawn at one shared metres->pixels scale, so relative dot sizes are true field sizes.
  ghost    : library restricted to fallow/partial circles.
Gap colour = measured median sand of the source scene, not black.
Every placed dot is written to a manifest: cell -> pivot id, lon/lat, date, scene, rotation."""
import sys, json, argparse, numpy as np
from PIL import Image
from skimage.color import rgb2lab, lab2rgb
from scipy.spatial import cKDTree
ap = argparse.ArgumentParser()
ap.add_argument("--atlas", required=True); ap.add_argument("--target", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--mode", default="faithful", choices=["faithful","graded","halftone","ghost"])
ap.add_argument("--cols", type=int, default=90); ap.add_argument("--width", type=int, default=3600)
ap.add_argument("--grade", type=float, default=0.5); ap.add_argument("--sand", default=None)
ap.add_argument("--seed", type=int, default=7); ap.add_argument("--rep", type=float, default=2.0)
a = ap.parse_args(); rng = np.random.default_rng(a.seed)
A = json.load(open(f"{a.atlas}/records.json")); recs = [r for r in A["records"] if r.get("audit","pass") != "fail"]
if a.mode == "ghost": recs = [r for r in recs if r["obs"]["cls"] in ("fallow","partial")]
print("library", len(recs))
# ---- library features
chips, LAB, DIP, RAD = [], [], [], []
for r in recs:
    im = np.asarray(Image.open(f"{a.atlas}/{r['chip']}").convert("RGBA")).astype(np.float32)/255
    chips.append(im); m = im[...,3] > 0.99
    L = rgb2lab(im[...,:3][None])[0]
    LAB.append(L[m].mean(0))
    h, w = m.shape; yy, xx = np.mgrid[0:h,0:w]; xx = (xx-w/2)/(w/2); yy = (yy-h/2)/(h/2)
    dk = (100 - L[...,0]) * m; DIP.append([(dk*xx).sum()/dk.sum(), (dk*yy).sum()/dk.sum()])   # dark-side vector
    RAD.append(r["radius_m"])
LAB, DIP, RAD = np.array(LAB), np.array(DIP), np.array(RAD)
sand = np.array(json.loads(a.sand)) if a.sand else None
# ---- target + hex lattice
T = Image.open(a.target).convert("RGB"); W = a.width; H = int(W * T.height / T.width)
T = np.asarray(T.resize((W, H), Image.LANCZOS)).astype(np.float32)/255; TL = rgb2lab(T[None])[0]
# TARGET GAMUT FIT (declared in manifest; chips are never altered by this): map target L*,a*,b*
# percentiles (2,98) onto the library's, so matching uses the palette the desert actually offers.
def pct(a, q): return np.percentile(a, q)
tfit = {}
for c in range(3):
    t2, t98 = pct(TL[...,c], 2), pct(TL[...,c], 98); l2, l98 = pct(LAB[:,c], 2), pct(LAB[:,c], 98)
    if a.mode != "halftone": TL[...,c] = l2 + (TL[...,c] - t2) * (l98 - l2) / max(t98 - t2, 1e-3)
    tfit[c] = [float(t2), float(t98), float(l2), float(l98)]
TLmin, TLmax = pct(TL[...,0], 2), pct(TL[...,0], 98)
D = W / a.cols; rowh = D*np.sqrt(3)/2; cells = []
for j in range(int(H/rowh)+2):
    for i in range(a.cols+1):
        cells.append((i*D + (D/2 if j%2 else 0), j*rowh))
cells = [(x,y) for x,y in cells if -D/2 < x < W+D/2 and -D/2 < y < H+D/2]
def cellfeat(x, y, rad):
    x0, x1, y0, y1 = int(max(0,x-rad)), int(min(W,x+rad)), int(max(0,y-rad)), int(min(H,y+rad))
    P = TL[y0:y1, x0:x1]; yy, xx = np.mgrid[y0:y1, x0:x1]; m = (xx-x)**2+(yy-y)**2 <= rad*rad
    if m.sum() < 3: return None
    lab = P[m].mean(0); dk = (100-P[...,0])*m; s = dk.sum()+1e-6
    dip = [((xx-x)/rad*dk).sum()/s, ((yy-y)/rad*dk).sum()/s]
    return lab, np.array(dip), P[...,0][m].std()
# ---- scale for halftone: largest library radius fills the cell
rmax = np.percentile(RAD, 98); px_per_m = (D/2*1.0) / rmax
canvas = np.ones((H, W, 3), np.float32) * (lab2rgb(sand[None,None])[0,0] if sand is not None else np.array([0.85,0.7,0.5]))
if sand is not None: sandL = sand[0]
else: sandL = 75
used = np.zeros(len(recs)); place = []; tree_cells = []; last = {}
order = rng.permutation(len(cells))
for ci in order:
    x, y = cells[ci]; f = cellfeat(x, y, D/2)
    if f is None: continue
    lab, dip, std = f
    if a.mode == "halftone":
        # darkness relative to sand -> requested fraction of max radius (area ~ coverage)
        # tone from the target's own range: darkest 2% -> full dot, lightest 2% -> no dot; gamma for midtones
        cover = np.clip((TLmax - lab[0]) / max(1, TLmax - TLmin), 0.0, 1.0) ** 1.15
        if cover < 0.03: continue
        r_req = rmax*np.sqrt(cover)
        cost = 1.0*np.abs(np.log(RAD/r_req))*40 + 0.5*np.hypot(LAB[:,1]-lab[1], LAB[:,2]-lab[2])
    else:
        cost = np.sqrt(((LAB - lab)**2 * np.array([1.0, 1.0, 1.0])).sum(1))
    cost = cost + a.rep*used                                   # repetition penalty
    for j in last.get((round(x/D), round(y/rowh)), []): cost[j] += 1e6
    k = int(np.argmin(cost)); used[k] += 1
    # rotation: align chip dark-side vector with cell dark-side vector
    rot = 0.0
    if np.hypot(*DIP[k]) > 0.04 and np.hypot(*dip) > 0.02:
        rot = np.degrees(np.arctan2(dip[1], dip[0]) - np.arctan2(DIP[k][1], DIP[k][0]))
    im = Image.fromarray((chips[k]*255).astype(np.uint8))
    if a.mode == "halftone": dpx = max(2, int(round(2*RAD[k]*px_per_m)))
    else: dpx = int(round(D*1.0))
    im = im.rotate(-rot, resample=Image.BICUBIC).resize((dpx, dpx), Image.LANCZOS)
    c = np.asarray(im).astype(np.float32)/255; rgb, al = c[...,:3], c[...,3:]
    if a.mode == "graded":
        cl = rgb2lab(rgb[None])[0]; cl = cl + a.grade*(lab - LAB[k]); rgb = np.clip(lab2rgb(cl[None])[0], 0, 1)
    x0, y0 = int(round(x - dpx/2)), int(round(y - dpx/2))
    xa, ya = max(0,x0), max(0,y0); xb, yb = min(W, x0+dpx), min(H, y0+dpx)
    if xb <= xa or yb <= ya: continue
    sub = (slice(ya-y0, yb-y0), slice(xa-x0, xb-x0))
    canvas[ya:yb, xa:xb] = canvas[ya:yb, xa:xb]*(1-al[sub]) + rgb[sub]*al[sub]
    r = recs[k]
    place.append(dict(x=round(x,1), y=round(y,1), d=dpx, rot=round(rot,1), id=r["id"], lon=r["lon"], lat=r["lat"],
                      radius_m=r["radius_m"], date=r["obs"]["date"], scene=r["obs"]["scene_id"], cls=r["obs"]["cls"], chip=r["chip"]))
    for dx in (-1,0,1):
        for dy in (-1,0,1): last.setdefault((round(x/D)+dx, round(y/rowh)+dy), []).append(k)
Image.fromarray((canvas*255).astype(np.uint8)).save(a.out + ".png", optimize=True)
Image.fromarray((canvas*255).astype(np.uint8)).resize((1200, int(1200*H/W)), Image.LANCZOS).save(a.out + "_preview.jpg", quality=88)
json.dump(dict(mode=a.mode, target=a.target, target_gamut_fit=None if a.mode=="halftone" else tfit, width=W, height=H, cell=D, cols=a.cols, sand_lab=None if sand is None else sand.tolist(),
               library=len(recs), distinct_used=int((used>0).sum()), max_reuse=int(used.max()), dots=place,
               attribution="Contains modified Copernicus Sentinel data 2025"), open(a.out + ".json", "w"))
print("dots", len(place), "distinct", int((used>0).sum()), "max reuse", int(used.max()))
