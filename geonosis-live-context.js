/* GEONOSIS -> MODEL CONTEXT
 * Loaded after icosa-live-context.js. Extends the one existing compiler rather
 * than creating a second LLM path.
 */

var GEONOSIS_CONTEXT_VERSION='geonosis-context-v2-statements';
var GEONOSIS_CONTEXT_MAX=8;

function geoCtxIso(ms){return Number.isFinite(Number(ms))&&Number(ms)>0?new Date(Number(ms)).toISOString():null;}
function geoCtxSource(id,cell){
  var s=LIVE.sources[id],t=GEO_TARGETS[id],m=s&&s.meta||{},slug=cellSlug(cell),matches=!!(m.coverageCell&&m.coverageCell===slug);
  var state=s?s.state:'missing',fresh=s?liveSourceFreshness(s):'UNAVAILABLE';
  if(state==='unconfigured')fresh='UNCONFIGURED';
  if(m.coverageCell&&!matches)fresh='OTHER CELL';
  return {id:id,provider:s&&(s.provider||s.name)||null,state:state,freshness:fresh,loaded_records:s&&s.count||0,last_update:geoCtxIso(s&&s.lastUpdate),coverage:{requested_cell:t&&t.slug||null,loaded_cell:m.coverageCell||null,matches_focus:matches,mode:m.coverageMode||t&&t.mode||null,complete_for_focus:matches&&!!m.completeForCell,zero_semantics:matches&&m.completeForCell?(m.zeroSemantics||'source-specific successful zero'):('not valid as an absence claim'+(m.zeroSemantics?' · '+m.zeroSemantics:''))},error:s&&s.lastError||null};
}
function geoCtxSignal(r){
  var p=r.properties||{},x={id:r.id,kind:r.kind,epistemic:r.epistemic||'RECORD',observed_at:geoCtxIso(r.observedAt),retrieved_at:geoCtxIso(r.retrievedAt),subject:r.signal&&r.signal.subject||null,predicate:r.signal&&r.signal.predicate||null,sign_types:r.signal&&r.signal.sign_types||[]};
  if(r.kind==='weather-alert')x.sign={event:p.event||null,severity:p.severity||null,certainty:p.certainty||null,urgency:p.urgency||null,headline:p.headline||null,area:p.area||null,expires:p.expires||null};
  else if(r.kind==='streamflow')x.sign={site:p.site||null,monitoring_location:p.monitoringLocation||null,value:p.value,unit:p.unit||null,approval_status:p.approvalStatus||null,hydrologic_unit:p.hydrologicUnit||null,drainage_area:p.drainageArea};
  else if(r.kind==='hydro-flowline')x.sign={name:p.name||null,feature_type:p.featureType||null,length_km:p.lengthKm,flow_direction:p.flowDirection||null,stream_order:p.streamOrder,mainstem_id:p.mainstemId||null,catchment_id:p.catchmentId||null,hydrosequence:p.hydrosequence,downstream_hydrosequence:p.downstreamHydrosequence,upstream_hydrosequence:p.upstreamHydrosequence,address_path:(p.addressPath||[]).slice(0,20)};
  else if(r.kind==='fema-declaration')x.sign={county:p.county||null,state:p.state||null,fips:p.fips||null,designation:p.designation||null,disaster_number:p.disasterNumber||null,post_date:geoCtxIso(p.postDate),amendment:p.amendment||null};
  else if(r.kind==='flood-hazard')x.sign={flood_zone:p.floodZone||null,zone_subtype:p.zoneSubtype||null,special_flood_hazard:p.specialFloodHazard||null,static_bfe:p.staticBfe,depth:p.depth,velocity:p.velocity,study_type:p.studyType||null,address_path:(p.addressPath||[]).slice(0,20)};
  else if(r.kind==='biodiversity')x.sign={scientific_name:p.scientificName||null,vernacular_name:p.vernacularName||null,species:p.species||null,basis_of_record:p.basisOfRecord||null,dataset:p.datasetTitle||null,occurrence_status:p.occurrenceStatus||null,coordinate_uncertainty_m:p.coordinateUncertaintyM,event_date:p.eventDate||null};
  else if(r.kind==='civic-report')x.sign={complaint_type:p.complaintType||null,descriptor:p.descriptor||null,agency:p.agency||null,status:p.status||null,borough:p.borough||null,created:p.created||null,closed:p.closed||null};
  else if(r.kind==='air-quality')x.sign={parameter:p.parameter||null,aqi:p.aqi,category:p.category||null,reporting_area:p.reportingArea||null,state_code:p.stateCode||null,date_observed:p.dateObserved||null,hour_observed:p.hourObserved};
  else x.sign=r.signal&&r.signal.value||{};
  return x;
}
function geoCtxKind(cell,id){
  var d=GEO_DEFS[id],src=geoCtxSource(id,cell);
  if(!d||!src.coverage.matches_focus)return {count:null,examples:[],note:'source has no matching loaded coverage for this triangle'};
  var rows=liveForCell(cell,d.kind).slice();
  rows.sort(function(a,b){return (b.observedAt||b.retrievedAt||0)-(a.observedAt||a.retrievedAt||0);});
  return {count:rows.length,examples:rows.slice(0,GEONOSIS_CONTEXT_MAX).map(geoCtxSignal)};
}
function geoCtxBuild(cell){
  var ids=Object.keys(GEO_DEFS),sources={},signs={};
  ids.forEach(function(id){sources[id]=geoCtxSource(id,cell);signs[GEO_DEFS[id].kind]=geoCtxKind(cell,id);});
  var inference=typeof geonosisInfer==='function'?geonosisInfer(cell):{differences:[],statements_of_importance:[]};
  return {version:GEONOSIS_CONTEXT_VERSION,focus_address:cellSlug(cell),semantics:{signal:'a source-stamped proposition about the focused place, never omniscience',reported:'a person or institution asserted/reported it',observed:'a sensor or source recorded an observation',record:'a mapped/administrative record',preliminary:'current values may not be quality-assured',regulatory:'an official mapped or administrative classification, not a direct physical measurement',derived_statement:'a deterministic candidate proposition produced by a named rule from attached evidence IDs; it is an agenda candidate, not an additional fact',absence:'a missing record is only meaningful when coverage is matching, complete, and the source-specific zero_semantics says what that zero means'},sources:sources,signs:signs,differences:inference.differences||[],statements_of_importance:inference.statements_of_importance||[]};
}

var liveCtxBuildGeonosisBase=liveCtxBuild;
liveCtxBuild=function(cell){var x=liveCtxBuildGeonosisBase(cell);x.geonosis=geoCtxBuild(cell);return x;};

var liveCtxWarmGeonosisBase=liveCtxWarm;
liveCtxWarm=function(cell){liveCtxWarmGeonosisBase(cell);if(typeof geoRequestAll==='function')geoRequestAll(cell);};

var liveCtxPendingGeonosisBase=liveCtxPending;
liveCtxPending=function(cell){
  var out=liveCtxPendingGeonosisBase(cell),slug=cellSlug(cell);
  Object.keys(GEO_DEFS).forEach(function(id){var s=LIVE.sources[id],t=GEO_TARGETS[id];if(!s||s.state!=='loading'||!t||t.slug!==slug)return;if(out.indexOf(id)<0)out.push(id);});
  return out;
};

var GEONOSIS_CONTEXT_LAW=' When context.live.geonosis is present, preserve each sign epistemic class and source coverage. NWS sampled-point zeros do not prove there is no weather alert elsewhere in a triangle. A USGS streamflow zero means no matching current gauge time-series point, not no stream or no water. A 3DHP zero means no mapped flowline intersection under the returned service coverage, not physical absence of water. A FEMA declaration zero means no current designated-county intersection, not no hazard or disaster. A FEMA NFHL zero is valid only when the separate availability layer confirms mapped coverage; even then it means no mapped regulatory Flood Hazard Zone intersection, not zero flood probability. A GBIF zero means no matching occurrence record, not species absence. A 311 zero means no geocoded service request in the stated time window, not no experienced problem. An AirNow zero means no returned reporting-area observation, not clean air. EPA ECHO is an administrative facility/compliance record, not direct pollution measurement. Never collapse these narrow zeros into world claims. context.live.geonosis.statements_of_importance are deterministic agenda candidates whose evidence IDs are authoritative for their basis: you may argue, qualify, connect or reject the proposition, but never add a factual premise that is not in the supplied context.';
if(typeof LAW==='string'&&LAW.indexOf('context.live.geonosis is present')<0)LAW+=GEONOSIS_CONTEXT_LAW;

var renderLiveModelContextGeoBase=renderLiveModelContext;
renderLiveModelContext=function(cell){
  renderLiveModelContextGeoBase(cell);
  var el=document.getElementById('live-model-context');if(!el)return;
  var g=geoCtxBuild(cell),parts=[];
  Object.keys(GEO_DEFS).forEach(function(id){var k=GEO_DEFS[id].kind,q=g.signs[k];parts.push(GEO_DEFS[id].label+' '+(q.count==null?'?':q.count));});
  var p=document.createElement('p');p.style.fontSize='8px';p.style.letterSpacing='.08em';p.textContent='GEONOSIS · '+parts.join(' · ')+' · SOI '+g.statements_of_importance.length;el.appendChild(p);
};

window.ICOSA_LIVE.geonosisContext=function(slug){var c=typeof slug==='string'?cellFromSlug(slug):slug;return c?geoCtxBuild(c):null;};
window.ICOSA_LIVE.geonosisContextVersion=GEONOSIS_CONTEXT_VERSION;
