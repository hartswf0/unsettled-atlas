# GEONOSIS HARVESTER

> A place is not a coordinate. A place is an evidence graph whose signals remain distinguishable.

`geonosis/` is the build-time evidence substrate for Unsettled Atlas.

It does not add another map layer system. It turns heterogeneous public records into one provenance-preserving signal grammar that can be addressed to the same icosahedral cells already used by Icosa Syntegrity.

## Contract

```
SOURCE
  -> RAW RECORD
  -> NORMALIZED SIGNAL
  -> ICOSA ADDRESS / SPATIAL SCOPE
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
11. **Representative is not contained.** A polygon or line may receive a representative point for indexing, but its original geometry survives and the address basis says `exact:false`.
12. **A jurisdiction is not a point.** County/state/national records remain administrative scopes until their real boundary geometry is compiled. The query centre is never substituted for the jurisdiction.

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
atlas_address_basis
epistemic
observed_at
retrieved_at
confidence
derived_from
relations
actors
provenance
```

`atlas_address_basis` records how the compiler indexed the preserved source geometry:

```
{
  method: "source_point" | "polygon_centroid_representative" | ...,
  representative_point: [lon, lat],
  exact: true | false,
  note: "..."
}
```

An unaddressed signal is not a failed signal. USAspending county totals, for example, preserve the county FIPS scope in provenance until county polygons are compiled.

## Addressing

`icosa-address.mjs` reuses the exact geometry of the existing instrument:

- 20 Earth-fixed root faces from `icosa-world.data.js`
- gnomonic barycentric face coordinates
- the same four-way recursive subdivision
- URL slugs `F00.0123...`

`geometry.mjs` sits before the addressor. Points address exactly. Lines and polygons keep their source geometry and receive only a labeled representative address for indexing. Administrative scopes receive no fabricated point.

The harvester therefore does not introduce H3, S2 or another spatial identity system. External indices may be retained as source identifiers, but the Atlas address remains the common ground key.

## Executable adapters

### Core

- USGS earthquakes
- NWS active alerts
- OpenStreetMap Notes
- Wikipedia geosearch
- NASA EONET open natural events

### Wave 1 · ecology, regulation, civic change, memory, money

- GBIF occurrences
- iNaturalist observations
- EPA ECHO All Media Facilities, through EPA's official weekly ArcGIS FeatureServer
- National Park Service National Register point layer
- City of Atlanta historic buildings
- City of Atlanta rezoning cases
- New Orleans building permits
- New Orleans code-enforcement cases
- USAspending county place-of-performance obligations, with Census geocoder used only to identify the county containing the query point

Global wave-one sources join the default harvest. Atlanta and New Orleans municipal adapters switch on automatically only near those cities, and every adapter can still be selected explicitly with `--sources`.

## Deterministic statement candidates

`infer.mjs` creates statements only from explicit evidence patterns:

- `hazard_presence` — one or more hazard/event signals address to the ground.
- `representation_contestation` — multiple open OSM Notes address to the same ground.
- `attention_density` — multiple Wikipedia entities address to the ground; encyclopedic representation, not population or intrinsic importance.
- `ecological_observation_density` — multiple GBIF/iNaturalist records; observation density, not organism abundance.
- `regulated_environment_presence` — one or more EPA-regulated facilities; ECHO status is reported, not independently verified harm.
- `institutional_memory_density` — multiple official historic-resource records; institutional recognition, not complete community memory.
- `building_change_activity` — multiple permits/rezoning records; authorization/proposal, not proof that work happened.
- `service_enforcement_pressure` — multiple code-enforcement cases; administrative case density, not a diagnosis.
- `heritage_change_coaddress` — official historic-resource and change records share an Atlas address at the requested depth; a prompt for investigation, never proof of impact.
- `multi_source_activity` — independent source families address activity to the same ground.

These remain deliberately weak. Baselines, hydrological topology, ownership joins, commodity flows, population exposure and institutional responsibility should strengthen them before a model is allowed to draft a Syntegration agenda.

## Output

A harvest writes:

```
geonosis/out/<run-id>/
  manifest.json
  signals.json
  statements.json
  unaddressed.json      # only when scoped records cannot honestly be point-addressed
  rejected.json         # only when contract validation fails
  cells/
    Fxx.json
    Fxx.0.json
    ...
```

The manifest separately counts exact point addresses, representative geometry addresses and unaddressed administrative scopes. A cell bundle contains signals indexed to that requested-depth cell. Roll-up remains a prefix operation.

## Run

```bash
# Atlanta: global sources + Atlanta municipal sources selected automatically
node geonosis/harvest.mjs --lat 33.749 --lon -84.388 --radius-km 15 --depth 10

# New Orleans: global sources + NOLA permits/code enforcement selected automatically
node geonosis/harvest.mjs --lat 29.9511 --lon -90.0715 --radius-km 15 --depth 10

# Deliberate small source set
node geonosis/harvest.mjs --lat 33.749 --lon -84.388 --radius-km 10 --depth 9 \
  --sources epa-echo,gbif-occurrences,nps-national-register,atlanta-rezoning-cases

node geonosis/test.mjs
```

Network adapters are optional. Contract tests use fixtures and geometry invariants so the core remains testable offline.