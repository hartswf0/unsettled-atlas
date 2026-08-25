/* GEONOSIS SEMIOSIS LENS
 * A source record is evidence. It becomes a candidate geosign only when a
 * spatial difference is read in a consequential relation for a named
 * responsive system at a stated scale.
 *
 * Loaded after geonosis-inspector.js so it can upgrade the existing map marks,
 * selected-record panel, drawing pass, and model context without replacing the
 * ICOSA world or its observation bus.
 */

var GEONOSIS_SEMIOSIS_VERSION='geonosis-semiosis-v1';
var GEO_SEMIOSIS={
  reader:'primary',
  readers:['primary','person','ecology','infrastructure','institution','model']
};

function geoSemReaderName(k){
  return ({primary:'PRIMARY PROCESS',person:'PERSON / BODY',ecology:'ECOLOGY / ORGANISM',infrastructure:'INFRASTRUCTURE',institution:'INSTITUTION',model:'MODEL / INFERENCE'})[k]||String(k||'PRIMARY PROCESS').toUpperCase();
}
function geoSemSourceGlyph(r){
  var d=typeof GEO_DEFS!=='undefined'&&GEO_DEFS[r&&r.source];
  if(d&&d.glyph)return d.glyph;
  var k=r&&r.kind||'';
  var m={earthquake:'EQ',datacenter:'DC',fire:'FIRE',aircraft:'AIR','weather-alert':'WX',streamflow:'Q','hydro-flowline':'H2O','fema-declaration':'FEMA',biodiversity:'BIO','civic-report':'311','flood-hazard':'FLOOD','regulated-facility':'EPA','weather-state':'MET','terrain-state':'Z','air-quality':'AQ'};
  return m[k]||geoInspectCut(String(k||'DATA').toUpperCase(),6);
}
function geoSemDifference(r){
  var p=r&&r.properties||{},k=r&&r.kind;
  if(k==='earthquake')return 'M'+Number(p.magnitude||0).toFixed(1)+' seismic event'+(p.depthKm==null?'':' · '+Math.round(p.depthKm)+' km depth');
  if(k==='datacenter')return (p.name||'data center')+(p.operator?' · '+p.operator:'');
  if(k==='fire')return 'thermal detection'+(p.frp==null?'':' · FRP '+Number(p.frp).toFixed(1));
  if(k==='aircraft')return (p.callsign||p.registration||p.icao24||'aircraft')+(p.altitudeM==null?'':' · '+Math.round(p.altitudeM)+' m');
  if(k==='weather-alert')return (p.event||'weather alert')+(p.severity?' · '+p.severity:'');
  if(k==='streamflow')return (p.site||p.monitoringLocation||'stream gauge')+(p.value==null?'':' · '+p.value+' '+(p.unit||''));
  if(k==='hydro-flowline')return (p.name||p.featureType||'mapped flowline')+(p.streamOrder==null?'':' · order '+p.streamOrder);
  if(k==='fema-declaration')return (p.designation||'FEMA disaster designation')+(p.disasterNumber?' · #'+p.disasterNumber:'');
  if(k==='biodiversity')return (p.vernacularName||p.scientificName||p.species||'species occurrence')+(p.basisOfRecord?' · '+p.basisOfRecord:'');
  if(k==='civic-report')return (p.complaintType||'civic report')+(p.descriptor?' · '+p.descriptor:'');
  if(k==='flood-hazard')return 'FEMA flood zone '+(p.floodZone||'record')+(p.zoneSubtype?' · '+p.zoneSubtype:'');
  if(k==='regulated-facility')return (p.name||'EPA regulated facility')+(p.currentSignificantNonCompliance==='Y'?' · significant non-compliance flag':'');
  if(k==='weather-state')return (p.mode==='forecast'?'forecast':'weather observation')+' · '+(p.shortForecast||p.textDescription||geoInspectValue(p.temperature)||'state');
  if(k==='terrain-state')return 'terrain sample'+(p.elevationCentreM==null?'':' · '+Math.round(p.elevationCentreM)+' m')+(p.reliefM==null?'':' · relief '+Math.round(p.reliefM)+' m');
  if(k==='air-quality')return (p.parameter||'air quality')+(p.aqi==null?'':' · AQI '+p.aqi)+(p.category?' · '+p.category:'');
  return geoInspectLabel(r);
}
function geoSemSpatialForm(r){
  var k=r&&r.kind,p=r&&r.properties||{};
  if(k==='aircraft')return 'TRAJECTORY / MOVING POINT';
  if(k==='hydro-flowline')return 'LINE / NETWORK'+(p.addressPath&&p.addressPath.length?' · '+p.addressPath.length+' ADDRESSED CELLS':'');
  if(k==='flood-hazard')return 'AREA / REGULATORY POLYGON';
  if(k==='weather-alert')return 'AREA / INSTITUTIONAL ALERT';
  if(k==='weather-state'||k==='terrain-state'||k==='air-quality'||k==='streamflow')return 'FIELD SAMPLE / POINT OBSERVATION';
  return 'EMPLACED POINT';
}
function geoSemTemporalMode(r){
  var k=r&&r.kind,p=r&&r.properties||{};
  if(k==='aircraft')return 'TRAJECTORY / NOW';
  if(k==='weather-state'&&p.mode==='forecast')return 'POTENTIAL / FUTURE';
  if(k==='weather-alert'||k==='fire'||k==='air-quality')return 'CURRENT / POTENTIAL CONSEQUENCE';
  if(k==='earthquake')return 'EVENT / TRACE OF PROCESS';
  if(k==='biodiversity'||k==='civic-report'||k==='fema-declaration'||k==='regulated-facility')return 'RECORD / MEMORY';
  if(k==='hydro-flowline'||k==='flood-hazard'||k==='datacenter'||k==='terrain-state')return 'PERSISTENT / MAPPED STATE';
  return 'OBSERVATION / NOW';
}
function geoSemRelation(r){
  var k=r&&r.kind,p=r&&r.properties||{};
  if(k==='earthquake')return 'present seismic event -> index of a recent subsurface process';
  if(k==='datacenter')return 'emplaced facility -> possible node in computation / power / network relations';
  if(k==='fire')return 'thermal detection contiguous with this ground -> evidence of possible active burning';
  if(k==='aircraft')return r.motion&&r.motion.previousCell?'position at t(n) -> addressed transition '+r.motion.previousCell+' -> '+r.motion.cell:'moving position -> trajectory through addressed ground';
  if(k==='weather-alert')return 'institutional warning -> applies to delimited or sampled ground';
  if(k==='streamflow')return 'gauge observation -> state of a monitoring location within a hydrologic network';
  if(k==='hydro-flowline')return 'mapped flowline -> passes through / connects addressed cells';
  if(k==='fema-declaration')return 'jurisdiction -> designated under a named federal disaster record';
  if(k==='biodiversity')return 'occurrence record -> organism observation contiguous with this coordinate';
  if(k==='civic-report')return 'reported problem -> place x agency x service-response process';
  if(k==='flood-hazard')return 'regulatory polygon -> overlaps / classifies this ground';
  if(k==='regulated-facility')return 'facility identity -> emplaced in regulatory and hydrologic contexts';
  if(k==='weather-state')return 'station or forecast-grid sample -> nearby atmospheric field';
  if(k==='terrain-state')return 'elevation samples -> local relief / gradient field';
  if(k==='air-quality')return 'reporting-area observation -> nearby atmospheric condition';
  return 'source record -> emplaced at coordinate';
}
function geoSemPrimary(k){
  var m={
    earthquake:['TRACE','SEISMIC / HAZARD PROCESS','A present event makes recent seismic activity inferable on this ground.'],
    datacenter:['CONNECT','COMPUTATION / INFRASTRUCTURE','An emplaced infrastructure node makes network and dependency relations addressable.'],
    fire:['WARN','FIRE / HAZARD PROCESS','A thermal detection raises attention to possible active burning; it is not a fire perimeter.'],
    aircraft:['TRACE','MOBILITY PROCESS','Successive addressed positions make a trajectory and cell transitions legible.'],
    'weather-alert':['WARN','WEATHER / HAZARD PROCESS','An institutional alert changes the hazard state assigned to covered ground.'],
    streamflow:['FLOW','HYDROLOGIC PROCESS','A gauge value differentiates the current state of a hydrologic flow network.'],
    'hydro-flowline':['CONNECT','HYDROLOGIC PROCESS','A mapped flowline links addressed ground through upstream/downstream continuity.'],
    'fema-declaration':['NAME','INSTITUTIONAL PROCESS','A disaster designation makes a jurisdiction legible under a named federal disaster record.'],
    biodiversity:['TRACE','ECOLOGICAL / OBSERVATION PROCESS','An occurrence record makes a past or present organism observation spatially inferable; it does not prove species absence or abundance.'],
    'civic-report':['EXPOSE','CIVIC / INSTITUTIONAL PROCESS','A service request makes a reported local problem legible to an institutional response system; it does not verify the underlying condition.'],
    'flood-hazard':['BOUND','REGULATORY / FLOOD MODEL','A regulatory hazard polygon differentiates ground by mapped flood-hazard classification.'],
    'regulated-facility':['LOCATE','REGULATORY / INSTITUTIONAL PROCESS','An EPA facility record makes a regulated facility and its administrative status spatially addressable; it is not direct pollution measurement.'],
    'weather-state':['ORIENT','ATMOSPHERIC / FORECAST PROCESS','A sampled observation or forecast differentiates the atmospheric state near the focus.'],
    'terrain-state':['ORIENT','TERRAIN / SURFACE PROCESS','Elevation and relief differentiate orientation, gradient, routing and potential surface flow.'],
    'air-quality':['WARN','ATMOSPHERIC / HEALTH-ATTENTION PROCESS','An AQI observation differentiates current reporting-area air conditions; it does not measure every location in the triangle.']
  };
  return m[k]||['OBSERVE','OBSERVATION PROCESS','No consequential relation has been specified for this source record yet.'];
}
function geoSemOverride(k,reader){
  var hazard={earthquake:1,fire:1,'weather-alert':1,'flood-hazard':1,'air-quality':1};
  var flow={streamflow:1,'hydro-flowline':1,'terrain-state':1};
  if(reader==='primary')return null;
  if(reader==='person'){
    if(hazard[k])return ['WARN','PERSON / BODY','The sign can change attention, avoidance or route choice; it does not by itself establish personal exposure or damage.'];
    if(flow[k])return [k==='terrain-state'?'ROUTE':'ORIENT','PERSON / BODY','The relation can alter movement or orientation; accessibility, crossing safety and actual route choice require additional evidence.'];
    if(k==='civic-report')return ['EXPOSE','PERSON / BODY','The record exposes a reported experience attached to this place; the report is not independently verified.'];
    if(k==='biodiversity')return ['LOCATE','PERSON / BODY','The occurrence record can orient observation toward a reported organism location; presence now is not guaranteed.'];
    if(k==='datacenter'||k==='regulated-facility'||k==='aircraft'||k==='fema-declaration'||k==='weather-state')return ['ORIENT','PERSON / BODY','The record can orient attention to a situated condition, facility, movement or jurisdiction; no personal consequence is inferred without another relation.'];
  }
  if(reader==='ecology'){
    if(k==='biodiversity')return ['TRACE','ECOLOGY / ORGANISM','The occurrence is evidence of an organism-place relation; population, habitat quality and current presence require more evidence.'];
    if(k==='streamflow'||k==='hydro-flowline')return ['FLOW','ECOLOGY / ORGANISM','Hydrologic connectivity can structure passage, habitat and resource movement; ecological use is not established by geometry alone.'];
    if(k==='terrain-state')return ['ORIENT','ECOLOGY / ORGANISM','Terrain gradient can structure movement, drainage and exposure for organisms; species-specific response is not inferred.'];
    if(k==='fire'||k==='weather-alert'||k==='flood-hazard'||k==='earthquake')return ['TRACE','ECOLOGY / ORGANISM','The event or hazard can mark environmental disturbance; ecological effect is not established by this record alone.'];
    return ['OBSERVE','ECOLOGY / ORGANISM','No ecological consequence is licensed from this record alone. Add an organism, habitat or ecological process relation first.'];
  }
  if(reader==='infrastructure'){
    if(k==='datacenter')return ['CONNECT','INFRASTRUCTURE','The facility can be treated as a node in computation, power and network dependency graphs; specific dependencies require additional data.'];
    if(k==='aircraft')return ['ROUTE','INFRASTRUCTURE','The trajectory can be read as movement through transport space; capacity, conflict and destination are not inferred.'];
    if(hazard[k])return ['MODEL','INFRASTRUCTURE','The hazard signal can change exposure or inspection modelling for situated assets; actual damage is not inferred.'];
    if(flow[k])return ['MODEL','INFRASTRUCTURE','The hydrologic or terrain relation can constrain drainage, crossing, siting or load models; asset-specific consequence requires an asset relation.'];
    if(k==='regulated-facility')return ['LOCATE','INFRASTRUCTURE','The record locates a regulated facility within an infrastructure landscape; operational dependencies are not supplied by ECHO.'];
    return ['OBSERVE','INFRASTRUCTURE','No infrastructure consequence is licensed from this record alone. Add a situated asset or dependency relation first.'];
  }
  if(reader==='institution'){
    if(k==='fema-declaration')return ['BOUND','INSTITUTION','The declaration links a named jurisdiction to a federal disaster designation, changing its administrative status.'];
    if(k==='civic-report')return ['CLUSTER','INSTITUTION','Reports can be grouped by place, type and time to expose a service-demand pattern; reporting bias remains possible.'];
    if(k==='regulated-facility')return ['EXPOSE','INSTITUTION','The record makes regulatory identity, inspection and compliance fields administratively legible.'];
    if(k==='flood-hazard')return ['BOUND','INSTITUTION','The mapped zone classifies ground within a regulatory flood-hazard regime.'];
    if(k==='weather-alert'||k==='fire'||k==='earthquake'||k==='air-quality')return ['WARN','INSTITUTION','The signal can change monitoring or response priority; no declaration, closure or enforcement action is implied.'];
    if(k==='hydro-flowline'||k==='streamflow'||k==='terrain-state'||k==='weather-state'||k==='biodiversity'||k==='datacenter'||k==='aircraft')return ['MAP','INSTITUTION','The source makes a situated phenomenon addressable for institutional mapping or monitoring; policy consequence is not inferred.'];
  }
  if(reader==='model'){
    if(k==='aircraft')return ['PREDICT','MODEL / INFERENCE','Successive positions constrain a trajectory estimate; future position remains uncertain.'];
    if(k==='weather-state')return ['PREDICT','MODEL / INFERENCE','Observed or predicted atmospheric state constrains a local forecast model within source resolution and time bounds.'];
    if(k==='terrain-state')return ['MODEL','MODEL / INFERENCE','Elevation samples constrain surface, gradient, visibility or flow calculations; they are samples rather than a complete continuous field.'];
    if(k==='streamflow'||k==='hydro-flowline')return ['FLOW','MODEL / INFERENCE','The observation or mapped line constrains hydrologic connectivity and flow reasoning.'];
    if(hazard[k])return ['PREDICT','MODEL / INFERENCE','The signal can update a hazard model; it does not by itself determine outcome, exposure or future spread.'];
    if(k==='biodiversity')return ['INFER','MODEL / INFERENCE','The occurrence can update a species-distribution hypothesis; absence, abundance and habitat suitability are not directly observed.'];
    if(k==='civic-report')return ['CLUSTER','MODEL / INFERENCE','The report can contribute to a spatial demand or complaint pattern; reporting behavior is a confound.'];
    if(k==='datacenter')return ['CONNECT','MODEL / INFERENCE','The facility can become a node in a computation/infrastructure graph; edges require separate evidence.'];
    if(k==='regulated-facility'||k==='fema-declaration')return ['MAP','MODEL / INFERENCE','The administrative record can constrain a jurisdictional or regulatory model; physical conditions are not implied.'];
  }
  return ['OBSERVE',geoSemReaderName(reader),'No consequential relation is licensed from this record alone for this reader.'];
}
function geoSemAdmitted(op){return op!=='OBSERVE';}
function geoSemAddress(r){
  if(!r)return null;
  if(r.prefixes&&r.prefixes.length)return r.prefixes[Math.min(LIVE_INDEX_DEPTH,r.prefixes.length-1)];
  return r.v?cellSlug(cellAt(r.v,LIVE_INDEX_DEPTH)):null;
}
function geoSemCoverage(r){
  var s=r&&LIVE.sources[r.source],m=s&&s.meta||{},t=typeof GEO_TARGETS!=='undefined'&&GEO_TARGETS[r&&r.source];
  return m.coverageCell||t&&t.slug||null;
}
function geoSemInterpret(r,reader){
  reader=reader||GEO_SEMIOSIS.reader||'primary';
  var base=geoSemPrimary(r&&r.kind),ov=geoSemOverride(r&&r.kind,reader),use=ov||base,op=use[0];
  return {
    version:GEONOSIS_SEMIOSIS_VERSION,
    evidence_id:r&&r.id||null,
    status:geoSemAdmitted(op)?'CANDIDATE_GEOSIGN':'OBSERVATION_ONLY',
    derived:true,
    reader:reader,
    responsive_system:use[1],
    operation:op,
    difference:geoSemDifference(r),
    emplacement:{
      address:geoSemAddress(r),
      position:r?[r.lon,r.lat]:null,
      coverage_address:geoSemCoverage(r),
      spatial_form:geoSemSpatialForm(r)
    },
    relation:geoSemRelation(r),
    consequence:use[2],
    scale:r&&r.v?{address:geoSemAddress(r),coverage_address:geoSemCoverage(r)}:null,
    temporal_mode:geoSemTemporalMode(r),
    epistemic:r&&r.epistemic||'RECORD',
    source:r&&r.source||null,
    admission_rule:geoSemAdmitted(op)?'difference × emplacement × responsive system -> stated consequence':'no stated consequence for this responsive system; remain an observation'
  };
}
function geoSemCompact(r){
  var g=geoSemInterpret(r,'primary');
  return {status:g.status,derived:true,operation:g.operation,difference:g.difference,emplacement:g.emplacement,relation:g.relation,responsive_system:g.responsive_system,consequence:g.consequence,temporal_mode:g.temporal_mode,admission_rule:g.admission_rule};
}

/* Map labels become OPERATION / SOURCE rather than unexplained source glyphs. */
var geoSemGlyphBase=geoInspectGlyph;
geoInspectGlyph=function(r){
  var g=geoSemInterpret(r,GEO_SEMIOSIS.reader),src=geoSemSourceGlyph(r);
  if(GEO_SEMIOSIS.reader==='primary')return g.operation+'/'+src;
  return (g.status==='OBSERVATION_ONLY'?'OBS':g.operation)+'/'+src;
};

function geoSemCellOutline(c,S,label,dashed,alpha){
  if(!c||!facingCamera(cellCentre(c)))return;
  var pts=c.tri.map(function(w){return screenOfWorld(worldOf(c.f,w),S);});
  ctx.save();if(dashed)ctx.setLineDash([4,4]);ctx.globalAlpha=alpha==null?.7:alpha;ctx.strokeStyle=COL.signal;ctx.fillStyle=COL.signal;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);ctx.lineTo(pts[1][0],pts[1][1]);ctx.lineTo(pts[2][0],pts[2][1]);ctx.closePath();ctx.stroke();var sc=liveCellScreen(c,S);ctx.font='700 7px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';ctx.textAlign='center';if(sc.x>=0&&sc.x<=W&&sc.y>=0&&sc.y<=H)ctx.fillText(label,sc.x,sc.y-12);ctx.restore();
}
function geoSemPath(r,S){
  var p=r&&r.properties||{},slugs=(p.addressPath||[]).slice(0,48);
  if(r&&r.motion&&r.motion.previousCell&&r.motion.cell)slugs=[r.motion.previousCell,r.motion.cell];
  if(slugs.length<2)return;
  var pts=[];slugs.forEach(function(slug){var c=cellFromSlug(slug);if(!c)return;var sc=liveCellScreen(c,S);if(Number.isFinite(sc.x)&&Number.isFinite(sc.y))pts.push(sc);});
  if(pts.length<2)return;
  ctx.save();ctx.strokeStyle=COL.signal;ctx.globalAlpha=.7;ctx.lineWidth=1.4;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(var i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=COL.signal;ctx.font='700 7px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';ctx.textAlign='left';ctx.fillText('RELATION PATH',pts[Math.floor(pts.length/2)].x+5,pts[Math.floor(pts.length/2)].y-5);ctx.restore();
}
function geoSemCompositions(r,S){
  if(!r||typeof geonosisInfer!=='function')return [];
  var c=geoInspectDataCell(),inf=c&&geonosisInfer(c),ss=inf&&inf.statements_of_importance||[],out=[];
  ss.forEach(function(s){if((s.evidence||[]).indexOf(r.id)<0)return;(s.evidence||[]).forEach(function(id){if(id!==r.id&&LIVE.records[id]&&out.indexOf(id)<0)out.push(id);});});
  var a=livePointScreen(r,S);ctx.save();ctx.strokeStyle=COL.signal;ctx.globalAlpha=.32;ctx.lineWidth=1;ctx.setLineDash([1,4]);out.slice(0,12).forEach(function(id){var q=LIVE.records[id];if(!q||!q.v||!facingCamera(q.v))return;var b=livePointScreen(q,S);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();});ctx.restore();
  return out;
}
function geoSemDrawSelected(S){
  var r=GEO_INSPECT.selectedId&&LIVE.records[GEO_INSPECT.selectedId];if(!r||!r.v||!facingCamera(r.v))return;
  var g=geoSemInterpret(r,GEO_SEMIOSIS.reader),ps=livePointScreen(r,S),depth=Math.min(LIVE_INDEX_DEPTH,Math.max(5,Math.max(0,depthForZoom()))),at=cellAt(r.v,depth),cov=geoSemCoverage(r),cc=cov&&cellFromSlug(cov);
  geoSemCellOutline(at,S,'AT '+cellSlug(at),false,.72);if(cc&&cellSlug(cc)!==cellSlug(at))geoSemCellOutline(cc,S,'APPLIES / SAMPLED '+cellSlug(cc),true,.46);geoSemPath(r,S);geoSemCompositions(r,S);
  ctx.save();ctx.strokeStyle=COL.signal;ctx.fillStyle='#f1eee4';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ps.x,ps.y,10,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(ps.x-14,ps.y);ctx.lineTo(ps.x+14,ps.y);ctx.moveTo(ps.x,ps.y-14);ctx.lineTo(ps.x,ps.y+14);ctx.stroke();ctx.font='700 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';var label=(g.status==='OBSERVATION_ONLY'?'OBSERVATION ONLY':g.operation+' · '+g.responsive_system),w=Math.min(310,Math.max(110,ctx.measureText(label).width+12)),x=Math.max(4,Math.min(W-w-4,ps.x+14)),y=Math.max(4,Math.min(H-34,ps.y+14));ctx.fillRect(x,y,w,28);ctx.strokeRect(x+.5,y+.5,w-1,27);ctx.fillStyle=COL.signal;ctx.textAlign='left';ctx.fillText(label,x+6,y+9);ctx.font='400 7px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';ctx.fillText('WHERE · '+cellSlug(at)+' · '+Number(r.lat).toFixed(4)+', '+Number(r.lon).toFixed(4),x+6,y+20);ctx.restore();
}
var geoSemDrawBase=geoInspectDraw;
geoInspectDraw=function(S){geoSemDrawBase(S);geoSemDrawSelected(S);};

function geoSemReaderButtons(){
  return '<div class="geo-sem-readers"><b>READ FOR</b>'+GEO_SEMIOSIS.readers.map(function(k){return '<button type="button" data-geo-reader="'+k+'" class="'+(GEO_SEMIOSIS.reader===k?'on':'')+'">'+geoSemReaderName(k)+'</button>';}).join('')+'</div>';
}
function geoSemRawProps(r){
  var p=r&&r.properties||{},h='<details class="geo-sem-raw"><summary>SOURCE RECORD · '+Object.keys(p).length+' FIELDS</summary>';
  Object.keys(p).slice(0,24).forEach(function(k){h+='<div class="row geo-prop"><b>'+geoInspectEsc(k.toUpperCase())+'</b><span>'+geoInspectEsc(geoInspectValue(p[k]))+'</span></div>';});
  return h+'</details>';
}
var geoSemSelectedHtmlBase=geoInspectSelectedHtml;
geoInspectSelectedHtml=function(r){
  if(!r)return '';
  var g=geoSemInterpret(r,GEO_SEMIOSIS.reader),src=LIVE.sources[r.source],address=g.emplacement.address||'—',coverage=g.emplacement.coverage_address||'NO EXPLICIT COVERAGE CELL';
  var h='<div class="geo-sem-law">DIFFERENCE × EMPLACEMENT × RESPONSIVE SYSTEM → CONSEQUENCE</div>'+geoSemReaderButtons()+
    '<div class="row on"><b>'+geoInspectEsc((g.status==='CANDIDATE_GEOSIGN'?'GEOSIGN · ':'OBSERVATION · ')+g.operation+' / '+geoSemSourceGlyph(r))+'</b><span>'+geoInspectEsc(g.status)+'</span></div>'+
    '<div class="row geo-prop"><b>DIFFERENCE</b><span>'+geoInspectEsc(g.difference)+'</span></div>'+
    '<div class="row geo-prop"><b>WHERE · AT</b><span>'+geoInspectEsc(address+' · '+Number(r.lat).toFixed(5)+', '+Number(r.lon).toFixed(5))+'</span></div>'+
    '<div class="row geo-prop"><b>WHERE · COVERAGE</b><span>'+geoInspectEsc(coverage)+'</span></div>'+
    '<div class="row geo-prop"><b>SPATIAL FORM</b><span>'+geoInspectEsc(g.emplacement.spatial_form)+'</span></div>'+
    '<div class="row geo-prop"><b>RELATION</b><span>'+geoInspectEsc(g.relation)+'</span></div>'+
    '<div class="row geo-prop"><b>FOR</b><span>'+geoInspectEsc(g.responsive_system)+'</span></div>'+
    '<div class="row geo-prop"><b>DOES</b><span>'+geoInspectEsc(g.operation+' · '+g.consequence)+'</span></div>'+
    '<div class="row geo-prop"><b>TIME MODE</b><span>'+geoInspectEsc(g.temporal_mode)+'</span></div>'+
    '<div class="row geo-prop"><b>EPISTEMIC</b><span>'+geoInspectEsc((r.epistemic||'RECORD')+' · GEONOTIC READING IS DERIVED')+'</span></div>'+
    '<div class="row geo-prop"><b>SOURCE</b><span>'+geoInspectEsc((src&&src.provider)||r.source)+'</span></div>'+
    '<div class="row geo-prop"><b>ADMISSION</b><span>'+geoInspectEsc(g.admission_rule)+'</span></div>';
  return h+geoSemRawProps(r);
};

function geoSemCompositionHtml(r){
  if(!r||typeof geonosisInfer!=='function')return '';
  var c=geoInspectDataCell(),inf=c&&geonosisInfer(c),ss=(inf&&inf.statements_of_importance||[]).filter(function(s){return (s.evidence||[]).indexOf(r.id)>=0;});
  if(!ss.length)return '<details><summary>COMPOSES WITH · 0</summary><p>No deterministic multi-record composition currently uses this evidence record.</p></details>';
  var h='<details open><summary>COMPOSES WITH · '+ss.length+'</summary><p>Non-linear spatial syntax: these rule-derived propositions join this record to other evidence. The lines on the map show those evidence relations.</p>';
  ss.slice(0,6).forEach(function(s){h+='<div class="topic"><b>'+geoInspectEsc(s.proposition)+'</b><em>'+geoInspectEsc(s.question)+'</em><i>'+geoInspectEsc((s.evidence||[]).length+' EVIDENCE RECORDS · '+s.rule.toUpperCase())+'</i></div>';});return h+'</details>';
}
var geoSemRenderPanelBase=geoInspectRenderPanel;
geoInspectRenderPanel=function(cell){
  geoSemRenderPanelBase(cell);
  var root=document.getElementById('geonosis-inspector');if(!root)return;
  var sel=GEO_INSPECT.selectedId&&LIVE.records[GEO_INSPECT.selectedId];
  if(sel)root.insertAdjacentHTML('beforeend',geoSemCompositionHtml(sel));
  root.querySelectorAll('[data-geo-reader]').forEach(function(btn){btn.onclick=function(e){e.preventDefault();e.stopPropagation();GEO_SEMIOSIS.reader=btn.getAttribute('data-geo-reader')||'primary';geoInspectRenderPanel(cell);geoSemUpdatePlate();wake();};});
};

function geoSemUpdatePlate(){
  var el=document.getElementById('geonosis-map-plate');if(!el)return;
  var c=geoInspectDataCell(),rows=c?liveForCell(c):[],st=geoInspectSourceStats(),active=0,obs=0;
  rows.forEach(function(r){if(geoSemInterpret(r,GEO_SEMIOSIS.reader).status==='CANDIDATE_GEOSIGN')active++;else obs++;});
  el.innerHTML='<b>GEONOSIS · '+active+' RELATION'+(active===1?'':'S')+' HERE</b><span>CELL '+(c?cellSlug(c):'—')+' · LENS '+geoSemReaderName(GEO_SEMIOSIS.reader)+'</span><span>'+st.loaded+'/'+st.total+' SOURCES LOADED'+(st.loading?' · '+st.loading+' LOADING':'')+(obs?' · '+obs+' OBSERVATION ONLY':'')+'</span><i>MARK = OPERATION / SOURCE · TAP TO READ WHERE + CONSEQUENCE</i>';
}
geoInspectUpdatePlate=geoSemUpdatePlate;

/* Upgrade panel language from DATA FIELD to the actual geonotic distinction. */
var geoSemRenderLiveWhereBase=renderLiveWhere;
renderLiveWhere=function(cell){geoSemRenderLiveWhereBase(cell);var d=document.getElementById('geonosis-inspector');if(d){var s=d.querySelector('summary');if(s&&/^DATA FIELD/.test(s.textContent)){var dc=geoInspectDataCell(),rows=dc?liveForCell(dc):[];s.textContent='GEONOSIS FIELD · '+rows.length+' RECORD'+(rows.length===1?'':'S')+' · '+(dc?cellSlug(dc):'NO CELL');}}geoSemUpdatePlate();};

/* Native styling: explicit labels, no mystery icons. */
(function(){
  var style=document.createElement('style');style.textContent='\n#panel .geo-sem-law{border:1px solid var(--ink);padding:7px 8px;margin:7px 0;font:700 9px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.06em;background:var(--ground)}\n#panel .geo-sem-readers{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:7px 0}#panel .geo-sem-readers>b{font-size:8px;letter-spacing:.08em;margin-right:3px}#panel .geo-sem-readers button{appearance:none;border:1px solid var(--ink);background:var(--ground);color:var(--ink);font:700 7px/1.1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:5px 6px;letter-spacing:.04em}#panel .geo-sem-readers button.on{background:var(--ink);color:var(--ground)}#panel .geo-sem-raw{margin-top:6px}\n';document.head.appendChild(style);
})();

/* Give the model the same distinction. This is explicitly derived, never a new source fact. */
if(typeof geoCtxSignal==='function'){
  var geoSemCtxSignalBase=geoCtxSignal;
  geoCtxSignal=function(r){var x=geoSemCtxSignalBase(r);x.geonosis_interpretation=geoSemCompact(r);return x;};
}
if(typeof LAW==='string'&&LAW.indexOf('geonosis_interpretation')<0){
  LAW+=' When a sign contains geonosis_interpretation, treat it as a DERIVED candidate reading of source evidence, not as an additional observation. Preserve its named responsive_system, emplacement and admission rule. OBSERVATION_ONLY means no consequential relation is licensed for that reader from the supplied record alone. Do not convert a candidate consequence into a factual outcome.';
}

window.ICOSA_LIVE.geosign=function(id,reader){var r=LIVE.records[id];return r?geoSemInterpret(r,reader||GEO_SEMIOSIS.reader):null;};
window.ICOSA_LIVE.setGeonosisReader=function(reader){if(GEO_SEMIOSIS.readers.indexOf(reader)<0)return false;GEO_SEMIOSIS.reader=reader;geoSemUpdatePlate();if(typeof whereCell!=='undefined'&&whereCell)geoInspectRenderPanel(whereCell);wake();return true;};
window.ICOSA_LIVE.geonosisReaders=GEO_SEMIOSIS.readers.slice();
window.ICOSA_LIVE.semiosisVersion=GEONOSIS_SEMIOSIS_VERSION;

setTimeout(function(){geoSemUpdatePlate();wake();},250);
