#!/usr/bin/env python3
"""landcover.py — the ground itself (take 113, T2 of the reference study).

The reference study's core finding for the light map: AllTrails' ground is
NEVER one colour — forest and parkland wash in pale green, wetland gets its own
tone, and public land carries a deeper tint. Our tan basemap drew the Huron
National Forest as a desert, and Jacob called it what it was.

This reads the Michigan extract we already hold (the same file corridor.py
reads) and emits polygons in four kinds:

    forest   landuse=forest, natural=wood
    wetland  natural=wetland
    park     leisure=park | nature_reserve | recreation_ground
    public   boundary=protected_area | national_park   (the NF boundary wash)

Multipolygon assembly is pyosmium's area handler — closed ways and relations
both arrive as areas with outer and inner rings, so lakes punched out of forest
stay punched out.

Size discipline: rings are Douglas-Peucker simplified (~25 m) and small slivers
are dropped, because the ground wash needs the SHAPE of the forest, not every
stand boundary. The payload prints its own size and feature count so a bloat
regression is visible in the build log (landmine 172: slow and big report
nothing on their own).
"""
import json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R

OUT = os.path.join(ROOT, "landcover_payload.json")

KINDS = {"forest", "wetland", "park", "public"}
MIN_M2 = {"forest": 30000, "wetland": 25000, "park": 8000, "public": 50000}
# Statewide, the wash needs the SHAPE of the forests, not every stand — at the
# box thresholds Michigan would emit hundreds of thousands of slivers. Bulk
# regions raise the floor ~30x and simplify twice as hard (take 114).
BULK_M2 = {"forest": 1_000_000, "wetland": 800_000, "park": 60_000,
           "public": 500_000}
TOL_DEG = 0.00025          # ~25 m Douglas-Peucker
RND = 5                    # coordinate rounding


def kind_of(tags):
    lu = tags.get("landuse"); na = tags.get("natural"); le = tags.get("leisure")
    bd = tags.get("boundary")
    if lu == "forest" or na == "wood":
        return "forest"
    if na == "wetland":
        return "wetland"
    if le in ("park", "nature_reserve", "recreation_ground"):
        return "park"
    if bd in ("protected_area", "national_park"):
        return "public"
    return None


def ring_area_m2(pts):
    if len(pts) < 4:
        return 0.0
    lat0 = math.radians(sum(p[1] for p in pts) / len(pts))
    kx = 111320 * math.cos(lat0); ky = 111320
    s = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        s += (x1 * kx) * (y2 * ky) - (x2 * kx) * (y1 * ky)
    return abs(s) / 2


def simplify(pts, tol):
    if len(pts) <= 5:
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
        L2 = dx * dx + dy * dy
        worst, wi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L2 == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
                d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if d > worst:
                worst, wi = d, i
        if worst > tol:
            keep[wi] = True
            stack.append((a, wi)); stack.append((wi, b))
    return [p for p, k in zip(pts, keep) if k]


def main():
    w, s, e, n = R.bbox                  # (w, s, e, n)
    bbox = (w, s, e, n)
    bulk = R.bulk
    global TOL_DEG
    mins = BULK_M2 if bulk else MIN_M2
    if bulk:
        TOL_DEG = 0.0005
        print("landcover: bulk region — thresholds raised, simplify 50 m")

    try:
        import osmium
    except Exception:
        print("landcover: osmium unavailable — skipping; the bundle will be "
              "PARTIAL and the app will name it")
        return

    import osm_local
    pbf = osm_local.extract_path(
        json.load(open(os.path.join(ROOT, "regions.json")))
        ["regions"][R.id].get("state", "Michigan"))

    feats = []
    stats = {k: 0 for k in KINDS}
    dropped = {"small": 0, "outside": 0}

    class H(osmium.SimpleHandler):
        def area(self, a):
            k = kind_of(dict((t.k, t.v) for t in a.tags))
            if not k:
                return
            try:
                for outer in a.outer_rings():
                    pts = [(p.lon, p.lat) for p in outer]
                    if len(pts) < 4:
                        continue
                    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
                    if max(xs) < w or min(xs) > e or max(ys) < s or min(ys) > n:
                        dropped["outside"] += 1
                        continue
                    if ring_area_m2(pts) < mins[k]:
                        dropped["small"] += 1
                        continue
                    rings = [simplify(pts, TOL_DEG)]
                    for inner in a.inner_rings(outer):
                        ip = [(p.lon, p.lat) for p in inner]
                        if len(ip) >= 4 and ring_area_m2(ip) > (mins[k]/3):
                            rings.append(simplify(ip, TOL_DEG))
                    g = [[[round(x, RND), round(y, RND)] for x, y in r]
                         for r in rings]
                    feats.append({"k": k, "g": g})
                    stats[k] += 1
            except Exception:
                # a broken multipolygon in OSM is OSM's problem, not a crash
                pass

    H().apply_file(pbf, locations=True, idx="flex_mem")

    payload = {"bbox": list(bbox), "f": feats}
    txt = json.dumps(payload, separators=(",", ":"))
    open(OUT, "w").write(txt)
    verts = sum(len(r) for f in feats for r in f["g"])
    print(f"landcover: {len(feats)} areas "
          f"({', '.join(f'{k} {v}' for k, v in sorted(stats.items()) if v)}) · "
          f"{verts} vertices · {len(txt)//1024} KB · "
          f"dropped {dropped['small']} slivers, {dropped['outside']} outside")


if __name__ == "__main__":
    main()
