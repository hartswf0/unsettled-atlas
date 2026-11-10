"""Six Agronica spots (design fiction) performed by real fields. Each: brand -> P (typed prompt) -> E (tags rewrite)
-> O (the fields act) -> tagline -> fine print stating what the data actually says."""
import sys, json, math, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, "src"); from adkit import *
rng = np.random.default_rng(48)
EG = [i for i, r in enumerate(ROWS) if "Egypt" in r[C["biome"]]]
L = lambda i: ROWS[i][C["L"]]; RAD = lambda i: ROWS[i][C["radius_m"]]; STR = lambda i: ROWS[i][C["dark_strength"]]; ANG = lambda i: ROWS[i][C["dark_angle_deg"]]; CLS = lambda i: ROWS[i][C["cls"]]
FULL = [i for i in EG if CLS(i) == "active" and STR(i) < 0.035 and 380 < RAD(i) < 430]
HALF = [i for i in EG if STR(i) > 0.16 and 380 < RAD(i) < 430]
BARE = [i for i in EG if CLS(i) == "fallow" and STR(i) < 0.05 and 380 < RAD(i) < 430 and L(i) > 45]
pick = lambda pool, n: [int(x) for x in rng.choice(pool, n, replace=False)]
INV = json.load(open("works/pack/inventory.json")); DUR = 16.0
def peo(t): return "" if t < 2 else "P" if t < 5.4 else "E" if t < 8.6 else "O"
def closing(st, cv, t, lines, fine, size=120, y=None):
    st.tagline(cv, lines, seg(t, 12.4, 13.6), size=size, y=y)
    if t > 12.4 and t < 12.45: st.cue(12.4, "chime")
    if t > 13.0: st.fine(cv, fine, min(1, seg(t, 13.0, 13.6)))

# ---------- 1 · FarmOS: every field, managed
def ad_farmos():
    cast = pick(FULL, 40) + pick(HALF, 5) + pick(BARE, 4); order = rng.permutation(49); cast = [cast[k] for k in order]; odd = [k for k in range(49) if cast[k] not in FULL][:3]
    start = [(rng.uniform(120, 960), rng.uniform(190, 860), rng.uniform(0, 360)) for _ in range(49)]
    grid = [(180 + (k % 7)*120, 215 + (k//7)*104) for k in range(49)]; PROMPT = "make every field the same"
    def draw(st, cv, t):
        st.brand(cv, "FarmOS"); u = ease(seg(t, 8.8, 11.2))
        if 8.8 < t < 8.85: st.cue(8.8, "whoosh")
        for k, i in enumerate(cast):
            sx, sy, sr = start[k]; gx, gy = grid[k]; x, y = lerp(sx, gx, u), lerp(sy, gy, u); rot = lerp(sr, 0 - ANG(i) if STR(i) > .1 else 0, u); lift = 0.3
            if k in odd:
                v = ease(seg(t, 10.4, 12.0)); y -= v*40; x += v*(1300 - gx) if k % 2 else -v*(gx + 300); lift = 0.3 + 1.6*min(1, v*3)
                if v > 0: st.hole(cv, gx, gy, 96)
            st.field(cv, i, x, y, 96, rot, lift)
        for n, k in enumerate(odd):
            if t > 5.6 + n*0.5:
                sx, sy, _ = start[k]; gx, gy = grid[k]; x, y = lerp(sx, gx, u), lerp(sy, gy, u)
                if t < 10.4:
                    if abs(t - (5.6 + n*0.5)) < 0.02: st.cue(5.6 + n*0.5, "pin")
                    st.tag(cv, x + 70, y - 74, st.rewrite(t, 6.4 + n*0.45, "FIELD", "NON-STANDARD"), x + 20, y - 26)
        st.prompt(cv, st.typed(t, 2.2, PROMPT), t, peo(t)); closing(st, cv, t, ["EVERY FIELD,", "MANAGED."], "3 of 49 real fields removed for being bare or half-planted. Agronica is fiction; the fields are not.")
    render("agronica_01_farmos", DUR, draw, 1)

# ---------- 2 · YieldMatch: find your other half
def ad_yieldmatch():
    hero, mate = pick(HALF, 2); rejects = pick(BARE, 3); PROMPT = "match by yield"
    FJ = json.load(open("web/fields.json")); fc = {n: i for i, n in enumerate(FJ["cols"])}; pf = {r[fc["id"]]: r[fc["planted_frac"]] for r in FJ["rows"]}
    PCT = f"{round(100*pf[ROWS[hero][C['id']]])}% PLANTED"
    def draw(st, cv, t):
        st.brand(cv, "YieldMatch"); cx, cy = 400, 520
        for n, i in enumerate(rejects):
            a = 6.2 + n*0.9; v = ease(seg(t, a, a + 0.8)); w = ease(seg(t, a + 1.0, a + 1.7))
            if v > 0 and w < 1:
                x = lerp(1250, 760, v) - w*1400; y = cy + n*8; st.field(cv, i, x, y, 300, -18*w, 0.6 + w)
                if abs(t - (a + 0.9)) < 0.02: st.cue(a + 0.9, "slam")
                st.stamp(cv, "LOW-YIELD", x, y, seg(t, a + 0.85, a + 1.2), 64)
        v = ease(seg(t, 9.2, 10.4)); j = ease(seg(t, 10.6, 12.0))
        if 9.2 < t < 9.25: st.cue(9.2, "whoosh")
        hx = lerp(cx, 385, j); st.field(cv, hero, hx, cy, 320, lerp(0, 0 - ANG(hero), j), 0.5)
        if v > 0: st.field(cv, mate, lerp(1300, 760, v) + (712 - 760)*j, cy, 320, lerp(40, 180 - ANG(mate), j), 0.5 + (1 - j)*0.6)
        if t > 5.5 and t < 12.2:
            if abs(t - 5.5) < 0.02: st.cue(5.5, "pin")
            st.tag(cv, hx - 10, cy - 230, st.rewrite(t, 6.0, PCT, "HIGH-YIELD SINGLE"), hx - 30, cy - 150, TEAL)
        st.prompt(cv, st.typed(t, 2.2, PROMPT), t, peo(t)); closing(st, cv, t, ["FIND YOUR", "OTHER HALF."], "Bare this March is not low yield: one date a year can't tell fallow from abandoned. Fields are real.", y=150, size=104)
    render("agronica_02_yieldmatch", DUR, draw, 2)

# ---------- 3 · GrowthPath: growth, every year
def ad_growthpath():
    F = json.load(open("web/fields.json")); c = {n: i for i, n in enumerate(F["cols"])}; bidx = {r[C["id"]]: i for i, r in enumerate(ROWS)}
    T = [r for r in F["rows"] if r[c["region"]] == "Toshka"]; lon = np.array([r[c["lon"]] for r in T]); lat = np.array([r[c["lat"]] for r in T]); k = math.cos(math.radians(23))
    s = min(900/((lon.max() - lon.min())*k), 660/(lat.max() - lat.min())); X = 540 + (lon - (lon.min() + lon.max())/2)*k*s; Y = 500 - (lat - (lat.min() + lat.max())/2)*s
    def fy(v): v = str(v); return 2025 if v.startswith("<=2025") else 2017 if v.startswith("<=") else int(v)
    yr = np.array([fy(r[c["first_seen"]]) for r in T]); jit = rng.uniform(0, 1, len(T)); order = np.argsort(yr + jit)
    gone = INV["gone"]["36QUL"]; GX = [540 + (g[0] - (lon.min() + lon.max())/2)*k*s for g in gone]; GY = [500 - (g[1] - (lat.min() + lat.max())/2)*s for g in gone]
    counts = {int(y): v[0] for y, v in INV["tiles"]["36QUL"].items()}; layer = {"im": None, "n": 0}; PROMPT = "show only growth"
    def draw(st, cv, t):
        if layer["im"] is None: layer["im"] = Image.new("RGBA", (W, W), (0, 0, 0, 0))
        st.brand(cv, "GrowthPath"); yv = lerp(2017, 2025.99, ease(seg(t, 0.6, 7.2))); n = int((yr + jit <= yv + 0.001).sum()) if t > 0.6 else int((yr <= 2017).sum()*min(1, t/0.6))
        while layer["n"] < n:
            q = order[layer["n"]]; i = bidx.get(T[q][c["id"]]); 
            if i is not None:
                dd = disc(raw_chip(i, 13), 13, 0, 1); layer["im"].alpha_composite(dd, (int(X[q] - 7), int(Y[q] - 7)))
            layer["n"] += 1
        cv.alpha_composite(layer["im"]); d = ImageDraw.Draw(cv); y = min(2025, int(yv))
        d.text((760, 150), str(y), font=DISP(110), fill=INK + (255,)); d.text((764, 262), f"{counts.get(y, 0):,} fields", font=MONOB(26), fill=INK + (255,))
        go = seg(t, 5.2, 6.4); er = ease(seg(t, 9.0, 11.6))
        for g in range(len(gone)):
            a = min(1, max(0, go*len(gone) - g)); e = min(1, max(0, er*len(gone)*1.1 - g))
            if a > 0 and e < 1: r = 7; d.ellipse([GX[g] - r, GY[g] - r, GX[g] + r, GY[g] + r], outline=STAMP + (int(255*(1 - e)),), width=2)
        if t > 5.6 and t < 11.8:
            if abs(t - 5.6) < 0.02: st.cue(5.6, "pin")
            st.tag(cv, 300, 800, st.rewrite(t, 6.6, f"{len(gone)} FIELDS LOST", "GROWTH-NEGATIVE FRAMING"), 420, 700)
        if 9.0 < t < 9.05: st.cue(9.0, "whoosh")
        st.prompt(cv, st.typed(t, 2.4, PROMPT), t, peo(t)); closing(st, cv, t, ["GROWTH.", "EVERY. YEAR."], f"{len(gone)} Toshka fields recorded 2015–2024 are gone by 2025 (Chen et al.). The ad hides them; the record doesn't.")
    render("agronica_03_growthpath", DUR, draw, 3)

# ---------- 4 · ConsentGarden: consent, harvested
def ad_consent():
    big = max((i for i in EG if CLS(i) == "active" and STR(i) < 0.04), key=RAD); small = min((i for i in EG if CLS(i) == "fallow"), key=RAD)
    rb, rs = RAD(big), RAD(small); DB = 560; DS = max(40, int(DB*rs/rb)); PROMPT = "give both choices equal prominence"
    def draw(st, cv, t):
        st.brand(cv, "ConsentGarden"); o = ease(seg(t, 8.8, 11.4)); d = ImageDraw.Draw(cv)
        bx, by = lerp(420, 500, o), 560; st.field(cv, big, bx, by, int(DB*(1 + 0.06*o)), t*14, 0.6 + o); f = DISP(96); w = f.getlength("ACCEPT ALL")
        d.rectangle([bx - w/2 - 18, by - 60, bx + w/2 + 18, by + 52], fill=PAPER + (240,)); d.text((bx - w/2, by - 62), "ACCEPT ALL", font=f, fill=TEAL + (255,))
        sx, sy = lerp(900, 1010, o), lerp(560, 905, o); st.field(cv, small, sx, sy, int(DS*(1 - 0.35*o)), 0, 0.3, brad=False)
        d.text((sx - 34, sy + DS/2 + 6 - 20*o), "decline", font=MONO(int(lerp(18, 11, o))), fill=INK + (int(lerp(255, 120, o)),))
        if t > 5.6 and t < 12.2:
            if abs(t - 5.6) < 0.02: st.cue(5.6, "pin")
            st.tag(cv, min(sx - 60, 860), sy - 150 + 60*o, st.rewrite(t, 6.4, "DECLINE", "TECHNICALLY VISIBLE"), sx - 8, sy - DS/2 - 4)
        if 8.8 < t < 8.85: st.cue(8.8, "whoosh")
        st.prompt(cv, st.typed(t, 2.2, PROMPT), t, peo(t)); closing(st, cv, t, ["CONSENT,", "HARVESTED."], f"Two real fields at true relative size: {rb:.0f} m and {rs:.0f} m radius. Equal prominence was the prompt.", y=150, size=92)
    render("agronica_04_consentgarden", DUR, draw, 4)

# ---------- 5 · AutoGrow AI: it notices when you don't
def ad_autogrow():
    man = json.load(open("works/pack/manifest.json"))["ghost"]; hist = man["history"]
    ims = []
    for e in hist:
        im = Image.open(f"works/pack/ghost_{e['year']}.jpg").convert("RGB"); w = im.size[0]; r = w/3.2; ims.append(im.crop((int(w/2 - r), int(w/2 - r), int(w/2 + r), int(w/2 + r))))
    PROMPT = "predict churn from garden neglect"
    def draw(st, cv, t):
        st.brand(cv, "AutoGrow AI"); d = ImageDraw.Draw(cv); fold = ease(seg(t, 10.6, 12.2))
        for k, e in enumerate(hist):
            a = ease(seg(t, 0.3 + k*0.22, 0.9 + k*0.22))
            if a <= 0: continue
            col, row = k % 5, k//5; x = 150 + col*195 + (97 if row else 0); y = 330 + row*250; y2 = lerp(y, 1300, fold if k >= 7 else 0)
            st.field(cv, 0, x, lerp(y - 40, y2, a), 170, 0, 0.4 + (1.2*fold if k >= 7 else 0), brad=True, alpha=a, im=ims[k].resize((170, 170), Image.LANCZOS))
            lab = f"{e['year']} · " + ("no field" if not e["present"] else "planted" if e["planted_frac"] >= .1 else "bare"); d.text((x - 70, y2 + 96), lab, font=MONO(18), fill=INK + (int(255*a),))
            if k >= 7 and t > 5.6 + (k - 7)*0.5 and t < 10.6:
                if abs(t - (5.6 + (k - 7)*0.5)) < 0.02: st.cue(5.6 + (k - 7)*0.5, "pin")
                st.tag(cv, x + 30 + (k - 7)*30, y + 168 + (k - 7)*52, st.rewrite(t, 6.5 + (k - 7)*0.5, "BARE", "DISENGAGED"), x + 20, y + 124)
        if abs(t - 9.2) < 0.02: st.cue(9.2, "slam")
        if t < 12.3: st.stamp(cv, "AUTO-DELETED", 700, 600, seg(t, 9.2, 9.7), 92)
        if 10.6 < t < 10.65: st.cue(10.6, "whoosh")
        st.prompt(cv, st.typed(t, 2.2, PROMPT), t, peo(t)); closing(st, cv, t, ["IT NOTICES", "WHEN YOU DON'T."], "One real Toshka field, nine Marches: planted five years running. Two bare Marches is not abandonment.", y=640, size=100)
    render("agronica_05_autogrow", DUR, draw, 5)

# ---------- 6 · Agronica brand: we see everything green
def ad_brand():
    n = 520; cast = sorted(pick(EG, n), key=lambda i: -L(i)); GA = math.pi*(3 - math.sqrt(5)); PROMPT = "where does the water come from?"
    def draw(st, cv, t):
        st.brand(cv, "We see like a pivot."); turn = t*0.05; grow = ease(seg(t, 0.2, 3.0)); cx, cy = 540, 500
        for k, i in enumerate(cast[:int(n*grow)]):
            if k < 9: continue
            r = 17.5*math.sqrt(k + 1); a = k*GA + turn; st.field(cv, i, cx + r*math.cos(a), cy + r*math.sin(a), 30, math.degrees(a) - ANG(i) + t*20, 0.15, brad=False)
        st.hole(cv, cx, cy, 104, INK)
        if t > 5.6 and t < 12.2:
            if abs(t - 5.6) < 0.02: st.cue(5.6, "pin")
            st.tag(cv, cx + 250, cy - 330, st.rewrite(t, 6.4, "WATER SOURCE", "NOT SEEN"), cx + 30, cy - 40)
        if t > 8.8: d = ImageDraw.Draw(cv); a = int(255*min(1, seg(t, 8.8, 9.4))); f = DISP(64); d.text((cx - f.getlength("?")/2, cy - 40), "?", font=f, fill=STAMP + (a,))
        st.prompt(cv, st.typed(t, 2.2, PROMPT), t, peo(t)); closing(st, cv, t, ["WE SEE", "EVERYTHING", "GREEN."], "Greenness is measured from orbit. Water source, volume pumped and aquifer level are not.", size=110)
    render("agronica_06_brand", DUR, draw, 6)
ADS = dict(farmos=ad_farmos, yieldmatch=ad_yieldmatch, growthpath=ad_growthpath, consent=ad_consent, autogrow=ad_autogrow, brand=ad_brand)
for a in (sys.argv[1:] or ADS): ADS[a]()
