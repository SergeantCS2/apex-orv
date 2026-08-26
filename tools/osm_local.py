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



def poi_tags():
    """A110's tag set, IMPORTED from ingest.py rather than copied.

    The two OSM paths must fetch the same things or a fallback build ships a
    different map than a normal one — and that difference would be invisible,
    because both produce a valid aoi.json. ingest.py builds its Overpass query
    from this same dict, so there is one definition and no drift (landmine 107).
    """
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "_ing", os.path.join(HERE, "ingest.py"))
    m = importlib.util.module_from_spec(spec)
    # ingest.py runs its whole pipeline at import, so read the literal instead.
    import ast
    src = open(os.path.join(HERE, "ingest.py"), encoding="utf-8").read()
    tree = ast.parse(src)
    for node in tree.body:
        if isinstance(node, ast.Assign) and getattr(node.targets[0], "id", "") == "POI_TAGS":
            return ast.literal_eval(node.value)
    sys.exit("ingest.py has no POI_TAGS — the two OSM paths would fetch "
             "different things and nothing would say so")


POI = poi_tags()
# Kept in step with the extra clauses at the bottom of ingest.py's Overpass
# query. `peak` is NOT a POI — poi.py's KINDS does not classify it, so it rides
# through aoi.json and is picked up by contour.py, which owns terrain (A76).
POI_EXTRA = {"leisure": ["slipway"], "natural": ["beach", "peak"]}


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


def build(rid=None, sink=None):
    import osmium

    rid, r = region(rid)
    bulk = bool(r.get("bulk"))
    W, S, E, N = r["bbox"]
    print(f"region {rid} — {r['name']}  [{W}, {S}, {E}, {N}]")
    pbf = extract_path(r.get("state", "Michigan"))

    class H(osmium.SimpleHandler):
        def __init__(self):
            super().__init__()
            self.out = []
            self.seen = 0
            self.emit = (sink if sink is not None
                         else self.out.append)

        def _poi(self, t):
            for k, vals in list(POI.items()) + list(POI_EXTRA.items()):
                if t.get(k) in vals:
                    return True
            return False

        def node(self, n):
            """POIs are often nodes. Overpass `nwr ... out geom` gives a node a
            lat/lon rather than a geometry array, so match that shape exactly —
            graph.py and pack.py both skip elements with no geometry, which is
            how a node passes through them untouched."""
            if not self._poi(n.tags):
                return
            lon, lat = n.location.lon, n.location.lat
            if not (W <= lon <= E and S <= lat <= N):
                return
            self.emit({"type": "node", "id": n.id,
                             "tags": dict(n.tags), "lon": lon, "lat": lat})

        def way(self, w):
            t = w.tags
            hw = t.get("highway")
            ww = t.get("waterway")
            nat = t.get("natural")
            if not (hw in HIGHWAY or ww in WATERWAY or nat == "water"
                    or self._poi(t)):
                return
            if bulk:
                # Statewide census (take 117): service 951k (driveways, parking
                # aisles) + footway 486k (sidewalks) + cycleway 19k were 65% of
                # a 1.08 GB pull, and unnamed streams are drainage ditches.
                # None of it serves an ORV/paddle app at state scale; the box
                # region keeps its original behaviour for regression.
                if hw in ("service", "footway", "cycleway", "steps",
                          "pedestrian", "corridor", "raceway"):
                    return
                if ww == "stream" and not t.get("name"):
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
                self.emit({"type": "way", "id": w.id,
                                 "tags": dict(t), "geometry": geom})

    h = H()
    # Statewide, flex_mem (every node location in RAM) stacked on the element
    # list drew the OOM killer (-9, take 117). The sparse FILE index keeps
    # node locations on disk — size tracks node count, lookups stay fast, and
    # peak RAM drops by the entire index.
    _idx = os.path.join("/tmp", f"apex_nodes_{rid}.idx")
    if os.path.exists(_idx):
        os.remove(_idx)
    print(f"  reading extract (node locations on disk: {_idx})…")
    h.apply_file(pbf, locations=True, idx=f"sparse_file_array,{_idx}")
    try:
        os.remove(_idx)
    except OSError:
        pass
    print(f"  {h.seen:,} candidate ways in Michigan, {len(h.out):,} touching the region")

    from collections import Counter
    c = Counter()
    for e in h.out:
        t = e["tags"]
        c[t.get("highway") or t.get("waterway") or
          ("water" if t.get("natural") == "water" else "?")] += 1
    print("  " + " · ".join(f"{k} {v}" for k, v in c.most_common(8)))

    return h.out


def build_stream(out_path, rid=None):
    """build(), but each kept element streams straight to out_path so the
    element list never lives in RAM beside the parse (take 117)."""
    import json as _json
    # Write beside, rename on success (take 120, landmine 201 addendum): an
    # interrupted stream used to leave a truncated aoi.json wearing a fresh
    # timestamp, and every later consumer read the stump without complaint.
    tmp = out_path + ".part"
    f = open(tmp, "w")
    f.write('{"source": "geofabrik", "elements": [')
    state = {"n": 0}
    def sink(el):
        if state["n"]:
            f.write(",")
        f.write(_json.dumps(el, separators=(",", ":")))
        state["n"] += 1
    els = build(rid, sink=sink)
    f.write("]}")
    f.close()
    os.replace(tmp, out_path)
    print(f"  streamed aoi — {state['n']:,} elements, "
          f"{os.path.getsize(out_path)//1048576} MB")
    return state["n"]


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
