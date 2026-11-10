"""Pick the clearest, most complete 2025 L2A scene for an MGRS tile over a list of months (open COGs only)."""
import sys, re, json, urllib.request, mgrs
sys.path.insert(0, __file__.rsplit("/",1)[0]); import s2
lat, lon, months = float(sys.argv[1]), float(sys.argv[2]), [int(m) for m in sys.argv[3].split(",")]
tile = mgrs.MGRS().toMGRS(lat, lon, MGRSPrecision=0); t = f"{tile[:2]}/{tile[2]}/{tile[3:]}"
best = None
for mo in months:
    xml = urllib.request.urlopen(f"{s2.BUCKET}/?list-type=2&prefix=sentinel-s2-l2a-cogs/{t}/2025/{mo}/&delimiter=/", context=s2._ctx).read().decode()
    for sid in [p.rstrip('/').split('/')[-1] for p in re.findall(r"<Prefix>([^<]*L2A/)</Prefix>", xml)]:
        try: it = s2.item(sid); p = it["properties"]
        except Exception: continue
        if "sentinel-cogs" not in it["assets"]["red"]["href"]: continue
        sc = p.get("eo:cloud_cover", 100) + 0.3*p.get("s2:nodata_pixel_percentage", 100)
        if best is None or sc < best[0]: best = (round(sc,2), sid, p.get("eo:cloud_cover"), p.get("s2:nodata_pixel_percentage"))
print(json.dumps(dict(tile=tile, best=best)))
