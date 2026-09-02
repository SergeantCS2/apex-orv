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
    # take 121: unnamed ships, exactly as for beaches below. Jacob asked why
    # Waterford's kayak drops were missing: of 81 slipways there, 66 carry no
    # name in OSM and were being dropped. A place you may put a boat in is a
    # destination whether or not somebody typed a name on it; "Boat launch" is
    # honest, and silence is not (A146).
    ("launch",    "leisure",  ["slipway"],                          True),
    # A139 (take 131): Great Lakes DESTINATIONS — the reason you drive to the
    # coast. Lighthouses are the archetype (Manistee); marinas are where a
    # boat gets fuel and a slip. Both destinations, not corridor treatment.
    ("lighthouse","man_made", ["lighthouse"],                       False),
    ("marina",    "leisure",  ["marina"],                           False),
    # take 147 · A166 (first external tester): a livery is put-in
    # infrastructure, not shopping — and it outranks camp so a
    # rental-campground pins as the thing a paddler is looking for.
    ("livery",    "amenity",  ["boat_rental"],                      False),
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
    import aoi_stream
    els = aoi_stream.elements()   # generator — 542 MB statewide, never loaded
    seen, out = set(), []
    _ski_areas, _pistes = [], []   # take 142 · collected here (single-pass generator)
    # A152 (take 122): a named car park is a TRAILHEAD only if a trail comes
    # to it. Statewide the old rule shipped 1,902 "trailheads" including ".",
    # "001", "1 hour/Handicapped" and "RMHA Pool Parking Lot" — every named
    # lot in every city. Trail vertices (OSM track/path/bridleway, plus every
    # agency line) go into a 200 m grid during the same stream; a parking POI
    # keeps its badge only if one lies within ~150 m. Everything else is a
    # place to leave a car, not a place to start a ride, and is dropped.
    TRAILWAYS = {"track", "path", "bridleway"}
    GC = 0.002
    tgrid = {}
    def _tadd(lon, lat):
        tgrid.setdefault((int(lon / GC), int(lat / GC)), []).append((lon, lat))
    def _near_trail(lon, lat, r=0.0015):
        cx, cy = int(lon / GC), int(lat / GC)
        r2 = r * r
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for px, py in tgrid.get((cx + dx, cy + dy), ()):
                    ddx = (px - lon) * 0.72
                    if ddx * ddx + (py - lat) ** 2 <= r2:
                        return True
        return False
    for e in els:
        tags = e.get("tags", {})
        if e.get("type") == "way" and tags.get("highway") in TRAILWAYS:
            for pt in e.get("geometry") or []:
                _tadd(pt["lon"], pt["lat"])
        # take 142 · ski & snowboard raw material — assembled after the loop,
        # because the generator cannot be walked twice.
        if e.get("type") == "way":
            if tags.get("landuse") == "winter_sports" and (tags.get("name") or "").strip():
                _ski_areas.append(e)
            elif tags.get("piste:type") in ("downhill", "snow_park"):
                _pistes.append(e)
        kind, unnamed_ok = classify(tags)
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
        rec = {"k": kind, "n": nm or None,
               "p": [round(c[0], 5), round(c[1], 5)]}
        # take 174 · A186 · a campground's TYPE is what a camper decides by,
        # and OSM carries it: who runs it, whether it is rustic or serviced,
        # whether it costs. Kept only for camps, compact, and honest — an
        # unknown stays unknown rather than defaulting to "modern".
        if kind == "camp":
            t = e.get("tags", {}) or {}
            op = (t.get("operator") or "").lower()
            cs = (t.get("camp_site") or "").lower()
            fee = (t.get("fee") or "").lower()
            who = ("dnr" if ("natural resources" in op or "dnr" in op or "state of michigan" in op)
                   else "usfs" if ("forest service" in op or "usfs" in op or "usda" in op)
                   else "county" if ("county" in op or "township" in op or "city of" in op)
                   else "private" if op else None)
            ty = ("rustic" if (cs == "basic" or t.get("backcountry") == "yes" or
                               (who in ("dnr", "usfs") and not cs and t.get("power_supply") in (None, "no")))
                  else "modern" if cs in ("standard", "serviced", "deluxe") or t.get("power_supply") in ("yes", "true")
                  else None)
            ct = {}
            if who: ct["op"] = who
            if ty: ct["ty"] = ty
            if fee in ("yes", "no"): ct["fee"] = fee == "yes"
            if t.get("backcountry") == "yes": ct["disp"] = True
            if ct: rec["ct"] = ct
        out.append(rec)

    # agency lines count as trails too — a DNR hiking trailhead is real
    if os.path.exists("authoritative.json"):
        for f in json.load(open("authoritative.json")):
            g = f.get("geometry") or {}
            parts = g.get("coordinates") or []
            if g.get("type") == "LineString":
                parts = [parts]
            for part in parts if g.get("type") in ("LineString", "MultiLineString") else []:
                for pt in part:
                    _tadd(pt[0], pt[1])
    # Trail SYSTEMS (take 129, transcribed from Jacob's onX screen 24269): one
    # pin per named DNR hiking / biking / horse system — "Ogemaw Hills
    # Pathway", "Black Mountain Pathway" — at the system's centroid, carrying
    # its total mileage. Statewide corridors (North Country Trail, Iron Belle,
    # Shore To Shore) are lines, not places: anything spanning more than
    # ~40 km keeps its line and gets no pin. Hiking systems are kind
    # `system`; biking systems are `mtb`, so Ride can show them alone.
    if os.path.exists("authoritative.json"):
        import math
        sysd = {}
        for f in json.load(open("authoritative.json")):
            if f.get("src") != "dnr" or f.get("c") not in ("foot", "bike", "horse"):
                continue
            nm = (f.get("n") or "").strip()
            g = f.get("geometry") or {}
            if not nm or g.get("type") not in ("LineString", "MultiLineString"):
                continue
            parts = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
            d = sysd.setdefault(nm, {"xs": [], "ys": [], "m": 0.0, "bike": 0, "n": 0})
            for part in parts:
                for a, b in zip(part, part[1:]):
                    dx = (b[0] - a[0]) * 111320 * math.cos(math.radians(a[1]))
                    dy = (b[1] - a[1]) * 111320
                    d["m"] += math.hypot(dx, dy)
                for pt in part:
                    d["xs"].append(pt[0]); d["ys"].append(pt[1])
            d["bike"] += 1 if f.get("c") == "bike" else 0
            d["n"] += 1
        added = skipped = 0
        for nm, d in sysd.items():
            if not d["xs"]:
                continue
            span = math.hypot((max(d["xs"]) - min(d["xs"])) * 111320 * 0.72,
                              (max(d["ys"]) - min(d["ys"])) * 111320)
            if span > 40000 or d["m"] < 800:
                skipped += 1
                continue
            kind = "mtb" if d["bike"] * 2 >= d["n"] else "system"
            out.append({"k": kind, "n": nm,
                        "p": [round(sum(d["xs"]) / len(d["xs"]), 5),
                              round(sum(d["ys"]) / len(d["ys"]), 5)],
                        "mi": round(d["m"] / 1609.34, 1)})
            added += 1
        print(f"poi: trail systems — {added} pinned ({skipped} skipped as statewide "
              f"corridors or under half a mile)")

    # Ski & snowboard hills (take 142, Jacob 24280): the winter_sports polygon
    # pins at a point inside itself; named downhill runs and terrain parks
    # whose midpoint falls inside become the card's run list with their tagged
    # difficulty — untagged difficulty stays untagged (grey), never invented.
    # The website tag becomes the card's link. Nordic is deliberately out.
    # Relations are not assembled here: Michigan's hills are closed ways; if a
    # named hill is ever missing, look here first.
    if _ski_areas:
        from shapely.geometry import Polygon, Point
        DIFF = {"novice": "green", "easy": "green", "intermediate": "blue",
                "advanced": "black", "expert": "expert", "freeride": "expert"}
        ORDER = {"green": 0, "blue": 1, "black": 2, "expert": 3, "park": 4}
        ski_added = ski_runs = 0
        for e in _ski_areas:
            ring = [(q["lon"], q["lat"]) for q in e.get("geometry") or []]
            if len(ring) < 4:
                continue
            try:
                poly = Polygon(ring)
                if not poly.is_valid:
                    poly = poly.buffer(0)
            except Exception:
                continue
            t = e.get("tags", {})
            nm = t["name"].strip()
            key = ("ski", nm.lower())
            if key in seen or poly.is_empty:
                continue
            seen.add(key)
            c = poly.representative_point()
            if not (W <= c.x <= E and S <= c.y <= N):
                continue
            runs, seenr = [], set()
            for w in _pistes:
                g = w.get("geometry") or []
                if not g:
                    continue
                m = g[len(g) // 2]
                if not poly.contains(Point(m["lon"], m["lat"])):
                    continue
                wt = w.get("tags", {})
                rn = (wt.get("name") or "").strip()
                if wt.get("piste:type") == "snow_park":
                    rd, rn = "park", (rn or "Terrain park")
                else:
                    rd = DIFF.get(wt.get("piste:difficulty"))
                    if not rn:
                        continue
                if rn.lower() in seenr:
                    continue
                seenr.add(rn.lower())
                runs.append({"n": rn, "d": rd})
            runs.sort(key=lambda r: (ORDER.get(r["d"], 5), r["n"]))
            rec = {"k": "ski", "n": nm,
                   "p": [round(c.x, 5), round(c.y, 5)]}
            if runs:
                rec["runs"] = runs[:60]
                ski_runs += len(rec["runs"])
            web = (t.get("website") or t.get("contact:website") or "").strip()
            if web:
                rec["web"] = web
            out.append(rec)
            ski_added += 1
        print(f"poi: ski hills — {ski_added} pinned, {ski_runs} runs on their cards")

    # take 151 · A169: DNR boating access sites become launch pins where OSM
    # has none. Same 120 m same-ramp rule as the corridor merge. State-
    # sponsored sites only — county ramps (the Rifle's High Banks) are in
    # neither source, and that limit is written where it bites (bas.py).
    if os.path.exists("bas_payload.json"):
        _bas = json.load(open("bas_payload.json"))["b"]
        _ex = [r for r in out if r["k"] == "launch"]
        import math as _m
        def _mt(a, b):
            return _m.hypot((b[0]-a[0])*111320*_m.cos(_m.radians(a[1])),
                            (b[1]-a[1])*111320)
        bas_added = 0
        for b in _bas:
            if not (W <= b["p"][0] <= E and S <= b["p"][1] <= N):
                continue
            if any(_mt(r["p"], b["p"]) < 120 for r in _ex):
                continue
            rec = {"k": "launch", "n": b["n"], "p": b["p"]}
            out.append(rec); _ex.append(rec); bas_added += 1
        print(f"poi: launches — {bas_added} DNR boating access sites added "
              f"({len(_bas)-bas_added} already held or outside)")

    th_before = sum(1 for r in out if r["k"] == "trailhead")
    out = [r for r in out if r["k"] != "trailhead" or _near_trail(r["p"][0], r["p"][1])]
    th_after = sum(1 for r in out if r["k"] == "trailhead")
    if th_before != th_after:
        print(f"poi: trailheads — {th_before} named car parks, {th_after} within 150 m "
              f"of a trail kept, {th_before - th_after} dropped (A152)")

    if not out:
        print("poi: nothing named in this region")
        if os.path.exists("poi_payload.json"):
            os.remove("poi_payload.json")
        return

    # A156 (take 122): the Geofabrik extract is clipped with a BUFFER, so
    # Sault Ontario's fuel and Hurley Wisconsin's bars leaked in — 221 of
    # 25,893 places sat outside the state. A place you cannot ride to under
    # Michigan's rules is not a place on this map. Boundary-town survivors are
    # the ones whose point is actually inside the polygon.
    if R.bulk:
        import statemask
        before = len(out)
        out = [r for r in out if statemask.inside(r["p"][0], r["p"][1])]
        if before != len(out):
            print(f"poi: clip — {before - len(out)} place(s) outside {R.name} dropped")
    # A151 (take 123) · PROMINENCE. Jacob's field verdict on take 121: the
    # pins "pop in/out like crazy". Cause: 670 destination badges in one
    # 10-mile view handed to a collision solver whose answer changes with
    # every pan. The fix is to thin the DATA deterministically, not fight the
    # placement — every place gets a rank, the layer filters on it per zoom,
    # and a pin that is on stays on while you pan. Ranks:
    #   0  the reason you load the trailer: camps, trailheads, day-use, views
    #   1  named launches and beaches
    #   2  unnamed launches and beaches (a place you may put in, no name)
    #   3  services — fuel, food, stores, info, water, toilets, shelters
    PRI0 = {"camp", "trailhead", "dayuse", "view", "system", "mtb", "lighthouse"}
    PRI1 = {"launch", "beach"}
    for r in out:
        if r["k"] in PRI0:
            r["pri"] = 0
        elif r["k"] in PRI1:
            r["pri"] = 1 if r["n"] else 2
        else:
            r["pri"] = 3
    # A151 · DEDUPE unnamed launches. 1,167 of 2,156 carried no name and many
    # are several ramps on one lake within a few hundred metres — one pin
    # says "you can put in here" as well as four do. An unnamed launch within
    # ~200 m of any other launch is dropped; a named sibling always wins.
    lg = {}
    GD = 0.002
    for r in out:
        if r["k"] == "launch":
            lg.setdefault((int(r["p"][0] / GD), int(r["p"][1] / GD)), []).append(r)
    drop = set()
    for r in out:
        if r["k"] != "launch" or r["n"] or id(r) in drop:
            continue
        cx, cy = int(r["p"][0] / GD), int(r["p"][1] / GD)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for o in lg.get((cx + dx, cy + dy), ()):
                    if o is r or id(o) in drop:
                        continue
                    ddx = (o["p"][0] - r["p"][0]) * 0.72
                    if ddx * ddx + (o["p"][1] - r["p"][1]) ** 2 <= 0.0018 ** 2:
                        drop.add(id(r))
                        break
                if id(r) in drop:
                    break
            if id(r) in drop:
                break
    if drop:
        print(f"poi: launches — {len(drop)} unnamed within ~200 m of another launch "
              f"collapsed (A151)")
        out = [r for r in out if id(r) not in drop]
    out.sort(key=lambda r: (r["k"], r["n"] or ""))
    blob = json.dumps({"bbox": list(R.bbox), "p": out}, separators=(",", ":"))
    open("poi_payload.json", "w").write(blob)

    from collections import Counter
    c = Counter(r["k"] for r in out)
    print(f"poi: {len(out)} places, {len(blob)/1024:.0f} KB")
    print("  " + " · ".join(f"{k} {v}" for k, v in c.most_common()))


if __name__ == "__main__":
    main()
