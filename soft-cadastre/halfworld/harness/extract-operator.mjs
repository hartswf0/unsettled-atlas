#!/usr/bin/env node
/* ============================================================================
   extract-operator.mjs — STAGE 3, LLM TIER, WITH THE MODEL ALREADY IN THE ROOM

     node harness/extract-operator.mjs --emit
     node harness/extract-operator.mjs --ingest atlas/extract-response.json
     node harness/extract-operator.mjs --diff        stub vs operator, per unit

   extract.mjs offers two tiers: `--stub` regex, or an API call needing a key
   and a bill. That framing missed the obvious third case — an assistant is
   already reading this repository. This script is the hand-off:

     --emit    writes one fully-rendered prompt per unit, closed vocabularies
               substituted, to atlas/extract-request.json
     (the operator model answers, in the conversation, for the session's cost
      and no separate spend)
     --ingest  validates the answer HARD and merges it into atlas/extracted.json

   THE VALIDATOR IS THE POINT
   --------------------------
   A model in the loop is not trusted more than a model behind an API. Ingest
   refuses anything that breaks the contract, and names which unit broke it:

     · an anchor outside the closed list          (law 4 — guessing is not resolving)
     · a relation outside the closed list
     · a topic outside the closed list
     · ANY numeric geometry — coordinate pairs, distances, radii, bearings
       (law 2 — the compiler owns geometry; the translator may not smuggle it)
     · a possessive span or surface form not present verbatim in the unit text
       (an evidence span that is not in the evidence is a fabrication)
     · a co-mention naming an anchor the mentions did not resolve

   Provenance is recorded per record: via, model, operated_at. A record whose
   provenance is unstated is refused like any other part in this system.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const p = (...a) => path.join(ROOT, ...a);
const cfg = JSON.parse(fs.readFileSync(p("world.config.json"), "utf8"));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };

const ANCHORS = Object.keys(cfg.anchors);
const RELATIONS = Object.keys(cfg.relations);
const TOPICS = ["parking", "cycling", "noise", "traffic", "safety", "density", "trees", "general"];
const STANCES = ["approve", "deny", "defer", "withdraw", null];

const S = JSON.parse(fs.readFileSync(p("atlas", cfg.source), "utf8"));
const units = (S.docs || []).filter(d => d.kind === "unit");
const ledger = (e) => {
  fs.mkdirSync(p("ledger"), { recursive: true });
  fs.appendFileSync(p("ledger", "extract.jsonl"), JSON.stringify({ t: new Date().toISOString(), ...e }) + "\n");
};

/* ------------------------------------------------------------------ EMIT */
if (process.argv.includes("--emit")) {
  const tpl = fs.readFileSync(p("harness/prompts/extract.md"), "utf8");
  const req = {
    schema: "halfworld/extract-request/v1",
    emitted_at: new Date().toISOString(),
    contract: {
      anchors: ANCHORS, relations: RELATIONS, topics: TOPICS, stances: ["approve", "deny", "defer", "withdraw", null],
      forbidden: "coordinates, distances, radii, bearings, bounding boxes — any number describing space",
      unresolved: "a named place matching no anchor takes anchor:null with the surface form copied verbatim",
    },
    units: units.map(u => ({
      id: u.id, title: u.title, text: u.el.join("\n"),
      prompt: tpl.replace("{{ANCHORS}}", ANCHORS.join(", "))
                 .replace("{{RELATIONS}}", RELATIONS.join(", "))
                 .replace("{{UNIT}}", `${u.title}\n${u.el.join("\n")}`),
    })),
  };
  fs.writeFileSync(p("atlas/extract-request.json"), JSON.stringify(req, null, 1));
  console.log(`EMITTED ${units.length} unit prompt(s) → atlas/extract-request.json`);
  console.log(`  anchors   ${ANCHORS.length}: ${ANCHORS.join(", ")}`);
  console.log(`  relations ${RELATIONS.length}: ${RELATIONS.join(", ")}`);
  console.log(`\nAnswer with one record per unit, then:\n  node harness/extract-operator.mjs --ingest atlas/extract-response.json`);
  process.exit(0);
}

/* ----------------------------------------------------------------- DIFF */
if (process.argv.includes("--diff")) {
  const EX = JSON.parse(fs.readFileSync(p("atlas/extracted.json"), "utf8"));
  const prev = fs.existsSync(p("atlas/extracted.stub.json")) ? JSON.parse(fs.readFileSync(p("atlas/extracted.stub.json"), "utf8")) : null;
  if (!prev) { console.error("no atlas/extracted.stub.json to compare against"); process.exit(1); }
  const byId = Object.fromEntries(prev.map(r => [r.id, r]));
  console.log("unit                                  stub → operator");
  let sm = 0, om = 0;
  for (const r of EX) {
    const a = byId[r.id] || { mentions: [] };
    sm += a.mentions.length; om += r.mentions.length;
    const anchorsA = new Set(a.mentions.filter(m => m.anchor).map(m => m.anchor));
    const anchorsB = new Set(r.mentions.filter(m => m.anchor).map(m => m.anchor));
    const gained = [...anchorsB].filter(x => !anchorsA.has(x));
    const lost = [...anchorsA].filter(x => !anchorsB.has(x));
    console.log(`${r.id.padEnd(34)} ${String(a.mentions.length).padStart(3)} → ${String(r.mentions.length).padStart(3)} mentions` +
      (gained.length ? `   +${gained.join(" +")}` : "") + (lost.length ? `   -${lost.join(" -")}` : "") +
      (r.stance !== a.stance ? `   stance ${a.stance ?? "null"} → ${r.stance ?? "null"}` : ""));
  }
  console.log(`\nTOTAL mentions ${sm} → ${om}`);
  process.exit(0);
}

/* --------------------------------------------------------------- INGEST */
const file = arg("ingest");
if (!file) { console.error("usage: --emit | --ingest <file> | --diff"); process.exit(1); }
const res = JSON.parse(fs.readFileSync(p(file), "utf8"));
if (!res.model || !res.via) { console.error("response must state `via` and `model` — unstated provenance is refused"); process.exit(1); }

/* Any number that describes space. The translator may write "behind"; it may
   never write how far behind. */
const NUMERIC = /-?\d+\.\d{3,}|\b\d+\s?(m|km|meters|metres|feet|ft|yards|miles|degrees|°)\b/i;

const out = [], problems = [];
for (const u of units) {
  const rec = (res.records || []).find(r => r.id === u.id);
  const hay = (u.title + "\n" + u.el.join("\n")).toLowerCase();
  const bad = [];

  if (!rec) { problems.push(`${u.id}: no record returned`); out.push({ id: u.id, mentions: [], claims: { possessive: [], comention: [] }, stance: null, ok: false, via: res.via, error: "missing" }); continue; }

  const mentions = [];
  for (const m of rec.mentions || []) {
    if (!m.surface || !hay.includes(String(m.surface).toLowerCase())) { bad.push(`surface not in unit text: "${m.surface}"`); continue; }
    if (m.anchor !== null && !ANCHORS.includes(m.anchor)) { bad.push(`anchor outside closed list: "${m.anchor}"`); continue; }
    if (!RELATIONS.includes(m.relation)) { bad.push(`relation outside closed list: "${m.relation}"`); continue; }
    if (!TOPICS.includes(m.topic)) { bad.push(`topic outside closed list: "${m.topic}"`); continue; }
    if (NUMERIC.test(JSON.stringify(m))) { bad.push(`numeric geometry smuggled into a mention: ${JSON.stringify(m)}`); continue; }
    mentions.push({ surface: m.surface, anchor: m.anchor ?? null, relation: m.relation, topic: m.topic });
  }

  const resolved = new Set(mentions.filter(m => m.anchor).map(m => m.anchor));
  const possessive = [];
  for (const q of rec.claims?.possessive || []) {
    if (hay.includes(String(q).toLowerCase())) possessive.push(q);
    else bad.push(`possessive span not in unit text: "${q}"`);
  }
  const comention = [];
  for (const pair of rec.claims?.comention || []) {
    if (!Array.isArray(pair) || pair.length !== 2) { bad.push(`malformed co-mention: ${JSON.stringify(pair)}`); continue; }
    if (!pair.every(a => resolved.has(a))) { bad.push(`co-mention names an anchor the mentions did not resolve: ${JSON.stringify(pair)}`); continue; }
    comention.push(pair);
  }

  const stance = rec.stance ?? null;
  if (!STANCES.includes(stance)) bad.push(`stance outside closed list: "${stance}"`);

  if (bad.length) problems.push(...bad.map(b => `${u.id}: ${b}`));
  out.push({
    id: u.id, mentions, claims: { possessive, comention },
    stance: STANCES.includes(stance) ? stance : null,
    ok: bad.length === 0, via: res.via, model: res.model, operated_at: res.operated_at || new Date().toISOString(),
    ...(bad.length ? { rejected: bad } : {}),
  });
  ledger({ id: u.id, event: "EXTRACTED", via: res.via, model: res.model, mentions: mentions.length, rejected: bad.length });
}

/* Keep the stub run beside the new one — the comparison is the evidence that
   the tier change was worth anything. */
if (fs.existsSync(p("atlas/extracted.json")) && !fs.existsSync(p("atlas/extracted.stub.json")))
  fs.copyFileSync(p("atlas/extracted.json"), p("atlas/extracted.stub.json"));

fs.writeFileSync(p("atlas/extracted.json"), JSON.stringify(out, null, 1));

const mentions = out.reduce((a, r) => a + r.mentions.length, 0);
const anchored = out.reduce((a, r) => a + r.mentions.filter(m => m.anchor).length, 0);
console.log(`INGESTED  via ${res.via} · ${res.model}`);
console.log(`  ${out.length} unit(s) · ${mentions} mention(s) · ${anchored} resolved · ${out.filter(r => r.ok).length} clean`);
if (problems.length) {
  console.log(`\nREFUSED ${problems.length} item(s) — kept out of the atlas, recorded on the unit:`);
  for (const q of problems) console.log("  · " + q);
} else console.log(`\nNo contract violations. Every mention verbatim, every anchor and relation in the closed list, no geometry smuggled.`);
console.log(`\nwrote atlas/extracted.json   next: node harness/compile-field.mjs && node harness/gate.mjs`);
