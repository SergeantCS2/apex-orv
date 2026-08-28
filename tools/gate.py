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
# basemap.nationalmap.gov: the §8 take-145 in-app provisioning allowlist —
# user-tap-only HD saves (A160), declared in PROVISION.md, never load-bearing.
ALLOW = re.compile(r"openstreetmap\.org|maplibre\.org|github\.com/maplibre"
                   r"|basemap\.nationalmap\.gov")


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


# ── 4b. One palette, read by both the map and the legend ────────────────────
# Take 77. The activity picker carried its OWN copy of the colours and had
# drifted: it said two-track was #A9702F while the layer painted #9C7343 — dE
# 12.9, four times the just-noticeable difference — and #A9702F appeared nowhere
# in the style at all. Take 61 set the value, take 64 dimmed the LAYER, take 67
# wrote the swatch from the take-61 value, and nothing connected them.
#
# "Generated from the same table" was the claim in landmine 98 and it was only
# half true: generated from a COPY of the table is a hand-written legend with
# extra steps. This gates the mechanical part — no literal may appear where a
# palette reference belongs — so the two cannot drift again.
def check_palette():
    src = read("src", "app.html")
    if not src:
        return          # check_current already fails on this
    m = re.search(r"var PAL=\{(.*?)\n\};", src, re.S)
    if not m:
        return fails.append(
            "src/app.html has no PAL table — the style and the legend would "
            "each carry their own colours, which is how they drifted (take 77)")
    keys = set(re.findall(r"^\s*([a-z0-9]+)\s*:\s*'#", m.group(1), re.M))
    keys |= set(re.findall(r"\b([a-z0-9]+)\s*:\s*'#[0-9A-Fa-f]{6}'", m.group(1)))
    if not keys:
        return fails.append("PAL exists but declares no colours")

    bad = []
    # 1. every lyr() call paints from PAL
    for lid, cls, col in re.findall(r"lyr\('([a-z0-9]+)','([a-z0-9]+)',([^,]+),", src):
        if not col.strip().startswith("PAL."):
            bad.append(f"layer '{lid}' paints {col.strip()} instead of a PAL entry")
    # 2. the show-only match expression carries no literal
    sl = re.search(r"id:'show-line'.*?\}\}", src, re.S)
    if sl and re.search(r"#[0-9A-Fa-f]{6}", sl.group(0)):
        bad.append("show-line paints a hex literal instead of PAL entries")
    # 3. every legend swatch reads PAL
    for row, sw in re.findall(r"\{k:'([a-z0-9_]+)'.*?sw:([^,}]+)", src):
        if not sw.strip().startswith("PAL."):
            bad.append(f"legend row '{row}' uses {sw.strip()} — a copy of the "
                       f"palette, not the palette")
    if bad:
        fails.append("palette drift (landmine 98): " + "; ".join(bad[:6]))
        return

    # Coverage, now gated rather than noted. A class is explained if the legend
    # names it, if a tier row shows its colour, or if it PAINTS THE SAME COLOUR
    # as something already explained — fsclosed is closed-red, and the red row
    # explains both. Anything left must be declared exempt in the app with a
    # reason, so a new drawn class cannot slip in unexplained.
    drawn = {c for _l, c, _p in re.findall(r"lyr\('([a-z0-9]+)','([a-z0-9]+)',([^,]+),", src)}
    acts = re.search(r"var ACTS=\[(.*?)\n\];", src, re.S)
    explained = set()
    if acts:
        for cl in re.findall(r"cls:\[([^\]]*)\]", acts.group(1)):
            explained |= set(re.findall(r"'([a-z0-9]+)'", cl))
        for sw in re.findall(r"sw:PAL\.([a-z0-9]+)", acts.group(1)):
            explained.add(sw)
    pal = dict(re.findall(r"([a-z0-9]+)\s*:\s*'(#[0-9A-Fa-f]{6})'", m.group(1)))
    shown_cols = {pal[k] for k in explained if k in pal}
    explained |= {k for k, v in pal.items() if v in shown_cols}
    ex = re.search(r"var LEGEND_EXEMPT=\[([^\]]*)\]", src)
    exempt = set(re.findall(r"'([a-z0-9]+)'", ex.group(1))) if ex else set()
    gap = sorted(drawn - explained - exempt)
    if gap:
        return fails.append(
            f"drawn but unexplained: {', '.join(gap)} — every colour on the map "
            f"needs a legend row, or a declared reason in LEGEND_EXEMPT saying "
            f"why it does not (take 77)")
    notes.append(f"palette: {len(keys)} colours, one table, style and legend "
                 f"agree; {len(drawn)} drawn classes, {len(exempt)} exempt "
                 f"({', '.join(sorted(exempt))})")


# ── 4c. Per-vehicle legality, not just per-class ─────────────────────────────
# Take 80. MACHINE[m].ok is a CLASS allow-list, which encodes the DNR's rules
# correctly because the DNR puts width in the layer a feature comes from. The
# Forest Service does not: it publishes one trail class and states the rules per
# vehicle in the attributes. 25 fstrail edges here read `moto: open` with `atv`
# unset — "Trails open to motorcycles, Yearlong" — and class-only routing put a
# quad on them, while the feature card printed "Moto open" alongside.
#
# Required to be non-vacuous: if no built bundle carries a rule that
# distinguishes one machine from another, this check is looking at nothing and
# says so rather than passing quietly (landmine 85).
def check_machine_legality():
    src = read("src", "app.html")
    if not src:
        return
    if "function machineLegal(" not in src:
        return fails.append(
            "src/app.html has no machineLegal() — machine legality would be "
            "decided by class alone, and the Forest Service states its rules "
            "per vehicle (take 80)")
    for fn in ("function route(from,to,cost)", "function nearestNode(ll)"):
        i = src.find(fn)
        if i < 0:
            fails.append(fn.split("(")[0] + " missing")
            continue
        # Bound the window at the NEXT top-level function, not at a character
        # count. A fixed 2600-char window from nearestNode() ran past its end
        # and into route(), which does call machineLegal — so the check passed
        # on a nearestNode that had been reverted to class-only. Found by the
        # negative control, which is what they are for (landmine 54).
        j = src.find("\nfunction ", i + 1)
        body = src[i:j if j > 0 else i + 2600]
        if "machineLegal(" not in body:
            fails.append(
                fn.split("(")[0] + "() does not call machineLegal — the router "
                "and the snapper must apply the SAME rule, or a snap lands on a "
                "node the router will not leave (take 24)")
    if re.search(r"var ok=\{\};MACHINE\[machine\]\.ok\.forEach", src):
        fails.append("a raw class allow-list is still built for routing; "
                     "per-vehicle rules would be bypassed")
    import glob as _g
    paths = _g.glob(os.path.join(ROOT, "bundles", "*", "graph.json"))
    if not paths:
        return notes.append("no bundles built — machine legality check deferred")
    seen = 0
    for gp in paths:
        try:
            g = json.load(open(gp))
        except Exception:
            continue
        bk = g.get("bk") or []
        mi = bk.index("moto") if "moto" in bk else -1
        ai = bk.index("atv") if "atv" in bk else -1
        if mi < 0 and ai < 0:
            continue
        for b in g.get("b") or []:
            m = b[mi] if 0 <= mi < len(b) else None
            a = b[ai] if 0 <= ai < len(b) else None
            if (m or a) and not (m and a):
                seen += 1
    if not seen:
        return notes.append(
            "machine legality: wired, but no built bundle contains a rule that "
            "distinguishes one machine from another — nothing to enforce yet")
    notes.append("machine legality: per-vehicle rules honoured, %d attribute "
                 "bundle(s) distinguish machines" % seen)




# ── 4d. Ledger integrity ────────────────────────────────────────────────────
# A93. Take 43 deduped these by hand ("42 handoff entries, 70 landmines, no gaps,
# no duplicates") and by take 81 it had re-accumulated: two Take 49s, two Take
# 56s, A46 and A52 twice each, and landmines 78 and 85 defined twice — 78 being
# two DIFFERENT lessons sharing a number that mkapex.py and gate.py both cite.
#
# These three files are what a successor is told to read first, and the project's
# own rule is that a number is citable and never reused. A duplicate breaks
# citability silently: nothing errors, the reader simply gets the wrong lesson.
def check_ledgers():
    import collections
    def dups(seq):
        return sorted(x for x, c in collections.Counter(seq).items() if c > 1)

    h = read("docs", "HANDOFF.md") or ""
    takes = [int(x) for x in re.findall(r"^## Take (\d+) ", h, re.M)]
    if not takes:
        return fails.append("HANDOFF.md has no take entries")
    d = dups(takes)
    if d:
        fails.append("HANDOFF.md: take %s appears more than once — the take number "
                     "is the seal, and two entries claiming one seal makes the "
                     "history unreadable" % ", ".join(map(str, d)))
    gaps = [t for t in range(min(takes), max(takes) + 1) if t not in takes]
    if gaps:
        fails.append("HANDOFF.md: no entry for take %s" % ", ".join(map(str, gaps)))

    a = read("docs", "AGENDA.md") or ""
    ids = re.findall(r"^## (A\d+[a-z]?)", a, re.M)
    d = dups(ids)
    if d:
        fails.append("AGENDA.md: %s used by more than one item — an id that means "
                     "two things cannot be cited" % ", ".join(d))

    l = read("docs", "LANDMINES.md") or ""
    nums = [int(x) for x in re.findall(r"^\*\*(\d+)[.,]", l, re.M)]
    if not nums:
        return fails.append("LANDMINES.md has no numbered entries")
    d = dups(nums)
    if d:
        fails.append("LANDMINES.md: landmine %s defined more than once — citations "
                     "in the code resolve to whichever one you read first"
                     % ", ".join(map(str, d)))
    gaps = [n for n in range(1, max(nums) + 1) if n not in nums]
    if gaps:
        fails.append("LANDMINES.md: no landmine %s" % ", ".join(map(str, gaps)))

    # A heading that says OPEN over a body that says SHIPPED is worse than a
    # duplicate id: nothing errors, and a successor reads the status line and
    # believes it. A103 said PROPOSED for work superseded eleven takes earlier;
    # A108 said OPEN for something that shipped the take after it was raised
    # (take 97).
    stale = []
    for blk in re.split(r"\n(?=## )", a):
        head = blk.split("\n", 1)[0]
        m2 = re.match(r"## (A\d+[a-z]?)\b(.*)", head)
        if not m2:
            continue
        # Strip parenthetical history — "SHIPPED take 98 (proposed take 89)" is
        # a resolved item recording where it came from, not an open one. The
        # first version read the whole line and flagged it (take 98, and the
        # same shape as matching a keyword inside a comment).
        status = re.sub(r"\([^)]*\)", "", m2.group(2)).upper()
        if not re.search(r"\bOPEN\b|\bPROPOSED\b|\bUNKNOWN\b", status):
            continue
        body = blk[len(head):].upper()
        # a body that reports a completed outcome under an open heading
        # NOT "Ruled out:" — check_agenda REQUIRES that line on every item, so
        # matching it flagged every open proposal in the file (take 97). The
        # signal is a completed-outcome marker or a resolution sub-heading.
        # A resolution sub-entry is appended at the END of the file by
        # convention, not beside its parent, so it is not inside this block —
        # search the whole document for one naming this id (take 97).
        rid = m2.group(1)
        resolved_elsewhere = re.search(
            r"^### " + re.escape(rid) +
            r" (shipped|superseded|resolved|measured|closed)", a, re.M | re.I)
        if re.search(r"\*\*SHIPPED\b|\*\*SUPERSEDED\b|\*\*CLOSED\b", body) \
           or resolved_elsewhere:
            stale.append(m2.group(1))
    if stale:
        fails.append("AGENDA.md: %s reads OPEN in its heading but its body "
                     "records a completed outcome — the status line is what a "
                     "successor trusts" % ", ".join(sorted(set(stale))))

    if not any("HANDOFF.md" in f or "AGENDA.md" in f or "LANDMINES.md" in f
               for f in fails):
        notes.append("ledgers: %d takes, %d agenda ids, %d landmines — "
                     "no duplicates, no gaps" % (len(takes), len(ids), len(nums)))




# ── 4e. The OSM fallback chain, in order ────────────────────────────────────
# A108, take 85. The three tiers are NOT equivalent and the order is the whole
# point: Overpass and Geofabrik both give real OSM ways with water and the same
# topology (20,222 edges); TIGER gives roads only, no water, 34k edges and a
# different shape. Reordering them, or losing the middle tier, silently changes
# what a rider's map is made of on any build where Overpass is down — and
# Overpass has been down for every local build since take 76.
def check_osm_fallback():
    ing = read("tools", "ingest.py")
    if not ing:
        return fails.append("tools/ingest.py missing")
    # Compare CALL SITES, not definitions. `find("tiger_roads()")` matches
    # `def tiger_roads():` — the definition sits near the top of the file, so
    # the first version of this check reported the tiers out of order on
    # correct code (landmine 54, and the check was the broken one).
    i_geo = ing.find("osm_local.build()")
    i_tig = ing.find("els = tiger_roads()")
    if i_geo < 0:
        return fails.append(
            "ingest.py never calls osm_local.build() — it no longer reaches "
            "the Geofabrik tier — one Overpass "
            "outage would cost the water layer and change the shape of the "
            "network (A108)")
    if i_tig < 0:
        return fails.append("ingest.py no longer reaches the TIGER tier")
    if i_geo > i_tig:
        return fails.append(
            "the OSM fallback tiers are out of order: TIGER is tried before "
            "Geofabrik. TIGER has no water and a different topology; it is the "
            "LAST resort, not the first")
    # the tool the middle tier depends on must exist and be importable in CI
    if not os.path.exists(os.path.join(HERE, "osm_local.py")):
        return fails.append("tools/osm_local.py missing — the Geofabrik tier "
                            "cannot run")
    mirrors = re.search(r"OVERPASS_MIRRORS = \[(.*?)\]", ing, re.S)
    n = len(re.findall(r"https://", mirrors.group(1))) if mirrors else 0
    if not n:
        return fails.append("no Overpass mirrors declared")
    # a mirror that cannot serve the region is worse than no mirror: it answers
    # 200 with an empty set and looks like data (A102)
    if "overpass.osm.ch" in mirrors.group(1):
        return fails.append(
            "overpass.osm.ch is back in the mirror list — it is the Swiss "
            "chapter's instance and returns 0 ways for this region (A102)")
    notes.append(f"osm fallback: {n} Overpass mirror(s) -> Geofabrik extract "
                 f"-> Census TIGER, in that order")




# ── 4f. A60 · route both, draw one, and never hide the wrong thing ──────────
# Both copies of a duplicated road stay routable; only one is drawn. Two things
# can go wrong and neither shows up as an error:
#   - a class loses ALL its drawn representation and vanishes from the map
#   - a SAFETY class gets hidden: a closure, or designated ORV line
# Checked against the built graph, per class, because the next bad rank is one
# someone will add to DRAW_RANK without thinking about closures.
NEVER_HIDE = {"closed", "fsclosed", "route72", "trail50", "moto24", "mccct"}


def check_drawn():
    import glob as _g
    paths = _g.glob(os.path.join(ROOT, "bundles", "*", "graph.json"))
    if not paths:
        return notes.append("no bundles built — drawn-set check deferred")
    for gp in paths:
        rid = os.path.basename(os.path.dirname(gp))
        try:
            g = json.load(open(gp))
        except Exception as e:
            fails.append(f"bundle {rid}: graph unreadable: {e}")
            continue
        E, CLS = g.get("e") or [], g.get("cls") or []
        if not E:
            fails.append(f"bundle {rid}: graph has no edges")
            continue
        if len(E[0]) < 8:
            notes.append(f"drawn set: {rid} predates A60 — every edge drawn")
            continue
        tot, hid = {}, {}
        for e in E:
            c = CLS[e[3]] if e[3] < len(CLS) else "?"
            tot[c] = tot.get(c, 0) + 1
            if not e[7]:
                hid[c] = hid.get(c, 0) + 1
        gone = sorted(c for c in tot if hid.get(c, 0) == tot[c])
        if gone:
            fails.append(f"bundle {rid}: {', '.join(gone)} is entirely undrawn — "
                         f"a class that is routable but invisible is a lie about "
                         f"what is on the ground")
        unsafe = sorted(c for c in NEVER_HIDE if hid.get(c, 0))
        if unsafe:
            fails.append(f"bundle {rid}: hid {sum(hid[c] for c in unsafe)} edge(s) "
                         f"of {', '.join(unsafe)} — closures and designated ORV "
                         f"line must never be the copy that gets hidden")
        nh = sum(hid.values())
        if not gone and not unsafe:
            notes.append(f"drawn set: {rid} routes {len(E)} edges, draws "
                         f"{len(E)-nh} ({100.0*nh/len(E):.0f}% suppressed as "
                         f"cross-source duplicates), no class lost")


# ── 4g. A bundle's artifacts must describe the SAME graph ───────────────────
# terrain.json carries one elevation per graph node. A stale terrain from an
# earlier run hash-verifies perfectly and passes every existing check, because
# nothing compared two artifacts to each other. The APP caught it at take 86
# (`TR.ne.length === NODES.length`) after the gate had waved it through — a
# runtime check should not be the first thing to notice an incoherent bundle.
def check_artifacts_agree():
    import glob as _g
    n = 0
    for gp in _g.glob(os.path.join(ROOT, "bundles", "*", "graph.json")):
        d = os.path.dirname(gp)
        rid = os.path.basename(d)
        tp = os.path.join(d, "terrain.json")
        if not os.path.exists(tp):
            continue
        try:
            gn = len(json.load(open(gp))["n"]) // 2
            tn = len(json.load(open(tp)).get("ne") or [])
        except Exception as e:
            fails.append(f"bundle {rid}: unreadable comparing graph to terrain: {e}")
            continue
        n += 1
        if gn != tn:
            fails.append(f"bundle {rid}: terrain has {tn} node elevations but the "
                         f"graph has {gn} nodes — these came from different runs "
                         f"and every hash still matches")
    if n and not any("node elevations but" in f for f in fails):
        notes.append(f"artifacts agree: graph and terrain describe the same "
                     f"{n} bundle(s)")




# ── 4h. What is on the map must be governed from one place ──────────────────
# A91, take 90. The Labels chip was driven by a hand-kept array of five layer
# ids under a comment claiming it was "every label layer". By take 89 the style
# had eleven symbol layers and six escaped it — lake-label, lbl-trail-short,
# poi-label, lbl-ref, lbl-lake, lbl-stream — four of them added two takes
# earlier without a thought for the list meant to govern them.
#
# Third time a copy of a set has drifted from the set (landmine 107): the
# palette, the CI dep attribution, and now this.
def check_layer_control():
    src = read("src", "app.html")
    if not src:
        return
    # Match any USE of LBL, not only its declaration. The first version looked
    # for `var LBL=[` and passed a tree where the declaration was gone and a
    # second call site survived — `LBL is not defined` at runtime, caught by the
    # browser and not by this check (take 90).
    # Match a USE of LBL, not the letters. The first version looked only for
    # `var LBL=[` and passed a tree whose declaration was gone with a call site
    # still standing (`LBL is not defined` at runtime). The second matched the
    # word anywhere and failed on a COMMENT describing the old bug.
    if re.search(r"\bLBL\s*[.\[=]", src.replace("DESTLBL", "")):
        return fails.append(
            "src/app.html has a hand-kept LBL array again — a copy of the label "
            "set drifts from the style the moment a layer is added (take 90)")
    if "function labelLayers(" not in src:
        return fails.append(
            "src/app.html has no labelLayers() — the Labels control would be "
            "driven by a list rather than by the style")
    m = re.search(r"var LYRGROUPS=\[(.*?)\n\];", src, re.S)
    if not m:
        return fails.append("src/app.html has no LYRGROUPS — the layers panel "
                            "would have nothing to offer")
    # every layer a group claims to govern must actually exist in the style,
    # or the toggle is dead and looks like a broken feature
    have = set(re.findall(r"\{id:'([a-z0-9-]+)',type:'(?:line|fill|symbol|circle|raster)'", src))
    if not have:
        return fails.append("cannot read the style's layer ids")
    bad = []
    for lst in re.findall(r"ids:\[([^\]]*)\]", m.group(1)):
        for lid in re.findall(r"'([a-z0-9-]+)'", lst):
            if lid not in have:
                bad.append(lid)
    if bad:
        return fails.append(
            f"layers panel governs {', '.join(sorted(set(bad)))}, which the style "
            f"does not define — a toggle that moves nothing reads as a bug")
    n = len(re.findall(r"\{k:'", m.group(1)))
    syms = len(re.findall(r"\{id:'[a-z0-9-]+',type:'symbol'", src))
    notes.append(f"layer control: {n} group(s) in one panel, label set derived "
                 f"from the style ({syms} symbol layers)")




# ── 4i. A region switch must leave nothing behind ───────────────────────────
# A94, take 96. `region.DERIVED` was a hand-kept list of twelve while the
# pipeline produced seven more — address, context, other, poi, contour,
# imagery_tiles/ and dem_meta. A leftover payload is the previous region's data
# wearing this region's name, with every hash correct: landmine 37 exactly, and
# invisible because nothing errors.
#
# Checked against what the TOOLS ACTUALLY WRITE rather than against a list, so
# the next payload someone invents is caught the day it is written.
def check_region_clean():
    import importlib.util, glob as _g
    rp = os.path.join(HERE, "region.py")
    if not os.path.exists(rp):
        return fails.append("tools/region.py missing")
    spec = importlib.util.spec_from_file_location("_rg", rp)
    m = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(m)
    except Exception as e:
        return fails.append(f"region.py will not load: {e}")
    if not hasattr(m, "derived_files"):
        return fails.append(
            "region.py has no derived_files() — the clear-list would be "
            "hand-kept, and it has drifted every time it has been (take 96)")

    # what does any tool actually write into the repo root?
    writes = set()
    for fn in sorted(os.listdir(HERE)):
        if not fn.endswith(".py"):
            continue
        src = read("tools", fn) or ""
        for mm in re.finditer(r'["\']([a-z0-9_]+_payload\.json|imagery_tiles\.json|'
                              r'dem_meta\.json|imagery_meta\.json|imagery_budget\.json|'
                              r'aoi\.json|authoritative\.json|graph_raw\.json|'
                              r'hillshade\.jpg|imagery\.jpg)["\']', src):
            writes.add(mm.group(1))
    # `derived_files()` globs what is ON DISK, which is right for clearing and
    # wrong for checking: a seed has no payloads, so the glob returns nothing
    # and the check reported that nothing would be cleared. It must reason about
    # the RULE, not the current directory (take 96 — caught by the seed-mode
    # gate, which is exactly what that mode is for).
    src_rg = read("tools", "region.py") or ""
    # Match the GLOB CALL, not the letters — the same pattern appears in the
    # comment above it, so a plain substring test passed a region.py that had
    # stopped globbing (take 96, landmine 127's corollary, on both sides: my
    # check matched the comment and so did my control's mutation).
    globs_payloads = bool(re.search(r"glob\([^)]*\*_payload\.json", src_rg))
    if not globs_payloads:
        return fails.append(
            "region.py no longer clears by the *_payload.json convention — a "
            "hand-kept list has drifted every time it has been used (take 96)")
    extra = set(getattr(m, "DERIVED_EXTRA", []))
    # anything matching the convention is covered by the glob; the rest must be
    # named explicitly
    missed = sorted(f for f in writes
                    if not f.endswith("_payload.json") and f not in extra)
    if missed:
        return fails.append(
            f"a region switch would leave {', '.join(missed)} behind — the next "
            f"region inherits the last one's data with every hash correct "
            f"(landmine 37)")
    # The CI cache list is the same set as the clear list, and it drifted the
    # same way: poi, contour and corridor were all absent, so every build re-ran
    # steps whose output it already had. Checked against the convention rather
    # than against a list, for the same reason (take 107).
    yml = read("ci", "build.yml") or ""
    if yml and "actions/cache" in yml:
        # Scope to the `path: |` block, not the whole file. Testing the file
        # matched the words inside THIS CHECK'S OWN COMMENT, so two of three
        # controls passed on a cache list that had been gutted. Third time that
        # mistake has been made here (takes 96, 98, 107) — the lesson is not
        # "beware comments", it is SCAN THE STRUCTURE, NOT THE TEXT.
        blk = ""
        mblk = re.search(r"path:\s*\|\n((?:\s{2,}\S.*\n)+)", yml)
        if mblk:
            blk = "".join(ln for ln in mblk.group(1).splitlines(True)
                          if not ln.lstrip().startswith("#"))
        if not blk:
            fails.append("ci/build.yml has an actions/cache with no readable "
                         "path block")
        elif "*_payload.json" not in blk:
            fails.append(
                "ci/build.yml caches payloads by name instead of by the "
                "*_payload.json convention — it has already missed three "
                "(landmine 170)")
        for need in ("osm_cache", "dem_cache", "img_cache"):
            if blk and need not in blk:
                fails.append(f"ci/build.yml does not cache {need} — every build "
                             f"re-fetches it")
    dirs = getattr(m, "DERIVED_DIRS", [])
    if "imagery_tiles" not in dirs:
        return fails.append(
            "imagery_tiles/ is not cleared on a region switch — 2,008 tiles of "
            "the previous region's ground, and os.remove cannot delete a "
            "directory")
    # A95: an anchor outside its own bbox is a chip that pans the rider to blank
    # ground with no explanation, and a search hit that does the same. sthelen
    # carried two — Roscommon 2.5 km out and Houghton Lake 16.2 km out — since
    # the region was defined. Hand-typed coordinates are exactly what A72 will
    # multiply, so this is checked at build time rather than found in the field.
    try:
        cfg = json.load(open(os.path.join(ROOT, "regions.json")))
    except Exception as e:
        return fails.append(f"regions.json unreadable: {e}")
    stray = []
    for rid, r in (cfg.get("regions") or {}).items():
        bb = r.get("bbox")
        if not bb or len(bb) != 4:
            fails.append(f"region {rid} has no usable bbox")
            continue
        W, S, E, N = bb
        for a in r.get("anchors") or []:
            if not isinstance(a, list) or len(a) < 3:
                continue
            nm, lo, la = a[0], a[1], a[2]
            if not (W <= lo <= E and S <= la <= N):
                dx = max(W - lo, lo - E, 0) * 111.32 * 0.714
                dy = max(S - la, la - N, 0) * 111.32
                stray.append(f"{rid}/{nm} {(dx*dx+dy*dy)**0.5:.1f} km outside")
    if stray:
        return fails.append(
            "anchors outside their own region: " + "; ".join(stray) +
            " — the chip pans the rider off the map to ground the bundle does "
            "not cover, and says nothing about why (A95)")

    notes.append(f"region switch: clears *_payload.json by convention plus "
                 f"{len(extra)} named artifact(s) and "
                 f"{len(dirs)} directory; every anchor inside its bbox")




# ── 4j. No two functions may share a name ───────────────────────────────────
# Take 109 found TWO `function stLayout(){}` in app.html. JavaScript keeps the
# last declaration and silently discards the first, so a check added to the
# wrong one had never run for sixteen takes — and take 111 found the dead twin
# also held THREE MORE checks that had never run: machine-on-map,
# hud-matches-ride and map-has-room.
#
# Nothing errors. The code reads as live and greps as present. This is the only
# failure in the ledger that cost a whole function's worth of silence, so it is
# checked mechanically rather than remembered (landmine 175).
def check_no_duplicate_defs():
    src = read("src", "app.html")
    if not src:
        return fails.append("src/app.html missing")
    m = re.findall(r"<script>(.*?)</script>", src, re.S)
    if not m:
        return fails.append("src/app.html has no script block")
    js = m[-1]
    names = re.findall(r"^function ([A-Za-z_$][\w$]*)\s*\(", js, re.M)
    dup = sorted({n for n in names if names.count(n) > 1})
    if dup:
        return fails.append(
            "app.html declares these functions twice: " + ", ".join(dup) +
            " — the later one silently wins and everything in the earlier one "
            "never runs (landmine 175)")
    # top-level vars that shadow each other are the same trap, quieter
    vs = re.findall(r"^var ([A-Za-z_$][\w$]*)\s*=", js, re.M)
    vdup = sorted({v for v in vs if vs.count(v) > 1})
    if vdup:
        return fails.append(
            "app.html assigns these top-level vars twice: " + ", ".join(vdup))
    # ids in the STATIC markup, where a collision is a real ambiguity
    head = src[:src.find("<script>")]
    ids = re.findall(r'\sid="([A-Za-z0-9_-]+)"', head)
    idup = sorted({i for i in ids if ids.count(i) > 1})
    if idup:
        return fails.append(
            "duplicate ids in the static markup: " + ", ".join(idup) +
            " — getElementById returns only the first")
    notes.append(f"no duplicate definitions: {len(set(names))} functions, "
                 f"{len(set(vs))} top-level vars, {len(set(ids))} static ids")


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
    # BOTH the source and the built output. This scanned www/ only, so a
    # src/app.html that did not parse was invisible until something rebuilt —
    # and check_current compares take stamps, not content, so an edit within the
    # same take could sit broken in the source with the gate green. Found at
    # take 78 by breaking src/app.html and watching "inline syntax ok (2 files)"
    # go by. Take 12's lesson on the other axis: the repo must also be able to
    # build the app it claims to.
    targets = [("src", fn) for fn in sorted(os.listdir(os.path.join(ROOT, "src")))
               if fn.endswith((".js", ".html"))] if os.path.isdir(
                   os.path.join(ROOT, "src")) else []
    targets += [("www", fn) for fn in sorted(os.listdir(www))
                if fn.endswith((".js", ".html"))]
    for where, fn in targets:
        src = read(where, fn)
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
            fails.append(f"{where}/{fn} inline script does not parse: "
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
    # Take 118: statewide smoke runs the box-era 240 s out (same scale-up
    # as render's stopwatch, same take-117 lesson). The suite must still PASS.
                           timeout=900)
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
    # ...and take 127's `sat:(TILES&&!SPARSE)?{...}` opens with a paren
    srcs = set(re.findall(r"^\s{4}([a-z]+):(?=\s*[\{\(A-Za-z])", a[i:j], re.M))
    lays = set(re.findall(r"source:'([a-z]+)'", a[j:]))
    orphan = sorted(srcs - lays)
    ghost = sorted(lays - srcs)
    if orphan:
        fails.append("sources with no layer to draw them: " + ", ".join(orphan))
    elif ghost:
        fails.append("layers referencing sources that do not exist: " + ", ".join(ghost))
    else:
        notes.append(f"style: {len(srcs)} sources, every one drawn by a layer")


# ── 6b1a-1. A job downstream of a pushing job must pin its checkout ─────────
# actions/checkout defaults to the TRIGGERING commit. The seed job pushes a new
# one, so any job that needs it and checks out bare lands on a tree without the
# files the seed just delivered (landmine 85).
def check_checkout_ref():
    try:
        import yaml as _yaml
    except ImportError:
        return
    for d in (os.path.join(ROOT, "ci"), os.path.join(ROOT, ".github", "workflows")):
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if not f.endswith((".yml", ".yaml")):
                continue
            try:
                doc = _yaml.safe_load(open(os.path.join(d, f), encoding="utf-8"))
            except Exception:
                continue
            jobs = doc.get("jobs") or {}
            pushers = {n for n, j in jobs.items()
                       if "git push" in "\n".join(s.get("run", "")
                                                  for s in (j.get("steps") or []))}
            if not pushers:
                continue
            for name, job in jobs.items():
                needs = job.get("needs") or []
                needs = [needs] if isinstance(needs, str) else needs
                if not (set(needs) & pushers):
                    continue
                for st in (job.get("steps") or []):
                    if str(st.get("uses", "")).startswith("actions/checkout"):
                        if not (st.get("with") or {}).get("ref"):
                            fails.append(
                                f"{f}:{name} needs a job that pushes, but checks out "
                                f"the triggering commit — add ref: ${{{{ github.ref_name }}}}")
    if not any("triggering commit" in x for x in fails):
        notes.append("checkout: jobs after a push pin their ref")


# ── 6b1a0. Every third-party import must be installed by CI ─────────────────
# glyphs.py needed a font the runner did not have; gate.py needs pyyaml, which
# CI did not install — so its workflow validation would have silently downgraded
# to a note on the one machine where it matters. Check the dependency list
# against what the tools actually import (landmine 82).
def check_ci_deps():
    """Per JOB, not per workflow. Every job is a fresh runner, so the bundle
    job's `pip install` does nothing for the apk job — which called android.py,
    which imports icon.py, which needs PIL, and had no Python deps installed at
    all. My first version of this check searched the whole file and passed
    (landmine 83). Imports are resolved TRANSITIVELY through local modules.
    """
    import ast as _ast
    import sys as _sys
    import yaml as _yaml

    std = set(_sys.stdlib_module_names)
    local = {f[:-3] for f in os.listdir(HERE) if f.endswith(".py")}
    direct, uses_local = {}, {}
    for fn in sorted(os.listdir(HERE)):
        if not fn.endswith(".py"):
            continue
        mod = fn[:-3]
        direct[mod], uses_local[mod] = set(), set()
        try:
            tree = _ast.parse(open(os.path.join(HERE, fn), encoding="utf-8").read())
        except Exception:
            continue
        for n in _ast.walk(tree):
            names = []
            if isinstance(n, _ast.Import):
                names = [a.name.split(".")[0] for a in n.names]
            elif isinstance(n, _ast.ImportFrom) and n.module and n.level == 0:
                names = [n.module.split(".")[0]]
            for nm in names:
                if nm in local:
                    uses_local[mod].add(nm)
                elif nm not in std:
                    direct[mod].add(nm)

    def closure(mod, seen=None):
        seen = seen or set()
        if mod in seen or mod not in direct:
            return set()
        seen.add(mod)
        out = set(direct[mod])
        for dep in uses_local.get(mod, ()):
            out |= closure(dep, seen)
        return out

    # Import name -> pip name, for the packages where they differ. Adding a
    # dependency whose import name is not its package name means adding it here
    # too, or the check reports it missing when it is installed (take 91).
    PKG = {"PIL": "pillow", "yaml": "pyyaml", "cv2": "opencv-python",
           "skimage": "scikit-image", "sklearn": "scikit-learn"}
    problems = []
    dirs = [os.path.join(ROOT, "ci")]
    if not os.environ.get("APEX_GATE_SEED"):
        dirs.append(os.path.join(ROOT, ".github", "workflows"))
    for d in dirs:
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if not f.endswith((".yml", ".yaml")):
                continue
            try:
                doc = _yaml.safe_load(open(os.path.join(d, f), encoding="utf-8"))
            except Exception:
                continue
            for jname, job in (doc.get("jobs") or {}).items():
                runs = "\n".join(s.get("run", "") for s in (job.get("steps") or []))
                # a job may delegate to a script in the repo; follow it, or the
                # deps look absent when they are simply one level down
                for sh in re.findall(r"(?:bash|sh)\s+(ci/[\w.-]+\.sh)", runs):
                    sp = os.path.join(ROOT, sh)
                    if os.path.exists(sp):
                        runs += "\n" + open(sp, encoding="utf-8").read()
                need = set()
                for m in re.finditer(r"python3?\s+tools/(\w+)\.py", runs):
                    need |= closure(m.group(1))
                if "tools/pipeline.py" in runs:
                    # The pipeline dispatches steps by name, so this used to
                    # assume it runs EVERY tool. That was true when every tool
                    # was a step. It is not: colour_probe, colour_sweep and
                    # osm_local are local measurement instruments that CI never
                    # invokes, and demanding their dependencies would have CI
                    # install a compiled PBF reader to build an APK (take 84).
                    # Read the STEPS table instead of guessing at it.
                    ps = read("tools", "pipeline.py") or ""
                    steps = set(re.findall(r'"(\w+)\.py"', ps))
                    if not steps:
                        fails.append("cannot read the STEPS table in pipeline.py "
                                     "— CI dependency attribution would be a guess")
                    for mod in steps:
                        need |= closure(mod)
                miss = sorted(p for p in {PKG.get(x, x) for x in need}
                              if p not in runs)
                if miss:
                    problems.append(f"{f}:{jname} runs python without {miss}")
    if problems:
        fails.append("a job installs no Python deps it needs — each job is a "
                     "fresh runner: " + "; ".join(problems[:3]))
    else:
        notes.append("ci deps: every job installs what its Python tools import")


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
    if os.environ.get("APEX_GATE_SEED"):
        return notes.append("seed mode: workflow files are the user's, not gated here")
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
    # Take 117: the statewide render suite settles-then-measures (landmine
    # 198) and legitimately runs ~7 minutes; 300 s was box-era. The suite must
    # still PASS — only the stopwatch grew with the state.
    r = subprocess.run(["node", rm], capture_output=True, text=True, timeout=1200)
    if r.returncode:
        bad = [l.strip() for l in r.stdout.splitlines() if "FAIL" in l][:2]
        fails.append("render failed: " + ("; ".join(bad) or r.stderr[-120:]))
    else:
        n = sum(1 for l in r.stdout.splitlines() if l.strip().startswith("ok"))
        notes.append(f"render: real browser drew the map, {n} checks green")

    # The palette verifier runs under the SAME policy, in the same place, for the
    # same reason. It is a pipeline step too — but `ci/bundle.sh` runs the
    # pipeline BEFORE `npm ci`, so that step finds no puppeteer, prints "absent,
    # skipping" and exits 0. A check that skips is not a check (landmine 53), and
    # this one exists to stop the legend drifting from the map again.
    vp = os.path.join(HERE, "verify_palette.mjs")
    if not os.path.exists(vp):
        return fails.append(
            "tools/verify_palette.mjs missing — nothing proves the legend "
            "swatches match the colours the map paints (take 77)")
    r = subprocess.run(["node", vp], capture_output=True, text=True, timeout=300)
    if r.returncode:
        bad = [l.strip() for l in r.stdout.splitlines() if "FAIL" in l][:2]
        fails.append("palette render failed: " + ("; ".join(bad) or r.stderr[-120:]))
    else:
        n = sum(1 for l in r.stdout.splitlines() if l.strip().startswith("ok"))
        notes.append(f"palette: browser confirms swatch == map paint, {n} checks")


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
    # The workflow is a thin shim now; the steps it used to contain live in
    # ci/*.sh so the seed can update them (landmine 84). Read both, or every
    # check that greps the workflow for a command reports it missing.
    wf = ""
    for _d in (os.path.join(ROOT, ".github", "workflows"), os.path.join(ROOT, "ci")):
        if not os.path.isdir(_d):
            continue
        for _f in sorted(os.listdir(_d)):
            if _f.endswith((".yml", ".yaml", ".sh")):
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


# ── 6c1. A layer with nothing in it is not a layer ──────────────────────────
# Take 76. pack.py wrote a structurally valid EMPTY water payload — 65 bytes,
# both buckets [] — because take 56's TIGER fallback creates an aoi.json that
# satisfied its "was OSM missing" guard. bundle.verify() checks existence, size
# and SHA-256, and all three pass on an empty file, so the bundle reported
# COMPLETE with no water in it while ingest had already printed "bundle will be
# PARTIAL". The rider gets a map with no lakes and is told nothing, which is
# precisely what the three-state model exists to prevent (landmines 34, 74).
#
# Checked against the BUILT bundle rather than against the producers, because
# the next empty artifact will come from a producer nobody has written yet
# (landmine 73's corollary).
def check_empty_artifacts():
    import importlib.util, glob
    bp = os.path.join(HERE, "bundle.py")
    if not os.path.exists(bp):
        return          # check_bundles already fails on this
    spec = importlib.util.spec_from_file_location("_be", bp)
    m = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(m)
    except Exception as e:
        return fails.append(f"bundle.py will not load: {e}")
    # A check with nothing to look at reports success (landmine 85). If the
    # counters are gone, this check is theatre and should say so loudly.
    if not getattr(m, "COUNTERS", None):
        return fails.append(
            "bundle.py has no COUNTERS — nothing can tell an empty layer from "
            "a full one, and an empty artifact verifies as COMPLETE (take 76)")
    bd = os.path.join(ROOT, "bundles")
    if not os.path.isdir(bd):
        return notes.append("no bundles built — empty-artifact check deferred")
    seen, judged = 0, 0
    for mp in sorted(glob.glob(os.path.join(bd, "*", "manifest.json"))):
        rid = os.path.basename(os.path.dirname(mp))
        try:
            man = json.load(open(mp))
        except Exception as e:
            fails.append(f"bundle {rid}: manifest unreadable: {e}")
            continue
        seen += 1
        for e in man.get("artifacts", []):
            p = os.path.join(os.path.dirname(mp), e["path"])
            n = m.features(e.get("kind"), p) if os.path.exists(p) else None
            if n is None:
                continue
            judged += 1
            if n == 0:
                fails.append(
                    f"bundle {rid}: {e['path']} is staged but holds ZERO "
                    f"features — the bundle claims a layer it does not have "
                    f"(landmine 34). It must be absent so the state degrades "
                    f"to PARTIAL and the app names it.")
    if seen and not any("holds ZERO" in f for f in fails):
        notes.append(f"empty artifacts: {judged} countable layer(s) across "
                     f"{seen} bundle(s), every one has content")


# ── 6c3. Region POLYGON membership (take 122, A156) ─────────────────────────
# Every earlier check asked "inside the region BBOX" — which 7,413 Wisconsin
# and Minnesota edges passed. Bbox and polygon were the same thing for 118
# takes of box regions; statewide they are not. Boundary-crossers are kept
# whole by design, so a small fraction of nodes may sit just over the line;
# the threshold is 99.5 % of routable nodes and 99.5 % of places INSIDE.
def check_region_polygon():
    try:
        sys.path.insert(0, HERE)
        from region import R
        if not getattr(R, "bulk", False):
            return
        import statemask
    except Exception as e:
        return notes.append(f"region polygon: check skipped ({e})")
    gp = os.path.join(ROOT, "graph_payload.json")
    pp = os.path.join(ROOT, "poi_payload.json")
    if not os.path.exists(gp):
        return
    g = json.load(open(gp))
    x = y = 0
    inside = total = 0
    a = g["n"]
    for i in range(0, len(a), 2):
        x += a[i]; y += a[i + 1]
        total += 1
        if statemask.inside(x / 1e5, y / 1e5):
            inside += 1
    frac = inside / max(1, total)
    if frac < 0.995:
        fails.append(f"{total - inside} of {total} routable nodes lie outside the "
                     f"{R.name} polygon ({100 * (1 - frac):.2f}%) — agency data is "
                     "bleeding past the state line (A156); ingest must clip")
    else:
        notes.append(f"region polygon: {inside:,} of {total:,} routable nodes inside "
                     f"{R.name} ({100 * frac:.2f}%)")
    if os.path.exists(pp):
        P = json.load(open(pp)).get("p", [])
        pin = sum(1 for r in P if statemask.inside(r["p"][0], r["p"][1]))
        pf = pin / max(1, len(P))
        if pf < 0.995:
            fails.append(f"{len(P) - pin} of {len(P)} places lie outside the {R.name} "
                         "polygon — foreign pins (A156)")
        else:
            notes.append(f"region polygon: {pin:,} of {len(P):,} places inside")


# ── 6c2. Input integrity (take 120, landmine 201 addendum) ──────────────────
# A killed ingest left a 935 KB aoi.json where 543 MB had been, with a fresh
# timestamp, and every consumer read the stump: 323 summits quietly became
# 264. For a bulk region the streamed AOI cannot be smaller than a tenth of
# the extract it was read from; if it is, the input is a stump, not data.
def check_input_integrity():
    try:
        sys.path.insert(0, HERE)
        from region import R
    except Exception:
        return
    aoi = os.path.join(ROOT, "aoi.json")
    if not getattr(R, "bulk", False) or not os.path.exists(aoi):
        return
    cache = os.path.join(ROOT, "osm_cache")
    pbfs = [os.path.join(cache, f) for f in os.listdir(cache)] if os.path.isdir(cache) else []
    pbfs = [f for f in pbfs if f.endswith(".pbf")]
    if not pbfs:
        return
    ext = max(os.path.getsize(f) for f in pbfs)
    got = os.path.getsize(aoi)
    if got < ext // 10:
        return fails.append(
            f"aoi.json is {got // 1048576} MB against a {ext // 1048576} MB extract — "
            "a truncated stream, not the state (landmine 201). Delete it and rerun "
            "ingest; every payload built since its timestamp is suspect.")
    notes.append(f"input integrity: aoi.json {got // 1048576} MB vs extract "
                 f"{ext // 1048576} MB — a whole stream")


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



# ── Ledger entries file in numeric order ────────────────────────────────────
# Take 115's audit: 191 entries, zero gaps, zero duplicates — and two entries
# (68, 119) filed out of position, which the set-completeness check could never
# see. An out-of-order ledger cites fine and READS wrong. Order is asserted now.
def check_ledger_order():
    lm = read("docs", "LANDMINES.md") or ""
    nums = [int(x) for x in re.findall(r"^\*\*(\d+)[.,]", lm, re.M)]
    if nums != sorted(nums):
        bad = [(a, b) for a, b in zip(nums, nums[1:]) if b < a][:4]
        return fails.append(f"LANDMINES.md entries out of numeric order near {bad}")
    notes.append(f"landmine file order: {len(nums)} entries, strictly ascending")


for fn in (check_handoff, check_stamps, check_offline,
           check_style, check_palette, check_machine_legality,
           check_ledgers, check_osm_fallback, check_drawn,
           check_region_clean, check_no_duplicate_defs, check_ledger_order,
           check_layer_control,
           check_artifacts_agree, check_agenda, check_syntax, check_stubs,
           check_orphan_sources, check_class_legality, check_workflow_yaml,
           check_checkout_ref,
           check_ci_deps,
           check_absolute_paths, check_workflow_refs,
           check_smoke, check_render,
           check_current,
           check_provision,
           check_regions, check_bundles, check_empty_artifacts,
           check_input_integrity, check_region_polygon,
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
