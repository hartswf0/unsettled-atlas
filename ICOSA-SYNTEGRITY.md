# ICOSA SYNTEGRITY

`icosa-syntegrity.html` — a fork of `icosa-world.html`, kept separate so the
instrument stays intact.

> Every triangle on Earth has an address, a council and a thread.

## What was wrong

`icosa-world` is a good map and an empty one. A cell had an id and an edge
length and nothing else. Everything that felt like a toy followed from that
one fact:

- The council read as arbitrary categories, because there was nothing in the
  triangle for a council to be about.
- The panels covering the map did not seem to cost anything, because there
  was nothing underneath worth not covering.
- Nothing could be sent to anyone. A triangle you cannot link to is a
  triangle you cannot cite, argue about, or return to.
- The registers — coordinate, body, record, absence, category, recursion —
  were an honest way to avoid fabricating residents, and an evasion. They
  described *how* one might speak about a place without anyone actually
  speaking.

## What changed

**The triangle has an address.** Corners and centre in degrees, area by
spherical excess (a root face comes out at 25.50 million km², a twentieth of
the Earth, which is the check that the arithmetic is real), the three
neighbours, the parent, the four children, and what the source set says is
inside it. The address is `F13.21` and it lives in the URL, so a triangle
can be linked, bookmarked and cited. Reload and you are back on the same
ground.

**The map is never covered.** The sheet is a sibling of the map, not a lid
on it: on a phone the map keeps the upper half, on a wide screen the sheet
takes a column, and the map re-measures either way. You can read a panel
about a triangle while looking at the triangle.

**A seat is held by a person.** The council still comes from the geometry —
the solid, the seats, the antipodal critic — but no seat has an occupant
until someone types their name into it. Nothing simulates a resident,
because nothing needs to: the only way a seat speaks is if a person takes
it. Your critic is the seat opposite yours and it is a person too, named on
the map along its strut.

**The conversation is on the map.** Say something and it stays on the
triangle you said it about, drawn there as a mark with a count. A note
attached to a council seat is drawn at that seat's topic, so an argument
sits on the point it is about. The record is kept in this browser under
`icosa.syn.v1` and leaves as a file — no server, no account, so a
conversation is something you carry rather than something you are lent, and
two records merge by import.

## Descending has to reveal, not empty out

A map that shows less the deeper you go is not a map. That was the worst
thing about the first version and it had a single cause: the source. Natural
Earth 110m carries 243 settlements and 13 rivers, so past continental scale
there was nothing left to draw and a triangle became a tan field with a grid
on it.

`icosa-gazetteer.build.mjs` compiles the 10m tier instead:

| | |
|---:|---|
| 7,342 | settlements, with population, province and country |
| 2,528 | named administrative divisions |
| 1,366 | named rivers |
| 1,081 | ports |
| 893 | airports |
| 295 | named seas, gulfs and bays |
| 242 | country outlines, for jurisdiction |
| 235 | named physical regions |

The threshold on what is worth naming falls as the ground gets smaller, so a
cell that held three capitals at continental scale holds villages at
neighbourhood scale. Labels thin themselves on a screen-space grid rather
than piling up.

The gazetteer is a separate file from `icosa-world.data.js` and loads after
the first paint, so the instrument stays lean, the map appears immediately,
and only this page pays the weight.

## Who a concern is addressed to

This is what jurisdiction is for. A triangle is sampled at its centre, its
corners and its edge midpoints against the country outlines, and the
provinces come from the settlements inside it. So the panel can end with a
sentence that is the whole difference between a diagram and an instrument:

> A concern about this ground is addressed to **Egypt**, and below that to
> Al Qahirah, Al Minufiyah, Al Gharbiyah.

And a council seated on that triangle can say where its seats would come
from — the named settlements inside it, and the authorities over them.

When no state claims a triangle, it says so: *there is nobody to address*.
That is a fact about the ground, not a gap.

## Finding the people, and finding the issues

The honest answer has three parts, and the map can only supply two of them.

**The map cannot find people, and should not pretend to.** No register lists
who belongs to a 3 km triangle, and one that claimed to would be exactly the
laundering this project exists to criticise. What the map can do is
structure recruitment: a triangle has an address you can send, the person
who opens it lands on that exact ground, they take a seat by typing their
name, and they can name who should hold the next one. That is snowball
sampling — what field research actually does when there is no register —
and the geometry supplies the thing snowball sampling usually lacks, which
is a fixed number of seats and a defined critic for each.

**An issue is not in a dataset either.** It is a claim somebody made that
somebody else seconded. One person is a complaint; two is an issue. So a
note can be marked a concern, and a concern shows as *raised by one* until
another name seconds it, at which point it is *held by two*. Nothing is
inferred and nothing is aggregated.

**What the map genuinely can do is escalation.** A concern raised on a block
cannot be answered on that block. It has to climb until it reaches a
triangle whose jurisdiction could act on it. Because a cell address is a
prefix code, ancestry is a string test, so the climb costs nothing to
compute: every concern carries the scale at which it is answerable, and it
surfaces at the shallowest ancestor in that band.

The result reads like this. A concern raised at `F11.1103331300` — a 6.9 km
block in the Nile Delta — marked answerable at metropolitan scale, appears
at `F11.110333`, the 110 km triangle over Cairo, as:

> **1** concern raised below has climbed to this scale, because this is the
> scale at which something could answer. Here that is **Egypt**, and below
> it Al Qahirah, Al Minufiyah, Al Gharbiyah.

On the map the block where it was raised carries a hollow mark with an
upward chevron: it did not stay where it was said.

## Context, so nowhere is nowhere

Containment fails at small scale — nothing named is inside a 3 km triangle
and the panel goes quiet. But a triangle is only contextless if you refuse
to ask the other two questions.

- **What is near.** The nearest settlement, river, region, port, airport and
  named water, each with a distance and a compass bearing from the
  triangle's centre.
- **What contains this.** The ladder of ancestors, each with the largest
  thing that scale knows about, so a block reads as a block in a city in a
  delta in a country rather than as an unlabelled triangle. Every rung is
  clickable.

## Asking the wider record, live

The compiled gazetteer stops at about a village, and I had been treating
that as the floor because this build environment cannot reach Wikipedia,
Wikidata, Overpass or any model API — the egress policy refuses them all.

That was the wrong conclusion. **The page runs in the reader's browser, not
on a server.** A published page fetches from their network, and Wikipedia's
API answers anonymous cross-origin requests. So `LOOK UP THIS TRIANGLE`
asks Wikipedia geosearch directly, with no key, no account and nothing sent
anywhere but the query.

A radius query becomes a triangle query by keeping only the results that
actually fall inside the cell — the rest are shown as *nearby*, which is a
different and honest claim. Geosearch caps its radius at 10 km, so for a
larger triangle the panel says it searched the middle rather than implying
it covered the whole thing. Results are cached by address, kept in the same
record as everything else, exported with it, and every item links to the
article it came from.

It degrades: if the network refuses, the panel says so and the compiled
gazetteer is still there.

## The carry, and the flow of information

A syntegration works because every seat sits in two rooms, so what is said
in one is carried into the other **by a person**, and changed in the
carrying — carrying faithfully is not available, and choosing what to lose
is the actual work. That movement is the information flow, and it happens
along a strut.

So `CARRY` is an operation on a seat you hold: it shows you everything said
in your first room, each line with its id, and asks what survives the move
into your second. The carry is recorded with its origin room, its
destination and its seat, and drawn on the map as a dashed line along that
strut with a mark travelling it.

## What a model may do here

Drafting a carry is the one task in the protocol that is genuinely tedious
and genuinely a translation: restating what is already in the room, for a
different room. So a model may draft one, and may not send one.

- It is given only what is in the source room, plus what the sources say
  about this ground.
- Every sentence must end with the bracketed id of the note it came from.
- It is told that adding a fact is the one thing it must not do — not
  context, not background, not a plausible detail — and to answer *nothing
  here carries* if the material does not support one.
- Temperature is zero.
- The draft lands in the text field. **A person edits it and a person
  sends it.** Nothing a model produces is ever stored as somebody's words.

The key is pasted into the page and kept in that browser with the rest of
the record. It is never in this repository, and there is no server to send
it to.

The structure works without any of this: a human writes their own carry and
the protocol is unchanged. The model is an assist on one step, not a
participant.

## Seeing it: water, roads, and areas

The screenshot that prompted this showed the problem: settlements had been
upgraded to Natural Earth 10m and **the coastline never had**. It was still
110m simplified to about six kilometres, painted `#ddd7c6` against a
`#f1eee4` ground — five percent of luminance between sea and land. Past
continental scale the shore was mush and the water was invisible.

Two fixes, and they are different fixes.

**Contrast.** Sea is now a cool tint of its own and land a warm one, with a
darker coastline. A map that cannot distinguish sea from land is not
austere, it is broken.

**Resolution, tiled.** `icosa-detail.build.mjs` compiles the 10m coastline,
lakes, built-up areas and the major road network, **clipped to each root
face at build time** and written as twenty files. A reader downloads the
ground they are looking at — 143 KB on average, 4 KB for an ocean face —
rather than 2.8 MB of planet. It loads on descent past regional scale, which
is where the coarse coastline starts being visibly wrong, and stays off
above it, where the coarse one is fine and the fine one costs 23 fps.

Groups carry a barycentric bounding box so off-screen geometry is rejected
before it is transformed. 37 fps at continental scale and 61 below it, the
same as before the detail existed.

Built-up areas matter more than they sound: they are the only honest way to
paint a city as an **area** rather than a dot.

## Painting an area

A triangle is often the wrong unit. A watershed, a district, a burnt strip
is several triangles and none of them is a triangle. So `PAINT` lets you
drag across the map and mark a set of cells, name it, and keep it.

An area needs no new model — **it is a set of addresses**. Because the
addressing already carries containment and area, a painted region reports
its own extent (three triangles over north Georgia came to 302,369 km²) and
can be argued about exactly like a single cell.

Dragging paints. Tapping one triangle at a time is not circling anything.

## The links live on the map

Everything drawn was painted canvas, which means it was inert. You could not
open a place, copy it, long-press it or send it to anyone — the only
clickable things were in the sheet, describing ground you were looking at
somewhere else. That was backwards.

**A looked-up article is now drawn where it is**, as a real `<a>` anchor
positioned over its coordinates, with a live `href`, `target="_blank"` and
every browser affordance that comes with being an actual link. Canvas text
can do none of that, which is why the panel was never enough. Colliding
anchors stack rather than pile up.

**And everything painted is now askable.** Each mark records where it landed,
so a tap resolves to the thing under the finger before it falls through to
the triangle beneath it. Tapping the Atlanta dot opens *place · Atlanta* —
its province and country, its population, its coordinates, the triangle it
sits in as a clickable address, and two outbound links: Wikipedia, and the
ground itself on OpenStreetMap.

Leaving here goes to somebody else's record, which is the point: it is a
link and not a claim of ours.

## The triangle is the index

Fifty labels over a fourteen-kilometre triangle is not a map. The anchors
collided, the collision rule stacked them, and they became a column down
the middle of the world — covering the ground they were meant to point at,
saying nothing about where anything was, repeating the panel underneath,
and, because a stack is a screen position rather than a place, floating in
mid-air the moment the world folded. The design failed exactly where it
mattered: at density.

The instrument already had an index and was not using it. **A triangle
holding more than a few finds shows how many, and splitting it is how you
read it.** Go into a number and it breaks into four smaller numbers. Go far
enough and the numbers become names.

```
depth 9   ·  40 found        15 numerals painted on the ground
tap 12    ·  2 found         two names, two links
tap       ·  the article
```

Two constants do the whole job — how many names a triangle may show at once
(three), and how small a triangle may get before it stops being splittable
(46 px). Everything else falls out of geometry that was already there:

- **The count is not a badge, it is what the ground says.** The triangle is
  tinted in proportion to what it holds, so density reads before anything
  else does, and the numeral is painted into the triangle rather than sat in
  a box on top of it. Fifteen boxes look like a control panel; fifteen
  tinted triangles look like a map.
- **A number is a door, a dot is a thing.** Tap a count and you descend into
  the triangle that holds it. Tap a mark and you read it. A bin of one is
  drawn as a mark, not as the numeral `1`.
- **It folds, because it is drawn on the face.** Unfold the world and fifty
  articles are one tinted triangle over Korea reading `50`, on the surface,
  in the right place. The old chips could not do this at all.
- **Binning costs nothing per frame.** Each find is addressed once, deep,
  and after that sorting it into a triangle is a prefix test on its path —
  the same trick escalation uses. 61 fps standing still and dragging, with
  fifty finds loaded.
- **A label that will not fit is dropped, never stacked.** Names are packed
  as real rectangles, shortest first, and the counts are reserved before any
  name is allowed anywhere. A dropped label still leaves its dot, and the
  dot is what says the thing is there.
- **The panel stopped repeating the map.** It shows the same four counts
  with their addresses, each one tappable, so it reads as the legend to the
  ground rather than a second copy of it. Names appear there only once a
  triangle holds few enough to list.

The chip itself changed too: the dot inside it now sits exactly on the
coordinate, so the label extends away from its place instead of covering
it, and flips near the right edge.

## Read it where it is

Opening a mark used to raise a sheet — a full-height panel that covered the
map, listed everything, and offered a link that took you off the page
entirely. On a phone that is 1,685 px of content behind a 343 px window,
and the ground you were asking about is gone before you have read a word.

**Wikipedia cannot be framed.** `en.wikipedia.org` sends `X-Frame-Options`,
so an iframe renders blank and no amount of arranging fixes it. But its REST
summary endpoint answers cross-origin, so the extract is fetched and drawn
here, in our own type, in a card **beside the dot**:

```
https://en.wikipedia.org/api/rest_v1/page/summary/<title>
```

The card is 280 px wide and covers about a third of a phone screen instead
of all of it. It carries the first paragraph, the population, the
coordinates, the triangle as a tappable address, and three ways out — the
article, the ground on OpenStreetMap, and `SAY HERE`, which drops you into
the thread for that triangle without leaving.

**The card belongs to the point, not to the screen.** It is placed beside
the mark, and a leader runs from the mark to the card's edge, so which dot
is being read is not a matter of inference. Pan and the card travels with
the ground under it. Turn the point onto the far side of the world, or off
the edge, and the card goes rather than sitting there next to nothing.

Two details that are easy to get wrong and were:

- On a narrow screen there is often no room either side of the mark. The
  first version fell back to centring the card on the dot — covering the one
  thing the card was about. It goes under the mark, or over it, instead.
  (Getting this actually right took a second pass; see *Letting go* below.)
- The opening anchor is already drawn as a signal-coloured ring of exactly
  this size. Two different things looking the same is a lie, so the card's
  subject is a filled disc on a cleared halo instead.

Summaries are cached in the record, so a place read once reads instantly
after that, and reads at all with no network.

### The card takes the room there is

It was capped at `min(46vh, 340px)` and scrolled past that. On a 924×1064
screen that meant a scrollbar hiding half an article while a thousand
pixels of empty map sat around it — hiding data to protect space nothing
was using, which is the wrong way round.

The height now comes from the room a placement actually has. Beside the
mark the card is clear of it whatever its height, so it gets the whole
column; under or over, it gets the gap that is really there. Width went
from 280 to 340 where there is room for it, and the photograph is capped at
132 px because a 200 px photograph in a 340 px card is mostly ink.

Measured on a full Wikipedia extract: **no scrolling at 924×1064, 1280×860
or 390×664, with 100% of the extract visible on all three.** The mark is
still never covered — 32 cards across three viewports, none on top.

## The panel draws the shape it is describing

The address panel spent two thousand pixels describing a triangle and never
drew one:

```
ADDRESS   F02.11        TOUCHES   F02.13 F02.10 F02.22
SCALE     depth 2       INSIDE    F02.1
EDGE      1763 km       CONTAINS  F02.110 F02.111 F02.112 F02.113
CORNER A  41.0°N 74.2°W
CORNER B  33.1°N 62.4°W    ← seven rows of text for three corners,
CORNER C  29.7°N 81.5°W       three neighbours and four children,
                              none of which is a list
```

Every one of those is a *position*. So the cell is now drawn, at the top of
the panel, **oriented the way it is on screen right now** — turn the world
and the diagram turns with it, so the two never disagree about which way is
which. Inside it are the four children it actually has, in the true
subdivision: three at the corners and one inverted in the middle, the way
`childTri` cuts them. Outside each edge is the neighbour that shares it,
placed by reflecting the opposite corner over that edge, which is exactly
where it lies.

Each child carries its digit and what it holds. Each neighbour carries only
what it holds — **a neighbour gets no digit**, because a digit there would
read as a fifth child and the diagram would be lying about what is inside
what. Everything in it is somewhere you can go.

That makes the diagram answer three questions at a glance that the rows
answered nowhere: which way this triangle is facing, which of its quarters
is worth entering, and whether the interesting ground is next door instead.

### It follows you

The first version of the diagram redrew every frame and redrew the same
snapshot: the cell it was built for when the panel opened. Move, and it
went on describing somewhere you had left. A compass that keeps pointing
where you were is worse than no compass, and the rows below it were worse
still — they never changed at all.

So the panel is about the cell **in focus**, the same cell the address
plate names, and it is split by cost:

- **The shape** — which cell, its four children, its three neighbours — is
  three `cellAt` calls, so it follows the focus immediately.
- **The counts and the rows** are eight scans of the gazetteer, which
  cannot run on a pan. They are cached by address and rebuilt once the view
  has been still for 220 ms.

Between the two you get the right triangle at once and its numbers a moment
later, which is the honest order: never the wrong triangle, and never a
number belonging to a cell you have left. While the counts are catching up
the diagram says `COUNTING…` rather than showing stale ones.

Scroll position and the open state of the measurements carry across a
rebuild, or following the map would throw you back to the top of the panel
on every step. And the panel only re-measures the map when it actually
appears or disappears — re-measuring on each rebuild resized the canvas as
you panned.

### Clicking a name goes to the thing it names

A name in a panel that does not take you to what it names is just ink.
Every row that stands for a place on the ground now moves the map to it,
holds it, and reads it there — the panel closes, the map flies, the mark is
ringed, the card opens beside it. Settlements, the nearest things, and the
Wikipedia finds all behave this way. On a find the title stays a real
`<a>`, so the article is still one click and the row is the ground.

### The breadcrumb is the address, drawn

`WORLD ▸ F02 ▸ 3 ▸ 3 ▸ 1 ▸ 2` was digits nobody could read and nobody could
click. A step down this address is a choice of one quarter out of four, so
each step is now drawn as that quarter — filled corner or inverted middle —
and tapping any step goes back to it. The four glyphs are built once,
because the chain rebuilds on every cell change.

### What was cut

The measurements are still true and still there, behind one summary line
that reads `continental · 1763 km edge · 1.25 million km²`. They are just no
longer the first thing you have to read to find out where you are. The
settlement list went from fourteen to eight, since it is now navigable and
the map draws them anyway. And `ADMINISTERED` stopped repeating the country
after every province — six provinces had become six lines of the same
words; the country is only appended when the triangle actually spans two.

The panel went from 2,186 px to about 1,750 px on a phone, and the top of
it is now a picture instead of a stack of rows.

## Filling the seats from the record

A council of empty seats is a diagram, not a body. So the seats are now
filled from Wikidata: who the record actually ties to this ground, ranked,
each assigned to the seat whose ground they are nearest to.

### Why a triangle used to come back empty

Wikipedia's geosearch caps its radius at **ten kilometres**. That is a hard
limit of the endpoint, not a setting. So a 441 km triangle was being
answered by a disc covering about a twentieth of one per cent of it, and a
7054 km face by a rounding error. Anywhere without a town in that
particular disc came back with nothing — and the emptiness was an artefact
of the query, not a fact about the ground. Saying so honestly in the panel
was not the same as being useful.

Wikidata's query service has no such cap. `wikibase:around` takes any
radius, returns everything with coordinates inside it, carries the sitelink
count already attached, and answers cross-origin. It is the primary source
now; the capped endpoint is one of the fallbacks rather than the only door.

**The ladder, in order, and it does not run out:**

| | source | reach | needs |
|---|---|---|---|
| 1 | Wikidata query service | any radius, ranked | nothing |
| 2 | Wikipedia geosearch | 10 km, sampled at up to 10 points across the triangle rather than only its middle | nothing |
| 3 | OpenStreetMap / Overpass | every named settlement in the box — far denser than either, no notability | nothing |
| 4 | the compiled gazetteer | offline, in the page | nothing |
| 5 | a model | what the sources leave thin | your key |

One SPARQL query now does what three chained calls did, and covers the
whole triangle instead of its middle:

```sparql
SERVICE wikibase:around { ?place wdt:P625 ?coord .
  bd:serviceParam wikibase:center "Point(31.2 30.0)"^^geo:wktLiteral .
  bd:serviceParam wikibase:radius "273" . }
?p wdt:P31 wd:Q5 ; (wdt:P19|wdt:P20|wdt:P937) ?place .
?p wikibase:sitelinks ?links .
ORDER BY DESC(?links)
```

Rung 2 also stopped asking in one place. Ten kilometres is all geosearch
will give, so it is asked at up to ten points drawn from the triangle's own
subdivision lattice — which is why a 14 km cell that previously had to
climb two rungs to fill its bench now fills it from one.

**The ranking is stated, not implied.** Three terms, weighted:

```
local      1 / (1 + levels ascended)      × 0.55
reach      log10(sitelinks) / 2.4         × 0.30
attention  log10(pageviews) / 6.5         × 0.15
```

Locality is heaviest on purpose. A council for *this* ground that returns
the same six global names at every scale is not a council for this ground.
`sitelinks` — the number of language editions with an article about someone
— is the best available reading of "most cited"; it is robust, it is not
English-centric, and it comes free with the call that fetches their name.

**It never returns an empty seat, at any scale, in three layers.**

1. **The ladder.** A cell address is a prefix code, so ascending costs
   nothing. If a 14 km triangle knows nobody, its parent is asked, then its
   parent — up to the face, and a face of the Earth always knows someone.
   The climb stops as soon as every seat can be filled, or after two rungs
   running that add nobody new, and never exceeds eight rungs.
2. **Every name says where it came from.** `from this ground` or `from
   441 km up`, on the row. A borrowed name is visibly borrowed.
3. **Ground, with no network at all.** A seat is a strut between two
   topics, and a topic is a real point on this cell. The compiled gazetteer
   names what is nearest each of them offline, so every seat reads *speaks
   for Dumyat ↔ Ismailia* even when nothing has answered and nobody has
   been found.

**Geometry does the assignment.** Each seat's strut has a midpoint on the
sphere; a person is given to the seat whose midpoint their tied place is
nearest, highest score choosing first, nobody sitting twice. This is why
the pipeline pulls `claims` as well as labels — without knowing which place
each person is tied to, "assigned to the nearest seat" would have been a
sentence rather than a fact. A parent's answer is cached and serves every
cell inside it, so descending is instant after the first ask.

### The topics are subjects now, not coordinates

A topic used to read `TOPIC 3 · 30.8080°N 32.3046°E · ABSENCE · BODY ·
CATEGORY`, which is a location and a list of lenses, and no subject at all.
But a topic point is real ground, so the record can say what is there:

```
TOPIC 3   Nile Delta
          a place in Egypt · 30.8080°N 32.3046°E
          ABSENCE · BODY · CATEGORY · COORDINATE
```

The name is the most-read article at that point — one geosearch per topic,
ranked by pageviews — and it links out and moves the map when tapped. When
the network says nothing, the compiled gazetteer names the nearest
settlement, sea or named region instead, which is why the twelve planetary
topics (all of them at sea, by construction) still come back named. A topic
is never blank at any scale, with or without a network.

### The key was leaking into the record

`DB.key` held the OpenAI key, `commit()` writes `DB` to localStorage, and
`TAKE THE RECORD` serialised `DB` straight into a file. That file is the
one thing this instrument exists to hand to other people. Exporting an
atlas exported the key with it.

The key now lives in `sessionStorage` and never touches `DB`. A key found
on an older record is moved off it on load, the export scrubs again on the
way out, and an imported record arriving with a key does not get to keep
it. It is held for one browser tab, and the panel says so.

### The model is an instrument of the triangle, not a textbox

The old call was Chat Completions with a hard-coded `temperature`, the
older JSON-object mode, and `gpt-4o-mini` baked into the source — which is
exactly the shape that breaks the moment you type a current reasoning model
into the box.

**The core is the Responses API now:** `instructions` separate from
`input`, structured output by strict JSON Schema rather than by asking
nicely, `reasoning.effort` where the model takes it, `store: false`, a
`prompt_cache_key`, and **no temperature at all** — several current models
reject an arbitrary one and none of them need it here.

**The model list comes from the account.** `/v1/models` is asked once the
key is in, filtered and ranked, and offered as a selector with `AUTO` at
the top. A new generation ships and it appears without a source edit.

**And it is given the world state, not a paragraph.** The old prompt got a
sentence about rivers. What makes this project worth building is the
structure, and none of it was reaching the model. So the context is
compiled and addressed:

```
icosa-context-v2
  focus         address, scale, depth, edge, area, centre, corners
  containment   parents, children, neighbours
  ground        countries, admin1, settlements with populations,
                rivers, water, regions, airports, ports, nearest things
  council       solid, topics with their issue and provenance,
                seats with topics, critiques, register, holder,
                and whether the holder came from record, model or hand
  discourse     said here, carried between rooms, concerns arriving
                by escalation, concerns still below
  evidence      wikidata with sitelinks and the scale found at,
                wikipedia, gazetteer count, painted areas covering this
  operation     type, may_infer, may_invent_sources, may_mutate_record
```

The pipeline is **triangle → retrieve → assemble context → reason →
structured proposal → a human accepts → record**, and no server-side
conversation memory is used. The memory is recompiled from the local
record every call, because addressable inspectable knowledge is the whole
claim and opaque remote state would quietly break it.

**Context engineering you cannot see is a claim, not a property**, so the
council panel shows it before anything is asked — the model and whether it
takes reasoning, the context size, how many neighbours and ancestors are in
scope, topics and seats and how many are held, what discourse is included,
what evidence and from where, and that provenance is on. `SHOW THE CONTEXT`
prints the entire object.

### The fifth rung: what no database holds

Four sources answer without a key and cover most of the planet. What none
of them holds is the part of a syntegration that is not a lookup at all —
**the statements of importance**. A syntegration begins by asking a group
what is actually at issue on this ground, and no gazetteer has that.

So the last rung is a key you supply, kept in this browser and sent nowhere
but OpenAI. It fills exactly two things, and only what the free rungs left
thin: a statement of importance for each topic that has nothing but a place
name, and candidate people for seats the record left empty. It is handed
the ground — jurisdiction, provinces, settlements with populations, rivers,
water, and whoever was already found — and told to work from it.

```
TOPIC 0   Dumyat
          Who controls the barrage releases when the delta salts up in August
          settlement · 32.5584°N 31.5843°E · the compiled gazetteer ·
          issue inferred by the model
          BODY · CATEGORY · COORDINATE · RECORD
```

**Everything it produces is stamped, and the stamp is the feature.** An
inferred seat is dashed and grey where a cited one is solid and signal-red,
and it reads *inferred by the model · not a citation, not checked · the
link is a search, not a source*. Its link really is a search, because there
is no article to point at — the href has to match what the stamp claims it
is. When the model says it is unsure, the row says that too.

There are now three kinds of name a seat can hold, and no two of them are
allowed to look alike: **from the record** (a citation with a place
attached), **inferred by the model** (a guess), and **claimed by hand** (a
person). The moment those three become indistinguishable the council is
worthless.

The model runs automatically, but only after the free rungs have finished,
only if a key is present, and only for what is still thin. No key means no
call, and the bench is still full from the gazetteer.

*One bug worth recording:* the first version gated this on `!PEOPLE_STATE`,
which is false once a rung has **failed** — so the model was locked out by
exactly the emptiness it exists to fill. It now waits for the free rungs to
be *done*, not to have succeeded.

### Nothing has to be clicked

Opening a council asks the record immediately — people and topics at once —
and the seats claim themselves the moment it answers. Ten calls for a
twelve-seat bench; cached per cell afterwards, and a parent's answer serves
every cell inside it, so descending is instant.

The claim carries a stamp saying where the name came from. That stamp is
what makes auto-filling honest rather than laundering: a seat filled from
the record says **from the record · found on this ground · 215 languages ·
4,100,000 reads · not a person who agreed to sit**, and a seat somebody
typed says **claimed by hand**. Typing over a filled seat deletes the stamp
and the seat becomes yours. `CLEAR THE FILLED SEATS` empties every
record-filled seat and leaves hand-typed ones alone, because those are
somebody's and not the record's.

### A nomination is not a seat

This is the one line the feature rests on, and it is on every row.

The bench arrives full, and every row says which kind of full it is. A name
from the record is a citation with a place attached; a name typed by a
person is a claim. The two are never allowed to look the same, and the
distinction survives in the record itself — `DB.seats` holds the name,
`DB.seatSrc` holds where it came from, and clearing one clears the other.

I argued against filling seats this way and was overruled, which is
recorded here because the reasoning still applies: a dead novelist cannot
answer a critic, and ranking by fame optimises for notability when the
geometry is built to stop anyone optimising a single end. Read the filled
bench as *what the record says about this ground*, which is a real and
useful thing, and not as *who is in the room*. The stamp on every row is
what keeps those two readings apart.

### Untested against the live endpoints

This environment's egress refuses `en.wikipedia.org` and `www.wikidata.org`
outright — 403 at the proxy, the same wall the live lookup hit. The
pipeline is proved against recorded response shapes: the ascent, the
ranking, the geometric assignment, the caching, the offline floor and the
failure path all work. Whether Wikimedia answers *your* browser is
something only your browser can settle.

## Letting go

Everything here sticks, which is the point: a triangle stays picked, a
trace stays drawn, a council stays seated, a card stays open. But there was
no way back to nothing except `Esc` — a key a phone does not have — and
tapping the map only ever picked something *else*. You could get in and
never out.

**Tap the triangle you already have and it releases.** The way out is the
same gesture as the way in, and the same goes for a mark you are already
reading. No new furniture, no mode.

**When the map is holding anything, a `DROP` button appears naming what it
will let go of.** It peels one layer at a time, most recent first:

```
CARD → PRESS → TENSION → TRACE → COUNCIL → HOLD → TRIANGLE → PAINT
```

The button says the layer, so you know what you are about to lose before
you lose it. Painted work is last in the order because it is the only thing
here that somebody actually made. `Esc` peels the same stack, one press per
layer, so the key and the button are one model rather than two — this
replaces the old `Esc`, which cleared everything at once and cleared
neither the card nor the brush.

### A bug this turned up

Making the mark tappable-again exposed that the card could still land on
top of it. The placement chose a side and *then* clamped into the viewport,
and those are not the same thing as not covering the dot: a tall card on a
low mark got pulled straight back over it — so the earlier claim that the
mark stayed visible in every case was wrong.

Each candidate position is now clamped first and rejected if the clamped
rectangle contains the mark, and if no candidate survives the card is
shortened to whichever side has more room. The first attempt at that
shortening had a floor of 110 px, which is the same mistake in a smaller
form: a floor larger than the available room puts the card back on the
mark. Checked across 390×380, 390×664 and 1280×860 — 32 cards, none on top
of its mark. Below about 90 px of stage there is nowhere clear to put it,
and the ✕ is the way out.

## What it still does not do

Being plain about this, because the gap is the interesting part.

- **The empty map over Siberia is the source, not the drawing.** Two
  hypotheses were tried and both measured and dropped: making the
  population threshold adapt to how full the screen is (no change on three
  views, and it *thinned* a dense one from 1.19% to 0.61% ink), and
  tightening the label-collision grid from 74×15 to 50×12 px (0.37 / 0.40 /
  0.47 → 0.37 / 0.40 / 0.47 — no change at all). Neither was the binding
  constraint: at those scales the map is already drawing every place the
  gazetteer has in view. The lever for a sparse triangle is the live
  lookup, not the renderer.
- **The gazetteer stops at about a village.** Below roughly 5 km a triangle
  divides the ground without telling you more about it, and the panel says
  so rather than pretending. Street-level naming would need Wikidata or
  OpenStreetMap, and `query.wikidata.org` and `overpass-api.de` are both
  refused by the egress policy in this environment — unlike
  `raw.githubusercontent.com`, which is how the Natural Earth tiers got in.
- **Population is a floor, not a count.** It sums the settlements the
  gazetteer knows, so it undercounts everywhere and undercounts worst where
  settlements are small and many.
- **No model speaks as anyone.** It drafts one step and a person sends it.
  A council of synthetic voices over an empty triangle remains the thing
  this project exists to criticise. Nominating a name from Wikidata does
  not change that: a nominee is a citation, not an occupant, and nothing
  in this build makes one talk.
- **The live lookup is untested against the real endpoint.** It cannot be
  reached from the environment this was built in, so the plumbing was
  proved against a stand-in: the failure path, the radius, the
  inside-versus-nearby filter and the caching all work, but whether
  Wikipedia answers your browser is something only your browser can settle.
- **The record is local.** Two people in the same room can each hold a seat
  and merge records by file. Two people in different rooms cannot yet, and
  until they can, escalation is a demonstration rather than a channel: a
  concern climbs to the scale where an authority exists, and then stops,
  because there is nothing to hand it to.
- **Nobody is notified.** Naming the addressee is not the same as reaching
  them. The map can say a concern belongs to Al Qahirah; it cannot post it.
- **`icosa-world.html` is unchanged.** It remains the instrument: the
  geometry, the fold, the invariants, the compiled councils. This fork is
  where the argument about consequence happens.

## Grammar

Everything from `icosa-world`, plus:

- **tap the address plate** — corners, area, contents, and the link
- **the diagram at the top of WHERE** — four children inside, three
  neighbours outside, each carrying what it holds; tap any of them to go
- **any named row** — moves the map to it and reads it there
- **a step in the breadcrumb** — the quarter it took; tap to go back to it
- **tap the same triangle again** — let it go
- **DROP** — appears when the map is holding something, and names it
- **tap a number** — the count of what a triangle holds; going in divides it
- **tap a mark on the map** — the card, beside the dot: what it is, what is
  written about it, and the way out to the article or the ground
- **WHERE** — the same, from the action ring
- **SAID** — the thread on this triangle, what has climbed to it from
  below, and the field to add to it. Tick *a concern* and choose the scale
  at which it could be answered.
- **COUNCIL** — the seats, each one claimable by name

The compiled geometry, the solid family and the register assignment all come
from `icosa-world.data.js` unchanged. See `ICOSA-WORLD.md` for how those are
derived.
