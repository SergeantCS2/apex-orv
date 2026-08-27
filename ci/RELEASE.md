**Take 134 — hiking trails you can route on, and the guide that finally shows.**

- **Hiking trails are routable in Outdoors.** The whole DNR hiking network
  — ~12,000 miles — is now part of the map's routing graph for the On foot
  machine only. Tap a hiking trail and it identifies like an ORV trail;
  Return home walks you along it at 3 mph. No ORV machine can be routed
  onto one — the gate checks that against the built data.
- **It cost nothing you will feel.** The first build doubled the graph; the
  cause was the noder splitting two-track at every point where a hiking
  trail ran alongside it. Fixed at the source: 576k edges, 46.6 MB graph,
  bundle 142.7 MB — 18 MB over take 132, most of it hiking geometry.
  Dispatch scanning: 87 ms in a desktop browser (it was 3.4 s mid-take).
- **The guide shows on next launch.** Rewritten for the whole state and the
  three modes. Your phone had dismissed the old one at an early take; the
  key is versioned now, so this one shows once, then lives under Tools.
- Unnamed paths from OpenStreetMap are still drawn, dashed, but not routed
  — they are a separate class now (`path`), so the "either routable or
  show-only, never both" law holds.

### Check on the phone
1. Launch: the guide. Read it once; it will not return on its own.
2. Outdoors → the machine chip reads On foot. Tap a green dashed trail:
   its name and card. Return home: a walking route along trails.
3. Self-test: dispatch-scan well under a second.
4. Ride: hiking trails are hidden by default; the activity chip's Hiking
   row brings them back, drawn but never routed for an ORV.
