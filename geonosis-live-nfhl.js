/* GEONOSIS FEMA NFHL · regulatory flood-hazard geometry.
 * NFHL Availability is queried separately from Flood Hazard Zones so a place
 * without mapped NFHL coverage never becomes a false low-risk signal.
 */

GEO_SOURCE_IDS.nfhl='fema-nfhl-hazard';
GEO_DEFS[GEO_SOURCE_IDS.nfhl]={kind:'flood-hazard',label:'FLOOD',glyph:'FH',maxKm:180,cadence:86400000};
GEONOSIS_KIND['flood-hazard']={predicate:'regulatory_flood_hazard_zone',signs:['constraint','potential','institution','memory']};

function nfhlProp(p,name){
  if(!p)return null;
  if(Object.prototype.hasOwnProperty.call(p,name))return p[name];
  var want=String(name).toLowerCase(),keys=Object.keys(p);
  for(var i=0;i<keys.length;i++)if(keys[i].toLowerCase()===want)return p[keys[i]];
  return null;
}
function geoRegisterNfhl(){
  var id=GEO_SOURCE_IDS.nfhl;if(LIVE.sources[id])return;
  registerLiveSource({id:id,name:'FEMA NFHL flood hazard zones',provider:'FEMA National Flood Hazard Layer',cadence:GEO_DEFS[id].cadence,load:function(done){
    var t=GEO_TARGETS[id];if(!t)return done('awaiting a local triangle');
    var root='https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/';
    Promise.all([
      geoArcQuery(root+'0/query',t.cell,'*',50),
      geoArcQuery(root+'28/query',t.cell,'*',500)
    ]).then(function(parts){
      var availability=(parts[0]&&parts[0].features)||[],zones=(parts[1]&&parts[1].features)||[],out=[],got=Date.now();
      zones.forEach(function(f,i){
        var p=f.properties||{},a=geoAnchorGeometry(f.geometry,t)||lonlat(cellCentre(t.cell));
        out.push({id:'nfhl:'+(liveText(nfhlProp(p,'OBJECTID'))||liveText(nfhlProp(p,'GLOBALID'))||String(i)),kind:'flood-hazard',lon:a[0],lat:a[1],observedAt:geoIsoMs(nfhlProp(p,'EFF_DATE'))||geoIsoMs(nfhlProp(p,'L_FIRM_PAN')),retrievedAt:got,epistemic:'REPORTED_REGULATORY',properties:{floodZone:liveText(nfhlProp(p,'FLD_ZONE')),zoneSubtype:liveText(nfhlProp(p,'ZONE_SUBTY')),specialFloodHazard:liveText(nfhlProp(p,'SFHA_TF')),staticBfe:liveFinite(nfhlProp(p,'STATIC_BFE')),depth:liveFinite(nfhlProp(p,'DEPTH')),velocity:liveFinite(nfhlProp(p,'VELOCITY')),studyType:liveText(nfhlProp(p,'STUDY_TYP')),sourceCitation:liveText(nfhlProp(p,'SOURCE_CIT')),addressPath:geoAddressPath(f.geometry,Math.min(10,LIVE_INDEX_DEPTH))}});
      });
      var mapped=availability.length>0,truncated=zones.length>=500,complete=mapped&&!truncated;
      done(null,out,geoCoverageMeta(t,{coverageMode:'exact_triangle_intersection_plus_nfhl_availability',completeForCell:complete,nfhlAvailable:mapped,availabilityFeatures:availability.length,truncated:truncated,zeroSemantics:complete?'NFHL is available here and no Flood Hazard Zone polygon intersects this triangle':(mapped?'hazard query may be truncated; zero is not meaningful':'NFHL availability did not confirm mapped coverage; zero is not meaningful'),sourceUrl:root,regulatory:true}));
    }).catch(function(e){done(String(e&&e.message||e));});
  }});
  var reg=window.GEONOSIS_SOURCE_REGISTRY;if(reg&&Array.isArray(reg.sources))reg.sources.forEach(function(s){if(s.id==='fema-nfhl')s.adapter={state:'integrated',sourceId:id};});
}
setTimeout(geoRegisterNfhl,860);

function geoRequestNfhl(cell){
  var id=GEO_SOURCE_IDS.nfhl,d=GEO_DEFS[id],s=LIVE.sources[id];if(!cell||!d)return;
  if(cellEdgeKm(cell)>d.maxKm){GEO_TARGETS[id]=null;geoStopSource(id,'idle','enter a smaller triangle to query FEMA flood hazards');return;}
  var slug=cellSlug(cell);if(GEO_TARGETS[id]&&GEO_TARGETS[id].slug===slug)return;
  GEO_TARGETS[id]={cell:cell,slug:slug,mode:'exact_intersection_with_availability',requestedAt:Date.now()};if(s)pollLiveSource(id);
}
var geoRequestAllNfhlBase=geoRequestAll;
geoRequestAll=function(cell){geoRequestAllNfhlBase(cell);geoRequestNfhl(cell);};

var geoRecordLabelNfhlBase=geoRecordLabel;
geoRecordLabel=function(r){
  if(r&&r.kind==='flood-hazard'){var p=r.properties||{};return ['FEMA '+(p.floodZone||'flood zone'),p.zoneSubtype,p.specialFloodHazard==='T'?'SFHA':null,p.staticBfe==null?null:'BFE '+p.staticBfe].filter(Boolean).join(' · ');}
  return geoRecordLabelNfhlBase(r);
};
