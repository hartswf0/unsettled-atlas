/* ICOSA LIVE SOURCES · second-stage adapters.
 * Injected after icosa-live-inject.js, inside the canonical ICOSA closure.
 *
 * Two deliberately different source classes live here:
 *   - datacenters: persistent infrastructure, one ODbL snapshot, global index
 *   - FIRMS: high-volume observed events, fetched only for the triangle in hand
 *
 * The renderer never receives raw source rows. Everything becomes the same
 * addressed record first, so the map remains place-first rather than layer-first.
 */

var LIVE2_CFG = window.ICOSA_LIVE_CONFIG || {};
var DATACENTER_SOURCE = 'osm-datacenters';
var FIRMS_SOURCE = 'nasa-firms';
var DATACENTER_URL = LIVE2_CFG.datacenterUrl ||
  'https://raw.githubusercontent.com/bilawalsidhu/gods-eye-view/main/src/data/local_data/datacenters/datacenters.geojsonl';
var FIRMS_DATASET = LIVE2_CFG.firmsSource || 'VIIRS_NOAA20_NRT';
var FIRMS_MAX_KM = 2500;
var FIRMS_TARGET = null;
var LIVE2_BIN_CACHE = Object.create(null);

function live2ConfigFirmsKey() {
  var direct = liveText(LIVE2_CFG.firmsMapKey);
  if (direct) return direct;
  try { return liveText(localStorage.getItem('ICOSA_FIRMS_MAP_KEY')); }
  catch (e) { return null; }
}

function live2FeatureAnchor(feature) {
  var g = feature && feature.geometry;
  if (!g) return null;
  if (g.type === 'Point' && Array.isArray(g.coordinates)) {
    var lon0 = liveFinite(g.coordinates[0]), lat0 = liveFinite(g.coordinates[1]);
    return lon0 == null || lat0 == null ? null : [lon0, lat0];
  }
  var sx = 0, sy = 0, n = 0;
  function walk(a) {
    if (!Array.isArray(a)) return;
    if (a.length >= 2 && Number.isFinite(Number(a[0])) && Number.isFinite(Number(a[1]))) {
      sx += Number(a[0]); sy += Number(a[1]); n++; return;
    }
    for (var i = 0; i < a.length; i++) walk(a[i]);
  }
  walk(g.coordinates);
  return n ? [sx / n, sy / n] : null;
}

function live2NormalizeDatacenters(text) {
  var lines = String(text || '').split('\n'), out = [], got = Date.now();
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var f;
    try { f = JSON.parse(line); } catch (e) { continue; }
    var a = live2FeatureAnchor(f);
    if (!a) continue;
    var p = f.properties || {}, tags = p.tags || {};
    var rawId = liveText(f.id) || liveText(p.id) || liveText(p.osm_id) ||
      (liveText(p.osm_type) && liveText(p.osm_id) ? p.osm_type + ':' + p.osm_id : null) || ('row-' + i);
    var name = liveText(tags.name) || liveText(p.name) || liveText(tags.operator) || liveText(p.operator) || 'data center';
    var operator = liveText(tags.operator) || liveText(p.operator) || liveText(tags['operator:short']);
    var capacity = liveText(tags['capacity:it_load']) || liveText(tags.it_load) ||
      liveText(tags.capacity) || liveText(p.capacity);
    out.push({
      id: 'osm-dc:' + rawId,
      kind: 'datacenter',
      lon: a[0],
      lat: a[1],
      observedAt: null,
      retrievedAt: got,
      epistemic: 'RECORD',
      properties: {
        name: name,
        operator: operator,
        capacity: capacity,
        osmType: liveText(p.osm_type),
        osmId: liveText(p.osm_id)
      }
    });
  }
  return out;
}

registerLiveSource({
  id: DATACENTER_SOURCE,
  name: 'Data centers',
  provider: 'OpenStreetMap contributors',
  cadence: 86400000,
  load: function (done) {
    fetch(DATACENTER_URL, { credentials: 'omit', cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        var rows = live2NormalizeDatacenters(text);
        if (!rows.length) throw new Error('datacenter snapshot empty or malformed');
        done(null, rows, {
          sourceUrl: DATACENTER_URL,
          attribution: '© OpenStreetMap contributors',
          license: 'ODbL 1.0',
          snapshot: true,
          featureCount: rows.length
        });
      })
      .catch(function (e) { done(String(e && e.message || e)); });
  }
});

function live2CsvRows(text) {
  var lines = String(text || '').replace(/\r/g, '').split('\n').filter(function (x) { return x.trim(); });
  if (lines.length < 2) return [];
  function cols(line) {
    var out = [], s = '', quoted = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { s += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === ',' && !quoted) { out.push(s); s = ''; }
      else s += ch;
    }
    out.push(s); return out;
  }
  var head = cols(lines[0]).map(function (x) { return x.trim(); }), rows = [];
  for (var j = 1; j < lines.length; j++) {
    var v = cols(lines[j]), r = {};
    for (var k = 0; k < head.length; k++) r[head[k]] = v[k] == null ? '' : v[k];
    rows.push(r);
  }
  return rows;
}

function live2Confidence(v) {
  var s = String(v == null ? '' : v).trim().toLowerCase();
  if (s === 'low' || s === 'l') return 0.3;
  if (s === 'nominal' || s === 'n') return 0.6;
  if (s === 'high' || s === 'h') return 0.9;
  var n = Number(s);
  return Number.isFinite(n) ? clamp(n / 100, 0, 1) : 0;
}

function live2FireTime(date, time) {
  if (!date) return null;
  var t = String(time == null ? '0000' : time).padStart(4, '0');
  var ms = Date.parse(String(date).slice(0, 10) + 'T' + t.slice(0, 2) + ':' + t.slice(2, 4) + ':00Z');
  return Number.isFinite(ms) ? ms : null;
}

function live2NormalizeFirms(rows, target) {
  var out = [], got = Date.now();
  for (var i = 0; i < rows.length; i++) {
    var x = rows[i] || {};
    var lat = liveFinite(x.latitude != null ? x.latitude : x.lat);
    var lon = liveFinite(x.longitude != null ? x.longitude : x.lon);
    if (lat == null || lon == null) continue;
    var v = fromLonLat(lon, lat);
    if (target && target.cell && !cellContains(target.cell, v)) continue;
    var date = x.acq_date != null ? x.acq_date : x.acqDate;
    var time = x.acq_time != null ? x.acq_time : x.acqTime;
    var sensor = liveText(x.instrument) || liveText(x.sensor) || 'VIIRS';
    var sat = liveText(x.satellite);
    var observed = live2FireTime(date, time);
    var stable = [sensor || '', sat || '', date || '', time || '', lon.toFixed(5), lat.toFixed(5)].join(':');
    out.push({
      id: 'firms:' + stable,
      kind: 'fire',
      lon: lon,
      lat: lat,
      observedAt: observed,
      retrievedAt: got,
      epistemic: 'OBSERVED',
      properties: {
        frp: liveFinite(x.frp),
        confidence: live2Confidence(x.confidence),
        brightness: liveFinite(x.bright_ti4 != null ? x.bright_ti4 : x.brightness),
        sensor: sensor,
        satellite: sat,
        daynight: liveText(x.daynight),
        acquisitionDate: liveText(date),
        acquisitionTime: liveText(time)
      }
    });
  }
  return out;
}

function live2CellBounds(cell) {
  var pts = cellCorners(cell).map(lonlat), lons = [], lats = [];
  for (var i = 0; i < pts.length; i++) { lons.push(pts[i][0]); lats.push(pts[i][1]); }
  var south = Math.min.apply(null, lats), north = Math.max.apply(null, lats);
  var west = Math.min.apply(null, lons), east = Math.max.apply(null, lons);
  var pad = Math.min(4, Math.max(0.15, cellEdgeKm(cell) / 111 * 0.06));
  south = clamp(south - pad, -90, 90); north = clamp(north + pad, -90, 90);
  if (east - west <= 180) return [[clamp(west - pad, -180, 180), south, clamp(east + pad, -180, 180), north]];
  // Dateline: negative longitudes belong to the eastern half, positive to western half.
  var neg = lons.filter(function (x) { return x < 0; });
  var pos = lons.filter(function (x) { return x >= 0; });
  var left = pos.length ? Math.min.apply(null, pos) : 170;
  var right = neg.length ? Math.max.apply(null, neg) : -170;
  return [[clamp(left - pad, -180, 180), south, 180, north], [-180, south, clamp(right + pad, -180, 180), north]];
}

function live2FirmsUrl(key, box) {
  return 'https://firms.modaps.eosdis.nasa.gov/api/area/csv/' + encodeURIComponent(key) + '/' +
    encodeURIComponent(FIRMS_DATASET) + '/' + box.map(function (x) { return Number(x).toFixed(4); }).join(',') + '/1';
}

function live2FetchText(url) {
  return fetch(url, { credentials: 'omit', cache: 'no-store' }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  });
}

function live2RegisterFirms() {
  if (LIVE.sources[FIRMS_SOURCE]) return;
  registerLiveSource({
    id: FIRMS_SOURCE,
    name: 'Active fire detections',
    provider: 'NASA FIRMS',
    cadence: 300000,
    load: function (done) {
      var target = FIRMS_TARGET, key = live2ConfigFirmsKey();
      if (!target || !target.cell) return done('awaiting a regional triangle');
      if (!key) return done('FIRMS MAP_KEY not configured');
      var boxes = live2CellBounds(target.cell);
      Promise.all(boxes.map(function (box) { return live2FetchText(live2FirmsUrl(key, box)); }))
        .then(function (parts) {
          var rows = [];
          for (var i = 0; i < parts.length; i++) rows = rows.concat(live2CsvRows(parts[i]));
          var fires = live2NormalizeFirms(rows, target);
          done(null, fires, {
            coverageCell: target.slug,
            coverageKm: Math.round(cellEdgeKm(target.cell)),
            bboxCount: boxes.length,
            dataset: FIRMS_DATASET,
            dayRange: 1,
            attribution: 'NASA FIRMS',
            scoped: true
          });
        })
        .catch(function (e) { done(String(e && e.message || e)); });
    }
  });
  if (FIRMS_TARGET && live2ConfigFirmsKey()) pollLiveSource(FIRMS_SOURCE);
}
setTimeout(live2RegisterFirms, 520); // after the core auto-start has enumerated its global sources

function live2RequestFirms(cell) {
  if (!cell) return;
  if (cellEdgeKm(cell) > FIRMS_MAX_KM) {
    FIRMS_TARGET = null;
    var wide = LIVE.sources[FIRMS_SOURCE];
    if (wide) { wide.state = 'idle'; wide.lastError = 'enter a regional triangle to query FIRMS'; }
    liveRefreshOpenPanel();
    return;
  }
  var slug = cellSlug(cell);
  if (FIRMS_TARGET && FIRMS_TARGET.slug === slug) return;
  FIRMS_TARGET = { cell: cell, slug: slug };
  var s = LIVE.sources[FIRMS_SOURCE];
  if (!s) return;
  if (!live2ConfigFirmsKey()) {
    s.state = 'unconfigured'; s.lastError = 'FIRMS MAP_KEY not configured';
    liveRefreshOpenPanel(); return;
  }
  pollLiveSource(FIRMS_SOURCE);
}

function live2SourceRecords(sourceId, kind) {
  var ids = LIVE.sourceIds[sourceId] || [], out = [];
  for (var i = 0; i < ids.length; i++) {
    var r = LIVE.records[ids[i]];
    if (r && (!kind || r.kind === kind)) out.push(r);
  }
  return out;
}

function live2Bins(sourceId, depth, kind) {
  var s = LIVE.sources[sourceId], stamp = s ? s.lastUpdate : 0;
  var key = [sourceId, depth, kind || '', stamp].join('|');
  if (LIVE2_BIN_CACHE[key]) return LIVE2_BIN_CACHE[key];
  var bins = Object.create(null), rows = live2SourceRecords(sourceId, kind);
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], slug = r.prefixes[Math.min(depth, r.prefixes.length - 1)];
    if (!bins[slug]) bins[slug] = [];
    bins[slug].push(r);
  }
  LIVE2_BIN_CACHE = Object.create(null); // one current-depth cache per frame regime is enough
  LIVE2_BIN_CACHE[key] = bins;
  return bins;
}

function live2FillCell(cell, S, fill, alpha, stroke) {
  var pts = cell.tri.map(function (w) { return screenOfWorld(worldOf(cell.f, w), S); });
  ctx.save();
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]);
  ctx.lineTo(pts[2][0], pts[2][1]); ctx.closePath();
  ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.globalAlpha = Math.min(1, alpha * 4); ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke(); }
  ctx.restore();
}

function live2DrawDatacenters(S) {
  var src = LIVE.sources[DATACENTER_SOURCE];
  if (!src || !src.lastUpdate) return;
  var depth = Math.min(LIVE_INDEX_DEPTH, Math.max(0, depthForZoom()));
  var bins = live2Bins(DATACENTER_SOURCE, depth, 'datacenter'), slugs = Object.keys(bins);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  for (var i = 0; i < slugs.length; i++) {
    var cell = cellFromSlug(slugs[i]), list = bins[slugs[i]];
    if (!cell || !facingCamera(cellCentre(cell))) continue;
    var sc = liveCellScreen(cell, S);
    if (sc.x < -30 || sc.y < -30 || sc.x > W + 30 || sc.y > H + 30) continue;
    if (depth <= 4 || list.length > 9) {
      live2FillCell(cell, S, COL.ink, Math.min(0.09, 0.012 + Math.log2(list.length + 1) * 0.012), COL.ink);
      ctx.fillStyle = COL.ink; ctx.fillText('D ' + list.length, sc.x, sc.y + 10);
    } else {
      for (var j = 0; j < list.length; j++) {
        var r = list[j]; if (!facingCamera(r.v)) continue;
        var p = livePointScreen(r, S);
        if (p.x < -10 || p.y < -10 || p.x > W + 10 || p.y > H + 10) continue;
        var z = view.zoom > 4.8 ? 4 : 2.7;
        ctx.strokeStyle = COL.ink; ctx.lineWidth = 1;
        ctx.strokeRect(p.x - z, p.y - z, z * 2, z * 2);
        if (view.zoom > 6.1 && r.properties && r.properties.name) {
          ctx.fillStyle = COL.ink;
          ctx.fillText(String(r.properties.name).slice(0, 24).toUpperCase(), p.x, p.y - 10);
        }
      }
    }
  }
  ctx.restore();
}

function live2DrawFires(S) {
  var src = LIVE.sources[FIRMS_SOURCE];
  if (!src || !src.lastUpdate) return;
  var depth = Math.min(LIVE_INDEX_DEPTH, Math.max(0, depthForZoom()));
  var bins = live2Bins(FIRMS_SOURCE, depth, 'fire'), slugs = Object.keys(bins);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  for (var i = 0; i < slugs.length; i++) {
    var cell = cellFromSlug(slugs[i]), list = bins[slugs[i]];
    if (!cell || !facingCamera(cellCentre(cell))) continue;
    var sc = liveCellScreen(cell, S);
    if (sc.x < -30 || sc.y < -30 || sc.x > W + 30 || sc.y > H + 30) continue;
    if (depth <= 5 || list.length > 8) {
      live2FillCell(cell, S, COL.signal, Math.min(0.20, 0.04 + Math.log2(list.length + 1) * 0.025), COL.signal);
      ctx.fillStyle = COL.signal; ctx.fillText('F ' + list.length, sc.x, sc.y - 10);
    } else {
      for (var j = 0; j < list.length; j++) {
        var r = list[j]; if (!facingCamera(r.v)) continue;
        var p = livePointScreen(r, S);
        if (p.x < -10 || p.y < -10 || p.x > W + 10 || p.y > H + 10) continue;
        var frp = r.properties && r.properties.frp || 0;
        var rad = clamp(1.8 + Math.log2(frp + 1) * 0.55, 1.8, 6);
        ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, TAU);
        ctx.fillStyle = COL.signal; ctx.globalAlpha = 0.72; ctx.fill(); ctx.globalAlpha = 1;
      }
    }
  }
  ctx.restore();
}

var drawLiveCoreSources = drawLive;
drawLive = function (S) {
  drawLiveCoreSources(S);
  live2DrawDatacenters(S);
  live2DrawFires(S);
};

function live2RemovePanel(id) {
  var el = document.getElementById(id);
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function live2RenderSourcePanels(cell) {
  var root = document.getElementById('panel');
  if (!root || !root.classList.contains('open') || !cell) return;
  live2RemovePanel('live-infra-record'); live2RemovePanel('live-fire-record');

  var dcSrc = LIVE.sources[DATACENTER_SOURCE], dcs = liveForCell(cell, 'datacenter');
  dcs.sort(function (a, b) { return String(a.properties.name || '').localeCompare(String(b.properties.name || '')); });
  var dh = '<details id="live-infra-record"' + (dcs.length ? ' open' : '') + '><summary>INFRASTRUCTURE · ' +
    dcs.length + ' DATA CENTER' + (dcs.length === 1 ? '' : 'S') + ' · ' + liveSourceFreshness(dcSrc) + '</summary>';
  if (dcSrc && dcSrc.state === 'error' && !dcSrc.lastUpdate) {
    dh += '<p>Datacenter snapshot unavailable. No absence claim is made for this triangle.</p>';
  } else if (!dcs.length) {
    dh += '<p>No datacenter record from the loaded OSM snapshot intersects this triangle.</p>';
  } else {
    for (var i = 0; i < Math.min(10, dcs.length); i++) {
      var d = dcs[i], pp = d.properties || {};
      dh += '<div class="row"><b>' + liveEsc(pp.name || 'DATA CENTER') + '</b><span>' +
        liveEsc([pp.operator, pp.capacity].filter(Boolean).join(' · ') || 'OpenStreetMap record') + '</span></div>';
    }
    if (dcs.length > 10) dh += '<p>+' + (dcs.length - 10) + ' more in this triangle.</p>';
  }
  dh += '<p style="font-size:8px;letter-spacing:.08em">RECORD · © OpenStreetMap contributors · ODbL 1.0 · snapshot imported from God\'s Eye View.</p></details>';
  root.insertAdjacentHTML('beforeend', dh);

  var fireSrc = LIVE.sources[FIRMS_SOURCE], fires = liveForCell(cell, 'fire');
  fires.sort(function (a, b) { return (b.observedAt || 0) - (a.observedAt || 0); });
  var coverage = fireSrc && fireSrc.meta && fireSrc.meta.coverageCell;
  var exactCoverage = coverage === cellSlug(cell);
  var fh = '<details id="live-fire-record"' + (fires.length ? ' open' : '') + '><summary>ACTIVE FIRE · ' +
    fires.length + ' DETECTION' + (fires.length === 1 ? '' : 'S') + ' · FIRMS ' + liveSourceFreshness(fireSrc) + '</summary>';
  if (!fireSrc || fireSrc.state === 'idle') {
    fh += '<p>' + (cellEdgeKm(cell) > FIRMS_MAX_KM ? 'Enter a regional triangle to query FIRMS.' : 'FIRMS has not been queried for this triangle yet.') + '</p>';
  } else if (fireSrc.state === 'unconfigured') {
    fh += '<p>NASA FIRMS is BYOK. No fire-absence claim is made until a MAP_KEY is configured.</p>';
  } else if (fireSrc.state === 'error' && !fireSrc.lastUpdate) {
    fh += '<p>NASA FIRMS unavailable. No fire-absence claim is made for this triangle.</p>';
  } else if (!exactCoverage) {
    fh += '<p>The loaded FIRMS snapshot belongs to another triangle. This ground is not being described as fire-free.</p>';
  } else if (!fires.length) {
    fh += '<p>No detection from ' + liveEsc(FIRMS_DATASET) + ' fell inside this triangle in the current one-day query.</p>';
  } else {
    for (var j = 0; j < Math.min(8, fires.length); j++) {
      var f = fires[j], fp = f.properties || {};
      fh += '<div class="row"><b>' + liveEsc(fp.sensor || 'VIIRS') +
        (fp.frp == null ? '' : ' · FRP ' + Number(fp.frp).toFixed(1)) + '</b><span>' +
        (f.observedAt ? liveAge(f.observedAt) + ' ago' : 'observed') +
        (fp.confidence ? ' · ' + Math.round(fp.confidence * 100) + '% confidence' : '') + '</span></div>';
    }
    if (fires.length > 8) fh += '<p>+' + (fires.length - 8) + ' more detections in this triangle.</p>';
  }
  fh += '<p style="font-size:8px;letter-spacing:.08em">OBSERVED · NASA FIRMS · attention-scoped query · records filtered back through the triangle.</p></details>';
  root.insertAdjacentHTML('beforeend', fh);
}

var renderLiveWhereCoreSources = renderLiveWhere;
renderLiveWhere = function (cell) {
  renderLiveWhereCoreSources(cell);
  live2RenderSourcePanels(cell);
};

var openWhereCoreSources = openWhere;
openWhere = function (cell, keep) {
  openWhereCoreSources(cell, keep);
  live2RequestFirms(cell);
};

window.ICOSA_LIVE.setFirmsKey = function (key) {
  var k = liveText(key);
  try {
    if (k) localStorage.setItem('ICOSA_FIRMS_MAP_KEY', k);
    else localStorage.removeItem('ICOSA_FIRMS_MAP_KEY');
  } catch (e) { return false; }
  var s = LIVE.sources[FIRMS_SOURCE];
  if (s) { s.state = 'idle'; s.lastError = null; }
  if (k && FIRMS_TARGET && s) pollLiveSource(FIRMS_SOURCE);
  liveRefreshOpenPanel();
  return true;
};
window.ICOSA_LIVE.clearFirmsKey = function () { return window.ICOSA_LIVE.setFirmsKey(null); };
window.ICOSA_LIVE.requestFirms = function (slug) {
  var c = typeof slug === 'string' ? cellFromSlug(slug) : slug;
  if (!c) return false;
  live2RequestFirms(c); return true;
};
window.ICOSA_LIVE.sourceInfo = {
  datacenters: { source: 'OpenStreetMap contributors', license: 'ODbL 1.0', url: DATACENTER_URL },
  firms: { source: 'NASA FIRMS', dataset: FIRMS_DATASET, scoped: true, maxCellKm: FIRMS_MAX_KM }
};
