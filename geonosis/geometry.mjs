// GEONOSIS · geometry helpers
//
// A source geometry is evidence. It is never replaced merely to make
// indexing convenient. This module may derive a representative point for an
// Atlas address, but it always names the method and whether that address is
// exact for the source geometry.

function finitePoint(p) {
  return Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1]);
}

function mean(points) {
  const ps = points.filter(finitePoint);
  if (!ps.length) return null;
  let x = 0, y = 0;
  for (const p of ps) { x += +p[0]; y += +p[1]; }
  return [x / ps.length, y / ps.length];
}

function flattenPoints(coords, out = []) {
  if (!Array.isArray(coords)) return out;
  if (coords.length >= 2 && Number.isFinite(+coords[0]) && Number.isFinite(+coords[1])) {
    out.push([+coords[0], +coords[1]]);
    return out;
  }
  for (const c of coords) flattenPoints(c, out);
  return out;
}

// Planar centroid for one closed ring in lon/lat. This is intentionally an
// indexing representative, not a geodesic claim about area. It is excellent
// for local municipal polygons and falls back cleanly when degenerate.
function ringCentroid(ring) {
  const pts = (ring || []).filter(finitePoint);
  if (pts.length < 3) return mean(pts);
  let twiceA = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const cross = (+a[0]) * (+b[1]) - (+b[0]) * (+a[1]);
    twiceA += cross;
    cx += ((+a[0]) + (+b[0])) * cross;
    cy += ((+a[1]) + (+b[1])) * cross;
  }
  if (Math.abs(twiceA) < 1e-12) return mean(pts);
  return [cx / (3 * twiceA), cy / (3 * twiceA)];
}

function polygonRepresentative(coords) {
  const outer = coords?.[0] || [];
  return ringCentroid(outer) || mean(flattenPoints(coords));
}

function multiPolygonRepresentative(coords) {
  // Choose the exterior ring with the greatest absolute planar area. This
  // avoids averaging islands into a point in the sea while keeping the
  // method deterministic.
  let best = null, bestArea = -1;
  for (const poly of coords || []) {
    const ring = poly?.[0] || [];
    const pts = ring.filter(finitePoint);
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      a += (+p[0]) * (+q[1]) - (+q[0]) * (+p[1]);
    }
    a = Math.abs(a / 2);
    const c = ringCentroid(ring);
    if (c && a > bestArea) { bestArea = a; best = c; }
  }
  return best || mean(flattenPoints(coords));
}

export function representativePoint(geometry) {
  if (!geometry || typeof geometry !== 'object') return null;
  const type = geometry.type;
  const c = geometry.coordinates;

  if (type === 'Point' && finitePoint(c)) {
    return { point: [+c[0], +c[1]], method: 'source_point', exact: true };
  }
  if (type === 'MultiPoint') {
    const p = mean(c || []);
    return p && { point: p, method: 'multipoint_mean', exact: false };
  }
  if (type === 'LineString' || type === 'MultiLineString') {
    const p = mean(flattenPoints(c));
    return p && { point: p, method: 'line_vertex_mean', exact: false };
  }
  if (type === 'Polygon') {
    const p = polygonRepresentative(c);
    return p && { point: p, method: 'polygon_centroid_representative', exact: false };
  }
  if (type === 'MultiPolygon') {
    const p = multiPolygonRepresentative(c);
    return p && { point: p, method: 'largest_polygon_centroid_representative', exact: false };
  }
  return null;
}

export function addressBasis(geometry) {
  const r = representativePoint(geometry);
  if (!r) return null;
  return {
    method: r.method,
    representative_point: r.point,
    exact: r.exact,
    note: r.exact
      ? 'Atlas address derives from the source point.'
      : 'Representative address only. The preserved source geometry may span additional Atlas cells.'
  };
}
