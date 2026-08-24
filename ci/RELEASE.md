**Take 112 — your four field findings, all fixed.**

Signed release build, installs over take 111 (which you have not ridden yet —
this includes everything from it: the compass reading true north, the four
revived self-test checks, the bigger drawer handle).

### The "random string of test/error code" — found it

That was the drawer's chevron arrow. I wrote it in a computer-code escape that
means "▾" in JavaScript but means nothing in a web page, so the page drew the
raw six characters — and the folded state rotates the arrow 180°, which mirrored
them into the second bit of gibberish you saw near the bar. Same bug, upright
and upside down.

It is a real arrow now, and there is a check that the arrow is exactly one
character so this cannot quietly come back.

### The one FAIL in your self-test — real, and fixed

`tap-targets: btn-disp 28px` — the Dispatch, Retrace and Directions buttons were
being squeezed to 28 px when the drawer folded. They now hold **44 px minimum in
every state** — the glove number.

### The drawer standing open after the tutorial

Your first GPS fix arrived while the tutorial was up, and the "you are 135 mi
away" message opened the drawer underneath it. That message is status, not a
card about something you tapped — so it no longer unfolds anything. The strip
just reads **"135 mi away · planning mode"** and the full note is one tap away
on the handle.

### Relief — agreed, and off by default

Over the flat map style it reads as dark blotches. It starts OFF now. It is
still there under **Layers** — on Hybrid at low strength it actually helps, which
is why it is a toggle and not deleted.

### Test script

- **Force-stop, reopen.** The chevron on the drawer strip should be a small
  clean arrow, nothing else printed anywhere near the bar.
- **Fold the drawer, then run the self-test.** `tap-targets` should pass — that
  was your one FAIL.
- **Force-stop and reopen away from home** — the map should stay full-screen
  with just "135 mi away · planning mode" on the strip, no drawer.
- **The map itself** — relief off. Better at first glance?
- **Layers → Relief on, basemap Hybrid** — that is the combination where relief
  is meant to earn its keep. Worth it there, or should it go entirely?
- Everything from take 111: compass reads "° true", self-test is 42 checks.

Guide content adjustments whenever you have them — that list is yours to shape.
