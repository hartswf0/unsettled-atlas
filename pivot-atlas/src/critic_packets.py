"""Glyph-bank critic packets: per new basin, a seeded random sample of admitted fields shown with their
terrain collar and the circle drawn, 6x5 grid, numbered. The critic judges each: real pivot / not."""
import sys, json, os, numpy as np
from PIL import Image, ImageDraw
bank = json.load(open("web2/bank/bank.json")); S = bank["glyph_px"]; pr = bank["per_row"]; out = sys.argv[1]; os.makedirs(out, exist_ok=True)
sheets = {}; rng = np.random.default_rng(31); idx = {}
for name in sorted(set(r[1] for r in bank["rows"])):
    if "Egypt" in name: continue
    ids = [i for i, r in enumerate(bank["rows"]) if r[1] == name]; pick = rng.permutation(ids)[:30]
    W = Image.new("RGB", (6*170, 5*190), (240, 230, 210)); d = ImageDraw.Draw(W)
    for k, i in enumerate(pick):
        sh = i // (pr*pr); c = i % (pr*pr)
        if sh not in sheets: sheets[sh] = Image.open(f"web2/bank/sheet_{sh}.jpg")
        im = sheets[sh].crop(((c % pr)*S, (c//pr)*S, (c % pr)*S+S, (c//pr)*S+S)).resize((160, 160), Image.LANCZOS)
        x, y = (k % 6)*170+5, (k//6)*190+5; W.paste(im, (x, y)); rr = 160/2/1.04
        d.ellipse([x+80-rr, y+80-rr, x+80+rr, y+80+rr], outline=(0, 255, 255), width=1); d.text((x, y+163), f"#{k:02d}", fill=(0, 0, 0))
    f = name.split(",")[0].replace(" ", "_").lower(); W.save(f"{out}/{f}.png")
    idx[f] = dict(basin=name, ids=[bank["rows"][i][0] for i in pick])
json.dump(idx, open(f"{out}/index.json", "w"), indent=1); print(list(idx))
