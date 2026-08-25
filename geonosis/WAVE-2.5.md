# GEONOSIS WAVE 2.5 · COMPILED GROUND → COUNCIL

Wave 2.5 closes the gap between the build-time Geonosis evidence graph and the existing Icosa Syntegrity instrument.

## Runtime grammar

```
ICOSA ADDRESS
  ↓
LIVE WORLD                    COMPILED GROUND
fast observations             dated public records
  ↓                              ↓
source state                  signals / entities / relations
  └──────────────┬───────────────┘
                 ↓
          DIFFERENCE / STRANGE
                 ↓
       STATEMENT OF IMPORTANCE
                 ↓
          HUMAN SELECTS ONE
                 ↓
           CALL A COUNCIL
                 ↓
     existing Syntegrity harness
```

The model does not create the geographic claim. The human selects a rule-derived proposition whose evidence IDs and scope already exist.

## Persistent interface labels

The WHERE panel keeps four explicit surfaces:

- **HERE** — entities represented in compiled ground.
- **HAPPENING** — reported/declared/observed signals and change records.
- **CONNECTIONS** — typed entity relations backed by `derived_from[]` evidence.
- **STRANGE** — deterministic statements with visible importance factors and evidence IDs.

A selected STRANGE proposition exposes **CALL A COUNCIL**. The resulting council panel displays **GEONOSIS AGENDA SEED · HUMAN SELECTED** before convening.

## Publication law

`geonosis/publish.mjs` converts reference-window harvests into static prefix bundles under `geonosis/data/`.

- A prefix bundle aggregates only records whose Atlas addresses descend from that prefix.
- Arrays are bounded samples; counts describe the compiled prefix.
- Non-point geometry retains the `atlas_address_basis` caveat from the source signal.
- Administrative records without honest Icosa geometry never enter a triangle bundle. They remain in `scoped.json`.
- Descending below a compiled leaf returns `COMPILED_PARENT_SCOPE`; it never pretends the broader bundle is exact for the deeper focus.
- Moving outside the compiled Atlanta/New Orleans windows returns `OUTSIDE_COMPILED_COVERAGE`; the loader never falls sideways to another place on the same root face.

## Current reference windows

The compiler currently harvests 40 km windows around:

- Atlanta, Georgia — reference ground.
- New Orleans, Louisiana — generalization test ground.

The windows are intentionally finite. They prove the compiler/runtime contract before global bulk products are tiled.

## Local source corrections discovered by the first real compilation

The first generated build exposed source drift that is now encoded explicitly:

- Atlanta Historic Buildings layer 17 uses ArcGIS source field `DESCRIPTIO`, not `DESCRIPTION`.
- New Orleans building permits now use current Data.NOLA dataset `rcm3-fn58`, including source `location_1` geometry and recent filing/status dates.
- New Orleans Code Enforcement All Cases now uses current dataset `u6yx-v2tw`. Its published contract is treated as municipality-scoped because the adapter does not receive source point geometry. Case addresses are not silently geocoded into Atlas points.

The regional compiler now fails if those required local sources error or return zero records in the 40 km reference windows. A blind spot cannot silently become a successful publication.

## Build and validation

```bash
npm run geonosis:test
npm run geonosis:publish-test
npm run geonosis:smoke
npm run geonosis:compile-ground
npm run geonosis:validate-ground
```

`geonosis-compile-ground.yml` refreshes the static Atlanta/New Orleans ground daily and on compiler/source changes. The generated files are committed so GitHub Pages can serve them without a runtime API fan-out.

## Next boundary

Wave 2.5 does **not** solve administrative allocation. County-scoped HMDA and USAspending records remain unaddressed until real Census county/tract polygons are compiled against Icosa cells.

The next structural step after the UI bridge is therefore:

```
ADMINISTRATIVE GEOMETRY
  + Overture/GERS entity identity
  + mismatch/lag/exposure/dependency operators
  ↓
stronger Statements of Importance
```
