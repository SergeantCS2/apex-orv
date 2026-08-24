#!/usr/bin/env python3
"""A river corridor: the whole river, ordered downstream, and what sits on it.

A115. Every region is a rectangle and a river is a line that runs off the edge
of one. The Au Sable enters the Bull Gap box at -84.30 and leaves at -83.90, so
the app draws 42.8 miles of a river that runs 123. Jacob's use for it is a
two-car shuttle — drop the boats at a put-in, drive both cars to the take-out,
one car back — and that only works if you know which access is ABOVE which, and
how far the float is between them. A clipped stroke cannot answer either.

Measured before building (landmine 23):

    Au Sable River        55 ways  123.1 mi   Grayling to Lake Huron
    North Branch          26 ways   37.2 mi
    South Branch          10 ways   48.6 mi
    within ~500 m of the mainstem: 39 canoe access, 15 slipways, 10 camps, 7 dams

Nine of the fifteen access points on the local outfitter's own map turn up in
OSM by name — Burtons Landing, Wakeley Bridge, Camp Ten Bridge, Comins Flats,
and every dam from Alcona to Foote. Two independent sources agreeing is worth
more than either (landmine 144).

Cost: the vector corridor is a few hundred KB. A bbox containing the same river
would be three times the current region's imagery; a +/-1 km corridor is 0.23x.
That is why a corridor is a corridor and not a bigger rectangle.

WHAT THIS DOES NOT DO
---------------------
It does not tell you how long a float takes. Those hours belong to the outfitter
whose table they came from, and they embed craft, flow and season. River miles
between two access points is arithmetic on geometry we hold; how long it takes
you is not (A112).
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from region import R

BUFFER_M = 500.0        # what counts as "on the river"
MIN_ACCESS = 3          # what counts as a river people actually paddle
NEAR_REGION_KM = 25.0   # a put-in you would drive to from the riding area
MAX_PORTAGE_M = 15000.0 # beyond this, two reaches are two RIVERS, not a portage
SIMPLIFY_M = 12.0       # the corridor is drawn, not routed on
JOIN_TOL = 2.5e-5       # ~2.5 m: endpoints OSM split apart, not distinct ones

# What a paddler is looking for. `dam` is not a feature, it is a HAZARD, and it
# is the reason this file exists at all — see the note where they are marked.
KINDS = [
    ("dam",     lambda t: t.get("waterway") in ("dam", "weir")),
    ("launch",  lambda t: t.get("leisure") == "slipway"),
    ("access",  lambda t: t.get("canoe") == "yes"
                          or t.get("waterway") == "access_point"),
    ("camp",    lambda t: t.get("tourism") in ("camp_site", "caravan_site")),
    ("parking", lambda t: t.get("amenity") == "parking" and (t.get("name") or "").strip()),
]


def metres(a, b):
    return math.hypot((b[0] - a[0]) * 111320 * math.cos(math.radians(a[1])),
                      (b[1] - a[1]) * 111320)


def near(a, b, tol=JOIN_TOL):
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol


def chain(ways):
    """Join OSM ways into the fewest continuous lines, preserving node order.

    OSM digitises a waterway in FLOW direction, so keeping each way's own node
    order and only ever joining tail-to-head keeps the result running downstream.
    A join that would need a way reversed is still taken — a river split across
    a county line is sometimes drawn against itself — but it is counted, because
    a corridor with many of them is one whose direction should not be trusted.
    """
    frags = [list(w) for w in ways if len(w) >= 2]
    out, reversed_joins = [], 0
    while frags:
        cur = frags.pop(0)
        joined = True
        while joined:
            joined = False
            for i, f in enumerate(frags):
                if near(cur[-1], f[0]):
                    cur += f[1:]
                elif near(cur[0], f[-1]):
                    cur = f[:-1] + cur
                elif near(cur[-1], f[-1]):
                    cur += list(reversed(f))[1:]; reversed_joins += 1
                elif near(cur[0], f[0]):
                    cur = list(reversed(f))[:-1] + cur; reversed_joins += 1
                else:
                    continue
                frags.pop(i); joined = True; break
        out.append(cur)
    out.sort(key=len, reverse=True)
    return out, reversed_joins


def simplify(pts, tol_m):
    """Distance-based thinning. The corridor is drawn and measured along, never
    routed on, so dropping a vertex costs a little smoothness and no topology."""
    if len(pts) < 3:
        return pts
    keep = [pts[0]]
    for p in pts[1:-1]:
        if metres(keep[-1], p) >= tol_m:
            keep.append(p)
    keep.append(pts[-1])
    return keep


def cumulative(pts):
    d, acc = [0.0], 0.0
    for a, b in zip(pts, pts[1:]):
        acc += metres(a, b)
        d.append(acc)
    return d


def project(pts, cum, pt):
    """Nearest point on the line: (distance along in metres, offset in metres)."""
    best = (None, 1e18)
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        ax = (b[0] - a[0]) * 111320 * math.cos(math.radians(a[1]))
        ay = (b[1] - a[1]) * 111320
        px = (pt[0] - a[0]) * 111320 * math.cos(math.radians(a[1]))
        py = (pt[1] - a[1]) * 111320
        L2 = ax * ax + ay * ay
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, (px * ax + py * ay) / L2))
        dx, dy = px - t * ax, py - t * ay
        off = math.hypot(dx, dy)
        if off < best[1]:
            best = (cum[i] + t * math.sqrt(L2), off)
    return best


def main():
    cfg = json.load(open(os.path.join(ROOT, "regions.json")))
    declared = cfg["regions"][R.id].get("corridors")
    out_path = os.path.join(ROOT, "corridor_payload.json")
    if declared == []:
        if os.path.exists(out_path):
            os.remove(out_path)
            print("corridor: none declared for this region — removed a stale payload")
        else:
            print("corridor: none declared for this region")
        return

    try:
        import osmium
    except Exception:
        print("corridor: osmium unavailable — skipping; the bundle will be "
              "PARTIAL and the app will name it")
        return

    import osm_local
    pbf = osm_local.extract_path(
        json.load(open(os.path.join(ROOT, "regions.json")))
        ["regions"][R.id].get("state", "Michigan"))

    class H(osmium.SimpleHandler):
        def __init__(self):
            super().__init__()
            self.ways = {}
            self.feats = []
            self.access = []

        def _feat(self, t, lon, lat):
            for kind, test in KINDS:
                if test(t):
                    self.feats.append({"k": kind, "n": (t.get("name") or "").strip() or None,
                                       "p": [lon, lat]})
                    return

        def node(self, n):
            t = n.tags
            self._feat(t, n.location.lon, n.location.lat)
            if (t.get("leisure") == "slipway" or t.get("canoe") == "yes"
                    or t.get("waterway") == "access_point"):
                self.access.append((n.location.lon, n.location.lat))

        def way(self, w):
            t = w.tags
            nm = (t.get("name") or "").strip()
            # every named river, scored below — the set is DERIVED, never typed
            if t.get("waterway") == "river" and nm:
                try:
                    self.ways.setdefault(nm, []).append(
                        [(n.location.lon, n.location.lat) for n in w.nodes])
                except Exception:
                    pass
            if t.get("waterway") in ("dam", "weir"):
                try:
                    p = w.nodes[0].location
                    self._feat(t, p.lon, p.lat)
                except Exception:
                    pass

    print("corridor: reading the extract — every named river, scored by access")
    h = H()
    h.apply_file(pbf, locations=True, idx="flex_mem")

    # ── Which rivers are paddled? ──────────────────────────────────────────
    # Not a hand-typed list of famous rivers. That is opinion, it goes stale,
    # and it does not survive going statewide. A river is paddled if people have
    # BUILT PLACES TO PUT BOATS ON IT — which is evidence, and it is in the data.
    #
    # Measured across Michigan: 574 named rivers, 2,645 access points. At >= 3
    # access points, 83 rivers and 5,139 miles survive — and the ranking falls
    # out as the state's canonical paddling list without anyone choosing it:
    # Huron 78, Au Sable 54, Manistee 51, Grand 44, Clinton 40, Muskegon 33.
    # Every river Jacob named clears it: Rifle 6, Black 9, Pine 15.
    CELL = 0.01
    grid = {}
    for lo, la in h.access:
        grid.setdefault((int(lo / CELL), int(la / CELL)), []).append((lo, la))

    W, S, E, N = R.bbox
    dlon = NEAR_REGION_KM / (111.32 * math.cos(math.radians((S + N) / 2)))
    dlat = NEAR_REGION_KM / 111.32
    bw, bs, be, bn = W - dlon, S - dlat, E + dlon, N + dlat

    scored = []
    for nm, ways in h.ways.items():
        pts = [p for w in ways for p in w]
        if len(pts) < 2:
            continue
        if not any(bw <= p[0] <= be and bs <= p[1] <= bn for p in pts[::4]):
            continue                      # not within reach of this region
        hits = set()
        for lo, la in pts[::8]:
            gx, gy = int(lo / CELL), int(la / CELL)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for q in grid.get((gx + dx, gy + dy), ()):
                        if metres((lo, la), q) <= BUFFER_M:
                            hits.add(q)
        if len(hits) >= MIN_ACCESS:
            scored.append((len(hits), nm))
    scored.sort(reverse=True)
    wanted = [nm for _, nm in scored]
    if declared:
        wanted = declared                 # an explicit list overrides the filter
        print(f"corridor: using the declared list, not the filter: {', '.join(wanted)}")
    else:
        print(f"corridor: {len(h.ways)} named rivers near this region, "
              f"{len(wanted)} with >= {MIN_ACCESS} access points — " +
              ", ".join(f"{nm} ({n})" for n, nm in scored[:6]))

    corridors = []
    for nm in wanted:
        lines, rev = chain(h.ways.get(nm) or [])
        if not lines:
            print(f"corridor: {nm} not found in the extract")
            continue

        # ── The gaps ARE the dams ──────────────────────────────────────────
        # Chaining leaves the Au Sable in 17 pieces and the longest is 86.6 of
        # 123 miles. That is not a defect in the data or the tolerance: the
        # river way STOPS at each impoundment and resumes below it, because a
        # pond is a `natural=water` polygon and not a river. Fragment 0 ends
        # just above Alcona Dam and fragment 1 begins just below it; the same
        # at Loud, Five Channels, Cooke and Foote.
        #
        # Gluing them into one line would draw a river you cannot paddle. What
        # is actually there is a chain of REACHES separated by portages — which
        # is what a paddler does, and the breaks land exactly on the hazards
        # that make A112 a ship-blocker.
        #
        # Fragments under a mile are side channels and braids around Mio and
        # Grayling, not the run.
        MIN_REACH_M = 1609.0
        big = [l for l in lines
               if sum(metres(a, b) for a, b in zip(l, l[1:])) >= MIN_REACH_M]
        dropped = len(lines) - len(big)
        # downstream order: this river runs east, and `chain` preserved OSM's
        # flow direction, so ordering reaches by where each one starts works —
        # asserted below rather than assumed
        big.sort(key=lambda l: l[0][0])

        # Michigan reuses river names heavily — one "Black River" name group
        # spans 170 miles of several distinct rivers. A gap of 200 km between
        # reaches is not an impoundment, and calling it a portage would invent a
        # river that does not exist. Beyond MAX_PORTAGE_M, split into separate
        # corridors and let each stand on its own.
        groups, cur = [], []
        for l in big:
            pr = simplify(l, SIMPLIFY_M)
            if cur and metres(cur[-1][-1], pr[0]) > MAX_PORTAGE_M:
                groups.append(cur); cur = []
            cur.append(pr)
        if cur:
            groups.append(cur)
        if len(groups) > 1:
            print(f"corridor: {nm} — {len(groups)} separate rivers share this name; "
                  f"taking the longest")
            groups.sort(key=lambda g: sum(
                metres(a, b) for pr in g for a, b in zip(pr, pr[1:])), reverse=True)
        reaches, cuts = [], []
        for i, pr in enumerate(groups[0]):
            reaches.append(pr)
            if i:
                gap = metres(reaches[i - 1][-1], pr[0])
                cuts.append({"m": round(gap), "p": [round((reaches[i-1][-1][0]+pr[0][0])/2, 5),
                                                   round((reaches[i-1][-1][1]+pr[0][1])/2, 5)]})

        # one continuous mileage across the whole run, so "12 miles below the
        # put-in" means the same thing everywhere
        pts, cum, base = [], [], 0.0
        for i, pr in enumerate(reaches):
            c = cumulative(pr)
            if i:
                base += cuts[i - 1]["m"]
            pts.append(pr)
            cum.append([base + x for x in c])
            base += c[-1]
        total = base
        flat = [p for pr in pts for p in pr]
        flatcum = [x for c in cum for x in c]
        # Downstream check: OSM flow direction should carry the line toward the
        # sea. Reported, never silently corrected — if it is wrong, every "above
        # / below" this file produces is wrong with it.
        drop_east = flat[-1][0] - flat[0][0]

        # Only features near THIS river's box get projected. Without this the
        # cost is (every dam, launch, camp and named car park in Michigan) x
        # (every point of every river), and the step does not finish.
        rw = min(p[0] for p in flat) - 0.02; re_ = max(p[0] for p in flat) + 0.02
        rs = min(p[1] for p in flat) - 0.02; rn = max(p[1] for p in flat) + 0.02
        cand = [f for f in h.feats
                if rw <= f["p"][0] <= re_ and rs <= f["p"][1] <= rn]

        on = []
        for f in cand:
            d, off = project(flat, flatcum, f["p"])
            if d is None or off > BUFFER_M:
                continue
            # `mi` is distance along the MAPPED LINE, and it is not a paddling
            # distance. Checked against the outfitter's published table for nine
            # access points: ours runs about 0.53x theirs above Mio and 0.78x
            # near it — OSM's centreline is drawn at 62 m point spacing and
            # cannot hold the meanders of the upper river. The ORDER is exact
            # and the dams are exact; the mileage is a floor, not a figure.
            #
            # Not corrected by a factor. The shortfall is not constant, and a
            # made-up multiplier applied to a number a rider might plan a day
            # around is the kind of confident guess this app exists to refuse.
            on.append({"k": f["k"], "n": f["n"], "p": f["p"],
                       "mi": round(d / 1609.34, 2), "off": round(off)})
        on.sort(key=lambda x: x["mi"])

        corridors.append({
            "n": nm, "mi": round(total / 1609.34, 1),
            # Stated in the payload so the app cannot forget it and neither can
            # anyone reading this file later.
            "mi_note": ("distance along the mapped centreline; the paddled river "
                        "is longer, by roughly half again above Mio"),
            "pts": len(flat), "rev": rev, "dropped": dropped,
            # one line per reach — drawn as separate strokes, because they ARE
            # separate: you portage between them
            "g": [[[round(a, 5), round(b, 5)] for a, b in pr] for pr in pts],
            "cuts": cuts,
            "f": on,
        })
        kinds = {}
        for f in on:
            kinds[f["k"]] = kinds.get(f["k"], 0) + 1
        print(f"corridor: {nm} — {total/1609.34:.1f} mi in {len(reaches)} reach(es) "
              f"from {len(h.ways[nm])} ways, {len(flat)} points, {rev} reversed "
              f"join(s), {dropped} side channel(s) dropped")
        for i, c in enumerate(cuts):
            print(f"corridor: {nm} — portage {i+1}: {c['m']} m of impoundment at "
                  f"{c['p'][1]:.4f},{c['p'][0]:.4f}")
        print(f"corridor: {nm} — on the river: " +
              " · ".join(f"{k} {v}" for k, v in sorted(kinds.items())) +
              f"   (runs {'east' if drop_east > 0 else 'west'})")

    if not corridors:
        if os.path.exists(out_path):
            os.remove(out_path)
        return
    blob = json.dumps({"c": corridors}, separators=(",", ":"))
    open(out_path, "w").write(blob)
    print(f"corridor: {len(corridors)} corridor(s), {len(blob)/1024:.0f} KB")


if __name__ == "__main__":
    main()
