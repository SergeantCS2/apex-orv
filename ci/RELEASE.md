**Take 88 — the roads have their numbers on them.**

Signed release build, installs over take 87.

### What changed

**M 33, M 72, F-28, 489, H57-7** and the Forest Road numbers now appear along the
roads they belong to. That number is how you actually say where you are — "two
east of M 33" — and it is on every sign, where the street name often is not.

The numbers were in the data all along and were being thrown away twice on the
way to your phone: once when OpenStreetMap roads were read in, and again when the
network was split into segments.

**2,152 stretches of road** now carry their number.

### It works with the duplicate fix, not against it

Another 2,318 numbered stretches are **not** labelled, on purpose. Those are the
OpenStreetMap copy of a Forest Service road — the same road we already label
with its official FS number from the Forest Service's own data. Take 86 stopped
drawing those duplicate lines; this take makes sure it does not put the number
back on them. You should never see the same road number twice on two parallel
lines.

### What wins the space

When labels compete for the same bit of screen:

1. **Trail names** — always first. The trail you are riding matters most.
2. **Road numbers** — a number orients you.
3. **Lake and river names** — last.

That order is fixed by how the map is built, not by tuning, so it cannot drift.

### Test script for this build

- **Airplane mode on, force-stop, reopen.** Map renders, NET badge green.
- **Find M 33 and M 72.** Do the numbers appear along them as you pan? Do they
  look like numbers rather than street names?
- **The one to watch:** are trail names still appearing as often as take 87? I
  could not settle this from here — my measurements at one spot varied run to
  run, and the layer ordering says trail names should be unaffected, but your
  eyes on a real screen are worth more than my count.
- **Any road showing its number twice** on two lines side by side would be a bug
  and I want to know.
- Still outstanding: ride a road you know runs north–south and check the compass
  reads N or S; save a route, force-stop, reopen.

### Known, and deliberate

- A road carrying three or more designations shows the first two. A third would
  be truncated into something unreadable, so it is dropped instead.
- The numbers are styled as bold text with a heavy white outline rather than as
  proper highway shields. Real shields need artwork the build has no way to make
  yet.

### Only a ride can answer

- Whether road numbers help or crowd the map
- Battery drain with the screen on
- Whether the compass heading is right on a road you know
