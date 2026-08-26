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

# Take 117: float64 RGB of a statewide mosaic is 1.1 GB before the elevation
# math starts — the OOM killer took it on the 3 GB build box. uint8 view +
# channel-wise float32 decode: same numbers, a quarter of the memory.
arr = np.asarray(mosaic, dtype=np.uint8)
del mosaic
RAW = (arr[:, :, 0].astype(np.float32) * np.float32(256.0)
       + arr[:, :, 1].astype(np.float32)
       + arr[:, :, 2].astype(np.float32) / np.float32(256.0)) - np.float32(32768.0)
del arr
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
# Take 126: statewide the 850 px shade is 7.5x downsampled from 6400 px of
# z10 tiles — upscaled to a 5-mile view it is grey blotches (Jacob, 24416).
# 4096 px is every GPU's minimum texture size (the Fold reports 8192); the
# box keeps 850, which was already native there.
if R.bulk:
    OUT_W = 4096
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


# ── riding-area patches (take 120) ─────────────────────────────────────────
# The statewide z10 DEM is the trade (150 m/px); the Fold's self-test then
# read Bull Gap 49 ft high while Mio and the Pink Store were within 10 ft —
# a sharp sand hill is exactly what 150 m/px flattens. The state keeps z10;
# every DNR scramble area (areas_payload.json, which now runs before this
# step) gets a z13 patch — the area's bbox plus ~4 km, so the trails around
# the hill are covered, not just the polygon — and any node or profile point
# inside a patch samples the patch. ~50 tiles for the whole state instead of
# 45,000. Absent-safe: no areas artifact, no patches, same result as before.
PATCH_Z, PAD = 13, 0.045
PATCHES = []
def _grab_z(z, x, y):
    fp = f"{CACHE}/{z}_{x}_{y}.png"
    if not os.path.exists(fp):
        u = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
        for _ in range(3):
            try:
                open(fp, "wb").write(urllib.request.urlopen(u, timeout=60).read())
                break
            except Exception:
                pass
    if not os.path.exists(fp):
        return None
    a = np.asarray(Image.open(fp).convert("RGB"), dtype=np.float32)
    return a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768

def _build_patches():
    if not R.bulk or not os.path.exists("areas_payload.json"):
        return
    areas = json.load(open("areas_payload.json")).get("a", [])
    ntiles = 0
    for ar in areas:
        xs = [pt[0] for ring in ar["g"] for pt in ring]
        ys = [pt[1] for ring in ar["g"] for pt in ring]
        w, s_, e, n = min(xs) - PAD, min(ys) - PAD, max(xs) + PAD, max(ys) + PAD
        x0, y0 = deg2tile(w, n, PATCH_Z); x1, y1 = deg2tile(e, s_, PATCH_Z)
        rows = []
        ok = True
        for ty in range(y0, y1 + 1):
            row = []
            for tx in range(x0, x1 + 1):
                t = _grab_z(PATCH_Z, tx, ty)
                if t is None:
                    ok = False
                    break
                row.append(t)
                ntiles += 1
            if not ok:
                break
            rows.append(np.hstack(row))
        if not ok:
            print(f"terrain: patch {ar['n']} — a z13 tile failed, area keeps z10")
            continue
        raw = np.vstack(rows)
        raw[(raw < -100) | (raw > 1500)] = np.nan   # nodata clamp (take 117)
        pw, pn = tile2deg(x0, y0, PATCH_Z)
        pe, ps = tile2deg(x1 + 1, y1 + 1, PATCH_Z)
        PATCHES.append({"n": ar["n"], "raw": raw, "w": pw, "e": pe, "s": ps, "n_": pn,
                        "my0": mercY(pn), "my1": mercY(ps)})
    print(f"terrain: {len(PATCHES)} riding-area z13 patch(es) from {ntiles} tiles — "
          + ", ".join(p["n"] for p in PATCHES))

def sample_at(lon, lat):
    for P in PATCHES:
        if P["w"] <= lon <= P["e"] and P["s"] <= lat <= P["n_"]:
            raw = P["raw"]; Hq, Wq = raw.shape
            fx = (lon - P["w"]) / (P["e"] - P["w"]) * (Wq - 1)
            fy = (mercY(lat) - P["my0"]) / (P["my1"] - P["my0"]) * (Hq - 1)
            fx = min(max(fx, 0.0), Wq - 1.001); fy = min(max(fy, 0.0), Hq - 1.001)
            x0, y0 = int(fx), int(fy); tx, ty = fx - x0, fy - y0
            a, b = raw[y0, x0], raw[y0, x0 + 1]; c, d = raw[y0 + 1, x0], raw[y0 + 1, x0 + 1]
            v = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
            if not np.isnan(v):
                return float(v)
            break   # nodata inside the patch: fall through to z10
    return sample_raw(lon, lat)

_build_patches()

nodes = dec(g["n"])
node_elev = [round(sample_at(p[0], p[1])) for p in nodes]

prof, gain, loss = [], [], []
for k, enc in enumerate(g["g"]):
    pts = dec(enc)
    es = [round(sample_at(p[0], p[1])) for p in pts]
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
