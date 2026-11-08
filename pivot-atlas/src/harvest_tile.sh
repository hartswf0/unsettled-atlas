#!/bin/sh
# usage: harvest_tile.sh TILE SCENE_ID [RMAX]   — full cascade for one new biome tile
set -e
T=$1; S=$2; export RMAX=${3:-32}; export STRONG_SIGN=${4:-darker}
python3 src/fetch.py data/stack_${T}_2025.npz $S
python3 src/detect.py   data/stack_${T}_2025.npz data/det_${T}_v4raw.json
python3 src/lattice.py  data/stack_${T}_2025.npz data/det_${T}_v4raw.json data/det_${T}_v4.json
python3 src/geomfit.py  data/stack_${T}_2025.npz data/det_${T}_v4.json data/det_${T}_v5.json
python3 src/finalize.py data/stack_${T}_2025.npz data/det_${T}_v5.json data/det_${T}_v6.json
python3 src/catalog.py  data/stack_${T}_2025.npz data/det_${T}_v6.json atlas/${T} ${T}
echo DONE $T
