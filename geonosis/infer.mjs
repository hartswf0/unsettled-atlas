import { statementId } from './schema.mjs';

function groupByAddress(signals) {
  const m = new Map();
  for (const s of signals) {
    if (!s.atlas_address) continue;
    if (!m.has(s.atlas_address)) m.set(s.atlas_address, []);
    m.get(s.atlas_address).push(s);
  }
  return m;
}

function make(kind, address, text, evidence, importance = {}) {
  return {
    id: statementId({ kind, address, evidence: evidence.map(x => x.id).sort() }),
    kind,
    atlas_address: address,
    text,
    epistemic: 'INFERRED',
    evidence: evidence.map(x => x.id),
    derived_from: evidence.map(x => x.id),
    importance: {
      change: importance.change ?? null,
      exposure: importance.exposure ?? null,
      anomaly: importance.anomaly ?? null,
      contestation: importance.contestation ?? null,
      consequence: importance.consequence ?? null,
      evidence_diversity: importance.evidence_diversity ?? null,
      uncertainty: importance.uncertainty ?? null,
      novelty: importance.novelty ?? null
    }
  };
}

export function inferStatements(signals) {
  const out = [];
  for (const [address, ss] of groupByAddress(signals)) {
    const hazards = ss.filter(s => s.predicate.startsWith('hazard.'));
    if (hazards.length) {
      const families = [...new Set(hazards.map(s => s.source))];
      out.push(make(
        'hazard_presence', address,
        `${hazards.length} current or recent hazard/event signal${hazards.length === 1 ? '' : 's'} address to this ground from ${families.length} source${families.length === 1 ? '' : 's'}.`,
        hazards,
        { consequence: Math.min(1, 0.25 + hazards.length * 0.1), evidence_diversity: Math.min(1, families.length / 4), uncertainty: 0.25 }
      ));
    }

    const notes = ss.filter(s => s.source === 'osm-notes');
    if (notes.length >= 2) {
      out.push(make(
        'representation_contestation', address,
        `${notes.length} unresolved OpenStreetMap Notes address to this ground. This is evidence of unresolved mapping claims, not evidence that the underlying claims are true.`,
        notes,
        { contestation: Math.min(1, notes.length / 6), evidence_diversity: 0.25, uncertainty: 0.7 }
      ));
    }

    const wiki = ss.filter(s => s.source === 'wikipedia-geosearch');
    if (wiki.length >= 5) {
      out.push(make(
        'attention_density', address,
        `${wiki.length} Wikipedia-geocoded entities address to this ground at the requested depth. This measures encyclopedic representation, not population or intrinsic importance.`,
        wiki,
        { evidence_diversity: 0.2, novelty: 0.25, uncertainty: 0.55 }
      ));
    }

    const sources = [...new Set(ss.map(s => s.source))];
    if (sources.length >= 3) {
      out.push(make(
        'multi_source_activity', address,
        `${sources.length} independent source channels address signals to this ground: ${sources.join(', ')}.`,
        ss,
        { evidence_diversity: Math.min(1, sources.length / 5), uncertainty: 0.35 }
      ));
    }
  }
  return out;
}
