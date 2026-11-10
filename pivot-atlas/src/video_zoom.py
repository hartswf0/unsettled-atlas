"""Zoom from the halftone portrait into one dot, then into that farm's real neighbourhood (10 m L2A,
windowed COG read). The dot was drawn rotated; the real scene starts at that rotation and eases to north-up."""
import json, os, sys, math, subprocess, numpy as np, rasterio
from rasterio.windows import Window
from PIL import Image, ImageDraw, ImageFont
from pyproj import Transformer
sys.path.insert(0, "src"); import s2
Image.MAX_IMAGE_PIXELS = None
M = json.load(open("mosaics/astronaut_halftone.json")); big = Image.open("mosaics/astronaut_halftone.png").convert("RGB"); BW, BH = big.size
tx, ty = BW*0.44, BH*0.30
dot = min((d for d in M["dots"] if d["d"] > 30), key=lambda d: (d["x"]-tx)**2 + (d["y"]-ty)**2)
print("dot", dot["id"], dot["lat"], dot["lon"], dot["scene"], dot["d"], dot["rot"])
W = 1080; out = "video/frames_zoom"; os.makedirs(out, exist_ok=True)
for f in os.listdir(out): os.remove(f"{out}/{f}")
try: F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24); FB = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30)
except Exception: F = FB = ImageFont.load_default()
def cap(im, a, b):
    d = ImageDraw.Draw(im); d.rectangle([0, W-92, W, W], fill=(12,14,10)); d.text((32, W-82), a, font=FB, fill=(234,217,184)); d.text((32, W-40), b, font=F, fill=(170,159,131))
k = 0; N1 = 210
w0, w1 = BW, dot["d"]*1.15
for f in range(N1):
    u = f/(N1-1); e = u*u*(3-2*u); w = w0*(w1/w0)**e
    cx = BW/2 + (dot["x"]-BW/2)*min(1, e*1.25); cy = BH/2 + (dot["y"]-BH/2)*min(1, e*1.25)
    box = (cx-w/2, cy-w/2, cx+w/2, cy+w/2)
    im = big.crop(tuple(int(round(v)) for v in box)).resize((W, W), Image.LANCZOS)
    cap(im, "Every dot is a farm", f"Portrait: NASA, public domain · 5,637 real fields from Toshka & East Oweinat") if f < N1-40 else cap(im, f"{dot['lat']:.4f} N, {dot['lon']:.4f} E · {dot['radius_m']:.0f} m radius", f"{dot['scene']} · {dot['date']}")
    im.save(f"{out}/{k:05d}.png"); k += 1
# real context, 10 m
it = s2.item(dot["scene"]); hr = {b: s2.href(it, b) for b in ("red","green","blue")}
with rasterio.open(hr["red"]) as ds:
    X, Y = Transformer.from_crs("EPSG:4326", ds.crs, always_xy=True).transform(dot["lon"], dot["lat"]); col, row = ~ds.transform * (X, Y)
    half = 900; win = Window(int(col)-half, int(row)-half, 2*half, 2*half)
arr = []
for b in ("red","green","blue"):
    with rasterio.open(hr[b]) as ds: arr.append(ds.read(1, window=win, boundless=True, fill_value=0))
ctx = Image.fromarray((np.clip(np.stack(arr).astype(np.float32)/1e4/0.55, 0, 1)**0.9*255).astype(np.uint8).transpose(1,2,0))
r10 = dot["radius_m"]/10; last = Image.open(f"{out}/{k-1:05d}.png")
N2, N3 = 60, 150
for f in range(N2 + N3):
    if f < N2: u = f/(N2-1); wpx = 2*r10*1.15; rot = dot["rot"]*(1-u*u*(3-2*u))
    else: u = (f-N2)/(N3-1); e = u*u*(3-2*u); wpx = 2*r10*1.15*((2*half*0.98)/(2*r10*1.15))**e; rot = 0
    c = ctx.rotate(-rot, resample=Image.BICUBIC, center=(half, half))
    im = c.crop((int(half-wpx/2), int(half-wpx/2), int(half+wpx/2), int(half+wpx/2))).resize((W, W), Image.LANCZOS)
    if f < 20: im = Image.blend(last, im, f/19)
    km = wpx*10/1000
    cap(im, f"{dot['lat']:.4f} N, {dot['lon']:.4f} E · {km:.1f} km across", f"Sentinel-2 L2A {dot['scene']} · Contains modified Copernicus Sentinel data")
    im.save(f"{out}/{k:05d}.png"); k += 1
subprocess.run(["ffmpeg","-y","-loglevel","error","-framerate","30","-i",f"{out}/%05d.png","-c:v","libx264","-pix_fmt","yuv420p","-crf","22","-movflags","+faststart","video/zoom_into_a_dot.mp4"], check=True)
print("frames", k)
