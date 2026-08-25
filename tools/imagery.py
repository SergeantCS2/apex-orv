"""Satellite imagery: measure the real budget, then build a basemap.

USGS ImageryOnly is public domain and NAIP-derived (landmine 22 — Esri, Google,
Bing and Mapbox imagery are licensed and cannot be redistributed offline).

Imagery is the size driver for the whole project, and A8 had only arithmetic
behind it. This measures.
"""
import io, json, math, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R

W, S, E, N = R.W, R.S, R.E, R.N

URL = ("https://basemap.nationalmap.gov/arcgis/rest/services/"
       "USGSImageryOnly/MapServer/tile/{z}/{y}/{x}")
CACHE = "img_cache"
os.makedirs(CACHE, exist_ok=True)


def t_xy(lon, lat, z):
    n = 2 ** z
    r = math.radians(lat)
    return (int((lon + 180) / 360 * n),
            int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n))


def t_deg(x, y, z):
    n = 2 ** z
    return (x / n * 360 - 180,
            math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n)))))


def span(z):
    x0, y0 = t_xy(W, N, z)
    x1, y1 = t_xy(E, S, z)
    return x0, y0, x1, y1, (x1 - x0 + 1), (y1 - y0 + 1)


def fetch(z, x, y):
    fp = f"{CACHE}/{z}_{x}_{y}.jpg"
    if os.path.exists(fp):
        return open(fp, "rb").read()
    for _ in range(3):
        try:
            b = urllib.request.urlopen(URL.format(z=z, x=x, y=y), timeout=60).read()
            open(fp, "wb").write(b)
            return b
        except Exception:
            pass
    return None


def budget():
    """Sample real tiles at each zoom, report the AOI cost and extrapolate."""
    AOI_KM2 = (abs(E - W) * 111.32 * math.cos(math.radians((N + S) / 2))
               * abs(N - S) * 111.32)
    MI_KM2 = 250_493.0
    print(f"AOI {AOI_KM2:.0f} km2  ({W},{S} -> {E},{N})\n")
    print(f"  {'z':>3} {'m/px':>7} {'tiles':>9} {'sampled KB':>11} {'AOI':>10} {'statewide':>11}")
    rows = {}
    for z in (12, 13, 14, 15, 16, 17):
        x0, y0, x1, y1, nx, ny = span(z)
        n = nx * ny
        mpp = 156543.03392 * math.cos(math.radians((N + S) / 2)) / (2 ** z)
        # sample 5 tiles spread across the AOI rather than trusting one
        picks = [(x0 + (x1 - x0) * i // 4, y0 + (y1 - y0) * j // 4)
                 for i, j in ((0, 0), (2, 1), (2, 3), (4, 2), (1, 4))]
        got = [fetch(z, x, y) for x, y in picks]
        got = [g for g in got if g]
        avg = sum(len(g) for g in got) / len(got) / 1024 if got else 0
        aoi_mb = n * avg / 1024
        state_gb = aoi_mb * (MI_KM2 / AOI_KM2) / 1024
        rows[z] = dict(tiles=n, kb=round(avg, 1), aoi_mb=round(aoi_mb, 1),
                       state_gb=round(state_gb, 1), mpp=round(mpp, 2))
        print(f"  {z:>3} {mpp:>7.2f} {n:>9,} {avg:>11.1f} "
              f"{aoi_mb:>8.0f} MB {state_gb:>8.1f} GB")
    json.dump(rows, open("imagery_budget.json", "w"), indent=1)
    return rows


def mosaic(z, out_w=1500, quality=62):
    x0, y0, x1, y1, nx, ny = span(z)
    print(f"\nfetching z{z}: {nx}x{ny} = {nx*ny} tiles")
    im = Image.new("RGB", (nx * 256, ny * 256))
    jobs = [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
    ok = 0

    def one(j):
        x, y = j
        return j, fetch(z, x, y)

    with ThreadPoolExecutor(max_workers=10) as ex:
        for (x, y), b in ex.map(one, jobs):
            if not b:
                continue
            try:
                im.paste(Image.open(io.BytesIO(b)).convert("RGB"),
                         ((x - x0) * 256, (y - y0) * 256))
                ok += 1
            except Exception:
                pass
    print(f"  {ok}/{len(jobs)} tiles")
    mw, mn = t_deg(x0, y0, z)
    me, ms = t_deg(x1 + 1, y1 + 1, z)
    sm = im.resize((out_w, int(out_w * im.size[1] / im.size[0])), Image.LANCZOS)
    buf = io.BytesIO()
    sm.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    open("imagery.jpg", "wb").write(buf.getvalue())
    json.dump({"b": [mw, ms, me, mn], "z": z, "src": ok, "of": len(jobs)},
              open("imagery_meta.json", "w"))
    print(f"  mosaic {sm.size} -> {len(buf.getvalue())/1024:.0f} KB jpeg")
    print(f"  extent {mw:.5f},{ms:.5f} -> {me:.5f},{mn:.5f}")


def tiles(zmax):
    """Emit real map tiles, so MapLibre streams only what is on screen.

    The mosaic approach threw away most of what it downloaded: it fetched native
    z14 (6.8 m/px) and squashed the whole AOI into one 1500 px JPEG — 22.1 m/px,
    where a two-track is a metre wide. Jacob stopped using the satellite layer
    because of it, which is the correct response to a map you can count the
    pixels of.

    Tiles cost more on disk but bound the MEMORY: only visible tiles are decoded,
    so z15 over the whole region is affordable where a single 9728 px image
    would not even fit in a texture. Measured at 21.3 KB/tile:
        z12-z14  11 MB   6.8 m/px
        z12-z15  41 MB   3.4 m/px   <- individual trails
        z12-z16 158 MB   1.7 m/px
    """
    if R.bulk:
        print('imagery: bulk region — the z12+ tile pyramid was measured impossible statewide at take 75 (8.6 GB at z15); the low-zoom underlay ships, the pyramid does not, and Hybrid says so')
        return

    root = "imagery_tiles"
    if os.path.isdir(root):
        import shutil
        shutil.rmtree(root)
    total = bytes_ = 0
    for z in range(12, zmax + 1):
        x0, y0, x1, y1, nx, ny = span(z)
        jobs = [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
        got = 0

        def one(j):
            x, y = j
            return j, fetch(z, x, y)

        with ThreadPoolExecutor(max_workers=10) as ex:
            for (x, y), b in ex.map(one, jobs):
                if not b:
                    continue
                d = os.path.join(root, str(z), str(x))
                os.makedirs(d, exist_ok=True)
                open(os.path.join(d, f"{y}.jpg"), "wb").write(b)
                got += 1
                bytes_ += len(b)
        total += got
        print(f"  z{z}: {got}/{len(jobs)} tiles")
    mb = bytes_ / 1048576
    json.dump({"zmin": 12, "zmax": zmax, "tiles": total,
               "bytes": bytes_}, open("imagery_tiles.json", "w"))
    print(f"tiles: {total} files, {mb:.1f} MB, z12-z{zmax} "
          f"({156543.03 * math.cos(math.radians((S + N) / 2)) / (2 ** zmax):.2f} m/px)")


if __name__ == "__main__":
    budget()
    mosaic(R.imagery_zoom)
    tiles(R.imagery_max_zoom)
