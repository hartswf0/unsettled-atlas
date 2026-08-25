#!/usr/bin/env node
import assert from 'node:assert/strict';
import { WAVE2_ADAPTERS, enrichGLEIF } from './adapters-wave2.mjs';

const ctx={lat:33.749,lon:-84.388,radiusKm:12,depth:10,sinceDays:365,limit:25};
const result={};
for(const id of ['fdic-locations','fdic-sod','hmda-lenders']){
  const rows=await WAVE2_ADAPTERS[id](ctx);
  assert(Array.isArray(rows),`${id} did not return an array`);
  assert(rows.length>0,`${id} returned no Atlanta records; endpoint/schema may have changed`);
  result[id]=rows.length;
  if(id==='fdic-locations') assert(rows.some(s=>s.geometry?.type==='Point'),'FDIC locations returned no point geometry');
  if(id==='fdic-sod') assert(rows.some(s=>Number.isFinite(Number(s.value?.deposits_usd))),'FDIC SOD returned no deposit amount');
  if(id==='hmda-lenders') assert(rows.some(s=>s.value?.lei),'HMDA returned no lender LEI');
}
const hmda=await WAVE2_ADAPTERS['hmda-lenders']({...ctx,limit:5});
const gleif=await enrichGLEIF(hmda,{gleifLimit:3});
assert(gleif.some(s=>s.source==='gleif-entity'),'GLEIF did not resolve any sampled HMDA LEI');
result['gleif-enrichment']=gleif.length;
process.stdout.write(JSON.stringify({ok:true,probe:'Atlanta, GA',counts:result},null,2)+'\n');
