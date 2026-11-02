#!/usr/bin/env python3
"""Extend the V4 mockup canvas with the screens take 190 builds: the Plan tab,
Search, Loop, Saved, Machine, the Tools tab, Compass, HD imagery, Mark this
spot, Diagnostics, Data sources, the turn list, the Ride tab before a ride and
the first-run tour. Same language as the approved artboards (the take-187
generator's components, values and type). Copy is the app's own (take 188
census of every screen, TOUR_STEPS, MACHINE labels) unless marked as a
proposal in the canvas notes. Writes project/<Name>.dc.html and an updated
project/canvas.json into the artifact's folder, mirrored under ~/apex-t189-work."""
import json, os, shutil, datetime
HERE = "~/apex-t189-work/mock190/"
ART = ("/tmp/claude-1000/-home-USER-apex-orv/b5ea4b69-3a93-4767-a698-172b74361c15/scratchpad/"
       "artifact-files/e64a7191-6f54-4873-a1f2-157c1c40d649/")
OUT = ART + "project/"
os.makedirs(OUT, exist_ok=True)
ICON = json.load(open(HERE + "icons.json"))
ASSETS = {"home": "/_blob/14339f69716e11a85b44a9dde23fb298", "route": "/_blob/2438a310a7d158a39e397ab675369517",
          "ride": "/_blob/f987b598317c69b11fbd320fe957e9c1"}
W, H = 411, 960

def ic(name, size=22, sw=2, color="currentColor"):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICON[name]}</svg>')

T = dict(sheet="#171613", card="#23211D", ctl="rgba(23,22,19,0.92)", line="#34312B",
         t1="#F5EFE2", t2="#CFC7B8", t3="#A39A8B", acc="#E2570F", onacc="#17130F",
         danger="#C1121F", ok="#8FAE63", warn="#E0A24B", route="#00A8E8")
COND = "'Barlow Condensed', Barlow, sans-serif"
HEAD = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&amp;family=Barlow+Condensed:wght@600;700;800&amp;display=swap">
<style>
body{{margin:0;font-family:Barlow,system-ui,sans-serif;background:#0d0c0a;color:{t1}}}
a{{color:{t1};text-decoration:none}}a:hover{{color:{t1}}}
</style>
</helmet>
<div style="position: relative; width: {W}px; height: {H}px; overflow: hidden; background: #0d0c0a; font-family: Barlow, system-ui, sans-serif; color: {t1}">
'''
FOOT = '''</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{W},"height":{H}}}}}'>
class Component extends DCLogic {{
renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
'''
def page(title, body):
    return HEAD.format(title=title, W=W, H=H, **T) + body + FOOT.format(W=W, H=H)

def img(name, style=""):
    return f'<img src="{ASSETS[name]}" alt="" style="position: absolute; left: 0; top: 0; width: {W}px; height: {H}px; object-fit: cover; {style}">'

def ctl(icon_name, label, x, y, w=48, aria=""):
    inner = ic(icon_name, 20)
    if label:
        inner += f'<span style="font: 700 14px/1 {COND}; letter-spacing: 0.04em">{label}</span>'
    return (f'<button type="button" aria-label="{aria or label or icon_name}" style="position: absolute; left: {x}px; top: {y}px; '
            f'width: {w}px; height: 48px; box-sizing: border-box; border-radius: 14px; background: {T["ctl"]}; '
            f'border: 1px solid rgba(255,255,255,0.10); color: {T["t1"]}; display: flex; align-items: center; justify-content: center; '
            f'gap: 8px; padding: 0 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.35)">{inner}</button>')

def map_chrome():
    """take 188's built layout: mode and filter on the left, basemap and HD on the right"""
    return (ctl("mountain", "Off-road", 12, 68, 124) + ctl("sliders-horizontal", "Everything ridable", 12, 124, 196)
            + ctl("map", "Map", W - 12 - 84, 12, 84) + ctl("download", "HD", W - 12 - 84, 68, 84)
            + f'<div style="position: absolute; left: 12px; top: 14px; font: 700 13px/1.2 Barlow, sans-serif; color: #1C1A16; '
              f'text-shadow: 0 0 3px #fff, 0 0 3px #fff">1135 ft elevation</div>')

TABH = 64
def tabs(active):
    items = [("map", "Map"), ("route", "Plan"), ("play", "Ride"), ("sliders-horizontal", "Tools")]
    cells = ""
    for icn, lab in items:
        on = lab == active
        col = T["t1"] if on else T["t3"]
        bar = (f'<span style="position: absolute; top: 0; left: 50%; margin-left: -16px; width: 32px; height: 3px; '
               f'border-radius: 0 0 3px 3px; background: {T["t1"]}"></span>') if on else ""
        cells += (f'<button type="button" style="position: relative; flex-grow: 1; height: {TABH}px; background: none; border: 0; '
                  f'color: {col}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; '
                  f'font: 700 13px/1 {COND}; letter-spacing: 0.1em; text-transform: uppercase" '
                  f'aria-label="{lab}"{" aria-current=\"page\"" if on else ""}>{bar}{ic(icn, 22)}<span>{lab}</span></button>')
    return (f'<nav style="position: absolute; left: 0; bottom: 0; width: {W}px; height: {TABH}px; display: flex; '
            f'background: #121110; border-top: 1px solid {T["line"]}">{cells}</nav>')

def sheet(top, inner, gap=12):
    return (f'<section style="position: absolute; left: 0; top: {top}px; width: {W}px; height: {H - TABH - top}px; '
            f'box-sizing: border-box; background: {T["sheet"]}; border-radius: 20px 20px 0 0; overflow: hidden; '
            f'box-shadow: 0 -8px 24px rgba(0,0,0,0.4); padding: 10px 16px 16px; display: flex; flex-direction: column; gap: {gap}px">'
            f'<div style="align-self: center; width: 40px; height: 4px; border-radius: 2px; background: #4A463F; flex-shrink: 0"></div>'
            f'{inner}</section>')

def primary(icon_name, label, href=None):
    tag, attr = ("a", f' href="{href}"') if href else ("button", ' type="button"')
    return (f'<{tag}{attr} style="height: 52px; box-sizing: border-box; border-radius: 26px; background: {T["acc"]}; color: {T["onacc"]}; '
            f'border: 0; display: flex; align-items: center; justify-content: center; gap: 10px; flex-grow: 1; flex-shrink: 0; '
            f'font: 800 18px/1 {COND}; letter-spacing: 0.06em; text-transform: uppercase">'
            f'{ic(icon_name, 22, 2.25)}<span>{label}</span></{tag}>')

def secondary(icon_name, label, grow=True, href=None):
    tag, attr = ("a", f' href="{href}"') if href else ("button", ' type="button"')
    return (f'<{tag}{attr} style="height: 52px; box-sizing: border-box; border-radius: 26px; background: {T["card"]}; '
            f'color: {T["t1"]}; border: 1px solid {T["line"]}; display: flex; align-items: center; justify-content: center; '
            f'gap: 8px; padding: 0 16px; flex-shrink: 0; {"flex-grow: 1; " if grow else ""}font: 700 17px/1 {COND}; '
            f'letter-spacing: 0.05em; text-transform: uppercase">{ic(icon_name, 20)}<span>{label}</span></{tag}>')

def kicker(t, color=None):
    return (f'<div style="font: 700 12px/1 {COND}; letter-spacing: 0.14em; flex-shrink: 0; '
            f'text-transform: uppercase; color: {color or T["t3"]}">{t}</div>')

def title(t, size=24):
    return f'<div style="font: 700 {size}px/1.15 Barlow, sans-serif; color: {T["t1"]}; flex-shrink: 0">{t}</div>'

def body(t, color=None, size=15):
    return f'<div style="font: 500 {size}px/1.4 Barlow, sans-serif; color: {color or T["t2"]}; flex-shrink: 0">{t}</div>'

def fact(icon_name, text, color=None):
    return (f'<div style="display: flex; align-items: center; gap: 8px; font: 500 15px/1.35 Barlow, sans-serif; color: {color or T["t2"]}; flex-shrink: 0">'
            f'<span style="display: flex; color: {color or T["t3"]}">{ic(icon_name, 18)}</span><span>{text}</span></div>')

def backbar(t, href):
    return (f'<div style="display: flex; align-items: center; gap: 4px; margin-left: -8px; flex-shrink: 0">'
            f'<a href="{href}" aria-label="Back" style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; color: {T["t2"]}">'
            f'{ic("chevron-left", 26)}</a>{title(t, 22)}</div>')

def row(icon_name, t, sub=None, right=None, href=None, selected=False, chevron=True, tint=None):
    tag, attr = ("a", f' href="{href}"') if href else ("button", ' type="button"')
    dot = (f'<span style="width: 8px; height: 8px; border-radius: 4px; background: {T["t1"]}; flex-shrink: 0"></span>' if selected else "")
    border = f'box-shadow: inset 0 0 0 1.5px {T["t1"]}; ' if selected else ""
    rgt = (f'<span style="font: 600 15px/1 Barlow, sans-serif; color: {T["t2"]}; font-variant-numeric: tabular-nums; white-space: nowrap">{right}</span>'
           if right else "")
    chev = f'<span style="display: flex; color: {T["t3"]}">{ic("chevron-right", 20)}</span>' if chevron else ""
    subl = f'<span style="font: 500 13px/1.3 Barlow, sans-serif; color: {T["t3"]}">{sub}</span>' if sub else ""
    return (f'<{tag}{attr} style="min-height: 60px; box-sizing: border-box; display: flex; align-items: center; gap: 14px; '
            f'padding: 8px 12px; border-radius: 12px; background: none; border: 0; color: {T["t1"]}; text-align: left; width: 100%; {border}">'
            f'<span style="width: 40px; height: 40px; border-radius: 12px; background: {T["card"]}; display: flex; align-items: center; '
            f'justify-content: center; color: {tint or T["t1"]}; flex-shrink: 0">{ic(icon_name, 22)}</span>'
            f'<span style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1">'
            f'<span style="display: flex; align-items: center; gap: 8px; font: {"700" if selected else "600"} 17px/1.2 Barlow, sans-serif">{dot}{t}</span>{subl}</span>'
            f'{rgt}{chev}</{tag}>')

def group(label, rows_html):
    return (f'<div style="display: flex; flex-direction: column; gap: 6px; flex-shrink: 0">{kicker(label) if label else ""}'
            f'<div style="display: flex; flex-direction: column; background: rgba(255,255,255,0.03); border: 1px solid {T["line"]}; '
            f'border-radius: 14px; padding: 2px">{rows_html}</div></div>')

def pchip(label, on=False):
    return (f'<button type="button" aria-pressed="{str(on).lower()}" style="height: 44px; box-sizing: border-box; border-radius: 22px; padding: 0 14px; '
            f'background: {T["card"]}; color: {T["t1"]}; border: {"2px solid " + T["t1"] if on else "1px solid " + T["line"]}; '
            f'display: flex; align-items: center; gap: 6px; font: {"800" if on else "700"} 16px/1 {COND}; letter-spacing: 0.04em; flex-shrink: 0">'
            f'{"<span style=\"width: 7px; height: 7px; border-radius: 4px; background: " + T["t1"] + "\"></span>" if on else ""}{label}</button>')

def search_field(text=None, focused=False, href=None):
    tag, attr = ("a", f' href="{href}"') if href else ("label", "")
    inner = (f'<span style="font-size: 17px; color: {T["t1"]}; flex-grow: 1">{text}</span>'
             f'<button type="button" aria-label="Clear" style="width: 44px; height: 44px; background: none; border: 0; color: {T["t2"]}; display: flex; align-items: center; justify-content: center">{ic("x", 20)}</button>'
             if text else f'<span style="font-size: 17px; color: {T["t3"]}; flex-grow: 1">Where to? Places, trails, addresses</span>')
    return (f'<{tag}{attr} style="height: 52px; box-sizing: border-box; border-radius: 26px; background: {T["card"]}; '
            f'border: {"2px solid " + T["acc"] if focused else "1px solid " + T["line"]}; display: flex; align-items: center; gap: 10px; '
            f'padding: 0 8px 0 16px; flex-shrink: 0"><span style="display: flex; color: {T["t2"]}">{ic("search", 20)}</span>{inner}</{tag}>')

# ── 10 · Plan tab ─────────────────────────────────────────────────────────
stepper = (f'<span style="display: flex; align-items: center; gap: 6px">'
           f'<button type="button" aria-label="Less range" style="width: 40px; height: 40px; border-radius: 20px; background: {T["card"]}; border: 1px solid {T["line"]}; color: {T["t1"]}; display: flex; align-items: center; justify-content: center">{ic("minus", 18)}</button>'
           f'<span style="font: 700 17px/1 Barlow, sans-serif; font-variant-numeric: tabular-nums; min-width: 52px; text-align: center">50 mi</span>'
           f'<button type="button" aria-label="More range" style="width: 40px; height: 40px; border-radius: 20px; background: {T["card"]}; border: 1px solid {T["line"]}; color: {T["t1"]}; display: flex; align-items: center; justify-content: center">{ic("plus", 18)}</button></span>')
fuel_row = (f'<div style="min-height: 60px; display: flex; align-items: center; gap: 14px; padding: 8px 12px">'
            f'<span style="width: 40px; height: 40px; border-radius: 12px; background: {T["card"]}; display: flex; align-items: center; justify-content: center; flex-shrink: 0">{ic("fuel", 22)}</span>'
            f'<span style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1"><span style="font: 600 17px/1.2 Barlow, sans-serif">Fuel range</span>'
            f'<span style="font: 500 13px/1.3 Barlow, sans-serif; color: {T["t3"]}">Routes warn past it</span></span>{stepper}</div>')
plan_body = (img("home") + map_chrome()
    + sheet(212, kicker("Plan") + search_field(href="Search.dc.html")
      + '<div style="display: flex">' + primary("house", "Return home", "Route.dc.html") + '</div>'
      + group("From here", row("repeat", "Loop from here", 'Ends where it starts · legal for your Dirt bike 24"', href="Loop.dc.html")
              + row("crosshair", "Start from my position", "Plan from where you stand, not the map centre")
              + row("star", "Saved", "Routes and marked spots, on this phone only", "0", href="Saved.dc.html"))
      + group("Your ride", row("bike", "Machine", None, 'Dirt bike 24"', href="Machine.dc.html") + fuel_row
              + row("house", "Home", "Long-press a spot, or use your position", "Not set")))
    + tabs("Plan"))

# ── 11 · Search ───────────────────────────────────────────────────────────
towns = ["Mio", "St. Helen", "Grayling", "Gladwin", "Baldwin", "Cadillac", "Silver Lake Dunes", "Atlanta", "Newberry", "Munising", "Marquette", "Drummond Island"]
town_chips = "".join(f'<button type="button" style="height: 44px; box-sizing: border-box; border-radius: 22px; padding: 0 14px; background: {T["card"]}; '
                     f'border: 1px solid {T["line"]}; color: {T["t1"]}; font: 700 15px/1 {COND}; letter-spacing: 0.04em">{t}</button>' for t in towns)
search_body = (img("home", "filter: brightness(0.5)")
    + sheet(96, search_field("Grayling", True)
      + group("3 results · offline", row("map-pin", "Grayling", "Town") + row("route", "Grayling Road", "Road") + row("route", "Grayling Rd", "Street"))
      + kicker("Jump to a town") + f'<div style="display: flex; flex-wrap: wrap; gap: 8px; flex-shrink: 0">{town_chips}</div>'
      + body("A trail code like H58, a town, a river or a street address — all of it offline.", T["t3"], 14))
    + tabs("Map"))

# ── 12 · Loop from here ───────────────────────────────────────────────────
dist = "".join(pchip(f"{d} mi", d == 15) for d in (6, 10, 15, 20, 30, 40))
loop_body = (img("home") + map_chrome()
    + sheet(420, backbar("Loop from here", "PlanTab.dc.html")
      + body('A ride that ends where it starts, on legal line for your Dirt bike 24".')
      + kicker("How far") + f'<div style="display: flex; flex-wrap: wrap; gap: 8px; flex-shrink: 0">{dist}</div>'
      + fact("crosshair", "Starts at the map centre — no GPS fix yet", T["warn"])
      + '<div style="display: flex; margin-top: auto">' + primary("repeat", "Find 15 mi loops", "Route.dc.html") + '</div>')
    + tabs("Plan"))

# ── 13 · Saved ────────────────────────────────────────────────────────────
saved_body = (img("home") + map_chrome()
    + sheet(380, backbar("Saved", "PlanTab.dc.html")
      + f'<div style="align-self: center; width: 64px; height: 64px; border-radius: 32px; background: {T["card"]}; display: flex; align-items: center; justify-content: center; color: {T["t2"]}; flex-shrink: 0">{ic("star", 30)}</div>'
      + '<div style="text-align: center">' + title("Nothing saved yet", 22) + '</div>'
      + body("Plan a route or a loop, pick the card you want to keep, then tap <b>Save</b> under the route options. Marked spots land here too. "
             "It is stored on this phone only — nothing is sent anywhere — and reopening a route plans it again on the current map, so closures stay up to date.")
      + '<div style="display: flex; margin-top: auto">' + secondary("map-pin", "Mark this spot", href="Mark.dc.html") + '</div>')
    + tabs("Plan"))

# ── 14 · Machine ──────────────────────────────────────────────────────────
machines = [("bike", 'Dirt bike 24"', True), ("car", 'Quad 50"', False), ("car", 'Side-by-side 72"', False), ("footprints", "On foot", False),
            ("sailboat", "Canoe", False), ("sailboat", "Kayak", False), ("waves", "Raft / tube", False)]
mrows = "".join(row(i, n, selected=s, chevron=False) for i, n, s in machines)
machine_body = (img("home", "filter: brightness(0.55)")
    + sheet(150, backbar("Your machine", "PlanTab.dc.html")
      + body("Routing follows what is legal for it, and lines too narrow for it fade — still real trails, just not yours today.")
      + group(None, mrows))
    + tabs("Plan"))

# ── 15 · Tools tab ────────────────────────────────────────────────────────
tools_body = (img("home") + map_chrome()
    + sheet(150, kicker("Tools")
      + group("On the trail", row("compass", "Compass", "Bearing to your truck, home or a waypoint", href="Compass.dc.html")
              + row("map-pin", "Mark this spot", "Saved on this phone, found under Saved", href="Mark.dc.html"))
      + group("Offline", row("download", "HD imagery", "Sharper satellite for places you choose", href="HD.dc.html"))
      + group("Learn", row("circle-help", "Take the tour", "Seven steps over the real screen", href="FirstRun.dc.html")
              + row("book-open", "How to use", "What each control does"))
      + group("About", row("database", "Data sources", "Who publishes each layer, and the licences", href="Sources.dc.html")
              + row("stethoscope", "Diagnostics", "About this build, self-test, pan test", href="Diag.dc.html")), gap=14)
    + tabs("Tools"))

# ── 16 · Compass ──────────────────────────────────────────────────────────
ticks = ""
for i in range(36):
    import math
    a = math.radians(i * 10)
    r1, r2 = (100, 88) if i % 9 == 0 else (100, 94)
    x1, y1 = 110 + r1 * math.sin(a), 110 - r1 * math.cos(a)
    x2, y2 = 110 + r2 * math.sin(a), 110 - r2 * math.cos(a)
    ticks += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{T["t2"] if i % 9 == 0 else "#6F685C"}" stroke-width="{3 if i % 9 == 0 else 1.5}" stroke-linecap="round"/>'
labels = "".join(f'<text x="{110 + 72 * math.sin(math.radians(d)):.1f}" y="{110 - 72 * math.cos(math.radians(d)) + 7:.1f}" text-anchor="middle" '
                 f'font-family="Barlow Condensed, Barlow, sans-serif" font-weight="800" font-size="22" fill="{T["acc"] if l == "N" else T["t1"]}">{l}</text>'
                 for d, l in ((0, "N"), (90, "E"), (180, "S"), (270, "W")))
dial = (f'<svg width="220" height="220" viewBox="0 0 220 220" role="img" aria-label="Compass: no heading yet" style="align-self: center; flex-shrink: 0">'
        f'<circle cx="110" cy="110" r="104" fill="#121110" stroke="{T["line"]}" stroke-width="2"/>{ticks}{labels}'
        f'<circle cx="110" cy="110" r="5" fill="{T["t2"]}"/></svg>')
compass_body = (img("home", "filter: brightness(0.55)")
    + sheet(150, backbar("Compass", "ToolsTab.dc.html") + dial
      + '<div style="text-align: center; flex-shrink: 0"><div style="font: 700 34px/1 Barlow, sans-serif; font-variant-numeric: tabular-nums">—</div>'
      + f'<div style="font: 600 13px/1.4 Barlow, sans-serif; color: {T["t3"]}; margin-top: 4px">No heading yet</div></div>'
      + fact("info", "This phone is not reporting a compass — start moving and it will use your GPS course instead.", T["warn"])
      + kicker("Bearings")
      + body("Nothing to take a bearing to yet — pin the truck, set home, or save a waypoint.")
      + '<div style="display: flex; gap: 10px; margin-top: auto">' + secondary("map-pin", "Mark this spot", href="Mark.dc.html") + secondary("house", "Set home") + '</div>')
    + tabs("Tools"))

# ── 17 · HD imagery ───────────────────────────────────────────────────────
def tier(name, size, note=None):
    return (f'<div style="display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 14px; background: rgba(255,255,255,0.03); '
            f'border: 1px solid {T["line"]}; flex-shrink: 0">{kicker(name)}'
            f'<div style="font: 700 20px/1.2 Barlow, sans-serif; font-variant-numeric: tabular-nums">{size}</div>'
            + (body(note, T["t3"], 14) if note else "")
            + f'<div style="display: flex">{secondary("download", "Save", grow=False)}</div></div>')
hd_body = (img("home", "filter: brightness(0.55)")
    + sheet(130, backbar("HD imagery", "ToolsTab.dc.html")
      + body("Sharper satellite for places you choose. Nothing downloads on its own — save on wifi.")
      + tier("This view", "293 tiles · about 5 MB") + tier("Crawford County", "2,515 tiles · about 46 MB")
      + tier("The whole state", "12,500 tiles · about 178 MB", "One level sharper than the built-in map, everywhere."))
    + tabs("Tools"))

# ── 18 · Mark this spot ───────────────────────────────────────────────────
pin = (f'<div style="position: absolute; left: 187px; top: 300px; width: 36px; height: 48px">'
       f'<svg width="36" height="48" viewBox="0 0 36 48" aria-hidden="true"><path d="M18 46 C18 46 3 28 3 17 A15 15 0 0 1 33 17 C33 28 18 46 18 46Z" '
       f'fill="{T["ok"]}" stroke="#fff" stroke-width="2.5"/><circle cx="18" cy="17" r="6" fill="#fff"/></svg></div>')
namefield = (f'<label style="display: flex; flex-direction: column; gap: 6px; flex-shrink: 0">{kicker("Name (optional)")}'
             f'<input type="text" placeholder="Truck, camp, gate…" style="height: 52px; box-sizing: border-box; border-radius: 14px; background: {T["card"]}; '
             f'border: 1px solid {T["line"]}; color: {T["t1"]}; font: 500 17px Barlow, sans-serif; padding: 0 16px"></label>')
mark_body = (img("home") + map_chrome() + pin
    + sheet(470, kicker("Marked · on this phone only", T["ok"]) + title("44.6200, −84.6000", 24)
      + body("Find it again under <b>Saved</b> on the Plan tab.") + namefield
      + '<div style="display: flex; gap: 10px; margin-top: auto">' + primary("check", "Done", "ToolsTab.dc.html") + secondary("x", "Undo", grow=False) + '</div>')
    + tabs("Tools"))

# ── 19 · Diagnostics ──────────────────────────────────────────────────────
diag_body = (img("home", "filter: brightness(0.55)")
    + sheet(420, backbar("Diagnostics", "ToolsTab.dc.html")
      + group(None, row("info", "About this build", "The take, the build and the data it carries")
              + row("shield-check", "Self-test", "Checks this phone: location, screen, sound, compass")
              + row("move", "Pan test", "Pans the map to measure how smoothly it draws"))
      + body("Share a self-test from here when something looks wrong — it says what this phone can and cannot do.", T["t3"], 14))
    + tabs("Tools"))

# ── 20 · Data sources ─────────────────────────────────────────────────────
def src(name, what):
    return row("database", name, what)
sources_body = (img("home", "filter: brightness(0.45)")
    + sheet(60, backbar("Data sources", "ToolsTab.dc.html")
      + f'<div style="padding: 14px; border-radius: 14px; background: rgba(224,162,75,0.10); border: 1px solid rgba(224,162,75,0.35); flex-shrink: 0">'
        f'{body("APEX ORV is an <b>independent app</b> — not affiliated with, endorsed by, or acting on behalf of the State of Michigan, the Michigan DNR, the U.S. Forest Service, the U.S. Geological Survey, or any other government agency.", T["t1"], 14)}</div>'
      + kicker("Official sources") + body("These agencies are the authority; this app is a convenience. Check the official source, and the signs on the ground, before you ride.", T["t3"], 14)
      + group(None, src("Michigan DNR", "Trail designations, closures, state land, boating access") + src("U.S. Forest Service", "Motor-vehicle use, forest roads, national forest land")
              + src("U.S. Geological Survey", "Elevation, contours, relief") + src("OpenStreetMap", "Roads, places, trails others mapped"))
      + kicker("Software and type")
      + body("MapLibre GL JS · BSD 3-Clause &nbsp;·&nbsp; Capacitor · MIT &nbsp;·&nbsp; Lucide icons · ISC &nbsp;·&nbsp; Barlow · SIL OFL 1.1", T["t2"], 14), gap=10)
    + tabs("Tools"))

# ── 21 · Turns ────────────────────────────────────────────────────────────
def step(icon_name, text, dist, at=None, note=None):
    n = f'<span style="font: 600 13px/1.3 Barlow, sans-serif; color: {T["warn"]}">{note}</span>' if note else ""
    a = f'<span style="font: 600 12px/1 Barlow, sans-serif; color: {T["t3"]}">at {at}</span>' if at else ""
    return (f'<div style="display: flex; gap: 14px; align-items: flex-start; padding: 12px 4px; border-bottom: 1px solid {T["line"]}; flex-shrink: 0">'
            f'<span style="display: flex; color: {T["t1"]}; padding-top: 2px">{ic(icon_name, 26, 2.25)}</span>'
            f'<span style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1"><span style="font: 500 17px/1.3 Barlow, sans-serif">{text}</span>{n}</span>'
            f'<span style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; font-variant-numeric: tabular-nums">'
            f'<span style="font: 700 17px/1 Barlow, sans-serif">{dist}</span>{a}</span></div>')
turns_body = (img("route")
    + sheet(330, '<div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0">' + title("12 steps · 9.2 mi", 22)
        + f'<span style="font: 700 12px/1 {COND}; letter-spacing: 0.1em; color: {T["t2"]}; border: 1px solid {T["line"]}; border-radius: 6px; padding: 5px 7px">MOST TRAIL</span></div>'
      + step("crosshair", "Start on <i>unnamed two-track</i>", "0.6 mi")
      + step("corner-up-left", "Turn left onto <b>South Thendara Drive</b>", "0.7 mi", "0.6 mi")
      + step("corner-up-right", "Turn right onto <b>West Timber Trail</b>", "1.5 mi", "1.3 mi", "Climbs 39 ft")
      + fact("list", "9 more steps below", T["t3"])
      + '<div style="display: flex; gap: 10px; margin-top: auto">' + primary("play", "Ride it", "Ride.dc.html") + '</div>')
    + tabs("Plan"))

# ── 22 · Ride tab, before a ride ──────────────────────────────────────────
ridetab_body = (img("home") + map_chrome()
    + sheet(540, kicker("Ride") + title("Ride from here", 24)
      + body("No route needed: the truck pins where you started, and <b>Retrace</b> leads you back on your own track.")
      + fact("locate-fixed", "Waiting for GPS — the ride starts on the first fix", T["warn"])
      + '<div style="display: flex; gap: 10px; margin-top: auto">' + primary("play", "Start riding", "Ride.dc.html") + secondary("route", "Plan first", grow=False, href="PlanTab.dc.html") + '</div>')
    + tabs("Ride"))

# ── 23 · First run: the tour ──────────────────────────────────────────────
ring = (f'<div style="position: absolute; left: 6px; top: 62px; width: 136px; height: 60px; border-radius: 18px; '
        f'box-shadow: 0 0 0 3px {T["acc"]}, 0 0 0 9999px rgba(10,9,7,0.62)"></div>')
tourcard = (f'<div style="position: absolute; left: 12px; right: 12px; top: 150px; border-radius: 18px; background: {T["sheet"]}; '
            f'border: 1px solid {T["line"]}; box-shadow: 0 12px 32px rgba(0,0,0,0.5); padding: 16px; display: flex; flex-direction: column; gap: 10px">'
            + kicker("1 of 7") + title("What are you doing today?", 22)
            + body("Off-road, Outdoors, Hunt, Water or Camp. A mode sets the pins, the lines and the routing for that kind of day — and everything it sets stays one tap away.")
            + '<div style="display: flex; gap: 10px">' + primary("chevron-right", "Next") + secondary("x", "Skip", grow=False) + '</div></div>')
firstrun_body = (img("home") + map_chrome() + ring + tourcard + tabs("Map"))

BOARDS = [
    ("PlanTab.dc.html", "10 · Plan tab", plan_body, True), ("Search.dc.html", "11 · Search", search_body, True),
    ("Loop.dc.html", "12 · Loop from here", loop_body, True), ("Saved.dc.html", "13 · Saved", saved_body, True),
    ("Machine.dc.html", "14 · Your machine", machine_body, True), ("Turns.dc.html", "15 · Turns", turns_body, True),
    ("ToolsTab.dc.html", "16 · Tools tab", tools_body, True), ("Compass.dc.html", "17 · Compass", compass_body, True),
    ("HD.dc.html", "18 · HD imagery", hd_body, True), ("Mark.dc.html", "19 · Mark this spot", mark_body, True),
    ("Diag.dc.html", "20 · Diagnostics", diag_body, True), ("Sources.dc.html", "21 · Data sources", sources_body, True),
    ("RideTab.dc.html", "22 · Ride, before a ride", ridetab_body, True), ("FirstRun.dc.html", "23 · First run: the tour", firstrun_body, True),
]
canvas = json.load(open(OUT + "canvas.json"))
GAP, ROWH = 80, 1340
rows = [(3, BOARDS[0:6], "Plan — the V4 proposal for take 190"), (4, BOARDS[6:12], "Tools — the V4 proposal for take 190"),
        (5, BOARDS[12:14], "Ride and first run — take 190")]
for r, boards, heading in rows:
    y = (r - 1) * ROWH
    for col, (fn, t, b, inter) in enumerate(boards):
        e = {"x": col * (W + GAP), "y": y, "w": W, "h": H, "title": t}
        if inter: e["is_interactive"] = True
        canvas["boards"][fn] = e
        if fn not in canvas["order"]: canvas["order"].append(fn)
        open(OUT + fn, "w", encoding="utf-8").write(page(t, b))
    canvas["notes"][f"row{r}"] = {"x": 0, "y": y - 300, "text": heading, "kind": "title1", "maxW": max(len(boards), 4) * W + (max(len(boards), 4) - 1) * GAP}
canvas["notes"]["read3"] = {"x": 6 * (W + GAP), "y": 2 * ROWH, "w": 380, "size": "m", "fill": "orange", "text":
    "Take 190, for your approval — the screens the first mockup never drew, in the same language:\n"
    "1. Plan and Tools stop being chips floating over the map: each tab opens a sheet of labelled rows, one line saying what each does.\n"
    "2. Every tool opens inside the sheet with a back arrow; the generic footer (elevation, coordinates, the action row) no longer repeats under every card.\n"
    "3. One primary per screen: Return home, Find loops, Ride it, Start riding, Done.\n"
    "4. Machine and fuel range move from tap-to-cycle chips to a picker and a stepper you can read.\n"
    "Copy is the app's own (take 188's census); numbers are the census values, not new data."}
canvas["notes"]["read4"] = {"x": 6 * (W + GAP), "y": 3 * ROWH, "w": 380, "size": "m", "fill": "teal", "text":
    "Tools: grouped On the trail / Offline / Learn / About. Compass says honestly when the phone has no compass. HD saves stay deliberate — no accent, nothing on its own. "
    "Data sources leads with the independence notice, then the agencies, then the software licences."}
json.dump(canvas, open(OUT + "canvas.json", "w", encoding="utf-8"), indent=1)
os.makedirs(HERE + "project", exist_ok=True)
for fn, *_ in BOARDS:
    shutil.copy(OUT + fn, HERE + "project/" + fn)
shutil.copy(OUT + "canvas.json", HERE + "project/canvas.json")
print("wrote", len(BOARDS), "artboards; canvas now has", len(canvas["boards"]), "boards")
