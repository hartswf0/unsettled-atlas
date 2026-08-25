/* ICOSA LIVE MOTION · moving observations as address transitions.
 * Injected after the persistent/scoped source adapters, inside ICOSA's closure.
 *
 * A plane is not primarily an icon. It is a sequence of cell addresses.
 * adsb.lol is the upstream observation source; ICOSA supplies the trace.
 *
 * IMPORTANT DEPLOYMENT LAW: api.adsb.lol does not currently authorize the
 * GitHub Pages browser origin with CORS. The public static build therefore
 * never silently fetches the upstream directly. Configure adsbBaseUrl to a
 * CORS-enabled reverse proxy/mirror that preserves the adsb.lol /v2 path.
 */

var AIR_SOURCE = 'adsb-lol-aircraft';
var AIR_TRACE_DEPTH = 9;
var AIR_MAX_CELL_KM = 900;
var AIR_TARGET = null;
var AIR_HISTORY = Object.create(null);
var AIR_HISTORY_TTL = 10 * 60 * 1000;
var AIR_UPSTREAM_URL = 'https://api.adsb.lol/v2';
var AIR_BASE_URL = (window.ICOSA_LIVE_CONFIG && liveText(window.ICOSA_LIVE_CONFIG.adsbBaseUrl)) || null;

function airNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v); return Number.isFinite(n) ? n : null;
}
function airSeenNow(payload) {
  var n = airNumber(payload && payload.now);
  if (n == null) return Date.now();
  return n > 10000000000 ? n : n * 1000;
}
function airCategory(v) {
  var s = String(v || '').trim().toUpperCase();
  return s || null;
}
function airConfigured() { return !!liveText(AIR_BASE_URL); }

function normalizeAdsbLol(payload) {
  var ac = payload && Array.isArray(payload.ac) ? payload.ac : [];
  var now = airSeenNow(payload), out = [];
  for (var i = 0; i < ac.length; i++) {
    var a = ac[i] || {}, hex = String(a.hex || '').trim().toLowerCase();
    var lat = airNumber(a.lat), lon = airNumber(a.lon);
    if (!hex || lat == null || lon == null) continue;
    var seenPos = Math.max(0, airNumber(a.seen_pos) != null ? airNumber(a.seen_pos) : (airNumber(a.seen) || 0));
    var onGround = a.alt_baro === 'ground';
    var baroFt = onGround ? null : airNumber(a.alt_baro);
    var geomFt = airNumber(a.alt_geom);
    var altM = geomFt != null ? geomFt * 0.3048 : (baroFt != null ? baroFt * 0.3048 : 0);
    var gs = airNumber(a.gs), rate = airNumber(a.baro_rate);
    if (rate == null) rate = airNumber(a.geom_rate);
    out.push({
      id: 'adsb:' + hex,
      kind: 'aircraft',
      lon: lon,
      lat: lat,
      observedAt: now - seenPos * 1000,
      retrievedAt: Date.now(),
      epistemic: 'OBSERVED',
      properties: {
        icao24: hex,
        callsign: liveText(a.flight) || liveText(a.r),
        altitudeM: altM,
        onGround: onGround,
        groundSpeedMps: gs == null ? null : gs * 0.514444,
        trackDeg: airNumber(a.track),
        verticalRateMps: rate == null ? null : rate * 0.00508,
        squawk: liveText(a.squawk),
        category: airCategory(a.category),
        registration: liveText(a.r),
        type: liveText(a.t)
      }
    });
  }
  return out;
}

function airTraceRecords(records) {
  var now = Date.now(), seen = Object.create(null);
  for (var i = 0; i < records.length; i++) {
    var r = records[i], id = r.properties && r.properties.icao24 || r.id;
    var v = fromLonLat(r.lon, r.lat), c = cellAt(v, AIR_TRACE_DEPTH), slug = cellSlug(c);
    seen[id] = 1;
    var h = AIR_HISTORY[id];
    if (!h) h = AIR_HISTORY[id] = { id: id, lastSlug: null, lastSeen: 0, trail: [], transitions: [] };
    var previous = h.lastSlug;
    if (previous && previous !== slug) {
      h.transitions.push({ from: previous, to: slug, at: r.observedAt || now });
      if (h.transitions.length > 64) h.transitions.splice(0, h.transitions.length - 64);
    }
    var last = h.trail.length ? h.trail[h.trail.length - 1] : null;
    if (!last || arcKm(last.v, v) > 0.25 || now - last.at > 30000) {
      h.trail.push({ v: v, at: r.observedAt || now, slug: slug });
      if (h.trail.length > 36) h.trail.splice(0, h.trail.length - 36);
    }
    h.lastSlug = slug; h.lastSeen = now;
    r.motion = {
      traceDepth: AIR_TRACE_DEPTH,
      cell: slug,
      previousCell: previous,
      transitioned: !!previous && previous !== slug,
      transitionCount: h.transitions.length
    };
  }
  Object.keys(AIR_HISTORY).forEach(function (id) {
    if (!seen[id] && now - AIR_HISTORY[id].lastSeen > AIR_HISTORY_TTL) delete AIR_HISTORY[id];
  });
}

function airUrl(target) {
  if (!airConfigured()) return null;
  var p = lonlat(cellCentre(target.cell));
  return AIR_BASE_URL.replace(/\/$/, '') + '/lat/' + p[1].toFixed(5) + '/lon/' + p[0].toFixed(5) +
    '/dist/' + Math.round(target.radiusNm);
}

function registerAirSource() {
  if (LIVE.sources[AIR_SOURCE]) return;
  registerLiveSource({
    id: AIR_SOURCE,
    name: 'Aircraft',
    provider: 'adsb.lol contributors',
    cadence: 15000,
    load: function (done) {
      var target = AIR_TARGET;
      if (!target || !target.cell) return done('awaiting a local triangle');
      if (!airConfigured()) return done('aircraft proxy/base URL not configured');
      var url = airUrl(target);
      fetch(url, { credentials: 'omit', cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) {
          var rows = normalizeAdsbLol(j).filter(function (r) { return cellContains(target.cell, fromLonLat(r.lon, r.lat)); });
          airTraceRecords(rows);
          done(null, rows, {
            coverageCell: target.slug,
            radiusNm: target.radiusNm,
            radiusKm: Math.round(target.radiusNm * 1.852),
            completeForCell: target.complete,
            attribution: 'adsb.lol contributors',
            license: 'ODbL 1.0',
            scoped: true,
            upstream: AIR_UPSTREAM_URL,
            transportBase: AIR_BASE_URL,
            transport: 'configured CORS-enabled reverse proxy/mirror'
          });
        })
        .catch(function (e) { done(String(e && e.message || e)); });
    }
  });
  var s = LIVE.sources[AIR_SOURCE];
  if (s && !airConfigured()) {
    s.state = 'unconfigured';
    s.lastError = 'configure ICOSA_LIVE_CONFIG.adsbBaseUrl with a CORS-enabled adsb.lol /v2 proxy or mirror';
  }
  if (AIR_TARGET && airConfigured()) pollLiveSource(AIR_SOURCE);
}
setTimeout(registerAirSource, 650); // manual/scoped: keep it out of the global auto-start set

function requestAircraft(cell) {
  if (!cell) return;
  var km = cellEdgeKm(cell), s = LIVE.sources[AIR_SOURCE];
  if (km > AIR_MAX_CELL_KM) {
    AIR_TARGET = null;
    if (s) { s.state = 'idle'; s.lastError = 'enter a regional or smaller triangle to query aircraft'; }
    liveRefreshOpenPanel();
    return;
  }
  var slug = cellSlug(cell), needKm = km * 0.70, radiusNm = clamp(needKm / 1.852, 25, 250);
  if (AIR_TARGET && AIR_TARGET.slug === slug) return;
  AIR_TARGET = { cell: cell, slug: slug, radiusNm: radiusNm, complete: radiusNm * 1.852 >= needKm - 1 };
  if (!s) return;
  if (!airConfigured()) {
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    s.state = 'unconfigured';
    s.lastError = 'aircraft transport is unconfigured because api.adsb.lol does not authorize this Pages origin with CORS';
    liveRefreshOpenPanel();
    return;
  }
  pollLiveSource(AIR_SOURCE);
}

function airRecords(cell) {
  return liveForCell(cell, 'aircraft').sort(function (a, b) {
    var aa = a.properties && a.properties.altitudeM || 0, bb = b.properties && b.properties.altitudeM || 0;
    return bb - aa;
  });
}

function drawAirTrail(history, S) {
  if (!history || history.trail.length < 2) return;
  ctx.beginPath(); var moved = false;
  for (var i = 0; i < history.trail.length; i++) {
    var p = history.trail[i].v;
    if (!facingCamera(p)) { moved = false; continue; }
    var q = screenOfWorld(worldOfPoint(p), S);
    if (!moved) { ctx.moveTo(q[0], q[1]); moved = true; }
    else ctx.lineTo(q[0], q[1]);
  }
  ctx.strokeStyle = COL.muted; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.8; ctx.stroke(); ctx.globalAlpha = 1;
}

function drawAircraft(S) {
  var src = LIVE.sources[AIR_SOURCE];
  if (!src || !src.lastUpdate) return;
  var rows = live2SourceRecords(AIR_SOURCE, 'aircraft');
  if (!rows.length) return;
  var depth = Math.min(LIVE_INDEX_DEPTH, Math.max(0, depthForZoom()));
  var bins = live2Bins(AIR_SOURCE, depth, 'aircraft'), slugs = Object.keys(bins);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  for (var i = 0; i < slugs.length; i++) {
    var cell = cellFromSlug(slugs[i]), list = bins[slugs[i]];
    if (!cell || !facingCamera(cellCentre(cell))) continue;
    var sc = liveCellScreen(cell, S);
    if (sc.x < -30 || sc.y < -30 || sc.x > W + 30 || sc.y > H + 30) continue;
    if (depth <= 6 || list.length > 12) {
      ctx.fillStyle = COL.muted; ctx.fillText('A ' + list.length, sc.x + 13, sc.y);
      continue;
    }
    for (var j = 0; j < list.length; j++) {
      var r = list[j]; if (!facingCamera(r.v)) continue;
      var h = AIR_HISTORY[r.properties.icao24];
      if (view.zoom > 4.4) drawAirTrail(h, S);
      var p = livePointScreen(r, S);
      if (p.x < -15 || p.y < -15 || p.x > W + 15 || p.y > H + 15) continue;
      var heading = ((r.properties.trackDeg || 0) - 90) * D2R;
      var size = r.properties.onGround ? 3 : 4.5;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(heading);
      ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size, -size * 0.55); ctx.lineTo(-size * 0.55, 0); ctx.lineTo(-size, size * 0.55); ctx.closePath();
      ctx.fillStyle = COL.ink; ctx.globalAlpha = r.properties.onGround ? 0.55 : 0.86; ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
      if (view.zoom > 5.7 && r.properties.callsign) {
        ctx.fillStyle = COL.ink; ctx.fillText(String(r.properties.callsign).trim().slice(0, 10), p.x, p.y - 11);
      }
    }
  }
  ctx.restore();
}

var drawLiveWithMotionBase = drawLive;
drawLive = function (S) {
  drawLiveWithMotionBase(S);
  drawAircraft(S);
};

function renderAircraftPanel(cell) {
  var root = document.getElementById('panel');
  if (!root || !root.classList.contains('open') || !cell) return;
  live2RemovePanel('live-air-record');
  var src = LIVE.sources[AIR_SOURCE], rows = airRecords(cell), coverage = src && src.meta && src.meta.coverageCell;
  var exact = coverage === cellSlug(cell);
  var h = '<details id="live-air-record"' + (rows.length ? ' open' : '') + '><summary>MOVEMENT · ' + rows.length +
    ' AIRCRAFT · ADSB.LOL ' + liveSourceFreshness(src) + '</summary>';
  if (src && src.state === 'unconfigured') {
    h += '<p>Aircraft upstream is integrated but browser transport is not configured. Set <b>ICOSA_LIVE_CONFIG.adsbBaseUrl</b> to a CORS-enabled reverse proxy or mirror of the adsb.lol /v2 API. No empty-airspace claim is made.</p>';
  } else if (!src || src.state === 'idle') {
    h += '<p>' + (cellEdgeKm(cell) > AIR_MAX_CELL_KM ? 'Enter a regional or smaller triangle to query aircraft.' : 'Aircraft have not been queried for this triangle yet.') + '</p>';
  } else if (src.state === 'error' && !src.lastUpdate) {
    h += '<p>Aircraft source/transport unavailable. No claim is made that this airspace is empty.</p>';
  } else if (!exact) {
    h += '<p>The loaded aircraft snapshot belongs to another triangle. This airspace is not being described as empty.</p>';
  } else if (!rows.length) {
    h += '<p>No positioned aircraft in the current bounded snapshot fell inside this triangle.</p>';
  } else {
    for (var i = 0; i < Math.min(10, rows.length); i++) {
      var r = rows[i], p = r.properties || {}, m = r.motion || {};
      var label = p.callsign || p.registration || p.icao24 || 'aircraft';
      h += '<div class="row"><b>' + liveEsc(label) + '</b><span>' +
        (p.onGround ? 'ground' : Math.round((p.altitudeM || 0) / 30.48) * 100 + ' ft') +
        (p.groundSpeedMps == null ? '' : ' · ' + Math.round(p.groundSpeedMps * 1.94384) + ' kt') +
        (m.transitionCount ? ' · ' + m.transitionCount + ' cell crossing' + (m.transitionCount === 1 ? '' : 's') : '') + '</span></div>';
    }
    if (rows.length > 10) h += '<p>+' + (rows.length - 10) + ' more aircraft in this triangle.</p>';
  }
  var complete = src && src.meta && src.meta.completeForCell;
  h += '<p style="font-size:8px;letter-spacing:.08em">OBSERVED · adsb.lol contributors · ODbL 1.0 · ' +
    (complete ? 'bounded snapshot covers this cell' : 'bounded snapshot may not cover the whole cell') +
    ' · movement stored as Fxx address transitions.</p></details>';
  root.insertAdjacentHTML('beforeend', h);
}

var renderLiveWhereMotionBase = renderLiveWhere;
renderLiveWhere = function (cell) {
  renderLiveWhereMotionBase(cell);
  renderAircraftPanel(cell);
};

var openWhereMotionBase = openWhere;
openWhere = function (cell, keep) {
  openWhereMotionBase(cell, keep);
  requestAircraft(cell);
};

window.ICOSA_LIVE.aircraftHistory = function (icao24) {
  return AIR_HISTORY[String(icao24 || '').trim().toLowerCase()] || null;
};
window.ICOSA_LIVE.requestAircraft = function (slug) {
  var c = typeof slug === 'string' ? cellFromSlug(slug) : slug;
  if (!c) return false; requestAircraft(c); return true;
};
window.ICOSA_LIVE.setAircraftBaseUrl = function (url) {
  AIR_BASE_URL = liveText(url) || null;
  var s = LIVE.sources[AIR_SOURCE];
  if (s) {
    s.state = AIR_BASE_URL ? 'idle' : 'unconfigured';
    s.lastError = AIR_BASE_URL ? null : 'aircraft proxy/base URL not configured';
  }
  if (AIR_BASE_URL && AIR_TARGET && s) pollLiveSource(AIR_SOURCE);
  liveRefreshOpenPanel();
  return !!AIR_BASE_URL;
};
window.ICOSA_LIVE.sourceInfo.aircraft = {
  source: 'adsb.lol contributors',
  upstream: AIR_UPSTREAM_URL,
  license: 'ODbL 1.0',
  scoped: true,
  traceDepth: AIR_TRACE_DEPTH,
  maxCellKm: AIR_MAX_CELL_KM,
  browserTransport: 'requires configured CORS-enabled reverse proxy/mirror',
  configured: function () { return airConfigured(); }
};
