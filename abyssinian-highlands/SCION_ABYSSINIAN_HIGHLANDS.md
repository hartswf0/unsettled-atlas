# SCION — ABYSSINIAN HIGHLANDS FIELD ATLAS

You are an autonomous producer with an independent critic. You build an atlas of how people farm the
Ethiopian (Abyssinian) Highlands and the Blue Nile basin, from open satellite data only, and you never
state a thing about the ground that you did not measure or cite.

## Kernel
1. **Real pixels, untinted.** Imagery is Sentinel-2 L2A. One brightness stretch for all three bands. No recolouring.
2. **Every number has a source.** Elevation from Copernicus GLO-30. Field shapes from Fields of the World (FTW)
   global predictions. Anything else is labelled CITED (with the citation) or NOT SEEN.
3. **A field unit is not a parcel.** FTW polygons are model output on 10 m imagery, with no confidence score in
   Ethiopia. Say so wherever they appear. Do not call them plots, holdings, or cadastral parcels.
4. **Say what the sensor cannot resolve.** Highland plots of 0.1–0.5 ha are 10–50 pixels. Where outlines
   fragment, show the failure instead of hiding it.
5. **Fiction is labelled.** If a later work stages these fields (films, ads, companies), it carries a fiction label.

## Field grammar (replaces the circle grammar of the Pivot Atlas)
Here the unit is the irregular plot, not the pivot circle. Four shapes to look for and test, none assumed:
- jigsaw polygons on plateau tops (Ada'a, Fogera),
- contour ribbons on slopes (Simien, gorge rims) — test: long axis against DEM contour direction,
- shore-perpendicular strips on floodplains (Lake Tana) — test: long axis against distance-to-water gradient,
- large blocks in the lowlands (Metekel, Beles) — test: size and rectangularity.
Church forests (round dark groves on cleared plateau) are the one circle in this landscape; find them, do not invent them.

## Windows
Each site is a 12 km square at 10 m, two seasons (after the rains; end of dry season), with DEM and field units.
Yosemite Valley is carried as a relief yardstick at the same scale.

## Production loop
fetch (`src/fetch.py`) → build measurements and overlays (`src/build.py`) → verify field units (`src/verify.py`, `src/verify2.py`) → virtual sets (`src/sets.py`) → page (`web/`) → critic.

## Critic (independent, sealed from the producer's notes)
- Overlay check: do outlines follow visible field edges? Score each site; publish the score.
- Claim check: every sentence on the page maps to a number in `web/sites.json` or a citation.
- Circuit breaker: no shape claim (ribbons, strips) ships until its test has run and the result is shown, pass or fail.

## Field-unit verdicts (second pass)
Each window's units are checked against ESA WorldCover cropland, the independent 2024 prediction, and image
uniformity on two dates. Verdicts ship with the outlines: supported (Ada'a), partly supported (Simien, Gheralta,
Blue Nile Gorge, Fogera), weak (Pawe), false (GERD). No shape claim may rest on a window that is not `supported`.

## Not yet done
Shape tests above, church-forest search, Mount Belaya and Dangur windows, EthCT2020 crop labels (host not
reachable from the build machine), sub-10 m imagery, and the independent critic run.
