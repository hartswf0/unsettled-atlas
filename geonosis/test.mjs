#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createAddressor } from './icosa-address.mjs';
import { normalizeSignal, pointGeometry, validateSignal } from './schema.mjs';
import { inferStatements } from './infer.mjs';

const A = createAddressor();

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

const mk = (source, predicate, lon, lat, n = 1) => normalizeSignal({
  source,
  source_record_id: `${source}-${n}`,
  predicate,
  value: n,
  geometry: pointGeometry(lon, lat),
  epistemic: 'REPORTED',
  atlas_address: A.addressPoint(lon, lat, 8),
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
  ...Array.from({ length: 5 }, (_, i) => mk('wikipedia-geosearch', 'attention.wikipedia_entity', lon, lat, 10 + i))
];

const statements = inferStatements(signals);
const kinds = new Set(statements.map(s => s.kind));
assert(kinds.has('hazard_presence'));
assert(kinds.has('representation_contestation'));
assert(kinds.has('attention_density'));
assert(kinds.has('multi_source_activity'));
for (const s of statements) {
  assert.equal(s.epistemic, 'INFERRED');
  assert(s.evidence.length > 0);
}

process.stdout.write(JSON.stringify({
  ok: true,
  tests: {
    address_prefix: true,
    root_face_identity: true,
    signal_validation: true,
    deterministic_inference: true
  },
  atlanta: A.addressPoint(-84.388, 33.749, 10),
  new_orleans: A.addressPoint(-90.0715, 29.9511, 10)
}, null, 2) + '\n');
