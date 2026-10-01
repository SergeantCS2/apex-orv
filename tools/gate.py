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
                   r"|basemap\.nationalmap\.gov"
                   # take 150 · A164: live gauge values, user tap only (§8)
                   r"|waterservices\.usgs\.gov"
                   # take 167 · A184: attribution links shown in Tools ->
                   # Data sources. DISPLAYED, never fetched — Play requires an
                   # app presenting government data to link its official
                   # source, and §8 exists to stop the app depending on the
                   # network, not to stop it citing anyone.
                   r"|michigan\.gov|gis-midnr\.opendata\.arcgis\.com"
                   r"|data\.fs\.usda\.gov|apps\.nationalmap\.gov"
                   r"|waterdata\.usgs\.gov"
                   # take 181 · A195: the privacy policy link on the same card —
                   # the app's own Pages site. Displayed, never fetched; Play's
                   # User Data policy wants the policy reachable from inside
                   # the app, not just the listing.
                   r"|sergeantcs2\.github\.io")
# take 187 · A211 — the scan now reaches www/'s subfolders. The vendored
# MapLibre files there carry two kinds of URL that are TEXT, never fetched:
# the SVG/XML namespace inside inline SVG (an identifier, not a location) and
# one console warning that cites an upstream issue. Named, so everything else
# in vendor/ refuses exactly as the top level does. Anchored at the URL's
# start, so a CDN URL that carries the namespace text in its path still refuses.
ALLOW_TEXT = re.compile(r"^https?://(?:www\.w3\.org/(?:2000/svg|1999/xlink|1999/xhtml|XML/1998/namespace)"
                        r"|github\.com/mapbox/mapbox-gl-js/issues)")


def _offline_hits(name, text):
    hits = []
    for i, line in enumerate(text.splitlines(), 1):
        for url in re.findall(r"https?://[^\s\"'<>)]+", line):
            if ALLOW.search(url) or ALLOW_TEXT.search(url):
                continue          # attribution, licence and namespace text only
            hits.append(f"{name}:{i} {url[:70]}")
    return hits


def check_scrub():
    """A release must not ship developer commentary. An .apk is a zip anyone
    can open, so www/ is effectively public: internal notes, ticket numbers
    and names have no business travelling with it. The repository keeps its
    annotations; the build strips them from the artifact."""
    for rel in ("app.js", "index.html"):
        p = os.path.join(ROOT, "www", rel)
        if not os.path.exists(p):
            continue
        t = read("www", rel)
        if "/*" in t or "<!--" in t:
            fails.append(f"www/{rel} still carries comments — run "
                         "tools/scrub.mjs (it is wired into build_app split)")
    notes.append("scrub: shipped assets carry no developer commentary")


def check_splash():
    """take 156 · A171. The splash only works if it is in the STATIC markup,
    ahead of the app shell, with its logo already inlined — a splash that
    needs app.js to appear cannot cover app.js loading."""
    idx = os.path.join(ROOT, "www", "index.html")
    if not os.path.exists(idx):
        return notes.append("no www/index.html to scan for the splash")
    h = read("www", "index.html")
    if 'id="splash"' not in h:
        return fails.append("no boot splash in www/index.html (A171)")
    i, j = h.index('id="splash"'), h.index('id="shell"')
    if i > j:
        return fails.append("the splash is not ahead of the app shell — it "
                            "would paint after the thing it exists to cover")
    if "__SPLASH_LOGO__" in h or "data:image/png;base64" not in h[i:j]:
        fails.append("the splash logo is not inlined — a second request "
                     "races the first paint (A171)")
    if "__IC_" in h[i:j]:
        fails.append("the splash markup carries an __IC_ token, the exact "
                     "thing it exists to hide")
    else:
        notes.append("splash: static, ahead of the shell, logo inlined")


def check_offline():
    www = os.path.join(ROOT, "www")
    if not os.path.isdir(www):
        return notes.append("no www/ to scan")
    # take 187 · A211 — its negative control, every run: a planted CDN
    # reference must be caught, one that carries the namespace text in its
    # path as well, and the SVG namespace itself must not be.
    # (the planted URLs are split so the provisioning-host scan of tools/,
    # manifest.py, does not read this control as a host the tools fetch)
    if not _offline_hits("planted", 'src="https:' + '//cdn.example.com/x.js"') \
       or not _offline_hits("planted", 'src="https:' + '//cdn.example.com/www.w3.org/2000/svg/x.js"') \
       or _offline_hits("planted", 'xmlns="http:' + '//www.w3.org/2000/svg"'):
        return fails.append("check_offline failed its own planted control — the "
                            "scan cannot be trusted this run")
    # take 187 · A211 — every folder, not just the top level (vendor/ and any
    # new css/ or icons/ were never scanned). bundle/ is data, checked elsewhere.
    hits, n = [], 0
    for dirpath, dirnames, filenames in os.walk(www):
        dirnames[:] = sorted(d for d in dirnames
                             if not (dirpath == www and d == "bundle"))
        for fn in sorted(filenames):
            if not fn.endswith((".html", ".js", ".css", ".svg")):
                continue
            p = os.path.join(dirpath, fn)
            n += 1
            hits += _offline_hits(os.path.relpath(p, www),
                                  open(p, encoding="utf-8", errors="replace").read())
    if hits:
        fails.append("remote origins in shipped assets (PROTOCOL §8):\n      "
                     + "\n      ".join(hits[:8]))
    else:
        notes.append(f"offline: no remote origins in www/ ({n} files, "
                     "subfolders included; both planted CDN URLs were caught)")


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
    # take 187 · A211 — ids may carry a hyphen: `[a-z0-9]+` never matched
    # 'minor-case' or 'paved-case', whose colours were literals it could not see
    for lid, cls, col in re.findall(r"lyr\('([a-z0-9-]+)','([a-z0-9]+)',([^,]+),", src):
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
    drawn = {c for _l, c, _p in re.findall(r"lyr\('([a-z0-9-]+)','([a-z0-9]+)',([^,]+),", src)}
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



# ── 4b. The token layer holds (take 187 · A208) ─────────────────────────────
# The token pass moved every colour, layer and duration in the stylesheet onto
# :root, holding the values it had (the computed-style diff against take 186
# proved nothing moved). These keep it that way, each proved on a planted
# input every run: (1) no colour literal in the stylesheet outside :root, and
# none in a template's inline style — build_app.py's loader screens are not in
# src/ and must render without the stylesheet; (2) every var(--x) the app uses
# is declared, because an undeclared one resets the property in silence;
# (3) colours the stylesheet shares with the script and the loader agree.
COLOUR = re.compile(r"#[0-9A-Fa-f]{3,8}\b|rgba?\([^)]*\)")


def _css_literals(css):
    body = re.sub(r":root\{[^}]*\}", "", re.sub(r"/\*.*?\*/", "", css, flags=re.S))
    return COLOUR.findall(body)


def _inline_literals(js):
    # take 188 · A224: re.S — a template's style= value can span a JS line
    # ('...background:'+x+\n ';border:...'), and a one-line scan never saw the
    # three that did. take 188 · A215: an SVG's fill= and stroke= attributes
    # are colours too (the compass rose and the elevation profile carried
    # literals there); none and currentColor are not colours of their own.
    out = [v for m in re.finditer(r"style=(\\?['\"])(.*?)\1", js, re.S)
           for v in COLOUR.findall(m.group(2))]
    for m in re.finditer(r"\b(?:fill|stroke)=(\\?['\"])(.*?)\1", js, re.S):
        v = m.group(2).strip()
        if v.lower() in ("none", "currentcolor", ""):
            continue
        out += COLOUR.findall(v) or [v]
    return out


# take 188 · A215 · a token named after its value is a literal with extra
# steps: take 187's --c-1b1813 and --m-140 said what they WERE, not what they
# were for, and 95 of them stood in :root. None may creep back.
VALUE_NAMED = re.compile(r"^--(?:c-[0-9a-f]|m-\d+$|[0-9a-f]{3}$|[0-9a-f]{6}$|rgba?-|(?:white|black|red|green|blue|"
                         r"orange|grey|gray|bone|sand|ink|flag)\b)", re.I)


def _value_named(css):
    roots = " ".join(re.findall(r":root\{[^}]*\}", re.sub(r"/\*.*?\*/", "", css, flags=re.S)))
    return sorted({t for t in re.findall(r"(--[\w-]+)\s*:", roots) if VALUE_NAMED.match(t)})


# take 188 · A215 · the closed red is a fill and a mark, never text: #C1121F
# text reads 2.6-2.9:1 on the dark surfaces. Text in that meaning uses
# --danger-text (the .tag.shut foreground, 9.5-10.7:1).
def _danger_text(text):
    return [m.group(0) for m in re.finditer(r"(?<![-\w])color\s*:[^;{}\"]{0,60}?var\(--danger\)", text)]


def _undeclared(css, js):
    roots = " ".join(re.findall(r":root\{[^}]*\}", css))
    declared = set(re.findall(r"(--[\w-]+)\s*:", roots))
    declared |= set(re.findall(r"setProperty\(\s*['\"](--[\w-]+)", js))
    return sorted(set(re.findall(r"var\(\s*(--[\w-]+)", css + js)) - declared)


def _pairs_bad(root, pairs):
    out = []
    for tok, m, grp, what in pairs:
        if not m:
            out.append(f"cannot find {what} to compare with {tok}")
        elif root.get(tok) != m.group(grp).upper():
            out.append(f"{tok} is {root.get(tok)} but {what} is {m.group(grp).upper()}")
    return out


def check_tokens():
    src, loader = read("src", "app.html"), read("tools", "build_app.py")
    if not src or not loader:
        return notes.append("tokens: no src/app.html or build_app.py to read")
    if (_css_literals("a{color:#123456}") != ["#123456"]
            or _css_literals(":root{--x:#123456}")
            or _inline_literals('<b style="color:#abcdef">x</b>') != ["#abcdef"]
            or _inline_literals("h+='<i style=\"background:'+x+\n  ';border:1px solid #abcdef\">'") != ["#abcdef"]
            or _undeclared(":root{--a:1}", "x{color:var(--b)}") != ["--b"]
            or not _pairs_bad({"--x": "#111111"}, [("--x", re.match(r"(#222222)", "#222222"), 1, "planted")])
            or _pairs_bad({"--x": "#111111"}, [("--x", re.match(r"(#111111)", "#111111"), 1, "planted")])
            or not _pairs_bad({}, [("--x", None, 1, "planted")])
            or _inline_literals('<svg><path fill="#123456"/></svg>') != ["#123456"]
            or _inline_literals("'<line stroke=\"'+x+'\"/>'+'<circle stroke=\"rgba(1,2,3,.5)\"/>'") != ["'+x+'", "rgba(1,2,3,.5)"]
            or _inline_literals('<path fill="none" stroke="currentColor"/>')
            or _value_named(":root{--c-123456:#123456;--m-140:140ms;--text-1:#F5EFE2}") != ["--c-123456", "--m-140"]
            or _value_named(":root{--text-1:#F5EFE2;--m-card:140ms;--sand-x:1}") != ["--sand-x"]
            or not _danger_text("a{color:var(--danger)}")
            or not _danger_text("x='<b style=\"color:'+(b?'var(--danger)':'var(--ok)')+'\">'")
            or _danger_text("a{background-color:var(--danger);border-color:var(--danger)}")
            or _danger_text("a{color:var(--danger-text)}")):
        return fails.append("check_tokens failed its own planted controls — its "
                            "scans cannot be trusted this run")
    # the app's own stylesheet — line 8's <style>__MLGCSS__</style> is the
    # MapLibre placeholder, and reading it as "the stylesheet" reads nothing
    m0 = re.search(r"<style>\s*:root\{", src)
    if not m0:
        return fails.append("token layer (A208): no <style> block opening with :root")
    a = m0.start()
    css = src[a:src.index("</style>", a)]
    script = src[src.index("</style>", a):]
    bad = []
    lit = _css_literals(css)
    if lit:
        bad.append(f"{len(lit)} colour literal(s) in the stylesheet outside :root "
                   f"({', '.join(sorted(set(lit))[:5])}) — make it a token")
    inl = _inline_literals(script)
    if inl:
        bad.append(f"{len(inl)} colour literal(s) in template inline styles "
                   f"({', '.join(sorted(set(inl))[:5])}) — use var(--token)")
    und = _undeclared(css, script)
    if und:
        bad.append("var() of undeclared token(s): " + ", ".join(und[:6]))
    vn = _value_named(css)
    if vn:
        bad.append(f"{len(vn)} token(s) named after their value ({', '.join(vn[:5])}) — name the role (A215)")
    dt = _danger_text(css) + _danger_text(script)
    if dt:
        bad.append(f"{len(dt)} text colour(s) in the closed red ({dt[0][:48]}) — text uses --danger-text (A215)")
    root = dict((k, v.strip().upper()) for k, v in re.findall(
        r"(--[\w-]+)\s*:\s*([^;}]+)", " ".join(re.findall(r":root\{[^}]*\}", css))))
    # \b: PAL.fsclosed ends in "closed:" too
    pal_closed = re.search(r"\bclosed:'(#[0-9A-Fa-f]{6})'", script)
    route = re.search(r"id:'routeline'.*?'line-color':'(#[0-9A-Fa-f]{6})'", script, re.S)
    fat = re.search(r"color:(#[0-9A-Fa-f]{6});background:(#[0-9A-Fa-f]{6})", loader)
    fat_acc = re.search(r"color:(#[0-9A-Fa-f]{6});margin-bottom:14px", loader)
    # take 188 · A215 · the role names (take 187's --shut/--bone/--rail/--flag)
    pairs = [("--danger", pal_closed, 1, "PAL.closed"), ("--route", route, 1, "the route line"),
             ("--text-1", fat, 1, "the loader's fatal text"), ("--surface-0", fat, 2, "the loader's fatal ground"),
             ("--accent", fat_acc, 1, "the loader's fatal accent")]
    bad += _pairs_bad(root, pairs)
    if bad:
        return fails.append("token layer (A208): " + "; ".join(bad))
    notes.append(f"tokens: 0 colour literals outside :root, 0 in template styles or SVG "
                 f"fill/stroke, every var() declared ({len(root)} tokens), none named after "
                 f"its value, no text in the closed red; {len(pairs)} shared "
                 f"colours agree; planted controls caught")

# ── 4b1. One scale (take 188 · A215) ────────────────────────────────────────
# Take 187's stylesheet typed its sizes: sixteen spacings, fifteen radii, and
# the floating controls placed at 60, 86, 136 and 186 px, so moving one
# control meant retyping four. Take 188 puts type, spacing, radius, targets and
# the floating columns on tokens (docs/DESIGN-v4.md §5), and this keeps it
# there: outside :root, no px literal in font-size or font, radius, padding,
# margin, gap or min-height, and none in the top/left/right/bottom of a
# floating control — a var() fallback (var(--strip-h,64px)) is not a literal.
# Two named lists are allowed px, each with its reason: SCALE_EXEMPT (any
# value) and SCALE_NUDGES (1-2 px optical nudges only). Proved on planted
# rules every run. Take 188 · cold audit · an entry that no longer excuses a
# px value must leave its list (as check_glyphs holds TEXT_GLYPH_EXEMPT):
# a stale name would wave through the next px literal typed on it.
SCALE_PROPS = re.compile(r"^(?:font-size|font|border-radius|border-(?:top|bottom)-(?:left|right)-radius"
                         r"|padding(?:-(?:top|right|bottom|left))?|margin(?:-(?:top|right|bottom|left))?"
                         r"|gap|row-gap|column-gap|min-height)$")
SCALE_FLOATING = {".basebtn", "#c-mode", "#c-act", "#c-base", "#c-hd", "#readout",
                  ".maplibregl-ctrl-bottom-left", "#lyrpanel", "#actpanel", "#modepanel",
                  "#cmppanel", "#diagpanel", "#hudstats", "#alert", "#nav"}
SCALE_EXEMPT = {
    "#splash": "the boot splash's geometry is read from the logo artwork (A171)",
    "#sp-track": "the splash's progress bar spans the artwork's wordmark (A171)",
    "#sp-fill": "the splash's progress bar spans the artwork's wordmark (A171)",
}
SCALE_NUDGES = {
    "#nav-g": "2 px between the banner's two lines", ".phd": "2 px above a photo caption",
    ".maplibregl-ctrl-scale": "1 px under MapLibre's scale text", ".cell": "2 px under a stat",
    ".cell:first-child": "2 px inset of the first stat", ".v": "1 px above a stat value",
    "#panel": "2 px above the card text", ".meta": "1 px inside a meta tag",
    ".st .at": "2 px above a turn's running total", "#routes": "2 px above the route cards",
    ".prof": "2 px under the elevation profile", ".moderow": "2 px between a mode and its line",
    "#diagpanel .sect": "2 px under a section label", "#hudneedle": "-1 px centres the 2 px needle",
}


def _scale_faults(css, used=None, exempt=None, nudges=None):
    exempt = SCALE_EXEMPT if exempt is None else exempt
    nudges = SCALE_NUDGES if nudges is None else nudges
    used = {} if used is None else used
    body = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    body = re.sub(r":root\{[^}]*\}", "", body)
    body = re.sub(r"@font-face\s*\{[^}]*\}", "", body)
    out = []
    for sel, decls in re.findall(r"([^{}]+)\{([^{}]*)\}", body):
        sel = " ".join(sel.split())
        sels = [x.strip() for x in sel.split(",")]
        # an exemption excuses the rule's scale values, and is in use only
        # while it excuses one: counted on any px in the rule (a width, a
        # height), a name whose scale values had all moved to tokens stayed
        # "in use" and waved the next literal typed on it through
        # (review of the take-188 audit fixes)
        for d in decls.split(";"):
            if ":" not in d:
                continue
            prop, val = (x.strip() for x in d.split(":", 1))
            prop = prop.lower()
            if not (SCALE_PROPS.match(prop) or (prop in ("top", "left", "right", "bottom")
                                                and any(x in SCALE_FLOATING for x in sels))):
                continue
            v = val
            while True:   # drop var() fallbacks, innermost first
                v2 = re.sub(r"var\((--[\w-]+)\s*,[^()]*\)", r"var(\1)", v)
                if v2 == v:
                    break
                v = v2
            px = [float(n) for n in re.findall(r"(-?\d*\.?\d+)px\b", v)]
            if not px:
                continue
            if sel in exempt:
                used[sel] = used.get(sel, 0) + 1
                continue
            if sel in nudges and all(abs(n) <= 2 for n in px):
                used[sel] = used.get(sel, 0) + 1
                continue
            out.append(f"{sel} {{{prop}:{val}}}")
    return out


def check_scale():
    src = read("src", "app.html")
    if not src:
        return notes.append("scale: no src/app.html to read")
    planted = _scale_faults("a{font-size:13px}b{border-radius:5px}c{padding:7px}.basebtn{top:86px}"
                            "d{padding:var(--s-2)}:root{--s-2:8px}e{padding:var(--x,8px)}"
                            "#nav-g{gap:2px}f{gap:2px}#splash{gap:22px}.chip{width:30px}"
                            "#hudneedle{margin-left:-3px}@media (x){g{margin:0 3px}}")
    want = ["a {font-size:13px}", "b {border-radius:5px}", "c {padding:7px}", ".basebtn {top:86px}",
            "f {gap:2px}", "#hudneedle {margin-left:-3px}", "g {margin:0 3px}"]
    if planted != want:
        return fails.append("check_scale failed its own planted rules — its scan cannot be "
                            f"trusted this run (got {planted})")
    m0 = re.search(r"<style>\s*:root\{", src)
    if not m0:
        return fails.append("scale (A215): no <style> block opening with :root")
    css = src[m0.start():src.index("</style>", m0.start())]
    # the staleness rule, proved first: a nudge and an exemption that excuse
    # nothing in a planted sheet must be named, a used one must not
    pu = {}
    # (#f: an exempt rule whose only px is not a scale value is stale; #g:
    # one with a scale px is in use and its px is not reported)
    pf = _scale_faults("#a{gap:2px}#b{padding:0}#c{top:0}#f{height:7px;width:min(300px,62vw)}#g{gap:22px}", pu,
                       exempt={"#c": "planted", "#e": "planted", "#f": "planted", "#g": "planted"},
                       nudges={"#a": "planted", "#b": "planted", "#d": "planted"})
    pst = sorted(k for k in ("#a", "#b", "#c", "#d", "#e", "#f", "#g") if not pu.get(k))
    if pst != ["#b", "#c", "#d", "#e", "#f"] or pf:
        return fails.append(f"check_scale's staleness rule failed its planted lists (unused {pst}) — "
                            "it cannot be trusted this run")
    used = {}
    bad = _scale_faults(css, used)
    if bad:
        return fails.append(f"scale (A215): {len(bad)} px literal(s) off the scale — use a token "
                            f"(--t-*, --s-*, --r-*, --tap) or name the exemption: " + "; ".join(bad[:6]))
    stale = sorted(k for k in list(SCALE_EXEMPT) + list(SCALE_NUDGES) if not used.get(k))
    if stale:
        return fails.append(f"scale (A215): {len(stale)} named exemption(s) excuse no px value any more — "
                            "an exemption that no longer matches must leave the list: " + ", ".join(stale))
    notes.append(f"scale: type, spacing, radius, targets and the floating columns are on tokens; "
                 f"{len(SCALE_EXEMPT)} named exemptions, {len(SCALE_NUDGES)} named nudges, each still in use; "
                 f"planted rules and planted stale entries caught")


# ── 4b2. Pin badges say what they are (take 188 · A214) ─────────────────────
# The maintainer, 2026-09-24: "shape + glyph, onX-style". Take 187 drew every
# kind as the same circle with hand-stroked glyphs, and the table let a launch
# and a marina share colour and glyph, info and toilet too — five shared glyphs
# and twelve colour pairs too close to tell apart (44 faults, measured on take
# 187). One table decides the look (POIKIND s/c/g plus BADGE_PAD), and this
# holds it: the shape shows the family (a destination is never a service
# circle, a service never a destination teardrop, all four shapes in use),
# every kind has its own glyph and colour (CIE76, the study's ΔE), the white
# glyph reads on its fill, no badge reads as the accent, the mixed-stack
# neutral or the closure/dam red (A112), and every glyph a badge names is
# held: a Lucide name in LUCIDE, the one icon table (A216's fold, landmine
# 107; check_icons proves each string against lucide-static byte for byte,
# and this re-proves the ones a badge draws), or an apex-* draft in
# APEX_GLYPHS, drawn in Lucide's grammar. lucide-static absent is a FAIL: a
# check that skips is not a check (landmine 53). The file is read by
# _lucide_icon (below, with check_icons): one reader for both checks.


def _lab(h):
    h = h.lstrip("#")
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    X = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047
    Y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    Z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return (116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z)))


def _de76(a, b):
    return sum((p - q) ** 2 for p, q in zip(_lab(a), _lab(b))) ** 0.5


def _contrast(a, b):
    def lum(h):
        h = h.lstrip("#")
        c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    x, y = lum(a), lum(b)
    return (max(x, y) + .05) / (min(x, y) + .05)


def _badge_kinds(block):
    """{key: {field: value}} from a `k:{c:'#..',s:'drop',g:'x',d:1}` table;
    a `k:'other'` value is an alias and comes back as the string."""
    body = re.sub(r"/\*.*?\*/", "", block, flags=re.S)
    out = {}
    for k, fields in re.findall(r"([a-z]+):\s*\{([^{}]*)\}", body):
        f = dict(re.findall(r"(\w+):\s*'([^']*)'", fields))
        f.update({a: b for a, b in re.findall(r"(\w+):\s*([0-9.]+)", fields)})
        out[k] = f
    top = re.sub(r"\{[^{}]*\}", "{}", body)      # an alias sits at the top level only
    for k, v in re.findall(r"([a-z]+):\s*'([a-z-]+)'\s*[,}\n]", top):
        out.setdefault(k, v)
    return out


def _badge_glyphs(block):
    """{name: markup} of a glyph table (LUCIDE, APEX_GLYPHS), keys bare or
    quoted (hyphenated names), one per line."""
    return {(a or b): v for a, b, v in re.findall(
        r"^\s*(?:'([a-z0-9-]+)'|([a-z0-9]+))\s*:\s*'([^']*)'\s*,?\s*$", block, re.M)}


BADGE_SHAPES = {"drop", "circle", "square", "hex"}


def _badge_faults(kinds, glyphs, accent, mixed, shut):
    bad = []
    for k, f in kinds.items():
        s, g, c = f.get("s"), f.get("g"), f.get("c", "")
        if s not in BADGE_SHAPES:
            bad.append(f"{k}: shape {s!r} is not one of {sorted(BADGE_SHAPES)}")
        if f.get("d") == "1" and s == "circle":
            bad.append(f"{k}: a destination drawn as a service circle")
        if f.get("d") != "1" and s == "drop":
            bad.append(f"{k}: a service drawn as a destination teardrop")
        if g not in glyphs:
            bad.append(f"{k}: glyph {g!r} is in neither LUCIDE nor APEX_GLYPHS")
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", c):
            bad.append(f"{k}: colour {c!r} is not #RRGGBB")
            continue
        if _contrast(c, "#FFFFFF") < 4.5:
            bad.append(f"{k}: white glyph on {c} is {_contrast(c, '#FFFFFF'):.2f}:1 (< 4.5)")
        if _de76(c, accent) < 20:
            bad.append(f"{k}: {c} is ΔE {_de76(c, accent):.1f} from the accent (< 20)")
        if _de76(c, mixed) < 18:
            bad.append(f"{k}: {c} is ΔE {_de76(c, mixed):.1f} from the mixed-stack neutral (< 18)")
        if _de76(c, shut) < 20:
            bad.append(f"{k}: {c} is ΔE {_de76(c, shut):.1f} from the closure/dam red (< 20)")
    gl = {}
    for k, f in kinds.items():
        gl.setdefault(f.get("g"), []).append(k)
    bad += [f"glyph {g!r} shared by {', '.join(v)}" for g, v in gl.items() if len(v) > 1]
    ok = {k: f for k, f in kinds.items() if re.fullmatch(r"#[0-9A-Fa-f]{6}", f.get("c", ""))}
    ks = sorted(ok)
    for i, a in enumerate(ks):
        for b in ks[i + 1:]:
            d = _de76(ok[a]["c"], ok[b]["c"])
            same = ok[a].get("s") == ok[b].get("s")
            if d < (20 if same else 12):
                bad.append(f"{a} {ok[a]['c']} and {b} {ok[b]['c']} are ΔE {d:.1f} apart"
                           f"{' in the same shape (< 20)' if same else ' (< 12)'}")
    return bad


def _glyph_faults(glyphs, lucide):
    """Lucide-named entries byte-equal to lucide-static; apex-* entries drawn in
    Lucide's grammar (path/circle/line/rect on the 24 grid)."""
    bad = []
    for name, mk in glyphs.items():
        mk = re.sub(r"\s+", " ", mk).strip()
        if name.startswith("apex-"):
            els = re.findall(r"<(\w+)\b[^>]*/>", mk)
            if not els or set(els) - {"path", "circle", "line", "rect"}:
                bad.append(f"badge glyph {name}: elements {sorted(set(els))} — only path/circle/line/rect draw")
            nums = [float(v) for v in re.findall(r"-?\d*\.?\d+", " ".join(re.findall(r'"([^"]*)"', mk)))]
            if any(v < -24 or v > 24 for v in nums):
                bad.append(f"badge glyph {name}: a coordinate leaves the 24 grid")
            continue
        want = lucide(name)
        if want is None:
            bad.append(f"badge glyph {name}: no such icon in lucide-static")
        elif mk != want:
            bad.append(f"badge glyph {name}: differs from lucide-static's {name}.svg")
    return bad


def _glyph_table_faults(apex, lucide, src):
    """Landmine 107: one table per kind of glyph. A Lucide icon lives in LUCIDE
    only, an apex-* draft in APEX_GLYPHS only, and the take-187 ICONS and the
    step-6 BADGE_GLYPHS tables stay folded (take 188 · A216)."""
    bad = [f"APEX_GLYPHS holds '{k}', not an apex-* draft — a Lucide icon belongs in LUCIDE"
           for k in sorted(apex) if not k.startswith("apex-")]
    bad += [f"LUCIDE holds '{k}', an apex-* draft — it belongs in APEX_GLYPHS"
            for k in sorted(lucide) if k.startswith("apex-")]
    bad += [f"a second glyph table var {n} is back (landmine 107)"
            for n in ("ICONS", "BADGE_GLYPHS") if re.search(r"^var " + n + r"=\{", src, re.M)]
    return bad


def check_badges():
    src = read("src", "app.html")
    if not src:
        return
    if _lucide_icon("fuel") is None:
        return fails.append("pin badges (A214): node_modules/lucide-static is absent — "
                            "the pasted glyphs cannot be checked, and a check that "
                            "skips is not a check (landmine 53); run npm ci")
    # planted controls first: every fault kind must be caught on a planted table
    acc, mix, shut = "#E2570F", "#2B2926", "#C1121F"
    P = {"a": {"s": "drop", "d": "1", "g": "x", "c": "#1873B1"},
         "b": {"s": "drop", "d": "1", "g": "x", "c": "#1A75B3"},
         "c": {"s": "circle", "d": "1", "g": "y", "c": "#C9A227"},
         "e": {"s": "drop", "g": "nope", "c": "#E2570F"},
         "f": {"s": "square", "g": "z", "c": "#B82626"},
         "h": {"s": "hex", "g": "w", "c": "#2D2B28"},
         "i": {"s": "blob", "g": "v", "c": "#123"}}
    pf = " | ".join(_badge_faults(P, {"x", "y", "z", "w", "v"}, acc, mix, shut))
    want = ["a service drawn as a destination teardrop", "a destination drawn as a service circle",
            "'nope' is in neither LUCIDE nor APEX_GLYPHS", "glyph 'x' shared", "in the same shape",
            "2.42:1", "from the accent", "from the mixed-stack", "from the closure/dam red",
            "shape 'blob'", "is not #RRGGBB"]
    fuel = _lucide_icon("fuel")
    pg = _glyph_faults({"fuel": fuel.replace("M14", "M15", 1), "info": _lucide_icon("info"),
                        "zz-none": "<path d=\"M1 1\" />", "apex-q": "<ellipse cx=\"1\" />"},
                       _lucide_icon)
    pk = _badge_glyphs("var LUCIDE={\n  'waves-arrow-down':'<path d=\"M1 1\" />',\n"
                       "  fuel:'<path d=\"M2 2\" />'\n};")
    pt = [_glyph_table_faults({"fuel": fuel}, {}, ""), _glyph_table_faults({}, {"apex-th": "x"}, ""),
          _glyph_table_faults({}, {}, "var ICONS={\n};"), _glyph_table_faults({}, {}, "var BADGE_GLYPHS={\n};")]
    pp = _badge_kinds("{launch:'launch',\n access:{c:'#175A63',g:'waves-arrow-down',s:'drop',d:1}}")
    missed = [w for w in want if w not in pf]
    if (missed or len(pg) != 3 or "differs" not in pg[0]
            or set(pk) != {"waves-arrow-down", "fuel"} or not all(pt)
            or pp.get("launch") != "launch" or pp.get("access", {}).get("g") != "waves-arrow-down"):
        return fails.append("check_badges failed its own planted controls — "
                            f"missed {missed}, glyph faults {pg}, keys {sorted(pk)}, pad {pp}, "
                            f"one-table plants {[len(t) for t in pt]}")
    m = re.search(r"var POIKIND=\{(.*?)\n\};", src, re.S)
    ga = re.search(r"^var APEX_GLYPHS=\{(.*?)\n\};", src, re.S | re.M)
    gl = re.search(r"^var LUCIDE=\{(.*?)\n\};", src, re.S | re.M)
    pd = re.search(r"var BADGE_PAD=\{(.*?)\n\};", src, re.S)
    root = " ".join(re.findall(r":root\{[^}]*\}", src))
    a = re.search(r"--accent:\s*(#[0-9A-Fa-f]{6})", root)
    s = re.search(r"--danger:\s*(#[0-9A-Fa-f]{6})", root)
    x = re.search(r"^var STACK_MIXED='(#[0-9A-Fa-f]{6})';", src, re.M)
    miss = [n for n, v in (("var POIKIND={", m), ("var APEX_GLYPHS={", ga), ("var LUCIDE={", gl),
                           ("var BADGE_PAD={", pd),
                           ("--accent in :root", a), ("--danger in :root", s),
                           ("var STACK_MIXED='#......';", x)) if not v]
    if miss:
        return fails.append("pin badges (A214): cannot find " + ", ".join(miss))
    kinds = _badge_kinds(m.group(1))
    apex = _badge_glyphs(ga.group(1))
    lucide = _badge_glyphs(gl.group(1))
    glyphs = dict(lucide, **apex)
    pad = _badge_kinds(pd.group(1))
    bad = []
    if len(kinds) < 15:
        bad.append(f"only {len(kinds)} POIKIND kinds parsed (< 15) — the check would be vacuous")
    if not any("-" in k for k in lucide) or not apex:
        bad.append("no hyphenated LUCIDE key or no APEX_GLYPHS key parsed — quoted keys are being missed")
    bad += _glyph_table_faults(apex, lucide, src)
    bad += [f"'{k}' is in both LUCIDE and APEX_GLYPHS" for k in sorted(set(apex) & set(lucide))]
    table = dict(kinds)
    aliases = {}
    for k, v in pad.items():
        if isinstance(v, str):
            if v not in kinds:
                bad.append(f"BADGE_PAD {k} aliases {v!r}, which is not a POIKIND kind")
            aliases[k] = v
        else:
            table["pad-" + k] = v
    if not pad:
        bad.append("BADGE_PAD is empty")
    bad += _badge_faults(table, glyphs, a.group(1), x.group(1), s.group(1))
    used = {f.get("s") for f in table.values()}
    if used != BADGE_SHAPES:
        bad.append(f"shapes in use {sorted(used)} — all four families must be drawn")
    drops = [k for k, f in kinds.items() if f.get("s") == "drop"]
    pdrops = [k for k, v in pad.items() if (kinds.get(v, {}) if isinstance(v, str) else v).get("s") == "drop"]
    # MapLibre 5.24 rejects a match with an empty label array — the whole style
    if not drops or not pdrops:
        bad.append(f"BADGE_DROPS {drops} / PAD_DROPS {pdrops} empty — MapLibre rejects "
                   f"an empty match label array, and with it the style (landmine 52)")
    for n in ("BADGE_DROPS", "PAD_DROPS"):
        if not re.search(r"^var " + n + r"=.*\.filter\(", src, re.M):
            bad.append(f"{n} is not derived from the table (landmine 107)")
    drawn = {f.get("g") for f in table.values()}
    bad += _glyph_faults({g: glyphs[g] for g in sorted(drawn) if g in glyphs}, _lucide_icon)
    unused = sorted(set(apex) - drawn)
    if unused:
        bad.append(f"APEX_GLYPHS carries unused {', '.join(unused)}")
    if bad:
        return fails.append(f"pin badges (A214): {len(bad)} fault(s): " + "; ".join(bad[:10]))
    dmin = min(_de76(table[p]["c"], table[q]["c"]) for p in table for q in table if p < q)
    notes.append(f"pin badges: {len(table)} badges ({len(kinds)} kinds + "
                 f"{len(table) - len(kinds)} paddle, {len(aliases)} alias), four shapes by "
                 f"family, glyphs unique, ΔE76 ≥ {dmin:.1f} overall, white ≥ "
                 f"{min(_contrast(f['c'], '#FFFFFF') for f in table.values()):.2f}:1, clear of "
                 f"accent/mixed/closure red; {len(drawn)} badge glyphs ({len(drawn - set(apex))} "
                 f"from LUCIDE equal lucide-static, {len(drawn & set(apex))} apex drafts in Lucide's "
                 f"grammar), one glyph table; planted controls caught")


# ── 4b2. One icon table, no text glyphs, licences declared (take 188 · A216) ─
# Landmine 107: a copy of a table is not the table. The app's icon strings are
# pasted from lucide-static; this proves each one against the npm package's
# own file rather than trusting the paste, and that every meaning a control
# names resolves (ic() returns '' silently for an unknown key — nothing draws
# and nothing says so). Landmine 53: with no node_modules this FAILS; CI runs
# the gate after `npm ci`.
LUCIDE_DIR = os.path.join(ROOT, "node_modules", "lucide-static")


def _blank_comments(text, python=False):
    """Comments blanked, line numbers kept (a glyph or token in a comment is
    not on screen)."""
    blank = lambda m: re.sub(r"[^\n]", " ", m.group(0))
    s = re.sub(r"/\*.*?\*/", blank, text, flags=re.S)
    s = re.sub(r"<!--.*?-->", blank, s, flags=re.S)
    s = re.sub(r"(?m)^\s*//.*$", blank, s)
    if python:
        s = re.sub(r"(?m)^\s*#.*$", blank, s)
    return s


def _lucide_icon(name, root=LUCIDE_DIR):
    """lucide-static's icons/<name>.svg as the app pastes it: the element
    lines, trimmed, joined by one space (no <svg> wrapper, no licence
    comment). None when the file does not exist."""
    p = os.path.join(root, "icons", name + ".svg")
    if not os.path.exists(p):
        return None
    lines = [l.strip() for l in open(p, encoding="utf-8").read().split("\n")]
    return " ".join(l for l in lines if l.startswith("<")
                    and not l.startswith(("<svg", "</svg", "<!--")))


def _call_args(js, name):
    """The argument text of every call name(...), quote- and paren-aware."""
    for m in re.finditer(r"(?<![\w.$])" + name + r"\(", js):
        i = j = m.end()
        depth, q = 1, None
        while j < len(js) and depth:
            c = js[j]
            if q:
                if c == "\\":
                    j += 2
                    continue
                if c == q:
                    q = None
            elif c in "'\"":
                q = c
            elif c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
            j += 1
        yield js[i:j - 1]


def _top_args(a):
    out, depth, q, cur, k = [], 0, None, "", 0
    while k < len(a):
        c = a[k]
        if q:
            cur += c
            if c == "\\" and k + 1 < len(a):
                cur += a[k + 1]
                k += 2
                continue
            if c == q:
                q = None
        elif c in "'\"":
            q = c
            cur += c
        elif c in "([{":
            depth += 1
            cur += c
        elif c in ")]}":
            depth -= 1
            cur += c
        elif c == "," and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += c
        k += 1
    return out + [cur]


def _icon_refs(js):
    """Every meaning the app names. Literals only (a key built from an
    expression would escape this, so keys stay literal): __IC_x__ in markup;
    any quoted letters-only key inside ic()'s first argument, setChip()'s
    second and mk()'s second — ternaries included; `ic:'x'` table values; the
    turn keys in turnWord and the directions' first step."""
    lit = lambda a: re.findall(r"['\"]([a-z]+)['\"]", a)
    refs = set(re.findall(r"__IC_([a-z]+)__", js))
    for a in _call_args(js, "ic"):
        refs |= set(lit(_top_args(a)[0]))
    for name in ("setChip", "mk"):
        for a in _call_args(js, name):
            t = _top_args(a)
            if len(t) > 1:
                refs |= set(lit(t[1]))
    refs |= set(re.findall(r"\bic:'([a-z]+)'", js))
    tw = re.search(r"function turnWord\(.*?(?=\nfunction )", js, re.S)
    if tw:
        refs |= set(re.findall(r"'([a-z]+)'", tw.group(0)))
    refs |= set(re.findall(r"\.turn=[^;\n]*?\['[A-Z][^']*',\s*'([a-z]+)'\]", js))
    return refs


def _icon_faults(src, root=LUCIDE_DIR, extra=None):
    """All faults of the icon table in `src` against lucide-static at `root`."""
    faults = []
    js = _blank_comments(src)
    if not os.path.isdir(root):
        return ["node_modules/lucide-static is missing — run npm ci "
                "(the icon strings cannot be proved without it)"]
    nodes = json.load(open(os.path.join(root, "icon-nodes.json"), encoding="utf-8"))
    ver = json.load(open(os.path.join(root, "package.json"), encoding="utf-8"))["version"]
    mv = re.search(r"^var LUCIDE_V='([^']+)';", js, re.M)
    mo = re.search(r"^var ICON_OF=\{(.*?)\};", js, re.M | re.S)
    ml = re.search(r"^var LUCIDE=\{\n(.*?)\n\};", js, re.M | re.S)
    if not (mv and mo and ml):
        return ["no LUCIDE_V / ICON_OF / LUCIDE table in src/app.html"]
    if mv.group(1) != ver:
        faults.append(f"LUCIDE_V is {mv.group(1)} but node_modules/lucide-static is {ver}")
    for label, text in (extra or {}).items():
        if f"lucide-static {ver}" not in (text or "") and f"package {ver}" not in (text or ""):
            faults.append(f"{label} does not name lucide-static {ver}")
    pairs = re.findall(r"\b([a-z]+):'([a-z0-9-]+)'", mo.group(1))
    keys = [k for k, _ in pairs]
    icon_of = dict(pairs)
    for k in sorted({k for k in keys if keys.count(k) > 1}):
        faults.append(f"ICON_OF names meaning '{k}' twice")
    vals = [v for _, v in pairs]
    for v in sorted({v for v in vals if vals.count(v) > 1}):
        faults.append(f"ICON_OF gives the icon '{v}' more than one meaning (duplicate)")
    rows = ml.group(1).split("\n")
    lucide = {}
    for r in rows:
        m = re.match(r"^\s*'([a-z0-9-]+)':'(.*)',?\s*$", r)
        if not m:
            faults.append(f"LUCIDE row not understood: {r.strip()[:50]}")
            continue
        if m.group(1) in lucide:
            faults.append(f"LUCIDE holds '{m.group(1)}' twice")
        lucide[m.group(1)] = m.group(2)
    for name, markup in sorted(lucide.items()):
        if name not in nodes:
            faults.append(f"'{name}' is not a canonical Lucide {ver} name (an alias, or no such icon)")
            continue
        want = _lucide_icon(name, root)
        if markup != want:
            faults.append(f"LUCIDE['{name}'] differs from lucide-static's icons/{name}.svg")
        elif markup.count("<") != len(nodes[name]):
            faults.append(f"LUCIDE['{name}'] has {markup.count('<')} elements, icon-nodes {len(nodes[name])}")
    # take 188 · cold audit · a count a record states is the table's count:
    # the manifest's filenote said 61 (step 10) after the badge fold made it
    # 74, and the gate read the version from it but never the number
    for label, text in (extra or {}).items():
        for n in re.findall(r"\b(\d+) inner-SVG strings", text or ""):
            if int(n) != len(lucide):
                faults.append(f"{label} says {n} inner-SVG strings; LUCIDE holds {len(lucide)}")
    for k, v in sorted(icon_of.items()):
        if v not in lucide:
            faults.append(f"ICON_OF.{k} -> '{v}', which LUCIDE does not hold")
    badge = set()      # POIKIND's and BADGE_PAD's g: glyphs read LUCIDE too (A216's fold)
    for n in ("POIKIND", "BADGE_PAD"):
        mb = re.search(r"^var " + n + r"=\{(.*?)\n\};", js, re.S | re.M)
        if mb:
            badge |= set(re.findall(r"\bg:\s*'([a-z0-9-]+)'", mb.group(1)))
    for name in sorted(set(lucide) - set(vals) - badge):
        faults.append(f"LUCIDE['{name}'] is pasted but no meaning or badge uses it")
    refs = _icon_refs(js)
    for k in sorted(refs - set(icon_of)):
        faults.append(f"icon '{k}' is referenced but ICON_OF has no such meaning (it would draw nothing)")
    for k in sorted(set(icon_of) - refs):
        faults.append(f"ICON_OF.{k} is unreferenced — no control, marker or card names it")
    return faults


def check_icons():
    src = read("src", "app.html")
    if not src:
        return fails.append("src/app.html missing")
    if not os.path.isdir(LUCIDE_DIR):
        return fails.append("check_icons: node_modules/lucide-static is missing — run "
                            "npm ci (landmine 53: a check that cannot run fails)")
    extra = {"tools/manifest.py": read("tools", "manifest.py"),
             "www/licenses.txt": read("www", "licenses.txt")}
    base = _icon_faults(src, extra=extra)
    if base and base[0].startswith("no LUCIDE_V"):
        return fails.append("icons (A216): " + base[0])
    # the planted controls, every run: each must be reported by its own words
    js_in = lambda code: src[:src.rfind("</script>")] + "\n" + code + "\n" + src[src.rfind("</script>"):]
    m = re.search(r"^  'map':'<path d=\"M14\.106 ", src, re.M)
    plants = [
        ("a changed coordinate", src.replace("'map':'<path d=\"M14.106 ", "'map':'<path d=\"M14.107 ", 1),
         "differs from lucide-static"),
        ("a duplicated icon", src.replace("hybrid:'satellite'", "hybrid:'map'", 1), "duplicate"),
        ("an alias", src.replace("home:'house'", "home:'home'", 1).replace("  'house':'", "  'home':'", 1),
         "not a canonical"),
        ("ic('nosuch')", js_in("x=ic('nosuch');"), "'nosuch' is referenced"),
        ("a ternary key", js_in("x=ic(y?'map':'nosuchb');"), "'nosuchb' is referenced"),
        ("a setChip ternary", js_in("setChip('c-x',y?'map':'nosuchc','L');"), "'nosuchc' is referenced"),
        ("an unreferenced key", src.replace("mk('truck','truck')", "mk('truck','')", 1), "ICON_OF.truck is unreferenced"),
        ("a badge glyph no badge draws", src.replace("g:'anchor'", "g:'zzanchor'", 1),
         "LUCIDE['anchor'] is pasted but no meaning or badge uses it"),
        ("version 1.36.0", re.sub(r"var LUCIDE_V='[^']+'", "var LUCIDE_V='1.36.0'", src, count=1),
         "LUCIDE_V is 1.36.0"),
    ]
    missed = [label for label, planted, want in plants
              if planted == src or not any(want in f for f in _icon_faults(planted, extra=extra))]
    # the stated count: a record one short of the table must be named
    nrow = len(re.findall(r"^  '[a-z0-9-]+':'", src, re.M))
    pex = dict(extra, **{"planted manifest": f"{nrow - 1} inner-SVG strings, one per icon"})
    if not any(f"planted manifest says {nrow - 1} inner-SVG strings" in f for f in _icon_faults(src, extra=pex)):
        missed.append("a stale stated count")
    # a token inside a comment is not a reference
    if not m or any("zzcomment" in f for f in _icon_faults(js_in("/* __IC_zzcomment__ */"), extra=extra)):
        missed.append("a commented token (must NOT be read)")
    if missed:
        return fails.append("check_icons failed its own planted controls (" + ", ".join(missed)
                            + ") — the scan cannot be trusted this run")
    faults = base
    if faults:
        return fails.append("icons (A216): " + "; ".join(faults[:8])
                            + (f" … and {len(faults) - 8} more" if len(faults) > 8 else ""))
    ml = re.search(r"^var LUCIDE=\{\n(.*?)\n\};", src, re.M | re.S)
    n = len(re.findall(r"^  '[a-z0-9-]+':'", ml.group(1), re.M))
    notes.append(f"icons: {n} pasted Lucide strings (chrome and badges, one table) equal "
                 f"lucide-static's files, every name canonical, one meaning each, every "
                 f"reference resolves and every string is used; {len(plants) + 1} planted "
                 f"controls caught")


# Text glyphs as icons: ⛽ drew as an empty box in desktop Chrome, and offline
# there is no fallback font (landmine 30). Emoji draw a different picture on
# every phone. The ranges leave General Punctuation and Latin-1 alone
# (· — – … ° × ′ ″ are typography, not icons).
TEXT_GLYPH_RE = re.compile("[\u2190-\u21FF\u2300-\u23FF\u2460-\u24FF\u25A0-\u25FF\u2600-\u27BF"
                      "\u27F0-\u27FF\u2900-\u297F\u2B00-\u2BFF\U0001F000-\U0001FAFF\uFE0F"
                      "\u2139\u203C\u2049]")
# exactly two, BY SITE: the drawer's chevron (a hook render reads) and the
# summit mark, which is a map glyph in the APEX label pack (tools/glyphs.py)
TEXT_GLYPH_EXEMPT = (("#peek-chev", '<span id="peek-chev">&#x25BE;</span>'),
                ("the summit text-field", "'text-field':'\\u25B2'"))


def _decode_escapes(line):
    line = re.sub(r"\\u\{([0-9a-fA-F]+)\}", lambda m: chr(int(m.group(1), 16)), line)
    line = re.sub(r"\\u(d[89ab][0-9a-f]{2})\\u(d[c-f][0-9a-f]{2})",
                  lambda m: bytes.fromhex(m.group(1) + m.group(2)).decode("utf-16-be"), line, flags=re.I)
    line = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), line)
    line = re.sub(r"&#x([0-9a-fA-F]+);", lambda m: chr(int(m.group(1), 16)), line)
    line = re.sub(r"&#(\d+);", lambda m: chr(int(m.group(1))), line)
    return line


def _text_glyph_faults(src, loader):
    faults, used = [], {k: 0 for k, _ in TEXT_GLYPH_EXEMPT}
    for name, text, python in (("src/app.html", src, False), ("tools/build_app.py", loader, True)):
        for i, line in enumerate(_blank_comments(text or "", python).split("\n"), 1):
            if not TEXT_GLYPH_RE.search(_decode_escapes(line)):
                continue
            rest = line
            if name == "src/app.html":
                for k, snip in TEXT_GLYPH_EXEMPT:
                    if snip in rest:
                        used[k] += rest.count(snip)
                        rest = rest.replace(snip, "")
            hit = TEXT_GLYPH_RE.findall(_decode_escapes(rest))
            if hit:
                faults.append(f"{name}:{i} {''.join(sorted(set(hit)))} {line.strip()[:60]}")
    for k, _ in TEXT_GLYPH_EXEMPT:
        if used[k] != 1:
            faults.append(f"the exemption for {k} matched {used[k]} site(s), not 1 — "
                          "an exemption that no longer matches must leave the list")
    return faults


def check_glyphs():
    src, loader = read("src", "app.html"), read("tools", "build_app.py")
    if not src or not loader:
        return fails.append("check_glyphs: src/app.html or tools/build_app.py missing")
    catch = ["x='☆ Save';", "x='\\u2606 Save';", "<b>&#128266;</b>", "<span>&#x25BE;</span>",
             "x='\\ud83d\\udd0a';"]
    keep = "x='a · b — c – d … 5°';"
    missed = [p for p in catch if len(_text_glyph_faults(src + "\n" + p + "\n", loader))
              <= len(_text_glyph_faults(src, loader))]
    if len(_text_glyph_faults(src + "\n" + keep + "\n", loader)) != len(_text_glyph_faults(src, loader)):
        missed.append("typography (must NOT be caught)")
    if not _text_glyph_faults(src.replace('<span id="peek-chev">&#x25BE;</span>', '<span>&#x25BE;</span>'), loader):
        missed.append("the chevron moved off its site")
    if missed:
        return fails.append("check_glyphs failed its own planted controls (" + ", ".join(missed)
                            + ") — the scan cannot be trusted this run")
    faults = _text_glyph_faults(src, loader)
    if faults:
        return fails.append(f"text glyphs or emoji a rider would see ({len(faults)}; A216 — "
                            "use an icon or words): " + "; ".join(faults[:6]))
    notes.append(f"glyphs: no emoji or text-glyph icon in src/app.html or the loader; "
                 f"exactly {len(TEXT_GLYPH_EXEMPT)} exemptions by site ({', '.join(k for k, _ in TEXT_GLYPH_EXEMPT)}); "
                 f"{len(catch) + 2} planted controls behave")


def _ttf_name(blob, nid=0):
    """A name-table string (Windows platform, UTF-16BE) from a TrueType
    blob, stdlib only (check_ci_deps)."""
    import struct
    try:
        n = struct.unpack(">H", blob[4:6])[0]
        for i in range(n):
            tag, _, off, _ = struct.unpack(">4sIII", blob[12 + 16 * i:28 + 16 * i])
            if tag != b"name":
                continue
            _, count, so = struct.unpack(">HHH", blob[off:off + 6])
            for j in range(count):
                pid, _, _, nm, ln, o = struct.unpack(">6H", blob[off + 6 + 12 * j:off + 18 + 12 * j])
                if nm == nid and pid == 3:
                    return blob[off + so + o:off + so + o + ln].decode("utf-16-be")
    except Exception:
        return None
    return None


# The OFL 1.1 body, PREAMBLE to "…DEALINGS IN THE FONT SOFTWARE.", with its
# whitespace collapsed to single spaces. Pinned from the Debian copy in
# libgraphite2-3 (its words agree with appstream's and pango's copies, less
# their reflow's 'to,deleting,'). A header alone proves nothing: the first
# copy shipped here had '?' for both '--' and two joined words (fixer round 1).
OFL_END = "DEALINGS IN THE FONT SOFTWARE."
OFL_BODY_SHA256 = "65a67a379d9157a5d3e26b95313206afe983db9743688fc98d9545c9f24bbe7d"
OFL_SECTIONS = ("PREAMBLE", "DEFINITIONS", "PERMISSION & CONDITIONS", "1) ", "2) ", "3) ",
                "4) ", "5) ", "TERMINATION", "DISCLAIMER")


def _licence_faults(lic_txt, lucide_licence, font_blob, src, manifest):
    import hashlib
    faults = []
    norm = lambda t: " ".join((t or "").split())
    if not lic_txt:
        return ["www/licenses.txt is missing"]
    if not lucide_licence:
        faults.append("node_modules/lucide-static/LICENSE is missing — run npm ci")
    elif norm(lucide_licence) not in norm(lic_txt):
        faults.append("www/licenses.txt does not carry the Lucide LICENSE verbatim")
    h = lic_txt.find("SIL OPEN FONT LICENSE Version 1.1")
    if h < 0:
        faults.append("www/licenses.txt has no SIL OFL 1.1 text")
    else:
        ofl = lic_txt[h:]
        a, b = ofl.find("PREAMBLE"), ofl.find(OFL_END)
        body = norm(ofl[a:b + len(OFL_END)]) if 0 <= a < b else ""
        lack = [x.strip() for x in OFL_SECTIONS if x not in body]
        if lack:
            faults.append("the OFL 1.1 text in www/licenses.txt lacks " + ", ".join(lack))
        if "?" in body:
            faults.append("the OFL 1.1 text in www/licenses.txt carries a '?' (a mangled '--')")
        if hashlib.sha256(body.encode()).hexdigest() != OFL_BODY_SHA256:
            faults.append("the OFL 1.1 text in www/licenses.txt is not the licence word for word "
                          "(sha256 of its whitespace-collapsed body differs); condition 2 wants "
                          "'this license' itself to travel with the font")
    cr = _ttf_name(font_blob or b"", 0)
    if not cr or not cr.startswith("Copyright"):
        faults.append("cannot read Barlow's copyright from assets/fonts/Barlow-SemiBold.ttf")
    else:
        if cr not in lic_txt:
            faults.append(f"www/licenses.txt does not carry Barlow's own copyright line ({cr[:50]})")
        holder = re.sub(r"\s*\(.*\)\s*$", "", cr).replace("Copyright ", "")   # "2017 The Barlow Project Authors"
        a = src.find("function sourcesCard(")
        card = src[a:src.find("\n}\n", a)] if a >= 0 else ""
        sec = card[card.find("SOFTWARE AND TYPE"):card.find("(PRIVACY_URL?")] if "SOFTWARE AND TYPE" in card else ""
        for w in ("Lucide", "ISC", "Feather", "MIT", "Barlow", "SIL Open Font License", holder, "LUCIDE_V"):
            if w not in sec:
                faults.append(f"the Data sources card's SOFTWARE AND TYPE section does not say '{w}'")
        if "http" in sec:
            faults.append("the licence section carries a URL (PROTOCOL §8: the card prints none)")
    for want in ("Lucide icons (pasted, not fetched)", "Barlow and Barlow Condensed (committed, never fetched)"):
        i = (manifest or "").find(want)
        if i < 0 or '"phase": "vendored"' not in manifest[i:i + 1200]:
            faults.append(f"tools/manifest.py has no vendored entry '{want}'")
    return faults



# take 188 · step 13b · the MapLibre GL JS (BSD 3-Clause: a binary
# redistribution must reproduce its notice) and Capacitor (MIT) notices.
# No MapLibre LICENSE travels in www/vendor (ci/bundle.sh fetches three dist
# files) and maplibre-gl is not an npm dependency, so its text is pinned by
# the sha256 of its whitespace-collapsed LICENSE.txt as published with
# 5.24.0 (the npm tarball's copy equals unpkg's; the tarball's dist files
# equal www/vendor's). Capacitor's texts are read from node_modules, one per
# @capacitor/* runtime dependency, at the installed version.
MAPLIBRE_LICENCE_SHA256 = "0ad4579744ea0949f886a697deb1bca33959e962888d90bc7a6ad97e88adc5d0"
MAPLIBRE_HEAD_RE = re.compile(r"\n== MapLibre GL JS \(maplibre-gl (\d+); this is the LICENSE\.txt "
                              r"published with (\d+)\.(\d+)\.(\d+)\) ==\n")
MAPLIBRE_VEND_RE = re.compile(r"@license ([^.\n]+)\. Full text of license: \S*/v(\d+)\.(\d+)\.(\d+)/LICENSE\.txt")
CAPACITOR_HEAD = "\n== Capacitor (the app runtime and its plugins) ==\n"
NOTICE_CARD_WORDS = ("MapLibre GL JS", "maplibregl.getVersion()", "BSD 3-Clause", "MapLibre contributors",
                     "Mapbox", "glfx.js", "Evan Wallace", "d3-color", "Mike Bostock", "Capacitor",
                     "Drifty Co.", "Ionic")


def _notice_block(lic_txt, head):
    """The text after a '== …' header line, up to the next '== ' header."""
    a = lic_txt.find(head)
    if a < 0:
        return None
    a += len(head)
    b = lic_txt.find("\n== ", a)
    return lic_txt[a:b if b >= 0 else len(lic_txt)]


def _notice_faults(lic_txt, src, manifest, caps, vend):
    """caps: [(name, version, LICENSE text or None)] for every @capacitor/*
    runtime dependency; vend: the head of www/vendor/maplibre-gl-csp.js, or
    None. Returns (faults, info)."""
    import hashlib
    faults, info = [], []
    norm = lambda t: " ".join((t or "").split())
    lic_txt = lic_txt or ""
    # MapLibre GL JS
    hd = MAPLIBRE_HEAD_RE.search(lic_txt)
    if not hd:
        faults.append("www/licenses.txt has no MapLibre GL JS section")
    else:
        body = norm(_notice_block(lic_txt, hd.group(0)))
        if hashlib.sha256(body.encode()).hexdigest() != MAPLIBRE_LICENCE_SHA256:
            faults.append("the MapLibre GL JS text in www/licenses.txt is not its LICENSE.txt word for word "
                          "(sha256 of the whitespace-collapsed section differs); BSD 3-Clause wants the notice "
                          "reproduced with a binary redistribution")
        m = MAPLIBRE_VEND_RE.search(vend or "")
        if vend is None:
            faults.append("www/vendor/maplibre-gl-csp.js is missing — run the vendor step (ci/bundle.sh); "
                          "the notice cannot be matched to the build")
        elif not m:
            faults.append("the vendored MapLibre build carries no '@license … LICENSE.txt' header")
        else:
            if m.group(1) != "3-Clause BSD":
                faults.append(f"the vendored MapLibre build says '@license {m.group(1)}', not 3-Clause BSD — "
                              "re-read its LICENSE.txt before shipping it")
            if m.group(2) != hd.group(1):
                faults.append(f"the vendored MapLibre is {'.'.join(m.groups()[1:])}, outside the major "
                              f"{hd.group(1)} www/licenses.txt names — re-read its LICENSE.txt")
            elif m.groups()[1:] != hd.groups()[1:]:
                info.append(f"MapLibre in www/vendor is {'.'.join(m.groups()[1:])}; the notice was read from "
                            f"{'.'.join(hd.groups()[1:])} (ci/bundle.sh fetches maplibre-gl@5)")
    # Capacitor
    cap = _notice_block(lic_txt, CAPACITOR_HEAD)
    if cap is None:
        faults.append("www/licenses.txt has no Capacitor section")
        cap = ""
    subs, parts = {}, re.split(r"^-- (.+) --$", cap, flags=re.M)
    for i in range(1, len(parts) - 1, 2):
        for nv in parts[i].split(", "):
            subs[nv] = norm(parts[i + 1])
    if not caps:
        faults.append("package.json lists no @capacitor/* runtime dependency — the Capacitor check read nothing")
    want = set()
    for name, ver, text in caps:
        want.add(f"{name} {ver}")
        if text is None:
            faults.append(f"node_modules/{name}/LICENSE is missing — run npm ci")
        elif f"{name} {ver}" not in subs:
            faults.append(f"www/licenses.txt's Capacitor section does not name {name} {ver} (the installed version)")
        elif subs[f"{name} {ver}"] != norm(text):
            faults.append(f"www/licenses.txt does not carry {name}'s LICENSE verbatim under its name")
    for nv in sorted(set(subs) - want):
        faults.append(f"www/licenses.txt names '{nv}', which is not an installed @capacitor/* runtime dependency")
    # the card and the manifest
    a = (src or "").find("function sourcesCard(")
    card = src[a:src.find("\n}\n", a)] if a >= 0 else ""
    sec = card[card.find("SOFTWARE AND TYPE"):card.find("(PRIVACY_URL?")] if "SOFTWARE AND TYPE" in card else ""
    for w in NOTICE_CARD_WORDS:
        if w not in sec:
            faults.append(f"the Data sources card's SOFTWARE AND TYPE section does not say '{w}'")
    i = (manifest or "").find('"name": "MapLibre GL JS"')
    if i < 0 or "www/licenses.txt" not in manifest[i:i + 700]:
        faults.append("tools/manifest.py's MapLibre GL JS entry does not point at www/licenses.txt")
    i = (manifest or "").find('"name": "Capacitor (the Android app runtime and its plugins)"')
    if i < 0 or "www/licenses.txt" not in manifest[i:i + 700]:
        faults.append("tools/manifest.py has no Capacitor entry pointing at www/licenses.txt")
    return faults, info


def check_licences():
    lic, src, man = read("www", "licenses.txt"), read("src", "app.html"), read("tools", "manifest.py")
    ll = os.path.join(LUCIDE_DIR, "LICENSE")
    lucide = open(ll, encoding="utf-8").read() if os.path.exists(ll) else None
    fp = os.path.join(ROOT, "assets", "fonts", "Barlow-SemiBold.ttf")
    blob = open(fp, "rb").read() if os.path.exists(fp) else None
    if lucide is None:
        return fails.append("check_licences: node_modules/lucide-static/LICENSE is missing — run npm ci")
    if not lic:
        return fails.append("licences (A216): www/licenses.txt is missing")
    base = _licence_faults(lic, lucide, blob, src, man)
    last = [l for l in lucide.strip().split("\n") if l.strip()][-1]
    cr = _ttf_name(blob or b"", 0) or ""
    fake = blob.replace(cr.encode("utf-16-be"), cr.replace("Barlow", "Barlaw").encode("utf-16-be")) if cr else b""
    # cut inside the Lucide block only: "SOFTWARE." also ends the OFL, and a
    # global replace would let the OFL test catch this plant for the wrong reason
    lb = lucide.rstrip()
    plants = [("the Lucide text's last line removed", lic.replace(lb, lb[:-len(last)]), lucide, blob, src, man),
              ("'Lucide' removed from the card", lic, lucide, blob, (src or "").replace("Lucide", "Lxcide"), man),
              ("a different copyright in the name table", lic, lucide, fake, src, man),
              ("the OFL body cut after its header",
               lic[:lic.find("SIL OPEN FONT LICENSE Version 1.1") + 33], lucide, blob, src, man),
              ("'substituting ? in part'", lic.replace("substituting -- in part or in whole --",
                                                       "substituting ? in part or in whole ?"), lucide, blob, src, man),
              ("'components,in' joined", lic.replace("components,\nin Original", "components,in Original"),
               lucide, blob, src, man)]
    missed = [p[0] for p in plants if len(_licence_faults(*p[1:])) <= len(base)]
    # take 188 · step 13b · MapLibre GL JS and Capacitor
    caps = []
    try:
        deps = json.load(open(os.path.join(ROOT, "package.json"), encoding="utf-8")).get("dependencies", {})
    except Exception:
        deps = {}
    for name in sorted(k for k in deps if k.startswith("@capacitor/")):
        d = os.path.join(ROOT, "node_modules", *name.split("/"))
        try:
            ver = json.load(open(os.path.join(d, "package.json"), encoding="utf-8"))["version"]
        except Exception:
            ver = "?"
        lp = os.path.join(d, "LICENSE")
        caps.append((name, ver, open(lp, encoding="utf-8").read() if os.path.exists(lp) else None))
    vp = os.path.join(ROOT, "www", "vendor", "maplibre-gl-csp.js")
    vend = open(vp, encoding="utf-8").read(600) if os.path.exists(vp) else None
    base2, info2 = _notice_faults(lic, src, man, caps, vend)
    hd = MAPLIBRE_HEAD_RE.search(lic)
    mlb = _notice_block(lic, hd.group(0)) if hd else ""
    mll = [l for l in mlb.strip().split("\n") if l.strip()][-1] if mlb.strip() else "\0"
    cut = mlb.rstrip()
    bump = [(n, v + ".9" if n == caps[-1][0] else v, t) for n, v, t in caps] if caps else caps
    edit = [(n, v, t.replace("Ionic", "Ionik") if t else t) for n, v, t in caps]
    extra = caps + [("@capacitor/camera", "8.0.0", caps[0][2] if caps else "MIT")]
    gone = [(n, v, None if i == 0 else t) for i, (n, v, t) in enumerate(caps)]
    plants2 = [("the MapLibre text's last line removed", lic.replace(cut, cut[:-len(mll)]), src, man, caps, vend),
               ("Mapbox's copyright line removed", lic.replace("Copyright (c) 2020, Mapbox\n", ""), src, man, caps, vend),
               ("'MapLibre' removed from the card", lic, (src or "").replace("MapLibre", "MapLxbre"), man, caps, vend),
               ("'Capacitor' removed from the card", lic, (src or "").replace("Capacitor 8", "Cxpacitor 8"), man, caps, vend),
               ("the runtime version dropped from the card", lic,
                (src or "").replace("maplibregl.getVersion()", "maplibregl.version"), man, caps, vend),
               ("a Capacitor package at a newer version", lic, src, man, bump, vend),
               ("a Capacitor LICENSE with a changed holder", lic, src, man, edit, vend),
               ("a new Capacitor plugin with no notice", lic, src, man, extra, vend),
               ("a Capacitor LICENSE missing from node_modules", lic, src, man, gone, vend),
               ("the vendored build under another licence", lic, src, man, caps,
                (vend or "").replace("@license 3-Clause BSD", "@license MIT")),
               ("the vendored build at major 6", lic, src, man, caps, re.sub(r"/v5\.", "/v6.", vend or "")),
               ("no vendored build", lic, src, man, caps, None),
               ("a notice for a package no longer installed", lic, src, man, caps[1:], vend),
               ("the manifest's MapLibre entry without its pointer", lic, src,
                (man or "").replace("Full text in www/licenses.txt, read from the", "Full text read from the"), caps, vend),
               ("no Capacitor entry in the manifest", lic, src,
                (man or "").replace("Capacitor (the Android app runtime", "Capxcitor (the Android app runtime"), caps, vend)]
    missed += [p[0] for p in plants2 if len(_notice_faults(*p[1:])[0]) <= len(base2)]
    # a minor drift within the major is named, not failed (ci/bundle.sh fetches maplibre-gl@5).
    # The plant is built from the NOTICE's version, not the vendor's: a vendor
    # already drifted must not make the control miss (take 188 step 13b3 review).
    vm = MAPLIBRE_VEND_RE.search(vend or "")
    dv = (vend[:vm.start(2)] + f"{hd.group(2)}.{int(hd.group(3)) + 1}.0" + vend[vm.end(4):]) if (vm and hd) else ""
    df, di = _notice_faults(lic, src, man, caps, dv)
    if not (vm and hd and df == base2 and any("MapLibre in www/vendor is" in x for x in di)):
        missed.append("a MapLibre minor drift is named and not failed")
    if base or base2:
        # a tree that already fails cannot tell a plant apart; say what fails
        return fails.append("licences (A216): " + "; ".join(base + base2)
                            + (f" ({len(missed)} planted controls not distinguishable on this tree)" if missed else ""))
    if missed:
        return fails.append("check_licences failed its own planted controls (" + ", ".join(missed)
                            + ") — it cannot be trusted this run")
    for x in info2:
        notes.append("licences: " + x)
    notes.append("licences: www/licenses.txt carries the Lucide LICENSE verbatim, Barlow's own "
                 "copyright line and the SIL OFL 1.1 word for word (pinned sha256); Data sources names both with no URL; "
                 f"two vendored manifest entries; {len(plants)} planted controls caught")
    notes.append(f"licences: MapLibre GL JS {'.'.join(hd.groups()[1:])} LICENSE.txt word for word (pinned sha256), "
                 f"the vendored build 3-Clause BSD at major {hd.group(1)}; {len(caps)} Capacitor packages' LICENSE "
                 f"verbatim at their installed versions; Data sources and the manifest name both; "
                 f"{len(plants2) + 1} more planted controls caught")


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
    # A batch sealed as one carries a range heading ("## Takes 151-152 -").
    # check_handoff already honoured it; this check did not, so the first take
    # after a batch reported the batch's own takes as gaps.
    cur = take() or 0
    for a, b in re.findall(r"^## Takes (\d+)\s*[-\u2013]\s*(\d+)", h, re.M):
        takes.extend(n for n in range(int(a), min(int(b), cur) + 1) if n not in takes)
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
def check_gauges_fallback():
    """take 179 (A191): the gauges step must survive a refusing NWIS the way
    ingest survives a refusing Overpass — retry, then the previous build's
    payload, then a spoken omission. Call-site checks, not definitions."""
    g = read("tools", "gauges.py")
    if not g:
        return fails.append("tools/gauges.py missing")
    if "for attempt in (1, 2)" not in g or "time.sleep(" not in g:
        return fails.append("gauges.py has no retry — one NWIS 503 stops the build (A191)")
    if 'os.path.exists("gauges_payload.json")' not in g or "previous build" not in g:
        return fails.append("gauges.py does not fall back to the cached payload (A191)")
    notes.append("gauges fallback: retry once -> previous build's payload -> spoken omission")


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
    # take 188 · A214 · with:[…] names layers a group governs beside its
    # derived set — a with: id the style lacks is the same dead toggle. (Step
    # 6 used it for the stack circle under All labels; A226 took it out: the
    # Map text row governs no layer, below.)
    def governed(block):
        return [lid for lst in re.findall(r"(?:ids|with):\[([^\]]*)\]", block)
                for lid in re.findall(r"'([a-z0-9-]+)'", lst)]
    if governed("{k:'x', ids:null, with:['zz-none']}") != ["zz-none"]:
        return fails.append("check_layer_control failed its planted control: "
                            "with:['zz-none'] was not read")
    bad = [lid for lid in governed(m.group(1)) if lid not in have]
    if bad:
        return fails.append(
            f"layers panel governs {', '.join(sorted(set(bad)))}, which the style "
            f"does not define — a toggle that moves nothing reads as a bug")
    # take 188 · A226 · "Map text" hides TEXT only (the maintainer,
    # 2026-09-25). Its row is txt:true and names no layer (an ids:/with: list
    # is a visibility toggle, which hid every pin and the stack circle in take
    # 187); lyrSet returns on g.txt before its visibility write, and textSet
    # writes no visibility — so switching text back on cannot show a group the
    # mode keeps off (A226's other half). Render proves the drawing; this holds
    # the code's shape where render does not run.
    def body(code, sig):
        mm = re.search(re.escape(sig) + r"(.*?)(?=\n(?:function |var ))", code, re.S)
        return mm.group(1) if mm else None
    def a226(groups, code):
        row = re.search(r"\{k:'labels'[^{}]*\}", groups)
        if not row:
            return "the layers panel has no labels (Map text) row"
        if "txt:true" not in row.group(0):
            return "the Map text row is not txt:true, so it toggles layer visibility"
        if re.search(r"(?:ids|with):\[", row.group(0)):
            return ("the Map text row names layers (ids:/with:), so it hides pins or "
                    "circles, not only text")
        ls, ts = body(code, "function lyrSet(g,on){"), body(code, "function textSet(on){")
        if ls is None or ts is None:
            return "lyrSet() or textSet() is missing"
        tb, vis = re.search(r"if\(g\.txt\)\{[^{}]*\breturn\b[^{}]*\}", ls), ls.find("'visibility'")
        if not tb or (vis >= 0 and tb.start() > vis):
            return "lyrSet does not return on g.txt before its visibility write"
        if "'visibility'" in ts:
            return "textSet writes layer visibility"
        return None
    # the rule's own controls, on a fixed minimal text (not the live source,
    # so a planted source cannot disarm them): the good text passes, each
    # plant fails
    G = "{k:'labels', h:'Map text', s:'x', ids:null, txt:true}"
    V = "  ids.forEach(function(id){map.setLayoutProperty(id,'visibility','none')})"
    C = ("function lyrSet(g,on){\n  if(g.txt){textSet(on);return}\n" + V + "}\n"
         "function textSet(on){\n  map.setLayoutProperty(id,'text-field','')}\nvar z=1;")
    ctl = {
        "with: on the row": (G.replace("txt:true", "with:['poi-stack-bg'], txt:true"), C),
        "ids: on the row": (G.replace("ids:null", "ids:['poi-stack']"), C),
        "no txt:true": (G.replace(", txt:true", ""), C),
        "g.txt return after the visibility write": (G, C.replace(
            "  if(g.txt){textSet(on);return}\n" + V, V + "\n  if(g.txt){textSet(on);return}")),
        "textSet writes visibility": (G, C.replace("'text-field','')", "'visibility','none')")),
    }
    if a226(G, C) is not None:
        return fails.append(f"check_layer_control: the A226 rule rejects its own "
                            f"good control ({a226(G, C)})")
    for lab, (gg, cc) in ctl.items():
        if (gg, cc) == (G, C) or a226(gg, cc) is None:
            return fails.append(f"check_layer_control failed its planted A226 control "
                                f"({lab}): the plant was not caught")
    grp = m.group(1)
    why = a226(grp, src)
    if why:
        return fails.append(f"layers panel: {why} — A226, take 188: Map text hides "
                            f"text only and writes no visibility")
    n = len(re.findall(r"\{k:'", m.group(1)))
    syms = len(re.findall(r"\{id:'[a-z0-9-]+',type:'symbol'", src))
    notes.append(f"layer control: {n} group(s) in one panel, label set derived "
                 f"from the style ({syms} symbol layers); Map text is text only, "
                 f"no visibility written (5 A226 controls caught)")




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
    else:
        # take 186 · A204: the document IS the render. Hand-appended sections
        # had drifted from manifest.py for ~40 takes and a regeneration would
        # have deleted the in-app declarations §8's allowlist cites.
        try:
            want = m.render()
            have = open(os.path.join(ROOT, "docs", "PROVISION.md"), encoding="utf-8").read()
            if want != have:
                wl, hl = want.splitlines(), have.splitlines()
                i = next((n for n in range(max(len(wl), len(hl)))
                          if n >= len(wl) or n >= len(hl) or wl[n] != hl[n]), 0)
                fails.append(f"docs/PROVISION.md is not manifest.py's render (first difference at "
                             f"line {i + 1}: {(hl[i] if i < len(hl) else '<end>')[:60]!r} vs "
                             f"{(wl[i] if i < len(wl) else '<end>')[:60]!r}) — run tools/manifest.py (A204)")
            else:
                notes.append("PROVISION.md equals manifest.py's render (A204)")
        except Exception as e:
            fails.append(f"manifest.render() failed: {e}")
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
    # take 181: 274 checks on the pinned Chrome take ~19-20 min in the build
    # sandbox, which sat exactly at the old 1200 s; the limit exists to catch
    # a HUNG render, and 30 min still does that. CI is faster.
    # Take 188, CI run 90: CI is not always faster. 607 checks took 34 min 52 s
    # on run 90's runner (run 89's, about 1.8x as fast, reached the same check
    # in 15.5 min; here the whole gate, render inside, took 885-928 s), past the
    # old 1800 s, so the gate's own render could not finish there (INFERRED;
    # landmine 235). 60 min still catches a hang; the suite must still PASS.
    r = subprocess.run(["node", rm], capture_output=True, text=True, timeout=3600)
    if r.returncode:
        bad = [l.strip() for l in r.stdout.splitlines() if "FAIL" in l][:2]
        fails.append("render failed: " + ("; ".join(bad) or r.stderr[-700:]))
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

# ── Play hardening (play kit) ──────────────────────────────────────────
# The artifact check lives in tools/android_check.py and runs in the apk job,
# where a built APK exists. This check makes sure it is WIRED — the check
# that is not called is the check that skipped (landmine 53) — and that the
# source-side patches android.py promises are still in the file. When a built
# APK is on disk (local proof builds), it runs the artifact check too.
def check_play():
    import subprocess, shutil
    sh = read("ci", "apk.sh") or ""
    if "tools/android_check.py" not in sh:
        fails.append("ci/apk.sh does not run tools/android_check.py — the Play "
                     "hardening check is not wired (play kit)")
    a = read("tools", "android.py") or ""
    for need in ("webContentsDebuggingEnabled\": false", "usesCleartextTraffic=\"false\"",
                 "versionCode {t}", "TARGET_SDK = 36", "MIN_SDK = 26"):
        if need not in a:
            fails.append(f"tools/android.py lost the Play patch: {need}")
    # take 183 · A183: R8 is on, versioned, and proven on the artifact — the
    # patch, the artifact assertions and the mapping hand-off must all exist.
    for need in ("def patch_r8", "APEX-R8 v1", "minifyEnabled true", "shrinkResources true",
                 "@android.webkit.JavascriptInterface <methods>"):
        if need not in a:
            fails.append(f"tools/android.py lost the R8 patch (A183): {need}")
    ac = read("tools", "android_check.py") or ""
    for need in ("def dex_missing", "def mapping_problem",
                 "Lcom/capacitorjs/plugins/geolocation/GeolocationPlugin;"):
        if need not in ac:
            fails.append(f"tools/android_check.py lost the R8 assertion (A183): {need}")
    for need in ('--mapping "$MAP"', 'play/mapping-take-$T.txt'):
        if need not in sh:
            fails.append(f"ci/apk.sh does not carry the R8 mapping through (A183): {need}")
    pkg = read("package.json") or ""
    if '"@capacitor/android": "^8' not in pkg:
        fails.append("package.json is not on @capacitor/android ^8 — targetSdk 36 "
                     "is tied to the Capacitor major (A170)")
    cfg = read("capacitor.config.json") or ""
    if '"webContentsDebuggingEnabled": false' not in cfg:
        fails.append("capacitor.config.json lacks explicit webContentsDebuggingEnabled:false")
    wf = read("ci", "build.yml") or ""
    m = re.search(r"node-version:\s*'?(\d+)", wf)
    if not m or int(m.group(1)) < 22:
        fails.append("ci/build.yml apk job pins Node < 22 — Capacitor 8 refuses it "
                     "(play kit). The workflow is hand-pasted: re-paste it.")
    for sec in ("PLAY_UPLOAD_KEYSTORE_B64", "PLAY_UPLOAD_STORE_PASS",
                "PLAY_UPLOAD_KEY_ALIAS", "PLAY_UPLOAD_KEY_PASS"):
        if f"{sec}: ${{{{ secrets.{sec} }}}}" not in wf:
            fails.append(f"ci/build.yml does not pass secrets.{sec} to ci/apk.sh (play kit)")
    if "steps.pkg.outputs.aab" not in wf:
        fails.append("ci/build.yml never publishes the AAB (play kit)")
    if re.search(r"-----BEGIN|PLAY_UPLOAD_KEYSTORE_B64\s*[:=]\s*['\"]?[A-Za-z0-9+/]{40}", sh):
        fails.append("ci/apk.sh appears to CONTAIN key material — credentials never live in the tree")
    bs = read("ci", "bundle.sh") or ""
    if "tools/play_assets.py" not in bs:
        fails.append("ci/bundle.sh does not generate the privacy page — Pages "
                     "publishes the bundle job's www/, so the policy URL Play "
                     "requires would 404 (play kit)")
    app = read("www", "app.js") or ""
    if "timeout:12000},function(pos,err)" in app:
        fails.append("www/app.js watchPosition still carries timeout:12000 — under "
                     "Capacitor 8 that errors a slow first fix (play kit)")
    r = subprocess.run([sys.executable, os.path.join(HERE, "android_check.py"),
                        "--selftest"], capture_output=True, text=True)
    if r.returncode:
        fails.append("android_check.py selftest failed: " + (r.stdout + r.stderr).strip()[-200:])
    apk = os.path.join(ROOT, "android", "app", "build", "outputs", "apk",
                       "release", "app-release.apk")
    if os.path.exists(apk) and (os.environ.get("ANDROID_HOME")
                                or os.environ.get("ANDROID_SDK_ROOT")):
        r = subprocess.run([sys.executable, os.path.join(HERE, "android_check.py"),
                            apk], capture_output=True, text=True)
        if r.returncode:
            fails.append("built APK fails android_check: " + r.stdout.strip()[-300:])
        else:
            notes.append("built APK passes android_check (versionCode=take, targetSdk 36)")
    if not any("Play" in f or "android_check" in f or "capacitor" in f.lower()
               or "R8" in f for f in fails):
        notes.append("play hardening wired: apk.sh -> android_check.py; android.py "
                     "patches present; R8 on with artifact assertions (A183)")


# ── take 184 · A196: the address index covers every county, or the build is not green ──
# Take 182 on Play carried 44 of 83 counties at full green (landmine 219).
# address.py now refuses a missing county and records its coverage in the
# payload; this holds the BUILT index to the region's declared county count,
# so a stale or older payload (no coverage keys) is refused too.
def check_address_coverage():
    import json as _json
    sys.path.insert(0, HERE)
    from region import R
    cand = [os.path.join(ROOT, "bundles", R.id, "address.json"),
            os.path.join(ROOT, "address_payload.json")]
    p = next((c for c in cand if os.path.exists(c)), None)
    if not p:
        return notes.append("address index not built yet (CI builds it)")
    d = _json.load(open(p, encoding="utf-8"))
    cov, exp = d.get("counties"), d.get("counties_expected")
    rel = os.path.relpath(p, ROOT)
    if not isinstance(cov, dict) or not exp:
        return fails.append(f"{rel} carries no county coverage — built by an address.py "
                            f"older than take 184; a partial index shipped green once (A196)")
    declared = _json.load(open(os.path.join(ROOT, "regions.json")))["regions"][R.id].get("counties")
    if declared and exp != declared:
        fails.append(f"{rel}: address.py found {exp} counties, regions.json declares "
                     f"{declared} for {R.id}")
    if len(cov) != exp:
        fails.append(f"{rel} covers {len(cov)} of {exp} counties (A196)")
    if sum(cov.values()) != d.get("n"):
        fails.append(f"{rel}: per-county counts sum to {sum(cov.values()):,}, n is {d.get('n'):,}")
    empty = sorted(f for f, n in cov.items() if not n)
    if empty:
        fails.append(f"{rel}: counties with zero segments: {', '.join(empty)}")
    if not any("A196" in f or rel in f for f in fails):
        notes.append(f"address index: {len(cov)}/{exp} counties, {d['n']:,} segments "
                     f"(TIGER{d.get('vintage', '?')})")



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


for fn in (check_handoff, check_stamps, check_offline, check_splash, check_scrub,
           check_style, check_palette, check_badges, check_tokens, check_scale, check_icons, check_glyphs,
           check_licences, check_machine_legality,
           check_ledgers, check_osm_fallback, check_gauges_fallback, check_drawn,
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
           check_address_coverage,
           check_tools,
           check_manifest, check_play):
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
