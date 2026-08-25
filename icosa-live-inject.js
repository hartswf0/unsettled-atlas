/* ICOSA LIVE DATA · injected inside icosa-syntegrity's main closure.
 *
 * This file intentionally has no IIFE and no imports. The live harness inserts
 * it immediately before the existing closure ends, so it can use ICOSA's
 * canonical spatial primitives (cellAt, cellSlug, cellContains, drawGround,
 * openWhere, getJSON, wake, ...). The point is to adapt sources to ICOSA,
 * never to make a second map beside it.
 */

var LIVE_INDEX_DEPTH = 12;
var LIVE = {
  records: Object.create(null),
  sourceIds: Object.create(null),
  byCell: Object.create(null),
  sources: Object.create(null),
  started: false
};

function liveFinite(v) {
  var n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function liveText(v) {
  var s = String(v == null ? '' : v).trim();
  return s || null;
}
function liveRemoveRecord(id) {
  var r = LIVE.records[id];
  if (!r) return;
  var p = r.prefixes || [];
  for (var i = 0; i < p.length; i++) {
    var b = LIVE.byCell[p[i]];
    if (!b) continue;
    delete b[id];
    if (!Object.keys(b).length) delete LIVE.byCell[p[i]];
  }
  delete LIVE.records[id];
}
function liveIndexRecord(r) {
  r.v = fromLonLat(r.lon, r.lat);
  r.prefixes = [];
  for (var d = 0; d <= LIVE_INDEX_DEPTH; d++) {
    var slug = cellSlug(cellAt(r.v, d));
    r.prefixes.push(slug);
    if (!LIVE.byCell[slug]) LIVE.byCell[slug] = Object.create(null);
    LIVE.byCell[slug][r.id] = 1;
  }
  LIVE.records[r.id] = r;
}
function liveReplaceSource(sourceId, records, meta) {
  var old = LIVE.sourceIds[sourceId] || [];
  for (var i = 0; i < old.length; i++) liveRemoveRecord(old[i]);
  var ids = [];
  for (var j = 0; j < records.length; j++) {
    var r = records[j];
    if (!r || !r.id || !Number.isFinite(r.lon) || !Number.isFinite(r.lat)) continue;
    r.source = sourceId;
    liveIndexRecord(r);
    ids.push(r.id);
  }
  LIVE.sourceIds[sourceId] = ids;
  var s = LIVE.sources[sourceId];
  if (s) {
    s.state = 'ready';
    s.lastError = null;
    s.lastUpdate = Date.now();
    s.meta = meta || null;
    s.count = ids.length;
  }
  liveRefreshOpenPanel();
  wake();
}
function liveIdsForCell(cell) {
  if (!cell) return [];
  var bucketCell = cell.depth <= LIVE_INDEX_DEPTH
    ? cell
    : makeCell(cell.f, cell.path.slice(0, LIVE_INDEX_DEPTH));
  var bucket = LIVE.byCell[cellSlug(bucketCell)];
  if (!bucket) return [];
  var ids = Object.keys(bucket);
  if (cell.depth <= LIVE_INDEX_DEPTH) return ids;
  return ids.filter(function (id) {
    var r = LIVE.records[id];
    return r && cellContains(cell, r.v);
  });
}
function liveForCell(cell, kind) {
  return liveIdsForCell(cell).map(function (id) { return LIVE.records[id]; })
    .filter(function (r) { return r && (!kind || r.kind === kind); });
}
function liveInventory(cell) {
  var list = liveForCell(cell);
  var kinds = Object.create(null), sources = Object.create(null);
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    kinds[r.kind] = (kinds[r.kind] || 0) + 1;
    sources[r.source] = (sources[r.source] || 0) + 1;
  }
  return { count: list.length, kinds: kinds, sources: sources, items: list };
}
function liveAddressLadder(r) {
  if (!r || !r.prefixes) return [];
  var out = [];
  for (var i = 0; i < SCALES.length; i++) {
    var d = 0;
    while (d < LIVE_INDEX_DEPTH && cellEdgeKm(cellAt(r.v, d)) >= SCALES[i].min) d++;
    d = Math.max(0, d - 1);
    var slug = r.prefixes[Math.min(d, r.prefixes.length - 1)];
    if (!out.length || out[out.length - 1].slug !== slug) out.push({ scale: SCALES[i].n, slug: slug });
  }
  return out;
}

function registerLiveSource(spec) {
  if (!spec || !spec.id || typeof spec.load !== 'function') throw new Error('live source needs id + load');
  LIVE.sources[spec.id] = {
    id: spec.id,
    name: spec.name || spec.id,
    provider: spec.provider || spec.id,
    cadence: Math.max(5000, Number(spec.cadence) || 60000),
    state: 'idle',
    lastUpdate: 0,
    lastError: null,
    count: 0,
    meta: null,
    timer: null,
    load: spec.load
  };
  return LIVE.sources[spec.id];
}
function pollLiveSource(id) {
  var s = LIVE.sources[id];
  if (!s || s.state === 'loading') return;
  s.state = 'loading';
  s.lastError = null;
  s.load(function (err, records, meta) {
    if (err) {
      s.state = LIVE.sourceIds[id] && LIVE.sourceIds[id].length ? 'stale' : 'error';
      s.lastError = String(err);
      liveRefreshOpenPanel();
      wake();
    } else {
      liveReplaceSource(id, records || [], meta || null);
    }
    clearTimeout(s.timer);
    s.timer = setTimeout(function () { pollLiveSource(id); }, s.cadence);
  });
}
function startLiveSources() {
  if (LIVE.started) return;
  LIVE.started = true;
  Object.keys(LIVE.sources).forEach(function (id, i) {
    setTimeout(function () { pollLiveSource(id); }, 250 + i * 300);
  });
}

function normalizeUSGS(j) {
  var features = j && Array.isArray(j.features) ? j.features : [];
  var got = Date.now(), out = [];
  for (var i = 0; i < features.length; i++) {
    var f = features[i] || {}, g = f.geometry || {}, p = f.properties || {};
    var c = Array.isArray(g.coordinates) ? g.coordinates : [];
    var lon = liveFinite(c[0]), lat = liveFinite(c[1]), depth = liveFinite(c[2]);
    var mag = liveFinite(p.mag);
    if (lon == null || lat == null || mag == null || mag < 2.5) continue;
    var stable = liveText(f.id) || ('event-' + i);
    out.push({
      id: 'usgs:' + stable,
      kind: 'earthquake',
      lon: lon,
      lat: lat,
      observedAt: liveFinite(p.time),
      retrievedAt: got,
      epistemic: 'OBSERVED',
      properties: {
        magnitude: mag,
        depthKm: depth,
        place: liveText(p.place),
        significance: liveFinite(p.sig),
        tsunami: p.tsunami === 1,
        status: liveText(p.status),
        detail: liveText(p.detail),
        url: liveText(p.url)
      }
    });
  }
  return out;
}

registerLiveSource({
  id: 'usgs-earthquakes',
  name: 'Earthquakes 24h M2.5+',
  provider: 'USGS',
  cadence: 60000,
  load: function (done) {
    var url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
    getJSON(url, function (err, j) {
      if (err) return done(err);
      if (!j || !Array.isArray(j.features)) return done('malformed USGS response');
      done(null, normalizeUSGS(j), {
        generatedAt: j.metadata && liveFinite(j.metadata.generated),
        title: j.metadata && liveText(j.metadata.title),
        sourceUrl: url
      });
    });
  }
});

function liveSourceFreshness(s) {
  if (!s) return 'UNAVAILABLE';
  if (s.state === 'loading' && !s.lastUpdate) return 'LOADING';
  if (s.state === 'error') return 'UNAVAILABLE';
  if (!s.lastUpdate) return String(s.state || 'UNAVAILABLE').toUpperCase();
  var age = Date.now() - s.lastUpdate;
  if (age <= s.cadence * 2.25) return 'FRESH';
  return 'STALE';
}
function liveAge(ms) {
  if (!ms) return 'never';
  var sec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (sec < 90) return sec + 's';
  var min = Math.round(sec / 60);
  if (min < 90) return min + 'm';
  return Math.round(min / 60) + 'h';
}
function liveEsc(s) { return esc(String(s == null ? '' : s)); }

function renderLiveWhere(cell) {
  var root = document.getElementById('panel');
  if (!root || !root.classList.contains('open') || !cell) return;
  var old = document.getElementById('live-cell-record');
  if (old && old.parentNode) old.parentNode.removeChild(old);

  var inv = liveInventory(cell);
  var src = LIVE.sources['usgs-earthquakes'];
  var q = inv.items.filter(function (r) { return r.kind === 'earthquake'; })
    .sort(function (a, b) {
      return (b.properties.magnitude || 0) - (a.properties.magnitude || 0) ||
             (b.observedAt || 0) - (a.observedAt || 0);
    });
  var freshness = liveSourceFreshness(src);
  var state = src ? src.state : 'missing';
  var html = '<details id="live-cell-record"' + (q.length ? ' open' : '') + '>' +
    '<summary>LIVE RECORD · ' + q.length + ' EARTHQUAKE' + (q.length === 1 ? '' : 'S') +
    ' · USGS ' + freshness + '</summary>';

  if (state === 'error' && !src.lastUpdate) {
    html += '<p>USGS unavailable. No absence claim is made for this triangle.</p>';
  } else if (!q.length) {
    html += '<p>No M2.5+ USGS event in this triangle in the current 24-hour snapshot. ' +
      'Source refreshed ' + liveAge(src && src.lastUpdate) + ' ago.</p>';
  } else {
    for (var i = 0; i < Math.min(8, q.length); i++) {
      var r = q[i], p = r.properties || {};
      html += '<div class="row"><b>M' + Number(p.magnitude).toFixed(1) +
        (p.depthKm == null ? '' : ' · ' + Math.round(p.depthKm) + ' km deep') +
        '</b><span>' + liveEsc(p.place || 'USGS event') +
        (r.observedAt ? ' · ' + liveAge(r.observedAt) + ' ago' : '') + '</span></div>';
    }
    if (q.length > 8) html += '<p>+' + (q.length - 8) + ' more in this triangle.</p>';
  }
  html += '<p style="font-size:8px;letter-spacing:.08em">OBSERVED · source USGS · indexed by triangle address, not viewport.</p></details>';
  root.insertAdjacentHTML('beforeend', html);
}
function liveRefreshOpenPanel() {
  if (typeof whereCell !== 'undefined' && whereCell) renderLiveWhere(whereCell);
}

var openWhereWithoutLive = openWhere;
openWhere = function (cell, keep) {
  openWhereWithoutLive(cell, keep);
  renderLiveWhere(cell);
};

function liveVisibleBins(depth) {
  var bins = Object.create(null), ids = Object.keys(LIVE.records);
  for (var i = 0; i < ids.length; i++) {
    var r = LIVE.records[ids[i]];
    if (!r || r.kind !== 'earthquake') continue;
    var slug = r.prefixes[Math.min(depth, r.prefixes.length - 1)];
    if (!bins[slug]) bins[slug] = [];
    bins[slug].push(r);
  }
  return bins;
}
function liveCellScreen(cell, S) {
  var p = worldOfPoint(cellCentre(cell));
  var v = toView(p);
  var s = project(v, S);
  return { x: s[0], y: s[1], z: v[2] };
}
function livePointScreen(r, S) {
  var p = worldOfPoint(r.v), v = toView(p), s = project(v, S);
  return { x: s[0], y: s[1], z: v[2] };
}
function drawLiveCellTint(cell, S, alpha) {
  var pts = cell.tri.map(function (w) { return screenOfWorld(worldOf(cell.f, w), S); });
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  ctx.lineTo(pts[1][0], pts[1][1]);
  ctx.lineTo(pts[2][0], pts[2][1]);
  ctx.closePath();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COL.signal;
  ctx.fill();
  ctx.restore();
}
function drawLive(S) {
  if (!Object.keys(LIVE.records).length) return;
  var depth = Math.min(LIVE_INDEX_DEPTH, Math.max(0, depthForZoom()));
  var bins = liveVisibleBins(depth), slugs = Object.keys(bins);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 9px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

  for (var i = 0; i < slugs.length; i++) {
    var slug = slugs[i], list = bins[slug], cell = cellFromSlug(slug);
    if (!cell) continue;
    var sc = liveCellScreen(cell, S);
    if (sc.x < -40 || sc.y < -40 || sc.x > W + 40 || sc.y > H + 40) continue;

    if (depth <= 4 || list.length > 2) {
      drawLiveCellTint(cell, S, Math.min(0.16, 0.035 + Math.log2(list.length + 1) * 0.025));
      ctx.fillStyle = COL.signal;
      ctx.fillText(String(list.length), sc.x, sc.y);
      continue;
    }

    for (var j = 0; j < list.length; j++) {
      var r = list[j], ps = livePointScreen(r, S), mag = r.properties.magnitude || 2.5;
      if (ps.x < -20 || ps.y < -20 || ps.x > W + 20 || ps.y > H + 20) continue;
      var rad = clamp(2.5 + (mag - 2.5) * 1.2, 2.5, 9);
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, rad, 0, TAU);
      ctx.strokeStyle = COL.signal;
      ctx.lineWidth = mag >= 5 ? 2 : 1.2;
      ctx.stroke();
      if (view.zoom > 4.2) {
        ctx.fillStyle = COL.signal;
        ctx.fillText('M' + Number(mag).toFixed(1), ps.x, ps.y - rad - 7);
      }
    }
  }
  ctx.restore();
}

var drawGroundWithoutLive = drawGround;
drawGround = function (S) {
  drawGroundWithoutLive(S);
  drawLive(S);
};

window.ICOSA_LIVE = {
  registerSource: registerLiveSource,
  poll: pollLiveSource,
  queryCell: function (slug, kind) {
    var cell = typeof slug === 'string' ? cellFromSlug(slug) : slug;
    return cell ? liveForCell(cell, kind) : [];
  },
  inventory: function (slug) {
    var cell = typeof slug === 'string' ? cellFromSlug(slug) : slug;
    return cell ? liveInventory(cell) : null;
  },
  sourceState: function () {
    var out = {};
    Object.keys(LIVE.sources).forEach(function (id) {
      var s = LIVE.sources[id];
      out[id] = { state: s.state, freshness: liveSourceFreshness(s), count: s.count,
                  lastUpdate: s.lastUpdate, lastError: s.lastError, meta: s.meta };
    });
    return out;
  },
  addressLadder: liveAddressLadder,
  _state: LIVE
};

setTimeout(startLiveSources, 350);
