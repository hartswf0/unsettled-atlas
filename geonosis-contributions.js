/* GEONOSIS ORDINARY CONTRIBUTIONS
 * Geonosis must not wake up only for disasters. This module derives ordinary,
 * inspectable spatial relations from loaded evidence while preserving the line
 * between co-location, inference and causation.
 */

var GEONOSIS_CONTRIBUTION_VERSION='geonosis-contributions-v1';

function geoContribEsc(v){return typeof geoInspectEsc==='function'?geoInspectEsc(v):liveEsc(v);}
function geoContribKinds(cell){
  var rows=cell?liveForCell(cell):[],kinds=Object.create(null),sources=Object.create(null);
  rows.forEach(function(r){if(!r)return;kinds[r.kind]=(kinds[r.kind]||0)+1;sources[r.source]=(sources[r.source]||0)+1;});
  return {rows:rows,kinds:kinds,sources:sources};
}
function geoContribChild(cell,i){
  if(!cell||cell.depth>=LIVE_INDEX_DEPTH)return null;
  try{return makeCell(cell.f,cell.path.concat([i]));}catch(e){return null;}
}
function geoContribOperatorCounts(rows){
  var b=Object.create(null);rows.forEach(function(r){var x=String(r.properties&&r.properties.operator||'').trim();if(x)b[x]=(b[x]||0)+1;});
  return Object.keys(b).map(function(k){return {name:k,count:b[k]};}).sort(function(a,b){return b.count-a.count;});
}
function geoContribEvidence(rows,n){return (rows||[]).slice(0,n||24).map(function(r){return r.id;});}
function geoContribSources(rows){var out=[];(rows||[]).forEach(function(r){if(r&&r.source&&out.indexOf(r.source)<0)out.push(r.source);});return out;}
function geoContribItem(cell,spec){
  spec=spec||{};return {id:'contrib:'+geoInfStable([cellSlug(cell),spec.rule||spec.relation||'relation'].concat(spec.evidence||[])),kind:'geonosis_contribution',cell:cellSlug(cell),operation:spec.operation||'RELATE',relation:spec.relation||'spatial_relation',title:spec.title||'Spatial relation',proposition:spec.proposition||'',question:spec.question||'',evidence:spec.evidence||[],evidence_sources:spec.evidence_sources||[],focus_cell:spec.focus_cell||null,strength:spec.strength==null?1:spec.strength,caveat:spec.caveat||null,epistemic:'DERIVED',generated_by:'RULE',rule:spec.rule||spec.relation||'relation'};
}
function geoContribAsStatement(cell,c){
  if(typeof geoInfStatement!=='function')return null;
  var s=geoInfStatement(cell,'contribution-'+c.rule,c.proposition,c.question,c.evidence,{evidence_diversity:c.evidence_sources.length,consequence:c.strength,relation:c.relation},['relation','importance']);
  s.contribution_id=c.id;s.operation=c.operation;s.caveat=c.caveat;return s;
}
function geoContribNearestPairs(a,b,maxKm){
  var out=[];for(var i=0;i<a.length;i++){var best=null,bd=Infinity;for(var j=0;j<b.length;j++){var d=arcKm(a[i].v,b[j].v);if(d<bd){bd=d;best=b[j];}}if(best&&bd<=maxKm)out.push({a:a[i],b:best,km:bd});}return out;
}
function geoContribAddressOverlap(a,b,depth){
  var bins=Object.create(null),pairs=[];depth=Math.min(LIVE_INDEX_DEPTH,Math.max(0,depth||9));
  a.forEach(function(r){var s=cellSlug(cellAt(r.v,depth));(bins[s]||(bins[s]=[])).push(r);});
  b.forEach(function(r){var s=cellSlug(cellAt(r.v,depth)),aa=bins[s];if(aa&&aa.length)pairs.push({a:aa[0],b:r,slug:s});});return pairs;
}
function geoContribPathOverlap(points,areas){
  var out=[];points.forEach(function(p){for(var i=0;i<areas.length;i++){var path=areas[i].properties&&areas[i].properties.addressPath||[];for(var j=0;j<path.length;j++){var c=cellFromSlug(path[j]);if(c&&cellContains(c,p.v)){out.push({point:p,area:areas[i],slug:path[j]});i=areas.length;break;}}}});return out;
}

function geonosisContributions(cell){
  if(!cell)return {version:GEONOSIS_CONTRIBUTION_VERSION,cell:null,items:[],statements:[],ledger:{records:0,kinds:0,sources:0,candidate_geosigns:0}};
  var inv=geoContribKinds(cell),rows=inv.rows,items=[],statements=[];
  var dcs=liveForCell(cell,'datacenter'),hydro=liveForCell(cell,'hydro-flowline'),water=liveForCell(cell,'streamflow'),flood=liveForCell(cell,'flood-hazard'),bio=liveForCell(cell,'biodiversity'),civic=liveForCell(cell,'civic-report'),epa=liveForCell(cell,'regulated-facility'),terrain=liveForCell(cell,'terrain-state'),weather=liveForCell(cell,'weather-state'),alerts=liveForCell(cell,'weather-alert');

  /* COMPUTATION CONCENTRATION: count is not meaning until related to internal
   * distribution. Compare the four immediate child cells of the selected cell. */
  if(dcs.length>=3&&cell.depth<LIVE_INDEX_DEPTH){
    var cc=[],max=null;for(var ci=0;ci<4;ci++){var ch=geoContribChild(cell,ci),n=ch?liveForCell(ch,'datacenter').length:0,x={cell:ch,count:n};cc.push(x);if(!max||x.count>max.count)max=x;}
    var share=max&&dcs.length?max.count/dcs.length:0,ops=geoContribOperatorCounts(dcs),topOps=ops.slice(0,3).map(function(x){return x.name+' '+x.count;});
    if(max&&max.count>=2){
      var c=geoContribItem(cell,{rule:'datacenter-concentration',operation:'CLUSTER',relation:'computational_infrastructure_concentration',title:'Computational infrastructure concentration',proposition:dcs.length+' OSM data-center records lie in the selected triangle; '+max.count+' ('+Math.round(share*100)+'%) lie in child '+cellSlug(max.cell)+(topOps.length?'. Leading recorded operators in the selection include '+topOps.join(', ')+'.':'.'),question:'What power, fiber, water, land, labor and hazard relations sustain or constrain this computational concentration?',evidence:geoContribEvidence(dcs,32),evidence_sources:geoContribSources(dcs),focus_cell:cellSlug(max.cell),strength:Math.max(1,Math.min(4,share*4)),caveat:'This is concentration in the loaded OSM-derived snapshot. It does not establish capacity, ownership, demand, dependency or completeness.'});items.push(c);
    }
  }

  /* INFRASTRUCTURE x HYDROGRAPHY: proximity is a question-generator, never a
   * claim that data centers consume this water or depend on this flowline. */
  if(dcs.length&&hydro.length){
    var hp=geoContribNearestPairs(dcs,hydro,25);if(hp.length){var he=[];hp.slice(0,12).forEach(function(x){he.push(x.a.id,x.b.id);});var hc=geoContribItem(cell,{rule:'datacenter-hydro-proximity',operation:'CONNECT',relation:'infrastructure_hydrography_proximity',title:'Computation and hydrography share local ground',proposition:hp.length+' loaded data-center record'+(hp.length===1?' lies':'s lie')+' within 25 km of a loaded 3DHP flowline anchor in this selected ground.',question:'Are any water, cooling, drainage, flood, permitting or ecological relations actually present between these infrastructure and hydrologic systems?',evidence:he,evidence_sources:geoContribSources(hp.reduce(function(a,x){a.push(x.a,x.b);return a;},[])),strength:2,caveat:'Proximity is not dependency. 3DHP records are represented by anchors plus addressed paths; this rule only opens an investigation.'});items.push(hc);}
  }

  /* INFRASTRUCTURE x FLOOD GEOMETRY: only claim shared addressed geometry when
   * the NFHL polygon's sampled address path contains the infrastructure point. */
  if(dcs.length&&flood.length){
    var fp=geoContribPathOverlap(dcs,flood);if(fp.length){var fe=[];fp.slice(0,12).forEach(function(x){fe.push(x.point.id,x.area.id);});var fc=geoContribItem(cell,{rule:'datacenter-flood-address-overlap',operation:'EXPOSE',relation:'infrastructure_regulatory_flood_colocation',title:'Computational infrastructure meets mapped flood-hazard geometry',proposition:fp.length+' loaded data-center record'+(fp.length===1?' shares':'s share')+' addressed cells with loaded FEMA NFHL flood-hazard geometry in the current local sample.',question:'Which facilities, access routes, utilities and dependencies warrant closer flood-exposure inspection?',evidence:fe,evidence_sources:geoContribSources(fp.reduce(function(a,x){a.push(x.point,x.area);return a;},[])),strength:3,caveat:'Address-path overlap is a screening relation, not a parcel-level flood determination or claim of actual inundation.'});items.push(fc);}
  }

  /* ECOLOGY x HYDROGRAPHY: same addressed ground supports a corridor question,
   * but not a habitat or abundance claim. */
  if(bio.length&&hydro.length){
    var ep=geoContribAddressOverlap(bio,hydro,9);if(ep.length){var ee=[];ep.slice(0,12).forEach(function(x){ee.push(x.a.id,x.b.id);});var ec=geoContribItem(cell,{rule:'ecology-hydro-colocation',operation:'CONNECT',relation:'ecological_hydrologic_colocation',title:'Ecological observations meet hydrologic structure',proposition:ep.length+' biodiversity/hydrography pair'+(ep.length===1?' shares':'s share')+' depth-9 ICOSA ground in the loaded sample.',question:'Do these co-locations indicate corridor, edge, resource, disturbance or merely observation bias?',evidence:ee,evidence_sources:geoContribSources(ep.reduce(function(a,x){a.push(x.a,x.b);return a;},[])),strength:2,caveat:'Co-location does not establish habitat quality, abundance, current presence or ecological dependence.'});items.push(ec);}
  }

  /* TERRAIN x HYDROLOGY: compose sampled relief with mapped/current water
   * evidence without pretending the seven-point terrain sample is a DEM. */
  if(terrain.length&&(hydro.length||water.length)){
    var t=terrain[0],tp=t.properties||{},wr=hydro.concat(water),tc=geoContribItem(cell,{rule:'terrain-hydrology-composition',operation:'FLOW',relation:'terrain_hydrology_composition',title:'Terrain and water compose a flow field',proposition:'The local attention sample combines '+(tp.reliefM==null?'terrain elevation samples':Math.round(tp.reliefM)+' m sampled relief')+' with '+hydro.length+' mapped flowline'+(hydro.length===1?'':'s')+' and '+water.length+' current streamflow observation'+(water.length===1?'':'s')+'.',question:'What routing, drainage, crossing, erosion or flood propositions become testable when denser elevation and hydrologic topology are joined?',evidence:[t.id].concat(geoContribEvidence(wr,20)),evidence_sources:geoContribSources([t].concat(wr)),strength:2,caveat:'The terrain adapter samples a small set of 3DEP elevations; it does not reconstruct a continuous slope or runoff field.'});items.push(tc);
  }

  /* CIVIC x INSTITUTIONAL/HAZARD records: expose co-presence without turning a
   * complaint into proof of an EPA or flood cause. */
  if(civic.length&&(epa.length||flood.length)){
    var other=epa.concat(flood),cp=geoContribAddressOverlap(civic,other,10);if(cp.length){var ce=[];cp.slice(0,12).forEach(function(x){ce.push(x.a.id,x.b.id);});var cciv=geoContribItem(cell,{rule:'civic-institutional-colocation',operation:'EXPOSE',relation:'reported_experience_institutional_colocation',title:'Reported experience and institutional geography coincide',proposition:cp.length+' civic/institutional evidence pair'+(cp.length===1?' shares':'s share')+' depth-10 addressed ground in the loaded sample.',question:'Is there a service, enforcement, hazard, reporting or entirely unrelated process connecting these records?',evidence:ce,evidence_sources:geoContribSources(cp.reduce(function(a,x){a.push(x.a,x.b);return a;},[])),strength:2,caveat:'A shared address cell is not evidence that the regulated facility or hazard caused the complaint.'});items.push(cciv);}
  }

  /* WEATHER x situated infrastructure: the weather field can alter attention
   * around infrastructure without asserting damage. */
  if((alerts.length||weather.length)&&dcs.length){
    var localWx=alerts.concat(weather),near=geoContribNearestPairs(dcs,localWx,80);if(near.length){var we=[];near.slice(0,12).forEach(function(x){we.push(x.a.id,x.b.id);});var wc=geoContribItem(cell,{rule:'infrastructure-weather-colocation',operation:alerts.length?'WARN':'ORIENT',relation:'infrastructure_atmospheric_colocation',title:'Atmospheric state meets computational infrastructure',proposition:near.length+' loaded data-center record'+(near.length===1?' lies':'s lie')+' within 80 km of a loaded weather observation, forecast or alert anchor in the current attention sample.',question:'Does the atmospheric condition materially change cooling, power, access, flood, fire or continuity risk for any specific facility?',evidence:we,evidence_sources:geoContribSources(near.reduce(function(a,x){a.push(x.a,x.b);return a;},[])),strength:alerts.length?3:1,caveat:'Weather proximity changes what should be checked; it is not evidence of facility impact.'});items.push(wc);}
  }

  /* SEMIOTIC AGGREGATE: make the composition itself visible. This is the
   * ordinary Geonosis contribution even when no crisis rule fires. */
  var kindNames=Object.keys(inv.kinds),sourceNames=Object.keys(inv.sources);
  if(kindNames.length>=3){
    var ac=geoContribItem(cell,{rule:'semiotic-aggregate',operation:'COMPOSE',relation:'multi_source_spatial_aggregate',title:'Multiple sign families occupy the same selected ground',proposition:kindNames.length+' evidence kinds from '+sourceNames.length+' source families currently compose this selected triangle: '+kindNames.slice(0,10).join(', ')+(kindNames.length>10?' …':'' )+'.',question:'Which of these co-present differences enter consequential relations, and which should remain unrelated observations?',evidence:geoContribEvidence(rows,32),evidence_sources:sourceNames,strength:Math.min(4,sourceNames.length/2),caveat:'Co-presence is only the beginning of semiosis. The system must still specify relation, responsive system, scale and consequence.'});items.push(ac);
  }

  items.sort(function(a,b){return b.strength-a.strength||b.evidence_sources.length-a.evidence_sources.length;});
  items.forEach(function(c){var s=geoContribAsStatement(cell,c);if(s&&c.strength>=2)statements.push(s);});
  var candidate=0;if(typeof geoSemInterpret==='function')rows.forEach(function(r){if(geoSemInterpret(r,'primary').status==='CANDIDATE_GEOSIGN')candidate++;});
  return {version:GEONOSIS_CONTRIBUTION_VERSION,cell:cellSlug(cell),items:items,statements:statements,ledger:{records:rows.length,kinds:kindNames.length,sources:sourceNames.length,candidate_geosigns:candidate,contributions:items.length,statements:statements.length}};
}

/* Existing Statements-of-Importance and the LLM now receive ordinary spatial
 * contributions too, with their rule/caveat/evidence attached. */
var geoContribInferBase=geonosisInfer;
geonosisInfer=function(cell){
  var base=geoContribInferBase(cell),pack=geonosisContributions(cell),seen=Object.create(null);
  (base.statements_of_importance||[]).forEach(function(s){seen[s.id]=1;});
  pack.statements.forEach(function(s){if(!seen[s.id]){base.statements_of_importance.push(s);seen[s.id]=1;}});
  base.contributions=pack.items;base.contribution_ledger=pack.ledger;return base;
};
if(typeof geoCtxBuild==='function'){
  var geoContribCtxBase=geoCtxBuild;
  geoCtxBuild=function(cell){var x=geoContribCtxBase(cell),p=geonosisContributions(cell);x.contributions=p.items.slice(0,8);x.contribution_ledger=p.ledger;return x;};
}
if(typeof LAW==='string'&&LAW.indexOf('context.live.geonosis.contributions')<0){
  LAW+=' context.live.geonosis.contributions are deterministic spatial relation candidates. Preserve each contribution caveat. Co-location, proximity and shared ICOSA cells do not establish causation, ownership, exposure or dependency unless separate evidence explicitly supplies that relation.';
}

function geoContribPanel(cell){
  var root=document.getElementById('panel');if(!root||!root.classList.contains('open')||!cell)return;
  var old=document.getElementById('geonosis-contributions');if(old&&old.parentNode)old.parentNode.removeChild(old);
  var p=geonosisContributions(cell),l=p.ledger,h='<details id="geonosis-contributions" open><summary>GEONOSIS CONTRIBUTIONS · '+p.items.length+'</summary>'+
    '<div class="geo-contrib-ledger"><div><b>'+l.records+'</b><span>EVIDENCE RECORDS</span></div><div><b>'+l.candidate_geosigns+'</b><span>CANDIDATE GEOSIGNS</span></div><div><b>'+l.contributions+'</b><span>RELATIONS</span></div><div><b>'+l.statements+'</b><span>COUNCIL CANDIDATES</span></div></div>'+
    '<p>Geonosis contributes when evidence enters a consequential spatial relation. Ordinary concentration, flow, co-location and composition count; crisis is not required.</p>';
  if(!p.items.length)h+='<div class="topic"><b>NO CONTRIBUTION YET</b><em>The loaded records do not yet satisfy an ordinary relation rule at this selected scale.</em><i>ZOOM / MOVE ATTENTION / LOAD MORE SOURCE FAMILIES</i></div>';
  p.items.slice(0,10).forEach(function(c){h+='<div class="topic geo-contrib"><b>'+geoContribEsc(c.operation+' · '+c.title)+'</b><em>'+geoContribEsc(c.proposition)+'</em><strong>'+geoContribEsc(c.question)+'</strong><i>'+geoContribEsc(c.relation.toUpperCase()+' · '+c.evidence_sources.length+' SOURCES · '+c.evidence.length+' EVIDENCE IDS'+(c.focus_cell?' · FOCUS '+c.focus_cell:''))+'</i>'+(c.caveat?'<small>'+geoContribEsc(c.caveat)+'</small>':'')+'</div>';});
  h+='<p style="font-size:8px;letter-spacing:.08em">RULE DERIVED · EVIDENCE PRESERVED · PROXIMITY ≠ CAUSATION · CO-PRESENCE ≠ DEPENDENCY.</p></details>';root.insertAdjacentHTML('beforeend',h);
}
var geoContribRenderWhereBase=renderLiveWhere;
renderLiveWhere=function(cell){geoContribRenderWhereBase(cell);geoContribPanel(cell);geoContribUpdatePlate();};

function geoContribUpdatePlate(){
  var el=document.getElementById('geonosis-map-plate'),c=typeof geoScopeSelectedCell==='function'?geoScopeSelectedCell():(typeof whereCell!=='undefined'&&whereCell?whereCell:focusCell());if(!el||!c)return;
  var p=geonosisContributions(c),line=document.getElementById('geo-contrib-map-line');
  if(!line){line=document.createElement('span');line.id='geo-contrib-map-line';el.appendChild(line);}line.textContent='CONTRIBUTIONS · '+p.ledger.contributions+' RELATIONS · '+p.ledger.statements+' COUNCIL CANDIDATES';
}
var geoContribPlateBase=geoInspectUpdatePlate;
geoInspectUpdatePlate=function(){geoContribPlateBase();geoContribUpdatePlate();};

(function(){var style=document.createElement('style');style.textContent='\n#panel .geo-contrib-ledger{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid var(--ink);margin:6px 0}#panel .geo-contrib-ledger div{padding:6px;border-right:1px solid var(--ink)}#panel .geo-contrib-ledger div:last-child{border-right:0}#panel .geo-contrib-ledger b,#panel .geo-contrib-ledger span{display:block}#panel .geo-contrib-ledger b{font-size:14px}#panel .geo-contrib-ledger span{font-size:6px;letter-spacing:.08em}#panel .geo-contrib strong,#panel .geo-contrib small{display:block;font-size:8px;line-height:1.35;margin-top:4px}#panel .geo-contrib strong{font-weight:700}#panel .geo-contrib small{color:var(--muted)}@media(max-width:520px){#panel .geo-contrib-ledger{grid-template-columns:repeat(2,minmax(0,1fr))}#panel .geo-contrib-ledger div:nth-child(2){border-right:0}}\n';document.head.appendChild(style);})();

window.ICOSA_LIVE.contributions=function(slug){var c=typeof slug==='string'?cellFromSlug(slug):(slug||((typeof geoScopeSelectedCell==='function')&&geoScopeSelectedCell()));return c?geonosisContributions(c):null;};
window.ICOSA_LIVE.contributionVersion=GEONOSIS_CONTRIBUTION_VERSION;
