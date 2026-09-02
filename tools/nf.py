"""National forest boundaries (take 174 · A186 · Camp mode).

Michigan has three: Ottawa, Hiawatha, Huron-Manistee. The USFS Enterprise
Data Warehouse serves the administrative boundaries as an ArcGIS layer; this
fetches the three by name, generalised to ~60 m so the polygons are a few
hundred KB rather than tens of MB, and writes nf.json as GeoJSON for the
bundle. A camper's question is "am I on national forest land, where
dispersed camping is allowed" — the outline is the answer, and it only has
to be right to the width of a two-track.

Host: apps.fs.usda.gov, declared in manifest.py and PROVISION.md. Cached so
a rebuild does not re-fetch.
"""
import json, os, sys, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from region import R

URL = ("https://apps.fs.usda.gov/arcx/rest/services/EDW/"
       "EDW_ForestSystemBoundaries_01/MapServer/0/query")
NAMES = ["Ottawa National Forest", "Hiawatha National Forest",
         "Huron-Manistee National Forest"]
CACHE = "nf_cache.json"


def fetch():
    if os.path.exists(CACHE):
        return json.load(open(CACHE))
    where = " OR ".join(f"FORESTNAME='{n}'" for n in NAMES)
    q = urllib.parse.urlencode({
        "where": where, "outFields": "FORESTNAME", "returnGeometry": "true",
        "outSR": "4326", "maxAllowableOffset": "0.0006", "f": "geojson"})
    req = urllib.request.Request(URL + "?" + q, headers={"User-Agent": "Mozilla/5.0"})
    data = json.loads(urllib.request.urlopen(req, timeout=120).read())
    json.dump(data, open(CACHE, "w"))
    return data


def main():
    data = fetch()
    feats = []
    for f in data.get("features", []):
        nm = (f.get("properties") or {}).get("FORESTNAME") or (f.get("properties") or {}).get("forestname")
        if not nm or not f.get("geometry"):
            continue
        feats.append({"type": "Feature", "properties": {"n": nm.replace(" National Forest", "")},
                      "geometry": f["geometry"]})
    out = {"type": "FeatureCollection", "features": feats}
    json.dump(out, open("nf.json", "w"), separators=(",", ":"))
    kb = os.path.getsize("nf.json") / 1024
    print(f"nf: {len(feats)} national forest(s) — {', '.join(x['properties']['n'] for x in feats)} · {kb:.0f} KB")
    if len(feats) != 3:
        print("nf: expected 3 Michigan forests — check the query", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
