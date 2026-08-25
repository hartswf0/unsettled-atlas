/* GEONOSIS WEATHER + TERRAIN
 * NWS: current station observation and hourly forecast remain separate records
 * with separate epistemic classes.
 * 3DEP EPQS: sampled/interpolated terrain state, explicitly DERIVED.
 */

GEO_SOURCE_IDS.weather='nws-weather-state';
GEO_SOURCE_IDS.terrain='usgs-3dep-terrain';
GEO_DEFS[GEO_SOURCE_IDS.weather]={kind:'weather-state',label:'WEATHER STATE',glyph:'MET',maxKm:120,cadence:600000};
GEO_DEFS[GEO_SOURCE_IDS.terrain]={kind:'terrain-state',label:'TERRAIN',glyph:'Z',maxKm:120,cadence:86400000};
GEONOSIS_KIND['weather-state']={predicate:'weather_state',signs:['perception','affection','potential','chronosign']};
GEONOSIS_KIND['terrain-state']={predicate:'terrain_state',signs:['material','constraint','affordance','flow']};

function geoQv(x){
  if(!x||typeof x!=='object')return null;
  return {value:liveFinite(x.value),unit:liveText(x.unitCode)||liveText(x.unit)};
}
function geoForecastPrecip(p){
  var x=p&&p.probabilityOfPrecipitation;
  return x&&liveFinite(x.value);
}
function geoRegisterWeather(){
  var id=GEO_SOURCE_IDS.weather;if(LIVE.sources[id])return;
  registerLiveSource({id:id,name:'NWS observed + hourly weather',provider:'National Weather Service',cadence:GEO_DEFS[id].cadence,load:function(done){
    var t=GEO_TARGETS[id];if(!t)return done('awaiting a local triangle');
    var c=lonlat(cellCentre(t.cell)),pointUrl='https://api.weather.gov/points/'+c[1].toFixed(5)+','+c[0].toFixed(5);
    geoFetchJSON(pointUrl).then(function(point){
      var pp=point&&point.properties||{},forecastUrl=pp.forecastHourly,stationsUrl=pp.observationStations;
      var forecastP=forecastUrl?geoFetchJSON(forecastUrl):Promise.resolve(null);
      var stationP=stationsUrl?geoFetchJSON(stationsUrl).then(function(st){
        var f=st&&st.features&&st.features[0],base=f&&(f.id||(f.properties&&f.properties['@id']));
        return base?geoFetchJSON(String(base).replace(/\/$/,'')+'/observations/latest'):null;
      }):Promise.resolve(null);
      return Promise.all([forecastP,stationP]).then(function(parts){return {point:point,forecast:parts[0],obs:parts[1],centre:c};});
    }).then(function(x){
      var out=[],got=Date.now(),fp=x.forecast&&x.forecast.properties&&x.forecast.properties.periods&&x.forecast.properties.periods[0];
      if(fp){
        out.push({id:'nws-forecast:'+cellSlug(t.cell)+':'+(liveText(fp.startTime)||got),kind:'weather-state',lon:x.centre[0],lat:x.centre[1],observedAt:geoIsoMs(fp.startTime)||got,retrievedAt:got,epistemic:'PREDICTED',properties:{mode:'forecast',startTime:liveText(fp.startTime),endTime:liveText(fp.endTime),temperature:liveFinite(fp.temperature),temperatureUnit:liveText(fp.temperatureUnit),probabilityOfPrecipitation:geoForecastPrecip(fp),windSpeed:liveText(fp.windSpeed),windDirection:liveText(fp.windDirection),shortForecast:liveText(fp.shortForecast),detailedForecast:liveText(fp.detailedForecast)}});
      }
      var o=x.obs,op=o&&o.properties||{},og=o&&o.geometry&&o.geometry.coordinates,olon=og&&liveFinite(og[0]),olat=og&&liveFinite(og[1]);
      if(o&&op){
        if(olon==null||olat==null){olon=x.centre[0];olat=x.centre[1];}
        out.push({id:'nws-observation:'+(liveText(op.station)||liveText(o.id)||cellSlug(t.cell))+':'+(liveText(op.timestamp)||got),kind:'weather-state',lon:olon,lat:olat,observedAt:geoIsoMs(op.timestamp)||got,retrievedAt:got,epistemic:'OBSERVED',properties:{mode:'observation',station:liveText(op.station),timestamp:liveText(op.timestamp),textDescription:liveText(op.textDescription),temperature:geoQv(op.temperature),dewpoint:geoQv(op.dewpoint),windDirection:geoQv(op.windDirection),windSpeed:geoQv(op.windSpeed),windGust:geoQv(op.windGust),barometricPressure:geoQv(op.barometricPressure),visibility:geoQv(op.visibility),precipitationLastHour:geoQv(op.precipitationLastHour),relativeHumidity:geoQv(op.relativeHumidity)}});
      }
      done(null,out,geoCoverageMeta(t,{coverageMode:'focus_grid_forecast_plus_nearest_observation_station',completeForCell:false,zeroSemantics:'no NWS point weather record returned near the focus; not proof of absent weather conditions',pointUrl:'https://api.weather.gov/points/{lat},{lon}',forecastResolution:'NWS forecast grid roughly 2.5 km; station observation may be delayed by QC ingest'}));
    }).catch(function(e){done(String(e&&e.message||e));});
  }});
  var reg=window.GEONOSIS_SOURCE_REGISTRY;if(reg&&Array.isArray(reg.sources))reg.sources.forEach(function(s){if(s.id==='nws-api')s.adapterWeather={state:'integrated',sourceId:id};});
}
setTimeout(geoRegisterWeather,940);

function geoTerrainPoints(cell){
  var c=lonlat(cellCentre(cell)),corn=cellCorners(cell).map(lonlat),out=[{name:'centre',p:c}];
  for(var i=0;i<3;i++)out.push({name:'corner'+i,p:corn[i]});
  for(var j=0;j<3;j++)out.push({name:'edge'+j,p:[(corn[j][0]+corn[(j+1)%3][0])/2,(corn[j][1]+corn[(j+1)%3][1])/2]});
  return out;
}
function geoEpqs(p){
  var url='https://epqs.nationalmap.gov/v1/json?x='+p[0].toFixed(7)+'&y='+p[1].toFixed(7)+'&wkid=4326&units=Meters&includeDate=true';
  return geoFetchJSON(url).then(function(j){return {value:liveFinite(j&&j.value),resolution:liveFinite(j&&j.resolution),rasterId:j&&j.rasterId,sourceDate:liveText(j&&j.sourceDate),url:url};});
}
function geoTerrainGrade(samples){
  var max=0;
  for(var i=1;i<samples.length;i++){
    if(samples[0].elevationM==null||samples[i].elevationM==null)continue;
    var km=arcKm(fromLonLat(samples[0].lon,samples[0].lat),fromLonLat(samples[i].lon,samples[i].lat));
    if(km<=0)continue;
    max=Math.max(max,Math.abs(samples[i].elevationM-samples[0].elevationM)/(km*1000)*100);
  }
  return max;
}
function geoRegisterTerrain(){
  var id=GEO_SOURCE_IDS.terrain;if(LIVE.sources[id])return;
  registerLiveSource({id:id,name:'USGS 3DEP terrain sample',provider:'USGS 3D Elevation Program / EPQS',cadence:GEO_DEFS[id].cadence,load:function(done){
    var t=GEO_TARGETS[id];if(!t)return done('awaiting a local triangle');var pts=geoTerrainPoints(t.cell);
    Promise.all(pts.map(function(x){return geoEpqs(x.p).then(function(z){return {name:x.name,lon:x.p[0],lat:x.p[1],elevationM:z.value,resolutionM:z.resolution,rasterId:z.rasterId,sourceDate:z.sourceDate};});})).then(function(samples){
      var valid=samples.filter(function(x){return x.elevationM!=null&&Number.isFinite(x.elevationM);});
      if(!valid.length)throw new Error('3DEP EPQS returned no elevation samples');
      var zs=valid.map(function(x){return x.elevationM;}),c=lonlat(cellCentre(t.cell)),res=valid.map(function(x){return x.resolutionM;}).filter(function(x){return x!=null;});
      var state={sampleCount:valid.length,samples:samples,elevationCentreM:samples[0]&&samples[0].elevationM,minElevationM:Math.min.apply(null,zs),maxElevationM:Math.max.apply(null,zs),reliefM:Math.max.apply(null,zs)-Math.min.apply(null,zs),maxCentreToSampleGradePct:geoTerrainGrade(samples),bestResolutionM:res.length?Math.min.apply(null,res):null};
      done(null,[{id:'3dep-terrain:'+t.slug,kind:'terrain-state',lon:c[0],lat:c[1],observedAt:null,retrievedAt:Date.now(),epistemic:'DERIVED',properties:state}],geoCoverageMeta(t,{coverageMode:'sampled_centre_vertices_edge_midpoints',completeForCell:false,sampleCount:valid.length,zeroSemantics:'terrain sampling is not an absence-query; missing samples mean unavailable 3DEP/EPQS coverage',sourceUrl:'https://epqs.nationalmap.gov/v1/json',method:'EPQS interpolated elevations from 3DEP dynamic elevation service'}));
    }).catch(function(e){done(String(e&&e.message||e));});
  }});
  var reg=window.GEONOSIS_SOURCE_REGISTRY;if(reg&&Array.isArray(reg.sources))reg.sources.forEach(function(s){if(s.id==='usgs-3dep-dem')s.adapter={state:'integrated_sampled',sourceId:id};});
}
setTimeout(geoRegisterTerrain,960);

function geoRequestWeatherTerrain(cell){
  [GEO_SOURCE_IDS.weather,GEO_SOURCE_IDS.terrain].forEach(function(id){var d=GEO_DEFS[id],s=LIVE.sources[id];if(!cell||!d)return;if(cellEdgeKm(cell)>d.maxKm){GEO_TARGETS[id]=null;geoStopSource(id,'idle','enter a smaller triangle to query '+d.label.toLowerCase());return;}var slug=cellSlug(cell);if(GEO_TARGETS[id]&&GEO_TARGETS[id].slug===slug)return;GEO_TARGETS[id]={cell:cell,slug:slug,mode:'sampled',requestedAt:Date.now()};if(s)pollLiveSource(id);});
}
var geoRequestAllWeatherTerrainBase=geoRequestAll;
geoRequestAll=function(cell){geoRequestAllWeatherTerrainBase(cell);geoRequestWeatherTerrain(cell);};

var geoRecordLabelWeatherTerrainBase=geoRecordLabel;
geoRecordLabel=function(r){
  if(r&&r.kind==='weather-state'){var p=r.properties||{};if(p.mode==='forecast')return ['FORECAST',p.temperature==null?null:p.temperature+'°'+(p.temperatureUnit||''),p.shortForecast,p.windSpeed].filter(Boolean).join(' · ');var t=p.temperature&&p.temperature.value;return ['OBSERVED',t==null?null:Math.round(t*10)/10+' '+(p.temperature.unit||''),p.textDescription].filter(Boolean).join(' · ');}
  if(r&&r.kind==='terrain-state'){var z=r.properties||{};return ['3DEP',z.elevationCentreM==null?null:Math.round(z.elevationCentreM)+' m',z.reliefM==null?null:'relief '+Math.round(z.reliefM)+' m',z.maxCentreToSampleGradePct==null?null:'grade ~'+z.maxCentreToSampleGradePct.toFixed(1)+'%'].filter(Boolean).join(' · ');}
  return geoRecordLabelWeatherTerrainBase(r);
};
