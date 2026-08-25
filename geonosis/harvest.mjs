#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTERS, defaultSourcesFor } from './adapters-all.mjs';
import { enrichGLEIF } from './adapters-wave2.mjs';
import { createAddressor } from './icosa-address.mjs';
import { addressBasis } from './geometry.mjs';
import { inferStatements } from './infer.mjs';
import { validateSignal } from './schema.mjs';
import { buildGraph } from './graph.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
function args(argv){const out={};for(let i=2;i<argv.length;i++){const a=argv[i];if(!a.startsWith('--'))continue;const k=a.slice(2),n=argv[i+1];if(n!=null&&!n.startsWith('--')){out[k]=n;i++;}else out[k]=true;}return out;}
function needNumber(v,name,fallback=null){if(v==null&&fallback!=null)return fallback;const n=Number(v);if(!Number.isFinite(n))throw new Error(`--${name} must be a number`);return n;}
function safeRunId(lat,lon){const t=new Date().toISOString().replace(/[:.]/g,'-');return `${t}_${lat.toFixed(4)}_${lon.toFixed(4)}`.replace(/[^0-9A-Za-z_.-]/g,'_');}
function writeJSON(path,value){writeFileSync(path,JSON.stringify(value,null,2)+'\n');}

function addressSignals(signals,addressor,depth){const good=[],rejected=[];for(const s of signals){const errors=validateSignal(s);if(errors.length){rejected.push({signal:s.id||null,errors});continue;}const basis=addressBasis(s.geometry);if(basis){s.atlas_address_basis=basis;const[lon,lat]=basis.representative_point;s.atlas_address=addressor.addressPoint(lon,lat,depth);}good.push(s);}return{good,rejected};}
function groupCells(signals){const cells=new Map();for(const s of signals){if(!s.atlas_address)continue;if(!cells.has(s.atlas_address))cells.set(s.atlas_address,[]);cells.get(s.atlas_address).push(s);}return cells;}

async function run(){
  const a=args(process.argv),lat=needNumber(a.lat,'lat'),lon=needNumber(a.lon,'lon'),radiusKm=needNumber(a['radius-km'],'radius-km',15),depth=Math.max(0,Math.min(20,Math.round(needNumber(a.depth,'depth',10)))),sinceDays=Math.max(1,Math.round(needNumber(a['since-days'],'since-days',30))),limit=Math.max(1,Math.round(needNumber(a.limit,'limit',500)));
  if(lat<-90||lat>90||lon<-180||lon>180)throw new Error('lat/lon out of range');if(radiusKm<=0)throw new Error('--radius-km must be positive');
  const ctx={lat,lon,radiusKm,depth,sinceDays,limit};
  const selected=String(a.sources||defaultSourcesFor(ctx).join(',')).split(',').map(s=>s.trim()).filter(Boolean);for(const id of selected)if(!ADAPTERS[id])throw new Error(`no executable adapter: ${id}`);
  const runId=a['run-id']||safeRunId(lat,lon),outDir=resolve(a.out||join(HERE,'out',runId));mkdirSync(join(outDir,'cells'),{recursive:true});

  const sourceRuns=[];
  const batches=await Promise.all(selected.map(async id=>{const started=new Date().toISOString();try{const signals=await ADAPTERS[id](ctx);sourceRuns.push({id,status:'ok',started,finished:new Date().toISOString(),count:signals.length});return signals;}catch(err){sourceRuns.push({id,status:'error',started,finished:new Date().toISOString(),count:0,error:String(err?.message||err)});return[];}}));

  const first=batches.flat();
  let enriched=[];const es=new Date().toISOString();
  try{enriched=await enrichGLEIF(first,{gleifLimit:Math.min(50,Number(a['gleif-limit']||30))});sourceRuns.push({id:'gleif-enrichment',status:'ok',started:es,finished:new Date().toISOString(),count:enriched.length});}
  catch(err){sourceRuns.push({id:'gleif-enrichment',status:'error',started:es,finished:new Date().toISOString(),count:0,error:String(err?.message||err)});}

  const addressor=createAddressor(),{good:signals,rejected}=addressSignals([...first,...enriched],addressor,depth);
  signals.sort((a,b)=>String(a.atlas_address).localeCompare(String(b.atlas_address))||a.source.localeCompare(b.source)||a.id.localeCompare(b.id));
  const statements=inferStatements(signals),graph=buildGraph(signals),cells=groupCells(signals);

  const entitiesByCell=new Map();for(const e of graph.entities){if(!e.atlas_address)continue;if(!entitiesByCell.has(e.atlas_address))entitiesByCell.set(e.atlas_address,[]);entitiesByCell.get(e.atlas_address).push(e);}
  for(const[address,ss]of cells){const cellStatements=statements.filter(x=>x.atlas_address===address),cellEntities=entitiesByCell.get(address)||[],ids=new Set(cellEntities.map(e=>e.id)),cellRelations=graph.relations.filter(r=>ids.has(r.subject)||ids.has(r.object));writeJSON(join(outDir,'cells',`${address}.json`),{atlas_address:address,signals:ss,entities:cellEntities,relations:cellRelations,statements:cellStatements});}

  const unaddressed=signals.filter(s=>!s.atlas_address),approximate=signals.filter(s=>s.atlas_address_basis&&!s.atlas_address_basis.exact);
  const manifest={schema:'geonosis-harvest-v0.3',run_id:runId,created_at:new Date().toISOString(),query:ctx,sources:sourceRuns.sort((a,b)=>a.id.localeCompare(b.id)),counts:{signals:signals.length,entities:graph.entities.length,relations:graph.relations.length,statements:statements.length,addressed_cells:cells.size,exact_addressed_signals:signals.filter(s=>s.atlas_address_basis?.exact).length,representative_addressed_signals:approximate.length,unaddressed_signals:unaddressed.length,rejected:rejected.length},epistemic_note:'Signals are evidence. Entities normalize identity. Relations are derived only from cited signals. GLEIF parent relations describe accounting consolidation, not beneficial ownership. FDIC branch deposits are reported balances, not local investment. See geonosis/SYSTEM.md.'};
  writeJSON(join(outDir,'manifest.json'),manifest);writeJSON(join(outDir,'signals.json'),signals);writeJSON(join(outDir,'entities.json'),graph.entities);writeJSON(join(outDir,'relations.json'),graph.relations);writeJSON(join(outDir,'statements.json'),statements);if(unaddressed.length)writeJSON(join(outDir,'unaddressed.json'),unaddressed);if(rejected.length)writeJSON(join(outDir,'rejected.json'),rejected);
  process.stdout.write(JSON.stringify({out:outDir,...manifest.counts,sources:manifest.sources},null,2)+'\n');
}
run().catch(err=>{process.stderr.write(`geonosis harvest failed: ${err?.stack||err}\n`);process.exitCode=1;});
