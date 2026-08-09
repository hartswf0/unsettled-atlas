# ICOSA WORLD

A planetary instrument. `icosa-world.html`

> A place is not a point on a map. A place is a triangle inside larger
> triangles connected by forces to other triangles.
>
> Do not zoom into the world. Let the world unfold around attention.

---

## Theory of the program

A world map should not be a flat picture of a sphere. It should be a
continuously unfolding planetary structure.

The fundamental object is not the map. It is the triangle. Twenty
triangles describe the planet at the first scale. Every triangle can
subdivide into smaller triangles, and every smaller triangle can subdivide
again, so the same structure represents the Earth, a continent, a city, a
building, or a point beneath a finger. The map has no privileged scale.

The Dymaxion map supplies the planetary topology. The icosahedron supplies
the computational primitive. Tensegrity supplies the behaviour between
parts. The mobile screen supplies the constraint. What results is neither a
globe, nor a slippy map, nor a static Dymaxion projection, nor a GIS
viewer, nor a 3D model. It is a world instrument.

### Entities

| | |
|---|---|
| **World** | The conceptual Earth. It has no native screen representation; everything shown is a projection of it. |
| **Icosahedron** | The root structure. Twenty faces, thirty edges, twelve vertices. Every location on Earth belongs to one root face. |
| **Face** | The fundamental container. A face contains four child faces, each of which contains four more. There is no conceptual bottom. |
| **Cell** | A triangle at any depth: id, parent, children, three neighbours, geographic extent, scale, content. A country is not fundamentally a polygon. It is a phenomenon intersecting cells. |
| **Vertex** | A junction. Vertices matter because information propagates between faces through them: they are meeting points between spatial systems, not only geometry. |
| **Edge** | An adjacency relation. The edge matters more than the border. A political boundary may lie across an edge, but the edge represents *what can pass between two places* — water, people, weather, trade, language, conflict, attention. |
| **Strut** | A compressive relation: something maintaining separation or structure. A mountain range, an institution, a jurisdiction, a distance. |
| **Tendon** | A tensile relation: something pulling separated locations together. Migration, trade, a river system, a supply chain, a shared event. |
| **Anchor** | The currently meaningful place — not necessarily the centre of the screen. The map reorganises around the anchor. |
| **Scale** | Not zoom. The current level of spatial consequence, from Earth to event. |

Because places pull, resist, support and transmit, the visible world is a
tensegrity system rather than an arrangement of things sitting next to each
other.

### Operations

`FOLD` net → hinged plates → icosahedron.
`UNFOLD` the reverse, and not one canned animation: the faces behave like
connected physical plates.
`ENTER` a triangle expands and its four children become available, while its
neighbours remain spatially understandable. This replaces zoom.
`EXIT` return toward the parent. Nothing teleports.
`TURN` rotate the world through its adjacency graph, without assuming north
is up.
`PULL` select a relation; two places exert visible tension on one another.
`PRESS` select a structural constraint; the system reveals what resists.
`TRACE` follow a phenomenon across triangles, so the map reorganises around
the phenomenon rather than around political borders.

### Conditions

Every operation occurs under conditions, and the interface exposes an
action only when it is possible — there is no permanent toolbar of
irrelevant operations.

- `ENTER` requires a visible triangle with available children.
- `EXIT` requires a cell with a parent.
- `FOLD` requires multiple root faces visible.
- `TRACE` requires a phenomenon associated with more than one cell.
- `PULL` requires at least two entities connected by a relation.

### Invariants

1. Every point on Earth resolves to exactly one position in the
   hierarchical triangular system.
2. Subdivision never destroys the parent; the world remains navigable
   backward.
3. Neighbours remain neighbours across scale. The representation may
   change; the topology may not.
4. Crossing an icosahedral seam must feel continuous. A seam is a
   projection artifact, not a geographical event.
5. Detail increases only where attention demands it. The planet is never
   rendered at maximum resolution.
6. The world remains manipulable with one finger. Any feature requiring
   desktop precision violates the system.
7. The user must never become spatially lost. At every depth the system
   preserves evidence of where I am, what contains this, what touches
   this, and how I return.

### The deeper claim

The conventional digital map assumes `world → projection → image →
viewport`. This program assumes `world → topology → recursive cells →
relations → temporary projection`. The projection is disposable; the
topology remains. The same object can therefore become a globe, a Dymaxion
map, an icosahedron, a local map, a network, a timeline, a causal system,
or a conversation without changing underneath.

---

## How the program keeps those promises

### Barycentric weights, not pixels

Each root face carries an inverse basis. A direction on the sphere resolves
into three weights against the face's three corner vectors, normalised to
sum to one. Because a gnomonic projection sends great circles to straight
lines, those weights *are* the flat coordinates of the face. Two
consequences follow, and they are what make the rest cheap:

- Subdividing a triangle at the midpoints of its weights is exactly
  subdividing it at the great-circle midpoints of its edges. The hierarchy
  is exact on the sphere at every depth — invariants 1 and 2 are arithmetic,
  not approximation.
- A cell is a face plus a path of child indices (`F14·0222·2222`). Its
  corners are recomputed from the root by four-way subdivision, so the
  parent is never stored away and never lost.

The weights of a point and of its antipode normalise identically, so the
face test also requires the unnormalised sum to be positive. Without that,
half the world resolves to the wrong side of the planet.

Neighbours are found by stepping a short distance outward from an edge
midpoint and asking the sphere which cell is there. That question is
answered the same way at a seam as anywhere else, which is how invariants
3 and 4 hold without special-casing the seams.

### Folding

The net is a spanning tree of the twenty faces. Nineteen edges stay hinged
and eleven are cut. Folding rotates every hinge by the same angle at once —
each face's transform is its parent's transform composed with a rotation
about the hinge line — so the faces move as connected plates and the
polyhedron closes exactly at 41.81°, the icosahedron's supplement of the
dihedral angle. The fold runs both ways continuously and can be stopped
anywhere.

The net folds *away* from the viewer. Folding toward the viewer turns the
world inside out, which is worth stating because it is not obvious until
you are looking at the far side of the Earth through the near side.

### Detail

Three zones, as the theory requires. The grid subdivides only where a
triangle is still large on the screen and still on the screen at all, so
what is active is drawn finely, what is near is drawn coarsely, and
everything else is represented by an ancestor. Visible complexity stays
roughly constant while conceptual resolution goes as deep as you take it.

Coastlines are clipped to each face once, on the sphere, and stored as face
weights. After that they cost nothing to fold: they are carried by the face
they belong to.

Depth is capped at 30 here — a cell edge of about 7 mm — which is a limit
of this build, not of the structure.

### Two geometries at once

Surface geometry answers *where is it*. Relational geometry answers *what
holds it in relation to everything else*. `TENSION` relaxes the places
toward what pulls them while the ground stays where it is, so a distant
place can be watched becoming structurally near. A tendon is drawn as a
chord through the body of the world; a strut stands off it.

`PRESS` shows the map's own compression: the eleven cuts. In the folded
world they close. In the flat world they are the outline of the map, and
the distance between a cut's two lips is the artifact.

---

## What is derived, and what is declared

`icosa-world.build.mjs` compiles `icosa-world.data.js`. It owns all
geometry; nothing in the map is hand-placed.

**The icosahedron's orientation is solved, not transcribed.** Fuller chose
an orientation whose twelve vertices fall in water so that no vertex
punctures a landmass. Rather than copy his published table, the compiler
restates the criterion and searches SO(3) for the rotation maximising the
minimum distance from any vertex to any land, against a 2° land mask built
from the coastline source. The result puts every vertex offshore, the
closest 267 km out:

| | latitude | longitude | clearance |
|---:|---:|---:|---:|
| 0 | −16.01° | −92.64° | 1764 km |
| 1 | −13.17° | −26.89° | 1122 km |
| 2 | 40.99° | −62.61° | 447 km |
| 3 | −27.57° | 39.79° | 593 km |
| 4 | 75.30° | 129.68° | 267 km |
| 5 | −32.71° | −161.01° | 2096 km |
| 6 | 27.57° | −140.21° | 2037 km |
| 7 | −75.30° | −50.32° | 412 km |
| 8 | 32.71° | 18.99° | 267 km |
| 9 | 16.01° | 87.36° | 556 km |
| 10 | 13.17° | 153.11° | 2211 km |
| 11 | −40.99° | 117.39° | 667 km |

**The net is solved the same way.** Each of the thirty edges is weighted by
how much land its arc crosses; a maximum spanning tree keeps the
land-crossing edges hinged and leaves the ocean ones to be cut. Trees that
overlap when unfolded are rejected, and among the rest the compiler prefers
a compact sheet. The cuts cross 0.40 edge-lengths of land in total out of
eleven — the price of flattening a sphere, paid where it is cheapest. It is
not zero, and the map does not pretend it is: `PRESS` shows where it was
paid.

This is not Fuller's net. It is a net derived from Fuller's criteria.

**Source geometry.** Natural Earth 110m — land, lakes, rivers, populated
places — public domain, fetched by the build script and cached under
`.cache/`. Simplified to about 0.055°, which is roughly 6 km. Below that
edge length the readout says `past the source`: the triangles keep going
and the coastline does not. What a deep cell carries is its identity, its
extent, its neighbours, and its relations.

**Fixture declares itself.** The relations are the five the theory names,
and no others:

```
Atlanta ↔ Savannah                  logistics    tendon
Atlanta ↔ Washington                governance   strut
Atlanta ↔ Lagos                     diaspora     tendon
Atlanta ↔ Ashburn                   computation  tendon
Atlanta ↔ Chattahoochee Headwaters  watershed    tendon
```

Savannah, Washington, Ashburn and the Chattahoochee headwaters are not in
the source place set; their coordinates are declared in the program and
labelled as fixture. Ashburn stands for "the global cloud" on the ground
that the cloud has an address. The phenomena available to `TRACE` are the
thirteen named rivers in the source, traced through the cells they actually
pass through.

### Checking rather than asserting

The invariants are claims about the structure, so the program can check
them. Load `icosa-world.html?verify` and it tests them in the browser
against random points on the sphere:

| | | |
|---|---|---|
| 1 | one point, one face | 4000/4000 points, 0 ambiguous |
| 2 | the cell holds its point, and so does its parent | 1200/1200 to depth 18, 0 orphaned |
| 3 | neighbours are mutual and share two corners | 2700 relations, 0 broken |
| 4 | a seam is a step, not an event | widest neighbour gap 0.690 of a cell edge |

and the council claims, checked against the compiled solid:

| | | |
|---|---|---|
| 1 | a council cannot be scaled by subdividing the world | five-valent topics at frequency 1/2/4/8: 12, 12, 12, 12 |
| 2 | the icosahedron is the closure ceiling | 66/66 topic pairs covered; nothing larger keeps closure |
| 3 | every seat is critiqued by its opposed register | 4 solids seated |
| 4 | no room is all one kind of description | tetrahedron 4/4, octahedron 6/6, cube 8/8, icosahedron 12/12 |

Invariant 3 is the one worth watching, because the neighbour of a cell at
the edge of a root face lives on another face, in another part of the net,
at another orientation, and the test does not care: it asks the sphere.
Invariant 4 is measured rather than asserted — if a seam were an event, a
neighbour's centre would be further away than a cell is wide.

Invariants 5, 6 and 7 are not arithmetic and are not claimed to be:
adaptive detail, one-finger operation and never being lost are properties
of the interface, and the way to check them is to use it on a phone.

---

## Councils

The same solid, used twice. Above, the icosahedron holds the Earth: twenty
faces of ground, twelve vertices in the sea. Stafford Beer's Team Syntegrity
spends the same object on discourse — the thirty edges are thirty people,
the twelve vertices are twelve topics, everyone sits in exactly two rooms,
and the geometry rather than a chairperson guarantees that what is said
comes back. `icosa-world.data.js` had shipped the thirty struts since the
first build and never read them. This is the other half of the solid.

### You cannot scale a council by subdividing the world

The obvious way to give a bigger cell a bigger council is to subdivide. It
does not work, and the reason is not practical:

```
frequency 1:   12 topics,   30 people,  degrees 12×5
frequency 2:   42 topics,  120 people,  degrees 12×5,  30×6
frequency 4:  162 topics,  480 people,  degrees 12×5, 150×6
frequency 8:  642 topics, 1920 people,  degrees 12×5, 630×6
```

Twelve fives, forever. Every geodesic subdivision of an icosahedron has
exactly twelve five-valent vertices and all the rest six-valent, at any
frequency — Euler's formula, the same fact that puts twelve pentagons on a
football. For a map this is nothing; a vertex is a junction. For a council
it is fatal, because topic size *is* vertex degree: twelve people would sit,
permanently and structurally, in smaller rooms than everybody else, and the
whole claim of the method is that no seat is a better seat.

Subdivide to change scale. Change solid to change headcount. Never confuse
the two recursions.

### The icosahedron is the ceiling, not a choice

Every candidate solid was built and asked the same questions. `closure` is
the share of topic pairs sharing at least one person once member and critic
seats are both counted — the property that makes reverberation a guarantee
rather than a hope.

| solid | people | topics | per topic | closure | diameter |
|---|---:|---:|---:|---:|---:|
| tetrahedron | 6 | 4 | 3 | 6/6 | 1 |
| octahedron | 12 | 6 | 4 | 15/15 | 2 |
| cube | 12 | 8 | 3 | 28/28 | 3 |
| cuboctahedron | 24 | 12 | 4 | 54/66 | 3 |
| **icosahedron** | **30** | **12** | **5** | **66/66** | **3** |
| dodecahedron | 30 | 20 | 3 | 70/190 | 5 |
| rhombicuboctahedron | 48 | 24 | 4 | 108/276 | 5 |
| icosidodecahedron | 60 | 30 | 4 | 135/435 | 5 |

Every one of them admits critic seats — each strut has an exact antipodal
partner and all four of its topics stay distinct, which is true even of the
tetrahedron, whose *vertices* are not centrally symmetric although its edge
midpoints are.

But closure dies above thirty. The icosahedron is the largest solid in the
family where every pair of topics still shares a person. Bigger solids do
not host bigger syntegrations; they host sparser ones. They buy headcount
and pay for it in reverberation, and the build fails if that ceiling ever
moves.

### The ladder

So a council is chosen by how much world a cell holds, not by how many
people are available:

| cell edge | scale | solid | people | topics |
|---|---|---|---:|---:|
| ≥ 2500 km | EARTH | icosahedron | 30 | 12 |
| ≥ 700 km | CONTINENTAL | icosahedron | 30 | 12 |
| ≥ 150 km | REGIONAL | cube | 12 | 8 |
| ≥ 20 km | METROPOLITAN | octahedron | 12 | 6 |
| ≥ 4 km | NEIGHBOURHOOD | octahedron | 12 | 6 |
| ≥ 0.8 km | BLOCK | tetrahedron | 6 | 4 |
| below | BUILDING and down | — | — | — |

Bounded at the top by closure and at the bottom by the tetrahedron: six
people over four topics is the smallest structure that can seat member and
critic roles at all. Below it the readout says `below the smallest solid`
and `COUNCIL` disappears from the actions, the same way every other
operation appears only where it is possible.

The consequence is the interesting part. A planetary problem is not handled
by growing the solid — it is handled by **tiling the sphere with small
councils and letting the map's own adjacency carry the resonance between
them**. Cells already know their three neighbours, their parent and their
four children, and invariant 3 guarantees that adjacency survives a change
of scale. Beer got closure inside one solid. The map supplies closure
*between* solids, which is exactly the implementation gap the method is
criticised for: the output of a council is bound to a cell and stays there,
rather than being handed upward to a hierarchy that rejects it.

### Registers, not people

The seats are ways of describing a place. Nothing here simulates a
resident, and that is a rule rather than a limitation: synthesising
testimony and attaching it to a real place is precisely the laundering this
apparatus exists to expose.

| register | may | may never |
|---|---|---|
| `COORDINATE` ↔ `BODY` | report what the measured record contains, with its source | say anything the record does not contain |
| `BODY` ↔ `COORDINATE` | derive the bodily consequence of a cited fact, marked as a derivation | invent testimony, or speak in the first person for anyone |
| `RECORD` ↔ `ABSENCE` | speak only with a citation, and stay silent otherwise | assert anything uncited |
| `ABSENCE` ↔ `RECORD` | name the schema slots with no entries for this cell | explain why they are empty |
| `CATEGORY` ↔ `RECURSION` | name the classification in force and who authored it | say the classification is correct |
| `RECURSION` ↔ `CATEGORY` | point to a description that has already returned as environment | predict |

Two of those are computations rather than voices, which is what keeps them
honest: `ABSENCE` reports schema slots the compiler finds empty, and `BODY`
performs its derivation from a citation and is tagged as derived.

The registers are then seated on the solid so that the geometry enforces the
epistemology instead of a facilitator. Every strut is critiqued by its
antipodal strut, and the antipodal strut carries the *opposed* register —
coordinate answered by body, record answered by absence. At the same time
every room hears as many different registers as it has seats. Both
constraints hold simultaneously and exactly, on all four seated solids:
tetrahedron 4/4, octahedron 6/6, cube 8/8, icosahedron 12/12, with the six
registers balanced at five struts each on the icosahedron.

What that buys is not decoration. **A room cannot be all data or all
anecdote, because the seating chart forbids it.**

And the twelve planetary topics have addresses — all of them at sea, the
closest 267 km offshore. That is not a decision about agendas; it falls out
of solving for no vertex on land. The planetary agenda sits in
international waters, where no jurisdiction can claim it.

### Not yet built

No council has been convened. The compiler derives the structure; it does
not fill it. Two things come next, in this order, because the order is the
safeguard:

1. **A dossier per cell** — heritage and historic sites with coordinates and
   source ids, plus a computed absence table of the schema slots with no
   entries. The dossier is what makes a council not-fabrication, so it must
   exist before anything is allowed to speak.
2. **The council itself**, compiled offline and committed as an artifact
   with its model, version, date and dossier hash on its face — never served
   live from a page, never holding a key.

Under one rule, which is the framework's own *Translational AI* used as an
engineering constraint rather than a slogan: **no model may assert ground
truth.** A model may only translate between registers of description that
already exist in the dossier. Every utterance carries its citations or is
rendered visibly as unsourced, in the same voice the map already uses when
the coastline runs out.

The atlas states the risk plainly because the risk is ours: if synthetic
deliberation about a real triangle is read as an account of a real
neighbourhood, the grid arrives as description and returns as environment.
So a council is a declared fixture, dated and bound to its cell — and this
place, like the others, alters what it measures.

---

## Grammar

One finger:

- **drag** — turn a folded world; slide a flat one
- **tap** — the triangle becomes the interface
- **double tap** — enter
- **long press** — hold a place as anchor

Two fingers:

- **pinch** — descend and ascend the scale
- **twist** — fold toward the icosahedron, unfold toward the map

No minimap: the surrounding triangular hierarchy performs orientation. No
permanent zoom buttons: scale is spatially embodied. No layer drawer:
phenomena appear by asking for them or by touching relationships.

Desktop equivalents exist — wheel scales, shift-wheel folds,
enter/backspace enter and exit, `f` folds, `esc` clears — but the phone is
the constraint the design answers to.

---

## Build

```
node icosa-world.build.mjs
```

Writes `icosa-world.data.js`. The search is seeded deterministically, so
the same orientation and the same net come out every time.
