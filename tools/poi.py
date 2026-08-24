#!/usr/bin/env python3
"""Places you can ride TO.

A110. The map has always been line: trails to ride along. It has never shown a
destination — where you park, where you camp, where you put a boat in, where you
buy fuel. Jacob asked for pins you can tap, "almost like Google Maps".

Two rules decide what reaches the phone.

NAMED ONLY. There are 206 parking areas inside this region and four of them have
names. The four are trailheads — "Bull Gap Trailhead", "Bull Gap Hill Climb
Trailhead" — and the other 202 are gravel pull-offs OSM happens to know about.
Shipping all of them would be clutter, and clutter is how a map stops being
trusted. An unnamed pin says "something is here" and nothing more, which is not
worth the space it takes.

EXCEPT WHERE ABSENCE IS THE POINT. A beach has no name in OSM and is still a
destination — the beach at Island Lake sits 6 m from the named day-use area and
is exactly what Jacob asked for. So `natural=beach` ships unnamed, labelled by
kind rather than by name. That is an exception with a reason, written down here
so the next person does not "fix" it.

Fuel closes a loop: the app has costed routes against a fuel range since take 36
and has never once shown the rider where fuel actually is.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R

# kind -> (tag, values, ships-unnamed). Order matters: the first match wins, so
# a campground with a shop tag is a campground.
KINDS = [
    ("trailhead", "amenity",  ["parking"],                          False),
    ("launch",    "leisure",  ["slipway"],                          False),
    ("camp",      "tourism",  ["camp_site"],                        False),
    ("beach",     "natural",  ["beach"],                            True),
    ("dayuse",    "tourism",  ["picnic_site"],                      False),
    ("view",      "tourism",  ["viewpoint"],                        False),
    ("fuel",      "amenity",  ["fuel"],                             False),
    ("store",     "shop",     ["convenience", "supermarket", "general"], False),
    ("food",      "amenity",  ["restaurant", "cafe"],               False),
    ("info",      "tourism",  ["information"],                      False),
    ("water",     "amenity",  ["drinking_water"],                   False),
    ("toilet",    "amenity",  ["toilets"],                          False),
    ("shelter",   "amenity",  ["shelter"],                          False),
]


def centre(e):
    """A node has lat/lon; a way has geometry. Overpass `nwr ... out geom`
    produces both shapes and osm_local.py matches it, so handle both here."""
    if e.get("type") == "node" and e.get("lon") is not None:
        return float(e["lon"]), float(e["lat"])
    g = e.get("geometry") or []
    if not g:
        return None
    xs = [float(p["lon"]) for p in g]
    ys = [float(p["lat"]) for p in g]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def classify(t):
    for kind, key, vals, unnamed_ok in KINDS:
        if t.get(key) in vals:
            return kind, unnamed_ok
    return None, False


def main():
    if not os.path.exists("aoi.json"):
        print("poi: no aoi.json — OSM was unavailable at ingest. "
              "Skipping places; the bundle will be PARTIAL and the app "
              "will name it.")
        if os.path.exists("poi_payload.json"):
            os.remove("poi_payload.json")
            print("poi: removed a stale poi_payload.json from an earlier run")
        return
    W, S, E, N = R.bbox
    els = json.load(open("aoi.json"))["elements"]
    seen, out = set(), []
    for e in els:
        kind, unnamed_ok = classify(e.get("tags", {}))
        if not kind:
            continue
        nm = (e.get("tags", {}).get("name") or "").strip()
        if not nm and not unnamed_ok:
            continue
        c = centre(e)
        if not c or not (W <= c[0] <= E and S <= c[1] <= N):
            continue
        # OSM often carries the same place as a node AND a way. Two pins a few
        # metres apart with one name is the doubled-line problem in point form
        # (A60), so collapse on name + kind + rough position.
        key = (kind, nm.lower(), round(c[0], 3), round(c[1], 3))
        if key in seen:
            continue
        seen.add(key)
        out.append({"k": kind, "n": nm or None,
                    "p": [round(c[0], 5), round(c[1], 5)]})

    if not out:
        print("poi: nothing named in this region")
        if os.path.exists("poi_payload.json"):
            os.remove("poi_payload.json")
        return

    out.sort(key=lambda r: (r["k"], r["n"] or ""))
    blob = json.dumps({"bbox": list(R.bbox), "p": out}, separators=(",", ":"))
    open("poi_payload.json", "w").write(blob)

    from collections import Counter
    c = Counter(r["k"] for r in out)
    print(f"poi: {len(out)} places, {len(blob)/1024:.0f} KB")
    print("  " + " · ".join(f"{k} {v}" for k, v in c.most_common()))


if __name__ == "__main__":
    main()
