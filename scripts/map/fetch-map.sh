#!/usr/bin/env bash
# Builds the offline map package in public/map. Run once, before the storm,
# on a machine with internet. The hub never fetches any of this at runtime.
# See docs/SPEC.md 8.
#
#   scripts/map/fetch-map.sh <west,south,east,north> <hdx-adm4.geojson> <municipality>
#
#   bbox          The town's map_bbox setting, in degrees.
#   adm4 file     Philippines barangay boundaries (admin level 4) from HDX,
#                 downloaded by hand as GeoJSON. Check its licence first.
#   municipality  The town as the HDX file spells it, for example "Tacloban City".
#
# Needs the pmtiles CLI (github.com/protomaps/go-pmtiles) on PATH.
# BUILD=YYYYMMDD picks the Protomaps daily build; the default is yesterday.

set -euo pipefail

if [ $# -ne 3 ]; then
  sed -n '6,14p' "$0"
  exit 1
fi

bbox="$1"
adm4="$2"
town="$3"
out="public/map"
build="${BUILD:-$(date -v-1d +%Y%m%d 2>/dev/null || date -d yesterday +%Y%m%d)}"
assets="https://github.com/protomaps/basemaps-assets/archive/refs/heads/main.tar.gz"

command -v pmtiles >/dev/null || { echo "pmtiles CLI not found. Install it from github.com/protomaps/go-pmtiles."; exit 1; }
[ -f "$adm4" ] || { echo "No file at $adm4"; exit 1; }

mkdir -p "$out"

echo "Tiles: Protomaps build $build, bbox $bbox"
pmtiles extract "https://build.protomaps.com/$build.pmtiles" "$out/town.pmtiles" --bbox="$bbox" --maxzoom=15

echo "Glyphs and sprites: protomaps/basemaps-assets"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "$assets" | tar -xz -C "$tmp"
src="$tmp/basemaps-assets-main"
rm -rf "$out/fonts" "$out/sprites"
mkdir -p "$out/fonts" "$out/sprites/v4"
for font in "Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic"; do
  cp -R "$src/fonts/$font" "$out/fonts/"
done
cp "$src"/sprites/v4/light* "$out/sprites/v4/"

echo "Barangays: $town"
node scripts/map/cut-barangays.mjs "$adm4" "$town" "$out/barangays.geojson"

du -sh "$out"/*
echo "Done. Record the build date and the HDX licence in $out/README.md."
