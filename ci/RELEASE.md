**Take 110 — cards that move, and a guide the first time you open it.**

Signed release build, installs over take 109.

### Cards move now

Take 109 made the details panel slide up and down. Its **contents** still changed
between frames — tap one pin, then another, and the text just became different
text.

Now each card rises as it arrives. It is quick, about a seventh of a second, and
the place name comes in a fraction slower than the rest so your eye lands on what
you tapped before the detail underneath it.

Three cards had no motion at all and were not opening the panel properly —
**saved routes, the route options list, and turn-by-turn directions**. They were
written a different way from every other card in the app. All fixed, and they now
behave like everything else.

### A guide, the first time you open it

First launch now shows a short guide with the **map blurred behind it**. It
covers:

- What the four tabs are for
- Tapping things, pressing and holding, the Layers button
- That it knows which trails your machine may legally use, and never routes you
  through a closed one
- The six rivers, and picking two points for the float between them
- What Dispatch does, and that it refuses to guess

Close it with **Start riding**, or tap the blurred background. It will not come
back on its own.

**Tools → How to use** brings it back any time.

Everything in it is something the app actually does. There is nothing in there I
cannot back up.

### Test script

- **Airplane mode on, force-stop, reopen.** Map renders, NET badge green.
- **The guide should appear on first launch only.** Close it, force-stop, reopen
  — it should not come back. Then check **Tools → How to use** brings it back.
- **Does the guide say the right things?** You are the only person who has used
  this on real ground; if it explains something wrongly or misses the thing you
  would want a friend to know first, tell me.
- **Tap between several pins in a row.** Do the cards feel right arriving, or is
  the motion too slow, too much, or distracting while riding?
- **Open saved routes, route options and directions** — those three were the odd
  ones out and I want to know they feel the same as the rest now.
- Everything from take 109: the drawer, the compass standing still, the icons.
