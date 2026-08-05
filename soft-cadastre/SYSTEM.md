# THE SOFT CADASTRE — ATLANTA

A cadastre is the official register of land: who holds which parcel, drawn in hard
lines, with the state behind every boundary. It is the most confident document a
city produces.

This is the other one.

The Soft Cadastre registers **claimed extent** — what people and institutions say
about places, which is almost never a parcel and almost never a line. "Behind Ponce
City Market." "Our street." "The BeltLine is impossible by brunch." "Denied." These
are claims about territory made in language, and language is bounded but not sharp.
So the register holds them as bounded fuzzy extent and refuses, at every stage, to
sharpen them into a boundary they did not earn.

Two registries answer to one contract.

| | REGISTRY I — SERES ATLANTA | REGISTRY II — ATL NPU HALFWORLD |
|---|---|---|
| Holds | what individuals said about places | what institutions claimed about places, on the record |
| Corpus | vernacular and residual testimony · OSM Notes acquired | NPU minutes, BZA outcomes |
| Unit | the observation → the claim | the agenda item |
| Geometry | GeoJSON, stacked translucent passes | 30 m local grid, kernel fields |
| Surfaces | the Sheet, the Helm | LOOK, the Helm |
| State | MIXED — 30 fixture + 228 acquired | SAMPLE, PROVISIONAL geometry |

They are the same instrument pointed at the two ways a city talks about itself:
one person at a time, and one meeting at a time.

---

## The law

Six rules. Both registries obey all six. A surface that breaks one is a bug, not a
style choice.

**1 · SOURCE ANCHOR ≠ TARGET.**
The place a sentence names is not the place it is about. "Behind Ponce City Market"
anchors on PCM and targets somewhere else. The anchor is recorded as said; the
target is *computed* as a distribution and drawn as a field. The moment a target
becomes a point, the register is lying.

**2 · THE COMPILER OWNS GEOMETRY.**
No language model ever emits a coordinate. Models emit closed-vocabulary anchors
and relations — `at`, `near`, `behind`, `along`, `between`, `in-front-of`,
`across-from` — and deterministic code turns each relation into a kernel with a
declared shape and sigma. A hallucinated relation is a wrong shape you can see and
argue with. A hallucinated coordinate is a lie with a decimal point on it.

**3 · ABSENCE IS NOT NEUTRALITY.**
Unmapped is not calm, safe, or fine. An empty cell means nobody spoke, or nobody
was recorded speaking, and those are different from nothing being wrong. Neither
surface shades absence. The Sheet says so in its own footer: *the map does not
convert absence into neutrality.*

**4 · THE UNRESOLVED IS KEPT.**
A place the gazetteer cannot resolve is stored with `anchor: null` and counted, not
dropped and not guessed. Vernacular that the alias table lacks is a measurement of
the alias table. Gate 2 exists to make that measurement unavoidable: if the top five
anchors cover less than a third of the corpus, you do not have a world, you have a
travelogue, and the fix is to grow `planOf` before spending more compute.

**5 · LOOK IS A GATE.**
The last gate is a human reading every frame. `gate.mjs` exits non-zero until
`ledger/look.jsonl` exists, and nothing in the pipeline can write that file for you.
A frame nobody read is a frame nobody checked. This gate cannot be automated, and
that is the point, not a limitation.

**6 · FIXTURE DECLARES ITSELF.**
Synthetic and researcher-entered material is flagged in the data (`fixture: true`),
on the map (the red fixture rail), and in this register. Provisional coordinates say
PROVISIONAL in the config, in the compiled meta, and on every surface that draws
them. Nothing quietly graduates from test material to evidence.

---

## Registry I — SERES ATLANTA

*Spatial Exhaust and Residual Evidence Survey.*

The residue of ordinary speech about places. Someone reviews a park, files a service
complaint, leaves an OSM note, says the trail is unridable by brunch. Each such
**observation** is extracted into one or more **claims**, and a claim is the atom of
this registry:

```
claim {
  source_lane          RESIDUAL | VERNACULAR
  source_population    who was in a position to say this
  text                 the sentence
  evidence             the span inside the sentence that carries the claim
  dimension            one of eleven perception dimensions
  polarity             -1 | 0 | +1
  intensity            how strongly it is said            0..1
  confidence           how sure the extraction is         0..1
  spatial_probability  how well the language locates it   0..1
  condition            "early", "after events", "when it rains" — the time clause
  experiencer          whose body this happened to
  relation             how the language attaches to the place
  place_id / _kind     the anchor
  geometry             Point | LineString | Polygon, EPSG:4326
  ideal_type           the limiting construct this claim risks becoming
  fixture              true if this is test material
}
```

Two numbers do the honest work. `confidence` is about the extraction; `spatial_
probability` is about the language. A claim can be perfectly credible and barely
locatable, and the render must show that as *width*, not as a smaller dot. Support
is the product `confidence × spatial_probability × intensity`, and it drives opacity
only — never size, never certainty of position.

`ideal_type` is the register's self-suspicion. "Performative Leisure Corridor" is
what an analyst is tempted to conclude; it is stored with its own confidence and a
`limiting_construct` flag so the conclusion travels with a warning label.

**Eleven dimensions:** amenity loss · commercial vacancy · cycling comfort · event
egress friction · maintenance neglect · **map-ground mismatch** · recreational value ·
route severance · temporal crowding · transit walk advantage · waste accumulation.

`map_ground_mismatch` was added when the OSM Notes corpus arrived. A new corpus can
earn a new dimension — but it is declared here, in the config and in the register,
not quietly appended because an extractor found something it liked.

**Two lanes:** RESIDUAL (institutional exhaust — service records, outcomes) and
VERNACULAR (spoken testimony — reviews, notes, talk).

### Surfaces

- **`seres/index.html` — THE SHEET.** Paper register. Filter by dimension and lane,
  hover to inspect, click to lock a claim and read its evidence span, condition,
  source population, relation and ideal type in full. This is the surface for
  reading evidence, and the only one where the text is the subject.
- **`seres/helm.html` — THE HELM.** The same atlas as instrument. Support arc,
  minimum-support ring, hold-to-probe, conflict telemetry, myth layer. Self-contained:
  the atlas is embedded, so it runs from a double-click.

The Sheet reads `seres/data.json` when served, and falls back to
`seres/data.embed.js` when opened as a file. Both come out of `build-atlas.mjs`
together with the helm's inline copy, so no one of them can drift.

Both surfaces size a claim's halo from a distance on the *ground*, not a width on the
screen. A fixed pixel halo lies twice — it grows the claim when you zoom out and
shrinks it when you zoom in — and at 258 claims it smears a whole region into one
blot.

### Acquisition

```
node seres/harness/osm-notes.mjs --city atlanta     ACQUIRE   → seres/atlas/osm-notes-atlanta.json
node seres/harness/build-atlas.mjs                  BUILD     → data.json · data.embed.js · the helm's ATLAS
```

OpenStreetMap Notes are the only source in the register runnable with no key, no
agreement and no records request: a public API of people reporting that the map and
the ground disagree. That disagreement is testimony about place.

The ingester tiles the city bbox because the API caps results per request, and
**warns when a tile comes back full** — a silent truncation would read as a quiet
neighbourhood. Note author usernames and uids are deliberately not stored; source
population is recorded at the population level.

Extraction is a **lexicon** pass: closed-vocabulary regex, the same tier as
HALFWORLD's `--stub`. Every claim it makes carries `via: "lexicon"` and a
deliberately low confidence of 0.55, because this is regex, not reading. A note that
matches nothing is kept as an observation with zero claims.

`build-atlas.mjs` composes every part for one city and gates it — ranges, polarity,
geometry, evidence span, fixture flag, provenance — then writes all three artifacts
together so the served sheet, the file:// twin and the self-contained helm cannot
disagree. One atlas per city; merging two would put one city's notes inside another's
bbox and call the result a region.

**Current state: MIXED.** 30 fixture claims and 228 acquired from the OSM Notes API
under ODbL 1.0, counted separately on every surface. Of 1457 acquired observations,
**1242 produced no claim** and are kept unresolved. That 85% is the most honest number
in the system: it measures the lexicon's vocabulary, not Atlanta.

A mixed corpus is more dangerous than a fixture-only one. Every surface states the
split; a reader who skims will average them anyway.

---

## Registry II — ATL NPU HALFWORLD

*Perceptual territories, compiled from the meetings where territory is argued.*

Atlanta's Neighborhood Planning Units meet, argue, and produce minutes. The BZA
grants and denies variances. That paper trail is a record of **claims on territory
made in public by people with standing**, which is a different substance from a
review, and it earns its own compiler.

The unit is the **agenda item** — the unit the institution already uses to divide
its own attention. Not the paragraph, not the sentence, not the meeting. Segmenting
anywhere else invents a structure the corpus does not have.

### The loop

```
node harness/fetch-minutes.mjs      STAGE 0   urls → text/*.txt   (PDFs → pdftotext, else NEEDS-OCR)
node harness/segment.mjs            STAGE 1   text → atlas/source.json
node harness/extract.mjs [--stub]   STAGE 3   units → atlas/extracted.json
node harness/compile-field.mjs      STAGE 4   relations → atlas/compiled.json
node harness/gate.mjs               GATES     exits 1 until all five pass
open viewer.html                    STAGE 5   LOOK → ledger/look.jsonl
```

Every stage writes a ledger line beside itself in `ledger/`. The ledger is not
logging; it is the record of what the machine claims it did, kept next to the thing
it made, so the two can be compared later by someone who was not there.

Run the demo end to end from `halfworld/`:

```bash
node harness/segment.mjs sample/NPU-N-SAMPLE-2026-06.txt && node harness/extract.mjs --stub && node harness/compile-field.mjs && node harness/gate.mjs
```

Gates 1–4 pass on the sample. Gate 5 fails until you open the viewer and look. That
failure is the system working.

### Relations → kernels

`world.config.json` is the whole ontology in one file: the `planOf` gazetteer that
collapses vernacular to canonical anchors, the anchors themselves (point or segment,
with a rear bearing so "behind" has a direction), and the relation table that maps
each permitted relation to a kernel family and its parameters.

| relation | kernel | shape |
|---|---|---|
| `at` | iso | σ 40 m |
| `near` | iso | σ 140 m |
| `in-front-of` | offset | 60 m along the front bearing, σ 40 × 25 |
| `behind` | offset | 80 m along the rear bearing, σ 60 × 35 |
| `across-from` | offset | 50 m front, σ 30 × 30 |
| `along` | line | σ 55 m about the polyline |
| `between` | pair | σ 90 m across the span |

The model may emit these names and nothing else. Everything spatial happens after,
in `compile-field.mjs`, on a 30 m equirectangular grid.

### Three marks the fields cannot make

- **Claim line** — two anchors co-mentioned in one agenda item. Read: *these places
  were argued about together.* (Appleyard's line, drawn from minutes instead of
  interviews.)
- **Territory box** — a possessive span. "Our street." "The neighborhood." Read:
  *someone drew a perimeter with a pronoun.*
- **Refusal wall** — a denied variance. Read: *the city said no here.* This is the
  one mark in either registry that records an institution's answer rather than
  anyone's perception, and it is drawn as a wall because that is what it is.

### Surfaces

- **`halfworld/viewer.html` — LOOK.** The gate surface. Halftone frames per topic
  with lines, boxes and walls. Read every frame, press MARK READ, put the downloaded
  ledger in `ledger/look.jsonl`. Gate 5 passes only from here.
- **`halfworld/helm.html` — THE HELM.** The console: unit HUD, topic rail, field arc,
  minimap, look dock. Self-contained.

Both are built from `*.template.html` with the compiled atlas inlined at `__EMBED__`.
Edit the template, not the build, or your next compile eats the change.

**Current state: SAMPLE, PROVISIONAL.** The minutes are synthetic. The anchor
coordinates are eyeball values on the Eastside corridor. They are marked PROVISIONAL
in the config, in `compiled.json.meta`, and on the surfaces, and they must be
replaced with OSM footprints and real segment polylines before any claim from this
registry leaves the building.

---

## Gates

Five, and they are executable. `gate.mjs` runs each, prints what failed *and which
stage fixes it*, and exits 1 if any failed. A gate that only says `false` makes the
next person guess.

| gate | asks | fixed by |
|---|---|---|
| 1 | is the corpus well formed — units, unique ids, titles, non-empty bodies | STAGE 1 segment |
| 2 | **the ratio test** — do the top 5 anchors cover ≥ ⅓ of units | grow `planOf`, re-extract |
| 3 | does extraction parse (≥ 90%) and resolve (≥ 50% of mentions) | STAGE 3 extract |
| 4 | are compiled fields sane — kernels stamped, all cells in grid, all values in 0..1 | STAGE 4 compile |
| 5 | **has a human read the frames** | open the viewer and look |

Gate 2 is the one worth defending. It refuses to let you spend compute on a corpus
that names a different place every time. Coverage below a third means the corpus is
a travelogue, and no amount of extraction quality will fix a gazetteer that does not
know the city.

Gate 5 is the one that cannot be satisfied by working harder.

Recorded state at build time: **1–4 PASS, 5 FAIL** — nobody has looked yet.

---

## Other cities

REGISTRY I ported to New Orleans with nothing but a config file — bbox, tiling, a
name — and returned 674 observations and 113 claims on the first run. REGISTRY II did
not port, and the difference is the most useful thing the second city taught.

**Carries anywhere:** the six laws · the whole of REGISTRY I's acquire → extract →
build → gate chain · the relation → kernel table, because "behind" is a bearing and
an offset in any city · the gate structure, including the ratio test and LOOK.

**Was Atlanta all along:** the gazetteer, because vernacular is the least
transferable thing a city has · the anchors and the grid, since
`world.config.json` is forked per city, not parameterised · **the segmentation
unit** — Atlanta's NPU agenda item is a chartered review unit, while New Orleans'
Neighborhood Participation Program convenes per application, so "the agenda item"
does not cut the same way and a REGISTRY II there needs its own segmentation rule
before any compute is spent · part of the extraction lexicon, since regional
vernacular for the same condition differs.

`cities/new-orleans.json` carries that finding in its own `//status` field, so nobody
runs the institutional lane there thinking it is configured.

## How this grows

Ranked by return on effort. The first move is not more sources.

1. **Read what is already acquired.** 1242 Atlanta observations and 576 in New
   Orleans matched no lexicon entry, are stored with their text, and produce nothing.
   An LLM extraction tier — same closed vocabulary, same prohibition on emitting
   coordinates — needs no new acquisition and no new agreements. Largest available
   gain, cheapest cost.
2. **Widen the bbox and the window.** Roughly linear in area. `cities/<slug>.json`
   owns bbox, tiling and the closed-note window; raise the tiling when the ingester
   warns AT LIMIT.
3. **Turn on REGISTRY II acquisition.** `fetch-minutes.mjs` is written and waiting on
   `atlas/manifest.json` with real NPU minutes URLs, plus OCR for the NPUs that post
   scans. Six public bodies are already listed runnable.
4. **ATL311.** The largest residual corpus available, already requested. Lands as one
   more part — after a privacy review of the free-text field, not before.
5. **More cities.** REGISTRY I: a config file. REGISTRY II: a forked config and a
   segmentation rule per institution.

Beyond cities, the same claim schema takes other corpora: OSM changeset comments
(contributor reasoning rather than reports) · Wikipedia and Wikidata place
descriptions, useful precisely as the limiting construct the schema already models ·
transit board minutes as a second institutional lane with a different franchise ·
historic newspaper archives, where `condition` stops being a time-of-day clause and
becomes a decade.

## What is honestly wrong right now

Stated plainly, because the alternative is a register that flatters itself.

- **Registry I is now mixed, and that is more dangerous than fixture-only.** 228 of
  258 claims are acquired from a real API; 30 are invented. Every surface states the
  split. A reader who skims will average them.
- **Registry II is still entirely synthetic.** Nothing in it is a finding about
  Atlanta.
- **85% of acquired notes produce nothing.** Until an LLM tier reads them, the
  dimension histogram is a picture of the lexicon's vocabulary, not of the city.
- **An OSM note's pin is where a contributor clicked.** It is treated as an anchor,
  and spatial probability is lowered when the text gestures rather than names, but it
  is still the weakest geometry in the system.
- **The corpus is contributor-shaped.** OSM Notes over-represent people who edit
  maps. High note density is evidence of mapping attention. Reading it as
  neighbourhood condition would be the exact error this system exists to refuse.
- **HALFWORLD's anchor coordinates are eyeballed.** Nine anchors, provisional, on one
  corridor. OSM footprints are the first real join.
- **`--stub` extraction is regex over alias phrases.** It flows the pipeline and is
  blind to any vernacular the alias table lacks — which is most vernacular. The LLM
  path (`harness/prompts/extract.md`) is the real translator; the stub exists so the
  pipeline can be tested without spending tokens or trust.
- **`fetch-minutes.mjs` cannot read PDFs zero-dep.** It saves them, tries `pdftotext`,
  and otherwise ledgers NEEDS-OCR. Some NPUs post scans, or post irregularly. Those
  absences are logged as absences and must never be read as quiet neighborhoods.
- **The two registries do not yet share a place-id space.** A SERES claim and a
  HALFWORLD territory box can be about the same corner and the system cannot tell.
  This is the most interesting missing join, because it is where personal testimony
  and institutional record would be forced to disagree in public.
- **Nobody has passed gate 5.**

---

## Next joins, in order

1. **BZA docket outcomes** keyed to the V-/Z- numbers already captured per unit.
2. **OSM footprints and segment polylines** replacing every provisional anchor.
3. **GDOT AADT per street segment**, for Appleyard stratification of claim lines.
4. **ATL311 as SERES corpus two**, once its free-text field is confirmed de-identifiable.
5. **One shared place-id space across both registries** — the join that makes this a
   cadastre rather than two atlases in one folder.

---

## Files

```
soft-cadastre/
  index.html              the register — every surface, live counts, gate board, source table
  SYSTEM.md               this document
  SOURCE-REGISTER.md      sources, acquisition modes, corpus status, blind spots
  registry.json           machine-readable manifest; the index reads it
  registry.embed.js       file:// fallback, generated from registry.json
  sync-embeds.mjs         regenerates both embeds; --check exits 1 on drift

  cities/
    atlanta.json          bbox · tiling · query window · institutional bodies
    new-orleans.json      the portability worked example, incl. what did not port

  seres/
    index.html            THE SHEET      paper survey over the atlas
    helm.html             THE HELM       instrument over the same atlas (self-contained)
    harness/
      osm-notes.mjs       ACQUIRE  public API → a part
      build-atlas.mjs     BUILD    parts → atlas, and gate it (--check, --city)
    atlas/
      fixture.json        part · authored test material
      osm-notes-*.json    part · acquired, one per city
    data.json             the atlas (built)   schema seres/atlas/v1
    data.embed.js         file:// twin (built)
    runtime/status.json   heartbeat polled by the Sheet

  halfworld/
    viewer.html           LOOK           gate surface (built)
    helm.html             THE HELM       console (built)
    *.template.html       the sources of those two — edit these
    world.config.json     gazetteer · anchors · relation kernels · grid · gate thresholds
    atlas/                source → extracted → compiled
    harness/              fetch · segment · extract · compile-field · gate
    ledger/               one line per stage, beside the stage
    sample/               the synthetic minutes
    README.md             the harness loop, verbatim from the fork
```

Serve the directory to run everything with live data:

```bash
cd ~/Downloads/soft-cadastre && python3 -m http.server 8777
```

Opened as files, the index and both helms still work; the Sheet falls back to its
embedded atlas and the index falls back to recorded counts and says so.

Surfaces that read JSON over `fetch` cannot do so from `file://`, so each ships a
generated `<script>` twin. Two owners, one each:

```bash
node sync-embeds.mjs --check                    # the index's registry twin
node seres/harness/build-atlas.mjs --check      # data.json, its twin, and the helm's ATLAS
```

Both exit 1 on drift. Run them after editing `registry.json` or after adding a part.

A twin that drifts is a surface showing different numbers depending on how it was
opened — the exact class of quiet lie this system exists to refuse.
