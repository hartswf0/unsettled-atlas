import json, numpy as np
from PIL import Image
def load(path):
    z = np.load(path); meta = json.load(open(path.replace(".npz",".json")))
    return z["stack"], z["src"], meta
def rgb(stack, gain=None):
    a = stack[[2,1,0]].astype(np.float32)
    v = a[:, a[0] > 0]
    hi = np.percentile(v, 99.5) if gain is None else gain
    return np.clip(a / hi * 255, 0, 255).astype(np.uint8).transpose(1,2,0)
def px2map(meta, x, y):
    t = meta["transform"]; return t[0]*x + t[1]*y + t[2], t[3]*x + t[4]*y + t[5]
