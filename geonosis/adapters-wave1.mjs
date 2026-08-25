import { normalizeSignal, pointGeometry } from './schema.mjs';

const UA = 'Unsettled-Atlas-Geonosis/0.2 (https://github.com/hartswf0/unsettled-atlas)';

async function fetchJSON(url, options = {}, timeoutMs = 25000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: ac.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} · ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function bbox(lat, lon, radiusKm) {
  const dy = radiusKm / 110.574;
  const dx = radiusKm / (111.320 * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
  return [lon - dx, lat - dy, lon + dx, lat + dy];
}

function bboxPolygonWKT(b) {
  const [x0, y0, x1, y1] = b;
  return `POLYGON((${x0} ${y0},${x1} ${y0},${x1} ${y1},${x0} ${y1},${x0} ${y0}))`;
}

function asISO(value) {
  if (value == null || value === '') return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : String(value);
}

function isoDateDaysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function geojsonPoint(feature) {
  const c = feature?.geometry?.coordinates;
  if (!Array.isArray(c) || !Number.isFinite(+c[0]) || !Number.isFinite(+c[1])) return null;
  return pointGeometry(+c[0], +c[1]);
}

async function arcgisGeoJSON(base, ctx, outFields = '*', extra = {}) {
  const b = bbox(ctx.lat, ctx.lon, ctx.radiusKm);
  const url = new URL(base.replace(/\/$/, '') + '/query');
  Object.entries({
    f: 'geojson',
    where: '1=1',
    geometry: b.join(','),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields,
    returnGeometry: 'true',
    resultRecordCount: String(Math.min(ctx.limit || 500, 2000)),
    ...extra
  }).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const data = await fetchJSON(url);
  if (data?.error) throw new Error(`ArcGIS ${data.error.code || ''} ${data.error.message || 'query error'}`.trim());
  return { url, features: data.features || [] };
}

async function socrataWithinCircle(base, ctx, fields = '*', extraWhere = null, order = null) {
  const url = new URL(base);
  const radiusM = Math.max(1, Math.round(ctx.radiusKm * 1000));
  const where = [`within_circle(the_geom, ${ctx.lat}, ${ctx.lon}, ${radiusM})`];
  if (extraWhere) where.push(`(${extraWhere})`);
  url.searchParams.set('$select', fields);
  url.searchParams.set('$where', where.join(' AND '));
  url.searchParams.set('$limit', String(Math.min(ctx.limit || 500, 50000)));
  if (order) url.searchParams.set('$order', order);
  const data = await fetchJSON(url);
  return { url, rows: Array.isArray(data) ? data : [] };
}

function socrataPoint(row) {
  const c = row?.the_geom?.coordinates;
  if (Array.isArray(c) && Number.isFinite(+c[0]) && Number.isFinite(+c[1])) return pointGeometry(+c[0], +c[1]);
  const lon = +(row?.longitude ?? row?.lon ?? NaN);
  const lat = +(row?.latitude ?? row?.lat ?? NaN);
  return pointGeometry(lon, lat);
}

async function censusCounty(lat, lon) {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/coordinates');
  url.searchParams.set('x', String(lon));
  url.searchParams.set('y', String(lat));
  url.searchParams.set('benchmark', 'Public_AR_Current');
  url.searchParams.set('vintage', 'Current_Current');
  url.searchParams.set('format', 'json');
  const data = await fetchJSON(url);
  const county = data?.result?.geographies?.Counties?.[0];
  if (!county) return null;
  const stateFips = String(county.STATE || '').padStart(2, '0');
  const countyFips = String(county.COUNTY || '').padStart(3, '0');
  const state = STATE_BY_FIPS[stateFips];
  if (!state) return null;
  return {
    state,
    state_fips: stateFips,
    county_fips: countyFips,
    geoid: county.GEOID || stateFips + countyFips,
    name: county.NAME || county.BASENAME || null,
    query_url: url.toString()
  };
}

const STATE_BY_FIPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY','60':'AS','66':'GU','69':'MP','72':'PR','78':'VI'
};

const AWARD_TYPES = ['02','03','04','05','06','07','08','09','10','11','A','B','C','D','IDV_A','IDV_B','IDV_B_A','IDV_B_B','IDV_B_C','IDV_C','IDV_D','IDV_E'];

export const WAVE1_ADAPTERS = {
  'gbif-occurrences': async function gbif(ctx) {
    const b = bbox(ctx.lat, ctx.lon, Math.min(ctx.radiusKm, 200));
    const url = new URL('https://api.gbif.org/v1/occurrence/search');
    url.searchParams.set('geometry', bboxPolygonWKT(b));
    url.searchParams.set('hasCoordinate', 'true');
    url.searchParams.set('limit', String(Math.min(ctx.limit || 300, 300)));
    const data = await fetchJSON(url);
    return (data.results || []).flatMap(r => {
      const g = pointGeometry(+r.decimalLongitude, +r.decimalLatitude);
      if (!g) return [];
      return [normalizeSignal({
        source: 'gbif-occurrences',
        source_record_id: r.key ?? r.occurrenceID ?? null,
        predicate: 'ecology.occurrence',
        value: {
          scientific_name: r.scientificName || null,
          species: r.species || null,
          vernacular_name: r.vernacularName || null,
          taxon_key: r.taxonKey ?? null,
          species_key: r.speciesKey ?? null,
          basis_of_record: r.basisOfRecord || null,
          occurrence_status: r.occurrenceStatus || null,
          coordinate_uncertainty_m: r.coordinateUncertaintyInMeters ?? null,
          issues: r.issues || []
        },
        geometry: g,
        epistemic: 'REPORTED',
        observed_at: asISO(r.eventDate || r.dateIdentified || null),
        actors: ['GROUND', 'HUMAN', 'DOG', 'ECOLOGY'],
        provenance: {
          query_url: url.toString(),
          source_url: r.key ? `https://www.gbif.org/occurrence/${r.key}` : null,
          provider: 'GBIF',
          dataset_key: r.datasetKey || null,
          license: r.license || null
        },
        raw: { country_code: r.countryCode || null, publishing_org_key: r.publishingOrgKey || null }
      })];
    });
  },

  'inaturalist-observations': async function inaturalist(ctx) {
    const url = new URL('https://api.inaturalist.org/v1/observations');
    url.searchParams.set('lat', String(ctx.lat));
    url.searchParams.set('lng', String(ctx.lon));
    url.searchParams.set('radius', String(Math.min(ctx.radiusKm, 50)));
    url.searchParams.set('per_page', String(Math.min(ctx.limit || 200, 200)));
    url.searchParams.set('order_by', 'observed_on');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('geo', 'true');
    const data = await fetchJSON(url);
    return (data.results || []).flatMap(r => {
      const c = r.geojson?.coordinates || (r.location ? r.location.split(',').reverse().map(Number) : null);
      const g = c && pointGeometry(+c[0], +c[1]);
      if (!g) return [];
      return [normalizeSignal({
        source: 'inaturalist-observations',
        source_record_id: r.id,
        predicate: 'ecology.inaturalist_observation',
        value: {
          scientific_name: r.taxon?.name || null,
          common_name: r.taxon?.preferred_common_name || null,
          iconic_taxon: r.taxon?.iconic_taxon_name || null,
          quality_grade: r.quality_grade || null,
          captive: r.captive ?? null,
          obscured: r.obscured ?? null,
          photos: Array.isArray(r.photos) ? r.photos.length : null
        },
        geometry: g,
        epistemic: 'REPORTED',
        observed_at: asISO(r.time_observed_at || r.observed_on || null),
        actors: ['GROUND', 'HUMAN', 'DOG', 'ECOLOGY'],
        provenance: {
          query_url: url.toString(),
          source_url: r.uri || (r.id ? `https://www.inaturalist.org/observations/${r.id}` : null),
          provider: 'iNaturalist'
        },
        raw: { place_guess: r.place_guess || null, positional_accuracy: r.positional_accuracy ?? null }
      })];
    });
  },

  'epa-echo': async function echo(ctx) {
    const base = 'https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/ECHO_All_Media_Facilities/FeatureServer/0';
    const fields = [
      'OBJECTID','registry_id','fac_name','fac_street','fac_city','fac_state','fac_zip','fac_county',
      'fac_lat','fac_long','fac_accuracy_meters','fac_major_flag','fac_active_flag','fac_inspection_count',
      'fac_date_last_inspection','fac_formal_action_count','fac_total_penalties','fac_penalty_count',
      'fac_qtrs_with_nc','fac_programs_with_snc','fac_compliance_status','fac_snc_flg','fac_derived_huc'
    ].join(',');
    const { url, features } = await arcgisGeoJSON(base, ctx, fields);
    return features.flatMap(f => {
      const p = f.properties || {}, g = geojsonPoint(f);
      if (!g) return [];
      return [normalizeSignal({
        source: 'epa-echo',
        source_record_id: p.registry_id || p.OBJECTID,
        predicate: 'environment.regulated_facility',
        value: {
          name: p.fac_name || null,
          address: [p.fac_street, p.fac_city, p.fac_state, p.fac_zip].filter(Boolean).join(', '),
          county: p.fac_county || null,
          major: p.fac_major_flag || null,
          active: p.fac_active_flag || null,
          compliance_status: p.fac_compliance_status || null,
          significant_noncompliance: p.fac_snc_flg || null,
          programs_with_significant_noncompliance: p.fac_programs_with_snc ?? null,
          quarters_noncompliance_3y: p.fac_qtrs_with_nc ?? null,
          inspections_5y: p.fac_inspection_count ?? null,
          formal_actions_5y: p.fac_formal_action_count ?? null,
          penalties_5y: p.fac_penalty_count ?? null,
          penalty_total_5y_usd: p.fac_total_penalties ?? null,
          coordinate_accuracy_m: p.fac_accuracy_meters ?? null,
          huc: p.fac_derived_huc || null
        },
        geometry: g,
        epistemic: 'REPORTED',
        observed_at: asISO(p.fac_date_last_inspection || null),
        actors: ['GROUND', 'HUMAN', 'BUILDING', 'SERVICE', 'ECOLOGY', 'ECONOMY'],
        provenance: {
          query_url: url.toString(),
          source_url: p.registry_id ? `https://echo.epa.gov/detailed-facility-report?fid=${encodeURIComponent(p.registry_id)}` : null,
          provider: 'U.S. EPA ECHO',
          refresh: 'weekly'
        },
        raw: { objectid: p.OBJECTID }
      })];
    });
  },

  'nps-national-register': async function nps(ctx) {
    const base = 'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0';
    const fields = ['OBJECTID','NRIS_Refnum','RESNAME','ResType','Address','City','County','State','Is_NHL','STATUS','CertDate','IS_EXTANT','MAP_METHOD','SOURCE','SRC_DATE','SRC_SCALE','SRC_ACCU','ORIGINATOR','CR_ID','GEOM_ID'].join(',');
    const { url, features } = await arcgisGeoJSON(base, ctx, fields);
    return features.flatMap(f => {
      const p = f.properties || {}, g = geojsonPoint(f);
      if (!g) return [];
      return [normalizeSignal({
        source: 'nps-national-register',
        source_record_id: p.NRIS_Refnum || p.CR_ID || p.OBJECTID,
        predicate: 'memory.national_register_resource',
        value: {
          name: p.RESNAME || null,
          resource_type: p.ResType || null,
          address: p.Address || null,
          city: p.City || null,
          county: p.County || null,
          state: p.State || null,
          national_historic_landmark: p.Is_NHL ?? null,
          status: p.STATUS || null,
          extant: p.IS_EXTANT ?? null,
          map_method: p.MAP_METHOD || null,
          source_accuracy: p.SRC_ACCU ?? null
        },
        geometry: g,
        epistemic: 'DECLARED',
        valid_from: asISO(p.CertDate || null),
        actors: ['GROUND', 'HUMAN', 'BUILDING', 'MEMORY', 'SERVICE'],
        provenance: { query_url: url.toString(), provider: 'National Park Service', source: p.SOURCE || null, originator: p.ORIGINATOR || null },
        raw: { geom_id: p.GEOM_ID || null, src_date: p.SRC_DATE || null, src_scale: p.SRC_SCALE || null }
      })];
    });
  },

  'nola-building-permits': async function nolaPermits(ctx) {
    const start = isoDateDaysAgo(Math.max(ctx.sinceDays || 30, 365));
    const { url, rows } = await socrataWithinCircle(
      'https://data.nola.gov/resource/nbcf-m6c2.json', ctx, '*',
      `issuedate >= '${start}T00:00:00.000'`, 'issuedate DESC'
    );
    return rows.flatMap(r => {
      const g = socrataPoint(r);
      if (!g) return [];
      return [normalizeSignal({
        source: 'nola-building-permits',
        source_record_id: r.numstring || r.objectid || r.permitnum || null,
        predicate: 'change.building_permit',
        value: {
          permit: r.numstring || r.permitnum || null,
          permit_type: r.permittype || null,
          address: r.address || null,
          description: r.descr || null,
          construction_value_usd: r.constructionval == null ? null : Number(r.constructionval),
          land_use: r.landuse || null,
          proposed_use: r.proposedusecategory || null,
          status: r.status || r.currentstatus || null
        },
        geometry: g,
        epistemic: 'DECLARED',
        observed_at: asISO(r.issuedate || r.filingdate || null),
        actors: ['GROUND', 'HUMAN', 'BUILDING', 'SERVICE', 'ECONOMY'],
        provenance: { query_url: url.toString(), provider: 'City of New Orleans · Data.NOLA' },
        raw: { objectid: r.objectid || null }
      })];
    });
  },

  'nola-code-enforcement': async function nolaCode(ctx) {
    const { url, rows } = await socrataWithinCircle('https://data.nola.gov/resource/6ha4-bwyc.json', ctx, '*');
    return rows.flatMap(r => {
      const g = socrataPoint(r);
      if (!g) return [];
      return [normalizeSignal({
        source: 'nola-code-enforcement',
        source_record_id: r.caseno || r.objectid || null,
        predicate: 'service.code_enforcement_case',
        value: {
          case_number: r.caseno || null,
          status: r.status || r.casestatus || null,
          stage: r.stage || null,
          permit_status: r.permitstatus || null,
          hearing_result: r.hearingresult || r.prevhearingresult || null,
          next_hearing: r.nexthearingdate || null,
          zip: r.zipcode || null
        },
        geometry: g,
        epistemic: 'DECLARED',
        observed_at: asISO(r.statdate || r.statusdate || r.lastupdate || null),
        actors: ['GROUND', 'HUMAN', 'BUILDING', 'SERVICE'],
        provenance: { query_url: url.toString(), provider: 'City of New Orleans · Data.NOLA' },
        raw: { geopin: r.geopin || null }
      })];
    });
  },

  'atlanta-historic-buildings': async function atlHistoric(ctx) {
    const base = 'https://gis.atlantaga.gov/dpcd/rest/services/OpenDataService1/MapServer/17';
    const fields = ['OBJECTID','STATUS','ADDRESS','NAME','CLASS','DATE_','OF_STORI','PREV_USE','CONSTR_MAT','NPU','NR_POTENTI','DESCRIPTION','SURVEY','GLOBALID'].join(',');
    const { url, features } = await arcgisGeoJSON(base, ctx, fields);
    return features.flatMap(f => {
      const p = f.properties || {}, g = geojsonPoint(f);
      if (!g) return [];
      return [normalizeSignal({
        source: 'atlanta-historic-buildings',
        source_record_id: p.GLOBALID || p.OBJECTID,
        predicate: 'memory.atlanta_historic_building',
        value: {
          name: p.NAME || null,
          address: p.ADDRESS || null,
          status: p.STATUS || null,
          class: p.CLASS || null,
          date: p.DATE_ || null,
          stories: p.OF_STORI ?? null,
          previous_use: p.PREV_USE || null,
          construction_material: p.CONSTR_MAT || null,
          npu: p.NPU || null,
          national_register_potential: p.NR_POTENTI || null,
          description: p.DESCRIPTION || null,
          survey: p.SURVEY || null
        },
        geometry: g,
        epistemic: 'DECLARED',
        actors: ['GROUND', 'HUMAN', 'BUILDING', 'MEMORY', 'SERVICE'],
        provenance: { query_url: url.toString(), provider: 'City of Atlanta Department of City Planning' }
      })];
    });
  },

  'atlanta-rezoning-cases': async function atlRezoning(ctx) {
    const base = 'https://gis.atlantaga.gov/dpcd/rest/services/OpenDataService1/MapServer/23';
    const fields = ['OBJECTID','FROM_ZONE','TO_ZONE','DOCKET_NO','STATUS','FINAL_UPDA','ORDINANCE','ORDHYPERLINK','STATUSTYPE','ACRES','GLOBALID'].join(',');
    const { url, features } = await arcgisGeoJSON(base, ctx, fields);
    return features.map(f => {
      const p = f.properties || {};
      return normalizeSignal({
        source: 'atlanta-rezoning-cases',
        source_record_id: p.GLOBALID || p.DOCKET_NO || p.OBJECTID,
        predicate: 'change.rezoning_case',
        value: {
          docket: p.DOCKET_NO || null,
          from_zone: p.FROM_ZONE || null,
          to_zone: p.TO_ZONE || null,
          status: p.STATUS || null,
          status_type: p.STATUSTYPE || null,
          final_update: p.FINAL_UPDA || null,
          ordinance: p.ORDINANCE || null,
          ordinance_url: p.ORDHYPERLINK || null,
          acres: p.ACRES == null ? null : Number(p.ACRES)
        },
        geometry: f.geometry || null,
        epistemic: 'DECLARED',
        observed_at: asISO(p.FINAL_UPDA || null),
        actors: ['GROUND', 'HUMAN', 'BUILDING', 'SERVICE', 'ECONOMY'],
        provenance: { query_url: url.toString(), provider: 'City of Atlanta Department of City Planning' }
      });
    });
  },

  'usaspending-county': async function usaspendingCounty(ctx) {
    const county = await censusCounty(ctx.lat, ctx.lon);
    if (!county) return [];
    const endpoint = 'https://api.usaspending.gov/api/v2/search/spending_by_geography/';
    const body = {
      scope: 'place_of_performance',
      geo_layer: 'county',
      spending_type: 'obligation',
      filters: {
        time_period: [{ start_date: isoDateDaysAgo(Math.max(ctx.sinceDays || 30, 365)), end_date: todayISODate() }],
        award_type_codes: AWARD_TYPES,
        place_of_performance_locations: [{ country: 'USA', state: county.state, county: county.county_fips }]
      }
    };
    const data = await fetchJSON(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const rows = Array.isArray(data?.results) ? data.results : [];
    return rows.map((r, i) => normalizeSignal({
      source: 'usaspending-county',
      source_record_id: `${county.geoid}:${r.shape_code || r.code || i}`,
      predicate: 'money.federal_obligations_place_of_performance',
      value: {
        amount_usd: r.aggregated_amount ?? r.amount ?? null,
        county: county.name,
        county_geoid: county.geoid,
        state: county.state,
        response: r
      },
      geometry: null,
      epistemic: 'REPORTED',
      actors: ['GROUND', 'HUMAN', 'SERVICE', 'ECONOMY'],
      provenance: {
        query_url: endpoint,
        provider: 'USAspending.gov',
        county_lookup_url: county.query_url,
        spatial_scope: { country: 'USA', state: county.state, county_fips: county.county_fips, county_geoid: county.geoid, county_name: county.name },
        note: 'Administrative scope retained. This record is not pinned to the query point.'
      },
      raw: { request: body }
    }));
  }
};

export const WAVE1_GLOBAL_DEFAULTS = [
  'gbif-occurrences',
  'inaturalist-observations',
  'epa-echo',
  'nps-national-register',
  'usaspending-county'
];

export const WAVE1_LOCAL = [
  'nola-building-permits',
  'nola-code-enforcement',
  'atlanta-historic-buildings',
  'atlanta-rezoning-cases'
];
