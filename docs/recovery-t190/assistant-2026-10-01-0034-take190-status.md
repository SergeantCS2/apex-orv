**TLDR:** Take 189 Phase A (the render speed-up and junk pin names) is still running. PR #2, take 188's CI fix, is waiting for your merge. Take 190 is set up to start as soon as take 189 seals, and nothing in it needs an answer from you before then.

**Status**
- **PR #2** ([SergeantCS2/apex-orv#2](https://github.com/SergeantCS2/apex-orv/pull/2)) is still open. Once you merge it, I'll watch the CI run on main. Tagging `t188` waits for a green run and your go.
- **Render speed-up (A227):** the lane has rewritten about 270 lines of `tools/render.mjs`. It is waiting for the shared Chrome lock to take its next timing run.
- **Junk pin names (A228):** the lane has changed the data step that builds the pins plus the app, smoke and gate files. Its own full render is about 11 minutes in.
- **Take 190:** the specs, the lane setup script and the lanes workflow are ready in `~/apex-t190-work/`. It is one framework lane first, then four lanes in parallel.

**Take 190: the specs left 14 questions open; I'm using a safe default for each**
Tell me before take 189 seals if you want any of these changed. The four that change what gets built:
1. **Sheet height:** the map always keeps at least 12% of the screen open, so the Plan and Tools lists scroll if they must. If Return home itself would need a scroll on the 360-wide or inner screen, the build stops and asks you.
2. **One extra tap off a ride:**
   - Return home from Tools goes from 2 taps to 3, and from the Ride card from 1 to 2.
   - Dispatch goes up by one tap too.
   - This is how the approved screens work. A slim Return home and Dispatch at the bottom of each sheet is offered, not built.
3. **Tour exits:** Skip means never show it again, and Tools → Take the tour replays it. Back means "not now".
4. **Mark this spot with no GPS fix:** it refuses honestly. Today it quietly marks the region centre and says "Marked", because an existing check against that is dead code.

The other defaults:
- **Loop:** the screen says it starts at the start pin, because that is what the code does, not "the map centre".
- **Machine picker:** water craft are greyed out in the land modes.
- **Saved:** spots saved in another region are counted instead of showing "Nothing saved yet".
- **Data sources:** the screen is unchanged. Adding a credit for the U.S. Census Bureau is left as an open agenda item for you.

**DEFERRED**
- Tagging `t188`, which waits for your merge, a green CI run and your go.
- The inner-screen census shots.
- Deleting `~/apex-clean-t188` (2.8 GB).