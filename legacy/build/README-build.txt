FRANK'S WINE ALMANAC — BUILD PIPELINE
=====================================

You do NOT need anything in this folder to use or share the app.
Open ../index.html to use it. This folder only documents how the data was
generated, so it can be regenerated or audited.

REQUIREMENTS
  Python 3 with: shapely   (pip install shapely; needed by build_geometry.py only —
                            build_appellations.py & build_almanac.py use the stdlib)
  Internet access (only for re-fetching boundaries / geocoding).

PIPELINE (run from inside this build/ folder, in order)
  1. python build_geometry.py   France department GeoJSON -> projected, dissolved
                                 13 region SVG paths            -> data/geometry.json
  2. python geocode_merge.py     geocodes villages (geo.api.gouv.fr), merges wine
                                 data                            -> data/wine.json
  3. python build_context.py     greyed neighbours + cities + autoroutes + wine
                                 routes                          -> data/context.json
  4. python build_trips.py       geocodes trip stops             -> data/trips.json
  5. python build_appellations.py  per-appellation map AREAS: matches each curated
                                 sub-appellation to the INAO "Aires geographiques des
                                 AOC/AOP" commune list (data/inao_aires.csv), looks up
                                 commune centroids (data/commune_ref.json), projects to
                                 SVG and takes the convex hull -> data/appellations.json
                                 (Champagne grand-cru villages / sub-regions & a couple
                                 of newer AOCs use curated commune sets.)
  6. python build_almanac.py     merges everything (incl. data/varietals.json,
                                 data/climate.json, data/appellations.json), repairs
                                 any cp1252 mojibake in the source text, and writes
                                 data/almanac.json AND ../assets/almanac-data.js
                                 (the file the app loads)

  After a data change you normally only need step 6 (it re-reads the JSON inputs
  and rewrites ../assets/almanac-data.js). Steps 1-5 hit the network; step 5 also
  needs steps run once for clean names (run 6, then 5, then 6 to bootstrap).

VERIFY
  node ../verify_map.js   headless smoke test (region -> appellation area ->
                          village -> house views); expects 0 console errors.

SOURCE DATA (data/)
  *.geojson            raw French geography (Natural Earth, france-geojson)
  wine_raw/            per-region producer dossiers (curated, web-verified)
  varietals.json       per-house grapes / wine types / flagship
  climate.json         per-region climate + visit scorecard data
  trips_raw/           per-region curated trip itineraries
  geocache.json        cached geocoding results (so re-runs are fast / offline)
  inao_aires.csv       INAO "Aires geographiques des AOC/AOP" (data.gouv.fr, Lic.
                       Ouverte 2.0) — commune <-> appellation membership
  commune_ref.json     all French commune centroids (geo.api.gouv.fr) — INSEE -> lon/lat
  appellations.json    built per-appellation map areas (convex hulls)
  *.json               intermediate + final built datasets
