import { createHash } from 'node:crypto';

export const EPISTEMIC = new Set([
  'OBSERVED', 'REPORTED', 'DECLARED', 'MODELED',
  'DERIVED', 'INFERRED', 'PREDICTED', 'CONTESTED'
]);

export const ACTORS = new Set([
  'GROUND', 'HUMAN', 'DOG', 'CAR', 'BUILDING',
  'SERVICE', 'ECOLOGY', 'DISASTER', 'ECONOMY', 'MEMORY'
]);

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function signalId(seed) {
  return 'sig_' + createHash('sha256').update(stable(seed)).digest('hex').slice(0, 20);
}

export function statementId(seed) {
  return 'stmt_' + createHash('sha256').update(stable(seed)).digest('hex').slice(0, 20);
}

export function pointGeometry(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  return { type: 'Point', coordinates: [lon, lat] };
}

export function normalizeSignal(input) {
  const now = input.retrieved_at || new Date().toISOString();
  const epistemic = String(input.epistemic || 'REPORTED').toUpperCase();
  if (!EPISTEMIC.has(epistemic)) throw new Error(`unknown epistemic type: ${epistemic}`);

  const actors = [...new Set((input.actors || ['GROUND']).map(String))];
  for (const actor of actors) if (!ACTORS.has(actor)) throw new Error(`unknown actor: ${actor}`);

  const base = {
    source: String(input.source),
    source_record_id: input.source_record_id == null ? null : String(input.source_record_id),
    predicate: String(input.predicate),
    value: input.value ?? null,
    unit: input.unit ?? null,
    geometry: input.geometry ?? null,
    atlas_address: input.atlas_address ?? null,
    atlas_address_basis: input.atlas_address_basis ?? null,
    epistemic,
    observed_at: input.observed_at ?? null,
    valid_from: input.valid_from ?? null,
    valid_to: input.valid_to ?? null,
    retrieved_at: now,
    confidence: input.confidence == null ? null : Number(input.confidence),
    derived_from: [...new Set((input.derived_from || []).map(String))],
    relations: Array.isArray(input.relations) ? input.relations : [],
    actors,
    provenance: input.provenance || {},
    raw: input.raw ?? null
  };

  return {
    id: input.id || signalId({
      source: base.source,
      source_record_id: base.source_record_id,
      predicate: base.predicate,
      value: base.value,
      geometry: base.geometry,
      observed_at: base.observed_at
    }),
    ...base
  };
}

export function validateSignal(s) {
  const errors = [];
  for (const k of ['id', 'source', 'predicate', 'epistemic', 'retrieved_at']) {
    if (!s?.[k]) errors.push(`missing ${k}`);
  }
  if (s?.epistemic && !EPISTEMIC.has(s.epistemic)) errors.push(`bad epistemic ${s.epistemic}`);
  if (s?.geometry?.type === 'Point') {
    const [lon, lat] = s.geometry.coordinates || [];
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) errors.push('bad point geometry');
  }
  if (s?.atlas_address_basis?.representative_point) {
    const [lon, lat] = s.atlas_address_basis.representative_point;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) errors.push('bad atlas address basis point');
  }
  if (s?.confidence != null && (!Number.isFinite(s.confidence) || s.confidence < 0 || s.confidence > 1)) {
    errors.push('confidence must be 0..1');
  }
  return errors;
}
