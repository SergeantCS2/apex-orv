"""Build an SDF glyph pack, offline, from a TTF.

Landmine 4: MapLibre fetches glyph ranges from a `glyphs` URL and has no bundled
fallback — omit it and every text layer silently renders nothing. There is no CDN
allowed here (PROTOCOL §8), so the pack has to be generated and shipped.

Output is a Mapbox/MapLibre glyph PBF: hand-encoded protobuf, no dependency.

  message glyph    { uint32 id=1; bytes bitmap=2; uint32 width=3;
                     uint32 height=4; sint32 left=5; sint32 top=6;
                     uint32 advance=7 }
  message fontstack{ string name=1; string range=2; repeated glyph glyphs=3 }
  message glyphs   { repeated fontstack stacks=1 }
"""
import os
import base64, json, sys
import numpy as np
from PIL import Image, ImageFont, ImageDraw
from scipy.ndimage import distance_transform_edt

SIZE = 24        # what MapLibre expects
BUFFER = 3
RADIUS = 8.0
CUTOFF = 0.25    # shader compares against 192/255 -> the edge sits at 0.75


# ── protobuf primitives ────────────────────────────────────────────────────
def varint(n):
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        out.append(b | (0x80 if n else 0))
        if not n:
            return bytes(out)


def tag(field, wire):
    return varint((field << 3) | wire)


def fv(field, n):                      # varint field
    return tag(field, 0) + varint(n)


def fz(field, n):                      # zigzag sint32 field
    return tag(field, 0) + varint((n << 1) ^ (n >> 31))


def fb(field, b):                      # length-delimited field
    if isinstance(b, str):
        b = b.encode()
    return tag(field, 2) + varint(len(b)) + b


# ── SDF ────────────────────────────────────────────────────────────────────
def sdf(mask):
    """mask: bool array, True inside the glyph. Returns uint8 SDF with the
    edge at 192, matching what the MapLibre text shader expects."""
    if not mask.any():
        return np.full(mask.shape, int(255 * (0.75 - 1)), dtype=np.uint8)
    outside = distance_transform_edt(~mask)
    inside = distance_transform_edt(mask)
    d = np.where(mask, -inside, outside)          # negative inside
    v = 255.0 * (1.0 - CUTOFF - d / RADIUS)       # -> 192 at the edge
    return np.clip(np.round(v), 0, 255).astype(np.uint8)


# The typeface is a SOURCE asset, like the logo — vendored in the repo, not
# borrowed from whatever happens to be installed. It was an absolute path into
# my own container (/mnt/skills/...), so the pipeline ran here and died on the
# GitHub runner at step six with "cannot open resource" (landmine 81).
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def build(font_path, stack_name, chars):
    font = ImageFont.truetype(font_path, SIZE)
    glyphs = b""
    n = 0
    for ch in chars:
        cp = ord(ch)
        try:
            adv = int(round(font.getlength(ch)))
        except Exception:
            continue
        box = font.getbbox(ch)
        if box is None:
            box = (0, 0, 0, 0)
        x0, y0, x1, y1 = box
        gw, gh = max(0, x1 - x0), max(0, y1 - y0)

        if gw == 0 or gh == 0:                     # space and friends
            glyphs += fb(3, fv(1, cp) + fv(3, 0) + fv(4, 0) +
                            fz(5, 0) + fz(6, 0) + fv(7, adv))
            n += 1
            continue

        W, H = gw + 2 * BUFFER, gh + 2 * BUFFER
        img = Image.new("L", (W, H), 0)
        ImageDraw.Draw(img).text((BUFFER - x0, BUFFER - y0), ch, font=font, fill=255)
        mask = np.asarray(img) > 127
        bmp = sdf(mask).tobytes()

        # MapLibre's `top` is measured from the baseline, y up
        top = -(y0) + BUFFER
        glyphs += fb(3, fv(1, cp) + fb(2, bmp) + fv(3, W) + fv(4, H) +
                        fz(5, x0 - BUFFER) + fz(6, top - H) + fv(7, adv))
        n += 1

    stack = fb(1, stack_name) + fb(2, "0-255") + glyphs
    return fb(1, stack), n


if __name__ == "__main__":
    # U+25B2 BLACK UP-POINTING TRIANGLE is the summit marker (A76, take 94).
    # A character the map draws and the pack does not carry renders as a box or
    # as nothing at all, and MapLibre says so only in a console warning nobody
    # reads (landmine 30).
    CHARS = "".join(chr(c) for c in range(32, 127)) + "°′″–—‘’“”…×·▲"
    packs = {}
    # NationalPark is the typeface cut for National Park Service routed signage.
    # On a map of the Huron National Forest that is the actual vernacular of the
    # subject, not a default sans. OFL, so it ships inside the APK legally.
    # ONE fontstack on purpose: a single stack can be served from a static data:
    # URI, which avoids needing a custom protocol handler for glyph requests.
    for name, path in (
        ("APEX", os.path.join(ROOT, "assets", "fonts", "NationalPark-Bold.ttf")),
    ):
        pbf, n = build(path, name, CHARS)
        packs[name] = base64.b64encode(pbf).decode()
        print(f"  {name:<8} {n:>3} glyphs  {len(pbf)/1024:6.1f} KB pbf  "
              f"{len(packs[name])/1024:6.1f} KB base64")

    blob = json.dumps(packs, separators=(",", ":"))
    open("glyphs_payload.json", "w").write(blob)
    print(f"glyph payload {len(blob)/1024:.0f} KB")
