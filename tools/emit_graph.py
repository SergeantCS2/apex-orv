"""Pack the routing graph small enough to inline.

Node coords -> 1e-5 ints. Edge polylines -> RDP at 10 m then delta ints. Names
and trail ids go into dictionaries so a trail mentioned 40 times costs one string.
"""
import json, importlib.util, pathlib

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
         e.get("moto"), e.get("atv"), e.get("lic"), e.get("sym"))
    if all(x is None for x in b):
        return -1
    if b not in bidx:
        bidx[b] = len(bundles); bundles.append(list(b))
    return bidx[b]

E, G = [], []
for e in edges:
    pts = pack.rdp([(float(p[0]), float(p[1])) for p in e["pts"]], TOL)
    if len(pts) < 2:
        pts = [tuple(e["pts"][0]), tuple(e["pts"][-1])]
    E.append([remap[e["a"]], remap[e["b"]], round(e["L"]),
              ci.get(e["c"], 10), name_id(e.get("n")), name_id(e.get("id")),
              bundle_id(e)])
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

out = {"jx": JX, "cls": CLS, "nm": names, "bk": ["src","auth","st","w","moto","atv","lic","sym"],
       "b": bundles, "n": N, "e": E, "g": G}
blob = json.dumps(out, separators=(",", ":"))
pathlib.Path("graph_payload.json").write_text(blob)

coords = sum(len(x) // 2 for x in G)
print(f"nodes {len(used)}  edges {len(E)}  names {len(names)}  bundles {len(bundles)}  coords {coords}")
print(f"graph payload {len(blob)/1024:.0f} KB")
