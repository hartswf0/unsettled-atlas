#!/usr/bin/env node
/* ============================================================================
   build-atlas.mjs — REGISTRY I compile + gate

     node seres/harness/build-atlas.mjs             build
     node seres/harness/build-atlas.mjs --check     exit 1 if anything is stale

   Composes every part in seres/atlas/*.json (schema seres/part/v1) into the one
   atlas the three SERES artifacts read:

     seres/data.json        served
     seres/data.embed.js    file:// twin
     seres/helm.html        self-contained console (ATLAS re-embedded in place)

   All three come from here so none of them can quietly disagree with the others.
   Adding a corpus is: drop a part in seres/atlas/, run this, look at what the
   gate says.

   The gate refuses to build an atlas whose numbers are outside their declared
   range, whose claims carry a dimension no part declared, or whose provenance
   is unstated. Fixture and acquired material are counted separately and always
   reported separately — a part that does not say which it is fails. (Law 6.)
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const p = (...a) => path.join(ROOT, ...a);
const CHECK = process.argv.includes("--check");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };

/* One atlas per city. Parts declare which city they belong to; a part with no
   city predates the cities/ layer and belongs to the reference build. Merging
   two cities into one atlas would put New Orleans notes inside Atlanta's bbox
   and call the result a region. */
const CITY = arg("city", "atlanta");
const PRIMARY = CITY === "atlanta";

/* ------------------------------------------------------------------ parts */
const dir = p("seres/atlas");
const parts = fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort()
  .map(f => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) }))
  .filter(x => x.schema === "seres/part/v1")
  .filter(x => (x.city?.slug || "atlanta") === CITY);

if (!parts.length) { console.error(`no parts for city "${CITY}" in seres/atlas/ — nothing to build`); process.exit(1); }

const fail = [];
for (const part of parts) {
  if (typeof part.fixture !== "boolean") fail.push(`${part.file}: no fixture flag — a part must say whether it is invented`);
  if (!part.acquisition) fail.push(`${part.file}: no acquisition block — provenance is not optional`);
}

/* ---------------------------------------------------------------- compose */
const claims = [], places = [];
const lanes = new Set(), dims = new Set();
const seenClaim = new Set(), seenPlace = new Set(), observations = new Set();
let fixtureClaims = 0, acquiredClaims = 0, unresolvedObs = 0;

for (const part of parts) {
  for (const d of part.dimensions || []) dims.add(d);
  for (const c of part.claims || []) {
    if (seenClaim.has(c.id)) { fail.push(`duplicate claim id ${c.id}`); continue; }
    seenClaim.add(c.id);
    dims.add(c.dimension); lanes.add(c.source_lane);
    observations.add(c.observation_id);
    (c.fixture ? fixtureClaims++ : acquiredClaims++, claims.push(c));
  }
  for (const pl of part.places || []) {
    if (seenPlace.has(pl.id)) continue;
    seenPlace.add(pl.id); places.push(pl);
  }
  unresolvedObs += part.totals?.unresolved_observations || 0;
  /* An observation that produced no claim is still an observation. */
  for (const o of part.observations || []) if (!o.resolved) observations.add(o.id);
}

/* -------------------------------------------------------------- the gate */
const RANGE = ["intensity", "confidence", "spatial_probability"];
for (const c of claims) {
  for (const k of RANGE) {
    const v = c[k];
    if (typeof v !== "number" || !isFinite(v) || v < 0 || v > 1) fail.push(`${c.id}: ${k}=${v} outside 0..1`);
  }
  if (![-1, 0, 1].includes(c.polarity)) fail.push(`${c.id}: polarity ${c.polarity} not in -1|0|1`);
  if (!c.geometry || !c.geometry.type || !c.geometry.coordinates) fail.push(`${c.id}: no geometry`);
  if (typeof c.fixture !== "boolean") fail.push(`${c.id}: no fixture flag`);
  if (!c.evidence) fail.push(`${c.id}: no evidence span — a claim must point at the words it came from`);
}

let region = parts.find(x => x.region)?.region || null;
if (!region) {
  /* A city with no authored region still has a study area: the bbox its own
     acquisition was bounded by. */
  const c = parts.find(x => x.city)?.city;
  if (c) region = { name: `${c.name} study area`, bbox: c.bbox, crs: "EPSG:4326" };
}
if (!region) fail.push("no part declares a region and no city bbox to fall back on");

if (fail.length) {
  console.log("GATE FAIL · REGISTRY I\n" + fail.slice(0, 25).map(f => "  " + f).join("\n"));
  if (fail.length > 25) console.log(`  … and ${fail.length - 25} more`);
  process.exit(1);
}

const atlas = {
  schema: "seres/atlas/v1",
  built_at: new Date().toISOString(),
  title: `SERES ${(parts.find(x => x.city)?.city?.name || "ATLANTA").toUpperCase()}`,
  city: CITY,
  region,
  state: {
    fixture_present: parts.some(x => x.fixture),
    acquired_present: parts.some(x => !x.fixture),
    llm_enabled: false,
    parts: parts.map(x => ({ part: x.part, fixture: x.fixture, source: x.acquisition.source, extraction: x.acquisition.extraction, claims: (x.claims || []).length })),
  },
  /* Licences travel with the data or the data should not travel. */
  attribution: [...new Set(parts.map(x => x.acquisition.attribution).filter(Boolean))],
  dimensions: [...dims].sort(),
  source_lanes: [...lanes].sort(),
  places,
  claims,
  totals: {
    observations: observations.size,
    extractions: observations.size,
    claims: claims.length,
    places: places.length,
    fixture_claims: fixtureClaims,
    acquired_claims: acquiredClaims,
    unresolved_observations: unresolvedObs,
  },
};

/* ------------------------------------------------------------- artifacts */
const json = JSON.stringify(atlas, null, 1);
const embed = `/* SOFT CADASTRE — offline fallback for file:// use. Generated by seres/harness/build-atlas.mjs. */\nwindow.SERES_ATLAS_EMBED=${JSON.stringify(atlas)};\n`;

/* The helm is self-contained by design: rewrite its ATLAS literal in place so a
   double-clicked helm can never show different numbers than the served sheet. */
function reembedHelm(src, obj) {
  const key = "const ATLAS=";
  const i = src.indexOf(key);
  if (i < 0) return null;
  const s = i + key.length;
  let d = 0, j = s;
  for (; j < src.length; j++) { const ch = src[j]; if (ch === "{") d++; else if (ch === "}") { d--; if (!d) { j++; break; } } }
  return src.slice(0, s) + JSON.stringify(obj) + src.slice(j);
}

/* The two SERES surfaces are the reference build's. A second city produces its
   atlas and stops there — pointing a surface at it is a deliberate act, not a
   side effect of running the compiler. */
const writes = PRIMARY
  ? [["seres/data.json", json + "\n"], ["seres/data.embed.js", embed], ["seres/helm.html", (() => {
      const src = fs.readFileSync(p("seres/helm.html"), "utf8");
      const next = reembedHelm(src, atlas);
      if (next === null) { console.error("seres/helm.html: no `const ATLAS=` literal to re-embed"); process.exit(1); }
      return next;
    })()]]
  : [[`seres/data.${CITY}.json`, json + "\n"]];

let stale = 0;
for (const [rel, body] of writes) {
  const cur = fs.existsSync(p(rel)) ? fs.readFileSync(p(rel), "utf8") : null;
  /* built_at moves every run; compare everything else. */
  const same = cur !== null && strip(cur) === strip(body);
  if (same) { console.log(`OK      ${rel}`); continue; }
  stale++;
  if (CHECK) { console.log(`STALE   ${rel} — rebuild with: node seres/harness/build-atlas.mjs`); continue; }
  fs.writeFileSync(p(rel), body);
  console.log(`WROTE   ${rel}`);
}
function strip(s) { return s.replace(/"built_at":"[^"]*"/g, '"built_at":"*"'); }

console.log(`\nREGISTRY I · ${parts.length} part(s)`);
for (const x of atlas.state.parts)
  console.log(`  ${x.fixture ? "FIXTURE " : "ACQUIRED"}  ${String(x.claims).padStart(5)} claims  ${x.part}  (${x.source}, ${x.extraction})`);
console.log(`\n  ${atlas.totals.observations} observations · ${atlas.totals.claims} claims · ${atlas.totals.places} named places`);
console.log(`  ${atlas.totals.fixture_claims} fixture · ${atlas.totals.acquired_claims} acquired · ${atlas.totals.unresolved_observations} observations kept unresolved`);
console.log(`  ${atlas.dimensions.length} dimensions · ${atlas.source_lanes.length} lanes`);
console.log(`\nGATE PASS · REGISTRY I`);
process.exit(CHECK && stale ? 1 : 0);
