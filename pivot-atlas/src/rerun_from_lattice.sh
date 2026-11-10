#!/bin/sh
# usage: rerun_from_lattice.sh TILE [STRONG_SIGN]  — re-tier an existing raw detection and rebuild records
set -e
T=$1; export STRONG_SIGN=${2:-any}
python3 src/lattice.py  data/stack_${T}_2025.npz data/det_${T}_v4raw.json data/det_${T}_v4.json
python3 src/geomfit.py  data/stack_${T}_2025.npz data/det_${T}_v4.json data/det_${T}_v5.json
python3 src/finalize.py data/stack_${T}_2025.npz data/det_${T}_v5.json data/det_${T}_v6.json
rm -rf atlas/${T}; python3 src/catalog.py data/stack_${T}_2025.npz data/det_${T}_v6.json atlas/${T} ${T}
echo DONE $T
