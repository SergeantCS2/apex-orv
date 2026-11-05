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


def sha(path, buf=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(buf), b""):
            h.update(b)
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
    reads, writes, probes, listed, tried = set(), set(), set(), set(), set()
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
            elif ev in ("os.listdir", "os.scandir"):
                r = _rel(a[0] if a and a[0] is not None else ".", root)
                if r is not None:
                    listed.add(r)
            elif ev == "import":
                tp = _third_party(a[0], root)
                if tp:
                    tried.add(tp)
            elif ev in NET_EVENTS:
                blind.append(f"the network ({ev})")
            elif ev in PROC_EVENTS or ev.startswith("os.exec") or ev.startswith("os.spawn"):
                blind.append(f"a child process ({ev})")
            elif ev == "sqlite3.connect":
                blind.append("a sqlite database")
        except Exception:
            blind.append(f"an event the trace could not read ({ev})")

    _stat = os.stat

    def stat(p, *a, **k):
        try:
            r = _rel(p, root) if not isinstance(p, int) else None
            if r is not None:
                probes.add(r)
        except Exception:
            pass
        return _stat(p, *a, **k)

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
    os.stat = stat
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
        os.stat = _stat
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
    outputs = {r: sha(os.path.join(root, r)) for r in sorted(writes) if os.path.isfile(os.path.join(root, r))}
    ins = {}
    for r in sorted((reads | probes) - set(writes)):
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


def selftest():
    """The planted controls, in a scratch repo: a stamp is honoured only while
    everything holds, and each change below must re-run the step."""
    import shutil
    import subprocess
    import tempfile
    tmp = tempfile.mkdtemp(prefix="apex-stepstamp-")
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


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "run":
        # APEX_STAMP_ROOT: the selftest's scratch repo, never set by the pipeline
        sys.exit(run(sys.argv[2], sys.argv[3], sys.argv[4:], root=os.environ.get("APEX_STAMP_ROOT") or ROOT))
    if sys.argv[1:] == ["--selftest"]:
        bad, whys = selftest()
        for x in whys:
            print("  ok   re-runs: " + x)
        for x in bad:
            print("  FAIL " + x)
        print("STEPSTAMP SELFTEST " + ("FAILED" if bad else "PASSED"))
        sys.exit(1 if bad else 0)
    sys.exit(__doc__)
