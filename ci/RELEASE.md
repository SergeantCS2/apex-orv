**Take 159 — 56 MB smaller, and the map looks the same.**

The satellite imagery went from 183 MB to 127 MB — about 30% off the
biggest thing in the app — with no visible change. Expect an APK around
185 MB instead of 240.

How, briefly: the tiles arrive from USGS at full colour resolution, which
no aerial photo needs. Halving the colour detail while keeping every bit
of the brightness detail — the part your eye actually reads — is where
the 56 MB was hiding.

WebP was measured and turned down. At the same visible quality it saved
only about six points more than this, which doesn't justify a new image
format running through the tile loader, your saved HD imagery, and the
build checks.

### Check on the phone
1. Hybrid at a spot you know well: it should look exactly as before.
2. Zoom into a riding area patch — still sharp.
3. Saved HD imagery still works and still looks right.
