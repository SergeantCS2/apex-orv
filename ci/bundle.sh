#!/usr/bin/env bash
# Everything the bundle job does. Lives in the REPO, not in the workflow file,
# because the workflow is pasted by hand and cannot be updated by the seed job
# (GITHUB_TOKEN has no workflows permission — landmine 46). Anything that changes
# belongs here, where seeding a new zip updates it (landmine 84).
set -euo pipefail

python3 -m pip install --quiet pillow numpy scipy pyyaml osmium scikit-image shapely
# Take 136: the photo step does NOT fetch on CI. Wikimedia rate-limits cloud
# runners so hard that two builds sat on "address:" until the 90-minute
# timeout. The photos are fetched locally and shipped in the seed; this
# tells photos.py to use them as-is.
export APEX_PHOTO_BUDGET_S=0

python3 tools/pipeline.py

# The region comes from regions.json, not from an env var (take 118 removed
# the workflow pin; take 119 removed THIS last reader of it — under `set -u`
# it killed Jacob's first successful statewide build one line after the
# pipeline finished, landmine 199's corollary). region.py is the one place
# that resolves it; ask it.
REGION="$(python3 -c 'import sys; sys.path.insert(0,"tools"); from region import R; print(R.id)')"
cp "bundles/${REGION}/manifest.json" www/bundle/manifest.json
mkdir -p www/vendor
# CSP build plus a real worker file: Android WebView cannot start MapLibre's
# blob: worker, so every source-backed layer drew nothing (landmine 47).
for f in maplibre-gl.css maplibre-gl-csp.js maplibre-gl-csp-worker.js; do
  curl -fsSL -o "www/vendor/$f" "https://unpkg.com/maplibre-gl@5/dist/$f"
done
test -s www/vendor/maplibre-gl-csp-worker.js

# The render check found a map that had drawn nothing for 14 takes. Without a
# browser the gate merely NOTES that it skipped (landmine 53).
npm ci --no-audit --no-fund || npm install --no-audit --no-fund
npx puppeteer browsers install chrome
node tools/render.mjs
# The pipeline has a palette step, but the pipeline runs ABOVE this line —
# before npm ci — so it finds no puppeteer and skips. Run it here, where chrome
# exists. A check that skips is not a check (landmine 53).
node tools/verify_palette.mjs

python3 tools/gate.py

# ── Built what the seed declared? (take 118, landmine 199) ─────────────────
# Take 117's seed declared ALL OF MICHIGAN; the hand-pasted workflow held a
# hardcoded APEX_REGION override and CI shipped the box wearing the new take —
# same speed, same size, full green. This check lives HERE, where the seed can
# update it: the built manifest must name the region regions.json declares,
# and a statewide bundle has a size floor no box can fake.
python3 - <<'VERIFY'
import json, os, sys
want = json.load(open("regions.json"))["default"]
if os.environ.get("APEX_REGION") and os.environ["APEX_REGION"] != want:
    sys.exit(f"CI env pins APEX_REGION={os.environ['APEX_REGION']} but the "
             f"seed declares {want}. Delete APEX_REGION from the workflow "
             f"env — the seed's regions.json is the single source of truth "
             f"(take 118).")
man = json.load(open("www/bundle/manifest.json"))
got = man.get("region")
if got != want:
    sys.exit(f"built {got}, seed declares {want} — stale cache or override; "
             f"see ci/build.yml header for the remedy")
size = sum(os.path.getsize(os.path.join(r, f))
           for r, _, fs in os.walk("www/bundle") for f in fs)
print(f"verified: region {got}, bundle {size//1048576} MB")
if want == "michigan" and size < 90 * 1048576:
    sys.exit(f"michigan bundle is only {size//1048576} MB — that is the box "
             f"in a trench coat (stale cache); bump the cache key and rerun")
VERIFY

{
  echo "### Region bundle"
  echo '```'
  du -h www/bundle/* www/vendor/* 2>/dev/null || true
  du -sh www
  echo '```'
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
