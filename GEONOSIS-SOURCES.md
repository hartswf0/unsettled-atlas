# GEONOSIS SOURCE REALITY AUDIT

Verified 2026-08-25.

The machine-readable/runtime ledger is `geonosis-source-registry.js`. The rule is stricter than “a dataset exists”: a source must have a current provider, an access path, an access/terms state, geographic coverage, an epistemic class, and an ingestion mode. A technically reachable endpoint is not automatically deployable.

## What the branch already consumes

| Source | Current use | Access reality |
|---|---|---|
| USGS Earthquake Hazards | M2.5+ one-day GeoJSON, recursively ICOSA-indexed | keyless, global |
| NASA FIRMS | one-day VIIRS detections for the attended triangle | free MAP_KEY; attention-scoped |
| OpenStreetMap datacenter snapshot | persistent infrastructure records | ODbL snapshot pinned to inspected God's Eye View commit |
| adsb.lol | bounded regional aircraft snapshots + ICOSA transitions | keyless current endpoint; ODbL attribution |
| Wikidata/Wikipedia/Wikimedia | council/evidence/place/attention | keyless but rate-limited |

## High-value adapters that are genuinely ready

These have authoritative current access paths and fit the Geonosis contract without pretending they are global browser layers.

### Identity and physical world

- Overture Maps + GERS — global open reference map, stable GERS UUIDs, registry, bridge files and changelog. Pull GeoParquet/STAC windows server-side and attach GERS IDs to signals.
- OpenStreetMap / Overpass — fine human geography. Use bounded Overpass queries or extracts, never giant browser queries.
- USGS 3DEP DEM — elevation/slope/viewshed/runoff substrate.
- USGS 3DEP lidar — canopy/building height and obstruction. Tile/server workflow.
- Landsat Collection 2 — STAC + cloud imagery for change/perception.
- Annual NLCD — CONUS annual 30 m land-cover history through 2025.
- USDA SSURGO via Soil Data Access — AOI soil/hydrologic properties.
- USGS 3DHP — preferred current hydrography.
- USGS Water Data OGC API — streamflow/stage/monitoring locations.
- NWS API — observations, forecasts and alerts.
- NOAA NDBC — real-time buoy/station observations.

### Hazards and environment

- EPA AirNow — current preliminary AQI/observations; free account/API key.
- EPA AQS — delayed/validated regulatory air-quality record; key for row API.
- EPA ECHO + FRS — facilities, permits, inspections, enforcement and cross-program facility identity.
- USDA Cropland Data Layer / CropScape — annual crop classification.
- FEMA NFHL — official flood-hazard geometry and coverage service.
- OpenFEMA — declarations, assistance, mitigation and program datasets; no registration.
- NOAA Storm Events — historical storm-event bulk files.
- GBIF — occurrence search without auth; bulk downloads require an account.

### Population, institutions and knowledge

- Census/ACS — current Data API now requires a key; preserve MOEs and vintage.
- LEHD/LODES — block-level workplace/residence and OD employment flows via bulk files.
- GHSL — open/free global population, built-up, settlement, building-age/attribute and exposure products.
- NCES EDGE — school/district/postsecondary geography.
- CDC PLACES — modeled local health estimates, explicitly not direct individual measurement.
- BLS Public Data API — economic/employment context; v1 keyless, registered v2 has higher limits.
- USAspending — federal awards/geographic spending; no auth.
- Grants.gov — opportunity search/fetch endpoints; no auth for those reads.
- OpenAlex — free API key with daily allowance; free bulk snapshot.
- Crossref — public metadata API without required signup.
- GNIS — official/variant U.S. geographic names.
- Wikimedia Pageviews — attention, not truth/importance.
- Library of Congress Chronicling America — historical newspapers and bulk OCR.

### Mobility and infrastructure

- GTFS static — real standard, but feeds are agency-specific; discover/register each provider.
- GTFS-Realtime — provider-specific feeds; never claim global live transit coverage.
- GBFS — public read-only shared-mobility feeds with a global systems catalog.
- FHWA TMAS — traffic count/station data; not one national live traffic API.
- NHTSA FARS — census of qualifying fatal crashes; state portals needed for nonfatal/local crash detail.
- DOE AFDC — charging/fuel stations; developer API key and downloadable data.
- EIA — energy API requires a free key; bulk downloads are a keyless path.
- FCC BDC — public broadband availability data; the Fabric itself is separately licensed.
- NOAA/Marine Cadastre AIS — annual historical vessel positions/tracks, **not live AIS**.
- Global Fishing Watch — token/API for recent AIS-derived fishing activity; algorithmic classifications stay DERIVED.

## Corrections to the original source list

1. **USGS WaterServices is legacy.** New work should use `api.waterdata.usgs.gov/ogcapi/`; the old WaterServices endpoints are scheduled for decommissioning in Q1 2027.
2. **NHD is legacy.** 3DHP is the current USGS hydrography program, though national replacement is still in progress. Keep a coverage flag when falling back to NHD/NHDPlus.
3. **ESA WorldCover is a fixed 2020/2021 baseline, not the current global annual program.** Copernicus LCFM is the operational successor for 10 m global land-cover/forest monitoring.
4. **AirNow and AQS are not interchangeable.** AirNow is current/preliminary; AQS is the quality-assured regulatory record and can lag.
5. **Census API access changed.** In 2026 Census Data API queries require an API key. LODES bulk files remain a useful separate path.
6. **OpenAlex access changed.** API calls are now key-based; the snapshot remains free.
7. **Marine Cadastre AIS is historical/annual.** It cannot serve as the system's live ship feed.
8. **HIFLD Open is retired.** It was decommissioned in 2025 and the FGDC HIFLD subcommittee was retired in March 2026. Current infrastructure should resolve to original provider agencies. Rescued HIFLD copies are memory/history, not current truth.
9. **OpenSky is not a default public-product source.** Current operational automated REST use is an agreement/licensing boundary. The branch therefore uses the provider-agnostic movement contract with adsb.lol by default.
10. **GDELT is not currently a direct-browser dependency.** ICOSA's live browser tests found its endpoint unsuitable cross-origin; use a server/proxy/bulk pipeline and retain Wikinews as a browser-safe fallback.

## Sources that are not one dataset

Parcels, assessor records, zoning, permits, code violations, inspections, 311, municipal trees, potholes, parking/curb rules, city budgets, public meetings, plans and local election data are **jurisdictional families**. They must never appear in Geonosis as if a national feed exists.

The resolver order is:

```text
jurisdiction
  -> authoritative local/state portal
     -> ArcGIS FeatureServer / MapServer
     -> Socrata SODA / OData
     -> CKAN
     -> agency-specific download/API
  -> register exact dataset + schema + license + update cadence
  -> normalize SIGNAL
  -> ICOSA address
```

NYC 311 is registered as the first concrete civic-experience source: dataset `erm2-nwe9`, 2020-present, daily updated, with complaint/problem, agency, status and coordinates. Other jurisdictions remain explicitly UNKNOWN until resolved.

## Ingestion law

```text
small live feed      -> browser adapter when CORS/terms permit
regional live feed   -> attention-scoped ICOSA query
large vector corpus  -> server/window/pre-index
large raster         -> tile/COG window by attended cell
historical bulk      -> offline/server ETL -> temporal SIGNALS
federated standard   -> discover provider -> register feed -> ingest
local civic family   -> resolve jurisdiction first
terms/key source     -> explicit configuration; never smuggle credentials
retired source       -> historical only
```

## What “have it” means

A source is not considered present merely because its name appears in a design document. For every source the registry carries:

```text
id
family
provider/authority
status
access mode
auth requirement
coverage
default epistemic class
endpoint/documented access path
operational notes
```

Adapters add, at runtime:

```text
last successful retrieval
coverage cell / geometry
retrieval timestamp
provider timestamp
freshness
record count
license/attribution
failure state
```

Only a successful query with exact relevant coverage may produce a meaningful zero.

## Next adapter order

The best next work is not another random point feed. Build the sources that create new Geonosis operators:

1. **NWS** — weather + alerts gives current condition, prediction and constraint signs.
2. **USGS Water OGC + 3DHP** — creates upstream/downstream causal topology and actual changing water state.
3. **FEMA NFHL + OpenFEMA** — connects hazard geometry to institutional disaster history/response.
4. **EPA ECHO/FRS + AirNow/AQS** — joins facility identity, compliance, exposure and live/regulatory environmental state.
5. **NYC 311 adapter as the civic template** — proves perception/valuation/response-latency signs; then generalize the jurisdiction resolver.
6. **GBIF** — ecological occurrences become actor-specific dog/ecology interpretants.
7. **Overture GERS** — persistent external entity identity and cross-source joins.
8. **DEM/land-cover windows** — slope, shade, permeability and physical derived signs.
9. **LODES/Census/GHSL** — exposure, daily flows and population context.
10. **Regulations.gov / Federal Register / Congress.gov / USAspending** — institutional agenda, contestation and resource flows.

That sequence turns the existing live map into a causal/sign system rather than a denser map.
