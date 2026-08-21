#!/usr/bin/env python3
"""Gate. Not advisory — if it fails, nothing ships.

Every check here corresponds to a mistake someone actually made. Discipline that
depends on remembering is not a control; this is.

  python3 tools/gate.py        exit 0 = pass, 1 = fail
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
fails, notes = [], []


def read(*p):
    fp = os.path.join(ROOT, *p)
    return open(fp, encoding="utf-8").read() if os.path.exists(fp) else None


def take():
    b = read("BUILD")
    m = re.search(r"OFFROAD_TAKE=(\d+)", b) if b else None
    return int(m.group(1)) if m else None


# ── 1. HANDOFF currency ─────────────────────────────────────────────────────
# The take-155 failure: nineteen builds shipped with no record. No entry, no ship.
def check_handoff():
    t, h = take(), read("docs", "HANDOFF.md")
    if t is None:
        return fails.append("BUILD missing or has no OFFROAD_TAKE")
    if h is None:
        return fails.append("docs/HANDOFF.md missing")
    heads = re.findall(r"^## Takes? (\d+)(?:\s*[-\u2013]\s*(\d+))?", h, re.M)
    if not heads:
        return fails.append("HANDOFF.md has no '## Take N' headings")
    newest = max(int(b) if b else int(a) for a, b in heads)
    if newest < t:
        return fails.append(
            f"HANDOFF documents up to take {newest} but BUILD is take {t}. "
            f"Write the entry BEFORE shipping (PROTOCOL §6).")
    title = re.search(r"^# HANDOFF — through Take (\d+)", h, re.M)
    if not title or int(title.group(1)) < t:
        return fails.append(f"HANDOFF title line is behind take {t}")
    notes.append(f"handoff current at take {t}")


# ── 2. Doc stamps agree ─────────────────────────────────────────────────────
def check_stamps():
    t = take()
    for name, pat in (("ROADMAP.md", r"Current as of take (\d+)"),
                      ("LANDMINES.md", r"Current as of take (\d+)"),
                      ("AGENDA.md", r"Current as of take (\d+)"),
                      ("PROTOCOL.md", r"take (\d+)")):
        s = read("docs", name)
        if s is None:
            fails.append(f"docs/{name} missing")
            continue
        m = re.search(pat, s)
        if not m:
            fails.append(f"docs/{name} has no take stamp")
        elif int(m.group(1)) < t:
            fails.append(f"docs/{name} stamped take {m.group(1)}, BUILD is {t}")
    if not fails:
        notes.append("doc stamps agree")


# ── 3. Offline integrity ────────────────────────────────────────────────────
# PROTOCOL §8. One CDN reference passes every test on wifi and dies in the woods.
ALLOW = re.compile(r"openstreetmap\.org|maplibre\.org|github\.com/maplibre")


def check_offline():
    www = os.path.join(ROOT, "www")
    if not os.path.isdir(www):
        return notes.append("no www/ to scan")
    hits = []
    for fn in sorted(os.listdir(www)):
        if not fn.endswith((".html", ".js", ".css")):
            continue
        for i, line in enumerate(read("www", fn).splitlines(), 1):
            for url in re.findall(r"https?://[^\s\"'<>)]+", line):
                if ALLOW.search(url):
                    continue          # attribution and licence text only
                hits.append(f"{fn}:{i} {url[:70]}")
    if hits:
        fails.append("remote origins in shipped assets (PROTOCOL §8):\n      "
                     + "\n      ".join(hits[:8]))
    else:
        notes.append("offline: no remote origins in www/")


# ── 4. Style integrity ──────────────────────────────────────────────────────
# A layer pointing at a source that isn't declared renders nothing, silently.
def check_style():
    """Fonts and glyphs. The style lives in src/app.html now, not style.json."""
    src = read("src", "app.html")
    if src:
        fonts = set(re.findall(r"'text-font':\s*\['([^']+)'\]", src))
        packs = read("tools", "glyphs.py") or ""
        if fonts and "glyphs:GLYPH_URL" not in src.replace(" ", ""):
            fails.append("app declares text-font but no glyphs URL — "
                         "text renders as nothing, silently (landmine 4)")
        for f in sorted(fonts):
            if f'"{f}"' not in packs:
                fails.append(f"font '{f}' is used but not built by "
                             f"tools/glyphs.py (landmine 30)")
        if fonts:
            notes.append(f"fonts: {', '.join(sorted(fonts))} — all built")
    s = read("www", "style.json")
    if s is None:
        return
    try:
        st = json.loads(s)
    except Exception as e:
        return fails.append(f"style.json not parseable: {e}")
    srcs = set(st.get("sources", {}))
    for lyr in st.get("layers", []):
        if lyr.get("type") == "background":
            continue
        if lyr.get("source") not in srcs:
            fails.append(f"style layer '{lyr.get('id')}' -> unknown source "
                         f"'{lyr.get('source')}'")
    syms = [l for l in st.get("layers", []) if l.get("type") == "symbol"]
    if syms and not st.get("glyphs"):
        fails.append(f"style has {len(syms)} symbol layer(s) but no glyphs URL — "
                     "text renders as nothing, silently (landmine 4)")
    # every text-font named must be a stack we actually ship
    packs = read("tools", "glyphs.py")
    for l in syms:
        for f in (l.get("layout") or {}).get("text-font") or []:
            if packs and f'"{f}"' not in packs and f"'{f}'" not in packs:
                fails.append(f"layer '{l.get('id')}' wants font '{f}' — "
                             "not built by tools/glyphs.py (landmine 30)")
    notes.append(f"style: {len(st.get('layers', []))} layers, {len(srcs)} sources, "
                 f"{len(syms)} symbol")


# ── 5. AGENDA discipline ────────────────────────────────────────────────────
# Items without a ruled-out line get re-derived from scratch every session.
def check_agenda():
    a = read("docs", "AGENDA.md")
    if a is None:
        return
    blocks = re.split(r"^## ", a, flags=re.M)[1:]
    bad = [b.splitlines()[0].strip() for b in blocks
           if "Ruled out:" not in b and "ruled out:" not in b.lower()]
    if bad:
        fails.append("AGENDA items with no 'Ruled out:' line: " + "; ".join(bad))
    else:
        notes.append(f"agenda: {len(blocks)} items, all carry ruled-out evidence")


# ── 6. Inline script syntax ─────────────────────────────────────────────────
# Landmine 27: a double-escaped quote in a patched template terminates the string
# and kills every line after it. The page still renders. Nothing says why.
def check_syntax():
    import subprocess, shutil, tempfile
    if not shutil.which("node"):
        return notes.append("node absent, inline syntax unchecked")
    www = os.path.join(ROOT, "www")
    if not os.path.isdir(www):
        return
    n = 0
    for fn in sorted(os.listdir(www)):
        if not fn.endswith((".js", ".html")):
            continue
        src = read("www", fn)
        if fn.endswith(".html"):
            # EVERY bare inline block, not "last open tag to last close tag" —
            # that slice swallowed the following <script src> and reported a
            # syntax error in a correct file (take 21, landmine 39 again).
            blocks = re.findall(r"<script>(.*?)</script>", src, re.S)
            if not blocks:
                continue
            src = "\n;\n".join(blocks)
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
            f.write("var WATER={l:{}},GR={jx:{},cls:[],nm:[],bk:[],b:[],n:[],e:[],g:[]};\n")
            f.write(src)
            tmp = f.name
        r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
        os.unlink(tmp)
        if r.returncode:
            first = [l for l in r.stderr.splitlines() if "Error" in l]
            fails.append(f"{fn} inline script does not parse: "
                         f"{(first[0] if first else r.stderr)[:90]}")
        else:
            n += 1
    if n:
        notes.append(f"inline syntax ok ({n} file{'s' if n > 1 else ''})")


# ── 6b. Provisioning manifest ───────────────────────────────────────────────
# PROTOCOL §8: provisioning may use the network, the field may not. What makes
# that safe is that every host is declared -- an undeclared fetch is the one that
# works on the bench with wifi on.
def check_provision():
    import importlib.util
    mp = os.path.join(HERE, "manifest.py")
    if not os.path.exists(mp):
        return fails.append("tools/manifest.py missing — PROTOCOL §8 undeclared")
    spec = importlib.util.spec_from_file_location("_mf", mp)
    m = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(m)
    except Exception as e:
        return fails.append(f"manifest.py will not load: {e}")
    found, declared = m.scan_hosts(), m.declared_hosts()
    undeclared = sorted(h for h in found if h not in declared)
    if undeclared:
        fails.append("undeclared provisioning hosts (PROTOCOL §8): " +
                     ", ".join(f"{h} in {sorted(found[h])[0]}" for h in undeclared))
    if not os.path.exists(os.path.join(ROOT, "docs", "PROVISION.md")):
        fails.append("docs/PROVISION.md missing — run tools/manifest.py")
    # A source declared but never reached means a pipeline step disappeared.
    # This exact signal showed up at take 12 (hosts fell 6 -> 5) and was read
    # past; take 13 found the cause was a silently reverted fetch. Now it fails.
    unused = sorted(declared - set(found))
    if unused:
        fails.append("declared but never reached: " + ", ".join(unused) +
                     " — a pipeline step has gone missing (landmine 32)")
    if not undeclared and not unused:
        notes.append(f"provisioning: {len(found)} hosts, all declared and reached")


# ── 6b1. The shipped app must EXECUTE, not just parse ────────────────────────
# Take 15: the first actual execution of www/app.js found labels dead since
# take 9 and all Phase-4 distance maths dead since take 7 — bugs the syntax
# check and the Python mirror-verifiers structurally could not see.
def check_smoke():
    import shutil, subprocess
    sm = os.path.join(HERE, "smoke.mjs")
    if not os.path.exists(sm):
        return fails.append("tools/smoke.mjs missing — the shipped app is "
                            "never executed before shipping")
    if not shutil.which("node"):
        return notes.append("node absent, smoke not run")
    if not os.path.exists(os.path.join(ROOT, "www", "bundle", "manifest.json")):
        return notes.append("no built bundle in www/ — smoke deferred to pipeline")
    total, bad = 0, []
    for mode in ([], ["--no-gps"], ["--fatal-drill"], ["--dead-renderer"], ["--away"]):
        r = subprocess.run(["node", sm] + mode, capture_output=True, text=True,
                           timeout=240)
        total += sum(1 for l in r.stdout.splitlines() if l.startswith("  ok"))
        if r.returncode:
            hit = [l for l in r.stdout.splitlines() if "FAIL" in l][:2]
            bad.append((mode and mode[0] or "gps") + ": " +
                       ("; ".join(hit) or r.stderr.splitlines()[-1][:80]))
    if bad:
        fails.append("smoke failed — " + " | ".join(bad))
    else:
        notes.append(f"smoke: 5 modes executed, {total} assertions green")


# ── 6b1a. The harness must model every API the app calls ────────────────────
# Six times now a stub has omitted a method the app uses. Twice it HID a feature
# (marker taps, take 33) and four times it INVENTED a failure the app did not
# have (getElement, scrollIntoView, getContainer, the two queryRenderedFeatures
# contracts). Every one was found by a person tapping a phone, which is the most
# expensive way to find anything. This check is static and costs nothing.
def check_stubs():
    app = read("www", "app.js")
    smoke = read("tools", "smoke.mjs")
    if not app or not smoke:
        return notes.append("no built app or harness — stub check skipped")
    gaps = []

    # MapLibre surface: every map.X( the app calls must exist on MapStub
    used = set(re.findall(r"\bmap\.([a-zA-Z_]\w*)\s*\(", app))
    body = smoke[smoke.index("class MapStub"):smoke.index("let theMap")]
    have = set(re.findall(r"^\s{2}([a-zA-Z_]\w*)\s*\(", body, re.M))
    have |= set(re.findall(r"^\s{2}([a-zA-Z_]\w*)\s*=", body, re.M))
    gaps += [f"MapStub.{m}()" for m in sorted(used - have)]

    # Marker surface
    mk = re.search(r"Marker: class \{(.*?)\n  \},", smoke, re.S)
    mkhave = set(re.findall(r"([a-zA-Z_]\w*)\s*\(", mk.group(1))) if mk else set()
    for m in sorted(set(re.findall(r"\b(?:hM|mM|tM|dropM|youM)\.([a-zA-Z_]\w*)\s*\(", app))):
        if m not in mkhave:
            gaps.append(f"Marker.{m}()")

    # DOM methods the app calls on elements it got from el()/createElement
    el_body = smoke[smoke.index("class El"):smoke.index("const byId")]
    elhave = set(re.findall(r"^\s{2}(?:get |set )?([a-zA-Z_]\w*)\s*[(=]", el_body, re.M))
    DOM = {"scrollIntoView", "focus", "getBoundingClientRect", "addEventListener",
           "remove", "click", "appendChild", "removeAttribute", "setAttribute",
           "blur", "select", "closest", "contains"}
    for m in sorted(DOM):
        if re.search(r"\.%s\s*\(" % m, app) and m not in elhave:
            gaps.append(f"El.{m}()")

    if gaps:
        fails.append("harness stubs are missing APIs the app calls: "
                     + ", ".join(gaps[:8]))
    else:
        notes.append(f"stubs cover the app's API surface "
                     f"({len(used)} map calls, {len(elhave)} El members)")


# ── 6b1a2. Every source must have a layer that draws it ─────────────────────
# Take 43: `alt` (dimmed alternates, take 35) and `approach` (dashed off-network
# legs, take 39) were both created, fed data, and never drawn — my patches
# anchored on a layer id that does not exist ('route-line' vs 'routeline'), so
# the insertions silently no-matched. Every check I had written measured
# setData, which is the DATA, not the DRAWING. Two shipped features were
# invisible for eight takes.
def check_orphan_sources():
    a = read("www", "app.js")
    if not a or "sources:{" not in a:
        return notes.append("no built app — source/layer check skipped")
    i = a.index("sources:{")
    j = a.index("layers:[", i)
    # a source may be declared conditionally — `sat:TILES?{type:'raster'...}` —
    # so match the NAME at this indent, not the shape that follows it
    srcs = set(re.findall(r"^\s{4}([a-z]+):(?=\s*[\{A-Za-z])", a[i:j], re.M))
    lays = set(re.findall(r"source:'([a-z]+)'", a[j:]))
    orphan = sorted(srcs - lays)
    ghost = sorted(lays - srcs)
    if orphan:
        fails.append("sources with no layer to draw them: " + ", ".join(orphan))
    elif ghost:
        fails.append("layers referencing sources that do not exist: " + ", ".join(ghost))
    else:
        notes.append(f"style: {len(srcs)} sources, every one drawn by a layer")


# ── 6b1a1. No tool may depend on a path outside the repo ────────────────────
# Twice now a tool has worked here and died on a clean machine because it
# referenced an absolute path that only existed in my sandbox: emit_graph.py
# importing /home/claude/pack.py (take 45), and glyphs.py loading a typeface
# from /mnt/skills/... (take 51, found by the first real CI run). Anything a
# build needs must be IN the repo.
def check_absolute_paths():
    bad = []
    for fn in sorted(os.listdir(HERE)):
        if not fn.endswith((".py", ".mjs")) or fn == "gate.py":
            continue
        txt = open(os.path.join(HERE, fn), encoding="utf-8").read()
        for m in re.finditer(r"['\"](/(?:mnt|home|opt|usr|Users)/[^'\"]*)['\"]", txt):
            path = m.group(1)
            # /mnt/user-data/outputs is where deliverables are published, and
            # /usr/bin shebang-ish references are fine; the danger is INPUTS.
            if path.startswith("/mnt/user-data/outputs"):
                continue
            bad.append(f"{fn}: {path}")
    if bad:
        fails.append("tools reference paths outside the repo — they will not "
                     "exist on a clean runner: " + "; ".join(bad[:4]))
    else:
        notes.append("no tool depends on a path outside the repo")


# ── 6b1a2b. Workflows must be valid YAML *by GitHub's rules* ────────────────
# PyYAML's safe_load silently keeps the LAST of duplicate keys. build.yml carried
# two `concurrency:` blocks from take 20 to take 49 and passed every gate run,
# while GitHub would have rejected the file outright as "Invalid workflow file".
# CI had never actually been valid; we only ever ran the pipeline locally.
def check_workflow_yaml():
    dirs = [os.path.join(ROOT, ".github", "workflows"), os.path.join(ROOT, "ci")]
    dirs = [x for x in dirs if os.path.isdir(x)]
    if not dirs:
        return notes.append("no workflows yet (added at setup)")
    try:
        import yaml
    except ImportError:
        return notes.append("pyyaml absent — workflow validation skipped")

    class NoDup(yaml.SafeLoader):
        pass

    def _nodup(loader, node, deep=False):
        out = {}
        for k, v in node.value:
            key = loader.construct_object(k, deep=deep)
            if key in out:
                raise ValueError(f"duplicate key {key!r}")
            out[key] = loader.construct_object(v, deep=deep)
        return out

    NoDup.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _nodup)
    seen = 0
    for d in dirs:
      for fn in sorted(os.listdir(d)):
        if not fn.endswith((".yml", ".yaml")):
            continue
        seen += 1
        try:
            doc = yaml.load(open(os.path.join(d, fn)), Loader=NoDup)
        except Exception as e:
            fails.append(f"{os.path.basename(d)}/{fn} is not a valid workflow: {e}")
            continue
        if not isinstance(doc, dict) or "jobs" not in doc:
            fails.append(f"{os.path.basename(d)}/{fn} has no jobs")
    if seen and not any("is not a valid workflow" in f for f in fails):
        notes.append(f"workflows: {seen} file(s), valid YAML with no duplicate keys")


# ── 6b1a3. Every class in the graph must be legal for SOME machine ───────────
# The safety invariant. Non-ORV routes (hiking, equestrian, snowmobile, NFS
# non-motorised) are shown so the map is honest about what exists, and they must
# NEVER enter the routing graph — seeing a trail and being allowed to ride it are
# different facts. Two hand-maintained lists that must agree is exactly the shape
# of mistake that ships a footpath as a dirt-bike route, so this checks the BUILT
# data rather than the source.
def check_class_legality():
    import glob
    ok_classes = set()
    a = read("src", "app.html") or ""
    for m in re.finditer(r"ok:\[([^\]]*)\]", a):
        ok_classes |= set(re.findall(r"'([a-z0-9]+)'", m.group(1)))
    if not ok_classes:
        return fails.append("could not read MACHINE allow-lists from src/app.html")
    CLOSED = {"closed", "fsclosed"}
    seen = 0
    for gp in sorted(glob.glob(os.path.join(ROOT, "bundles", "*", "graph.json"))):
        seen += 1
        cls = set(json.load(open(gp)).get("cls", []))
        illegal = sorted(cls - ok_classes - CLOSED)
        if illegal:
            fails.append(f"{os.path.basename(os.path.dirname(gp))}: routing graph "
                         f"contains classes no machine may ride: {illegal} — a "
                         f"rider could be routed onto one")
        op = os.path.join(os.path.dirname(gp), "other.json")
        if os.path.exists(op):
            show = set(json.load(open(op)).get("cls", []))
            leaked = sorted(show & ok_classes)
            if leaked:
                fails.append(f"show-only classes also marked ridable: {leaked}")
    if seen and not any("routing graph contains" in f for f in fails):
        notes.append(f"class legality: every class in {seen} graph(s) is ridable "
                     f"by some machine or explicitly closed")


# ── 6b1a4. Workflow step references must resolve ────────────────────────────
# `${{ steps.pkg.outputs.apk }}` with no step declaring `id: pkg` resolves to an
# EMPTY STRING — GitHub does not error, it substitutes nothing. The release
# would have been published with no APK attached, and nothing in CI would have
# said so (landmine 78). Same class as an orphan source: a reference with no
# referent, silently.
def check_workflow_refs():
    import glob
    wfd = os.path.join(ROOT, ".github", "workflows")
    if not os.path.isdir(wfd):
        return notes.append("no workflows to check")
    bad, seen = [], 0
    for fp in sorted(glob.glob(os.path.join(wfd, "*.y*ml"))):
        txt = open(fp).read()
        seen += 1
        # `- id: deploy` and `  id: pkg` are both valid; the first form was
        # missed and reported a false failure on a healthy workflow (landmine 54).
        ids = set(re.findall(r"^\s*-?\s*id:\s*([A-Za-z0-9_-]+)", txt, re.M))
        for sid, out in set(re.findall(r"steps\.([A-Za-z0-9_-]+)\.outputs\.([A-Za-z0-9_-]+)", txt)):
            if sid not in ids:
                bad.append(f"{os.path.basename(fp)}: steps.{sid}.outputs.{out} "
                           f"— no step has id '{sid}'")
            # Whether the output is actually WRITTEN is only knowable for
            # `run:` steps — a third-party action declares its own outputs
            # (actions/deploy-pages emits page_url). Checking the id is the part
            # that is both checkable and the part that silently broke.
    if bad:
        fails.extend(bad)
    else:
        notes.append(f"workflow refs: every steps.*.outputs.* in {seen} file(s) resolves")


# ── 6b1b. The app must actually RENDER ──────────────────────────────────────
# Take 23: an invalid style expression made MapLibre reject the whole style, so
# ZERO layers drew from take 9 to take 22 while smoke reported green. A stubbed
# renderer can never see this; only a real engine can (landmines 51, 52).
def check_render():
    import shutil, subprocess
    rm = os.path.join(HERE, "render.mjs")
    if not os.path.exists(rm):
        return fails.append("tools/render.mjs missing — nothing renders the app")
    if not shutil.which("node"):
        return notes.append("node absent, render not run")
    if not os.path.exists(os.path.join(ROOT, "www", "bundle", "manifest.json")):
        return notes.append("no built bundle in www/ — render deferred to pipeline")
    chrome = os.path.join(os.path.expanduser("~"), ".cache", "puppeteer")
    if not os.path.isdir(chrome):
        msg = ("chrome absent — cannot verify the map renders "
               "(npx puppeteer browsers install chrome)")
        # In CI this is a failure: a skipped render check is exactly how a map
        # that drew nothing passed two audits (landmine 53).
        if os.environ.get("CI"):
            return fails.append(msg)
        return notes.append(msg + " [local skip]")
    r = subprocess.run(["node", rm], capture_output=True, text=True, timeout=300)
    if r.returncode:
        bad = [l.strip() for l in r.stdout.splitlines() if "FAIL" in l][:2]
        fails.append("render failed: " + ("; ".join(bad) or r.stderr[-120:]))
    else:
        n = sum(1 for l in r.stdout.splitlines() if l.strip().startswith("ok"))
        notes.append(f"render: real browser drew the map, {n} checks green")


# ── 6b2. The repo must build the app it claims to ────────────────────────────
# Take 12: www/ still held the take-2 spike while eleven takes of work lived only
# in standalone HTML. CI would have produced an APK of the spike. Nothing caught
# it because every check looked at whether files existed, never at whether they
# were current.
def check_current():
    src = read("src", "app.html")
    if src is None:
        return fails.append("src/app.html missing — no app source of truth")
    t = take()
    if t is not None and f"Take {t}" not in src:
        fails.append(f"src/app.html does not say 'Take {t}' — the repo is "
                     f"building an older app than it documents")
    if not os.path.exists(os.path.join(HERE, "build_app.py")):
        return fails.append("tools/build_app.py missing — www/ cannot be regenerated")
    # Read EVERY workflow, not a hardcoded filename. The single-file installer
    # (apex.yml) merges seed + build so a phone can drop one file into an empty
    # repo; the gate was looking for build.yml, found nothing, and failed three
    # checks on a perfectly good seed (take 48).
    wf = ""
    for _d in (os.path.join(ROOT, ".github", "workflows"), os.path.join(ROOT, "ci")):
        if not os.path.isdir(_d):
            continue
        for _f in sorted(os.listdir(_d)):
            if _f.endswith((".yml", ".yaml")):
                wf += open(os.path.join(_d, _f)).read() + "\n"
    if "maplibre-gl-csp-worker.js" not in wf:
        fails.append("workflow does not vendor the CSP worker — the APK will "
                     "render nothing (landmine 47)")
    if "tools/android.py" not in wf:
        fails.append("workflow apk job does not call tools/android.py — CI and "
                     "the proven build have diverged (landmine 40)")
    wa = read("www", "app.js")
    if wa is None:
        return notes.append("www/ not built yet (CI generates it)")
    # www/ is what cap sync packages into the APK. src/ saying "Take 45" while
    # www/ still says 44 ships a stale app under a current version stamp — take
    # 45 did exactly that and this gate passed it. Landmine 35: "exists" is not
    # "current", and the artifact that matters is the built one.
    # The take stamp lives in the TITLE, which build_app writes into
    # www/index.html — app.js only mentions takes in comments, so checking it
    # matched "Take 14" from a landmine note and reported a stale build on a
    # current tree. Verify the check before believing it (landmine 54).
    wi = read("www", "index.html") or ""
    _m = re.search(r"ORV · Take (\d+)", wi)
    if t is not None and wi and (not _m or int(_m.group(1)) != t):
        fails.append(f"www/index.html says Take {_m.group(1) if _m else '?'} but "
                     f"BUILD says {t} — run tools/build_app.py before packaging. "
                     f"www/ is what cap sync puts in the APK.")
    if "bundle/manifest.json" not in wa:
        fails.append("www/app.js does not read a bundle manifest — it is stale "
                     "output from a previous shape of the app")
    # loader REQ kinds must match what bundle.py actually emits
    ba = read("tools", "bundle.py") or ""
    kinds = set(re.findall(r'"[\w.\-]+",\s*"[\w.\-]+",\s*"(\w+)"', ba))
    req = set(re.findall(r"var REQ=\{([^}]*)\}", wa))
    if req:
        want = set(re.findall(r"(\w+):1", req.pop()))
        bad = want - kinds
        if bad:
            fails.append(f"loader requires kinds {sorted(bad)} that bundle.py "
                         f"never emits — every region would be refused")
        else:
            notes.append(f"app current at take {t}, loader kinds match bundle.py")


# ── 6c. Bundle integrity model ──────────────────────────────────────────────
# Landmine 34: a half-downloaded region is a safety problem. Every artifact must
# declare whether it is REQUIRED, and any bundle on disk must verify.
def check_bundles():
    import importlib.util
    bp = os.path.join(HERE, "bundle.py")
    if not os.path.exists(bp):
        return fails.append("tools/bundle.py missing — no provisioning integrity model")
    spec = importlib.util.spec_from_file_location("_bd", bp)
    m = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(m)
    except Exception as e:
        return fails.append(f"bundle.py will not load: {e}")
    if not any(a[3] for a in m.ARTIFACTS):
        fails.append("no bundle artifact is marked REQUIRED — "
                     "every region would verify as usable (landmine 34)")
    bd = os.path.join(ROOT, "bundles")
    built = 0
    if os.path.isdir(bd):
        for rid in sorted(os.listdir(bd)):
            if not os.path.isdir(os.path.join(bd, rid)):
                continue
            state, bad, absent = m.verify(rid)
            built += 1
            if state == "unusable":
                fails.append(f"bundle {rid} UNUSABLE: {'; '.join(bad)}")
            elif absent:
                notes.append(f"bundle {rid} partial, absent: {', '.join(absent)}")
    req = sum(1 for a in m.ARTIFACTS if a[3])
    notes.append(f"bundles: {len(m.ARTIFACTS)} artifacts ({req} required), "
                 f"{built} built")


# ── 6d. Regions ─────────────────────────────────────────────────────────────
# Take 14: the AOI was hardcoded in ten places across seven files. One
# definition now, and nothing may reintroduce a literal.
def check_regions():
    rp = os.path.join(ROOT, "regions.json")
    if not os.path.exists(rp):
        return fails.append("regions.json missing — the AOI has no single home")
    try:
        cfg = json.load(open(rp))
    except Exception as e:
        return fails.append(f"regions.json will not parse: {e}")
    regs = cfg.get("regions", {})
    if not regs:
        return fails.append("regions.json defines no regions")
    try:
        import importlib.util
        sp = importlib.util.spec_from_file_location("_rg", os.path.join(HERE, "region.py"))
        rm = importlib.util.module_from_spec(sp)
        sp.loader.exec_module(rm)
        if getattr(rm, "BAD_DEFAULT", None):
            fails.append(f"regions.json: {rm.BAD_DEFAULT}")
    except Exception as e:
        fails.append(f"region.py will not load: {e}")
    if cfg.get("default") not in regs:
        fails.append(f"default region {cfg.get('default')!r} is not defined — "
                     f"every tool would exit on import")
    # a bare lat/lon pair in a tool means the region leaked back into code
    leaks = []
    for fn in sorted(os.listdir(HERE)):
        # verify*.py are fixtures with expected values baked in, deliberately.
        # A fixture that reads the config cannot catch a config error.
        # context.py carries a fixed table of Great Lakes label positions. They
        # are cartographic furniture, not a region definition — no region moves
        # Lake Superior — so they do not belong in regions.json.
        if not fn.endswith(".py") or fn in ("region.py", "gate.py", "context.py") \
                or fn.startswith("verify"):
            continue
        for i, line in enumerate(read("tools", fn).splitlines(), 1):
            if line.lstrip().startswith("#") or '"""' in line:
                continue
            if re.search(r"-8[0-9]\.\d+\s*,\s*4[0-9]\.\d+", line):
                leaks.append(f"{fn}:{i}")
    if leaks:
        fails.append("hardcoded coordinates outside regions.json: "
                     + ", ".join(leaks[:6]))
    else:
        notes.append(f"regions: {len(regs)} defined ({', '.join(regs)}), "
                     f"no hardcoded bboxes")


# ── 7. Pipeline provenance ──────────────────────────────────────────────────
# Every tool that produces shipped data must survive a fresh session reading it.
# A pipeline nobody can re-run is a pipeline whose numbers cannot be checked.
def check_tools():
    need = {"ingest.py": "agency fetch", "manifest.py": "provisioning",
            "build_app.py": "app assembly", "region.py": "region definition",
            "android.py": "APK project", "icon.py": "launcher icon",
            "stamp.py": "doc stamps", "render.mjs": "real-browser render",
            "pipeline.py": "the sequence",
            "imagery.py": "satellite", "glyphs.py": "label glyphs",
            "bundle.py": "region bundles", "conflate.py": "duplication measure",
            "graph.py": "routable network", "emit_graph.py": "client payload",
            "terrain.py": "DEM ingest", "pack.py": "geometry compaction",
            "gate.py": "this"}
    have = set(os.listdir(HERE))
    for f, what in sorted(need.items()):
        if f not in have:
            fails.append(f"tools/{f} missing ({what})")
    vers = sorted(f for f in have if f.startswith("verify"))
    if not vers:
        fails.append("no verify*.py — client maths must be checkable headlessly")
    else:
        notes.append(f"pipeline: {len(need)} tools, {len(vers)} verifier"
                     f"{'s' if len(vers) > 1 else ''} ({', '.join(vers)})")


# ── 8. Android manifest ─────────────────────────────────────────────────────
def check_manifest():
    p = os.path.join(ROOT, "android", "app", "src", "main", "AndroidManifest.xml")
    if not os.path.exists(p):
        return notes.append("no android/ yet (generated in CI)")
    s = open(p, encoding="utf-8").read()
    if "ACCESS_FINE_LOCATION" not in s:
        fails.append("AndroidManifest missing ACCESS_FINE_LOCATION")
    if "screenLayout" not in s:
        fails.append("AndroidManifest has no configChanges for screenLayout — "
                     "folding destroys the activity (landmine 7)")


for fn in (check_handoff, check_stamps, check_offline,
           check_style, check_agenda, check_syntax, check_stubs,
           check_orphan_sources, check_class_legality, check_workflow_yaml,
           check_absolute_paths, check_workflow_refs,
           check_smoke, check_render,
           check_current,
           check_provision,
           check_regions, check_bundles,
           check_tools,
           check_manifest):
    try:
        fn()
    except Exception as e:
        fails.append(f"{fn.__name__} crashed: {e}")

print(f"GATE — take {take()}")
for n in notes:
    print(f"  ok   {n}")
for f in fails:
    print(f"  FAIL {f}")
print("GATE PASSED" if not fails else f"GATE FAILED ({len(fails)})")
sys.exit(1 if fails else 0)
