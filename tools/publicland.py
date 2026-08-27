#!/usr/bin/env python3
"""DNR public land (take 132). Transcribed from Jacob's onX Hunt screens: the
public-land wash and boundary is the layer a hunter reads first.

Source: `DNRLOTSParcelsOPENDATA` layer 2, "Managed Lands" — 136,026 parcels
the DNR manages, each with a ProjectUseType (Forests, Wildlife Game Areas,
State Parks, Boating Access Site, …) and a ProjectName (the management unit
or the game area). Most parcels are 40-acre PLSS squares; shipped raw they
would be 136k polygons with a hairline seam between every pair. They are
DISSOLVED here per project with shapely and simplified to ~10 m, which gives
a few thousand tracts a phone can draw.

Layer 13 ("Project Boundary") was ruled out: those are Forest Management
Unit outlines — 360,000-acre administrative boxes that include private land
— not ownership.

Private parcels with owner names (onX's other half) are county GIS and not a
free statewide layer; stated, not faked. Host services3.arcgis.com is already
declared in manifest.py (scramble areas).
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "publicland_payload.json")
BASE = ("https://services3.arcgis.com/Jdnp1TjADvSDxMAX/arcgis/rest/services/"
        "DNRLOTSParcelsOPENDATA/FeatureServer/2")
CACHE = os.path.join(ROOT, "auth_cache", "dnr_managed_lands_L2.json")
UA = {"User-Agent": "APEX-Offroad/1.0 (SergeantCS2 on GitHub, repo apex)"}
PAGE = 1000   # the server's maxRecordCount; 2000 silently returned one page
# the service's actual strings (read at take 132, not guessed)
TYPES = {
    "Forests": "forest", "National Forest": "forest",
    "Wildlife Game Areas": "game",
    "State Park": "park", "Recreational Areas": "park",
    "Boating Access Site": "launch", "Public Water Access Site": "launch",
    "RAIL TRAILS": "trail",
}
SKIP = {"Undedicated", "Field Adminstration", "Military", "Right of Way Properties", ""}


def _get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except Exception:
            time.sleep(3 * (i + 1))
    return None


def fetch():
    if os.path.exists(CACHE):
        try:
            return json.load(open(CACHE))
        except Exception:
            pass
    q = urllib.parse.urlencode({"where": "1=1", "returnCountOnly": "true", "f": "json"})
    total = (_get(f"{BASE}/query?{q}") or {}).get("count")
    feats, off = [], 0
    while True:
        q = urllib.parse.urlencode({
            "where": "1=1", "outFields": "ProjectUseType,ProjectName,Acreage",
            "returnGeometry": "true", "outSR": 4326, "geometryPrecision": 5,
            "resultOffset": off, "resultRecordCount": PAGE, "f": "geojson"})
        d = _get(f"{BASE}/query?{q}")
        if d is None:
            sys.exit(f"publicland: page at offset {off} failed four times — refusing a partial layer")
        got = d.get("features", [])
        feats.extend(got)
        print(f"  {len(feats):,} parcels…", flush=True)
        if len(got) < PAGE:
            break
        off += PAGE
    if total is not None and len(feats) != total:
        print(f"!! publicland: server reports {total}, got {len(feats)} (landmine 72)")
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(feats, open(CACHE + ".part", "w"))
    os.replace(CACHE + ".part", CACHE)
    return feats


def main():
    from shapely.geometry import shape, mapping
    from shapely.ops import unary_union
    feats = fetch()
    print(f"publicland: {len(feats):,} DNR-managed parcels")
    groups = {}
    for f in feats:
        p = f.get("properties") or {}
        ut = (p.get("ProjectUseType") or "").strip()
        if ut in SKIP:
            continue
        t = TYPES.get(ut, "other")
        n = (p.get("ProjectName") or "").strip().title()
        if not n or f.get("geometry") is None:
            continue
        groups.setdefault((t, n), []).append(f)
    out, kept_ac = [], 0.0
    for (t, n), fs in groups.items():
        try:
            geoms = [shape(f["geometry"]).buffer(0) for f in fs]
            u = unary_union(geoms).simplify(0.0001, preserve_topology=True)
        except Exception as e:
            print(f"  !! {n}: union failed ({e}); skipped")
            continue
        ac = sum((f["properties"].get("Acreage") or 0) for f in fs)
        polys = list(u.geoms) if u.geom_type == "MultiPolygon" else [u]
        rings = []
        for poly in polys:
            if poly.area * 111320 * 111320 * 0.72 < 8094:   # < 2 acres: a sliver
                continue
            rings.append([[round(x, 5), round(y, 5)] for x, y in poly.exterior.coords])
        if not rings:
            continue
        out.append({"n": n, "t": t, "ac": int(round(ac)), "g": rings})
        kept_ac += ac
    out.sort(key=lambda a: -a["ac"])
    if not out:
        print("publicland: nothing — artifact absent")
        if os.path.exists(OUT):
            os.remove(OUT)
        return
    blob = json.dumps({"bbox": list(R.bbox), "a": out}, separators=(",", ":"))
    open(OUT, "w").write(blob)
    by = {}
    for a in out:
        by[a["t"]] = by.get(a["t"], 0) + 1
    print(f"publicland: {len(out)} tracts from {len(feats):,} parcels, "
          f"{kept_ac / 1e6:.2f}M acres, {len(blob) // 1024} KB — "
          + ", ".join(f"{k} {v}" for k, v in sorted(by.items())))
    print("  largest: " + " · ".join(f"{a['n']} {a['ac']:,} ac" for a in out[:4]))


if __name__ == "__main__":
    main()
