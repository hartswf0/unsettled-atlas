# GEONOSIS HARVESTER

> A place is not a coordinate. A place is an evidence graph whose signals remain distinguishable.

`geonosis/` is the build-time evidence substrate for Unsettled Atlas. It does not add another map layer system. It turns heterogeneous public records into a provenance-preserving grammar addressed to the same icosahedral ground used by Icosa Syntegrity.

## Contract

```
SOURCE
  -> RAW RECORD
  -> NORMALIZED SIGNAL
  -> ICOSA ADDRESS / SPATIAL SCOPE
  -> ENTITY
  -> RELATION
  -> INFERENCE
  -> STATEMENT CANDIDATE
  -> ACTOR INTERPRETANT
```

The browser is not the harvester. Large, slow, browser-hostile and historical sources belong here at build time. Live browser sources may still exist, but the Atlas must not depend on them to remember what was observed.

## Laws

1. **Source anchor is not target.** A source may supply a point, polygon, place name or jurisdiction. It never supplies an Atlas address. The compiler assigns the address.
2. **The Atlas owns geometry.** No API response and no model may emit an `Fxx...` address.
3. **Evidence types do not collapse.** `OBSERVED`, `REPORTED`, `DECLARED`, `MODELED`, `DERIVED`, `INFERRED`, `PREDICTED` and `CONTESTED` remain distinct.
4. **Inference is another record.** It never overwrites its parents and must name them in `derived_from`.
5. **Failure is local.** One dead/rate-limited/schema-changed source must not abort a harvest.
6. **Absence is scoped.** `zero returned` means only that a particular source/query returned zero records at a particular time.
7. **Time is first-class.** `observed_at`, `valid_from`, `valid_to` and `retrieved_at` are different claims.
8. **Actor meaning is downstream.** A dog, car, building, service council and flood model can interpret the same signal differently without changing the source signal.
9. **Raw provenance survives.** Every normalized signal retains source id, source URL/query URL when available, source record id and a compact raw payload or pointer.
10. **The phone receives compiled ground.** Repeated API work is moved out of the interaction loop whenever possible.
11. **Representative is not contained.** A polygon or line may receive a representative point for indexing, but its original geometry survives and the address basis says `exact:false`.
12. **A jurisdiction is not a point.** County/state/national records remain administrative scopes until their real boundary geometry is compiled. The query centre is never substituted for the jurisdiction.
13. **An entity is not a signal.** `Fixture Bank` can be described by many records without any one record becoming the bank itself.
14. **No edge without evidence.** Every graph relation carries `derived_from[]` back to the signals that earned it.
15. **Ownership vocabulary stays literal.** GLEIF Level 2 parentage means accounting consolidation. It is never relabeled as beneficial ownership.
16. **Money stocks are not money uses.** A branch deposit balance is not evidence that those deposits are invested in the surrounding ground.

## Acquisition lanes

- `LIVE` — keyless endpoint suitable for runtime or build-time querying.
- `COMPILE` — public bulk/download source; prefer periodic local compilation.
- `PROXY` — useful source whose CORS/access pattern is unsuitable for a static browser.
- `KEY` — optional credentialed adapter. Never a core dependency.
- `LOCAL` — municipal/regional source whose schema is locality-specific.

## Spatial addressing

`icosa-address.mjs` reuses the existing 20 Earth-fixed root faces, gnomonic barycentric coordinates, four-way recursive subdivision and `F00.0123...` URL grammar. `geometry.mjs` sits before it. Points address exactly. Lines and polygons preserve their source geometry and receive only a labeled representative address for indexing. Administrative scopes receive no fabricated point.

## Executable sources

### Core

- USGS earthquakes
- NWS active alerts
- OpenStreetMap Notes
- Wikipedia geosearch
- NASA EONET

### Wave 1 · ecology, regulation, civic change, memory, public money

- GBIF occurrences
- iNaturalist observations
- EPA ECHO facilities
- NPS National Register
- Atlanta historic buildings
- Atlanta rezoning cases
- New Orleans building permits
- New Orleans code enforcement
- USAspending county place-of-performance obligations

### Wave 2 · banking, mortgage institutions, corporate consolidation

- FDIC BankFind branch locations
- FDIC Summary of Deposits branch balances
- HMDA Data Browser county filer/lender presence
- GLEIF LEI reference-data enrichment
- GLEIF direct accounting-consolidation parent enrichment
- GLEIF ultimate accounting-consolidation parent enrichment

Wave 2 uses the Census coordinate geocoder only to identify the containing U.S. county/state for APIs that are natively administrative. HMDA and USAspending county records remain county-scoped and unaddressed until county polygons are compiled.

## Graph

`graph.mjs` produces normalized entities and evidence-backed relations. Current relation vocabulary includes:

```
branch_of
holds_reported_deposits
reports_hmda_activity_in
reports_obligations_with_place_of_performance
directly_consolidated_by
ultimately_consolidated_by
```

This allows one evidence path to read:

```
BANK BRANCH
  -> branch_of -> FDIC INSTITUTION

HMDA LENDER LEI
  -> reports_hmda_activity_in -> COUNTY
  -> directly_consolidated_by -> PARENT LEI

US FEDERAL GOVERNMENT
  -> reports_obligations_with_place_of_performance -> COUNTY
```

Those edges can later meet parcels, GERS buildings, permits, commodities, environmental facilities and service complaints without changing what the original source asserted.

## Deterministic statement candidates

`infer.mjs` keeps the ground-level patterns from Waves 0–1: hazards, mapping contestation, Wikipedia attention, ecological observation density, regulated-facility presence, official-memory density, building-change activity, code-enforcement pressure, heritage/change co-addressing and multi-source activity.

`infer-graph.mjs` adds:

- `reported_deposit_stock` — sums FDIC-reported branch balances addressed to a cell, explicitly not local investment.
- `county_financial_channels` — juxtaposes HMDA-reporting lender presence and USAspending place-of-performance obligations without collapsing them into one index.
- `lender_consolidation_parentage` — identifies when sampled HMDA lenders have GLEIF consolidation-parent relations, explicitly not beneficial ownership and explicitly limited by the enrichment sample.

No model chooses these patterns and there is still no single magic `importance` score.

## Output

A harvest writes:

```
geonosis/out/<run-id>/
  manifest.json
  signals.json
  entities.json
  relations.json
  statements.json
  unaddressed.json      # when scoped records cannot honestly be point-addressed
  rejected.json         # only when contract validation fails
  cells/
    Fxx.json
    Fxx.0.json
    ...
```

A cell bundle now contains its indexed signals plus located entities, touching relations and cell statements. County-scoped graph statements remain in the run-level `statements.json` rather than being pinned to a triangle.

## Run

```bash
# Full Atlanta harvest, including Wave 2 defaults
node geonosis/harvest.mjs --lat 33.749 --lon -84.388 --radius-km 15 --depth 10

# Deliberate finance-only run
node geonosis/harvest.mjs --lat 33.749 --lon -84.388 --radius-km 12 --depth 10 \
  --sources usaspending-county,fdic-locations,fdic-sod,hmda-lenders

# Limit GLEIF enrichment work when a county contains many HMDA filers
node geonosis/harvest.mjs --lat 33.749 --lon -84.388 --gleif-limit 15

npm run geonosis:test
npm run geonosis:smoke
```

`geonosis:test` is offline and deterministic. `geonosis:smoke` makes a deliberately small live Atlanta probe against Census, FDIC, HMDA and GLEIF so provider schema drift is caught before merge.
