#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileBackplane, mapFeatures } from './system-backplane.mjs';
import { correspondenceRules, actorRuleManifest } from './system-rules.mjs';

const HERE=dirname(fileURLToPath(import.meta.url));
function args(argv){const out={};for(let i=2;i<argv.length;i++){const a=argv[i];if(!a.startsWith('--'))continue;const k=a.slice(2),n=argv[i+1];if(n!=null&&!n.startsWith('--')){out[k]=n;i++;}else out[k]=true;}return out;}
function readJSON(path,fallback=null){if(!existsSync(path))return fallback;return JSON.parse(readFileSync(path,'utf8'));}
function readJSONL(path){if(!existsSync(path))return[];return readFileSync(path,'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));}
function writeJSON(path,value){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(value,null,2)+'\n');}
function writeJSONL(path,rows){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,rows.map(x=>JSON.stringify(x)).join('\n')+(rows.length?'\n':''));}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function byId(rows=[]){return new Map(rows.map(x=>[x.id,x]));}
function currentBySubject(current=[]){const m=new Map();for(const s of current){if(!m.has(s.subject_id))m.set(s.subject_id,[]);m.get(s.subject_id).push(s);}return m;}
function groupCells(system){
  const formsById=byId(system.forms),obsByForm=new Map(),eventsBySubject=new Map(),possByScope=new Map();
  for(const o of system.observations){if(!obsByForm.has(o.form_id))obsByForm.set(o.form_id,[]);obsByForm.get(o.form_id).push(o);}
  for(const e of system.events){if(!eventsBySubject.has(e.subject_id))eventsBySubject.set(e.subject_id,[]);eventsBySubject.get(e.subject_id).push(e);}
  for(const p of system.possibilities){const k=String(p.geographic_scope||'');if(!possByScope.has(k))possByScope.set(k,[]);possByScope.get(k).push(p);}
  const currentMap=currentBySubject(system.current),cells=new Map();
  for(const f of system.forms){if(!f.atlas_address)continue;if(!cells.has(f.atlas_address))cells.set(f.atlas_address,{atlas_address:f.atlas_address,subject_ids:new Set(),form_ids:new Set()});const c=cells.get(f.atlas_address);c.subject_ids.add(f.subject_id);c.form_ids.add(f.id);}
  const out=[];
  for(const c of cells.values()){
    const subjects=system.subjects.filter(s=>c.subject_ids.has(s.id));
    const forms=[...c.form_ids].map(id=>formsById.get(id)).filter(Boolean);
    const current=subjects.flatMap(s=>currentMap.get(s.id)||[]);
    const events=subjects.flatMap(s=>eventsBySubject.get(s.id)||[]);
    const possibilities=system.possibilities.filter(p=>p.geographic_scope===c.atlas_address||subjects.some(s=>p.geographic_scope===s.id));
    out.push({atlas_address:c.atlas_address,subjects,forms,current,events,possibilities});
  }
  return out;
}

export function compileDirectory({inputDir,outDir,region,centerLat=null,centerLon=null,mapLimit=1500}){
  inputDir=resolve(inputDir);outDir=resolve(outDir);mkdirSync(outDir,{recursive:true});
  const signals=readJSON(join(inputDir,'signals.json'),[]),harvest=readJSON(join(inputDir,'manifest.json'),{});
  if(!Array.isArray(signals))throw new Error(`${inputDir}/signals.json must be an array`);
  const existing={forms:readJSON(join(outDir,'forms.json'),[]),observations:readJSONL(join(outDir,'ledger.jsonl'))};
  const system=compileBackplane(signals,existing),cells=groupCells(system),map=mapFeatures(system,{limit:mapLimit});
  const lat=finite(centerLat??harvest.query?.lat),lon=finite(centerLon??harvest.query?.lon);
  const sourceFailures=(harvest.sources||[]).filter(s=>s.status!=='ok');
  const manifest={
    schema:'geonosis-system-public-v1',region,generated_at:new Date().toISOString(),center:lat!==null&&lon!==null?[lat,lon]:null,
    harvest_run_id:harvest.run_id||null,harvest_created_at:harvest.created_at||null,
    counts:{signals:signals.length,forms:system.forms.length,observations:system.observations.length,subjects:system.subjects.length,current_states:system.current.length,correspondences:system.correspondences.length,events:system.events.length,active_events:system.events.filter(e=>e.active).length,possibilities:system.possibilities.length,addressed_cells:cells.length,map_features:map.features.length,bridge_errors:system.bridge_errors.length},
    source_health:{total:(harvest.sources||[]).length,failed:sourceFailures.length,failures:sourceFailures.map(s=>({id:s.id,error:s.error||s.status}))},
    laws:['map is a client, not an inference engine','no cross-source identity from coordinate proximity','no correspondence without an explicit registered rule','unchanged observations deduplicate by stable id','UNKNOWN and zero licensed events are valid system outputs'],
    rule_registry:{correspondence:correspondenceRules(),actor:actorRuleManifest()}
  };
  writeJSON(join(outDir,'manifest.json'),manifest);writeJSON(join(outDir,'forms.json'),system.forms);writeJSONL(join(outDir,'ledger.jsonl'),system.observations);writeJSON(join(outDir,'subjects.json'),system.subjects);writeJSON(join(outDir,'current.json'),system.current);writeJSON(join(outDir,'correspondences.json'),system.correspondences);writeJSON(join(outDir,'events.json'),system.events);writeJSON(join(outDir,'possibilities.json'),system.possibilities);writeJSON(join(outDir,'map.json'),map);writeJSON(join(outDir,'bridge-errors.json'),system.bridge_errors);
  const cellDir=join(outDir,'cells');rmSync(cellDir,{recursive:true,force:true});mkdirSync(cellDir,{recursive:true});for(const cell of cells)writeJSON(join(cellDir,`${cell.atlas_address}.json`),cell);
  return manifest;
}

function main(){const a=args(process.argv);if(!a.in)throw new Error('--in harvest directory required');if(!a.out)throw new Error('--out public system directory required');const manifest=compileDirectory({inputDir:a.in,outDir:a.out,region:a.region||'unnamed',centerLat:a['center-lat'],centerLon:a['center-lon'],mapLimit:Number(a['map-limit']||1500)});process.stdout.write(JSON.stringify(manifest,null,2)+'\n');}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(error){process.stderr.write(`geonosis system compile failed: ${error?.stack||error}\n`);process.exitCode=1;}}
