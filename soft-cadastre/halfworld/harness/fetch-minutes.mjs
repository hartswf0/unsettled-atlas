#!/usr/bin/env node
/* ============================================================================
   fetch-minutes.mjs — STAGE 0 · ACQUIRE
   Manifest-driven pull of NPU minutes + BZA dockets. Zero dependency:
   native fetch, node:fs. Raw bytes are kept beside stripped text — the
   ledger starts here and a ledger with no failures is a falsified ledger.

     node harness/fetch-minutes.mjs                pull everything in atlas/manifest.json
     node harness/fetch-minutes.mjs --dry          list what would be pulled

   manifest.json shape:
     { "docs": [ { "id": "NPU-N-2026-06", "npu": "N", "kind": "minutes",
                   "url": "https://...", "date": "2026-06" } ] }

   HONEST: this script cannot parse PDF text (zero-dep). PDFs are saved to
   raw/ and logged as NEEDS-OCR; run `pdftotext` (poppler) if present, else
   the gap itself is data and stays in the ledger.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const p = (...a) => path.join(ROOT, ...a);
const DRY = process.argv.includes("--dry");

const ledger = (entry) => {
  fs.mkdirSync(p("ledger"), { recursive: true });
  fs.appendFileSync(p("ledger", "acquire.jsonl"),
    JSON.stringify({ t: new Date().toISOString(), ...entry }) + "\n");
};

const stripHtml = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)>/gi, "\n")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

const hasPdftotext = (() => {
  try { execFileSync("pdftotext", ["-v"], { stdio: "ignore" }); return true; }
  catch { return false; }
})();

async function pull(doc) {
  const res = await fetch(doc.url, { redirect: "follow" });
  if (!res.ok) { ledger({ id: doc.id, event: "FETCH-FAIL", status: res.status, url: doc.url }); return; }
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(p("raw"), { recursive: true });
  fs.mkdirSync(p("text"), { recursive: true });

  if (ct.includes("pdf") || doc.url.toLowerCase().endsWith(".pdf")) {
    const rawPath = p("raw", doc.id + ".pdf");
    fs.writeFileSync(rawPath, buf);
    if (hasPdftotext) {
      const txtPath = p("text", doc.id + ".txt");
      execFileSync("pdftotext", ["-layout", rawPath, txtPath]);
      ledger({ id: doc.id, event: "SAVED+EXTRACTED", via: "pdftotext", bytes: buf.length });
    } else {
      ledger({ id: doc.id, event: "SAVED, NEEDS-OCR", note: "pdftotext not present; PDF kept raw", bytes: buf.length });
    }
  } else {
    fs.writeFileSync(p("raw", doc.id + ".html"), buf);
    const text = stripHtml(buf.toString("utf8"));
    fs.writeFileSync(p("text", doc.id + ".txt"),
      `# ${doc.id}  npu:${doc.npu}  kind:${doc.kind}  date:${doc.date}\n\n` + text);
    ledger({ id: doc.id, event: "SAVED+STRIPPED", bytes: buf.length, chars: text.length });
  }
}

const manifestPath = p("atlas", "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("no atlas/manifest.json — create it with the NPU/BZA urls you are pulling.");
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
for (const doc of manifest.docs || []) {
  if (DRY) { console.log("WOULD PULL", doc.id, doc.url); continue; }
  try { await pull(doc); console.log("PULLED", doc.id); }
  catch (e) { ledger({ id: doc.id, event: "ERROR", err: String(e) }); console.error("FAILED", doc.id, e.message); }
}
