**Take 119 — Riding areas, statewide summits, and the one line that killed
your first complete Michigan build.**

### What happened to your take-118 CI run

It worked. Your workflow paste was correct: CI built the whole state in
1,637 s — 474,047 edges, 130 MB, five smoke modes green, and the graph hash
`01cdc37a60d5` is byte-identical to the same build in the sandbox. It then
died on `ci/bundle.sh: line 12: APEX_REGION: unbound variable` — take 118
removed the pin from your workflow and left this one reader of it behind.
Fixed: the script now asks `regions.json` (via region.py) for the region.

**No manual step this time.** Your `.github/workflows/build.yml` is already
right. Upload the seed as usual. Expect ~15 min with warm caches, and the
summary line `verified: region michigan, bundle ~132 MB`. If the cache
serves stale box payloads the guard names its remedy (bump DATA_V).

### What is new on the map

- **Riding areas.** Silver Lake Dunes is ground, not trail — your call. The
  DNR publishes its designated ORV scramble areas as polygons in a separate
  service we had never read. Eight statewide, drawn in the legal-route green
  with a dashed edge and a label: St. Helen Motorsport Area (1,285 ac),
  Silver Lake ORV Area (447), Holly Oaks (239), The Mounds (213), Black
  Mountain (64), Gladwin (20), Rock Climb Area (10) and Bull Gap Hill Climb
  (3). Tap inside one for its card; a trail under your finger still wins.
  Layers → "Riding areas" (on by default).
- **Named summits statewide.** 323 of them, Mount Arvon at the top — the
  take-117 OOM is gone. Layers → "Named hills". Contour lines remain off
  statewide by design (take 75).
- The bundle now verifies **COMPLETE** rather than PARTIAL.

### Confirm on the phone

1. Fly to Silver Lake (Search → "Silver Lake"): the dune area draws as a
   green polygon with its acreage; tap inside it → the card says routing
   goes to its edge, never across.
2. Fly to Bull Gap: a tiny green polygon on the hill climb — 3 acres.
3. Layers → Named hills → Mio Mountain 1,296 ft, Wagon Wheel Hill 1,450 ft.
4. The About panel shows Take 119, bundle COMPLETE.

Field verdicts that would drive the next take: does the 447-acre polygon
read at state zoom, and does the area label collide with the Silver Lake
State Park place label?

### Known, deliberate

- Private motocross parks (Ogemaw Hills etc.) are NOT in the DNR layer; they
  are queued for the places pass as a category (A140 open).
- Return Home and Directions still route to the nearest edge inside a
  scramble area; the card says so, the router does not yet (A140 open).
- Peak heights are read from the z10 DEM and run a few feet low (Mount Arvon
  1,972 vs the official 1,979). Recorded, not fudged.
