**Take 158 — the half-built look is gone for good.**

Take 157 put a loading screen over the messy start-up. This one removes
the mess underneath it: the app's buttons stay invisible until their
icons are actually drawn, so `__IC_map__` style placeholder text can no
longer appear on screen at all — with or without the loading screen in
front of it.

Everything from the last two builds rides along: the cold-start loading
screen with your logo and the red A-to-X progress bar, and the thin red
line across the top while a basemap change settles.

### Check on the phone
1. Force-stop and reopen: logo, bar, then a finished map — no
   placeholder text at any point.
2. Cycle Map → Satellite → Hybrid: red line while it loads, gone after.
3. Everything else exactly where you left it.
