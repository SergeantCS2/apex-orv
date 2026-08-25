"""Terrain ingest.

Public Terrarium-encoded DEM tiles (elevation-tiles-prod, USGS 3DEP over CONUS).
One fetch gives four products: node elevations, per-edge climb, elevation
profiles, and a hillshade. Landmine 20 — encoded DEM and rendered hillshade are
different things from the same source; this makes both.
"""
import io, json, math, os, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageFilter

import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R

Z = 13
# Bulk regions (the whole state) drop to z10: z13 statewide is ~38,000 tiles
# and a 50,000 px mosaic — unfetchable and unholdable. z10 is ~730 tiles and a
# ~6,700 px mosaic (inside the 8192 GPU texture limit, landmine on maxTex),
# ~150 m/px. Elevation reads coarser and SAYS so in the log; the alternative is
# no terrain at all, and terrain is a REQUIRED artifact (take 114).
if R.bulk:
    Z = 10
    print("terrain: bulk region — DEM at z10 (~150 m/px), the statewide trade")
W, S, E, N = R.W, R.S, R.E, R.N
TS = 256
CACHE = "dem_cache"
os.makedirs(CACHE, exist_ok=True)


def deg2tile(lon, lat, z):
    n = 2 ** z
    r = math.radians(lat)
    return (int((lon + 180.0) / 360.0 * n),
            int((1.0 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2.0 * n))


def tile2deg(x, y, z):
    n = 2 ** z
    lon = x / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lon, lat


X0, Y0 = deg2tile(W, N, Z)
X1, Y1 = deg2tile(E, S, Z)
NX, NY = X1 - X0 + 1, Y1 - Y0 + 1

# exact mosaic corners, on tile boundaries, so the hillshade lines up with no fudge
MW, MN = tile2deg(X0, Y0, Z)
ME_, MS = tile2deg(X1 + 1, Y1 + 1, Z)
print(f"mosaic {NX}x{NY} tiles = {NX*TS}x{NY*TS} px")
print(f"extent {MW:.5f},{MS:.5f} -> {ME_:.5f},{MN:.5f}")


def grab(xy):
    x, y = xy
    fp = f"{CACHE}/{Z}_{x}_{y}.png"
    if os.path.exists(fp):
        return xy, Image.open(fp).convert("RGB")
    u = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png"
    for _ in range(3):
        try:
            b = urllib.request.urlopen(u, timeout=60).read()
            open(fp, "wb").write(b)
            return xy, Image.open(io.BytesIO(b)).convert("RGB")
        except Exception:
            pass
    return xy, None


jobs = [(x, y) for x in range(X0, X1 + 1) for y in range(Y0, Y1 + 1)]
mosaic = Image.new("RGB", (NX * TS, NY * TS))
missing = 0
with ThreadPoolExecutor(max_workers=8) as ex:
    for (x, y), im in ex.map(grab, jobs):
        if im is None:
            missing += 1
            continue
        mosaic.paste(im, ((x - X0) * TS, (y - Y0) * TS))
print(f"fetched {len(jobs)-missing}/{len(jobs)} tiles")

# ── decode to metres ────────────────────────────────────────────────────────
import numpy as np

arr = np.asarray(mosaic, dtype=np.float64)
RAW = (arr[:, :, 0] * 256.0 + arr[:, :, 1] + arr[:, :, 2] / 256.0) - 32768.0
Hp, Wp = RAW.shape
lo, hi = float(RAW.min()), float(RAW.max())
print(f"elevation {lo:.0f}..{hi:.0f} m  ({lo*3.28084:.0f}..{hi*3.28084:.0f} ft), relief {hi-lo:.0f} m")


def mercY(lat):
    r = math.radians(lat)
    return (1.0 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2.0


MY0, MY1 = mercY(MN), mercY(MS)


def sample_raw(lon, lat):
    """Bilinear metres at a lon/lat. Mercator-correct in y."""
    fx = (lon - MW) / (ME_ - MW) * (Wp - 1)
    fy = (mercY(lat) - MY0) / (MY1 - MY0) * (Hp - 1)
    fx = min(max(fx, 0.0), Wp - 1.001); fy = min(max(fy, 0.0), Hp - 1.001)
    x0, y0 = int(fx), int(fy)
    tx, ty = fx - x0, fy - y0
    a, b = RAW[y0, x0], RAW[y0, x0 + 1]
    c, d = RAW[y0 + 1, x0], RAW[y0 + 1, x0 + 1]
    return float((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty)


# ── hillshade ───────────────────────────────────────────────────────────────
# Terrarium quantises to 1/256 m and resampled 3DEP carries stair-step noise.
# Shading that raw makes high-frequency speckle JPEG cannot compress -- the first
# attempt came out 724 KB. Blur the ELEVATION, not the shade: fixes the look and
# the file size together. Node sampling still reads RAW, so distances stay honest.
def blur(a, r=2):
    k = np.ones(2 * r + 1) / (2 * r + 1)
    out = np.apply_along_axis(lambda m: np.convolve(m, k, mode="same"), 1, a)
    return np.apply_along_axis(lambda m: np.convolve(m, k, mode="same"), 0, out)


Z_ = blur(RAW, 2)
AZ, ALT = math.radians(315.0), math.radians(45.0)
res = 156543.03392 * math.cos(math.radians((N + S) / 2)) / (2 ** Z) / TS

dzdy, dzdx = np.gradient(Z_, res)
slope = np.arctan(2.4 * np.hypot(dzdx, dzdy))
aspect = np.arctan2(dzdy, -dzdx)
v = (math.sin(ALT) * np.cos(slope) +
     math.cos(ALT) * np.sin(slope) * np.cos(AZ - aspect))
shade = Image.fromarray(np.clip(v * 255, 0, 255).astype(np.uint8), "L")

# 850 px at q58 lands at ~227 KB. This used to be trimmed afterwards by a
# throwaway script, which meant a clean run produced a 428 KB shade nobody
# noticed until take 13 (landmine 32 — no hand steps).
OUT_W = 850
shade = shade.resize((OUT_W, int(OUT_W * Hp / Wp)), Image.LANCZOS)
buf = io.BytesIO()
shade.save(buf, "JPEG", quality=58, optimize=True, progressive=True)
open("hillshade.jpg", "wb").write(buf.getvalue())
print(f"hillshade {shade.size} -> {len(buf.getvalue())/1024:.0f} KB jpeg")

json.dump({"bounds": [MW, MS, ME_, MN], "z": Z,
           "min": lo, "max": hi}, open("dem_meta.json", "w"))

# ── sample the graph ───────────────────────────────────────────────────────
g = json.load(open("graph_payload.json"))


def dec(a):
    p, x, y = [], 0, 0
    for i in range(0, len(a), 2):
        x += a[i]; y += a[i + 1]
        p.append((x / 1e5, y / 1e5))
    return p


nodes = dec(g["n"])
node_elev = [round(sample_raw(p[0], p[1])) for p in nodes]

prof, gain, loss = [], [], []
for k, enc in enumerate(g["g"]):
    pts = dec(enc)
    es = [round(sample_raw(p[0], p[1])) for p in pts]
    up = sum(max(0, es[i] - es[i - 1]) for i in range(1, len(es)))
    dn = sum(max(0, es[i - 1] - es[i]) for i in range(1, len(es)))
    gain.append(up); loss.append(dn)
    d, prev = [], 0
    for e in es:
        d.append(e - prev); prev = e
    prof.append(d)

terr = {"ne": node_elev, "up": gain, "dn": loss, "pf": prof,
        "b": [MW, MS, ME_, MN]}
blob = json.dumps(terr, separators=(",", ":"))
open("terrain_payload.json", "w").write(blob)
print(f"terrain payload {len(blob)/1024:.0f} KB  "
      f"(nodes {len(node_elev)}, edges {len(gain)})")
print(f"total climb across network {sum(gain)*3.28084/1000:.1f}k ft")
