"""Pack the AOI into the smallest thing that still renders honestly.

Ramer-Douglas-Peucker at ~8 m, coords quantised to 1e-5 (about 1.1 m),
then delta-encoded as integers. Decoded back to GeoJSON in the browser.
"""
import json, os, math, sys

import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R

BBOX = tuple(R.bbox)
LAT0 = (R.S + R.N) / 2
KX = math.cos(math.radians(LAT0))          # lon degrees -> lat-equivalent
TOL_LINE = 8 / 111320                       # ~8 m in degrees of latitude
TOL_POLY = 15 / 111320

CLASS = {
    'motorway': 'paved', 'trunk': 'paved', 'primary': 'paved',
    'secondary': 'paved', 'tertiary': 'paved',
    'unclassified': 'minor', 'residential': 'minor',
    'living_street': 'minor', 'raceway': 'minor',
    'track': 'track',
    'path': 'path', 'bridleway': 'path', 'cycleway': 'path',
}


def rdp(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        ax, ay = pts[i][0] * KX, pts[i][1]
        bx, by = pts[j][0] * KX, pts[j][1]
        dx, dy = bx - ax, by - ay
        den = dx * dx + dy * dy
        best, bi = -1.0, -1
        for k in range(i + 1, j):
            px, py = pts[k][0] * KX, pts[k][1]
            if den == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / den))
                d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if d > best:
                best, bi = d, k
        if best > tol:
            keep[bi] = True
            stack.append((i, bi))
            stack.append((bi, j))
    return [p for p, k in zip(pts, keep) if k]


def encode(pts):
    """[lon0*1e5, lat0*1e5, dlon, dlat, ...] — deltas are small ints."""
    out, px, py = [], 0, 0
    for lon, lat in pts:
        x, y = round(lon * 1e5), round(lat * 1e5)
        out.append(x - px)
        out.append(y - py)
        px, py = x, y
    return out


def main():
    """Water for the basemap. Everything else the app draws comes from the
    routable graph, so this is the only thing still taken straight from OSM.

    Was an ad-hoc snippet until take 13; a clean checkout produced no water at
    all and the bundle silently verified as PARTIAL.
    """
    out = 'water_payload.json'

    def nothing(why):
        """No water is a legitimate outcome. An EMPTY ARTIFACT is not.

        Take 76: this guard used to test only whether aoi.json existed. Take
        56's TIGER fallback WRITES an aoi.json — it just carries no water tags —
        so the guard sailed past, pack wrote a structurally valid empty payload
        (65 bytes of {"l":{"waterway":[],"water":[]}}), and bundle.verify passed
        it on existence, size and hash. The bundle reported COMPLETE while the
        map had no water and the app never named the gap. Landmine 74 in a new
        place, defeating landmine 34.

        A stale payload from an earlier run must go too, or the artifact simply
        survives on disk and the hole reopens (landmines 32, 36).
        """
        print(f"water: {why} Skipping the water layer; the bundle will be "
              f"PARTIAL and the app will name it.")
        if os.path.exists(out):
            os.remove(out)
            print(f"water: removed a stale {out} from an earlier run")

    if not os.path.exists('aoi.json'):
        return nothing("no aoi.json — OSM was unavailable at ingest.")
    aoi = json.load(open('aoi.json'))
    src = aoi.get('source')
    els = aoi['elements']
    buckets = {'waterway': [], 'water': []}
    for e in els:
        geom = e.get('geometry')
        if not geom or len(geom) < 2:
            continue
        t = e.get('tags', {})
        key = ('waterway' if 'waterway' in t
               else 'water' if t.get('natural') == 'water' else None)
        if not key:
            continue
        pts = [(g['lon'], g['lat']) for g in geom]
        pts = rdp(pts, TOL_POLY if key == 'water' else TOL_LINE)
        if key == 'water':
            if len(pts) < 4:
                continue
            if pts[0] != pts[-1]:
                pts.append(pts[0])
        if len(pts) < 2:
            continue
        buckets[key].append(encode(pts))

    if not buckets['water'] and not buckets['waterway']:
        return nothing(
            "aoi.json came from the Census TIGER fallback, which carries no "
            "water at all — OSM is the only source for this layer."
            if src == 'tiger' else
            f"OSM returned no water in this box ({len(els)} elements scanned).")

    blob = json.dumps({'bbox': list(BBOX), 'l': buckets}, separators=(',', ':'))
    open(out, 'w').write(blob)
    print(f"water: {len(buckets['water'])} polys, {len(buckets['waterway'])} lines, "
          f"{len(blob)/1024:.0f} KB")


if __name__ == '__main__':
    main()
