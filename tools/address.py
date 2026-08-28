"""Offline address index for the region. Both directions, no network in the field.

Take 34. Jacob asked for an address on a dropped pin, and the ability to type an
address to set home. Live geocoding is a network service, and this app does not
get to depend on one on a trail — so the index is built at provision time and
shipped in the bundle.

Source: Census TIGER ADDRFEAT — per-county address *ranges*. Each road segment
carries the house numbers at each end, per side, plus the ZIP. That is how
geocoders actually work in rural areas where there are no address points: find
the nearest segment, work out which side you are on, and interpolate along it.

Reverse: point -> nearest segment within a cap -> side -> interpolated number.
Forward: "4952 S Branch Rd" -> segments with that name whose range contains
4952 -> interpolated position.

Rural coverage is honest but partial. When there is no address the app shows
nothing at all rather than announcing an absence, which is what was asked for.
"""
import io
import json
import os
import sys
import urllib.request
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from context import parse_dbf, parse_shp_all
from region import R

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COUNTY = ("https://www2.census.gov/geo/tiger/GENZ2023/shp/"
          "cb_2023_us_county_20m.zip")
ADDRFEAT = ("https://www2.census.gov/geo/tiger/TIGER2023/ADDRFEAT/"
            "tl_2023_{fips}_addrfeat.zip")
PAD = 0.02          # take a little beyond the region so edge pins still resolve


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "APEX-Offroad/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read()


def counties_for(bbox):
    """Counties whose geometry overlaps the region box."""
    z = zipfile.ZipFile(io.BytesIO(get(COUNTY)))
    base = next(n[:-4] for n in z.namelist() if n.endswith(".shp"))
    rows = parse_dbf(z.read(base + ".dbf"))
    shapes = parse_shp_all(z.read(base + ".shp"))
    W, S, E, N = bbox
    out = []
    for row, rings in zip(rows, shapes):
        if row.get("STATEFP") != "26":          # Michigan only for now
            continue
        xs = [p[0] for r in rings for p in r]
        ys = [p[1] for r in rings for p in r]
        if not xs or max(xs) < W - PAD or min(xs) > E + PAD:
            continue
        if max(ys) < S - PAD or min(ys) > N + PAD:
            continue
        out.append((row["STATEFP"] + row["COUNTYFP"], row.get("NAME", "?")))
    return out


def num(s):
    """House numbers are text in TIGER and sometimes carry letters."""
    s = (s or "").strip()
    d = "".join(c for c in s if c.isdigit())
    return int(d) if d else None


def main():
    W, S, E, N = R.bbox
    cs = counties_for(R.bbox)
    if not cs:
        print("address: no counties matched the region — skipping")
        return
    print("  counties: " + ", ".join(f"{n} ({f})" for f, n in cs))

    names, nidx, segs = [], {}, []
    seen = 0
    for fips, cname in cs:
        try:
            z = zipfile.ZipFile(io.BytesIO(get(ADDRFEAT.format(fips=fips))))
        except Exception as e:
            print(f"  {cname}: unavailable ({type(e).__name__}) — skipped")
            continue
        base = next(n[:-4] for n in z.namelist() if n.endswith(".shp"))
        rows = parse_dbf(z.read(base + ".dbf"))
        shapes = parse_shp_all(z.read(base + ".shp"), polyline=True)
        for row, parts in zip(rows, shapes):
            seen += 1
            nm = (row.get("FULLNAME") or "").strip()
            if not nm or not parts:
                continue
            pts = parts[0]
            # keep only what touches the region
            if all(p[0] < W - PAD or p[0] > E + PAD or
                   p[1] < S - PAD or p[1] > N + PAD for p in pts):
                continue
            lf, lt = num(row.get("LFROMHN")), num(row.get("LTOHN"))
            rf, rt = num(row.get("RFROMHN")), num(row.get("RTOHN"))
            if lf is None and rf is None:
                continue
            if nm not in nidx:
                nidx[nm] = len(names)
                names.append(nm)
            # endpoints are enough: TIGER segments are short and every geocoder
            # interpolates linearly along them anyway
            a, b = pts[0], pts[-1]
            zp = (row.get("ZIPL") or row.get("ZIPR") or "").strip()
            segs.append([nidx[nm],
                         round(a[0], 5), round(a[1], 5),
                         round(b[0], 5), round(b[1], 5),
                         lf or 0, lt or 0, rf or 0, rt or 0,
                         int(zp) if zp.isdigit() else 0])

    # Take 139 · the index was 52 MB of decimal text — ten floats and ints per
    # segment, 770k segments. Sorted by name then position and stored as
    # DELTA INTEGERS at 1e-5 degrees (~1 m; 1e-4 saved only 2 MB more and
    # cost fidelity), with house-number ranges as from + span and zips as an
    # index: 28 MB, same information. The app decodes it back into the same
    # `segs` arrays on load, so every consumer is unchanged.
    segs.sort(key=lambda g: (g[0], g[1], g[2]))
    zips = sorted({g[9] for g in segs})
    zi = {z: i for i, z in enumerate(zips)}
    flat, px, py, pn = [], 0, 0, 0
    for g in segs:
        x1, y1, x2, y2 = [round(v * 1e5) for v in g[1:5]]
        flat.extend([g[0] - pn, x1 - px, y1 - py, x2 - x1, y2 - y1,
                     g[5], g[6] - g[5], g[7], g[8] - g[7], zi[g[9]]])
        pn, px, py = g[0], x1, y1
    payload = {"v": 2, "names": names, "zips": zips, "p": 100000, "n": len(segs), "f": flat}
    blob = json.dumps(payload, separators=(",", ":"))
    open(os.path.join(ROOT, "address_payload.json"), "w").write(blob)
    print(f"address: {len(segs)} segments of {seen} scanned, "
          f"{len(names)} street names, {len(blob)/1024:.0f} KB")


if __name__ == "__main__":
    main()
