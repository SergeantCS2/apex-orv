# DESIGN — Modes (A136 / A137)
*Take 124 · a proposal, not a build. Jacob: "each mode for essentially each
onX Off-road application" — ORV/MTB, Fish/Camp/Hunt/Hiking, Beach/Kayak/
Tubing/Boating. Landmine 190 applies: transcribe his onX screenshots, do not
invent what a hunter or angler wants.*

## What a mode IS

One tap that sets five things at once, each of which already exists as a
table in the app:

| the mode sets | today's table | mode = a preset over it |
|---|---|---|
| which lines draw | `ACTS` (activity selector: orv / dirt / foot / horse / snow / nfs) | a default `act`, plus a whitelist of show-only classes |
| which pins draw | `POIKIND` (13 kinds) + `pri` rank (take 123) | a kind whitelist and a per-mode rank override |
| which layer groups are on | `LYRGROUPS` (places, water, contour, peaks, areas, paddle, relief, labels) | a default on/off set |
| which basemap | `BASEMAPS` | Map or Hybrid |
| what the router optimises | six profiles + `MACHINE` | a default profile and machine |

Nothing about a mode is new geometry. The exception is hunting (below).

## The modes, with what exists for each

### 1 · Ride — ORV / MTB (the app today)
- Lines: `orv` (route72, trail50, moto24, mccct, fstrail) + two-track + forest
  roads. MTB adds the `bike` show-only class (2,949 routes carried, never yet
  drawn by default).
- Pins: trailhead, camp, fuel, dayuse, view. Riding areas ON.
- Router: Most trail; machine as chosen.
- Basemap: Map. Relief off, contours off.
- **Exists today.** Mode 1 is the current default renamed.

### 2 · Outdoors — Hike / Camp / Fish / Hunt
- Lines: `foot` (69,628 routes — the largest class we carry and it is show-
  only today), `horse`. ORV lines hidden by default, one tap to reveal.
- Pins: trailhead, camp, shelter, water, toilet, view, launch, beach.
- Layer groups: Named hills ON, Contours ON at close zoom, Relief ON, Rivers
  & paddling ON. Riding areas OFF.
- Router: on foot — a seventh profile, `walk`, over foot + track classes.
  **Not built.** The router already routes over classes by machine; a
  "machine" that walks (`ok: ['foot','track','fsroad',…]`, speed 3 mph) is a
  MACHINE table row, not new routing.
- **Hunt** needs data we do not have: DNR State Game Areas / Wildlife
  Management Areas (a DNR polygon service, same shape as scramble areas),
  hunting-unit boundaries, and public-land ownership (our landcover `public`
  is 87 polygons — the Census/DNR public-land layer is far denser).
- **Fish** needs: lakes as tappable objects (water.json has 12,826 named
  polys — already there), DNR Boating Access Sites (found, not fetched),
  and species/stocking if Jacob's onX Fish screenshots show that is the
  point. **Transcribe first.**

### 3 · Water — Beach / Kayak / Tube / Boat
- Lines: paddle corridors (76, with float times, dams, portages), NO trail
  lines by default.
- Pins: launch (2,017), beach (1,106), camp near water, dayuse, marina
  (needs `leisure=marina` added to POI_EXTRA — one line).
- Layer groups: Rivers & paddling ON, Lakes & rivers ON, Places ON, Named
  hills OFF, Riding areas OFF.
- Router: none by default — a paddle "route" is the corridor itself. Return
  Home still works.
- Basemap: Hybrid (water reads best on imagery).
- Great Lakes destinations (A139 — lighthouses, major harbours, famous
  grounds) belong to this mode.

## The one thing every mode shares

The default VIEW. Jacob: "the default map view changing". Today the app
opens at your position zoomed out, else HOME, else mid-Michigan. A mode can
carry a zoom preference (Ride: z9 to see trail systems; Water: z10 on the
nearest lake; Trail: z11) but not a place — position is position.

## How it is built, in order

1. **`MODES` table + a mode chip** next to the basemap chip: three entries,
   each a preset {act, kinds, groups, basemap, profile, machine, zoom}.
   Switching a mode applies the preset through the existing setters
   (`applyAct`, `setBasemap`, layer-group toggles, `setChip`). Persisted in
   storage. **One take.** Everything a mode does must also be reachable by
   hand afterwards — a mode is a starting point, never a cage.
2. **Draw `foot` and `bike` by default in Trail and Ride** — they are in
   the bundle already. Confirm on the Fold that 69,628 foot routes at
   state zoom is a map and not a hairball; they may need the same `pri`
   thinning the pins got.
3. **`walk` machine + profile.** A MACHINE row and a profile label.
4. **Water mode data:** `leisure=marina`; DNR Boating Access Sites
   (authoritative, named); A139 Great Lakes POI.
5. **Hunt/Fish data**, after Jacob's onX screenshots are transcribed:
   DNR game areas, public-land ownership, hunting units; lake cards.
6. The guide rewrite (A155) teaches modes; its key bumps (A147).

## What I need from Jacob before step 5

The onX Hunt and onX Fish screenshots he holds — what is on screen, what
is one tap away, what the pin set is. Steps 1–4 are transcribable from what
we already have; 5 is not.

## Ruled out
- A mode as a separate bundle or region: every mode reads the same 132 MB.
- Hiding roads in any mode: the `applyAct` exemption stands.
- Inventing a fishing or hunting pin set from general knowledge — landmine
  190. The hunter is Jacob's expert, not me.
