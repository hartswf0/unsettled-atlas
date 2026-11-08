"""Sentinel-2 L2A COG access (AWS open data, sentinel-cogs bucket). No STAC API needed:
scene items are addressed directly by MGRS tile + date path."""
import os, json, urllib.request
os.environ.setdefault("CURL_CA_BUNDLE", "/root/.ccr/ca-bundle.crt")
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("GDAL_HTTP_MULTIRANGE", "YES")
os.environ.setdefault("GDAL_HTTP_MERGE_CONSECUTIVE_RANGES", "YES")
import ssl
BUCKET = "https://sentinel-cogs.s3.us-west-2.amazonaws.com"
_ctx = ssl.create_default_context(cafile=os.environ["CURL_CA_BUNDLE"])

def item(scene_id):
    # scene_id like S2B_36QUL_20250305_0_L2A
    tile = scene_id.split("_")[1]; d = scene_id.split("_")[2]
    path = f"sentinel-s2-l2a-cogs/{tile[:2]}/{tile[2]}/{tile[3:]}/{d[:4]}/{int(d[4:6])}/{scene_id}/{scene_id}.json"
    with urllib.request.urlopen(f"{BUCKET}/{path}", context=_ctx) as r:
        return json.load(r)

def href(it, band):
    h = it["assets"][band]["href"]
    return "/vsicurl/" + h.replace("s3://sentinel-cogs/", BUCKET + "/")
