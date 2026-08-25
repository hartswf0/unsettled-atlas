const TIMEOUT_MS = 20000;
const BROWSER_ORIGIN = 'https://hartswf0.github.io';

async function rawFetch(name, url, { requireCors = true } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        'accept': 'application/json, application/geo+json;q=0.9, text/plain;q=0.8, */*;q=0.5',
        'origin': BROWSER_ORIGIN,
        'user-agent': 'ICOSA-Geonosis-provider-smoke/1.0 (github.com/hartswf0/unsettled-atlas)'
      }
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status} ${text.slice(0,240)}`);
    const cors = r.headers.get('access-control-allow-origin');
    if (requireCors && !(cors === '*' || cors === BROWSER_ORIGIN)) {
      throw new Error(`${name}: server answered but did not authorize browser origin ${BROWSER_ORIGIN}; ACAO=${cors || '(missing)'}`);
    }
    return { r, text, cors, elapsed: Date.now()-started };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchChecked(name, url, validate, options) {
  const got = await rawFetch(name, url, options);
  let body;
  try { body = JSON.parse(got.text); }
  catch { throw new Error(`${name}: expected JSON; got ${got.text.slice(0,160)}`); }
  validate(body, got);
  console.log(`PASS ${name} ${got.elapsed}ms CORS=${got.cors || '(not advertised)'}`);
  return body;
}

async function fetchTextChecked(name, url, validate, options) {
  const got = await rawFetch(name, url, options);
  validate(got.text, got);
  console.log(`PASS ${name} ${got.elapsed}ms CORS=${got.cors || '(not advertised)'}`);
  return got.text;
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

function arcQuery(base, outFields='*') {
  return base + '?' + new URLSearchParams({
    where: '1=1',
    geometry: JSON.stringify(atlTri),
    geometryType: 'esriGeometryPolygon',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields,
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: '5',
    f: 'geojson'
  }).toString();
}

const nwsWeatherChain = (async () => {
  const point = await fetchChecked(
    'NWS point metadata',
    `https://api.weather.gov/points/${atl.lat},${atl.lon}`,
    j => assert(j && j.properties && j.properties.forecastHourly && j.properties.observationStations, 'NWS point response missing linked forecast/station URLs')
  );
  await fetchChecked(
    'NWS hourly forecast',
    point.properties.forecastHourly,
    j => assert(j && j.properties && Array.isArray(j.properties.periods) && j.properties.periods.length, 'NWS hourly forecast missing periods[]')
  );
  const stations = await fetchChecked(
    'NWS observation stations',
    point.properties.observationStations,
    j => assert(j && Array.isArray(j.features) && j.features.length, 'NWS stations response missing features[]')
  );
  const stationBase = stations.features[0].id || (stations.features[0].properties && stations.features[0].properties['@id']);
  assert(stationBase, 'NWS first station missing id');
  await fetchChecked(
    'NWS latest observation',
    String(stationBase).replace(/\/$/, '') + '/observations/latest',
    j => assert(j && j.properties && j.properties.timestamp, 'NWS latest observation missing timestamp')
  );
})();

const tests = [
  fetchChecked(
    'USGS earthquake GeoJSON',
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
    j => assert(j && Array.isArray(j.features), 'USGS earthquake response missing features[]')
  ),
  fetchTextChecked(
    'OSM datacenter snapshot',
    'https://raw.githubusercontent.com/bilawalsidhu/gods-eye-view/880a672b5e16ad3e41d318801d3a5203f9201923/src/data/local_data/datacenters/datacenters.geojsonl',
    text => {
      const line = text.split('\n').find(x => x.trim());
      assert(line, 'datacenter snapshot empty');
      const f = JSON.parse(line);
      assert(f && f.geometry, 'datacenter first record missing geometry');
    }
  ),
  fetchChecked(
    'adsb.lol upstream shape (server-only transport)',
    `https://api.adsb.lol/v2/lat/${atl.lat}/lon/${atl.lon}/dist/25`,
    (j, got) => {
      assert(j && Array.isArray(j.ac), 'adsb.lol response missing ac[]');
      assert(!(got.cors === '*' || got.cors === BROWSER_ORIGIN), 'adsb.lol unexpectedly became browser-CORS capable; revisit proxy requirement');
    },
    { requireCors: false }
  ),
  fetchChecked(
    'NWS active alerts',
    `https://api.weather.gov/alerts/active?point=${atl.lat},${atl.lon}`,
    j => assert(j && Array.isArray(j.features), 'NWS response missing features[]')
  ),
  nwsWeatherChain,
  fetchChecked(
    'USGS 3DEP EPQS',
    `https://epqs.nationalmap.gov/v1/json?x=${atl.lon}&y=${atl.lat}&wkid=4326&units=Meters&includeDate=true`,
    j => assert(j && Number.isFinite(Number(j.value)), '3DEP EPQS response missing numeric value')
  ),
  fetchChecked(
    'USGS Water latest continuous',
    `https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?f=json&limit=5&parameter_code=00060&bbox=${atlBox.join(',')}`,
    j => assert(j && Array.isArray(j.features), 'USGS Water response missing features[]')
  ),
  fetchChecked(
    'USGS 3DHP flowlines',
    arcQuery(
      'https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer/50/query',
      'OBJECTID,id3dhp,streamorder,flowdirectionlabel,hydrosequence,dnhydrosequence,uphydrosequence'
    ),
    j => assert(j && Array.isArray(j.features), '3DHP response missing features[]')
  ),
  fetchChecked(
    'FEMA designated counties',
    arcQuery(
      'https://gis.fema.gov/arcgis/rest/services/FEMA/DECS_ALL/MapServer/0/query',
      'objectid,name,state_name,fips,fema_postdate,designate,dec_number'
    ),
    j => assert(j && Array.isArray(j.features), 'FEMA response missing features[]')
  ),
  fetchChecked(
    'FEMA NFHL availability',
    arcQuery('https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/0/query'),
    j => assert(j && Array.isArray(j.features), 'NFHL availability response missing features[]')
  ),
  fetchChecked(
    'FEMA NFHL flood hazard zones',
    arcQuery('https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query'),
    j => assert(j && Array.isArray(j.features), 'NFHL flood hazard response missing features[]')
  ),
  fetchChecked(
    'EPA ECHO facilities',
    arcQuery(
      'https://echogeo.epa.gov/arcgis/rest/services/ECHO/Facilities/MapServer/0/query',
      'OBJECTID,REGISTRY_ID,FAC_NAME,FAC_LAT,FAC_LONG,FAC_DERIVED_HUC,FAC_INSPECTION_COUNT,FAC_CURR_COMPLIANCE_STATUS,FAC_QTRS_IN_NC'
    ),
    j => assert(j && Array.isArray(j.features), 'EPA ECHO response missing features[]')
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
  console.error(`${failed}/${settled.length} provider/deployment smoke tests failed`);
  process.exit(1);
}
console.log(`PASS all ${settled.length} provider/deployment smoke tests`);
