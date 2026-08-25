/* GEONOSIS DIFFERENCE + STATEMENT ENGINE
 * No model decides what is important here. Rules collide source-stamped signs
 * and emit candidate Statements of Importance with the evidence IDs attached.
 * The LLM may phrase/argue them later, but it may not manufacture their basis.
 */

var GEONOSIS_INFERENCE_VERSION='geonosis-inference-v1';

function geoInfRows(cell,id,kind){
  if(typeof GEO_SOURCE_IDS!=='undefined'&&GEO_SOURCE_IDS&&Object.keys(GEO_SOURCE_IDS).some(function(k){return GEO_SOURCE_IDS[k]===id;})){
    return typeof geoSourceRows==='function'?geoSourceRows(id,cell):[];
  }
  return liveForCell(cell,kind);
}
function geoInfStable(parts){
  var s=parts.join('|'),h=2166136261;
  for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(36);
}
function geoInfStatement(cell,rule,proposition,question,evidence,metrics,signTypes){
  evidence=(evidence||[]).filter(Boolean);
  var sources=[];evidence.forEach(function(id){var r=LIVE.records[id];if(r&&r.source&&sources.indexOf(r.source)<0)sources.push(r.source);});
  return {id:'soi:'+geoInfStable([cellSlug(cell),rule].concat(evidence)),kind:'statement_of_importance',cell:cellSlug(cell),rule:rule,proposition:proposition,question:question,generated_by:'RULE',epistemic:'DERIVED',evidence:evidence,evidence_sources:sources,sign_types:signTypes||['importance'],metrics:metrics||{},created_at:Date.now()};
}
function geoInfDifference(type,evidence,note){return {type:type,evidence:(evidence||[]).filter(Boolean),note:note||null};}
function geoInfTop311(rows){
  var bins=Object.create(null);rows.forEach(function(r){var k=liveText(r.properties&&r.properties.complaintType)||'Unclassified';bins[k]=(bins[k]||0)+1;});
  return Object.keys(bins).map(function(k){return {name:k,count:bins[k]};}).sort(function(a,b){return b.count-a.count;})[0]||null;
}
function geoInfCurrentEcho(rows){return rows.filter(function(r){var p=r.properties||{};return p.currentSignificantNonCompliance==='Y'||(p.quartersNonCompliance||0)>0||(p.programsSignificantNonCompliance||0)>0;});}
function geoInfWeatherHazard(rows){return rows.filter(function(r){return /flood|rain|storm|hurricane|tropical|surge/i.test(String(r.properties&&r.properties.event||''));});}

function geonosisInfer(cell){
  var statements=[],differences=[];

  /* institutional non-compliance: a direct ECHO administrative signal */
  if(GEO_SOURCE_IDS.echo){
    var echo=geoInfCurrentEcho(geoInfRows(cell,GEO_SOURCE_IDS.echo,'regulated-facility'));
    echo.slice(0,4).forEach(function(r){
      var p=r.properties||{},name=p.name||p.registryId||'An EPA-regulated facility';
      var condition=p.currentSignificantNonCompliance==='Y'?'is currently flagged in significant non-compliance':((p.quartersNonCompliance||0)+' quarters are recorded in non-compliance');
      differences.push(geoInfDifference('institutional_noncompliance',[r.id],name+' · '+condition));
      statements.push(geoInfStatement(cell,'echo-noncompliance',name+' '+condition+' in EPA ECHO.','What conditions, exposures, enforcement actions, or community concerns should be examined around this regulated facility?',[r.id],{contestation:1,evidence_diversity:1,change:null,exposure:null,consequence:null},['institution','contestation','importance']));
    });
  }

  /* civic concentration: counts remain "at least" because the source may cap */
  if(GEO_SOURCE_IDS.nyc311){
    var c311=geoInfRows(cell,GEO_SOURCE_IDS.nyc311,'civic-report'),top=geoInfTop311(c311);
    if(top&&top.count>=3){
      var ev=c311.filter(function(r){return (r.properties&&r.properties.complaintType||'Unclassified')===top.name;}).slice(0,12).map(function(r){return r.id;});
      differences.push(geoInfDifference('civic_concentration',ev,top.count+' recent '+top.name+' requests'));
      statements.push(geoInfStatement(cell,'311-concentration','At least '+top.count+' geocoded NYC 311 requests classified as “'+top.name+'” occurred in this triangle in the current seven-day query window.','Is this concentration a transient cluster, a repeated service failure, or an artifact of reporting behavior?',[].concat(ev),{experienced_signal:top.count,evidence_diversity:1,contestation:null,change:null,consequence:null},['affection','discourse','institution','importance']));
    }
  }

  /* regulatory flood ground + sampled active hydro-meteorological warning */
  if(GEO_SOURCE_IDS.nfhl&&GEO_SOURCE_IDS.nws){
    var flood=geoInfRows(cell,GEO_SOURCE_IDS.nfhl,'flood-hazard'),wx=geoInfWeatherHazard(geoInfRows(cell,GEO_SOURCE_IDS.nws,'weather-alert'));
    if(flood.length&&wx.length){
      var fev=flood.slice(0,6).map(function(r){return r.id;}),wev=wx.slice(0,4).map(function(r){return r.id;});
      differences.push(geoInfDifference('compound_hazard_signal',fev.concat(wev),'mapped FEMA flood-hazard ground + sampled active NWS hydro-meteorological alert'));
      statements.push(geoInfStatement(cell,'flood-weather-compound','FEMA-mapped Flood Hazard Zone geometry intersects this triangle while the NWS sampled alert query returns an active '+(wx[0].properties.event||'hydro-meteorological')+' alert.','Which people, structures, routes, utilities, or habitats on this ground are exposed if the present weather condition reaches the mapped flood-hazard area?',fev.concat(wev),{evidence_diversity:2,exposure:null,consequence:1,contestation:null,change:1},['constraint','event','potential','importance']));
    }
  }

  /* preliminary current air-quality signal */
  if(GEO_SOURCE_IDS.airnow){
    var air=geoInfRows(cell,GEO_SOURCE_IDS.airnow,'air-quality').filter(function(r){return Number(r.properties&&r.properties.aqi)>=101;}).sort(function(a,b){return (b.properties.aqi||0)-(a.properties.aqi||0);});
    if(air.length){
      var a=air[0],ap=a.properties||{};
      differences.push(geoInfDifference('elevated_air_quality_index',[a.id],'AirNow AQI '+ap.aqi+' '+(ap.parameter||'')));
      statements.push(geoInfStatement(cell,'airnow-aqi','AirNow currently reports AQI '+ap.aqi+(ap.parameter?' for '+ap.parameter:'')+(ap.reportingArea?' in the '+ap.reportingArea+' reporting area':'')+' near this triangle; the observation is preliminary.','Which populations, outdoor activities, or institutions here are most sensitive to the current air-quality condition?',[a.id],{exposure:1,change:null,consequence:1,evidence_diversity:1,contestation:null},['perception','affection','potential','importance']));
    }
  }

  /* globally indexed seismic event */
  var quakes=liveForCell(cell,'earthquake').filter(function(r){return Number(r.properties&&r.properties.magnitude)>=4.5;}).sort(function(a,b){return (b.properties.magnitude||0)-(a.properties.magnitude||0);});
  if(quakes.length){
    var q=quakes[0],qp=q.properties||{};
    differences.push(geoInfDifference('significant_recent_seismic_event',[q.id],'M'+Number(qp.magnitude).toFixed(1)+' recent earthquake'));
    statements.push(geoInfStatement(cell,'seismic-event','USGS reports a M'+Number(qp.magnitude).toFixed(1)+' earthquake in this triangle during the current 24-hour M2.5+ snapshot'+(qp.place?' near '+qp.place:'')+'.','What structures, infrastructure dependencies, or populations on this ground make this seismic event consequential?',[q.id],{consequence:1,change:1,evidence_diversity:1,exposure:null,contestation:null},['event','material','potential','importance']));
  }

  /* active thermal detection with materially high FRP; still a detection, not a fire perimeter */
  var firms=typeof FIRMS_SOURCE!=='undefined'?LIVE.sources[FIRMS_SOURCE]:null;
  var fireCoverage=firms&&firms.meta&&firms.meta.coverageCell===cellSlug(cell);
  if(fireCoverage){
    var fires=liveForCell(cell,'fire').filter(function(r){return Number(r.properties&&r.properties.frp)>=50;}).sort(function(a,b){return (b.properties.frp||0)-(a.properties.frp||0);});
    if(fires.length){
      var f=fires[0],fp=f.properties||{};
      differences.push(geoInfDifference('high_frp_detection',[f.id],'FIRMS FRP '+Number(fp.frp).toFixed(1)));
      statements.push(geoInfStatement(cell,'high-frp-fire','NASA FIRMS reports an active thermal detection with FRP '+Number(fp.frp).toFixed(1)+' inside this triangle in the current one-day query.','What fuel, weather, terrain, structures, evacuation routes, or ecological assets should be connected to this active thermal signal?',[f.id],{consequence:1,change:1,evidence_diversity:1,exposure:null,contestation:null},['event','potential','importance']));
    }
  }

  return {version:GEONOSIS_INFERENCE_VERSION,cell:cellSlug(cell),differences:differences,statements_of_importance:statements};
}

function renderGeonosisStatements(cell){
  var root=document.getElementById('panel');if(!root||!root.classList.contains('open')||!cell)return;
  if(typeof live2RemovePanel==='function')live2RemovePanel('geonosis-statements');
  var inf=geonosisInfer(cell),ss=inf.statements_of_importance;if(!ss.length)return;
  var h='<details id="geonosis-statements" open><summary>STATEMENTS OF IMPORTANCE · '+ss.length+'</summary><p>Rule-derived candidates. Evidence IDs travel with every proposition; the model does not decide what exists.</p>';
  ss.slice(0,8).forEach(function(s){h+='<div class="topic"><b>'+liveEsc(s.proposition)+'</b><em>'+liveEsc(s.question)+'</em><i>'+liveEsc(s.rule.toUpperCase())+' · '+s.evidence.length+' EVIDENCE RECORD'+(s.evidence.length===1?'':'S')+'</i></div>';});
  h+='<p style="font-size:8px;letter-spacing:.08em">DERIVED · RULE GENERATED · SOURCE EVIDENCE PRESERVED.</p></details>';root.insertAdjacentHTML('beforeend',h);
}
var renderLiveWhereInferenceBase=renderLiveWhere;
renderLiveWhere=function(cell){renderLiveWhereInferenceBase(cell);renderGeonosisStatements(cell);};

window.ICOSA_LIVE.inferGeonosis=function(slug){var c=typeof slug==='string'?cellFromSlug(slug):slug;return c?geonosisInfer(c):null;};
window.ICOSA_LIVE.inferenceVersion=GEONOSIS_INFERENCE_VERSION;
