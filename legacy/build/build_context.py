#!/usr/bin/env python3
"""Build map-context layer: greyed neighbours, major cities, autoroutes, wine routes.
All projected into the same SVG space as data/geometry.json. Writes data/context.json."""
import json, time, urllib.parse, urllib.request, os
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union

GEO = json.load(open("data/geometry.json", encoding="utf-8"))
P = GEO["proj"]; W = P["width"]; H = P["height"]

def project(lon, lat):
    x = (lon * P["coslat"] - P["minx"]) * P["scale"] + P["pad"]
    y = ((-lat) - P["miny"]) * P["scale"] + P["pad"]
    return x, y

def iter_coords(geom):
    def walk(c):
        if isinstance(c[0], (int, float)): yield c
        else:
            for x in c: yield from walk(x)
    yield from walk(mapping(geom)["coordinates"])

def geom_to_path(geom, dec=1):
    gj = mapping(geom); t = gj["type"]
    polys = gj["coordinates"] if t == "MultiPolygon" else [gj["coordinates"]]
    out = []
    for poly in polys:
        for ring in poly:
            pts = [f"{round(project(lo,la)[0],dec)},{round(project(lo,la)[1],dec)}" for lo,la in ring]
            if pts: out.append("M"+"L".join(pts)+"Z")
    return "".join(out)

# ---------- 1) Neighbour countries (greyed), clipped to a margin around France ----------
NE = json.load(open("data/ne_countries.geojson", encoding="utf-8"))
NEIGH = {"Spain","Italy","Switzerland","Germany","Belgium","Luxembourg","Netherlands","United Kingdom","Andorra","Monaco"}
# clip box in lon/lat roughly covering the view + a margin (France approx lon -6..10, lat 40..52)
clip_ll = box(-7.5, 39.5, 11.5, 52.5)
neighbours = []
for f in NE["features"]:
    nm = f["properties"].get("NAME")
    if nm in NEIGH:
        g = shape(f["geometry"]).intersection(clip_ll)
        if g.is_empty: continue
        g = g.simplify(0.02, preserve_topology=True)
        neighbours.append({"name": nm, "path": geom_to_path(g)})
print("neighbours:", [n["name"] for n in neighbours])

# ---------- geocode helper ----------
CACHE_PATH = "data/geocache.json"
cache = json.load(open(CACHE_PATH, encoding="utf-8")) if os.path.exists(CACHE_PATH) else {}
def geocode(name, dep=None):
    key = "CITY|"+name+("|"+dep if dep else "")
    if key in cache: return cache[key]
    params = {"nom": name, "fields": "centre,population,codeDepartement", "boost": "population", "limit": "5"}
    url = "https://geo.api.gouv.fr/communes?" + urllib.parse.urlencode(params)
    out = None
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            res = json.load(r)
        pick = None
        if dep: pick = next((c for c in res if c.get("codeDepartement")==dep), None)
        if not pick and res: pick = res[0]
        if pick and pick.get("centre"):
            lo,la = pick["centre"]["coordinates"]; x,y = project(lo,la)
            out = {"x": round(x,1), "y": round(y,1), "pop": pick.get("population",0), "lon":lo, "lat":la}
    except Exception as e:
        print("  ! geocode", name, e)
    cache[key] = out; time.sleep(0.05); return out

# ---------- 2) Major cities ----------
CITY_NAMES = ["Paris","Lyon","Marseille","Bordeaux","Toulouse","Nantes","Strasbourg","Lille","Nice",
 "Montpellier","Dijon","Reims","Tours","Clermont-Ferrand","Avignon","Perpignan","Besançon","Chambéry",
 "Grenoble","Valence","Orange","Nîmes","Narbonne","Béziers","Mulhouse","Colmar","Metz","Nancy","Angers",
 "Le Mans","Orléans","Beaune","Mâcon","Pau","Bayonne","Carcassonne","Annecy","Auxerre","Poitiers","Agen",
 "Millau","Bourg-en-Bresse","Albi","Cahors","Bergerac","Limoges","Rouen","Troyes"]
cities = {}
for nm in CITY_NAMES:
    g = geocode(nm)
    if g: cities[nm] = g
print("cities geocoded:", len(cities))

# ---------- 3) Autoroute corridors (schematic, via real city coordinates) ----------
CORRIDORS = {
 "A6":  ["Paris","Auxerre","Beaune","Mâcon","Lyon"],
 "A7":  ["Lyon","Valence","Orange","Avignon","Marseille"],
 "A9":  ["Orange","Nîmes","Montpellier","Béziers","Narbonne","Perpignan"],
 "A10": ["Paris","Orléans","Tours","Poitiers","Bordeaux"],
 "A62": ["Bordeaux","Agen","Toulouse"],
 "A61": ["Toulouse","Carcassonne","Narbonne"],
 "A75": ["Clermont-Ferrand","Millau","Béziers"],
 "A71": ["Orléans","Clermont-Ferrand"],
 "A31": ["Beaune","Dijon","Nancy","Metz"],
 "A35": ["Strasbourg","Colmar","Mulhouse"],
 "A36": ["Mulhouse","Besançon","Beaune"],
 "A11": ["Le Mans","Angers","Nantes"],
 "A64": ["Bayonne","Pau","Toulouse"],
 "A40": ["Mâcon","Bourg-en-Bresse","Annecy"],
 "A20": ["Limoges","Cahors","Toulouse"],
}
autoroutes = []
for code, seq in CORRIDORS.items():
    pts = [[cities[c]["x"], cities[c]["y"]] for c in seq if c in cities]
    if len(pts) >= 2: autoroutes.append({"code": code, "pts": pts})
print("autoroutes:", len(autoroutes))

# ---------- 4) Wine routes: greedy nearest-neighbour path through each region's villages ----------
WINE = json.load(open("data/wine.json", encoding="utf-8"))
def nn_route(towns):
    pts = [(t["x"], t["y"]) for t in towns]
    if len(pts) < 2: return []
    # start at northernmost (smallest y)
    start = min(range(len(pts)), key=lambda i: pts[i][1])
    used = [False]*len(pts); order = [start]; used[start] = True
    for _ in range(len(pts)-1):
        cur = order[-1]; best=None; bd=1e18
        for i,p in enumerate(pts):
            if used[i]: continue
            d = (p[0]-pts[cur][0])**2 + (p[1]-pts[cur][1])**2
            if d < bd: bd=d; best=i
        # avoid absurd long jumps (>region diagonal*0.6): stop the route
        order.append(best); used[best]=True
    return [[round(pts[i][0],1), round(pts[i][1],1)] for i in order]
wine_routes = {}
for rid, r in WINE["regions"].items():
    rt = nn_route(r["towns"])
    if rt: wine_routes[rid] = rt
print("wine routes:", len(wine_routes))

json.dump(cache, open(CACHE_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
out = {"neighbours": neighbours, "cities": cities, "autoroutes": autoroutes, "wineRoutes": wine_routes}
json.dump(out, open("data/context.json", "w", encoding="utf-8"), ensure_ascii=False)
print("context.json bytes:", len(open("data/context.json",encoding="utf-8").read()))
