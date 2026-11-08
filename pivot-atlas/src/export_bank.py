"""Glyph bank export for the live Observatory.
Admission: Egypt catalog records (audited twice) + new-biome records passing the strict bank rule
(strong tier, sub-pixel fit, fit_resid <= 0.05). Each glyph: 80 px sprite cell (L2A chip resized,
declared rendering, NO tint), circular use only. Features: CIELAB mean, ExG, NDVI(2025 obs), texture std,
dark-side vector (wedge angle + contrast), radius m, biome, lon/lat, scene, date, class."""
import sys, json, os, numpy as np
from PIL import Image
from skimage.color import rgb2lab
BIOMES = {"36QUL": "Toshka, Egypt", "35QPF": "East Oweinat, Egypt", "11TLL": "Columbia Basin, USA",
          "13SGV": "Texas Panhandle, USA", "37RDP": "Al Jawf, Saudi Arabia"}
# Western Bahia (23LMG) EXCLUDED: independent critic precision 18/24 = 75% (circles cut from rectangular fields, no hub).
EGYPT = {"36QUL", "35QPF"}
S = 80; PER = 25            # 25x25 glyphs per 2000x2000 sheet
out = "web2"; os.makedirs(f"{out}/bank", exist_ok=True)
rows, cells = [], []
for t, name in BIOMES.items():
    p = f"atlas/{t}/records.json"
    if not os.path.exists(p): print("skip", t); continue
    det = {}
    if t not in EGYPT:
        for d in json.load(open(f"data/det_{t}_v6.json"))["accepted"]: det[(round(d["px"],2), round(d["py"],2))] = d
    n0 = 0
    for r in json.load(open(p))["records"]:
        if t not in EGYPT and not (r["tier"] == "strong" and r.get("geometry") == "subpixel_fit" and (r.get("fit_resid") or 1) <= 0.05): continue
        im = Image.open(f"atlas/{t}/{r['chip']}").convert("RGBA").resize((S, S), Image.LANCZOS)
        a = np.asarray(im).astype(np.float32)/255; m = a[...,3] > 0.99; rgb = a[...,:3]
        L = rgb2lab(rgb[None])[0]; lab = L[m].mean(0)
        R, G, B = rgb[...,0][m], rgb[...,1][m], rgb[...,2][m]; exg = float((2*G - R - B).mean())
        yy, xx = np.mgrid[0:S, 0:S]; xx = (xx - S/2 + .5)/(S/2); yy = (yy - S/2 + .5)/(S/2)
        dk = (100 - L[...,0]) * m; sx, sy = (dk*xx).sum()/dk.sum(), (dk*yy).sum()/dk.sum()
        tex = float(L[...,0][m].std())
        cells.append(rgb)   # keep the real terrain collar; the viewer clips to the field circle
        rows.append([r["id"], name, r["lon"], r["lat"], r["radius_m"], r["obs"]["date"], r["obs"]["scene_id"], r["obs"]["cls"],
                     round(float(lab[0]),1), round(float(lab[1]),1), round(float(lab[2]),1), round(exg,3), r["obs"]["ndvi_median"],
                     round(tex,1), round(float(np.degrees(np.arctan2(sy, sx))),1), round(float(np.hypot(sx, sy)),3)])
        n0 += 1
    print(t, name, n0, flush=True)
n = len(cells); sheets = (n + PER*PER - 1)//(PER*PER)
for k in range(sheets):
    sh = np.zeros((PER*S, PER*S, 3), np.float32)
    for j in range(PER*PER):
        i = k*PER*PER + j
        if i >= n: break
        y, x = divmod(j, PER); sh[y*S:(y+1)*S, x*S:(x+1)*S] = cells[i]
    big = Image.fromarray((sh*255).astype(np.uint8)); big.save(f"{out}/bank/sheet_{k}.jpg", quality=90, optimize=True)
    big.resize((PER*S//2, PER*S//2), Image.LANCZOS).save(f"{out}/bank/sheet40_{k}.jpg", quality=86, optimize=True)   # fast first paint
json.dump(dict(cols=["id","biome","lon","lat","radius_m","date","scene","cls","L","a","b","exg","ndvi","tex","dark_angle_deg","dark_strength"],
               glyph_px=S, per_row=PER, sheets=sheets, rendering=dict(bands=["B04","B03","B02"], product="Sentinel-2 L2A BOA", reflectance_max=0.55, gamma=0.9, tint=0.0),
               rows=rows), open(f"{out}/bank/bank.json","w"), separators=(",",":"))
print("glyphs", n, "sheets", sheets)
# ---- ledger
import collections
scn = {}
for t in BIOMES:
    p = f"data/stack_{t}_2025-03.json" if t in EGYPT else f"data/stack_{t}_2025.json"
    if os.path.exists(p): scn[BIOMES[t]] = ", ".join(json.load(open(p))["scenes"])
by = collections.defaultdict(list)
for r in rows: by[r[1]].append(r[8])
L = []
for t, name in BIOMES.items():
    if name not in by: continue
    v = np.array(by[name]); rule = "catalog (sealed GT + 2 audit rounds)" if t in EGYPT else "strict: strong rim, sub-pixel fit, residual ≤ 0.05; sampled by independent critic"
    L.append([name, scn.get(name, ""), f"{len(v):,}", f"{np.percentile(v,5):.0f}–{np.percentile(v,95):.0f}", rule])
json.dump(dict(rows=L, note="Fields are Sentinel-2 L2A surface reflectance (B04/B03/B02, 0–0.55, gamma 0.9), identical rendering for every field, no tint. Contains modified Copernicus Sentinel data 2025."),
          open(f"{out}/bank/ledger.json", "w"), indent=1)
print("ledger", [l[:3] for l in L])
