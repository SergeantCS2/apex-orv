# DESIGN · V4 — the presentation overhaul · study (no code yet)

*Opened 2026-09-23 at take 186 for A203. Transcribe, don't invent (landmine
190): §4 waits for the maintainer's reference screenshots, and nothing in
§5–§11 is built before the maintainer approves it. Evidence is labelled
PROVEN (read in the code or observed, and what), MEASURED (counted, and
how), INFERRED (reasoned) or UNKNOWN.*

The feature set stays. V4 changes how it is presented: the map (Hybrid,
pins), the controls (one component set, readable in sun and with gloves)
and the two flows the maintainer named as buried (planning, starting a
route). It is a refinement of the take-113 identity — charcoal, bone, one
orange accent, Barlow — not a rebrand (A114).

---

## 0 · What the maintainer asked, 2026-09-23

> "I'd like to leverage this skill for the UI overhaul and redesign … a
> plan and a few ideas on how we can achieve this, bringing the app into
> its next big version and overhaul. The feature set is there, we just
> need to present it better."

Asked what matters most:

> "Hybrid view also looks very cheap, many grey lines scattered around
> when zoomed out — hard to see detail of the map, the whole point of
> hybrid."
>
> "Pins still need work, but it was better than before. They still shift
> around, some are unknown, some phase in and out with small zoom
> adjustments."
>
> "We have the feature set, but overall it's very confusing to use certain
> features, hidden behind menus, actions etc."

Also chosen: **hard to read outdoors**, **feels inconsistent**. Not chosen:
the cover-vs-inner screen layout.

Decisions, same day:
- **One dark look.** No light theme; raise size and contrast.
- **Study first, then staged takes**, each bundling several items.
- **References come from the maintainer** (§4) — the look is transcribed.
- **"Unknown" pins are look-alike badges** (A214), not junk names.
- **Buried = planning and starting a route** (A217), not Tools or Layers.
- **Map + Hybrid only** — Satellite is the same basemap (A212).

Which build these answers describe is UNKNOWN (asked, §4). A197 P3 needs
its verdict on a build carrying P1 (take 185 or later).

---

## 1 · The measured audit (take 186)

Line numbers are `src/app.html` unless a file is named.

### 1.1 Hybrid (A202, A212, A213)
- PROVEN: the grey outlines `minor-case #C9C8C2` and `paved-case #BFBEB8`
  (2494-2495) are never touched by `setBasemap` (4420-4480). Takes 124/126
  dimmed and narrowed only the white centre lines (4460-4468), so on
  imagery the grey outline is what shows of every road; below z11.5 a
  minor road is a bare grey outline. DESIGN.md §3's Hybrid ("road casings
  off") was never built.
- MEASURED (counted from `bundles/michigan/graph.json`): minor and paved
  are ~188k edges / ~106k km — half of all line length drawn.
- PROVEN: the network layers have no minzoom (`lyr()` 2007), and every
  width curve `w()` (1996) holds its z10 value below z10.
- PROVEN: Satellite is Hybrid. `sat=(m!=='Map')` (4427); nothing else in
  the file tells them apart (the only other tests are `==='Map'`, 5454).
- PROVEN: `applyMachine` (4128-4150) rebuilds road opacity from values read
  at startup on Map; `setBasemap` writes plain numbers over the machine's
  `case` on `casing-track`/`casing-fsroad`. Craft have `ok:[]`
  (1027-1029), so in Water the roads' look depends on the basemap before.
- INFERRED: `setBasemap(0)` at load (7265) runs after the mode restore, so
  a restored Water mode opens on Map; render:482-483 accepts Map whatever
  the imagery state and cannot see it.
- PROVEN: only the statewide mosaic `sat` is dimmed (2411-2413); the z11–15
  tiles `sat-base`/`sat-patch` are not (2418, 2421). Label halos are the
  light map's (#EFE6D2, #F2F3F0).
- INFERRED: MapLibre's GeoJSON simplification drops sub-0.375 px pieces of
  the ~76 m routing edges at z7–9 — the "scattered" look.
- PROVEN, unguarded: `tools/verify_palette.mjs` never touches `c-base` (0
  references) so it checks Map only; `check_palette`'s id regex
  (`tools/gate.py:225`) skips hyphenated ids, so the two grey outlines
  escape it.

### 1.2 Pins (A197 P3, A209, A210, A214)
- PROVEN: `restack()` (7114-7170) re-forms every stack on `moveend` (7252)
  with no hysteresis, anchors each on its first-ranked member (7147), and
  the radius runs 48 px at z8 to 24 px at z14 (1340-1342).
- PROVEN: rank `(+r||9)*10+(+pri||3)` (7134) reads rank 0 and priority 0 as
  missing — a lighthouse sorts last of all kinds, every priority-0
  destination sorts as priority 3 (A209).
- PROVEN: the "unchanged, don't resend" signature (7166) is the count plus
  name:member-count per stack — blind to which pins and where; a changed
  set can be skipped and leave stale badges (A209).
- PROVEN: `modeFilter` (4364-4373) adds the per-kind zoom gate only to
  step filters; `poi-dot`'s base filter (2654) is not one (A210).
- PROVEN: `fadeDuration:0` (2858) — collision placement redone every frame,
  labels switch instantly. INFERRED: that this is the flicker; stacks
  changing only at `moveend` is a second cause.
- PROVEN look-alike badges (A214): launch = marina (1221/1232), info =
  toilet (1239/1241), lighthouse and view share the eye glyph, trail
  system and day-use share the tree glyph with greens ΔE≈12 apart
  (1223/1227), and the paddle badges duplicate launch/camp/info
  (1312-1313). There is no pin legend; the Pins rows show a colour swatch
  (5484-5486).
- MEASURED take 187 (`tools/pins_probe.py sweep`, committed; the static
  replica over the built poi.json): the badge set changes on 21–39% of
  0.1-zoom steps (Camp 21, Off-road 34, Outdoors 31, Hunt 33, Water 39), and
  on 21–40% inside one tile zoom where no kind arrives — the clusterer
  re-partitions; the A209 rank fix moves anchors (Water 33 of 89) but not
  the churn. (The study's first figure, 26–44%, came from an unvalidated
  scratch replay.)

### 1.3 Planning and starting a route (A217)
PROVEN from the handlers. "Actions" counts taps and one long-press.

| Flow | Today | Path |
|---|---|---|
| Plan and ride to a place | 4 | long-press the spot → **Directions here** (`pc-route`, 6087) → Ride tab → **Ride it** (`c-ride`) |
| Return home and ride | 4 (3 with the drawer open) | the grabber → **Return home** (`btn-home`, 742) → Ride tab → **Ride it** |
| Set home | 3 (+1) | Plan tab → **Set home** → one of three (Tap the map adds a tap); or long-press → **Make this home** (2) |
| Free ride, no route | 2 | Ride tab → **Ride it** |
| Turn list of the current route | 1 | **Directions** (`btn-steps`, 741) |

- PROVEN: the app opens with the drawer folded (`railSet(false)`, 7274), and
  folded, the action row is collapsed — `#rail.folded #actions{max-height:0;
  opacity:0}` (479); MEASURED height 0 at both viewports; the self-test's
  on-screen list agrees (6528: folded = peek, Ride it, Locate). Return home
  is not on the opening screen.
- PROVEN: two different things are called Directions — the place card's
  "Directions here" (route to a place) and the action row's "Directions"
  (the turn list, 4032-4057).
- PROVEN: the Plan tab is six chips in a sideways-scrolling strip (Tools
  has seven), already over A113's "at most 5 on screen" (render:2943 only
  asserts most < total).
- PROVEN: ~100 `show()` calls open the drawer, including one-word results
  ("Cancelled." 3015, "Pin removed." 6129); the toast has one caller (5711).
- PROVEN: place-card actions are text glyphs `▸ ⌂ ◉ ☎ ⤢ ☆ ✕` (6087-6096);
  Wrong turn, a simulator control, sits on the Ride tab (688).

### 1.4 Readability (A215)
- PROVEN: type tokens 9 / 11 / 12.5 / 15 / 18 / 30 px (130); every control
  label is 11 px (398, 251, 110, 577); tags, route-card details and
  captions are 9 px (524, 572, 514). Raw sizes outside the scale: 66, 67,
  75, 77, 210, 228, 240, 241 — A120's "zero hard-coded sizes" is stale.
- PROVEN (calculated): `--dim #6E665B` on `#14120F` is 3.3:1.
- PROVEN: the ride strip's buttons (N↑, voice, Re-centre) are ~23 px tall
  (228-232: 13px/1 + 5 px padding) — the controls used while riding are
  the smallest on screen.
- PROVEN: the tap floor is 38 px, checked on `.chip,.act,.rc,.hit` only
  (6497-6503); `.actrow` rows are 38 px, `#tour-x` 34, folded `#peek` 34.
- PROVEN: `<meta name="color-scheme" content="light">` (7) over a dark UI;
  `user-scalable=no` (6). Why it says light is not recorded (UNKNOWN).

### 1.5 Consistency (A216)
PROVEN (UI survey of take 186): 12 button families; 8 "selected"
treatments; 4 sheet types; 3 card-title styles; `.sub`, `.unit`, `.mono`
used in cards with no base rule; 15 border radii; 13 box shadows; ~38
padding values; ~16 near-duplicate greys; 13 colour tokens unused or stale
(10-19; e.g. `--easy #2F7D4F` vs `PAL.route72 #0FAE57`, 1974). Icons: 25
Lucide strings pasted into `ICONS` (2877-2910; the "inlined at build time"
comment at 2884 is not true), `locate` meaning Compass and Locate, `alert`
meaning Wrong turn, Stop and Delete, `play` five actions, `mountain` all
five modes; turn arrows as text glyphs (4004-4029); 🔊 on `#nav` (603),
outside the emoji check's `#shell` scope (render:2892-2898). Developer copy
reaches the rider: "Tell Claude you saw RENDER FAIL" (5838), metres in the
navigation line (5255). ("MAP CENTRE" is honesty copy and stays.)

### 1.6 The screen, measured
MEASURED on the take-186 build in desktop headless Chrome (not the Fold's
WebView), `getBoundingClientRect`, `~/apex-shots/v4-baseline/measure.json`:

| Viewport | Drawer | Map above the drawer | Band clear of floating controls |
|---|---|---|---|
| 411×960 (cover) | folded | 90% | 59% |
| 411×960 | open | 70% | 39% |
| 360×800 | folded | 88% | 51% |
| 360×800 | open | 63% | 26% |
| 749×832 (inner, take 187) | folded | 88% | 53% |
| 749×832 (inner, take 187) | open | 67% | 31% |

"Clear band" = from the bottom of the left control stack (230 px) to the
top of the tool strip. It is what bigger targets and a larger type scale
spend first (§8). The inner-screen rows were measured on the take-187 build
(`node tools/probe.mjs v4`, the drawer state read back before measuring —
the first run measured "open" on a drawer the resize had folded again).
Re-read at the seal with the drawer settled (landmine 224: in headless
Chrome a transition waits for a frame): 88.0% / 52.9% folded, the open
drawer's top at 66.5%. The take-186 rows were read before that was known;
their folded values agree with the settled take-187 reads (89.6%, 87.5%),
the open ones are not re-verified.

### 1.7 Seen in the baseline shots
OBSERVED in `~/apex-shots/v4-baseline/` (outside the repo, A206): the
take-186 build in desktop headless Chrome at 411×960 @2.625 — the cover
screen's CSS size, not the Fold's WebView, and with no GPS.

- `10-hybrid-z7`, `10-hybrid-z9`: the maintainer's complaint, reproduced.
  At z7 the Lower Peninsula reads as brown two-track mesh over a grey road
  grid; at z9 around Grayling the forest shows only between lines.
- `11-water-pins-houghton-z11.6`: from z11 the imagery is bright and sharp
  (undimmed tiles) while lakes are flat, opaque blue pasted over the photo.
- `04-place-card-dropped-pin`: six equal-weight buttons (Directions here …
  Remove pin), no primary; the one accent on screen is Return home in the
  action row beneath; the coordinates print twice (card and `#coords`).
- `05-route-options`: three cards in a sideways scroll, the third cut off;
  Ride it is not on the card (Ride tab); the fuel line's ⛽ renders as an
  empty box in this Chrome — a glyph Barlow lacks (on the Fold it depends
  on the system font: UNKNOWN).
- `06-riding-hud` (ride started, no fix): the route cards stay open over
  half the screen; the ride strip reads "0 mph · N  N↑" in 13 px.
- `03-tab-plan`: three and a half of the six Plan chips show; Loop and
  Saved are off the right edge and nothing says the strip scrolls. The
  machine chip reads "Dirt bike 24"" beside a car icon (`vehicle` is
  Lucide `car` for every machine).
- `03-tab-*`, `09-map-z9`: the Map basemap at z9 is a dense brown two-track
  mesh as well. Noted only — A202 keeps the Map palette out of the Hybrid
  change unless the maintainer widens it.
- `05`, `11`, `12`: at badge size the campground tent glyph reads as a
  warning triangle.
- `00-first-run-tour`: the tour card sets its text in `system-ui` (DejaVu
  here, Roboto on Android), not Barlow (66, 77).

---

## 2 · The ui-ux-pro-max skill: what it contributed

Loaded with `npx skills use https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
--skill ui-ux-pro-max` (skills CLI 1.7.0); its search tool was run
read-only. `--persist` was not used: it writes a `design-system/` folder,
and this document is the persisted form.

- **Design system.** "outdoor navigation map app" and "offroad trail map
  rugged" returned landing-page patterns (Funnel, Hero + CTA) and SaaS
  palettes — off-fit, rejected. The retry "gps route tracking map" matched
  *Running & Cycling GPS* (none of its 192 product types is an offline
  trail map): dark #0F172A, orange #EA580C, green #059669, dials variance
  3 / motion 2 / density 7. Its typography search returned **Barlow
  Condensed + Barlow** ("Sports/Fitness") — APEX's pairing since take 113 —
  and its orange sits beside APEX's accent #E2570F. The skill lands on the
  identity APEX already has.
- **Adopted** — each becomes a guard with a planted control (§11):
  priority order accessibility → touch → layout → type/colour →
  navigation; the pre-delivery checklist (`references/pro-rules.md`);
  Android 48 dp targets and 8 dp gaps; 16 px body text; text ≥4.5:1,
  non-text ≥3:1; tabular numerals; one icon family, one meaning per icon,
  no emoji or glyph icons; no gesture-only actions; predictable back;
  toasts that do not steal focus; reduced motion.
- **Rejected**: Google Fonts `@import` (PROTOCOL §8 — nothing loads in the
  field); GSAP snippets (a dependency, and A120: nothing on the map
  animates); the HUD/Sci-Fi style (the skill's own accessibility risk
  "high"; 1 px neon lines in sunlight); glassmorphism; landing-page
  patterns; Phosphor icons (APEX has Lucide, which the skill also names);
  swapping Barlow for Inter.

---

## 3 · Rules V4 keeps (with sources)

1. Transcribe, don't invent — the reference is the spec (landmine 190).
2. Presentation, not architecture: no framework, no rewrite (A116,
   landmine 153). Smoke's fake DOM limits the markup (§11 hooks).
3. Offline: fonts, glyphs and icons bundled; OFL/ISC; licences declared
   (PROTOCOL §8; landmines 4, 30, 81).
4. One accent surface per screen, counted (landmine 192).
5. Floating controls: one opaque surface (alpha ≥0.85), contrast ≥4.5:1 on
   both basemaps, state in the label (A150).
6. Glove paths: no one-tap path gets longer (landmine 135); a tap target's
   minimum lives on the control (landmines 184, 186).
7. The map is the product: visible in every destination (A113), nothing on
   it animates (A120), motion is transform/opacity with reduced motion.
8. The type scale is one decision; map label sizes stay out (landmine 157).
9. One colour table for map and legend (landmines 98, 107); closed lines
   never dimmed (A86); dimmed, dashed and absent stay distinct (landmine
   115); roads are never hidden in a mode (DESIGN-modes).
10. Card text literally honest; real progress, never a timer (A171).
11. Assert behaviour, not pixels (landmine 189); screenshots are for eyes
    (A206).
12. Polish never breaks loading (landmine 188).
13. The name, the certificate CN and the app id stay (A114, A31).

---

## 4 · References (asked 2026-09-23)

Needed from the maintainer, as screenshots, before §5–§10 get values:

1. onX Offroad **Hybrid over Michigan forest** at about z7, z9 and z11 —
   how roads, trails, labels and imagery brightness behave zoomed out.
2. onX Offroad **main map screen** — where every control sits.
3. onX **place / trail card**.
4. onX **route flow**: pick a destination → the route → start.
5. onX **pin clusters** at two zooms of the same place.
6. AllTrails **main screen** and a **trail card**.
7. The same APEX screens from the Fold, for side by side.
8. From both Fold screens: the **ENV·screen** and **UI·viewport** lines
   (Tools → Diagnostics → Self-test; 6315, 6468) — A197 Q3.
9. Which take the pin and Hybrid answers were judged on.

Transcriptions go here as they arrive: sampled colours, counted radii and
sizes, named patterns (the DESIGN.md §1–§2 method).

### 4.1 Received 2026-09-23 — eight screenshots, transcribed

Colours are medians of hue-matched pixels over a region (approximate but
close); sizes for the Fold shots are measured at 2.625 image px per CSS px
and are ±1–2 px. R1–R2 are iPhone captures; R3–R8 are the Fold (R3, R4, R6–R8
the inner screen; R5 the cover).

**R1 · onX Offroad, Go & Track while recording** (the maintainer circled
Distance)
- A compass tape across the top: a near-black band (#0E0D08), cardinal
  letters, ticks, an orange heading needle (#E99C40).
- Hybrid: imagery dimmed and desaturated; public land a translucent
  blue-grey fill with thin outlines; trails green (#72B160) with a white
  casing; the recorded track thick dotted red (#C82A1F).
- Map symbols by shape: hexagons (state forest, trail system), a
  triangle-in-square (trail camp), round badges (launch), "TH"; labels white
  with a dark halo; water names italic serif; road shields (495, 491).
- Right column: black rounded squares — north-up, locate (orange pin), and
  zoom +/− in one tall pill.
- A white sheet with three big stats and small labels beneath — Time
  03:37:36 · **Distance 39.6 mi** · Elevation 1335 ft (#232323 on white) —
  and two full-width actions: Resume (orange #F2A33C, dark text) and End
  (red #B7423B, white text).
- Five tabs, icon + label: Discover, Offline Maps, My Content, Tools, Go &
  Track (#232220).

**R2 · onX Offroad, Discover at ~z12 over Kalkaska**
- Imagery strongly dimmed and desaturated (mid-tone #3D3F3A); **water dark
  navy (#172937)**; public land as blue-grey outlines.
- **Roads are thin dark dashed lines on the photo — no light casings, no
  grey grid.**
- Trails: the ORV trail periwinkle blue (#768ECA) with a white casing; a tan
  dashed trail with a dark casing; a cyan (#6EEAF2) dashed class.
- Symbols: teardrop pins with a white glyph for destinations (campground —
  blue #37669C with a camper; a saved route start — black with a
  motorcycle); round light badges for Boat Ramp and Gate; an orange hexagon
  (#DA9D4C) for a trail system. Labels white with a dark halo; lake names
  italic serif.
- Chrome: menu (dark circle), logo, search (circle) across the top; a right
  column of light circles (~44 pt): weather, north, layers, 2D, drive;
  "Filters · Active: 1" bottom-left; a floating frosted tab bar with the
  selected tab in its own pill.

**R3 · onX Offroad, all of Michigan (the Fold's inner screen)**
- **At state zoom only highways (thin grey, with shields) and trails (green
  #5DAE4F, blue #5674B2) are drawn** over dark imagery (#4B5453) and navy
  water (#112138) — no minor roads, no two-track mesh. Region names in
  letter-spaced caps ("MICHIGAN", "UPPER PENINSULA", "LOWER PENINSULA"); the
  state line dotted yellow-green.
- Chrome: menu / logo / search; a right column of dark rounded squares
  (Weather with a label, N, layers, 2D, drive); "Upgrade" (#F2A33C) and
  "Filters" bottom-left; dark tab bar (#222222).

**R4 · onX, the My Content sheet**
- A dark sheet with a grabber, the title left, a circular × right; a
  section title and a one-line helper; one full-width primary action.
- Waypoints as teardrop pins in type colours (blue, yellow, white, red)
  with a white glyph; small dark label chips beside them.

**R5 · AllTrails, a trail card (the Fold's cover screen)**
- Light map (ground #EEEDEB, water #C1DCEF), roads white with a grey
  casing; the selected trail lime (#A9F185) with a white casing and
  direction chevrons; a lime start pin; parks as green tree circles.
- A near-black sheet (#0F110E), rounded top, grabber; title with a chevron
  (≈19–20 px); a stats row with icons — distance, ↗ gain, ↘ loss, time
  (≈13–14 px); an elevation profile (white line; min/max elevation; 0 /
  midpoint / total distance); secondary actions as icon + label (More,
  Activity, Download); **one primary action: "Start", a lime pill
  (#AAF286), 48 px tall, with a navigation arrow.**
- Map controls: dark circles (~47 px, #0F110E) — collapse, compass, route,
  locate on the left; layers (with a count badge) and weather sharing one
  pill, AR and draw on the right; a scale bar top-left.

**R6–R8 · onX Backcountry (the Fold's inner screen, 749×832)** — A136's
references, awaited since take 128
- Light topo map (ground #EEEDCE, water #B8E3F6, contours); POI labels
  large and bold, dark with a white halo; lake names blue italic,
  letter-spaced; trailheads as dark "TH" circles; campgrounds as a white
  tent in a dark rounded square (#5A5A5A); launches as small circles; parks
  as green trees.
- Selection: the selected route blue (#125AEC) with a bright yellow halo
  (#EEE50A) and direction chevrons; the selected pin ringed in yellow.
- The sheet (#1A1A1A): grabber; a centred title (≈15 px bold) and
  subtitle ("1 onX Hike Route ⌄"); a kebab (⋮) right; a horizontal route
  card (#333333, 64 px tall): image tile, kicker ("Hike Route"), title,
  "Moderate | 9.9 mi | +781 ft" with dividers; then the place's own
  section: kicker ("Trailhead"), a very large title (≈34 px bold), amenity
  icons in columns.
- **One floating primary action per state: a white pill (#FFFFFF, #333333
  text, 48 × 187 px) with an icon** — "Trailhead Details", "Route Details",
  "View Map".
- The detail page: header title and "9.9mi • +781ft"; a hero photo ("1/1");
  kicker + ≈34 px title; a source chip ("From Hiking Project ›"); a body
  paragraph (≈16 px); tag chips.

### 4.2 What the references say for APEX (inputs to §5–§10, for approval
through the mockup)
1. **Hybrid (D1–D5):** R2 and R3 are the spec, and they agree with
   DESIGN.md §3: dark, desaturated imagery; navy water; roads with no light
   casing (thin dark lines at z12; only highways at state zoom); trails
   bright with a casing; labels white with a dark halo.
2. **Pins (A214):** onX separates kinds by **shape** as well as colour —
   teardrops for destinations and waypoints, round badges for services,
   hexagons for trail systems and forests, squares for camps, lettered
   "TH". Its tent sits in a dark square, which keeps it from reading as a
   warning sign.
3. **Cards and sheets (§6, A217):** one primary action per state, large and
   unmistakable (R5's Start, R6–R8's white pill, R1's Resume/End);
   secondary actions small, icon + label; a stats row with icons; titles
   ≈15–34 px, body ≈16 px — against APEX's 11–15 px today.
4. **Controls:** map buttons are ≈44–48 px circles or rounded squares in a
   right-hand column; search at the top; five tabs with icon + label
   (APEX has four).
5. **Riding:** a compass tape across the top (APEX has `#hudbar`) and three
   big stats in a sheet — the maintainer circled Distance.
6. **The inner screen:** R3, R4, R6–R8 lay it out as map above and a
   full-width sheet below — no side panel.

### 4.3 Answers
- **8 · The Fold's CSS viewports.** Inner: **749×832 at dpr 2.625**
  (PROVEN — the maintainer's self-test, take 186, SM-F966U1, Android 16,
  WebView Chrome 153; map-has-room 612 of 832 px). Cover: 411×960
  (render's matrix; the Fold7 cover's 1080×2520 at 2.625 gives the same —
  INFERRED). **The harness has never laid the app out at 749×832** (A211),
  and it is the screen the maintainer uses.
- **9 · The build judged.** The self-test reads Take 186 — the pin and
  Hybrid answers describe take 186 (INFERRED from the build on the phone).
- The same self-test: "Web Speech API absent in this WebView — strip stays
  silent" — spoken turn-by-turn is silent on the Fold (A218). COMPASS "not
  started" — A201 still waits for its number.

---

## 5 · Tokens (proposal)

CSS only. The JS tables — `PAL`, `POIKIND`, `WPTYPES`, the canvas badges,
MapLibre paint — stay JS; a gate check keeps the values both sides share
(accent, bone, ink) equal. Smoke's `getComputedStyle` stub has no
`getPropertyValue` (smoke.mjs:326), so JS never reads tokens.
`build_app.py`'s loader screens (`fatal()` 130-136, the PARTIAL card
199-209) are tokenised or exempted by name. Found at take 187 and left for
take 189: templates also colour inline SVG through fill=/stroke= attributes
(five literals) and the canvas draws with five more — JS-side values, outside
`check_tokens`' scope (the stylesheet and style= attributes).

| Group | Tokens | Take 187 (today's values) | V4 rule (take 189) |
|---|---|---|---|
| Surface | `--surface-0/1/2`, `--scrim` | `#14120F` rail, panel rgba, chip fill | from §4 |
| Text | `--text-1/2/3` | bone `#F5EFE2`, `#9C9384`-family greys | ≥7:1 / ≥4.5:1 / ≥4.5:1 on every surface |
| Line | `--border`, `--border-strong` | `#2C2822` | non-text ≥3:1 where it carries state |
| Accent | `--accent`, `--on-accent` | `#E2570F` | one surface per screen |
| Status | `--danger`, `--ok`, `--route` | `#C1121F`, `#8FAE63`, `#00A8E8` | equal to PAL where shared |
| Type | `--t-xs … --t-xxl` (exist) | 9 / 11 / 12.5 / 15 / 18 / 30 | e.g. 12 / 14 / 16 / 18 / 22 / 32 — one decision |
| Space | `--s-1 … --s-6` | shared values only | 4 / 8 / 12 / 16 / 24 / 32 |
| Radius | `--r-sm/md/lg` | shared values only | three steps, from §4 |
| Elevation | `--e-1/2` | the two most-used shadows | two |
| Layer | `--z-*` | 4, 5, 6, 40, 60, 70, 9998, 9999 | same order, named |
| Motion | `--m-fast/base/ease` (exist) | 110 ms / 150 ms | same; reduced motion wins |
| Size | `--tap`, `--tap-ride`, `--ic` | 44 / — / 15 px | 48 / 56 / 20–24 px |

Take 187 moves colours, z-index and motion onto tokens completely, and
radius, spacing and shadows where a value is shared; one-off literals stay
until take 189 puts them on the scale, and the literal ratchet (§11)
counts what is left.

---

## 6 · Components (proposal)

CSS classes on the existing markup — no framework, ids and data
attributes unchanged, labels still the first `<span>`.

| Today (families) | V4 |
|---|---|
| `.chip`, `.chip.quiet`, `button.act`, `#guide-go`, `#diagpanel .chip` | `.btn` — primary (accent, once per screen), secondary, quiet; 48 px |
| `.basebtn`, `#nav button` | map control — 48 px; ride controls 56 px |
| `#tour-x`, icon-only buttons | icon button, 48 px, with an accessible name |
| `.actrow`, `.moderow`, `.hit`, the stack tray rows | one 48 px row; state shown in the label (A150) |
| `.rc` | selectable card with a real selected state |
| `.tab` | tab, active state beyond colour |
| `#rail`, floating panels, `#guide`, tour card | one sheet language; `#guide` keeps its blur (render asserts it) |
| `.tag` | tag — legality only; not reused for "offline" or "live GPS" |
| `#toast` | toast for bare acknowledgements, wraps, `aria-live="polite"` |

Selected state, eight ways today → one: a check or dot plus weight in the
label and a border — never a fill change alone. Card anatomy: title
(`.tn`), subtitle (`.sub`), a facts row, the honesty line, one primary
action.

Icons: one Lucide icon per meaning. Proposed (all present in lucide-static
1.37.0): Compass `compass` / Locate `locate-fixed`; Stop download
`circle-stop` / Delete `trash-2`; the five modes from the references;
turns `arrow-up`, `arrow-up-left/right`, `corner-up-left/right`, `undo-2`,
arrive `circle-dot`; card actions `route`, `house`, `crosshair`, `phone`,
`star`, `x`; voice `volume-2`/`volume-x`. The ICONS-map pasting stays
(A118); a check compares each pasted string to lucide-static's.

---

## 7 · Planning and starting a route (A217)

Targets, for approval:

| Flow | Today | V4 |
|---|---|---|
| Plan and ride to a place | 4 | 3 — long-press → **route here** → **Ride it** on the route card |
| Return home and ride | 4 | 2 — **Return home** reachable with the drawer folded → **Ride it** on the route card (A200's "two actions") |
| Set home | 3 | 3 — just redesigned (A200); unchanged |
| Free ride | 2 | 2 — must not get longer (landmine 135) |
| Turn list | 1 | 1 — renamed so it no longer collides with "Directions here" |

- The destination → card → route options → Ride it path is one line; each
  step has one primary action.
- Plan actions visible and labelled, no sideways strip. A113's "at most 5
  on screen" is re-decided and given a counter (landmine 192).
- Wrong turn becomes simulator-only.
- Toasts take bare acknowledgements only; smoke's panel-text asserts
  (smoke.mjs:673-715) move in the same commit; results and the PARTIAL
  card stay cards (`showQuiet` 7566 already exists for quiet ones).
- Lock-step render hooks: Set home and I'm here share a destination
  (2742-2744); the action row has ≥4 buttons (2747); the reachable list
  (2736-2738); the self-test's on-screen list (6528-6529); the tour ring
  still encloses `c-mode` and `c-act`.

---

## 8 · Map share (budget)

§1.6 is the floor: V4 may not shrink the clear band at 360×800 or 411×960,
drawer open or folded — nor at 749×832, the inner screen the maintainer
uses (§4.3), once take 187 has measured it there.

Take 187 measures the band with `node tools/probe.mjs v4` (folded: 59.2%,
51.0%, 52.9%). An open drawer is as tall as what it holds, so the open
measure fills it to its maximum height — and there 360×800 leaves 2.2% of
the height clear (the left stack and the tool strip nearly meet), 411×960
12.2%, 749×832 5.1% (MEASURED, desktop Chrome, the drawer settled). A render guard was built and taken out
after three failed attempts (PROTOCOL §5): inside render's run the drawer's
geometry contradicted its class at measure time (25% "folded" at 360×800,
where a fresh page and a readback of render's own sequence both read 51%).
Ruled out: state left by earlier checks, saved storage, the drawer reopening
itself. The cause, found at the seal (landmine 224): headless Chrome leaves
a CSS transition pending until a frame is drawn, and nothing draws one while
the map is idle; the probe now draws a frame and waits for the drawer's
transitions. The guard returns that way with V4's drawer (take 189), which also sets the
open budget; the small phone is where it bites. Bigger targets and type are paid for by layout,
not by map. The floating stack is placed by hand-typed offsets (250-328),
so 48 px controls are a relayout, not a token change. A ride-HUD overlap
check (`#nav` vs `#hudbar`, `#hudstats`, `#alert`) lands with the 56 px
ride controls. Self-test map-has-room (>35%, 6575-6577) and the device
matrix (render:3137-3193) keep passing.

---

## 9 · Hybrid (A202, A212, A213) — decisions for the maintainer

The take-113 study already wrote the Hybrid rules and they were never
built (DESIGN.md §3, APEX-Hybrid): "imagery dimmed + desaturated · water overlaid
dark", "two-tracks dimmed to quiet rust; labels white with dark halo;
road casings off", "dark scene, luminous data". Today: grey outlines on
(2494-2495), two-tracks full brown with a white casing (`casing-track`
0.4), light halos, water an opaque light blue over the photo (#A9D3E6).
The §4 references confirm or replace those rules before D1–D5 get values.

- **D1 · Road casings on Hybrid.** Width, colour and visibility decided
  together (landmine 91), measured over dark canopy and bright ground with
  `tools/colour_probe.py` / `colour_sweep.py` (landmine 108). Recommended:
  DESIGN.md's recorded "road casings off" on Hybrid, trails keeping their
  white casing; two-tracks toward "quiet rust" (a legality colour — scored
  against the non-ridable colours first, landmine 108).
- **D2 · Paved roads zoomed out.** Recommended: keep take 126's "highways
  stay, at a third". Hiding any class is a zoom-range change (A59, never
  opacity 0), only with landmine 129's never-hide list and its check.
- **D3 · Basemap × machine.** One function derives road opacity from both.
  The rule — multiply, minimum, or roads exempt from craft dimming — keeps
  a visibility floor (landmine 115) and stays a per-feature `case` with
  precomputed literals (render reads `"case"` and `0.285`,
  render:3342-3354). Checked after a machine change on Hybrid and a mode
  change from Hybrid; the restored-Water order fixed with a check.
- **D4 · Imagery and water.** One treatment from the mosaic through the
  z11–15 tiles; how much dimming comes from §4 — the maintainer's goal is
  seeing the ground. Water on Hybrid: today an opaque light blue pasted
  over the photo (OBSERVED, `11-water-pins-houghton-z11.6`); DESIGN.md
  wrote "water overlaid dark".
- **D5 · Labels.** White with a dark halo on Hybrid (DESIGN.md §3 and T4,
  never built); today's halos are the light map's.
- **D6 · Map + Hybrid only (decided, A212).** Updates in the same commit:
  render 482, 741/757/780/804, 2983, 3007-3031; smoke 1223;
  `tools/probe.mjs:117`; the tour's "Map, satellite or hybrid" (3311) with
  a tour key bump (A147).
- **D7 · Fragments.** Measure first (line length drawn per layer at
  z7/9/11, tile-clipped copies deduplicated). Then try the runtime
  `chainStrokes` (1136, source `strokes` 2344) as a low-zoom draw-only
  source, or GeoJSON `tolerance`, before any pipeline step. Merged lines
  stay out of `HIT` (7333) and keep their legality class.

---

## 10 · Pins (A197 P3, A209, A210, A214)

Invariants any design keeps: the count equals what the map draws; mixed
stacks allowed; a badge sits on a real member, never a centroid (2684-2686);
services never stack at statewide zoom.

- **Defects first (take 187):** A209 (rank 0, the signature), A210 (the
  `poi-dot` gate — a live read on a view that provably holds a gated pin,
  printing its count; landmines 55, 130).
- **Instruments:** `pins_probe.py` ranks as the app does; a committed
  0.1-zoom sweep calibrated against render's live counts; decisive
  comparisons in the real page (`probe.mjs eval` on `window.__stack`).
- **Stable stacking (recommended): zoom bands.** The drawable pool is
  constant within a band; stacks are computed at the band's lowest zoom,
  so on-screen spacing only grows inside it and render's history-free "no
  two within R" (render:1498-1501) still holds; at a band edge stacks only
  split. Band width is the stability-vs-precision knob, set by
  measurement. Target: under 5% re-partition per 0.1 step, kind arrivals
  excluded (A197 — no clusterer removes those).
- **Upstream re-checked (PROTOCOL §3), ruled out again:** supercluster
  places at centroids (lakes) and would need vendoring; `cluster:true`
  re-clusters on every `setData`, which queues behind tile loads (15.9 s
  measured, 7162-7165). The rulings touched: take 123, take 154 (overtaken
  at 169 on mixed stacks), A170.
- **Flicker:** the label-fade cause and the `moveend` cause measured
  separately. A non-zero `fadeDuration` would be an A120 exception the
  maintainer approves; `raster-fade-duration:150` (2418, 2421) already is
  one, unrecorded.
- **Badges (A214):** each kind a distinct glyph and colour — including
  system vs day-use and the paddle duplicates. Reverses A197's "no new
  art", on the maintainer's verdict. Glyph source — today's stroke style
  (rationale 1246-1247: "a stroke sketch outlives any imported path" at 8
  px) or Lucide paths — chosen by rendering both at z9.2, z10 and z12 at
  DPR 2.625. Colours from §4.
- **Legend:** the Pins rows show the map's own badge image, checked equal
  (landmine 98); a `.sw` stays for render:1617 or that check moves with it
  (landmine 217).
- The "All labels" badge circle (left as found, take 186).

---

## 11 · Guards, each with a planted control

Floors in take 187 are today's; take 189 raises them to V4's. Offender sets
may only shrink. Every check runs the same function on its planted
control, never throws inside `page.evaluate` (landmine 217), and a hidden
planted element must *not* be flagged.

| Guard | Where | 187 | 189 | Planted control |
|---|---|---|---|---|
| Contrast, text over its background composited on pure white and pure black (A150's never-built check); stroked/haloed map text its own rule | render | today's set | 7:1 / 4.5:1 / 3:1 | low-contrast chip |
| Tap target, every interactive element, each state forced (landmine 111) | render | 38 px | 48 / 56 px | 30 px button |
| Text floor | render | 9 px | 12 px | 11 px span (in 189) |
| Raw colour literals, comment-stripped `www/` | gate | today's set | exemptions only | planted literal |
| Accent budget from the token (render:1617, 2441) | render | 1 | 1 | second accent surface |
| Every `var(--x)` declared | gate | all | all | undeclared var |
| No emoji/glyph icons, incl. `#nav` and cards | render | extended scope | same | planted glyph |
| Clear band (§8), three sizes | probe (render guard deferred, §8) | measured | render guard + open budget | a 200 px taller mode chip |
| Ride-HUD overlap | render | — | added | overlapping element |
| Tap counts (§7) | render | — | take 190 | extra step |
| Pin re-partition per 0.1 step | probe/render | measured | < 5% | old restack |
| Pins legend = map badge image | render | — | take 188 | swapped image |
| CSS/JS shared colours equal | gate | added | same | planted mismatch |
| Barlow applied (`document.fonts.check`) | render | added | same | wrong family name |

Harness gaps closed in take 187 (A211): `.svg`/`.woff2` MIME types in the
render, probe and palette servers; `check_offline` recursive, with a cited
allowance for the SVG namespace and the MapLibre worker's URL; the stale
`c-labels` (render:3153); `verify_palette` failing on a renamed row and
running on Hybrid; `check_palette` reading hyphenated ids, the two grey
outline colours moved into `PAL` at the same values. The in-app
self-test's own tap check stays at 38 px on four classes: smoke fakes 40
px (smoke.mjs:113) and the self-test ships to riders.

Hooks every take keeps: the build markers (`__MLGCSS__`, `__MLGJS__`, the
last bare `<script>`, `__SPLASH_LOGO__`, DECLS); `#title` "ORV · Take N";
~95 ids, 15 data attributes, ~20 class strings; exact strings in source
casing (HD sheet, "MAP CENTRE", legend labels, "What are you doing
today?"); smoke's DOM — `<button|div class="…" data-…>`, class first,
letters-only data names right after it, bare `.class` selectors, no
`classList`/`closest`/`setAttribute`/`contains`, no new `map.X()` without
its stub; `svg.ic` ≥16 in `#shell` buttons; one SVG in `#cmpbox`;
`#peek-chev` "▾"; the tab bar below `#stage`; closed panels transitioned,
not `display:none`; `#actions` outside `#railbody`.

---

## 12 · Takes and approval gates

| Take | Content | Unlocked by |
|---|---|---|
| — | this study, docs only | — |
| 187 | A208 tokens (computed-style diff against take 186 must be empty) and guards; A209, A210 defects; A211 harness gaps; the V4 probe scenes | the maintainer's OK on §5, §6, §11 |
| 188 | the map: A202 (D1–D5, D7), A212 (D6), A213, A197 P3, A214 | §4 references + the mockup |
| 189 | the look: A215, A216; licence notices (Lucide ISC, Barlow OFL) in Data sources and PROVISION via `tools/manifest.py` | the mockup |
| 190 | the flow: A217; the tour, `#guide`, TESTING.md and README follow; tour and guide keys bumped (A147) | the mockup |

The mockup: a private page at 411×960 built from real probe shots with V4
chrome in Barlow and Lucide — the route flow, a place card, the pin
legend, Hybrid before and after — made only after §4 is transcribed, and
judged on the Fold. V4 does not jump ahead of the A183 device check on
the take-186 Play candidate.

- **Ruled out:** a rebrand or new identity — A114, and the skill's own
  design system lands on the existing one.
- **Ruled out:** a framework, Tailwind or a native rewrite — A116,
  landmine 153; smoke's fake DOM and `check_stubs` bound the markup.
- **Ruled out:** designing the look from the skill's palettes (landmine
  190); its rules are adopted, its look is not.
- **Ruled out:** pixel assertions in the gate — A206, landmines 54, 189.
- **Ruled out:** a light theme and the inner-screen layout in V4 — not
  chosen (ROADMAP:430).
- **Ruled out:** MapLibre or supercluster clustering for pins (§10).
- **Ruled out:** hiding roads on Hybrid by opacity 0 (A59), or at all
  without landmine 129's list.
- **Ruled out:** one take for everything — the maintainer chose staged
  takes.

## 13 · Deferred

The inner-screen / two-pane layout; landscape; a light theme; junk and
borrowed pin names; shields and serif water names (DESIGN.md); A201's
compass fix; A207; A206's emulator phase; the personal name in source
comments (a sweep with its own gate check, outside V4).
