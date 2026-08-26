#!/usr/bin/env python3
"""Open-riding AREAS — the DNR's designated ORV scramble areas, as polygons.

Take 119, Jacob's call at take 117: Silver Lake Dunes is not a trail network,
it is 450 acres of dune you may ride ANYWHERE on. Drawing it as trail lines
would be a lie of shape; the DNR draws it as an area and so do we.

Source (found at take 119): the DNR publishes `DNR ORV Scramble Areas` as its
own feature service on ArcGIS Online — separate from the DNRTrailsOPENDATA
MapServer every other DNR layer comes from, which is why 118 takes of
ingesting that service never saw a polygon. The trails service holds only the
two short ACCESS routes into Silver Lake (1.1 mi, both open, 72"), not the
perimeter. Eight areas statewide: Silver Lake ORV Area 447 ac (the DNR's
published "450"), St. Helen Motorsport Area 1,285, Holly Oaks 239, The Mounds
213, Black Mountain 64, Gladwin 20, Rock Climb Area 10 and Bull Gap Hill Climb
3. Jacob: draw every one — the small ones are how a rider finds the hill.

Not in this layer, deliberately: private motocross parks (Ogemaw Hills etc).
The DNR layer is DESIGNATED public riding ground; a private park is a
business, and it belongs in the POI pass with a category, not in a legal
riding-area layer (open question recorded at A140).

Cached to auth_cache/ and retried like every other agency read. Source total
is checked: the server's returnCountOnly must equal what we ship (AGENTS rule
7, landmine 76).
"""
import json
import os
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R

# NOT `from ingest import query`: ingest.py has no __main__ guard, so
# importing it RUNS the statewide ingest — 3.9 GB and the OOM killer at take
# 119's first attempt (landmine 201; osm_local.py reads ingest by AST for the
# same reason). Eight polygons do not need pagination; they do need the
# retry-and-cache manners every other agency read has.

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "areas_payload.json")

# Declared in manifest.py (PROTOCOL §8): a provisioning host nobody declared
# is a host the gate refuses.
SCRAMBLE = ("https://services3.arcgis.com/Jdnp1TjADvSDxMAX/arcgis/rest/"
            "services/DNR_ORV_Scramble_Areas/FeatureServer")
LAYER = 1
FIELDS = "OBJECTID,SCAName,Acres,Ownership"

# The service's own coded domain for Ownership, READ from the layer metadata
# at take 119 (not guessed — the first draft guessed and was wrong about 3).
# Unknown codes print as "DNR-listed".
OWNER = {0: "State", 1: "Federal", 2: "Private", 3: "County", 4: "Local",
         5: "Mixed ownership"}


UA = {"User-Agent": "APEX-Offroad/1.0 (offline trail map; contact via repo)"}


def query(base, layer, fields):
    """One cached, retried GeoJSON read. Statewide is 8 rows; no paging."""
    import time
    os.makedirs("auth_cache", exist_ok=True)
    ck = os.path.join("auth_cache", "dnr_orv_scramble_areas_L%d.json" % layer)
    if os.path.exists(ck):
        try:
            c = json.load(open(ck))
            if isinstance(c, list):
                return c
        except Exception:
            pass
    q = urllib.parse.urlencode({"where": "1=1", "outFields": fields,
                                "returnGeometry": "true", "outSR": 4326,
                                "f": "geojson"})
    rq = urllib.request.Request(f"{base}/{layer}/query?{q}", headers=UA)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(rq, timeout=120) as r:
                feats = json.load(r).get("features", [])
            json.dump(feats, open(ck, "w"))
            return feats
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))


def server_count():
    q = urllib.parse.urlencode({"where": "1=1", "returnCountOnly": "true",
                                "f": "json"})
    rq = urllib.request.Request(f"{SCRAMBLE}/{LAYER}/query?{q}", headers=UA)
    try:
        with urllib.request.urlopen(rq, timeout=60) as r:
            return json.load(r).get("count")
    except Exception as e:
        print(f"areas: could not read the server count ({e}) — shipping "
              "what the paged fetch returned, unverified")
        return None


def main():
    W, S, E, N = R.bbox
    feats = query(SCRAMBLE, LAYER, FIELDS)
    total = server_count()
    areas = []
    for f in feats:
        p = f.get("properties") or {}
        g = f.get("geometry") or {}
        nm = (p.get("SCAName") or "").strip()
        if not nm or g.get("type") not in ("Polygon", "MultiPolygon"):
            continue
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        rings = [[[round(x, 5), round(y, 5)] for x, y in ring]
                 for poly in polys for ring in poly]
        lon = sum(pt[0] for r in rings for pt in r) / sum(len(r) for r in rings)
        lat = sum(pt[1] for r in rings for pt in r) / sum(len(r) for r in rings)
        if not (W <= lon <= E and S <= lat <= N):
            continue
        areas.append({
            "n": nm,
            "ac": int(round(p.get("Acres") or 0)),
            "o": OWNER.get(p.get("Ownership"), "DNR-listed"),
            "c": [round(lon, 5), round(lat, 5)],
            "g": rings,
        })
    areas.sort(key=lambda a: -a["ac"])
    if total is not None and len(feats) != total:
        print(f"!! areas: server reports {total}, got {len(feats)} — "
              f"{total - len(feats)} MISSING (landmine 72)")
    if not areas:
        print("areas: no scramble area inside this region — artifact absent, "
              "not empty (landmine 74)")
        if os.path.exists(OUT):
            os.remove(OUT)
        return
    payload = {"bbox": [W, S, E, N], "a": areas}
    blob = json.dumps(payload, separators=(",", ":"))
    open(OUT, "w").write(blob)
    print(f"areas: {len(areas)} DNR scramble area(s) in region "
          f"(server total {total}), {len(blob) // 1024} KB")
    for a in areas:
        print(f"  {a['n']:32s} {a['ac']:5d} ac  {a['o']}")


if __name__ == "__main__":
    main()
