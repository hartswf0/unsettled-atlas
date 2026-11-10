"""Fetch a 20 m analysis stack for one MGRS tile from two same-season scenes
(different orbits) and composite: primary scene first, secondary fills nodata.
Records per-pixel source scene index so every circle knows which scene it was observed in."""
import sys, json, numpy as np, rasterio
from rasterio.enums import Resampling
sys.path.insert(0, __file__.rsplit("/",1)[0]); import s2
BANDS = ["blue","green","red","nir","swir16","scl"]
def fetch(scenes, out, size=5490):
    stack = None; src = None; meta = {}
    for k, sid in enumerate(scenes):
        it = s2.item(sid); arrs = []
        for b in BANDS:
            with rasterio.open(s2.href(it, b)) as ds:
                rs = Resampling.nearest if b=="scl" else Resampling.average
                a = ds.read(1, out_shape=(size,size), resampling=rs)
                if k==0 and b=="red":
                    t = ds.transform * ds.transform.scale(ds.width/size, ds.height/size)
                    meta = dict(crs=ds.crs.to_string(), transform=list(t)[:6], size=size)
            arrs.append(a)
        a = np.stack(arrs).astype(np.uint16)
        valid = (a[2] > 0)
        if stack is None:
            stack = a; src = np.where(valid, 0, 255).astype(np.uint8)
        else:
            fill = (src == 255) & valid
            stack[:, fill] = a[:, fill]; src[fill] = k
        print(sid, "valid", valid.mean().round(3), flush=True)
    meta["scenes"] = scenes; meta["bands"] = BANDS
    np.savez_compressed(out, stack=stack, src=src)
    json.dump(meta, open(out.replace(".npz",".json"),"w"), indent=1)
if __name__ == "__main__":
    fetch(sys.argv[2:], sys.argv[1])
