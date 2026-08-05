# ATL NPU HALFWORLD — perceptual territories harness

NPU minutes + BZA outcomes -> segmented agenda-item units -> spatial relation
programs (no coordinates from the model, ever) -> deterministic kernel fields
-> ordered-dot halftone frames with Appleyard claim lines, territory boxes,
and refusal walls. Forked orchestration contract from abiding-halfworld:
executable gates, ledger beside every stage, LOOK as a gate that cannot pass
without a human.

## The loop

    node harness/fetch-minutes.mjs              # STAGE 0 — needs atlas/manifest.json with real urls
    node harness/segment.mjs                    # STAGE 1 — text/*.txt -> atlas/source.json
    node harness/extract.mjs --stub             # STAGE 3 — offline regex extraction
    node harness/extract.mjs                    # STAGE 3 — LLM extraction (ANTHROPIC_API_KEY)
    node harness/compile-field.mjs              # STAGE 4 — atlas/compiled.json
    node harness/gate.mjs                       # gates 1-5; exits 1 until all pass
    open viewer.html                            # STAGE 5 — LOOK; MARK READ; download look.jsonl -> ledger/

Demo end-to-end right now:

    node harness/segment.mjs sample/NPU-N-SAMPLE-2026-06.txt
    node harness/extract.mjs --stub
    node harness/compile-field.mjs
    node harness/gate.mjs

Gates 1-4 pass on the sample. Gate 5 fails until you have looked, which is
correct behavior.

## Contract

- SEGMENT at the agenda item — the unit the institution already uses.
- The model is a semiotic translator with closed vocabularies (anchors,
  relations). Unknown place -> anchor:null, kept as data, never guessed.
- compile-field.mjs owns all geometry. Relations -> kernel families
  (iso / offset-behind / along-line / between). Denied variances -> refusal
  walls. Possessive spans -> territory boxes. Co-mentions -> claim lines.
- Gate 2 is the ratio test: top-5 anchors must cover >= 1/3 of units or the
  corpus is a travelogue and planOf must grow before compute is spent.

## Honest notes (HONEST law)

- SAMPLE minutes are synthetic, written to exercise the pipeline. Anchor
  coordinates are PROVISIONAL eyeball values — replace with OSM footprints
  and real segment polylines before any claim leaves the building.
- --stub extraction is regex over planOf aliases: good enough to flow the
  pipeline, blind to vernacular the alias table lacks. The LLM path is the
  real translator; its prompt is harness/prompts/extract.md.
- fetch-minutes.mjs cannot read PDFs zero-dep. It saves them, uses pdftotext
  if present, and otherwise ledgers NEEDS-OCR. The gaps are data.
- Some NPUs post minutes irregularly or as scans. Log the absence.
- Next joins, in order: BZA docket outcomes keyed to V-/Z- numbers already
  captured per unit; GDOT AADT per street segment for Appleyard
  stratification; ATL311 as corpus two once its free-text field is confirmed.
