#!/usr/bin/env node
import assert from 'node:assert/strict';
import { ADAPTERS, defaultSourcesFor } from './adapters-all.mjs';
import { createAddressor } from './icosa-address.mjs';
import { addressBasis, representativePoint } from './geometry.mjs';
import { normalizeSignal, pointGeometry, validateSignal } from './schema.mjs';
import { inferStatements } from './infer.mjs';
import { buildGraph } from './graph.mjs';

const A=createAddressor();
for(const id of ['usgs-earthquakes','nws-alerts','osm-notes','wikipedia-geosearch','eonet','gbif-occurrences','inaturalist-observations','epa-echo','nps-national-register','nola-building-permits','nola-code-enforcement','atlanta-historic-buildings','atlanta-rezoning-cases','usaspending-county','fdic-locations','fdic-sod','hmda-lenders']) assert.equal(typeof ADAPTERS[id],'function',`adapter did not load: ${id}`);
const atlDefaults=defaultSourcesFor({lat:33.749,lon:-84.388,radiusKm:10});for(const id of ['atlanta-historic-buildings','atlanta-rezoning-cases','fdic-locations','fdic-sod','hmda-lenders'])assert(atlDefaults.includes(id));
const nolaDefaults=defaultSourcesFor({lat:29.9511,lon:-90.0715,radiusKm:10});assert(nolaDefaults.includes('nola-building-permits'));assert(nolaDefaults.includes('nola-code-enforcement'));

for(const[lon,lat]of[[-84.388,33.749],[-90.0715,29.9511],[0,0],[139.6917,35.6895],[151.2093,-33.8688]]){const d4=A.addressPoint(lon,lat,4),d10=A.addressPoint(lon,lat,10);assert.match(d4,/^F\d{2}\.[0-3]{4}$/);assert.match(d10,/^F\d{2}\.[0-3]{10}$/);assert.equal(d10.slice(0,d4.length),d4);assert.equal(A.addressPoint(lon,lat,10),d10);}
for(let f=0;f<A.FACES.length;f++){const p=A.baryPoint(f,[1/3,1/3,1/3]);assert.equal(A.faceOf(p),f);}
const srcPoint={type:'Point',coordinates:[-84.388,33.749]},pb=addressBasis(srcPoint);assert.equal(pb.exact,true);assert.equal(pb.method,'source_point');
const poly={type:'Polygon',coordinates:[[[-84.40,33.74],[-84.38,33.74],[-84.38,33.76],[-84.40,33.76],[-84.40,33.74]]]},pr=representativePoint(poly);assert.equal(pr.exact,false);assert(Math.abs(pr.point[0]+84.39)<1e-8);assert(Math.abs(pr.point[1]-33.75)<1e-8);assert.equal(poly.type,'Polygon');

const mk=(source,predicate,lon,lat,n=1,value=n)=>normalizeSignal({source,source_record_id:`${source}-${n}`,predicate,value,geometry:lon==null?null:pointGeometry(lon,lat),atlas_address:lon==null?null:A.addressPoint(lon,lat,8),atlas_address_basis:lon==null?null:{method:'source_point',representative_point:[lon,lat],exact:true},epistemic:'REPORTED',actors:['GROUND']});
const bad=normalizeSignal({source:'fixture',predicate:'x',epistemic:'REPORTED'});assert.deepEqual(validateSignal(bad),[]);
const lon=-84.388,lat=33.749;
const signals=[
 mk('osm-notes','claim.map_note',lon,lat,1),mk('osm-notes','claim.map_note',lon,lat,2),mk('usgs-earthquakes','hazard.earthquake',lon,lat,3),mk('eonet','hazard.natural_event',lon,lat,4),
 ...Array.from({length:5},(_,i)=>mk('wikipedia-geosearch','attention.wikipedia_entity',lon,lat,10+i)),...Array.from({length:3},(_,i)=>mk('gbif-occurrences','ecology.occurrence',lon,lat,20+i)),...Array.from({length:2},(_,i)=>mk('inaturalist-observations','ecology.inaturalist_observation',lon,lat,30+i)),
 mk('epa-echo','environment.regulated_facility',lon,lat,40,{significant_noncompliance:'Y'}),mk('epa-echo','environment.regulated_facility',lon,lat,41,{significant_noncompliance:'N'}),mk('nps-national-register','memory.national_register_resource',lon,lat,50),mk('atlanta-historic-buildings','memory.atlanta_historic_building',lon,lat,51),mk('nola-building-permits','change.building_permit',lon,lat,60),mk('nola-building-permits','change.building_permit',lon,lat,61),mk('nola-code-enforcement','service.code_enforcement_case',lon,lat,70),mk('nola-code-enforcement','service.code_enforcement_case',lon,lat,71),
 mk('fdic-locations','money.bank_branch',lon,lat,80,{cert:123,branch_id:7,institution_name:'Fixture Bank',branch_name:'Downtown'}),mk('fdic-sod','money.branch_deposits',lon,lat,81,{cert:123,branch_id:7,institution_name:'Fixture Bank',branch_name:'Downtown',deposits_usd:125000000}),
 mk('hmda-lenders','money.hmda_lender_presence',null,null,82,{lei:'549300TESTLEI000001',name:'Fixture Lender',year:2025,county_geoid:'13121',county_name:'Fulton County'}),mk('gleif-entity','ownership.lei_entity',null,null,83,{lei:'549300TESTLEI000001',legal_name:'Fixture Lender LLC',jurisdiction:'US-GA'}),mk('gleif-parent','ownership.direct_parent',null,null,84,{child_lei:'549300TESTLEI000001',parent_lei:'549300PARENT0000001',parent_name:'Fixture Parent',level:'direct'})
];
const statements=inferStatements(signals),kinds=new Set(statements.map(s=>s.kind));for(const expected of ['hazard_presence','representation_contestation','attention_density','ecological_observation_density','regulated_environment_presence','institutional_memory_density','building_change_activity','service_enforcement_pressure','heritage_change_coaddress','multi_source_activity'])assert(kinds.has(expected),`missing inference ${expected}`);for(const s of statements){assert.equal(s.epistemic,'INFERRED');assert(s.evidence.length>0);assert.deepEqual(s.evidence,s.derived_from);}
const graph=buildGraph(signals),predicates=new Set(graph.relations.map(r=>r.predicate));for(const p of ['branch_of','holds_reported_deposits','reports_hmda_activity_in','directly_consolidated_by'])assert(predicates.has(p),`missing relation ${p}`);assert(graph.entities.some(e=>e.id==='fdic:123'));assert(graph.entities.some(e=>e.id==='lei:549300TESTLEI000001'));for(const r of graph.relations)assert(r.derived_from.length>0);

process.stdout.write(JSON.stringify({ok:true,tests:{executable_adapters_load:true,regional_defaults:true,address_prefix:true,root_face_identity:true,source_geometry_preserved:true,representative_address_basis:true,signal_validation:true,deterministic_inference:true,entity_relation_graph:true},adapters:Object.keys(ADAPTERS).sort(),inference_kinds:[...kinds].sort(),relation_predicates:[...predicates].sort(),atlanta:A.addressPoint(-84.388,33.749,10),new_orleans:A.addressPoint(-90.0715,29.9511,10)},null,2)+'\n');
