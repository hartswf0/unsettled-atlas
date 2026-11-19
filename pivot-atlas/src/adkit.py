"""Agronica ad stage, in the PAELEO grammar: a prompt is typed on screen (P), paper tags pinned to things rewrite
themselves (E), the cut-paper cast acts (O). The cast is real center-pivot fields from the glyph bank, rotated,
moved and scaled only; rims, shadows, brads, tags and type are drawn paper. Sound is synthesized from the cues."""
import json, math, os, subprocess, wave, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W = 1080; FPS = 30
FD = "/mnt/skills/examples/canvas-design/canvas-fonts"
def font(name, size): return ImageFont.truetype(f"{FD}/{name}.ttf", size)
DISP = lambda s: font("BigShoulders-Bold", s); MONO = lambda s: font("JetBrainsMono-Regular", s); MONOB = lambda s: font("JetBrainsMono-Bold", s); SERIF = lambda s: font("Lora-Italic", s)
KRAFT, PAPER, INK, TEAL, STAMP, LAMP, LABEL = (201,154,96), (251,250,247), (20,17,13), (15,143,128), (212,42,30), (242,184,90), (18,23,32)
B = json.load(open("web2/bank/bank.json")); C = {n: i for i, n in enumerate(B["cols"])}; ROWS = B["rows"]; S, PR = B["glyph_px"], B["per_row"]
_sheets, _chips = {}, {}
ease = lambda u: 0 if u <= 0 else 1 if u >= 1 else (2*u*u if u < .5 else 1 - (-2*u + 2)**2/2)
back = lambda u: 0 if u <= 0 else 1 if u >= 1 else 1 + 2.70158*(u-1)**3 + 1.70158*(u-1)**2
seg = lambda t, a, b: (t - a)/(b - a)
lerp = lambda a, b, u: a + (b - a)*u
def raw_chip(i, size):
    k = (i, size)
    if k not in _chips:
        sh, c = divmod(i, PR*PR)
        if sh not in _sheets: _sheets[sh] = Image.open(f"web2/bank/sheet_{sh}.jpg").convert("RGB")
        inner = S/1.04; off = (S - inner)/2; x, y = (c % PR)*S, (c//PR)*S
        im = _sheets[sh].crop((round(x+off), round(y+off), round(x+off+inner), round(y+off+inner))).resize((size, size), Image.LANCZOS)
        _chips[k] = im
    return _chips[k]
def disc(im, size, rot=0.0, rim=None):
    """a field as a paper cut-out: image clipped to a circle with a thin cut margin"""
    rim = max(2, size//36) if rim is None else rim
    src = im if im.size == (size, size) else im.resize((size, size), Image.LANCZOS)
    if rot: src = src.rotate(-rot, resample=Image.BICUBIC)
    out = Image.new("RGBA", (size + 2*rim, size + 2*rim), (0, 0, 0, 0)); d = ImageDraw.Draw(out)
    d.ellipse([0, 0, size + 2*rim - 1, size + 2*rim - 1], fill=PAPER + (255,))
    m = Image.new("L", (size*2, size*2), 0); ImageDraw.Draw(m).ellipse([2, 2, size*2 - 3, size*2 - 3], fill=255); m = m.resize((size, size), Image.LANCZOS)
    out.paste(src, (rim, rim), m); return out
class Stage:
    def __init__(self, seed=1, tone=KRAFT):
        rng = np.random.default_rng(seed); n = rng.normal(0, 5.5, (W, W, 1)); fib = rng.normal(0, 3.0, (W//4, W, 1)).repeat(4, 0)
        yy, xx = np.mgrid[0:W, 0:W]; vig = 1 - 0.16*(((xx - W/2)**2 + (yy - W/2)**2)/(W/2)**2)[..., None]
        self.bg = Image.fromarray(np.clip((np.array(tone)[None, None] + n + fib)*vig, 0, 255).astype(np.uint8)).convert("RGBA"); self.cues = []
    def frame(self): return self.bg.copy()
    def shadow(self, cv, x, y, size, lift=1.0, alpha=110):
        r = size/2; off = 5 + 9*lift; blur = 5 + 7*lift
        box = Image.new("RGBA", (int(size + 6*blur), int(size + 6*blur)), (0, 0, 0, 0)); d = ImageDraw.Draw(box); c = box.size[0]/2
        d.ellipse([c - r, c - r, c + r, c + r], fill=(30, 18, 6, int(alpha))); box = box.filter(ImageFilter.GaussianBlur(blur))
        cv.alpha_composite(box, (int(x - c + off*0.6), int(y - c + off)))
    def field(self, cv, i, x, y, size, rot=0.0, lift=0.3, brad=True, alpha=1.0, im=None):
        size = int(max(4, size)); self.shadow(cv, x, y, size, lift, 110*alpha)
        d = disc(raw_chip(i, size) if im is None else im, size, rot)
        if alpha < 1: d.putalpha(d.getchannel("A").point(lambda v: int(v*alpha)))
        cv.alpha_composite(d, (int(x - d.size[0]/2), int(y - d.size[1]/2)))
        if brad and size > 40:
            dr = ImageDraw.Draw(cv); b = max(3, size//28); dr.ellipse([x - b, y - b, x + b, y + b], fill=(176, 132, 52, int(255*alpha)), outline=(92, 66, 20, int(255*alpha)))
            dr.ellipse([x - b*0.45, y - b*0.6, x + b*0.1, y - b*0.05], fill=(245, 222, 160, int(230*alpha)))
    def hole(self, cv, x, y, size, col=INK):
        d = ImageDraw.Draw(cv); r = size/2; n = 44
        for k in range(0, n, 2): d.arc([x - r, y - r, x + r, y + r], 360*k/n, 360*(k + 1)/n, fill=col + (150,), width=3)
    def tag(self, cv, x, y, text, tx=None, ty=None, col=STAMP, size=24, alpha=1.0, tilt=0):
        f = MONOB(size); tw = int(f.getlength(text)) + 26; th = size + 20
        slip = Image.new("RGBA", (tw + 12, th + 12), (0, 0, 0, 0)); d = ImageDraw.Draw(slip)
        d.rectangle([6, 8, tw + 6, th + 8], fill=(30, 18, 6, 70)); slip = slip.filter(ImageFilter.GaussianBlur(3)); d = ImageDraw.Draw(slip)
        d.rectangle([2, 2, tw + 2, th + 2], fill=PAPER + (255,), outline=INK + (255,), width=2); d.text((15, 10), text, font=f, fill=INK + (255,))
        d.ellipse([tw - 8, -2 + 4, tw + 6, 12 + 4], fill=col + (255,), outline=INK + (255,))
        if tilt: slip = slip.rotate(tilt, resample=Image.BICUBIC, expand=True)
        if alpha < 1: slip.putalpha(slip.getchannel("A").point(lambda v: int(v*alpha)))
        if tx is not None:
            ImageDraw.Draw(cv).line([(x, y), (tx, ty)], fill=INK + (int(200*alpha),), width=2)
        cv.alpha_composite(slip, (int(x - slip.size[0]/2), int(y - slip.size[1]/2)))
    def rewrite(self, t, t0, old, new, cps=22, tag="e"):
        """old text is erased right-to-left, then the new text is typed; returns the visible string and logs key cues"""
        u = t - t0
        if u < 0: return old
        ne = min(len(old), int(u*cps*1.6))
        if ne < len(old): self._key(t0, ne, 1/(cps*1.6), tag); return old[:len(old) - ne]
        t1 = t0 + len(old)/(cps*1.6) + 0.12; nt = max(0, min(len(new), int((t - t1)*cps))); self._key(t1, nt, 1/cps, tag); return new[:nt]
    def typed(self, t, t0, text, cps=15):
        n = max(0, min(len(text), int((t - t0)*cps))); self._key(t0, n, 1/cps, "p"); return text[:n]
    def _key(self, t0, n, dt, kind):
        for k in range(n): self.cues.append((round(t0 + k*dt, 3), "key" if kind == "p" else "tick"))
    def cue(self, t, kind): self.cues.append((round(t, 3), kind))
    def prompt(self, cv, text, t, phase):
        d = ImageDraw.Draw(cv); y0 = W - 142; d.rectangle([0, y0, W, W - 62], fill=LABEL + (255,))
        cur = "▌" if int(t*2.5) % 2 == 0 else " "; d.text((40, y0 + 22), "> " + text + cur, font=MONO(32), fill=PAPER + (255,))
        for k, (p, col) in enumerate((("P", LAMP), ("E", TEAL), ("O", STAMP))):
            on = "PEO".index(phase) >= k if phase else False; x = W - 190 + k*52
            d.rectangle([x, y0 + 20, x + 42, y0 + 62], fill=(col if on else (50, 56, 66)) + (255,)); d.text((x + 11, y0 + 20), p, font=DISP(38), fill=(LABEL if on else (120, 126, 136)) + (255,))
    def brand(self, cv, app, alpha=1.0):
        d = ImageDraw.Draw(cv); a = int(255*alpha); d.text((40, 30), "AGRONICA", font=DISP(54), fill=INK + (a,)); d.text((42, 92), app, font=MONOB(22), fill=INK + (a,))
    def fine(self, cv, text, alpha=1.0):
        d = ImageDraw.Draw(cv); d.rectangle([0, W - 62, W, W], fill=PAPER + (255,)); f = MONO(17); words = text.split(); lines = [""]
        for w_ in words:
            if f.getlength(lines[-1] + " " + w_) > W - 80: lines.append(w_)
            else: lines[-1] = (lines[-1] + " " + w_).strip()
        for n, ln in enumerate(lines[:2]): d.text((40, W - (54 if len(lines) > 1 else 44) + n*24), ln, font=f, fill=INK + (int(255*alpha),))
    def tagline(self, cv, lines, u, col=INK, y=None, size=120):
        if u <= 0: return
        d = ImageDraw.Draw(cv); f = DISP(size); y = y if y is not None else W/2 - len(lines)*size*0.5
        for k, ln in enumerate(lines):
            uu = ease(min(1, max(0, u*1.6 - k*0.25))); w = f.getlength(ln); x = (W - w)/2; yy = y + k*size*0.98 + (1 - uu)*40
            d.rectangle([x - 22, yy + 8, x + w + 22, yy + size*1.02], fill=PAPER + (int(238*uu),)); d.text((x, yy), ln, font=f, fill=col + (int(255*uu),))
    def stamp(self, cv, text, x, y, u, size=84, rot=-9):
        if u <= 0: return
        f = DISP(size); w = int(f.getlength(text)); im = Image.new("RGBA", (w + 60, size + 50), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rectangle([6, 6, w + 54, size + 44], outline=STAMP + (235,), width=8); d.text((30, 14), text, font=f, fill=STAMP + (235,))
        sc = lerp(2.2, 1.0, back(min(1, u*3))); im = im.resize((int(im.size[0]*sc), int(im.size[1]*sc)), Image.LANCZOS).rotate(rot, resample=Image.BICUBIC, expand=True)
        im.putalpha(im.getchannel("A").point(lambda v: int(v*min(1, u*4)))); cv.alpha_composite(im, (int(x - im.size[0]/2), int(y - im.size[1]/2)))
def audio(cues, dur, path, seed=3):
    sr = 44100; n = int(dur*sr); a = np.zeros(n, np.float32); rng = np.random.default_rng(seed); seen = set()
    def add(t, s):
        i = int(t*sr)
        if i < n: e = min(n, i + len(s)); a[i:e] += s[:e - i]
    tt = lambda d: np.arange(int(d*sr))/sr
    for t, kind in sorted(set(cues)):
        if (t, kind) in seen: continue
        seen.add((t, kind))
        if kind == "key": x = tt(0.045); add(t, (rng.normal(0, 1, len(x))*np.exp(-x*95)*0.22 + np.sin(2*np.pi*(1700 + rng.uniform(-200, 200))*x)*np.exp(-x*140)*0.10).astype(np.float32))
        elif kind == "tick": x = tt(0.03); add(t, (rng.normal(0, 1, len(x))*np.exp(-x*160)*0.10).astype(np.float32))
        elif kind == "pin": x = tt(0.22); add(t, (np.sin(2*np.pi*150*x)*np.exp(-x*22)*0.5 + rng.normal(0, 1, len(x))*np.exp(-x*70)*0.12).astype(np.float32))
        elif kind == "slam": x = tt(0.5); add(t, (np.sin(2*np.pi*(70 + 60*np.exp(-x*18))*x)*np.exp(-x*9)*0.8 + rng.normal(0, 1, len(x))*np.exp(-x*40)*0.3).astype(np.float32))
        elif kind == "whoosh":
            x = tt(0.7); w = rng.normal(0, 1, len(x)); w = np.convolve(w, np.ones(40)/40, "same"); add(t, (w*np.sin(np.pi*x/0.7)**2*0.9).astype(np.float32))
        elif kind == "chime":
            x = tt(1.6); add(t, sum(np.sin(2*np.pi*f*x)*np.exp(-x*(2.2 + k))*0.16 for k, f in enumerate((523.25, 659.25, 783.99, 1046.5))).astype(np.float32))
    x = np.arange(n)/sr; pad = sum(np.sin(2*np.pi*f*x + p)*0.035 for f, p in ((130.81, 0), (196.0, 1), (261.63, 2), (329.63, .5)))
    env = np.clip(x/1.5, 0, 1)*np.clip((dur - x)/1.5, 0, 1); a += (pad*env).astype(np.float32); a = np.tanh(a*1.2)*0.85
    with wave.open(path, "w") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((a*32767).astype(np.int16).tobytes())
def render(name, dur, draw, seed=1, tone=KRAFT):
    st = Stage(seed, tone); d = f"ads/out/frames_{name}"; os.makedirs(d, exist_ok=True)
    for f in os.listdir(d): os.remove(f"{d}/{f}")
    for k in range(int(dur*FPS)):
        cv = st.frame(); draw(st, cv, k/FPS); cv.convert("RGB").save(f"{d}/{k:05d}.png", compress_level=1)
    audio(st.cues, dur, f"ads/out/{name}.wav", seed)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", f"{d}/%05d.png", "-i", f"ads/out/{name}.wav", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-crf", "21", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", f"ads/{name}.mp4"], check=True)
    print(name, "done", flush=True)
