/* F15 EARTH · POWER-OF-10 SAFETY LAYER
 * Runtime guards over the material working-set adapter.
 * These wrappers make termination and failure routing explicit without
 * changing the source semantics of FIELD, GEOMETRY or VOLUME evidence.
 */

var EARTH_POWER10_VERSION='earth-power10-v1';

/* Longitude normalization is closed-form: no open-ended correction loop. */
earthTileCode=function(lat,lon){
  var la=Number(lat),lo=Number(lon);
  if(!Number.isFinite(la)||!Number.isFinite(lo))throw new Error('invalid WorldCover coordinate');
  la=Math.max(-89.999999,Math.min(89.999999,la));
  lo=((lo+180)%360+360)%360-180;
  var lat0=Math.floor(la/3)*3,lon0=Math.floor(lo/3)*3;
  var ns=lat0<0?'S':'N',ew=lon0<0?'W':'E';
  return {code:ns+String(Math.abs(lat0)).padStart(2,'0')+ew+String(Math.abs(lon0)).padStart(3,'0'),lat0:lat0,lon0:lon0};
};

earthLocalXY=function(p,baseLon){
  var d=Number(p[0])-baseLon;
  d=((d+180)%360+360)%360-180;
  return [baseLon+d,p[1]];
};

/* Cache removal is a single bounded splice, never a data-dependent loop. */
earthCogCachePut=function(code,promise){
  EARTH_COG_CACHE.push({code:code,promise:promise});
  if(EARTH_COG_CACHE.length>EARTH_LIMITS.CACHE_COGS){
    EARTH_COG_CACHE.splice(0,EARTH_COG_CACHE.length-EARTH_LIMITS.CACHE_COGS);
  }
};

/* Budget/dateline checks can fail before a Promise exists. Convert those
 * synchronous failures into the same checked asynchronous failure path used
 * by network and decoder failures. */
var earthP10WorldCoverBase=earthRequestWorldCover;
earthRequestWorldCover=function(selected,cell,signal){
  try{return Promise.resolve(earthP10WorldCoverBase(selected,cell,signal));}
  catch(e){return Promise.reject(e);}
};

var earthP10GeometryBase=earthRequestGeometries;
earthRequestGeometries=function(selected,cell,signal){
  try{return Promise.resolve(earthP10GeometryBase(selected,cell,signal));}
  catch(e){return Promise.reject(e);}
};

/* Startup assertions make illegal safety configurations fail visibly. */
(function(){
  var checks=[
    ['FIELD_SAMPLES',EARTH_LIMITS.FIELD_SAMPLES,1,16],
    ['MAX_COG_TILES',EARTH_LIMITS.MAX_COG_TILES,1,8],
    ['MAX_GEOMETRY_FEATURES',EARTH_LIMITS.MAX_GEOMETRY_FEATURES,1,500],
    ['MAX_GEOMETRY_VERTICES',EARTH_LIMITS.MAX_GEOMETRY_VERTICES,1,25000],
    ['REQUEST_TIMEOUT_MS',EARTH_LIMITS.REQUEST_TIMEOUT_MS,1000,30000],
    ['CACHE_COGS',EARTH_LIMITS.CACHE_COGS,1,8]
  ];
  for(var i=0;i<checks.length;i++){
    var c=checks[i],v=Number(c[1]);
    if(!Number.isFinite(v)||v<c[2]||v>c[3])throw new Error('EARTH safety configuration invalid: '+c[0]+'='+c[1]);
  }
})();

if(window.ICOSA_EARTH){window.ICOSA_EARTH.power10=EARTH_POWER10_VERSION;}
