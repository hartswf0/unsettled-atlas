const CORRESPONDENCE_RULES=[
  {id:'road-status-cross-regime-v1',predicate:'road.status',regimes:['MATERIAL','AFFORDANCE','INSTITUTIONAL','REPRESENTATIONAL'],expectation:'The same road-status predicate should agree across regimes when it is claimed as current.',compare:'exact'},
  {id:'access-status-cross-regime-v1',predicate:'access.status',regimes:['AFFORDANCE','INSTITUTIONAL','REPRESENTATIONAL'],expectation:'Declared, represented, and actor-relative access status should agree when they refer to the same subject and time.',compare:'exact'},
  {id:'service-status-cross-regime-v1',predicate:'service.status',regimes:['MATERIAL','INSTITUTIONAL','REPRESENTATIONAL'],expectation:'Observed, institutional, and represented service status should agree for the same service subject.',compare:'exact'},
  {id:'closure-status-cross-regime-v1',predicate:'closure.status',regimes:['MATERIAL','INSTITUTIONAL','REPRESENTATIONAL'],expectation:'Closure status should agree across observed, institutional, and represented regimes for the same subject.',compare:'exact'}
];

export function correspondenceRuleFor(predicate){return CORRESPONDENCE_RULES.find(r=>r.predicate===predicate)||null;}
export function correspondenceRules(){return CORRESPONDENCE_RULES.map(x=>({...x,regimes:[...x.regimes]}));}

function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function text(v){return v==null?'':String(v).trim();}
function severityRank(v){return ({Unknown:0,Minor:1,Moderate:2,Severe:3,Extreme:4})[text(v)]??0;}

const ACTOR_RULES=[
  {
    id:'surface-water-car-v1',predicate:'surface_water.depth_m',actor:'CAR',
    run(o){const depth=num(o.value);if(depth===null)return null;return {condition:`surface water depth ${depth} m`,modality:depth>.15?'FORBIDDEN':'REACHABLE',reachable:depth<=.15,risk:Math.min(1,depth/.30)};}
  },
  {
    id:'surface-water-dog-v1',predicate:'surface_water.depth_m',actor:'DOG',
    run(o){const depth=num(o.value);if(depth===null)return null;return {condition:`surface water depth ${depth} m`,modality:depth>.35?'THREATENED':'REACHABLE',reachable:depth<=.35,risk:Math.min(1,depth/.50)};}
  },
  {
    id:'surface-water-flow-v1',predicate:'surface_water.depth_m',actor:'FLOOD',
    run(o){const depth=num(o.value);if(depth===null)return null;return {condition:`surface water depth ${depth} m`,modality:depth>0?'ACTUAL':'POSSIBLE',reachable:true,expected:depth>0,risk:null};}
  },
  {
    id:'surface-water-city-v1',predicate:'surface_water.depth_m',actor:'CITY',
    run(o){const depth=num(o.value);if(depth===null)return null;return {condition:`surface water depth ${depth} m`,modality:depth>.15?'THREATENED':'ACTUAL',reachable:null,expected:depth>.15,risk:Math.min(1,depth/.40)};}
  },
  {
    id:'nws-alert-human-v1',predicate:'hazard.weather_alert',actor:'HUMAN',
    run(o){const sev=severityRank(o.value?.severity);return {condition:o.value?.event||'active weather alert',modality:sev>=2?'THREATENED':'POSSIBLE',reachable:null,expected:true,risk:sev/4};}
  },
  {
    id:'nws-alert-service-v1',predicate:'hazard.weather_alert',actor:'SERVICE',
    run(o){const sev=severityRank(o.value?.severity);return {condition:o.value?.event||'active weather alert',modality:sev>=2?'THREATENED':'POSSIBLE',reachable:null,expected:true,risk:sev/4};}
  },
  {
    id:'earthquake-human-v1',predicate:'hazard.earthquake',actor:'HUMAN',
    run(o){const m=num(o.value?.magnitude);if(m===null)return null;return {condition:`earthquake M${m}`,modality:m>=4?'THREATENED':'ACTUAL',reachable:null,expected:true,risk:Math.max(0,Math.min(1,(m-2)/5))};}
  },
  {
    id:'earthquake-building-v1',predicate:'hazard.earthquake',actor:'BUILDING',
    run(o){const m=num(o.value?.magnitude);if(m===null)return null;return {condition:`earthquake M${m}`,modality:m>=4?'THREATENED':'ACTUAL',reachable:null,expected:true,risk:Math.max(0,Math.min(1,(m-2)/5))};}
  },
  {
    id:'natural-event-human-v1',predicate:'hazard.natural_event',actor:'HUMAN',
    run(o){return {condition:o.value?.title||'active natural event',modality:'THREATENED',reachable:null,expected:true,risk:null};}
  },
  {
    id:'map-note-service-v1',predicate:'claim.map_note',actor:'SERVICE',
    run(o){if(text(o.value?.status).toLowerCase()!=='open')return null;return {condition:'open map issue report',modality:'POSSIBLE',reachable:null,expected:true,risk:null};}
  }
];

export function actorPossibilitiesFor(observation,legacySignal=null){
  const allowed=new Set((legacySignal?.actors||[]).map(String));
  const out=[];
  for(const rule of ACTOR_RULES){
    if(rule.predicate!==observation.predicate)continue;
    if(allowed.size&&!allowed.has(rule.actor))continue;
    const r=rule.run(observation);if(!r)continue;
    out.push({actor_id:rule.actor,condition:r.condition,modality:r.modality,reachable:r.reachable??null,permitted:r.permitted??null,expected:r.expected??null,risk:r.risk??null,horizon:r.horizon||null,rule_id:rule.id});
  }
  return out;
}

export function actorRuleManifest(){return ACTOR_RULES.map(r=>({id:r.id,predicate:r.predicate,actor:r.actor}));}
