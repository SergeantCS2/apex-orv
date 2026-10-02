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


# take 189 · A228 · PLACEHOLDER NAMES. Take 187's probe found six Off-road
# information pins near Grayling named "A" to "F"; the built bundle of take
# 188 also carried info posts named "1" to "42", car parks named "car
# parking" and launches named "Boat Launch". A name like that is not a name:
# it is a designator or the kind said again, and the map label read "A" where
# every other pin reads a place. The maintainer (2026-09-30): "clean them up".
# The rule never guesses a better name: the pin keeps its place, its kind and
# its badge, ships UNNAMED (so the app labels it by kind from POIKIND — the
# one table of display names) and carries the source's text as `ph`, so the
# card can say literally what the source called it. Four rules, first match
# wins, each counted in the log:
#   letter    — one letter and nothing else: "A", "f"
#   number    — no letter at all: "12", "#3", "08-911", "#41.75"
#   code      — one letter with one to three digits: "C1", "4A", "10A", "#7B"
#   kind word — the whole name, normalised, is a generic word for its own
#               kind (PH_WORDS): "car parking", "Restrooms", "Boat Launch"
# Not placeholders, on purpose: a word plus a designator ("Lot 10", "Site 12",
# "Pavilion 2") names one of several on the ground; a word that says MORE
# than the kind ("Vault Toilet", "Trail Map", "Visitor Center"); and a name
# equal to the element's OSM brand tag ("76" is Phillips 66's fuel brand) —
# the brand exemption is applied in main() against every brand the extract's
# places carry, and ships as `bn: 1`.
# tools/gate.py check_pin_names holds the built bundle to this and checks
# that every POIKIND display name is in its kind's PH_WORDS.
PH_WORDS = {
    "trailhead": {"trailhead", "trail head", "parking", "car parking", "parking lot",
                  "parking area", "car park", "public parking", "public parking lot",
                  "public parking area", "trailhead parking", "trail head parking",
                  "trail parking", "trailhead lot"},
    "launch": {"boat launch", "launch", "boat ramp", "ramp", "slipway", "public boat launch",
               "public launch", "public boat ramp", "boat access", "public boat access",
               "boat launch site"},
    "lighthouse": {"lighthouse", "light house"},
    "marina": {"marina"},
    "livery": {"livery", "canoe livery", "kayak livery", "canoe rental", "kayak rental",
               "boat rental", "canoe and kayak rental", "canoe and kayak livery"},
    "camp": {"campground", "camp ground", "campsite", "camp site", "campsites", "camping",
             "camping area", "camp"},
    "beach": {"beach", "public beach", "swimming beach", "swim beach", "beach area"},
    "dayuse": {"day use", "day use area", "picnic area", "picnic site", "picnic",
               "picnic grounds"},
    "view": {"viewpoint", "view point", "view", "scenic view", "scenic viewpoint", "overlook",
             "scenic overlook", "lookout", "scenic lookout", "vista", "scenic vista"},
    "fuel": {"fuel", "gas", "gas station", "fuel station", "filling station",
             "petrol station", "gasoline"},
    "store": {"store", "shop", "convenience store", "general store", "grocery",
              "grocery store", "supermarket", "market"},
    "food": {"food", "restaurant", "cafe", "café", "coffee shop"},
    "info": {"information", "info", "information board", "info board", "information kiosk",
             "info kiosk", "kiosk", "information sign", "sign", "signboard", "board",
             "visitor information", "information point", "information center",
             "information centre", "tourist information"},
    "water": {"drinking water", "water", "water fountain", "drinking fountain", "fountain",
              "potable water"},
    "toilet": {"toilets", "toilet", "restroom", "restrooms", "rest room", "rest rooms",
               "bathroom", "bathrooms", "washroom", "washrooms", "privy", "outhouse",
               "latrine", "public toilet", "public toilets", "public restroom",
               "public restrooms", "comfort station"},
    "shelter": {"shelter", "pavilion", "picnic shelter", "picnic pavilion", "shelter house"},
    "system": {"trail system", "trail", "trails", "pathway"},
    "mtb": {"mtb trail system", "mtb trail", "mtb trails", "mountain bike trail",
            "mountain bike trails", "bike trail", "bike trails"},
    "ski": {"ski and snowboard hill", "ski hill", "ski area", "ski resort"},
}


def _ph_norm(s):
    """Lower case, '&' read as 'and', punctuation to spaces, spaces collapsed."""
    s = s.lower().replace("&", " and ")
    s = "".join(ch if ch.isalnum() else " " for ch in s)
    return " ".join(s.split())


def placeholder(name, kind):
    """The A228 rule a pin name trips, or None. Never a guess: it only says
    whether the source's text is a placeholder, not what the place is."""
    if not name:
        return None
    t = name.strip()
    letters = [ch for ch in t if ch.isalpha()]
    if len(t) == 1 and t.isalpha():
        return "letter"
    if not letters:
        return "number"
    core = t.lstrip("#").strip()
    digits = [ch for ch in core if ch.isdigit()]
    if (len(letters) == 1 and 1 <= len(digits) <= 3 and len(core) == len(digits) + 1
            and (core[0].isalpha() or core[-1].isalpha())):
        return "code"
    if _ph_norm(t) in PH_WORDS.get(kind, ()):
        return "kind word"
    return None


def _selftest():
    """Planted names, every run of poi.py: each rule must fire on its plant and
    stay quiet on its look-alike, or the step refuses to write anything."""
    want = [("A", "info", "letter"), ("f", "info", "letter"), ("12", "info", "number"),
            ("#3", "shelter", "number"), ("08-911", "info", "number"),
            ("#41.75", "info", "number"), (".", "trailhead", "number"),
            ("C1", "camp", "code"), ("4A", "camp", "code"), ("10A", "camp", "code"),
            ("#7B", "camp", "code"),
            ("car parking", "trailhead", "kind word"), ("Car  Parking", "trailhead", "kind word"),
            ("Restrooms", "toilet", "kind word"), ("Boat Launch", "launch", "kind word"),
            ("Information", "info", "kind word"), ("Picnic Area", "dayuse", "kind word"),
            ("Canoe & Kayak Livery", "livery", "kind word"),
            # look-alikes that are names and must survive
            ("BP", "fuel", None), ("UF", "fuel", None), ("Lot 10", "trailhead", None),
            ("Site 12", "camp", None), ("Vault Toilet", "toilet", None),
            ("Trail Map", "info", None), ("Boat Launch", "trailhead", None),
            ("Parking", "info", None), ("A1B", "camp", None), ("1234A", "camp", None),
            ("Bull Gap Trailhead", "trailhead", None), ("Cafe 106", "food", None),
            ("", "info", None), (None, "info", None)]
    bad = [(n, k, placeholder(n, k), w) for n, k, w in want if placeholder(n, k) != w]
    if bad:
        sys.exit(f"poi: A228 placeholder self-test FAILED — (name, kind, got, want) {bad}")
    print(f"poi: A228 placeholder self-test — {len(want)} planted names, every rule "
          f"fired on its plant and stayed quiet on its look-alike")


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
    _selftest()
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
    _private = 0
    # A228: every OSM brand a classified place carries ("76" is Phillips 66's
    # fuel brand; measured take 189, 14 of the 15 places named "76" carry
    # brand=76 and one store does not) — a name that IS a brand is a name,
    # whatever it looks like.
    _brands = set()
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
        if (tags.get("brand") or "").strip():
            _brands.add(tags["brand"].strip().lower())
        nm = (e.get("tags", {}).get("name") or "").strip()
        if not nm and not unnamed_ok:
            continue
        # take 175 · A188 · a residential dock tagged access=private is not a
        # launch a rider can use, and a lake district is full of them (Jacob,
        # 24766/24768, Cass Lake). Counted so the ledger says how many.
        if kind in ("launch", "beach") and (tags.get("access") or "").lower() in ("private", "no"):
            _private += 1
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
    # take 189 · A228 · placeholder names (the rule and its reasons sit with
    # PH_WORDS above). The pin keeps its place and kind and ships unnamed with
    # the source's text in `ph`; a name that is a brand ships as `bn`. A
    # lake-borrowed name (`w`) is not the source's text, so a placeholder
    # there is dropped with its flag and carries no `ph`.
    ph_w = [0]
    def _ph_apply(r):
        rule = placeholder(r.get("n"), r["k"])
        if not rule:
            return
        if not r.get("w") and r["n"].strip().lower() in _brands:
            r["bn"] = 1      # shipped, so the gate can tell a brand from a placeholder
            return
        if r.get("w"):
            r.pop("w"); ph_w[0] += 1
        else:
            r["ph"] = r["n"]
        r["n"] = None
        if r["k"] in ("launch", "beach"):
            r["pri"] = 2     # the unnamed rank (A151), like any unnamed launch
    # Launches and beaches FIRST, here, before the A151 and A188 passes below:
    # a "Boat Launch" beside Rogers City Marina is an unnamed launch in the
    # shadow of a named destination, the same place twice, and goes the way
    # every unnamed launch does (render's A188 check found two shadows when
    # this pass ran last). Lake naming leaves a `ph` pin alone: its card says
    # what the source called it, and "the source has no name for this spot"
    # would not be true of it.
    for r in out:
        if r["k"] in ("launch", "beach"):
            _ph_apply(r)
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
    ph_shadow = sum(1 for r in out if id(r) in drop and r.get("ph") is not None)
    if drop:
        print(f"poi: launches — {len(drop)} unnamed within ~200 m of another launch "
              f"collapsed (A151)")
        out = [r for r in out if id(r) not in drop]
    # take 175 · A188 · the unnamed-pin cleanup. Measured first: 1,982
    # unnamed pins, ALL launches and beaches (45% and 86% of their kinds),
    # 370 of them within 300 m of a named destination, 568 on the shore of
    # a named lake. Three passes, each counted:
    #   shadows — an unnamed launch or beach within 300 m of a NAMED
    #     destination is the same place twice (a slipway node beside the
    #     named launch it belongs to). Dropped.
    #   named by water — an unnamed launch or beach within 150 m of a named
    #     lake's shore takes the lake's name and a flag, so the card can say
    #     "named for the lake it is on" rather than pretend OSM named it.
    #   the rest stay unnamed; the app steps them back outside Water mode.
    print(f"poi: {_private} private launches/beaches dropped (access=private)")
    import math as _m
    def _mt(a, b):
        return _m.hypot((a[0] - b[0]) * 111320 * _m.cos(_m.radians(a[1])), (a[1] - b[1]) * 111320)
    DEST = ("launch", "beach", "marina", "camp", "dayuse", "livery", "lighthouse", "trailhead")
    named_dest = [r for r in out if r.get("n") and r["k"] in DEST]
    g = {}
    for r in named_dest:
        g.setdefault((round(r["p"][0], 2), round(r["p"][1], 2)), []).append(r)
    shadow = set()
    for r in out:
        if r.get("n") or r["k"] not in ("launch", "beach"):
            continue
        kx, ky = round(r["p"][0], 2), round(r["p"][1], 2)
        for dx in (-0.01, 0, 0.01):
            for dy in (-0.01, 0, 0.01):
                for q in g.get((round(kx + dx, 2), round(ky + dy, 2)), []):
                    if _mt(r["p"], q["p"]) < 300:
                        shadow.add(id(r)); break
                if id(r) in shadow: break
            if id(r) in shadow: break
    ph_shadow += sum(1 for r in out if id(r) in shadow and r.get("ph") is not None)
    out = [r for r in out if id(r) not in shadow]
    print(f"poi: {len(shadow)} unnamed launches/beaches within 300 m of a named destination dropped (shadows)")
    named_by_water = 0
    if os.path.exists("water_payload.json"):
        try:
            sys.path.insert(0, os.path.dirname(__file__))
            from pack import decode_ring
            W = json.load(open("water_payload.json"))
            lakes = []
            for nm_, geo in zip(W["nm"]["water"], W["l"]["water"]):
                if not nm_: continue
                try: lakes.append((nm_, decode_ring(geo)))
                except Exception: pass
            wg = {}
            for nm_, ring in lakes:
                for v in ring[::max(1, len(ring) // 60)]:
                    wg.setdefault((round(v[0], 2), round(v[1], 2)), []).append((nm_, ring))
            for r in out:
                if r.get("n") or r["k"] not in ("launch", "beach") or r.get("ph") is not None:
                    continue
                best = None; seen = set()
                for dx in (-0.01, 0, 0.01):
                    for dy in (-0.01, 0, 0.01):
                        for nm_, ring in wg.get((round(r["p"][0] + dx, 2), round(r["p"][1] + dy, 2)), []):
                            if nm_ in seen: continue
                            seen.add(nm_)
                            d = min(_mt(r["p"], v) for v in ring[::max(1, len(ring) // 300)])
                            if d < 150 and (best is None or d < best[0]): best = (d, nm_)
                if best:
                    r["n"] = best[1]; r["w"] = 1; named_by_water += 1
        except Exception as ex:
            print(f"poi: water naming skipped ({ex})")
    print(f"poi: {named_by_water} unnamed launches/beaches named for the lake they are on")
    # A borrowed name is still a name: two unnamed launches on one shore both
    # become "Cass Lake" — collapse same-kind, same-name pins within 300 m to
    # one — and an unnamed neighbour of a now-named pin is a shadow of it.
    # Both passes counted. (The first render found 3 such shadows.)
    bw = [r for r in out if r.get("w")]
    bg = {}
    for r in bw:
        bg.setdefault((r["k"], r["n"], round(r["p"][0], 2), round(r["p"][1], 2)), []).append(r)
    dup = set()
    for r in bw:
        if id(r) in dup: continue
        for dx in (-0.01, 0, 0.01):
            for dy in (-0.01, 0, 0.01):
                for q in bg.get((r["k"], r["n"], round(r["p"][0] + dx, 2), round(r["p"][1] + dy, 2)), []):
                    if q is not r and id(q) not in dup and _mt(r["p"], q["p"]) < 300:
                        dup.add(id(q))
    out = [r for r in out if id(r) not in dup]
    print(f"poi: {len(dup)} lake-named duplicates collapsed (same lake, same kind, within 300 m)")
    named_dest2 = [r for r in out if r.get("n") and r["k"] in DEST]
    g2 = {}
    for r in named_dest2:
        g2.setdefault((round(r["p"][0], 2), round(r["p"][1], 2)), []).append(r)
    shadow2 = set()
    for r in out:
        if r.get("n") or r["k"] not in ("launch", "beach"): continue
        kx, ky = round(r["p"][0], 2), round(r["p"][1], 2); hit = False
        for dx in (-0.01, 0, 0.01):
            for dy in (-0.01, 0, 0.01):
                for q in g2.get((round(kx + dx, 2), round(ky + dy, 2)), []):
                    if _mt(r["p"], q["p"]) < 300: hit = True; break
                if hit: break
            if hit: break
        if hit: shadow2.add(id(r))
    ph_shadow += sum(1 for r in out if id(r) in shadow2 and r.get("ph") is not None)
    out = [r for r in out if id(r) not in shadow2]
    print(f"poi: {len(shadow2)} unnamed shadows of lake-named pins dropped")
    # A228 for every other kind, last, so no earlier pass sees a changed name
    # (and a lake-borrowed launch name is checked too); then the counts, read
    # from what ships.
    for r in out:
        _ph_apply(r)
    from collections import Counter as _C
    ph_rule = _C(placeholder(r["ph"], r["k"]) for r in out if r.get("ph") is not None)
    ph_kind = _C(r["k"] for r in out if r.get("ph") is not None)
    print(f"poi: A228 placeholder names — {sum(ph_rule.values())} shipped unnamed, "
          "labelled by kind: " + " · ".join(f"{k} {ph_rule[k]}" for k in
                                            ("letter", "number", "code", "kind word")) +
          f"; {ph_shadow} launches/beaches collapsed into a neighbour or dropped as a shadow "
          "(A151, A188, as every unnamed one is); "
          f"{sum(1 for r in out if r.get('bn'))} kept as their OSM brand; "
          f"{ph_w[0]} lake-borrowed")
    if ph_kind:
        print("  by kind: " + " · ".join(f"{k} {v}" for k, v in ph_kind.most_common()))
    still = sum(1 for r in out if not r.get("n") and r["k"] in ("launch", "beach"))
    print(f"poi: {still} launches/beaches remain unnamed (stepped back outside Water in the app)")
    out.sort(key=lambda r: (r["k"], r["n"] or ""))
    blob = json.dumps({"bbox": list(R.bbox), "p": out}, separators=(",", ":"))
    open("poi_payload.json", "w").write(blob)

    from collections import Counter
    c = Counter(r["k"] for r in out)
    print(f"poi: {len(out)} places, {len(blob)/1024:.0f} KB")
    print("  " + " · ".join(f"{k} {v}" for k, v in c.most_common()))


if __name__ == "__main__":
    main()
