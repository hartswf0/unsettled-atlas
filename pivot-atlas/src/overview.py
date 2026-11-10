import sys, numpy as np, rasterio
from rasterio.enums import Resampling
from PIL import Image
sys.path.insert(0, __file__.rsplit("/",1)[0]); import s2
for sid in sys.argv[1:]:
    it = s2.item(sid); print(sid, it["properties"].get("eo:cloud_cover"), it["bbox"])
    with rasterio.open(s2.href(it, "visual")) as ds:
        a = ds.read(out_shape=(3, 1098, 1098), resampling=Resampling.average)
    Image.fromarray(np.moveaxis(a,0,-1)).save(f"out/overview_{sid}.jpg", quality=85)
