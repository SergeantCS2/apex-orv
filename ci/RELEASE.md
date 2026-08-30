**Take 163 — release build, final app identity.**

The app's package name is now `com.apexoffroad.app`. This is set before
the first store upload because the store fixes it permanently and it
appears in the store listing's address.

**Read this before installing the store version:** Android treats a
package name as the app's identity, so the store build is a separate app
from the one you've been sideloading. It will install *alongside* it, not
over it, and saved waypoints, recorded rides and saved HD imagery do not
carry across. Note anything you want to keep first.

Otherwise identical to the last build: loading screen, basemap loading
line, stacked pins at every zoom, smaller satellite imagery.

### Check before submitting
1. Install and open: loading screen, then a finished map.
2. Tools -> Self-test: expect a clean pass.
3. Confirm the old sideloaded build is still there separately — that's
   expected, and it's your fallback until the store version is proven.
