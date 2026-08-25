/* ICOSA LIVE CONTEXT · the world the model can actually see.
 * Injected after live sources + motion, inside ICOSA's canonical closure.
 *
 * One bridge only: every existing model operation already calls compileContext().
 * This wrapper adds a bounded, provenance-carrying live block there and refreshes
 * it immediately before askOpenAI serializes the context. The LLM never receives
 * a layer dump; it receives what the selected triangle knows now, plus exactly
 * what each source can and cannot support.
 */

var LIVE_CONTEXT_VERSION = 'icosa-live-context-v1';
var LIVE_CONTEXT_WAIT_MS = 1800;
var LIVE_CONTEXT_MAX_EXAMPLES = 8;

function liveCtxIso(ms) {
  return Number.isFinite(Number(ms)) && Number(ms) > 0 ? new Date(Number(ms)).toISOString() : null;
}
function liveCtxRound(v, places) {
  var n = Number(v); if (!Number.isFinite(n)) return null;
  var p = Math.pow(10, places == null ? 1 : places);
  return Math.round(n * p) / p;
}
function liveCtxCoverage(sourceId, cell) {
  var s = LIVE.sources[sourceId], slug = cellSlug(cell);
  var meta = s && s.meta || {}, coverage = meta.coverageCell || null;
  var scoped = !!meta.scoped || sourceId === FIRMS_SOURCE || sourceId === AIR_SOURCE;
  var matches = !scoped || coverage === slug;
  var complete = !scoped || (sourceId === AIR_SOURCE ? !!meta.completeForCell : matches);
  var zero = 'unknown';
  if (sourceId === DATACENTER_SOURCE && s && s.lastUpdate) zero = 'no_record_in_loaded_osm_snapshot';
  else if (sourceId === 'usgs-earthquakes' && s && s.lastUpdate) zero = 'no_event_in_loaded_24h_usgs_snapshot';
  else if (sourceId === FIRMS_SOURCE && matches && s && s.lastUpdate && s.state !== 'error') zero = 'no_detection_in_loaded_one_day_firms_query';
  else if (sourceId === AIR_SOURCE && matches && complete && s && s.lastUpdate && s.state !== 'error') zero = 'no_positioned_aircraft_in_loaded_bounded_snapshot';
  return {
    scoped: scoped,
    coverage_cell: coverage,
    matches_focus: matches,
    complete_for_focus: complete,
    zero_semantics: zero
  };
}
function liveCtxSource(sourceId, cell) {
  var s = LIVE.sources[sourceId], cov = liveCtxCoverage(sourceId, cell);
  if (!s) return {
    id: sourceId, provider: null, state: 'missing', freshness: 'UNAVAILABLE', loaded_records: 0,
    last_update: null, coverage: cov, error: 'source adapter not registered'
  };
  return {
    id: sourceId,
    provider: s.provider || s.name || sourceId,
    state: s.state || 'idle',
    freshness: liveSourceFreshness(s),
    loaded_records: s.count || 0,
    last_update: liveCtxIso(s.lastUpdate),
    coverage: cov,
    error: s.lastError || null
  };
}
function liveCtxScopedRows(cell, sourceId, kind) {
  var s = LIVE.sources[sourceId], cov = liveCtxCoverage(sourceId, cell);
  if (!s || !cov.matches_focus) return [];
  return liveForCell(cell, kind);
}
function liveCtxEarthquakes(cell) {
  var rows = liveForCell(cell, 'earthquake').slice().sort(function (a, b) {
    return ((b.properties && b.properties.magnitude) || 0) - ((a.properties && a.properties.magnitude) || 0) ||
      (b.observedAt || 0) - (a.observedAt || 0);
  });
  var max = null;
  for (var i = 0; i < rows.length; i++) {
    var m = rows[i].properties && Number(rows[i].properties.magnitude);
    if (Number.isFinite(m)) max = max == null ? m : Math.max(max, m);
  }
  return {
    count: rows.length,
    largest_magnitude: max,
    examples: rows.slice(0, LIVE_CONTEXT_MAX_EXAMPLES).map(function (r) {
      var p = r.properties || {};
      return { id: r.id, magnitude: liveCtxRound(p.magnitude, 1), depth_km: liveCtxRound(p.depthKm, 1),
        place: p.place || null, observed_at: liveCtxIso(r.observedAt), epistemic: r.epistemic || 'OBSERVED' };
    })
  };
}
function liveCtxDatacenters(cell) {
  var rows = liveForCell(cell, 'datacenter').slice().sort(function (a, b) {
    return String((a.properties && a.properties.name) || '').localeCompare(String((b.properties && b.properties.name) || ''));
  });
  return {
    count: rows.length,
    examples: rows.slice(0, LIVE_CONTEXT_MAX_EXAMPLES).map(function (r) {
      var p = r.properties || {};
      return { id: r.id, name: p.name || null, operator: p.operator || null, capacity: p.capacity || null,
        epistemic: r.epistemic || 'RECORD' };
    })
  };
}
function liveCtxFires(cell) {
  var cov = liveCtxCoverage(FIRMS_SOURCE, cell);
  if (!cov.matches_focus) return { count: null, examples: [], note: 'loaded FIRMS data belongs to another triangle' };
  var rows = liveCtxScopedRows(cell, FIRMS_SOURCE, 'fire').slice().sort(function (a, b) {
    return (b.observedAt || 0) - (a.observedAt || 0);
  });
  return {
    count: rows.length,
    examples: rows.slice(0, LIVE_CONTEXT_MAX_EXAMPLES).map(function (r) {
      var p = r.properties || {};
      return { id: r.id, sensor: p.sensor || null, satellite: p.satellite || null,
        frp: liveCtxRound(p.frp, 1), confidence: liveCtxRound(p.confidence, 2),
        observed_at: liveCtxIso(r.observedAt), epistemic: r.epistemic || 'OBSERVED' };
    })
  };
}
function liveCtxAircraft(cell) {
  var cov = liveCtxCoverage(AIR_SOURCE, cell);
  if (!cov.matches_focus) return { count: null, examples: [], note: 'loaded aircraft data belongs to another triangle' };
  var rows = liveCtxScopedRows(cell, AIR_SOURCE, 'aircraft').slice().sort(function (a, b) {
    return ((b.properties && b.properties.altitudeM) || 0) - ((a.properties && a.properties.altitudeM) || 0);
  });
  return {
    count: rows.length,
    examples: rows.slice(0, 12).map(function (r) {
      var p = r.properties || {}, m = r.motion || {};
      return { id: r.id, callsign: p.callsign || null, registration: p.registration || null,
        type: p.type || null, on_ground: !!p.onGround, altitude_m: liveCtxRound(p.altitudeM, 0),
        speed_mps: liveCtxRound(p.groundSpeedMps, 1), track_deg: liveCtxRound(p.trackDeg, 0),
        address: m.cell || null, previous_address: m.previousCell || null,
        transition_count: m.transitionCount || 0, observed_at: liveCtxIso(r.observedAt),
        epistemic: r.epistemic || 'OBSERVED' };
    })
  };
}
function liveCtxSlugInside(cell, slug) {
  var c = slug && cellFromSlug(slug);
  return !!(c && cellContains(cell, cellCentre(c)));
}
function liveCtxCrossings(cell) {
  var out = [], now = Date.now();
  if (cell.depth > AIR_TRACE_DEPTH) return {
    trace_depth: AIR_TRACE_DEPTH, resolution_supported: false,
    note: 'aircraft transition addresses are coarser than this focus cell', recent: []
  };
  Object.keys(AIR_HISTORY).forEach(function (id) {
    var h = AIR_HISTORY[id]; if (!h || now - h.lastSeen > AIR_HISTORY_TTL) return;
    (h.transitions || []).forEach(function (t) {
      var fromIn = liveCtxSlugInside(cell, t.from), toIn = liveCtxSlugInside(cell, t.to);
      if (!fromIn && !toIn) return;
      out.push({ aircraft: id, kind: !fromIn && toIn ? 'entry' : (fromIn && !toIn ? 'exit' : 'internal_cell_crossing'),
        from: t.from, to: t.to, at: t.at || 0 });
    });
  });
  out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
  return { trace_depth: AIR_TRACE_DEPTH, resolution_supported: true,
    recent: out.slice(0, 12).map(function (t) {
      return { aircraft: t.aircraft, kind: t.kind, from: t.from, to: t.to, at: liveCtxIso(t.at) };
    }) };
}
function liveCtxBuild(cell) {
  var slug = cellSlug(cell);
  var sources = {};
  sources.usgs = liveCtxSource('usgs-earthquakes', cell);
  sources.datacenters = liveCtxSource(DATACENTER_SOURCE, cell);
  sources.firms = liveCtxSource(FIRMS_SOURCE, cell);
  sources.aircraft = liveCtxSource(AIR_SOURCE, cell);
  return {
    version: LIVE_CONTEXT_VERSION,
    focus_address: slug,
    semantics: {
      observed: 'a source reported an observation; it is not a complete account of reality',
      record: 'a source snapshot contains a record; absence means no record in that snapshot, not nonexistence',
      zero: 'only use a source zero according to that source coverage.zero_semantics',
      unavailable: 'UNAVAILABLE, UNCONFIGURED, NOT QUERIED, OTHER CELL, LOADING and STALE are not evidence of absence'
    },
    sources: sources,
    here: {
      earthquakes: liveCtxEarthquakes(cell),
      datacenters: liveCtxDatacenters(cell),
      fires: liveCtxFires(cell),
      aircraft: liveCtxAircraft(cell)
    },
    movement: { aircraft_crossings: liveCtxCrossings(cell) }
  };
}
function liveCtxWarm(cell) {
  if (!cell) return;
  if (typeof live2RegisterFirms === 'function') live2RegisterFirms();
  if (typeof registerAirSource === 'function') registerAirSource();
  if (cellEdgeKm(cell) <= FIRMS_MAX_KM && typeof live2RequestFirms === 'function') live2RequestFirms(cell);
  if (cellEdgeKm(cell) <= AIR_MAX_CELL_KM && typeof requestAircraft === 'function') requestAircraft(cell);
}
function liveCtxPending(cell) {
  var slug = cellSlug(cell), pending = [];
  ['usgs-earthquakes', DATACENTER_SOURCE, FIRMS_SOURCE, AIR_SOURCE].forEach(function (id) {
    var s = LIVE.sources[id]; if (!s || s.state !== 'loading') return;
    var cov = liveCtxCoverage(id, cell);
    if (s.lastUpdate && (!cov.scoped || cov.coverage_cell === slug)) return;
    if (!cov.scoped || (id === FIRMS_SOURCE && FIRMS_TARGET && FIRMS_TARGET.slug === slug) ||
        (id === AIR_SOURCE && AIR_TARGET && AIR_TARGET.slug === slug)) pending.push(id);
  });
  return pending;
}
function liveCtxInstall(ctx, cell) {
  if (!ctx || !cell) return ctx;
  var operation = ctx.operation;
  if (Object.prototype.hasOwnProperty.call(ctx, 'operation')) delete ctx.operation;
  ctx.version = 'icosa-context-v3-live';
  ctx.live = liveCtxBuild(cell);
  if (operation !== undefined) ctx.operation = operation;
  return ctx;
}

var compileContextWithoutLive = compileContext;
compileContext = function (cell, seat, world, op) {
  liveCtxWarm(cell);
  return liveCtxInstall(compileContextWithoutLive(cell, seat, world, op), cell);
};

var askOpenAIWithoutLiveContext = askOpenAI;
askOpenAI = function (opts, cb) {
  var address = opts && opts.context && opts.context.focus && opts.context.focus.address;
  var cell = address ? cellFromSlug(address) : null;
  if (!cell) return askOpenAIWithoutLiveContext(opts, cb);
  liveCtxWarm(cell);
  var began = Date.now();
  (function sendWhenWarm() {
    var pending = liveCtxPending(cell);
    if (pending.length && Date.now() - began < LIVE_CONTEXT_WAIT_MS) {
      return setTimeout(sendWhenWarm, 90);
    }
    liveCtxInstall(opts.context, cell);
    askOpenAIWithoutLiveContext(opts, cb);
  })();
};

var LIVE_CONTEXT_LAW = ' When context.live is present, treat it as source-stamped evidence, not omniscience. ' +
  'OBSERVED is an observation and RECORD is a snapshot record. Never turn UNAVAILABLE, UNCONFIGURED, NOT QUERIED, ' +
  'OTHER CELL, LOADING or STALE into evidence of absence. A zero supports only the narrow claim named in ' +
  'context.live.sources.*.coverage.zero_semantics. Movement claims must use the address transitions actually supplied.';
if (typeof LAW === 'string' && LAW.indexOf('context.live is present') < 0) LAW += LIVE_CONTEXT_LAW;

function renderLiveModelContext(cell) {
  var root = document.getElementById('panel');
  if (!root || !root.classList.contains('open') || !cell) return;
  if (typeof live2RemovePanel === 'function') live2RemovePanel('live-model-context');
  var x = liveCtxBuild(cell), s = x.sources, h = '<details id="live-model-context"><summary>MODEL CONTEXT · LIVE WORLD</summary>';
  h += '<p>Every model operation on this triangle receives this source-stamped live block before it is sent.</p>';
  [['USGS', s.usgs], ['DATACENTERS', s.datacenters], ['FIRMS', s.firms], ['AIRCRAFT', s.aircraft]].forEach(function (pair) {
    var q = pair[1], cov = q.coverage || {}, note = q.freshness;
    if (cov.scoped && !cov.matches_focus) note = 'OTHER CELL';
    h += '<div class="row"><b>' + pair[0] + '</b><span>' + liveEsc(note) + ' · ' + q.loaded_records + ' loaded</span></div>';
  });
  h += '<div class="row"><b>HERE</b><span>' + x.here.earthquakes.count + ' quakes · ' +
    x.here.datacenters.count + ' data centers · ' + (x.here.fires.count == null ? '?' : x.here.fires.count) +
    ' fires · ' + (x.here.aircraft.count == null ? '?' : x.here.aircraft.count) + ' aircraft</span></div>';
  h += '<p style="font-size:8px;letter-spacing:.08em">COMPILED · bounded examples + provenance + coverage + zero semantics + Fxx movement transitions.</p></details>';
  root.insertAdjacentHTML('beforeend', h);
}
var renderLiveWhereModelContextBase = renderLiveWhere;
renderLiveWhere = function (cell) {
  renderLiveWhereModelContextBase(cell);
  renderLiveModelContext(cell);
};

window.ICOSA_LIVE.modelContext = function (slug) {
  var c = typeof slug === 'string' ? cellFromSlug(slug) : slug;
  return c ? liveCtxBuild(c) : null;
};
window.ICOSA_LIVE.contextForModel = function (slug, op) {
  var c = typeof slug === 'string' ? cellFromSlug(slug) : slug;
  return c ? compileContext(c, null, null, op || 'INSPECT') : null;
};
window.ICOSA_LIVE.contextVersion = LIVE_CONTEXT_VERSION;
