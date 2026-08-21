"""One region definition, read by every tool.

Take 14: the AOI was hardcoded in ten places across seven files, so adding a
riding area meant a coordinated edit nobody would get right twice. Same class of
problem as landmine 32 — state that has to be kept in sync by hand.

  from region import R
  R.bbox, R.name, R.id, R.overpass_bbox, R.anchors

Selected by --region, $APEX_REGION, or the default in regions.json.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_CFG = json.load(open(os.path.join(ROOT, "regions.json")))


def known(rid):
    return rid in _CFG["regions"]


def _pick():
    for i, a in enumerate(sys.argv):
        if a == "--region" and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
        if a.startswith("--region="):
            return a.split("=", 1)[1]
    return os.environ.get("APEX_REGION") or _CFG["default"]


class Region:
    def __init__(self, rid):
        if rid not in _CFG["regions"]:
            # Raise, do not sys.exit. A SystemExit at import time takes the gate
            # down with it, so a bad default produced no diagnostic at all —
            # the check existed and could never report (take 14).
            raise ValueError(f"unknown region {rid!r}; known: "
                             f"{', '.join(_CFG['regions'])}")
        self.id = rid
        d = _CFG["regions"][rid]
        self.name = d["name"]
        self.note = d.get("note", "")
        self.bbox = d["bbox"]                       # W, S, E, N
        self.W, self.S, self.E, self.N = self.bbox
        self.imagery_zoom = d.get("imagery_zoom", 14)
        # tiles are shipped z12..imagery_max_zoom; 15 is ~41 MB and 3.4 m/px
        self.imagery_max_zoom = d.get("imagery_max_zoom", 15)
        self.centre = d.get("centre", [(self.W + self.E) / 2, (self.S + self.N) / 2])
        self.anchors = d.get("anchors", [])
        self.state = d.get("state")

    @property
    def overpass_bbox(self):
        """Overpass wants S,W,N,E — the one ordering that is not W,S,E,N."""
        return (self.S, self.W, self.N, self.E)

    @property
    def esri_envelope(self):
        return f"{self.W},{self.S},{self.E},{self.N}"

    def __repr__(self):
        return f"<{self.id} {self.name} {self.bbox}>"


ALL = list(_CFG["regions"])
BAD_DEFAULT = None
try:
    R = Region(_pick())
except ValueError as _e:
    # Fall back so tooling can still load and *report* the problem.
    BAD_DEFAULT = str(_e)
    R = Region(ALL[0])


# Derived artifacts live in the working directory without a region in the name,
# and several steps skip when their output already exists. Building region B
# straight after region A therefore silently mixed A's OSM data into B's graph —
# the landmine 32 pattern again, an artifact outliving the run that made it.
#
# The marker makes the workspace single-region: switch, and everything derived
# is cleared first.
DERIVED = ["aoi.json", "authoritative.json", "graph_raw.json",
           "graph_payload.json", "terrain_payload.json", "water_payload.json",
           "glyphs_payload.json", "imagery_meta.json", "imagery_budget.json",
           "hillshade.jpg", "imagery.jpg", "payload.json"]


def ensure_workspace(rid=None, quiet=False):
    rid = rid or R.id
    mark = os.path.join(ROOT, ".region")
    prev = open(mark).read().strip() if os.path.exists(mark) else None
    if prev == rid:
        return False
    wiped = 0
    for f in DERIVED:
        p = os.path.join(ROOT, f)
        if os.path.exists(p):
            os.remove(p)
            wiped += 1
    open(mark, "w").write(rid)
    if not quiet and prev:
        print(f"workspace was {prev}, now {rid} — cleared {wiped} derived artifacts")
    elif not quiet:
        print(f"workspace set to {rid}")
    return True
