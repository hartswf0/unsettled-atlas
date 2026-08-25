#!/usr/bin/env node
import assert from 'node:assert/strict';
import { compileBackplane, reconstructCurrent } from './system-backplane.mjs';

const point={type:'Point',coordinates:[-84.388,33.749]};
function s(id,regime,predicate,value,time,epistemic='OBSERVED',actors=[]){return {id,source:'fixture-system-test',source_record_id:'road-a',subject_id:'road:fixture-a',predicate,value,geometry:point,epistemic,observed_at:time,actors,geonosis_regime:regime,geonosis_form:predicate==='surface_water.depth_m'?'FIELD':'RELATION'};}
const signals=[
  s('water-1','MATERIAL','surface_water.depth_m',0.28,'2026-01-01T08:10:00Z','OBSERVED',['CAR','DOG','FLOOD','CITY']),
  s('material-closed','MATERIAL','road.status','CLOSED','2026-01-01T08:10:00Z'),
  s('map-open','REPRESENTATIONAL','road.status','OPEN','2026-01-01T08:12:00Z','REPORTED'),
  s('authority-closed','INSTITUTIONAL','road.status','CLOSED','2026-01-01T08:27:00Z','DECLARED'),
  s('map-closed','REPRESENTATIONAL','road.status','CLOSED','2026-01-01T09:02:00Z','REPORTED')
];
const system=compileBackplane(signals);
assert.equal(system.bridge_errors.length,0);
assert.equal(system.observations.length,5);
assert.equal(system.subjects.length,1);
assert.equal(system.possibilities.length,4,'actor possibilities must be derived by rules, not UI strings');
assert.ok(system.events.some(e=>e.regime_a==='MATERIAL'&&e.regime_b==='REPRESENTATIONAL'&&!e.active&&e.started_at==='2026-01-01T08:12:00.000Z'&&e.resolved_at==='2026-01-01T09:02:00.000Z'));
assert.ok(system.events.some(e=>e.regime_a==='INSTITUTIONAL'&&e.regime_b==='REPRESENTATIONAL'&&!e.active&&e.started_at==='2026-01-01T08:27:00.000Z'&&e.resolved_at==='2026-01-01T09:02:00.000Z'));
assert.ok(system.correspondences.length>=3);
assert.ok(system.correspondences.every(c=>c.state==='MATCH'),'current state should recouple after map update');
const at0815=reconstructCurrent(system.forms,system.observations,'2026-01-01T08:15:00Z');
const rep=at0815.find(x=>x.regime==='REPRESENTATIONAL'&&x.predicate==='road.status');
assert.equal(rep?.value,'OPEN');
const again=compileBackplane(signals,{forms:system.forms,observations:system.observations});
assert.equal(again.observations.length,system.observations.length,'unchanged observations must deduplicate');
assert.equal(again.forms.length,system.forms.length,'unchanged forms must deduplicate');
console.log(JSON.stringify({ok:true,observations:system.observations.length,subjects:system.subjects.length,events:system.events.length,possibilities:system.possibilities.length,current_correspondences:system.correspondences.length},null,2));
