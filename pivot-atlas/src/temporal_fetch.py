"""Pick the clearest, most complete March scene per year and fetch a 20 m stack for it."""
import sys, json, re, urllib.request, os
sys.path.insert(0, __file__.rsplit("/",1)[0]); import s2
from fetch import fetch
tile, years = sys.argv[1], [int(y) for y in sys.argv[2].split(",")]
t = f"{tile[:2]}/{tile[2]}/{tile[3:]}"; log = {}
for y in years:
    out = f"data/epochs/stack_{tile}_{y}-03.npz"      # epoch key stays "-03"; actual date is recorded in meta
    if os.path.exists(out): continue
    best = None
    for mo in (3, 2, 4, 10):                          # fall back when March has no open-COG item
      if best: break
      url = f"{s2.BUCKET}/?list-type=2&prefix=sentinel-s2-l2a-cogs/{t}/{y}/{mo}/&delimiter=/"
      xml = urllib.request.urlopen(url, context=s2._ctx).read().decode()
      sids = [p.rstrip('/').split('/')[-1] for p in re.findall(r"<Prefix>([^<]*L2A/)</Prefix>", xml)]
      for sid in sids:
        try: it = s2.item(sid); p = it["properties"]
        except Exception: continue
        if "sentinel-cogs" not in it["assets"]["red"]["href"]: continue   # requester-pays JP2 archive: not open
        if p.get("eo:cloud_cover", 100) > 5: continue
        score = p.get("eo:cloud_cover", 100) + 0.5*p.get("s2:nodata_pixel_percentage", 100)
        if best is None or score < best[0]: best = (score, sid, p.get("eo:cloud_cover"), p.get("s2:nodata_pixel_percentage"))
    if best is None: print(tile, y, "no open clear scene"); continue
    print(tile, y, best, flush=True); log[y] = best
    os.makedirs("data/epochs", exist_ok=True); fetch([best[1]], out)
json.dump(log, open(f"data/epochs/choice_{tile}.json","a"))
