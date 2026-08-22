# Prompt for the v2 kickoff session (study only)

You're taking over APEX ORV — a free, offline-first Android trail-navigation
app for northeastern Lower Michigan ORV riding — at the moment v1 was declared
done (take 74, field-tested 41 PASS / 0 FAIL on-device). I'm Jacob; I work
entirely from a Samsung Galaxy Z Fold 7, no laptop, so everything ships
through chat and a GitHub Actions pipeline. Your predecessor built v1 across
74 sealed takes.

Attached is `apex-seed.zip` — the complete repository.

**This session is study only. Make no changes: no edits, no rebuilds, no
reseals, no "quick fixes," no matter how small or obvious.** Your job is to
load the project into your head and prepare for v2.

Read in this order:
1. `BUILD`, `README.md`
2. `docs/V1-STATE.md` — architecture, pipeline, CI, verification, numbers,
   open items
3. `docs/HANDOFF.md` — all 74 takes, newest first; the project's memory
4. `docs/LANDMINES.md` — 103 numbered process rules paid for in real
   failures. These are law. Pay particular attention to: verify a check can
   fail (54); read a feature's actual output before improving it; a failed
   assert silently drops the whole patch (99); a class label is not a name
   (101); check your own expectation before calling a mismatch (102); disk
   exhaustion masquerades as GPU/render failures, and the hog may live
   outside the project tree.
5. `docs/AGENDA.md` — the evidence ledger. Every claim is PROVEN, INFERRED,
   UNKNOWN, or explicitly Ruled out. Keep that discipline in everything you
   produce.
6. The code: `src/app.html` (the entire app), `tools/` (pipeline and
   harnesses — smoke.mjs, render.mjs, gate.py, mkapex.py), `ci/`
   (build.yml is the source of truth; the pasted workflow is generated from
   it; RELEASE.md is the release notes and test script).

Then produce, as documents only:

**A.** The architecture in your own words — data flow from sources (DNR, USFS
MVUM, OSM/Overpass with TIGER fallback, Census, DEM, imagery) to the phone,
and the seal + CI ritual.

**B.** The invariants you must never break: the keystore and signing facts,
offline-clean (zero remote requests), the honesty rules (refusal vs
near-address phrasing, dispatch wording, never presenting a class as a name),
the gate, the four-device layout matrix.

**C.** A prioritized v2 proposal list. Label every item PROVEN-need /
INFERRED / UNKNOWN. Start from the open agenda items — A18 ride telemetry,
A60 duplicate agency/OSM geometry (route both, draw one), trail-name density,
address coverage — then add what your own study surfaces.

**D.** Questions for me — only ones the repository cannot answer.

Ask before assuming; verify before claiming; when you and the data disagree,
establish which of you is wrong before acting. No changes yet — v2 starts
when I say so.
