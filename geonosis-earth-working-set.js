/* F15 EARTH WORKING SET
 *
 * The existing Geonosis bus is record-shaped. This module adds a parallel
 * material-evidence registry whose native units are FIELD, GEOMETRY, VOLUME.
 * It never converts a raster, polyline or point-cloud availability state into
 * a fake Point record merely to fit the observation bus.
 *
 * Theory:
 * selected ICOSA ground -> bounded attention descendant -> source-specific
 * working set -> native evidence -> bounded context + map marks.
 */

var EARTH_WORKING_SET_VERSION='earth-working-set-v1';
var EARTH_LIMITS=Object.freeze({
  TERRAIN_MAX_KM:600,
  WORLDCOVER_MAX_KM:120,
  GEOMETRY_MAX_KM:160,
  FIELD_SAMPLES:7,
  MAX_COG_TILES:4,
  MAX_GEOMETRY_FEATURES:220,
  MAX_GEOMETRY_VERTICES:12000,
  MAX_VERTICES_PER_FEATURE:1200,
  MAX_CONTEXT_GEOMETRIES:10,
  REQUEST_TIMEOUT_MS:12000,
  GEOTIFF_LOAD_TIMEOUT_MS:10000,
  CACHE_COGS:4
});

var EARTH={
  selectedSlug:null,
  requestKey:null,
  generation:0,
  abort:null,
  fields:{terrain:null,worldcover:null},
  geometries:{power:null,water:null},
  volumes:{lidar:null},
  resources:{requests:0,cogTiles:0,geometryFeatures:0,geometryVertices:0},
  error:null,
  state:'IDLE'
};

var EARTH_COG_CACHE=[];
var EARTH_GEOTIFF_PROMISE=null;

var EARTH_WORLDCOVER_CLASSES=Object.freeze({
  10:'TREE COVER',20:'SHRUBLAND',30:'GRASSLAND',40:'CROPLAND',50:'BUILT-UP',
  60:'BARE / SPARSE',70:'SNOW / ICE',80:'PERMANENT WATER',90:'HERBACEOUS WETLAND',
  95:'MANGROVES',100:'MOSS / LICHEN'
});
var EARTH_WORLDCOVER_COLORS=Object.freeze({
  10:'#006400',20:'#ffbb22',30:'#ffff4c',40:'#f096ff',50:'#fa0000',
  60:'#b4b4b4',70:'#f0f0f0',80:'#0064c8',90:'#0096a0',95:'#00cf75',100:'#fae6a0'
});

function earthFinite(v){var n=Number(v);return Number.isFinite(n)?n:null;}
function earthText(v){return v==null?'':String(v);}
function earthNowIso(){return new Date().toISOString();}
function earthAbortError(e){return !!(e&&(e.name==='AbortError'||e.name==='AbortSignal'));}
function earthEsc(s){
  if(typeof geoInspectEsc==='function')return geoInspectEsc(String(s==null?'':s));
  return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});
}
function earthTimeoutController(ms){
  var controller=new AbortController();
  var timer=setTimeout(function(){controller.abort();},Math.max(1,Math.min(30000,Number(ms)||EARTH_LIMITS.REQUEST_TIMEOUT_MS)));
  return {controller:controller,clear:function(){clearTimeout(timer);}};
}
function earthLinkAbort(parent,child){
  if(!parent)return function(){};
  if(parent.aborted){child.abort();return function(){};}
  var fn=function(){child.abort();};parent.addEventListener('abort',fn,{once:true});
  return function(){try{parent.removeEventListener('abort',fn);}catch(e){}};
}
function earthFetch(url,options,parentSignal){
  var t=earthTimeoutController(EARTH_LIMITS.REQUEST_TIMEOUT_MS),unlink=earthLinkAbort(parentSignal,t.controller),opts=options||{};
  opts.signal=t.controller.signal;opts.credentials='omit';opts.cache='no-store';
  EARTH.resources.requests++;
  return fetch(url,opts).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status+' · '+url);return r;}).finally(function(){unlink();t.clear();});
}

function earthSamplePoints(cell){
  var centre=lonlat(cellCentre(cell)),corn=cellCorners(cell).map(lonlat),out=[{name:'centre',lon:centre[0],lat:centre[1]}];
  for(var i=0;i<3&&out.length<EARTH_LIMITS.FIELD_SAMPLES;i++)out.push({name:'corner'+i,lon:corn[i][0],lat:corn[i][1]});
  for(var j=0;j<3&&out.length<EARTH_LIMITS.FIELD_SAMPLES;j++){
    var a=corn[j],b=corn[(j+1)%3];
    var ax=a[0],bx=b[0];if(Math.abs(ax-bx)>180){if(ax<0)ax+=360;else bx+=360;}
    var lon=(ax+bx)/2;if(lon>180)lon-=360;
    out.push({name:'edge'+j,lon:lon,lat:(a[1]+b[1])/2});
  }
  return out.slice(0,EARTH_LIMITS.FIELD_SAMPLES);
}

function earthAttentionCell(selected,maxKm){
  if(!selected)return null;
  if(typeof geoScopeCellFor==='function')return geoScopeCellFor(selected,maxKm);
  var c=selected,anchor=cellCentre(selected),limit=Math.max(1,Number(maxKm)||1),guard=0;
  while(c&&c.depth<LIVE_INDEX_DEPTH&&cellEdgeKm(c)>limit&&guard<LIVE_INDEX_DEPTH+1){c=cellAt(anchor,c.depth+1);guard++;}
  return c;
}

function earthCoverage(selected,cell,mode,complete,zeroSemantics){
  return {
    selectedCell:selected?cellSlug(selected):null,
    coverageCell:cell?cellSlug(cell):null,
    coverageEdgeKm:cell?+cellEdgeKm(cell).toFixed(2):null,
    mode:mode,
    completeForCoverage:!!complete,
    zeroSemantics:zeroSemantics||'no absence claim defined'
  };
}

function earthLoadGeoTIFF(signal){
  if(window.GeoTIFF&&window.GeoTIFF.fromUrl)return Promise.resolve(window.GeoTIFF);
  if(EARTH_GEOTIFF_PROMISE)return EARTH_GEOTIFF_PROMISE;
  EARTH_GEOTIFF_PROMISE=new Promise(function(resolve,reject){
    var existing=document.querySelector('script[data-earth-geotiff]');
    if(existing){existing.addEventListener('load',function(){window.GeoTIFF?resolve(window.GeoTIFF):reject(new Error('GeoTIFF global missing'));},{once:true});existing.addEventListener('error',function(){reject(new Error('GeoTIFF.js failed to load'));},{once:true});return;}
    var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/geotiff@3.0.5/dist-browser/geotiff.js';s.async=true;s.crossOrigin='anonymous';s.setAttribute('data-earth-geotiff','1');
    var timer=setTimeout(function(){reject(new Error('GeoTIFF.js load timeout'));},EARTH_LIMITS.GEOTIFF_LOAD_TIMEOUT_MS);
    s.onload=function(){clearTimeout(timer);window.GeoTIFF?resolve(window.GeoTIFF):reject(new Error('GeoTIFF global missing'));};
    s.onerror=function(){clearTimeout(timer);reject(new Error('GeoTIFF.js failed to load'));};
    document.head.appendChild(s);
  }).catch(function(e){EARTH_GEOTIFF_PROMISE=null;throw e;});
  if(signal&&signal.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
  return EARTH_GEOTIFF_PROMISE;
}

function earthTileCode(lat,lon){
  var la=Math.max(-89.999999,Math.min(89.999999,Number(lat))),lo=Number(lon);
  while(lo<-180)lo+=360;while(lo>=180)lo-=360;
  var lat0=Math.floor(la/3)*3,lon0=Math.floor(lo/3)*3;
  var ns=lat0<0?'S':'N',ew=lon0<0?'W':'E';
  var alat=String(Math.abs(lat0)).padStart(2,'0'),alon=String(Math.abs(lon0)).padStart(3,'0');
  return {code:ns+alat+ew+alon,lat0:lat0,lon0:lon0};
}
function earthWorldCoverUrl(code){return 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_'+code+'_Map.tif';}
function earthCogCacheGet(code){
  for(var i=0;i<EARTH_COG_CACHE.length;i++)if(EARTH_COG_CACHE[i].code===code){var x=EARTH_COG_CACHE.splice(i,1)[0];EARTH_COG_CACHE.push(x);return x.promise;}
  return null;
}
function earthCogCachePut(code,promise){
  EARTH_COG_CACHE.push({code:code,promise:promise});
  while(EARTH_COG_CACHE.length>EARTH_LIMITS.CACHE_COGS)EARTH_COG_CACHE.shift();
}
function earthOpenCog(code,signal){
  var cached=earthCogCacheGet(code);if(cached)return cached;
  var p=earthLoadGeoTIFF(signal).then(function(G){if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');return G.fromUrl(earthWorldCoverUrl(code));});
  earthCogCachePut(code,p);return p;
}

function earthSampleWorldCoverPoint(point,signal){
  var tile=earthTileCode(point.lat,point.lon),url=earthWorldCoverUrl(tile.code);
  return earthOpenCog(tile.code,signal).then(function(tiff){
    return tiff.getImage(0).then(function(image){
      var bbox=image.getBoundingBox(),w=image.getWidth(),h=image.getHeight();
      var x=Math.floor((point.lon-bbox[0])/(bbox[2]-bbox[0])*w);
      var y=Math.floor((bbox[3]-point.lat)/(bbox[3]-bbox[1])*h);
      x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));
      return image.readRasters({window:[x,y,x+1,y+1],samples:[0],interleave:true,signal:signal}).then(function(data){
        var code=earthFinite(data&&data[0]);
        return {name:point.name,lon:point.lon,lat:point.lat,classCode:code,className:EARTH_WORLDCOVER_CLASSES[code]||('CLASS '+code),tile:tile.code,url:url,pixel:[x,y]};
      });
    });
  });
}

function earthRequestWorldCover(selected,cell,signal){
  var points=earthSamplePoints(cell),tiles={},tileCount=0;
  for(var i=0;i<points.length;i++){var tc=earthTileCode(points[i].lat,points[i].lon).code;if(!tiles[tc]){tiles[tc]=1;tileCount++;}}
  if(tileCount>EARTH_LIMITS.MAX_COG_TILES)throw new Error('WorldCover working set requires '+tileCount+' COGs; hard limit '+EARTH_LIMITS.MAX_COG_TILES);
  EARTH.resources.cogTiles=tileCount;
  var jobs=[];for(var j=0;j<points.length;j++)jobs.push(earthSampleWorldCoverPoint(points[j],signal));
  return Promise.all(jobs).then(function(samples){
    var hist={};for(var k=0;k<samples.length;k++){var c=samples[k].classCode;if(c==null)continue;hist[c]=(hist[c]||0)+1;}
    return {type:'FIELD',id:'esa-worldcover-2021',state:'READY',semantic:'categorical land cover',epistemic:'MAPPED_FIELD',source:'ESA WorldCover 2021 v200',retrievedAt:earthNowIso(),nativeResolutionM:10,resampling:'nearest pixel only',samples:samples,histogram:hist,coverage:earthCoverage(selected,cell,'seven-point categorical COG sample',false,'sample count zero is not evidence of land-cover absence')};
  });
}

function earthRequestTerrain(selected,cell,signal){
  var pts=earthSamplePoints(cell),lat=[],lon=[];
  for(var i=0;i<pts.length;i++){lat.push(pts[i].lat.toFixed(7));lon.push(pts[i].lon.toFixed(7));}
  var url='https://api.open-meteo.com/v1/elevation?latitude='+encodeURIComponent(lat.join(','))+'&longitude='+encodeURIComponent(lon.join(','));
  return earthFetch(url,{headers:{Accept:'application/json'}},signal).then(function(r){return r.json();}).then(function(j){
    var zs=Array.isArray(j&&j.elevation)?j.elevation:[],samples=[],valid=[];
    for(var k=0;k<pts.length;k++){var z=earthFinite(zs[k]);samples.push({name:pts[k].name,lon:pts[k].lon,lat:pts[k].lat,elevationM:z});if(z!=null)valid.push(z);}
    if(!valid.length)throw new Error('GLO-90 elevation returned no valid samples');
    var min=Math.min.apply(null,valid),max=Math.max.apply(null,valid);
    return {type:'FIELD',id:'copernicus-glo90',state:'READY',semantic:'continuous terrain elevation',epistemic:'DERIVED_FIELD',source:'Copernicus DEM 2021 GLO-90 via Open-Meteo',retrievedAt:earthNowIso(),nativeResolutionM:90,samples:samples,minElevationM:min,maxElevationM:max,reliefM:max-min,coverage:earthCoverage(selected,cell,'seven-point terrain sample',false,'missing terrain samples mean unavailable service/coverage, never flat terrain')};
  });
}

function earthBounds(cell){
  var p=cellCorners(cell).map(lonlat),west=180,east=-180,south=90,north=-90;
  for(var i=0;i<p.length;i++){west=Math.min(west,p[i][0]);east=Math.max(east,p[i][0]);south=Math.min(south,p[i][1]);north=Math.max(north,p[i][1]);}
  return {west:west,east:east,south:south,north:north,crossesDateline:(east-west)>180};
}
function earthSegmentIntersect(a,b,c,d){
  function orient(p,q,r){return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);}
  var o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b),eps=1e-10;
  return ((o1>eps&&o2<-eps)||(o1<-eps&&o2>eps))&&((o3>eps&&o4<-eps)||(o3<-eps&&o4>eps));
}
function earthLocalXY(p,baseLon){var x=p[0];while(x-baseLon>180)x-=360;while(x-baseLon<-180)x+=360;return [x,p[1]];}
function earthWayHitsCell(geom,cell){
  if(!Array.isArray(geom)||!geom.length)return false;
  var centre=lonlat(cellCentre(cell)),base=centre[0],tri=cellCorners(cell).map(lonlat).map(function(p){return earthLocalXY(p,base);});
  var max=Math.min(geom.length,EARTH_LIMITS.MAX_VERTICES_PER_FEATURE),pts=[];
  for(var i=0;i<max;i++){
    var g=geom[i],lon=earthFinite(g&&g.lon),lat=earthFinite(g&&g.lat);if(lon==null||lat==null)continue;
    if(cellContains(cell,fromLonLat(lon,lat)))return true;pts.push(earthLocalXY([lon,lat],base));
  }
  for(var j=1;j<pts.length;j++)for(var e=0;e<3;e++)if(earthSegmentIntersect(pts[j-1],pts[j],tri[e],tri[(e+1)%3]))return true;
  return false;
}
function earthNormalizeWay(el,kind,cell,budget){
  if(!el||!Array.isArray(el.geometry)||!earthWayHitsCell(el.geometry,cell))return null;
  var geom=[],max=Math.min(el.geometry.length,EARTH_LIMITS.MAX_VERTICES_PER_FEATURE);
  for(var i=0;i<max&&budget.vertices<EARTH_LIMITS.MAX_GEOMETRY_VERTICES;i++){
    var p=el.geometry[i],lon=earthFinite(p&&p.lon),lat=earthFinite(p&&p.lat);if(lon==null||lat==null)continue;geom.push([lon,lat]);budget.vertices++;
  }
  if(geom.length<2)return null;
  return {id:'osm-way:'+el.id,type:'GEOMETRY',geometryType:'LineString',kind:kind,coordinates:geom,properties:{name:earthText(el.tags&&el.tags.name)||null,power:earthText(el.tags&&el.tags.power)||null,voltage:earthText(el.tags&&el.tags.voltage)||null,waterway:earthText(el.tags&&el.tags.waterway)||null,operator:earthText(el.tags&&el.tags.operator)||null},source:'OpenStreetMap via Overpass',epistemic:'MAPPED_GEOMETRY'};
}
function earthRequestGeometries(selected,cell,signal){
  var b=earthBounds(cell);if(b.crossesDateline)throw new Error('Overpass dateline-spanning attention cell is not supported');
  var box=[b.south.toFixed(6),b.west.toFixed(6),b.north.toFixed(6),b.east.toFixed(6)].join(',');
  var q='[out:json][timeout:10];(way["power"~"^(line|minor_line)$"]('+box+');way["waterway"]('+box+'););out tags geom('+box+') '+EARTH_LIMITS.MAX_GEOMETRY_FEATURES+';';
  var body='data='+encodeURIComponent(q);
  return earthFetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',Accept:'application/json'},body:body},signal).then(function(r){return r.json();}).then(function(j){
    var els=Array.isArray(j&&j.elements)?j.elements:[],power=[],water=[],budget={vertices:0},max=Math.min(els.length,EARTH_LIMITS.MAX_GEOMETRY_FEATURES);
    for(var i=0;i<max;i++){
      var el=els[i],kind=el&&el.tags&&el.tags.power?'power':(el&&el.tags&&el.tags.waterway?'water':null);if(!kind)continue;
      var x=earthNormalizeWay(el,kind,cell,budget);if(!x)continue;if(kind==='power')power.push(x);else water.push(x);
      if(budget.vertices>=EARTH_LIMITS.MAX_GEOMETRY_VERTICES)break;
    }
    EARTH.resources.geometryFeatures=power.length+water.length;EARTH.resources.geometryVertices=budget.vertices;
    var truncated=els.length>=EARTH_LIMITS.MAX_GEOMETRY_FEATURES||budget.vertices>=EARTH_LIMITS.MAX_GEOMETRY_VERTICES;
    var common={type:'GEOMETRY_SET',state:truncated?'PARTIAL':'READY',source:'OpenStreetMap via Overpass',retrievedAt:earthNowIso(),coverage:earthCoverage(selected,cell,'bbox query then triangle intersection filter',!truncated,truncated?'result hit a hard feature/vertex budget; zero has no absence meaning':'zero means only: no OSM-mapped matching way returned for this exact bounded query')};
    return {power:Object.assign({id:'osm-power-lines',semantic:'mapped power line geometry',features:power},common),water:Object.assign({id:'osm-waterways',semantic:'mapped waterway geometry',features:water},common)};
  });
}

function earthVolumeState(selected){
  return {type:'VOLUME',id:'lidar-point-cloud',state:'UNAVAILABLE',semantic:'3D point-cloud evidence',epistemic:'AVAILABILITY',source:null,retrievedAt:earthNowIso(),reason:'No general open browser-safe LiDAR/COPC source is configured for this geography.',coverage:earthCoverage(selected,null,'availability only',false,'UNAVAILABLE is not evidence that LiDAR does not exist')};
}

function earthResetFor(selected){
  EARTH.generation++;if(EARTH.abort)EARTH.abort.abort();EARTH.abort=new AbortController();
  EARTH.selectedSlug=selected?cellSlug(selected):null;EARTH.error=null;EARTH.state='LOADING';
  EARTH.fields.terrain=null;EARTH.fields.worldcover=null;EARTH.geometries.power=null;EARTH.geometries.water=null;EARTH.volumes.lidar=earthVolumeState(selected);
  EARTH.resources={requests:0,cogTiles:0,geometryFeatures:0,geometryVertices:0};
  return {generation:EARTH.generation,signal:EARTH.abort.signal};
}
function earthSameGeneration(g){return g===EARTH.generation&&EARTH.abort&&!EARTH.abort.signal.aborted;}

function earthRequestAll(selected,force){
  selected=selected||(typeof geoScopeSelectedCell==='function'?geoScopeSelectedCell():focusCell());if(!selected)return Promise.resolve(null);
  var terrainCell=earthAttentionCell(selected,EARTH_LIMITS.TERRAIN_MAX_KM),coverCell=earthAttentionCell(selected,EARTH_LIMITS.WORLDCOVER_MAX_KM),geomCell=earthAttentionCell(selected,EARTH_LIMITS.GEOMETRY_MAX_KM);
  var key=[cellSlug(selected),terrainCell&&cellSlug(terrainCell),coverCell&&cellSlug(coverCell),geomCell&&cellSlug(geomCell)].join('|');
  if(!force&&EARTH.requestKey===key&&(EARTH.state==='READY'||EARTH.state==='PARTIAL'||EARTH.state==='LOADING'))return Promise.resolve(EARTH);
  EARTH.requestKey=key;var run=earthResetFor(selected),g=run.generation,signal=run.signal,jobs=[];

  jobs.push(earthRequestTerrain(selected,terrainCell,signal).then(function(x){if(earthSameGeneration(g))EARTH.fields.terrain=x;}).catch(function(e){if(earthSameGeneration(g)&&!earthAbortError(e))EARTH.fields.terrain={type:'FIELD',id:'copernicus-glo90',state:'ERROR',error:String(e&&e.message||e),coverage:earthCoverage(selected,terrainCell,'seven-point terrain sample',false)};}));
  jobs.push(earthRequestWorldCover(selected,coverCell,signal).then(function(x){if(earthSameGeneration(g))EARTH.fields.worldcover=x;}).catch(function(e){if(earthSameGeneration(g)&&!earthAbortError(e))EARTH.fields.worldcover={type:'FIELD',id:'esa-worldcover-2021',state:'ERROR',error:String(e&&e.message||e),coverage:earthCoverage(selected,coverCell,'seven-point categorical COG sample',false)};}));
  jobs.push(earthRequestGeometries(selected,geomCell,signal).then(function(x){if(earthSameGeneration(g)){EARTH.geometries.power=x.power;EARTH.geometries.water=x.water;}}).catch(function(e){if(earthSameGeneration(g)&&!earthAbortError(e)){var er={type:'GEOMETRY_SET',state:'ERROR',error:String(e&&e.message||e),coverage:earthCoverage(selected,geomCell,'bounded OSM geometry query',false)};EARTH.geometries.power=Object.assign({id:'osm-power-lines',features:[]},er);EARTH.geometries.water=Object.assign({id:'osm-waterways',features:[]},er);}}));

  earthRefreshUI();
  return Promise.all(jobs).then(function(){
    if(!earthSameGeneration(g))return EARTH;
    var states=[EARTH.fields.terrain,EARTH.fields.worldcover,EARTH.geometries.power,EARTH.geometries.water].map(function(x){return x&&x.state||'ERROR';});
    EARTH.state=states.every(function(s){return s==='READY';})?'READY':states.some(function(s){return s==='READY'||s==='PARTIAL';})?'PARTIAL':'ERROR';
    EARTH.error=EARTH.state==='ERROR'?'all material evidence requests failed':null;earthRefreshUI();if(typeof wake==='function')wake();return EARTH;
  });
}

function earthHistogramText(field){
  if(!field||!field.histogram)return '—';var a=[];Object.keys(field.histogram).sort(function(x,y){return field.histogram[y]-field.histogram[x];}).forEach(function(code){a.push((EARTH_WORLDCOVER_CLASSES[code]||code)+' '+field.histogram[code]+'/'+field.samples.length);});return a.slice(0,4).join(' · ');
}
function earthGeometryExamples(set){
  var out=[],f=set&&set.features||[],max=Math.min(f.length,EARTH_LIMITS.MAX_CONTEXT_GEOMETRIES);
  for(var i=0;i<max;i++){var p=f[i].properties||{};out.push({id:f[i].id,name:p.name||null,power:p.power||null,voltage:p.voltage||null,waterway:p.waterway||null,operator:p.operator||null,vertices:f[i].coordinates.length});}
  return out;
}
function earthContext(cell){
  var slug=cell?cellSlug(cell):null,matches=slug&&EARTH.selectedSlug===slug;
  function field(x){if(!x)return null;return {type:x.type,id:x.id,state:x.state,semantic:x.semantic||null,epistemic:x.epistemic||null,source:x.source||null,native_resolution_m:x.nativeResolutionM||null,coverage:x.coverage||null,sample_count:x.samples&&x.samples.length||0,min_elevation_m:x.minElevationM,max_elevation_m:x.maxElevationM,relief_m:x.reliefM,histogram:x.histogram||null,error:x.error||null};}
  function geom(x){if(!x)return null;return {type:x.type,id:x.id,state:x.state,semantic:x.semantic||null,source:x.source||null,coverage:x.coverage||null,count:x.features&&x.features.length||0,examples:earthGeometryExamples(x),error:x.error||null};}
  return {version:EARTH_WORKING_SET_VERSION,focus_address:slug,matches_loaded_selected:!!matches,state:matches?EARTH.state:'OTHER CELL',semantics:{field:'a spatial condition sampled or read from a field without pretending it is a point observation',geometry:'shape-preserving mapped geometry; examples are summaries and raw coordinates are not placed in model context',volume:'hierarchically refinable 3D evidence or an explicit availability state',absence:'UNAVAILABLE, ERROR, PARTIAL, OTHER CELL and NOT QUERIED are never zeros; OSM zero only describes the bounded map query; seven field samples never prove uniformity'},fields:{terrain:matches?field(EARTH.fields.terrain):null,worldcover:matches?field(EARTH.fields.worldcover):null},geometries:{power:matches?geom(EARTH.geometries.power):null,water:matches?geom(EARTH.geometries.water):null},volumes:{lidar:matches?EARTH.volumes.lidar:null},resources:matches?Object.assign({},EARTH.resources):null,limits:EARTH_LIMITS};
}

function earthPanelHTML(cell){
  var c=earthContext(cell),terrain=c.fields.terrain,cover=c.fields.worldcover,power=c.geometries.power,water=c.geometries.water,lidar=c.volumes.lidar;
  function st(x){return x?x.state:'LOADING';}
  var terrainTxt=terrain&&terrain.state==='READY'?Math.round(terrain.min_elevation_m)+'–'+Math.round(terrain.max_elevation_m)+' m · relief '+Math.round(terrain.relief_m)+' m':st(terrain);
  var coverTxt=cover&&cover.state==='READY'?earthHistogramText(EARTH.fields.worldcover):st(cover);
  var pTxt=power?(power.count+' ways · '+power.state):'LOADING',wTxt=water?(water.count+' ways · '+water.state):'LOADING';
  return '<details id="earth-working-set" open><summary>F15 · EARTH WORKING SET · '+earthEsc(c.state)+'</summary>'+
    '<p><b>The triangle asks the ground.</b> Fields stay fields, lines stay lines, and a missing volume stays unavailable. Nothing below is converted into a fake point record.</p>'+
    '<div class="row"><b>TERRAIN · FIELD</b><span>'+earthEsc(terrainTxt)+'</span></div>'+
    '<div class="row"><b>LAND COVER · FIELD</b><span>'+earthEsc(coverTxt)+'</span></div>'+
    '<div class="row"><b>POWER · GEOMETRY</b><span>'+earthEsc(pTxt)+'</span></div>'+
    '<div class="row"><b>WATER · GEOMETRY</b><span>'+earthEsc(wTxt)+'</span></div>'+
    '<div class="row"><b>LIDAR · VOLUME</b><span>'+earthEsc(lidar?lidar.state:'UNAVAILABLE')+'</span></div>'+
    '<div class="row"><b>WORKING SET</b><span>'+earthEsc(EARTH.resources.requests+' requests · '+EARTH.resources.cogTiles+' COGs · '+EARTH.resources.geometryVertices+' geometry vertices')+'</span></div>'+
    '<p style="font-size:8px;letter-spacing:.06em">WORLD COVER 2021 v200 · 10 m COG · NEAREST PIXEL · COPERNICUS GLO-90 · 90 m · OSM/OVERPASS · BOUNDED DESCENDANT QUERIES. LIDAR UNAVAILABLE IS NOT LIDAR ABSENCE.</p></details>';
}

function earthRefreshUI(){
  if(typeof liveRefreshOpenPanel==='function')liveRefreshOpenPanel();if(typeof geoScopeUpdatePlate==='function')geoScopeUpdatePlate();if(typeof wake==='function')wake();
}

if(typeof renderLiveWhere==='function'){
  var earthRenderWhereBase=renderLiveWhere;
  renderLiveWhere=function(cell){earthRenderWhereBase(cell);var root=document.getElementById('panel');if(!root||!root.classList.contains('open')||!cell)return;var old=document.getElementById('earth-working-set');if(old)old.remove();root.insertAdjacentHTML('beforeend',earthPanelHTML(cell));};
}

if(typeof liveCtxBuild==='function'){
  var earthCtxBase=liveCtxBuild;
  liveCtxBuild=function(cell){var x=earthCtxBase(cell);x.earth=earthContext(cell);return x;};
}
var EARTH_CONTEXT_LAW=' When context.live.earth is present, FIELD, GEOMETRY and VOLUME are distinct evidence forms. Seven terrain or land-cover samples do not prove uniformity across a triangle. WorldCover is a 2021 mapped categorical field and must not be treated as current observation. OSM geometry is a mapped record; a successful zero means only no matching OSM way was returned in that bounded query. UNAVAILABLE LiDAR is not evidence that no LiDAR exists. Never convert an unavailable, partial, stale, error or other-cell material source into an absence claim.';
if(typeof LAW==='string'&&LAW.indexOf('context.live.earth is present')<0)LAW+=EARTH_CONTEXT_LAW;

if(typeof geoScopeRequestAll==='function'){
  var earthScopeRequestBase=geoScopeRequestAll;
  geoScopeRequestAll=function(selected){earthScopeRequestBase(selected);earthRequestAll(selected,false);};
  if(typeof geoRequestAll==='function')geoRequestAll=geoScopeRequestAll;
}

if(typeof geoScopeUpdatePlate==='function'){
  var earthPlateBase=geoScopeUpdatePlate;
  geoScopeUpdatePlate=function(){earthPlateBase();var el=document.getElementById('geonosis-map-plate');if(!el)return;var old=el.querySelector('[data-earth-working-set]');if(old)old.remove();var s=document.createElement('span');s.setAttribute('data-earth-working-set','1');var p=EARTH.geometries.power&&EARTH.geometries.power.features||[],w=EARTH.geometries.water&&EARTH.geometries.water.features||[];s.textContent='EARTH · '+EARTH.state+' · PWR '+p.length+' · H2O '+w.length+' · COG '+EARTH.resources.cogTiles;el.appendChild(s);};
  if(typeof geoInspectUpdatePlate!=='undefined')geoInspectUpdatePlate=geoScopeUpdatePlate;
}

function earthScreen(lon,lat,S){
  var p=fromLonLat(lon,lat),f=faceOf(p),vv=toView(worldOf(f,baryOf(f,p)));
  if(dot(qApply(view.q,faceNormal(f)),sub([0,0,CAM_D],vv))<=0)return null;
  return project(vv,S);
}
function earthDrawGeometrySet(set,S,color,width){
  if(!set||!Array.isArray(set.features))return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.globalAlpha=.74;ctx.lineJoin='round';ctx.lineCap='round';
  var max=Math.min(set.features.length,EARTH_LIMITS.MAX_GEOMETRY_FEATURES);
  for(var i=0;i<max;i++){var pts=set.features[i].coordinates,started=false;ctx.beginPath();var pvmax=Math.min(pts.length,EARTH_LIMITS.MAX_VERTICES_PER_FEATURE);for(var j=0;j<pvmax;j++){var sp=earthScreen(pts[j][0],pts[j][1],S);if(!sp){started=false;continue;}if(!started){ctx.moveTo(sp[0],sp[1]);started=true;}else ctx.lineTo(sp[0],sp[1]);}if(started)ctx.stroke();}
  ctx.restore();
}
function earthDrawFieldSamples(field,S){
  if(!field||field.state!=='READY'||!Array.isArray(field.samples))return;ctx.save();var max=Math.min(field.samples.length,EARTH_LIMITS.FIELD_SAMPLES);for(var i=0;i<max;i++){var p=field.samples[i],sp=earthScreen(p.lon,p.lat,S);if(!sp)continue;var color=EARTH_WORLDCOVER_COLORS[p.classCode]||'#121514';ctx.beginPath();ctx.arc(sp[0],sp[1],4.2,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#121514';ctx.lineWidth=1;ctx.stroke();}ctx.restore();
}
if(typeof drawGround==='function'){
  var earthDrawGroundBase=drawGround;
  drawGround=function(S){
    earthDrawGeometrySet(EARTH.geometries.water,S,'rgba(54,106,132,.92)',1.25);
    earthDrawGeometrySet(EARTH.geometries.power,S,'rgba(103,52,116,.96)',1.6);
    earthDrawFieldSamples(EARTH.fields.worldcover,S);
    earthDrawGroundBase(S);
  };
}

window.ICOSA_EARTH={
  version:EARTH_WORKING_SET_VERSION,
  limits:EARTH_LIMITS,
  state:function(){return {version:EARTH_WORKING_SET_VERSION,state:EARTH.state,selected:EARTH.selectedSlug,requestKey:EARTH.requestKey,fields:EARTH.fields,geometries:EARTH.geometries,volumes:EARTH.volumes,resources:Object.assign({},EARTH.resources),error:EARTH.error};},
  context:function(slug){var c=typeof slug==='string'?cellFromSlug(slug):slug;return c?earthContext(c):null;},
  request:function(slug){var c=typeof slug==='string'?cellFromSlug(slug):slug;c=c||(typeof geoScopeSelectedCell==='function'?geoScopeSelectedCell():focusCell());return earthRequestAll(c,true);}
};
if(window.ICOSA_LIVE){window.ICOSA_LIVE.earth=window.ICOSA_EARTH;window.ICOSA_LIVE.earthContext=function(slug){return window.ICOSA_EARTH.context(slug);};}

setTimeout(function(){var c=typeof geoScopeSelectedCell==='function'?geoScopeSelectedCell():focusCell();earthRequestAll(c,false);},375);
