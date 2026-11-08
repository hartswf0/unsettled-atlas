# Pivot Atlas · Circle Assembler (seed milestone)

A catalog of center-pivot irrigation fields detected in open Sentinel-2 imagery, plus an assembler that renders any image as a mosaic of those real fields. This milestone covers two seed tiles in Egypt's Western Desert: **Toshka (MGRS 36QUL)** and **East Oweinat (MGRS 35QPF)**. It was built under the SCION Circle Assembler instruction (`SCION_CIRCLE_ASSEMBLER.md`).

Viewer: `web/index.html` (serve `web/` statically).

## What is here

| Path | What |
|---|---|
| `atlas/36QUL/records.json`, `atlas/35QPF/records.json` | 3,410 + 1,213 field records: center (WGS84 + UTM), radius, geometry method, March-2025 sector state, CIELAB, 2017–2025 history, lifecycle, provenance |
| `data/det_*_v6.json` | final detections with every score (rim support, step, fit residual, NDVI) |
| `data/gt_sealed/36QUL/` | sealed ground truth: 14 stratified chips, 285 circles, labeled by an independent agent |
| `data/audit_packets/verdicts.json`, `data/audit_r2/verdicts_r2.json` | independent audit, rounds 1 and 2 |
| `data/audit_36QUL_*_c.json` | scores against sealed labels (pixel-centre convention) |
| `mosaics/*.json` | placement manifests: each dot maps to a field id, lon/lat, date, scene, rotation |
| `web/` | viewer + compact exports |
| `src/` | pipeline |

## Pipeline (reproduce)

```
python3 src/fetch.py data/stack_36QUL_2025-03.npz S2C_36QUL_20250320_0_L2A S2C_36QUL_20250313_0_L2A
python3 src/fetch.py data/stack_35QPF_2025-03.npz S2B_35QPF_20250311_0_L2A
# per tile T:
python3 src/detect.py   data/stack_T_2025-03.npz data/det_T_v4raw.json      # Hough on 2 channels + rim confirmation
python3 src/lattice.py  data/stack_T_2025-03.npz data/det_T_v4raw.json data/det_T_v4.json   # tiers + farm-lattice invariant
python3 src/geomfit.py  data/stack_T_2025-03.npz data/det_T_v4.json data/det_T_v5.json      # sub-pixel half-max circle fit
python3 src/finalize.py data/stack_T_2025-03.npz data/det_T_v5.json data/det_T_v6.json      # reject bare+non-circular; pick geometry
python3 src/catalog.py  data/stack_T_2025-03.npz data/det_T_v6.json atlas/T T              # records + 10 m L2A chips
python3 src/temporal_fetch.py T 2017,2018,2019,2020,2021,2022,2023,2024
python3 src/temporal_attrs.py T
# merge atlas/records.json + atlas/sand.json (see export notes in src/export_web.py), then:
python3 src/mosaic.py --atlas atlas --target targets/astronaut_nasa_pd.png --out mosaics/astronaut_halftone --mode halftone --cols 70 --width 3200 --sand "$(jq -c .sand_lab atlas/sand.json)"
python3 src/mosaic_temporal.py mosaics/astronaut_halftone.json mosaics/astronaut_temporal 0.5
python3 src/export_web.py
```

Imagery is read directly from the AWS open COG bucket `sentinel-cogs` (no STAC API). Requester-pays JP2 items are skipped.

## Validation (measured)

- **Sealed labels, Toshka, v6:** precision 0.993 (95% CI 0.973–0.998), recall 0.974 (0.948–0.987), median center error 3.8 m, median radius error −0.5%. Fallow recall 3/8.
- **Independent audit round 2:** same-site precision 100% in both regions (all 10 removals confirmed). Fresh-sample precision is 97.5% (Toshka) and 100% (East Oweinat). Center bias is fixed in both regions.
- **Open failures (circuit breaker holds expansion):** in Toshka, mean radius ratio is 1.047 (about a third of fields are 6–10% small, likely the rim-search fallback), half-planted fields are sometimes fitted to their planted half, and there were 9 misses in 20 fresh empty-space windows.

## Finding

The Toshka tile had about 300 pivot fields in March 2017 and 3,410 in March 2025, while the Toshka lakes refilled beside them. 534 Toshka fields have no earlier coverage, because the single-scene epochs cover about 82% of the tile. East Oweinat was largely built by 2017 (909 of 1,213 fields).

## Licenses

Contains modified Copernicus Sentinel data 2017–2025. Portrait target: NASA photo of Eileen Collins (public domain), via scikit-image `data.astronaut`. Code: MIT (repository license).
