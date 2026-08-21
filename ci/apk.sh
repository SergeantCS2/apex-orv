#!/usr/bin/env bash
# Everything the apk job does. Each CI job is a FRESH runner, so this installs
# its own Python deps — android.py imports icon.py which needs PIL (landmine 83).
set -euo pipefail

python3 -m pip install --quiet pillow

python3 tools/android.py
npx cap sync android
( cd android && ./gradlew assembleRelease --no-daemon -q )

T=$(grep -oP 'OFFROAD_TAKE=\K[0-9]+' BUILD)
cp android/app/build/outputs/apk/release/app-release.apk "apex-orv-take-$T.apk"
echo "take=$T" >> "${GITHUB_OUTPUT:-/dev/null}"
echo "apk=apex-orv-take-$T.apk" >> "${GITHUB_OUTPUT:-/dev/null}"
echo "built apex-orv-take-$T.apk"
