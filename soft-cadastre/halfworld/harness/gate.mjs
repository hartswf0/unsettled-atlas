#!/usr/bin/env node
/* ============================================================================
   gate.mjs — THE LOOP, MADE EXECUTABLE (forked contract, municipal edition)

     node harness/gate.mjs            run every gate, exit 1 on failure
     node harness/gate.mjs 2          run one gate
     node harness/gate.mjs --json     machine-readable

   for gate in 1..5: while not gate.passes: do the work the gate names.
   A gate that only says "false" makes the loop guess — every gate reports
   WHAT failed and WHICH STAGE fixes it.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const p = (...a) => path.join(ROOT, ...a);
const has = (x) => fs.existsSync(p(x));
const J = (x) => JSON.parse(fs.readFileSync(p(x), "utf8"));
const cfg = J("world.config.json");
const JSON_OUT = process.argv.includes("--json");
const ONLY = process.argv.find(a => /^\d+$/.test(a));

const GATES = [];
const gate = (n, name, fixedBy, run) => GATES.push({ n, name, fixedBy, run });

/* -------------------------------------------------------------- GATE 1 */
gate(1, "corpus is well formed", "STAGE 1 — segment (harness/segment.mjs)", () => {
  const src = path.join("atlas", cfg.source);
  if (!has(src)) return { pass: false, detail: `no ${src}` };
  const d = (J(src).docs || []).filter(x => x.kind === "unit");
  const ids = new Set(d.map(x => x.id));
  const bad = [];
  if (d.length < cfg.gates.min_units) bad.push(`${d.length} unit(s) — below floor ${cfg.gates.min_units}`);
  if (d.length !== ids.size) bad.push(`${d.length - ids.size} duplicate id(s)`);
  const noTitle = d.filter(x => !x.title).length; if (noTitle) bad.push(`${noTitle} unit(s) with no title`);
  const noEl = d.filter(x => !x.el || !x.el.length).length; if (noEl) bad.push(`${noEl} unit(s) with empty el`);
  return { pass: !bad.length, detail: bad.join("; ") || `${d.length} units, ids unique`, numbers: { units: d.length } };
});

/* -------------------------------------------------------------- GATE 2 */
gate(2, "gazetteer covers the corpus (the ratio test)", "grow planOf aliases in world.config.json, then re-run extract", () => {
  if (!has("atlas/extracted.json")) return { pass: false, detail: "no atlas/extracted.json — run extract first" };
  const EX = J("atlas/extracted.json");
  const perAnchorUnits = {};
  let unitsWithAnchor = 0;
  for (const r of EX) {
    const anchors = new Set((r.mentions || []).filter(m => m.anchor).map(m => m.anchor));
    if (anchors.size) unitsWithAnchor++;
    for (const a of anchors) (perAnchorUnits[a] ||= new Set()).add(r.id);
  }
  const top = Object.entries(perAnchorUnits).sort((a, b) => b[1].size - a[1].size).slice(0, cfg.gates.gazetteer_top_n);
  const covered = new Set(); for (const [, s] of top) for (const id of s) covered.add(id);
  const ratio = EX.length ? covered.size / EX.length : 0;
  const pass = ratio >= cfg.gates.gazetteer_min_ratio;
  return { pass,
    detail: `top ${cfg.gates.gazetteer_top_n} anchors cover ${covered.size}/${EX.length} units (${(ratio * 100).toFixed(0)}%) — ` +
            (pass ? "you have a world" : `need ≥ ${(cfg.gates.gazetteer_min_ratio * 100).toFixed(0)}%; this corpus is a travelogue until planOf grows`),
    numbers: { ratio: +ratio.toFixed(3), top: top.map(([a, s]) => [a, s.size]) } };
});

/* -------------------------------------------------------------- GATE 3 */
gate(3, "extraction parses and resolves", "STAGE 3 — extract (fix prompt, or add aliases; unresolved mentions are data but too many is a broken gazetteer)", () => {
  if (!has("atlas/extracted.json")) return { pass: false, detail: "no atlas/extracted.json" };
  const EX = J("atlas/extracted.json");
  const okRate = EX.length ? EX.filter(r => r.ok).length / EX.length : 0;
  let mentions = 0, resolved = 0;
  for (const r of EX) for (const m of r.mentions || []) { mentions++; if (m.anchor) resolved++; }
  const anchorRate = mentions ? resolved / mentions : 0;
  const bad = [];
  if (okRate < cfg.gates.extract_min_parse_rate) bad.push(`parse rate ${(okRate * 100).toFixed(0)}% < ${(cfg.gates.extract_min_parse_rate * 100)}%`);
  if (anchorRate < cfg.gates.extract_min_anchor_rate) bad.push(`anchor resolution ${(anchorRate * 100).toFixed(0)}% < ${(cfg.gates.extract_min_anchor_rate * 100)}%`);
  if (!mentions) bad.push("zero mentions extracted");
  return { pass: !bad.length, detail: bad.join("; ") || `parse ${(okRate * 100).toFixed(0)}% · resolve ${resolved}/${mentions}`,
           numbers: { okRate: +okRate.toFixed(3), mentions, resolved } };
});

/* -------------------------------------------------------------- GATE 4 */
gate(4, "compiled fields are sane", "STAGE 4 — compile (harness/compile-field.mjs)", () => {
  if (!has("atlas/compiled.json")) return { pass: false, detail: "no atlas/compiled.json" };
  const C = J("atlas/compiled.json");
  const bad = [];
  if (!C.sanity.stamped) bad.push("zero kernels stamped");
  for (const [topic, cells] of Object.entries(C.fields || {})) {
    let out = 0, nan = 0;
    for (const [x, y, v] of cells) {
      if (x < 0 || y < 0 || x >= C.meta.W || y >= C.meta.H) out++;
      if (!isFinite(v) || v < 0 || v > 1) nan++;
    }
    if (out) bad.push(`${topic}: ${out} cell(s) outside grid`);
    if (nan) bad.push(`${topic}: ${nan} bad value(s)`);
    if (!cells.length) bad.push(`${topic}: empty field`);
  }
  if (!Object.keys(C.fields || {}).length) bad.push("no fields at all");
  return { pass: !bad.length, detail: bad.join("; ") || `${C.sanity.stamped} kernels over ${Object.keys(C.fields).length} topic(s); ${C.sanity.unresolved} unresolved kept as data`,
           numbers: C.sanity };
});

/* -------------------------------------------------------------- GATE 5 */
gate(5, "LOOK — a human has read the frames", "open viewer.html, read every frame, press MARK READ; the ledger it downloads goes in ledger/look.jsonl", () => {
  if (!has("ledger/look.jsonl")) return { pass: false, detail: "no ledger/look.jsonl — nobody has looked. A frame nobody read is a frame nobody checked. This gate cannot be automated and that is the point." };
  const seen = fs.readFileSync(p("ledger/look.jsonl"), "utf8").trim().split("\n").filter(Boolean).length;
  return { pass: seen > 0, detail: `${seen} look entr(ies) on record`, numbers: { seen } };
});

/* -------------------------------------------------------------- runner */
let failed = 0;
const results = [];
for (const g of GATES) {
  if (ONLY && String(g.n) !== ONLY) continue;
  let r; try { r = g.run(); } catch (e) { r = { pass: false, detail: "gate crashed: " + e.message }; }
  results.push({ gate: g.n, name: g.name, ...r, fixedBy: r.pass ? undefined : g.fixedBy });
  if (!r.pass) failed++;
  if (!JSON_OUT) console.log(`GATE ${g.n} ${r.pass ? "PASS" : "FAIL"} · ${g.name}\n       ${r.detail}${r.pass ? "" : "\n       fix: " + g.fixedBy}`);
}
if (JSON_OUT) console.log(JSON.stringify(results, null, 2));
process.exit(failed ? 1 : 0);
