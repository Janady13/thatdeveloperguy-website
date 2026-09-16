#!/bin/sh
# Builds the verified embedded it-services.riv plus the two contentless delivery variants. Run from rive/it-services.
set -e
export PATH=$HOME/.rive/bin:$PATH
python3 build-scene.py && rive . --verify && rive . --once
for m in ref2x ref4x; do
  d=$(mktemp -d); mkdir -p "$d"; printf 'name: it-services\nmain: ITServices\n' > "$d/rive.yaml"
  MODE=$m OUT="$d/scene.rml" python3 build-scene.py >/dev/null && rive "$d" --once | tail -1 && cp "$d/build/it-services.riv" "build/it-services-${m#ref}.riv"; rm -rf "$d"
done
ls -la build/it-services*.riv
