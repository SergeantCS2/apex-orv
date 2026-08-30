"""Declare everything APEX downloads, why, how big, and under what licence.

PROTOCOL §8 splits provisioning from runtime. Provisioning may use the network;
the field may not. The thing that makes that safe rather than aspirational is
this manifest: an undeclared fetch is the failure that works on the bench with
wifi on and dies at Mack Lake.

The gate refuses any host appearing in tools/ that is not declared here.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

SOURCES = [
    {
        # take 150 · A164: the one source with TWO phases — the site
        # inventory at build, and LIVE values fetched in-app on a user tap
        # (PROTOCOL §8 in-app rules, second entry on the runtime allowlist).
        "host": "waterservices.usgs.gov",
        "name": "USGS Water Services (NWIS)",
        "what": "Gauge site inventory (1,332 MI surface-water sites) at "
                "build; live flow/stage/water-temp on a river-card tap",
        "licence": "Public domain (US Government work)",
        "tool": "gauges.py + the app's conditions button",
        "phase": "provision + in-app (user tap only, never load-bearing)",
        "refresh": "inventory each build; values are always live or absent — "
                   "a level from build time is worse than none (A164)",
    },
    {
        "host": "download.geofabrik.de",
        "name": "Geofabrik OpenStreetMap extract",
        "what": "Michigan .osm.pbf — the same OSM ways ingest.py asks Overpass "
                "for, from the sanctioned bulk download path",
        "licence": "ODbL (OpenStreetMap contributors)",
        "tool": "osm_local.py",
        "phase": "provision",
        "refresh": "only when every Overpass mirror fails — tier 2 of the OSM "
                   "fallback chain, ahead of Census TIGER (A108, take 85)",
    },
    {
        "host": "gisagodnr.state.mi.us",
        "name": "Michigan DNR trails",
        "what": "ORV routes, trails, motorcycle trails, MCCCT, closures, reroutes",
        "licence": "Public domain (State of Michigan open data)",
        "tool": "ingest.py",
        "phase": "provision",
        "refresh": "seasonal — closures change in-season",
    },
    {
        "host": "en.wikipedia.org",
        "name": "Wikipedia (geosearch + lead image)",
        "what": "Photos for MAJOR pins — camps, trail systems, riding areas, "
                "named beaches — matched by name near the pin (take 131)",
        "licence": "CC BY-SA / public domain per image; author and licence "
                   "shipped and shown on the card",
        "tool": "photos.py",
        "phase": "provision",
        "refresh": "rarely",
    },
    {
        "host": "commons.wikimedia.org",
        "name": "Wikimedia Commons (geosearch)",
        "what": "A geotagged photo taken AT a pin that has no article — beaches, "
                "launches, campgrounds (take 131)",
        "licence": "per image; author and licence shipped and shown",
        "tool": "photos.py",
        "phase": "provision",
        "refresh": "rarely",
    },
    {
        "host": "upload.wikimedia.org",
        "name": "Wikimedia Commons (thumbnails)",
        "what": "The 320 px lead image itself",
        "licence": "per image (see en.wikipedia.org entry)",
        "tool": "photos.py",
        "phase": "provision",
        "refresh": "rarely",
    },
    {
        "host": "services3.arcgis.com",
        "name": "Michigan DNR ORV Scramble Areas",
        "what": "Designated open-riding area polygons (Silver Lake, St. Helen, "
                "Holly Oaks, The Mounds, Bull Gap Hill Climb…) — the DNR "
                "publishes these on ArcGIS Online, not in its trails MapServer",
        "licence": "Public domain (State of Michigan open data)",
        "tool": "areas.py",
        "phase": "provision",
        "refresh": "rarely — designations change by rulemaking",
    },
    {
        "host": "apps.fs.usda.gov",
        "name": "USDA Forest Service MVUM",
        "what": "Motor Vehicle Use Map roads and trails, per-vehicle legality",
        "licence": "Public domain (US Government work)",
        "tool": "ingest.py",
        "phase": "provision",
        "refresh": "annual — MVUMs republish each March",
    },
    {
        "host": "overpass-api.de",
        "name": "OpenStreetMap via Overpass",
        "what": "Context roads, tracks, water. Advisory only, never authoritative",
        "licence": "ODbL — attribution required, shipped in the map credits",
        "tool": "ingest.py / pack.py",
        "phase": "provision",
        "refresh": "occasional",
    },
    {
        "host": "s3.amazonaws.com",
        "name": "Terrarium elevation tiles",
        "what": "Encoded DEM: node elevations, per-edge climb, profiles, hillshade",
        "licence": "Public domain / ODbL mix — USGS 3DEP over CONUS",
        "tool": "terrain.py",
        "phase": "provision",
        "refresh": "rarely — terrain does not move",
    },
    {
        "host": "basemap.nationalmap.gov",
        "name": "USGS ImageryOnly",
        "what": "Satellite basemap. NAIP-derived",
        "licence": "Public domain (US Government work)",
        "tool": "imagery.py",
        "phase": "provision",
        "refresh": "when NAIP re-flies, every 2-3 years",
        "note": "Landmine 22 — Esri, Google, Bing and Mapbox imagery are licensed "
                "and may NOT be redistributed offline. This one may.",
    },
    {
        "host": "www2.census.gov",
        "name": "US Census cartographic boundary files",
        "what": "cb_2023_us_state_20m — state outlines clipped to the SHORELINE. "
                "The TIGERweb legal boundary was tried first and runs far out "
                "into the Great Lakes, which draws a shape nobody recognises.",
        "licence": "US Government work, public domain",
        "tool": "context.py",
        "phase": "provision",
        "refresh": "effectively never — state lines do not move",
    },
    {
        "host": "www2.census.gov",
        "name": "US Census TIGER address ranges (ADDRFEAT)",
        "what": "per-county house-number ranges per road segment, for the "
                "offline geocoder. Counties are chosen by overlap with the "
                "region box, then clipped to it.",
        "licence": "US Government work, public domain",
        "tool": "address.py",
        "phase": "provision",
        "refresh": "annual — TIGER vintages are yearly",
    },
    {
        "host": "overpass.kumi.systems",
        "name": "Overpass mirror (Kumi Systems)",
        "what": "same OSM database as the primary; used only when it is down",
        "licence": "ODbL (OpenStreetMap contributors)",
        "tool": "ingest.py",
        "phase": "provision",
        "refresh": "same as the primary",
    },
    {
        "host": "apps.fs.usda.gov",
        "name": "USFS National Forest System trails (EDW_TrailNFSPublish_01)",
        "what": "every NFS trail, motorised and not, with per-mode permissions. "
                "MVUM lists only what vehicles may use; this is what EXISTS.",
        "licence": "US Government work, public domain",
        "tool": "ingest.py",
        "phase": "provision",
        "refresh": "seasonal",
    },
    {
        "host": "unpkg.com",
        "name": "MapLibre GL JS",
        "what": "Renderer, vendored into the bundle at build time",
        "licence": "BSD 3-Clause",
        "tool": ".github/workflows/build.yml",
        "phase": "build",
        "refresh": "on version bump",
    },
    {
        "host": "github.com",
        "name": "bundletool (google/bundletool releases)",
        "what": "Google's app-bundle tool: validates the Play AAB and derives "
                "the universal APK android_check audits. Pinned by version and "
                "sha256 in ci/apk.sh; runs on the CI runner only (take 154).",
        "licence": "Apache 2.0",
        "tool": "ci/apk.sh",
        "phase": "build",
        "refresh": "on version bump (BT_VER in ci/apk.sh)",
    },
]

# measured, not estimated — see imagery.py and the take 10 handoff
BUDGET_NOTE = """Per-region download sizes, measured at take 10 over the
1,060 km2 Bull Gap / Mio / Rose City AOI. Statewide figures extrapolate by area
and are shown to rule statewide OUT, not to plan for it."""


def declared_hosts():
    return {s["host"] for s in SOURCES}


# XML namespace identifiers. They look like URLs and are never fetched — the
# scanner flagged schemas.android.com in the icon generator's adaptive-icon xml
# (take 24). A declaration list is only useful if everything on it is a real
# network dependency.
NAMESPACES = {"schemas.android.com", "www.w3.org", "schemas.microsoft.com",
              "maven.apache.org", "java.sun.com", "xmlns.jcp.org"}


def scan_hosts():
    """Every remote host any tool or workflow actually reaches."""
    found = {}
    targets = [(HERE, os.listdir(HERE))]
    # ci/ holds the canonical build definition; .github/workflows holds the
    # generated copy. GITHUB_TOKEN cannot write the latter (landmine 46), so the
    # source of truth lives where GitHub does not execute it — and both must be
    # scanned or a declared host looks unreached (take 51).
    for d in (os.path.join(ROOT, ".github", "workflows"), os.path.join(ROOT, "ci")):
        if os.path.isdir(d):
            targets.append((d, os.listdir(d)))
    for d, files in targets:
        for fn in files:
            if not fn.endswith((".py", ".yml", ".yaml", ".sh")):
                continue
            try:
                txt = open(os.path.join(d, fn), encoding="utf-8").read()
            except Exception:
                continue
            for u in re.findall(r"https?://([A-Za-z0-9.\-]+)", txt):
                if u in NAMESPACES:
                    continue
                found.setdefault(u, set()).add(fn)
    return found


def render():
    budget = {}
    bp = os.path.join(ROOT, "imagery_budget.json")
    if os.path.exists(bp):
        budget = json.load(open(bp))

    out = ["# PROVISION — what APEX downloads, and when", "",
           "*Generated by `tools/manifest.py`. Do not hand-edit.*", "",
           "PROTOCOL §8: **provisioning may use the network, the field may not.**",
           "Everything below is fetched at home on wifi, verified, and then never",
           "needed again. An undeclared fetch is the failure that passes on the",
           "bench and dies at Mack Lake — the gate refuses any host not listed here.",
           ""]

    for phase, title in (("provision", "Downloaded to the device"),
                         ("build", "Build machine only — never reaches a phone")):
        rows = [s for s in SOURCES if s["phase"] == phase]
        out += [f"## {title}", ""]
        for s in rows:
            out += [f"### {s['name']}", "",
                    f"- **Host** `{s['host']}`",
                    f"- **Provides** {s['what']}",
                    f"- **Licence** {s['licence']}",
                    f"- **Fetched by** `{s['tool']}`",
                    f"- **Refresh** {s['refresh']}"]
            if s.get("note"):
                out += [f"- **Note** {s['note']}"]
            out += [""]

    if budget:
        out += ["## Imagery size budget — measured", "", BUDGET_NOTE, "",
                "| zoom | m/px | tiles | AOI | statewide |",
                "|---|---|---|---|---|"]
        for z in sorted(budget, key=int):
            b = budget[z]
            if not b["tiles"] or not b["aoi_mb"]:
                continue
            out.append(f"| z{z} | {b['mpp']} | {b['tiles']:,} | "
                       f"{b['aoi_mb']:.0f} MB | {b['state_gb']:.1f} GB |")
        out += ["",
                "**z16 (1.7 m/px) is the useful ceiling: 159 MB for a riding area.**",
                "That is one wifi download the night before. Statewide at the same",
                "zoom is 36.6 GB, which settles it — imagery is per-region, always.",
                "z12-13 are cheap enough to ship with the app as a fallback.", ""]

    out += ["## The invariant", "",
            "After provisioning completes and verifies, the app must be **provably**",
            "complete. The test is a cold start in airplane mode: every layer the",
            "region claims to have renders, and the NET badge stays green.", "",
            "Nothing in the field may wait on a network call — not a font, not a",
            "glyph range, not a tile, not a licence check.", ""]
    return "\n".join(out)


if __name__ == "__main__":
    found = scan_hosts()
    declared = declared_hosts()
    undeclared = {h: v for h, v in found.items() if h not in declared}
    unused = declared - set(found)

    print(f"hosts reached by tools: {len(found)}")
    for h, files in sorted(found.items()):
        mark = "ok " if h in declared else "UNDECLARED"
        print(f"  {mark:<11} {h:<32} {', '.join(sorted(files))}")
    if unused:
        print(f"\ndeclared but unused: {', '.join(sorted(unused))}")

    open(os.path.join(ROOT, "docs", "PROVISION.md"), "w").write(render())
    print("\nwrote docs/PROVISION.md")
    sys.exit(1 if undeclared else 0)
