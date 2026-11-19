"""Abyssinian Highlands atlas: sites, open-data readers (Sentinel-2 COGs, Copernicus DEM, FTW field polygons)."""
import os, re, json, sys, urllib.request, ssl, math
os.environ.setdefault("CURL_CA_BUNDLE", "/root/.ccr/ca-bundle.crt")
os.environ.setdefault("SSL_CERT_FILE", "/root/.ccr/ca-bundle.crt")
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("GDAL_HTTP_MULTIRANGE", "YES")
os.environ.setdefault("GDAL_HTTP_MERGE_CONSECUTIVE_RANGES", "YES")
import numpy as np, mgrs, rasterio
from rasterio.windows import from_bounds
from rasterio.warp import reproject, Resampling, transform as rtransform
from rasterio.transform import from_origin

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
S2B = "https://sentinel-cogs.s3.us-west-2.amazonaws.com"
DEMB = "https://copernicus-dem-30m.s3.amazonaws.com"
FTWB = "https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/tge-labs/ftw-global-data"
CTX = ssl.create_default_context(cafile=os.environ["CURL_CA_BUNDLE"])
KM = 12.0; PX = 1200  # 12 km window at 10 m

# key, name, lat, lon, zone note (the user's coordinates where given; others are stated as chosen here)
SITES = [
 ("simien",  "Simien escarpment · Imet Gogo", 13.2167, 38.0833, "given"),
 ("gheralta","Gheralta massif",               13.8950, 39.3300, "moved"),
 ("gorge",   "Blue Nile (Abay) Gorge",        10.0750, 38.1917, "given"),
 ("fogera",  "Lake Tana shore · Fogera plain",11.9500, 37.7000, "chosen"),
 ("gerd",    "GERD dam and reservoir",        11.2153, 35.0931, "given"),
 ("pawe",    "Metekel lowland · Pawe",        11.3100, 36.4100, "chosen"),
 ("adaa",    "Ada'a plain · Bishoftu",         8.7500, 39.0650, "chosen"),
 ("yosemite","Yosemite Valley (reference)",   37.7400,-119.5900, "reference"),
]

def utm_epsg(lat, lon):
    z = int((lon + 180) // 6) + 1
    return (32600 if lat >= 0 else 32700) + z

def window(lat, lon, km=KM):
    epsg = utm_epsg(lat, lon)
    xs, ys = rtransform("EPSG:4326", f"EPSG:{epsg}", [lon], [lat])
    x0 = round((xs[0] - km*500) / 10) * 10; y1 = round((ys[0] + km*500) / 10) * 10
    return epsg, (x0, y1 - km*1000, x0 + km*1000, y1)

def get(url):
    with urllib.request.urlopen(url, context=CTX) as r: return r.read()

def s2_item(sid):
    tile, d = sid.split("_")[1], sid.split("_")[2]
    return json.loads(get(f"{S2B}/sentinel-s2-l2a-cogs/{tile[:2]}/{tile[2]}/{tile[3:]}/{d[:4]}/{int(d[4:6])}/{sid}/{sid}.json"))

def s2_href(it, band):
    return "/vsicurl/" + it["assets"][band]["href"].replace("s3://sentinel-cogs/", S2B + "/")

def s2_candidates(lat, lon, ym, km=KM):
    """All open L2A scenes over (year, month) pairs for every MGRS tile touching the window, sorted by cloud cover."""
    d = km / 2 / 111.0; M = mgrs.MGRS(); out = []
    tiles = {M.toMGRS(lat + a*d, lon + b*d / math.cos(math.radians(lat)), MGRSPrecision=0) for a in (-1, 0, 1) for b in (-1, 0, 1)}
    for tile, (y, mo) in [(t, p) for t in sorted(tiles) for p in ym]:
        t = f"{tile[:2]}/{tile[2]}/{tile[3:]}"
        xml = get(f"{S2B}/?list-type=2&prefix=sentinel-s2-l2a-cogs/{t}/{y}/{mo}/&delimiter=/").decode()
        for sid in [p.rstrip('/').split('/')[-1] for p in re.findall(r"<Prefix>([^<]*L2A/)</Prefix>", xml)]:
            try: it = s2_item(sid)
            except Exception: continue
            if "sentinel-cogs" not in it["assets"]["red"]["href"]: continue
            out.append((it["properties"].get("eo:cloud_cover", 100), sid, it))
    return sorted(out, key=lambda r: r[0])

def s2_read(it, bands, bounds, epsg):
    arrs = []
    for b in bands:
        with rasterio.open(s2_href(it, b)) as ds:
            if ds.crs.to_epsg() != epsg: return None
            a = ds.read(1, window=from_bounds(*bounds, ds.transform), boundless=True, fill_value=0,
                        out_shape=(PX, PX), resampling=Resampling.bilinear if b != "scl" else Resampling.nearest)
        arrs.append(a)
    return np.stack(arrs)

def dem_read(bounds, epsg, px=PX):
    """Copernicus GLO-30 DEM warped onto the window grid (bilinear)."""
    x0, y0, x1, y1 = bounds
    lons, lats = rtransform(f"EPSG:{epsg}", "EPSG:4326", [x0, x1, x0, x1], [y0, y0, y1, y1])
    dst = np.full((px, px), np.nan, "float32"); T = from_origin(x0, y1, (x1-x0)/px, (y1-y0)/px)
    for la in range(math.floor(min(lats)), math.floor(max(lats)) + 1):
        for lo in range(math.floor(min(lons)), math.floor(max(lons)) + 1):
            ns = f"N{la:02d}" if la >= 0 else f"S{-la:02d}"; ew = f"E{lo:03d}" if lo >= 0 else f"W{-lo:03d}"
            n = f"Copernicus_DSM_COG_10_{ns}_00_{ew}_00_DEM"
            try:
                with rasterio.open(f"/vsicurl/{DEMB}/{n}/{n}.tif") as ds:
                    tmp = np.full((px, px), np.nan, "float32")
                    reproject(rasterio.band(ds, 1), tmp, dst_transform=T, dst_crs=f"EPSG:{epsg}",
                              resampling=Resampling.bilinear, dst_nodata=np.nan)
                    dst = np.where(np.isnan(dst), tmp, dst)
            except Exception as e: print("dem miss", n, e, file=sys.stderr)
    return dst

def ftw_query(lonlat_box, regions=("AM", "TI", "BE", "OR")):
    """FTW global field polygons intersecting a lon/lat box, via parquet row-group bbox statistics."""
    import fsspec, pyarrow.parquet as pq, pyarrow as pa, pyarrow.compute as pc
    w, s, e, n = lonlat_box; fs = fsspec.filesystem("https", client_kwargs={"trust_env": True}); tabs = []
    for r in regions:
        U = f"{FTWB}/predictions/vectors/alpha/results-by-admin-conf/admin:country_code=ET/ET_{r}.parquet"
        pf = pq.ParquetFile(fs.open(U, block_size=8*2**20, cache_type="readahead")); md = pf.metadata
        names = [md.schema.column(i).path for i in range(md.num_columns)]; ix = {k: names.index(k) for k in ("bbox.xmin","bbox.ymin","bbox.xmax","bbox.ymax")}
        gs = []
        for g in range(md.num_row_groups):
            rg = md.row_group(g); st = {k: rg.column(i).statistics for k, i in ix.items()}
            if st["bbox.xmin"].min > e or st["bbox.xmax"].max < w or st["bbox.ymin"].min > n or st["bbox.ymax"].max < s: continue
            gs.append(g)
        for g in gs:
            t = pf.read_row_group(g); b = t["bbox"].combine_chunks()
            m = pc.and_(pc.and_(pc.less(b.field("xmin"), e), pc.greater(b.field("xmax"), w)),
                        pc.and_(pc.less(b.field("ymin"), n), pc.greater(b.field("ymax"), s)))
            t = t.filter(m)
            if t.num_rows: tabs.append(t)
        print(f"  ftw {r}: {len(gs)} row groups", file=sys.stderr)
    return pa.concat_tables(tabs) if tabs else None
