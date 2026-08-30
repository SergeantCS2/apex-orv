"""Refuse a built Android artifact that regressed a Play requirement.

Take 153 (A170). The source manifest is what android.py writes; the ARTIFACT
is what Play reads, and the two differ after manifest merging (plugins add
components, AGP adds attributes). So this reads the built APK with aapt2 —
the same tool Play's own pre-review uses — and fails loudly on:

  targetSdk < 36        versionCode != OFFROAD_TAKE     debuggable=true
  usesCleartextTraffic  any component without exported   allowBackup absent

Usage:  python3 tools/android_check.py [--play] path/to/app.apk
  --play  the artifact is bound for Play: refuse the committed dev key (take 155)
  an .aab path checks the bundle's signer only; an .apk path checks the manifest
Needs ANDROID_HOME (aapt2 in build-tools) — true on ubuntu-latest and here.
"""
import glob, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET_SDK, MIN_SDK = 36, 26


def aapt2():
    home = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    cands = sorted(glob.glob(os.path.join(home or "/nonexistent",
                                          "build-tools", "*", "aapt2")))
    if not cands:
        sys.exit("aapt2 not found: set ANDROID_HOME (build-tools required)")
    return cands[-1]


def take():
    m = re.search(r"OFFROAD_TAKE=(\d+)", open(os.path.join(ROOT, "BUILD")).read())
    return int(m.group(1))


def unexported(tree):
    """(component count, [components lacking android:exported]) from an
    aapt2 xmltree dump. A component's attributes are the A: lines that
    follow its E: line at deeper indent, up to the next E: at any depth."""
    lines = tree.splitlines()
    comps, missing = 0, []
    i = 0
    while i < len(lines):
        m = re.match(r"(\s*)E: (activity|service|receiver|provider|activity-alias) ", lines[i])
        if m:
            comps += 1
            attrs, j = [], i + 1
            while j < len(lines) and not re.match(r"\s*E: ", lines[j]):
                attrs.append(lines[j]); j += 1
            blob = "\n".join(attrs)
            name = re.search(r'android:name\(0x[0-9a-f]+\)="([^"]+)"', blob)
            if not re.search(r"android:exported\(0x[0-9a-f]+\)=", blob):
                missing.append(f"{m.group(2)}:{name.group(1) if name else '?'}")
            i = j
        else:
            i += 1
    return comps, missing


def selftest():
    good = """E: application
        A: android:allowBackup(0x01010280)=true
          E: activity (line=1)
            A: android:name(0x01010003)="A"
            A: android:exported(0x01010010)=true
          E: provider (line=2)
            A: android:exported(0x01010010)=false"""
    bad = good.replace('            A: android:exported(0x01010010)=false', "")
    assert unexported(good) == (2, []), unexported(good)
    assert unexported(bad) == (2, ["provider:?"]), unexported(bad)
    print("android_check selftest ok: exported audit refuses a bare component")


def signer_dn(artifact):
    """DN of the certificate that signed an APK or AAB. keytool reads the
    jar signature, which is what an AAB carries — bundletool's derived
    universal APK is signed by bundletool's own key and says NOTHING about
    who signed the bundle (found while writing this; landmine 193)."""
    out = subprocess.run(["keytool", "-printcert", "-jarfile", artifact],
                         capture_output=True, text=True).stdout
    m = re.search(r"Owner: (.*)", out)
    return m.group(1).strip() if m else "UNSIGNED"


def check_aab_signer(aab, play):
    dn = signer_dn(aab)
    print(f"android_check — {os.path.basename(aab)}\n  signer {dn}")
    if dn == "UNSIGNED":
        print("  FAIL bundle is unsigned"); sys.exit(1)
    if play and dn.startswith(DEV_CN):
        print(f"  FAIL signed by the COMMITTED dev key but named as a Play "
              f"artifact — set the PLAY_UPLOAD_* secrets (take 155)"); sys.exit(1)
    if not play and not dn.startswith(DEV_CN):
        print("  note: dev-named bundle carries a non-dev signer")
    print("android_check PASSED (signer)")


DEV_CN = "CN=APEX Off-road"   # the committed keystore's cert (tools/android.py)


def check(apk, play=False):
    a = aapt2()
    badging = subprocess.run([a, "dump", "badging", apk], capture_output=True,
                             text=True, check=True).stdout
    tree = subprocess.run([a, "dump", "xmltree", "--file", "AndroidManifest.xml",
                           apk], capture_output=True, text=True, check=True).stdout
    fails = []

    def field(pat, src=badging):
        m = re.search(pat, src)
        return m.group(1) if m else None

    vc = int(field(r"versionCode='(\d+)'") or 0)
    vn = field(r"versionName='([^']*)'")
    tsdk = int(field(r"targetSdkVersion:'(\d+)'") or 0)
    msdk = int(field(r"minSdkVersion:'(\d+)'") or 0)
    pkg = field(r"package: name='([^']*)'")
    t = take()
    if vc != t:
        fails.append(f"versionCode {vc} != OFFROAD_TAKE {t}")
    if vn != f"2.{t}":
        fails.append(f"versionName {vn!r} != '2.{t}'")
    if tsdk < TARGET_SDK:
        fails.append(f"targetSdkVersion {tsdk} < {TARGET_SDK} (Play, new apps)")
    if msdk != MIN_SDK:
        fails.append(f"minSdkVersion {msdk} != {MIN_SDK} (README promise)")
    if pkg != "com.sergeantslabs.apex":
        fails.append(f"package {pkg} — appId is permanent on Play (A170)")

    # xmltree: attribute lines look like  A: android:debuggable(0x0101000f)=true
    app = tree.split("E: application", 1)[1] if "E: application" in tree else tree
    def attr(name, src=app):
        m = re.search(rf"android:{name}\(0x[0-9a-f]+\)=(\S+)", src)
        return m.group(1) if m else None
    if attr("debuggable") == "true":
        fails.append("android:debuggable=true in the artifact")
    if attr("usesCleartextTraffic") != "false":
        fails.append(f"usesCleartextTraffic={attr('usesCleartextTraffic')} (want false)")
    if attr("allowBackup") != "true":
        fails.append(f"allowBackup={attr('allowBackup')} (decided true, A170)")

    ncomp, missing = unexported(tree)
    if missing:
        fails.append("components without android:exported: " + ", ".join(missing))

    perms = re.findall(r"uses-permission: name='([^']+)'", badging)
    print(f"android_check — {os.path.basename(apk)}")
    print(f"  package {pkg}  versionCode {vc}  versionName {vn}  "
          f"minSdk {msdk}  targetSdk {tsdk}")
    print(f"  components {ncomp} (all exported-declared: {not missing})  "
          f"permissions {len(perms)}: {', '.join(p.rsplit('.',1)[1] for p in perms)}")
    for f in fails:
        print(f"  FAIL {f}")
    print("android_check PASSED" if not fails else f"android_check FAILED ({len(fails)})")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--selftest":
        selftest(); sys.exit(0)
    play = "--play" in sys.argv
    args = [x for x in sys.argv[1:] if x != "--play"]
    if len(args) != 1:
        sys.exit(__doc__)
    selftest()
    if args[0].endswith(".aab"):
        check_aab_signer(args[0], play); sys.exit(0)
    check(args[0], play=play)
