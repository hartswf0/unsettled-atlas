# Source Register

Every source the Soft Cadastre draws on, which registry it feeds, how it is acquired,
what state that acquisition is in, what it is good for, and what it cannot see.
A source with no stated blind spot has not been examined.

## Institutional lane → REGISTRY II (ATL NPU HALFWORLD)

| Source | Acquisition mode | Corpus status | Primary value | Primary blind spot |
|---|---|---|---|---|
| Atlanta NPU directory/agendas | Public HTML/PDF discovery | Runnable | Neighborhood debates and agenda context | Uneven minutes and participant selection |
| NPU library | Public HTML/PDF discovery | Runnable | Institutional rules and historical context | Less direct experiential language |
| BZA | Public HTML/PDF discovery | Runnable | Variances, staff reasoning, deferrals, decisions | Application-centered, not population-representative |
| ZRB | Public HTML/PDF discovery | Runnable | Rezonings, public positions, alternative futures | Final documents can obscure negotiation history |
| Tree Conservation Commission | Public HTML/PDF discovery | Runnable | Parcel–canopy conflict and appeals | Individual appeals do not measure canopy experience generally |
| Boards and commissions calendar | Public HTML/PDF discovery | Runnable | Licensing, appeals, accessibility, waste and oversight traces | Heterogeneous and difficult to normalize |

## Vernacular and residual lanes → REGISTRY I (SERES ATLANTA)

| Source | Lane | Acquisition mode | Corpus status | Primary value | Primary blind spot |
|---|---|---|---|---|---|
| OpenStreetMap Notes | VERNACULAR | Public API | **Withdrawn** | Nothing usable for this registry. Acquired in full (Atlanta 1457 observations, New Orleans 674), audited, and refused admission | **Not a testimony corpus.** 42% of extracted claims derive from app-generated text (StreetComplete, Organic Maps, Scout); the human-written remainder is overwhelmingly map-editing requests |
| ATL311 | RESIDUAL | De-identified records request | Pending | High-volume service narratives and outcomes | Reporting propensity, privacy, uncertain narrative fields |
| Yelp Open Dataset | VERNACULAR | Manual agreement-gated import | Gated | Place-attached reviews, tips and attributes | Current Atlanta coverage unverified; platform selection |
| Google Places reviews | VERNACULAR | Reference-only | Excluded from corpus ingestion | Place identifiers and limited display context | Storage, reuse, sample-size and model-development restrictions |

## Geometry lane → anchors only, never targets

Geometry sources resolve where an *anchor* is. Under the first law of the system
they never resolve where a claim is *about*.

| Source | Acquisition mode | Corpus status | Primary value | Primary blind spot |
|---|---|---|---|---|
| OpenStreetMap via Overpass API | Public API | **Acquired** | Reference basemap for orientation — boundary, water, road classes, rail, 90 place names. 764 chained lines, 94% of raw points dropped. ODbL 1.0 | Reference only. It locates the reader, never the claim; drawing a road under a claim tempts a reader to read the claim as sitting *on* it |
| OSM footprints and segment polylines | Public API | Pending | Real anchor geometry to replace PROVISIONAL eyeball coordinates | A footprint is not a perceived extent; still an anchor, never a target |
| GDOT AADT per street segment | Public dataset | Pending | Traffic volume for Appleyard stratification of claim lines | Volume is not severance; any correlation must be declared, not implied |

## Source state vocabulary

- `acquired`: in the corpus now, with provenance and licence recorded per claim.
- `withdrawn`: acquired, audited, and refused admission to the atlas; kept on disk with its reason.
- `runnable`: public acquisition path is configured.
- `pending`: requested but not yet received.
- `gated`: requires user acceptance or a separate data agreement.
- `reference-only`: may identify or link a place, but is not archived as a textual corpus.
- `quarantined`: obtained material contains privacy or rights concerns requiring review.

## Present holdings

- **REGISTRY I — SERES** holds **fixture only**: 30 authored claims across 8 places,
  written to exercise the schema. An acquired corpus of 228 claims from the
  OpenStreetMap Notes API was built and then **withdrawn** after audit — OSM Notes
  turned out to be a map-maintenance queue rather than testimony about place. The
  parts remain on disk marked `admitted: false` with their reason attached. See
  [SYSTEM.md](SYSTEM.md) § *What was tried and refused*.
- **REGISTRY II — HALFWORLD** is still running on a **synthetic sample**: 7 agenda
  items in one file, with **PROVISIONAL** anchor coordinates. No acquired
  institutional record is present.

### A second city

New Orleans was acquired to test what generalises: **674 observations → 113 claims**,
from nothing but `cities/new-orleans.json` — which proved the acquisition machinery
ports even though the corpus itself was later withdrawn. Its institutional lane is
*sketched, not runnable* — the Neighborhood Participation Program convenes per application rather
than by standing chartered unit, so Atlanta's "agenda item" does not segment it. That
finding is recorded in the city file itself so nobody runs REGISTRY II there thinking
it is configured.

### Attribution

Acquired material travels with its licence or it does not travel. The OSM parts carry
`© OpenStreetMap contributors` in the part, in the built atlas, on the Sheet's rail
and footer, on the Helm's corpus flag, and in the register's footer.

Every surface declares this in its own frame. See [SYSTEM.md](SYSTEM.md) §
*What is honestly wrong right now*.
