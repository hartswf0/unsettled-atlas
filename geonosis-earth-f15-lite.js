/* F15 EARTH WORKING SET · LEAN
 * Standalone additive runtime injected inside the base ICOSA closure.
 * No Geonosis observation bus required.
 */
var F15_EARTH_VERSION='f15-earth-lean-v2';
var F15_LIMITS=Object.freeze({
  TERRAIN_MAX_KM:300,
  COVER_MAX_KM:60,
  GEOM_MAX_KM:80,
  FIELD_SAMPLES:7,
  MAX_COG_TILES:3,
  MAX_GEOM_FEATURES:120,
  MAX_VERTICES:6000,
  MAX_VERTICES_PER_FEATURE:800,
  REQUEST_TIMEOUT_MS:8000,
  GEOTIFF_TIMEOUT_MS:7000,
  CACHE_COGS:3,
  FOCUS_SETTLE_MS:320
});

var F15={
  generation:0,
  abort:null,
  selected:null,
  terrainCell:null,
  coverCell:null,
  geomCell:null,
  state:'IDLE',
  terrain:null,
  cover:null,
  power:null,
  water:null,
  lidar:{type:'VOLUME',state:'UNAVAILABLE',reason:'No globally appropriate open LiDAR/COPC source is configured for this geography.'},
  resources:{requests:0,cogs:0,features:0,vertices:0},
  focusCandidate:null,
  focusTimer:null,
  lastRequestKey:null
};

var F15_CLASSES=Object.freeze({
  10:'TREE',20:'SHRUB',30:'GRASS',40:'CROP',50:'BUILT',60:'BARE',
  70:'SNOW',80:'WATER',90:'WETLAND',95:'MANGROVE',100:'MOSS'
});
var F15_COLORS=Object.freeze({
  10:'#006400',20:'#b8860b',30:'#9a9a18',40:'#a858a8',50:'#a8462a',
  60:'#77756f',70:'#f0f0f0',80:'#397f9d',90:'#188c91',95:'#11895a',100:'#c2ad70'
});
var F15_COG_CACHE=[];
var F15_GEOTIFF=null;

function f15Finite(v){var n=Number(v);return Number.isFinite(n)?n:null;}
function f15Esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}
function f15AbortError(e){return !!(e&&(e.name==='AbortError'||String(e).indexOf('AbortError')>=0));}
function f15Selected(){
  if(typeof whereCell!=='undefined'&&whereCell)return whereCell;
  if(typeof selection!=='undefined'&&selection)return selection;
  return typeof focusCell==='function'?focusCell():null;
}
function f15DepthLimit(){return typeof MAX_DEPTH==='number'?MAX_DEPTH:12;}
function f15Attention(selected,maxKm){
  if(!selected)return null;
  var c=selected,anchor=cellCentre(selected),limit=Math.max(1,Number(maxKm)||1),guard=0,max=f15DepthLimit();
  while(c&&c.depth<max&&cellEdgeKm(c)>limit&&guard<=max){c=cellAt(anchor,c.depth+1);guard++;}
  return c;
}
function f15SamplePoints(cell){
  var centre=lonlat(cellCentre(cell)),corn=cellCorners(cell).map(lonlat);
  var out=[{name:'centre',lon:centre[0],lat:centre[1]}];
  for(var i=0;i<3&&out.length<F15_LIMITS.FIELD_SAMPLES;i++)out.push({name:'corner'+i,lon:corn[i][0],lat:corn[i][1]});
  for(var j=0;j<3&&out.length<F15_LIMITS.FIELD_SAMPLES;j++){
    var a=corn[j],b=corn[(j+1)%3],ax=a[0],bx=b[0];
    if(Math.abs(ax-bx)>180){if(ax<0)ax+=360;else bx+=360;}
    var x=(ax+bx)/2;if(x>180)x-=360;
    out.push({name:'edge'+j,lon:x,lat:(a[1]+b[1])/2});
  }
  return out.slice(0,F15_LIMITS.FIELD_SAMPLES);
}
function f15Fetch(url,opts,parentSignal){
  var c=new AbortController(),timer=setTimeout(function(){c.abort();},F15_LIMITS.REQUEST_TIMEOUT_MS);
  var unlink=function(){};
  if(parentSignal){
    if(parentSignal.aborted)c.abort();
    else{
      var fn=function(){c.abort();};
      parentSignal.addEventListener('abort',fn,{once:true});
      unlink=function(){try{parentSignal.removeEventListener('abort',fn);}catch(e){}};
    }
  }
  var o=opts||{};o.signal=c.signal;o.credentials='omit';o.cache='default';
  F15.resources.requests++;
  return fetch(url,o).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r;}).finally(function(){clearTimeout(timer);unlink();});
}

function f15Terrain(selected,cell,signal){
  var pts=f15SamplePoints(cell),lats=[],lons=[];
  for(var i=0;i<pts.length;i++){lats.push(pts[i].lat.toFixed(6));lons.push(pts[i].lon.toFixed(6));}
  var url='https://api.open-meteo.com/v1/elevation?latitude='+encodeURIComponent(lats.join(','))+'&longitude='+encodeURIComponent(lons.join(','));
  return f15Fetch(url,{headers:{Accept:'application/json'}},signal).then(function(r){return r.json();}).then(function(j){
    var zs=Array.isArray(j&&j.elevation)?j.elevation:[],samples=[],valid=[];
    for(var k=0;k<pts.length;k++){var z=f15Finite(zs[k]);samples.push({name:pts[k].name,lon:pts[k].lon,lat:pts[k].lat,elevationM:z});if(z!=null)valid.push(z);}
    if(!valid.length)throw new Error('no elevation returned');
    return {type:'FIELD',state:'READY',source:'Copernicus DEM GLO-90 via Open-Meteo',samples:samples,min:Math.min.apply(null,valid),max:Math.max.apply(null,valid),coverage:cellSlug(cell)};
  });
}

function f15TileCode(lat,lon){
  var la=Math.max(-89.999999,Math.min(89.999999,Number(lat)));
  var lo=((Number(lon)+180)%360+360)%360-180;
  var lat0=Math.floor(la/3)*3,lon0=Math.floor(lo/3)*3;
  return (lat0<0?'S':'N')+String(Math.abs(lat0)).padStart(2,'0')+(lon0<0?'W':'E')+String(Math.abs(lon0)).padStart(3,'0');
}
function f15CogUrl(code){return 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_'+code+'_Map.tif';}
function f15GeoTIFF(signal){
  if(window.GeoTIFF&&window.GeoTIFF.fromUrl)return Promise.resolve(window.GeoTIFF);
  if(F15_GEOTIFF)return F15_GEOTIFF;
  F15_GEOTIFF=new Promise(function(resolve,reject){
    var s=document.createElement('script'),done=false;
    var timer=setTimeout(function(){if(done)return;done=true;reject(new Error('GeoTIFF loader timeout'));},F15_LIMITS.GEOTIFF_TIMEOUT_MS);
    s.src='https://cdn.jsdelivr.net/npm/geotiff';
    s.async=true;s.crossOrigin='anonymous';
    s.onload=function(){if(done)return;done=true;clearTimeout(timer);window.GeoTIFF&&window.GeoTIFF.fromUrl?resolve(window.GeoTIFF):reject(new Error('GeoTIFF global unavailable'));};
    s.onerror=function(){if(done)return;done=true;clearTimeout(timer);reject(new Error('GeoTIFF loader failed'));};
    document.head.appendChild(s);
  }).catch(function(e){F15_GEOTIFF=null;throw e;});
  if(signal&&signal.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
  return F15_GEOTIFF;
}
function f15CogOpen(code,signal){
  for(var i=0;i<F15_COG_CACHE.length;i++){
    if(F15_COG_CACHE[i].code===code){
      var hit=F15_COG_CACHE.splice(i,1)[0];F15_COG_CACHE.push(hit);return hit.promise;
    }
  }
  var p=f15GeoTIFF(signal).then(function(G){if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');return G.fromUrl(f15CogUrl(code));});
  F15_COG_CACHE.push({code:code,promise:p});
  if(F15_COG_CACHE.length>F15_LIMITS.CACHE_COGS)F15_COG_CACHE.splice(0,F15_COG_CACHE.length-F15_LIMITS.CACHE_COGS);
  return p;
}
function f15CoverSample(p,signal){
  var code=f15TileCode(p.lat,p.lon);
  return f15CogOpen(code,signal).then(function(t){return t.getImage(0);}).then(function(image){
    var b=image.getBoundingBox(),w=image.getWidth(),h=image.getHeight();
    var x=Math.max(0,Math.min(w-1,Math.floor((p.lon-b[0])/(b[2]-b[0])*w)));
    var y=Math.max(0,Math.min(h-1,Math.floor((b[3]-p.lat)/(b[3]-b[1])*h)));
    return image.readRasters({window:[x,y,x+1,y+1],samples:[0],interleave:true,signal:signal}).then(function(data){
      var v=f15Finite(data&&data[0]);
      return {name:p.name,lon:p.lon,lat:p.lat,classCode:v,className:F15_CLASSES[v]||('CLASS '+v),tile:code};
    });
  });
}
function f15Cover(selected,cell,signal){
  var pts=f15SamplePoints(cell),seen={},tiles=0;
  for(var i=0;i<pts.length;i++){var c=f15TileCode(pts[i].lat,pts[i].lon);if(!seen[c]){seen[c]=1;tiles++;}}
  if(tiles>F15_LIMITS.MAX_COG_TILES)return Promise.reject(new Error('COG budget '+tiles+' > '+F15_LIMITS.MAX_COG_TILES));
  F15.resources.cogs=tiles;
  var jobs=[];for(var j=0;j<pts.length;j++)jobs.push(f15CoverSample(pts[j],signal));
  return Promise.all(jobs).then(function(samples){
    var hist={};for(var k=0;k<samples.length;k++){var cc=samples[k].classCode;if(cc!=null)hist[cc]=(hist[cc]||0)+1;}
    return {type:'FIELD',state:'READY',source:'ESA WorldCover 2021 v200',samples:samples,histogram:hist,coverage:cellSlug(cell)};
  });
}

function f15Bounds(cell){
  var p=cellCorners(cell).map(lonlat),w=180,e=-180,s=90,n=-90;
  for(var i=0;i<p.length;i++){w=Math.min(w,p[i][0]);e=Math.max(e,p[i][0]);s=Math.min(s,p[i][1]);n=Math.max(n,p[i][1]);}
  return {west:w,east:e,south:s,north:n,crosses:(e-w)>180};
}
function f15Local(p,base){var d=Number(p[0])-base;d=((d+180)%360+360)%360-180;return [base+d,p[1]];}
function f15Seg(a,b,c,d){
  function o(p,q,r){return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);}
  var x1=o(a,b,c),x2=o(a,b,d),x3=o(c,d,a),x4=o(c,d,b),eps=1e-10;
  return ((x1>eps&&x2<-eps)||(x1<-eps&&x2>eps))&&((x3>eps&&x4<-eps)||(x3<-eps&&x4>eps));
}
function f15WayHits(g,cell){
  if(!Array.isArray(g)||g.length<2)return false;
  var base=lonlat(cellCentre(cell))[0],tri=cellCorners(cell).map(lonlat).map(function(p){return f15Local(p,base);}),pts=[];
  var max=Math.min(g.length,F15_LIMITS.MAX_VERTICES_PER_FEATURE);
  for(var i=0;i<max;i++){var x=f15Finite(g[i]&&g[i].lon),y=f15Finite(g[i]&&g[i].lat);if(x==null||y==null)continue;if(cellContains(cell,fromLonLat(x,y)))return true;pts.push(f15Local([x,y],base));}
  for(var j=1;j<pts.length;j++)for(var e=0;e<3;e++)if(f15Seg(pts[j-1],pts[j],tri[e],tri[(e+1)%3]))return true;
  return false;
}
function f15Geometry(selected,cell,signal){
  var b=f15Bounds(cell);
  if(b.crosses)return Promise.reject(new Error('dateline geometry query not supported'));
  var box=[b.south.toFixed(5),b.west.toFixed(5),b.north.toFixed(5),b.east.toFixed(5)].join(',');
  var q='[out:json][timeout:7];(way["power"~"^(line|minor_line)$"]('+box+');way["waterway"]('+box+'););out tags geom '+F15_LIMITS.MAX_GEOM_FEATURES+';';
  return f15Fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',Accept:'application/json'},body:'data='+encodeURIComponent(q)},signal)
  .then(function(r){return r.json();}).then(function(j){
    var els=Array.isArray(j&&j.elements)?j.elements:[],power=[],water=[],vertices=0;
    var max=Math.min(els.length,F15_LIMITS.MAX_GEOM_FEATURES);
    for(var i=0;i<max&&vertices<F15_LIMITS.MAX_VERTICES;i++){
      var el=els[i];if(!el||!Array.isArray(el.geometry)||!f15WayHits(el.geometry,cell))continue;
      var kind=el.tags&&el.tags.power?'power':(el.tags&&el.tags.waterway?'water':null);if(!kind)continue;
      var coords=[],m=Math.min(el.geometry.length,F15_LIMITS.MAX_VERTICES_PER_FEATURE);
      for(var k=0;k<m&&vertices<F15_LIMITS.MAX_VERTICES;k++){
        var lo=f15Finite(el.geometry[k]&&el.geometry[k].lon),la=f15Finite(el.geometry[k]&&el.geometry[k].lat);
        if(lo==null||la==null)continue;coords.push([lo,la]);vertices++;
      }
      if(coords.length<2)continue;
      var row={id:'osm-way:'+el.id,coordinates:coords,properties:{name:el.tags&&el.tags.name||null,power:el.tags&&el.tags.power||null,voltage:el.tags&&el.tags.voltage||null,waterway:el.tags&&el.tags.waterway||null}};
      if(kind==='power')power.push(row);else water.push(row);
    }
    F15.resources.features=power.length+water.length;F15.resources.vertices=vertices;
    var partial=els.length>=F15_LIMITS.MAX_GEOM_FEATURES||vertices>=F15_LIMITS.MAX_VERTICES;
    return {
      power:{type:'GEOMETRY',state:partial?'PARTIAL':'READY',source:'OpenStreetMap via Overpass',features:power,coverage:cellSlug(cell)},
      water:{type:'GEOMETRY',state:partial?'PARTIAL':'READY',source:'OpenStreetMap via Overpass',features:water,coverage:cellSlug(cell)}
    };
  });
}

function f15SetSourceError(name,e){
  var obj={state:'ERROR',error:String(e&&e.message||e)};
  if(name==='terrain')F15.terrain=obj;
  if(name==='cover')F15.cover=obj;
  if(name==='power')F15.power=obj;
  if(name==='water')F15.water=obj;
}
function f15RefreshState(){
  var xs=[F15.terrain,F15.cover,F15.power,F15.water],ready=0,loading=0;
  for(var i=0;i<xs.length;i++){var s=xs[i]&&xs[i].state||'LOADING';if(s==='READY'||s==='PARTIAL')ready++;else if(s==='LOADING')loading++;}
  F15.state=loading?'LOADING':ready===4?'READY':ready?'PARTIAL':'ERROR';
  f15UpdatePlate();if(typeof wake==='function')wake();
}
function f15Request(selected,force){
  selected=selected||f15Selected();if(!selected)return Promise.resolve(null);
  var tc=f15Attention(selected,F15_LIMITS.TERRAIN_MAX_KM),cc=f15Attention(selected,F15_LIMITS.COVER_MAX_KM),gc=f15Attention(selected,F15_LIMITS.GEOM_MAX_KM);
  var key=[cellSlug(selected),cellSlug(tc),cellSlug(cc),cellSlug(gc)].join('|');
  if(!force&&F15.lastRequestKey===key&&(F15.state==='LOADING'||F15.state==='READY'||F15.state==='PARTIAL'))return Promise.resolve(F15);
  F15.lastRequestKey=key;F15.generation++;var g=F15.generation;
  if(F15.abort)F15.abort.abort();F15.abort=new AbortController();
  F15.selected=selected;F15.terrainCell=tc;F15.coverCell=cc;F15.geomCell=gc;
  F15.state='LOADING';F15.resources={requests:0,cogs:0,features:0,vertices:0};
  F15.terrain={state:'LOADING'};F15.cover={state:'LOADING'};F15.power={state:'LOADING'};F15.water={state:'LOADING'};
  f15UpdatePlate();

  function current(){return g===F15.generation&&F15.abort&&!F15.abort.signal.aborted;}
  var sig=F15.abort.signal;
  var terrainJob=f15Terrain(selected,tc,sig).then(function(x){if(current())F15.terrain=x;}).catch(function(e){if(current()&&!f15AbortError(e))f15SetSourceError('terrain',e);}).finally(function(){if(current())f15RefreshState();});
  var coverJob=f15Cover(selected,cc,sig).then(function(x){if(current())F15.cover=x;}).catch(function(e){if(current()&&!f15AbortError(e))f15SetSourceError('cover',e);}).finally(function(){if(current())f15RefreshState();});
  var geomJob=f15Geometry(selected,gc,sig).then(function(x){if(current()){F15.power=x.power;F15.water=x.water;}}).catch(function(e){if(current()&&!f15AbortError(e)){f15SetSourceError('power',e);f15SetSourceError('water',e);}}).finally(function(){if(current())f15RefreshState();});
  return Promise.allSettled([terrainJob,coverJob,geomJob]).then(function(){if(current())f15RefreshState();return F15;});
}

function f15CoverSummary(){
  var h=F15.cover&&F15.cover.histogram;if(!h)return F15.cover&&F15.cover.state||'—';
  var keys=Object.keys(h).sort(function(a,b){return h[b]-h[a];}),out=[];
  for(var i=0;i<Math.min(3,keys.length);i++)out.push((F15_CLASSES[keys[i]]||keys[i])+' '+h[keys[i]]+'/'+F15.cover.samples.length);
  return out.join(' · ');
}
function f15TerrainSummary(){
  if(!F15.terrain||F15.terrain.state!=='READY')return F15.terrain&&F15.terrain.state||'—';
  return Math.round(F15.terrain.min)+'–'+Math.round(F15.terrain.max)+' m';
}
function f15GeomSummary(x){return x&&Array.isArray(x.features)?x.features.length+' · '+x.state:(x&&x.state||'—');}

function f15EnsurePlate(){
  var stage=document.getElementById('stage');if(!stage)return null;
  var el=document.getElementById('f15-earth-plate');if(el)return el;
  var style=document.createElement('style');
  style.textContent='#f15-earth-plate{position:absolute;z-index:14;left:max(12px,env(safe-area-inset-left));top:72px;min-width:210px;max-width:min(330px,72vw);background:var(--ground);border:1.5px solid var(--ink);padding:7px 8px;font-size:8px;line-height:1.55;letter-spacing:.08em;pointer-events:auto;cursor:pointer}#f15-earth-plate b{font-size:9px}#f15-earth-plate .f15dim{color:var(--muted)}#f15-earth-plate .f15err{color:var(--signal)}@media(max-width:520px){#f15-earth-plate{top:68px;min-width:170px;max-width:62vw;font-size:7px}}';
  document.head.appendChild(style);
  el=document.createElement('div');el.id='f15-earth-plate';
  el.onclick=function(){var c=F15.selected||f15Selected();if(c&&typeof openWhere==='function')openWhere(c);};
  stage.appendChild(el);return el;
}
function f15UpdatePlate(){
  var el=f15EnsurePlate();if(!el)return;
  var sel=F15.selected?cellSlug(F15.selected):'—',tc=F15.terrainCell?cellSlug(F15.terrainCell):'—',cc=F15.coverCell?cellSlug(F15.coverCell):'—',gc=F15.geomCell?cellSlug(F15.geomCell):'—';
  function cls(x){return x&&x.state==='ERROR'?' class="f15err"':'';}
  el.innerHTML='<b>F15 · EARTH WORKING SET · '+f15Esc(F15.state)+'</b>'+ 
    '<div class="f15dim">SELECTED '+f15Esc(sel)+'</div>'+ 
    '<div'+cls(F15.terrain)+'>Z · '+f15Esc(f15TerrainSummary())+' <span class="f15dim">'+f15Esc(tc)+'</span></div>'+ 
    '<div'+cls(F15.cover)+'>COVER · '+f15Esc(f15CoverSummary())+' <span class="f15dim">'+f15Esc(cc)+'</span></div>'+ 
    '<div'+cls(F15.power)+'>POWER · '+f15Esc(f15GeomSummary(F15.power))+' <span class="f15dim">'+f15Esc(gc)+'</span></div>'+ 
    '<div'+cls(F15.water)+'>WATER · '+f15Esc(f15GeomSummary(F15.water))+'</div>'+ 
    '<div class="f15dim">LIDAR · UNAVAILABLE ≠ ABSENT · '+F15.resources.requests+' REQUESTS</div>';
}

function f15WhereHTML(){
  return '<details id="f15-earth-where" open><summary>EARTH WORKING SET · '+f15Esc(F15.state)+'</summary>'+ 
    '<p><b>This triangle does not contain the dataset.</b> It selects bounded descendant working cells, and only those cells ask the external world for evidence.</p>'+ 
    '<div class="row"><b>TERRAIN · FIELD</b><span>'+f15Esc(f15TerrainSummary())+' · '+f15Esc(F15.terrainCell?cellSlug(F15.terrainCell):'—')+'</span></div>'+ 
    '<div class="row"><b>LAND COVER · FIELD</b><span>'+f15Esc(f15CoverSummary())+' · '+f15Esc(F15.coverCell?cellSlug(F15.coverCell):'—')+'</span></div>'+ 
    '<div class="row"><b>POWER · GEOMETRY</b><span>'+f15Esc(f15GeomSummary(F15.power))+'</span></div>'+ 
    '<div class="row"><b>WATER · GEOMETRY</b><span>'+f15Esc(f15GeomSummary(F15.water))+'</span></div>'+ 
    '<div class="row"><b>LIDAR · VOLUME</b><span>UNAVAILABLE · NOT AN ABSENCE CLAIM</span></div>'+ 
    '<div class="row"><b>BOUNDS</b><span>'+F15_LIMITS.FIELD_SAMPLES+' samples · '+F15_LIMITS.MAX_COG_TILES+' COGs · '+F15_LIMITS.MAX_GEOM_FEATURES+' ways · '+F15_LIMITS.MAX_VERTICES+' vertices</span></div>'+ 
    '<p style="font-size:8px;letter-spacing:.06em">COPERNICUS GLO-90 · ESA WORLDCOVER 2021 v200 10 m COG · OPENSTREETMAP/OVERPASS. FIELD SAMPLES DO NOT PROVE UNIFORMITY. MAPPED ZERO DOES NOT PROVE PHYSICAL ABSENCE.</p></details>';
}
if(typeof openWhere==='function'){
  var f15OpenWhereBase=openWhere;
  openWhere=function(cell,keep){
    var r=f15OpenWhereBase(cell,keep);
    var root=document.getElementById('panel');if(root&&cell){
      var old=document.getElementById('f15-earth-where');if(old)old.remove();
      root.insertAdjacentHTML('beforeend',f15WhereHTML());
      f15Request(cell,false);
    }
    return r;
  };
}

function f15Context(cell){
  var same=cell&&F15.selected&&cellSlug(cell)===cellSlug(F15.selected);
  function src(x){if(!x)return null;return {state:x.state||null,source:x.source||null,coverage:x.coverage||null,error:x.error||null};}
  return {version:F15_EARTH_VERSION,focus_address:cell?cellSlug(cell):null,matches_loaded_selected:!!same,state:same?F15.state:'OTHER CELL',
    semantics:{field:'sampled or range-read spatial condition, not a point event',geometry:'shape-preserving mapped line evidence',volume:'3D evidence availability state',absence:'ERROR, PARTIAL, UNAVAILABLE and OTHER CELL are not zeros'},
    terrain:same?Object.assign(src(F15.terrain)||{},{min_m:F15.terrain&&F15.terrain.min,max_m:F15.terrain&&F15.terrain.max,sample_count:F15.terrain&&F15.terrain.samples&&F15.terrain.samples.length||0}):null,
    land_cover:same?Object.assign(src(F15.cover)||{},{histogram:F15.cover&&F15.cover.histogram||null,sample_count:F15.cover&&F15.cover.samples&&F15.cover.samples.length||0}):null,
    power:same?Object.assign(src(F15.power)||{},{count:F15.power&&F15.power.features&&F15.power.features.length||0}):null,
    water:same?Object.assign(src(F15.water)||{},{count:F15.water&&F15.water.features&&F15.water.features.length||0}):null,
    lidar:same?F15.lidar:null,limits:F15_LIMITS};
}
if(typeof compileContext==='function'){
  var f15CompileBase=compileContext;
  compileContext=function(cell,operation){var x=f15CompileBase(cell,operation);x.earth=f15Context(cell);return x;};
}
if(typeof LAW==='string'&&LAW.indexOf('F15 material evidence')<0){
  LAW+=' F15 material evidence keeps FIELD, GEOMETRY and VOLUME distinct. Seven field samples do not prove uniformity. OSM mapped zeros do not prove physical absence. UNAVAILABLE LiDAR is not an absence claim.';
}

function f15Screen(lon,lat,S){
  var p=fromLonLat(lon,lat),f=faceOf(p),vv=toView(worldOf(f,baryOf(f,p)));
  if(dot(qApply(view.q,faceNormal(f)),sub([0,0,CAM_D],vv))<=0)return null;
  return project(vv,S);
}
function f15DrawCell(cell,S,color,label){
  if(!cell)return;var cs=cellCorners(cell).map(lonlat),pts=[];
  for(var i=0;i<3;i++){var sp=f15Screen(cs[i][0],cs[i][1],S);if(!sp)return;pts.push(sp);}
  ctx.save();ctx.setLineDash([5,4]);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.globalAlpha=.7;ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);ctx.lineTo(pts[1][0],pts[1][1]);ctx.lineTo(pts[2][0],pts[2][1]);ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  var c=lonlat(cellCentre(cell)),sc=f15Screen(c[0],c[1],S);if(sc){ctx.fillStyle=color;ctx.font='700 7px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(label,sc[0],sc[1]-7);}ctx.restore();
}
function f15DrawGeometry(set,S,color,width){
  if(!set||!Array.isArray(set.features))return;
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.globalAlpha=.88;ctx.lineCap='round';ctx.lineJoin='round';
  var max=Math.min(set.features.length,F15_LIMITS.MAX_GEOM_FEATURES);
  for(var i=0;i<max;i++){var g=set.features[i].coordinates,started=false;ctx.beginPath();var m=Math.min(g.length,F15_LIMITS.MAX_VERTICES_PER_FEATURE);for(var j=0;j<m;j++){var sp=f15Screen(g[j][0],g[j][1],S);if(!sp){started=false;continue;}if(!started){ctx.moveTo(sp[0],sp[1]);started=true;}else ctx.lineTo(sp[0],sp[1]);}if(started)ctx.stroke();}
  ctx.restore();
}
function f15DrawSamples(S){
  var s=F15.cover&&F15.cover.samples;if(!Array.isArray(s))return;
  ctx.save();for(var i=0;i<Math.min(s.length,F15_LIMITS.FIELD_SAMPLES);i++){var p=s[i],sp=f15Screen(p.lon,p.lat,S);if(!sp)continue;ctx.beginPath();ctx.arc(sp[0],sp[1],4.5,0,Math.PI*2);ctx.fillStyle=F15_COLORS[p.classCode]||'#121514';ctx.fill();ctx.strokeStyle='#121514';ctx.lineWidth=1;ctx.stroke();}ctx.restore();
}
function f15ScheduleFocus(){
  var c=f15Selected();if(!c)return;var slug=cellSlug(c);
  if(F15.focusCandidate===slug)return;
  F15.focusCandidate=slug;
  if(F15.focusTimer)clearTimeout(F15.focusTimer);
  F15.focusTimer=setTimeout(function(){
    F15.focusTimer=null;var now=f15Selected();if(now&&cellSlug(now)===F15.focusCandidate)f15Request(now,false);
  },F15_LIMITS.FOCUS_SETTLE_MS);
}
if(typeof drawGround==='function'){
  var f15DrawGroundBase=drawGround;
  drawGround=function(S){
    f15DrawGroundBase(S);
    f15DrawCell(F15.terrainCell,S,'rgba(18,21,20,.55)','Z');
    f15DrawCell(F15.coverCell,S,'rgba(168,70,42,.72)','FIELD');
    f15DrawCell(F15.geomCell,S,'rgba(67,61,105,.72)','GEOM');
    f15DrawGeometry(F15.water,S,'rgba(47,111,137,.95)',1.35);
    f15DrawGeometry(F15.power,S,'rgba(88,41,105,.95)',1.65);
    f15DrawSamples(S);
    f15ScheduleFocus();
  };
}

window.ICOSA_EARTH={
  version:F15_EARTH_VERSION,
  limits:F15_LIMITS,
  state:function(){return F15;},
  context:function(slug){var c=typeof slug==='string'?cellFromSlug(slug):slug;return f15Context(c||f15Selected());},
  request:function(slug){var c=typeof slug==='string'?cellFromSlug(slug):slug;return f15Request(c||f15Selected(),true);}
};

f15EnsurePlate();
setTimeout(function(){f15Request(f15Selected(),true);},120);
