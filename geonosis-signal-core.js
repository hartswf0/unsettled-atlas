/* GEONOSIS SIGNAL CORE
 * One rule: source rows do not become truth. They become source-stamped signals.
 * This wraps the existing LIVE index, so old and new adapters share the same
 * subject/predicate/epistemic/provenance/address contract.
 */

var GEONOSIS_SIGNAL_VERSION='geonosis-signal-v1';
var GEONOSIS_KIND = {
  earthquake:{predicate:'seismic_event',signs:['perception','event','material']},
  datacenter:{predicate:'datacenter_record',signs:['position','material','institution']},
  fire:{predicate:'active_fire_detection',signs:['perception','event','potential']},
  aircraft:{predicate:'aircraft_position',signs:['position','movement','trace']},
  'weather-alert':{predicate:'weather_alert',signs:['event','institution','constraint','potential']},
  streamflow:{predicate:'streamflow_observation',signs:['perception','flow','chronosign']},
  'hydro-flowline':{predicate:'hydrographic_flowline',signs:['topology','flow','material']},
  'fema-declaration':{predicate:'federal_disaster_declaration',signs:['event','institution','memory']},
  biodiversity:{predicate:'species_occurrence',signs:['perception','position','memory']},
  'civic-report':{predicate:'service_request',signs:['affection','discourse','institution','event']},
  'air-quality':{predicate:'air_quality_observation',signs:['perception','affection','chronosign']}
};
function geonosisSubject(r){
  var p=r.properties||{};
  if(r.kind==='aircraft')return 'aircraft:'+(p.icao24||r.id);
  if(r.kind==='streamflow')return 'monitoring-location:'+(p.monitoringLocation||r.id);
  if(r.kind==='hydro-flowline')return 'hydrography:'+(p.mainstemId||p.catchmentId||r.id);
  if(r.kind==='fema-declaration')return 'jurisdiction:'+[p.state,p.county,p.fips].filter(Boolean).join(':');
  if(r.kind==='air-quality')return 'reporting-area:'+(p.reportingArea||r.id);
  return r.id;
}
function geonosisValue(r){
  var p=r.properties||{};
  if(r.kind==='earthquake')return {magnitude:p.magnitude,depth_km:p.depthKm,place:p.place||null};
  if(r.kind==='datacenter')return {name:p.name||null,operator:p.operator||null,capacity:p.capacity||null};
  if(r.kind==='fire')return {frp:p.frp,confidence:p.confidence,sensor:p.sensor||null};
  if(r.kind==='aircraft')return {callsign:p.callsign||null,altitude_m:p.altitudeM,speed_mps:p.groundSpeedMps,track_deg:p.trackDeg};
  if(r.kind==='weather-alert')return {event:p.event||null,severity:p.severity||null,urgency:p.urgency||null,headline:p.headline||null};
  if(r.kind==='streamflow')return {value:p.value,unit:p.unit||null,approval_status:p.approvalStatus||null};
  if(r.kind==='hydro-flowline')return {name:p.name||null,feature_type:p.featureType||null,stream_order:p.streamOrder,flow_direction:p.flowDirection||null};
  if(r.kind==='fema-declaration')return {disaster_number:p.disasterNumber||null,designation:p.designation||null,state:p.state||null,county:p.county||null};
  if(r.kind==='biodiversity')return {scientific_name:p.scientificName||null,vernacular_name:p.vernacularName||null,basis_of_record:p.basisOfRecord||null};
  if(r.kind==='civic-report')return {complaint_type:p.complaintType||null,descriptor:p.descriptor||null,agency:p.agency||null,status:p.status||null};
  if(r.kind==='air-quality')return {parameter:p.parameter||null,aqi:p.aqi,category:p.category||null};
  return p;
}
function geonosisRelations(r){
  var p=r.properties||{},out=[];
  if(r.kind==='hydro-flowline'&&p.addressPath&&p.addressPath.length)out.push({predicate:'passes_through',objects:p.addressPath.slice(0,64)});
  if(r.kind==='aircraft'&&r.motion){
    if(r.motion.previousCell&&r.motion.cell&&r.motion.previousCell!==r.motion.cell)out.push({predicate:'moved_from_to',from:r.motion.previousCell,to:r.motion.cell});
    if(r.motion.cell)out.push({predicate:'located_in',object:r.motion.cell});
  }
  if(r.kind==='streamflow'&&p.hydrologicUnit)out.push({predicate:'within_hydrologic_unit',object:p.hydrologicUnit});
  if(r.kind==='fema-declaration'&&p.disasterNumber)out.push({predicate:'designated_under',object:'fema-disaster:'+p.disasterNumber});
  return out;
}
function geonosisSignal(r){
  var k=GEONOSIS_KIND[r.kind]||{predicate:r.kind||'observation',signs:['perception']};
  return {version:GEONOSIS_SIGNAL_VERSION,subject:geonosisSubject(r),predicate:k.predicate,value:geonosisValue(r),geometry:{type:'Point',coordinates:[r.lon,r.lat]},observed_at:r.observedAt||null,retrieved_at:r.retrievedAt||null,source:r.source||null,epistemic:r.epistemic||'RECORD',confidence:r.properties&&r.properties.confidence!=null?r.properties.confidence:null,sign_types:k.signs.slice(),addresses:[],relations:geonosisRelations(r),derived_from:[],provenance:{provider:r.source||null,record_id:r.id}};
}

var liveIndexRecordGeonosisBase=liveIndexRecord;
liveIndexRecord=function(r){
  if(!r.signal)r.signal=geonosisSignal(r);
  liveIndexRecordGeonosisBase(r);
  r.signal.addresses=(r.prefixes||[]).slice();
  r.signal.relations=geonosisRelations(r);
};
var liveReplaceSourceGeonosisBase=liveReplaceSource;
liveReplaceSource=function(sourceId,records,meta){
  liveReplaceSourceGeonosisBase(sourceId,records,meta);
  (records||[]).forEach(function(r){if(!r||!r.signal)return;r.signal.source=sourceId;r.signal.provenance.provider=sourceId;r.signal.coverage=meta||null;});
};

window.ICOSA_LIVE.signal=function(id){var r=LIVE.records[id];return r&&r.signal||null;};
window.ICOSA_LIVE.signalsForCell=function(slug,kind){var c=typeof slug==='string'?cellFromSlug(slug):slug;return c?liveForCell(c,kind).map(function(r){return r.signal;}).filter(Boolean):[];};
window.ICOSA_LIVE.signalVersion=GEONOSIS_SIGNAL_VERSION;
