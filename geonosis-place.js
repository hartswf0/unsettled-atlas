/* GEONOSIS HUMAN PLACE ORIENTATION
 * Adds a recognizable place label only when the source record or ICOSA's own
 * gazetteer can support one. Exact ICOSA address + coordinates remain the
 * canonical machine emplacement.
 */

function geoPlaceString(v){var s=String(v==null?'':v).trim();return s||null;}
function geoPlaceJoin(xs){var out=[];(xs||[]).forEach(function(x){x=geoPlaceString(x);if(x&&out.indexOf(x)<0)out.push(x);});return out.join(', ')||null;}
function geoPlaceItemName(x){
  if(x==null)return null;
  if(typeof x==='string'||typeof x==='number')return geoPlaceString(x);
  return geoPlaceString(x.name||x.label||x.title||x.place||x.city||x.region||x.admin1||x.country);
}
function geoPlaceFromSource(r){
  var p=r&&r.properties||{},k=r&&r.kind;
  if(k==='earthquake')return geoPlaceString(p.place);
  if(k==='weather-alert')return geoPlaceString(p.area||p.areaDesc||p.headline);
  if(k==='streamflow')return geoPlaceString(p.site||p.monitoringLocation);
  if(k==='hydro-flowline')return geoPlaceString(p.name);
  if(k==='fema-declaration')return geoPlaceJoin([p.county,p.state]);
  if(k==='civic-report')return geoPlaceJoin([p.borough,p.city]);
  if(k==='regulated-facility')return geoPlaceJoin([p.city,p.county,p.state]);
  if(k==='air-quality')return geoPlaceJoin([p.reportingArea,p.stateCode]);
  if(k==='datacenter')return geoPlaceString(p.name);
  if(k==='biodiversity')return geoPlaceString(p.locality||p.stateProvince||p.country);
  if(k==='weather-state')return geoPlaceString(p.station);
  return null;
}
function geoPlaceFromIcosa(r){
  if(!r||!r.v||typeof cellInventory!=='function')return null;
  try{
    var d=Math.min(8,LIVE_INDEX_DEPTH),c=cellAt(r.v,d),inv=cellInventory(c)||{};
    var groups=['places','settlements','regions','admin1','countries'];
    for(var i=0;i<groups.length;i++){
      var a=inv[groups[i]];
      if(!Array.isArray(a)||!a.length)continue;
      var n=geoPlaceItemName(a[0]);if(n)return n;
    }
  }catch(e){}
  return null;
}
function geoPlaceName(r){return geoPlaceFromSource(r)||geoPlaceFromIcosa(r);}

var geoPlaceInterpretBase=geoSemInterpret;
geoSemInterpret=function(r,reader){
  var g=geoPlaceInterpretBase(r,reader),place=geoPlaceName(r);
  if(g&&g.emplacement)g.emplacement.place=place;
  return g;
};

var geoPlaceSelectedHtmlBase=geoInspectSelectedHtml;
geoInspectSelectedHtml=function(r){
  var h=geoPlaceSelectedHtmlBase(r),place=geoPlaceName(r);
  if(!place)return h;
  var needle='<div class="row geo-prop"><b>WHERE · AT</b>';
  var row='<div class="row geo-prop"><b>WHERE · PLACE</b><span>'+geoInspectEsc(place)+'</span></div>';
  return h.indexOf(needle)>=0?h.replace(needle,row+needle):row+h;
};

var geoPlaceDrawSelectedBase=geoSemDrawSelected;
geoSemDrawSelected=function(S){
  geoPlaceDrawSelectedBase(S);
  var r=GEO_INSPECT.selectedId&&LIVE.records[GEO_INSPECT.selectedId],place=geoPlaceName(r);if(!r||!r.v||!place||!facingCamera(r.v))return;
  var p=livePointScreen(r,S);ctx.save();ctx.font='700 7px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';var text=geoInspectCut(place,38),w=Math.min(260,ctx.measureText(text).width+10),x=Math.max(4,Math.min(W-w-4,p.x-w/2)),y=Math.max(4,p.y-30);ctx.fillStyle='#f1eee4';ctx.fillRect(x,y,w,13);ctx.strokeStyle=COL.ink;ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,12);ctx.fillStyle=COL.ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x+w/2,y+6.5);ctx.restore();
};

window.ICOSA_LIVE.placeForRecord=function(id){var r=LIVE.records[id];return r?geoPlaceName(r):null;};
