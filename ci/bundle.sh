#!/usr/bin/env bash
# Everything the bundle job does. Lives in the REPO, not in the workflow file,
# because the workflow is pasted by hand and cannot be updated by the seed job
# (GITHUB_TOKEN has no workflows permission — landmine 46). Anything that changes
# belongs here, where seeding a new zip updates it (landmine 84).
set -euo pipefail

python3 -m pip install --quiet pillow numpy scipy pyyaml

python3 tools/pipeline.py

cp "bundles/${APEX_REGION}/manifest.json" www/bundle/manifest.json
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

python3 tools/gate.py

{
  echo "### Region bundle"
  echo '```'
  du -h www/bundle/* www/vendor/* 2>/dev/null || true
  du -sh www
  echo '```'
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
