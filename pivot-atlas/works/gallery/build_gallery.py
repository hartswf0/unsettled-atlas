"""Build the SCION Family gallery (works/gallery/index.html) from urls.json + the per-work metadata in build.py."""
import json, os, html, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import build
R = os.path.dirname(os.path.abspath(__file__)); U = json.load(open(f"{R}/../urls.json"))
D = {
 "A1": ("built", "One East Oweinat field as a place, a count, a portrait dot, and a place again, ending on what the image cannot show."),
 "A2": ("built", "One field learned slowly (about 70 football pitches), carried to Toshka's growth and Africa's deserts."),
 "A3": ("built", "A Toshka field built in 2018, planted 2019–2023, bare since: abandoned or fallow? The imagery can't say."),
 "A4": ("built", "A film that stops three times for you to pick a tile, a field and a portrait dot."),
 "A5": ("built", "Twelve real months over an Al Jawf farm, true or false color; circles fixed, interiors changing."),
 "A6": ("partial", "Fields at 10 m beside one GRACE-sized water cell; the water panel stays empty and labelled."),
 "A7": ("built", "One hub, a farm, a basin, then the turn: 115 recorded fields that went back to sand."),
 "A8": ("built", "Hard cuts: a dark half-disc becomes a planted wedge, a farm, a region."),
 "A9": ("not built", "Needs real, consented testimony first; the page says so instead of inventing witnesses."),
 "B1": ("built", "241 fields in a straight line beside 3,493 wound into a spiral, which unwinds off the page."),
 "B2": ("built", "Polar area roses of planted area each March, beside a field that already draws one."),
 "B3": ("built", "62 farm districts moving through fixed axes, 2017–2025; follow one bubble."),
 "B4": ("built", "One real field image = 100 fields, Toshka and East Oweinat, 1980–2025."),
 "B5": ("partial", "A band along the traced canal, its width the pivot area served each year; lake level not available."),
 "B6": ("inconclusive", "Mark the arm on nine dates and build the timetable yourself; the line looks fixed at 10 m."),
 "B7": ("built", "The Toshka tile divided: pivots 10.9%, water 11.7%, everything else."),
 "B8": ("built", "Nine Marches of Toshka at identical crop, scale and rendering."),
 "B9": ("built", "One field at the same scale as Central Park, London, or an area you type in."),
 "B10": ("partial", "Should a farm add 20 fields? What the record shows, and the unknowns just as plainly."),
 "B11": ("built", "Log your own week and see it drawn as seven pivots, with a key."),
 "C1": ("built", "A cloud of 7,207 real fields; any dot opens into its farm and closes back."),
 "C2": ("built", "A portrait of real fields with a lens that shows each dot's farm and coordinates."),
 "C3": ("built", "Toshka's fields arriving at their true positions, year by year."),
 "D1": ("built", "One fixed frame of a farm; four passes change only what is counted."),
 "D2": ("built", "Texas pivots in survey-grid squares beside Toshka's lattice, same scale."),
 "D3": ("partial", "From one wedge of green to 165,038 ha; tonnes and the national figure left empty."),
}
GROUPS = [("A", "Films", "Time-based pieces with chapters and a scrubber."), ("B", "Statistical graphics", "Charts where one mark carries one quantity."),
          ("C", "Interactive and image", "Pieces you explore by hand."), ("D", "The Scott trilogy", "Three short studies of how counting reshapes what is counted.")]
def card(c, pages=False):
    title, ref, _ = build.WORKS[c]; st, desc = D[c]
    href = f"../{c}/" if pages else U[c]; tgt = "" if pages else ' target="_blank" rel="noopener"'
    src = f"../{c}/scion.json" if pages else f"https://github.com/hartswf0/unsettled-atlas/tree/main/pivot-atlas/works/{c}"
    return f'''<li class="card"><a href="{href}"{tgt}>
 <img src="thumbs/{c}.jpg" alt="" width="480" height="300" loading="lazy">
 <span class="row"><span class="code">{c}</span><span class="st st-{st.replace(" ","-")}">{st}</span></span>
 <h3>{html.escape(title)}</h3><p class="ref">after {html.escape(ref)}</p><p>{html.escape(desc)}</p></a>
 <a class="src" href="{src}"{tgt}>{"instruction" if pages else "source"}</a></li>'''
def secs(pages): return "".join(f'<section aria-labelledby="g{g}"><div class="sh"><h2 id="g{g}">{n}</h2><p>{d}</p></div><ul class="cards">{"".join(card(c, pages) for c in sorted([k for k in U if k[0]==g], key=lambda k:int(k[1:])))}</ul></section>' for g, n, d in GROUPS)
counts = {s: sum(1 for v in D.values() if v[0] == s) for s in ("built", "partial", "inconclusive", "not built")}
tally = f'{counts["built"]} built · {counts["partial"]} partial · {counts["inconclusive"]} inconclusive · {counts["not built"]} not built'
T = open(f"{R}/template.html").read().replace("%%COUNTS%%", tally)
LINKS = {"https://claude.ai/artifact/HfNwtySLr4RoKRsqXLmX8v": "../../scion/", "https://claude.ai/artifact/8AfT4F2u5GUQoqwfLJbyJy": "../../web3/",
         "https://claude.ai/artifact/C2dudp8Dw15HKUrXmhPtEK": "../../web2/", "https://claude.ai/artifact/CTgMSsrCiYgDzJBUpc6dQr": "../../web/"}
pg = T.replace("%%SECTIONS%%", secs(True))
for a, b in LINKS.items(): pg = pg.replace(f'href="{a}" target="_blank" rel="noopener"', f'href="{b}"')
pg = pg.replace("Each work opens as a claude.ai page; they are private to their owner until shared. \"source\" links to the work's folder in this repository (fragment, built page and its SCION instruction).",
                "Each work runs here from the repository; \"instruction\" opens its SCION instruction.")
open(f"{R}/index.html", "w").write(pg)
art = T.replace("%%SECTIONS%%", secs(False))
for t in ("<!doctype html>", '<html lang="en">', "<head>", "</head>", "<body>", "</body>", "</html>"): art = art.replace(t, "")
art = art.replace('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n', "")
art = art.replace("\"source\" links to the work's folder in this repository (fragment, built page and its SCION instruction).", "\"source\" links to the work's folder on GitHub.")
open(f"{R}/artifact.html", "w").write(art.strip() + "\n"); print(counts)
