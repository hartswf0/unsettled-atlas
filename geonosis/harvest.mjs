#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTERS, DEFAULT_SOURCES } from './adapters.mjs';
import { createAddressor } from './icosa-address.mjs';
import { inferStatements } from './infer.mjs';
import { validateSignal } from './schema.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function args(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next != null && !next.startsWith('--')) { out[k] = next; i++; }
    else out[k] = true;
  }
  return out;
}

function needNumber(v, name, fallback = null) {
  if (v == null && fallback != null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--${name} must be a number`);
  return n;
}

function safeRunId(lat, lon) {
  const t = new Date().toISOString().replace(/[:.]/g, '-');
  return `${t}_${lat.toFixed(4)}_${lon.toFixed(4)}`.replace(/[^0-9A-Za-z_.-]/g, '_');
}

function writeJSON(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

function addressSignals(signals, addressor, depth) {
  const good = [];
  const rejected = [];
  for (const s of signals) {
    const errors = validateSignal(s);
    if (errors.length) { rejected.push({ signal: s.id || null, errors }); continue; }
    if (s.geometry?.type === 'Point') {
      const [lon, lat] = s.geometry.coordinates;
      s.atlas_address = addressor.addressPoint(lon, lat, depth);
    }
    good.push(s);
  }
  return { good, rejected };
}

function groupCells(signals) {
  const cells = new Map();
  for (const s of signals) {
    if (!s.atlas_address) continue;
    if (!cells.has(s.atlas_address)) cells.set(s.atlas_address, []);
    cells.get(s.atlas_address).push(s);
  }
  return cells;
}

async function run() {
  const a = args(process.argv);
  const lat = needNumber(a.lat, 'lat');
  const lon = needNumber(a.lon, 'lon');
  const radiusKm = needNumber(a['radius-km'], 'radius-km', 15);
  const depth = Math.max(0, Math.min(20, Math.round(needNumber(a.depth, 'depth', 10))));
  const sinceDays = Math.max(1, Math.round(needNumber(a['since-days'], 'since-days', 30)));
  const limit = Math.max(1, Math.round(needNumber(a.limit, 'limit', 500)));
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error('lat/lon out of range');
  if (radiusKm <= 0) throw new Error('--radius-km must be positive');

  const selected = String(a.sources || DEFAULT_SOURCES.join(','))
    .split(',').map(s => s.trim()).filter(Boolean);
  for (const id of selected) if (!ADAPTERS[id]) throw new Error(`no executable adapter: ${id}`);

  const runId = a['run-id'] || safeRunId(lat, lon);
  const outDir = resolve(a.out || join(HERE, 'out', runId));
  mkdirSync(join(outDir, 'cells'), { recursive: true });

  const ctx = { lat, lon, radiusKm, depth, sinceDays, limit };
  const sourceRuns = [];
  const batches = await Promise.all(selected.map(async id => {
    const started = new Date().toISOString();
    try {
      const signals = await ADAPTERS[id](ctx);
      sourceRuns.push({ id, status: 'ok', started, finished: new Date().toISOString(), count: signals.length });
      return signals;
    } catch (err) {
      sourceRuns.push({ id, status: 'error', started, finished: new Date().toISOString(), count: 0, error: String(err?.message || err) });
      return [];
    }
  }));

  const addressor = createAddressor();
  const { good: signals, rejected } = addressSignals(batches.flat(), addressor, depth);
  signals.sort((a, b) => String(a.atlas_address).localeCompare(String(b.atlas_address)) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id));

  const statements = inferStatements(signals);
  const cells = groupCells(signals);
  for (const [address, ss] of cells) {
    const cellStatements = statements.filter(x => x.atlas_address === address);
    writeJSON(join(outDir, 'cells', `${address}.json`), {
      atlas_address: address,
      signals: ss,
      statements: cellStatements
    });
  }

  const manifest = {
    schema: 'geonosis-harvest-v0',
    run_id: runId,
    created_at: new Date().toISOString(),
    query: ctx,
    sources: sourceRuns.sort((a, b) => a.id.localeCompare(b.id)),
    counts: {
      signals: signals.length,
      statements: statements.length,
      addressed_cells: cells.size,
      rejected: rejected.length
    },
    epistemic_note: 'A source result is not an Atlas fact merely because it was retrieved. See geonosis/SYSTEM.md.'
  };

  writeJSON(join(outDir, 'manifest.json'), manifest);
  writeJSON(join(outDir, 'signals.json'), signals);
  writeJSON(join(outDir, 'statements.json'), statements);
  if (rejected.length) writeJSON(join(outDir, 'rejected.json'), rejected);

  process.stdout.write(JSON.stringify({ out: outDir, ...manifest.counts, sources: manifest.sources }, null, 2) + '\n');
}

run().catch(err => {
  process.stderr.write(`geonosis harvest failed: ${err?.stack || err}\n`);
  process.exitCode = 1;
});
