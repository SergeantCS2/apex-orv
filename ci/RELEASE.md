**Take 108 — everything connected, checked button by button. Go ride it.**

Signed release build, installs over take 107. You have not been out since take
82; twenty-six builds have landed. This is the one.

### Where everything lives

```
Map     Layers · Locate · Search
Plan    Machine · Set home · I'm here · Fuel range · Loop · Saved
Ride    Ride it · Wrong turn
Tools   Compass · Mark this spot · Diagnostics
Always  Dispatch · Retrace · Directions · Return home
On map  Basemap (one tap) · Activity filter
```

**Ride has two buttons on purpose.** On a bike you press *Ride it* and *Wrong
turn*. Everything else is setup and belongs before you start.

### What the check found

Every button in the app was cross-referenced against every handler: **40 buttons,
47 handlers, none unwired, none orphaned.**

Two things were wrong and are fixed:

- **"I'm here" was on the wrong tab.** It is the other half of "Set home" — the
  app sets them together internally — and they were on different tabs. Both in
  Plan now.
- **Two handlers for buttons that no longer exist**, left behind when Relief and
  Labels moved into the Layers panel. Removed.

Then a second, different check: not "is it wired" but **"can you actually get to
it"** — walking all four tabs and confirming every action appears. All present,
7 layer groups reachable, diagnostics behind one button, action row always there.

### Under the Layers button

Places · Lakes & rivers · Contours · Named hills · Rivers & paddling · Relief ·
All labels

### Test script

- **Airplane mode on, force-stop, reopen.** Map renders, NET badge green.
- **Walk all four tabs.** Anything where you would not look for it?
- **Self-test** — 59 checks. The `dispatch-scan` number is one I still want.
- **Ride a road you know runs north–south** and check the compass. Asked for
  many builds now; it has never been verified against real ground.
- **▤ Layers** — every one on and off.
- **Plan a float you have done**, check the time range covers it.
- **Save a waypoint, force-stop, reopen.**
- **Route somewhere and press ✕ Clear route.**

Anything at all that looks wrong. There is a lot of new surface here and yours
are the only eyes that have seen the actual ground.
