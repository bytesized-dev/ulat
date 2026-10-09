#!/usr/bin/env bash
# Builds the offline map package in public/map. Run once, before the storm,
# on a machine with internet. The hub never fetches any of this at runtime.
# See docs/SPEC.md 8 and public/map/README.md.
#
#   scripts/map/fetch-map.sh <west,south,east,north> <adm3 pcode>
#
#   bbox        Area to cut tiles for, in degrees. Pad the town a little.
#   adm3 pcode  The town's code in the HDX boundaries, for example PH0907201.
#
# Needs the pmtiles CLI (github.com/protomaps/go-pmtiles) on PATH, or PMTILES set to it.
# BUILD=YYYYMMDD picks the Protomaps daily build; the default is yesterday.
#
# Dapitan City:  scripts/map/fetch-map.sh 123.08,8.41,123.55,9.00 PH0907201

set -euo pipefail

if [ $# -ne 2 ]; then
  sed -n '6,14p' "$0"
  exit 1
fi

bbox="$1"
pcode="$2"
out="public/map"
pmtiles="${PMTILES:-pmtiles}"
build="${BUILD:-$(date -v-1d +%Y%m%d 2>/dev/null || date -d yesterday +%Y%m%d)}"

command -v "$pmtiles" >/dev/null || { echo "pmtiles CLI not found. Install it from github.com/protomaps/go-pmtiles."; exit 1; }
mkdir -p "$out"

echo "Tiles: Protomaps build $build, bbox $bbox"
"$pmtiles" extract "https://build.protomaps.com/$build.pmtiles" "$out/town.pmtiles" --bbox="$bbox" --maxzoom=15

echo "Glyphs and sprites: protomaps/basemaps-assets"
node scripts/map/basemap-assets.mjs

echo "Barangays: HDX $pcode"
node scripts/map/hdx-barangays.mjs "$pcode" "$out/barangays.geojson"

du -sh "$out"/*
echo "Done. Update the dates in $out/README.md."
