**Take 138 — two things I broke in 136, fixed.**

- **Hybrid is a photo again.** From z12 up, everything outside a riding
  area turned blue with white lines. The tile the app uses for "nothing
  here" was a blue pixel at half opacity — a constant I typed from memory.
  It is truly transparent now, and the test decodes it to prove so.
- **The tab bar and drawer are back.** The guide rewrite left two stray
  closing tags, and on the Fold the whole bottom of the app fell below the
  screen. Balanced, and the test measures the bar's position on a phone
  viewport.

Plus 137: hunting waypoints. Plus 136: the build finishes.

### Check on the phone
1. Hybrid at street zoom anywhere outside a riding area: the state photo,
   no blue.
2. MAP · PLAN · RIDE · TOOLS visible at the bottom; the drawer handle
   above them.
3. Outdoors → press-hold → Stand.
