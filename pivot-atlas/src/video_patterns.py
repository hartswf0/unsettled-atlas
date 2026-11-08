"""Pattern videos from real glyph-bank fields (rotation, scale and placement only; field pixels untouched).
spinner: loading wheel; the fading tail is real fields of decreasing planted darkness, not opacity.
clock  : 12 hours in 12 s; hands are chains of fields; hour markers are the largest wheel-track fields.
spiral : golden-angle phyllotaxis of 1,500 fields sorted by lightness, slowly turning."""
import json, os, sys, math, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont
B = json.load(open("web2/bank/bank.json")); C = {n:i for i,n in enumerate(B["cols"])}; S, PR = B["glyph_px"], B["per_row"]
rows = B["rows"]; sheets = {}
def chip(i, size):
    k, c = divmod(i, PR*PR)
    if k not in sheets: sheets[k] = Image.open(f"web2/bank/sheet_{k}.jpg").convert("RGB")
    inner = S/1.04; off = (S-inner)/2; x, y = (c % PR)*S, (c//PR)*S
    im = sheets[k].crop((round(x+off), round(y+off), round(x+off+inner), round(y+off+inner))).resize((size*2, size*2), Image.LANCZOS)
    m = Image.new("L", (size*2, size*2), 0); ImageDraw.Draw(m).ellipse([2, 2, size*2-3, size*2-3], fill=255)
    im.putalpha(m); return im
def put(canvas, im, x, y, size, rot_deg):
    g = im.rotate(-rot_deg, resample=Image.BICUBIC).resize((size, size), Image.LANCZOS)
    canvas.alpha_composite(g, (int(round(x-size/2)), int(round(y-size/2))))
W = 1080; BG = (11, 13, 10, 255)
try: F = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
except Exception: F = ImageFont.load_default()
def caption(cv, txt):
    d = ImageDraw.Draw(cv); d.text((32, W-44), txt, font=F, fill=(170,159,131,255))
def encode(d, name):
    subprocess.run(["ffmpeg","-y","-loglevel","error","-framerate","30","-i",f"{d}/%05d.png","-c:v","libx264","-pix_fmt","yuv420p","-crf","22","-movflags","+faststart",f"video/{name}.mp4"], check=True)
def frames_dir(n):
    d = f"video/frames_{n}"; os.makedirs(d, exist_ok=True)
    for f in os.listdir(d): os.remove(f"{d}/{f}")
    return d
ang = lambda i: rows[i][C["dark_angle_deg"]]; strg = lambda i: rows[i][C["dark_strength"]]; Lv = lambda i: rows[i][C["L"]]
which = sys.argv[1:] or ["spinner", "clock", "spiral"]
if "spinner" in which:
    d = frames_dir("spinner"); N = 12; R = 330; sz = 168
    # head = fully planted dark discs; the tail runs through half-planted wedges to bare sand discs
    allf = sorted(range(len(rows)), key=Lv); n = len(allf)
    levels = [np.array(allf[int(n*q):int(n*q)+400]) for q in np.linspace(0.0, 0.985, N)]
    cache = {}
    for f in range(240):
        step = f // 3; cyc = step // N
        cv = Image.new("RGBA", (W, W), BG)
        for k in range(N):                                # slot k positions; head = step % N
            behind = (step - k) % N; lvl = levels[behind]; i = int(lvl[(cyc*5 + k*3) % len(lvl)])
            a = 2*math.pi*k/N - math.pi/2; x, y = W/2 + R*math.cos(a), W/2 + R*math.sin(a)
            tangent = math.degrees(a) + 90                # planted (dark) side faces direction of travel
            if (i, sz) not in cache: cache[(i, sz)] = chip(i, sz)
            put(cv, cache[(i, sz)], x, y, sz, tangent - ang(i))
        caption(cv, "Loading wheel of 12 real center-pivot fields · tail = progressively bare fields · Sentinel-2 L2A")
        cv.convert("RGB").save(f"{d}/{f:05d}.png")
    encode(d, "spinner"); print("spinner done", flush=True)
if "clock" in which:
    d = frames_dir("clock"); cache = {}
    rings = sorted(range(len(rows)), key=lambda i: -rows[i][C["tex"]])
    big = [i for i in rings if rows[i][C["radius_m"]] > 380][:12]
    smallpool = sorted(range(len(rows)), key=lambda i: -Lv(i))[:600]      # pale bare fields read on the dark face
    centre = rings[0]
    for f in range(360):
        hours = 10 + 12*f/360; hA = (hours % 12)/12*2*math.pi - math.pi/2; mA = (hours % 1)*2*math.pi - math.pi/2
        cv = Image.new("RGBA", (W, W), BG)
        for k, i in enumerate(big):
            a = 2*math.pi*k/12 - math.pi/2; x, y = W/2 + 420*math.cos(a), W/2 + 420*math.sin(a)
            if (i,120) not in cache: cache[(i,120)] = chip(i, 120)
            put(cv, cache[(i,120)], x, y, 120, f*1.5 + k*30)          # each marker turns slowly, like a pivot arm
        for (A, n, sz, off) in ((hA, 4, 74, 0), (mA, 7, 52, 40)):
            for j in range(n):
                r = 90 + j*(sz*0.95); i = smallpool[(off + j*13) % len(smallpool)]
                if (i,sz) not in cache: cache[(i,sz)] = chip(i, sz)
                put(cv, cache[(i,sz)], W/2 + r*math.cos(A), W/2 + r*math.sin(A), sz, math.degrees(A) - ang(i))
        if (centre,150) not in cache: cache[(centre,150)] = chip(centre, 150)
        put(cv, cache[(centre,150)], W/2, W/2, 150, -f*2)
        hh = int(hours) % 12 or 12; mm = int((hours % 1)*60)
        caption(cv, f"Pivot clock · {hh}:{mm:02d} · 12 hours in 12 seconds · every disc is a real farm (Sentinel-2 L2A)")
        cv.convert("RGB").save(f"{d}/{f:05d}.png")
    encode(d, "clock"); print("clock done", flush=True)
if "spiral" in which:
    d = frames_dir("spiral"); n = 1500; rng = np.random.default_rng(3)
    pick = rng.choice(len(rows), n, replace=False); pick = sorted(pick, key=lambda i: -Lv(i))     # light centre -> dark rim
    GA = math.pi*(3 - math.sqrt(5)); cache = {}
    for f in range(300):
        cv = Image.new("RGBA", (W, W), BG); turn = f*0.004
        for k, i in enumerate(pick):
            r = 13.0*math.sqrt(k+1); a = k*GA + turn; sz = int(14 + 10*min(1, k/n*1.5))
            if r > W/2 - 20: continue
            if (i, sz) not in cache: cache[(i, sz)] = chip(int(i), sz)
            put(cv, cache[(i, sz)], W/2 + r*math.cos(a), W/2 + r*math.sin(a), sz, math.degrees(a) - ang(i) + f*2)
        caption(cv, "1,500 real fields in a golden-angle spiral, lightest at the centre · each disc turns like its pivot arm")
        cv.convert("RGB").save(f"{d}/{f:05d}.png")
    encode(d, "spiral"); print("spiral done", flush=True)
