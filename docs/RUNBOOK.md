# RUNBOOK — phone-only, from nothing to an installed APK

> **Easiest path: open `apex-setup.html` from the project files.** It walks
> every tap, templates every link from your username, and copies the workflows
> for you. What follows is the reference version of the same flow.

*Current as of take 166.* Three artifacts, four screens, no laptop.

You need, saved to your phone first (all in the project outputs):
`build.yml` · `bootstrap.yml` · `apex-seed.zip`

---

## 1. Repo

github.com → **New repository** → name `apex-offroad` → **Public** → tick
*Add a README* → Create.

## 2. Paste the two workflows

They are hand-created because GitHub's build token cannot push workflow files
(landmine 42) — everything else arrives by zip.

1. **Add file → Create new file** → path `.github/workflows/build.yml` →
   paste the contents of `build.yml` → Commit.
2. Same again for `.github/workflows/bootstrap.yml` ← `bootstrap.yml`.

## 3. Upload the seed

**Releases → Create a new release** → tag `seed-1` → attach `apex-seed.zip`
from your phone's files → **Publish release**.

## 4. Run bootstrap

**Actions → bootstrap → Run workflow.** ~30 seconds: it downloads the seed,
unzips the whole tree, commits it. That push triggers **build** automatically.

First build ≈ 10–14 min (agency data, DEM, imagery, npm, Gradle — all cached
after). When it finishes:

- **Releases** has `apex-offroad-take-17.apk`
- **Settings → Pages → Source: GitHub Actions** (one tap, once) puts the
  browser build at `https://<you>.github.io/apex-offroad/`

---

## 5. Stage 0 — browser pan test

Open the Pages URL on the Fold, cover screen, portrait. Tap **⏱ Pan test**.
Report: avg fps · p99 min fps · NET badge · GRAPH badge.
Pass: avg ≥ 50, p99 min ≥ 30, NET green.

## 6. Stage 1 — the APK

Download the APK from Releases (allow *Install unknown apps* for your browser
when asked). Then, in order:

1. Open with wifi **on**. Map renders, labels show, GPS asks permission.
2. **Airplane mode on. Force-stop. Reopen.** Identical map, NET stays green.
3. Tap **▶ Ride it** and walk to the mailbox — the truck pins itself, the
   breadcrumb draws, **Retrace** brings you back.

Updates: every new take is a new APK on Releases that installs **over** the
old one — same signing key, on purpose (AGENDA A21).

---

## Termux alternative (optional)

```
pkg install git gh unzip && gh auth login
gh repo create apex-offroad --public --clone && cd apex-offroad
unzip ~/storage/downloads/apex-seed.zip && git add -A
git commit -m seed && git push
```
Then paste the two workflows via the website as above (the token restriction
applies to `gh` pushes of workflow files too — do those two in the browser).

## If something goes wrong

| Symptom | Look at |
|---|---|
| bootstrap run fails "no assets" | The release must contain `apex-seed.zip`, spelled exactly |
| build fails in `bundle` | Actions log; usually a transient agency/Overpass 5xx — re-run |
| build fails in `apk` at Gradle | landmine 40; the runner log will name the toolchain gap |
| APK installs, map blank offline | landmine 3 — NET badge tells you what fetched |
| No labels | landmines 4/30/38 — but smoke executes labels now; re-run build |
| Won't install over previous | Signing changed — should not happen; see AGENDA A21 |
