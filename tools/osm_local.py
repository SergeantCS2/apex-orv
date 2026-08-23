#!/usr/bin/env python3
"""Build aoi.json from a Geofabrik extract, for LOCAL work only.

Why this exists
---------------
Take 83 established that Overpass is reachable from GitHub Actions and NOT from
the container this project is developed in: Jacob's take-82 APK came back with
20,428 edges and a complete bundle while every local probe returned 0/24. Four
takes of release notes said "OpenStreetMap is down" and were wrong about his own
build (landmine 122).

That is a broken instrument, not a broken product — but it blocks any work that
has to be MEASURED against the OSM road network, which is most of A60. This
closes that hole without touching the pipeline: same output file, same shape,
same tag set as the Overpass query in ingest.py, from the sanctioned bulk
download path instead of a volunteer query API.

What this is
------------
Take 84 built this as a local measurement instrument. Take 85 promoted it, with
Jacob's agreement (A108): it is now the SECOND tier of the OSM fallback chain,
between the Overpass mirrors and Census TIGER.

    Overpass mirrors  ->  Geofabrik extract (here)  ->  Census TIGER roads

That matters because the tiers are not equivalent. Geofabrik is real OSM data:
same ways, same tags, water included, and it reproduces the Overpass network
edge for edge (20,222 edges / 12,236 nodes, the take-74 record). TIGER is roads
only — no water, different topology, 34k edges instead of 20k. Before this,
one Overpass outage cost the water layer and changed the shape of the network;
now it costs a 297 MB download and nothing else.

TIGER stays as the last tier because Geofabrik needs a compiled PBF reader and a
big download, and a build that can still finish with neither is worth keeping.

Usage
-----
    python3 tools/osm_local.py [region-id]

Writes ./aoi.json marked `"source": "geofabrik"`, which `fetch_osm()` treats as
a good OSM copy and will not overwrite. aoi.json is gitignored, so this cannot
reach CI.
"""
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(ROOT, "osm_cache")

# The Geofabrik extract for the state a region sits in. Keyed by the `state`
# field in regions.json so a second state does not need a code change.
EXTRACTS = {
    "Michigan": "https://download.geofabrik.de/north-america/us/michigan-latest.osm.pbf",
}

# EXACTLY the tag set fetch_osm() asks Overpass for. If these drift apart the
# local network stops being the one that ships, which is the whole point of the
# tool — so they are written to be diffed against ingest.py by eye and by the
# self-check at the bottom.
HIGHWAY = {"motorway", "trunk", "primary", "secondary", "tertiary",
           "unclassified", "residential", "living_street", "service", "track",
           "path", "footway", "bridleway", "cycleway", "raceway"}
WATERWAY = {"river", "stream"}


def region(rid=None):
    cfg = json.load(open(os.path.join(ROOT, "regions.json")))
    rid = rid or cfg.get("default")
    r = cfg["regions"][rid]
    return rid, r


def extract_path(state):
    url = EXTRACTS.get(state)
    if not url:
        sys.exit(f"no Geofabrik extract configured for state {state!r}")
    os.makedirs(CACHE, exist_ok=True)
    fp = os.path.join(CACHE, os.path.basename(url))
    if os.path.exists(fp) and os.path.getsize(fp) > 1_000_000:
        print(f"  extract cached: {os.path.getsize(fp)/1048576:.0f} MB")
        return fp
    print(f"  downloading {url}")
    tmp = fp + ".part"
    urllib.request.urlretrieve(url, tmp)
    os.replace(tmp, fp)
    print(f"  downloaded {os.path.getsize(fp)/1048576:.0f} MB")
    return fp


def build(rid=None):
    import osmium

    rid, r = region(rid)
    W, S, E, N = r["bbox"]
    print(f"region {rid} — {r['name']}  [{W}, {S}, {E}, {N}]")
    pbf = extract_path(r.get("state", "Michigan"))

    class H(osmium.SimpleHandler):
        def __init__(self):
            super().__init__()
            self.out = []
            self.seen = 0

        def way(self, w):
            t = w.tags
            hw = t.get("highway")
            ww = t.get("waterway")
            nat = t.get("natural")
            if not (hw in HIGHWAY or ww in WATERWAY or nat == "water"):
                return
            self.seen += 1
            geom, inside = [], False
            for n in w.nodes:
                try:
                    lon, lat = n.location.lon, n.location.lat
                except Exception:
                    return              # incomplete way at the extract edge
                geom.append({"lon": lon, "lat": lat})
                if W <= lon <= E and S <= lat <= N:
                    inside = True
            # Overpass `way(bbox)` selects ways with a node in the box and
            # `out geom` returns their FULL geometry — it does not clip. Match
            # that, or the local network is a different network (landmine 89 is
            # about the TIGER path, where features are county-sized; these are
            # not).
            if inside and len(geom) >= 2:
                self.out.append({"type": "way", "id": w.id,
                                 "tags": dict(t), "geometry": geom})

    h = H()
    print("  reading extract (node locations indexed in memory)…")
    h.apply_file(pbf, locations=True, idx="flex_mem")
    print(f"  {h.seen:,} candidate ways in Michigan, {len(h.out):,} touching the region")

    from collections import Counter
    c = Counter()
    for e in h.out:
        t = e["tags"]
        c[t.get("highway") or t.get("waterway") or
          ("water" if t.get("natural") == "water" else "?")] += 1
    print("  " + " · ".join(f"{k} {v}" for k, v in c.most_common(8)))

    return h.out


def build_and_write(rid=None):
    els = build(rid)
    json.dump({"source": "geofabrik", "elements": els},
              open(os.path.join(ROOT, "aoi.json"), "w"))
    print(f"  wrote aoi.json — {len(els):,} elements, "
          f"{os.path.getsize(os.path.join(ROOT, 'aoi.json'))/1048576:.1f} MB")
    return els


def check_tags_match_ingest():
    """The tag sets here and in ingest.py must not drift.

    A copy of a table is not the table (landmine 107). ingest.py builds its tag
    list inside an Overpass query string, so it cannot be imported — the next
    best thing is to read the string and compare, and to say so loudly when they
    differ rather than silently measuring a different network.
    """
    import re
    src = open(os.path.join(HERE, "ingest.py"), encoding="utf-8").read()
    m = re.search(r'way\["highway"~"\^\(([^)]*)\)\$"\]', src)
    if not m:
        return print("  WARN: could not find the highway list in ingest.py")
    theirs = set(m.group(1).split("|"))
    if theirs != HIGHWAY:
        print(f"  MISMATCH vs ingest.py: only here {sorted(HIGHWAY - theirs)}, "
              f"only there {sorted(theirs - HIGHWAY)}")
    else:
        print(f"  tag set matches ingest.py ({len(HIGHWAY)} highway values)")


if __name__ == "__main__":
    check_tags_match_ingest()
    build_and_write(sys.argv[1] if len(sys.argv) > 1 else None)
