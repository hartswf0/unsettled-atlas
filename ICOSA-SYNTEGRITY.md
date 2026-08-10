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
- **No model writes anything.** Deliberately, and still. A council of real
  people over a grounded dossier is worth building; a council of synthetic
  voices over an empty one is the thing the whole project exists to
  criticise.
- **The record is local.** Two people in the same room can each hold a seat
  and merge records by file. Two people in different rooms cannot yet.
- **`icosa-world.html` is unchanged.** It remains the instrument: the
  geometry, the fold, the invariants, the compiled councils. This fork is
  where the argument about consequence happens.

## Grammar

Everything from `icosa-world`, plus:

- **tap the address plate** — corners, area, contents, and the link
- **WHERE** — the same, from the action ring
- **SAID** — the thread on this triangle, and the field to add to it
- **COUNCIL** — the seats, each one claimable by name

The compiled geometry, the solid family and the register assignment all come
from `icosa-world.data.js` unchanged. See `ICOSA-WORLD.md` for how those are
derived.
