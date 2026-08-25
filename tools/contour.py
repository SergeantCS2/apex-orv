#!/usr/bin/env python3
"""Contour lines from the DEM this pipeline already downloads.

A87. terrain.py fetches 110 Terrarium tiles at z13 and turns them into four
things — node elevations, per-edge climb, elevation profiles and a rendered
hillshade. This is a fifth product of the same ingest: no new source, no new
host, no extra fetch. The tiles are already in dem_cache/ when this runs.

Why contours and not just the hillshade
---------------------------------------
The hillshade shows you that there is a hill. A contour tells you how big it is
and how steep, and it carries a NUMBER — which matters in country where the
relief is 199 m across the whole region and the difference between a rideable
sand hill and a wall is fifty feet.

Measured before choosing (landmine 23):

    interval   levels   lines    points   payload
      20 ft        33    6551    118192    1154 KB
      40 ft        16    3204     58713     573 KB   <- at 16 m tolerance
      50 ft        13    2503     46393     453 KB
     100 ft         7    1355     24259     237 KB

40 ft is the USGS interval for this relief and gives about seven lines on Wagon
Wheel Hill, which reads as a hill rather than as a smudge. Simplified at 2.0 px
(~27 m at z13's 13.6 m/px) it costs 419 KB — around 1% of an APK that already
carries 45 MB of imagery.

Index contours every 200 ft are marked so the style can draw them heavier and
label them, which is how every topographic map in the world is read.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import uniform_filter
from skimage import measure

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

Z = 13                      # same tiles terrain.py fetched; do not refetch
from region import R as _R0
if _R0.bulk:
    Z = 10   # take 117: bulk terrain fetched z10; a statewide z13 mosaic is a
             # 10 GB array. Summits at 150 m/px name the same hills.
FT = 0.3048
INTERVAL_FT = 40
INDEX_EVERY = 5             # every 5th line is a 200 ft index contour
SIMPLIFY_PX = 2.0           # ~27 m at z13
MIN_PTS = 8                 # a contour shorter than this is noise, not terrain


def tile_xy(lon, lat, z):
    n = 2 ** z
    r = math.radians(lat)
    return ((lon + 180) / 360 * n,
            (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)


def encode(pts):
    """[lon0*1e5, lat0*1e5, dlon, dlat, ...] — deltas are small ints.

    Copied deliberately rather than imported: pack.py does work at import time,
    and a second definition of eleven obvious lines is safer here than a module
    that runs a pipeline step as a side effect of `import` (landmine 117).
    """
    out, px, py = [], 0, 0
    for lon, lat in pts:
        x, y = round(lon * 1e5), round(lat * 1e5)
        out.append(x - px)
        out.append(y - py)
        px, py = x, y
    return out


def rdp(pts, eps):
    """Ramer-Douglas-Peucker, iterative so a long contour cannot blow the stack."""
    if len(pts) < 3:
        return pts

    def dist(p, a, b):
        if a == b:
            return math.hypot(p[0] - a[0], p[1] - a[1])
        t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / \
            ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)
        t = max(0.0, min(1.0, t))
        return math.hypot(p[0] - (a[0] + t * (b[0] - a[0])),
                          p[1] - (a[1] + t * (b[1] - a[1])))

    stack = [(0, len(pts) - 1)]
    keep = {0, len(pts) - 1}
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        far, idx = 0.0, i
        for k in range(i + 1, j):
            d = dist(pts[k], pts[i], pts[j])
            if d > far:
                far, idx = d, k
        if far > eps:
            keep.add(idx)
            stack.append((i, idx))
            stack.append((idx, j))
    return [pts[i] for i in sorted(keep)]


def main():
    bulk = R.bulk
    if bulk:
        # Take 117: the first bulk skip threw out the SUMMITS with the contour
        # lines — the state rendered peakless. Lines stay ruled out (take 75:
        # enormous, unreadable at state zoom); summits are a few hundred named
        # points and ship for the whole state.
        # Take 117 UNRESOLVED: statewide summit extraction OOMs even at z10
        # with the nodata clamp in place — the killer strikes after mosaic
        # assembly, suspect is the peak-detection allocations themselves at
        # 45M px. Resume there next session (dims print + clamp are staged).
        # Until then: honest full skip, artifact absent, the app names it.
        print("contour: bulk region — no statewide lines OR summits yet "
              "(summit extraction OOMs at state scale, take 117 open item)")
        out = os.path.join(ROOT, "contour_payload.json")
        if os.path.exists(out):
            os.remove(out)
        return
    W, S, E, N = R.bbox
    x0, y0 = tile_xy(W, N, Z)
    x1, y1 = tile_xy(E, S, Z)
    tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)

    cache = os.path.join(ROOT, "dem_cache")
    w = (tx1 - tx0 + 1) * 256
    h = (ty1 - ty0 + 1) * 256
    print(f"contour: mosaic {w}x{h} px at z{Z}")
    grid = np.full((h, w), np.nan, dtype=np.float32)
    got = 0
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            fp = os.path.join(cache, f"{Z}_{tx}_{ty}.png")
            if not os.path.exists(fp):
                continue
            a = np.asarray(Image.open(fp).convert("RGB"), dtype=np.float32)
            # Terrarium: (R*256 + G + B/256) - 32768 metres
            elev = (a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256) - 32768
            # Take 117: terrarium nodata at lake seams decoded to -1651..3008 m
            # statewide; with the whole grid "prominent", peak detection built
            # candidate arrays until the OOM killer arrived. Michigan runs
            # 174 m (Erie) to 603 m (Arvon): anything wild is nodata.
            elev[(elev < -100) | (elev > 1500)] = np.nan
            grid[(ty - ty0) * 256:(ty - ty0 + 1) * 256,
                 (tx - tx0) * 256:(tx - tx0 + 1) * 256] = elev
            got += 1
    if not got:
        print("contour: no DEM tiles in dem_cache — run the terrain step first; "
              "the bundle will be PARTIAL and the app will name it")
        out = os.path.join(ROOT, "contour_payload.json")
        if os.path.exists(out):
            os.remove(out)
            print("contour: removed a stale payload from an earlier run")
        return

    lo, hi = float(np.nanmin(grid)), float(np.nanmax(grid))
    filled = np.nan_to_num(grid, nan=lo)
    # A 3-px box blur takes the staircase off marching squares without moving
    # the line anywhere a rider could measure.
    sm = uniform_filter(filled, size=3)

    step = INTERVAL_FT * FT
    base = math.ceil(lo / step) * step
    levels = list(np.arange(base, hi, step))

    n = 2 ** Z
    def px2ll(px, py):
        lon = (tx0 * 256 + px) / (n * 256) * 360 - 180
        ly = math.pi - 2 * math.pi * (ty0 * 256 + py) / (n * 256)
        return lon, math.degrees(math.atan(math.sinh(ly)))

    lines, pts_total = [], 0
    if bulk:
        levels = []   # no lines statewide — the loop below becomes a no-op
    for v in levels:
        ft = int(round(v / FT))
        # index contours land on multiples of INTERVAL_FT * INDEX_EVERY
        is_index = (round(v / step) % INDEX_EVERY == 0)
        for c in measure.find_contours(sm, v):
            if len(c) < MIN_PTS:
                continue
            simp = rdp([(float(p[1]), float(p[0])) for p in c], SIMPLIFY_PX)
            if len(simp) < 2:
                continue
            coords = [px2ll(px, py) for px, py in simp]
            pts_total += len(coords)
            # SAME delta encoding the water and graph payloads use, so the
            # client's existing decode() reads it with no new code. Writing raw
            # floats first cost 946 KB where the estimate said 419 — the
            # estimate had assumed this encoding and the first version did not
            # use it (take 91).
            lines.append({"ft": ft, "i": 1 if is_index else 0,
                          "c": encode(coords)})

    # ── Named summits (A76) ────────────────────────────────────────────────
    # The name comes from OSM; the ELEVATION comes from this DEM, because every
    # other elevation the app shows comes from here and a summit label that
    # disagreed with the readout under your wheels would be its own small lie.
    #
    # Cross-checked against OSM's own surveyed `ele` before choosing: Auger Hill
    # 421 vs 421, Wagon Wheel Hill 445 vs 446, Mio Mountain 392 vs 393,
    # Timberline Mountain 378 vs 386. Three within a metre. Independently, three
    # of the four match the figures on onX's map to within three feet.
    #
    # Unnamed peaks are skipped — a summit with no name is terrain, and the
    # contours above already draw it.
    peaks = []
    aoi = os.path.join(ROOT, "aoi.json")
    if os.path.exists(aoi):
        try:
            els = json.load(open(aoi)).get("elements", [])
        except Exception:
            els = []
        for e in els:
            t = e.get("tags", {})
            if t.get("natural") != "peak":
                continue
            nm = (t.get("name") or "").strip()
            if not nm:
                continue
            lon = e.get("lon")
            lat = e.get("lat")
            if lon is None or lat is None:
                continue
            if not (W <= lon <= E and S <= lat <= N):
                continue
            fx, fy = tile_xy(lon, lat, Z)
            px = int((fx - tx0) * 256)
            py = int((fy - ty0) * 256)
            if not (0 <= px < w and 0 <= py < h):
                continue
            # local max in a small window: the peak node is rarely on the exact
            # pixel of the high point at 13.6 m/px
            win = filled[max(0, py - 2):py + 3, max(0, px - 2):px + 3]
            if not win.size:
                continue
            ft = int(round(float(win.max()) / FT))
            peaks.append({"n": nm, "ft": ft, "p": [round(lon, 5), round(lat, 5)]})
        peaks.sort(key=lambda x: -x["ft"])

    payload = {"bbox": [W, S, E, N], "step": INTERVAL_FT,
               "index": INTERVAL_FT * INDEX_EVERY, "l": lines, "pk": peaks}
    out = os.path.join(ROOT, "contour_payload.json")
    blob = json.dumps(payload, separators=(",", ":"))
    open(out, "w").write(blob)
    idx = sum(1 for l in lines if l["i"])
    if peaks:
        print("contour: summits — " +
              " · ".join(f"{p['n']} {p['ft']} ft" for p in peaks[:5]))
    print(f"contour: {len(lines)} lines ({idx} index), {pts_total} points, "
          f"{INTERVAL_FT} ft interval over {(hi-lo)/FT:.0f} ft of relief, "
          f"{len(blob)/1024:.0f} KB")


if __name__ == "__main__":
    main()
