import { readFileSync } from 'node:fs';
import { geographicForm, observation, interpretation, possibility, action, transformation, worldModel } from './v1-schema.mjs';
import { evaluateCorrespondence, evaluateLag } from './correspondence-engine.mjs';

export function buildFloodedIntersectionTrace(fixturePath=new URL('./fixtures/flooded-intersection-v1.json',import.meta.url)){
  const fixture=JSON.parse(readFileSync(fixturePath,'utf8'));
  if(!fixture.fixture)throw new Error('event trace accepts only explicit fixture data');
  const scope=fixture.scope;
  const formsByKey=new Map();
  for(const f of fixture.forms){
    formsByKey.set(f.key,geographicForm({
      form:f.form,subject_id:f.subject_id,atlas_address:null,
      native_extent:'synthetic-fixture',operative_scale:'intersection',
      bridge_basis:'fixture-only',provenance:{fixture:fixture.name,warning:fixture.warning}
    }));
  }

  const observationsByKey=new Map();
  for(const e of fixture.events){
    const form=formsByKey.get(e.form_key);if(!form)throw new Error(`missing form ${e.form_key}`);
    observationsByKey.set(e.key,observation({
      regime:e.regime,form_id:form.id,source:e.source,source_record_id:e.key,
      epistemic:e.epistemic,predicate:e.predicate,value:e.value,unit:e.unit||null,
      apparatus:e.apparatus,time:e.time,confidence:1,
      provenance:{fixture:true,warning:fixture.warning}
    }));
  }

  const flood=observationsByKey.get('material_flood');
  const mapOpen=observationsByKey.get('map_open');
  const authorityClosed=observationsByKey.get('institution_closure');
  const mapClosed=observationsByKey.get('map_closed');

  const carInterpretation=interpretation({
    observation_ids:[flood.id],
    interpreter:{id:'actor:standard-passenger-car',type:'CAR',capabilities:['road-travel','shallow-water-traversal'],task:'cross-intersection'},
    referent:'intersection traversability for a standard passenger car',
    rule:{id:'flood-depth-car-passability-v1',type:'threshold',version:'1',provenance:'fixture rule; not a universal vehicle safety threshold'},
    interpretant:Number(flood.value)>=0.20?'CLOSED':'OPEN',
    modality:'REACHABLE',scale:'intersection',confidence:0.85,
    alternatives:['localized puddle leaves a traversable lane','sensor location is not representative of the travel path'],
    falsifiers:['independent travel-path depth below rule threshold','verified safe passage under the same vehicle capability model'],
    possibility_delta:Number(flood.value)>=0.20?{closes:['direct vehicle crossing'],raises_risk:['stalling','loss of control']}:{opens:['direct vehicle crossing']},
    time:{recognized_at:flood.time.observed_at}
  });

  const emergencyInterpretation=interpretation({
    observation_ids:[flood.id],
    interpreter:{id:'actor:road-authority-duty-system',type:'INSTITUTION',capabilities:['declare-closure','publish-road-status'],task:'maintain safe road access'},
    referent:'need for institutional road restriction',
    rule:{id:'fixture-road-closure-assessment-v1',type:'decision-rule',version:'1',provenance:'synthetic fixture rule'},
    interpretant:'CLOSURE_WARRANTED',modality:'EXPECTED',scale:'intersection',confidence:0.9,
    alternatives:['partial lane restriction','temporary warning without closure'],
    falsifiers:['independent inspection finds no travel hazard'],
    possibility_delta:{closes:['unrestricted institutional permission to cross'],opens:['detour routing']},
    time:{recognized_at:flood.time.observed_at}
  });

  const carPossibility=possibility({
    actor_id:'actor:standard-passenger-car',condition:'cross-intersection',modality:'FORBIDDEN',
    reachable:false,permitted:null,expected:false,risk:'HIGH',horizon:'immediate',geographic_scope:scope,
    derived_from:[flood.id,carInterpretation.id]
  });

  const closureAction=action({
    actor_id:'actor:road-authority-duty-system',verb:'DECLARE_CLOSED',target:'fixture:intersection-a:road-status',
    geographic_scope:scope,time:{acted_on_at:authorityClosed.time.recognized_at},
    derived_from:[flood.id,emergencyInterpretation.id,authorityClosed.id]
  });

  const materialWorld=worldModel({label:'Fixture material state at flood detection',regime:'MATERIAL',scope,form_ids:[formsByKey.get('water_depth_field').id],observation_ids:[flood.id],valid_at:flood.time.observed_at,provenance:{fixture:true}});
  const affordanceWorld=worldModel({label:'Fixture car possibility state',regime:'AFFORDANCE',scope,form_ids:[formsByKey.get('road_status_relation').id],observation_ids:[flood.id],interpretation_ids:[carInterpretation.id],valid_at:flood.time.observed_at,provenance:{fixture:true}});
  const representationBefore=worldModel({label:'Fixture map before update',regime:'REPRESENTATIONAL',scope,form_ids:[formsByKey.get('road_status_relation').id],observation_ids:[mapOpen.id],valid_at:mapOpen.time.observed_at,provenance:{fixture:true}});
  const institutionalWorld=worldModel({label:'Fixture institutional closure',regime:'INSTITUTIONAL',scope,form_ids:[formsByKey.get('road_status_relation').id],observation_ids:[authorityClosed.id],interpretation_ids:[emergencyInterpretation.id],valid_at:authorityClosed.time.recognized_at,provenance:{fixture:true}});
  const representationAfter=worldModel({label:'Fixture map after update',regime:'REPRESENTATIONAL',scope,form_ids:[formsByKey.get('road_status_relation').id],observation_ids:[mapClosed.id],valid_at:mapClosed.time.observed_at,provenance:{fixture:true}});

  const mismatch=evaluateCorrespondence({
    id:'affordance-map-road-state-v1',regime_a:'AFFORDANCE',regime_b:'REPRESENTATIONAL',operator:'equal',
    subject_or_extent:'fixture:intersection-a:road-status',expectation:'The published road state should correspond to the actor-relative passability state for the declared actor model.'
  },{
    left:carInterpretation.interpretant,right:mapOpen.value,
    left_evidence:[flood.id,carInterpretation.id],right_evidence:[mapOpen.id],
    geographic_scope:scope,temporal_scope:{at:mapOpen.time.observed_at}
  });

  const institutionalLag=evaluateLag({
    id:'material-institution-recognition-lag-v1',regime_a:'MATERIAL',regime_b:'INSTITUTIONAL',max_lag_minutes:10,
    subject_or_extent:'fixture:intersection-a:road-status',expectation:'Institutional restriction should recognize a detected road hazard within 10 minutes in this fixture.'
  },{
    trigger_at:flood.time.observed_at,response_at:authorityClosed.time.recognized_at,
    trigger_evidence:[flood.id],response_evidence:[authorityClosed.id,closureAction.id],geographic_scope:scope
  });

  const representationLag=evaluateLag({
    id:'institution-representation-update-lag-v1',regime_a:'INSTITUTIONAL',regime_b:'REPRESENTATIONAL',max_lag_minutes:10,
    subject_or_extent:'fixture:intersection-a:road-status',expectation:'The published map should reflect the institutional closure within 10 minutes in this fixture.'
  },{
    trigger_at:authorityClosed.time.recognized_at,response_at:mapClosed.time.observed_at,
    trigger_evidence:[authorityClosed.id],response_evidence:[mapClosed.id],geographic_scope:scope
  });

  const finalMatch=evaluateCorrespondence({
    id:'institution-map-road-state-v1',regime_a:'INSTITUTIONAL',regime_b:'REPRESENTATIONAL',operator:'equal',
    subject_or_extent:'fixture:intersection-a:road-status',expectation:'The published road state should correspond to the currently declared institutional road state.'
  },{
    left:authorityClosed.value,right:mapClosed.value,left_evidence:[authorityClosed.id],right_evidence:[mapClosed.id],
    geographic_scope:scope,temporal_scope:{at:mapClosed.time.observed_at}
  });

  const reorientation=transformation({
    before_world:representationBefore.id,after_world:representationAfter.id,operation:'REORIENT',
    geographic_changes:[
      {relation:'published-road-state',from:'OPEN',to:'CLOSED'},
      {possibility:'direct vehicle crossing',from:'apparently available',to:'represented unavailable'}
    ],
    time:{occurred_at:mapClosed.time.observed_at},derived_from:[mismatch.id,authorityClosed.id,mapClosed.id]
  });

  return {
    schema:'geonosis-v1-event-trace',fixture:true,name:fixture.name,warning:fixture.warning,scope,
    geographic_forms:[...formsByKey.values()],
    observations:[...observationsByKey.values()],
    interpretations:[carInterpretation,emergencyInterpretation],
    possibilities:[carPossibility],actions:[closureAction],
    transformations:[reorientation],
    world_models:[materialWorld,affordanceWorld,representationBefore,institutionalWorld,representationAfter],
    correspondences:[mismatch,institutionalLag,representationLag,finalMatch],
    regime_break:{
      correspondence_id:mismatch.id,
      definition:'A declared cross-regime expectation fails while action still depends on the outdated representation.',
      resolved_by:[authorityClosed.id,mapClosed.id,finalMatch.id]
    }
  };
}

if(import.meta.url===`file://${process.argv[1]}`){
  process.stdout.write(JSON.stringify(buildFloodedIntersectionTrace(),null,2)+'\n');
}
