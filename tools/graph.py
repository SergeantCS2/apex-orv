"""Build one routable graph from DNR + USFS + OSM.

Conflation rule, derived from conflate.py rather than assumed:
  - USFS trails are 94.8% redundant with DNR -> drop the duplicates, but carry
    the USFS trail id (H57-7) onto the DNR feature it matched. DNR knows closure
    status; USFS knows the number you'd give a dispatcher. Keep both.
  - USFS roads are only 12.6% redundant -> keep essentially all of them.

Noding: vertices are snapped to a ~12 m grid, then any grid cell touched by two
or more different lines becomes a junction. Lines are split at junctions. Then
dangling endpoints are pulled to a nearby junction if one is within SNAP_M,
which is what actually connects one agency's geometry to another's.
"""
import json, math, os, sys
from collections import defaultdict, Counter

import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R

G = 0.00012                 # ~13 m lat, ~9.5 m lon at 44.5N
SNAP_M = 30.0
MATCH_M = 25.0
STEP_M = 20.0
LAT0 = (R.S + R.N) / 2
KX = math.cos(math.radians(LAT0))
MD = 111320.0

# mph by class -- rough, but the ordering is what routing cares about
SPEED = {"route72": 25, "fsroad": 22, "trail50": 16, "fstrail": 14,
         "mccct": 11, "moto24": 11, "paved": 45, "minor": 28, "track": 14}
# effort multiplier: how much you don't want this under you when tired or hurt
EFFORT = {"paved": 1.0, "route72": 1.05, "fsroad": 1.1, "minor": 1.15,
          "trail50": 1.5, "fstrail": 1.7, "track": 1.8, "mccct": 2.3,
          "moto24": 2.6}
PAVED = {"paved", "minor"}


def m(a, b):
    return math.hypot((b[0] - a[0]) * KX * MD, (b[1] - a[1]) * MD)


def key(p):
    return (int(round(p[0] / G)), int(round(p[1] / G)))


def lines_of(f):
    g = f.get("geometry")
    if not g:
        return []
    return [g["coordinates"]] if g["type"] == "LineString" else \
           g["coordinates"] if g["type"] == "MultiLineString" else []


def densify(pts, step=STEP_M):
    out = []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        d = m(a, b)
        out.append(a)
        if d > step:
            for k in range(1, int(d // step) + 1):
                t = k * step / d
                out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    if pts:
        out.append(pts[-1])
    return out


# ── 1. load and conflate ───────────────────────────────────────────────────
rows = json.load(open("authoritative.json"))
dnr = [r for r in rows if r["src"] == "dnr"]
fs = [r for r in rows if r["src"] == "usfs"]

dgrid = defaultdict(list)
for i, r in enumerate(dnr):
    for ln in lines_of(r):
        for p in densify([(float(x[0]), float(x[1])) for x in ln if len(x) >= 2]):
            dgrid[(int(p[0] / 0.0006), int(p[1] / 0.0006))].append((p, i))


def dnr_near(p):
    cx, cy = int(p[0] / 0.0006), int(p[1] / 0.0006)
    best, who = 1e9, None
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for q, idx in dgrid.get((cx + i, cy + j), ()):
                d = m(p, q)
                if d < best:
                    best, who = d, idx
    return best, who


kept, merged_ids, dropped = [], 0, 0
for r in fs:
    samples, votes = [], Counter()
    for ln in lines_of(r):
        samples += densify([(float(x[0]), float(x[1])) for x in ln if len(x) >= 2])
    if not samples:
        continue
    hits = 0
    for p in samples:
        d, who = dnr_near(p)
        if d <= MATCH_M:
            hits += 1
            votes[who] += 1
    frac = hits / len(samples)
    # a trail that is essentially the same line the DNR already publishes
    if r["c"] in ("fstrail", "fsclosed") and frac >= 0.80 and votes:
        target = dnr[votes.most_common(1)[0][0]]
        if r.get("id") and not target.get("id"):
            target["id"] = r["id"]          # carry the number across
            merged_ids += 1
        dropped += 1
        continue
    kept.append(r)

print(f"conflation: {len(fs)} USFS -> kept {len(kept)}, dropped {dropped} duplicates, "
      f"{merged_ids} trail ids merged onto DNR features")

net = dnr + kept

# ── split routable from show-only ──────────────────────────────────────────
# Routes a dirt bike may not legally use are held out of the graph entirely, so
# no cost function, no snap and no loop can ever reach them. They are carried in
# a separate payload and drawn distinctly. The gate re-checks this against the
# built data, because two lists that must agree is how a footpath becomes a
# suggested route.
SHOW_ONLY = {"foot", "horse", "snow", "snowmob", "nfsmoto", "bike", "mou",
             "railtrail", "cycle", "race"}
show = [r for r in net if r["c"] in SHOW_ONLY]
net = [r for r in net if r["c"] not in SHOW_ONLY]

# A trail can be designated for several uses at once, and the DNR publishes it in
# every matching layer — "LP 9" is a motorcycle trail AND a hiking trail AND an
# equestrian trail. Drawn naively that puts a grey "not ridable" line directly on
# top of a trail Jacob may legally ride, which is worse than useless: it tells him
# to stay off something he is allowed on. The ridable designation wins (take 47).
def _ends(r):
    g = r.get("geometry") or {}
    cs = g.get("coordinates") or []
    if g.get("type") == "MultiLineString":
        cs = [pt for part in cs for pt in part]
    if len(cs) < 2:
        return None
    try:
        return (round(cs[0][0], 4), round(cs[0][1], 4),
                round(cs[-1][0], 4), round(cs[-1][1], 4))
    except Exception:
        return None


_ridable = {k for k in (_ends(r) for r in net) if k}
_before = len(show)
show = [r for r in show if _ends(r) not in _ridable]
if _before != len(show):
    print(f"  dropped {_before - len(show)} show-only copies of trails that are "
          f"ALSO ridable — multi-use designation, ridable wins")
print(f"show-only routes held out of the graph: {len(show)}")

# ── 2. add OSM context roads so you can actually get home ──────────────────
# Overpass fetches path/bridleway/cycleway/raceway and this map had no entry for
# any of them, so they were downloaded and silently dropped — in jack-pine
# country a lot of real connecting two-track is tagged highway=path. They are
# mapped now, all to SHOW-ONLY classes: OSM is advisory, and an OSM path is not
# a designated ORV route no matter what it looks like on the ground.
CLS = {"motorway": "paved", "trunk": "paved", "primary": "paved",
       "secondary": "paved", "tertiary": "paved", "unclassified": "minor",
       "residential": "minor", "living_street": "minor", "service": "track", "track": "track",
       "path": "foot", "footway": "foot", "bridleway": "horse",
       "cycleway": "cycle", "raceway": "race"}
# ── drop OSM lines that duplicate agency geometry ──────────────────────────
# conflate.py dedupes USFS against DNR, but nothing deduped OSM against either —
# so a forest road present in both MVUM and OSM was drawn twice, as two jagged
# parallel lines a few metres apart. 5,390 overlapping spans, 1,957 of them
# fsroad+track. Jacob: "some paths don't match the road properly" (take 64).
#
# The agency line is authoritative on classification and legality; the OSM copy
# adds nothing but noise. Grid-hash every authoritative vertex at ~34 m and drop
# any OSM way whose points mostly land on one.
_CELL = 0.00015                      # ~17 m; see the sweep below
_grid = set()
for _r in net:
    _g = _r.get("geometry") or {}
    _cs = _g.get("coordinates") or []
    if _g.get("type") == "MultiLineString":
        _cs = [q for part in _cs for q in part]
    for _pt in _cs:
        try:
            _grid.add((int(_pt[0] / _CELL), int(_pt[1] / _CELL)))
        except Exception:
            pass


def _covered(coords):
    """Fraction of points sitting on a cell an agency line already occupies."""
    if not coords:
        return 0.0
    hit = 0
    for x, y in coords:
        cx, cy = int(x / _CELL), int(y / _CELL)
        # No neighbour expansion. At 45 m with neighbours this removed 558 miles
        # — a quarter of the network — and connectivity fell from 99.7% to 97.4%.
        # A road running parallel to a trail is not the same road.
        if (cx, cy) in _grid:
            hit += 1
    return hit / len(coords)


osm_dupe = 0
osm_n = 0
_osm_ok = os.path.exists("aoi.json")
if _osm_ok:
    try:
        _osm_ok = next(iter(__import__("aoi_stream").elements()), None) is not None
    except Exception:
        _osm_ok = False
# Existence is not content. An empty aoi.json passed the old check and produced
# a graph with 3,621 edges instead of 20,133 — trails only, no roads at all.
if not _osm_ok:
    # Water is optional and degrades to PARTIAL. Roads are not: without them
    # Return Home cannot reach a town, and a bundle that cannot get you back is
    # exactly what landmine 34 says to refuse rather than ship quietly.
    # CI caches aoi.json, so this only bites a cold first build.
    sys.exit("graph: aoi.json missing — OSM was unavailable, so the road network "
             "cannot be built.\n       DNR/USFS trail data fetched fine; re-run "
             "when Overpass recovers.\n       Refusing to ship a bundle whose "
             "Return Home cannot reach a road.")
# Take 117: the statewide aoi is 542 MB; json.load of it needs more RAM than
# the build machine has. Stream, never load (aoi_stream).
import aoi_stream
from region import R as _R

# ── CONNECTOR-ONLY RESIDENTIAL (take 117, third attempt at one problem) ────
# Attempt 1: keep all residential — the OOM killer (260k town-grid ways do not
# fit a 3 GB build box). Attempt 2: drop them all — severed local connectivity,
# a THIRD of nodes fell out of the giant component and 2.8 km neighbours could
# not reach each other (take 64's lesson at state scale). Attempt 3, this one:
# keep only the residential ways that CONNECT — union-find the non-residential
# network by rounded coordinate, then admit a residential way iff it touches
# two different components (a bridge) or extends an accepted connector (chain
# passes, capped). Metro grids stay out; trailhead access stays in.
KEEP_RES = None
if _R.bulk:
    def _k(pt):
        return (round(pt["lon"] * 1e6) << 32) ^ (round(pt["lat"] * 1e6) & 0xFFFFFFFF)
    _P = {}
    def _f(x):
        r = x
        while _P.get(r, r) != r:
            r = _P[r]
        while _P.get(x, x) != x:
            _P[x], x = r, _P[x]
        return r
    def _u(a, b):
        _P.setdefault(a, a)      # every seen point self-registers, so
        _P.setdefault(b, b)      # membership (`kk in _P`) is exact
        ra, rb = _f(a), _f(b)
        if ra != rb:
            _P[ra] = rb
    n_nonres = 0
    for _e in aoi_stream.elements():
        _t = _e.get("tags") or {}
        _hw = _t.get("highway")
        if not _hw or _hw == "residential":
            continue
        if CLS.get(_hw) is None:
            continue
        _g = _e.get("geometry") or []
        for _i in range(len(_g) - 1):
            _u(_k(_g[_i]), _k(_g[_i + 1]))
        n_nonres += 1
    KEEP_RES = set()
    for _pass in range(3):
        added = 0
        for _e in aoi_stream.elements():
            _t = _e.get("tags") or {}
            if _t.get("highway") != "residential":
                continue
            if _e.get("id") in KEEP_RES:
                continue
            _g = _e.get("geometry") or []
            touch = [_k(_pt) for _pt in _g]
            roots = set(_f(kk) for kk in touch if kk in _P)
            if len(roots) >= 2:
                KEEP_RES.add(_e.get("id"))
                for _i in range(len(touch) - 1):
                    _u(touch[_i], touch[_i + 1])
                added += 1
        print(f"graph: connector pass {_pass + 1} admitted {added} residential ways")
        if not added:
            break
    print(f"graph: connector-only residential — {len(KEEP_RES)} of the "
          f"statewide residential ways bridge the network; the rest stay out "
          f"(non-residential ways unioned: {n_nonres})")
    _P = None
    import gc as _gc2
    _gc2.collect()

for e in aoi_stream.elements():
    if (KEEP_RES is not None
            and (e.get("tags") or {}).get("highway") == "residential"
            and e.get("id") not in KEEP_RES):
        continue
    t = e.get("tags", {})
    c = CLS.get(t.get("highway", ""))
    g = e.get("geometry")
    if not c or not g or len(g) < 2:
        continue
    _coords = [[q["lon"], q["lat"]] for q in g]
    # 0.72: a road that merely crosses or briefly shares an agency line is kept;
    # one that runs along it for most of its length is the same road twice.
    if c not in SHOW_ONLY and _covered(_coords) >= 0.85:
        osm_dupe += 1
        continue
    # A75. OSM carries the posted route number in `ref` — "M 33", "F-28",
    # "H45", "614" — and we dropped it. That number is how a rider says where
    # they are ("two east of M 33") and it is on every sign; the street name
    # often is not. Multi-value refs arrive semicolon-separated ("M 33;M 72")
    # and are split later, at the point where they are drawn.
    (show if c in SHOW_ONLY else net).append({"c": c, "src": "osm", "auth": "advisory",
                "n": t.get("name"), "ref": (t.get("ref") or "").strip() or None,
                "geometry": {"type": "LineString",
                             "coordinates": [[p["lon"], p["lat"]] for p in g]}})
    osm_n += 1
del rows
import gc as _gc
_gc.collect()
print(f"osm context: {osm_n} added, {osm_dupe} dropped as duplicates of agency geometry ({len(net)} total)")

# ── 3. node the network ────────────────────────────────────────────────────
polys = []
for f in net:
    _lns = list(lines_of(f))
    # Take 117: on the 3 GB build box, keeping BOTH the raw coordinate lists
    # and their noded tuple copies for 200k statewide features was the OOM.
    # Once the rounded copy exists the original is dead weight — drop it.
    f["geometry"] = None
    for ln in _lns:
        pts = [(round(float(p[0]), 6), round(float(p[1]), 6))
               for p in ln if len(p) >= 2]
        ded = [pts[0]] + [p for i, p in enumerate(pts[1:], 1) if p != pts[i - 1]]
        if len(ded) >= 2:
            polys.append((f, ded))
import gc
gc.collect()

touch = defaultdict(set)
for pi, (_, pts) in enumerate(polys):
    for p in pts:
        touch[key(p)].add(pi)

junction = {k for k, s in touch.items() if len(s) >= 2}
for _, pts in polys:
    junction.add(key(pts[0])); junction.add(key(pts[-1]))

nid, nodes = {}, []
def node_at(p):
    k = key(p)
    if k not in nid:
        nid[k] = len(nodes)
        nodes.append(p)
    return nid[k]

edges = []
for f, pts in polys:
    cur, run = node_at(pts[0]), [pts[0]]
    for p in pts[1:]:
        run.append(p)
        if key(p) in junction:
            n2 = node_at(p)
            if n2 != cur:
                L = sum(m(run[i], run[i + 1]) for i in range(len(run) - 1))
                if L > 1:
                    edges.append({"a": cur, "b": n2, "L": L, "c": f["c"],
                                  "n": f.get("n"), "id": f.get("id"),
                                  "src": f["src"], "auth": f.get("auth"),
                                  "st": f.get("st"), "w": f.get("w"),
                                  "moto": f.get("moto"), "atv": f.get("atv"),
                                  "lic": f.get("lic"), "sym": f.get("sym"),
                                  "ref": f.get("ref"),      # A75, take 88
                                  "rst": f.get("rst"),      # A101, take 95
                                  "pts": run[:]})
            cur, run = n2, [p]
print(f"noded: {len(nodes)} nodes, {len(edges)} edges")

# ── 4. pull dangling ends onto nearby junctions ────────────────────────────
deg = Counter()
for e in edges:
    deg[e["a"]] += 1; deg[e["b"]] += 1
ngrid = defaultdict(list)
for i, p in enumerate(nodes):
    ngrid[(int(p[0] / 0.0006), int(p[1] / 0.0006))].append(i)

alias, snapped = {}, 0
for i, p in enumerate(nodes):
    if deg[i] != 1:
        continue
    cx, cy = int(p[0] / 0.0006), int(p[1] / 0.0006)
    best, who = SNAP_M, None
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for j in ngrid.get((cx + dx, cy + dy), ()):
                if j == i or deg[j] < 2:
                    continue
                d = m(p, nodes[j])
                if d < best:
                    best, who = d, j
    if who is not None:
        alias[i] = who; snapped += 1
for e in edges:
    e["a"] = alias.get(e["a"], e["a"])
    e["b"] = alias.get(e["b"], e["b"])
edges = [e for e in edges if e["a"] != e["b"]]
print(f"snapped {snapped} dangling ends within {SNAP_M:.0f} m")

# ── 5. connectivity ────────────────────────────────────────────────────────
par = list(range(len(nodes)))
def find(x):
    while par[x] != x:
        par[x] = par[par[x]]; x = par[x]
    return x
for e in edges:
    ra, rb = find(e["a"]), find(e["b"])
    if ra != rb:
        par[ra] = rb

comp = Counter(find(e["a"]) for e in edges)
big = comp.most_common(1)[0]
tot_mi = sum(e["L"] for e in edges) / 1609.34
big_mi = sum(e["L"] for e in edges if find(e["a"]) == big[0]) / 1609.34
print(f"\ncomponents: {len(comp)}")
print(f"  largest holds {big[1]}/{len(edges)} edges  ({100*big[1]/len(edges):.1f}%)")
print(f"  network {tot_mi:.0f} mi total, {big_mi:.0f} mi ({100*big_mi/tot_mi:.1f}%) routable together")

json.dump({"nodes": nodes, "edges": edges, "main": big[0],
           "par": [find(i) for i in range(len(nodes))]},
          open("graph_raw.json", "w"))
print("\nwrote graph_raw.json")

# ── show-only payload ──────────────────────────────────────────────────────
# Routes that exist but may not be ridden. Simplified hard: they are context, not
# something anyone navigates turn by turn, and they must never reach the router.
def _rdp(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        n = (dx * dx + dy * dy) ** 0.5 or 1e-12
        worst, wi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / n
            if d > worst:
                worst, wi = d, i
        if worst > tol:
            keep[wi] = True
            stack.append((a, wi)); stack.append((wi, b))
    return [q for q, k in zip(pts, keep) if k]


_rows, _pts = [], 0
for r in show:
    g = r.get("geometry") or {}
    if g.get("type") != "LineString":
        continue
    pts = _rdp([(round(c[0], 5), round(c[1], 5)) for c in g["coordinates"]], 0.00012)
    if len(pts) < 2:
        continue
    _pts += len(pts)
    _rows.append({"c": r["c"], "n": (r.get("n") or "")[:34],
                  "u": r.get("use", ""), "g": [[x, y] for x, y in pts]})
_blob = json.dumps({"cls": sorted({r["c"] for r in _rows}), "r": _rows},
                   separators=(",", ":"))
open("other_payload.json", "w").write(_blob)
print(f"show-only payload: {len(_rows)} routes, {_pts} points, "
      f"{len(_blob)/1024:.0f} KB")
