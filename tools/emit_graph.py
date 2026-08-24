"""Pack the routing graph small enough to inline.

Node coords -> 1e-5 ints. Edge polylines -> RDP at 10 m then delta ints. Names
and trail ids go into dictionaries so a trail mentioned 40 times costs one string.
"""
import json, importlib.util, math, pathlib

# tools/pack.py, resolved from THIS file. The old absolute path
# /home/claude/pack.py only ever worked because a stray copy happened to sit
# there; a fresh container has no such file and the pipeline dies at step four.
# Landmine 32 wearing an import: an absolute path outside the repo is a hand step.
_HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("pack", _HERE / "pack.py")
pack = importlib.util.module_from_spec(spec); spec.loader.exec_module(pack)
TOL = 10 / 111320

g = json.load(open("graph_raw.json"))
nodes, edges = g["nodes"], g["edges"]

CLS = ["route72", "trail50", "moto24", "mccct", "fstrail", "fsroad",
       "closed", "fsclosed", "paved", "minor", "track"]
ci = {c: i for i, c in enumerate(CLS)}

names, nidx = [], {}
def name_id(s):
    if not s:
        return -1
    if s not in nidx:
        nidx[s] = len(names); names.append(s)
    return nidx[s]

# renumber nodes to only those an edge actually touches
used = sorted({e["a"] for e in edges} | {e["b"] for e in edges})
remap = {n: i for i, n in enumerate(used)}
N = []
px = py = 0
for n in used:
    lon, lat = nodes[n]
    x, y = round(lon * 1e5), round(lat * 1e5)
    N += [x - px, y - py]
    px, py = x, y

# attribute bundles dedupe hard -- a few dozen distinct combinations across 16k edges
bundles, bidx = [], {}
def bundle_id(e):
    b = (e.get("src"), e.get("auth"), e.get("st"), e.get("w"),
         e.get("moto"), e.get("atv"), e.get("lic"), e.get("sym"),
         e.get("rst"))          # A101, take 95 — must match bk below
    if all(x is None for x in b):
        return -1
    if b not in bidx:
        bidx[b] = len(bundles); bundles.append(list(b))
    return bidx[b]

E, G = [], []
# ── A60 · route both, draw one ──────────────────────────────────────────────
# 5,169 cross-source pairs carry the same physical road twice, because two
# agencies mapped it. Jacob: "some paths don't match the road properly" — two
# jagged parallel lines a few metres apart.
#
# Deleting the duplicate is the trap, and take 64 measured why: at 45 m it costs
# 558 miles and drops connectivity 99.7% -> 97.4%, because the two sources have
# different topology and the OSM way bridges gaps the agency geometry leaves. So
# both stay in the graph and BOTH remain routable; only one is drawn.
#
# The predicate is NOT "these lines are close" (landmine 125). At 17 m there are
# 8,103 near-parallel pairs and 2,934 share a source — 861 of those are
# mccct+moto24, the Cross Country Cycle Trail running along a motorcycle trail.
# That is two legal designations on one corridor, not one road drawn twice, and
# hiding either would delete a fact about what a rider may ride. Only pairs from
# DIFFERENT sources are duplicates.
#
# Which copy survives is by priority, never by length: a closure must never be
# hidden, agency line carries legality and closure status that OSM does not, and
# a designated ORV trail says more than the forest road it runs on.
DRAW_RANK = {"closed": 0, "fsclosed": 0,
             "route72": 1, "trail50": 1, "moto24": 1, "mccct": 1, "fstrail": 1,
             "fsroad": 2, "track": 3, "minor": 4, "paved": 5}
DUP_M = 17.0      # take 64's measured-safe distance; 45 m destroys connectivity
DUP_DEG = 20.0


def mark_duplicates(edges):
    """Edge indices that should be ROUTED but not DRAWN."""
    CELL = 0.00045
    info, buck = [], {}
    for i, e in enumerate(edges):
        pts = [(float(p[0]), float(p[1])) for p in e["pts"]]
        if len(pts) < 2:
            info.append(None)
            continue
        a, b = pts[0], pts[-1]
        m = pts[len(pts) // 2]
        brg = math.degrees(math.atan2((b[0] - a[0]) * 0.714, (b[1] - a[1]))) % 180
        info.append((m, brg, e["L"], e.get("c"), e.get("src") or "osm"))
        buck.setdefault((int(m[0] / CELL), int(m[1] / CELL)), []).append(i)

    def metres(p, q):
        return math.hypot((q[0]-p[0])*0.714*69, (q[1]-p[1])*69) * 1609.34

    drop, pairs = set(), 0
    for key, idxs in buck.items():
        cand = list(idxs)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx or dy:
                    cand += buck.get((key[0]+dx, key[1]+dy), [])
        for x in idxs:
            ix = info[x]
            if not ix:
                continue
            for y in cand:
                if y <= x:
                    continue
                iy = info[y]
                if not iy or ix[4] == iy[4]:
                    continue        # same source: a co-designation, not a copy
                da = abs(ix[1] - iy[1]); da = min(da, 180 - da)
                if da > DUP_DEG or metres(ix[0], iy[0]) > DUP_M:
                    continue
                if abs(ix[2] - iy[2]) > max(ix[2], iy[2]) * 0.5 + 80:
                    continue        # very different lengths are not one span
                pairs += 1
                rx = DRAW_RANK.get(ix[3], 9); ry = DRAW_RANK.get(iy[3], 9)
                loser = y if rx <= ry else x
                winner = x if loser == y else y
                # never hide the last drawn copy of a span
                if winner in drop:
                    continue
                drop.add(loser)
    return drop, pairs


DUP, DUP_PAIRS = mark_duplicates(edges)
print(f"duplicates: {DUP_PAIRS} cross-source pairs within {DUP_M:.0f} m, "
      f"{len(DUP)} edges routed but not drawn "
      f"({100.0*len(DUP)/max(1,len(edges)):.1f}% of the network)")

for e in edges:
    pts = pack.rdp([(float(p[0]), float(p[1])) for p in e["pts"]], TOL)
    if len(pts) < 2:
        pts = [tuple(e["pts"][0]), tuple(e["pts"][-1])]
    E.append([remap[e["a"]], remap[e["b"]], round(e["L"]),
              ci.get(e["c"], 10), name_id(e.get("n")), name_id(e.get("id")),
              bundle_id(e),
              # A60: 0 = routable but not drawn. The fact lives WITH the edge it
              # describes rather than in a parallel list that can go missing
              # (landmine 105).
              0 if len(E) in DUP else 1,
              # A75: the posted route number, through the same name dictionary
              # as trail names — 183 distinct strings across 4,470 edges, so a
              # dictionary is far smaller than repeating them.
              name_id(e.get("ref"))])
    G.append(pack.encode(pts))

# Junction descriptors. Michigan posts numbered junction signs but does not
# publish the numbers (A7, closed negative at take 4). Inventing our own would
# produce numbers nobody can check against a post. Naming a junction by the ways
# that meet there is verifiable from the map and from the ground:
#   "Mack - Bull Gap Trail x FR 4460"
from collections import defaultdict as _dd
inc = _dd(list)
for e in edges:
    inc[remap[e["a"]]].append(e); inc[remap[e["b"]]].append(e)
JX = {}
for n, es in inc.items():
    if len(es) < 3:
        continue
    seen, labels = set(), []
    for e in es:
        lab = e.get("n") or e.get("id")
        if lab and lab not in seen:
            seen.add(lab); labels.append(name_id(lab))
    if len(labels) >= 2:
        JX[n] = labels[:3]
print(f"junctions named: {len(JX)}")

out = {"jx": JX, "cls": CLS, "nm": names, "bk": ["src","auth","st","w","moto","atv","lic","sym","rst"],
       "b": bundles, "n": N, "e": E, "g": G}
blob = json.dumps(out, separators=(",", ":"))
pathlib.Path("graph_payload.json").write_text(blob)

coords = sum(len(x) // 2 for x in G)
print(f"nodes {len(used)}  edges {len(E)}  names {len(names)}  bundles {len(bundles)}  coords {coords}")
print(f"graph payload {len(blob)/1024:.0f} KB")
