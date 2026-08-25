#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SAMPLE = { signals: 32, entities: 24, relations: 24, statements: 16 };

function readJSON(path, fallback = null) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}
function writeJSON(path, value) { writeFileSync(path, JSON.stringify(value, null, 2) + '\n'); }
function uniq(xs) { return [...new Set(xs.filter(Boolean))]; }
function bump(obj, key, n = 1) { if (key) obj[key] = (obj[key] || 0) + n; }
function validSlug(slug) { return /^F\d{2}(?:\.[0-3]+)?$/.test(String(slug || '')); }
function prefixes(slug) {
  if (!validSlug(slug)) return [];
  const [root, path = ''] = slug.split('.');
  const out = [root];
  for (let i = 1; i <= path.length; i++) out.push(root + '.' + path.slice(0, i));
  return out;
}
function importanceRank(s) {
  const i = s?.importance || {}, vals = [];
  for (const k of ['change','exposure','anomaly','contestation','consequence','evidence_diversity','novelty']) {
    if (Number.isFinite(Number(i[k]))) vals.push(Number(i[k]));
  }
  if (Number.isFinite(Number(i.uncertainty))) vals.push(1 - Number(i.uncertainty));
  return vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : 0;
}
function recency(x) {
  const v = x?.observed_at || x?.valid_from || x?.retrieved_at || x?.created_at || null;
  const t = v ? Date.parse(v) : 0;
  return Number.isFinite(t) ? t : 0;
}
function bucket(address) {
  return {
    schema: 'geonosis-compiled-cell-v0.1',
    atlas_address: address,
    regions: new Set(),
    sources: new Set(),
    counts: { signals: 0, entities: 0, relations: 0, statements: 0,
      direct_signals: 0, direct_entities: 0, direct_statements: 0 },
    signal_predicates: {}, entity_types: {}, relation_predicates: {}, statement_kinds: {},
    signals: [], entities: [], relations: [], statements: []
  };
}
function putSample(arr, item, max, scoreFn) {
  arr.push(item);
  arr.sort((a,b) => scoreFn(b) - scoreFn(a) || String(a.id || '').localeCompare(String(b.id || '')));
  if (arr.length > max) arr.length = max;
}
function annotate(x, region) { return { ...x, publication_region: region }; }

export function publishRuns(inputDirs, outDir) {
  outDir = resolve(outDir);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, 'cells'), { recursive: true });

  const cells = new Map(), leaves = new Set(), scoped = [], regions = [], sourceHealth = {};
  const get = address => { if (!cells.has(address)) cells.set(address, bucket(address)); return cells.get(address); };

  function walkAddress(address, region, fn) {
    if (!validSlug(address)) return;
    leaves.add(address);
    for (const p of prefixes(address)) { const b = get(p); b.regions.add(region); fn(b, p === address); }
  }

  for (const dir0 of inputDirs) {
    const dir = resolve(dir0), manifest = readJSON(join(dir, 'manifest.json'));
    if (!manifest) throw new Error(`missing harvest manifest: ${dir}`);
    const region = manifest.publication_region || basename(dir);
    const label = manifest.publication_label || region;
    const signals = readJSON(join(dir, 'signals.json'), []);
    const entities = readJSON(join(dir, 'entities.json'), []);
    const relations = readJSON(join(dir, 'relations.json'), []);
    const statements = readJSON(join(dir, 'statements.json'), []);
    const entityById = new Map(entities.map(e => [e.id, e]));

    regions.push({
      id: region,
      label,
      query: manifest.query,
      created_at: manifest.created_at,
      counts: manifest.counts,
      note: 'Reference-window harvest. Administrative-scope records are published separately and are not painted into triangles.'
    });
    for (const s of manifest.sources || []) sourceHealth[`${region}:${s.id}`] = { region, ...s };

    for (const s of signals) {
      if (!validSlug(s.atlas_address)) {
        scoped.push({ region, kind: 'signal', record: s });
        continue;
      }
      walkAddress(s.atlas_address, region, (b, direct) => {
        b.counts.signals++; if (direct) b.counts.direct_signals++;
        b.sources.add(s.source); bump(b.signal_predicates, s.predicate);
        putSample(b.signals, annotate(s, region), SAMPLE.signals, recency);
      });
    }
    for (const e of entities) {
      if (!validSlug(e.atlas_address)) {
        if (e.scope) scoped.push({ region, kind: 'entity', record: e });
        continue;
      }
      walkAddress(e.atlas_address, region, (b, direct) => {
        b.counts.entities++; if (direct) b.counts.direct_entities++;
        bump(b.entity_types, e.type);
        putSample(b.entities, annotate(e, region), SAMPLE.entities, x => recency(x) + (x.name ? 1 : 0));
      });
    }
    for (const r of relations) {
      const a = entityById.get(r.subject)?.atlas_address, z = entityById.get(r.object)?.atlas_address;
      const addresses = uniq([a, z]).filter(validSlug);
      if (!addresses.length) {
        scoped.push({ region, kind: 'relation', record: r });
        continue;
      }
      const visited = new Set();
      for (const address of addresses) {
        walkAddress(address, region, b => {
          if (visited.has(b.atlas_address)) return;
          visited.add(b.atlas_address); b.counts.relations++; bump(b.relation_predicates, r.predicate);
          putSample(b.relations, annotate(r, region), SAMPLE.relations, recency);
        });
      }
    }
    for (const s of statements) {
      if (!validSlug(s.atlas_address)) {
        scoped.push({ region, kind: 'statement', record: s });
        continue;
      }
      walkAddress(s.atlas_address, region, (b, direct) => {
        b.counts.statements++; if (direct) b.counts.direct_statements++;
        bump(b.statement_kinds, s.kind);
        putSample(b.statements, { ...annotate(s, region), publication_rank: +importanceRank(s).toFixed(4) }, SAMPLE.statements, x => Number(x.publication_rank || 0));
      });
    }
  }

  const prefixesOut = [...cells.keys()].sort((a,b) => a.length - b.length || a.localeCompare(b));
  for (const address of prefixesOut) {
    const b = cells.get(address);
    writeJSON(join(outDir, 'cells', `${address}.json`), {
      ...b,
      generated_at: new Date().toISOString(),
      regions: [...b.regions].sort(),
      sources: [...b.sources].sort(),
      coverage_note: 'Counts aggregate only compiled descendant records under this Icosa prefix. Samples are bounded. A non-point source keeps its representative-address caveat from the source signal.'
    });
  }

  const manifest = {
    schema: 'geonosis-compiled-index-v0.1',
    generated_at: new Date().toISOString(),
    prefixes: prefixesOut,
    leaves: [...leaves].sort(),
    regions,
    source_health: Object.values(sourceHealth),
    counts: { prefixes: prefixesOut.length, leaves: leaves.size, scoped_records: scoped.length },
    scope_law: 'A prefix bundle contains compiled records whose Atlas addresses descend from that prefix. Unaddressed administrative scopes live in scoped.json and are never treated as point or triangle evidence.'
  };
  writeJSON(join(outDir, 'manifest.json'), manifest);
  writeJSON(join(outDir, 'scoped.json'), {
    schema: 'geonosis-compiled-scopes-v0.1', generated_at: manifest.generated_at,
    note: 'Administrative/jurisdictional evidence retained without fabricated triangle assignment.', records: scoped.slice(0, 1000)
  });
  return manifest;
}

function cliArgs(argv) {
  const out = {}; for (let i=2;i<argv.length;i++) if (argv[i].startsWith('--')) {
    const k=argv[i].slice(2), v=argv[i+1]; if (v && !v.startsWith('--')) { out[k]=v; i++; } else out[k]=true;
  } return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const a = cliArgs(process.argv), inputs = String(a.inputs || '').split(',').filter(Boolean);
  if (!inputs.length) throw new Error('--inputs dir1,dir2 is required');
  const m = publishRuns(inputs, a.out || 'geonosis/data');
  process.stdout.write(JSON.stringify(m.counts, null, 2) + '\n');
}
