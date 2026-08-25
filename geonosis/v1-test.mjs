#!/usr/bin/env node
import assert from 'node:assert/strict';
import { REGIMES, FORMS, KINDS, interpretation, observation, geographicForm } from './v1-schema.mjs';
import { legacySignalToV1 } from './v1-bridge.mjs';
import { buildFloodedIntersectionTrace } from './v1-event-trace.mjs';

assert.deepEqual(REGIMES,['MATERIAL','AFFORDANCE','INSTITUTIONAL','REPRESENTATIONAL']);
assert.deepEqual(FORMS,['OBJECT','FIELD','TRAJECTORY','RELATION']);
assert.equal(KINDS.length,8);

const form=geographicForm({form:'OBJECT',subject_id:'fixture:thing'});
const obs=observation({regime:'MATERIAL',form_id:form.id,source:'fixture',epistemic:'OBSERVED',predicate:'fixture.state',value:1,apparatus:{id:'fixture-apparatus'}});
assert.throws(()=>interpretation({observation_ids:[obs.id],interpreter:{id:'x',type:'HUMAN'},referent:'state',rule:{id:'r',type:'rule'},interpretant:'SAFE'}),/alternative or falsifier/);

const bridged=legacySignalToV1({
  id:'sig_fixture',source:'usgs-earthquakes',source_record_id:'eq1',predicate:'hazard.earthquake',value:{magnitude:2.1},unit:null,geometry:{type:'Point',coordinates:[-84.3,33.7]},atlas_address:'F02.133',epistemic:'OBSERVED',confidence:1,derived_from:[],provenance:{}
});
assert.equal(bridged.observation.regime,'MATERIAL');
assert.equal(bridged.form.form,'OBJECT');
assert.equal(bridged.observation.source_signal_id,'sig_fixture');

const trace=buildFloodedIntersectionTrace();
assert.equal(trace.fixture,true);
assert.equal(trace.geographic_forms.length,2);
assert.equal(trace.observations.length,4);
assert.equal(trace.interpretations.length,2);
assert.equal(trace.world_models.length,5);
assert.equal(trace.correspondences.length,4);
assert.equal(trace.correspondences[0].state,'MISMATCH');
assert.equal(trace.correspondences[1].state,'LAG');
assert.equal(trace.correspondences[1].temporal_scope.lag_minutes,17);
assert.equal(trace.correspondences[2].state,'LAG');
assert.equal(trace.correspondences[2].temporal_scope.lag_minutes,35);
assert.equal(trace.correspondences[3].state,'MATCH');
assert.equal(trace.regime_break.correspondence_id,trace.correspondences[0].id);
assert(trace.interpretations.every(i=>i.alternatives.length||i.falsifiers.length));
assert(trace.correspondences.filter(c=>c.state!=='UNKNOWN').every(c=>c.evidence.length>0));
assert(trace.actions[0].derived_from.includes(trace.observations[0].id));
assert.equal(trace.transformations[0].operation,'REORIENT');

process.stdout.write(JSON.stringify({ok:true,version:'geonosis-v1.0.0',regimes:REGIMES,forms:FORMS,object_kinds:KINDS,fixture:trace.name,correspondence_states:trace.correspondences.map(c=>c.state)},null,2)+'\n');
