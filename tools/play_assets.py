"""Everything Google Play asks for that is not the bundle, generated.

Play's console wants a 512 icon, a 1024x500 feature graphic, screenshots, a
privacy policy URL, a data safety declaration, listing copy and release notes.
All but the screenshots are derivable from what the repo already holds, so
they are generated on every build instead of being hand-kept and drifting
(landmine 32: assets are generated, never committed as binaries; landmine 98:
a document kept beside the thing it describes drifts from it).

Writes ./play/ and prints what it made. Run by ci/apk.sh; also runnable by
hand. The privacy policy is deployed by the pages job at /privacy.html —
that URL is what goes in the Play console.

The policy text is not marketing: it is what the code does, checked against
the code. Two network features exist (HD imagery saves, USGS gauge readings)
and both are user-tap-only; everything else is offline by PROTOCOL §8. If
that stops being true, this file is wrong and the gate's offline check will
have failed first.
"""
import json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "play")
APP_NAME = "APEX ORV"
APP_ID = "com.sergeantslabs.apex"
CONTACT = "sergeantetsy@gmail.com"


def take():
    m = re.search(r"OFFROAD_TAKE=(\d+)", open(os.path.join(ROOT, "BUILD")).read())
    return int(m.group(1))


def images():
    from PIL import Image, ImageDraw
    src = Image.open(os.path.join(ROOT, "assets", "logo-master.png")).convert("RGBA")
    made = []

    # 512x512 store icon: 32-bit PNG, no alpha shenanigans, square.
    icon = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    s = src.copy()
    s.thumbnail((512, 512), Image.LANCZOS)
    icon.paste(s, ((512 - s.width) // 2, (512 - s.height) // 2), s)
    bg = src.getpixel((2, 2))[:3]     # the master's OWN background, sampled —
    flat = Image.new("RGB", (512, 512), bg)   # never a colour typed from memory
    flat.paste(icon, (0, 0), icon)
    flat.save(os.path.join(OUT, "icon-512.png"))
    made.append("icon-512.png")

    # 1024x500 feature graphic. No text: Play overlays the app name itself,
    # and text in the graphic is the first thing that looks amateur when it
    # collides with the overlay.
    # The wash runs from the logo's own background so the mark sits ON the
    # graphic instead of reading as a pasted box (seen at first render).
    fg = Image.new("RGB", (1024, 500), bg)
    d = ImageDraw.Draw(fg)
    for y in range(500):
        k = y / 500
        d.line([(0, y), (1024, y)],
               fill=tuple(max(0, int(c * (1.0 - 0.45 * k))) for c in bg))
    logo = src.copy()
    logo.thumbnail((300, 300), Image.LANCZOS)
    top = (500 - logo.height) // 2
    band = fg.crop((362, top, 362 + logo.width, top + logo.height))
    band.paste(logo, (0, 0), logo)
    # feather the logo's square edge into the wash
    from PIL import ImageChops
    mask = Image.new("L", band.size, 0)
    ImageDraw.Draw(mask).ellipse((-30, -30, band.width + 30, band.height + 30), fill=255)
    fg.paste(band, (362, top), mask.filter(__import__("PIL.ImageFilter", fromlist=["x"]).GaussianBlur(18)))
    fg.save(os.path.join(OUT, "feature-graphic-1024x500.png"))
    made.append("feature-graphic-1024x500.png")
    return made


POLICY = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>APEX ORV — Privacy Policy</title>
<style>
 body{{background:#0b0f0d;color:#e8ece9;font:16px/1.6 system-ui,sans-serif;
      margin:0 auto;padding:32px 20px;max-width:44rem}}
 h1{{font-size:1.5rem}} h2{{font-size:1.05rem;margin-top:2rem;color:#9fd3b4}}
 code{{background:#151b18;padding:2px 5px;border-radius:4px}}
 .foot{{color:#8b968f;font-size:.85rem;margin-top:3rem}}
</style></head><body>
<h1>APEX ORV — Privacy Policy</h1>
<p><b>APEX ORV collects nothing.</b> There is no account, no analytics, no
advertising, no crash reporting and no server belonging to this app. Nothing
you do in it is transmitted to the developer or to anyone else.</p>

<h2>Location</h2>
<p>The app requests location so it can draw where you are on the trail, record
a ride, and navigate. Location is used <b>on your device only</b>. It is never
uploaded, never stored off the device, and never shared. Denying the
permission leaves every other feature working; only the moving position dot
and ride recording stop.</p>

<h2>What is stored on your phone</h2>
<p>Waypoints, saved routes, recorded rides, and your preferences are stored in
the app's own storage on your device. Uninstalling the app removes them.
Android's backup service may include them in your device backup so a new phone
restores your waypoints; that backup is between you and Google, and the
developer has no access to it.</p>

<h2>The two times the app uses the network</h2>
<p>The map, trails, terrain and search all work with no signal — that is the
point of the app. The network is touched only when you tap something that
plainly asks for it:</p>
<ul>
  <li><b>Saving or streaming high-detail imagery</b> — tiles are requested
      from the U.S. Geological Survey's public imagery service.</li>
  <li><b>River conditions</b> — a live reading is requested from the U.S.
      Geological Survey's water services.</li>
</ul>
<p>Those requests carry the map tile or gauge being asked for. No identifier
of you or your device is attached by the app.</p>

<h2>Children</h2>
<p>The app is a trail navigation tool, is not directed at children, and
collects no personal information from anyone.</p>

<h2>Changes</h2>
<p>If this ever stops being accurate, this page changes with the release that
changed it. It is generated from the repository that builds the app.</p>

<p class="foot">{app} ({appid}) · build {take} · contact: {contact}</p>
</body></html>
"""

DATA_SAFETY = """# Play Console — Data safety answers ({app}, build {take})

Answered from the code, not from memory. Re-read `docs/PROVISION.md` and the
gate's offline check before changing any line here.

## Data collection and sharing
- **Does your app collect or share any of the required user data types?**
  **No.**
  The app has no backend. It sends no user data anywhere. Location is read by
  the device and used in-process to draw and record; it is never transmitted.

## If the console asks about location specifically
- Collected: **No** · Shared: **No** · Processed ephemerally: **Yes**
  (used on-device to render position and, if the user records a ride, written
  only to the app's own local storage).
- Required for the app to function: **No** — the map and every planning
  feature work without the permission.

## Data security
- **Is all user data encrypted in transit?** No user data is transmitted.
  The two user-initiated fetches (USGS imagery, USGS water services) are HTTPS
  and carry no user data.
- **Can users request data deletion?** Data never leaves the device;
  uninstalling deletes it. There is nothing on a server to delete.

## Permissions to justify in the listing
| Permission | Why |
|---|---|
| ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION | Draw the rider's position on the trail and record a ride. |
| WAKE_LOCK | Keep the navigation screen awake while riding — a nav screen that sleeps mid-trail is a safety failure. |
| VIBRATE | Turn and off-route alerts the rider can feel through a glove. |
| INTERNET / ACCESS_NETWORK_STATE | The two user-tapped fetches above. The app is fully usable with no signal. |

## Ads, purchases, accounts
None, none, none. The app is free and has no in-app purchases.
"""


def listing(t):
    """Store listing copy. 30/80/4000 character limits are Play's."""
    short = "Offline ORV, trail and water navigation for all of Michigan."
    full = """Michigan trails, off the grid.

APEX ORV is a free, fully offline trail app for Michigan riders. Every trail,
road, contour and satellite tile ships inside the app — once it is installed,
it needs no signal, no subscription and no account. That is the whole idea: the
places worth riding are the places without bars.

WHAT IS IN IT
- Michigan's ORV trail system: routes, connectors and forest roads, drawn from
  state DNR and U.S. Forest Service data alongside OpenStreetMap.
- Four modes that each plan something. Off-road plans by machine on the trail
  network. Outdoors and Hunt plan on foot. Water plans river runs by boat.
- Turn-by-turn routing and Return Home, computed on the phone.
- Terrain and elevation, with a live elevation readout.
- Satellite imagery for the whole state, offline, with optional high-detail
  imagery you can save for a specific area when you have wifi.
- Trailheads, campgrounds, launches, liveries, fuel and food as searchable
  pins, with photos where they exist.
- Ride recording, waypoints, and a self-test that tells you the app is
  actually working before you are three miles in.
- Live river conditions from USGS gauges when you have signal and tap for them.

WHAT IT DOES NOT DO
No account. No ads. No tracking. No analytics. Nothing you do is sent
anywhere. It does not need a data connection to do its job, and it will not
quietly use one.

HONEST LIMITS
Trail legality comes from agency data and can lag a closure — signs on the
ground always win. County and township boat ramps are missing where no public
dataset lists them. High-detail imagery beyond the built-in level needs wifi
to save first.

Michigan only, on purpose."""
    assert len(APP_NAME) <= 30 and len(short) <= 80 and len(full) <= 4000
    return f"""# Play store listing — {APP_NAME} (build {t})

- **App name** (30 max, {len(APP_NAME)} used): {APP_NAME}
- **Short description** (80 max, {len(short)} used): {short}
- **Category**: Maps & Navigation · **Tags**: navigation, outdoors, offline
- **Contact email**: {CONTACT}
- **Privacy policy URL**: https://<user>.github.io/<repo>/privacy.html
- **Content rating**: questionnaire — no violence, no user content, no ads,
  no purchases; expect Everyone.

## Full description ({len(full)} of 4000)

{full}

## Screenshots (the one thing not generated)
Play needs at least 2 phone screenshots, 16:9 or 9:16, min 320 px.
Take them on the Fold: the map in Off-road mode, a route with the turn list,
a POI card, and Water mode's run planner.
"""


def main():
    os.makedirs(OUT, exist_ok=True)
    t = take()
    made = images()
    open(os.path.join(OUT, "privacy.html"), "w").write(
        POLICY.format(app=APP_NAME, appid=APP_ID, take=t, contact=CONTACT))
    open(os.path.join(OUT, "data-safety.md"), "w").write(
        DATA_SAFETY.format(app=APP_NAME, take=t))
    open(os.path.join(OUT, "listing.md"), "w").write(listing(t))
    rel = os.path.join(ROOT, "ci", "RELEASE.md")
    if os.path.exists(rel):
        notes = re.sub(r"[*#`]", "", open(rel).read()).strip()[:480]
        open(os.path.join(OUT, "release-notes.txt"), "w").write(notes + "\n")
    # the policy must be reachable at the URL the console is given
    www = os.path.join(ROOT, "www")
    if os.path.isdir(www):
        shutil.copyfile(os.path.join(OUT, "privacy.html"),
                        os.path.join(www, "privacy.html"))
    files = sorted(os.listdir(OUT))
    print(f"play assets — build {t}: {', '.join(files)}")
    if CONTACT.startswith("SUPPORT-EMAIL"):
        print("  NOTE set CONTACT in tools/play_assets.py — Play requires a "
              "contact email on the listing")
    return files


if __name__ == "__main__":
    main()
