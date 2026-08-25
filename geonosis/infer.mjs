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

function sourceCount(ss) {
  return new Set(ss.map(s => s.source)).size;
}

function hasRepresentativeGeometry(ss) {
  return ss.some(s => s.atlas_address_basis && s.atlas_address_basis.exact === false);
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

    const ecology = ss.filter(s => s.predicate === 'ecology.occurrence' || s.predicate === 'ecology.inaturalist_observation');
    if (ecology.length >= 5) {
      const families = sourceCount(ecology);
      out.push(make(
        'ecological_observation_density', address,
        `${ecology.length} biodiversity observation records from ${families} source channel${families === 1 ? '' : 's'} address to this ground. This is observation density, not species abundance or complete ecological inventory.`,
        ecology,
        { evidence_diversity: Math.min(1, families / 3), novelty: Math.min(1, ecology.length / 20), uncertainty: 0.55 }
      ));
    }

    const regulated = ss.filter(s => s.predicate === 'environment.regulated_facility');
    if (regulated.length) {
      const snc = regulated.filter(s => ['Y', 'S'].includes(String(s.value?.significant_noncompliance || '').toUpperCase())).length;
      out.push(make(
        'regulated_environment_presence', address,
        `${regulated.length} EPA-regulated facilit${regulated.length === 1 ? 'y' : 'ies'} address${regulated.length === 1 ? 'es' : ''} to this ground${snc ? `; ${snc} record${snc === 1 ? '' : 's'} carries a significant-noncompliance flag` : ''}. The statement reports ECHO records and does not independently establish present harm.`,
        regulated,
        { consequence: Math.min(1, 0.25 + regulated.length * 0.08 + snc * 0.15), evidence_diversity: 0.25, uncertainty: 0.35 }
      ));
    }

    const memory = ss.filter(s => s.predicate.startsWith('memory.'));
    if (memory.length >= 2) {
      out.push(make(
        'institutional_memory_density', address,
        `${memory.length} officially recorded historic or commemorative resources address to this ground. This measures institutionalized memory in the connected registers, not everything a community considers historically important.`,
        memory,
        { evidence_diversity: Math.min(1, sourceCount(memory) / 3), contestation: 0.15, uncertainty: 0.35 }
      ));
    }

    const changes = ss.filter(s => s.predicate === 'change.building_permit' || s.predicate === 'change.rezoning_case');
    if (changes.length >= 2) {
      out.push(make(
        'building_change_activity', address,
        `${changes.length} permit or rezoning records address to this ground. They record authorized or proposed change, not proof that construction or land-use change occurred.${hasRepresentativeGeometry(changes) ? ' At least one polygon is indexed by a representative address; its preserved geometry may span other cells.' : ''}`,
        changes,
        { change: Math.min(1, changes.length / 8), evidence_diversity: Math.min(1, sourceCount(changes) / 3), uncertainty: hasRepresentativeGeometry(changes) ? 0.55 : 0.35 }
      ));
    }

    const enforcement = ss.filter(s => s.predicate === 'service.code_enforcement_case');
    if (enforcement.length >= 2) {
      out.push(make(
        'service_enforcement_pressure', address,
        `${enforcement.length} code-enforcement case records address to this ground. This is administrative case density, not a diagnosis of building condition or resident behavior.`,
        enforcement,
        { contestation: Math.min(1, enforcement.length / 8), consequence: Math.min(1, enforcement.length / 10), uncertainty: 0.45 }
      ));
    }

    if (memory.length && changes.length) {
      const ev = [...memory, ...changes];
      out.push(make(
        'heritage_change_coaddress', address,
        `Official historic-resource records and permit/rezoning records co-address at this requested Atlas depth. This is a prompt for investigation, not evidence that any listed action affects any listed historic resource.${hasRepresentativeGeometry(ev) ? ' At least one source geometry is representatively indexed rather than point-exact.' : ''}`,
        ev,
        { change: 0.6, contestation: 0.45, evidence_diversity: Math.min(1, sourceCount(ev) / 4), uncertainty: hasRepresentativeGeometry(ev) ? 0.65 : 0.5, novelty: 0.55 }
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
