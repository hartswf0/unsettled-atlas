#!/usr/bin/env node
/* ============================================================================
   sync-embeds.mjs — keep the file:// fallbacks honest

     node sync-embeds.mjs           regenerate the embeds
     node sync-embeds.mjs --check   exit 1 if any embed has drifted

   The index reads registry.json over fetch, which file:// forbids, so it ships
   a generated <script> twin. A twin that drifts from its source is a surface
   that shows different numbers depending on how it was opened — exactly the
   kind of quiet lie this system exists to refuse.

   REGISTRY I's three artifacts (data.json, data.embed.js and the helm's inline
   ATLAS) are NOT handled here — they are built together by
   seres/harness/build-atlas.mjs, which also gates them. One owner each.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CHECK = process.argv.includes("--check");

const PAIRS = [
  { src: "registry.json", out: "registry.embed.js", global: "CADASTRE_REGISTRY" },
];

let drifted = 0;
for (const { src, out, global: g } of PAIRS) {
  const s = path.join(ROOT, src), o = path.join(ROOT, out);
  if (!fs.existsSync(s)) { console.log(`MISSING ${src} — cannot generate ${out}`); drifted++; continue; }
  const data = JSON.parse(fs.readFileSync(s, "utf8"));
  const body = `/* SOFT CADASTRE — offline fallback for file:// use. Generated from ${src}. */\n`
             + `window.${g}=${JSON.stringify(data)};\n`;
  const cur = fs.existsSync(o) ? fs.readFileSync(o, "utf8") : null;
  if (cur === body) { console.log(`OK      ${out}`); continue; }
  drifted++;
  if (CHECK) { console.log(`DRIFT   ${out} — regenerate with: node sync-embeds.mjs`); continue; }
  fs.writeFileSync(o, body);
  console.log(`WROTE   ${out}  (${body.length} bytes from ${src})`);
}
process.exit(CHECK && drifted ? 1 : 0);
