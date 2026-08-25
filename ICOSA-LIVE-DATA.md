# ICOSA LIVE DATA

`icosa-syntegrity-live.html` is an additive live-data harness for `icosa-syntegrity.html`.

The map remains place-first. Sources do not become independent map layers. Every usable row is normalized, assigned an ICOSA address, indexed through its ancestor chain, and only then rendered, exposed to the selected triangle, or compiled into model context.

## Contract

A normalized observation has:

```text
id
source
kind
lon / lat
observedAt
retrievedAt
epistemic
properties
v                derived unit-sphere point
prefixes[]       Fxx address at depths 0..12
```

The shared bus exposes:

```js
ICOSA_LIVE.queryCell(cellOrSlug, kind)
ICOSA_LIVE.inventory(cellOrSlug)
ICOSA_LIVE.sourceState()
ICOSA_LIVE.addressLadder(record)
ICOSA_LIVE.registerSource(spec)
ICOSA_LIVE.poll(sourceId)
ICOSA_LIVE.modelContext(cellOrSlug)
ICOSA_LIVE.contextForModel(cellOrSlug, operation)
```

The core distinction is between **global sources** and **attention-scoped sources**. Global sources may answer any cell from one indexed snapshot. Attention-scoped sources only answer the cell recorded in their coverage metadata. The renderer, panel, and model-context compiler all enforce that distinction.

## Source classes

### USGS earthquakes

- Source: USGS GeoJSON 24-hour M2.5+ feed.
- Mode: global polling.
- Cadence: 60 seconds.
- Epistemic state: `OBSERVED`.
- Broad scales aggregate into addressed triangles; deeper scales resolve to individual events.
- A failed feed is `UNAVAILABLE`, never interpreted as zero earthquakes.

### OpenStreetMap datacenters

- Runtime source: the 4,351-feature public datacenter snapshot bundled by `bilawalsidhu/gods-eye-view`.
- Source data: OpenStreetMap contributors.
- License: ODbL 1.0.
- Mode: persistent global record.
- Cadence: daily revalidation; browser cache is allowed to satisfy the static fetch.
- Epistemic state: `RECORD`.
- Point features keep their coordinates; non-point geometries receive a deterministic geometry anchor before ICOSA indexing.

The harness pins the upstream snapshot to the God's Eye View commit it was inspected from rather than following that repository's moving `main` branch.

The UI keeps the required attribution: `© OpenStreetMap contributors · ODbL 1.0`.

### NASA FIRMS

- Source: NASA FIRMS Area API.
- Default dataset: `VIIRS_NOAA20_NRT`.
- Mode: attention-scoped, not global.
- Query begins only for triangles with edge length <= 2,500 km.
- Query geometry is a padded bounding box around the triangle, split at the dateline when necessary.
- Returned detections are filtered back through `cellContains`, so the triangle, not the rectangular API query, owns the final record.
- Day range: 1.
- Cadence while active: 5 minutes.
- Epistemic state: `OBSERVED`.
- No MAP_KEY means `UNCONFIGURED`, never "no fires".

FIRMS warns that a one-day global VIIRS request may return tens of thousands of records. ICOSA therefore refuses the source-first temptation to download the world and instead asks only where attention has landed.

Configure in the browser console:

```js
ICOSA_LIVE.setFirmsKey('YOUR_NASA_FIRMS_MAP_KEY')
```

Clear it:

```js
ICOSA_LIVE.clearFirmsKey()
```

The key is stored in browser `localStorage` and used only to construct NASA FIRMS requests. A deployment can instead define `window.ICOSA_LIVE_CONFIG.firmsMapKey` before the live harness runs.

### adsb.lol aircraft

- Source: adsb.lol point API.
- License: ODbL 1.0.
- Mode: attention-scoped.
- Query begins only for triangles with edge length <= 900 km.
- Radius is derived from triangle size and capped at 250 nautical miles.
- Cadence while active: 15 seconds.
- Records are filtered back through the selected triangle.
- Epistemic state: `OBSERVED`.

Aircraft add a second structure beyond ordinary address indexing. At ICOSA depth 9 each aircraft has a motion address. A change is retained as:

```text
Fxx.pathA -> Fxx.pathB @ timestamp
```

Each aircraft keeps a bounded trail and up to 64 cell transitions. `ICOSA_LIVE.aircraftHistory(icao24)` exposes the trace.

A bounded point snapshot is explicitly marked complete or partial for the selected cell. An unavailable source or a snapshot belonging to another triangle never becomes an empty-airspace claim.

## Why OpenSky is not auto-enabled

God's Eye View supports OpenSky behind a server-side authentication/proxy layer. Current OpenSky terms also make operational REST integration a licensing boundary. The public ICOSA branch therefore does not silently turn OpenSky into a browser feed. The movement contract is source-agnostic, so an authorized deployment can add an OpenSky adapter later without changing the cell-transition model.

## Model context bridge

`icosa-live-context.js` wraps the existing `compileContext()` rather than creating a second LLM path. The existing syntegration harness already routes topic inference, person inference, charter writing, speaking, critique, judging, carrying and outcomes through compiled ICOSA context. The wrapper therefore upgrades those operations together.

At runtime the model context becomes `icosa-context-v3-live` and gains:

```text
live.version
live.focus_address
live.semantics
live.sources.*        state, freshness, coverage, completeness, zero semantics
live.here.earthquakes count + bounded examples
live.here.datacenters count + bounded examples
live.here.fires       count + bounded examples only for matching coverage
live.here.aircraft    count + bounded examples only for matching coverage
live.movement         recent Fxx aircraft entries, exits and internal crossings
```

The full source datasets are never dumped into the prompt. The model gets counts plus bounded examples, source state, provenance semantics and coverage rules.

`compileContext()` warms attention-scoped sources when the scale permits. `askOpenAI()` then refreshes the live block immediately before serialization. If a first relevant source is already loading and has no usable matching snapshot, the send waits for at most 1.8 seconds; after that the model receives the honest loading/unavailable state instead of being blocked.

The constitutional `LAW` is extended with one live-data rule: `OBSERVED` is an observation, `RECORD` is a snapshot record, and unavailable/stale/unconfigured/other-cell states are never evidence of absence. A zero may support only the narrow claim named by that source's `coverage.zero_semantics`.

The WHERE panel now includes `MODEL CONTEXT · LIVE WORLD`, making the same statuses and per-cell counts visible to the person using the model.

For inspection without making a model call:

```js
ICOSA_LIVE.modelContext('F14.0222')
ICOSA_LIVE.contextForModel('F14.0222', 'INSPECT')
```

## Rendering law

The visible unit is always the triangle first.

```text
broad scale      source records -> cell counts / density
narrow scale     cell counts -> individual observations
movement         positions -> cell transitions -> trace
model            addressed observations -> bounded live evidence -> existing council
```

Back-side records are culled with the same `facingCamera` rule as the rest of the folded world. Scoped sources paint only when their recorded coverage address still matches the triangle currently holding attention; previous-region data never leaks into a new region while its request is loading.

## Absence law

`0` is only meaningful when a source successfully described the exact ground in question.

These states remain distinct:

```text
FRESH
STALE
UNAVAILABLE
UNCONFIGURED
NOT QUERIED AT THIS SCALE
LOADED FOR ANOTHER TRIANGLE
ZERO RECORDS IN A SUCCESSFUL EXACT-COVERAGE QUERY
```

The interface and model context must never collapse the first six into the seventh.

## Validation boundary

The original observation bus passed a local mocked execution of normalization -> 13-prefix indexing -> source replacement -> per-cell inventory.

The live-model bridge has also passed a local mock execution proving:

```text
compileContext() -> icosa-context-v3-live
USGS observation -> live.here.earthquakes
OSM record -> live.here.datacenters
exact FIRMS zero -> narrow zero_semantics
LAW -> live epistemic rule present
askOpenAI() -> live block refreshed before send
```

The browser adapters have been reviewed against the current ICOSA closure and committed through GitHub, but this execution environment cannot resolve `github.com` for a fresh branch clone, so a full browser/runtime pass of the expanded branch remains to be run in the deployed GitHub Pages context before merge.

After deployment, the minimum smoke test is:

```js
ICOSA_LIVE.sourceState()
ICOSA_LIVE.modelContext(location.hash.slice(1))
ICOSA_LIVE.contextForModel(location.hash.slice(1), 'INSPECT')
```

Expect `usgs-earthquakes` and `osm-datacenters` to leave `idle/loading`, then select a regional triangle and expect `adsb-lol-aircraft` to acquire a coverage cell. Configure a FIRMS key, reopen that triangle, and expect `nasa-firms.meta.coverageCell` to equal the selected cell slug. Open a smaller triangle twice at least 15 seconds apart and inspect an aircraft with:

```js
ICOSA_LIVE.aircraftHistory('icao24')
```

A valid moving contact should accumulate trail points and eventually `from -> to` cell transitions at trace depth 9. The same crossings should then appear under `context.live.movement.aircraft_crossings` for any focus cell coarse enough to contain them.
