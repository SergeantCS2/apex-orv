"""Generate the launcher icon from Jacob's own APEX artwork.

Take 30. Earlier takes redrew the mark from primitives and never got close — the
letterforms are specific and hand-plotting them was guesswork dressed up as
engineering. `assets/logo-master.png` is the artwork itself: cropped from the
file Jacob supplied, colour-snapped to the three brand colours so JPEG haloes do
not survive scaling, and corner-cleaned. Every density derives from it here, so
there is still one source of truth and no per-density binaries in the repo.

A logo is a source asset, not generated data — committing it is the honest thing;
committing five rendered sizes would not be.

Emits: legacy square + round icons mdpi..xxxhdpi, adaptive foreground on the
108dp canvas with the art inside the 66dp safe zone, mipmap-anydpi-v26 xml with
a monochrome layer, and the background colour resource.
"""
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
MASTER = os.path.join(ROOT, "assets", "logo-master.png")

CHAR = (50, 50, 50)          # the tile colour, and the adaptive background
SS = 4
SAFE_D = 0.62      # safe-circle diameter as a fraction of the 108dp canvas

LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}


def master():
    if not os.path.exists(MASTER):
        raise SystemExit(f"missing {MASTER} — the logo artwork is the source")
    return Image.open(MASTER).convert("RGB")


def artwork_alpha(src):
    """The mark on transparency: everything that is not the tile colour."""
    a = src.convert("RGBA")
    px = a.load()
    w, h = a.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if abs(r - CHAR[0]) < 26 and abs(g - CHAR[1]) < 26 and abs(b - CHAR[2]) < 26:
                px[x, y] = (r, g, b, 0)
    return a


def trimmed(a):
    """Crop to the ink so the adaptive safe zone is filled, not padded."""
    bb = a.getbbox()
    return a.crop(bb) if bb else a


def rounded(size, frac=0.235):
    S = size * SS
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1],
                                        radius=int(S * frac), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def circle(size):
    S = size * SS
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).ellipse([0, 0, S - 1, S - 1], fill=255)
    return m.resize((size, size), Image.LANCZOS)


def write(path, im):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "PNG")


def build(res=RES, preview=None):
    src = master()
    art = trimmed(artwork_alpha(src))
    made = 0

    for dens, px in LEGACY.items():
        tile = src.resize((px, px), Image.LANCZOS).convert("RGBA")
        sq = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        sq.paste(tile, (0, 0), rounded(px))
        write(os.path.join(res, f"mipmap-{dens}", "ic_launcher.png"), sq)
        rd = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        rd.paste(tile, (0, 0), circle(px))
        write(os.path.join(res, f"mipmap-{dens}", "ic_launcher_round.png"), rd)
        made += 2

    # The mark is WIDE (about 782x636 of the master). Two things must hold or a
    # launcher mask eats the A's foot and the X's arm, which is exactly what
    # happened on the Fold at take 31:
    #   1. keep the aspect ratio — resizing the trimmed art into a SQUARE
    #      stretched it and pushed the extremes outward;
    #   2. size by the DIAGONAL, not the width. A circular mask cuts corners,
    #      and the bottom-left of this mark IS a corner.
    aw, ah = art.size
    diag = (aw * aw + ah * ah) ** 0.5
    for dens, px in ADAPTIVE.items():
        s_ = (SAFE_D * px) / diag          # whole bbox inside the safe circle
        w, h = max(1, round(aw * s_)), max(1, round(ah * s_))
        a = art.resize((w, h), Image.LANCZOS)
        fg = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        fg.paste(a, ((px - w) // 2, (px - h) // 2), a)
        write(os.path.join(res, f"mipmap-{dens}", "ic_launcher_foreground.png"), fg)
        made += 1

    xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
           '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
           '    <background android:drawable="@color/ic_launcher_background" />\n'
           '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
           '    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />\n'
           '</adaptive-icon>\n')
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        p = os.path.join(res, "mipmap-anydpi-v26", name)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "w").write(xml)
        made += 1

    vals = os.path.join(res, "values", "ic_launcher_background.xml")
    os.makedirs(os.path.dirname(vals), exist_ok=True)
    open(vals, "w").write(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">#%02X%02X%02X</color>\n'
        '</resources>\n' % CHAR)
    made += 1

    if preview:
        big = src.resize((512, 512), Image.LANCZOS).convert("RGBA")
        sq = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        sq.paste(big, (0, 0), rounded(512))
        sq.save(preview, "PNG")
    print(f"icon: {made} resources from assets/logo-master.png")


if __name__ == "__main__":
    import sys
    build(preview=sys.argv[1] if len(sys.argv) > 1 else None)
