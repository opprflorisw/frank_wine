#!/usr/bin/env python3
"""Build per-appellation map geometry for the detail panel.

For each region's curated sub-appellations, work out a real geographic *area*
on the map by:
  1. matching the appellation name to the INAO "Aires geographiques des AOC/AOP"
     dataset (data/inao_aires.csv) -> the list of member communes (INSEE codes);
  2. looking up each commune centroid (data/commune_ref.json, geo.api.gouv.fr);
  3. projecting to SVG space with the almanac projection params;
  4. taking the convex hull of the member-commune centroids (a clean translucent
     "area"), lightly buffered outward.

Appellations absent from the INAO list (Champagne sub-regions & grand-cru
villages, a couple of newer AOCs) fall back to curated commune sets or a single
commune disc, so EVERY appellation is shown.

Inputs  : data/almanac.json (proj + subAppellations), data/inao_aires.csv,
          data/commune_ref.json
Output  : data/appellations.json  -> { regionId: [ {name, tier, c, bbox, poly, n}, ... ] }
Run order: after build_almanac.py (for clean names), then re-run build_almanac.py
           to merge this file in.
"""
import csv, json, math, re, unicodedata, os

DATA = "data"

# ---------------------------------------------------------------- text repair
def fix(s):
    """Repair cp1252/latin-1 double-encoded UTF-8 mojibake (e.g. 'MÃ©doc'->'Médoc')."""
    s = str(s)
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

def norm(s):
    s = unicodedata.normalize("NFKD", fix(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def stripcru(s):
    s = re.sub(r"\(.*?\)", "", fix(s))
    s = norm(s)
    for w in ("grand cru", "premier cru", "1er cru"):
        s = s.replace(w, "")
    return re.sub(r"\s+", " ", s).strip()

# ---------------------------------------------------------------- load inputs
alm = json.load(open(f"{DATA}/almanac.json", encoding="utf-8"))
P = alm["proj"]

def project(lon, lat):
    x = (lon * P["coslat"] - P["minx"]) * P["scale"] + P["pad"]
    y = ((-lat) - P["miny"]) * P["scale"] + P["pad"]
    return [round(x, 1), round(y, 1)]

# commune reference: INSEE -> (lon,lat,dep) ; (normname,dep) -> INSEE
ref = json.load(open(f"{DATA}/commune_ref.json", encoding="utf-8"))
CENT = {}            # insee -> [lon,lat]
DEP = {}             # insee -> dept
NAME2INSEE = {}      # (normname, dep) -> insee
for c in ref:
    if not c.get("centre"):
        continue
    code = c["code"]; dep = c.get("codeDepartement", code[:2])
    CENT[code] = c["centre"]["coordinates"]
    DEP[code] = dep
    NAME2INSEE[(norm(c["nom"]), dep)] = code

# INAO appellation -> member communes
idx, toks = {}, {}
with open(f"{DATA}/inao_aires.csv", encoding="latin-1") as f:
    r = csv.reader(f, delimiter=";"); next(r)
    for row in r:
        if len(row) < 6:
            continue
        n = norm(row[4])
        if not n:
            continue
        idx.setdefault(n, set()).add(row[0])
        toks[n] = set(n.split())

# ---------------------------------------------------------------- region depts
RDEPTS = {
    "bordeaux": ["33"],
    "sudouest": ["24", "46", "47", "82", "32", "81", "12", "64", "65", "40", "09"],
    "bourgogne": ["21", "71", "89"],
    "beaujolais": ["69", "71"],
    "champagne": ["51", "10", "52", "02"],
    "rhone": ["26", "84", "07", "30", "69"],
    "loire": ["44", "49", "37", "41", "18", "58", "72", "86", "45"],
    "alsace": ["67", "68"],
    "languedoc": ["34", "11", "66", "30"],
    "provence": ["83", "13", "06", "84"],
    "jura": ["39"],
    "savoie": ["73", "74"],
    "corse": ["2A", "2B"],
}

# ---------------------------------------------------------------- name aliases
ALIAS = {
    "Pouilly-Fumé": "pouilly fume ou blanc fume de pouilly et pouilly sur loire",
    "Minervois-La Livinière": "la liviniere",
    "Corbières-Boutenac": "boutenac",
    "Chambertin / Clos de Bèze": "chambertin clos de beze",
    "Le Montrachet": "montrachet",
    "Moulis-en-Médoc": "moulis",
}

def match_inao(region, clean_name):
    """Return a set of member INSEE codes from INAO data, or None."""
    cands = []
    if clean_name in ALIAS:
        cands.append(ALIAS[clean_name])
    cands += [norm(clean_name), stripcru(clean_name)]
    b = stripcru(clean_name)
    if region == "savoie":
        cands += ["vin de savoie " + b, "roussette de savoie " + b]
    if region == "alsace":
        cands += ["alsace grand cru " + b]
    if region == "corse":
        bb = b.replace("vin de corse ", "")
        cands += ["vin de corse ou corse " + bb, bb]
    for c in cands:
        if c in idx:
            return idx[c]
    # token-superset fallback (INAO name contains all appellation tokens)
    st = set(b.split())
    best = None
    for n, tk in toks.items():
        if st and st <= tk:
            extra = len(tk - st)
            if best is None or extra < best[1]:
                best = (n, extra)
    if best and best[1] <= 3:
        return idx[best[0]]
    return None

# ---------------------------------------------------------------- curated sets
# Champagne grand-cru villages (single commune each) and informal sub-regions
# are NOT separate AOCs in the INAO list -> placed from commune names (dept 51/10).
CHAMP_GC = {
    "Aÿ (Grand Cru)": ["Aÿ-Champagne"],
    "Ambonnay (Grand Cru)": ["Ambonnay"],
    "Bouzy (Grand Cru)": ["Bouzy"],
    "Verzenay (Grand Cru)": ["Verzenay"],
    "Avize (Grand Cru)": ["Avize"],
    "Cramant (Grand Cru)": ["Cramant"],
    "Le Mesnil-sur-Oger (Grand Cru)": ["Le Mesnil-sur-Oger"],
    "Oger (Grand Cru)": ["Oger"],
}
CHAMP_SUB = {
    "Montagne de Reims": ["Verzenay", "Mailly-Champagne", "Verzy", "Rilly-la-Montagne",
                          "Bouzy", "Ambonnay", "Ludes", "Sillery"],
    "Côte des Blancs": ["Avize", "Cramant", "Oger", "Le Mesnil-sur-Oger",
                        "Vertus", "Cuis", "Chouilly"],
    "Vallée de la Marne": ["Aÿ-Champagne", "Hautvillers", "Damery", "Cumières",
                           "Châtillon-sur-Marne", "Dormans", "Verneuil"],
    "Côte des Bar (Aube)": ["Les Riceys", "Bar-sur-Seine", "Bar-sur-Aube",
                            "Essoyes", "Celles-sur-Ource", "Mussy-sur-Seine"],
    "Côte de Sézanne": ["Sézanne", "Vindey", "Barbonne-Fayel", "Broyes",
                        "Allemant", "Bethon"],
}
MANUAL = {
    ("savoie", "Crémant de Savoie"): ["Apremont", "Chignin", "Cruet", "Montmélian",
                                      "Jongieux", "Arbin"],
}
# direct lon/lat for villages missing from the current commune list (e.g. merged)
MANUAL_COORD = {
    "Oger (Grand Cru)": [4.0116, 48.9525],   # Oger, absorbed in the commune list
}

def communes_from_names(names, depts):
    out = []
    for nm in names:
        code = None
        for d in depts:
            code = NAME2INSEE.get((norm(nm), d))
            if code:
                break
        if code:
            out.append(code)
    return out

# ---------------------------------------------------------------- geometry
def convex_hull(pts):
    pts = sorted(set(map(tuple, pts)))
    if len(pts) <= 2:
        return [list(p) for p in pts]
    def cross(o, a, b):
        return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return [list(p) for p in (lower[:-1] + upper[:-1])]

def octagon(cx, cy, r):
    return [[round(cx + r*math.cos(math.radians(a)), 1),
             round(cy + r*math.sin(math.radians(a)), 1)] for a in range(0, 360, 45)]

def buffer_out(poly, d=3.0):
    """Push hull vertices outward from the centroid by ~d SVG units."""
    if len(poly) < 3:
        return poly
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    out = []
    for x, y in poly:
        dx, dy = x - cx, y - cy
        m = math.hypot(dx, dy) or 1
        out.append([round(x + dx/m*d, 1), round(y + dy/m*d, 1)])
    return out

def make_geom(insee_list, tier):
    pts = [project(*CENT[c]) for c in insee_list if c in CENT]
    if not pts:
        return None
    if len(pts) >= 3:
        poly = buffer_out(convex_hull(pts), 3.0)
    else:
        # single / double commune -> small disc around the mean point
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        poly = octagon(cx, cy, 6.0)
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    bx, by = min(xs), min(ys)
    bbox = [round(bx, 1), round(by, 1), round(max(xs)-bx, 1), round(max(ys)-by, 1)]
    cx = round(sum(xs)/len(xs), 1); cy = round(sum(ys)/len(ys), 1)
    return {"tier": tier, "c": [cx, cy], "bbox": bbox, "poly": poly, "n": len(pts)}

# ---------------------------------------------------------------- build
out = {}
stats = {"inao": 0, "commune": 0, "manual": 0, "miss": 0}
for rid, reg in alm["regions"].items():
    depts = RDEPTS.get(rid, [])
    items = []
    for raw in reg["subAppellations"]:
        name = fix(raw)
        geom = None; tier = None
        # 1) Champagne curated villages / sub-regions
        if name in CHAMP_GC:
            geom = make_geom(communes_from_names(CHAMP_GC[name], depts), "commune"); tier = "commune"
        elif name in CHAMP_SUB:
            geom = make_geom(communes_from_names(CHAMP_SUB[name], depts), "manual"); tier = "manual"
        elif (rid, name) in MANUAL:
            geom = make_geom(communes_from_names(MANUAL[(rid, name)], depts), "manual"); tier = "manual"
        else:
            # 2) INAO commune list, restricted to the region's departments
            ins = match_inao(rid, name)
            if ins:
                inreg = {c for c in ins if DEP.get(c) in depts}
                ins2 = inreg or ins
                geom = make_geom(list(ins2), "inao"); tier = "inao"
        if geom is None and name in MANUAL_COORD:
            pt = project(*MANUAL_COORD[name])
            poly = octagon(pt[0], pt[1], 6.0)
            xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
            geom = {"tier": "commune", "c": pt,
                    "bbox": [min(xs), min(ys), round(max(xs)-min(xs), 1), round(max(ys)-min(ys), 1)],
                    "poly": poly, "n": 1}
            tier = "commune"
        if geom is None:
            # 3) last resort: a single-commune disc from the appellation name
            code = None
            for d in depts:
                code = NAME2INSEE.get((stripcru(name), d)) or NAME2INSEE.get((norm(name), d))
                if code:
                    break
            if code:
                geom = make_geom([code], "commune"); tier = "commune"
        if geom is None:
            stats["miss"] += 1
            items.append({"name": name, "tier": "none", "c": None, "bbox": None, "poly": None, "n": 0})
            continue
        stats[tier] += 1
        geom["name"] = name
        items.append(geom)
    out[rid] = items

json.dump(out, open(f"{DATA}/appellations.json", "w", encoding="utf-8"), ensure_ascii=False)
total = sum(len(v) for v in out.values())
print("appellations:", total, "| by tier:", stats)
print("appellations.json bytes:", os.path.getsize(f"{DATA}/appellations.json"))
miss = [(rid, a["name"]) for rid, v in out.items() for a in v if a["tier"] == "none"]
if miss:
    print("STILL MISSING (no geometry):")
    for r, a in miss:
        print("   ", r, a)
