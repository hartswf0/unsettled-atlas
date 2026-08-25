# ICOSA LIVE DATA

`icosa-syntegrity-live.html` is an additive live-data harness for `icosa-syntegrity.html`.

The map remains place-first. Sources do not become independent map layers. Every usable row is normalized, assigned an ICOSA address, indexed through its ancestor chain, and only then rendered or exposed to the selected triangle.

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
```

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

## Rendering law

The visible unit is always the triangle first.

```text
broad scale      source records -> cell counts / density
narrow scale     cell counts -> individual observations
movement         positions -> cell transitions -> trace
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

The interface must never collapse the first six into the seventh.

## Validation boundary

The original observation bus passed a local mocked execution of normalization -> 13-prefix indexing -> source replacement -> per-cell inventory. The later browser adapters have been reviewed against the current ICOSA closure and committed through GitHub, but this execution environment cannot resolve `github.com` for a fresh branch clone, so a full browser/runtime pass of the expanded branch remains to be run in the deployed GitHub Pages context before merge.
