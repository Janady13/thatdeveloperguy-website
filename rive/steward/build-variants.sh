#!/bin/sh
# Builds the verified embedded steward.riv (assets/2x inside) plus the two contentless delivery variants. Run from rive/steward.
set -e
export PATH=$HOME/.rive/bin:$PATH
python3 build-rig.py && rive . --verify && rive . --once
for m in ref2x ref4x; do
  d=$(mktemp -d); mkdir -p "$d"; printf 'name: steward\nmain: Hero\n' > "$d/rive.yaml"
  MODE=$m OUT="$d/scene.rml" python3 build-rig.py >/dev/null && rive "$d" --once | tail -1 && cp "$d/build/steward.riv" "build/steward-${m#ref}.riv"; rm -rf "$d"
done
ls -la build/steward*.riv
