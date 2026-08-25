import { geographicForm, observation } from './v1-schema.mjs';

const SOURCE_APPARATUS={
  'usgs-earthquakes':{id:'USGS_FDSN',classification_method:'instrument network + USGS event solution',failure_modes:['station coverage','location uncertainty','catalog latency']},
  'nws-alerts':{id:'NWS_ALERTS',classification_method:'official alert production',failure_modes:['forecast uncertainty','polygon generalization','issuance latency']},
  'eonet':{id:'NASA_EONET',classification_method:'aggregated event reporting',failure_modes:['source lag','aggregation omissions']},
  'gbif-occurrences':{id:'GBIF_OCCURRENCE',classification_method:'aggregated occurrence record',failure_modes:['observer bias','coordinate uncertainty','taxonomic error','sampling absence']},
  'inaturalist-observations':{id:'INATURALIST_OBSERVATION',classification_method:'community observation',failure_modes:['observer bias','location obscuration','taxonomic disagreement','sampling absence']},
  'osm-notes':{id:'OSM_NOTES',classification_method:'voluntary map issue report',failure_modes:['reporting opportunity','uneven mapper attention','stale unresolved notes']},
  'wikipedia-geosearch':{id:'WIKIPEDIA_GEOSEARCH',classification_method:'encyclopedic representation near coordinates',failure_modes:['notability bias','coverage bias','coordinate imprecision']},
  'epa-echo':{id:'EPA_ECHO',classification_method:'regulatory facility record',failure_modes:['reporting lag','facility identity mismatch','regulatory coverage limits']},
  'nps-national-register':{id:'NPS_NRHP',classification_method:'official historic register',failure_modes:['designation bias','sensitive geometry omission','update latency']},
  'fdic-locations':{id:'FDIC_BANKFIND',classification_method:'reported branch location',failure_modes:['reporting lag','branch move/closure latency']},
  'fdic-sod':{id:'FDIC_SOD',classification_method:'reported branch deposit stock',failure_modes:['annual reporting cadence','deposit attribution limits']},
  'hmda-lenders':{id:'HMDA',classification_method:'reported mortgage lending activity',failure_modes:['coverage rules','geographic aggregation','reporting lag']},
  'gleif-enrichment':{id:'GLEIF_LEI',classification_method:'legal entity and accounting-consolidation relationship records',failure_modes:['LEI coverage','relationship reporting exemptions','entity matching uncertainty']},
  'usaspending-county':{id:'USASPENDING',classification_method:'federal award place-of-performance aggregation',failure_modes:['administrative scope','award reporting lag','recipient/place conflation']},
  'atlanta-historic-buildings':{id:'ATLANTA_ARCGIS',classification_method:'municipal GIS historic-building record',failure_modes:['schema drift','designation coverage','update lag']},
  'atlanta-rezoning-cases':{id:'ATLANTA_ARCGIS',classification_method:'municipal rezoning case record',failure_modes:['representative-point indexing','case status lag']},
  'nola-building-permits':{id:'DATA_NOLA',classification_method:'municipal permit record',failure_modes:['address/geometry quality','filing lag','unpermitted work']},
  'nola-code-enforcement':{id:'DATA_NOLA',classification_method:'municipal code case record',failure_modes:['reporting bias','address resolution','municipal scope']}
};

function apparatusFor(signal){
  return SOURCE_APPARATUS[signal.source]||{id:String(signal.source||'UNKNOWN_SOURCE').toUpperCase(),classification_method:'source-native record',failure_modes:['unknown coverage','unknown detection threshold']};
}

export function regimeForSignal(signal,override=null){
  if(override)return override;
  const p=String(signal.predicate||'');
  if(signal.source==='usgs-earthquakes'&&signal.epistemic==='OBSERVED')return 'MATERIAL';
  if((signal.source==='gbif-occurrences'||signal.source==='inaturalist-observations')&&signal.epistemic==='OBSERVED')return 'MATERIAL';
  if(p.startsWith('attention.')||p.startsWith('claim.')||signal.source==='nws-alerts'||signal.source==='eonet'||signal.source==='wikipedia-geosearch'||signal.source==='osm-notes')return 'REPRESENTATIONAL';
  if(p.startsWith('finance.')||p.startsWith('ownership.')||p.startsWith('regulation.')||p.startsWith('planning.')||p.startsWith('permit.')||p.startsWith('code.')||p.startsWith('heritage.')||['epa-echo','nps-national-register','fdic-locations','fdic-sod','hmda-lenders','gleif-enrichment','usaspending-county','atlanta-historic-buildings','atlanta-rezoning-cases','nola-building-permits','nola-code-enforcement'].includes(signal.source))return 'INSTITUTIONAL';
  if(signal.epistemic==='OBSERVED')return 'MATERIAL';
  return 'REPRESENTATIONAL';
}

export function formForSignal(signal,override=null){
  if(override)return override;
  const p=String(signal.predicate||'');
  if(p.startsWith('movement.')||p.includes('route')||p.includes('flow'))return 'TRAJECTORY';
  if(p.startsWith('finance.')||p.startsWith('ownership.')||p.includes('relationship')||p.includes('award'))return 'RELATION';
  if(p.includes('alert')||p.includes('flood')||p.includes('heat')||p.includes('air_quality')||p.includes('drought'))return 'FIELD';
  return 'OBJECT';
}

export function legacySignalToV1(signal,{regime=null,form=null,subject_id=null}={}){
  if(!signal||!signal.id)throw new Error('legacy signal requires id');
  const inferredForm=formForSignal(signal,form);
  const g=geographicForm({
    form:inferredForm,
    subject_id:subject_id||signal.subject_id||signal.gers_id||signal.source_record_id||signal.id,
    geometry:signal.geometry||null,
    atlas_address:signal.atlas_address||null,
    native_extent:signal.geometry?.type||null,
    observation_resolution:signal.provenance?.spatial_resolution||null,
    operative_scale:signal.provenance?.scope||null,
    institutional_scope:signal.provenance?.administrative_scope||null,
    addressing_depth:signal.atlas_address?String(signal.atlas_address).split('.')[1]?.length||0:null,
    bridge_basis:`legacy-signal:${signal.predicate}`,
    provenance:{source_signal_id:signal.id,source:signal.source}
  });
  const o=observation({
    regime:regimeForSignal(signal,regime),
    form_id:g.id,
    source:signal.source,
    source_record_id:signal.source_record_id||null,
    source_signal_id:signal.id,
    epistemic:signal.epistemic,
    predicate:signal.predicate,
    value:signal.value,
    unit:signal.unit||null,
    apparatus:apparatusFor(signal),
    time:{
      occurred_at:signal.observed_at||null,
      observed_at:signal.observed_at||null,
      recorded_at:signal.provenance?.recorded_at||null,
      published_at:signal.provenance?.published_at||null,
      valid_from:signal.valid_from||null
    },
    confidence:signal.confidence??1,
    provenance:{legacy_signal_id:signal.id,legacy_derived_from:signal.derived_from||[]}
  });
  return {form:g,observation:o};
}

export function bridgeSignals(signals=[]){
  const forms=[],observations=[],errors=[];
  for(const signal of signals){
    try{const x=legacySignalToV1(signal);forms.push(x.form);observations.push(x.observation);}catch(error){errors.push({signal_id:signal?.id||null,error:String(error.message||error)});}
  }
  return {forms,observations,errors};
}
