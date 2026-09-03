# APEX ORV v3

**Michigan's trails, rivers, public land, lakes and campgrounds — one app,
fully offline, and now it navigates.**

Both peninsulas and Isle Royale. 122,000 miles of legal routing, 76 paddling
rivers ordered downstream, 4.7 million acres of state land, three national
forests, 25,000 places — all of it on the phone, none of it needing a bar of
signal. Free, no account, no ads, and nothing you do in it is sent anywhere.

**Install:** from Google Play (closed testing at the moment; ask for an
invite), or the signed APK from the latest [Release](../../releases/latest).
Android 8+, about 185 MB — the size is the map, not the app (satellite
imagery for the whole state is most of it). The Play build and the sideloaded
APK are different app identities and install side by side.

## It navigates

Tap **Ride it** and the map centres on you, turns to face the way you're
going, tilts and follows — like a navigation app, on two-tracks.

- **Turn by turn** on the route you planned: "In 400 ft · Turn left onto
  Trail 7", remaining distance, a time from your own pace, **"You have
  arrived"**, and a re-route from where you are when you're 40 m off.
- **On the river**: plan a run, tap Navigate this run, and the map points
  **downstream** — not where the phone thinks you're heading, because a
  kayak drifts. Miles and minutes to the take-out for your boat, the river
  mile you're on, and **"Dam in 1.2 mi — portage"** before anything else.
- **On foot**: the same guidance at walking pace.
- **Voice**, if your phone has one — the self-test tells you. Each turn is
  spoken once as it becomes next and once close in. Off by default.
- **If the app dies mid-ride** — force-stopped, phone dead — the next launch
  offers **Resume your trip?** with your track, your clock and your
  destination intact.
- Pan to pause following; Re-centre or Locate to resume; N↑ for north-up.
  The screen stays awake while it follows.

> [!IMPORTANT]
> **The map is not permission.** Trail designations come from the Michigan
> DNR and the US Forest Service, and every line says which source it came
> from and whether your machine may be on it — but seasons, closures and
> permits are the agencies' to set. Check before you ride or hunt. An ORV
> licence and trail permit are required on the designated system.
>
> On the water: **dams are marked and the app tells you to portage them.**
> Do. River mileage is measured along the mapped centreline and is a floor,
> not a figure — the paddled river is longer, and the app says so on the
> card rather than inventing a correction.

> [!NOTE]
> **Where the data ends.** OpenStreetMap, DNR and USFS between them are very
> good and not perfect. Some county and township boat ramps are in none of
> those sources yet — if a ramp you use is missing, adding it to
> OpenStreetMap fixes it for everyone, this app included, on the next build.

---

## Five modes, one chip

The mode chip cycles the whole map — layers, pins, routing and the machine
button all follow.

| Mode | What the map becomes |
|---|---|
| **Off-road** | ORV trails and routes by legal width, riding areas, fuel — routing for a dirt bike (24"), quad (50") or side-by-side (72") that respects what each may touch |
| **Outdoors** | The hiker's map — trail systems with mileage, MTB systems, named hills from regional zoom, rivers, camps, and every ski & snowboard hill in the state |
| **Hunt** | 4.7M acres of state land with boundaries and game areas, county lines, and the waypoints a hunter marks: stand, camera, sign, water, gate |
| **Water** | Launches, liveries, beaches, marinas and lighthouses; rivers you can plan a float on; live USGS conditions on a tap |
| **Camp** | Campgrounds typed where the source records it, the state and national forest land where dispersed camping is allowed, and the supplies on the way in |

**Every mode plans something.** A dirt-bike ride, a hike, an MTB loop, a
kayak run — the plan system follows the mode, so Water never walks you down
a road between two boat launches.

## Off-road

- **122,346 miles routable together** — DNR designations, USFS trails and
  OpenStreetMap conflated into one graph, duplicates resolved, every edge
  carrying its legal class
- **Six route profiles**: Most trail · Fastest · Easiest · Pavement soonest ·
  Shortest · Least climbing — plus loop generation ("15 miles from here,
  most trail, back to the truck")
- Turn-by-turn directions with running mileage; closures routed around
- **Riding areas** (Bull Gap, Silver Lake Dunes, Mack Lake and more) drawn
  as the open ground they are — routing goes to the edge, never pretends a
  line through them
- The machine button is also the legend: pick a side-by-side and every trail
  too narrow for it fades on the map, still real, just not yours today

## Outdoors

- **455 hiking and trail systems**, every one with its mileage
- **112 MTB systems** wearing a little hand-drawn bike
- **36 ski & snowboard hills** — tap one for its runs by name and difficulty
  (green · blue · black, terrain parks too), its website, and a photo where
  Wikipedia has one. Difficulty comes from the source or stays grey; it is
  never guessed
- Named hills and summits from regional zoom, elevation readout everywhere

## Hunt

- State land with real boundaries and game-area names, county lines drawn
  the way a hunter thinks
- Five waypoint types on a long-press — stand, camera, sign, water, gate —
  kept on the phone and nowhere else

## Water

- **76 rivers mapped as paddling corridors** — ordered downstream, every dam
  marked as the portage it is, campgrounds and access points placed by river
  mile
- **Plan a run**: tap a put-in and a take-out (a launch pin or a stop on the
  river — either works) and get the distance between them, every dam on the
  way, other accesses, campgrounds, and a float time for **your boat** —
  kayak, canoe, or raft, at paces calibrated against the liveries' own
  posted times. Tap them in the wrong order and the card flips it: a river
  only runs one way
- **Launches everywhere they actually are**: OpenStreetMap's plus the
  Michigan DNR's 1,325 developed boating access sites, merged and de-duplicated
- **Canoe & kayak liveries** as their own pins — put-in infrastructure, not
  shopping
- **Live river conditions**: 241 USGS gauges ship with the app; tap "River
  conditions" on a river card and the current flow, stage and water
  temperature arrive from USGS, stamped with their time and their gauge.
  Live or absent — a reading from build time would be a lie, so none ship

## Camp

- **Campgrounds by type**, where the source records it: state forest (DNR),
  national forest (USFS), county, private; rustic or modern; fee or free.
  Where it doesn't, the card says "type not recorded" — never a guess.
- **The land where dispersed camping is allowed**, shaded: state forest, and
  the Ottawa, Hiawatha and Huron-Manistee national forests.
- Supplies on the way in — fuel, stores, water, launches, trailheads —
  appear as you zoom in, so the statewide view stays campgrounds and forest.

## Pins that behave

- Pins that would overlap **stack into one circle with a count**, at any
  zoom. Tap it for the whole pile; tap a row for that place. Each mode
  stacks only what it shows.
- Unnamed boat launches and beaches — OpenStreetMap maps a lot of them
  without names — no longer pile up: private docks are dropped, duplicates
  beside a named place are dropped, 440 carry the name of the lake they're
  on (the card says the name is borrowed), and the rest stay out of the way
  until you're zoomed well in — except in Water mode, where a paddler wants
  every launch.

## The imagery, honestly

Hybrid carries a **statewide satellite base** (z11+z12 — about 90 ft per
pixel) with razor-sharp z13–15 patches over the riding areas. At a 1-mile
zoom the statewide base is legible, not crisp: full sharpness statewide
would be an 8.6 GB app, and that trade is stated here instead of hidden.

So sharpness is **yours to place**: the **HD chip** (top right) saves full
z13–15 imagery for any area you choose — the sheet quotes tiles and
megabytes *before* a save button exists, the chip counts progress
("HD 42%"), the screen stays on while it saves, Stop keeps what landed,
and the same save later resumes free.
Saved HD draws on top of the base and works in airplane mode, because it is
on the phone. **Nothing downloads on its own. Ever.**

## Search that knows the state

One box, about 200,000 entries: trails by name or number ("H57-17" and
"h5717" both work), junctions, towns, ski hills, launches — and **streets
and addresses**, offline: 770,097 road segments and 104,214 street names,
good enough that the dispatch card can read your position aloud as the
nearest address. Rivers are in there too: "rifle river" finds the Rifle
River, fits the whole river on screen, and points you at the run planner.

## Built for the bad day

- **Dispatch card**: your position as coordinates *and* nearest address,
  written to be read aloud to a county dispatcher — and it refuses to print
  a coordinate it can't stand behind
- Breadcrumb trail, lossless retrace, truck pin, compass, mark-this-spot
- Ride recording with an HUD that fits four device sizes
- A **self-test under Tools** that runs 50+ checks on your actual phone —
  load, data, routing, safety, GPS — and prints what it found

## Offline, actually

The standard is a cold start in airplane mode: every layer the region
claims, rendering, with the NET badge green. The only two things that ever
touch the network are the two that can't exist without it — HD saves and
live gauge readings — both on a tap, both declared, neither load-bearing.
The app wraps its own network access and shows a badge, so "offline" is
something it proves rather than promises.

## Privacy

No account. No analytics. Waypoints, rides and saved runs live on the
phone. The self-test prints it plainly: *saved routes — nothing sent
anywhere · zero remote requests.*

---

## Building it

The repo is a seed: source, tools and governance docs (~12 MB). GitHub
Actions rebuilds the entire state from public sources — Geofabrik's
Michigan extract, DNR and USFS ArcGIS layers, USGS terrain and imagery,
Wikipedia photos — and produces the signed APK. Every data source is
declared in `docs/PROVISION.md` with its licence and refresh cadence;
imagery that may not be redistributed offline (Esri, Google, Bing, Mapbox)
is named there as excluded.

**The paper trail is the point.** `docs/HANDOFF.md` is an append-only
record of every take since the first; `docs/LANDMINES.md` numbers 200+
known failure modes so they are stepped around instead of rediscovered;
`docs/AGENDA.md` carries every decision with what was *ruled out* and why.
The build gates on all of it: ~300 smoke assertions across six modes,
260 rendered-pixel checks in a real browser, and a final gate that has
refused seals for a stale document stamp, a missing ruled-out line, and a
URL that hadn't been declared — each time correctly.

Field-tested on a Galaxy Z Fold, on the trails and rivers it maps.
