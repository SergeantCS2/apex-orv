#!/usr/bin/env python3
"""Pin-density instrument (take 184, A197). Read-only; a measurement, not a check.

Replicates restack() and the two pin layers' filters over the BUILT poi.json,
for a viewport at a zoom over a centre, and reports what the app would put on
screen: stack badges, lone pins, the share of badge members the pin layers
would draw at that zoom, badges whose members are all undrawable ("ghosts"),
and the largest count. Verified against a known-true case before its numbers
were believed (PROTOCOL §0): at z8.8–9.0 over Grayling in a 1908×880 Camp
view it gives 153–163 badges with counts to 38, and at z10.8 thirteen stacks
plus ten lone pins — the maintainer's screenshots of 2026-09-23.

The mode and kind tables are read from src/app.html by node at run time, so
this cannot drift from the app the way a copied list would (landmine 196).
The drawable rule is a transcription of modeFilter() and the two base
filters; render.mjs asserts the same rule inside the live app, which is the
truth this instrument is checked against each take.

  python3 tools/pins_probe.py table        today's rule vs the take-185 rule, five centres
  python3 tools/pins_probe.py calib        the screenshot calibration
  python3 tools/pins_probe.py --rule draw  only the take-185 rule
  python3 tools/pins_probe.py --off toilet --on food   a rider's choices (take 186)
  python3 tools/pins_probe.py sweep        take 187: how often the badge set changes per 0.1 zoom
  python3 tools/pins_probe.py anchors      take 187: badges the take-186 ranking anchored elsewhere
  --rank old   reproduce take 186's ranking, which read rank 0 and priority 0 as
               missing (A209) — the negative control for the fix

take 188 · A197 P3 · zoom bands. `--algo` picks the clusterer the numbers are for:
  flat    take 187's restack(): re-formed per view in screen pixels (the default,
          and the planted control: its within-band re-partition must read >= 15%)
  band    a bottom-up hierarchy of zoom bands, built once per mode in world
          pixels at each band's floor; a coarser band clusters the finer band's
          stacks, so zooming in across an edge can only split
  indep   the split-only control: every band clustered on its own, which must
          show merges at the edges, or the instrument is blind
The band edges are STACK_BANDS, read from src/app.html like MODES; `band` and
`indep` refuse to run without it unless `--edges a,b,...` names them (printed).
STACK_BANDS landed in take 188 (A197 P3, step 8) and ends at 17, the map's
maxZoom, so its top band is a point. Measured on that build: band within 0.0%,
0 merges, invariants 0 across 193,994 stacks; flat within 15-27%; indep merges
0/3/3/7/2. The committed badge-set column counts badges leaving the view as
churn and reads 10-27% even on the bands (landmine 225); read the re-partition
table.
  python3 tools/pins_probe.py sweep --algo band     the committed metric, plus
               re-partition within a band, over all steps and at the edges
  python3 tools/pins_probe.py sweep --repart        the same extra table for flat
  python3 tools/pins_probe.py invariants --algo band   anchors best-ranked, no
               service stacks below 11.4, members drawable at each band's floor
               and top, no two markers within R, merges, spread, markers per view
  python3 tools/pins_probe.py steps --mode camp --centre Grayling --cw 411 --ch 880
               per-step changed ids as JSON lines, in live-sweep.js's shape;
               --live <probe eval output> prints how many step flags agree
  --centre <anchor name from regions.json>   limits any command to that centre
"""
import json, math, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICES = {"food", "store", "fuel"}
CLUSTER_MAXZ = 11.4
PIN_FLOOR = 9.2


def centres():
    """Five centres from the region's anchors in regions.json — never
    coordinates typed here; the gate refuses hardcoded geography in tools
    (landmine 197). The take-184 measurement used Grayling, Traverse City,
    Houghton Lake, Marquette and Mio; the anchor set swaps the two that are
    not anchors for Cadillac and St. Helen."""
    cfg = json.load(open(os.path.join(ROOT, "regions.json")))
    reg = cfg["regions"][cfg["default"]]
    by = {a[0]: (a[1], a[2]) for a in reg.get("anchors", [])}
    out = {n: by[n] for n in ("Grayling", "Cadillac", "Marquette", "Mio", "St. Helen") if n in by}
    return out if len(out) >= 3 else {a[0]: (a[1], a[2]) for a in reg.get("anchors", [])[:5]}


CENTRES = centres()


def app_tables():
    """MODES and POIKIND as the app defines them, evaluated by node."""
    js = r"""
const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8');
function grab(start,end){const i=s.indexOf(start);if(i<0)throw new Error('no '+start);
  const j=s.indexOf(end,i);return s.slice(i,j+end.length)}
const MODES_SRC=grab('var MODES=[','\n];'), POIKIND_SRC=grab('var POIKIND={','\n};');
eval(MODES_SRC);eval(POIKIND_SRC);
/* take 188 · STACK_BANDS is optional here: it lands with A197 P3, and flat must
   still run on a source without it (the take-187 control). One line (landmine 137). */
let BANDS=null;const bi=s.indexOf('var STACK_BANDS=');
if(bi>=0){eval(s.slice(bi,s.indexOf(';',bi)+1));BANDS=STACK_BANDS;}
const MZ=/maxZoom:(\d+(?:\.\d+)?)/.exec(s);
process.stdout.write(JSON.stringify({modes:MODES,kinds:POIKIND,bands:BANDS,maxz:MZ?+MZ[1]:null}));
"""
    out = subprocess.run(["node", "-e", js, os.path.join(ROOT, "src", "app.html")],
                         capture_output=True, text=True, check=True).stdout
    d = json.loads(out)
    modes = {}
    for m in d["modes"]:
        kinds, off, z = m.get("kinds", []), m.get("off", []), m.get("z", {})
        assert all(k in kinds for k in off), f"{m['k']}: off lists a kind not in kinds"
        assert all(k in kinds and float(z[k]).is_integer() for k in z), f"{m['k']}: z must name listed kinds with integer zooms"
        modes[m["k"]] = (kinds, off, z)
    kinds = {k: (v.get("r", 9), 1 if v.get("d") else 0, v.get("z")) for k, v in d["kinds"].items()}
    return modes, kinds, d.get("bands"), d.get("maxz")


MODES, POIKIND, APP_BANDS, MAXZ = app_tables()
P = json.load(open(os.path.join(ROOT, "www", "bundle", "poi.json")))["p"]


def stack_radius(z):
    return 48 if z <= 8 else 24 if z >= 14 else 48 - (z - 8) * 4


def project(lon, lat, z):
    W = 512 * 2 ** z
    x = (lon + 180) / 360 * W
    s = math.sin(math.radians(lat))
    y = (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * W
    return x, y


ON, OFF = set(), set()   # a rider's choices, from --on / --off (applied to every mode)


def effective(mode):
    kinds, off, z = MODES[mode]
    return [k for k in kinds if (k in ON) or (k not in off and k not in OFF)]


def drawable(rec, mode, z):
    """Would the pin layers draw this place at zoom z? A transcription of
    pinDrawable() (take 186): steps in a filter are evaluated at the TILE zoom
    T = floor(z); the two layer minzooms at the fractional zoom."""
    kinds, off, ztab = MODES[mode]
    k = rec["k"]
    if k not in effective(mode):
        return False
    T = math.floor(z)
    unz = 12 if mode == "water" else 13.5
    if k in ("launch", "beach") and not rec.get("n") and T < unz:
        return False
    r, d, kz_default = POIKIND.get(k, (9, 0, None))
    if d and z < PIN_FLOOR:
        return False
    if not d and z < 11.4:
        return False
    kz = ztab.get(k, kz_default)
    if kz is not None:
        return T >= kz
    pri = rec.get("pri", 3)
    if d:
        return pri <= 0 or (T >= 10.5 and pri <= 1) or T >= 11.4
    return True


def rank_of(rec, k, rank):
    """take 187 · A209. 'app': rank 0 and priority 0 are the top ranks, as the
    app reads them since take 187 (and as this probe always did). 'old': the
    take-186 app's `(+r||9)*10+(+pri||3)`, which read both zeros as missing."""
    r, pri = POIKIND.get(k, (9, 0, None))[0], rec.get("pri", 3)
    if rank == "old":
        return (r or 9) * 10 + (pri or 3)
    return r * 10 + pri


def restack(mode, z, centre, cw, ch, rule="draw", rank="app"):
    """rule='kinds': the pre-185 pool (every kind the mode lists, services out
    below 11.4). rule='draw': the take-185 pool (what the layers would draw,
    nothing below the floor)."""
    kinds, off, ztab = MODES[mode]
    R = stack_radius(z)
    cx, cy = project(centre[0], centre[1], z)
    pad = R + 8
    pts = []
    if rule == "draw" and z < PIN_FLOOR:
        pts = []
    else:
        for i, rec in enumerate(P):
            k = rec["k"]
            if rule == "kinds":
                if k not in kinds or (z < CLUSTER_MAXZ and k in SERVICES):
                    continue
            elif not drawable(rec, mode, z):
                continue
            x, y = project(rec["p"][0], rec["p"][1], z)
            x, y = x - cx + cw / 2, y - cy + ch / 2
            if x < -pad or y < -pad or x > cw + pad or y > ch + pad:
                continue
            pts.append({"id": i, "x": x, "y": y, "k": k,
                        "r": rank_of(rec, k, rank), "rec": rec})
    pts.sort(key=lambda q: q["r"])          # JS sort is stable; ties keep array order
    grid, stacks = {}, []
    for q in pts:
        gx, gy = math.floor(q["x"] / R), math.floor(q["y"] / R)
        best, bd = None, R
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for st in grid.get((gx + dx, gy + dy), ()):
                    d = math.hypot(st["x"] - q["x"], st["y"] - q["y"])
                    if d < bd:
                        bd, best = d, st
        if best:
            best["m"].append(q)
        else:
            ns = {"x": q["x"], "y": q["y"], "k": q["k"], "anchor": q, "m": [q]}
            stacks.append(ns)
            grid.setdefault((gx, gy), []).append(ns)
    inview = lambda q: 0 <= q["x"] <= cw and 0 <= q["y"] <= ch
    badges = [s for s in stacks if len(s["m"]) >= 2 and inview(s["anchor"])]
    singles = [s["m"][0] for s in stacks if len(s["m"]) == 1 and inview(s["m"][0])]
    lone = [q for q in singles if drawable(q["rec"], mode, z)]
    members = sum(len(b["m"]) for b in badges)
    drawn = sum(1 for b in badges for q in b["m"] if drawable(q["rec"], mode, z))
    ghost = sum(1 for b in badges if not any(drawable(q["rec"], mode, z) for q in b["m"]))
    return {"pool": len(pts), "badges": len(badges), "lone": len(lone), "markers": len(badges) + len(lone),
            "members": members, "drawn": drawn, "ghost": ghost,
            "maxn": max([len(b["m"]) for b in badges] or [0]), "_badges": badges,
            "_of": {q["id"]: s["anchor"]["id"] for s in stacks for q in s["m"]}}


def table(rule, modes=("camp", "ride", "water", "outdoors", "hunt"), zooms=(9, 10, 10.7, 11, 11.6, 12, 13, 13.7), cw=412, ch=915):
    eff = ", ".join(f"{m}:{len(effective(m))}/{len(MODES[m][0])}" for m in modes)
    print(f"rule={rule}  viewport {cw}x{ch}, mean over {len(CENTRES)} centres; effective pins {eff}")
    print(f"{'mode':9}{'z':>4} {'pool':>6} {'badges':>7} {'lone':>5} {'markers':>8} {'drawn%':>7} {'ghost':>6} {'maxn':>5}")
    for mode in modes:
        for z in zooms:
            rs = [restack(mode, z, c, cw, ch, rule) for c in CENTRES.values()]
            mean = lambda k: sum(r[k] for r in rs) / len(rs)
            drawn = 100 * sum(r["drawn"] for r in rs) / max(1, sum(r["members"] for r in rs))
            print(f"{mode:9}{z:4} {mean('pool'):6.0f} {mean('badges'):7.1f} {mean('lone'):5.1f} "
                  f"{mean('markers'):8.1f} {drawn:6.0f}% {mean('ghost'):6.1f} {max(r['maxn'] for r in rs):5}")


def _sig(r):
    return frozenset((b["anchor"]["id"], frozenset(q["id"] for q in b["m"])) for b in r["_badges"])


def sweep(modes=("camp", "ride", "water", "outdoors", "hunt"), cw=412, ch=915, rank="app",
          algo="flat", edges=None, repart=False):
    """take 187 · A197 P3's instrument: step the zoom 9.2 -> 14.0 by 0.1 over each
    centre and count the steps where the badge set (anchor + members) changes.
    'within' counts only steps that stay inside one tile zoom and cross no layer
    minzoom — the changes a rider sees on a small zoom with nothing new
    arriving; kind arrivals at the thresholds are A197's, not the clusterer's."""
    if algo == "flat":
        print(f"sweep 9.2->14.0 by 0.1, viewport {cw}x{ch}, rank={rank}, mean over {len(CENTRES)} centres")
    else:
        print(f"sweep 9.2->14.0 by 0.1, viewport {cw}x{ch}, rank=app, algo={algo}, "
              f"edges {edges_note(edges)}, mean over {len(CENTRES)} centres")
    print(f"{'mode':9} {'all steps':>10} {'within a tile zoom':>19}")
    zs = [round(9.2 + 0.1 * i, 1) for i in range(49)]
    for mode in modes:
        ch_all = ch_in = n_all = n_in = 0
        for c in CENTRES.values():
            prev = None
            for z in zs:
                sig = _sig(restack(mode, z, c, cw, ch, "draw", rank) if algo == "flat"
                           else restack_band(mode, z, c, cw, ch, algo, edges))
                if prev is not None:
                    pz, same_tile = prev[0], math.floor(prev[0]) == math.floor(z)
                    crosses = any(pz < t <= z for t in (PIN_FLOOR, CLUSTER_MAXZ))
                    n_all += 1; ch_all += sig != prev[1]
                    if same_tile and not crosses:
                        n_in += 1; ch_in += sig != prev[1]
                prev = (z, sig)
        print(f"{mode:9} {100 * ch_all / max(1, n_all):9.0f}% {100 * ch_in / max(1, n_in):18.0f}%")
    if algo != "flat" or repart:
        repartition(modes, cw, ch, rank, algo, edges)


def anchors(modes=("camp", "ride", "water", "outdoors", "hunt"), zooms=(9.5, 10.5, 11.5, 12.5, 13.5), cw=412, ch=915):
    """take 187 · A209's measurement: badges whose members are the same under both
    rankings but whose anchor — the member the badge sits on and shows — differs."""
    print(f"badges anchored differently by the take-186 ranking, viewport {cw}x{ch}, {len(CENTRES)} centres")
    for mode in modes:
        moved = total = 0
        for c in CENTRES.values():
            for z in zooms:
                new = {frozenset(q["id"] for q in b["m"]): b["anchor"]["id"] for b in restack(mode, z, c, cw, ch)["_badges"]}
                old = {frozenset(q["id"] for q in b["m"]): b["anchor"]["id"] for b in restack(mode, z, c, cw, ch, "draw", "old")["_badges"]}
                for m, a in new.items():
                    if m in old:
                        total += 1; moved += old[m] != a
        print(f"  {mode:9} {moved:4} of {total:4} badges ({100 * moved / max(1, total):.0f}%)")


# ── take 188 · A197 P3 · zoom bands (ported from the take-188 study's bands.py) ──
PLAN_EDGES = [9.2, 10, 11, 11.4, 12, 13, 14, 15, 16, 17]   # only to classify flat's steps
EDGES_ARG = None                                           # --edges a,b,... (printed when used)
_W0 = []


def w0(i):
    """A place's world pixels at z0 (512-px tiles); at zoom z multiply by 2**z."""
    if not _W0:
        _W0.extend(project(r["p"][0], r["p"][1], 0) for r in P)
    return _W0[i]


def band_edges(algo):
    """The edges a band algorithm uses: --edges, else the app's STACK_BANDS. flat
    only needs edges to say which steps stay inside a band; without STACK_BANDS
    it uses the plan's edges and says so."""
    if EDGES_ARG:
        return EDGES_ARG
    if APP_BANDS:
        return [float(e) for e in APP_BANDS]
    if algo == "flat":
        return PLAN_EDGES
    sys.exit(f"--algo {algo}: src/app.html has no STACK_BANDS (it lands with A197 P3) — "
             f"name the edges with --edges a,b,... to measure without it")


def edges_note(edges):
    src = ("--edges" if EDGES_ARG else "src/app.html STACK_BANDS" if APP_BANDS
           else "the plan's (no STACK_BANDS in src/app.html)")
    return ",".join(f"{e:g}" for e in edges) + f" ({src})"


def band_of(z, edges):
    b = None
    for i, e in enumerate(edges):
        if z + 1e-9 >= e:
            b = i
    return b


def band_rank(i):
    return (rank_of(P[i], P[i]["k"], "app"), i)


def greedy(points, zb, R):
    """points (rankkey, id, members): the app's one-pass rule in world pixels at
    zb — rank order; join the nearest seed within R, else become a seed."""
    s = 2 ** zb
    grid, stacks = {}, []
    for rk, pid, mem in sorted(points, key=lambda p: p[0]):
        x, y = w0(pid)[0] * s, w0(pid)[1] * s
        gx, gy = math.floor(x / R), math.floor(y / R)
        best, bd = None, R
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for st in grid.get((gx + dx, gy + dy), ()):
                    d = math.hypot(st["x"] - x, st["y"] - y)
                    if d < bd:
                        bd, best = d, st
        if best:
            best["m"].extend(mem)
        else:
            ns = {"x": x, "y": y, "a": pid, "m": list(mem)}
            stacks.append(ns)
            grid.setdefault((gx, gy), []).append(ns)
    return stacks


_LEVELS = {}


def levels(mode, algo, edges):
    """{band: stacks}, pools and pin -> anchor maps, memoized on the mode, the
    rider's choices and the edges. band: bottom-up, each coarser band clusters
    the finer band's stacks restricted to its own pool, seeded at each
    restriction's best-ranked member. indep: each band on its own."""
    key = (mode, algo, tuple(edges), frozenset(ON), frozenset(OFF))
    if key in _LEVELS:
        return _LEVELS[key]
    pools = [set(i for i, r in enumerate(P) if drawable(r, mode, e)) for e in edges]
    lv, prev = {}, None
    for b in range(len(edges) - 1, -1, -1):
        zb, pool = edges[b], pools[b]
        if algo == "indep" or prev is None:
            pts = [(band_rank(i), i, [i]) for i in pool]
        else:
            pts = []
            for st in prev:
                mem = [i for i in st["m"] if i in pool]
                if mem:
                    a = min(mem, key=band_rank)
                    pts.append((band_rank(a), a, mem))
        lv[b] = greedy(pts, zb, stack_radius(zb))
        prev = lv[b]
    ofs = {b: {i: st["a"] for st in lv[b] for i in st["m"]} for b in lv}
    _LEVELS[key] = (lv, pools, ofs)
    return _LEVELS[key]


def view(centre, z, cw, ch):
    cx, cy = project(centre[0], centre[1], z)
    return cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2


def inview(i, z, v):
    x, y = w0(i)[0] * 2 ** z, w0(i)[1] * 2 ** z
    return v[0] <= x <= v[2] and v[1] <= y <= v[3]


def band_of_map(mode, z, algo, edges):
    """pin -> anchor over the band's whole pool at z ({} below the first edge)."""
    b = band_of(z, edges)
    return {} if b is None else levels(mode, algo, edges)[2][b]


def restack_band(mode, z, centre, cw, ch, algo, edges):
    """restack()'s dict for a band algorithm: what the view at z shows."""
    b = band_of(z, edges)
    out = {"pool": 0, "badges": 0, "lone": 0, "markers": 0, "members": 0, "drawn": 0,
           "ghost": 0, "maxn": 0, "_badges": [], "_of": {}}
    if b is None:
        return out
    lv, pools, ofs = levels(mode, algo, edges)
    v = view(centre, z, cw, ch)
    pad = stack_radius(z) + 8
    vp = (v[0] - pad, v[1] - pad, v[2] + pad, v[3] + pad)
    badges, lone = [], []
    for st in lv[b]:
        if not inview(st["a"], z, v):
            continue
        if len(st["m"]) >= 2:
            badges.append({"anchor": {"id": st["a"]}, "m": [{"id": i, "rec": P[i]} for i in st["m"]]})
        elif drawable(P[st["a"]], mode, z):
            lone.append(st["a"])
    dr = lambda q: drawable(q["rec"], mode, z)
    out.update(pool=sum(1 for i in pools[b] if inview(i, z, vp)), badges=len(badges), lone=len(lone),
               markers=len(badges) + len(lone), members=sum(len(x["m"]) for x in badges),
               drawn=sum(1 for x in badges for q in x["m"] if dr(q)),
               ghost=sum(1 for x in badges if not any(dr(q) for q in x["m"])),
               maxn=max([len(x["m"]) for x in badges] or [0]), _badges=badges, _of=ofs[b])
    return out


def pin_map(mode, z, c, cw, ch, rank, algo, edges):
    if algo == "flat":
        return restack(mode, z, c, cw, ch, "draw", rank)["_of"]
    return band_of_map(mode, z, algo, edges)


def _changed(of0, of1, Q):
    return any(of0.get(i) != of1.get(i) for i in Q)


def _merges_splits(of0, of1, Q):
    """zooming from of0 to of1: a merge is an of1 group holding members of more
    than one of0 group; a split the reverse."""
    g0, g1 = {}, {}
    for i in Q:
        g0.setdefault(of0[i], set()).add(i)
        g1.setdefault(of1[i], set()).add(i)
    return (sum(1 for g in g1.values() if len({of0[i] for i in g}) > 1),
            sum(1 for g in g0.values() if len({of1[i] for i in g}) > 1))


def repartition(modes, cw, ch, rank, algo, edges):
    """Re-partition per 0.1 step: over the places the previous step pooled that
    are still in view (arrivals excluded), did any change its anchor? Split by
    steps inside one band and steps across an edge; merges and splits at edges."""
    edges = edges or band_edges(algo)
    print(f"re-partition per 0.1 step, 9.2->14.0, {cw}x{ch}, algo={algo}, edges {edges_note(edges)}; "
          f"Q = pooled at the previous step and in view now")
    print(f"{'mode':9} {'within a band':>14} {'all steps':>10} {'at edges':>9} {'merges':>7} {'splits':>7}")
    zs = [round(9.2 + 0.1 * i, 1) for i in range(49)]
    for mode in modes:
        n_in = c_in = n_e = c_e = mg = sp = 0
        for c in CENTRES.values():
            prev = None
            for z in zs:
                of = pin_map(mode, z, c, cw, ch, rank, algo, edges)
                if prev is not None:
                    pz, pof = prev
                    v = view(c, z, cw, ch)
                    Q = [i for i in pof if inview(i, z, v)]
                    chg = _changed(pof, of, Q)
                    if band_of(pz, edges) == band_of(z, edges):
                        n_in += 1; c_in += chg
                    else:
                        n_e += 1; c_e += chg
                        m_, s_ = _merges_splits(pof, of, [i for i in Q if i in of])
                        mg += m_; sp += s_
                prev = (z, of)
        print(f"{mode:9} {100 * c_in / max(1, n_in):13.1f}% {100 * (c_in + c_e) / max(1, n_in + n_e):9.1f}% "
              f"{100 * c_e / max(1, n_e):8.0f}% {mg:7} {sp:7}   (steps within {n_in}, at edges {n_e})")


def _pct(a, p):
    return a[min(len(a) - 1, int(p * len(a)))] if a else 0


def invariants(modes=("camp", "ride", "water", "outdoors", "hunt"), algo="band", cw=412, ch=915):
    """The band design's promises, checked over the whole state (a measurement
    the builder reads, not a gate): anchors are the best-ranked member; no
    service stacks below 11.4; every member drawable at its band's floor and
    top; no two markers within R at the floor or the top; no merges at edges.
    Then spread at band tops and markers per view against flat."""
    if algo == "flat":
        sys.exit("invariants: flat has no bands — use --algo band or --algo indep")
    edges = band_edges(algo)
    print(f"invariants, algo={algo}, edges {edges_note(edges)}, top of the last band z{MAXZ or edges[-1]:g}")
    total = nstacks = 0
    spreads = []
    for mode in modes:
        lv, pools, ofs = levels(mode, algo, edges)
        v = {"rank": 0, "service": 0, "drawable": 0, "near": 0, "merges": 0}
        for b in range(len(edges)):
            zb = edges[b]
            zt = round(edges[b + 1] - 0.01, 2) if b + 1 < len(edges) else max(zb, MAXZ or zb)
            for st in lv[b]:
                nstacks += 1
                best = min(st["m"], key=band_rank)
                v["rank"] += best != st["a"]
                if zb < CLUSTER_MAXZ and len(st["m"]) > 1:
                    v["service"] += any(not POIKIND.get(P[i]["k"], (9, 0, None))[1] for i in st["m"])
                v["drawable"] += sum(1 for i in st["m"]
                                     if not (drawable(P[i], mode, zb) and drawable(P[i], mode, zt)))
            for z in (zb, zt):
                R, sc, grid = stack_radius(z), 2 ** z, {}
                for st in lv[b]:
                    x, y = w0(st["a"])[0] * sc, w0(st["a"])[1] * sc
                    gx, gy = math.floor(x / R), math.floor(y / R)
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            v["near"] += sum(1 for (ox, oy) in grid.get((gx + dx, gy + dy), ())
                                             if math.hypot(ox - x, oy - y) < R - 1e-6)
                    grid.setdefault((gx, gy), []).append((x, y))
            if b:
                Q = [i for i in pools[b - 1] if i in ofs[b]]
                v["merges"] += _merges_splits(ofs[b - 1], ofs[b], Q)[0]
        bad = sum(v.values())
        total += bad
        print(f"  {mode:9} anchors not best-ranked {v['rank']}, service stacks below 11.4 {v['service']}, "
              f"members undrawable at floor/top {v['drawable']}, markers within R {v['near']}, "
              f"merges at edges {v['merges']}")
        for c in CENTRES.values():
            for b in range(len(edges) - 1):
                zt = round(edges[b + 1] - 0.05, 2)
                if zt > 14:
                    continue
                vw = view(c, zt, cw, ch)
                for st in lv[b]:
                    if len(st["m"]) < 2 or not inview(st["a"], zt, vw):
                        continue
                    ax, ay = w0(st["a"])[0] * 2 ** zt, w0(st["a"])[1] * 2 ** zt
                    spreads.append(max(math.hypot(w0(i)[0] * 2 ** zt - ax, w0(i)[1] * 2 ** zt - ay)
                                       for i in st["m"]))
    spreads.sort()
    print(f"spread at band tops (z <= 14, in view, {len(CENTRES)} centres, {cw}x{ch}): "
          f"p50/p95/max {_pct(spreads, .5):.0f}/{_pct(spreads, .95):.0f}/{spreads[-1] if spreads else 0:.0f} px")
    print(f"markers per view (badges + lone), mean over {len(CENTRES)} centres: flat -> {algo}")
    for mode in modes:
        row = []
        for z in (9.5, 10.0, 11.0, 12.0, 13.0, 13.9):
            f = sum(restack(mode, z, c, cw, ch)["markers"] for c in CENTRES.values()) / len(CENTRES)
            g = sum(restack_band(mode, z, c, cw, ch, algo, edges)["markers"] for c in CENTRES.values()) / len(CENTRES)
            row.append(f"z{z:g} {f:.1f}->{g:.1f}")
        print(f"  {mode:9} " + "  ".join(row))
    print(f"invariants: {total} violations across {nstacks} stacks")
    return total


def steps(modes, cw, ch, algo, rank="app", live=None):
    """Per-step flags in live-sweep.js's shape: candidates are the places in view
    at z9.2 (views nest when zooming in); at each step, q counts those in view and
    drawable at the previous zoom, ch those whose anchor changed."""
    edges = band_edges(algo) if algo != "flat" else None
    runs = []
    zs = [round(9.2 + 0.1 * k, 1) for k in range(49)]
    for mode in modes:
        for name, c in CENTRES.items():
            v0 = view(c, 9.2, cw, ch)
            cand = [i for i in range(len(P)) if inview(i, 9.2, v0)]
            prev, flags = None, []
            for z in zs:
                of = pin_map(mode, z, c, cw, ch, rank, algo, edges)
                if prev is not None:
                    v = view(c, z, cw, ch)
                    q = chg = 0
                    for i in cand:
                        if not inview(i, z, v) or not drawable(P[i], mode, prev[0]):
                            continue
                        q += 1
                        chg += prev[1].get(i, i) != of.get(i, i)
                    flags.append([prev[0], z, chg, q])
                prev = (z, of)
            runs.append({"mode": mode, "name": name, "algo": algo, "canvas": [cw, ch], "flags": flags})
            print(json.dumps(runs[-1]))
    if live:
        got = load_live(live)
        lr = {(r["mode"], r["name"]): r["flags"] for r in got.get("runs", [])}
        same = n = 0
        for r in runs:
            lf = lr.get((r["mode"], r["name"]))
            if not lf:
                continue
            for a, b in zip(r["flags"], lf):
                if abs(a[1] - b[1]) > 1e-6:
                    continue
                n += 1; same += (a[2] > 0) == (b[2] > 0)
        print(f"steps vs live ({live}, live canvas {got.get('canvas')}): {same} of {n} step flags agree "
              f"({100 * same / max(1, n):.1f}%)")


def load_live(path):
    """probe eval output, saved as-is: the JSON object starts at the first line
    that opens with "{"; a status line before it (the splash notice, or a stray
    log line) is skipped, never hand-edited out. Anything else is an error."""
    text = open(path).read()
    m = re.search(r"^\{", text, re.M)
    if not m:
        sys.exit(f"FAIL: no JSON object in {path} (is it probe eval output?)")
    got, _ = json.JSONDecoder().raw_decode(text, m.start())
    return got


def calib():
    print("screenshot calibration: Camp, 1908x880, rule=kinds (the pre-185 app), over the Grayling anchor")
    c = CENTRES.get("Grayling") or next(iter(CENTRES.values()))
    for z in (8.8, 9.0, 9.2, 9.6, 10.0, 10.4, 10.8):
        a = restack("camp", z, c, 1908, 880, "kinds")
        print(f"  z{z:4}: badges {a['badges']:3}  lone {a['lone']:3}  max {a['maxn']:3}")


if __name__ == "__main__":
    args = sys.argv[1:]
    val = lambda f, d=None: args[args.index(f) + 1] if f in args and args.index(f) + 1 < len(args) else d
    rule = val("--rule")
    if "--on" in args: ON = set(val("--on").split(","))
    if "--off" in args: OFF = set(val("--off").split(","))
    rank = val("--rank", "app")
    algo = val("--algo", "flat")
    if algo not in ("flat", "band", "indep"):
        sys.exit(f"--algo {algo}: flat, band or indep")
    if "--edges" in args:
        EDGES_ARG = [float(e) for e in val("--edges").split(",")]
    if "--centre" in args:
        cfg = json.load(open(os.path.join(ROOT, "regions.json")))
        by = {a[0]: (a[1], a[2]) for a in cfg["regions"][cfg["default"]].get("anchors", [])}
        if val("--centre") not in by:
            sys.exit(f"--centre {val('--centre')!r} is not an anchor in regions.json: {', '.join(sorted(by))}")
        CENTRES = {val("--centre"): by[val("--centre")]}
    cw, ch = int(val("--cw", 412)), int(val("--ch", 915))
    modes = tuple(val("--mode").split(",")) if "--mode" in args else ("camp", "ride", "water", "outdoors", "hunt")
    # take 188: every flag's VALUE is skipped, or `--algo band sweep` would run `table`
    skip = {val(f) for f in ("--rule", "--on", "--off", "--rank", "--algo", "--edges", "--centre",
                             "--cw", "--ch", "--mode", "--live") if f in args}
    what = [a for a in args if not a.startswith("--") and a not in skip and "," not in a][:1] or ["table"]
    if what[0] == "calib":
        calib()
    elif what[0] == "sweep":
        if algo == "flat" and "--cw" not in args and "--ch" not in args and "--mode" not in args:
            sweep(rank=rank, repart="--repart" in args)
        else:
            sweep(modes, cw, ch, rank, algo, band_edges(algo), "--repart" in args)
    elif what[0] == "anchors":
        anchors()
    elif what[0] == "invariants":
        sys.exit(1 if invariants(modes, algo, cw, ch) else 0)
    elif what[0] == "steps":
        steps(modes, cw, ch, algo, rank, val("--live"))
    else:
        for r in ([rule] if rule else ["kinds", "draw"]):
            table(r)
            print()
