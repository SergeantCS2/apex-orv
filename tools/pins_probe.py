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
"""
import json, math, os, subprocess, sys

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
process.stdout.write(JSON.stringify({modes:MODES,kinds:POIKIND}));
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
    return modes, kinds


MODES, POIKIND = app_tables()
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


def restack(mode, z, centre, cw, ch, rule="draw"):
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
                        "r": POIKIND.get(k, (9, 0, None))[0] * 10 + rec.get("pri", 3), "rec": rec})
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
            "maxn": max([len(b["m"]) for b in badges] or [0]), "_badges": badges}


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


def calib():
    print("screenshot calibration: Camp, 1908x880, rule=kinds (the pre-185 app), over the Grayling anchor")
    c = CENTRES.get("Grayling") or next(iter(CENTRES.values()))
    for z in (8.8, 9.0, 9.2, 9.6, 10.0, 10.4, 10.8):
        a = restack("camp", z, c, 1908, 880, "kinds")
        print(f"  z{z:4}: badges {a['badges']:3}  lone {a['lone']:3}  max {a['maxn']:3}")


if __name__ == "__main__":
    args = sys.argv[1:]
    rule = args[args.index("--rule") + 1] if "--rule" in args else None
    if "--on" in args: ON = set(args[args.index("--on") + 1].split(","))
    if "--off" in args: OFF = set(args[args.index("--off") + 1].split(","))
    skip = {rule} | (ON or set()) | (OFF or set())
    what = [a for a in args if not a.startswith("--") and a not in skip and "," not in a][:1] or ["table"]
    if what[0] == "calib":
        calib()
    else:
        for r in ([rule] if rule else ["kinds", "draw"]):
            table(r)
            print()
