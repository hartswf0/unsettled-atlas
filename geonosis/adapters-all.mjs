import { ADAPTERS as CORE, DEFAULT_SOURCES as CORE_DEFAULTS } from './adapters.mjs';
import { WAVE1_ADAPTERS, WAVE1_GLOBAL_DEFAULTS } from './adapters-wave1.mjs';
import { normalizeSignal } from './schema.mjs';

async function echoWithStrictTimeSemantics(ctx) {
  const signals = await WAVE1_ADAPTERS['epa-echo'](ctx);
  return signals.map(s => {
    const lastInspection = s.observed_at;
    return normalizeSignal({
      ...s,
      id: undefined,
      observed_at: null,
      value: { ...s.value, last_inspection: lastInspection }
    });
  });
}

export const ADAPTERS = {
  ...CORE,
  ...WAVE1_ADAPTERS,
  'epa-echo': echoWithStrictTimeSemantics
};

function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371.0088, d2r = Math.PI / 180;
  const p1 = aLat * d2r, p2 = bLat * d2r;
  const dp = (bLat - aLat) * d2r, dl = (bLon - aLon) * d2r;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function defaultSourcesFor(ctx) {
  const out = [...CORE_DEFAULTS, ...WAVE1_GLOBAL_DEFAULTS];

  // Local adapters are only asked when the requested ground is plausibly in
  // their jurisdiction. They remain ordinary named adapters and can always
  // be selected explicitly with --sources.
  if (haversineKm(ctx.lat, ctx.lon, 33.7490, -84.3880) <= 120 + ctx.radiusKm) {
    out.push('atlanta-historic-buildings', 'atlanta-rezoning-cases');
  }
  if (haversineKm(ctx.lat, ctx.lon, 29.9511, -90.0715) <= 120 + ctx.radiusKm) {
    out.push('nola-building-permits', 'nola-code-enforcement');
  }
  return [...new Set(out)];
}
