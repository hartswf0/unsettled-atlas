#!/usr/bin/env node
/* ============================================================================
   segment.mjs — STAGE 1 · SEGMENT
   Splits stripped minutes into agenda-item units — the unit the institution
   already uses — and emits atlas/source.json in the halfworld docs schema.

     node harness/segment.mjs                segment every file in text/
     node harness/segment.mjs sample/*.txt   segment specific files

   Unit boundaries recognized (in order):
     "ITEM 4" / "Item IV." / "4." at line start followed by caps-ish title
     "V-26-118" / "Z-25-041" / "APPLICATION ..." variance dockets
     ALL-CAPS heading lines >= 8 chars
   Cast guessed from "Mr./Ms./Mrs./Chair/Commissioner <Name>" patterns.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const p = (...a) => path.join(ROOT, ...a);
const cfg = JSON.parse(fs.readFileSync(p("world.config.json"), "utf8"));

const files = process.argv.slice(2).filter(a => !a.startsWith("--"));
const inputs = files.length ? files
  : fs.existsSync(p("text")) ? fs.readdirSync(p("text")).filter(f => f.endsWith(".txt")).map(f => p("text", f))
  : [];
if (!inputs.length) { console.error("nothing to segment — put .txt files in text/ or pass paths."); process.exit(1); }

const BOUNDARY = new RegExp([
  String.raw`^(?:ITEM|Item)\s+([0-9IVXLC]+)[.:)]?\s`,
  String.raw`^([0-9]{1,2})[.)]\s+(?=[A-Z])`,
  String.raw`^((?:V|Z|U|CDP)-\d{2}-\d{2,4})\b`,
  String.raw`^(APPLICATION\b.*)$`,
  String.raw`^([A-Z][A-Z0-9 ,'&/\-]{7,})$`
].join("|"), "m");

const CAST = /\b(?:Mr|Ms|Mrs|Dr|Chair(?:person)?|Commissioner|Councilmember)\.?\s+([A-Z][a-z]+)/g;
const OUTCOME = /\b(den(?:y|ied|ial)|defer(?:red|ral)?|approv(?:e|ed|al)|withdraw(?:n|al)?|no\s+action|tabled)\b/i;

const docs = [];
for (const file of inputs) {
  const base = path.basename(file, ".txt");
  const raw = fs.readFileSync(file, "utf8");
  const headerMatch = raw.match(/^#\s*(\S+)\s+npu:(\S+)\s+kind:(\S+)\s+date:(\S+)/);
  const meta = headerMatch
    ? { srcId: headerMatch[1], npu: headerMatch[2], kind: headerMatch[3], date: headerMatch[4] }
    : { srcId: base, npu: cfg.defaultNpu, kind: "minutes", date: "undated" };

  const body = headerMatch ? raw.slice(raw.indexOf("\n\n") + 2) : raw;
  const lines = body.split("\n");

  let units = [], cur = null, n = 0;
  const push = () => { if (cur && cur.el.join(" ").trim().length > 40) units.push(cur); };
  for (const line of lines) {
    if (BOUNDARY.test(line)) {
      push(); n++;
      cur = { id: `${meta.srcId}-item${String(n).padStart(2, "0")}`,
              kind: "unit", num: `${meta.date}.${String(n).padStart(2, "0")}`,
              title: line.trim().slice(0, 120), npu: meta.npu, date: meta.date,
              srckind: meta.kind, el: [], cast: [] };
    } else if (cur && line.trim()) cur.el.push(line.trim());
    else if (!cur && line.trim()) {
      cur = { id: `${meta.srcId}-item00`, kind: "unit", num: `${meta.date}.00`,
              title: "PREAMBLE", npu: meta.npu, date: meta.date, srckind: meta.kind, el: [line.trim()], cast: [] };
    }
  }
  push();

  for (const u of units) {
    const text = u.el.join(" ");
    u.cast = [...new Set([...text.matchAll(CAST)].map(m => m[1]))];
    const o = text.match(OUTCOME);
    if (o) u.outcome = o[1].toLowerCase().replace(/ied$|ial$/, "y").replace(/red$|ral$/, "").replace(/ed$|al$/, "");
    docs.push(u);
  }
  console.log(`SEGMENTED ${base}: ${units.length} unit(s)`);
}

fs.mkdirSync(p("atlas"), { recursive: true });
fs.writeFileSync(p("atlas", cfg.source), JSON.stringify({ docs }, null, 2));
console.log(`WROTE atlas/${cfg.source} — ${docs.length} unit(s) total`);
