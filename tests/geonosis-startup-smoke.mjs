import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code=fs.readFileSync('geonosis-startup.js','utf8');
const polled=[];
const LIVE={records:Object.create(null),sourceIds:Object.create(null),byCell:Object.create(null),sources:Object.create(null),started:true};
const GEO_TARGETS={'late-source':{slug:'F02.123',cell:{}}};
const GEO_DEFS={'late-source':{kind:'test',label:'TEST',maxKm:10}};

function baseRegister(spec){
  LIVE.sources[spec.id]={id:spec.id,state:'idle',lastUpdate:0,lastError:null,count:0,meta:null,cadence:60000,load:spec.load};
  return LIVE.sources[spec.id];
}
function pollLiveSource(id){polled.push(id);LIVE.sources[id].state='loading';}

const sandbox={
  console,
  Date,
  Object,
  Math,
  JSON,
  LIVE,
  GEO_TARGETS,
  GEO_DEFS,
  registerLiveSource:baseRegister,
  pollLiveSource,
  renderLiveWhere:function(){},
  liveRefreshOpenPanel:function(){},
  wake:function(){},
  window:{ICOSA_LIVE:{}},
  document:{getElementById:function(){return null;}},
  setTimeout:function(fn,ms){if(ms===0)fn();return {fn,ms};},
  clearTimeout:function(){},
  FIRMS_SOURCE:'nasa-firms',
  FIRMS_TARGET:null,
  live2ConfigFirmsKey:function(){return null;},
  AIR_SOURCE:'adsb-lol-aircraft',
  AIR_TARGET:null,
  AIR_BASE_URL:null
};
vm.createContext(sandbox);
vm.runInContext(code,sandbox,{filename:'geonosis-startup.js'});

assert.notEqual(sandbox.registerLiveSource,baseRegister,'registerLiveSource must be wrapped');
sandbox.registerLiveSource({id:'late-source',load:function(){}});
assert.deepEqual(polled,['late-source'],'late source with an existing attention target must poll immediately');
assert.equal(LIVE.sources['late-source'].state,'loading');
assert.equal(sandbox.window.ICOSA_LIVE.buildId,'2026-08-25.signal-start-v1');
const health=sandbox.window.ICOSA_LIVE.runtimeHealth();
assert.equal(health.sources['late-source'].target,'F02.123');
assert.equal(health.sources['late-source'].state,'loading');

console.log('PASS late target -> late adapter -> immediate poll');
console.log('PASS runtime health exposes target and state');
