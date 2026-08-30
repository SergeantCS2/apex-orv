**Take 166 — advertising ID declaration.**

Google blocked the submission pending an advertising ID declaration. The
answer is no — this app has no advertising, no analytics, and no ad
identifier — and it's answered on the Play Console form, not here.

What changed in the build: the release check now inspects the finished
package and fails if an advertising ID permission ever appears in it. The
declaration you give Google is a promise about the final merged app, and
a dependency added later could quietly break that promise. Now it can't
do so silently.

No change to the app itself.

### On the two warnings
Both are about R8 code optimization, and both are declined for this
release. The Java code is about 7.6 MB of a ~185 MB app that is almost
entirely map data, so a good pass saves under 2% — and our test suite
runs the web layer in a browser, so it cannot detect an optimization rule
that breaks a native plugin. Only a device install can. Worth doing later
with proper device verification; not worth the risk on a first release.
