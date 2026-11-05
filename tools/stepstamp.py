#!/usr/bin/env python3
"""take 195 · A207 · a compute step skips only when everything it read is the same.

The maintainer approved the design 2026-11-05 (AGENDA A207). CI restores the
region's payloads from its cache, yet seven compute steps re-ran on every
build (run 110: graph 431 s, corridor 260 s, landcover 88 s, poi 81 s, pack
78 s, contour 64 s, emit_graph 36 s, about 17 min; hazards joined them at
take 194). A payload that exists is exactly what hid four broken producers at
take 13 (landmine 32), so a skip never keys on existence. It keys on what the
step READ, as observed while it ran:

  run    python3 tools/stepstamp.py run NAME TOOL [ARGS...]
         runs TOOL in this process (as `python3 TOOL ARGS` would) under an
         audit hook (PEP 578). Recorded: every file under the repo it opens,
         every path it stats (exists, isfile, getsize: os.stat), every
         directory it lists, every file an osmium reader is handed, every
         module it imports or tries to import. Then step_stamps/NAME.json
         holds the content hash of each file it read or probed ("absent" for
         a path that was not there), each listed directory's names, each
         file it wrote with its hash, the version of each package it
         imported, its argv and the Python version.
  check  fresh(NAME, TOOL, ARGS) is true only when every one of those is
         the same now, the outputs included: a payload the cache restored
         from another build than the one the stamp describes re-runs.

No input list is written by hand: a hand list drifts (landmines 37, 170);
the trace is what the step did. What the trace cannot see writes no stamp,
so the step simply runs every build, as before:
  - a network connection or a child process (the step then has inputs
    that are not files here);
  - a C library that opens files itself, other than osmium's readers,
    which are wrapped (fiona, rasterio, GDAL, pyogrio, h5py, netCDF4,
    geopandas, sqlite3);
  - a failed run, which also deletes the old stamp first.
APEX_NO_SKIP=1 runs every step regardless (the clean run, PROTOCOL §6b).
"""
import hashlib
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIR = "step_stamps"
V = 1
# the compute steps that read only files (PROVEN by reading them, take 195:
# no network, no process, osmium the only C reader)
SKIPPABLE = ("hazards", "pack", "poi", "graph", "emit_graph", "contour", "corridor", "landcover")
OPAQUE = ("fiona", "rasterio", "osgeo", "pyogrio", "h5py", "netCDF4", "geopandas", "sqlite3", "_sqlite3")
NET_EVENTS = ("socket.connect", "socket.getaddrinfo", "urllib.Request", "http.client.connect")
PROC_EVENTS = ("subprocess.Popen", "os.system", "os.exec", "os.posix_spawn", "os.spawn", "os.fork",
               "os.forkpty", "pty.spawn")
SKIP_DIRS = ("__pycache__", ".git", "node_modules", DIR)


_MEMO = {}


def sha(path, buf=1 << 20):
    """A file's sha256, remembered within one process by (size, mtime): the
    pipeline checks eight stamps, three of them over the same 348 MB
    extract (the review of take 195)."""
    try:
        st = os.stat(path)
        k = (os.path.abspath(path), st.st_size, st.st_mtime_ns)
    except OSError:
        k = None
    if k and k in _MEMO:
        return _MEMO[k]
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(buf), b""):
            h.update(b)
    if k:
        _MEMO[k] = h.hexdigest()
    return h.hexdigest()


def stamp_path(name, root=ROOT):
    return os.path.join(root, DIR, f"{name}.json")


def _rel(p, root):
    """A path under root, relative and with / separators; None outside it or
    inside a directory never worth recording."""
    try:
        p = os.fspath(p)
    except TypeError:
        return None
    if isinstance(p, bytes):
        p = os.fsdecode(p)
    if not isinstance(p, str) or not p:
        return None
    a = os.path.abspath(p)
    if a != root and not a.startswith(root + os.sep):
        return None
    r = os.path.relpath(a, root).replace(os.sep, "/")
    if any(part in SKIP_DIRS for part in r.split("/")):
        return None
    return r


def state_of(root, rel):
    """What a recorded path is now: a file's content hash, "dir", or "absent"."""
    p = os.path.join(root, rel)
    if os.path.isfile(p):
        return sha(p)
    if os.path.isdir(p):
        return "dir"
    return "absent"


def names_of(root, rel, outputs):
    p = os.path.join(root, rel)
    if not os.path.isdir(p):
        return "absent"
    out = set(o.rsplit("/", 1)[-1] for o in outputs if o.rsplit("/", 1)[0] == rel)
    return hashlib.sha256("\n".join(sorted(n for n in os.listdir(p) if n not in out)).encode()).hexdigest()


def _dist_versions(mods):
    """{top-level module: "dist version" | "absent"} for third-party modules."""
    import importlib.metadata as md
    import importlib.util as iu
    try:
        pd = md.packages_distributions()
    except Exception:
        pd = {}
    out = {}
    for m in sorted(mods):
        try:
            if iu.find_spec(m) is None:
                out[m] = "absent"
                continue
        except Exception:
            out[m] = "absent"
            continue
        ds = pd.get(m) or []
        vs = []
        for d in sorted(set(ds)):
            try:
                vs.append(f"{d} {md.version(d)}")
            except Exception:
                vs.append(f"{d} ?")
        out[m] = "; ".join(vs) or "present"
    return out


def _third_party(name, root):
    """A top-level module that is neither the standard library nor this repo's."""
    top = name.split(".")[0]
    if not top or top in sys.stdlib_module_names or top in sys.builtin_module_names:
        return None
    if top.startswith("_"):
        return None
    if os.path.exists(os.path.join(root, "tools", top + ".py")):
        return None
    return top


def env_of(argv):
    return {"v": V, "argv": list(argv), "python": "%d.%d" % sys.version_info[:2],
            "env": {k: os.environ[k] for k in sorted(os.environ)
                    if k.startswith("APEX_") and k not in ("APEX_NO_SKIP", "APEX_STAMP_ROOT")}}


def run(name, tool, args, root=ROOT):
    """Run tool as __main__ under the trace; write the stamp only on a clean
    exit with nothing the trace cannot see. Returns the exit code."""
    root = os.path.abspath(root)
    sp = stamp_path(name, root)
    if os.path.exists(sp):
        os.remove(sp)                 # a failed run must never leave an old yes behind
    reads, writes, probes, listed, tried, gone = set(), set(), set(), set(), set(), set()
    blind = []
    tracing = [True]    # audit hooks cannot be removed: the stamp's own reads after the run are not the step's

    def note_open(path, mode, flags):
        r = _rel(path, root)
        if r is None:
            return
        w = False
        if isinstance(mode, str):
            w = any(c in mode for c in "wax+")
        elif isinstance(flags, int):
            w = bool(flags & (os.O_WRONLY | os.O_RDWR | os.O_APPEND | os.O_CREAT | os.O_TRUNC))
        (writes if w else reads).add(r)

    def hook(ev, a):
        if not tracing[0]:
            return
        try:
            if ev == "open":
                note_open(a[0], a[1] if len(a) > 1 else None, a[2] if len(a) > 2 else None)
            elif ev == "os.rename":
                # os.replace and shutil.move raise it too: the file a step
                # writes as x.part and renames is x
                d = _rel(a[1], root) if len(a) > 1 else None
                if d is not None:
                    writes.add(d)
                sr = _rel(a[0], root)
                if sr is not None:
                    gone.add(sr)
            elif ev == "os.remove":
                r = _rel(a[0], root)
                if r is not None:
                    gone.add(r)
            elif ev in ("os.listdir", "os.scandir"):
                r = _rel(a[0] if a and a[0] is not None else ".", root)
                if r is not None:
                    listed.add(r)
            elif ev == "import":
                tp = _third_party(a[0], root)
                if tp:
                    tried.add(tp)
            elif ev == "exec":
                # every module body runs through exec, and its code object
                # names its source even when it was loaded from a .pyc
                # (whose source is only stat'ed by the import system, never
                # through os.stat) or by spec_from_file_location without
                # ever entering sys.modules (emit_graph loads pack.py so)
                fn = getattr(a[0], "co_filename", None) if a else None
                # code compiled from a string names itself "<string>" and the
                # like: not a file, not an input (the review of take 195)
                r = _rel(fn, root) if fn and not str(fn).startswith("<") else None
                if r is not None:
                    reads.add(r)
            elif ev in NET_EVENTS:
                blind.append(f"the network ({ev})")
            elif ev in PROC_EVENTS or ev.startswith("os.exec") or ev.startswith("os.spawn"):
                blind.append(f"a child process ({ev})")
            elif ev == "sqlite3.connect":
                blind.append("a sqlite database")
        except Exception:
            blind.append(f"an event the trace could not read ({ev})")

    _stat, _lstat, _access = os.stat, os.lstat, os.access

    def probe(f):
        def w(p, *a, **k):
            try:
                r = _rel(p, root) if not isinstance(p, int) else None
                if r is not None:
                    probes.add(r)
            except Exception:
                pass
            return f(p, *a, **k)
        return w
    stat = probe(_stat)

    # osmium reads its file in C++, which no audit event sees: when the step
    # imports it, its entry points are wrapped to record the path they are
    # handed (a finder on sys.meta_path, so a step that never imports osmium
    # never loads it)
    def wrap_osmium(osmium):
        def rec(p):
            r = _rel(p, root)
            if r is not None:
                reads.add(r)
        SH = osmium.SimpleHandler
        _af = SH.apply_file
        def apply_file(self, filename, *a, **k):
            rec(filename)
            return _af(self, filename, *a, **k)
        SH.apply_file = apply_file
        for mod, attr in ((osmium, "apply"), (osmium, "FileProcessor"),
                          (getattr(osmium, "io", None), "Reader"), (getattr(osmium, "io", None), "File")):
            f = getattr(mod, attr, None) if mod is not None else None
            if f is None:
                continue
            def make(f):
                def w(src, *a, **k):
                    if isinstance(src, (str, bytes, os.PathLike)):
                        rec(src)
                    return f(src, *a, **k)
                return w
            setattr(mod, attr, make(f))

    import importlib.util as _iu

    class OsmiumFinder:
        def find_spec(self, fullname, path=None, target=None):
            if fullname != "osmium":
                return None
            sys.meta_path.remove(self)
            spec = _iu.find_spec("osmium")
            if spec is None or spec.loader is None:
                return spec
            _exec = spec.loader.exec_module

            def exec_module(module):
                _exec(module)
                try:
                    import osmium.io  # noqa: F401
                except Exception:
                    pass
                wrap_osmium(module)
            spec.loader.exec_module = exec_module
            return spec

    import runpy
    tool_abs = os.path.abspath(tool)
    t0 = time.time()
    if "osmium" not in sys.modules:
        sys.meta_path.insert(0, OsmiumFinder())
    else:
        wrap_osmium(sys.modules["osmium"])
    before = set(sys.modules)
    sys.addaudithook(hook)
    os.stat, os.lstat, os.access = stat, probe(_lstat), probe(_access)
    sys.argv = [tool_abs] + list(args)
    sys.path[0] = os.path.dirname(tool_abs)
    code = 0
    try:
        runpy.run_path(tool_abs, run_name="__main__")
    except SystemExit as e:
        code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
        if not isinstance(e.code, (int, type(None))):
            print(e.code, file=sys.stderr)
    finally:
        tracing[0] = False
        os.stat, os.lstat, os.access = _stat, _lstat, _access
        sys.stdout.flush()
    if code:
        return code
    mods = set()
    for k, m in list(sys.modules.items()):
        f = getattr(m, "__file__", None)
        r = _rel(f, root) if f else None
        if r is not None:
            reads.add(r)
        tp = _third_party(k, root) if k not in before else None
        if tp:
            mods.add(tp)
    opaque = sorted(m for m in mods | tried if m in OPAQUE)
    if opaque:
        blind.append("a C library that opens files itself (" + ", ".join(opaque) + ")")
    reads.add(_rel(tool_abs, root) or tool)
    if blind:
        print(f"   {name}: no stamp — it used {blind[0]}, which the trace cannot see; it runs every build")
        return 0
    # what the step wrote, renamed into place, or removed: a payload it
    # deleted must be absent before it may skip, or a cache could restore
    # one the step no longer makes (the review of take 195)
    outputs = {r: state_of(root, r) for r in sorted(writes | gone)
               if not os.path.isdir(os.path.join(root, r)) and (r in writes or not os.path.exists(os.path.join(root, r)))}
    ins = {}
    for r in sorted((reads | probes) - set(outputs)):
        ins[r] = state_of(root, r)
    st = dict(env_of(args), step=name, tool=_rel(tool_abs, root) or tool,
              t=time.strftime("%Y-%m-%dT%H:%MZ", time.gmtime()), secs=round(time.time() - t0, 1),
              inputs=ins, listed={r: names_of(root, r, outputs) for r in sorted(listed)},
              outputs=outputs, packages=_dist_versions(mods | tried))
    os.makedirs(os.path.dirname(sp), exist_ok=True)
    with open(sp + ".part", "w") as f:
        json.dump(st, f, indent=1, sort_keys=True)
    os.replace(sp + ".part", sp)
    big = sum(os.path.getsize(os.path.join(root, r)) for r, h in ins.items() if h not in ("dir", "absent"))
    print(f"   {name}: stamped — {len(ins)} input(s) ({big / 1048576:.0f} MB), {len(listed)} listing(s), "
          f"{len(outputs)} output(s), {len(st['packages'])} package(s)")
    return 0


def fresh(name, tool, args, root=ROOT):
    """(True, why) only when the stamp's every record holds now."""
    root = os.path.abspath(root)
    if os.environ.get("APEX_NO_SKIP"):
        return False, "APEX_NO_SKIP is set (the clean run)"
    sp = stamp_path(name, root)
    if not os.path.exists(sp):
        return False, "no stamp (a first build with stamps, a clean run, or the last run failed)"
    try:
        st = json.load(open(sp))
    except Exception as e:
        return False, f"the stamp is unreadable ({e})"
    want = env_of(args)
    for k in ("v", "argv", "python", "env"):
        if st.get(k) != want[k]:
            return False, f"its {k} changed ({st.get(k)!r} -> {want[k]!r})"
    if st.get("tool") != (_rel(os.path.abspath(tool), root) or tool):
        return False, "another tool"
    if not st.get("inputs"):
        return False, "the stamp records no inputs"
    t0 = time.time()
    for r, h in st["outputs"].items():
        now = state_of(root, r)
        if now != h:
            return False, f"its output {r} is {'gone' if now == 'absent' else 'not the one stamped'}"
    for r, h in st["inputs"].items():
        now = state_of(root, r)
        if now != h:
            return False, f"its input {r} changed ({'now absent' if now == 'absent' else 'was absent' if h == 'absent' else 'new content'})"
    for r, h in st.get("listed", {}).items():
        if names_of(root, r, st["outputs"]) != h:
            return False, f"the files in {r}/ changed"
    for m, v in _dist_versions(st.get("packages", {})).items():
        if st["packages"].get(m) != v:
            return False, f"package {m} is {v}, stamped {st['packages'].get(m)}"
    return True, (f"its {len(st['inputs'])} input(s), {len(st.get('listed', {}))} listing(s), "
                  f"{len(st['outputs'])} output(s) and {len(st.get('packages', {}))} package(s) equal the stamp of "
                  f"{st.get('t')} ({st.get('secs')} s saved; checked in {time.time() - t0:.1f} s)")


VOLATILE = ("t", "secs")


def cache_paths(root=ROOT):
    """The region cache's path list, read from the workflow (the gate holds
    restore and save equal)."""
    import yaml
    d = yaml.safe_load(open(os.path.join(root, "ci", "build.yml")))
    rs = [x for x in d["jobs"]["bundle"]["steps"] if str(x.get("uses", "")).startswith("actions/cache/restore@")]
    return [l.strip() for l in str(rs[0]["with"]["path"]).splitlines() if l.strip()]


def cached_files(root, pats):
    """{path: size} of every file the cache paths cover, the stamps' own
    directory left out (they are keyed by content below)."""
    import glob
    out = {}
    for p in pats:
        p = p[2:] if p.startswith("./") else p
        for m in glob.glob(os.path.join(root, p)):
            if os.path.isdir(m):
                for dp, _dn, fn in os.walk(m):
                    for f in fn:
                        fp = os.path.join(dp, f)
                        out[os.path.relpath(fp, root).replace(os.sep, "/")] = os.path.getsize(fp)
            elif os.path.isfile(m):
                out[os.path.relpath(m, root).replace(os.sep, "/")] = os.path.getsize(m)
    return {k: v for k, v in out.items() if not k.startswith(DIR + "/")}


def cache_key(root=ROOT, pats=None):
    """take 195 · A207 · the hash the region cache is saved under: every
    stamp without its time fields, and the name and size of every file the
    cache holds. A build whose steps all skipped and that fetched nothing
    new keys equal to the cache it restored, and saves nothing. New tiles,
    a DEM tile, a re-fetched extract or a re-run step change it, and the
    cache is saved with them (the review of take 195: keyed on the stamps
    alone, tiles a build fetched were thrown away). Prints why to stderr,
    against the record the restored cache carries."""
    import glob
    pats = pats if pats is not None else cache_paths(root)
    stamps = {}
    for fn in sorted(glob.glob(os.path.join(root, DIR, "*.json"))):
        n = os.path.basename(fn)[:-5]
        if n.startswith("_"):
            continue
        st = json.load(open(fn))
        stamps[n] = {k: v for k, v in st.items() if k not in VOLATILE}
    files = cached_files(root, pats)
    rec = {"stamps": stamps, "files": files}
    h = hashlib.sha256(json.dumps(rec, sort_keys=True).encode()).hexdigest()[:16]
    # what the step stamps say a step wrote, but no cache path carries: that
    # step can never skip (the review of take 195 found graph_raw.json so)
    unc = sorted({o for st in stamps.values() for o, v in st.get("outputs", {}).items()
                  if v != "absent" and o not in files})
    for o in unc:
        print(f"::warning::{o} is a stamped step's output that the region cache does not carry: "
              "that step re-runs every build (A207)", file=sys.stderr)
    rp = os.path.join(root, DIR, "_cache.json")
    try:
        was = json.load(open(rp))
    except Exception:
        was = None
    if was is None:
        print("cache key: no record from the restored cache (a first build with stamps)", file=sys.stderr)
    else:
        ch = sorted(n for n in set(stamps) | set(was.get("stamps", {})) if stamps.get(n) != was.get("stamps", {}).get(n))
        wf = was.get("files", {})
        new = [k for k in files if k not in wf]
        lost = [k for k in wf if k not in files]
        size = [k for k in files if k in wf and files[k] != wf[k]]
        print(f"cache key: stamps changed {ch or 'none'}; files new {len(new)}, gone {len(lost)}, "
              f"resized {len(size)}" + (f" (e.g. {', '.join((new + lost + size)[:4])})" if new or lost or size else ""),
              file=sys.stderr)
    os.makedirs(os.path.join(root, DIR), exist_ok=True)
    json.dump(rec, open(rp, "w"), sort_keys=True)
    return h


def selftest():
    """The planted controls, in a scratch repo: a stamp is honoured only while
    everything holds, and each change below must re-run the step."""
    import shutil
    import subprocess
    import tempfile
    tmp = tempfile.mkdtemp(prefix="apex-stepstamp-")
    # the clean run sets APEX_NO_SKIP and then runs the gate: the scratch
    # checks must not read it, nor take it away (the review of take 195)
    outer = os.environ.pop("APEX_NO_SKIP", None)
    try:
        root = os.path.realpath(tmp)
        os.makedirs(os.path.join(root, "tools"))
        os.makedirs(os.path.join(root, "data"))
        W = lambda p, s: open(os.path.join(root, p), "w").write(s)
        W("tools/helper.py", "K = 3\n")
        W("in.json", '{"a": 1}\n')
        W("data/x.txt", "x\n")
        W("tools/fake.py",
          "import json, os, sys\nfrom helper import K\n"
          "a = json.load(open('in.json'))\n"
          "opt = os.path.exists('opt.json')\n"
          "n = len(os.listdir('data'))\n"
          "json.dump({'a': a['a'] * K, 'opt': opt, 'n': n, 'argv': sys.argv[1:]}, open('fake_payload.json', 'w'))\n")
        W("tools/proc.py", "import subprocess\nsubprocess.run(['true'])\nopen('proc_payload.json', 'w').write('{}')\n")
        W("tools/bad.py", "open('in.json').read()\nraise SystemExit('bad step')\n")
        W("tools/side.py", "V = 1\n")
        W("tools/spec.py", "import importlib.util, os\n"
          "sp = importlib.util.spec_from_file_location('side', os.path.join(os.path.dirname(__file__), 'side.py'))\n"
          "m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)\n"
          "open('spec_payload.json', 'w').write(str(m.V))\n")
        me = os.path.abspath(__file__)

        def go(tool, *a):
            return subprocess.run([sys.executable, me, "run", tool.split("/")[-1][:-3], tool] + list(a),
                                  cwd=root, capture_output=True, text=True, env=dict(os.environ, APEX_STAMP_ROOT=root))

        def chk(tool="tools/fake.py", *a):
            cwd = os.getcwd()
            os.chdir(root)
            try:
                return fresh(tool.split("/")[-1][:-3], tool, list(a), root=root)
            finally:
                os.chdir(cwd)

        fails = []
        r = go("tools/fake.py", "--region", "x")
        if r.returncode or not os.path.exists(stamp_path("fake", root)):
            return [f"the traced run failed: {r.stdout[-300:]} {r.stderr[-300:]}"], []
        st = json.load(open(stamp_path("fake", root)))
        for need in ("in.json", "opt.json", "tools/helper.py", "tools/fake.py"):
            if need not in st["inputs"]:
                fails.append(f"the trace missed {need}: {sorted(st['inputs'])}")
        if st["inputs"].get("opt.json") != "absent":
            fails.append("an absent probed path is not recorded as absent")
        if "data" not in st["listed"] or "fake_payload.json" not in st["outputs"]:
            fails.append("the trace missed the listing or the output")
        if st["packages"]:
            fails.append(f"packages the step never imported are recorded: {st['packages']}")
        ok, why = chk("tools/fake.py", "--region", "x")
        if not ok:
            fails.append(f"an unchanged step did not skip: {why}")

        def plant(label, token, do, undo, *a):
            do()
            ok, why = chk("tools/fake.py", *(a or ("--region", "x")))
            undo()
            if ok:
                fails.append(f"control: {label} still skipped")
            elif token not in why:
                fails.append(f"control: {label} re-ran for another reason ({why})")
            return why

        whys = [
            plant("an input's content changed", "in.json", lambda: W("in.json", '{"a": 2}\n'), lambda: W("in.json", '{"a": 1}\n')),
            plant("a probed absent path appeared", "opt.json", lambda: W("opt.json", "{}"),
                  lambda: os.remove(os.path.join(root, "opt.json"))),
            plant("a file joined a listed directory", "data/", lambda: W("data/y.txt", "y"),
                  lambda: os.remove(os.path.join(root, "data", "y.txt"))),
            plant("an imported module changed", "tools/helper.py", lambda: W("tools/helper.py", "K = 4\n"),
                  lambda: W("tools/helper.py", "K = 3\n")),
            plant("the tool itself changed", "tools/fake.py",
                  lambda: W("tools/fake.py", open(os.path.join(root, "tools/fake.py")).read() + "#\n"),
                  lambda: W("tools/fake.py", open(os.path.join(root, "tools/fake.py")).read()[:-2])),
            plant("the output is not the one stamped", "fake_payload.json", lambda: W("fake_payload.json", "{}"),
                  lambda: W("fake_payload.json", json.dumps({}))),
            plant("another argv", "argv", lambda: None, lambda: None, "--region", "y"),
        ]
        # the output plant rewrote the payload: a fresh run restores the yes
        go("tools/fake.py", "--region", "x")
        if not chk("tools/fake.py", "--region", "x")[0]:
            fails.append("a re-run after the controls did not stamp again")
        os.environ["APEX_NO_SKIP"] = "1"
        try:
            if chk("tools/fake.py", "--region", "x")[0]:
                fails.append("control: APEX_NO_SKIP=1 still skipped")
        finally:
            del os.environ["APEX_NO_SKIP"]
        os.remove(stamp_path("fake", root))
        if chk("tools/fake.py", "--region", "x")[0]:
            fails.append("control: no stamp still skipped")
        # a module loaded by spec from a valid .pyc is an input too
        import py_compile
        py_compile.compile(os.path.join(root, "tools", "side.py"), doraise=True)
        go("tools/spec.py")
        st2 = json.load(open(stamp_path("spec", root)))
        if "tools/side.py" not in st2["inputs"]:
            fails.append(f"the trace missed a module loaded by spec from its .pyc: {sorted(st2['inputs'])}")
        W("tools/side.py", "V = 2\n")
        ok, why = chk("tools/spec.py")
        if ok or "tools/side.py" not in why:
            fails.append(f"control: a module loaded by spec changed and the step did not re-run for it ({why})")
        else:
            whys.append(why)
        # a payload written as .part and renamed into place is the output;
        # one the step deletes must be absent before it skips; code compiled
        # from a string is not an input
        W("tools/mv.py", "import os, collections\nP = collections.namedtuple('P', 'a b')\n"
                         "open('mv_payload.json.part', 'w').write('{}')\nos.replace('mv_payload.json.part', 'mv_payload.json')\n"
                         "os.path.exists('old_payload.json') and os.remove('old_payload.json')\n")
        W("old_payload.json", "{}")
        go("tools/mv.py")
        st3 = json.load(open(stamp_path("mv", root)))
        if "mv_payload.json" not in st3["outputs"] or st3["outputs"].get("old_payload.json") != "absent":
            fails.append(f"the trace missed a renamed output or a removed one: {st3['outputs']}")
        if any(k.startswith("<") for k in st3["inputs"]):
            fails.append(f"code compiled from a string was recorded as an input: {sorted(st3['inputs'])}")
        W("old_payload.json", "{}")
        ok, why = chk("tools/mv.py")
        os.remove(os.path.join(root, "old_payload.json"))
        if ok or "old_payload.json" not in why:
            fails.append(f"control: a payload the step deletes came back and it still skipped ({why})")
        else:
            whys.append(why)
        W("mv_payload.json", "[]")
        ok, why = chk("tools/mv.py")
        if ok or "mv_payload.json" not in why:
            fails.append(f"control: a renamed-into-place output changed and the step still skipped ({why})")
        else:
            whys.append(why)
        # the cache key: equal when nothing changed, new when a cached file
        # or a stamp did, and it names an output no cache path carries
        import io
        import contextlib
        go("tools/fake.py", "--region", "x")
        pats = ["./*_payload.json", "data", DIR]
        def key(root, pats, _e=None):
            with contextlib.redirect_stderr(_e or io.StringIO()):
                return cache_key(root, pats)
        k1 = key(root, pats)
        if key(root, pats) != k1:
            fails.append("the cache key differs with nothing changed")
        W("data/z.txt", "z")
        if key(root, pats) == k1:
            fails.append("control: a new file in a cached directory left the cache key unchanged")
        os.remove(os.path.join(root, "data", "z.txt"))
        if key(root, pats) != k1:
            fails.append("the cache key did not return when the file went")
        st = json.load(open(stamp_path("fake", root)))
        st["t"] = "2000-01-01T00:00Z"
        json.dump(st, open(stamp_path("fake", root), "w"))
        if key(root, pats) != k1:
            fails.append("a stamp's time alone changed the cache key")
        st["inputs"]["in.json"] = "0" * 64
        json.dump(st, open(stamp_path("fake", root), "w"))
        if key(root, pats) == k1:
            fails.append("control: a stamp whose record changed left the cache key unchanged")
        err = io.StringIO()
        key(root, ["data", DIR], err)
        if "fake_payload.json is a stamped step's output that the region cache does not carry" not in err.getvalue():
            fails.append("control: an output no cache path carries was not named")
        r = go("tools/proc.py")
        if r.returncode or os.path.exists(stamp_path("proc", root)) or "no stamp" not in r.stdout:
            fails.append(f"control: a step that starts a process was stamped ({r.stdout[-200:]})")
        go("tools/fake.py", "--region", "x")
        shutil.copyfile(stamp_path("fake", root), stamp_path("bad", root))
        r = go("tools/bad.py")
        if r.returncode == 0 or os.path.exists(stamp_path("bad", root)):
            fails.append("control: a failed step kept or wrote a stamp")
        try:
            import osmium  # noqa: F401
            W("tiny.osm", "<?xml version='1.0'?><osm version='0.6'><node id='1' lat='44.5' lon='-84.2' version='1'/></osm>\n")
            W("tools/osm.py", "import osmium\nclass H(osmium.SimpleHandler):\n  n = 0\n  def node(self, x): H.n += 1\n"
                              "H().apply_file('tiny.osm')\nopen('osm_payload.json', 'w').write(str(H.n))\n")
            go("tools/osm.py")
            st = json.load(open(stamp_path("osm", root)))
            if "tiny.osm" not in st["inputs"]:
                fails.append("the osmium wrapper did not record the file it read")
            W("tiny.osm", open(os.path.join(root, "tiny.osm")).read().replace("44.5", "44.6"))
            ok, why = chk("tools/osm.py")
            if ok or "tiny.osm" not in why:
                fails.append(f"control: an extract osmium read changed and the step did not re-run for it ({why})")
            if not str(st["packages"].get("osmium", "")).startswith("osmium "):
                fails.append(f"the osmium version is not recorded: {st['packages']}")
            whys.append("osmium's file is recorded and its change re-runs the step")
        except ImportError:
            whys.append("osmium absent here: its wrapper is not exercised")
        return fails, whys
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        os.environ.pop("APEX_NO_SKIP", None)
        if outer is not None:
            os.environ["APEX_NO_SKIP"] = outer


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "run":
        # APEX_STAMP_ROOT: the selftest's scratch repo, never set by the pipeline
        sys.exit(run(sys.argv[2], sys.argv[3], sys.argv[4:], root=os.environ.get("APEX_STAMP_ROOT") or ROOT))
    if sys.argv[1:] == ["key"]:
        # the workflow's save key: one line on stdout, the reasons on stderr
        print(cache_key())
        sys.exit(0)
    if sys.argv[1:] == ["--selftest"]:
        bad, whys = selftest()
        for x in whys:
            print("  ok   re-runs: " + x)
        for x in bad:
            print("  FAIL " + x)
        print("STEPSTAMP SELFTEST " + ("FAILED" if bad else "PASSED"))
        sys.exit(1 if bad else 0)
    sys.exit(__doc__)
