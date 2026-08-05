#!/usr/bin/env node
/* ============================================================================
   osm-notes.mjs — REGISTRY I acquisition, corpus one

     node seres/harness/osm-notes.mjs --city atlanta
     node seres/harness/osm-notes.mjs --city atlanta --closed 30 --out custom.json

   OpenStreetMap Notes are the only source in the register that is runnable with
   no key, no agreement and no records request: a public API of people reporting
   that the map and the ground disagree. That disagreement is testimony about
   place, which is exactly what REGISTRY I holds.

   WHAT THIS IS NOT
   ---------------
   Extraction here is a LEXICON pass — closed-vocabulary regex over note text,
   the same tier as halfworld's `extract.mjs --stub`. It is blind to any phrasing
   the lexicon lacks, and it says so: every claim carries `via: "lexicon"` and a
   deliberately low confidence. The LLM tier is the real translator, and it must
   obey the same rule the compiler obeys everywhere in this system — it may emit
   dimension, polarity and evidence span, and it may never emit a coordinate.

   PRIVACY
   -------
   Notes are public and carry usernames. This ingester stores the note id, its
   URL and the text, and deliberately does NOT store the author's username or
   uid. Source population is recorded at the population level.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const UA = "soft-cadastre/1.0 (perception-field research; contact via repository)";
const API = "https://api.openstreetmap.org/api/0.6/notes.json";

const CITY = arg("city", "atlanta");
const CLOSED = arg("closed", null);         // days a closed note stays in the corpus; 0 = open only, -1 = all
let PER_TILE = +arg("per-tile", 0);
const cityPath = path.join(ROOT, "cities", `${CITY}.json`);
if (!fs.existsSync(cityPath)) { console.error(`no cities/${CITY}.json — scaffold one from cities/atlanta.json`); process.exit(1); }
const city = JSON.parse(fs.readFileSync(cityPath, "utf8"));
const Q = city.query || {};
const CLOSED_D = CLOSED !== null ? CLOSED : String(Q.closed_days ?? 0);
PER_TILE = PER_TILE || Q.per_tile || 100;
const OUT = path.join(ROOT, "seres/atlas", arg("out", `osm-notes-${CITY}.json`));

/* ---------------------------------------------------------------- lexicon
   Closed vocabulary. dimension + polarity are fixed by the entry; the matched
   text becomes the evidence span. Anything that matches nothing is KEPT as an
   observation with zero claims — an unresolved note is a measurement of this
   lexicon, not of the city. (Law 4.) */
const LEX = [
  { d: "route_severance",        p: -1, i: .78, re: /\b(closed to (?:through )?traffic|no (?:through )?access|blocked|barrier|dead ?end|cannot (?:get|pass) through|road closed|permanently closed to)\b/i },
  { d: "route_severance",        p: -1, i: .62, re: /\b(no (?:sidewalk|crossing|pedestrian access)|there is no path|path (?:does not|doesn't) (?:exist|connect)|not connected)\b/i },
  { d: "commercial_vacancy",     p: -1, i: .70, re: /\b(permanently closed|out of business|now vacant|closed down|no longer (?:there|exists|open)|has closed|demolished|torn down|empty lot)\b/i },
  { d: "amenity_loss",           p: -1, i: .60, re: /\b(removed|gone|no longer here|does not exist anymore|replaced by|used to be)\b/i },
  { d: "maintenance_neglect",    p: -1, i: .66, re: /\b(overgrown|abandoned|derelict|broken|damaged|not maintained|in disrepair|potholes?|flooded)\b/i },
  { d: "waste_accumulation",     p: -1, i: .72, re: /\b(dumping|trash|garbage|litter|debris|junk pile)\b/i },
  { d: "cycling_comfort",        p: -1, i: .64, re: /\b(bike lane (?:ends|missing|blocked)|unsafe for (?:bikes|cycl)|no bike|cyclists? (?:cannot|can't))\b/i },
  { d: "cycling_comfort",        p:  1, i: .58, re: /\b(new bike lane|protected bike|cycle track|bike path (?:added|opened))\b/i },
  { d: "transit_walk_advantage", p:  1, i: .55, re: /\b(bus stop|marta|transit stop|station entrance|new crossing|pedestrian bridge)\b/i },
  { d: "recreational_value",     p:  1, i: .55, re: /\b(park|trail|playground|greenway|community garden)\b/i },
  { d: "map_ground_mismatch",    p:  0, i: .50, re: /\b(this is (?:not|mismarked|mislabeled)|marked as|tagged as|should be|wrong (?:name|location|place)|does not match|incorrectly|mapped as)\b/i },
];

/* Vagueness lowers spatial probability. A note that names a feature is better
   located than one that gestures. Neither is upgraded to certainty. */
const VAGUE = /\b(around here|somewhere|near here|approximately|roughly|not sure where|in this area|about here)\b/i;
const NAMES_FEATURE = /^(Node|Way|Relation):\s*(.+?)\s*\(\d+\)/;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function tiles([lo, la, LO, LA], { cols, rows }) {
  const out = [], dx = (LO - lo) / cols, dy = (LA - la) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++)
    out.push([lo + i * dx, la + j * dy, lo + (i + 1) * dx, la + (j + 1) * dy].map(n => +n.toFixed(5)));
  return out;
}

async function fetchTile(bbox) {
  const url = `${API}?bbox=${bbox.join(",")}&limit=${PER_TILE}&closed=${CLOSED_D}`;
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${bbox.join(",")}`);
  return (await r.json()).features || [];
}

/* ------------------------------------------------------------- extraction */
function extract(note) {
  const pr = note.properties, first = (pr.comments || [])[0] || {};
  const text = String(first.text || "").trim();
  if (!text) return null;

  const m = text.match(NAMES_FEATURE);
  const place_name = m ? m[2] : `OSM note ${pr.id}`;
  const place_kind = m ? `osm_${m[1].toLowerCase()}` : "map_report";
  const body = m ? text.slice(m[0].length).trim() : text;

  let sp = m ? .84 : .70;
  if (VAGUE.test(text)) sp = Math.min(sp, .52);

  const claims = [];
  for (const L of LEX) {
    const hit = body.match(L.re) || text.match(L.re);
    if (!hit) continue;
    if (claims.some(c => c.dimension === L.d)) continue;
    claims.push({
      id: `osm-note:${pr.id}:${L.d}`,
      observation_id: `osm-note:${pr.id}`,
      source_lane: "VERNACULAR",
      source_type: "osm_note",
      source_population: "osm_contributor",
      text: body || text,
      evidence: hit[0],
      dimension: L.d,
      polarity: L.p,
      intensity: L.i,
      /* Deliberately low. This is regex, not reading. */
      confidence: 0.55,
      condition: null,
      experiencer: "osm_contributor",
      spatial_probability: sp,
      relation: "note_pin_on_reported_feature",
      place_id: `osm-note:${pr.id}`,
      place_name,
      place_kind,
      geometry: { type: "Point", coordinates: note.geometry.coordinates },
      ideal_type: null,
      fixture: false,
      via: "lexicon",
      acquired: { source: "OpenStreetMap Notes", note_id: pr.id, url: pr.url, opened: pr.date_created, status: pr.status, license: "ODbL 1.0" },
    });
  }

  return {
    observation: {
      id: `osm-note:${pr.id}`,
      source_lane: "VERNACULAR",
      source_type: "osm_note",
      source_population: "osm_contributor",
      text: body || text,
      place_name,
      geometry: { type: "Point", coordinates: note.geometry.coordinates },
      acquired: { source: "OpenStreetMap Notes", note_id: pr.id, url: pr.url, opened: pr.date_created, status: pr.status, license: "ODbL 1.0" },
      resolved: claims.length > 0,
    },
    claims,
  };
}

/* ------------------------------------------------------------------- main */
const T = tiles(city.bbox, city.tiles || { cols: 3, rows: 3 });
console.log(`OSM NOTES · ${city.name} · ${T.length} tiles · closed=${CLOSED_D} · ${PER_TILE}/tile`);

const seen = new Set(), observations = [], claims = [];
let failed = 0, truncated = 0;
for (const [n, bbox] of T.entries()) {
  let feats;
  try { feats = await fetchTile(bbox); }
  catch (e) { failed++; console.log(`  tile ${n + 1}/${T.length}  FAIL  ${e.message}`); continue; }
  if (feats.length >= PER_TILE) truncated++;
  let kept = 0;
  for (const f of feats) {
    if (seen.has(f.properties.id)) continue;
    seen.add(f.properties.id);
    const r = extract(f);
    if (!r) continue;
    observations.push(r.observation); claims.push(...r.claims); kept++;
  }
  console.log(`  tile ${n + 1}/${T.length}  ${String(feats.length).padStart(4)} notes  +${kept} new${feats.length >= PER_TILE ? "  ⚠ AT LIMIT" : ""}`);
  await sleep(400);                                   // be a good citizen
}

const resolved = observations.filter(o => o.resolved).length;
const byDim = {};
for (const c of claims) byDim[c.dimension] = (byDim[c.dimension] || 0) + 1;

const out = {
  schema: "seres/part/v1",
  part: `osm-notes-${CITY}`,
  built_at: new Date().toISOString(),
  city: { slug: city.slug, name: city.name, bbox: city.bbox },
  acquisition: {
    source: "OpenStreetMap Notes",
    mode: "Public API",
    endpoint: API,
    license: "ODbL 1.0",
    attribution: "© OpenStreetMap contributors",
    query: { closed_days: +CLOSED_D, per_tile: PER_TILE, tiles: T.length },
    extraction: "lexicon",
    extraction_note: "Closed-vocabulary regex. Blind to any phrasing the lexicon lacks. Every claim carries via:'lexicon' and confidence 0.55.",
    privacy: "Note author usernames and uids are deliberately not stored.",
  },
  fixture: false,
  totals: {
    observations: observations.length,
    resolved_observations: resolved,
    unresolved_observations: observations.length - resolved,
    claims: claims.length,
    by_dimension: byDim,
    tiles_failed: failed,
    tiles_at_limit: truncated,
  },
  observations,
  claims,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

console.log(`\n${observations.length} observations · ${resolved} resolved · ${observations.length - resolved} kept unresolved · ${claims.length} claims`);
console.log(Object.entries(byDim).sort((a, b) => b[1] - a[1]).map(([d, n]) => `  ${String(n).padStart(4)}  ${d}`).join("\n") || "  (no claims — grow the lexicon)");
if (truncated) console.log(`\n⚠ ${truncated} tile(s) returned a full page — raise --per-tile or tiles.cols/rows in cities/${CITY}.json, or you are silently truncating the corpus.`);
if (failed) console.log(`⚠ ${failed} tile(s) failed. The gaps are data — re-run before compiling.`);
console.log(`\nwrote ${path.relative(ROOT, OUT)}   next: node seres/harness/build-atlas.mjs`);
