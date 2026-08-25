/* GEONOSIS AIRNOW · current/preliminary air-quality observations, BYOK. */

GEO_SOURCE_IDS.airnow='airnow-current';
GEO_DEFS[GEO_SOURCE_IDS.airnow]={kind:'air-quality',label:'AIR',glyph:'AQ',maxKm:160,cadence:180000};

function geoAirNowKey(){
  var k=liveText(GEO_CFG.airNowApiKey);if(k)return k;
  try{return liveText(localStorage.getItem('ICOSA_AIRNOW_API_KEY'));}catch(e){return null;}
}
function geoRegisterAirNow(){
  var id=GEO_SOURCE_IDS.airnow;if(LIVE.sources[id])return;
  registerLiveSource({id:id,name:'AirNow current observations',provider:'AirNow',cadence:GEO_DEFS[id].cadence,load:function(done){
    var t=GEO_TARGETS[id],key=geoAirNowKey();if(!t)return done('awaiting a local triangle');if(!key)return done('AirNow API key not configured');
    var p=lonlat(cellCentre(t.cell)),dist=Math.round(clamp(cellEdgeKm(t.cell)*.75,25,100));
    var url='https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude='+p[1].toFixed(5)+'&longitude='+p[0].toFixed(5)+'&distance='+dist+'&API_KEY='+encodeURIComponent(key);
    geoFetchJSON(url).then(function(rows){
      rows=Array.isArray(rows)?rows:[];var out=[],got=Date.now();
      rows.forEach(function(x,i){
        var lon=liveFinite(x.Longitude),lat=liveFinite(x.Latitude);if(lon==null||lat==null){lon=p[0];lat=p[1];}
        out.push({id:'airnow:'+[(x.ReportingArea||''),(x.ParameterName||''),(x.DateObserved||''),(x.HourObserved||''),i].join(':'),kind:'air-quality',lon:lon,lat:lat,observedAt:geoIsoMs(x.DateObserved),retrievedAt:got,epistemic:'OBSERVED_PRELIMINARY',properties:{parameter:liveText(x.ParameterName),aqi:liveFinite(x.AQI),category:x.Category&&liveText(x.Category.Name),reportingArea:liveText(x.ReportingArea),stateCode:liveText(x.StateCode),distanceKm:dist,dateObserved:liveText(x.DateObserved),hourObserved:liveFinite(x.HourObserved),localTimeZone:liveText(x.LocalTimeZone)}});
      });
      done(null,out,geoCoverageMeta(t,{coverageMode:'nearest_reporting_area_within_radius',completeForCell:false,radiusKm:dist,zeroSemantics:'no AirNow reporting-area observation returned near the focus; not proof of clean air or no monitors',sourceUrl:'AirNow latLong/current'}));
    }).catch(function(e){done(String(e&&e.message||e));});
  }});
  var reg=window.GEONOSIS_SOURCE_REGISTRY;if(reg&&Array.isArray(reg.sources))reg.sources.forEach(function(s){if(s.id==='airnow')s.adapter={state:'integrated_byok',sourceId:id};});
}
setTimeout(geoRegisterAirNow,900);

function geoRequestAirNow(cell){
  var id=GEO_SOURCE_IDS.airnow,s=LIVE.sources[id],d=GEO_DEFS[id];if(!cell||!d)return;
  if(cellEdgeKm(cell)>d.maxKm){GEO_TARGETS[id]=null;geoStopSource(id,'idle','enter a smaller triangle to query air quality');return;}
  var slug=cellSlug(cell);if(!GEO_TARGETS[id]||GEO_TARGETS[id].slug!==slug)GEO_TARGETS[id]={cell:cell,slug:slug,mode:'sampled',requestedAt:Date.now()};
  if(!s)return;
  if(!geoAirNowKey()){if(s.timer){clearTimeout(s.timer);s.timer=null;}s.state='unconfigured';s.lastError='AirNow API key not configured';liveRefreshOpenPanel();return;}
  if(s.state!=='loading')pollLiveSource(id);
}
var geoRequestAllAirBase=geoRequestAll;
geoRequestAll=function(cell){geoRequestAllAirBase(cell);geoRequestAirNow(cell);};

var geoRecordLabelAirBase=geoRecordLabel;
geoRecordLabel=function(r){
  if(r&&r.kind==='air-quality'){var p=r.properties||{};return [p.parameter,p.aqi==null?null:'AQI '+p.aqi,p.category,p.reportingArea].filter(Boolean).join(' · ')||'air quality';}
  return geoRecordLabelAirBase(r);
};

window.ICOSA_LIVE.setAirNowKey=function(key){
  var k=liveText(key);try{if(k)localStorage.setItem('ICOSA_AIRNOW_API_KEY',k);else localStorage.removeItem('ICOSA_AIRNOW_API_KEY');}catch(e){return false;}
  var s=LIVE.sources[GEO_SOURCE_IDS.airnow];if(s){s.state='idle';s.lastError=null;}
  var t=GEO_TARGETS[GEO_SOURCE_IDS.airnow];if(k&&t&&s)pollLiveSource(GEO_SOURCE_IDS.airnow);liveRefreshOpenPanel();return true;
};
window.ICOSA_LIVE.clearAirNowKey=function(){return window.ICOSA_LIVE.setAirNowKey(null);};
