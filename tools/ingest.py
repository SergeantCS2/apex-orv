"""Pull authoritative trail data for the AOI and normalise it.

Two jurisdictions overlap here (landmine 13): Bull Gap and the Meadows are
federal USFS; Rose City, Ambrose Lake and Ogemaw Hills are state DNR. Either
source alone looks complete and is wrong.

Every output feature carries `src` and `auth` so the renderer can show legal
designation differently from an OSM guess (ROADMAP 3.5 / 7.2).
"""
import json, urllib.parse, urllib.request

import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R

BBOX = R.esri_envelope
S_, W_, N_, E_ = R.overpass_bbox
# Overpass is volunteer-run and the primary has now blocked a build twice with a
# 503. Mirrors serve the same database, so try them in turn before giving up —
# a single volunteer endpoint should not be a single point of failure for a map
# someone rides with. All three are declared in PROVISION.md.
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
]
OVERPASS = OVERPASS_MIRRORS[0]
# MapServer, NOT FeatureServer. The FeatureServer silently serves FEWER features
# for an identical query — measured twice, on two different days, in the Bull Gap
# box, in both geojson and Esri json:
#     ORV Trails 153/159 · Motorcycle 23/25 · MCCCT 45/47 · Skiing 0/10
#     Hiking 13/24 · Equestrian 13/14 · Snowmobile 97/101   (36 features withheld)
# returnCountOnly reports the MapServer totals from BOTH endpoints, so the data
# exists on both and the FeatureServer drops it on the way out. Six ORV trails
# and two motorcycle trails were missing from every build up to take 44.
DNR = "https://gisagodnr.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/MapServer"
FS = "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MVUM_01/MapServer"


def _count(base, layer):
    """How many features the server says match — independent of the payload.

    "Did I get everything?" is not a question to leave unasked on a map someone
    navigates by. A silent shortfall is how 36 features, six of them ORV trails,
    went missing for forty takes (landmine 72).
    """
    q = urllib.parse.urlencode({
        "geometry": BBOX, "geometryType": "esriGeometryEnvelope", "inSR": 4326,
        "spatialRel": "esriSpatialRelIntersects", "where": "1=1",
        "returnGeometry": "false", "returnCountOnly": "true", "f": "json",
    })
    try:
        req = urllib.request.Request(f"{base}/{layer}/query?{q}", headers={
            "User-Agent": "APEX-Offroad/1.0 (offline trail map; contact via repo)"})
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.load(r).get("count")
    except Exception:
        return None


SHORTFALL = []


def query(base, layer, fields):
    q = urllib.parse.urlencode({
        "geometry": BBOX, "geometryType": "esriGeometryEnvelope", "inSR": 4326,
        "outSR": 4326, "spatialRel": "esriSpatialRelIntersects", "where": "1=1",
        "outFields": fields, "returnGeometry": "true", "f": "geojson",
    })
    # State and federal endpoints return 503 under load. Take 14 gave Overpass
    # retries and stopped there; a single 503 from DNR or USFS then killed the
    # whole pipeline — and in CI that is a red build for an upstream hiccup
    # nobody controls (landmine 57). Every network read retries now.
    import time
    url = f"{base}/{layer}/query?{q}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "APEX-Offroad/1.0 (offline trail map; contact via repo)"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                feats = json.load(r).get("features", [])
            have = _count(base, layer)
            if have is not None and len(feats) < have:
                msg = (f"layer {layer}: server reports {have} features, got "
                       f"{len(feats)} — {have - len(feats)} MISSING")
                SHORTFALL.append(msg)
                print(f"  !! {msg}")
            return feats
        except Exception as e:
            if attempt == 3:
                raise
            wait = 6 * (attempt + 1)
            print(f"  {type(e).__name__} on layer {layer} — retrying in {wait}s "
                  f"({attempt + 1}/3)")
            time.sleep(wait)


def clean(v):
    """Agency nulls come through as -1, empty string or the literal 'null'."""
    if v in (None, "", " ", "-1", -1, "null", "Null"):
        return None
    return str(v).strip()


def short(name):
    """'ORV The Meadows Trail TMT' -> 'The Meadows Trail (TMT)'.

    Only wrap a BARE trailing code. Wrapping one that is already parenthesised
    produced 'The Meadows Motorcycle Trail ((TMM))' on 1,066 edges at take 9.
    """
    if not name:
        return None
    n = name.replace("ORV ", "").strip()
    parts = n.rsplit(" ", 1)
    if (len(parts) == 2 and 2 <= len(parts[1]) <= 5
            and parts[1].isalnum() and parts[1].isupper()):
        return f"{parts[0]} ({parts[1]})"
    return n


def tiger_roads():
    """Roads from Census TIGER, when Overpass will not answer.

    OSM is richer and stays the primary. But it is volunteer-run, all three
    mirrors 503'd during a CI build, and graph.py then correctly refused to ship
    a bundle whose Return Home cannot reach a road — so a build that fetched
    every trail perfectly produced nothing (take 56).

    TIGER is a US government CDN with no rate limit and no outage history worth
    planning around. It also carries **S1500, Vehicular Trail (4WD)** — 384 of
    them in Oscoda County alone, which is exactly the two-track this app is for.

    Written in Overpass's element shape so graph.py needs no special case.
    """
    import io
    import zipfile
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from context import parse_dbf, parse_shp_all
    from address import counties_for

    MTFCC = {"S1100": "motorway", "S1200": "primary", "S1400": "residential",
             "S1500": "track", "S1640": "service", "S1740": "service",
             "S1730": "residential", "S1780": "service"}
    W, S_, E, N = R.bbox
    # A small margin so a trail crossing the edge still connects, but bounded —
    # the gate allows a little slop, not a county.
    PAD = 0.02
    PAD_W, PAD_S, PAD_E, PAD_N = W - PAD, S_ - PAD, E + PAD, N + PAD
    els, seen = [], 0
    for fips, cname in counties_for(R.bbox):
        url = (f"https://www2.census.gov/geo/tiger/TIGER2023/ROADS/"
               f"tl_2023_{fips}_roads.zip")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "APEX-Offroad/1.0"})
            with urllib.request.urlopen(req, timeout=240) as r:
                z = zipfile.ZipFile(io.BytesIO(r.read()))
        except Exception as e:
            print(f"  tiger {cname}: unavailable ({type(e).__name__})")
            continue
        base = next(n[:-4] for n in z.namelist() if n.endswith(".shp"))
        rows = parse_dbf(z.read(base + ".dbf"))
        shapes = parse_shp_all(z.read(base + ".shp"), polyline=True)
        for row, parts in zip(rows, shapes):
            seen += 1
            hw = MTFCC.get(row.get("MTFCC", ""))
            if not hw or not parts:
                continue
            name = (row.get("FULLNAME") or "").strip()
            for pts in parts:
                # CLIP, do not filter. Keeping a whole way because one point is
                # near the box let county roads trail off to the county line —
                # the graph spanned 44.16 to 44.86 against a 44.42-44.72 region
                # and the gate refused the bundle as "not this region"
                # (landmine 89). Emit each run of consecutive in-box points as
                # its own way; a road that leaves and returns becomes two.
                run = []
                for x, y in pts:
                    if PAD_W <= x <= PAD_E and PAD_S <= y <= PAD_N:
                        run.append((x, y))
                    else:
                        if len(run) >= 2:
                            els.append({"type": "way", "id": len(els) + 1,
                                        "tags": {"highway": hw, "name": name},
                                        "geometry": [{"lon": round(a, 6),
                                                      "lat": round(b, 6)}
                                                     for a, b in run]})
                        run = []
                if len(run) >= 2:
                    els.append({"type": "way", "id": len(els) + 1,
                                "tags": {"highway": hw, "name": name},
                                "geometry": [{"lon": round(a, 6), "lat": round(b, 6)}
                                             for a, b in run]})
    print(f"tiger: {len(els)} road ways from {seen} features (OSM fallback)")
    return els


def fetch_osm(path="aoi.json"):
    """OSM context roads. Advisory only — never authoritative (landmine 12).

    Added at take 10, silently reverted at take 11 by a `cp` of an older copy,
    and only found at take 13 by running the pipeline from a clean checkout.
    `aoi.json` survived on disk the whole time, so nothing failed (landmine 32).
    """
    import os
    if os.path.exists(path):
        # A TIGER-derived aoi.json must NOT be sticky. CI caches this file, and
        # fetch_osm skips when it exists — so one Overpass outage would pin the
        # region to the road-only fallback forever, with no water layer and no
        # OSM paths, and nothing would ever retry (landmine 90). Jacob's manual
        # rerun succeeded precisely because the cache held a GOOD OSM copy, which
        # is the same mechanism working in his favour.
        try:
            if json.load(open(path)).get("source") == "tiger":
                print("osm: cached aoi.json came from the TIGER fallback — "
                      "retrying OSM before settling for it again")
            else:
                print(f"osm: {path} present, skipping fetch")
                return
        except Exception:
            print(f"osm: {path} unreadable — refetching")
    q = f"""[out:json][timeout:240];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|track|path|footway|bridleway|cycleway|raceway)$"]({S_},{W_},{N_},{E_});
  way["waterway"~"^(river|stream)$"]({S_},{W_},{N_},{E_});
  way["natural"="water"]({S_},{W_},{N_},{E_});
);
out geom;"""
    # Overpass returns 406 to urllib's default user-agent. Identify properly —
    # it is also just good manners on a volunteer-run service.
    payload = urllib.parse.urlencode({"data": q}).encode()
    hdrs = {"User-Agent": "APEX-Offroad/1.0 (offline trail map; contact via repo)"}
    # Overpass is volunteer-run and rate-limits under load — a 429 or 504 killed
    # the whole pipeline at take 14. Back off rather than dying.
    import time
    blob = None
    for attempt, endpoint in enumerate(OVERPASS_MIRRORS):
        try:
            req = urllib.request.Request(endpoint, data=payload, headers=hdrs)
            with urllib.request.urlopen(req, timeout=300) as r:
                blob = r.read()
            # A mirror can answer 200 with an EMPTY result set — overpass.osm.ch
            # did exactly that, and a clean run then built a bundle with zero
            # roads and said nothing (landmine 74). Empty is a failure here: this
            # bbox provably contains thousands of ways.
            if len(json.loads(blob).get("elements", [])) == 0:
                raise ValueError("empty result set")
            host = endpoint.split("/")[2]
            if attempt:
                print(f"osm: primary unavailable, served by mirror {host}")
            break
        except Exception as e:
            print(f"osm: {endpoint.split('/')[2]} {type(e).__name__} "
                  f"{getattr(e, 'code', '')}")
            if attempt == len(OVERPASS_MIRRORS) - 1:
                # OSM supplies the OPTIONAL water layer and nothing else — the
                # graph comes from DNR and USFS. A volunteer service being down
                # must not stop the build; it must produce a PARTIAL bundle that
                # says which layer is missing (landmine 34). Take 43: a clean run
                # died here on an Overpass 503 and took the whole pipeline with
                # it, including a graph that had already been fetched fine.
                print(f"osm: every mirror failed ({type(e).__name__}) — "
                      f"falling back to Census TIGER roads")
                els = tiger_roads()
                if els:
                    # marked, so a later run knows to try OSM again
                    json.dump({"source": "tiger", "elements": els},
                              open("aoi.json", "w"))
                    print(f"osm: aoi.json written from TIGER ({len(els)} ways); "
                          f"no water layer, bundle will be PARTIAL")
                return
            time.sleep(3)
    open(path, "wb").write(blob)
    print(f"osm: fetched {len(json.loads(blob)['elements'])} elements -> {path}")


out = []

# ── DNR ────────────────────────────────────────────────────────────────────
DNR_LAYERS = [
    (11, "ORVRouteName", "route72"),   # 72" routes, all vehicles
    (12, "ATVTrailName", "trail50"),   # 50" ORV trails
    (13, "MotorcycleName", "moto24"),  # 24" motorcycle-only
    (14, "TrailNamePrimary", "mccct"),  # cross-country cycle trail
]
for lid, namefield, cls in DNR_LAYERS:
    fields = f"{namefield},TrailNamePrimary,TrailWidthFeet,OpenClosedStatusORV,LicenseType,TrailOnRoad"
    for f in query(DNR, lid, fields):
        a = f["properties"]
        status = clean(a.get("OpenClosedStatusORV")) or "Unknown"
        out.append({
            "geometry": f["geometry"],
            "c": "closed" if status.lower().startswith("temporarily") else cls,
            "n": short(clean(a.get(namefield)) or clean(a.get("TrailNamePrimary"))),
            "src": "dnr", "auth": "legal",
            "w": clean(a.get("TrailWidthFeet")),
            "st": status,
            "lic": clean(a.get("LicenseType")),
            "onroad": clean(a.get("TrailOnRoad")),
        })

def pick(a, *names):
    """First non-empty attribute matching any name, case-insensitively.

    NFS publishes lowercase field names and DNR layers 5/15 have no
    TrailNamePrimary at all. Naming fields explicitly in outFields fails
    silently on those; ask for everything and read defensively.
    """
    low = {k.lower(): v for k, v in a.items()}
    for n in names:
        v = clean(low.get(n.lower()))
        if v:
            return v
    return ""


# ── DNR non-ORV routes ─────────────────────────────────────────────────────
# Jacob rides to camp and wants to know every route that exists, including the
# ones he may not legally ride — a footpath to a lake is worth seeing. These get
# classes that appear in NO machine's allow-list, so they are drawn and
# searchable and the router can never send anyone down one. The gate enforces
# that separation against the built graph, not against these lists.
DNR_OTHER = [
    (2,  "Hiking",           "foot"),
    (3,  "Biking",           "bike"),
    (4,  "Equestrian",       "horse"),
    (5,  "Skiing",           "snow"),
    (6,  "Snowshoe",         "foot"),
    (7,  "Iron Belle",       "foot"),
    (9,  "Hunter walking",   "foot"),
    (10, "Use permit / MOU", "mou"),
    (15, "Snowmobile",       "snowmob"),
    (16, "Rail trail",       "railtrail"),
]
for lid, what, cls in DNR_OTHER:
    try:
        rows = query(DNR, lid, "*")
    except Exception as e:
        print(f"  dnr layer {lid} ({what}): unavailable ({type(e).__name__}) — skipped")
        continue
    for f in rows:
        a = f["properties"]
        out.append({
            "geometry": f["geometry"], "c": cls,
            "n": short(pick(a, "TrailNamePrimary", "Name", "DNRTrail",
                            "PRDTrailUnit") or what),
            "src": "dnr", "auth": "nonorv", "use": what,
            "st": pick(a, "OpenClosedStatusORV", "OpenClosedStatusSnowmobile",
                       "OpenClosedStatusNonmotor"),
        })

# ── USFS National Forest System trails ─────────────────────────────────────
# MVUM lists only what motor vehicles may use. This is every NFS trail, which is
# how the non-motorised ones become visible.
NFS = ("https://apps.fs.usda.gov/arcx/rest/services/EDW/"
       "EDW_TrailNFSPublish_01/MapServer")
try:
    nfs_rows = query(NFS, 0, "*")
except Exception as e:
    print(f"  usfs NFS trails: unavailable ({type(e).__name__}) — skipped")
    nfs_rows = []
for f in nfs_rows:
    a = f["properties"]
    motor = pick(a, "TERRA_MOTORIZED").upper().startswith("Y")
    moto = bool(pick(a, "MOTORCYCLE_MANAGED", "MOTORCYCLE_ACCPT_DISC"))
    out.append({
        "geometry": f["geometry"],
        # Even a motorised NFS trail stays non-routable: MVUM is the authority on
        # what may be ridden. Claiming otherwise would put someone on a trail on
        # my say-so.
        "c": "nfsmoto" if (motor or moto) else "foot",
        "n": short(pick(a, "TRAIL_NAME", "TRAIL_NO") or "NFS trail"),
        "src": "usfs", "auth": "nonorv",
        "use": "NFS trail" + (" (motorised per USFS)" if motor or moto
                              else " (non-motorised)"),
        "surf": pick(a, "TRAIL_SURFACE").title(),
        "id": pick(a, "TRAIL_NO"),
    })


# ── USFS MVUM ──────────────────────────────────────────────────────────────
FS_FIELDS = "id,name,mvum_symbol_name,seasonal,motorcycle,atv,other_ohv_gt50inches,highclearancevehicle"
for lid, cls in ((2, "fstrail"), (1, "fsroad")):
    for f in query(FS, lid, FS_FIELDS):
        a = f["properties"]
        moto = clean(a.get("motorcycle"))
        atv = clean(a.get("atv"))
        out.append({
            "geometry": f["geometry"],
            # A road nobody can ride a motorcycle on is not a trail option.
            "c": cls if (moto or atv) else "fsclosed",
            "n": (clean(a.get("name")) or "").title() or None,
            "id": clean(a.get("id")),
            "src": "usfs", "auth": "legal",
            "sym": clean(a.get("mvum_symbol_name")),
            "seas": clean(a.get("seasonal")),
            "moto": moto, "atv": atv,
        })

fetch_osm()
json.dump(out, open("authoritative.json", "w"))
print(f"region {R.id} — {R.name}")

from collections import Counter
c = Counter(f["c"] for f in out)
print(f"features {len(out)}")
for k, v in c.most_common():
    print(f"  {k:<10} {v}")
named = sum(1 for f in out if f.get("n"))
print(f"named {named}/{len(out)}")
