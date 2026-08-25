import crypto from 'node:crypto';

export const V1_VERSION='geonosis-v1.0.0';
export const REGIMES=Object.freeze(['MATERIAL','AFFORDANCE','INSTITUTIONAL','REPRESENTATIONAL']);
export const FORMS=Object.freeze(['OBJECT','FIELD','TRAJECTORY','RELATION']);
export const MODALITIES=Object.freeze(['ACTUAL','POSSIBLE','REACHABLE','PERMITTED','FORBIDDEN','EXPECTED','LIKELY','THREATENED','COUNTERFACTUAL']);
export const CORRESPONDENCE_STATES=Object.freeze(['MATCH','MISMATCH','LAG','CONTRADICTION','UNKNOWN']);
export const KINDS=Object.freeze(['GEOGRAPHIC_FORM','OBSERVATION','INTERPRETATION','POSSIBILITY','ACTION','TRANSFORMATION','WORLD_MODEL','CORRESPONDENCE']);

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
export function stableId(prefix,payload){
  const h=crypto.createHash('sha256').update(JSON.stringify(stable(payload))).digest('hex').slice(0,20);
  return `${prefix}_${h}`;
}
function req(value,name){if(value===undefined||value===null||value==='')throw new Error(`missing ${name}`);return value;}
function oneOf(value,set,name){if(!set.includes(value))throw new Error(`invalid ${name}: ${value}`);return value;}
function arr(value){return Array.isArray(value)?value:[];}
function finite01(value,name='confidence'){
  const n=Number(value);
  if(!Number.isFinite(n)||n<0||n>1)throw new Error(`${name} must be 0..1`);
  return n;
}
function timeBlock(input={}){
  return {
    occurred_at:input.occurred_at||null,
    became_detectable_at:input.became_detectable_at||null,
    observed_at:input.observed_at||null,
    recorded_at:input.recorded_at||null,
    published_at:input.published_at||null,
    valid_from:input.valid_from||null,
    recognized_at:input.recognized_at||null,
    acted_on_at:input.acted_on_at||null,
    superseded_at:input.superseded_at||null,
    expired_at:input.expired_at||null
  };
}

export function geographicForm(input={}){
  const body={
    kind:'GEOGRAPHIC_FORM',
    form:oneOf(req(input.form,'form'),FORMS,'form'),
    subject_id:req(input.subject_id,'subject_id'),
    geometry:input.geometry||null,
    atlas_address:input.atlas_address||null,
    native_extent:input.native_extent||null,
    observation_resolution:input.observation_resolution||null,
    operative_scale:input.operative_scale||null,
    institutional_scope:input.institutional_scope||null,
    representation_scale:input.representation_scale||null,
    addressing_depth:input.addressing_depth??null,
    bridge_basis:input.bridge_basis||null,
    provenance:input.provenance||null
  };
  return {...body,id:input.id||stableId('gform',body)};
}

export function observation(input={}){
  const body={
    kind:'OBSERVATION',
    regime:oneOf(req(input.regime,'regime'),REGIMES,'regime'),
    form_id:req(input.form_id,'form_id'),
    source:req(input.source,'source'),
    source_record_id:input.source_record_id||null,
    source_signal_id:input.source_signal_id||null,
    epistemic:req(input.epistemic,'epistemic'),
    predicate:req(input.predicate,'predicate'),
    value:input.value,
    unit:input.unit||null,
    apparatus:{
      id:req(input.apparatus?.id,'apparatus.id'),
      opportunity:input.apparatus?.opportunity||null,
      coverage:input.apparatus?.coverage||null,
      resolution:input.apparatus?.resolution||null,
      detection_threshold:input.apparatus?.detection_threshold||null,
      classification_method:input.apparatus?.classification_method||null,
      expected_frequency:input.apparatus?.expected_frequency||null,
      failure_modes:arr(input.apparatus?.failure_modes)
    },
    time:timeBlock(input.time),
    confidence:finite01(input.confidence??1),
    provenance:input.provenance||null
  };
  return {...body,id:input.id||stableId('obs',body)};
}

export function interpretation(input={}){
  const body={
    kind:'INTERPRETATION',
    observation_ids:arr(input.observation_ids),
    interpreter:{
      id:req(input.interpreter?.id,'interpreter.id'),
      type:req(input.interpreter?.type,'interpreter.type'),
      capabilities:arr(input.interpreter?.capabilities),
      task:input.interpreter?.task||null
    },
    referent:req(input.referent,'referent'),
    rule:{
      id:req(input.rule?.id,'rule.id'),
      type:req(input.rule?.type,'rule.type'),
      version:input.rule?.version||'1',
      provenance:input.rule?.provenance||null
    },
    interpretant:req(input.interpretant,'interpretant'),
    modality:oneOf(input.modality||'ACTUAL',MODALITIES,'modality'),
    scale:input.scale||null,
    confidence:finite01(input.confidence??1),
    alternatives:arr(input.alternatives),
    falsifiers:arr(input.falsifiers),
    possibility_delta:{
      opens:arr(input.possibility_delta?.opens),
      closes:arr(input.possibility_delta?.closes),
      raises_risk:arr(input.possibility_delta?.raises_risk),
      lowers_risk:arr(input.possibility_delta?.lowers_risk)
    },
    time:timeBlock(input.time)
  };
  if(!body.observation_ids.length)throw new Error('interpretation requires observation_ids');
  if(!body.alternatives.length&&!body.falsifiers.length)throw new Error('interpretation must expose an alternative or falsifier');
  return {...body,id:input.id||stableId('interp',body)};
}

export function possibility(input={}){
  const body={
    kind:'POSSIBILITY',
    actor_id:req(input.actor_id,'actor_id'),
    condition:req(input.condition,'condition'),
    modality:oneOf(req(input.modality,'modality'),MODALITIES,'modality'),
    reachable:input.reachable??null,
    permitted:input.permitted??null,
    expected:input.expected??null,
    risk:input.risk??null,
    horizon:input.horizon||null,
    geographic_scope:input.geographic_scope||null,
    derived_from:arr(input.derived_from)
  };
  return {...body,id:input.id||stableId('poss',body)};
}

export function action(input={}){
  const body={
    kind:'ACTION',
    actor_id:req(input.actor_id,'actor_id'),
    verb:req(input.verb,'verb'),
    target:input.target||null,
    geographic_scope:input.geographic_scope||null,
    time:timeBlock(input.time),
    derived_from:arr(input.derived_from)
  };
  return {...body,id:input.id||stableId('act',body)};
}

export function transformation(input={}){
  const body={
    kind:'TRANSFORMATION',
    before_world:req(input.before_world,'before_world'),
    after_world:req(input.after_world,'after_world'),
    operation:req(input.operation,'operation'),
    geographic_changes:arr(input.geographic_changes),
    time:timeBlock(input.time),
    derived_from:arr(input.derived_from)
  };
  return {...body,id:input.id||stableId('xform',body)};
}

export function worldModel(input={}){
  const body={
    kind:'WORLD_MODEL',
    label:req(input.label,'label'),
    regime:oneOf(req(input.regime,'regime'),REGIMES,'regime'),
    scope:req(input.scope,'scope'),
    form_ids:arr(input.form_ids),
    observation_ids:arr(input.observation_ids),
    interpretation_ids:arr(input.interpretation_ids),
    valid_at:input.valid_at||null,
    provenance:input.provenance||null
  };
  return {...body,id:input.id||stableId('world',body)};
}

export function correspondence(input={}){
  const body={
    kind:'CORRESPONDENCE',
    regime_a:oneOf(req(input.regime_a,'regime_a'),REGIMES,'regime_a'),
    regime_b:oneOf(req(input.regime_b,'regime_b'),REGIMES,'regime_b'),
    subject_or_extent:req(input.subject_or_extent,'subject_or_extent'),
    expectation:req(input.expectation,'expectation'),
    state:oneOf(req(input.state,'state'),CORRESPONDENCE_STATES,'state'),
    evidence:arr(input.evidence),
    explanation:req(input.explanation,'explanation'),
    temporal_scope:input.temporal_scope||null,
    geographic_scope:input.geographic_scope||null,
    rule_id:req(input.rule_id,'rule_id')
  };
  if(!body.evidence.length&&body.state!=='UNKNOWN')throw new Error('non-UNKNOWN correspondence requires evidence');
  return {...body,id:input.id||stableId('corr',body)};
}
