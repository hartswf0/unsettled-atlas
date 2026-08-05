#!/usr/bin/env node
/* ============================================================================
   extract.mjs — STAGE 3 · EXTRACT
   Per-unit semiotic translation. THE MODEL NEVER EMITS COORDINATES — it
   emits a spatial relation program (anchor + relation + qualifier) plus
   territorial claims. Geometry belongs to compile-field.mjs.

     node harness/extract.mjs --stub     deterministic regex extraction, offline
     node harness/extract.mjs            LLM extraction (needs ANTHROPIC_API_KEY)

   Output atlas/extracted.json, one record per unit:
     { id, mentions:[{surface, anchor, relation, topic}],
       claims:{possessive:[...], comention:[[anchorA,anchorB],...]},
       stance, ok, via }
   Failures stay in the record and in ledger/extract.jsonl.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const p = (...a) => path.join(ROOT, ...a);
const cfg = JSON.parse(fs.readFileSync(p("world.config.json"), "utf8"));
const STUB = process.argv.includes("--stub");
const RELS = Object.keys(cfg.relations);

const ledger = (e) => {
  fs.mkdirSync(p("ledger"), { recursive: true });
  fs.appendFileSync(p("ledger", "extract.jsonl"), JSON.stringify({ t: new Date().toISOString(), ...e }) + "\n");
};

const S = JSON.parse(fs.readFileSync(p("atlas", cfg.source), "utf8"));
const units = (S.docs || []).filter(d => d.kind === "unit");

/* ---- alias table, longest first so THE OLD SEARS BUILDING beats SEARS --- */
const aliases = Object.entries(cfg.planOf).sort((a, b) => b[0].length - a[0].length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* topic detectors — the castHints move, pointed at issues not bodies */
const TOPICS = {
  parking:  /\b(park(?:ing|ed)|deck|valet|curb)\b/i,
  cycling:  /\b(bike|bicycle|cyclist|scooter|lane)\b/i,
  noise:    /\b(noise|loud|music|amplif)\b/i,
  traffic:  /\b(traffic|speeding|cut-through|congest)\b/i,
  safety:   /\b(crime|light(?:ing)?|unsafe|dark)\b/i,
  density:  /\b(density|units|stories|height|setback|variance|rezon)\b/i,
  trees:    /\b(tree|canopy|shade)\b/i
};

const REL_WORDS = {
  "behind": /\bbehind\b|\bin back of\b|\brear of\b/i,
  "in-front-of": /\bin front of\b/i,
  "across-from": /\bacross (?:the street )?from\b|\bopposite\b/i,
  "along": /\balong\b|\bdown\b(?=\s+the)/i,
  "near": /\bnear\b|\bby\b|\bclose to\b|\baround\b/i,
  "at": /\bat\b|\bon the corner of\b|\binside\b/i,
  "between": /\bbetween\b/i
};

function stubExtract(u) {
  const text = u.el.join(" ");
  const mentions = [];
  for (const [surface, anchor] of aliases) {
    const re = new RegExp(`(.{0,50})\\b${esc(surface)}\\b`, "gi");
    let m;
    while ((m = re.exec(text))) {
      const pre = m[1];
      let relation = "at";
      for (const [rel, rre] of Object.entries(REL_WORDS)) if (rre.test(pre)) { relation = rel; break; }
      let topic = "general";
      const window = text.slice(Math.max(0, m.index - 120), m.index + surface.length + 120);
      for (const [t, tre] of Object.entries(TOPICS)) if (tre.test(window)) { topic = t; break; }
      mentions.push({ surface, anchor, relation, topic });
    }
  }
  const possessive = [...text.matchAll(/\b(?:our|my)\s+((?:[a-z]+\s){0,2}(?:street|block|corner|alley|park|sidewalk|neighborhood|court))/gi)]
    .map(m => m[1].toLowerCase());
  const seen = [...new Set(mentions.map(m => m.anchor))];
  const comention = [];
  for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) comention.push([seen[i], seen[j]]);
  return { id: u.id, mentions, claims: { possessive, comention },
           stance: u.outcome || null, ok: true, via: "stub" };
}

async function llmExtract(u) {
  const prompt = fs.readFileSync(p("harness", "prompts", "extract.md"), "utf8")
    .replace("{{ANCHORS}}", Object.keys(cfg.anchors).join(", "))
    .replace("{{RELATIONS}}", RELS.join(", "))
    .replace("{{UNIT}}", JSON.stringify({ id: u.id, title: u.title, text: u.el.join("\n") }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json",
               "x-api-key": process.env.ANTHROPIC_API_KEY,
               "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.MODEL || "claude-sonnet-4-6",
                           max_tokens: 1500, messages: [{ role: "user", content: prompt }] })
  });
  const data = await res.json();
  const raw = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const clean = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);           // throws -> caught by caller, stays in ledger
  for (const m of parsed.mentions || []) {
    if (!cfg.anchors[m.anchor]) { m.anchor = null; m.note = "unknown anchor — refused, not guessed"; }
    if (!RELS.includes(m.relation)) m.relation = "near";
  }
  return { id: u.id, ...parsed, ok: true, via: "llm" };
}

const out = [];
for (const u of units) {
  try {
    const rec = STUB ? stubExtract(u) : await llmExtract(u);
    out.push(rec);
    ledger({ id: u.id, event: "EXTRACTED", via: rec.via, mentions: rec.mentions.length });
  } catch (e) {
    out.push({ id: u.id, mentions: [], claims: { possessive: [], comention: [] }, ok: false, err: String(e) });
    ledger({ id: u.id, event: "EXTRACT-FAIL", err: String(e) });
  }
}
fs.writeFileSync(p("atlas", "extracted.json"), JSON.stringify(out, null, 2));
const okN = out.filter(r => r.ok).length;
console.log(`EXTRACTED ${okN}/${units.length} unit(s) via ${STUB ? "stub" : "llm"} -> atlas/extracted.json`);
