/* GEONOSIS EPA ECHO + FRS IDENTITY BRIDGE
 * ECHO's public ArcGIS facility layer carries EPA FRS Registry IDs plus
 * inspection/compliance/enforcement fields. This is an institutional record,
 * not direct pollution measurement.
 */

GEO_SOURCE_IDS.echo='epa-echo-facilities';
GEO_DEFS[GEO_SOURCE_IDS.echo]={kind:'regulated-facility',label:'EPA',glyph:'EPA',maxKm:260,cadence:21600000};
GEONOSIS_KIND['regulated-facility']={predicate:'epa_regulated_facility_record',signs:['institution','position','contestation','memory']};

function geoRegisterEcho(){
  var id=GEO_SOURCE_IDS.echo;if(LIVE.sources[id])return;
  registerLiveSource({id:id,name:'EPA ECHO regulated facilities',provider:'EPA ECHO / FRS',cadence:GEO_DEFS[id].cadence,load:function(done){
    var t=GEO_TARGETS[id];if(!t)return done('awaiting a local triangle');
    var base='https://echogeo.epa.gov/arcgis/rest/services/ECHO/Facilities/MapServer/0/query';
    var fields=[
      'OBJECTID','REGISTRY_ID','FAC_NAME','FAC_STREET','FAC_CITY','FAC_STATE','FAC_ZIP','FAC_COUNTY','FAC_FIPS_CODE','FAC_EPA_REGION',
      'FAC_LAT','FAC_LONG','FAC_ACCURACY_METERS','FAC_DERIVED_HUC','FAC_MAJOR_FLAG','FAC_ACTIVE_FLAG','FAC_INSPECTION_COUNT',
      'FAC_DATE_LAST_INSPECTION','FAC_DAYS_LAST_INSPECTION','FAC_FORMAL_ACTION_COUNT','FAC_TOTAL_PENALTIES','FAC_PENALTY_COUNT',
      'FAC_QTRS_IN_NC','FAC_PROGRAMS_IN_SNC','FAC_CURR_COMPLIANCE_STATUS','FAC_CURR_SNC_FLG','FAC_3YR_COMPLIANCE_STATUS',
      'AIR_FLAG','NPDES_FLAG','SDWIS_FLAG','RCRA_FLAG','TRI_FLAG','GHG_FLAG'
    ].join(',');
    geoArcQuery(base,t.cell,fields,400).then(function(j){
      var feats=(j&&j.features)||[],out=[],got=Date.now();
      feats.forEach(function(f,i){
        var p=f.properties||{},c=(f.geometry&&f.geometry.coordinates)||[],lon=liveFinite(p.FAC_LONG),lat=liveFinite(p.FAC_LAT);
        if(lon==null||lat==null){lon=liveFinite(c[0]);lat=liveFinite(c[1]);}
        if(lon==null||lat==null||!cellContains(t.cell,fromLonLat(lon,lat)))return;
        out.push({id:'echo:'+(liveText(p.REGISTRY_ID)||liveText(p.OBJECTID)||String(i)),kind:'regulated-facility',lon:lon,lat:lat,observedAt:geoIsoMs(p.FAC_DATE_LAST_INSPECTION),retrievedAt:got,epistemic:'REPORTED',properties:{registryId:liveText(p.REGISTRY_ID),name:liveText(p.FAC_NAME),street:liveText(p.FAC_STREET),city:liveText(p.FAC_CITY),state:liveText(p.FAC_STATE),county:liveText(p.FAC_COUNTY),fips:liveText(p.FAC_FIPS_CODE),epaRegion:liveText(p.FAC_EPA_REGION),coordinateAccuracyM:liveFinite(p.FAC_ACCURACY_METERS),hydrologicUnit:liveText(p.FAC_DERIVED_HUC),major:liveText(p.FAC_MAJOR_FLAG),active:liveText(p.FAC_ACTIVE_FLAG),inspectionCount:liveFinite(p.FAC_INSPECTION_COUNT),lastInspection:geoIsoMs(p.FAC_DATE_LAST_INSPECTION),daysSinceInspection:liveFinite(p.FAC_DAYS_LAST_INSPECTION),formalActionCount:liveFinite(p.FAC_FORMAL_ACTION_COUNT),totalPenalties:liveFinite(p.FAC_TOTAL_PENALTIES),penaltyCount:liveFinite(p.FAC_PENALTY_COUNT),quartersNonCompliance:liveFinite(p.FAC_QTRS_IN_NC),programsSignificantNonCompliance:liveFinite(p.FAC_PROGRAMS_IN_SNC),currentComplianceStatus:liveText(p.FAC_CURR_COMPLIANCE_STATUS),currentSignificantNonCompliance:liveText(p.FAC_CURR_SNC_FLG),threeYearComplianceStatus:liveText(p.FAC_3YR_COMPLIANCE_STATUS),programs:{air:liveText(p.AIR_FLAG),npdes:liveText(p.NPDES_FLAG),drinkingWater:liveText(p.SDWIS_FLAG),rcra:liveText(p.RCRA_FLAG),tri:liveText(p.TRI_FLAG),ghg:liveText(p.GHG_FLAG)}}});
      });
      var truncated=feats.length>=400;
      done(null,out,geoCoverageMeta(t,{coverageMode:'exact_triangle_point_intersection',completeForCell:!truncated,truncated:truncated,zeroSemantics:!truncated?'no facility record in EPA ECHO All Facilities intersects this triangle; this does not mean no pollution source or environmental burden':'ECHO query reached the client cap; zero is not meaningful',sourceUrl:base,identityBridge:'EPA FRS REGISTRY_ID'}));
    }).catch(function(e){done(String(e&&e.message||e));});
  }});
  var reg=window.GEONOSIS_SOURCE_REGISTRY;if(reg&&Array.isArray(reg.sources))reg.sources.forEach(function(s){
    if(s.id==='epa-echo')s.adapter={state:'integrated',sourceId:id};
    if(s.id==='epa-frs')s.adapter={state:'identity_bridge_via_echo',sourceId:id,field:'REGISTRY_ID'};
  });
}
setTimeout(geoRegisterEcho,920);

function geoRequestEcho(cell){
  var id=GEO_SOURCE_IDS.echo,d=GEO_DEFS[id],s=LIVE.sources[id];if(!cell||!d)return;
  if(cellEdgeKm(cell)>d.maxKm){GEO_TARGETS[id]=null;geoStopSource(id,'idle','enter a smaller triangle to query EPA facilities');return;}
  var slug=cellSlug(cell);if(GEO_TARGETS[id]&&GEO_TARGETS[id].slug===slug)return;
  GEO_TARGETS[id]={cell:cell,slug:slug,mode:'exact_points',requestedAt:Date.now()};if(s)pollLiveSource(id);
}
var geoRequestAllEchoBase=geoRequestAll;
geoRequestAll=function(cell){geoRequestAllEchoBase(cell);geoRequestEcho(cell);};

var geoRecordLabelEchoBase=geoRecordLabel;
geoRecordLabel=function(r){
  if(r&&r.kind==='regulated-facility'){var p=r.properties||{};return [p.name,p.currentComplianceStatus,p.currentSignificantNonCompliance==='Y'?'SNC':null,p.registryId?'FRS '+p.registryId:null].filter(Boolean).join(' · ')||'EPA facility';}
  return geoRecordLabelEchoBase(r);
};
