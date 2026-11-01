#!/usr/bin/env bash
# Ready a fresh cloud container to run smoke, render and probe on the repo head,
# with no workstation and no local pipeline run.
#
# What it does, in order:
#   1. npm ci without puppeteer's own Chrome download
#   2. installs the Chrome CI pins (read from ci/bundle.sh, never typed here):
#      render on any other Chrome is not CI's render (Chrome 153 refuses
#      headless geolocation and fails two ride checks that pass on 138)
#   3. restores www/bundle and www/vendor from the APK of the newest green
#      CI run on main: the data the last proper build made. Both are gitignored.
#   4. says whether the committed www/app.js equals the APK's (a take in
#      progress will differ; the head of main should not)
#
# Needs: gh (authenticated), node, npm, unzip, python3.
# Prints the environment line to export before render/probe.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPO="${APEX_REPO:-SergeantCS2/apex-orv}"
WORK="${APEX_SETUP_DIR:-$HOME/.apex-setup}"
mkdir -p "$WORK"

echo "== 1. npm ci (no bundled Chrome)"
PUPPETEER_SKIP_DOWNLOAD=1 npm ci --no-audit --no-fund >/dev/null

echo "== 2. CI's pinned Chrome"
PIN="$(sed -n 's/^CHROME_PIN="\([0-9.]*\)"$/\1/p' ci/bundle.sh)"
test -n "$PIN" || { echo "no CHROME_PIN in ci/bundle.sh"; exit 1; }
npx puppeteer browsers install "chrome@$PIN" >/dev/null
CHROME="$HOME/.cache/puppeteer/chrome/linux-$PIN/chrome-linux64/chrome"
test -x "$CHROME" || { echo "Chrome $PIN not installed at $CHROME"; exit 1; }
"$CHROME" --version

echo "== 3. bundle from the newest green CI run on main"
RUN="$(gh api "repos/$REPO/actions/runs?branch=main&status=success&per_page=1" --jq '.workflow_runs[0].id')"
SHA="$(gh api "repos/$REPO/actions/runs/$RUN" --jq '.head_sha')"
ART="$(gh api "repos/$REPO/actions/runs/$RUN/artifacts" --jq '.artifacts[] | select(.name=="apk" and (.expired|not)) | .id')"
test -n "$ART" || { echo "run $RUN has no unexpired apk artifact"; exit 1; }
echo "run $RUN at ${SHA:0:7}, apk artifact $ART"
rm -rf "$WORK/apk" && mkdir -p "$WORK/apk"
gh api "repos/$REPO/actions/artifacts/$ART/zip" > "$WORK/apk/artifact.zip"
(cd "$WORK/apk" && unzip -q artifact.zip && unzip -q ./*.apk 'assets/public/*')
PUB="$WORK/apk/assets/public"
test -s "$PUB/bundle/manifest.json" || { echo "the APK carries no bundle/manifest.json"; exit 1; }
rm -rf www/bundle www/vendor
cp -r "$PUB/bundle" "$PUB/vendor" www/
du -sh www/bundle www/vendor

echo "== 4. the committed build against the APK's"
for f in app.js index.html licenses.txt; do
  if cmp -s "www/$f" "$PUB/$f"; then echo "www/$f equals the APK's"; else echo "www/$f DIFFERS from the APK's"; fi
done
echo
echo "export PUPPETEER_EXECUTABLE_PATH=$CHROME"
