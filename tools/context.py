"""State outline for orientation at low zoom. Context, never data.

Take 31. Zoomed out, the app showed one detailed square floating in empty sand
with no way to tell where in the world it was. Jacob asked to see Michigan
entire, with a pin for where he actually is, and no detail anywhere but the
downloaded box.

The outline exists ONLY to answer "where am I relative to my download". It is
drawn as a thin line at low zoom and disappears as you zoom in, so it can never
be mistaken for something routable. Nothing in the graph, the router or the
safety code ever sees it.

Source: the US Census **cartographic** boundary file (cb_*_us_state_20m).

Take 33 first used TIGERweb's legal state boundary, which for Michigan extends
far out into the Great Lakes — so the outline was a lumpy blob, not a mitten,
and Jacob rightly called it the weirdest map of Michigan he had ever seen. The
cartographic files are clipped to the **shoreline**, which is the shape a person
recognises: Lower Peninsula, Upper Peninsula, Isle Royale and three islands in
469 points at 1:20m. Legal boundary vs land boundary is not a detail.

The Great Lakes are labelled from a small fixed table — they are context, and
nobody needs their geometry to know where Lake Michigan is.
"""

# Where to write each lake name. Positions are chosen to sit in open water at
# statewide zoom, not to be centroids.
LAKES = {
    "Michigan": [
        ("LAKE SUPERIOR", -87.60, 47.70),
        ("LAKE MICHIGAN", -86.90, 43.60),
        ("LAKE HURON", -82.60, 44.60),
        ("LAKE ERIE", -81.40, 42.10),
    ],
}
import io
import json
import os
import struct
import sys
import urllib.request
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = ("https://www2.census.gov/geo/tiger/GENZ2023/shp/"
       "cb_2023_us_state_20m.zip")
TOL = 0.004           # the file is already 1:20m; only the largest rings need it


def _rdp_open(pts, tol):
    """RDP on an OPEN polyline. Iterative, so a 10k-point ring cannot blow the stack."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        n = (dx * dx + dy * dy) ** 0.5 or 1e-12
        worst, wi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / n
            if d > worst:
                worst, wi = d, i
        if worst > tol:
            keep[wi] = True
            stack.append((a, wi))
            stack.append((wi, b))
    return [p for p, k in zip(pts, keep) if k]



def rdp(pts, tol):
    """RDP that also handles CLOSED rings.

    On a closed ring the first and last points are identical, so the baseline
    a->b has zero length and the perpendicular distance evaluates to exactly
    zero for every interior point. RDP then keeps nothing and returns the two
    endpoints — silently, with no exception, discarding the whole state outline.
    Split the ring at its farthest point first, simplify each half as an open
    line, and rejoin.
    """
    if len(pts) < 3:
        return pts
    closed = abs(pts[0][0] - pts[-1][0]) < 1e-9 and abs(pts[0][1] - pts[-1][1]) < 1e-9
    if not closed:
        return _rdp_open(pts, tol)
    ax, ay = pts[0]
    far = max(range(1, len(pts) - 1),
              key=lambda i: (pts[i][0] - ax) ** 2 + (pts[i][1] - ay) ** 2)
    first = _rdp_open(pts[:far + 1], tol)
    second = _rdp_open(pts[far:], tol)
    return first + second[1:]




def parse_dbf(buf):
    nrec, hlen, rlen = struct.unpack("<IHH", buf[4:12])
    fields, off = [], 32
    while buf[off] != 0x0D:
        fields.append((buf[off:off + 11].split(b"\0")[0].decode(), buf[off + 16]))
        off += 32
    rows = []
    for i in range(nrec):
        rec = buf[hlen + i * rlen: hlen + (i + 1) * rlen]
        p, row = 1, {}
        for nm, ln in fields:
            row[nm] = rec[p:p + ln].decode("latin-1").strip()
            p += ln
        rows.append(row)
    return rows


def parse_shp(buf, want):
    """Rings of record `want`. Shapetype 5 (polygon) only — that is all this file
    contains, and guessing at others would be pretending to be a shapefile
    library."""
    pos, idx = 100, 0
    while pos < len(buf):
        _, clen = struct.unpack(">II", buf[pos:pos + 8])
        body = buf[pos + 8: pos + 8 + clen * 2]
        if idx == want:
            typ, = struct.unpack("<I", body[:4])
            if typ != 5:
                sys.exit(f"unexpected shapefile type {typ}")
            nparts, npts = struct.unpack("<II", body[36:44])
            parts = struct.unpack(f"<{nparts}I", body[44:44 + 4 * nparts])
            o = 44 + 4 * nparts
            rings = []
            for k in range(nparts):
                a = parts[k]
                b = parts[k + 1] if k + 1 < nparts else npts
                raw = body[o + 16 * a: o + 16 * b]
                rings.append([struct.unpack("<dd", raw[j * 16:(j + 1) * 16])
                              for j in range(b - a)])
            return rings
        pos += 8 + clen * 2
        idx += 1
    sys.exit(f"record {want} not found in shapefile")


def parse_shp_all(buf, polyline=False):
    """Every record's parts, in file order, so a DBF row and a shape line up.

    Shapetype 3 is polyline, 5 is polygon; the record layout is identical for
    both, which is why one reader serves the county outlines and the address
    ranges. Null shapes (type 0) yield an empty list so the row indexes still
    match — dropping them would silently shift every later record's attributes.
    """
    out, pos = [], 100
    while pos < len(buf):
        _, clen = struct.unpack(">II", buf[pos:pos + 8])
        body = buf[pos + 8: pos + 8 + clen * 2]
        pos += 8 + clen * 2
        typ, = struct.unpack("<I", body[:4])
        if typ == 0:
            out.append([])
            continue
        if typ not in (3, 5):
            out.append([])
            continue
        nparts, npts = struct.unpack("<II", body[36:44])
        parts = struct.unpack(f"<{nparts}I", body[44:44 + 4 * nparts])
        o = 44 + 4 * nparts
        rings = []
        for k in range(nparts):
            a = parts[k]
            b = parts[k + 1] if k + 1 < nparts else npts
            raw = body[o + 16 * a: o + 16 * b]
            rings.append([struct.unpack("<dd", raw[j * 16:(j + 1) * 16])
                          for j in range(b - a)])
        out.append(rings)
    return out


def main():
    name = R.state
    if not name:
        print("no state configured for this region — skipping context")
        return
    req = urllib.request.Request(URL, headers={"User-Agent": "APEX-Offroad/1.0"})
    with urllib.request.urlopen(req, timeout=240) as r:
        blob = r.read()
    z = zipfile.ZipFile(io.BytesIO(blob))
    base = next(n[:-4] for n in z.namelist() if n.endswith(".shp"))
    rows = parse_dbf(z.read(base + ".dbf"))
    try:
        want = [i for i, row in enumerate(rows) if row.get("NAME") == name][0]
    except IndexError:
        sys.exit(f"{name!r} not in {base}")
    rings = parse_shp(z.read(base + ".shp"), want)

    raw = sum(len(r) for r in rings)
    out = []
    for ring in rings:
        pts = [(round(x, 4), round(y, 4)) for x, y in ring]
        s = rdp(pts, TOL) if len(pts) > 40 else pts
        if len(s) >= 4:
            out.append(s)
    out.sort(key=len, reverse=True)

    payload = {"name": name,
               "rings": [[[x, y] for x, y in r] for r in out],
               "labels": [{"n": n, "at": [lo, la]} for n, lo, la in LAKES.get(name, [])]}
    blob = json.dumps(payload, separators=(",", ":"))
    open(os.path.join(ROOT, "context_payload.json"), "w").write(blob)
    print(f"context: {name} {len(out)} land rings, {raw} -> {sum(len(r) for r in out)} "
          f"points, {len(payload['labels'])} lake labels, {len(blob)/1024:.1f} KB")


if __name__ == "__main__":
    main()
