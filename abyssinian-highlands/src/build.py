"""Build the web pack: imagery, field-outline overlays, measured per-site statistics, relief transects."""
import sys, os, json, numpy as np, shapely
sys.path.insert(0, os.path.dirname(__file__)); from common import *; from render import *
W = os.path.join(ROOT, "web"); out = []
for key, name, lat, lon, src in SITES:
    meta = json.load(open(f"{RAW}/{key}.json")); dem = np.load(f"{RAW}/{key}_dem.npy")
    for s in ("after_rains", "dry"): Image.fromarray(rgb(key, s)).save(f"{W}/img/{key}_{s}.jpg", quality=84)
    Image.fromarray(rgb(key, "after_rains")).resize((240, 240), Image.LANCZOS).save(f"{W}/img/{key}_t.jpg", quality=80)
    gy, gx = np.gradient(dem, 10.0); slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    # transect with the largest elevation range (a row or a column of the window), sampled every 100 m
    rr = dem.max(1) - dem.min(1); cr = dem.max(0) - dem.min(0)
    if rr.max() >= cr.max(): i = int(rr.argmax()); prof = dem[i, ::10]; tx = ("W-E", i)
    else: i = int(cr.argmax()); prof = dem[::10, i]; tx = ("N-S", i)
    # biggest drop within 1 km horizontally along that transect
    drop = max(abs(float(prof[a] - prof[b])) for a in range(len(prof)) for b in range(a, min(a + 11, len(prof))))
    r = dict(key=key, name=name, lat=lat, lon=lon, coord=src, scenes=meta["scenes"],
             elev=[round(float(np.nanmin(dem))), round(float(np.nanmedian(dem))), round(float(np.nanmax(dem)))],
             slope_med=round(float(np.nanmedian(slope)), 1), transect=dict(dir=tx[0], idx=tx[1], z=[round(float(v)) for v in prof], drop1km=round(drop)))
    if key != "yosemite":
        g, a, p = fields(key, 2025); g24, a24, _ = fields(key, 2024)
        outline(g, 2, (255, 236, 64, 235)).save(f"{W}/img/{key}_fields.png", optimize=True)
        mr = shapely.minimum_rotated_rectangle(g); c = shapely.get_coordinates(shapely.get_exterior_ring(mr)).reshape(-1, 5, 2)
        e1 = np.hypot(*(c[:, 1] - c[:, 0]).T); e2 = np.hypot(*(c[:, 2] - c[:, 1]).T)
        elong = np.maximum(e1, e2) / np.maximum(np.minimum(e1, e2), 1.0)
        cen = shapely.centroid(g); ix = np.clip(shapely.get_x(cen).astype(int), 0, PX-1); iy = np.clip(shapely.get_y(cen).astype(int), 0, PX-1)
        ha = a / 1e4; big = ha >= 0.1
        r["fields"] = dict(n=int(len(g)), n2024=int(len(g24)), median_ha=round(float(np.median(ha)), 3), p90_ha=round(float(np.percentile(ha, 90)), 2),
            max_ha=round(float(ha.max()), 1), share_under_tenth_ha=round(float((ha < 0.1).mean()), 3), cover=round(float(a.sum() / (KM*1000)**2), 3),
            elong_med=round(float(np.median(elong[big])), 2) if big.any() else None, share_long=round(float((elong[big] >= 3).mean()), 3) if big.any() else None,
            slope_at_fields=round(float(np.median(slope[iy, ix])), 1), elev_at_fields=round(float(np.median(dem[iy, ix]))),
            hist=[int(v) for v in np.histogram(np.log10(ha), bins=np.linspace(-2, 1.5, 15))[0]])
    out.append(r); print(key, r["elev"], r["transect"]["drop1km"], r.get("fields", {}))
json.dump(dict(km=KM, sites=out), open(f"{W}/sites.json", "w"), separators=(",", ":"))
