"""Fetch one site: two Sentinel-2 seasons, DEM, FTW field polygons. Usage: fetch.py <site-key>"""
import sys, os, json, pickle, numpy as np
sys.path.insert(0, os.path.dirname(__file__)); from common import *
key = sys.argv[1]; _, name, lat, lon, _ = next(s for s in SITES if s[0] == key)
epsg, B = window(lat, lon); out = {"key": key, "epsg": epsg, "bounds": B, "scenes": {}}
SEASONS = {"after_rains": [(2025, 11), (2025, 12), (2025, 10)], "dry": [(2025, 3), (2025, 4), (2025, 2)]}
if key == "yosemite": SEASONS = {"after_rains": [(2025, 9), (2025, 10)], "dry": [(2025, 7), (2025, 8)]}
for season, ym in SEASONS.items():
    best = None
    for cc, sid, it in s2_candidates(lat, lon, ym)[:14]:
        scl = s2_read(it, ["scl"], B, epsg)
        if scl is None: continue
        bad = float(np.isin(scl[0], [0, 1, 8, 9, 10]).mean())   # nodata, saturated, cloud, cirrus (terrain shadow is kept)
        print(f"  {season} {sid} tile cc {cc:.1f} window bad {bad:.3f}", file=sys.stderr)
        if best is None or bad < best[0]: best = (bad, sid, it)
        if bad < 0.005: break
    bad, sid, it = best
    rgbn = s2_read(it, ["red", "green", "blue", "nir"], B, epsg)
    np.save(f"{RAW}/{key}_{season}.npy", rgbn)
    out["scenes"][season] = {"id": sid, "date": it["properties"]["datetime"][:10], "window_bad": round(bad, 4)}
if not os.path.exists(f"{RAW}/{key}_dem.npy"): np.save(f"{RAW}/{key}_dem.npy", dem_read(B, epsg))
if os.path.exists(f"{RAW}/{key}_ftw.parquet"):
    import pyarrow.parquet as pq; out["ftw_rows"] = pq.ParquetFile(f"{RAW}/{key}_ftw.parquet").metadata.num_rows
elif key != "yosemite":
    xs, ys = rtransform(f"EPSG:{epsg}", "EPSG:4326", [B[0], B[2], B[0], B[2]], [B[1], B[1], B[3], B[3]])
    t = ftw_query((min(xs), min(ys), max(xs), max(ys)))
    import pyarrow.parquet as pq
    if t is not None: pq.write_table(t, f"{RAW}/{key}_ftw.parquet"); out["ftw_rows"] = t.num_rows
json.dump(out, open(f"{RAW}/{key}.json", "w"), indent=1); print(json.dumps(out))
