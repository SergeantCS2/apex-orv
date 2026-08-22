#!/usr/bin/env python3
"""Measure trail-colour legibility against the REAL backdrop this map draws on.

Take 76. "Vibrant" is an opinion; deltaE against jack pine at 3.4 m/px is a
number. Landmine 67's moral applied to colour: measure the thing, then decide.

What matters is not one contrast figure but four different questions:

  1. Does the tier read as a COLOUR on its own white casing? Designated trail
     sits on a white halo (take 46), so the halo already answers "is there a
     line". Saturation answers "WHICH line", and that contest is against WHITE.
  2. Can the three tiers be told apart from each other at 3 px?
  3. fsroad has NO casing. Its contest is against the canopy directly.
  4. Does the whole trail+halo assembly separate from the backdrop?

CIE76 deltaE on sRGB->Lab. Rules of thumb: dE < 2.3 is a just-noticeable
difference, dE 10 is "clearly different", dE 25+ is "unmistakable at a glance".
"""
import json
import math
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image
import io

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

URL = ("https://basemap.nationalmap.gov/arcgis/rest/services/"
       "USGSImageryOnly/MapServer/tile/{z}/{y}/{x}")
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "img_cache")

# Bull Gap region, from regions.json. Read rather than hardcoded so the gate's
# no-literal-coordinates rule is not violated by a tool.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_CFG = json.load(open(os.path.join(ROOT, "regions.json")))
W, S, E, N = _CFG["regions"]["neml-bullgap"]["bbox"]


def t_xy(lon, lat, z):
    n = 2 ** z
    r = math.radians(lat)
    return (int((lon + 180) / 360 * n),
            int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n))


def fetch(z, x, y):
    fp = os.path.join(CACHE, f"{z}_{x}_{y}.jpg")
    if os.path.exists(fp):
        return open(fp, "rb").read()
    try:
        b = urllib.request.urlopen(URL.format(z=z, x=x, y=y), timeout=60).read()
        os.makedirs(CACHE, exist_ok=True)
        open(fp, "wb").write(b)
        return b
    except Exception:
        return None


# ── colour maths ────────────────────────────────────────────────────────────
def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)


def srgb_lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def rgb_lab(rgb):
    """rgb: (...,3) 0-255 -> Lab. D65."""
    lin = srgb_lin(np.asarray(rgb, dtype=float))
    M = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    xyz = lin @ M.T
    wp = np.array([0.95047, 1.0, 1.08883])
    t = xyz / wp
    d = 6.0 / 29.0
    f = np.where(t > d ** 3, np.cbrt(t), t / (3 * d * d) + 4.0 / 29.0)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def dE(c1, c2):
    return float(np.sqrt(np.sum((rgb_lab(c1) - rgb_lab(c2)) ** 2, axis=-1)))


def rel_lum(rgb):
    lin = srgb_lin(np.asarray(rgb, dtype=float))
    return float(np.dot(lin, [0.2126, 0.7152, 0.0722]))


def wcag(c1, c2):
    a, b = rel_lum(c1), rel_lum(c2)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def composite(fg, bg, alpha):
    return np.asarray(fg, dtype=float) * alpha + np.asarray(bg, dtype=float) * (1 - alpha)


# ── the backdrop ────────────────────────────────────────────────────────────
def sample_backdrop(z=15, n=16):
    """Real pixels from the tiles this region actually ships."""
    x0, y0 = t_xy(W, N, z)
    x1, y1 = t_xy(E, S, z)
    picks = []
    for i in range(4):
        for j in range(4):
            picks.append((x0 + (x1 - x0) * i // 3, y0 + (y1 - y0) * j // 3))
    picks = picks[:n]
    px = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for b in ex.map(lambda t: fetch(z, t[0], t[1]), picks):
            if not b:
                continue
            try:
                im = Image.open(io.BytesIO(b)).convert("RGB")
                px.append(np.asarray(im, dtype=float).reshape(-1, 3))
            except Exception:
                pass
    if not px:
        sys.exit("no imagery sampled — cannot measure")
    a = np.concatenate(px, axis=0)
    print(f"backdrop: {len(px)} tiles, {len(a):,} pixels sampled at z{z}")
    return a


def backdrop_bands(px):
    """Split the backdrop by luminance. Dark = canopy, which is the hard case."""
    lin = srgb_lin(px)
    lum = lin @ np.array([0.2126, 0.7152, 0.0722])
    q = np.quantile(lum, [0.05, 0.25, 0.50, 0.75, 0.95])
    bands = {}
    for name, lo, hi in (("darkest canopy (p0-10)", -1, np.quantile(lum, 0.10)),
                         ("canopy (p10-40)", np.quantile(lum, 0.10), np.quantile(lum, 0.40)),
                         ("median ground (p40-60)", np.quantile(lum, 0.40), np.quantile(lum, 0.60)),
                         ("open/sand (p90-100)", np.quantile(lum, 0.90), 2)):
        m = (lum > lo) & (lum <= hi)
        if m.sum():
            bands[name] = px[m].mean(axis=0)
    return bands, q


# ── the palettes under test ─────────────────────────────────────────────────
def live_palette():
    """Read PAL out of src/app.html. A measurement tool that carries its own
    copy of the palette is landmine 107 in miniature — it would go on reporting
    the take-77 values long after someone changed a colour, and report them
    confidently. The snapshot below is kept ONLY as a labelled historical
    baseline for the take-76/77 before-and-after."""
    import re
    src = open(os.path.join(ROOT, "src", "app.html")).read()
    m = re.search(r"var PAL=\{(.*?)\n\};", src, re.S)
    if not m:
        sys.exit("src/app.html has no PAL table")
    return dict(re.findall(r"([a-z0-9]+)\s*:\s*'(#[0-9A-Fa-f]{6})'", m.group(1)))


# FROZEN take-75 snapshot. Not the live palette — see live_palette().
TAKE75_BASELINE = {
    "route72 (easy)":     "#2F7D4F",
    "trail50 (moderate)": "#2585D8",
    "fstrail (moderate)": "#2585D8",
    "mccct (difficult)":  "#1C1A16",
    "moto24 (difficult)": "#1C1A16",
    "track (two-track)":  "#9C7343",
    "fsroad (forest rd)": "#8A7C66",
    "minor (road)":       "#4A443B",
    "paved (road)":       "#3A352E",
    "closed":             "#C1121F",
}

# Legend swatches as they exist today, to prove the drift is visible.
ACTS_SW = {
    "orv":   "#2585D8",
    "dirt":  "#A9702F",
    "foot":  "#7CB342",
    "horse": "#8E6BB5",
    "snow":  "#4FB3C9",
    "nfs":   "#C98A2E",
}

CANDIDATE = {
    "route72 (easy)":     "#12A150",
    "trail50 (moderate)": "#1478E0",
    "fstrail (moderate)": "#1478E0",
    "mccct (difficult)":  "#1C1A16",
    "moto24 (difficult)": "#1C1A16",
    "track (two-track)":  "#B0722B",
    "fsroad (forest rd)": "#8A7C66",
    "minor (road)":       "#4A443B",
    "paved (road)":       "#3A352E",
    "closed":             "#C1121F",
}

WHITE = np.array([255.0, 255.0, 255.0])


def report(name, pal, bands):
    print(f"\n{'='*74}\n{name}\n{'='*74}")
    print("\n1. Does the tier read as a COLOUR on its own white casing?")
    print("   (designated trail sits on a 0.95-opacity white halo)")
    print(f"   {'class':<22} {'dE vs white':>12} {'WCAG':>8}")
    for k, h in pal.items():
        if "road" in k or "paved" in k or "closed" in k:
            continue
        c = hex_rgb(h)
        print(f"   {k:<22} {dE(c, WHITE):>12.1f} {wcag(c, WHITE):>8.1f}")

    print("\n2. Can the three tiers be told apart from each other?")
    tiers = [("easy", pal["route72 (easy)"]),
             ("moderate", pal["trail50 (moderate)"]),
             ("difficult", pal["mccct (difficult)"])]
    for i in range(len(tiers)):
        for j in range(i + 1, len(tiers)):
            a, b = tiers[i], tiers[j]
            print(f"   {a[0]:>9} vs {b[0]:<10} dE {dE(hex_rgb(a[1]), hex_rgb(b[1])):>6.1f}")

    print("\n3. Ridable dirt vs the ROAD family (hierarchy must read)")
    for a in ("track (two-track)",):
        for b in ("fsroad (forest rd)", "minor (road)", "paved (road)"):
            print(f"   {a:<20} vs {b:<20} dE {dE(hex_rgb(pal[a]), hex_rgb(pal[b])):>6.1f}")

    print("\n4. Against the REAL backdrop — fsroad has NO casing, so this is its")
    print("   only defence; designated classes are shown for completeness.")
    hdr = "   " + f"{'class':<22}" + "".join(f"{b[:18]:>20}" for b in bands)
    print(hdr)
    for k, h in pal.items():
        if "closed" in k:
            continue
        c = hex_rgb(h)
        row = f"   {k:<22}"
        for b, bg in bands.items():
            row += f"{dE(c, bg):>20.1f}"
        print(row)

    print("\n5. The trail+halo ASSEMBLY vs backdrop (white halo at 0.95)")
    halo = composite(WHITE, np.array(list(bands.values())).mean(axis=0), 0.95)
    for b, bg in bands.items():
        print(f"   halo over {b:<24} dE {dE(composite(WHITE, bg, 0.95), bg):>6.1f}")


if __name__ == "__main__":
    px = sample_backdrop()
    bands, q = backdrop_bands(px)
    print("\nbackdrop luminance quantiles p5/25/50/75/95: " +
          " ".join(f"{v:.3f}" for v in q))
    print("backdrop band mean colours:")
    for b, c in bands.items():
        print(f"   {b:<26} rgb({c[0]:.0f},{c[1]:.0f},{c[2]:.0f})")

    print(f"\n{'='*74}\nLEGEND DRIFT — is the take-67 swatch visibly wrong?\n{'='*74}")
    d = dE(hex_rgb(ACTS_SW["dirt"]), hex_rgb(TAKE75_BASELINE["track (two-track)"]))
    print(f"   ACTS 'dirt' swatch {ACTS_SW['dirt']} vs track layer "
          f"{TAKE75_BASELINE['track (two-track)']}  dE {d:.1f}")
    print(f"   ({'VISIBLE — above the dE 2.3 JND' if d > 2.3 else 'below JND'})")
    print(f"   ACTS 'orv' swatch {ACTS_SW['orv']} stands for three layer colours:")
    for k in ("route72 (easy)", "trail50 (moderate)", "mccct (difficult)"):
        print(f"      vs {k:<22} dE {dE(hex_rgb(ACTS_SW['orv']), hex_rgb(TAKE75_BASELINE[k])):>6.1f}")

    report("TAKE-75 BASELINE (frozen snapshot)", TAKE75_BASELINE, bands)
    # report() keys off descriptive labels; map PAL onto them rather than
    # rewriting a working instrument around a new key format (take 77).
    LABEL = {"route72": "route72 (easy)", "trail50": "trail50 (moderate)",
             "fstrail": "fstrail (moderate)", "mccct": "mccct (difficult)",
             "moto24": "moto24 (difficult)", "track": "track (two-track)",
             "fsroad": "fsroad (forest rd)", "minor": "minor (road)",
             "paved": "paved (road)", "closed": "closed"}
    live = live_palette()
    missing = [k for k in LABEL if k not in live]
    if missing:
        sys.exit(f"PAL is missing {missing} — the probe and the app disagree "
                 f"about what the map draws")
    report("LIVE palette, read from src/app.html",
           {LABEL[k]: live[k] for k in LABEL}, bands)
