#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { publishRuns } from './publish.mjs';

const TMP='geonosis/.publish-test',RUN=join(TMP,'run'),OUT=join(TMP,'data');
rmSync(TMP,{recursive:true,force:true});mkdirSync(RUN,{recursive:true});
const write=(name,x)=>writeFileSync(join(RUN,name),JSON.stringify(x,null,2)+'\n');
write('manifest.json',{schema:'fixture',created_at:'2026-08-25T00:00:00Z',publication_region:'fixture',publication_label:'FIXTURE',query:{lat:0,lon:0,radiusKm:1},counts:{},sources:[{id:'fixture',status:'ok',count:2}]});
write('signals.json',[
 {id:'s1',source:'fixture',predicate:'change.fixture',epistemic:'REPORTED',atlas_address:'F02.120',value:{x:1},retrieved_at:'2026-08-25T00:00:00Z'},
 {id:'s2',source:'fixture-scope',predicate:'money.fixture_county',epistemic:'REPORTED',atlas_address:null,value:{x:2}}
]);
write('entities.json',[{id:'e1',type:'building',name:'Fixture Building',atlas_address:'F02.120',derived_from:['s1']},{id:'county:1',type:'administrative_scope',scope:'county',name:'Fixture County',atlas_address:null,derived_from:['s2']}]);
write('relations.json',[{id:'r1',subject:'e1',predicate:'inside_fixture',object:'e1',epistemic:'DERIVED',derived_from:['s1']},{id:'r2',subject:'county:1',predicate:'scoped_only',object:'county:1',epistemic:'REPORTED',derived_from:['s2']}]);
write('statements.json',[{id:'st1',kind:'fixture_difference',atlas_address:'F02.120',text:'Fixture difference.',epistemic:'INFERRED',evidence:['s1'],derived_from:['s1'],importance:{change:.8,uncertainty:.2}},{id:'st2',kind:'fixture_scope',atlas_address:null,scope_id:'county:1',text:'Scoped only.',epistemic:'INFERRED',evidence:['s2'],derived_from:['s2'],importance:{uncertainty:.5}}]);

const m=publishRuns([RUN],OUT);
assert(m.prefixes.includes('F02'));
assert(m.prefixes.includes('F02.1'));
assert(m.prefixes.includes('F02.12'));
assert(m.prefixes.includes('F02.120'));
assert(!m.prefixes.includes('F02.3'));
const parent=JSON.parse(readFileSync(join(OUT,'cells','F02.1.json'),'utf8'));
assert.equal(parent.counts.signals,1);
assert.equal(parent.signals[0].id,'s1');
assert.equal(parent.statements[0].id,'st1');
assert(parent.statements[0].publication_rank>0);
const scoped=JSON.parse(readFileSync(join(OUT,'scoped.json'),'utf8'));
assert(scoped.records.some(x=>x.record.id==='s2'));
assert(scoped.records.some(x=>x.record.id==='st2'));
assert(!parent.signals.some(x=>x.id==='s2'));
rmSync(TMP,{recursive:true,force:true});
process.stdout.write(JSON.stringify({ok:true,prefix_scope:true,administrative_scope_isolated:true,bounded_bundle:true},null,2)+'\n');
