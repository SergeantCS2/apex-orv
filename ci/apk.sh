#!/usr/bin/env bash
# Everything the apk job does. Each CI job is a FRESH runner, so this installs
# its own Python deps — android.py imports icon.py which needs PIL (landmine 83).
#
# Play kit: three artifacts, two keys, one appId.
#   apex-orv-take-N.apk  — sideload, COMMITTED key (installs over the last take)
#   apex-orv-take-N.aab  — Play, PRIVATE upload key from Actions secrets
# The workflow passes the PLAY_UPLOAD_* secrets through as env unchanged; all
# the logic is here, where the seed can update it (landmines 46/84).
set -euo pipefail

python3 -m pip install --quiet pillow

python3 tools/android.py
npx cap sync android

# ── 1. sideload APK, committed key ─────────────────────────────────────────
( cd android && ./gradlew assembleRelease --no-daemon -q )
# Refuse the ARTIFACT if a Play requirement regressed (targetSdk 36,
# versionCode = take, no cleartext, no debuggable, exported declared).
python3 tools/android_check.py android/app/build/outputs/apk/release/app-release.apk

T=$(grep -oP 'OFFROAD_TAKE=\K[0-9]+' BUILD)
cp android/app/build/outputs/apk/release/app-release.apk "apex-orv-take-$T.apk"

# ── 2. Play AAB, upload key if the secrets are set ─────────────────────────
AAB="apex-orv-take-$T.aab"
PLAY=1
if [ -n "${PLAY_UPLOAD_KEYSTORE_B64:-}" ]; then
  KS="$(mktemp -d)/upload.jks"                       # outside the tree, never committed
  echo "$PLAY_UPLOAD_KEYSTORE_B64" | base64 -d > "$KS"
  export PLAY_UPLOAD_KS="$KS"
  : "${PLAY_UPLOAD_STORE_PASS:?}" "${PLAY_UPLOAD_KEY_ALIAS:?}" "${PLAY_UPLOAD_KEY_PASS:?}"
  ( cd android && ./gradlew bundleRelease -Pupload=1 --no-daemon -q )
else
  echo "::warning::PLAY_UPLOAD_* secrets not set — AAB signed with the COMMITTED dev key; NOT uploadable to Play (take 155)"
  ( cd android && ./gradlew bundleRelease --no-daemon -q )
  AAB="apex-orv-take-$T-DEVKEY-DO-NOT-UPLOAD.aab"
  PLAY=0
fi
cp android/app/build/outputs/bundle/release/app-release.aab "$AAB"

# ── 3. prove the bundle the way Play will read it ──────────────────────────
# bundletool pinned by version AND sha256 — a tool that changes under the
# build is a build that changes (landmine 81).
BT_VER=1.18.1
BT_SHA=675786493983787ffa11550bdb7c0715679a44e1643f3ff980a529e9c822595c
curl -fsSL -o /tmp/bundletool.jar \
  "https://github.com/google/bundletool/releases/download/$BT_VER/bundletool-all-$BT_VER.jar"
echo "$BT_SHA  /tmp/bundletool.jar" | sha256sum -c -
java -jar /tmp/bundletool.jar validate --bundle="$AAB" > /dev/null && echo "bundletool validate: ok"
rm -rf /tmp/bt && java -jar /tmp/bundletool.jar build-apks --bundle="$AAB" \
  --output=/tmp/bt/u.apks --mode=universal
( cd /tmp/bt && unzip -q u.apks )
python3 tools/android_check.py /tmp/bt/universal.apk          # manifest, from the bundle
if [ "$PLAY" = 1 ]; then python3 tools/android_check.py --play "$AAB"   # signer, from the bundle
else                     python3 tools/android_check.py        "$AAB"; fi
# 16 KB page alignment: the shell carries no native libs (proven take 154),
# but assert it on the artifact rather than remember it.
ZA=$(ls -d "$ANDROID_HOME"/build-tools/*/zipalign | sort | tail -1)
"$ZA" -c -P 16 -v 4 /tmp/bt/universal.apk > /dev/null && echo "16 KB alignment: verified"

# ── 4. everything else Play asks for (icon, feature graphic, policy,
#      listing copy, data safety answers, release notes) ───────────────────
python3 tools/play_assets.py
ASSETS="play-assets-$T.zip"
( cd play && zip -qr "../$ASSETS" . )

{
  echo "take=$T"
  echo "apk=apex-orv-take-$T.apk"
  echo "aab=$AAB"
  echo "assets=$ASSETS"
} >> "${GITHUB_OUTPUT:-/dev/null}"
echo "built apex-orv-take-$T.apk, $AAB, $ASSETS"
