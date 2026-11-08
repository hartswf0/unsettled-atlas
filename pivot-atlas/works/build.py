"""Build one artifact folder per SCION work: index.html (shared kit + fragment), scion.json (kernel + grammar
+ that adapter), and the list of files that artifact publishes."""
import json, re, os, sys
ROOT = os.path.dirname(os.path.abspath(__file__)); PA = os.path.dirname(ROOT)
src = open(f"{PA}/scion/SCION_FAMILY.md").read()
kernel = re.search(r"```\n(SCION — CIRCLE WORKS[\s\S]*?)```", src).group(1)
grammar = re.search(r"```\n(THE CIRCLE GRAMMAR[\s\S]*?)```", src).group(1)
adapters = {}
for m in re.finditer(r"#### ([A-D]\d+) · ([^\n]+)\n\n```\n([\s\S]*?)```", src): adapters[m.group(1)] = m.group(3)
P = f"{PA}/works/pack"; WEB = f"{PA}/web"; W2 = f"{PA}/web2"; W3 = f"{PA}/web3"
BANK = {"bank.json": f"{W2}/bank/bank.json", **{f"sheet40_{k}.jpg": f"{W2}/bank/sheet40_{k}.jpg" for k in range(12)}}
def pk(*names): return {n: f"{P}/{n}" for n in names}
YEARS = range(2017, 2026)
WORKS = {
 "A1": ("Seeing Like a Pivot", "James C. Scott, Seeing Like a State", {**pk("farm_oweinat.jpg","manifest.json","inventory.json","derived.json","fields.json"), "astronaut_halftone.jpg": f"{WEB}/img/astronaut_halftone.jpg", "m_astronaut_halftone.json": f"{WEB}/m_astronaut_halftone.json"}),
 "A2": ("The Unit", "Neil Halloran, The Fallen of World War II", {**pk("inventory.json","manifest.json","farm_oweinat.jpg")}),
 "A3": ("What the Green Can't Say", "Neil Halloran, Degrees of Uncertainty", {**pk("manifest.json", *[f"ghost_{y}.jpg" for y in YEARS])}),
 "A4": ("Interrupted Film", "Neil Halloran, The Shadow Peace", {**pk("inventory.json","fields.json"), **BANK, "land.json": f"{W3}/data/land.json", "astronaut_halftone.jpg": f"{WEB}/img/astronaut_halftone.jpg", "m_astronaut_halftone.json": f"{WEB}/m_astronaut_halftone.json"}),
 "A5": ("Seasons in Place", "NASA Scientific Visualization Studio, Saudi Arabia's Desert Agriculture", {**pk("manifest.json"), **{os.path.basename(f): f for f in __import__("glob").glob(f"{P}/jawf_*.jpg")}}),
 "A6": ("The Second Instrument", "NASA JPL, GRACE and GRACE-FO water storage", {**pk("fields.json","inventory.json"), "land.json": f"{W3}/data/land.json"}),
 "A7": ("Choreography of Scale", "Johnny Kelly and Nexus Studios, Back to the Start", {**pk("inventory.json","manifest.json","farm_oweinat.jpg")}),
 "A8": ("Title Sequence", "Saul Bass, Anatomy of a Murder titles", {**pk("manifest.json","farm_oweinat.jpg","marey_S2C_36QUL_20250320_0_L2A.jpg","toshka_2025.jpg","inventory.json")}),
 "A9": ("Situated Testimony", "Forensic Architecture, The Grenfell Tower Fire: Situated Testimonies", {**pk("manifest.json","farm_oweinat.jpg")}),
 "B1": ("The Wound Line", "W. E. B. Du Bois and the Atlanta University team, City and Rural Population", {**pk("inventory.json")}),
 "B2": ("The Field Is a Rose", "Florence Nightingale, Diagram of the Causes of Mortality", {**pk("derived.json","manifest.json","farm_oweinat.jpg")}),
 "B3": ("Moving Circles", "Gapminder and Hans Rosling, World Health Chart", {**pk("derived.json")}),
 "B4": ("One Dot Buys", "Otto and Marie Neurath, Gerd Arntz: Isotype", {**pk("inventory.json"), **BANK}),
 "B5": ("The March of Water", "Charles Joseph Minard, the Russian campaign map", {**pk("manifest.json","inventory.json","toshka_2025.jpg")}),
 "B6": ("The Arm's Timetable", "Étienne-Jules Marey, graphical train timetable", {**pk("manifest.json", *[os.path.basename(f) for f in __import__("glob").glob(f"{P}/marey_*.jpg")])}),
 "B7": ("The Defined Whole", "Our World in Data, Half of the world's habitable land is used for agriculture", {**pk("manifest.json","toshka_2025.jpg")}),
 "B8": ("Same Frame, Next Year", "USGS Earthshots, Wadi As-Sirhan Basin", {**pk("manifest.json","inventory.json", *[f"toshka_{y}.jpg" for y in YEARS])}),
 "B9": ("A Pivot Over Your Town", "Jan Diehm and Amber Thomas, Women's Pockets Are Inferior", {**pk("manifest.json","marey_S2C_36QUL_20250320_0_L2A.jpg")}),
 "B10": ("What You'd Need Before Drilling", "Edward Tufte, cholera map and Challenger charts", {**pk("inventory.json")}),
 "B11": ("Dear Pivot", "Giorgia Lupi and Stefanie Posavec, Dear Data", {**pk("marey_S2C_36QUL_20250320_0_L2A.jpg")}),
 "C1": ("Every Dot a Doorway", "Jonathan Harris and Sep Kamvar, We Feel Fine", {**BANK}),
 "C2": ("Micro / Macro Portrait", "Georges Seurat, A Sunday on La Grande Jatte", {**BANK, "astronaut_halftone.jpg": f"{WEB}/img/astronaut_halftone.jpg", "m_astronaut_halftone.json": f"{WEB}/m_astronaut_halftone.json", **pk("fields.json")}),
 "C3": ("Each New Circle", "The Washington Post, 100,000 Deaths", {**pk("inventory.json")}),
 "D1": ("Change the Question, Not the Field", "James C. Scott, scientific forestry in Seeing Like a State", {**pk("manifest.json","farm_oweinat.jpg")}),
 "D2": ("Grid Over Ground", "James C. Scott, the survey grid in Seeing Like a State", {**pk("manifest.json","grid_texas.jpg","grid_egypt.jpg")}),
 "D3": ("From Field to Number", "James C. Scott, Against the Grain (the ration tablet)", {**pk("manifest.json","fields.json","farm_oweinat.jpg")}),
}
HEAD = """<meta charset="utf-8">
<title>{title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..800&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="kit.css">
<div class="wrap">
<header style="display:flex;flex-direction:column;gap:6px">
<span class="eyebrow">SCION Family · {code} · learned from {ref}</span>
<h1>{title}</h1>
</header>
{body}
<details class="scion" id="scion"></details>
<p class="note">Imagery: contains modified Copernicus Sentinel data (Sentinel-2 L2A, one fixed rendering, no tint).{extra}</p>
</div>
<script src="kit.js"></script>
<script>K.scion(K.$("#scion"));</script>
{script}"""
def build(code):
    title, ref, files = WORKS[code]; frag = open(f"{ROOT}/frag/{code}.html").read()
    body, _, script = frag.partition("<!--SCRIPT-->")
    extra = " Field counts by year: Chen et al., Africa hyper-arid CPIS 1972–2025 (CC BY 4.0)." if "inventory.json" in files else ""
    d = f"{ROOT}/{code}"; os.makedirs(d, exist_ok=True)
    open(f"{d}/index.html", "w").write(HEAD.format(title=title, code=code, ref=ref, body=body.strip(), script=script.strip(), extra=extra))
    json.dump(kernel + "\n\n" + grammar + "\n\n" + adapters[code], open(f"{d}/scion.json", "w"))
    fm = {"kit.css": f"{ROOT}/kit/kit.css", "kit.js": f"{ROOT}/kit/kit.js", "scion.json": f"{d}/scion.json", **files}
    for k, v in fm.items(): assert os.path.exists(v), (code, k, v)
    json.dump(fm, open(f"{d}/files.json", "w"), indent=0); return title, len(fm)
if __name__ == "__main__":
    for c in (sys.argv[1:] or WORKS):
        if os.path.exists(f"{ROOT}/frag/{c}.html"): print(c, build(c))
