"""Real time-lapse: Toshka (MGRS 36QUL), March 2017 -> March 2025, Sentinel-2 L2A, same fixed rendering
every year (B04/B03/B02, reflectance 0-0.55, gamma 0.9). Crossfades between real epochs only; no-data
left black. Output H.264 MP4."""
import sys, os, glob, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, "src"); from common import load
out = "video/frames_toshka"; os.makedirs(out, exist_ok=True)
for f in glob.glob(f"{out}/*.png"): os.remove(f)
files = [(y, f"data/epochs/stack_36QUL_{y}-03.npz") for y in range(2017, 2025)] + [(2025, "data/stack_36QUL_2025-03.npz")]
X0, Y0, W = 0, 1250, 4200; S = 1080
try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 64); small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
except Exception: font = small = ImageFont.load_default()
ims = []
for y, p in files:
    s, _, m = load(p); a = s[[2,1,0], Y0:Y0+W, X0:X0+W].astype(np.float32)/1e4
    im = (np.clip(a/0.55, 0, 1)**0.9*255).astype(np.uint8).transpose(1,2,0)
    ims.append((y, m["scenes"][0], np.asarray(Image.fromarray(im).resize((S,S), Image.LANCZOS)).astype(np.float32)))
    print(y, flush=True)
def label(arr, y, sid):
    im = Image.fromarray(arr.astype(np.uint8)); d = ImageDraw.Draw(im)
    d.rectangle([0, S-96, S, S], fill=(12,14,10)); d.text((36, S-86), str(y), font=font, fill=(234,217,184))
    d.text((250, S-74), "Toshka, Egypt · March · Sentinel-2 L2A", font=small, fill=(234,217,184))
    d.text((250, S-44), f"{sid} · Contains modified Copernicus Sentinel data", font=small, fill=(170,159,131))
    return im
k = 0; HOLD, FADE = 30, 15
for i, (y, sid, a) in enumerate(ims):
    for _ in range(HOLD): label(a, y, sid).save(f"{out}/{k:05d}.png"); k += 1
    if i+1 < len(ims):
        b = ims[i+1][2]
        for t in range(1, FADE+1):
            u = t/FADE; label(a*(1-u)+b*u, y if u < 0.5 else ims[i+1][0], sid if u < 0.5 else ims[i+1][1]).save(f"{out}/{k:05d}.png"); k += 1
for _ in range(30): label(ims[-1][2], ims[-1][0], ims[-1][1]).save(f"{out}/{k:05d}.png"); k += 1
subprocess.run(["ffmpeg","-y","-loglevel","error","-framerate","30","-i",f"{out}/%05d.png","-c:v","libx264","-pix_fmt","yuv420p","-crf","23","-preset","medium","-movflags","+faststart","video/toshka_2017_2025.mp4"], check=True)
print("frames", k)
