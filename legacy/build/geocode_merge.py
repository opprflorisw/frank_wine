#!/usr/bin/env python3
"""Geocode curated towns via geo.api.gouv.fr, project to SVG space, merge wine data."""
import json, time, urllib.parse, urllib.request, os

GEO = json.load(open("data/geometry.json", encoding="utf-8"))
P = GEO["proj"]

def project(lon, lat):
    x = (lon * P["coslat"] - P["minx"]) * P["scale"] + P["pad"]
    y = ((-lat) - P["miny"]) * P["scale"] + P["pad"]
    return round(x, 1), round(y, 1)

# region display-name -> (geometry id, dept codes for geocode disambiguation)
RMAP = {
    "Bordeaux":              ("bordeaux",   ["33"]),
    "Sud-Ouest":             ("sudouest",   ["24","46","47","82","32","81","12","64","65","40","09"]),
    "Bourgogne":             ("bourgogne",  ["21","71","89"]),
    "Beaujolais":            ("beaujolais", ["69","71"]),
    "Champagne":             ("champagne",  ["51","10","52","02"]),
    "Vallée du Rhône":       ("rhone",      ["26","84","07","30","69"]),
    "Vallée de la Loire":    ("loire",      ["44","49","37","41","18","58","72","86","45"]),
    "Alsace":                ("alsace",     ["67","68"]),
    "Languedoc-Roussillon":  ("languedoc",  ["34","11","66","30"]),
    "Provence":              ("provence",   ["83","13","06","84"]),
    "Jura":                  ("jura",       ["39"]),
    "Savoie":                ("savoie",     ["73","74"]),
    "Corse":                 ("corse",      ["2A","2B"]),
}

CACHE_PATH = "data/geocache.json"
cache = json.load(open(CACHE_PATH, encoding="utf-8")) if os.path.exists(CACHE_PATH) else {}

def geocode(name, depts):
    key = name + "|" + ",".join(depts)
    if key in cache:
        return cache[key]
    base = "https://geo.api.gouv.fr/communes"
    def query(params):
        url = base + "?" + urllib.parse.urlencode(params)
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                return json.load(r)
        except Exception as e:
            print("  ! http error", name, e); return []
    # 1) restricted to region departments, fuzzy name search, take best-scored
    res = query({"nom": name, "fields": "centre,codeDepartement,population", "boost": "population", "limit": "8"})
    pick = None
    in_depts = [c for c in res if c.get("codeDepartement") in depts]
    if in_depts:
        pick = in_depts[0]
    elif res:
        pick = res[0]
    out = None
    if pick and pick.get("centre"):
        lon, lat = pick["centre"]["coordinates"]
        x, y = project(lon, lat)
        out = {"x": x, "y": y, "commune": pick["nom"], "dep": pick.get("codeDepartement"), "lon": lon, "lat": lat}
    cache[key] = out
    time.sleep(0.05)
    return out

# Load all dossiers
groups = [
    "data/wine_raw/group_a_bordeaux_sudouest.json",
    "data/wine_raw/group_b_burgundy_beaujolais_jura_savoie.json",
    "data/wine_raw/group_c_champagne_alsace_loire.json",
    "data/wine_raw/group_d_rhone_provence_languedoc_corse.json",
]
regions = {}
missing = []
for gp in groups:
    for reg in json.load(open(gp, encoding="utf-8")):
        name = reg["region"]
        if name not in RMAP:
            print("UNMAPPED REGION:", name); continue
        rid, depts = RMAP[name]
        towns = []
        for t in reg.get("towns", []):
            g = geocode(t, depts)
            if g:
                towns.append({"name": t, "x": g["x"], "y": g["y"], "commune": g["commune"]})
            else:
                missing.append((name, t))
        regions[rid] = {
            "id": rid,
            "name": name,
            "summary": reg["summary"],
            "classification": reg["classification"],
            "subAppellations": reg["subAppellations"],
            "producers": reg["producers"],
            "towns": towns,
            "geo": {
                "path": GEO["regions"][rid]["path"],
                "bbox": GEO["regions"][rid]["bbox"],
                "centroid": GEO["regions"][rid]["centroid"],
            },
        }

json.dump(cache, open(CACHE_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=0)

out = {
    "proj": P,
    "viewBox": [0, 0, round(P["width"]), round(P["height"])],
    "france": GEO["france"],
    "regions": regions,
}
json.dump(out, open("data/wine.json", "w", encoding="utf-8"), ensure_ascii=False)

print("\n=== SUMMARY ===")
tot_t = tot_p = 0
for rid, r in regions.items():
    tot_t += len(r["towns"]); tot_p += len(r["producers"])
    print(f"{rid:11s} {r['name']:24s} towns={len(r['towns']):2d}/{len(r['towns'])+sum(1 for m in missing if m[0]==r['name'])}  producers={len(r['producers'])}")
print(f"\ntotal towns geocoded: {tot_t} | producers: {tot_p}")
if missing:
    print("MISSING (could not geocode):")
    for m in missing: print("  -", m[0], "/", m[1])
print("wine.json bytes:", len(open('data/wine.json',encoding='utf-8').read()))
