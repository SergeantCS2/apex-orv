# PROTOCOL

*Revised 2026-08-19, take 138.*

The working rules for this project. The gate enforces the ones it can.

---

## 0. Start of every session

**Deliverables are verified where the person reaches them.** A session that
hands over work checks what is ACTUALLY in the outputs directory — not what a
previous session remembers putting there (landmine 191: a verified take-113
seed reverted to take 112 between sessions). Every sealed seed carries its take
number in its filename (`apex-seed-tNNN.zip`) and its sha256 is printed in the
message beside it.

**One-off audit probes are code and get the same suspicion as checks** — a
probe is verified against a known-true case before its findings are believed
(landmine 193: three of a take-115 audit's five alarms were the probe's own
regexes).

Read, in this order:

1. `docs/LANDMINES.md` §0 — the symptom index. Do not read landmines top to
   bottom; nobody finds the right one that way.
2. `docs/AGENDA.md` — what is open, and what has already been ruled out for each.
3. `docs/HANDOFF.md` — newest take first.

---

## 1. Evidence labelling

Every claim about system behaviour is one of:

- **PROVEN** — observed directly, with the observation stated. "I ran it and saw X."
- **INFERRED** — reasoned from documentation or analogy. Say so.
- **UNKNOWN** — not established. Say this instead of guessing.

Label first, and when in doubt label down. An INFERRED claim presented as PROVEN
sends the next session down a path nobody verified, and the cost lands several
takes later when it is expensive to unwind.

**A specific trap for this project:** "the library supports it" is INFERRED until
it runs on the Fold. Desktop Chrome is not evidence about a Samsung WebView, and
a green CI build is not evidence about a phone in a jack pine stand.

---

## 2. Takes

Every shipped build gets a number, stamped in `BUILD` as `OFFROAD_TAKE=N`.
Takes are never reused and never back-dated.

---

## 3. Check upstream before building a mechanism

Before writing anything that looks like infrastructure, check whether MapLibre,
Capacitor, planetiler, PMTiles, Valhalla or OsmAnd already does it:

- Tile storage → PMTiles and MBTiles exist. Do not invent a format.
- Offline routing → Valhalla ships offline tiles. Do not write a router.
- Geometry simplification → the tiler does it. Do not pre-simplify twice.
- Terrain and hillshade → MapLibre has raster-DEM sources natively.
- Distance, bearing, along-track → Turf has these, tested.
- Coordinate formatting → so does everything. Do not hand-roll it.

**Copying beats deriving.** A mechanism you wrote is a mechanism you maintain.

---

## 4. Cleverness policy

Prefer the boring mechanism. If a fix requires explaining why it works, it is
probably the wrong fix.

Removing something is a valid change and usually a better one than adding.

---

## 5. Three-strike circling rule

**After three consecutive failed attempts at the same symptom, stop.** Do not try
a fourth guess. Instead, in order:

1. Write down what has been ruled out, with evidence. A short list is itself the
   finding — the attempts were not producing information.
2. Find something that already does the thing and works, and read its source.
3. Add a readback diagnostic. Turn "it doesn't work" into a fact.
4. Ask Jacob for a *differential test*, not another build. A test that isolates
   one variable is worth more than three builds that change several.
5. If none of that produces a new fact, say so and offer to stop.

**A sign you are circling: your last three changes were all ADDING things.**

---

## 6. Ordering — the lossy step goes first

The documentation step is the one that gets dropped under pressure, because it
sits at the end and nothing breaks visibly when it is missing. So invert it:

1. Write the HANDOFF entry **first**.
2. Update LANDMINES / AGENDA / ROADMAP if the take taught anything.
3. Build, gate, ship.

If a response runs out of room, what is lost is the build — one message away and
obviously missing — instead of the record, which is silently gone forever.
Losing the recoverable thing beats losing the irrecoverable one.

**Never compress a cycle to fit one response.** A ship may span two turns —
diagnose and build in one, docs and artefact in the next. Say which turn you are on.

**End every shipping response by stating what was DEFERRED.** Not "here is what I
did" — "here is what I chose not to do this cycle." Deferral that is spoken is a
decision; deferral that is silent is a hole in the record.

---

## 6b. Clean runs

**Any take that adds or changes a pipeline step is followed by a clean run before
it ships.** Copy the committed files into an empty directory, run
`tools/pipeline.py`, then gate.

Artifacts survive on disk and hide broken producers. Take 13 found four broken
steps this way that thirteen takes of ordinary work had not surfaced, including
one that had been silently reverted two takes earlier. Nothing else finds this.

---

## 7. The gate

`tools/gate.py` runs on every build. It is not advisory. If it fails, nothing
ships.

Every check corresponds to a mistake that is easy to make and hard to notice.
When a new one of those turns up, add a check rather than resolving to be careful.

---

## 8. Offline is about the field, not about the network

**Revised at take 10.** The earlier version of this rule said no shipped asset may
reach a remote origin, full stop. That was too blunt and quietly wrong: every tile,
every DEM sample and every agency record has to come from somewhere. The rule was
conflating two different phases.

**Provisioning — at home, on wifi.** The app may download whatever it needs.
Regions, imagery, terrain, refreshed agency data. This is expected and fine.

**The field — no signal, no exceptions.** Nothing the app needs may depend on a
network call. Not a font, not a glyph range, not a tile, not a licence check.

**The invariant that makes this safe rather than aspirational:**

> After provisioning completes and verifies, the app must be **provably** complete.
> The test is a cold start in airplane mode: every layer the region claims to have
> renders, and the NET badge stays green.

Three controls, because this failure is invisible on wifi:

1. **Runtime assets carry no remote origins.** The gate greps `www/`. A CDN
   reference passes every bench test and dies at Mack Lake.
2. **The app wraps `fetch` and `XMLHttpRequest`** and shows a NET badge. Belt and
   braces.
3. **Every provisioning host is declared** in `docs/PROVISION.md` with its purpose,
   licence and refresh cadence. The gate refuses an undeclared host in `tools/`.
   An undeclared fetch is exactly the thing that works with wifi on.

Declaring licences is not bureaucracy. Landmine 22: Esri, Google, Bing and Mapbox
imagery may not be redistributed into an offline bundle. USGS and NAIP may. The
manifest is where that distinction lives so nobody swaps in a nicer-looking
basemap without noticing.

---

## 9. Safety features are not features

Anything in ROADMAP Phase 4 is load-bearing. It does not get cut for schedule, it
does not ship behind a toggle that defaults off, and it never depends on a network
call or a successful map download.

If a Phase 4 item can fail silently, it needs an indicator showing it is working.

---

## 10. Before shipping, ask

- Did I label PROVEN / INFERRED / UNKNOWN honestly?
- Did I check upstream before building a mechanism? (§3)
- Is this my third failed attempt at the same symptom? (§5)
- Did I write the HANDOFF entry FIRST? (§6)
- Have I stated what I am DEFERRING this cycle? (§6)
- Am I asking Jacob to test more than one thing at a time?
- Would splitting this across two messages produce a more complete result?

**Touched steps run before the seal.** If a take edits a pipeline tool, that
step executes this take — locally or with its region path exercised — before
anything is sealed. Parse is not verification; cached payloads hide dead code
until the clean CI runner finds it (landmine 194).
