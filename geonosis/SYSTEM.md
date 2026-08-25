# GEONOSIS HARVESTER

> A place is not a coordinate. A place is an evidence graph whose signals remain distinguishable.

`geonosis/` is the build-time evidence substrate for Unsettled Atlas.

It does not add another map layer system. It turns heterogeneous public records into one provenance-preserving signal grammar that can be addressed to the same icosahedral cells already used by Icosa Syntegrity.

## Contract

```
SOURCE
  -> RAW RECORD
  -> NORMALIZED SIGNAL
  -> ICOSA ADDRESS
  -> RELATION / INFERENCE
  -> STATEMENT CANDIDATE
  -> ACTOR INTERPRETANT
```

The browser is not the harvester. Large, slow, browser-hostile and historical sources belong here at build time. Live browser sources may still exist, but the Atlas must not depend on them to remember what was observed.

## Laws

1. **Source anchor is not target.** A source may supply a point, polygon, place name or jurisdiction. It never supplies an Atlas address. The compiler assigns the address.
2. **The Atlas owns geometry.** No API response and no model may emit an `Fxx...` address.
3. **Evidence types do not collapse.** `OBSERVED`, `REPORTED`, `DECLARED`, `MODELED`, `DERIVED`, `INFERRED`, `PREDICTED` and `CONTESTED` remain distinct.
4. **Inference is another signal.** It never overwrites its parents and must name them in `derived_from`.
5. **Failure is local.** One dead/rate-limited/schema-changed source must not abort a harvest.
6. **Absence is scoped.** `zero returned` means only that a particular source/query returned zero records at a particular time.
7. **Time is first-class.** `observed_at`, `valid_from`, `valid_to` and `retrieved_at` are different claims.
8. **Actor meaning is downstream.** A dog, car, building, service council and flood model can interpret the same signal differently without changing the source signal.
9. **Raw provenance survives.** Every normalized signal retains source id, source URL/query URL when available, source record id and a compact raw payload or pointer.
10. **The phone receives compiled ground.** Repeated API work is moved out of the interaction loop whenever possible.

## Acquisition lanes

- `LIVE` — keyless endpoint suitable for runtime or build-time querying.
- `COMPILE` — public bulk/download source; prefer periodic local compilation.
- `PROXY` — useful source whose CORS/access pattern is unsuitable for a static browser.
- `KEY` — optional credentialed adapter. Never a core dependency.
- `LOCAL` — municipal/regional source whose schema is locality-specific.

## Signal shape

See `schema.mjs`. Minimum fields are:

```
id
source
source_record_id
predicate
value
unit
geometry
atlas_address
epistemic
observed_at
retrieved_at
confidence
derived_from
relations
actors
provenance
```

## Addressing

`icosa-address.mjs` reuses the exact geometry of the existing instrument:

- 20 Earth-fixed root faces from `icosa-world.data.js`
- gnomonic barycentric face coordinates
- the same four-way recursive subdivision
- URL slugs `F00.0123...`

The harvester therefore does not introduce H3, S2 or another spatial identity system. External indices may be retained as source identifiers, but the Atlas address remains the common ground key.

## v0 live adapters

The first executable adapters are intentionally boring and keyless:

- USGS earthquakes
- NWS active alerts
- OpenStreetMap Notes
- Wikipedia geosearch
- NASA EONET open natural events

They prove the acquisition/normalization/addressing contract across unrelated schemas before larger sources are added.

## v0 deterministic inferences

`infer.mjs` creates candidate statements only from explicit evidence patterns:

- `hazard_presence` — one or more hazard/event signals address to the ground.
- `representation_contestation` — multiple open OSM Notes address to the same ground.
- `attention_density` — multiple Wikipedia entities address to the same ground; this is attention/notability, not population or importance.
- `multi_source_activity` — independent source families address activity to the same ground.

These are deliberately weak. Later rules should add baselines, time windows, exposure, money, ownership, hydrology and institutional responsibility rather than asking a model to invent significance.

## Output

A harvest writes:

```
geonosis/out/<run-id>/
  manifest.json
  signals.json
  statements.json
  cells/
    Fxx.json
    Fxx.0.json
    ...
```

A cell bundle contains signals whose deepest requested Atlas address is that cell. Roll-up is a prefix operation and can be performed without repeating the source query.

## Run

```
node geonosis/harvest.mjs --lat 33.749 --lon -84.388 --radius-km 15 --depth 10
node geonosis/test.mjs
```

Network adapters are optional. Tests use fixtures and geometry invariants so the core remains testable offline.
