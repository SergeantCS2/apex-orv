#!/usr/bin/env python3
"""Run the whole region pipeline. One command, no hand steps.

Take 13 ran this sequence from a clean checkout for the first time and found
four things missing: a reverted Overpass fetch, an Overpass user-agent, a
hillshade trim that lived in a throwaway script, and no producer at all for the
water layer. Every one of them was invisible because the artifacts survived on
disk from earlier runs (landmine 32).

The sequence lives here rather than in the workflow so it can be run and tested
anywhere, and so CI and a laptop cannot diverge.
"""
import subprocess, sys, time, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region import R, ALL, ensure_workspace

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

STEPS = [
    ("ingest",     ["ingest.py"],      "DNR + USFS + OSM"),
    ("pack",       ["pack.py"],        "water layer"),
    ("poi",        ["poi.py"],         "places you can ride to"),
    ("graph",      ["graph.py"],       "conflate and node the network"),
    ("emit_graph", ["emit_graph.py"],  "client payload"),
    # areas before terrain (take 120): terrain patches z13 DEM over each area
    ("areas",     ["areas.py"],       "DNR scramble areas — open riding ground as polygons"),
    ("terrain",    ["terrain.py"],     "DEM, climb, hillshade"),
    ("contour",    ["contour.py"],     "contour lines from the same DEM"),
    ("corridor",   ["corridor.py"],    "a river beyond the box, ordered downstream"),
    ("landcover", ["landcover.py"], "the ground itself — forest, wetland, park and public-land polygons"),
    ("glyphs",     ["glyphs.py"],      "SDF label pack"),
    ("context",    ["context.py"],     "state outline for orientation"),
    ("address",    ["address.py"],     "offline address index"),
    ("imagery",    ["imagery.py"],      "satellite basemap"),
    ("bundle",     ["bundle.py", "build", None], "region bundle"),
    ("build_app",  ["build_app.py", "split"], "assemble www/"),
    ("smoke",      ["smoke.mjs"],      "execute the shipped app (live GPS)"),
    ("smoke-sim",  ["smoke.mjs", "--no-gps"], "execute again on the simulator path"),
    ("smoke-fatal",["smoke.mjs", "--fatal-drill"], "drill the unusable-region refusal"),
    ("smoke-dead", ["smoke.mjs", "--dead-renderer"], "drill the RENDER FAIL detector"),
    ("smoke-away", ["smoke.mjs", "--away"], "drill planning mode out of region"),
    ("render",     ["render.mjs"],     "render in a real browser and check pixels"),
    ("palette",    ["verify_palette.mjs"], "legend swatches vs the colours the map paints"),
]


def run(name, args, why):
    t0 = time.time()
    print(f"\n\u2500\u2500 {name}  ({why})")
    argv = [a if a is not None else R.id for a in args[1:]]
    runner = ["node"] if args[0].endswith(".mjs") else [sys.executable]
    extra = [] if args[0].endswith(".mjs") else ["--region", R.id]
    if args[0] == "smoke.mjs" and name == "smoke":
        # smoke needs the manifest in place first
        import shutil
        shutil.copyfile(os.path.join(ROOT, "bundles", R.id, "manifest.json"),
                        os.path.join(ROOT, "www", "bundle", "manifest.json"))
    r = subprocess.run(runner + [os.path.join(HERE, args[0])] + argv + extra,
                       cwd=ROOT)
    if r.returncode:
        sys.exit(f"\n{name} failed ({r.returncode}) — pipeline stopped")
    print(f"   {time.time()-t0:.1f}s")


if __name__ == "__main__":
    only = [a for a in sys.argv[1:]
            if not a.startswith("--") and a != R.id] or None
    print(f"region {R.id} — {R.name}  {R.bbox}")
    ensure_workspace()
    t0 = time.time()
    for name, args, why in STEPS:
        if only and name not in only:
            continue
        run(name, args, why)
    print(f"\npipeline complete for {R.id} in {time.time()-t0:.0f}s")
