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

Invariant 3 is the one worth watching, because the neighbour of a cell at
the edge of a root face lives on another face, in another part of the net,
at another orientation, and the test does not care: it asks the sphere.
Invariant 4 is measured rather than asserted — if a seam were an event, a
neighbour's centre would be further away than a cell is wide.

Invariants 5, 6 and 7 are not arithmetic and are not claimed to be:
adaptive detail, one-finger operation and never being lost are properties
of the interface, and the way to check them is to use it on a phone.

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
