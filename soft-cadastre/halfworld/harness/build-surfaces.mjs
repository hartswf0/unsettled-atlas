#!/usr/bin/env node
/* ============================================================================
   build-surfaces.mjs — STAGE 5 PREP · put the compiled atlas into the surfaces

     node harness/build-surfaces.mjs           build viewer.html and helm.html
     node harness/build-surfaces.mjs --check   exit 1 if either has drifted

   viewer.html and helm.html are self-contained: the compiled atlas is inlined
   at the `__EMBED__` marker so a double-clicked file works with no server. That
   embedding had no script — it was done by hand once, which meant every later
   compile silently left the surfaces showing an older world. A pipeline whose
   last step is manual is a pipeline that lies about its own output.

   Edit the templates. The built files are generated and will be overwritten.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const p = (...a) => path.join(ROOT, ...a);
const CHECK = process.argv.includes("--check");
const MARK = "/*__EMBED__*/null";
const strip = (x) => x.replace(/"built":\s*"[^"]*"/g, '"built":"*"');

const src = p("atlas", "compiled.json");
if (!fs.existsSync(src)) { console.error("no atlas/compiled.json — run compile-field.mjs first"); process.exit(1); }
const compiled = fs.readFileSync(src, "utf8");
const sanity = JSON.parse(compiled).sanity;

let stale = 0;
for (const [tpl, out] of [["viewer.template.html", "viewer.html"], ["helm.template.html", "helm.html"]]) {
  const t = fs.readFileSync(p(tpl), "utf8");
  if (!t.includes(MARK)) { console.error(`${tpl}: no ${MARK} marker`); process.exit(1); }
  const body = t.replace(MARK, compiled);
  const cur = fs.existsSync(p(out)) ? fs.readFileSync(p(out), "utf8") : null;
  /* compiled.json restamps `built` every run. Comparing it raw makes --check report
     STALE on every single invocation, and a check that always cries wolf gets ignored. */
  if (cur !== null && strip(cur) === strip(body)) { console.log(`OK      ${out}`); continue; }
  stale++;
  if (CHECK) { console.log(`STALE   ${out} — rebuild with: node harness/build-surfaces.mjs`); continue; }
  fs.writeFileSync(p(out), body);
  console.log(`WROTE   ${out}  (${(body.length / 1024).toFixed(0)} KB)`);
}

console.log(`\n${sanity.units} units · ${sanity.stamped} kernels · ${sanity.lines} lines · ${sanity.boxes} boxes · ${sanity.walls} walls · ${sanity.unresolved} unresolved kept`);
if (sanity.dropped) console.log(`⚠ ${sanity.dropped} mark(s) dropped at compile — see atlas/compiled.json .dropped`);
if (!CHECK) console.log(`\nnext: node harness/gate.mjs, then open viewer.html and LOOK`);
process.exit(CHECK && stale ? 1 : 0);
