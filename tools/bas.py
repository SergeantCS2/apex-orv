#!/usr/bin/env python3
"""take 151 · A169 (first external tester, Rifle River report): the DNR's
Michigan Boating Access Sites layer — 1,332 state-sponsored sites, on the
services3.arcgis.com host PROVISION already declares. OSM held TWO named
accesses on the Rifle's 60.8 mapped miles; the DNR holds seven. Merged
into poi launches and corridor accesses downstream.

Honest limit, recorded where it is load-bearing: this is STATE-sponsored
sites. County and township ramps (the tester's Rifle High Banks is one)
are in neither OSM nor this layer; those need OSM contribution or a
county source we have not found yet."""
import json, os, sys, urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from osm_local import region

RID, R = region()
W, S, E, N = R["bbox"]

BASE = ("https://services3.arcgis.com/Jdnp1TjADvSDxMAX/arcgis/rest/services/"
        "DNR_State_Sponsored_Developed_Boating_Access_Sites_Public_View/"
        "FeatureServer/0/query")


def page(offset):
    q = (f"{BASE}?where=1%3D1&outFields=name,waterbody,WaterbodyType,"
         f"Latitude,Longitude&returnGeometry=false&orderByFields=OBJECTID"
         f"&resultOffset={offset}&resultRecordCount=1000&f=json")
    return json.loads(urllib.request.urlopen(q, timeout=90).read())


def main():
    print("bas: DNR boating access sites (state-sponsored)")
    out, offset = [], 0
    while True:
        d = page(offset)
        fs = d.get("features", [])
        for ft in fs:
            a = ft["attributes"]
            lon, lat = a.get("Longitude"), a.get("Latitude")
            nm = (a.get("name") or "").strip()
            if not nm or lon is None or lat is None:
                continue
            if not (W <= lon <= E and S <= lat <= N):
                continue
            out.append({"n": nm, "w": (a.get("waterbody") or "").strip() or None,
                        "p": [round(lon, 5), round(lat, 5)]})
        if len(fs) < 1000:
            break
        offset += 1000
    json.dump({"b": out}, open("bas_payload.json", "w"))
    print(f"bas: {len(out)} sites in the box, "
          f"{os.path.getsize('bas_payload.json')//1024} KB")


if __name__ == "__main__":
    main()
