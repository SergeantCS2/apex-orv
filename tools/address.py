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

Take 184 · A196. The take-182 build on Play carried 44 of 83 counties: a
county whose download failed was printed and SKIPPED, the step exited 0, and
nothing asserted coverage (landmine 219). Now every county's zip is cached
under auth_cache/addrfeat/ (fetched once; CI's region cache carries it), a
body that is not a zip is a failure (Census answers some URLs with HTTP 200
and an HTML "Request Rejected" page — landmine 74), one retry after a pause,
and a county still missing REFUSES the build. The payload records which
counties it covers so the gate can hold the built index to the region's
county count. Vintage 2024: 2023's Mecosta file is the rejected one.
"""
import io
import json
import os
import sys
import time
import urllib.request
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from context import parse_dbf, parse_shp_all
from region import R

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COUNTY = ("https://www2.census.gov/geo/tiger/GENZ2023/shp/"
          "cb_2023_us_county_20m.zip")
VINTAGE = "2024"   # take 184 · A196: TIGER2023 serves 82 of 83 Michigan counties, 2024 all 83
ADDRFEAT = ("https://www2.census.gov/geo/tiger/TIGER{v}/ADDRFEAT/"
            "tl_{v}_{fips}_addrfeat.zip")
CACHE = os.path.join(ROOT, "auth_cache", "addrfeat")
PACE_S, RETRY_S = 0.5, 20   # polite pacing toward Census; one retry after a pause (A191's shape)
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


def county_zip(fips, cname):
    """Path to the county's ADDRFEAT zip: from the cache, or fetched once and
    cached. A body that is not a zip is a failure; one retry after RETRY_S;
    None when both attempts fail — the caller refuses the build (A196)."""
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, f"tl_{VINTAGE}_{fips}_addrfeat.zip")
    if os.path.exists(p) and zipfile.is_zipfile(p):
        return p
    url = ADDRFEAT.format(v=VINTAGE, fips=fips)
    for attempt in (1, 2):
        try:
            b = get(url)
            if not zipfile.is_zipfile(io.BytesIO(b)):
                raise ValueError("body is not a zip — an HTML page at HTTP 200 (landmine 74)")
            with open(p + ".part", "wb") as fh:
                fh.write(b)
            os.replace(p + ".part", p)
            time.sleep(PACE_S)
            return p
        except Exception as e:
            print(f"  {cname} ({fips}): attempt {attempt} failed — "
                  f"{type(e).__name__}: {str(e)[:70]}")
            if attempt == 1:
                time.sleep(RETRY_S)
    return None


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
    seen, missing, per_county = 0, [], {}
    for fips, cname in cs:
        p = county_zip(fips, cname)
        if not p:
            missing.append(f"{cname} ({fips})")
            continue
        z = zipfile.ZipFile(p)
        kept_before = len(segs)
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
        per_county[fips] = len(segs) - kept_before
    if missing:
        # A partial index does not ship green: nothing is written, the step
        # fails, the pipeline stops (A196, landmine 219).
        sys.exit(f"address: {len(missing)} of {len(cs)} counties unavailable after a "
                 f"retry — refusing to build a partial index (A196): {', '.join(missing)}")

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
    # take 184 · coverage travels with the data: which counties, how many
    # segments each, how many the region has, and the vintage. The app's
    # decoder reads only the keys it names (f, n, p, zips, names), so these are
    # ignored on the phone and asserted by the gate.
    payload = {"v": 2, "names": names, "zips": zips, "p": 100000, "n": len(segs), "f": flat,
               "counties": per_county, "counties_expected": len(cs), "vintage": int(VINTAGE)}
    blob = json.dumps(payload, separators=(",", ":"))
    open(os.path.join(ROOT, "address_payload.json"), "w").write(blob)
    print(f"address: {len(segs)} segments of {seen} scanned across "
          f"{len(per_county)} of {len(cs)} counties (TIGER{VINTAGE}), "
          f"{len(names)} street names, {len(blob)/1024:.0f} KB")


if __name__ == "__main__":
    main()
