#!/usr/bin/env python3
"""Project France department GeoJSON -> SVG paths, dissolve into wine regions.

Outputs geometry.json with:
  - proj: projection params (so towns can be projected identically later)
  - france: full metropolitan outline path (string)
  - regions: { id: {name, path, bbox:[x,y,w,h], centroid:[x,y], depts:[...]} }
"""
import json, math
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

DEPTS = json.load(open("data/departements.geojson", encoding="utf-8"))

# --- Wine region -> department codes (a partition; each dept -> one region) ---
REGIONS = {
    "bordeaux":   {"name": "Bordeaux",                "depts": ["33"]},
    "sudouest":   {"name": "Sud-Ouest",              "depts": ["24","46","47","82","32","81","12","64","65","40","09"]},
    "bourgogne":  {"name": "Bourgogne",              "depts": ["21","71","89"]},
    "beaujolais": {"name": "Beaujolais",             "depts": ["69"]},
    "champagne":  {"name": "Champagne",              "depts": ["51","10","52","02"]},
    "rhone":      {"name": "Vallée du Rhône",        "depts": ["26","84","07","30"]},
    "loire":      {"name": "Vallée de la Loire",     "depts": ["44","49","37","41","18","58","72","86"]},
    "alsace":     {"name": "Alsace",                 "depts": ["67","68"]},
    "languedoc":  {"name": "Languedoc-Roussillon",   "depts": ["34","11","66"]},
    "provence":   {"name": "Provence",               "depts": ["83","13","06"]},
    "jura":       {"name": "Jura",                   "depts": ["39"]},
    "savoie":     {"name": "Savoie",                 "depts": ["73","74"]},
    "corse":      {"name": "Corse",                  "depts": ["2A","2B"]},
}

# --- Projection: equirectangular with latitude correction, fit to width W ---
LAT0 = 46.6
COSLAT = math.cos(math.radians(LAT0))
W = 1000.0  # target width in SVG units

# First pass: gather all coords to compute bounds in projected space
def raw_xy(lon, lat):
    return (lon * COSLAT, -lat)

feats = {f["properties"]["code"]: f for f in DEPTS["features"]}
minx = miny = 1e9
maxx = maxy = -1e9

def iter_coords(geom):
    gj = mapping(geom)
    def walk(c):
        if isinstance(c[0], (int, float)):
            yield c
        else:
            for x in c:
                yield from walk(x)
    yield from walk(gj["coordinates"])

for f in DEPTS["features"]:
    for lon, lat in iter_coords(shape(f["geometry"])):
        x, y = raw_xy(lon, lat)
        minx, maxx = min(minx, x), max(maxx, x)
        miny, maxy = min(miny, y), max(maxy, y)

scale = W / (maxx - minx)
H = (maxy - miny) * scale
PAD = 20.0

def project(lon, lat):
    x, y = raw_xy(lon, lat)
    return ((x - minx) * scale + PAD, (y - miny) * scale + PAD)

PROJ = {"lat0": LAT0, "coslat": COSLAT, "minx": minx, "miny": miny,
        "scale": scale, "pad": PAD, "width": W + 2*PAD, "height": H + 2*PAD}

def geom_to_path(geom, decimals=1):
    """Convert a (Multi)Polygon to an SVG path string in projected space."""
    gj = mapping(geom)
    t = gj["type"]
    polys = gj["coordinates"] if t == "MultiPolygon" else [gj["coordinates"]]
    out = []
    for poly in polys:
        for ring in poly:
            pts = []
            for lon, lat in ring:
                x, y = project(lon, lat)
                pts.append(f"{round(x,decimals)},{round(y,decimals)}")
            if pts:
                out.append("M" + "L".join(pts) + "Z")
    return "".join(out)

# Build region geometries
regions_out = {}
for rid, meta in REGIONS.items():
    geoms = [shape(feats[c]["geometry"]) for c in meta["depts"] if c in feats]
    merged = unary_union(geoms)
    # simplify a touch to shrink file (tolerance in degrees)
    merged_s = merged.simplify(0.01, preserve_topology=True)
    path = geom_to_path(merged_s)
    # bbox in projected space
    xs, ys = [], []
    for lon, lat in iter_coords(merged_s):
        x, y = project(lon, lat)
        xs.append(x); ys.append(y)
    bx, by = min(xs), min(ys)
    bw, bh = max(xs)-bx, max(ys)-by
    c = merged_s.representative_point()
    cx, cy = project(c.x, c.y)
    regions_out[rid] = {
        "name": meta["name"],
        "depts": meta["depts"],
        "path": path,
        "bbox": [round(bx,1), round(by,1), round(bw,1), round(bh,1)],
        "centroid": [round(cx,1), round(cy,1)],
    }

# Full France outline (all depts dissolved) for base layer
france = unary_union([shape(f["geometry"]) for f in DEPTS["features"]]).simplify(0.01, preserve_topology=True)
france_path = geom_to_path(france)

# Per-department light paths (for base/context under regions)
depts_out = {}
for code, f in feats.items():
    g = shape(f["geometry"]).simplify(0.01, preserve_topology=True)
    depts_out[code] = {"nom": f["properties"]["nom"], "path": geom_to_path(g)}

out = {"proj": PROJ, "france": france_path, "regions": regions_out, "depts": depts_out}
json.dump(out, open("data/geometry.json", "w", encoding="utf-8"), ensure_ascii=False)
print("viewBox: 0 0 %.0f %.0f" % (PROJ["width"], PROJ["height"]))
print("regions:", len(regions_out), "| depts:", len(depts_out))
print("geometry.json bytes:", len(open("data/geometry.json",encoding="utf-8").read()))
