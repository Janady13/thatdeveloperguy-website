#!/bin/sh
# Builds the verified embedded lobby.riv plus the two contentless delivery variants. Run from rive/lobby.
set -e
export PATH=$HOME/.rive/bin:$PATH
python3 build-scene.py && rive . --verify && rive . --once
for m in ref2x ref4x; do
  d=$(mktemp -d); mkdir -p "$d"; printf 'name: lobby\nmain: Lobby\n' > "$d/rive.yaml"
  MODE=$m OUT="$d/scene.rml" python3 build-scene.py >/dev/null && rive "$d" --once | tail -1 && cp "$d/build/lobby.riv" "build/lobby-${m#ref}.riv"; rm -rf "$d"
done
ls -la build/lobby*.riv
