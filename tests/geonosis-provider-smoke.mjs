const TIMEOUT_MS = 20000;

async function fetchChecked(name, url, validate) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        'accept': 'application/json, application/geo+json;q=0.9, */*;q=0.5',
        'user-agent': 'ICOSA-Geonosis-provider-smoke/1.0 (github.com/hartswf0/unsettled-atlas)'
      }
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status} ${text.slice(0,240)}`);
    let body;
    try { body = JSON.parse(text); }
    catch { throw new Error(`${name}: expected JSON; got ${text.slice(0,160)}`); }
    validate(body);
    const cors = r.headers.get('access-control-allow-origin') || '(not advertised)';
    console.log(`PASS ${name} ${Date.now()-started}ms CORS=${cors}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const atl = { lon: -84.3880, lat: 33.7490 };
const atlBox = [-84.55, 33.62, -84.22, 33.88];
const atlTri = {
  rings: [[[-84.55,33.62],[-84.22,33.68],[-84.38,33.88],[-84.55,33.62]]]
};
const atlWkt = 'POLYGON((-84.55 33.62,-84.22 33.68,-84.38 33.88,-84.55 33.62))';

const tests = [
  fetchChecked(
    'NWS active alerts',
    `https://api.weather.gov/alerts/active?point=${atl.lat},${atl.lon}`,
    j => assert(j && Array.isArray(j.features), 'NWS response missing features[]')
  ),
  fetchChecked(
    'USGS Water latest continuous',
    `https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?f=json&limit=5&parameter_code=00060&bbox=${atlBox.join(',')}`,
    j => assert(j && Array.isArray(j.features), 'USGS Water response missing features[]')
  ),
  fetchChecked(
    'USGS 3DHP flowlines',
    'https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer/50/query?' + new URLSearchParams({
      where: '1=1',
      geometry: JSON.stringify(atlTri),
      geometryType: 'esriGeometryPolygon',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'OBJECTID,id3dhp,streamorder,flowdirectionlabel,hydrosequence,dnhydrosequence,uphydrosequence',
      returnGeometry: 'true',
      outSR: '4326',
      resultRecordCount: '5',
      f: 'geojson'
    }).toString(),
    j => assert(j && Array.isArray(j.features), '3DHP response missing features[]')
  ),
  fetchChecked(
    'FEMA designated counties',
    'https://gis.fema.gov/arcgis/rest/services/FEMA/DECS_ALL/MapServer/0/query?' + new URLSearchParams({
      where: '1=1',
      geometry: JSON.stringify(atlTri),
      geometryType: 'esriGeometryPolygon',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'objectid,name,state_name,fips,fema_postdate,designate,dec_number',
      returnGeometry: 'true',
      outSR: '4326',
      resultRecordCount: '5',
      f: 'geojson'
    }).toString(),
    j => assert(j && Array.isArray(j.features), 'FEMA response missing features[]')
  ),
  fetchChecked(
    'GBIF occurrence search',
    'https://api.gbif.org/v1/occurrence/search?' + new URLSearchParams({
      limit: '5',
      hasCoordinate: 'true',
      occurrenceStatus: 'PRESENT',
      geometry: atlWkt
    }).toString(),
    j => assert(j && Array.isArray(j.results), 'GBIF response missing results[]')
  ),
  fetchChecked(
    'NYC 311 current dataset',
    'https://data.cityofnewyork.us/resource/erm2-nwe9.json?' + new URLSearchParams({
      '$limit': '1',
      '$order': 'created_date DESC',
      '$where': 'latitude IS NOT NULL AND longitude IS NOT NULL'
    }).toString(),
    j => assert(Array.isArray(j), 'NYC 311 response is not an array')
  )
];

const settled = await Promise.allSettled(tests);
let failed = 0;
for (const x of settled) {
  if (x.status === 'rejected') {
    failed++;
    console.error('FAIL', x.reason && x.reason.message || x.reason);
  }
}
if (failed) {
  console.error(`${failed}/${settled.length} public-provider smoke tests failed`);
  process.exit(1);
}
console.log(`PASS all ${settled.length} public-provider smoke tests`);
