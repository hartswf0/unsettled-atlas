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
  thing the card was about. It now goes under the mark, or over it, and the
  mark stays visible in every case.
- The opening anchor is already drawn as a signal-coloured ring of exactly
  this size. Two different things looking the same is a lie, so the card's
  subject is a filled disc on a cleared halo instead.

Summaries are cached in the record, so a place read once reads instantly
after that, and reads at all with no network.

## What it still does not do

Being plain about this, because the gap is the interesting part.

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
  this project exists to criticise.
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
