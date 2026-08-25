/* GEONOSIS MAP INSPECTOR
 * Makes the live observation bus perceptible and inspectable.
 * Injected last inside ICOSA's canonical closure.
 */

var GEO_INSPECT = {
  selectedId: null,
  selectedIds: [],
  hits: [],
  focusSlug: null,
  focusSince: 0,
  requestedKey: null,
  active: false,
  dataEdgeKm: 250,
  maxMarkers: 140
};

function geoInspectEsc(v){ return liveEsc(v == null ? '' : String(v)); }
function geoInspectCut(v,n){ var s=String(v==null?'':v); return s.length>(n||80)?s.slice(0,(n||80)-1)+'…':s; }
function geoInspectWhen(ms){
  if(!ms)return 'unknown time';
  var d=new Date(ms);return Number.isFinite(d.getTime())?d.toISOString().replace('.000Z','Z'):'unknown time';
}
function geoInspectValue(v){
  if(v==null)return '—';
  if(typeof v==='string')return geoInspectCut(v,180);
  if(typeof v==='number'||typeof v==='boolean')return String(v);
  try{return geoInspectCut(JSON.stringify(v),180);}catch(e){return String(v);}
}
function geoInspectGlyph(r){
  var d=typeof GEO_DEFS!=='undefined'&&GEO_DEFS[r&&r.source];
  if(d&&d.glyph)return d.glyph;
  var k=r&&r.kind||'';
  var m={earthquake:'EQ',datacenter:'DC',fire:'FIRE',aircraft:'AIR','weather-alert':'WX',streamflow:'Q','hydro-flowline':'H2O','fema-declaration':'FEMA',biodiversity:'BIO','civic-report':'311','flood-hazard':'FLOOD','epa-facility':'EPA','weather-state':'MET','terrain-state':'Z','air-quality':'AQ'};
  return m[k]||geoInspectCut(String(k||'DATA').toUpperCase(),5);
}
function geoInspectUrgent(r){
  var k=r&&r.kind;
  return k==='earthquake'||k==='fire'||k==='weather-alert'||k==='fema-declaration'||k==='flood-hazard'||k==='air-quality';
}
function geoInspectLabel(r){
  if(!r)return 'unknown signal';
  if(typeof geoRecordLabel==='function'){
    try{var x=geoRecordLabel(r);if(x)return x;}catch(e){}
  }
  var p=r.properties||{};
  return p.name||p.place||p.event||p.callsign||p.scientificName||r.kind||r.id;
}
function geoInspectDataCell(){
  var c=focusCell();
  while(c&&c.depth<LIVE_INDEX_DEPTH&&cellEdgeKm(c)>GEO_INSPECT.dataEdgeKm)c=cellAt(view.centre,c.depth+1);
  return c;
}
function geoInspectCellFor(maxKm){
  var c=focusCell(),limit=Math.max(1,Number(maxKm)||GEO_INSPECT.dataEdgeKm);
  while(c&&c.depth<LIVE_INDEX_DEPTH&&cellEdgeKm(c)>limit)c=cellAt(view.centre,c.depth+1);
  return c;
}
function geoInspectRequestSource(id){
  if(typeof GEO_DEFS==='undefined'||typeof GEO_TARGETS==='undefined')return;
  var d=GEO_DEFS[id],s=LIVE.sources[id];if(!d||!s)return;
  var c=geoInspectCellFor(d.maxKm),slug=cellSlug(c);
  if(typeof GEO_SOURCE_IDS!=='undefined'&&id===GEO_SOURCE_IDS.nyc311&&typeof geoIntersectsNyc==='function'&&!geoIntersectsNyc(c)){
    if(typeof geoStopSource==='function')geoStopSource(id,'idle','outside NYC 311 jurisdiction');
    return;
  }
  var t=GEO_TARGETS[id];
  if(!t||t.slug!==slug){
    GEO_TARGETS[id]={cell:c,slug:slug,mode:'attention_auto',requestedAt:Date.now()};
    pollLiveSource(id);
  }else if(!s.lastUpdate&&s.state!=='loading'){
    pollLiveSource(id);
  }
}
function geoInspectRequestAttention(){
  if(typeof GEO_DEFS!=='undefined')Object.keys(GEO_DEFS).forEach(geoInspectRequestSource);
  if(typeof live2RequestFirms==='function'&&typeof FIRMS_MAX_KM!=='undefined'){
    try{live2RequestFirms(geoInspectCellFor(FIRMS_MAX_KM));}catch(e){}
  }
  if(typeof requestAircraft==='function'&&typeof AIR_MAX_CELL_KM!=='undefined'){
    try{requestAircraft(geoInspectCellFor(AIR_MAX_CELL_KM));}catch(e){}
  }
}
function geoInspectTick(){
  if(!GEO_INSPECT.active)return;
  var c=focusCell(),slug=c&&cellSlug(c);if(!slug)return;
  if(slug!==GEO_INSPECT.focusSlug){
    GEO_INSPECT.focusSlug=slug;GEO_INSPECT.focusSince=Date.now();GEO_INSPECT.requestedKey=null;geoInspectUpdatePlate();return;
  }
  if(Date.now()-GEO_INSPECT.focusSince<420)return;
  var dc=geoInspectDataCell(),key=dc&&cellSlug(dc);
  if(!key||GEO_INSPECT.requestedKey===key)return;
  GEO_INSPECT.requestedKey=key;geoInspectRequestAttention();geoInspectUpdatePlate();
}

function geoInspectLocalRecords(){
  var c=geoInspectDataCell();if(!c)return [];
  var rows=liveForCell(c).slice();
  if(GEO_INSPECT.selectedId&&LIVE.records[GEO_INSPECT.selectedId]&&rows.indexOf(LIVE.records[GEO_INSPECT.selectedId])<0)rows.unshift(LIVE.records[GEO_INSPECT.selectedId]);
  rows.sort(function(a,b){
    var au=geoInspectUrgent(a)?1:0,bu=geoInspectUrgent(b)?1:0;
    return bu-au||((b.observedAt||b.retrievedAt||0)-(a.observedAt||a.retrievedAt||0));
  });
  return rows.slice(0,GEO_INSPECT.maxMarkers);
}
function geoInspectSourceStats(){
  var ids=Object.keys(LIVE.sources),out={total:ids.length,ready:0,loading:0,error:0,loaded:0};
  ids.forEach(function(id){var s=LIVE.sources[id];if(!s)return;if(s.lastUpdate)out.loaded++;if(s.state==='loading')out.loading++;if(s.state==='error')out.error++;if(s.state==='ready'||s.state==='stale')out.ready++;});
  return out;
}
function geoInspectUpdatePlate(){
  var el=document.getElementById('geonosis-map-plate');if(!el)return;
  var c=geoInspectDataCell(),rows=c?liveForCell(c):[],st=geoInspectSourceStats();
  el.innerHTML='<b>GEONOSIS DATA · '+rows.length+' HERE</b><span>'+st.loaded+'/'+st.total+' SOURCES LOADED'+(st.loading?' · '+st.loading+' LOADING':'')+'</span><i>TAP A DATA MARK TO INSPECT</i>';
}
function geoInspectInstallPlate(){
  if(document.getElementById('geonosis-map-plate'))return;
  var style=document.createElement('style');
  style.textContent='\n#geonosis-map-plate{position:absolute;z-index:19;left:max(10px,env(safe-area-inset-left));top:72px;max-width:min(290px,72vw);background:var(--ground);border:1.5px solid var(--ink);padding:6px 8px;font:700 9px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.08em;cursor:pointer;pointer-events:auto}\n#geonosis-map-plate b,#geonosis-map-plate span,#geonosis-map-plate i{display:block}#geonosis-map-plate span{font-size:8px;color:var(--muted);font-weight:400;margin-top:2px}#geonosis-map-plate i{font-size:7px;color:var(--signal);font-style:normal;margin-top:2px}\n#panel .geo-inspect-row.on{background:var(--ink);color:var(--ground);padding-inline:6px}#panel .geo-inspect-row.on span{color:var(--ground)}#panel .geo-prop{font-size:9px}#panel .geo-prop b{max-width:44%}\n@media(max-width:520px){#geonosis-map-plate{top:64px;max-width:66vw;padding:5px 7px}}\n';
  document.head.appendChild(style);
  var el=document.createElement('div');el.id='geonosis-map-plate';el.setAttribute('role','button');el.setAttribute('aria-label','Inspect Geonosis data in the current map area');
  var stage=document.getElementById('stage')||document.body;stage.appendChild(el);
  el.onclick=function(e){e.stopPropagation();openWhere(focusCell());setTimeout(function(){var d=document.getElementById('geonosis-inspector');if(d){d.open=true;d.scrollIntoView({block:'nearest'});}},0);};
  geoInspectUpdatePlate();
}

function geoInspectDrawCoverage(S){
  if(typeof GEO_TARGETS==='undefined')return;
  var groups=Object.create(null);
  Object.keys(GEO_TARGETS).forEach(function(id){var t=GEO_TARGETS[id],s=LIVE.sources[id];if(!t||!t.cell||!s||!s.lastUpdate)return;(groups[t.slug]||(groups[t.slug]={cell:t.cell,ids:[]})).ids.push(id);});
  ctx.save();ctx.setLineDash([3,4]);ctx.lineWidth=1;ctx.globalAlpha=.34;ctx.strokeStyle=COL.signal;ctx.fillStyle=COL.signal;ctx.font='700 7px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';ctx.textAlign='center';
  Object.keys(groups).forEach(function(slug){var g=groups[slug],c=g.cell;if(!c||!facingCamera(cellCentre(c)))return;var pts=c.tri.map(function(w){return screenOfWorld(worldOf(c.f,w),S);});ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);ctx.lineTo(pts[1][0],pts[1][1]);ctx.lineTo(pts[2][0],pts[2][1]);ctx.closePath();ctx.stroke();var sc=liveCellScreen(c,S);if(sc.x>=0&&sc.x<=W&&sc.y>=0&&sc.y<=H)ctx.fillText('QUERY '+g.ids.length,sc.x,sc.y-10);});
  ctx.restore();
}
function geoInspectDraw(S){
  geoInspectDrawCoverage(S);
  var rows=geoInspectLocalRecords(),groups=Object.create(null);GEO_INSPECT.hits=[];
  rows.forEach(function(r){if(!r||!r.v||!facingCamera(r.v))return;var p=livePointScreen(r,S);if(p.x<-30||p.y<-30||p.x>W+30||p.y>H+30)return;var key=Math.round(p.x/28)+','+Math.round(p.y/24);if(!groups[key])groups[key]={x:p.x,y:p.y,rows:[]};groups[key].rows.push(r);});
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  Object.keys(groups).forEach(function(key){var g=groups[key],r=g.rows[0],same=true,k=r.kind;for(var i=1;i<g.rows.length;i++)if(g.rows[i].kind!==k)same=false;var glyph=same?geoInspectGlyph(r):'DATA',text=glyph+(g.rows.length>1?' '+g.rows.length:'');var selected=GEO_INSPECT.selectedIds.some(function(id){return g.rows.some(function(x){return x.id===id;});})||g.rows.some(function(x){return x.id===GEO_INSPECT.selectedId;});var w=Math.max(18,ctx.measureText(text).width+8),h=14,x=g.x-w/2,y=g.y-h/2;ctx.globalAlpha=.96;ctx.fillStyle=selected?COL.signal:'#f1eee4';ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;ctx.strokeStyle=geoInspectUrgent(r)||selected?COL.signal:COL.ink;ctx.lineWidth=selected?2:1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);ctx.fillStyle=selected?'#f1eee4':(geoInspectUrgent(r)?COL.signal:COL.ink);ctx.fillText(text,g.x,g.y+.5);GEO_INSPECT.hits.push({x:g.x,y:g.y,w:w,h:h,rows:g.rows});if(selected&&g.rows.length===1){var lab=geoInspectCut(geoInspectLabel(r),44),lw=ctx.measureText(lab).width+8,lx=Math.min(W-lw-4,g.x+w/2+4),ly=Math.max(4,g.y-7);ctx.fillStyle='#f1eee4';ctx.fillRect(lx,ly,lw,14);ctx.strokeStyle=COL.signal;ctx.strokeRect(lx+.5,ly+.5,lw-1,13);ctx.fillStyle=COL.signal;ctx.textAlign='left';ctx.fillText(lab,lx+4,ly+7.5);ctx.textAlign='center';}});
  ctx.restore();
}

function geoInspectOpenRows(rows){
  if(!rows||!rows.length)return;
  GEO_INSPECT.selectedIds=rows.map(function(r){return r.id;});GEO_INSPECT.selectedId=rows[0].id;
  var r=rows[0],c=cellAt(r.v,Math.max(0,depthForZoom()));
  openWhere(c);wake();setTimeout(function(){var d=document.getElementById('geonosis-inspector');if(d){d.open=true;d.scrollIntoView({block:'nearest'});}},0);
}
function geoInspectPointer(e){
  if(!GEO_INSPECT.hits.length)return;var rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*(W/rect.width),y=(e.clientY-rect.top)*(H/rect.height),best=null,bd=1e9;
  for(var i=0;i<GEO_INSPECT.hits.length;i++){var h=GEO_INSPECT.hits[i],dx=x-h.x,dy=y-h.y,d=Math.sqrt(dx*dx+dy*dy),reach=Math.max(13,Math.max(h.w,h.h)/2+5);if(d<=reach&&d<bd){best=h;bd=d;}}
  if(!best)return;e.preventDefault();e.stopImmediatePropagation();geoInspectOpenRows(best.rows);
}

function geoInspectSelectedHtml(r){
  if(!r)return '';
  var src=LIVE.sources[r.source],addr=r.prefixes&&r.prefixes.length?r.prefixes[Math.min(LIVE_INDEX_DEPTH,r.prefixes.length-1)]:cellSlug(cellAt(r.v,LIVE_INDEX_DEPTH));
  var h='<div class="row on"><b>'+geoInspectEsc(geoInspectGlyph(r)+' · '+geoInspectLabel(r))+'</b><span>'+geoInspectEsc(r.epistemic||'RECORD')+'</span></div>'+
    '<div class="row geo-prop"><b>SOURCE</b><span>'+geoInspectEsc((src&&src.provider)||r.source)+'</span></div>'+
    '<div class="row geo-prop"><b>ADDRESS</b><span>'+geoInspectEsc(addr)+'</span></div>'+
    '<div class="row geo-prop"><b>POSITION</b><span>'+Number(r.lat).toFixed(5)+', '+Number(r.lon).toFixed(5)+'</span></div>'+
    '<div class="row geo-prop"><b>OBSERVED</b><span>'+geoInspectEsc(geoInspectWhen(r.observedAt))+'</span></div>'+
    '<div class="row geo-prop"><b>RETRIEVED</b><span>'+geoInspectEsc(geoInspectWhen(r.retrievedAt))+'</span></div>';
  var p=r.properties||{};Object.keys(p).slice(0,18).forEach(function(k){h+='<div class="row geo-prop"><b>'+geoInspectEsc(k.toUpperCase())+'</b><span>'+geoInspectEsc(geoInspectValue(p[k]))+'</span></div>';});
  return h;
}
function geoInspectRenderPanel(cell){
  var root=document.getElementById('panel');if(!root||!root.classList.contains('open'))return;var old=document.getElementById('geonosis-inspector');if(old&&old.parentNode)old.parentNode.removeChild(old);
  var dc=geoInspectDataCell(),rows=dc?liveForCell(dc):[],sel=GEO_INSPECT.selectedId&&LIVE.records[GEO_INSPECT.selectedId],stats=geoInspectSourceStats(),html='<details id="geonosis-inspector" open><summary>DATA FIELD · '+rows.length+' SIGNAL'+(rows.length===1?'':'S')+' · '+geoInspectEsc(dc?cellSlug(dc):'NO CELL')+'</summary>'+ 
    '<p><b>'+stats.loaded+'/'+stats.total+' sources loaded.</b> The dashed triangle on the map is the actual attention-query footprint. Tap any labeled data mark to inspect the underlying record.</p>';
  if(sel)html+=geoInspectSelectedHtml(sel);
  var ids=Object.keys(LIVE.sources).sort();html+='<details><summary>SOURCE STATE · '+ids.length+'</summary>';
  ids.forEach(function(id){var s=LIVE.sources[id],t=typeof GEO_TARGETS!=='undefined'&&GEO_TARGETS[id],state=liveSourceFreshness(s),count=s&&s.count||0;html+='<div class="row"><b>'+geoInspectEsc((s&&s.name)||id)+'</b><span>'+geoInspectEsc(state)+' · '+count+(t?' · '+t.slug:'')+'</span></div>';});html+='</details>';
  html+='<details open><summary>SIGNALS HERE · '+rows.length+'</summary>';
  rows.slice().sort(function(a,b){return (geoInspectUrgent(b)?1:0)-(geoInspectUrgent(a)?1:0)||((b.observedAt||b.retrievedAt||0)-(a.observedAt||a.retrievedAt||0));}).slice(0,60).forEach(function(r){html+='<div class="row geo-inspect-row'+(r.id===GEO_INSPECT.selectedId?' on':'')+'" data-geo-id="'+geoInspectEsc(r.id)+'"><b>'+geoInspectEsc(geoInspectGlyph(r)+' · '+geoInspectLabel(r))+'</b><span>'+geoInspectEsc((r.epistemic||'RECORD')+' · '+r.source)+'</span></div>';});
  if(rows.length>60)html+='<p>+'+(rows.length-60)+' more records in this local inspection cell.</p>';html+='</details></details>';root.insertAdjacentHTML('beforeend',html);
  root.querySelectorAll('[data-geo-id]').forEach(function(el){el.onclick=function(){var r=LIVE.records[el.getAttribute('data-geo-id')];if(!r)return;GEO_INSPECT.selectedId=r.id;GEO_INSPECT.selectedIds=[r.id];lookAt(r.v,depthForZoom());openWhere(cellAt(r.v,depthForZoom()),true);wake();};});
}

var geoInspectRenderLiveWhereBase=renderLiveWhere;
renderLiveWhere=function(cell){geoInspectRenderLiveWhereBase(cell);geoInspectRenderPanel(cell);geoInspectUpdatePlate();};
var geoInspectDrawLiveBase=drawLive;
drawLive=function(S){geoInspectDrawLiveBase(S);geoInspectDraw(S);};
canvas.addEventListener('pointerup',geoInspectPointer,true);

window.ICOSA_LIVE.inspectRecord=function(id){var r=LIVE.records[id];if(!r)return null;GEO_INSPECT.selectedId=id;GEO_INSPECT.selectedIds=[id];return r;};
window.ICOSA_LIVE.inspectHere=function(){var c=geoInspectDataCell();return {cell:c&&cellSlug(c),inventory:c&&liveInventory(c),sources:geoInspectSourceStats()};};
window.ICOSA_LIVE.requestHere=function(){geoInspectRequestAttention();return geoInspectDataCell()&&cellSlug(geoInspectDataCell());};
window.ICOSA_LIVE.inspector=GEO_INSPECT;

setTimeout(function(){geoInspectInstallPlate();GEO_INSPECT.active=true;geoInspectTick();setInterval(geoInspectTick,180);setInterval(geoInspectUpdatePlate,900);},1700);
