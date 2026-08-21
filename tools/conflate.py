"""How badly do DNR and USFS overlap? Measure it instead of guessing.

Landmine 11 says the same road exists in both sources with different geometry.
Take 5 made that visible at Bull Gap. This puts a number on it.

Method: densify every line to ~20 m spacing, grid-index the DNR points, then for
each USFS point find the nearest DNR point. A USFS sample is "duplicated" if a
DNR line runs within MATCH_M of it. Mileage-weighted, per class.
"""
import json, math
from collections import defaultdict, Counter

MATCH_M = 25.0
STEP_M = 20.0
LAT0 = 44.57
KX = math.cos(math.radians(LAT0))
M_PER_DEG = 111320.0
CELL = 0.0006                      # ~67 m; comfortably larger than MATCH_M


def lines_of(feat):
    g = feat.get("geometry")
    if not g:
        return []
    if g["type"] == "LineString":
        return [g["coordinates"]]
    if g["type"] == "MultiLineString":
        return g["coordinates"]
    return []


def metres(a, b):
    dx = (b[0] - a[0]) * KX * M_PER_DEG
    dy = (b[1] - a[1]) * M_PER_DEG
    return math.hypot(dx, dy)


def densify(pts, step=STEP_M):
    out = []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        d = metres(a, b)
        out.append(a)
        if d > step:
            n = int(d // step)
            for k in range(1, n + 1):
                t = (k * step) / d
                out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    if pts:
        out.append(pts[-1])
    return out


rows = json.load(open("authoritative.json"))
dnr = [r for r in rows if r["src"] == "dnr"]
fs = [r for r in rows if r["src"] == "usfs"]

# ── index every DNR sample point ───────────────────────────────────────────
grid = defaultdict(list)
dnr_pts = 0
for r in dnr:
    for ln in lines_of(r):
        pts = [(float(p[0]), float(p[1])) for p in ln if len(p) >= 2]
        for p in densify(pts):
            grid[(int(p[0] / CELL), int(p[1] / CELL))].append(p)
            dnr_pts += 1

print(f"DNR   {len(dnr):>4} features, {dnr_pts:>6} sample points")
print(f"USFS  {len(fs):>4} features")


def nearest(p):
    cx, cy = int(p[0] / CELL), int(p[1] / CELL)
    best = 1e9
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for q in grid.get((cx + i, cy + j), ()):
                d = metres(p, q)
                if d < best:
                    best = d
    return best


stats = defaultdict(lambda: [0.0, 0.0])   # class -> [matched_m, total_m]
worst = []

for r in fs:
    cls = r["c"]
    for ln in lines_of(r):
        pts = [(float(p[0]), float(p[1])) for p in ln if len(p) >= 2]
        s = densify(pts)
        if len(s) < 2:
            continue
        seg_m = sum(metres(s[i], s[i + 1]) for i in range(len(s) - 1))
        hits = sum(1 for p in s if nearest(p) <= MATCH_M)
        frac = hits / len(s)
        stats[cls][0] += seg_m * frac
        stats[cls][1] += seg_m
        if frac > 0.6 and seg_m > 300:
            worst.append((frac, seg_m / 1609.34, r.get("n"), r.get("id")))

print(f"\nUSFS mileage duplicated by DNR geometry (within {MATCH_M:.0f} m)\n")
tm = td = 0.0
for cls, (m, t) in sorted(stats.items()):
    tm += m; td += t
    print(f"  {cls:<10} {t/1609.34:7.1f} mi total   {m/1609.34:6.1f} mi dup   {100*m/t if t else 0:5.1f}%")
print(f"  {'ALL':<10} {td/1609.34:7.1f} mi total   {tm/1609.34:6.1f} mi dup   {100*tm/td if td else 0:5.1f}%")

worst.sort(reverse=True)
print("\nWorst offenders (>60% duplicated, >300 m):")
for frac, mi, n, i in worst[:10]:
    print(f"  {frac*100:5.1f}%  {mi:5.2f} mi  {(i or '-'):<9} {n}")
print(f"\n  ...{len(worst)} segments total in that category")
