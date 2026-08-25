/* GEONOSIS SOURCE CONTROLS
 * Browser-local configuration for source credentials/transports that cannot
 * be embedded in the public repository. Every field is explicitly labeled.
 */

var GEO_UI_FIRMS_KEY='ICOSA_FIRMS_MAP_KEY';
var GEO_UI_AIRNOW_KEY='ICOSA_AIRNOW_API_KEY';
var GEO_UI_ADSB_BASE='ICOSA_ADSB_BASE_URL';

function geoUiGet(k){try{return localStorage.getItem(k)||'';}catch(e){return '';}}
function geoUiSet(k,v){try{if(v)localStorage.setItem(k,v);else localStorage.removeItem(k);return true;}catch(e){return false;}}
function geoUiHas(k){return !!geoUiGet(k);}
function geoUiSourceStatus(id){
  var s=LIVE.sources[id];
  if(!s)return 'NOT REGISTERED';
  if(s.state==='unconfigured')return 'UNCONFIGURED';
  return String(liveSourceFreshness(s)||s.state||'IDLE').toUpperCase();
}
function geoUiEscAttr(s){return liveEsc(String(s||'')).replace(/"/g,'&quot;');}

function geoUiHydrateAircraft(){
  var saved=geoUiGet(GEO_UI_ADSB_BASE);
  if(saved&&window.ICOSA_LIVE&&window.ICOSA_LIVE.setAircraftBaseUrl)window.ICOSA_LIVE.setAircraftBaseUrl(saved);
}
setTimeout(geoUiHydrateAircraft,1100);

function geoUiBind(){
  var saveF=document.getElementById('geo-save-firms'),clearF=document.getElementById('geo-clear-firms');
  var saveA=document.getElementById('geo-save-airnow'),clearA=document.getElementById('geo-clear-airnow');
  var saveX=document.getElementById('geo-save-aircraft'),clearX=document.getElementById('geo-clear-aircraft');
  if(saveF)saveF.onclick=function(){var el=document.getElementById('geo-firms-key'),v=el&&el.value.trim();if(!v)return;if(window.ICOSA_LIVE.setFirmsKey)window.ICOSA_LIVE.setFirmsKey(v);if(el)el.value='';liveRefreshOpenPanel();};
  if(clearF)clearF.onclick=function(){if(window.ICOSA_LIVE.clearFirmsKey)window.ICOSA_LIVE.clearFirmsKey();liveRefreshOpenPanel();};
  if(saveA)saveA.onclick=function(){var el=document.getElementById('geo-airnow-key'),v=el&&el.value.trim();if(!v)return;if(window.ICOSA_LIVE.setAirNowKey)window.ICOSA_LIVE.setAirNowKey(v);if(el)el.value='';liveRefreshOpenPanel();};
  if(clearA)clearA.onclick=function(){if(window.ICOSA_LIVE.clearAirNowKey)window.ICOSA_LIVE.clearAirNowKey();liveRefreshOpenPanel();};
  if(saveX)saveX.onclick=function(){var el=document.getElementById('geo-aircraft-base'),v=el&&el.value.trim();if(!v)return;if(!/^https:\/\//i.test(v)){el.setCustomValidity('Use an HTTPS CORS-enabled base URL');el.reportValidity();return;}el.setCustomValidity('');geoUiSet(GEO_UI_ADSB_BASE,v.replace(/\/$/,''));if(window.ICOSA_LIVE.setAircraftBaseUrl)window.ICOSA_LIVE.setAircraftBaseUrl(v.replace(/\/$/,''));liveRefreshOpenPanel();};
  if(clearX)clearX.onclick=function(){geoUiSet(GEO_UI_ADSB_BASE,'');if(window.ICOSA_LIVE.setAircraftBaseUrl)window.ICOSA_LIVE.setAircraftBaseUrl(null);var el=document.getElementById('geo-aircraft-base');if(el)el.value='';liveRefreshOpenPanel();};
}

function renderGeonosisSourceControls(cell){
  var root=document.getElementById('panel');if(!root||!root.classList.contains('open'))return;
  if(typeof live2RemovePanel==='function')live2RemovePanel('geonosis-source-controls');
  var aircraftSaved=geoUiGet(GEO_UI_ADSB_BASE);
  var rows=[
    ['USGS EARTHQUAKES','usgs-earthquakes'],
    ['OSM DATACENTERS','osm-datacenters'],
    ['NWS ALERTS',GEO_SOURCE_IDS.nws],
    ['NWS WEATHER',GEO_SOURCE_IDS.weather],
    ['USGS WATER',GEO_SOURCE_IDS.water],
    ['USGS 3DHP',GEO_SOURCE_IDS.hydro],
    ['USGS 3DEP TERRAIN',GEO_SOURCE_IDS.terrain],
    ['FEMA DECLARATIONS',GEO_SOURCE_IDS.fema],
    ['FEMA NFHL',GEO_SOURCE_IDS.nfhl],
    ['EPA ECHO / FRS',GEO_SOURCE_IDS.echo],
    ['GBIF',GEO_SOURCE_IDS.gbif],
    ['NYC 311',GEO_SOURCE_IDS.nyc311]
  ];
  var h='<details id="geonosis-source-controls"><summary>DATA SOURCES · STATUS + SETUP</summary>'+
    '<p>Public sources run directly when this triangle is within their supported scale. Credentialed sources remain local to this browser. Aircraft requires a CORS-enabled transport because the upstream does not authorize this Pages origin directly.</p>';
  rows.forEach(function(x){h+='<div class="row"><b>'+liveEsc(x[0])+'</b><span>'+liveEsc(geoUiSourceStatus(x[1]))+'</span></div>';});
  h+='<div class="row"><b>NASA FIRMS</b><span>'+liveEsc(geoUiHas(GEO_UI_FIRMS_KEY)?geoUiSourceStatus(FIRMS_SOURCE):'KEY REQUIRED')+'</span></div>'+
     '<label for="geo-firms-key" style="display:block;font-size:9px;font-weight:700;letter-spacing:.09em;margin-top:10px">NASA FIRMS MAP KEY</label>'+
     '<input id="geo-firms-key" type="password" autocomplete="off" placeholder="'+(geoUiHas(GEO_UI_FIRMS_KEY)?'configured · enter to replace':'paste MAP_KEY')+'">'+
     '<div style="display:flex;gap:6px"><button id="geo-save-firms" type="button">SAVE KEY</button><button id="geo-clear-firms" type="button">CLEAR KEY</button></div>'+
     '<div class="row"><b>AIRNOW</b><span>'+liveEsc(geoUiHas(GEO_UI_AIRNOW_KEY)?geoUiSourceStatus(GEO_SOURCE_IDS.airnow):'KEY REQUIRED')+'</span></div>'+
     '<label for="geo-airnow-key" style="display:block;font-size:9px;font-weight:700;letter-spacing:.09em;margin-top:10px">AIRNOW API KEY</label>'+
     '<input id="geo-airnow-key" type="password" autocomplete="off" placeholder="'+(geoUiHas(GEO_UI_AIRNOW_KEY)?'configured · enter to replace':'paste API key')+'">'+
     '<div style="display:flex;gap:6px"><button id="geo-save-airnow" type="button">SAVE KEY</button><button id="geo-clear-airnow" type="button">CLEAR KEY</button></div>'+
     '<div class="row"><b>AIRCRAFT · ADSB.LOL</b><span>'+liveEsc(aircraftSaved?geoUiSourceStatus(AIR_SOURCE):'CORS BASE REQUIRED')+'</span></div>'+
     '<label for="geo-aircraft-base" style="display:block;font-size:9px;font-weight:700;letter-spacing:.09em;margin-top:10px">AIRCRAFT CORS BASE URL</label>'+
     '<input id="geo-aircraft-base" type="url" inputmode="url" autocomplete="off" value="'+geoUiEscAttr(aircraftSaved)+'" placeholder="https://your-proxy.example/v2">'+
     '<div style="display:flex;gap:6px"><button id="geo-save-aircraft" type="button">SAVE BASE URL</button><button id="geo-clear-aircraft" type="button">CLEAR BASE URL</button></div>'+
     '<p style="font-size:8px;letter-spacing:.08em">SECRETS ARE STORED ONLY IN THIS BROWSER LOCALSTORAGE. NOTHING IS COMMITTED TO GITHUB.</p></details>';
  root.insertAdjacentHTML('beforeend',h);geoUiBind();
}

var renderLiveWhereSourceControlsBase=renderLiveWhere;
renderLiveWhere=function(cell){renderLiveWhereSourceControlsBase(cell);renderGeonosisSourceControls(cell);};
window.ICOSA_LIVE.renderSourceControls=function(){var c=selectedCell&&selectedCell();if(c)renderGeonosisSourceControls(c);};
