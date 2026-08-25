/* GEONOSIS LIVE PUBLIC SOURCES
 * Injected inside ICOSA after the live bus/source helpers exist.
 * Every provider is attention-scoped and records what its zero can mean.
 */

var GEO_CFG = window.ICOSA_LIVE_CONFIG || {};
var GEO_TARGETS = Object.create(null);
var GEO_SOURCE_IDS = {
  nws:'nws-alerts', water:'usgs-water-latest', hydro:'usgs-3dhp-flowlines',
  fema:'fema-current-declarations', gbif:'gbif-occurrences', nyc311:'nyc-311'
};
var GEO_DEFS = {
  'nws-alerts':{kind:'weather-alert',label:'WEATHER',glyph:'WX',maxKm:800,cadence:120000},
  'usgs-water-latest':{kind:'streamflow',label:'WATER',glyph:'W',maxKm:500,cadence:300000},
  'usgs-3dhp-flowlines':{kind:'hydro-flowline',label:'HYDROGRAPHY',glyph:'H',maxKm:140,cadence:86400000},
  'fema-current-declarations':{kind:'fema-declaration',label:'DISASTER',glyph:'D',maxKm:800,cadence:600000},
  'gbif-occurrences':{kind:'biodiversity',label:'ECOLOGY',glyph:'BIO',maxKm:250,cadence:1800000},
  'nyc-311':{kind:'civic-report',label:'CIVIC',glyph:'311',maxKm:80,cadence:900000}
};

function geoIsoMs(v){
  if(v==null||v==='')return null;
  if(typeof v==='number'&&Number.isFinite(v))return v;
  var n=Number(v); if(Number.isFinite(n)&&n>100000000000)return n;
  var ms=Date.parse(String(v)); return Number.isFinite(ms)?ms:null;
}
function geoBounds(cell){
  var p=cellCorners(cell).map(lonlat),xs=p.map(function(x){return x[0];}),ys=p.map(function(x){return x[1];});
  var w=Math.min.apply(null,xs),e=Math.max.apply(null,xs);
  return {west:w,south:Math.min.apply(null,ys),east:e,north:Math.max.apply(null,ys),crossesDateline:e-w>180};
}
function geoTriangleRing(cell){var p=cellCorners(cell).map(lonlat);return [p[0],p[1],p[2],p[0]];}
function geoArcPolygon(cell){return JSON.stringify({rings:[geoTriangleRing(cell)]});}
function geoWkt(cell){return 'POLYGON(('+geoTriangleRing(cell).map(function(p){return p[0].toFixed(6)+' '+p[1].toFixed(6);}).join(',')+'))';}
function geoFetchJSON(url){
  return fetch(url,{credentials:'omit',cache:'no-store',headers:{Accept:'application/json, application/geo+json'}})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();});
}
function geoFlattenCoords(g){
  var out=[]; function walk(x){if(!Array.isArray(x))return;if(x.length>=2&&Number.isFinite(Number(x[0]))&&Number.isFinite(Number(x[1]))){out.push([Number(x[0]),Number(x[1])]);return;}for(var i=0;i<x.length;i++)walk(x[i]);}
  if(g)walk(g.coordinates); return out;
}
function geoAnchorGeometry(g,target){
  var pts=geoFlattenCoords(g),i;
  for(i=0;i<pts.length;i++)if(target&&cellContains(target.cell,fromLonLat(pts[i][0],pts[i][1])))return pts[i];
  for(i=1;i<pts.length;i++){
    var a=pts[i-1],b=pts[i],m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    if(target&&cellContains(target.cell,fromLonLat(m[0],m[1])))return m;
  }
  if(target)return lonlat(cellCentre(target.cell));
  return pts.length?pts[0]:null;
}
function geoAddressPath(g,depth){
  var pts=geoFlattenCoords(g),out=[],last=null;
  for(var i=0;i<pts.length&&out.length<64;i++){
    var s=cellSlug(cellAt(fromLonLat(pts[i][0],pts[i][1]),depth));
    if(s!==last){out.push(s);last=s;}
  }
  return out;
}
function geoCoverageMeta(t,extra){
  var m={coverageCell:t&&t.slug||null,scoped:true,coverageMode:t&&t.mode||'unknown',completeForCell:false};
  if(extra)for(var k in extra)m[k]=extra[k]; return m;
}
function geoStopSource(id,state,reason){
  var s=LIVE.sources[id]; if(!s)return;
  if(s.timer){clearTimeout(s.timer);s.timer=null;} s.state=state||'idle';s.lastError=reason||null;liveRefreshOpenPanel();
}
function geoSetTarget(id,cell,mode){
  var d=GEO_DEFS[id],s=LIVE.sources[id]; if(!cell||!d)return false;
  if(cellEdgeKm(cell)>d.maxKm){GEO_TARGETS[id]=null;geoStopSource(id,'idle','enter a smaller triangle to query '+d.label.toLowerCase());return false;}
  var slug=cellSlug(cell); if(GEO_TARGETS[id]&&GEO_TARGETS[id].slug===slug)return true;
  GEO_TARGETS[id]={cell:cell,slug:slug,mode:mode||'exact',requestedAt:Date.now()}; if(s)pollLiveSource(id); return true;
}
function geoArcQuery(base,cell,fields,limit){
  return geoFetchJSON(base+'?'+[
    'where=1%3D1','geometry='+encodeURIComponent(geoArcPolygon(cell)),'geometryType=esriGeometryPolygon','inSR=4326',
    'spatialRel=esriSpatialRelIntersects','outFields='+encodeURIComponent(fields||'*'),'returnGeometry=true','outSR=4326',
    'resultRecordCount='+(limit||250),'f=geojson'
  ].join('&'));
}

function geoRegisterNws(){
  var id=GEO_SOURCE_IDS.nws;if(LIVE.sources[id])return;
  registerLiveSource({id:id,name:'NWS active alerts',provider:'National Weather Service',cadence:GEO_DEFS[id].cadence,load:function(done){
    var t=GEO_TARGETS[id];if(!t)return done('awaiting a regional triangle');
    var points=[lonlat(cellCentre(t.cell))].concat(cellCorners(t.cell).map(lonlat));
    Promise.all(points.map(function(p){return geoFetchJSON('https://api.weather.gov/alerts/active?point='+p[1].toFixed(5)+','+p[0].toFixed(5));}))
    .then(function(all){
      var seen=Object.create(null),out=[],got=Date.now();
      all.forEach(function(j){((j&&j.features)||[]).forEach(function(f){
        var p=f.properties||{},stable=liveText(f.id)||liveText(p.id)||liveText(p['@id']);if(!stable||seen[stable])return;seen[stable]=1;
        var a=geoAnchorGeometry(f.geometry,t)||lonlat(cellCentre(t.cell));
        out.push({id:'nws:'+stable,kind:'weather-alert',lon:a[0],lat:a[1],observedAt:geoIsoMs(p.sent)||geoIsoMs(p.effective)||got,retrievedAt:got,epistemic:'REPORTED',properties:{event:liveText(p.event),severity:liveText(p.severity),certainty:liveText(p.certainty),urgency:liveText(p.urgency),headline:liveText(p.headline),area:liveText(p.areaDesc),instruction:liveText(p.instruction),description:liveText(p.description),sent:liveText(p.sent),effective:liveText(p.effective),onset:liveText(p.onset),expires:liveText(p.expires)}});
      });});
      done(null,out,geoCoverageMeta(t,{coverageMode:'sampled_center_and_vertices',samplePoints:points.length,completeForCell:false,zeroSemantics:'no active NWS alert at sampled centre/vertices; not proof of no alert anywhere in the triangle',sourceUrl:'https://api.weather.gov/alerts/active'}));
    }).catch(function(e){done(String(e&&e.message||e));});
  }});
}

function geoRegisterWater(){
  var id=GEO_SOURCE_IDS.water;if(LIVE.sources[id])return;
  registerLiveSource({id:id,name:'USGS latest streamflow',provider:'USGS Water Data for the Nation',cadence:GEO_DEFS[id].cadence,load:function(done){
    var t=GEO_TARGETS[id];if(!t)return done('awaiting a regional triangle');var b=geoBounds(t.cell);if(b.crossesDateline)return done('dateline-spanning water query not supported');
    var url='https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?f=json&limit=250&parameter_code=00060&bbox='+[b.west,b.south,b.east,b.north].map(function(x){return x.toFixed(6);}).join(',');
    geoFetchJSON(url).then(function(j){
      var feats=(j&&j.features)||[],out=[],got=Date.now();
      feats.forEach(function(f){var c=(f.geometry&&f.geometry.coordinates)||[],lon=liveFinite(c[0]),lat=liveFinite(c[1]),p=f.properties||{};if(lon==null||lat==null||!cellContains(t.cell,fromLonLat(lon,lat)))return;out.push({id:'usgs-water:'+(liveText(p.time_series_id)||liveText(f.id)||String(out.length)),kind:'streamflow',lon:lon,lat:lat,observedAt:geoIsoMs(p.time),retrievedAt:got,epistemic:'OBSERVED',properties:{site:liveText(p.monitoring_location_name),monitoringLocation:liveText(p.monitoring_location_id),value:liveFinite(p.value),unit:liveText(p.unit_of_measure),parameterCode:liveText(p.parameter_code),approvalStatus:liveText(p.approval_status),qualifier:liveText(p.qualifier),hydrologicUnit:liveText(p.hydrologic_unit_code),drainageArea:liveFinite(p.drainage_area)}});});
      var matched=liveFinite(j&&j.numberMatched),complete=matched==null?feats.length<250:matched<=250;
      done(null,out,geoCoverageMeta(t,{coverageMode:'bbox_then_exact_point_filter',completeForCell:complete,numberMatched:matched,zeroSemantics:complete?'no current USGS streamflow time-series point in this triangle':'query truncated; zero is not meaningful',parameterCode:'00060',sourceUrl:url}));
    }).catch(function(e){done(String(e&&e.message||e));});
  }});
}

function geoRegisterHydro(){
  var id=GEO_SOURCE_IDS.hydro;if(LIVE.sources[id])return;
  registerLiveSource({id:id,name:'USGS 3DHP flowlines',provider:'USGS 3D Hydrography Program',cadence:GEO_DEFS[id].cadence,load:function(done){
    var t=GEO_TARGETS[id];if(!t)return done('awaiting a local triangle');
    var base='https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer/50/query';
    geoArcQuery(base,t.cell,'OBJECTID,id3dhp,featuredate,mainstemid,gnisidlabel,featuretypelabel,lengthkm,flowdirectionlabel,streamorder,hydrosequence,dnhydrosequence,uphydrosequence,catchmentid3dhp',300)
    .then(function(j){
      var feats=(j&&j.features)||[],out=[],got=Date.now();
      feats.forEach(function(f){var p=f.properties||{},a=geoAnchorGeometry(f.geometry,t);if(!a)return;out.push({id:'3dhp:'+(liveText(p.id3dhp)||liveText(p.OBJECTID)||String(out.length)),kind:'hydro-flowline',lon:a[0],lat:a[1],observedAt:geoIsoMs(p.featuredate),retrievedAt:got,epistemic:'RECORD',properties:{name:liveText(p.gnisidlabel),featureType:liveText(p.featuretypelabel),lengthKm:liveFinite(p.lengthkm),flowDirection:liveText(p.flowdirectionlabel),streamOrder:liveFinite(p.streamorder),mainstemId:liveText(p.mainstemid),catchmentId:liveText(p.catchmentid3dhp),hydrosequence:liveFinite(p.hydrosequence),downstreamHydrosequence:liveFinite(p.dnhydrosequence),upstreamHydrosequence:liveFinite(p.uphydrosequence),addressPath:geoAddressPath(f.geometry,Math.min(10,LIVE_INDEX_DEPTH))}});});
      var truncated=feats.length>=300;done(null,out,geoCoverageMeta(t,{coverageMode:'exact_triangle_intersection',completeForCell:!truncated,truncated:truncated,zeroSemantics:!truncated?'no 3DHP flowline intersects this triangle':'query limit reached; zero is not meaningful',sourceUrl:base,dataClass:'current 3DHP where available, legacy NHD supplementation elsewhere'}));
    }).catch(function(e){done(String(e&&e.message||e));});
  }});
}

function geoRegisterFema(){
  var id=GEO_SOURCE_IDS.fema;if(LIVE.sources[id])return;
  registerLiveSource({id:id,name:'FEMA current declared counties',provider:'FEMA',cadence:GEO_DEFS[id].cadence,load:function(done){
    var t=GEO_TARGETS[id];if(!t)return done('awaiting a regional triangle');var base='https://gis.fema.gov/arcgis/rest/services/FEMA/DECS_ALL/MapServer/0/query';
    geoArcQuery(base,t.cell,'objectid,name,state_name,fips,fema_postdate,amd_date,designate,curr_amd,dec_number,dec_num,region',500)
    .then(function(j){var feats=(j&&j.features)||[],out=[],got=Date.now();feats.forEach(function(f){var p=f.properties||{},a=geoAnchorGeometry(f.geometry,t)||lonlat(cellCentre(t.cell));out.push({id:'fema-dec:'+(liveText(p.objectid)||liveText(p.fips)||String(out.length)),kind:'fema-declaration',lon:a[0],lat:a[1],observedAt:geoIsoMs(p.fema_postdate),retrievedAt:got,epistemic:'REPORTED',properties:{county:liveText(p.name),state:liveText(p.state_name),fips:liveText(p.fips),designation:liveText(p.designate),disasterNumber:liveText(p.dec_number)||liveText(p.dec_num),amendment:liveText(p.curr_amd),postDate:geoIsoMs(p.fema_postdate),amendmentDate:geoIsoMs(p.amd_date),region:liveFinite(p.region)}});});var truncated=feats.length>=500;done(null,out,geoCoverageMeta(t,{coverageMode:'exact_triangle_polygon_intersection',completeForCell:!truncated,truncated:truncated,zeroSemantics:!truncated?'no county polygon in FEMA current designated-counties layer intersects this triangle':'query limit reached',sourceUrl:base}));}).catch(function(e){done(String(e&&e.message||e));});
  }});
}

function geoRegisterGbif(){
  var id=GEO_SOURCE_IDS.gbif;if(LIVE.sources[id])return;
  registerLiveSource({id:id,name:'GBIF occurrence observations',provider:'GBIF',cadence:GEO_DEFS[id].cadence,load:function(done){
    var t=GEO_TARGETS[id];if(!t)return done('awaiting a local triangle');var b=geoBounds(t.cell);if(b.crossesDateline)return done('dateline-spanning GBIF query not supported');
    var url='https://api.gbif.org/v1/occurrence/search?limit=100&hasCoordinate=true&occurrenceStatus=PRESENT&geometry='+encodeURIComponent(geoWkt(t.cell));
    geoFetchJSON(url).then(function(j){var rows=(j&&j.results)||[],out=[],got=Date.now();rows.forEach(function(x){var lon=liveFinite(x.decimalLongitude),lat=liveFinite(x.decimalLatitude);if(lon==null||lat==null||!cellContains(t.cell,fromLonLat(lon,lat)))return;out.push({id:'gbif:'+(liveText(x.key)||liveText(x.occurrenceID)||String(out.length)),kind:'biodiversity',lon:lon,lat:lat,observedAt:geoIsoMs(x.eventDate)||geoIsoMs(x.lastInterpreted),retrievedAt:got,epistemic:'REPORTED',properties:{scientificName:liveText(x.scientificName),vernacularName:liveText(x.vernacularName),species:liveText(x.species),basisOfRecord:liveText(x.basisOfRecord),datasetTitle:liveText(x.datasetTitle),occurrenceStatus:liveText(x.occurrenceStatus),coordinateUncertaintyM:liveFinite(x.coordinateUncertaintyInMeters),eventDate:liveText(x.eventDate),recordedBy:liveText(x.recordedBy)}});});var count=liveFinite(j&&j.count),complete=!!(j&&j.endOfRecords)||count<=100;done(null,out,geoCoverageMeta(t,{coverageMode:'exact_triangle_wkt',completeForCell:complete,totalMatched:count,zeroSemantics:complete?'no GBIF occurrence record matching the query in this triangle':'only the first 100 matching GBIF occurrences are represented',sourceUrl:url}));}).catch(function(e){done(String(e&&e.message||e));});
  }});
}

function geoIntersectsNyc(cell){var b=geoBounds(cell);return !(b.east<-74.30||b.west>-73.65||b.north<40.45||b.south>40.95);}
function geoRegister311(){
  var id=GEO_SOURCE_IDS.nyc311;if(LIVE.sources[id])return;
  registerLiveSource({id:id,name:'NYC 311 service requests',provider:'NYC Open Data / 311',cadence:GEO_DEFS[id].cadence,load:function(done){
    var t=GEO_TARGETS[id];if(!t)return done('awaiting a NYC triangle');if(!geoIntersectsNyc(t.cell))return done('focus is outside NYC 311 jurisdiction');
    var b=geoBounds(t.cell),since=new Date(Date.now()-7*86400000).toISOString().slice(0,19);
    var where='created_date >= "'+since+'" AND latitude IS NOT NULL AND longitude IS NOT NULL AND latitude >= '+b.south.toFixed(6)+' AND latitude <= '+b.north.toFixed(6)+' AND longitude >= '+b.west.toFixed(6)+' AND longitude <= '+b.east.toFixed(6);
    var url='https://data.cityofnewyork.us/resource/erm2-nwe9.json?$limit=250&$order=created_date%20DESC&$where='+encodeURIComponent(where);
    geoFetchJSON(url).then(function(rows){rows=Array.isArray(rows)?rows:[];var out=[],got=Date.now();rows.forEach(function(x){var lon=liveFinite(x.longitude),lat=liveFinite(x.latitude);if(lon==null||lat==null||!cellContains(t.cell,fromLonLat(lon,lat)))return;out.push({id:'nyc311:'+(liveText(x.unique_key)||String(out.length)),kind:'civic-report',lon:lon,lat:lat,observedAt:geoIsoMs(x.created_date),retrievedAt:got,epistemic:'REPORTED',properties:{complaintType:liveText(x.complaint_type),descriptor:liveText(x.descriptor),agency:liveText(x.agency),agencyName:liveText(x.agency_name),status:liveText(x.status),resolution:liveText(x.resolution_description),borough:liveText(x.borough),incidentAddress:liveText(x.incident_address),created:liveText(x.created_date),closed:liveText(x.closed_date)}});});var complete=rows.length<250;done(null,out,geoCoverageMeta(t,{coverageMode:'bbox_then_exact_point_filter',completeForCell:complete,jurisdiction:'New York City',windowDays:7,zeroSemantics:complete?'no geocoded NYC 311 service request in this triangle during the last 7 days':'query reached 250-row cap; zero is not meaningful',sourceUrl:'https://data.cityofnewyork.us/resource/erm2-nwe9.json'}));}).catch(function(e){done(String(e&&e.message||e));});
  }});
}

function geoRegisterAll(){
  geoRegisterNws();geoRegisterWater();geoRegisterHydro();geoRegisterFema();geoRegisterGbif();geoRegister311();
  var reg=window.GEONOSIS_SOURCE_REGISTRY;if(reg&&Array.isArray(reg.sources)){
    var mapped={'usgs-water-ogc':GEO_SOURCE_IDS.water,'usgs-3dhp':GEO_SOURCE_IDS.hydro,'nws-api':GEO_SOURCE_IDS.nws,'openfema':GEO_SOURCE_IDS.fema,'gbif':GEO_SOURCE_IDS.gbif,'nyc-311':GEO_SOURCE_IDS.nyc311};
    reg.sources.forEach(function(s){if(mapped[s.id])s.adapter={state:'integrated',sourceId:mapped[s.id]};});
  }
}
setTimeout(geoRegisterAll,780);

function geoRequestAll(cell){
  if(!cell)return;
  geoSetTarget(GEO_SOURCE_IDS.nws,cell,'sampled');geoSetTarget(GEO_SOURCE_IDS.water,cell,'exact_points');
  geoSetTarget(GEO_SOURCE_IDS.hydro,cell,'exact_intersection');geoSetTarget(GEO_SOURCE_IDS.fema,cell,'exact_intersection');
  geoSetTarget(GEO_SOURCE_IDS.gbif,cell,'exact_wkt');
  if(geoIntersectsNyc(cell))geoSetTarget(GEO_SOURCE_IDS.nyc311,cell,'exact_points');else geoStopSource(GEO_SOURCE_IDS.nyc311,'idle','outside NYC 311 jurisdiction');
}
function geoSourceRows(id,cell){var s=LIVE.sources[id],t=GEO_TARGETS[id];if(!s||!t||!s.meta||s.meta.coverageCell!==cellSlug(cell))return [];return liveForCell(cell,GEO_DEFS[id].kind);}
function geoRecordLabel(r){var p=r.properties||{};if(r.kind==='weather-alert')return p.event||p.headline||'weather alert';if(r.kind==='streamflow')return (p.site||'stream gauge')+(p.value==null?'':' · '+p.value+' '+(p.unit||''));if(r.kind==='hydro-flowline')return p.name||p.featureType||'flowline';if(r.kind==='fema-declaration')return [p.county,p.state,p.disasterNumber].filter(Boolean).join(' · ')||'FEMA declaration';if(r.kind==='biodiversity')return p.vernacularName||p.species||p.scientificName||'occurrence';if(r.kind==='civic-report')return [p.complaintType,p.descriptor].filter(Boolean).join(' · ')||'311 request';return r.kind;}

function geoDrawSignals(S){
  var ids=Object.keys(GEO_DEFS),depth=Math.min(LIVE_INDEX_DEPTH,Math.max(0,depthForZoom()));ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 7px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  ids.forEach(function(id){var s=LIVE.sources[id],t=GEO_TARGETS[id];if(!s||!s.lastUpdate||!t||!s.meta||s.meta.coverageCell!==t.slug)return;var bins=live2Bins(id,depth,GEO_DEFS[id].kind);Object.keys(bins).forEach(function(slug){var c=cellFromSlug(slug),list=bins[slug];if(!c||!facingCamera(cellCentre(c)))return;var sc=liveCellScreen(c,S);if(sc.x<-25||sc.y<-25||sc.x>W+25||sc.y>H+25)return;if(depth<=6||list.length>8){ctx.fillStyle=(id===GEO_SOURCE_IDS.nws||id===GEO_SOURCE_IDS.fema)?COL.signal:COL.muted;ctx.fillText(GEO_DEFS[id].glyph+' '+list.length,sc.x,sc.y);}else for(var i=0;i<Math.min(24,list.length);i++){var r=list[i];if(!facingCamera(r.v))continue;var p=livePointScreen(r,S);if(p.x<-10||p.y<-10||p.x>W+10||p.y>H+10)continue;ctx.fillStyle=(r.kind==='weather-alert'||r.kind==='fema-declaration')?COL.signal:COL.ink;ctx.globalAlpha=.76;ctx.fillRect(p.x-1.5,p.y-1.5,3,3);ctx.globalAlpha=1;}});});ctx.restore();
}
var drawLiveGeonosisBase=drawLive;drawLive=function(S){drawLiveGeonosisBase(S);geoDrawSignals(S);};

function geoRenderPanel(cell){
  var root=document.getElementById('panel');if(!root||!root.classList.contains('open')||!cell)return;if(typeof live2RemovePanel==='function')live2RemovePanel('geonosis-signals');var total=0,body='';
  Object.keys(GEO_DEFS).forEach(function(id){var s=LIVE.sources[id],rows=geoSourceRows(id,cell),m=s&&s.meta||{},state=s?liveSourceFreshness(s):'UNAVAILABLE';if(m.coverageCell&&m.coverageCell!==cellSlug(cell))state='OTHER CELL';total+=rows.length;body+='<div class="row"><b>'+GEO_DEFS[id].label+'</b><span>'+liveEsc(state)+' · '+rows.length+' sign'+(rows.length===1?'':'s')+'</span></div>';for(var i=0;i<Math.min(3,rows.length);i++)body+='<div class="row"><b style="font-weight:400">'+liveEsc(geoRecordLabel(rows[i]))+'</b><span>'+liveEsc(rows[i].epistemic||'RECORD')+'</span></div>';});
  root.insertAdjacentHTML('beforeend','<details id="geonosis-signals"'+(total?' open':'')+'><summary>GEONOSIS · '+total+' ADDRESSED SIGNS</summary><p>Weather, water, hydrography, disaster, ecology and civic experience share the same ICOSA address bus.</p>'+body+'<p style="font-size:8px;letter-spacing:.08em">SOURCE STATE · COVERAGE · EPISTEMIC CLASS · ZERO SEMANTICS PRESERVED.</p></details>');
}
var renderLiveWhereGeonosisBase=renderLiveWhere;renderLiveWhere=function(cell){renderLiveWhereGeonosisBase(cell);geoRenderPanel(cell);};
var openWhereGeonosisBase=openWhere;openWhere=function(cell,keep){openWhereGeonosisBase(cell,keep);geoRequestAll(cell);};

window.ICOSA_LIVE.requestGeonosis=function(slug){var c=typeof slug==='string'?cellFromSlug(slug):slug;if(!c)return false;geoRequestAll(c);return true;};
window.ICOSA_LIVE.geonosisTargets=GEO_TARGETS;window.ICOSA_LIVE.geonosisSourceIds=GEO_SOURCE_IDS;
