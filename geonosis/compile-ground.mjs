#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishRuns } from './publish.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TMP = join(HERE, '.compile');
const OUT = join(HERE, 'data');

const COMMON = [
  'osm-notes','wikipedia-geosearch','gbif-occurrences','inaturalist-observations',
  'epa-echo','nps-national-register','usaspending-county','fdic-locations','fdic-sod','hmda-lenders'
];
const REGIONS = [
  {
    id: 'atlanta', label: 'ATLANTA REFERENCE GROUND', lat: 33.7490, lon: -84.3880, radiusKm: 40,
    sources: [...COMMON, 'atlanta-historic-buildings','atlanta-rezoning-cases']
  },
  {
    id: 'new-orleans', label: 'NEW ORLEANS TEST GROUND', lat: 29.9511, lon: -90.0715, radiusKm: 40,
    sources: [...COMMON, 'nola-building-permits','nola-code-enforcement']
  }
];

function stampManifest(dir, region) {
  const path = join(dir, 'manifest.json');
  const m = JSON.parse(readFileSync(path, 'utf8'));
  m.publication_region = region.id;
  m.publication_label = region.label;
  m.publication_window = { lat: region.lat, lon: region.lon, radius_km: region.radiusKm };
  writeFileSync(path, JSON.stringify(m, null, 2) + '\n');
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const runs = [];

for (const region of REGIONS) {
  const out = join(TMP, region.id); runs.push(out);
  process.stdout.write(`HARVEST ${region.label}\n`);
  execFileSync(process.execPath, [
    join(HERE, 'harvest.mjs'),
    '--lat', String(region.lat), '--lon', String(region.lon),
    '--radius-km', String(region.radiusKm), '--depth', '10', '--since-days', '365', '--limit', '160',
    '--gleif-limit', '24', '--sources', region.sources.join(','), '--run-id', region.id, '--out', out
  ], { cwd: ROOT, stdio: 'inherit', timeout: 8 * 60 * 1000 });
  stampManifest(out, region);
}

const manifest = publishRuns(runs, OUT);
rmSync(TMP, { recursive: true, force: true });
process.stdout.write(JSON.stringify({ ok: true, out: OUT, ...manifest.counts, regions: manifest.regions.map(r => r.id) }, null, 2) + '\n');
