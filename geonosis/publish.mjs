#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function readJSON(path, fallback = null) { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; } }
function writeJSON(path, value) { writeFileSync(path, JSON.stringify(value, null, 2) + '\n'); }
function uniq(xs) { return [...new Set(xs.filter(Boolean))]; }
function bump(obj, key, n = 1) { if (key) obj[key] = (obj[key] || 0) + n; }
function validSlug(slug) { return /^F\d{2}(?:\.[0-3]+)?$/.test(String(slug || '')); }
function depthOf(slug) { return (String(slug || '').split('.')[1] || '').length; }
function prefixes(slug) {
  if (!validSlug(slug)) return [];
  const [root, path = ''] = slug.split('.'), out = [root];
  for (let i = 1; i <= path.length; i++) out.push(root + '.' + path.slice(0, i));
  return out;
}
function limits(address) {
  const d = depthOf(address);
  if (d <= 4) return { signals: 2, entities: 2, relations: 2, statements: 4 };
  if (d <= 7) return { signals: 4, entities: 4, relations: 4, statements: 6 };
  if (d <= 9) return { signals: 8, entities: 8, relations: 8, statements: 8 };
  return { signals: 12, entities: 12, relations: 12, statements: 10 };
}
function importanceRank(s) {
  const i = s?.importance || {}, vals = [];
  for (const k of ['change','exposure','anomaly','contestation','consequence','evidence_diversity','novelty']) if (Number.isFinite(Number(i[k]))) vals.push(Number(i[k]));
  if (Number.isFinite(Number(i.uncertainty))) vals.push(1 - Number(i.uncertainty));
  return vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : 0;
}
function recency(x) {
  const v = x?.observed_at || x?.valid_from || x?.retrieved_at || x?.created_at || null, t = v ? Date.parse(v) : 0;
  return Number.isFinite(t) ? t : 0;
}
function shrink(v, depth = 0) {
  if (v == null || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.length > 180 ? v.slice(0,177) + '…' : v;
  if (depth >= 2) return Array.isArray(v) ? `[${v.length} items]` : '[object]';
  if (Array.isArray(v)) return v.slice(0,6).map(x => shrink(x, depth + 1));
  const out = {}, keys = Object.keys(v).filter(k => !['response','request','raw','description','instruction'].includes(k)).slice(0,12);
  for (const k of keys) out[k] = shrink(v[k], depth + 1);
  return out;
}
function compactSignal(s, region) {
  return { id:s.id, source:s.source, predicate:s.predicate, value:shrink(s.value), unit:s.unit??null,
    atlas_address:s.atlas_address, atlas_address_basis:s.atlas_address_basis?{method:s.atlas_address_basis.method,exact:!!s.atlas_address_basis.exact}:null,
    epistemic:s.epistemic, observed_at:s.observed_at||null, valid_from:s.valid_from||null, retrieved_at:s.retrieved_at||null,
    actors:(s.actors||[]).slice(0,8), publication_region:region };
}
function compactEntity(e, region) {
  return { id:e.id,type:e.type,name:e.name||null,identifiers:shrink(e.identifiers||{}),atlas_address:e.atlas_address||null,scope:e.scope||null,properties:shrink(e.properties||{}),publication_region:region };
}
function compactRelation(r, region) {
  return { id:r.id,subject:r.subject,predicate:r.predicate,object:r.object,value:shrink(r.value),valid_from:r.valid_from||null,valid_to:r.valid_to||null,epistemic:r.epistemic,derived_from:(r.derived_from||[]).slice(0,24),evidence_count:(r.derived_from||[]).length,publication_region:region };
}
function compactStatement(s, region, direct) {
  const evidence = s.evidence || s.derived_from || [], max = direct ? 64 : 16;
  return { id:s.id,kind:s.kind,text:shrink(s.text),epistemic:s.epistemic,atlas_address:s.atlas_address||null,scope_id:s.scope_id||null,
    evidence:evidence.slice(0,max),evidence_count:evidence.length,evidence_truncated:evidence.length>max,
    importance:shrink(s.importance||{}),publication_rank:+importanceRank(s).toFixed(4),publication_region:region };
}
function bucket(address) {
  return { schema:'geonosis-compiled-cell-v0.2',atlas_address:address,regions:new Set(),sources:new Set(),
    counts:{signals:0,entities:0,relations:0,statements:0,direct_signals:0,direct_entities:0,direct_statements:0},
    signal_predicates:{},entity_types:{},relation_predicates:{},statement_kinds:{},signals:[],entities:[],relations:[],statements:[] };
}
function putSample(arr, item, max, scoreFn) {
  arr.push(item); arr.sort((a,b)=>scoreFn(b)-scoreFn(a)||String(a.id||'').localeCompare(String(b.id||''))); if(arr.length>max)arr.length=max;
}

export function publishRuns(inputDirs, outDir) {
  outDir=resolve(outDir);rmSync(outDir,{recursive:true,force:true});mkdirSync(join(outDir,'cells'),{recursive:true});
  const cells=new Map(),leaves=new Set(),scoped=[],regions=[],sourceHealth={};
  const get=address=>{if(!cells.has(address))cells.set(address,bucket(address));return cells.get(address);};
  function walkAddress(address,region,fn){if(!validSlug(address))return;leaves.add(address);for(const p of prefixes(address)){const b=get(p);b.regions.add(region);fn(b,p===address,limits(p));}}

  for(const dir0 of inputDirs){
    const dir=resolve(dir0),manifest=readJSON(join(dir,'manifest.json'));if(!manifest)throw new Error(`missing harvest manifest: ${dir}`);
    const region=manifest.publication_region||basename(dir),label=manifest.publication_label||region;
    const signals=readJSON(join(dir,'signals.json'),[]),entities=readJSON(join(dir,'entities.json'),[]),relations=readJSON(join(dir,'relations.json'),[]),statements=readJSON(join(dir,'statements.json'),[]),entityById=new Map(entities.map(e=>[e.id,e]));
    regions.push({id:region,label,query:manifest.query,created_at:manifest.created_at,counts:manifest.counts,required_source_gate:manifest.required_source_gate||{},note:'Reference-window harvest. Administrative-scope records are published separately and are not painted into triangles.'});
    for(const s of manifest.sources||[])sourceHealth[`${region}:${s.id}`]={region,...s};

    for(const s of signals){
      if(!validSlug(s.atlas_address)){scoped.push({region,kind:'signal',record:{...compactSignal(s,region),atlas_address:null,provenance:shrink(s.provenance||{})}});continue;}
      walkAddress(s.atlas_address,region,(b,direct,L)=>{b.counts.signals++;if(direct)b.counts.direct_signals++;b.sources.add(s.source);bump(b.signal_predicates,s.predicate);putSample(b.signals,compactSignal(s,region),L.signals,recency);});
    }
    for(const e of entities){
      if(!validSlug(e.atlas_address)){if(e.scope)scoped.push({region,kind:'entity',record:compactEntity(e,region)});continue;}
      walkAddress(e.atlas_address,region,(b,direct,L)=>{b.counts.entities++;if(direct)b.counts.direct_entities++;bump(b.entity_types,e.type);putSample(b.entities,compactEntity(e,region),L.entities,x=>recency(x)+(x.name?1:0));});
    }
    for(const r of relations){
      const addresses=uniq([entityById.get(r.subject)?.atlas_address,entityById.get(r.object)?.atlas_address]).filter(validSlug);
      if(!addresses.length){scoped.push({region,kind:'relation',record:compactRelation(r,region)});continue;}
      const visited=new Set();
      for(const address of addresses)walkAddress(address,region,(b,_direct,L)=>{if(visited.has(b.atlas_address))return;visited.add(b.atlas_address);b.counts.relations++;bump(b.relation_predicates,r.predicate);putSample(b.relations,compactRelation(r,region),L.relations,recency);});
    }
    for(const s of statements){
      if(!validSlug(s.atlas_address)){scoped.push({region,kind:'statement',record:{...compactStatement(s,region,true),atlas_address:null}});continue;}
      walkAddress(s.atlas_address,region,(b,direct,L)=>{b.counts.statements++;if(direct)b.counts.direct_statements++;bump(b.statement_kinds,s.kind);putSample(b.statements,compactStatement(s,region,direct),L.statements,x=>Number(x.publication_rank||0));});
    }
  }

  const prefixesOut=[...cells.keys()].sort((a,b)=>a.length-b.length||a.localeCompare(b));
  for(const address of prefixesOut){const b=cells.get(address);writeJSON(join(outDir,'cells',`${address}.json`),{...b,regions:[...b.regions].sort(),sources:[...b.sources].sort(),coverage_note:'Counts aggregate only compiled descendant records under this Icosa prefix. Arrays are bounded compact samples, not the raw source corpus. Administrative scopes are excluded.'});}
  const manifest={schema:'geonosis-compiled-index-v0.2',generated_at:new Date().toISOString(),prefixes:prefixesOut,leaves:[...leaves].sort(),regions,source_health:Object.values(sourceHealth),counts:{prefixes:prefixesOut.length,leaves:leaves.size,scoped_records:scoped.length},scope_law:'A prefix bundle contains only compiled records whose Atlas addresses descend from that prefix. Unaddressed administrative scopes live in scoped.json and are never treated as point or triangle evidence.',publication_law:'Static cell files contain compact bounded evidence samples plus complete aggregate counts. Raw harvest payloads are intentionally not duplicated into ancestor bundles.'};
  writeJSON(join(outDir,'manifest.json'),manifest);
  writeJSON(join(outDir,'scoped.json'),{schema:'geonosis-compiled-scopes-v0.2',generated_at:manifest.generated_at,note:'Administrative/jurisdictional evidence retained without fabricated triangle assignment.',records:scoped.slice(0,1000)});
  return manifest;
}

function cliArgs(argv){const out={};for(let i=2;i<argv.length;i++)if(argv[i].startsWith('--')){const k=argv[i].slice(2),v=argv[i+1];if(v&&!v.startsWith('--')){out[k]=v;i++;}else out[k]=true;}return out;}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const a=cliArgs(process.argv),inputs=String(a.inputs||'').split(',').filter(Boolean);if(!inputs.length)throw new Error('--inputs dir1,dir2 is required');const m=publishRuns(inputs,a.out||'geonosis/data');process.stdout.write(JSON.stringify(m.counts,null,2)+'\n');}
