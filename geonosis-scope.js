/* GEONOSIS SCOPE COHERENCE
 * The selected ICOSA triangle is the user's HERE.
 * Attention-scoped providers may query a smaller descendant, but that sample
 * must never silently replace the selected geography or be reset to IDLE by it.
 */

var GEONOSIS_SCOPE_VERSION='geonosis-scope-v1';
var GEO_SCOPE={maxDisplayRecords:900};

function geoScopeSelectedCell(){
  if(typeof whereCell!=='undefined'&&whereCell)return whereCell;
  return typeof focusCell==='function'?focusCell():null;
}
function geoScopeAnchor(cell){
  if(!cell)return null;
  try{if(view&&view.centre&&cellContains(cell,view.centre))return view.centre;}catch(e){}
  return cellCentre(cell);
}
function geoScopeCellFor(cell,maxKm){
  if(!cell)return null;
  var limit=Math.max(1,Number(maxKm)||250),anchor=geoScopeAnchor(cell),c=cell;
  while(c&&c.depth<LIVE_INDEX_DEPTH&&cellEdgeKm(c)>limit)c=cellAt(anchor,c.depth+1);
  return c;
}
function geoScopeTargetState(id){
  var s=LIVE.sources[id],t=typeof GEO_TARGETS!=='undefined'&&GEO_TARGETS[id],m=s&&s.meta||{};
  var state=s?liveSourceFreshness(s):'UNAVAILABLE';
  if(s&&s.state==='unconfigured')state='UNCONFIGURED';
  if(t&&m.coverageCell&&m.coverageCell!==t.slug)state='OTHER SAMPLE';
  return state;
}
function geoScopeRequestSource(id,selected){
  if(typeof GEO_DEFS==='undefined'||typeof GEO_TARGETS==='undefined')return;
  var d=GEO_DEFS[id],s=LIVE.sources[id];if(!d)return;
  var c=geoScopeCellFor(selected,d.maxKm);if(!c)return;
  if(typeof GEO_SOURCE_IDS!=='undefined'&&id===GEO_SOURCE_IDS.nyc311&&typeof geoIntersectsNyc==='function'&&!geoIntersectsNyc(c)){
    GEO_TARGETS[id]={cell:c,slug:cellSlug(c),mode:'outside_jurisdiction',requestedAt:Date.now()};
    if(s&&typeof geoStopSource==='function')geoStopSource(id,'out_of_scope','attention sample is outside NYC 311 jurisdiction');
    return;
  }
  var slug=cellSlug(c),old=GEO_TARGETS[id],changed=!old||old.slug!==slug;
  GEO_TARGETS[id]={cell:c,slug:slug,mode:'attention_descendant',selectedCell:cellSlug(selected),requestedAt:Date.now()};
  if(s&&(changed||!s.lastUpdate||s.state==='idle'||s.state==='error'||s.state==='out_of_scope'))pollLiveSource(id);
}
function geoScopeRequestAll(selected){
  selected=selected||geoScopeSelectedCell();if(!selected)return;
  if(typeof GEO_DEFS!=='undefined')Object.keys(GEO_DEFS).forEach(function(id){geoScopeRequestSource(id,selected);});
  if(typeof live2RequestFirms==='function'&&typeof FIRMS_MAX_KM!=='undefined'){
    try{live2RequestFirms(geoScopeCellFor(selected,FIRMS_MAX_KM));}catch(e){}
  }
  if(typeof requestAircraft==='function'&&typeof AIR_MAX_CELL_KM!=='undefined'){
    try{requestAircraft(geoScopeCellFor(selected,AIR_MAX_CELL_KM));}catch(e){}
  }
  geoScopeUpdatePlate();
}

/* Replace the wrapper chain that used to feed the large selected cell directly
 * into every source-specific maxKm guard and thereby reset providers to IDLE. */
if(typeof geoRequestAll==='function')geoRequestAll=geoScopeRequestAll;

/* Inspector display scope = selected triangle. Provider query scope = legal
 * descendant. The two are intentionally distinct and visibly labelled. */
geoInspectDataCell=function(){return geoScopeSelectedCell()||focusCell();};
geoInspectCellFor=function(maxKm){return geoScopeCellFor(geoScopeSelectedCell()||focusCell(),maxKm);};
geoInspectRequestAttention=function(){geoScopeRequestAll(geoScopeSelectedCell()||focusCell());};

function geoScopeFairRows(rows){
  rows=(rows||[]).slice();
  rows.sort(function(a,b){var au=geoInspectUrgent(a)?1:0,bu=geoInspectUrgent(b)?1:0;return bu-au||((b.observedAt||b.retrievedAt||0)-(a.observedAt||a.retrievedAt||0));});
  if(rows.length<=GEO_SCOPE.maxDisplayRecords)return rows;
  var by=Object.create(null),ids=[];rows.forEach(function(r){var k=r.source||r.kind||'other';if(!by[k]){by[k]=[];ids.push(k);}by[k].push(r);});
  var out=[],i=0;while(out.length<GEO_SCOPE.maxDisplayRecords){var moved=false;for(var j=0;j<ids.length&&out.length<GEO_SCOPE.maxDisplayRecords;j++){var a=by[ids[j]];if(i<a.length){out.push(a[i]);moved=true;}}if(!moved)break;i++;}
  return out;
}
geoInspectLocalRecords=function(){
  var c=geoScopeSelectedCell()||focusCell();if(!c)return [];
  var rows=geoScopeFairRows(liveForCell(c));
  if(GEO_INSPECT.selectedId&&LIVE.records[GEO_INSPECT.selectedId]&&rows.indexOf(LIVE.records[GEO_INSPECT.selectedId])<0)rows.unshift(LIVE.records[GEO_INSPECT.selectedId]);
  return rows;
};

function geoScopeRequestKey(selected){
  if(!selected)return '';
  var parts=['selected:'+cellSlug(selected)];
  if(typeof GEO_DEFS!=='undefined')Object.keys(GEO_DEFS).sort().forEach(function(id){var c=geoScopeCellFor(selected,GEO_DEFS[id].maxKm);parts.push(id+':' +(c?cellSlug(c):'-'));});
  if(typeof FIRMS_MAX_KM!=='undefined'){var f=geoScopeCellFor(selected,FIRMS_MAX_KM);parts.push('firms:'+(f?cellSlug(f):'-'));}
  if(typeof AIR_MAX_CELL_KM!=='undefined'){var a=geoScopeCellFor(selected,AIR_MAX_CELL_KM);parts.push('air:'+(a?cellSlug(a):'-'));}
  return parts.join('|');
}
geoInspectTick=function(){
  if(!GEO_INSPECT.active)return;
  var selected=geoScopeSelectedCell()||focusCell();if(!selected)return;
  var slug=cellSlug(selected);if(slug!==GEO_INSPECT.focusSlug){GEO_INSPECT.focusSlug=slug;GEO_INSPECT.focusSince=Date.now();GEO_INSPECT.requestedKey=null;geoScopeUpdatePlate();return;}
  if(Date.now()-GEO_INSPECT.focusSince<300)return;
  var key=geoScopeRequestKey(selected);if(!key||key===GEO_INSPECT.requestedKey)return;
  GEO_INSPECT.requestedKey=key;geoScopeRequestAll(selected);
};

function geoScopeSampleSummary(selected){
  var slugs=Object.create(null),records=0,loaded=0;
  if(typeof GEO_TARGETS!=='undefined')Object.keys(GEO_TARGETS).forEach(function(id){var t=GEO_TARGETS[id],s=LIVE.sources[id],m=s&&s.meta||{};if(!t||!t.slug)return;slugs[t.slug]=1;if(s&&s.lastUpdate&&m.coverageCell===t.slug){loaded++;records+=s.count||0;}});
  var keys=Object.keys(slugs);return {slugs:keys,records:records,loaded:loaded,primary:keys[0]||null};
}
function geoScopeUpdatePlate(){
  var el=document.getElementById('geonosis-map-plate');if(!el)return;
  var c=geoScopeSelectedCell()||focusCell(),rows=c?liveForCell(c):[],sample=geoScopeSampleSummary(c),st=geoInspectSourceStats(),relations=0,obs=0;
  if(typeof geoSemInterpret==='function')rows.forEach(function(r){if(geoSemInterpret(r,typeof GEO_SEMIOSIS!=='undefined'?GEO_SEMIOSIS.reader:'primary').status==='CANDIDATE_GEOSIGN')relations++;else obs++;});
  else relations=rows.length;
  var lens=typeof GEO_SEMIOSIS!=='undefined'?geoSemReaderName(GEO_SEMIOSIS.reader):'PRIMARY';
  el.innerHTML='<b>GEONOSIS · '+relations+' RELATIONS · '+rows.length+' RECORDS</b>'+
    '<span>SELECTED · '+(c?cellSlug(c):'—')+' · '+(c?Math.round(cellEdgeKm(c))+' km':'')+'</span>'+
    '<span>ATTENTION · '+(sample.primary||'awaiting sample')+(sample.slugs.length>1?' · '+sample.slugs.length+' QUERY CELLS':'')+' · '+sample.records+' RECORDS</span>'+
    '<span>'+st.loaded+'/'+st.total+' SOURCES LOADED'+(st.loading?' · '+st.loading+' LOADING':'')+(obs?' · '+obs+' OBSERVATION ONLY':'')+'</span>'+
    '<i>LENS '+lens+' · TAP OPERATION/SOURCE MARK TO INSPECT</i>';
}
geoInspectUpdatePlate=geoScopeUpdatePlate;

/* Replace the misleading "0 addressed signs" panel with provider records at
 * their actual attention sample. A provider zero is always tied to that sample. */
if(typeof geoRenderPanel==='function')geoRenderPanel=function(cell){
  var root=document.getElementById('panel');if(!root||!root.classList.contains('open')||!cell)return;
  if(typeof live2RemovePanel==='function')live2RemovePanel('geonosis-signals');
  var total=0,body='';
  Object.keys(GEO_DEFS||{}).forEach(function(id){
    var d=GEO_DEFS[id],s=LIVE.sources[id],t=GEO_TARGETS[id],m=s&&s.meta||{},rows=[];
    if(t&&s&&s.lastUpdate&&m.coverageCell===t.slug)rows=liveForCell(t.cell,d.kind);
    var state=geoScopeTargetState(id);total+=rows.length;
    body+='<div class="row"><b>'+geoInspectEsc(d.label)+'</b><span>'+geoInspectEsc(state)+' · '+rows.length+' record'+(rows.length===1?'':'s')+(t?' · '+t.slug:'')+'</span></div>';
    for(var i=0;i<Math.min(3,rows.length);i++)body+='<div class="row geo-scope-record" data-geo-id="'+geoInspectEsc(rows[i].id)+'"><b style="font-weight:400">'+geoInspectEsc(geoRecordLabel(rows[i]))+'</b><span>'+geoInspectEsc(rows[i].epistemic||'RECORD')+'</span></div>';
  });
  root.insertAdjacentHTML('beforeend','<details id="geonosis-signals"'+(total?' open':'')+'><summary>ATTENTION SOURCES · '+total+' RECORDS</summary><p><b>Selected ground and provider sample are different scales.</b> Each row names the exact descendant query cell. Source records become geosigns only after a consequential relation is stated.</p>'+body+'<p style="font-size:8px;letter-spacing:.08em">NO HIDDEN HERE · QUERY CELL · COVERAGE · EPISTEMIC CLASS · ZERO SEMANTICS PRESERVED.</p></details>');
};

function geoScopeWireInfrastructure(cell){
  var box=document.getElementById('live-infra-record');if(!box||!cell)return;
  var dcs=liveForCell(cell,'datacenter').slice().sort(function(a,b){return String(a.properties&&a.properties.name||'').localeCompare(String(b.properties&&b.properties.name||''));});
  var els=box.querySelectorAll('.row');for(var i=0;i<Math.min(els.length,dcs.length);i++)(function(el,r){el.classList.add('geo-scope-clickable');el.title='Select this data center on the map';el.onclick=function(e){e.preventDefault();e.stopPropagation();geoInspectOpenRows([r]);};})(els[i],dcs[i]);
}
var geoScopeRenderPanelBase=geoInspectRenderPanel;
geoInspectRenderPanel=function(cell){
  geoScopeRenderPanelBase(cell);
  var selected=cell||geoScopeSelectedCell(),d=document.getElementById('geonosis-inspector');if(d&&selected){
    var s=d.querySelector('summary'),rows=liveForCell(selected),sample=geoScopeSampleSummary(selected);if(s)s.textContent='GEONOSIS FIELD · '+rows.length+' RECORDS · SELECTED '+cellSlug(selected);
    if(!d.querySelector('.geo-scope-ledger')){
      var h='<div class="geo-scope-ledger"><div class="row"><b>SELECTED TRIANGLE</b><span>'+geoInspectEsc(cellSlug(selected)+' · '+Math.round(cellEdgeKm(selected))+' km')+'</span></div><div class="row"><b>ATTENTION SAMPLE</b><span>'+geoInspectEsc(sample.slugs.length?sample.slugs.join(' · '):'awaiting provider queries')+'</span></div><p>Global records are shown across the selected triangle. Expensive providers are sampled in legal descendant cells and their footprints remain visible as dashed triangles.</p></div>';
      s.insertAdjacentHTML('afterend',h);
    }
  }
  geoScopeWireInfrastructure(selected);geoScopeUpdatePlate();
};

(function(){var style=document.createElement('style');style.textContent='\n#panel .geo-scope-ledger{border:1px solid var(--ink);padding:5px 7px;margin:6px 0}#panel .geo-scope-clickable,#panel .geo-scope-record{cursor:pointer}#panel .geo-scope-clickable:hover,#panel .geo-scope-record:hover{outline:1px solid var(--signal);outline-offset:-1px}\n';document.head.appendChild(style);})();

window.ICOSA_LIVE.scope=function(){var c=geoScopeSelectedCell();return {version:GEONOSIS_SCOPE_VERSION,selected:c&&cellSlug(c),selected_edge_km:c&&cellEdgeKm(c),attention:geoScopeSampleSummary(c),request_key:c&&geoScopeRequestKey(c)};};
window.ICOSA_LIVE.requestSelected=function(){var c=geoScopeSelectedCell();if(!c)return null;geoScopeRequestAll(c);return window.ICOSA_LIVE.scope();};
window.ICOSA_LIVE.scopeVersion=GEONOSIS_SCOPE_VERSION;

setTimeout(function(){geoScopeRequestAll(geoScopeSelectedCell()||focusCell());geoScopeUpdatePlate();wake();},350);
