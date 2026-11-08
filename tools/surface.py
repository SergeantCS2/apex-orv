"""take 197 · A10 · what OpenStreetMap records about a trail's surface.

The maintainer approved the design 2026-11-05 (AGENDA A10): the trail card
says "Surface: sand (OpenStreetMap)" where a mapper recorded it and "Surface
not recorded" where none did; DNR's own fields are ruled out (SurfaceType
reads "Dirt Natural" on every record, TrailTreadType is null on every one).

Two ways a graph record gets a surface:
  - an OSM road or track carries its own `surface` tag;
  - an agency (DNR or USFS) line inherits the tag of the OSM way graph.py
    drops as its duplicate (graph.py's _covered: 85% of the OSM way's points
    on cells the agency line occupies). The dropped way's cells are kept in
    a small table, cell -> the surfaces recorded there, and an agency line
    takes the value most of its own vertices sit on. Two values that split
    it are both said ("sand; dirt"), never one picked.

Only surfaces OSM records are said. A line no dropped duplicate covers,
or one covered on fewer than half its vertices, has none.
"""
from collections import Counter

CELL = 0.00015            # graph.py's _CELL: the same grid its duplicate test uses
MIN_SHARE = 0.5           # of an agency line's vertices that must sit on surfaced cells
MAX_LEN = 40              # a tag value longer than this is not a surface word


def clean(v):
    """OSM's value, trimmed; None for nothing. Several values (OSM writes
    them `a;b`) are kept as written, spaced."""
    if not v:
        return None
    v = str(v).strip()
    if not v or len(v) > MAX_LEN:
        return None
    return "; ".join(x.strip() for x in v.split(";") if x.strip()) or None


def cells(coords, cell=CELL):
    out = []
    for p in coords:
        try:
            out.append((int(p[0] / cell), int(p[1] / cell)))
        except Exception:
            pass
    return out


def collect(table, coords, value):
    """A dropped OSM duplicate with a surface: its cells remember the value."""
    v = clean(value)
    if not v:
        return 0
    n = 0
    for c in cells(coords):
        s = table.get(c, ())
        if v not in s:
            table[c] = s + (v,)        # a tuple: no separator a tag could hold
        n += 1
    return n


def _flat(geom):
    cs = (geom or {}).get("coordinates") or []
    if (geom or {}).get("type") == "MultiLineString":
        cs = [q for part in cs for q in part]
    return cs


def assign(records, table):
    """Give each agency record the surface its vertices sit on. Returns how
    many records got one. Records already carrying a surface keep it."""
    got = 0
    if not table:
        return 0
    for r in records:
        if r.get("src") == "osm" or r.get("sf"):
            continue
        cs = cells(_flat(r.get("geometry")))
        if not cs:
            continue
        votes, hit = Counter(), 0
        for c in cs:
            s = table.get(c)
            if s:
                hit += 1
                for v in s:
                    votes[v] += 1.0 / len(s)   # a shared cell is one vote, split
        if hit < MIN_SHARE * len(cs) or not votes:
            continue
        top = votes.most_common(2)
        if len(top) == 2 and top[1][1] >= 0.5 * top[0][1]:
            r["sf"] = top[0][0] + "; " + top[1][0]       # split: both said
        else:
            r["sf"] = top[0][0]
        got += 1
    return got
