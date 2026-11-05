# Android: APK releases

*Set up 2026-11-04. The user picked APK releases over a hosted build.*

Every push to `main` builds a signed APK on GitHub Actions and publishes it as
a GitHub Release. The Obtainium app on the phone watches the repo's releases
and installs each new APK. Nothing is uploaded to a store.

## How it fits together

| Piece | Where | What |
|---|---|---|
| The wrapper | `capacitor.config.json`, `android/` | Capacitor 8.5.3 (pinned; `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`). The app is one Android WebView that loads the built game from `dist/`. `android/` is the Gradle project `npx cap add android` made. |
| The copied game | `android/app/src/main/assets/public` | Written by `npx cap sync android`. Gitignored by Capacitor, so a built game never enters git through `android/`. |
| Version and signing | `android/app/build.gradle` | `versionCode` is the env `APP_VERSION_CODE` (the workflow run number, which only grows: Android refuses an update with a lower one). The release build is signed from `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_ALIAS`; without them it is unsigned. |
| The build | `.github/workflows/android.yml` | `npm ci`, `vite build`, `cap sync android`, `gradlew assembleRelease` on `ubuntu-latest` with JDK 21. On `main`: a release tagged `build-<run>` holding `frontier-idle-<run>.apk`, and releases past the newest 10 are deleted. On any other listed branch: the APK as a run artifact, no release. Run by hand from the Actions tab (`workflow_dispatch`). |

The app id is `io.github.oldmangibson.frontieridle`. Changing it makes a
different app: the phone keeps the old one and its save.

## What the phone build has

- **No licensed art in the APK.** The enemy battlers, the tile packs and the
  icon packs are gitignored (docs/AUTHORSHIP.md §9), so the Actions build has
  none of them: enemies show no picture, maps draw the node diagram, icons
  are emoji. The art reaches the phone as an art pack (docs/ART_PACK.md):
  `npm run art-pack` on the PC writes `art-pack/frontier-idle-art.zip`; copy
  it to the phone and use Menu → Import art pack once. The pack is kept in
  the app's storage, so APK updates keep it; uninstalling deletes it. Rerun
  and reimport when new art is added. A build made on this PC has the art
  built in; do not share that APK.
- **Its own save.** The save lives in the app's WebView storage, apart from
  any browser's. The header's Export and Import move a save between the two.
- **The desktop layout.** The phone layout (UI proposal A3) is not built.

## The signing key

`C:\Users\mersi\Documents\ksg-android-signing\` holds `release.p12` (PKCS12,
alias `frontieridle`, valid to 2126), `password.txt` and `cert.pem`. The
repo's Actions secrets hold copies:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_B64` | `release.p12`, base64 |
| `ANDROID_KEYSTORE_PASSWORD` | the contents of `password.txt` |
| `ANDROID_KEY_ALIAS` | `frontieridle` |

An installed app accepts an update only when it is signed with the same key.
Lose the key and the next build cannot update the phone: export the save,
uninstall, install the new build, import. Back the folder up outside the repo.

Setting the secrets from that folder (Git Bash, GitHub CLI logged in):

```bash
base64 -w0 ~/Documents/ksg-android-signing/release.p12 | gh secret set ANDROID_KEYSTORE_B64 --repo old-man-gibson/ksgproto28
gh secret set ANDROID_KEYSTORE_PASSWORD --repo old-man-gibson/ksgproto28 < ~/Documents/ksg-android-signing/password.txt
gh secret set ANDROID_KEY_ALIAS --repo old-man-gibson/ksgproto28 --body frontieridle
```

To make a new key (only if the old one is gone), as the 2026-11-04 one was made:

```bash
openssl rand -hex 24 > password.txt
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:4096 -sha256 -days 36500 -nodes -keyout key.pem -out cert.pem -subj "/CN=Frontier Idle/O=old-man-gibson"
openssl pkcs12 -export -inkey key.pem -in cert.pem -name frontieridle -out release.p12 -passout file:password.txt
```

Then delete `key.pem` and set the three secrets again.

## The phone

1. Install Obtainium (its GitHub releases page, or F-Droid).
2. The repo is private, so Obtainium needs a GitHub token. On github.com:
   Settings → Developer settings → Fine-grained tokens → a token for
   `old-man-gibson/ksgproto28` only, permission Contents: read-only. In
   Obtainium: Settings → GitHub → paste it.
3. Obtainium: Add app → `https://github.com/old-man-gibson/ksgproto28`. It
   finds `frontier-idle-<n>.apk` in the latest release.
4. Install. Android asks once to let Obtainium install apps.
5. From then on Obtainium checks for new releases on its own schedule and
   offers the update; it installs over the old one, save kept.

## Building on this PC

Needs Android Studio (its SDK) and JDK 21. JDK 17 is what this PC had on
2026-11-04, and no Android SDK, so the first builds ran on Actions only.

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
```

Unsigned without the three env variables, so a phone will not install it;
`assembleDebug` makes a debug-signed one that installs but cannot update a
release install, and the other way round.

## Costs and upkeep

- Each run spends GitHub Actions minutes (a private repo on the free plan has
  2,000 a month). One run's length is in the Actions tab.
- Updating Capacitor: `npm i -E @capacitor/core@<v> @capacitor/android@<v>`,
  `npm i -E -D @capacitor/cli@<v>`, then `npx cap sync android`. A major
  version can change `android/`; read its migration notes.
- The action versions in the workflow are pinned to exact tags.
