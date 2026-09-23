**Take 183 — the native shell is now R8-minified; the app itself is unchanged.**

Nothing on the map or in the app's behaviour changed from take 182. What
changed is how the Android shell is built: it is shrunk and obfuscated by
R8, with rules that keep everything the app reaches by name. The harness
proved those names survive in the built package; only a phone can prove
they answer.

On the phone, one pass: install this take, open Tools → Diagnostics →
Self-test and confirm the location and haptics lines report working; long-
press a spot and confirm Share opens the system sheet; confirm the
diagnostics card names your phone. If any of those fails on this take and
worked on 182, say so — it is the whole point of this build.

The first take built on the maintainer's workstation rather than the
sandbox; the seal is the commit, not a zip.
