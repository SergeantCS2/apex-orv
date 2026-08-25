# DESIGN — the reference study · take 113 (study phase, no code yet)

Jacob's brief, verbatim intent: **"a love child of onX Offroad and AllTrails,
but Michigan only."** Hybrid/satellite should read like onX; the default light
map should read like AllTrails; both must carry the same content — parks,
beaches, lakes, forests, river put-ins and take-outs, campgrounds, and the ORV
network that is already ours.

Five reference screenshots studied on 2026-08-24 (Jacob's own phone: onX
Offroad statewide satellite; AllTrails at four zooms including OUR ground —
Mio, the Au Sable, Rose City, Huron NF). What follows is transcription, not
invention. Where a value is sampled from a screenshot it is approximate but
close.

---

## 1 · What onX Offroad actually does (satellite reference)

**The imagery is dimmed and desaturated so the overlays glow.** Water reads
near-black navy. Whole scene sits dark. Trail lines are thin (~2 px at state
zoom) and VIVID — bright green (~#3FBF3F) and blue (~#3B82F6) — and they are
the brightest thing on screen. That inversion (dark ground, luminous data) IS
the onX look.

**Chrome:**
- No pill rows. Top bar is three bare white glyphs over the map: menu, logo,
  search. Nothing else.
- Right rail: dark rounded-square buttons (~48 px, ~#262626 near-opaque, white
  line icons), some with a tiny label UNDER the icon (Weather, 2D). Stacked,
  consistent, quiet.
- Exactly ONE accent element on the whole screen (orange Upgrade pill).
  Everything else is dark/white.
- Compound control pattern: "Filters · Active: 0" — dark pill, small orange
  icon tile inside, title + subtitle. Worth stealing for our Machine chip.
- Bottom tab bar: dark ~#1C1C1C, five tabs, line icon + label, white active /
  grey inactive. Their icon set is professionally drawn (the little jeep).

**Cartography details:** real interstate shields; state-boundary as yellow
dotted line; physiographic region names in italic serif ("Superior Upland");
"MICHIGAN" in letter-spaced caps; city labels plain white with soft dark halo.

## 2 · What AllTrails actually does (light-map reference, four zooms)

**The ground is never one colour.** Base is warm light grey (~#F2F3F0). Forest
and parkland wash in pale green (~#D7E8CC), with a second slightly deeper green
for public land / denser cover — at the Huron NF zoom the ENTIRE ground is the
green wash and it instantly reads "forest," which is exactly what our tan
basemap fails to do. Water is a confident mid blue (~#A9D3E6), named in blue
italic-ish serif ("Scott Lake"). Wetland gets its own texture.

**Roads:** white with the faintest grey casing, width by class; street names in
grey uppercase rotated along the line; bike routes as blue-purple dashes;
railways thin grey. Michigan route shields are drawn CORRECTLY — the black
diamond for M-33, white rectangles for F-routes. That authenticity detail
matters in a Michigan-only app.

**POI system — the single most transferable pattern:** category-coloured
circular badges with a white glyph, label text in the SAME category colour with
a white halo:
- nature/parks → green circle, white tree, green label
- campgrounds → brown circle, white tent, brown label ("Au Sable Loop
  Campground" at Mio — our own ground, styled better than we style it)
- visitor centre → dark circle, building glyph
- saved/target pins → near-black-green teardrops with white dot; clusters as
  the same pin with a white count
This replaces our anonymous coloured dots wholesale.

**Chrome:** every control is the same language — dark (~#1E241E) circle or
rounded-rect, white line icon, ~44-48 px: close (top-left), layers+weather
stack (top-right, with a lime notification badge), compass with ORANGE north
needle + locate (bottom-left), two more (bottom-right). ONE accent: lime
(~#A4F24C), spent once, on Start.

**Bottom sheet:** dark ~#1A1F1A, ROUNDED top corners, centred grabber pill, big
white TABULAR numerals with unit subscripts ("0:00 | 0.00 mi"), accent Start
button right. No standing instruction text. This is precisely the anatomy our
drawer should have.

## 3 · The synthesis — what APEX becomes

Two named styles, one content set, one chrome:

**APEX-Light (default) — AllTrails-derived**
- Ground #F2F3F0 · landcover green wash from OSM (`landuse=forest`,
  `natural=wood`, `leisure=park|nature_reserve`) with a second tone for public
  land · wetland variant · water ~#A9D3E6 with blue names
- Roads white + hairline casing, width hierarchy, grey rotated street names,
  Michigan diamond shields for M-routes, rectangles for F-routes
- ORV network stays OURS on top: legality colouring, closures red — the onX
  content on the AllTrails base. Non-motorised paths dashed dark green.
- POI as the badge system above; paddle put-ins/take-outs get a blue badge
  class of their own.

**APEX-Hybrid — onX-derived**
- Imagery dimmed + desaturated (MapLibre `raster-brightness-max` ~0.8,
  `raster-saturation` ~-0.3, tune by eye) · water overlaid dark
- Trail overlay thin and vivid; two-tracks dimmed to quiet rust; labels white
  with dark halo; road casings off
- Dark scene, luminous data.

**Chrome (both styles):**
1. ONE control language: dark near-opaque rounded squares/circles, white
   Lucide icons, 44-48 px. The cream pills, the grey pills and the orange
   Hybrid toggle all die.
2. Accent orange reserved for exactly one element per screen (context primary:
   Start riding / Return home). Basemap toggle becomes a quiet dark button.
3. Drawer → true sheet: rounded top, centred grabber (no text strip at rest),
   tabular numerals for TO TRUCK / recorded / elevation, place-name-first card
   hierarchy, coordinates demoted to the bottom as small data.
4. Type: bundle Barlow + Barlow Condensed (OFL); mono ONLY for coordinates.
5. Icons: Lucide (ISC) replaces every hand-drawn path, including the tab bar.

**Open decision for Jacob — the top chips row.** Neither reference has a
permanent row of place pills. Options: (a) fold the quick-jumps into Search as
suggestions, (b) collapse to one dark "Places" button, (c) keep but restyle
dark and smaller. Default recommendation: (a).

## 4 · Content parity (his requirement: both maps, same info)

Have today: ORV network, closures, 59 POI, lakes/rivers, contours, summits,
6 paddle corridors with access/dams/campgrounds, restrictions.
**Gaps to reach the references:** beaches (`natural=beach`), park/preserve
POLYGONS as first-class tinted areas (we only badge some as points), denser
general POI (visitor centres, day-use, trailhead density AllTrails shows),
public-land tint layer. All extractable from the Geofabrik file we already
hold; statewide will need the POI extraction generalised anyway.

## 5 · Build order (each step screenshot-reviewed BEFORE any install)

- **T1 Chrome:** control language + sheet anatomy + Lucide + Barlow. Works in
  every basemap immediately; biggest cheapness kill per hour.
- **T2 Light cartography:** landcover/water/roads/shields/labels.
- **T3 POI badges:** category system both styles.
- **T4 Hybrid tuning:** imagery dim, overlay glow, halo swap.
- **T5 Content parity:** beaches, park polygons, POI density, public-land tint.

Checkpoints throughout; seal only when Jacob wants a build on the phone.

## 6 · Licence note (so it is written down once)

Layout, palette, iconographic conventions and cartographic style are not
copyrightable subject matter; we transcribe them freely for this free personal
app. We do NOT copy their actual asset files, fonts under proprietary licence,
logos or names. Lucide is ISC; Barlow is SIL OFL; both bundle offline cleanly.


## 7 · Third reference incoming: onX Backcountry (take 115)

Jacob: the target is now a love child of THREE — onX Offroad (motorised,
satellite), AllTrails (light map, general outdoors), and **onX Backcountry**
(hiking/backcountry: topo emphasis, slope, waypoint-rich planning). Screenshots
to come; this section reserves the slot so the study extends rather than
restarts. Expected pulls, to be verified against his captures: topo/contour
presentation, slope-angle styling (A88 exists), tree-cover layers, and their
waypoint/route planning surfaces. Status: AWAITING REFERENCES — transcribe,
don't invent (landmine 190).
