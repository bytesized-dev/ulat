# Offline map package: Dapitan City

Everything the map needs, served by the hub. Nothing here is fetched from the internet at runtime. Rebuild with `scripts/map/fetch-map.sh 123.08,8.41,123.55,9.00 PH0907201`.

| File | Source | As of | Licence |
|---|---|---|---|
| `town.pmtiles` | Protomaps daily build `20261008`, basemap v4, cut to 123.08,8.41,123.55,9.00, zoom 0 to 15 | OpenStreetMap data of 8 Oct 2026 | ODbL 1.0. Show "© OpenStreetMap contributors" on the map |
| `fonts/` | Noto Sans Regular, Medium and Italic glyphs from protomaps/basemaps-assets | 9 Oct 2026 | SIL Open Font License 1.1, see `fonts/OFL.txt` |
| `sprites/v4/light*` | Protomaps basemap icons from protomaps/basemaps-assets | 9 Oct 2026 | MIT, derived from tangrams/icons |
| `barangays.geojson` | HDX Philippines Subnational Administrative Boundaries (COD-AB, PSA and NAMRIA), admin level 4, `adm3_pcode` PH0907201, simplified to about 5 m | Valid from 13 Feb 2025 | CC BY-IGO. Credit OCHA, PSA and NAMRIA |

## Dapitan City

- 50 barangays. Each feature has `name` and `pcode`.
- Barangay bbox: 123.21778, 8.41450, 123.51530, 8.86022 (west, south, east, north).
- City center from OpenStreetMap: 8.65494, 123.42438.
- OpenStreetMap itself only has 4 of the 50 barangay boundaries, which is why the boundaries come from HDX.

## Sizes

About 3.5 MB of tiles, 13 MB of glyphs in 768 small files, 60 KB of sprites and 90 KB of boundaries.
