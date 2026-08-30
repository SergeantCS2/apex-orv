# APEX ORV — tester guide

*Generated into `play/testing.html` and published on Pages beside the privacy
policy, so the guide a tester reads is the one this build actually shipped
(landmine 98: a document kept apart from the thing it describes drifts).*

The guide's job is to send riders at the parts that have never been touched by
anyone but the developer's own phone. Sections are ordered by how badly a
failure would hurt, not by how the app is laid out.

---

## Before you start

- **Install from Play, not from GitHub.** The store build has a different application id from the sideloaded one, so the two install **side by side** rather than replacing each other. That means **waypoints, recorded rides and saved HD imagery on your sideloaded copy do not carry across** — WebView storage is scoped per app. Write down anything you care about before you start, and consider uninstalling the old one so you are not testing the wrong icon.
- **Check you opened the right one.** Both copies use the same name and icon. The store build is the one that appeared after you installed from the Play link.
- **The download is large** (most of it is satellite imagery for the whole state). Get it on wifi.
- **First launch needs no signal**, but do it once at home so you can see it working before you rely on it.
- **You are not testing whether it looks nice.** You are testing whether it lies. Anything the app tells you that turns out to be wrong on the ground is the most valuable thing you can report.

## How to report

Report **what you did, what you expected, what happened, and where you were**. A screenshot beats a description. If you can, open **Tools → Diagnostics → Self-test** and include the summary line — it names the build.

Say which phone you have. Almost all development happened on one device, so a bug that only appears on yours is exactly the bug worth finding.

---

## 1. The first sixty seconds

- Launch it. **The splash should hold until the map is there** — if you see raw text like `__IC_map__`, or an empty screen you can still tap, that is a bug and it is a bad one.
- Does it ask for location once, plainly? **Deny it** on purpose the first time. Everything except the position dot and ride recording should still work. Then grant it and confirm the dot appears.
- Watch the **NET badge** in the title bar. It should read green with nothing unexpected. If it ever climbs while you are just panning the map, report it immediately — the app promises it downloads nothing on its own.
- Kill the app and reopen it. Does it come back where you left it?

## 2. Airplane mode is the real test

This is the whole point of the app, so test it deliberately:

- **Turn airplane mode on** and leave it on for an entire session.
- Pan and zoom across both peninsulas. Every layer should draw.
- Search for a trail, a town, an address, a river. All of it is supposed to work with no signal.
- Plan a route, run it, retrace it.
- Anything that greys out, hangs, spins forever, or says "no connection" in airplane mode is a bug — with two exceptions that are *supposed* to need signal: **saving HD imagery** and **live river conditions**.

## 3. GPS, under real conditions

The riskiest area in this build. The location code changed and has not been ridden hard.

- **Cold start under tree cover.** Park under canopy, open the app fresh, and time how long until the dot appears. It should keep trying — if it gives up, stops updating, or shows an error and never recovers, that is the single most important bug you can report.
- Ride a few miles and watch the dot. Does it keep up, or lag and jump?
- Does it survive **screen off → screen on** mid-ride? Does it survive a phone call?
- **Foldables**: fold and unfold mid-ride. The map should not reset, lose your route, or forget your position.
- Battery: note roughly what an hour of navigation costs you.

## 4. Routing — check it against the ground

- Plan a route with **Return home** and follow it. Every turn instruction should match a turn that exists.
- Change the machine (**Dirt bike 24" / Quad 50" / Side-by-side 72"**) and re-plan the same trip. Narrow trails should fade out for the wider machine. **If the app routes a 72" machine down something a 72" machine cannot legally or physically use, report it with the location — that is a safety bug.**
- Try each route profile: Most trail, Fastest, Easiest, Pavement soonest, Shortest, Least climbing. Do the results differ in the way the names promise?
- **Loop**: ask for a loop of a given distance from where you are. Does it come back to you? Is the mileage close to what you asked for?
- **Wrong turn**: go off route on purpose and press it. Does it recover sensibly?
- **Retrace**: does it walk you back the way you actually came?
- Compare the app's mileage to your odometer over a known stretch and tell us both numbers.

## 5. The four modes

Cycle the mode chip and confirm the whole map follows — layers, pins, routing, the machine button.

- **Off-road** — trails by legal width, riding areas, fuel. Do the riding areas (Bull Gap, Silver Lake Dunes, Mack Lake) look like open ground rather than a single line through them?
- **Outdoors** — hiking and MTB systems with mileage, ski and snowboard hills. Tap a hill: runs by name and difficulty, website, photo. **Is anything mislabelled?** Difficulty is supposed to come from the source or stay grey, never be guessed.
- **Hunt** — state land boundaries, game area names, county lines. Long-press to drop a waypoint: stand, camera, sign, water, gate. Do they survive closing the app? Do they survive a phone restart?
- **Water** — launches, liveries, beaches, marinas, lighthouses. **Plan a river run**: tap a put-in and a take-out and check the distance, the dams, the float time for your boat. Tap them in the wrong order on purpose — the card should flip them, because a river only runs one way.

## 6. Pins, when they pile up

Changed in this build and barely tested outside one screenshot.

- Zoom into a town where places cluster — a main street with several businesses.
- Overlapping pins should collapse into one pin with **×2, ×3** beside it, **at any zoom**.
- Tap the badge: you should get the whole stack as a scrollable list, and tapping a row opens that place.
- **Watch for flicker.** If pins visibly appear and disappear repeatedly while the map sits still, report it — that failure mode exists and we want to know if it escaped.
- Do pins you care about ever vanish entirely when you zoom?

## 7. Imagery — is it still sharp enough?

The satellite imagery was re-compressed in a recent build and is about a third smaller. Nobody has looked at it in the field yet.

- Switch the base to **Hybrid** and look at ground you know well at about a one-mile zoom. Is it legible? Any blocky patches, colour banding, or smeared areas?
- The statewide base is deliberately soft up close — that is expected. **Blockiness and colour smearing are not.**
- **HD chip** (top right): pick an area, check the sheet quotes tiles and megabytes *before* the save button appears, run the save, watch the progress. Press **Stop** partway — it should keep what it already got. Start the same save later; it should resume rather than start over.
- Put the phone in airplane mode and go back to that area. **Saved HD must still draw.**
- **Tools → Saved HD imagery**: does deleting a save actually free the space?

## 8. Search

- Trails by name and by number — `H57-17` and `h5717` should both find it.
- A street address near you. A town. A ski hill. A boat launch. A river by name.
- **Does the top result make sense**, or do you have to scroll to find the obvious answer?
- Anything you search for that *should* exist in Michigan and does not come up is worth reporting.

## 9. The safety features — test them cold, not on the bad day

- **Dispatch card**: does it show your coordinates *and* a nearest address? Read it aloud and check it against your maps app. **If the address is wrong, report it with the coordinates** — this is the feature meant to work when you are hurt.
- **Compass**, **Mark this spot**, **breadcrumb trail**, **truck pin**: do they do what they say?
- **Tools → Diagnostics → Self-test**: run it and report anything that fails. It should also report zero remote requests — if it does not, we want to know.

## 10. The things that make an app feel broken

- Rotate the phone. Fold and unfold it. Change the system font size to large. Turn on dark mode. Anything clipped, overlapping, or unreachable?
- Leave it open for an hour. Does it slow down or get hot?
- Interrupt it: incoming call, low battery warning, another app on top. Does it come back?
- Does the back button ever trap you in a panel you cannot leave?
- Anything that stutters while panning.

## 11. Read the map like a rider

Data errors matter as much as crashes:

- A trail drawn where there is no trail, or missing where there is one.
- A trail marked open that is signed closed, or the reverse.
- A boat launch, campground or gas station that is not there any more.
- A dam **not** marked on a river you paddle. Report this one first.
- Names spelled wrong, or a trail number that does not match the sign.

**The map is not permission.** Signs on the ground always win. An ORV licence and trail permit are required on the designated system. Check seasons and closures with the DNR or the Forest Service before you ride or hunt.

---

## What we most want to hear about

1. GPS that stops updating, or never gets a fix under cover.
2. Any route that sends a machine somewhere it may not legally or physically go.
3. A dispatch address that is wrong.
4. A dam missing from a river run.
5. Anything at all that happens in airplane mode but not on wifi.
6. Crashes — with what you were doing when it happened.

Thanks for riding it. Things you find now are things nobody finds three miles in.
