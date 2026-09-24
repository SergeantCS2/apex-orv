# APEX ORV — NEW CHAT BRIEF · V4 (rewritten 2026-09-23 at take 186)

Read this first, then CLAUDE.md (how work happens on the workstation),
then the newest HANDOFF entries. PROTOCOL is the law; LANDMINES §0 is the
symptom index. The ledgers are long: grep them, never read them whole.

## What this project is

A free, fully offline Android trail-navigation app for Michigan — both
peninsulas and Isle Royale — for ORV riders, paddlers, hunters, hikers and
campers. "A love child of onX Offroad and AllTrails, but Michigan only."
It is tested on the maintainer's Samsung Galaxy Z Fold and, since take
183, built on the maintainer's WSL2 workstation (before that: a claude.ai
sandbox and seed zips). Stack: Capacitor 8 + MapLibre GL 5 + an offline
bundle; a Python pipeline over the Geofabrik Michigan extract, DNR/USFS
ArcGIS layers, USGS DEM and imagery; a harness of smoke (319 assertions
over 5 passes at take 186), render (306 checks) and the gate (43 checks);
append-only ledgers.

## Where it stands at take 186

**Play:** take 176 is the production baseline — `com.apexoffroad.app`,
closed testing since 2026-09-02. Takes 183–186 each went green in CI and
were not promoted: the A183 device check is open, and take 186 is the Play
candidate once it passes.

Since the V3 brief (take 180):
- **181** — the first field reports: panels close on an outside tap and
  have Done (A192); back no longer exits (A193); a privacy link (A195).
- **182** — the first-run tour, on the real screen (A194).
- **183** — R8 on, asserted on the artifact (A183); the first take built
  on the workstation.
- **184** — the address index covers every county or the build refuses
  (A196).
- **185** — pins count what the map draws (A197 P1); CI keeps its cache
  (A198); an honest first-open text (A199); a compass readback (A201);
  the forest layer per mode (A205).
- **186** — the Pins selector (A197 P2); Set home in one button (A200);
  PROVISION regenerates from its tool (A204); a visual QA loop,
  `node tools/probe.mjs take` (A206).

## V4 — the presentation overhaul (A203)

The maintainer, 2026-09-23: "The feature set is there, we just need to
present it better." The study is `docs/DESIGN-v4.md`: a measured audit,
the rules taken from the ui-ux-pro-max skill, the decisions, and takes
187–190 (foundation, the map, the look, the flow). Its pieces are A197 P3,
A202 and A208–A217. Decided that day: one dark look; study first, then
staged takes; the look transcribed from the maintainer's reference
screenshots (landmine 190) — **still awaited**; Map + Hybrid only.
Nothing of V4 is built. The "before" screens are in
`~/apex-shots/v4-baseline/`, outside the repo.

## What only the phone can answer

- The A183 device check: R8 on the phone.
- The whole-state HD save: whether Samsung's WebView grants ~215 MB of
  IndexedDB (A190).
- The self-test COMPASS line (A201) — the fix waits on it.
- Sunlight, gloves and the fold seam — never measured (A18).
- The Fold's inner-screen CSS viewport (A197 Q3).

## How work happens (since take 183)

- The clone at `~/apex-orv` is the workspace and the repo head is the
  truth. A take is one ordinary commit, `take N: …`, that CI builds; the
  commit hash is the seal. The procedure is CLAUDE.md, "How a take works
  here".
- Stages run one at a time, in the background, logged to
  `~/apex-logs/<stage>-t<N>.log` and polled to their exit line. Measured
  at take 183: pipeline 2,054 s, gate 385 s (HANDOFF, take 183).
- Push, tags, Play, signing and secrets only on the maintainer's explicit
  go; `t<N>` is tagged after CI is green.
- Still true from the sandbox years: kill by exact name, never by a
  pattern your own shell carries (landmine 204); stop a detached stage by
  the PID its log records (221); stubs on browser accessors need
  `Object.defineProperty` (216); nothing inside a `page.evaluate` may
  throw (217); do not re-split `www/` while a render runs; the gate
  buffers its output; two chats, one ledger — check the highest agenda
  and landmine numbers before assigning one.
- At this brief: take 186, agenda A217, landmine 221.

## Order (as of 2026-09-23)

1. **Tester field reports** as they arrive — each an agenda item, and in
   a take.
2. **A183** — the device check; take 186 is the Play candidate.
3. **V4 (A203)** — `docs/DESIGN-v4.md`; waits on the references; never
   ahead of A183.
4. **A189** — the "Road hazards" layer, designed at take 180; build after
   A183, on approval. How it ranks against V4 is the maintainer's call
   (not yet made).
5. **Production listing** when the tester round is clean.

Also open: A207 (CI's compute steps never skip), A201's fix, the Play
screenshots taken on the Fold.

## Standing rules

No invented features (reference material first — LANDMINES governs);
measurement before decisions; real progress bars, never timers; **nothing
downloads on its own**; design before build on anything large, with
explicit ruled-outs; every ready fix goes into the next take, each with
its own agenda item and HANDOFF paragraph (HANDOFF, take 185); audit
before sealing; card text literally honest; "Continue" delegates, "get
this right" means do not seal until every item is hit; the document is
the bug when it disagrees with the code.
