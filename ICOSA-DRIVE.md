# ICOSA DRIVE

A planetary land selector you can fall into. `icosa-drive.html`

> The triangle was always an address. Now the address is a deed:
> descend far enough into any cell on Earth and the cell stops being
> a name for ground and becomes the ground — real relief, real
> imagery, drivable, with the next triangle waiting past every edge.

This is the fusion of two prior instruments, and it is a **new copy** —
neither parent is modified:

- **ICOSA SYNTEGRITY / ICOSA WORLD** contribute the grid: twenty faces,
  exact 4-way triangular subdivision in face-weight space, addresses like
  `F11.1103`, and the theorem that every point on Earth resolves into
  exactly one cell at every depth.
- **THUNDER RIGS (05)** contributes the land: terrarium elevation tiles +
  Esri World Imagery fetched for a geographic window, draped as a
  heightfield, collided as one analytic ground function, and sealed into
  `unsettled.landpack/v1` documents that remount offline.

The fusion is one sentence: **the triangular grid is the world's land
selector, and driving is what a triangle means at street scale.**

---

## Theory of the program

A slippy map answers "where" by letting you pan forever at every zoom.
A driving game answers "what is it like to be there" for one hand-picked
tile. Neither can hand its answer to the other: the map has no body, the
game has no world.

The icosa grid already solves the handoff. A cell is simultaneously

1. a **name** (`F07.2013` — sendable, linkable, citable),
2. a **region** (three corners on the sphere, an area in km²), and
3. a **container** (four children, one parent, three neighbours it
   meets edge-to-edge).

So selection is not a search box. It is *descent*: you spin the globe,
tap a triangle, tap one of its four children, and each tap divides the
world by four. Twelve to fifteen taps take you from the planet to a
street. At that point the cell's region is small enough to be fetched as
real terrain, and the program changes register — from selector to
vehicle — without changing its object. You are still inside the same
triangle. You can now drive it.

### The seven laws

**1 · THE ADDRESS IS THE DEED.** One slug names both the triangle on the
globe and the drivable tile. `#F07.20131102` in the URL is a place you
can stand. Addresses are interchangeable with the sibling artifacts:
the same slug names the same ground in ICOSA SYNTEGRITY's councils.

**2 · DEPTH IS SCALE.** Nothing is drivable from orbit. A cell's edge is
`7054 km / 2^depth`, and the drive window derives from it — the meters
of ground fetched, the terrarium zoom, the imagery zoom, the meters per
world-unit are all functions of depth, never free parameters. You cannot
ask for "the map at zoom 15"; you can only descend until the triangle
under your finger is street-sized. Approximately:

| depth | cell edge | window half-width | register |
|---|---|---|---|
| 0 | 7 054 km | — | the planet; twenty plates |
| 6 | 110 km | — | a region; still a name |
| 10 | 6.9 km | 4 273 m | first drivable: open terrain |
| 12 | 1 723 m | 1 068 m | a district |
| 14 | 431 m | 267 m | a neighbourhood |
| ≥15 | ≤215 m | 147 m (floor) | street scale, 1.84 m/unit |

The 147 m floor is inherited from THUNDER RIGS verbatim: at street scale
147 m of half-window over 160 world-units makes a car a car and a street
a street. A backyard cell deeper than 15 is still driven at street
scale — a smaller chart of the same standard, not a different standard.

**3 · THE CAR LIVES ON THE SPHERE.** The tile is a chart, not a world.
The car's authoritative position is a geographic point (a lat/lon on the
unit sphere); local `(x, z)` coordinates are merely that point expressed
in the current cell's chart. Every frame the chart mapping is inverted
and the car's true position updated. Consequences, all free:

- the HUD can always print real coordinates and the containing address,
- travel needs no adjacency tables (law 5),
- saving position means saving a point on Earth, not a tile offset.

**4 · THE GROUND IS ONE QUESTION.** Carried from THUNDER RIGS unchanged:
"how high is the land at (x,z)?" has exactly one answerer, an analytic
function `ground.y(x,z)` bilinearly interpolating the mounted
heightfield, with `ground.n(x,z)` its finite-difference normal. The car
clamps to it, sits on its normal, and slides against its slope. Nothing
else in the program may hold a private opinion about elevation.
Terrarium tiles carry bathymetry, so the sea answers with its floor;
the program does not pretend otherwise — it paints the water it sees in
the imagery and lets you drive the seabed of a flooded world. Honesty
over illusion.

**5 · TRAVEL IS CONTAINMENT FAILURE.** The grid's own membership test is
the travel system. Each frame the car's sphere point is tested with
`cellContains(cell, p)`. The moment it fails, the neighbour is *named*
by the same function that names everything: `cellAt(p, depth)`. The new
cell's terrain is fetched (or remounted from cache), the car's
geographic position carries over continuously, and the world has
scrolled by one triangle. Driving across the planet is therefore
literal: every triangle boundary you cross is a real edge of the same
global subdivision you descended through, and the breadcrumb of cells
you have driven is a path on the icosahedron.

**6 · LAND FETCHED ONCE IS LAND OWNED.** Every fetch is immediately
assembled into an `unsettled.landpack/v1` document — the THUNDER RIGS
contract, byte-compatible (12-bit packed heights, two per three bytes,
base64; JPEG data-URL imagery; spawn), extended with one field: `cell`,
the slug of the triangle it charts. Packs are cached in localStorage
keyed by slug, so a cell you have stood on remounts instantly and
offline; packs can be downloaded as `<slug>.landpack.json` and mounted
back by file. The atlas you accumulate by driving is a set of deeds.

**7 · NO ENGINE BUT THE GROUND.** The parents differ on dependencies:
THUNDER RIGS imports Three.js from a CDN; the icosa artifacts ship as
one file plus one data file, no libraries, working at `file://`. The
fusion follows the icosa doctrine: the 3D view is hand-rolled WebGL —
one shader for the draped heightfield, one for the car and sky — a few
hundred lines owed to no network. The only remote things are the two
tile services and only at fetch time; a cached or imported landpack
drives with zero network. (If WebGL itself is absent the program says
so and remains a selector; it does not half-work.)

### Entities

| | |
|---|---|
| **Cell** | A face plus a path of child indices (digits 0–3). Corners live in the root face's weight space; subdivision is exact and reversible. The unit of both selection and travel. |
| **Selector** | The orthographic globe: coastlines, the icosa wireframe, the current cell and its four children. Its verbs are SPIN, DESCEND, ASCEND. It is the whole program above depth 10. |
| **Window** | The square geographic chart circumscribing a cell: centre = cell centroid, half-width = 0.62 × edge (floored at 147 m). The factor covers the triangle's circumradius (0.577 × edge) with margin, so the whole triangle is always on the tile. |
| **Landpack** | The sealed document of one window: heights, imagery, spawn, provenance, `cell` slug. Cacheable, downloadable, mountable offline. |
| **Ground** | The one collider: `y(x,z)` and `n(x,z)` over the mounted heightfield. |
| **Car** | A pose on the sphere (point + heading) with arcade dynamics in the chart: throttle, brake, steering, slope-coupled speed. Rendered as an honest box on four wheels. |
| **Crossing** | The event of containment failure: old cell, new cell, the shared edge, and the continuous geographic point that witnessed it. |

### Operations

`SPIN` — drag the globe; quaternion trackball, no privileged north.
`DESCEND` — tap a child triangle; the address grows one digit.
`ASCEND` — step back out; the address loses one digit. Nothing teleports.
`LAND` — at depth ≥ 10, fetch (or remount) the cell's window and mount
it: heightfield + imagery + ground + car at the cell centroid.
`DRIVE` — keys or touch: throttle, brake, steer. The camera chases.
`CROSS` — drive out of the triangle; the neighbour mounts itself and
the address changes under you. The selector's breadcrumb records it.
`RISE` — leave the car; return to the selector at the cell you are in
(which, after driving, is generally not the cell you landed in).
`SAVE` / `MOUNT` — download the current landpack; mount one from file.

### Derivations, not decisions

Every number is derived so the two parents stay commensurable:

- `ICO_EDGE_KM = R · acos(√5⁄5) ≈ 7 053.65 km` (depth-0 edge; derived
  from the icosahedron, same as the parents).
- `edge(d) = ICO_EDGE_KM / 2^d`; `halfM(d) = max(147, 620 · edge(d)km)`
  clamped above at 4 273 m (depth 10) — the fetch budget's ceiling.
- world width `WU = 160` units wall-to-wall; scale `S = 2·halfM / WU`
  m/unit — exactly THUNDER RIGS' street standard at the floor.
- terrarium zoom 15 when `halfM ≤ 260`, else the finest zoom keeping
  the elevation mosaic ≤ 5×5 tiles; imagery zoom likewise (18 / 17 / 16
  by window size). Grid 129 × 129 — one height per ~1.25 units.
- chart mapping: `lat = lat₀ − z·S/111 320`,
  `lon = lon₀ + x·S/(111 320·cos lat₀)` — and its inverse is the law-3
  update. The chart is honest to ~(halfM/R)² ≈ 10⁻⁶ at street scale.

### What can go wrong, said out loud

- **The tiles do not come** (offline, blocked, S3 down): LAND fails with
  the reason on screen; a cached pack still mounts; the selector never
  breaks. The wire line says what is being asked and of whom.
- **The cell is ocean**: you get the seabed under a painted sea (law 4).
  The program says the elevation is bathymetric rather than faking a
  beach.
- **A crossing at a face seam**: `cellAt` names the neighbour across
  icosa face boundaries too — the chart re-centres, headings are
  preserved in geographic terms, and the car does not flip; the seam is
  a fact of the atlas, not of the physics.
- **localStorage is full**: the cache keeps the newest few packs and
  says so; SAVE always works because a download needs no quota.

### Verification

The artifact must demonstrate, headless, with tiles mocked:

1. address → window: the derived halfM/zooms for known depths,
2. LAND mounts: ground answers, car stands on it, HUD names the cell,
3. DRIVE moves the car and the geographic readout together (law 3),
4. CROSS: forcing the car over an edge renames the cell to the true
   neighbour and preserves geographic continuity (law 5),
5. the landpack round-trip: fetch → cache → remount with zero network,
   and the downloaded pack carries the `cell` slug (law 6),
6. no WebGL → the selector still selects and the failure is worded.
