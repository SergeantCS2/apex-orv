#!/usr/bin/env python3
"""State polygon mask — "is this point in Michigan?", answered in O(1).

Take 122, A156. Every agency layer is fetched with the region's BOUNDING BOX,
and for 118 takes of box-shaped regions a bbox was the region. Statewide, a
rectangle around Michigan holds northern Wisconsin, the Minnesota Arrowhead
and a slice of Ontario, and the USFS MVUM service happily returned 7,413
edges of Lakeland ATV, Price County snowmobile and Superior NF spurs. They
drew on bare white because nothing else — landcover, state fill — extends
past the shoreline, and Jacob photographed the seam.

The polygon is the Census cartographic boundary at 1:500k (context.py draws
the 1:20m one; that is fine for an outline and far too coarse for a keep/drop
call on the shoreline). It is rasterised once with PIL at ~0.004° per pixel
(~350 m), so a vertex test is one array lookup — 1.4 M vertices in well under
a second. Precision is the raster cell, which is comparable to the polygon's
own accuracy, and the caller's rule ("keep a feature if ANY vertex is inside")
errs toward keeping boundary-crossers whole, exactly as Geofabrik treats ways.

Importable and guarded (landmine 201). Cached under auth_cache/ so CI's
region cache carries the file.
"""
import io
import os
import sys
import zipfile
import urllib.request

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R
import context

URL = "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip"
CACHE = "auth_cache"
PX = 0.004          # degrees per raster pixel
_MASK = None        # (arr, W, S, E, N, cols, rows)


def _fetch():
    os.makedirs(CACHE, exist_ok=True)
    fp = os.path.join(CACHE, "cb_2023_us_state_500k.zip")
    if not os.path.exists(fp):
        req = urllib.request.Request(URL, headers={"User-Agent": "APEX-Offroad/1.0"})
        with urllib.request.urlopen(req, timeout=240) as r:
            data = r.read()
        open(fp + ".part", "wb").write(data)
        os.replace(fp + ".part", fp)
    return open(fp, "rb").read()


def state_rings(fips="26"):
    """Every outer ring of the state's polygons, in lon/lat."""
    z = zipfile.ZipFile(io.BytesIO(_fetch()))
    shp = next(n for n in z.namelist() if n.endswith(".shp"))
    dbf = next(n for n in z.namelist() if n.endswith(".dbf"))
    rows = context.parse_dbf(z.read(dbf))
    shapes = context.parse_shp_all(z.read(shp))
    rings = []
    for row, parts in zip(rows, shapes):
        if str(row.get("STATEFP", "")).strip() != fips:
            continue
        rings.extend(parts)
    if not rings:
        raise SystemExit("statemask: no rings for STATEFP %s in %s" % (fips, URL))
    return rings


def mask():
    """Rasterised state polygon over the region bbox. Built once per process."""
    global _MASK
    if _MASK is not None:
        return _MASK
    W, S, E, N = R.bbox
    cols = int((E - W) / PX) + 2
    rows = int((N - S) / PX) + 2
    img = Image.new("1", (cols, rows), 0)
    d = ImageDraw.Draw(img)
    for ring in state_rings():
        pts = [(int((x - W) / PX), int((N - y) / PX)) for x, y in ring]
        if len(pts) >= 3:
            d.polygon(pts, fill=1)
    arr = np.asarray(img, dtype=bool)
    # Dilate ~1 km (3 px). The Census shoreline is generalised and a raster
    # cell is 350 m; without this the first run dropped 82 DNR features that
    # are Michigan beach trails — Tawas Point, Hoffmaster's dunes, the North
    # Country Trail on the Porkies shore. A Wisconsin trail wholly within 1 km
    # of the land border is a tolerable keep; a Michigan beach dropped is not.
    from scipy.ndimage import binary_dilation
    arr = binary_dilation(arr, iterations=3)
    _MASK = (arr, W, S, E, N, cols, rows)
    return _MASK


def inside(lon, lat):
    arr, W, S, E, N, cols, rows = mask()
    if not (W <= lon <= E and S <= lat <= N):
        return False
    x = int((lon - W) / PX)
    y = int((N - lat) / PX)
    if x < 0 or y < 0 or x >= cols or y >= rows:
        return False
    return bool(arr[y, x])


def _coords(geom):
    """Flat vertex iterator over any GeoJSON geometry."""
    t = geom.get("type")
    c = geom.get("coordinates")
    if t == "Point":
        yield c
    elif t in ("LineString", "MultiPoint"):
        for p in c:
            yield p
    elif t in ("MultiLineString", "Polygon"):
        for part in c:
            for p in part:
                yield p
    elif t == "MultiPolygon":
        for poly in c:
            for part in poly:
                for p in part:
                    yield p


def touches_state(geom):
    """True if ANY vertex is inside the state — boundary-crossers stay whole."""
    for p in _coords(geom or {}):
        if inside(p[0], p[1]):
            return True
    return False


if __name__ == "__main__":
    # Self-test derived from regions.json, never from literals (the gate
    # refuses hardcoded geography — landmine 197 and the take-14 law). Every
    # anchor the region declares must be inside; the bbox corners are outside
    # the state by construction (a rectangle around a mitten has empty corners).
    arr, W, S, E, N = mask()[:5]
    print(f"statemask: {int(arr.sum()):,} land cells ({100 * arr.mean():.1f}% of the bbox)")
    bad = 0
    for a in R.anchors:
        ok = inside(a[1], a[2])
        bad += not ok
        print(f"  anchor {a[0]:18s} {'inside' if ok else 'OUTSIDE  <-- wrong'}")
    for name, lon, lat in (("NW corner", W, N), ("SW corner", W, S),
                           ("NE corner", E, N), ("SE corner", E, S)):
        ok = inside(lon, lat)
        bad += ok
        print(f"  {name:25s} {'OUTSIDE' if not ok else 'inside  <-- wrong'}")
    raise SystemExit(1 if bad else 0)
