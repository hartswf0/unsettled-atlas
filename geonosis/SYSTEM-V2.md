# GEONOSIS SYSTEM REMAKE

The map is a client. The evidence system owns geographic state.

## Runtime boundary

```text
PUBLIC SOURCES
  -> HARVESTERS
  -> CONSERVATIVE SUBJECT IDENTITY
  -> APPEND-ONLY OBSERVATION LEDGER
  -> TEMPORAL STATE RECONSTRUCTION
  -> EXPLICIT INTERPRETATION RULES
  -> ACTOR POSSIBILITY FIELDS
  -> EXPLICIT CORRESPONDENCE RULES
  -> GEONOTIC EVENT HISTORY
  -> ICOSA / MAP BUNDLES
  -> MAP / ACTORS / COUNCIL
```

The browser may render this output. It may not create a geographic fact, actor consequence, mismatch, event, or timeline.

## Hard laws

1. **No coordinate identity merge.** Co-location does not make two source records the same subject.
2. **No unregistered correspondence.** A regime break exists only when a named rule licenses the comparison.
3. **No UI inference.** The map contains no Atlanta coordinate, flood fixture, actor threshold, or event timeline.
4. **No overwrite history.** Observations deduplicate by stable id; a changed state arrives as another observation.
5. **No drama requirement.** Zero licensed events is valid and must be shown as zero.
6. **No absence collapse.** Source failure, no records, no geometry, and no applicable rule remain distinguishable.
7. **Icosa is an address.** It never proves subject identity or containment for non-point geometry.
8. **Actor meaning is compiled.** Actor possibilities come from the rule registry and cited observations.
9. **Static files are publication, not ontology.** `geonosis/system-data` is a public projection of the system storage contract.
10. **PostGIS is the persistence target.** `db/postgis.sql` defines the durable relational boundary; the file ledger is the current build-time implementation.

## Current system objects

- `SUBJECT` — conservative identity spine.
- `GEOGRAPHIC_FORM` — OBJECT / FIELD / TRAJECTORY / RELATION.
- `OBSERVATION` — append-only evidence plus observation apparatus and time.
- `CURRENT_STATE` — latest valid observation for subject x regime x predicate.
- `POSSIBILITY` — actor-relative consequence licensed by an interpretation rule.
- `CORRESPONDENCE` — current cross-regime comparison licensed by a correspondence rule.
- `GEONOTIC_EVENT` — persisted interval during which an expected correspondence failed.

## Public build

The scheduled compiler harvests Atlanta and New Orleans using the same code path, then publishes:

```text
geonosis/system-data/
  index.json
  atlanta/
    manifest.json
    forms.json
    ledger.jsonl
    subjects.json
    current.json
    correspondences.json
    events.json
    possibilities.json
    map.json
    cells/*.json
  new-orleans/
    ...same contract...
```

`geonosis-map/index.html` reads only this contract. A third region can be added by running the same harvester/compiler with another center; no map JavaScript changes are allowed.

## Believability test

A valid Geonosis client must be able to receive a compiled region it has never seen and answer, without application-specific code:

- what observations are here?
- what subjects are known?
- which regimes currently speak about them?
- what actor interpretations are licensed?
- what registered correspondences currently fail?
- when did a failure begin and resolve?
- which evidence earned the event?
- what could not be known because identity, observation, or a rule was missing?

If answering requires editing the map, the system has failed.
