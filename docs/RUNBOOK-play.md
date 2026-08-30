# RUNBOOK — Google Play

*Appended by the Play kit. The app's own runbook is unchanged.*

## A. Applying the kit to a NEW seed (the normal case)

The app is built in one chat; Play is shipped from another. Take numbers move
independently, so the Play work is a patch, not a take. When a newer seed
arrives:

```
unzip apex-seed-tNNN.zip -d tree
unzip play-kit.zip       -d tree/play-kit
cd tree
python3 play-kit/apply.py --check     # dry run: every anchor found?
python3 play-kit/apply.py             # -> take NNN+1, Play-ready
npm install                           # regenerate the lockfile (CI runs npm ci)
python3 tools/gate.py
```

`--check` first, always. If an anchor is missing the applier REFUSES and names
the edit: the seed changed that region and the patch needs reconciling. It
never half-applies and never silently skips (landmine 208).

Applying twice is safe — the second run reports `changed 0`.

## B. One-time setup on Google's side

1. **Upload key, generated on the Fold in Termux.** It never appears in chat,
   in the repo, or in a seed zip.
   ```
   pkg install openjdk-17            # provides keytool
   keytool -genkeypair -v -keystore ~/apex-upload.jks -storetype PKCS12 \
     -alias apexupload -keyalg RSA -keysize 2048 -validity 10000
   ```
   Answer the prompts; choose a password you keep in your password manager.
   Copy `~/apex-upload.jks` somewhere off the phone as a backup.
   ```
   base64 -w0 ~/apex-upload.jks > ~/apex-upload.b64      # for the secret
   ```
2. **Four repository secrets** (GitHub → Settings → Secrets → Actions):
   `PLAY_UPLOAD_KEYSTORE_B64` (the base64 above), `PLAY_UPLOAD_STORE_PASS`,
   `PLAY_UPLOAD_KEY_ALIAS` (`apexupload`), `PLAY_UPLOAD_KEY_PASS`.
   Until they exist CI still succeeds, but names the bundle
   `…-DEVKEY-DO-NOT-UPLOAD.aab` — that file cannot be uploaded to Play.
3. **Re-paste `ci/build.yml`** into `.github/workflows/build.yml` once. The
   seed cannot write workflows (landmine 46); diff it job by job against what
   is there — the `seed` job and `apex-seed*.zip` in `push.paths` are
   load-bearing and have been dropped by a paste before (landmine 202).
4. **Play Console**: create the app, accept Play App Signing, keep the
   applicationId `com.apexoffroad.app` — permanent from the first upload.
5. **Enable GitHub Pages** (Settings → Pages → Source: GitHub Actions) so the
   privacy policy is live at `https://<user>.github.io/<repo>/privacy.html`.
   That URL goes in the console; Play requires a working one.
6. **Set the contact email** in `tools/play_assets.py` (`CONTACT`).

## C. Every build after that

The `apk` job publishes three things to the Releases tab:

| Artifact | What it is |
|---|---|
| `apex-orv-take-N.apk` | sideload, committed key — installs over the last take |
| `apex-orv-take-N.aab` | the Play upload, private upload key |
| `play-assets-N.zip` | 512 icon, 1024×500 feature graphic, privacy.html, listing copy, data safety answers, release notes |

Upload the **.aab** to the Play track. The listing text and images come from
the zip. Screenshots are the only thing not generated — take them on the Fold.

**The Play build and a sideloaded take cannot coexist**: same applicationId,
different signing keys. Uninstall one before installing the other.

## D. The track sequence

Internal testing (instant, any number of testers) → complete the app setup →
closed testing → **12 testers opted in for 14 continuous days** → apply for
production. A tester who opts out restarts their clock. Read the pre-launch
report after the first upload as a field report and file items from it.
