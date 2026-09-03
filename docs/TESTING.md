# APEX ORV — tester guide

Thanks for testing. This page is written for the phone in your hand, not
for developers. It's ordered by how much a problem would matter on a
trail, not by where things sit in the app.

**What you are testing:** whether the app is *right*. Anything it tells you
that turns out to be wrong on the ground — a turn that isn't there, a dam
it didn't warn about, a trail it says is open that's signed closed — is
the most valuable thing you can send us. Looks come later.

---

## Before you start

- **Install from Google Play.** If you sideloaded an earlier copy, the store
  build installs *alongside* it rather than replacing it, and your saved
  waypoints, rides and HD imagery from the old copy won't carry over. Note
  anything you care about, then consider uninstalling the old one so you're
  not testing the wrong icon.
- **Get it on wifi.** Most of the download is satellite imagery for the
  whole state.
- **Open it once at home** before you rely on it anywhere. It needs no
  signal, but it's better to see that for yourself in the driveway.

## How to report

Tell us **what you did, what you expected, what happened, and where you
were**. A screenshot beats a paragraph. If you can, open **Tools →
Diagnostics → Self-test** and send the summary — it names the build and
your phone.

Say which phone you have. Almost all development happened on one device,
so a bug that only shows on yours is exactly the bug worth finding.

---

## 1. The first minute

- Launch it. You should see the logo with a red bar that fills as the map
  loads, then the map. If you ever see placeholder text or an empty screen
  you can still tap, that's a bug.
- It asks for location once. **Say no** the first time, on purpose.
  Everything except your position dot and ride recording should still
  work. Then allow it and confirm the dot appears.
- Kill the app and reopen it. It should come back where you left it.

## 2. Airplane mode is the real test

The whole point of the app is that it works with no signal. Test that on
purpose:

- Turn airplane mode **on** and leave it on for a whole session.
- Pan and zoom across both peninsulas. Every layer should draw.
- Search for a trail, a town, an address, a river. All of it should work.
- Plan a route, ride it, retrace it.
- Anything that greys out, spins forever, or says "no connection" in
  airplane mode is a bug — except two things that genuinely need signal:
  **saving HD imagery** and **live river conditions**.

## 3. Navigation — new, and never ridden by anyone but us

This is the biggest thing in this build and it has only been tested with
simulated positions. Please ride it.

**Following you**

- Tap **Ride it**. The map should centre on you, turn to face the way
  you're going, tilt, and follow as you move — like a navigation app.
- Does the tilt and zoom feel right at speed? Too close, too far, too
  flat? Tell us; that's a judgment only a real ride can make.
- Drag the map. Following should pause and a **Re-centre** button should
  appear. Tap it (or Locate) and it should snap back.
- Tap **N↑** for north-up. Tap again for heading-up.
- Does the screen stay on while it's following?

**Turn by turn**

- Plan a route first (Return home, or long-press a spot → Start here /
  Route here), then Ride it.
- The strip at the top should name the next turn and count the distance
  down: "In 400 ft · Turn left onto Trail 7". **Does it call a turn that
  isn't there? Miss one that is?** Either is the report we most want.
- It shows remaining distance and a time based on your own pace. Is the
  time believable?
- **Miss a turn on purpose.** Within a few seconds it should re-route from
  where you are.
- Reach the end. It should buzz and say **"You have arrived"** at about
  the right spot. Too early? Too late? Never? Tell us.

**If the app dies mid-ride**

- Force-stop the app in the middle of a ride (or let the phone die).
  Reopen it. You should be offered **"Resume your trip?"** with when it
  started and how far you'd gone. Resume: your track should still be
  there and recording should continue.

**Voice**

- Open **Tools → Diagnostics → Self-test** and find the **VOICE** line. It
  tells us whether your phone has a voice the app can use. Please send it
  — this is different on every phone and we can't know it from here.
- If a 🔊 button appears on the strip while following, tap it and take a
  turn. It should speak the turn once as it becomes next and once more
  close in. Never twice in a row for the same turn.

## 4. On the river

- In **Water** mode, plan a run: tap a put-in and a take-out. Then tap
  **Navigate this run**.
- The map should face **downstream** — not the way your phone thinks
  you're heading, since a kayak drifts and spins.
- The strip counts down miles to the take-out and a time for your boat,
  and shows the river mile you're on.
- It should warn you of a **dam ahead** before anything else, then call
  the next access or campground. If a dam you know about is *not* called,
  report that first.
- Reach the take-out: it should say so.

## 5. Routing — check it against the ground

- Plan a route with **Return home** and follow it. Every instruction should
  match a turn that exists.
- Change the machine (**Dirt bike / Quad / Side-by-side**) and re-plan.
  Narrow trails should fade for the wider machine. **If the app sends a
  side-by-side down something it can't legally or physically use, report
  it with the location.** That is a safety bug.
- Try each profile: Most trail, Fastest, Easiest, Pavement soonest,
  Shortest, Least climbing. Do they differ the way their names promise?
- **Loop**: ask for a loop of a given distance. Does it bring you back?
  Is the mileage close?
- **Retrace**: does it take you back the way you actually came?
- Compare the app's mileage to your odometer over a stretch you know.

## 6. The five modes

Cycle the mode chip and confirm the whole map follows — layers, pins,
routing, the machine button.

- **Off-road** — trails by legal width, riding areas, fuel. Do riding areas
  (Bull Gap, Silver Lake, Mack Lake) look like open ground?
- **Outdoors** — hiking and MTB systems, ski hills with their runs by
  difficulty. Anything mislabelled?
- **Hunt** — state land with boundaries, game areas, county lines.
  Long-press to drop a stand, camera, sign, water or gate. Do they survive
  closing the app? A restart?
- **Water** — launches, liveries, beaches, marinas, lighthouses, rivers
  with float times. Plan a run; tap the ends in the wrong order on purpose
  — the app should flip them.
- **Camp** — new. Campgrounds, with the national and state forest land
  where dispersed camping is allowed shaded on the map. Tap a campground:
  it should say who runs it and whether it's rustic or modern, fee or
  free — or honestly say the type isn't recorded. **Is a campground's
  type wrong?** Is one missing that you know?

## 7. Pins, and when there are too many

- Zoom into a busy lake or town. Overlapping pins should collapse into one
  circle with a count. Tap it: a list of everything in the pile, and the
  map moves in. Tap a row: that place opens.
- If pins visibly flicker on and off while the map sits still, report it.
- In lake districts, unnamed launches and beaches now stay out of the
  way until you're zoomed well in — except in Water mode, where a paddler
  wants every launch. Does the map now read clean where it used to be a
  pile? Is anything you rely on gone?

## 8. Imagery

- Switch to **Hybrid** over ground you know at about a one-mile zoom. The
  statewide base is deliberately soft up close; **blocky patches or
  smeared colour are not** expected.
- **HD chip** (top right): pick an area. The sheet should quote tiles and
  megabytes *before* offering the save. Run it, press **Stop** partway —
  it should keep what it got and resume later rather than start over.
- While a save runs the screen should stay on by itself, and opening the
  HD sheet should say what is downloading and how many tiles are done.
  Does a save feel faster than it did? (It fetches six tiles at a time
  now.)
- Airplane mode, back to that area: saved HD must still draw.
- **Tools → Saved HD imagery**: does deleting a save free the space?

## 9. Search

- A trail by name and by number — `H57-17` and `h5717` should both work.
- An address near you, a town, a ski hill, a boat launch, a river.
- Does the top result make sense? Anything that should exist in Michigan
  and doesn't come up is worth reporting.

## 10. Safety features — test them on a good day

- **Dispatch card**: your coordinates *and* the nearest address. Read it
  against your maps app. **If the address is wrong, report it with the
  coordinates.** This is the feature meant to work when you're hurt.
- **Compass**, **Mark this spot**, **breadcrumb trail**, **truck pin**: do
  they do what they say?
- **Self-test**: run it and send anything that fails. It should also report
  zero remote requests.

## 11. The things that make an app feel broken

- Rotate. Fold and unfold. Large system font. Dark mode. Anything clipped
  or unreachable?
- Leave it open for an hour. Slow? Hot?
- Interrupt it: a call, a low-battery warning, another app on top. Does it
  come back?
- Does the back button ever trap you?

## 12. Read the map like a rider

- A trail drawn where there is none, or missing where there is one.
- A trail marked open that's signed closed, or the reverse.
- A launch, campground or gas station that isn't there any more.
- A dam **not** marked on a river you paddle — report this one first.
- Names spelled wrong, or a number that doesn't match the sign.

**The map is not permission.** Signs on the ground always win. An ORV
licence and trail permit are required on the designated system. Check
seasons and closures with the DNR or Forest Service before you ride,
paddle or hunt.

---

## What we most want to hear about

1. **Navigation that lies** — a turn called that isn't there, one missed
   that is, "arrived" at the wrong place, a dam not warned about.
2. GPS that stops updating, or never gets a fix under tree cover.
3. Any route that sends a machine somewhere it may not legally go.
4. A dispatch address that's wrong.
5. Anything that works on wifi but not in airplane mode.
6. Crashes — with what you were doing.
7. The **VOICE** line from the self-test, and how following *feels* at
   speed.

Thanks for riding it. What you find now is what nobody finds three miles
in.
