#!/usr/bin/env python3
"""Merge wine.json + varietals.json + context.json -> data/almanac.json (master dataset).

Also (a) repairs cp1252/latin-1 double-encoded UTF-8 mojibake that crept into the
source data (e.g. 'MÃ©doc' -> 'Médoc'), and (b) merges per-appellation map geometry
from data/appellations.json (produced by build_appellations.py) into each region.
"""
import json, os
from collections import Counter


def _fix(s):
    """Repair double-encoded UTF-8 mojibake. Clean strings are returned unchanged."""
    for _ in range(3):
        t = None
        for enc in ("cp1252", "latin-1"):
            try:
                t = s.encode(enc).decode("utf-8"); break
            except Exception:
                continue
        if t is None or t == s:
            break
        s = t
        if "Ã" not in s and "Â" not in s and "�" not in s:
            break
    return s


def repair(obj):
    """Deep-walk: repair every string value in a nested dict/list structure."""
    if isinstance(obj, str):
        return _fix(obj)
    if isinstance(obj, list):
        return [repair(x) for x in obj]
    if isinstance(obj, dict):
        return {k: repair(v) for k, v in obj.items()}
    return obj


wine = json.load(open("data/wine.json", encoding="utf-8"))
varietals = json.load(open("data/varietals.json", encoding="utf-8"))
context = json.load(open("data/context.json", encoding="utf-8"))
climate = json.load(open("data/climate.json", encoding="utf-8")) if os.path.exists("data/climate.json") else {}
trips = json.load(open("data/trips.json", encoding="utf-8")) if os.path.exists("data/trips.json") else {}
appellations = json.load(open("data/appellations.json", encoding="utf-8")) if os.path.exists("data/appellations.json") else {}

unmatched = []
for rid, r in wine["regions"].items():
    vlist = varietals.get(r["name"], [])
    vmap = {v["name"]: v for v in vlist}
    rtypes, rgrapes = Counter(), Counter()
    for p in r["producers"]:
        v = vmap.get(p["name"])
        if not v:
            # try loose match (strip spaces/case)
            key = p["name"].lower().replace(" ", "")
            v = next((vv for vv in vlist if vv["name"].lower().replace(" ", "") == key), None)
        if v:
            p["types"] = v["types"]; p["grapes"] = v["grapes"]; p["flagship"] = v.get("flagship", "")
            for t in v["types"]: rtypes[t] += 1
            for g in v["grapes"]: rgrapes[g] += 1
        else:
            p["types"] = []; p["grapes"] = []; p["flagship"] = ""
            unmatched.append((r["name"], p["name"]))
    # region aggregates ordered by frequency
    TYPE_ORDER = ["Red", "White", "Rosé", "Sparkling", "Sweet", "Fortified"]
    r["types"] = sorted(rtypes.keys(), key=lambda t: TYPE_ORDER.index(t) if t in TYPE_ORDER else 99)
    r["typeCounts"] = dict(rtypes)
    r["grapes"] = [g for g, _ in rgrapes.most_common()]
    r["grapeCounts"] = dict(rgrapes)
    # climate / visit scorecard
    cm = climate.get(r["name"])
    if cm:
        r["climate"] = cm["climate"]; r["profile"] = cm["profile"]
        r["terroirScore"] = cm["terroirScore"]; r["visitScore"] = cm["visitScore"]
        r["visit"] = cm["visit"]
        r["overallScore"] = round((cm["terroirScore"] + cm["visitScore"]) / 2, 1)
    # trips
    r["trips"] = trips.get(rid, [])
    # per-appellation map geometry (convex hulls etc. from build_appellations.py)
    r["appellations"] = appellations.get(rid, [])

almanac = {
    "viewBox": wine["viewBox"],
    "proj": wine["proj"],
    "france": wine["france"],
    "regions": wine["regions"],
    "context": context,
    "meta": {"title": "Frank's Wine Almanac"},
}
# repair mojibake across the whole dataset (numbers/coords untouched)
almanac = repair(almanac)
json.dump(almanac, open("data/almanac.json", "w", encoding="utf-8"), ensure_ascii=False)
# write the app's data file directly (run from build/ -> writes into ../assets/)
with open("../assets/almanac-data.js", "w", encoding="utf-8") as f:
    f.write("window.ALMANAC=" + open("data/almanac.json", encoding="utf-8").read() + ";")

# stats
nreg = len(wine["regions"])
nh = sum(len(r["producers"]) for r in wine["regions"].values())
nt = sum(len(r["towns"]) for r in wine["regions"].values())
allgrapes = set()
for r in wine["regions"].values(): allgrapes |= set(r["grapes"])
ntrips = sum(len(r.get("trips", [])) for r in wine["regions"].values())
print(f"regions={nreg} houses={nh} villages={nt} distinct grapes={len(allgrapes)} trips={ntrips}")
print("unmatched houses (no varietal):", len(unmatched))
for u in unmatched: print("  -", u[0], "/", u[1])
print("almanac.json bytes:", len(open("data/almanac.json", encoding="utf-8").read()))
