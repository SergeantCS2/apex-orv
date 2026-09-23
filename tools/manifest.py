"""Declare everything APEX downloads, why, how big, and under what licence.

PROTOCOL §8 splits provisioning from runtime. Provisioning may use the network;
the field may not. The thing that makes that safe rather than aspirational is
this manifest: an undeclared fetch is the failure that works on the bench with
wifi on and dies at Mack Lake.

The gate refuses any host appearing in tools/ that is not declared here.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

SOURCES = [
    {
        "host": "apps.fs.usda.gov",
        "name": "USFS forest boundaries (Camp mode, take 174 · A186)",
        "what": "administrative boundaries of Michigan's three national forests "
                "(Ottawa, Hiawatha, Huron-Manistee) from the Enterprise Data "
                "Warehouse layer `EDW_ForestSystemBoundaries_01/MapServer/0`, "
                "generalised to ~60 m — 23 KB; build time, cached as nf_cache.json",
        "licence": "US federal government work, public domain",
        "tool": "nf.py",
        "phase": "provision",
        "refresh": "rarely; forest boundaries do not move",
    },
    # take 167 · A184 · CITATION-ONLY hosts. Play's Misleading Claims policy
    # requires an app presenting government information to link the official
    # source of it; these six appear in the store listing and in the app's
    # Tools -> Data sources panel as text and links a rider can follow. No
    # tool fetches them and the app never requests them — they are printed,
    # not called. Declared here anyway, because §8's rule is that any host
    # named in the tooling is accounted for, and "we only display it" is a
    # claim that should be written down rather than assumed.
    {
        "host": "www.michigan.gov",
        "name": "Michigan DNR (citation)",
        "what": "official agency page for the trail, closure, state-land and boating-access data",
        "licence": "n/a — cited, not fetched",
        "tool": "play_assets.py listing and the app's Data sources panel",
        "phase": "citation",
        "refresh": "re-check the link still resolves before each submission",
    },
    {
        "host": "gis-midnr.opendata.arcgis.com",
        "name": "Michigan DNR open data (citation)",
        "what": "public portal for the GIS layers the pipeline ingests",
        "licence": "n/a — cited, not fetched",
        "tool": "play_assets.py listing and the app's Data sources panel",
        "phase": "citation",
        "refresh": "re-check the link still resolves before each submission",
    },
    {
        "host": "data.fs.usda.gov",
        "name": "USDA Forest Service geodata (citation)",
        "what": "official source for national forest roads and trails",
        "licence": "n/a — cited, not fetched",
        "tool": "play_assets.py listing and the app's Data sources panel",
        "phase": "citation",
        "refresh": "re-check the link still resolves before each submission",
    },
    {
        "host": "apps.nationalmap.gov",
        "name": "USGS The National Map (citation)",
        "what": "official source for satellite imagery and elevation",
        "licence": "n/a — cited, not fetched",
        "tool": "play_assets.py listing and the app's Data sources panel",
        "phase": "citation",
        "refresh": "re-check the link still resolves before each submission",
    },
    {
        "host": "waterdata.usgs.gov",
        "name": "USGS water data (citation)",
        "what": "official source for the live river gauge readings",
        "licence": "n/a — cited, not fetched",
        "tool": "play_assets.py listing and the app's Data sources panel",
        "phase": "citation",
        "refresh": "re-check the link still resolves before each submission",
    },
    {
        "host": "www.openstreetmap.org",
        "name": "OpenStreetMap copyright page (citation)",
        "what": "licence and attribution for OSM-derived roads, places and context",
        "licence": "n/a — cited, not fetched",
        "tool": "play_assets.py listing and the app's Data sources panel",
        "phase": "citation",
        "refresh": "re-check the link still resolves before each submission",
    },
    {
        # take 181 · A195: the privacy policy Play wants linked INSIDE the app.
        "host": "sergeantcs2.github.io",
        "name": "APEX ORV privacy policy (citation)",
        "what": "the app's own Pages site: privacy.html, written by play_assets.py and deployed by the pages job",
        "licence": "n/a — cited, not fetched",
        "tool": "the app's Data sources panel (PRIVACY_URL)",
        "phase": "citation",
        "refresh": "re-check the link still resolves before each submission",
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
        "also": "**Also provides (take 151, A169)** `DNR_State_Sponsored_Developed_"
                "Boating_Access_Sites_Public_View` — 1,325 in-state boat ramps, fetched "
                "by `bas.py`, merged into launches and corridor accesses. State-sponsored "
                "only; county/township ramps are in neither this layer nor OSM.",
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
        "inapp": " (pipeline) and **in-app** by the HD save flow (take 145, A160) "
                 "— user tap only, never at boot or idle",
        "phase": "provision",
        "refresh": "when NAIP re-flies, every 2-3 years",
        "note": "Landmine 22 — Esri, Google, Bing and Mapbox imagery are licensed "
                "and may NOT be redistributed offline. This one may.",
    },
    {
        # take 150 · A164: the one source with TWO phases — the site
        # inventory at build, and LIVE values fetched in-app on a user tap
        # (PROTOCOL §8 in-app rules, second entry on the runtime allowlist).
        # The count is the record's (241 sites, HANDOFF takes 150/179), not
        # the 1,332 this entry carried with no source (A204, take 186).
        "host": "waterservices.usgs.gov",
        "name": "USGS Water Services (NWIS)",
        "what": "Gauge site inventory at build (241 MI surface-water sites, "
                "22 KB) and LIVE instantaneous values (flow 00060, stage 00065, "
                "water temp 00010) fetched **in-app** on a user tap (take 150, A164)",
        "licence": "Public domain (US Government work)",
        "tool": "gauges.py",
        "inapp": " (inventory) and the river card's conditions button — §8 "
                 "in-app rules: tap only, never at boot or idle, never "
                 "load-bearing; stale values are never shipped (ruled out in AGENDA)",
        "phase": "provision",
        "refresh": "inventory each build; values are always live or absent",
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
                "region box, then clipped to it. TIGER 2024 since take 184; "
                "each county's file is cached under auth_cache/addrfeat/ and "
                "a county that cannot be fetched refuses the build (A196).",
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
        "tool": "ci/bundle.sh",
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
    {
        # take 164 · A181 · vendored, never fetched: no host, a file.
        "file": "tools/vendor/acorn.mjs",
        "filenote": "one generated ESM build, unmodified",
        "name": "acorn (vendored, not fetched)",
        "what": "the JavaScript parser tools/scrub.mjs uses to remove comments "
                "from the release artifact without mistaking a regex literal "
                "for a division (take 164, A181)",
        "licence": "MIT, text retained at the head of the vendored file",
        "tool": "nobody at build time — it is committed, because the data "
                "pipeline runs before `npm ci` and must not depend on it",
        "phase": "vendored",
        "refresh": "only if the parser needs updating; it is a pinned copy",
    },
]

# take 167 · A184 / take 181 · A195 · the citation-only hosts render as one
# section; the entries above keep them on the declared list for the gate.
CITATION_NOTE = """Play's Misleading Claims policy requires an app that presents government
information to link the official source. Six hosts therefore appear in the
store listing and in the app's Tools -> Data sources panel:
`www.michigan.gov`, `gis-midnr.opendata.arcgis.com`, `data.fs.usda.gov`,
`apps.nationalmap.gov`, `waterdata.usgs.gov`, `www.openstreetmap.org` —
and, since take 181 (A195), a seventh: `sergeantcs2.github.io`, the app's
own Pages site, for the privacy policy Play's User Data policy wants
reachable from inside the app as well as from the listing.

- **Fetched by** nobody. They are printed as text and links a rider may
  follow in their own browser; no tool requests them and the app never
  does. Declared in manifest.py under the `citation` phase (take 167,
  A184) so the claim is on the record rather than assumed.
- **Refresh** re-check each link resolves before every store submission —
  Play requires them to be valid and functional, and note that
  www.usgs.gov answers 503 to automated requests, which is why the USGS
  citations use apps.nationalmap.gov and waterdata.usgs.gov."""

# The imagery budget, measured at take 10 and frozen here (take 186, A204):
# imagery_budget.json is gitignored and rewritten by every pipeline run for
# the current region, so a render that read it changed with the workspace.
BUDGET_ROWS = [(12, 27.02, 10573, 104, 0.1), (13, 13.51, 41904, 400, 0.2),
               (14, 6.75, 167228, 1834, 0.9), (15, 3.38, 668050, 10024, 4.9),
               (16, 1.69, 2667378, 38344, 18.9)]

# measured, not estimated — see imagery.py and the take 10 handoff
BUDGET_NOTE = """Per-region download sizes, measured at take 10 over the
1,060 km2 Bull Gap / Mio / Rose City AOI. Statewide figures extrapolate by area
and are shown to rule statewide OUT, not to plan for it."""


def declared_hosts():
    return {s["host"] for s in SOURCES if s.get("host")}


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
    out = ["# PROVISION — what APEX downloads, and when", "",
           "*Generated by `tools/manifest.py`. Do not hand-edit.*", "",
           "PROTOCOL §8: **provisioning may use the network, the field may not.**",
           "Everything below is fetched at home on wifi, verified, and then never",
           "needed again. An undeclared fetch is the failure that passes on the",
           "bench and dies at Mack Lake — the gate refuses any host not listed here.",
           ""]

    def entry(e):
        rows = [f"### {e['name']}", ""]
        if e.get("file"):
            rows.append(f"- **File** `{e['file']}`" + (f" — {e['filenote']}" if e.get("filenote") else ""))
        else:
            rows.append(f"- **Host** `{e['host']}`")
        if e.get("also"):
            rows.append(f"- {e['also']}")
        rows += [f"- **Provides** {e['what']}",
                 f"- **Licence** {e['licence']}",
                 (f"- **Fetched by** {e['tool']}" if e.get("file")
                  else f"- **Fetched by** `{e['tool']}`{e.get('inapp', '')}"),
                 f"- **Refresh** {e['refresh']}"]
        if e.get("note"):
            rows.append(f"- **Note** {e['note']}")
        return rows + [""]

    for phase, title in (("provision", "Downloaded to the device"),
                         ("build", "Build machine only — never reaches a phone"),
                         ("vendored", "Vendored — committed, never fetched")):
        out += [f"## {title}", ""]
        for e in [x for x in SOURCES if x["phase"] == phase]:
            out += entry(e)

    out += ["## Citation-only hosts (displayed, never fetched)", "", CITATION_NOTE, ""]

    out += ["## Imagery size budget — measured", "", BUDGET_NOTE, "",
            "| zoom | m/px | tiles | AOI | statewide |",
            "|---|---|---|---|---|"]
    for z, mpp, tiles, aoi_mb, state_gb in BUDGET_ROWS:
        out.append(f"| z{z} | {mpp} | {tiles:,} | {aoi_mb} MB | {state_gb} GB |")
    out += ["",
            "**Measured at take 10, before the state was the region.** The rows say",
            "what a riding-area box costs per zoom; z16 over that one AOI is 38 GB,",
            "which settled it — full-sharpness imagery is per area, on a rider's own",
            "tap (the HD saves, A160/A190), never shipped. The statewide bundle",
            "carries z10–12 with z13–15 patches over the riding areas.", ""]

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
