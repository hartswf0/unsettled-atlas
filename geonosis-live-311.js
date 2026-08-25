/* GEONOSIS NYC 311 · jurisdictional civic sensing override.
 * Replaces the generic registration before geoRegisterAll fires.
 */
function geoRegister311(){
  var id=GEO_SOURCE_IDS.nyc311;if(LIVE.sources[id])return;
  registerLiveSource({id:id,name:'NYC 311 service requests',provider:'NYC Open Data / 311',cadence:GEO_DEFS[id].cadence,load:function(done){
    var t=GEO_TARGETS[id];if(!t)return done('awaiting a NYC triangle');if(!geoIntersectsNyc(t.cell))return done('focus is outside NYC 311 jurisdiction');
    var b=geoBounds(t.cell),since=new Date(Date.now()-7*86400000).toISOString().slice(0,19);
    var where="created_date >= '"+since+"' AND latitude IS NOT NULL AND longitude IS NOT NULL AND latitude >= "+b.south.toFixed(6)+" AND latitude <= "+b.north.toFixed(6)+" AND longitude >= "+b.west.toFixed(6)+" AND longitude <= "+b.east.toFixed(6);
    var url='https://data.cityofnewyork.us/resource/erm2-nwe9.json?$limit=250&$order=created_date%20DESC&$where='+encodeURIComponent(where);
    geoFetchJSON(url).then(function(rows){
      rows=Array.isArray(rows)?rows:[];var out=[],got=Date.now();
      rows.forEach(function(x){var lon=liveFinite(x.longitude),lat=liveFinite(x.latitude);if(lon==null||lat==null||!cellContains(t.cell,fromLonLat(lon,lat)))return;out.push({id:'nyc311:'+(liveText(x.unique_key)||String(out.length)),kind:'civic-report',lon:lon,lat:lat,observedAt:geoIsoMs(x.created_date),retrievedAt:got,epistemic:'REPORTED',properties:{complaintType:liveText(x.complaint_type),descriptor:liveText(x.descriptor),agency:liveText(x.agency),agencyName:liveText(x.agency_name),status:liveText(x.status),resolution:liveText(x.resolution_description),borough:liveText(x.borough),incidentAddress:liveText(x.incident_address),created:liveText(x.created_date),closed:liveText(x.closed_date)}});});
      var complete=rows.length<250;
      done(null,out,geoCoverageMeta(t,{coverageMode:'bbox_then_exact_point_filter',completeForCell:complete,jurisdiction:'New York City',windowDays:7,zeroSemantics:complete?'no geocoded NYC 311 service request in this triangle during the last 7 days':'query reached 250-row cap; zero is not meaningful',sourceUrl:'https://data.cityofnewyork.us/resource/erm2-nwe9.json'}));
    }).catch(function(e){done(String(e&&e.message||e));});
  }});
}
