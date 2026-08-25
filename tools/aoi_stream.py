"""aoi_stream.py — iterate aoi.json elements without loading the file.

Take 117: the statewide aoi is 542 MB in a 3 GB sandbox. json.load of it needs
4-5 GB and meets the OOM killer; graph.py was doing it twice (once just to
check non-emptiness). This scanner walks the byte stream, tracking brace depth
and string state, and yields one element dict at a time — peak memory is one
element, not one state.

The writer (osm_local.build_stream / json.dump) emits standard JSON, so this
must handle nested objects, arrays and quoted strings with escapes. It does not
handle anything else, because aoi.json contains nothing else.
"""
import json


def elements(path="aoi.json", chunk=1 << 22):
    with open(path, "r") as f:
        buf = f.read(chunk)
        # find the elements array
        i = buf.find('"elements"')
        while i < 0:
            more = f.read(chunk)
            if not more:
                return
            buf = buf[-64:] + more
            i = buf.find('"elements"')
        i = buf.find("[", i) + 1
        depth = 0
        instr = False
        esc = False
        start = None
        while True:
            n = len(buf)
            j = i
            while j < n:
                c = buf[j]
                if instr:
                    if esc:
                        esc = False
                    elif c == "\\":
                        esc = True
                    elif c == '"':
                        instr = False
                elif c == '"':
                    instr = True
                elif c == "{":
                    if depth == 0:
                        start = j
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0 and start is not None:
                        yield json.loads(buf[start:j + 1])
                        start = None
                elif c == "]" and depth == 0:
                    return
                j += 1
            more = f.read(chunk)
            if not more:
                return
            if start is not None:
                buf = buf[start:] + more
                i = j - start
                start = 0
            else:
                buf = more
                i = 0


def count(path="aoi.json"):
    n = 0
    for _ in elements(path):
        n += 1
    return n
