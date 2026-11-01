
// ───────────────────────── the take-190 driver ─────────────────────────
const FIX190 = `
TAKE 190 ADDITIONS TO THE PLAN (the orchestrator, from take 189's seal): (1) Lane F also builds "a tapped pin stays in view when its card opens": take 189's final shot 09 showed a pin tapped in the upper part of the map slide above the view (y -136) because the drawer's slide resizes the map and resize() keeps the centre. When a card opens for a tapped map feature, ease the camera once so the tapped point sits inside the clear band above the drawer (a camera move of the app's own — A240's rule that only a rider's gesture folds a card must still hold), with a render read at 360x800 and 411x960 that taps a pin near the top and finds it inside the band after the card opens, and a planted control (the ease removed) that FAILS. (2) Take 189 left two Starts on the Ride tab with the drawer folded (#c-ride "Ride it" in the strip and #btn-ride "Ride"); Lane R's Ride card makes "Start riding" the only Start there (the maintainer's decision), and #btn-ride hides on the Ride tab.`

const AUDIT_FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      title: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
      where: { type: 'string' }, evidence: { type: 'string' }, scenario: { type: 'string' }, fix: { type: 'string' } },
      required: ['title', 'severity', 'where', 'evidence', 'scenario', 'fix'] } },
    checked_clean: { type: 'array', items: { type: 'string' } },
  },
  required: ['findings', 'checked_clean'],
}
const VERDICT = {
  type: 'object',
  properties: { refuted: { type: 'boolean' }, reason: { type: 'string' }, evidence: { type: 'string' }, severity_if_real: { type: 'string' } },
  required: ['refuted', 'reason', 'evidence', 'severity_if_real'],
}
const AREPORT = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['green', 'red'] }, summary: { type: 'string' }, commit: { type: 'string' },
    fixed: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, change: { type: 'string' }, guard: { type: 'string' }, mutant: { type: 'string' } }, required: ['title', 'change', 'guard', 'mutant'] } },
    rejected: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, why: { type: 'string' } }, required: ['title', 'why'] } },
    checks: { type: 'array', items: { type: 'string' } }, for_maintainer: { type: 'array', items: { type: 'string' } }, landmine_candidates: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'summary', 'commit', 'fixed', 'rejected', 'checks', 'for_maintainer', 'landmine_candidates'],
}
const SREPORT = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['green', 'red'] }, summary: { type: 'string' }, commit: { type: 'string' },
    numbers: { type: 'array', items: { type: 'string' } }, assigned: { type: 'array', items: { type: 'string' } },
    for_maintainer: { type: 'array', items: { type: 'string' } }, deferred: { type: 'array', items: { type: 'string' } }, problems: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'summary', 'commit', 'numbers', 'assigned', 'for_maintainer', 'deferred', 'problems'],
}
const CHECK = {
  type: 'object',
  properties: { blocking: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, where: { type: 'string' }, fix: { type: 'string' } }, required: ['issue', 'where', 'fix'] } }, verified: { type: 'array', items: { type: 'string' } } },
  required: ['blocking', 'verified'],
}
const LOCKCMD = `Chrome only under the lock: 'setsid nohup flock /tmp/apex-chrome.lock bash -c '"'"'echo "PID $$"; for i in $(seq 60); do [ "$(pgrep -x chrome | wc -l)" = 0 ] && break; sleep 1; done; [ "$(pgrep -x chrome | wc -l)" = 0 ] || { echo REFUSED; echo EXIT=99; exit; }; rm -rf /tmp/puppeteer_dev_chrome_profile-*; S=$(date +%s); <cmd>; E=$?; echo "DURATION_S=$(( $(date +%s)-S ))"; echo "EXIT=$E"'"'"' > <log> 2>&1 < /dev/null &', polled to its EXIT line; a fresh log name per launch; never pkill/killall by name — stop only by the PID the log records.`
const done = (ledger) => ledger.filter((l) => l && l.status === 'green').map((l) => l.step)
const pendingOf = (ledger) => ledger.flatMap((l) => (l && l.for_maintainer ? l.for_maintainer : [])).filter((x) => /^(PENDING|CUT):/.test(String(x)))

// 1 · record first
phase('Record')
const rec = await agent(`${CTX}
${FIX190}
YOU WRITE TAKE 190's RECORD-FIRST COMMIT in the MAIN tree ${R}: 'git branch --show-current' must say v6 and 'git status --porcelain' must be empty (else stop red). v6 = take 189's sealed tree (b8f0910; take 189 is PR #4, unmerged — take 190 stacks on it, the maintainer's word).
1. BUILD: OFFROAD_TAKE=190; the title in src/app.html "ORV · Take 190" (assert the anchor).
2. docs/HANDOFF.md: a new take-190 entry at the TOP in take 189's record-first style (read it): heading "## Take 190 — 2026-10-02 — V4's new screens: …" naming the items; a RECORDED FIRST paragraph — the maintainer approved the screens ("The take-190 screens are approved, continue", 2026-09-30) and, on 2026-10-02, answered the open questions (quote them from ${MNOTES}: Mark takes a fresh fix, 30 s then Try again, ease to zoom 11+; the compass floats during a ride; one Start on the Ride tab; Return home pinned at the sheet foot if the sheet would scroll; Data sources adds the Census Bureau and AWS Terrain Tiles; the stacking; the batch-approval rule for anything that would stop) and the build model (Lane F alone, then T, P, S, R in parallel; the lean review; the cold audit); one paragraph per agenda item ending "To measure."; "*SEAL and DEFERRED are written at the seal.*".
3. docs/AGENDA.md: new items from the NEXT FREE id (expected A247 — verify with 'python3 ${W}/gatefn.py check_ledgers'), in this order, each "· DESIGNED (the V4 mockup, artboard N) · BUILDING take 190" (or "· FOUND take 189 (final shots) · BUILDING take 190" for the new one), a body of what will be built, and a "- **Ruled out:**" line — take them from plan190.md section 5 as corrected by plan190-delta.md and the decisions: the sheet framework; the Plan index; the Machine picker; the fuel range stepper; Search as a sheet; Search's back/jump/address-arm defects; Loop from here; Saved; the Tools index; Diagnostics and About; Data sources (independence notice first, the linked sources plus the Census Bureau and AWS Terrain Tiles — §5's item 18 is DECIDED, not open); the compass in the sheet off a ride (it floats during one); HD imagery's three tiers; Mark this spot (fresh fix, 30 s, Try again, ease to 11+, Done/Undo, no silent overwrite); Turns; the Ride tab before a ride (one Start); the tour card; a tapped pin stays in view when its card opens. Then §5's item 19 candidates as two OPEN items (the place card's Save as waypoint silently replacing a same-named waypoint; HD progress shown as a frozen snapshot), each with its Ruled out line.
4. 'python3 tools/stamp.py'; SMOKE5 to its exit line; 'python3 ${W}/gatefn.py check_handoff check_stamps check_ledgers check_ledger_order check_agenda check_current check_scrub'; 'git status --porcelain', stage BY NAME, commit "wip 190 step 1: record first — take 190 stamps, HANDOFF entry, agenda A<first>–A<last>" ending with 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'. Write ${NOTES}/step-01-record.md mapping each agenda id to its lane (F, P, S, T or R) — every lane reads it. Return the ids in 'assigned' as "A<id> — <title> — lane <X>".`,
  { label: 'record:190', phase: 'Record', schema: SREPORT, effort: 'high' })
if (!rec || rec.status !== 'green') return { stopped: 'record-first', rec }

const setup = (ids) => agent(`You prepare git worktrees for take-190 lanes. Run exactly: 'cd ~ && git -C ${R} rev-parse --abbrev-ref HEAD' (must print v6) and 'git -C ${R} status --porcelain' (must be empty); then 'bash ${W}/lanes-setup.sh ${ids.join(' ')}' and print its output; then for each id 'git -C ${W}/wt/<id> log --oneline -1' and 'ls -la ${W}/wt/<id>/www'. Do nothing else. If a worktree already exists for an id, report it and do not recreate it. Return the output verbatim.`,
  { label: `setup:${ids.join('')}`, phase: 'Setup', effort: 'low' })

// 2 · Lane F alone
phase('Setup')
await setup(['F'])
const prior0 = [{ step: 'record', status: 'green', wip: rec.commit, summary: rec.summary }]
const runF = await runLanes(['F'], prior0)
if (!runF.merged.includes('F')) return { stopped: 'lane F not merged', ledger: runF.ledger, pending: pendingOf(runF.ledger) }

// 3 · T, P, S, R in parallel (merge order T, P, S, R)
phase('Setup')
await setup(['T', 'P', 'S', 'R'])
const runC = await runLanes(['T', 'P', 'S', 'R'], runF.ledger)
const ledger = runC.ledger

// 4 · the cold audit
const RO = `READ-ONLY: no edits, no commits, no SMOKE5/pipeline/render/gate/probe/Chrome. You may run git, grep, sed -n, node --check, node -e on extracted snippets, 'node tools/smoke.mjs' (from ${R}) and single gate checks ('cd ${R} && python3 ${W}/gatefn.py <check>'). Write nothing outside ${W}/audit/.`
const ACTX = `${CTX}
${FIX190}
YOU ARE PART OF THE END-OF-TAKE COLD AUDIT of take 190 in ${R} (branch v6). The take's diff: 'git diff b8f0910 v6' (b8f0910 = take 189's sealed tree); its commits: 'git log --oneline b8f0910..v6'. Lanes merged: ${done(ledger).join(', ')}. Lane notes: ${NOTES}/*.md. The approved artboards: ${MOCK}/project/*.dc.html. Agenda: the take-190 items in docs/AGENDA.md (BUILDING take 190).`
const ALENSES = [
  { key: 'legality', text: 'LEGALITY AND ROUTING: Loop from here, the Machine picker (a craft in a land mode, the legality filter per machine), Return home from every sheet, Turns/Ride it, Search hits as destinations, Mark this spot; nothing routes onto a non-ridable trail; check_class_legality.' },
  { key: 'honesty', text: 'HONESTY OF EVERY STATE: every new sheet\'s copy in each reachable state (no fix, a stale fix, riding, folded, another region, Water vs land modes, nothing saved, records in another region, HD tiers saved/unsaved/partial, Mark: getting a fix / no fix after 30 s / cancelled / done / undone, the tour\'s steps vs what is drawn, Data sources, About\'s take/region/date/hash). A sentence that is false in some reachable state is a finding.' },
  { key: 'guards', text: 'GUARDS AND HARNESS COVERAGE: every new or changed check in render.mjs, smoke.mjs, gate.py: does its planted control really fail? Checks retired with the chips (the devices A231/F19 reads, restcap, dc.open, destOk with n=0): replaced by checks that bind? SECTION_FLOOR raised, never lowered, every new check inside its own section\'s guard; the tap walker\'s ceilings and new flows; exact offender lists; check_icons (no unused key) and the manifest icon count.' },
  { key: 'hooks', text: 'HOOKS AND LOCKSTEP: ids/classes/data- attributes/strings the harness reads vs what src/app.html draws now; window.__sheet and other hooks; the smoke fake-DOM limits in new code (class first, no classList/closest/setAttribute/contains, hidden/disabled set from JS, grab() keeps listeners); check_stubs; ES5; built outputs (www/app.js, www/index.html, docs/PROVISION.md) current; TOURKEY/GUIDEKEY bumped once; docs (TESTING.md, README, DESIGN-v4.md, NEW-CHAT-BRIEF.md) vs the code.' },
  { key: 'states', text: 'STATE MACHINE AND BACK: the sheet state (data-sheet index/tool/body/card/search, SHEET, SHEET_ROWS) across tab switches, folds, show()/showQuiet(), a ride starting or stopping under an open sheet, the self-test and pan test, a first fix arriving under an open tool (A230\'s peek must update), back from every layer (tour, pickers, guide, search, tool, index, drawer) — trace each in the code; a state that strands the rider (no way back, a dead button, a hidden primary) is a finding. Plus performance: per-fix or per-frame work added, listeners or timers leaking across sheet opens.' },
  { key: 'ui', text: 'UI AGAINST THE APPROVED ARTBOARDS AND THE V4 RULES: compare the integration shots in ~/apex-shots/t190/ (Read the PNGs) with the artboards in ' + MOCK + '/project/: layout, one primary per screen, row anatomy, copy; tap targets 48/56 px with 8 px gaps, type floors, contrast, the 0.12 open floor and --sheet-cap, fits at 360x800, 411x960 and 749x832 (Return home visible or pinned at the foot), the compass floating while riding, one Start on the Ride tab, the tapped pin in view.' },
]
phase('Audit find')
const verified = await pipeline(ALENSES,
  (L) => agent(`${ACTX}
YOU ARE A COLD FINDER. Lens — ${L.text}
${RO}
Report only real defects (the concrete failing scenario and evidence); severity blocker = wrong/unsafe for a rider or a guard that cannot fail, major = a visible defect or a coverage loss, minor = cosmetic. Clean areas go in checked_clean. Items already listed for the maintainer as PENDING in ${W}/pending/ are not findings unless the built behaviour is wrong under every option.`,
    { label: `audit-find:${L.key}`, phase: 'Audit find', schema: AUDIT_FINDINGS, effort: 'high' }),
  (res, L) => parallel((res ? res.findings : []).map((f, i) => () =>
    parallel([0, 1].map((k) => () => agent(`${ACTX}
YOU ARE SKEPTIC ${k + 1} of 2. Try to REFUTE this cold-audit finding (lens ${L.key}); read the code and harness yourself and reproduce it if you can. ${k === 0 ? 'Focus: is the scenario reachable in the shipped app, and is the evidence accurate?' : 'Focus: is it handled elsewhere (another guard, another path, a documented decision of the maintainer), or is the proposed fix wrong?'}
${RO}
Finding: ${JSON.stringify(f)}
refuted=true only if you can show it is not a real defect; if real, say how severe and correct its fix if needed.`,
      { label: `audit-skeptic:${L.key}:${i + 1}:${k + 1}`, phase: 'Audit verify', schema: VERDICT, effort: 'high' })))
      .then((vs) => ({ ...f, lens: L.key, votes: vs.filter(Boolean), survives: vs.filter(Boolean).filter((v) => !v.refuted).length >= 1 })))),
)
const allF = verified.filter(Boolean).flat().filter(Boolean)
const confirmed = allF.filter((f) => f.survives)
log(`take-190 cold audit: ${allF.length} findings, ${confirmed.length} survive`)
phase('Audit fix')
let arep = null
const arounds = []
if (confirmed.length) {
  arep = await agent(`${ACTX}
YOU ARE THE AUDIT FIXER, the only writer, in the MAIN tree ${R} on v6 (clean first, else stop red). Fix every surviving finding (verify each first; a wrong one goes in rejected with evidence): ${JSON.stringify(confirmed)}
A fix that needs the maintainer follows the PENDING rule (prepare it under ${W}/pending/, do not cut, do not halt). Rules: anchors asserted, ES5, a guard + a WATCHED mutant per behavioural fix, never loosen a guard/floor/ceiling, new render checks inside their section's guard with the floor raised. ${LOCKCMD} Logs ~/apex-logs/<stage>-t190-audit-<what>-<n>.log; work files in ${W}/audfix/.
Verify: SMOKE5; the touched render sections with --only, then ONE FULL render and verify_palette under the lock; single gate checks (python3 ${W}/gatefn.py check_no_duplicate_defs check_stubs check_syntax check_tokens check_icons check_scale check_ledgers check_agenda check_handoff check_scrub check_offline check_current check_licences); stage BY NAME; commit 'wip 190 audit fixes: <list>' with the Co-Authored-By line. Write ${NOTES}/audit-fixes.md. Green only if SMOKE5, the full render and verify_palette passed on the committed tree.`,
    { label: 'audit-fix:r1', phase: 'Audit fix', schema: AREPORT, effort: 'high' })
  arounds.push(arep)
  for (let round = 1; round <= 2 && arep; round++) {
    const chk = await agent(`${ACTX}
YOU ARE THE ONE FIX-CHECKER (round ${round}), READ-ONLY. The fixer's report: ${JSON.stringify(arep)}
The findings it was given: ${JSON.stringify(confirmed.map((f) => ({ title: f.title, where: f.where, fix: f.fix })))}
For each: fixed correctly in the committed diff, or rightly rejected? Each guard's mutant real (read its log)? Anything the fixes broke? Return only what is still wrong or newly broken as blocking.
${RO}`, { label: `audit-check:r${round}`, phase: 'Audit fix', schema: CHECK, effort: 'high' })
    arounds.push({ check: chk })
    const open = chk ? chk.blocking : []
    if (!open.length || round === 2) break
    arep = await agent(`${ACTX}
YOU ARE THE AUDIT FIXER again (round ${round + 1}), the only writer, main tree ${R} on v6 (clean first). Still blocking: ${JSON.stringify(open)}
Same rules (anchors, ES5, guard + watched mutant, PENDING rule, never loosen). ${LOCKCMD} Verify: SMOKE5; the touched sections with --only, then one FULL render and verify_palette under the lock; the single gate checks; commit by name 'wip 190 audit fixes r${round + 1}: <list>' with the Co-Authored-By line. Update ${NOTES}/audit-fixes.md.`,
      { label: `audit-fix:r${round + 1}`, phase: 'Audit fix', schema: AREPORT, effort: 'high' })
    arounds.push(arep)
  }
}

// 5 · pending batch, or the seal
phase('Seal')
const pend = pendingOf(ledger).concat(arounds.flatMap((r) => (r && r.for_maintainer ? r.for_maintainer : [])).filter((x) => /^(PENDING|CUT):/.test(String(x))))
const brief = await agent(`You check for take-190 pieces waiting on the maintainer. List ${W}/pending/ ('ls -la ${W}/pending/'; read every .md and check every .patch applies cleanly to the main tree with 'git -C ${R} apply --check <patch>' — read-only). Reported by the lanes and the audit: ${JSON.stringify(pend)}
If there is nothing pending: return the text "NONE". Otherwise write ${W}/pending/BRIEF.md — one decision brief for the maintainer to approve in one sitting: per item a short title, the question, 2–3 options with the recommended one first, the evidence (numbers labelled PROVEN/INFERRED), and whether a ready patch exists (path, applies cleanly yes/no). Keep it short and plain. Return the brief's text.`,
  { label: 'pending:brief', phase: 'Seal', effort: 'high' })
const hasPending = brief && String(brief).trim() !== 'NONE'
if (hasPending) return { stopped: 'pending maintainer approval', brief, ledger, audit: { found: allF.length, confirmed: confirmed.length, rounds: arounds } }

const srec = await agent(`${CTX}
YOU WRITE THE TAKE-190 SEAL RECORDS (the only writer) in ${R} on v6 (clean first). Sources: ${NOTES}/*.md (every lane, merge, integrate, audit-fixes), the logs they cite, ${MNOTES}, plan190.md and plan190-delta.md. Match take 189's records (read its HANDOFF entry, AGENDA A227–A246, LANDMINES 236–247): every number labelled PROVEN/INFERRED/UNKNOWN; "the maintainer", no name, no coordinates.
1. HANDOFF take-190 entry: the heading naming what was built; keep RECORDED FIRST; each item's "To measure." replaced by what changed, measured, ruled out, what went wrong, its audit corrections; a cold-audit section; "What I got wrong"; the maintainer's open decisions with defaults; the line "SEAL: written after the gate and the clean run."; DEFERRED.
2. AGENDA: each take-190 item → "BUILT take 190" with a "Built, take 190:" bullet and "Corrected (the cold audit, Fn):" bullets; anything found and not fixed → new OPEN items (next free ids) with Ruled out lines; no gaps.
3. LANDMINES from the next free number, one per distinct lesson that bit (cite existing ones instead of repeating), with §0 rows.
4. DESIGN-v4.md §12 (take 190 built; what V4 still owes: the Fold session and one polish take); NEW-CHAT-BRIEF.md (take 190 built, next numbers); TESTING.md and README.md for every flow that changed (the tabs as sheets, Search, Mark, the Ride card, the tour).
5. 'python3 tools/stamp.py'; SMOKE5; 'python3 ${W}/gatefn.py check_handoff check_stamps check_ledgers check_ledger_order check_agenda check_scrub check_current check_no_duplicate_defs'; stage by name; commit "wip 190 seal: records" with the Co-Authored-By line.`,
  { label: 'seal:records', phase: 'Seal', schema: SREPORT, effort: 'high' })
const srv = await agent(`${CTX}
YOU ARE THE COLD RECORDS REVIEWER, READ-ONLY. The writer's report: ${JSON.stringify(srec)}
Check every claim in 'git show ${srec && srec.commit ? srec.commit : 'HEAD'}' against the notes, logs and code: numbers right and labelled, statuses true, audit fixes attributed, landmines real and not duplicates, ids without gaps (python3 ${W}/gatefn.py check_handoff check_ledgers check_ledger_order check_agenda check_stamps), the maintainer's words quoted exactly, no name or coordinates. Blocking = a false or unlabelled claim, a wrong status, a ledger defect, a missing record.`,
  { label: 'seal:review', phase: 'Seal', schema: CHECK, effort: 'high' })
if (srv && srv.blocking.length) await agent(`${CTX}
YOU FIX THE RECORDS (the only writer) in ${R} on v6. Blocking findings (verify each): ${JSON.stringify(srv.blocking)}
Then stamp.py, the same single gate checks, stage by name, commit "wip 190 seal: records review" with the Co-Authored-By line.`,
  { label: 'seal:records-fix', phase: 'Seal', schema: SREPORT, effort: 'high' })
const sver = await agent(`${CTX}
YOU RUN TAKE 190's SEAL VERIFICATION on the committed v6 head ('git status --porcelain' empty, else stop red). ${LOCKCMD} Logs ~/apex-logs/<stage>-t190-seal-<what>-<n>.log. Check 'df -h /' first.
1. 'ANDROID_HOME=$HOME/Android/Sdk JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 PIP_BREAK_SYSTEM_PACKAGES=1 bash ci/apk.sh' (no Chrome; background, to its exit line): versionCode/versionName, android_check. Never print or change the keystore or secrets.
2. The FULL gate under the lock ('python3 tools/gate.py') to GATE PASSED/FAILED. If it fails: find the cause (landmine 54), fix in v6 by name ('wip 190 seal: gate fix: …'), run again with a new log. Never loosen a guard.
3. The PROTOCOL §6b clean run if any pipeline tool changed in 'git diff b8f0910 v6 -- tools/' (render.mjs, smoke.mjs, gate.py, manifest.py and the like count): 'rm -rf ~/apex-clean-t190 && mkdir ~/apex-clean-t190 && git -C ${R} archive HEAD | tar -x -C ~/apex-clean-t190'; 'npm ci --no-audit --no-fund'; 'APEX_PHOTO_BUDGET_S=0 python3 tools/pipeline.py' under the lock (expected to stop at render for the missing www/vendor, landmine 215); fetch www/vendor exactly as ci/bundle.sh does; render, verify_palette and gate in the clean dir under the lock. A USGS gauge outage there is A245's known case: rerun gauges/bundle/build_app/smoke once it answers. Compare www/app.js md5 with ${R}'s; no symlinks into ${R}.
4. Final shots from the sealed tree into ~/apex-shots/t190/final/ under the lock at 411x960, 360x800 and 749x832: the Plan sheet, Search, Loop, Saved, Machine, Turns, the Tools sheet, Compass (off a ride, and floating while riding), HD, Mark (getting a fix, done), Diagnostics, Data sources, the Ride tab before a ride, the tour card, a tapped pin in view — each beside its artboard name; look at every one; 0 remote requests; captions in README.txt.
5. The SEAL paragraph into the take-190 HANDOFF entry (gate, apk, clean run, shots folder, render time for N checks), stamp.py, single gate checks, commit "wip 190 seal: SEAL" with the Co-Authored-By line.
Green only if the gate PASSED on the committed tree, ci/apk.sh succeeded and the clean run's gate PASSED (or no clean run was owed); every number in 'numbers'.`,
  { label: 'seal:verify', phase: 'Seal', schema: SREPORT, effort: 'high' })
return { sealed: sver ? sver.status : 'red', ledger, audit: { found: allF.length, confirmed: confirmed.length, rounds: arounds }, records: srec, review: srv, verify: sver }
