"""Export compact web assets for the viewer: fields table (one row per catalog field), mosaic manifests
(dot -> field index), images, temporal frames, audit summary."""
import json, glob, os
from PIL import Image
recs = json.load(open("atlas/records.json"))["records"]
yrs = list(range(2017, 2026)); idx = {}
rows = []
for i, r in enumerate(recs):
    idx[r["id"]] = i; h = {e["year"]: e for e in r.get("history", [])}
    hist = [(round(h[y]["planted_frac"], 2) if (y in h and h[y]["valid"]) else None) for y in yrs]
    o = r["obs"]; lc = r.get("lifecycle", {})
    rows.append([r["id"], r["lon"], r["lat"], r["radius_m"], o["cls"], r["region"], o["date"], o["scene_id"],
                 lc.get("status"), lc.get("first_seen"), o["planted_frac"], hist, r.get("geometry")])
json.dump(dict(cols=["id","lon","lat","radius_m","cls","region","date","scene","status","first_seen","planted_frac","history","geometry"],
               years=yrs, rows=rows), open("web/fields.json","w"), separators=(",",":"))
OUTW = 2400
for name in ("astronaut_halftone","astronaut_faithful","astronaut_ghost","toshka_self"):
    m = json.load(open(f"mosaics/{name}.json")); s = OUTW / m["width"]
    im = Image.open(f"mosaics/{name}.png").convert("RGB"); H = int(round(m["height"]*s))
    im.resize((OUTW, H), Image.LANCZOS).save(f"web/img/{name}.jpg", quality=84, optimize=True, progressive=True)
    dots = [[round(d["x"]*s,1), round(d["y"]*s,1), round(d["d"]*s,1), idx[d["id"]], round(d["rot"])] for d in m["dots"]]
    json.dump(dict(name=name, mode=m["mode"], w=OUTW, h=H, dots=dots, library=m["library"], distinct=m["distinct_used"],
                   max_reuse=m["max_reuse"], gamut_fit=m.get("target_gamut_fit") is not None), open(f"web/m_{name}.json","w"), separators=(",",":"))
for f in sorted(glob.glob("mosaics/astronaut_temporal_*.jpg")):
    y = f.rsplit("_",1)[1][:4]; Image.open(f).resize((1200,1200), Image.LANCZOS).save(f"web/img/t_{y}.jpg", quality=82, optimize=True, progressive=True)
os.system("du -sh web; ls -la web web/img | head -40")
