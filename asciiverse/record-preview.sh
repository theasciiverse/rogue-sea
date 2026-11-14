#!/bin/sh
# Records the catalog preview, asciiverse/rogue-sea.cast, at 100x30 with
# hub's castrec.py: the title page, the welcome of --seed 3, and sailing
# the first sea in search of coconuts. Run from the repo root after building.
set -eu
CASTREC=${CASTREC:-../hub/tools/castrec.py}
state=$(mktemp -d)
trap 'rm -rf "$state"' EXIT
S="w4;kenter;w7;kesc;w6;kenter;w3;kenter;w3"
MOVES="k k k k l l l l k k k k h h h h k k k k k l l l l k k k k"
for k in $MOVES; do S="$S;k$k;w0.5"; done
S="$S;w2"
XDG_STATE_HOME="$state" python3 "$CASTREC" "${1:-asciiverse/rogue-sea.cast}" . "$S" -- ./out/rogue-sea --seed 3
