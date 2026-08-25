import { normalizeSignal, pointGeometry } from './schema.mjs';

const UA = 'Unsettled-Atlas-Geonosis/0.1 (https://github.com/hartswf0/unsettled-atlas)';

async function fetchJSON(url, options = {}, timeoutMs = 20000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: ac.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...(options.headers || {}) }
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
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

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function firstPoint(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Point') return geometry.coordinates;
  if (geometry.type === 'Polygon') return geometry.coordinates?.[0]?.[0] || null;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates?.[0]?.[0]?.[0] || null;
  if (geometry.type === 'LineString') return geometry.coordinates?.[0] || null;
  return null;
}

export const ADAPTERS = {
  'usgs-earthquakes': async function earthquake(ctx) {
    const url = new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
    url.searchParams.set('format', 'geojson');
    url.searchParams.set('latitude', ctx.lat);
    url.searchParams.set('longitude', ctx.lon);
    url.searchParams.set('maxradiuskm', ctx.radiusKm);
    url.searchParams.set('starttime', isoDaysAgo(ctx.sinceDays || 30));
    url.searchParams.set('orderby', 'time');
    url.searchParams.set('limit', String(ctx.limit || 500));
    const data = await fetchJSON(url);
    return (data.features || []).map(f => {
      const c = f.geometry?.coordinates || [];
      return normalizeSignal({
        source: 'usgs-earthquakes',
        source_record_id: f.id,
        predicate: 'hazard.earthquake',
        value: {
          magnitude: f.properties?.mag ?? null,
          place: f.properties?.place ?? null,
          depth_km: c[2] ?? null,
          significance: f.properties?.sig ?? null,
          felt_reports: f.properties?.felt ?? null,
          status: f.properties?.status ?? null
        },
        geometry: pointGeometry(c[0], c[1]),
        epistemic: 'OBSERVED',
        observed_at: f.properties?.time ? new Date(f.properties.time).toISOString() : null,
        actors: ['GROUND', 'HUMAN', 'BUILDING', 'SERVICE', 'DISASTER'],
        provenance: { query_url: url.toString(), detail_url: f.properties?.url || null, provider: 'USGS' },
        raw: { type: f.properties?.type, tsunami: f.properties?.tsunami }
      });
    });
  },

  'nws-alerts': async function nwsAlerts(ctx) {
    const url = new URL('https://api.weather.gov/alerts/active');
    url.searchParams.set('point', `${ctx.lat},${ctx.lon}`);
    const data = await fetchJSON(url, { headers: { Accept: 'application/geo+json' } });
    return (data.features || []).map(f => {
      const p = f.properties || {};
      const coord = firstPoint(f.geometry) || [ctx.lon, ctx.lat];
      return normalizeSignal({
        source: 'nws-alerts',
        source_record_id: p.id || f.id,
        predicate: 'hazard.weather_alert',
        value: {
          event: p.event || null,
          severity: p.severity || null,
          certainty: p.certainty || null,
          urgency: p.urgency || null,
          headline: p.headline || null,
          area_desc: p.areaDesc || null
        },
        geometry: pointGeometry(coord[0], coord[1]),
        epistemic: 'DECLARED',
        observed_at: p.sent || null,
        valid_from: p.effective || p.onset || null,
        valid_to: p.ends || p.expires || null,
        actors: ['GROUND', 'HUMAN', 'DOG', 'CAR', 'BUILDING', 'SERVICE', 'ECOLOGY', 'DISASTER'],
        provenance: { query_url: url.toString(), provider: 'National Weather Service', source_url: p['@id'] || p.id || null },
        raw: { instruction: p.instruction || null, description: p.description || null }
      });
    });
  },

  'osm-notes': async function osmNotes(ctx) {
    const b = bbox(ctx.lat, ctx.lon, Math.min(ctx.radiusKm, 50));
    const url = new URL('https://api.openstreetmap.org/api/0.6/notes.json');
    url.searchParams.set('bbox', b.join(','));
    url.searchParams.set('limit', String(Math.min(ctx.limit || 500, 10000)));
    url.searchParams.set('closed', '0');
    const data = await fetchJSON(url);
    return (data.features || []).map(f => {
      const p = f.properties || {}, c = f.geometry?.coordinates || [];
      const comments = p.comments || [];
      return normalizeSignal({
        source: 'osm-notes',
        source_record_id: p.id || f.id,
        predicate: 'claim.map_note',
        value: {
          status: p.status || 'open',
          comments: comments.length,
          latest: comments.length ? comments[comments.length - 1].text || null : null
        },
        geometry: pointGeometry(c[0], c[1]),
        epistemic: 'REPORTED',
        observed_at: p.date_created || null,
        actors: ['GROUND', 'HUMAN', 'SERVICE'],
        provenance: {
          query_url: url.toString(),
          source_url: p.id ? `https://www.openstreetmap.org/note/${p.id}` : null,
          provider: 'OpenStreetMap contributors',
          license: 'ODbL 1.0'
        },
        raw: { comments }
      });
    });
  },

  'wikipedia-geosearch': async function wikipedia(ctx) {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');
    url.searchParams.set('list', 'geosearch');
    url.searchParams.set('gscoord', `${ctx.lat}|${ctx.lon}`);
    url.searchParams.set('gsradius', String(Math.min(10000, Math.max(10, ctx.radiusKm * 1000))));
    url.searchParams.set('gslimit', String(Math.min(ctx.limit || 100, 500)));
    const data = await fetchJSON(url);
    return (data.query?.geosearch || []).map(x => normalizeSignal({
      source: 'wikipedia-geosearch',
      source_record_id: x.pageid,
      predicate: 'attention.wikipedia_entity',
      value: { title: x.title, distance_m: x.dist, namespace: x.ns },
      geometry: pointGeometry(x.lon, x.lat),
      epistemic: 'REPORTED',
      actors: ['GROUND', 'HUMAN', 'MEMORY'],
      provenance: {
        query_url: url.toString(),
        source_url: `https://en.wikipedia.org/?curid=${x.pageid}`,
        provider: 'Wikimedia'
      }
    }));
  },

  'eonet': async function eonet(ctx) {
    const url = new URL('https://eonet.gsfc.nasa.gov/api/v3/events');
    url.searchParams.set('status', 'open');
    url.searchParams.set('limit', String(Math.min(ctx.limit || 200, 500)));
    const data = await fetchJSON(url);
    const out = [];
    for (const e of data.events || []) {
      for (let i = 0; i < (e.geometry || []).length; i++) {
        const g = e.geometry[i];
        const c = firstPoint(g);
        if (!c) continue;
        out.push(normalizeSignal({
          source: 'eonet',
          source_record_id: `${e.id}:${i}`,
          predicate: 'hazard.natural_event',
          value: {
            event_id: e.id,
            title: e.title,
            categories: (e.categories || []).map(x => x.title),
            closed: e.closed || null
          },
          geometry: pointGeometry(c[0], c[1]),
          epistemic: 'REPORTED',
          observed_at: g.date || null,
          actors: ['GROUND', 'HUMAN', 'DOG', 'CAR', 'BUILDING', 'SERVICE', 'ECOLOGY', 'DISASTER'],
          provenance: { query_url: url.toString(), source_url: e.link || null, provider: 'NASA EONET' },
          raw: { geometry_type: g.type || null }
        }));
      }
    }
    return out;
  }
};

export const DEFAULT_SOURCES = ['usgs-earthquakes', 'nws-alerts', 'osm-notes', 'wikipedia-geosearch', 'eonet'];
