/* GEONOSIS STARTUP + RUNTIME HEALTH
 *
 * The original live bus starts its then-known sources at 350 ms. Several
 * Geonosis adapters deliberately register later (520–900+ ms), which meant
 * they could miss that one enumeration forever. If an attention target was
 * already created before the adapter registered, the source stayed IDLE.
 *
 * This module is injected last but executes synchronously before any of those
 * timers fire. It wraps registerLiveSource so late adapters immediately honor
 * an existing attention target, and it runs a short finite startup convergence
 * sequence. IDLE is therefore reserved for a real gating condition, not a
 * missed startup race.
 */

var GEONOSIS_BUILD_ID='2026-08-25.signal-start-v1';
var GEONOSIS_STARTUP_VERSION='geonosis-startup-v1';
var GEO_STARTUP={kicks:0,lastKick:0,lastReason:null};

function geoStartupTargetFor(id){
  if(typeof GEO_TARGETS!=='undefined'&&GEO_TARGETS[id])return GEO_TARGETS[id];
  if(typeof FIRMS_SOURCE!=='undefined'&&id===FIRMS_SOURCE&&typeof FIRMS_TARGET!=='undefined')return FIRMS_TARGET;
  if(typeof AIR_SOURCE!=='undefined'&&id===AIR_SOURCE&&typeof AIR_TARGET!=='undefined')return AIR_TARGET;
  return null;
}
function geoStartupNeedsPoll(id){
  var s=LIVE.sources[id],t=geoStartupTargetFor(id);if(!s||s.state==='loading')return false;
  if(t&&t.slug){
    var covered=s.meta&&s.meta.coverageCell===t.slug;
    return !s.lastUpdate||!covered||s.state==='idle'||s.state==='error'||s.state==='out_of_scope';
  }
  /* Global sources registered after LIVE.started should not miss startup. */
  return !!(LIVE.started&&!s.lastUpdate&&s.state==='idle'&&(!s.meta||!s.meta.scoped));
}
function geoStartupPoll(id){
  var s=LIVE.sources[id];if(!s||!geoStartupNeedsPoll(id))return false;
  /* Preserve explicit configuration gates. */
  if(typeof FIRMS_SOURCE!=='undefined'&&id===FIRMS_SOURCE&&typeof live2ConfigFirmsKey==='function'&&!live2ConfigFirmsKey())return false;
  if(typeof AIR_SOURCE!=='undefined'&&id===AIR_SOURCE&&typeof AIR_BASE_URL!=='undefined'&&!AIR_BASE_URL)return false;
  pollLiveSource(id);return true;
}

/* Crucial race fix: every adapter registered after the 350 ms bus start gets
 * one immediate chance to consume an attention target that already exists. */
var geoStartupRegisterBase=registerLiveSource;
registerLiveSource=function(spec){
  var s=geoStartupRegisterBase(spec);
  setTimeout(function(){
    geoStartupPoll(spec.id);
    if(typeof geoScopeUpdatePlate==='function')geoScopeUpdatePlate();
    if(typeof liveRefreshOpenPanel==='function')liveRefreshOpenPanel();
  },0);
  return s;
};

function geoStartupKick(reason){
  GEO_STARTUP.kicks++;GEO_STARTUP.lastKick=Date.now();GEO_STARTUP.lastReason=reason||'startup';
  var selected=(typeof geoScopeSelectedCell==='function'&&geoScopeSelectedCell())||(typeof focusCell==='function'&&focusCell());
  if(selected&&typeof geoScopeRequestAll==='function')geoScopeRequestAll(selected);
  Object.keys(LIVE.sources).forEach(geoStartupPoll);
  if(typeof geoScopeUpdatePlate==='function')geoScopeUpdatePlate();
  if(typeof liveRefreshOpenPanel==='function')liveRefreshOpenPanel();
  if(typeof wake==='function')wake();
}

/* Converge once delayed registration timers have had time to fire. Finite by
 * design: normal provider cadences take over after this sequence. */
[420,700,950,1300,1900,3000,5000].forEach(function(ms){
  setTimeout(function(){geoStartupKick('boot+'+ms+'ms');},ms);
});

/* Make source state diagnostic. A target waiting on registration is not IDLE;
 * a registered targeted source that has not yet returned is STARTING. */
if(typeof geoScopeTargetState==='function'){
  var geoStartupTargetStateBase=geoScopeTargetState;
  geoScopeTargetState=function(id){
    var t=typeof GEO_TARGETS!=='undefined'&&GEO_TARGETS[id],s=LIVE.sources[id];
    if(t&&!s)return 'REGISTERING';
    if(t&&s&&!s.lastUpdate&&s.state==='idle')return 'STARTING';
    return geoStartupTargetStateBase(id);
  };
}

/* Build identity in the visible map plate. If this line is absent, the browser
 * is not running this build, which makes cache/deployment failures obvious. */
if(typeof geoScopeUpdatePlate==='function'){
  var geoStartupPlateBase=geoScopeUpdatePlate;
  geoScopeUpdatePlate=function(){
    geoStartupPlateBase();
    var el=document.getElementById('geonosis-map-plate');if(!el)return;
    var old=el.querySelector('[data-geonosis-build]');if(old)old.remove();
    var b=document.createElement('span');b.setAttribute('data-geonosis-build','1');b.textContent='BUILD · '+GEONOSIS_BUILD_ID;el.appendChild(b);
  };
  geoInspectUpdatePlate=geoScopeUpdatePlate;
}

/* Add a compact runtime-health ledger to WHERE. */
var geoStartupRenderBase=renderLiveWhere;
renderLiveWhere=function(cell){
  geoStartupRenderBase(cell);
  var root=document.getElementById('panel');if(!root||!root.classList.contains('open'))return;
  var old=document.getElementById('geonosis-runtime-health');if(old)old.remove();
  var targeted=0,loading=0,ready=0,blocked=0,stalled=[];
  if(typeof GEO_DEFS!=='undefined')Object.keys(GEO_DEFS).forEach(function(id){
    var s=LIVE.sources[id],t=typeof GEO_TARGETS!=='undefined'&&GEO_TARGETS[id];if(t)targeted++;
    if(!s){if(t)stalled.push(id+' REGISTERING');return;}
    if(s.state==='loading')loading++;
    else if(s.lastUpdate)ready++;
    else if(s.state==='unconfigured'||s.state==='out_of_scope')blocked++;
    else if(t)stalled.push(id+' '+String(s.state||'idle').toUpperCase());
  });
  var h='<details id="geonosis-runtime-health"'+(stalled.length?' open':'')+'><summary>RUNTIME · '+ready+' READY · '+loading+' LOADING · '+blocked+' GATED</summary>'+
    '<div class="row"><b>BUILD</b><span>'+geoInspectEsc(GEONOSIS_BUILD_ID)+'</span></div>'+
    '<div class="row"><b>ATTENTION TARGETS</b><span>'+targeted+'</span></div>'+
    '<div class="row"><b>STARTUP KICKS</b><span>'+GEO_STARTUP.kicks+' · '+geoInspectEsc(GEO_STARTUP.lastReason||'booting')+'</span></div>';
  stalled.slice(0,12).forEach(function(x){h+='<div class="row"><b>STALLED</b><span>'+geoInspectEsc(x)+'</span></div>';});
  h+='<p>IDLE without a stated gate is a runtime fault, not evidence that the place is empty.</p></details>';
  root.insertAdjacentHTML('beforeend',h);
};

window.ICOSA_LIVE.buildId=GEONOSIS_BUILD_ID;
window.ICOSA_LIVE.startup=function(){geoStartupKick('manual');return {version:GEONOSIS_STARTUP_VERSION,build:GEONOSIS_BUILD_ID,kicks:GEO_STARTUP.kicks,lastKick:GEO_STARTUP.lastKick,lastReason:GEO_STARTUP.lastReason};};
window.ICOSA_LIVE.runtimeHealth=function(){
  var out={build:GEONOSIS_BUILD_ID,startup:GEO_STARTUP,sources:{}};
  Object.keys(LIVE.sources).forEach(function(id){var s=LIVE.sources[id],t=geoStartupTargetFor(id);out.sources[id]={state:s.state,lastUpdate:s.lastUpdate,lastError:s.lastError,target:t&&t.slug||null,coverage:s.meta&&s.meta.coverageCell||null,count:s.count||0};});
  return out;
};
