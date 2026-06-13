#!/usr/bin/env python3
"""Geocode trip stops, project to SVG space, assemble data/trips.json keyed by region id."""
import json, os, time, urllib.parse, urllib.request, glob

GEO = json.load(open("data/geometry.json", encoding="utf-8"))
P = GEO["proj"]
def project(lon, lat):
    return (round((lon*P["coslat"]-P["minx"])*P["scale"]+P["pad"],1),
            round(((-lat)-P["miny"])*P["scale"]+P["pad"],1))

RMAP = {"Bordeaux":("bordeaux",["33"]),"Sud-Ouest":("sudouest",["24","46","47","82","32","81","12","64","65"]),
 "Bourgogne":("bourgogne",["21","71","89"]),"Beaujolais":("beaujolais",["69","71"]),
 "Champagne":("champagne",["51","10","52","02"]),"Vallée du Rhône":("rhone",["26","84","07","30","69","38","42"]),
 "Vallée de la Loire":("loire",["44","49","37","41","18","58","72","86","45"]),"Alsace":("alsace",["67","68"]),
 "Languedoc-Roussillon":("languedoc",["34","11","66","30"]),"Provence":("provence",["83","13","06","84"]),
 "Jura":("jura",["39"]),"Savoie":("savoie",["73","74"]),"Corse":("corse",["2A","2B"])}

CACHE="data/geocache.json"
cache=json.load(open(CACHE,encoding="utf-8")) if os.path.exists(CACHE) else {}
def geocode(name, depts):
    key="TRIP|"+name+"|"+",".join(depts)
    if key in cache: return cache[key]
    url="https://geo.api.gouv.fr/communes?"+urllib.parse.urlencode({"nom":name,"fields":"centre,codeDepartement","boost":"population","limit":"6"})
    out=None
    try:
        with urllib.request.urlopen(url,timeout=20) as r: res=json.load(r)
        pick=next((c for c in res if c.get("codeDepartement") in depts), None) or (res[0] if res else None)
        if pick and pick.get("centre"):
            lo,la=pick["centre"]["coordinates"]; x,y=project(lo,la)
            out={"x":x,"y":y,"commune":pick["nom"]}
    except Exception as e:
        print("  ! geocode",name,e)
    cache[key]=out; time.sleep(0.05); return out

trips={}  # region id -> list of trips
missing=[]
for fp in glob.glob("data/trips_raw/*.json"):
    data=json.load(open(fp,encoding="utf-8"))
    for region, tlist in data.items():
        rid,depts=RMAP[region]
        trips.setdefault(rid,[])
        for t in tlist:
            xs,ys=[],[]
            for s in t["stops"]:
                g=geocode(s["town"],depts)
                if g:
                    s["x"],s["y"],s["commune"]=g["x"],g["y"],g["commune"]; xs.append(g["x"]); ys.append(g["y"])
                else:
                    missing.append((region,s["town"]))
            if xs:
                bx,by=min(xs),min(ys); t["bbox"]=[bx,by,max(xs)-bx,max(ys)-by]
                # route through unique consecutive towns
                pts=[];
                for s in t["stops"]:
                    if "x" in s and (not pts or pts[-1]!=[s["x"],s["y"]]): pts.append([s["x"],s["y"]])
                t["route"]=pts
            trips[rid].append(t)

json.dump(cache,open(CACHE,"w",encoding="utf-8"),ensure_ascii=False,indent=0)
json.dump(trips,open("data/trips.json","w",encoding="utf-8"),ensure_ascii=False)
nt=sum(len(v) for v in trips.values()); ns=sum(len(t["stops"]) for v in trips.values() for t in v)
print(f"regions with trips: {len(trips)} | trips: {nt} | stops: {ns}")
if missing:
    print("MISSING geocode:")
    for m in missing: print("  -",m[0],"/",m[1])
print("trips.json bytes:", len(open("data/trips.json",encoding="utf-8").read()))
