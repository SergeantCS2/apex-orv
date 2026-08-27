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
# overpass.osm.ch was removed at take 85. It is the Swiss chapter's instance and
# carries Swiss data only: a Bern bbox returns 4,176 ways, a Bull Gap bbox
# returns 0. It sat here for twenty-six takes as a fallback that could not once
# have worked, answering HTTP 200 with an empty set — which is exactly why
# landmine 74's empty-result guard exists. The guard was right; the mirror was
# never valid. A fallback needs the same reachability test as a primary (A102).
# A110 · the places a rider stops. Fuel closes a loop the app already half-had:
# it has costed routes against a fuel range since take 36 and never showed where
# fuel IS. Named features only reach the map (see poi.py) — 205 unnamed parking
# areas in this region would be clutter, not information.
POI_TAGS = {
    "amenity": ["fuel", "parking", "restaurant", "cafe", "toilets",
                "drinking_water", "shelter"],
    "tourism": ["camp_site", "picnic_site", "viewpoint", "information"],
    "shop":    ["convenience", "supermarket", "general"],
}

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
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


def query(base, layer, fields, env=None, depth=0):
    # env: "W,S,E,N". A statewide envelope makes some layers shed load with
    # 5xx no matter how small the pages are. When a layer exhausts its retries,
    # the envelope QUARTERS and each quadrant fetches independently (Jacob's
    # staging idea, applied only where a server demands it), then features
    # dedupe by OBJECTID because quadrant edges double-count boundary crossers
    # (take 117).
    q = urllib.parse.urlencode({
        "geometry": env or BBOX, "geometryType": "esriGeometryEnvelope", "inSR": 4326,
        "outSR": 4326, "spatialRel": "esriSpatialRelIntersects", "where": "1=1",
        "outFields": fields, "returnGeometry": "true", "f": "geojson",
    })
    # State and federal endpoints return 503 under load. Take 14 gave Overpass
    # retries and stopped there; a single 503 from DNR or USFS then killed the
    # whole pipeline — and in CI that is a red build for an upstream hiccup
    # nobody controls (landmine 57). Every network read retries now.
    import time
    # ── PAGINATION (take 117) ────────────────────────────────────────────
    # The box era never saw a layer exceed ArcGIS's 2000-record transfer cap,
    # so this function issued ONE request and the shortfall check below stayed
    # silent for 100+ takes. Statewide, DNR and MVUM layers run 3-4k+ features
    # and the single request quietly returned the first 2000 — the shortfall
    # warnings fired on the very first statewide run, which is exactly what
    # they were built for. Pages of 1000 until a short page; smaller requests
    # also stopped the 503s the statewide envelope was provoking.
    PAGE = 1000
    # Resumable (take 117): the statewide fetch is long, servers are flaky
    # under statewide envelopes, and the sandbox can kill a background run
    # mid-flight. Each completed layer caches to disk; a rerun pays only for
    # what is missing. Same convention as osm_cache (landmine 172: caches are
    # named for what they hold).
    os.makedirs("auth_cache", exist_ok=True)
    _b = "".join(c if c.isalnum() else "_" for c in base.split("//")[-1][:40].lower())
    _e = "" if env is None else "_" + "".join(
        c if c.isalnum() else "-" for c in env)
    ck = os.path.join("auth_cache", f"{_b}_L{layer}{_e}.json")
    if os.path.exists(ck):
        try:
            cached = json.load(open(ck))
            if isinstance(cached, list):
                return cached
        except Exception:
            pass
    def _page(offset):
        qq = q + "&" + urllib.parse.urlencode(
            {"resultOffset": offset, "resultRecordCount": PAGE,
             "orderByFields": "OBJECTID"})
        rq = urllib.request.Request(f"{base}/{layer}/query?{qq}", headers={
            "User-Agent": "APEX-Offroad/1.0 (offline trail map; contact via repo)"})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(rq, timeout=180) as r:
                    return json.load(r).get("features", [])
            except urllib.error.HTTPError:
                if attempt == 3:
                    raise
                w = 10 * (2 ** attempt)
                print(f"  HTTPError on layer {layer} p{offset//PAGE} — "
                      f"retrying in {w}s ({attempt+1}/3)")
                time.sleep(w)
        return []
    for attempt in range(4):
        try:
            feats = []
            while True:
                pg = _page(len(feats))
                feats.extend(pg)
                if len(pg) < PAGE:
                    break
                time.sleep(1.0)   # politeness between pages — the 503s were us
            json.dump(feats, open(ck, "w"))
            have = _count(base, layer)
            if have is not None and len(feats) < have:
                msg = (f"layer {layer}: server reports {have} features, got "
                       f"{len(feats)} — {have - len(feats)} MISSING")
                SHORTFALL.append(msg)
                print(f"  !! {msg}")
            return feats
        except Exception as e:
            if attempt == 3:
                if depth >= 3:
                    raise
                W_, S_, E_, N_ = [float(x) for x in (env or BBOX).split(",")]
                MX, MY = (W_ + E_) / 2, (S_ + N_) / 2
                print(f"  layer {layer}: envelope too heavy — quartering "
                      f"(depth {depth + 1})")
                seen, out = set(), []
                for qd in (f"{W_},{S_},{MX},{MY}", f"{MX},{S_},{E_},{MY}",
                           f"{W_},{MY},{MX},{N_}", f"{MX},{MY},{E_},{N_}"):
                    for f in query(base, layer, fields, env=qd, depth=depth + 1):
                        k = (f.get("properties") or {}).get("OBJECTID")                             or json.dumps(f.get("geometry", {}), sort_keys=True)[:80]
                        if k not in seen:
                            seen.add(k); out.append(f)
                json.dump(out, open(ck, "w"))
                return out
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



def _region_stamp():
    """Take 118: CI's cache restored the BOX's payloads under a michigan build
    and shipped Bull Gap wearing take 117 — same speed, same size, and the
    workflow was green. The stamp makes that impossible: ingest writes which
    region this data run belongs to, and bundle.py REFUSES to package payloads
    stamped for another region. A stale cache now fails loudly with its remedy
    instead of shipping the wrong state."""
    json.dump({"region": R.id}, open("region_stamp.json", "w"))

def fetch_osm(path="aoi.json"):
    """OSM context roads. Advisory only — never authoritative (landmine 12).

    Added at take 10, silently reverted at take 11 by a `cp` of an older copy,
    and only found at take 13 by running the pipeline from a clean checkout.
    `aoi.json` survived on disk the whole time, so nothing failed (landmine 32).
    """
    import os
    _region_stamp()
    if os.path.exists(path):
        # A TIGER-derived aoi.json must NOT be sticky. CI caches this file, and
        # fetch_osm skips when it exists — so one Overpass outage would pin the
        # region to the road-only fallback forever, with no water layer and no
        # OSM paths, and nothing would ever retry (landmine 90). Jacob's manual
        # rerun succeeded precisely because the cache held a GOOD OSM copy, which
        # is the same mechanism working in his favour.
        # Take 131: this used to json.load the whole file to read ONE key —
        # 3.9 GB on the statewide aoi.json and the OOM killer (landmine 200,
        # alive in the tool that wrote landmine 200's fix). Read the header.
        # And the file is no longer sticky across a tag-set change: the header
        # carries the hash of the tags that produced it (landmine 196's shape —
        # a cache invalidated by everything that mutates its inputs).
        try:
            import re as _re
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            import osm_local
            head = open(path, "rb").read(400).decode("utf-8", "ignore")
            m_src = _re.search(r'"source":\s*"([^"]+)"', head)
            m_tag = _re.search(r'"tags":\s*"([^"]+)"', head)
            if m_src and m_src.group(1) == "tiger":
                print("osm: cached aoi.json came from the TIGER fallback — "
                      "retrying OSM before settling for it again")
            elif R.bulk and (not m_tag or m_tag.group(1) != osm_local.tagset_hash()):
                print(f"osm: {path} was built with a different tag set — rebuilding "
                      "(landmine 196: a cache is invalidated by everything that "
                      "mutates its inputs)")
            else:
                print(f"osm: {path} present, skipping fetch")
                return
        except Exception:
            print(f"osm: {path} unreadable — refetching")
    # A110. Places you can ride TO, not just line to ride on. `nwr` because a
    # boat launch is usually a node, a campground usually a way, and OSM does
    # not promise either. Existing consumers are unaffected: graph.py and
    # pack.py both skip elements with no `geometry`, which is what a node is.
    #
    # This list is the ONE definition. tools/osm_local.py reads it back out of
    # this file and refuses to run if the two have drifted, because the
    # Geofabrik path must fetch the same tags as the Overpass path or a
    # fallback build quietly ships a different map (landmine 107).
    poi = "|".join(sorted(POI_TAGS["amenity"]))
    tour = "|".join(sorted(POI_TAGS["tourism"]))
    shop = "|".join(sorted(POI_TAGS["shop"]))
    q = f"""[out:json][timeout:240];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|track|path|footway|bridleway|cycleway|raceway)$"]({S_},{W_},{N_},{E_});
  way["waterway"~"^(river|stream)$"]({S_},{W_},{N_},{E_});
  way["natural"="water"]({S_},{W_},{N_},{E_});
  nwr["amenity"~"^({poi})$"]({S_},{W_},{N_},{E_});
  nwr["tourism"~"^({tour})$"]({S_},{W_},{N_},{E_});
  nwr["shop"~"^({shop})$"]({S_},{W_},{N_},{E_});
  nwr["leisure"="slipway"]({S_},{W_},{N_},{E_});
  nwr["natural"="beach"]({S_},{W_},{N_},{E_});
  nwr["man_made"="lighthouse"]({S_},{W_},{N_},{E_});
  nwr["leisure"="marina"]({S_},{W_},{N_},{E_});
  node["natural"="peak"]({S_},{W_},{N_},{E_});
);
out geom;"""
    # Overpass returns 406 to urllib's default user-agent. Identify properly —
    # it is also just good manners on a volunteer-run service.
    # A bulk region (the whole state) never queries Overpass: a statewide
    # request to a volunteer-run service is abuse, and the sanctioned bulk path
    # already exists and reproduces the same network (take 114, A72).
    if R.bulk:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import osm_local
        print("osm: bulk region — reading the Geofabrik extract directly "
              "(Overpass is for boxes, not states)")
        n = osm_local.build_stream("aoi.json")
        if not n:
            sys.exit("osm: bulk extract produced nothing — refusing to continue")
        print(f"osm: aoi.json streamed from Geofabrik ({n:,} elements)")
        return
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
                print(f"osm: every mirror failed ({type(e).__name__})")
                # TIER 2 — the Geofabrik extract. Real OSM data: same ways, same
                # tags, water included, and it reproduces the Overpass network
                # edge for edge. TIGER below is roads only, with no water and a
                # different topology, so trying this first is not a preference,
                # it is the difference between a complete bundle and a degraded
                # one (A108, Jacob's call at take 85).
                try:
                    # Steps run with cwd=ROOT, so tools/ is not on sys.path.
                    # Same pattern android.py uses to reach icon.py — copied,
                    # not derived (PROTOCOL §3).
                    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
                    import osm_local
                    print("osm: trying the Geofabrik extract "
                          "(sanctioned bulk path, ~300 MB on first use)")
                    els = osm_local.build()
                    if els:
                        json.dump({"source": "geofabrik", "elements": els},
                                  open("aoi.json", "w"))
                        print(f"osm: aoi.json written from Geofabrik "
                              f"({len(els)} ways) — real OSM data, water included")
                        return
                    print("osm: Geofabrik returned nothing for this region")
                except Exception as ge:
                    print(f"osm: Geofabrik unavailable ({type(ge).__name__}: "
                          f"{str(ge)[:80]}) — falling back to Census TIGER roads")
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
    # A101. SpecialRestrictionType carries real law — 180 features statewide,
    # 67 of which read "Off road motorcycles are prohibited". ZERO are in the
    # Bull Gap box, so this changes nothing today and is built precisely because
    # it changes everything the moment A72 widens the region.
    fields = (f"{namefield},TrailNamePrimary,TrailWidthFeet,OpenClosedStatusORV,"
              f"LicenseType,TrailOnRoad,SpecialRestrictionType")
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
            # "-1" is the DNR's null sentinel and appears on 1,877 of 1,889
            # routes; it is not a restriction and must not read as one.
            "rst": (lambda v: v if v and v != "-1" else None)(
                clean(a.get("SpecialRestrictionType"))),
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
# ── A156 (take 122): clip to the STATE, not the bbox ──────────────────────
# Every query above used the region rectangle. For a box region the rectangle
# WAS the region; statewide it holds northern Wisconsin, the Minnesota
# Arrowhead and a slice of Ontario, and the USFS service returned 7,413 edges
# of Lakeland ATV, Price County snowmobile and Superior NF spurs — drawn on
# bare white, because nothing else extends past the shoreline. A feature is
# kept if ANY vertex is inside the state polygon, so a trail that crosses the
# border is drawn whole to its end (Geofabrik's rule for ways). Drops are
# printed per source and class: a silent clip is how the next one hides.
if R.bulk:
    import statemask
    from collections import Counter
    kept, dropped = [], Counter()
    for f in out:
        if statemask.touches_state(f.get("geometry")):
            kept.append(f)
        else:
            dropped[(f.get("src"), f.get("c"))] += 1
    n_drop = sum(dropped.values())
    if n_drop:
        print(f"clip: {n_drop} feature(s) wholly outside {R.name} dropped — "
              + ", ".join(f"{src}/{c} {n}" for (src, c), n in dropped.most_common()))
    else:
        print(f"clip: every agency feature touches {R.name}")
    out = kept
json.dump(out, open("authoritative.json", "w"))
print(f"region {R.id} — {R.name}")

from collections import Counter
c = Counter(f["c"] for f in out)
print(f"features {len(out)}")
for k, v in c.most_common():
    print(f"  {k:<10} {v}")
named = sum(1 for f in out if f.get("n"))
print(f"named {named}/{len(out)}")
