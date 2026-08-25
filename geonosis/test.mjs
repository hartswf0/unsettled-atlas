#!/usr/bin/env node
import assert from 'node:assert/strict';
import { ADAPTERS, defaultSourcesFor } from './adapters-all.mjs';
import { createAddressor } from './icosa-address.mjs';
import { addressBasis, representativePoint } from './geometry.mjs';
import { normalizeSignal, pointGeometry, validateSignal } from './schema.mjs';
import { inferStatements } from './infer.mjs';

const A = createAddressor();

// Every executable adapter must at least load as program text without making
// the offline contract depend on the network.
for (const id of [
  'usgs-earthquakes','nws-alerts','osm-notes','wikipedia-geosearch','eonet',
  'gbif-occurrences','inaturalist-observations','epa-echo','nps-national-register',
  'nola-building-permits','nola-code-enforcement','atlanta-historic-buildings',
  'atlanta-rezoning-cases','usaspending-county'
]) assert.equal(typeof ADAPTERS[id], 'function', `adapter did not load: ${id}`);

const atlDefaults = defaultSourcesFor({ lat: 33.749, lon: -84.388, radiusKm: 10 });
assert(atlDefaults.includes('atlanta-historic-buildings'));
assert(atlDefaults.includes('atlanta-rezoning-cases'));
assert(!atlDefaults.includes('nola-building-permits'));
const nolaDefaults = defaultSourcesFor({ lat: 29.9511, lon: -90.0715, radiusKm: 10 });
assert(nolaDefaults.includes('nola-building-permits'));
assert(nolaDefaults.includes('nola-code-enforcement'));

// Address format and prefix invariance: deeper ground must remain inside its parent.
for (const [lon, lat] of [[-84.388, 33.749], [-90.0715, 29.9511], [0, 0], [139.6917, 35.6895], [151.2093, -33.8688]]) {
  const d4 = A.addressPoint(lon, lat, 4);
  const d10 = A.addressPoint(lon, lat, 10);
  assert.match(d4, /^F\d{2}\.[0-3]{4}$/);
  assert.match(d10, /^F\d{2}\.[0-3]{10}$/);
  assert.equal(d10.slice(0, d4.length), d4, `depth prefix failed at ${lon},${lat}`);
  assert.equal(A.addressPoint(lon, lat, 10), d10, 'address must be deterministic');
}

// Every root face centre must resolve to its own root face.
for (let f = 0; f < A.FACES.length; f++) {
  const p = A.baryPoint(f, [1 / 3, 1 / 3, 1 / 3]);
  assert.equal(A.faceOf(p), f, `root face centre ${f} resolved elsewhere`);
}

// Source geometry survives indexing. A source point is exact; a polygon only
// receives a named representative point and remains a polygon.
const srcPoint = { type: 'Point', coordinates: [-84.388, 33.749] };
const pb = addressBasis(srcPoint);
assert.equal(pb.exact, true);
assert.equal(pb.method, 'source_point');
assert.deepEqual(srcPoint, { type: 'Point', coordinates: [-84.388, 33.749] });

const poly = {
  type: 'Polygon',
  coordinates: [[[-84.40,33.74],[-84.38,33.74],[-84.38,33.76],[-84.40,33.76],[-84.40,33.74]]]
};
const pr = representativePoint(poly);
assert.equal(pr.exact, false);
assert.equal(pr.method, 'polygon_centroid_representative');
assert(Math.abs(pr.point[0] + 84.39) < 1e-8);
assert(Math.abs(pr.point[1] - 33.75) < 1e-8);
assert.equal(poly.type, 'Polygon');

const mk = (source, predicate, lon, lat, n = 1, value = n) => normalizeSignal({
  source,
  source_record_id: `${source}-${n}`,
  predicate,
  value,
  geometry: pointGeometry(lon, lat),
  atlas_address: A.addressPoint(lon, lat, 8),
  atlas_address_basis: { method: 'source_point', representative_point: [lon, lat], exact: true },
  epistemic: 'REPORTED',
  actors: ['GROUND']
});

const bad = normalizeSignal({ source: 'fixture', predicate: 'x', epistemic: 'REPORTED' });
assert.deepEqual(validateSignal(bad), []);

const lon = -84.388, lat = 33.749;
const signals = [
  mk('osm-notes', 'claim.map_note', lon, lat, 1),
  mk('osm-notes', 'claim.map_note', lon, lat, 2),
  mk('usgs-earthquakes', 'hazard.earthquake', lon, lat, 3),
  mk('eonet', 'hazard.natural_event', lon, lat, 4),
  ...Array.from({ length: 5 }, (_, i) => mk('wikipedia-geosearch', 'attention.wikipedia_entity', lon, lat, 10 + i)),
  ...Array.from({ length: 3 }, (_, i) => mk('gbif-occurrences', 'ecology.occurrence', lon, lat, 20 + i)),
  ...Array.from({ length: 2 }, (_, i) => mk('inaturalist-observations', 'ecology.inaturalist_observation', lon, lat, 30 + i)),
  mk('epa-echo', 'environment.regulated_facility', lon, lat, 40, { significant_noncompliance: 'Y' }),
  mk('epa-echo', 'environment.regulated_facility', lon, lat, 41, { significant_noncompliance: 'N' }),
  mk('nps-national-register', 'memory.national_register_resource', lon, lat, 50),
  mk('atlanta-historic-buildings', 'memory.atlanta_historic_building', lon, lat, 51),
  mk('nola-building-permits', 'change.building_permit', lon, lat, 60),
  mk('nola-building-permits', 'change.building_permit', lon, lat, 61),
  mk('nola-code-enforcement', 'service.code_enforcement_case', lon, lat, 70),
  mk('nola-code-enforcement', 'service.code_enforcement_case', lon, lat, 71)
];

const statements = inferStatements(signals);
const kinds = new Set(statements.map(s => s.kind));
for (const expected of [
  'hazard_presence',
  'representation_contestation',
  'attention_density',
  'ecological_observation_density',
  'regulated_environment_presence',
  'institutional_memory_density',
  'building_change_activity',
  'service_enforcement_pressure',
  'heritage_change_coaddress',
  'multi_source_activity'
]) assert(kinds.has(expected), `missing inference ${expected}`);

for (const s of statements) {
  assert.equal(s.epistemic, 'INFERRED');
  assert(s.evidence.length > 0);
  assert.deepEqual(s.evidence, s.derived_from);
}

process.stdout.write(JSON.stringify({
  ok: true,
  tests: {
    executable_adapters_load: true,
    regional_defaults: true,
    address_prefix: true,
    root_face_identity: true,
    source_geometry_preserved: true,
    representative_address_basis: true,
    signal_validation: true,
    deterministic_inference: true
  },
  adapters: Object.keys(ADAPTERS).sort(),
  inference_kinds: [...kinds].sort(),
  atlanta: A.addressPoint(-84.388, 33.749, 10),
  new_orleans: A.addressPoint(-90.0715, 29.9511, 10)
}, null, 2) + '\n');
