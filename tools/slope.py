#!/usr/bin/env python3
"""take 196 · A14 · slope bands over the riding areas, from their z13 DEM alone.

The maintainer approved the design 2026-11-05 (AGENDA A14): "slope shading
only where the ground is sharp". The statewide DEM is z10, about 150 m a
pixel; a sand hill climb is narrower than that, so a statewide slope layer
would read every climb as gentle, a confident wrong answer. terrain.py
already fetches a z13 patch (about 14 m a pixel at this latitude) around
every DNR scramble area. This shades those patches, and nothing else:

  - 15-25 degrees yellow, 25-35 orange, 35 and steeper red; below 15 and
    any pixel the DEM has no value for are transparent, never a guess;
  - slope is measured at the ground's own spacing. A Web Mercator pixel is
    156543.03392 / 2^z metres at the equator, times cos(latitude) on the
    ground, the same in x and y, row by row;
  - one transparent PNG per patch on the patch's own tile-aligned corners,
    so MapLibre lays it with no fudge; slope_payload.json lists them.

terrain.py calls write(PATCHES, PATCH_Z). The CLI (--from-areas) builds the
same patches from an areas file for a local look, fetching the tiles into
dem_cache exactly as terrain.py does.
"""
import hashlib
import io
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = "slope_payload.json"
DIR = "slope"
BANDS = (15, 25, 35)
# RGBA per band (index 0 is transparent): yellow, orange, red, readable over
# the sand map and the satellite alike at the layer's opacity
COLOURS = ((0, 0, 0, 0), (242, 194, 48, 255), (240, 122, 26, 255), (215, 48, 31, 255))
EQ = 156543.03392   # metres a pixel at z0 for 256 px tiles, at the equator


def merc_lat(y):
    """Latitude of a Web Mercator y in [0, 1] (0 at the top)."""
    return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y))))


def merc_y(lat):
    r = math.radians(lat)
    return (1.0 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2.0


def degrees(raw, n_lat, s_lat, z):
    """Slope in degrees for a mercator-row DEM (rows evenly spaced in
    mercator y from n_lat at the top to s_lat at the bottom). NaN stays NaN."""
    h, w = raw.shape
    y0, y1 = merc_y(n_lat), merc_y(s_lat)
    # the rows must be the patch's own: 256 a tile at this zoom across its
    # latitude span (the review of take 196: a resampled or cropped array
    # would measure every slope at the wrong spacing, silently)
    want = (y1 - y0) * 256 * 2 ** z
    if abs(want - h) > 0.5:
        raise ValueError(f"slope: {h} rows for a span of {want:.1f} at z{z}; the DEM is not the patch's own")
    lats = np.array([merc_lat(y0 + (y1 - y0) * (i + 0.5) / h) for i in range(h)])
    res = EQ / (2 ** z) * np.cos(np.radians(lats))          # ground metres a pixel, per row
    dzdy, dzdx = np.gradient(raw.astype(np.float64))
    dzdx = dzdx / res[:, None]
    dzdy = dzdy / res[:, None]
    return np.degrees(np.arctan(np.hypot(dzdx, dzdy)))


def bands(deg):
    """0 below the first band or where there is no value; 1, 2, 3 above."""
    b = np.zeros(deg.shape, dtype=np.uint8)
    ok = ~np.isnan(deg)
    for i, lo in enumerate(BANDS, 1):
        b[ok & (deg >= lo)] = i
    return b


def png(b):
    from PIL import Image
    im = Image.fromarray(b, "P")
    pal = []
    for c in COLOURS:
        pal += list(c[:3])
    im.putpalette(pal + [0, 0, 0] * (256 - len(COLOURS)))
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True, transparency=0)
    return buf.getvalue()


def write(patches, z, root=None):
    """One PNG per patch and the payload naming them; nothing when there are
    no patches (the bundle then carries no slope artifact and the Layers row
    says so). patches: terrain.py's {"n", "raw", "w", "e", "s", "n_"}."""
    root = root or os.getcwd()
    out = os.path.join(root, OUT)
    d = os.path.join(root, DIR)
    if os.path.isdir(d):
        for f in os.listdir(d):
            if f.endswith(".png"):
                os.remove(os.path.join(d, f))
    if not patches:
        if os.path.exists(out):
            os.remove(out)
        print("slope: no z13 patches — no slope bands in this bundle")
        return None
    os.makedirs(d, exist_ok=True)
    rows = []
    for i, P in enumerate(patches):
        deg = degrees(P["raw"], P["n_"], P["s"], z)
        b = bands(deg)
        f = f"{DIR}/{i}.png"
        blob = png(b)
        open(os.path.join(root, f), "wb").write(blob)
        h, w = b.shape
        lat = (P["n_"] + P["s"]) / 2
        cnt = [int((b == k).sum()) for k in range(4)]
        nan = int(np.isnan(deg).sum())
        rows.append({"n": P["n"], "b": [round(P["w"], 6), round(P["s"], 6), round(P["e"], 6), round(P["n_"], 6)],
                     "f": f, "px": [w, h], "h": hashlib.sha256(blob).hexdigest(), "m": round(EQ / 2 ** z * math.cos(math.radians(lat)), 1),
                     "c": cnt[1:], "nd": nan})
        print(f"slope: {P['n']:<30} {w}x{h} px, {rows[-1]['m']} m/px — 15-25° {cnt[1]:,}, 25-35° {cnt[2]:,}, "
              f"35°+ {cnt[3]:,} px; no value {nan:,}; {len(blob) // 1024} KB")
    json.dump({"v": 1, "z": z, "bands": list(BANDS), "p": rows,
               "src": "AWS Terrain Tiles (USGS 3DEP), z13 patches around the DNR scramble areas"},
              open(out, "w"), separators=(",", ":"))
    print(f"slope: {len(rows)} patch(es) -> {OUT} and {DIR}/")
    return rows


def _patches_from_areas(path, z=None, pad=None):
    """A LOCAL LOOK ONLY (CI uses terrain.py's own patches): terrain.py's
    patch boxes (PATCH_Z and PAD read from its source), the tiles read from
    dem_cache or fetched, an area whose tile fails skipped as terrain.py
    skips it."""
    import re
    import urllib.request
    from PIL import Image
    src = open(os.path.join(HERE, "terrain.py")).read()
    m = re.search(r"^PATCH_Z, PAD = (\d+), ([0-9.]+)$", src, re.M)
    if not m:
        sys.exit("slope: terrain.py's PATCH_Z, PAD line not found")
    z = z or int(m.group(1))
    pad = pad if pad is not None else float(m.group(2))
    n2 = 2 ** z

    def tile(lon, lat):
        r = math.radians(lat)
        return int((lon + 180) / 360 * n2), int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n2)

    def deg(x, y):
        return x / n2 * 360 - 180, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n2))))
    os.makedirs("dem_cache", exist_ok=True)

    def grab(x, y):
        fp = f"dem_cache/{z}_{x}_{y}.png"
        if not os.path.exists(fp):
            u = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
            try:
                open(fp, "wb").write(urllib.request.urlopen(u, timeout=60).read())
            except Exception:
                return None
        a = np.asarray(Image.open(fp).convert("RGB"), dtype=np.float32)
        return a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768
    out = []
    for ar in json.load(open(path)).get("a", []):
        xs = [p[0] for ring in ar["g"] for p in ring]
        ys = [p[1] for ring in ar["g"] for p in ring]
        x0, y0 = tile(min(xs) - pad, max(ys) + pad)
        x1, y1 = tile(max(xs) + pad, min(ys) - pad)
        tiles = [[grab(tx, ty) for tx in range(x0, x1 + 1)] for ty in range(y0, y1 + 1)]
        if any(t is None for row in tiles for t in row):
            print(f"slope: {ar['n']} — a z{z} tile failed, no bands for it (as terrain.py)")
            continue
        raw = np.vstack([np.hstack(row) for row in tiles])
        raw[(raw < -100) | (raw > 1500)] = np.nan
        w, n = deg(x0, y0)
        e, s = deg(x1 + 1, y1 + 1)
        out.append({"n": ar["n"], "raw": raw, "w": w, "e": e, "s": s, "n_": n})
    return out, z


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--from-areas":
        ps, z = _patches_from_areas(sys.argv[2])
        write(ps, z)
    else:
        sys.exit(__doc__)
