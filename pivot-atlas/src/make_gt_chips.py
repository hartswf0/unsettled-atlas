"""Sealed GT chip sampler. Fixed seed. Strata: 'farm' (dark-field density high), 'edge'
(lake/canal confusers: very dark low-NDVI water), 'random' (anywhere valid). Writes chips with a
labelled grid for an independent labeler. The detector never reads chips/ or labels."""
import sys, json, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
sys.path.insert(0, __file__.rsplit("/",1)[0]); from common import *
stack, src, meta = load(sys.argv[1]); out = sys.argv[2]
import os; os.makedirs(out, exist_ok=True)
R = rgb(stack); C = 300; rng = np.random.default_rng(20251108)
red, nir = stack[2].astype(float), stack[3].astype(float)
bright = R.mean(2); valid = stack[2] > 0
ndvi = (nir-red)/(nir+red+1e-6)
dark = ndi.uniform_filter((bright < 110).astype(float) * valid, 300)
water = ndi.uniform_filter(((ndvi < 0.0) & valid & (bright < 90)).astype(float), 300)
okv = ndi.minimum_filter(valid.astype(np.uint8), C) > 0
H = stack.shape[1]
def pick(mask, n, tag):
    ys, xs = np.nonzero(mask[C//2:H-C//2:10, C//2:H-C//2:10]); res = []
    for i in rng.permutation(len(ys)):
        y, x = ys[i]*10+C//2, xs[i]*10+C//2
        if all(abs(y-a)>C or abs(x-b)>C for a,b,_ in res+chosen): res.append((y,x,tag))
        if len(res)==n: break
    return res
chosen = []
chosen += pick((dark > 0.25) & (water < 0.01) & okv, 8, "farm")
chosen += pick((water > 0.05) & (dark > 0.05) & okv, 3, "edge")
chosen += pick(okv, 3, "random")
index = []
for i,(cy,cx,tag) in enumerate(chosen):
    y0, x0 = cy-C//2, cx-C//2
    im = Image.fromarray(R[y0:y0+C, x0:x0+C]).resize((900,900), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    for g in range(0, 901, 75):
        d.line([(g,0),(g,900)], fill=(255,0,255), width=1); d.line([(0,g),(900,g)], fill=(255,0,255), width=1)
        d.text((g+2,2), str(g), fill=(255,0,255)); d.text((2,g+2), str(g), fill=(255,0,255))
    name = f"gt_{i:02d}"; im.save(f"{out}/{name}.png")
    index.append(dict(chip=name, stratum=tag, x0=int(x0), y0=int(y0), size_px20=C, display_scale=3))
json.dump(dict(stack=sys.argv[1], seed=20251108, chips=index), open(f"{out}/index.json","w"), indent=1)
print([(c["chip"],c["stratum"]) for c in index])
