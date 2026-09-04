/* F15 EARTH · NATIVE PAGE COMPILER
 *
 * <selected ICOSA cell> is the query address.
 * [materialize] may admit only bounded catalog/STAC/header pages from real
 * source assets. A finer request may increase resolution but may not change
 * <quantity>, <units>, <semantics>, or <source> without saying so.
 *
 * This does not replace FIELD / GEOMETRY / VOLUME evidence. It records the
 * physical cloud pages underneath that evidence and exposes them to WIRE,
 * context, verification, and the existing Earth panel.
 */

var EARTH_NATIVE_VERSION='earth-native-pages-v1';
var EARTH_NATIVE_LIMITS=Object.freeze({
  MAX_PAGES:12,
  MAX_ITEMS_PER_LAYER:2,
  RANGE_BYTES:65536,
  REQUEST_TIMEOUT_MS:12000,
  TERRAIN_MAX_EDGE_KM:800,
  COVER_MAX_EDGE_KM:180,
  LIDAR_MAX_EDGE_KM:12,
  EDGE_SAMPLES:8
});

var EARTH_NATIVE_LAYERS=Object.freeze([
  Object.freeze({
    id:'terrain',collection:'3dep-seamless',asset:'data',storage:'COG',
    source:'USGS 3DEP via Microsoft Planetary Computer',
    quantity:'bare-earth elevation',units:'metres',semantics:'continuous',
    resampling:'bilinear',nativeResolutionM:10,maxEdgeKm:EARTH_NATIVE_LIMITS.TERRAIN_MAX_EDGE_KM
  }),
  Object.freeze({
    id:'cover',collection:'esa-worldcover',asset:'map',storage:'COG',
    source:'ESA WorldCover via Microsoft Planetary Computer',
    quantity:'land-cover class',units:'class code',semantics:'categorical',
    resampling:'nearest',nativeResolutionM:10,maxEdgeKm:EARTH_NATIVE_LIMITS.COVER_MAX_EDGE_KM
  }),
  Object.freeze({
    id:'lidar',collection:'3dep-lidar-copc',asset:'data',storage:'COPC',
    source:'USGS 3DEP LiDAR via Microsoft Planetary Computer',
    quantity:'classified lidar point cloud',units:'metres',semantics:'points',
    resampling:'none',nativeResolutionM:2,maxEdgeKm:EARTH_NATIVE_LIMITS.LIDAR_MAX_EDGE_KM
  })
]);

var EARTH_NATIVE={
  selectedSlug:null,
  generation:0,
  abort:null,
  state:'IDLE',
  bytes:0,
  pages:[],
  layers:{},
  errors:[]
};
var EARTH_NATIVE_CATALOG={};
var EARTH_NATIVE_STAC='https://planetarycomputer.microsoft.com/api/stac/v1';
var EARTH_NATIVE_SIGN='https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=';

function earthNativeLayer(id){
  for(var i=0;i<EARTH_NATIVE_LAYERS.length;i++)if(EARTH_NATIVE_LAYERS[i].id===id)return EARTH_NATIVE_LAYERS[i];
  return null;
}
function earthNativeSafeHref(href){
  try{var u=new URL(href);u.search='';u.hash='';return u.toString();}
  catch(e){return String(href||'').split('?')[0];}
}
function earthNativeFmtBytes(n){
  n=Math.max(0,Number(n)||0);
  return n>=1048576?(n/1048576).toFixed(2)+' MB':n>=1024?(n/1024).toFixed(1)+' KB':Math.round(n)+' B';
}
function earthNativeReset(cell){
  if(EARTH_NATIVE.abort)try{EARTH_NATIVE.abort.abort();}catch(e){}
  EARTH_NATIVE.abort=new AbortController();
  EARTH_NATIVE.selectedSlug=cellSlug(cell);
  EARTH_NATIVE.generation++;
  EARTH_NATIVE.state='IDLE';
  EARTH_NATIVE.bytes=0;
  EARTH_NATIVE.pages=[];
  EARTH_NATIVE.layers={};
  EARTH_NATIVE.errors=[];
  for(var i=0;i<EARTH_NATIVE_LAYERS.length;i++){
    var L=EARTH_NATIVE_LAYERS[i];
    EARTH_NATIVE.layers[L.id]={state:'NOT QUERIED',items:[],coverageCell:EARTH_NATIVE.selectedSlug};
  }
  return {generation:EARTH_NATIVE.generation,signal:EARTH_NATIVE.abort.signal};
}
function earthNativeSame(g){return g===EARTH_NATIVE.generation;}
function earthNativeWireStart(url,why){
  if(typeof EARTH!=='undefined'&&EARTH.resources)EARTH.resources.requests++;
  var host='';try{host=new URL(url).host;}catch(e){host=String(url).split('/')[2]||'';}
  if(typeof netStart==='function')netStart(host,why);
  return host;
}
function earthNativeWireEnd(host,err){if(typeof netEnd==='function')netEnd(host,!!err);}
function earthNativeFetch(url,options,parentSignal,why){
  var ctl=new AbortController(),timer=setTimeout(function(){ctl.abort();},EARTH_NATIVE_LIMITS.REQUEST_TIMEOUT_MS),unlink=function(){};
  if(parentSignal){
    var abort=function(){ctl.abort();};
    if(parentSignal.aborted)ctl.abort();else{parentSignal.addEventListener('abort',abort,{once:true});unlink=function(){try{parentSignal.removeEventListener('abort',abort);}catch(e){}};}
  }
  var opts=Object.assign({},options||{});opts.signal=ctl.signal;opts.credentials='omit';opts.cache='no-store';
  var host=earthNativeWireStart(url,why||'native page');
  return fetch(url,opts).then(function(r){if(!r.ok&&r.status!==206)throw new Error('HTTP '+r.status);return r;})
    .then(function(r){earthNativeWireEnd(host,false);return r;},function(e){earthNativeWireEnd(host,true);throw e;})
    .finally(function(){clearTimeout(timer);unlink();});
}
function earthNativeAddPage(L,kind,bytes,href,note){
  if(EARTH_NATIVE.pages.length>=EARTH_NATIVE_LIMITS.MAX_PAGES)return false;
  var n=Math.max(0,Number(bytes)||0);
  EARTH_NATIVE.pages.push({
    id:'np'+(EARTH_NATIVE.pages.length+1),layer:L.id,kind:kind,
    source:L.source,quantity:L.quantity,units:L.units,storage:L.storage,
    semantics:L.semantics,resampling:L.resampling,bytes:n,
    href:earthNativeSafeHref(href),note:String(note||'').slice(0,180),t:Date.now()
  });
  EARTH_NATIVE.bytes+=n;
  return true;
}
function earthNativeGeometry(cell){
  var C=cellCorners(cell),ring=[],n=EARTH_NATIVE_LIMITS.EDGE_SAMPLES;
  for(var e=0;e<3;e++){
    for(var k=0;k<n;k++){
      var p=lonlat(norm(lerp3(C[e],C[(e+1)%3],k/n)));
      ring.push([+p[0].toFixed(6),+p[1].toFixed(6)]);
    }
  }
  ring.push(ring[0]);
  var min=180,max=-180;
  for(var i=0;i<ring.length;i++){min=Math.min(min,ring[i][0]);max=Math.max(max,ring[i][0]);}
  return {geometry:{type:'Polygon',coordinates:[ring]},queryable:max-min<=180,lonSpan:max-min};
}
function earthNativeCatalog(L,signal){
  if(EARTH_NATIVE_CATALOG[L.collection])return Promise.resolve({json:EARTH_NATIVE_CATALOG[L.collection],bytes:0,cached:true});
  var url=EARTH_NATIVE_STAC+'/collections/'+encodeURIComponent(L.collection);
  return earthNativeFetch(url,null,signal,'catalog '+L.id).then(function(r){return r.text();}).then(function(text){
    var j=JSON.parse(text);EARTH_NATIVE_CATALOG[L.collection]=j;return {json:j,bytes:text.length,cached:false};
  });
}
function earthNativeSearch(cell,L,signal){
  var geo=earthNativeGeometry(cell);
  if(!geo.queryable)return Promise.reject(new Error('triangle crosses antimeridian; descend before spatial materialization'));
  var body={collections:[L.collection],limit:EARTH_NATIVE_LIMITS.MAX_ITEMS_PER_LAYER,intersects:geo.geometry};
  return earthNativeFetch(EARTH_NATIVE_STAC+'/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},signal,'STAC '+L.id+' · '+cellSlug(cell))
    .then(function(r){return r.text();}).then(function(text){return {json:JSON.parse(text),bytes:text.length};});
}
function earthNativeAsset(feature,L){
  var a=feature&&feature.assets||{};
  if(a[L.asset]&&a[L.asset].href)return a[L.asset];
  var keys=Object.keys(a);
  for(var i=0;i<keys.length;i++){var x=a[keys[i]];if(x&&x.href&&(x.roles||[]).indexOf('data')>=0)return x;}
  return null;
}
function earthNativeSign(href,signal){
  var u=EARTH_NATIVE_SIGN+encodeURIComponent(href);
  return earthNativeFetch(u,null,signal,'sign native asset').then(function(r){return r.json();}).then(function(j){if(!j||!j.href)throw new Error('signer returned no href');return j.href;});
}
function earthNativeHeader(signed,L,signal){
  var end=EARTH_NATIVE_LIMITS.RANGE_BYTES-1;
  return earthNativeFetch(signed,{headers:{Range:'bytes=0-'+end}},signal,L.id+' '+L.storage+' page 0 · '+EARTH_NATIVE_LIMITS.RANGE_BYTES+' B')
    .then(function(r){return r.arrayBuffer();}).then(function(buf){
      var a=new Uint8Array(buf),note='';
      if(L.storage==='COG'){
        var tiff=a.length>=4&&((a[0]===73&&a[1]===73)||(a[0]===77&&a[1]===77));
        note=tiff?'TIFF header present · STAC advertises cloud-optimized GeoTIFF':'TIFF header not confirmed';
      }else{
        var las=a.length>=4&&a[0]===76&&a[1]===65&&a[2]===83&&a[3]===70,copc=false;
        for(var i=0;i+3<a.length&&i<8192;i++)if(a[i]===99&&a[i+1]===111&&a[i+2]===112&&a[i+3]===99){copc=true;break;}
        note=las?(copc?'LASF header + COPC VLR marker present':'LASF header present · COPC VLR not in first page'):'LAS header not confirmed';
      }
      return {bytes:a.byteLength,note:note};
    });
}
function earthNativeLayerRun(cell,L,g,signal){
  var state=EARTH_NATIVE.layers[L.id],edge=cellEdgeKm(cell);
  if(edge>L.maxEdgeKm){
    state.state='CATALOG ONLY · DESCEND';
    return earthNativeCatalog(L,signal).then(function(x){if(!earthNativeSame(g))return;state.state=x.cached?'CATALOG READY · CACHE':'CATALOG READY';earthNativeAddPage(L,'catalog',x.bytes,EARTH_NATIVE_STAC+'/collections/'+L.collection,'spatial assets deferred above '+L.maxEdgeKm+' km edge');});
  }
  state.state='DISCOVERING';
  return earthNativeSearch(cell,L,signal).then(function(x){
    if(!earthNativeSame(g))return null;
    var fs=(x.json&&x.json.features||[]).slice(0,EARTH_NATIVE_LIMITS.MAX_ITEMS_PER_LAYER);
    state.items=fs.map(function(f){return f.id;});
    state.state=fs.length?'ITEMS FOUND':'NO ITEM RETURNED';
    earthNativeAddPage(L,'STAC item page',x.bytes,EARTH_NATIVE_STAC+'/search',fs.length+' bounded item(s)');
    if(!fs.length)return null;
    var asset=earthNativeAsset(fs[0],L);if(!asset)throw new Error('no data asset on first item');
    state.state='SIGNING';
    return earthNativeSign(asset.href,signal).then(function(signed){
      if(!earthNativeSame(g))return null;state.state='MATERIALIZING';
      return earthNativeHeader(signed,L,signal).then(function(pg){
        if(!earthNativeSame(g))return null;state.state='HEADER READY';
        state.asset=earthNativeSafeHref(asset.href);state.item=fs[0].id;
        earthNativeAddPage(L,L.storage+' header page',pg.bytes,asset.href,pg.note+' · item '+fs[0].id);
        if(L.id==='lidar'&&typeof EARTH!=='undefined'){
          EARTH.volumes.lidar={type:'VOLUME',id:'3dep-lidar-copc',state:'HEADER_READY',semantic:'classified lidar point-cloud asset',epistemic:'NATIVE_PAGE',source:L.source,retrievedAt:new Date().toISOString(),nativeResolutionM:L.nativeResolutionM,itemId:fs[0].id,asset:earthNativeSafeHref(asset.href),headerBytes:pg.bytes,headerNote:pg.note,coverage:typeof earthCoverage==='function'?earthCoverage(cell,cell,'STAC item + first COPC byte range',false,'a missing item or failed header is not evidence that LiDAR does not exist'):null,note:'asset presence and first page verified; point records are not decoded in F15'};
        }
        return null;
      });
    });
  }).catch(function(e){
    if(!earthNativeSame(g)||earthAbortError(e))return;
    state.state='ERROR';state.error=String(e&&e.message||e);EARTH_NATIVE.errors.push(L.id+': '+state.error);
    if(L.id==='lidar'&&typeof EARTH!=='undefined')EARTH.volumes.lidar={type:'VOLUME',id:'3dep-lidar-copc',state:'UNAVAILABLE_TO_THIS_REQUEST',semantic:'classified lidar point-cloud asset',epistemic:'AVAILABILITY',source:L.source,error:state.error,coverage:typeof earthCoverage==='function'?earthCoverage(cell,cell,'bounded STAC/COPC request',false,'request failure or zero returned items is not LiDAR absence'):null};
  });
}
function earthNativeRequest(cell,force){
  if(!cell)return Promise.resolve(EARTH_NATIVE);
  var slug=cellSlug(cell);
  if(!force&&EARTH_NATIVE.selectedSlug===slug&&(EARTH_NATIVE.state==='READY'||EARTH_NATIVE.state==='PARTIAL'))return Promise.resolve(EARTH_NATIVE);
  var run=earthNativeReset(cell),g=run.generation,signal=run.signal;
  EARTH_NATIVE.state='LOADING';earthNativeRefresh();
  var jobs=[];for(var i=0;i<EARTH_NATIVE_LAYERS.length;i++)jobs.push(earthNativeLayerRun(cell,EARTH_NATIVE_LAYERS[i],g,signal));
  return Promise.all(jobs).then(function(){
    if(!earthNativeSame(g))return EARTH_NATIVE;
    var ready=0,err=0;
    for(var i=0;i<EARTH_NATIVE_LAYERS.length;i++){var s=EARTH_NATIVE.layers[EARTH_NATIVE_LAYERS[i].id].state;if(s==='HEADER READY'||s.indexOf('CATALOG READY')===0||s==='NO ITEM RETURNED')ready++;if(s==='ERROR')err++;}
    EARTH_NATIVE.state=err===0?'READY':ready?'PARTIAL':'ERROR';earthNativeRefresh();return EARTH_NATIVE;
  });
}
function earthNativeContext(cell){
  var slug=cell?cellSlug(cell):null,match=slug&&slug===EARTH_NATIVE.selectedSlug;
  return {version:EARTH_NATIVE_VERSION,focus_address:slug,matches_loaded_selected:!!match,state:match?EARTH_NATIVE.state:'OTHER CELL',law:'native pages prove only what was actually fetched; refinement may not silently change source, quantity, units, or semantics',bytes:match?EARTH_NATIVE.bytes:0,limits:EARTH_NATIVE_LIMITS,layers:EARTH_NATIVE_LAYERS.map(function(L){var x=match&&EARTH_NATIVE.layers[L.id];return{id:L.id,collection:L.collection,source:L.source,quantity:L.quantity,units:L.units,storage:L.storage,semantics:L.semantics,resampling:L.resampling,native_resolution_m:L.nativeResolutionM,max_edge_km:L.maxEdgeKm,state:x?x.state:'NOT LOADED',items:x&&x.items||[],item:x&&x.item||null,asset:x&&x.asset||null,error:x&&x.error||null};}),pages:match?EARTH_NATIVE.pages.slice(0,EARTH_NATIVE_LIMITS.MAX_PAGES).map(function(p){return{layer:p.layer,kind:p.kind,source:p.source,quantity:p.quantity,units:p.units,storage:p.storage,semantics:p.semantics,resampling:p.resampling,bytes:p.bytes,href:p.href,note:p.note};}):[],errors:match?EARTH_NATIVE.errors.slice(0,4):[]};
}
function earthNativeVerify(){
  var registry=true,categorical=true,pages=true,bounded=EARTH_NATIVE.pages.length<=EARTH_NATIVE_LIMITS.MAX_PAGES;
  for(var i=0;i<EARTH_NATIVE_LAYERS.length;i++){var L=EARTH_NATIVE_LAYERS[i];if(!L.id||!L.collection||!L.source||!L.quantity||!L.units||!L.storage||!L.semantics)registry=false;if(L.semantics==='categorical'&&L.resampling!=='nearest')categorical=false;}
  for(var j=0;j<EARTH_NATIVE.pages.length;j++){var p=EARTH_NATIVE.pages[j],S=earthNativeLayer(p.layer);if(!S||p.source!==S.source||p.quantity!==S.quantity||p.units!==S.units||p.storage!==S.storage||p.semantics!==S.semantics||p.bytes<0||/[?&](sig|se|sp|sv|skoid)=/i.test(p.href))pages=false;}
  return {registry:registry,categorical:categorical,pages:pages,bounded:bounded,pass:registry&&categorical&&pages&&bounded};
}
function earthNativePanel(cell){
  var c=earthNativeContext(cell),v=earthNativeVerify();
  var rows=c.layers.map(function(L){return '<div class="row"><b>'+earthEsc(L.quantity.toUpperCase())+'</b><span>'+earthEsc(L.storage+' · '+L.state)+'</span></div><div class="row"><b style="font-weight:400">'+earthEsc(L.source)+'</b><span>'+earthEsc(L.semantics+' · '+L.resampling)+'</span></div>';}).join('');
  var pages=c.pages.map(function(p){return '<div class="row"><b>'+earthEsc(p.layer.toUpperCase()+' · '+p.kind)+'</b><span>'+earthEsc(earthNativeFmtBytes(p.bytes)+' · '+p.note)+'</span></div>';}).join('');
  return '<details id="earth-native-pages"><summary>NATIVE PAGES · '+earthEsc(c.state)+' · '+earthNativeFmtBytes(c.bytes)+'</summary><p><b>The address reaches the bytes.</b> STAC discovers assets; Planetary Computer signs only the asset being read; F15 then admits at most one 64 KB header page per eligible source. Signed capabilities never enter the record or model context.</p>'+rows+(pages?'<p><b>PAGES PRESENT</b></p>'+pages:'')+(c.errors.length?'<p style="color:var(--signal)">'+earthEsc(c.errors.join(' · '))+'</p>':'')+'<div class="row"><b>VERIFY</b><span>'+((v.pass?'4/4 PASS':'FAILED'))+' · identity · categories · capability scrub · bound</span></div><button class="go ghost" id="earthNativeAgain">MATERIALIZE NATIVE PAGES</button></details>';
}
function earthNativeRefresh(){if(typeof earthRefreshUI==='function')earthRefreshUI();else if(typeof wake==='function')wake();}

/* Context: keep native storage evidence distinct from the already-compiled
 * FIELD / GEOMETRY / VOLUME evidence. */
if(typeof earthContext==='function'){
  var earthNativeContextBase=earthContext;
  earthContext=function(cell){var x=earthNativeContextBase(cell);x.native_pages=earthNativeContext(cell);return x;};
}
if(typeof LAW==='string'&&LAW.indexOf('native_pages')<0){
  LAW+=' When context.live.earth.native_pages is present, it is a byte-range provenance manifest, not a second measurement. A readable COG or COPC header proves asset/page availability only. It does not by itself prove pixel values, point classifications, completeness, or absence outside the bounded STAC query.';
}

/* Panel: native storage sits under material evidence, never beside it as a
 * competing ontology. */
if(typeof earthPanelHTML==='function'){
  var earthNativePanelBase=earthPanelHTML;
  earthPanelHTML=function(cell){return earthNativePanelBase(cell)+earthNativePanel(cell);};
}
if(typeof renderLiveWhere==='function'){
  var earthNativeRenderBase=renderLiveWhere;
  renderLiveWhere=function(cell){earthNativeRenderBase(cell);setTimeout(function(){var b=document.getElementById('earthNativeAgain');if(b)b.onclick=function(){earthNativeRequest(cell,true);};},0);};
}

/* WIRE is the memory bus: ordinary source requests and native page faults
 * appear in one place. */
if(typeof wireTable==='function'){
  var earthNativeWireTableBase=wireTable;
  wireTable=function(){var h=earthNativeWireTableBase();if(!EARTH_NATIVE.selectedSlug)return h;return '<div class="wrow"><b>native pages</b> · '+earthEsc(EARTH_NATIVE.selectedSlug)+' · '+earthEsc(EARTH_NATIVE.state)+' · '+earthNativeFmtBytes(EARTH_NATIVE.bytes)+' · '+EARTH_NATIVE.pages.length+'/'+EARTH_NATIVE_LIMITS.MAX_PAGES+'</div>'+h;};
}

/* MEASURE is contextual, not a permanent mode. The same triangle that opens
 * WHERE can demand its native pages. */
if(typeof availableActions==='function'){
  var earthNativeActionsBase=availableActions;
  availableActions=function(cell){var a=earthNativeActionsBase(cell),label=EARTH_NATIVE.selectedSlug===cellSlug(cell)?EARTH_NATIVE.state+' · '+earthNativeFmtBytes(EARTH_NATIVE.bytes):'native pages';a.splice(Math.min(1,a.length),0,{k:'measure',t:'MEASURE',s:label});return a;};
}
if(typeof doAction==='function'){
  var earthNativeDoBase=doAction;
  doAction=function(kind,cell){if(kind!=='measure')return earthNativeDoBase(kind,cell);earthNativeRequest(cell,true);openWhere(cell);hideActions();setTimeout(function(){var e=document.getElementById('earth-native-pages');if(e)e.open=true;},40);wake();};
}

/* Follow the already-existing Earth working-set request. Because this module
 * is loaded after the Power-of-10 layer, the wrapper is the final request
 * gate and inherits all earlier safety behavior. */
if(typeof earthRequestAll==='function'){
  var earthNativeAllBase=earthRequestAll;
  earthRequestAll=function(selected,force){var p=earthNativeAllBase(selected,force);earthNativeRequest(selected,!!force);return p;};
}

/* Startup assertions: illegal epistemic or resource configurations do not
 * degrade silently. */
(function(){
  var v=earthNativeVerify();
  if(!v.registry)throw new Error('EARTH NATIVE registry has an incomplete quantity identity');
  if(!v.categorical)throw new Error('EARTH NATIVE categorical layer would interpolate classes');
  if(EARTH_NATIVE_LIMITS.MAX_PAGES<1||EARTH_NATIVE_LIMITS.MAX_PAGES>16)throw new Error('EARTH NATIVE page bound invalid');
  if(EARTH_NATIVE_LIMITS.RANGE_BYTES<4096||EARTH_NATIVE_LIMITS.RANGE_BYTES>262144)throw new Error('EARTH NATIVE range bound invalid');
})();

if(window.ICOSA_EARTH){
  window.ICOSA_EARTH.native={version:EARTH_NATIVE_VERSION,state:function(){return earthNativeContext(typeof geoScopeSelectedCell==='function'?geoScopeSelectedCell():focusCell());},request:function(slug){var c=typeof slug==='string'?cellFromSlug(slug):slug;c=c||(typeof geoScopeSelectedCell==='function'?geoScopeSelectedCell():focusCell());return earthNativeRequest(c,true);},verify:earthNativeVerify};
}
