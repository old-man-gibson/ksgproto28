# Android: APK releases

*Set up 2026-11-04. The user picked APK releases over a hosted build.*

Every push to `main` builds an APK on GitHub Actions. With the three signing
secrets set (below) it is a signed release APK, published as a GitHub Release:
the Obtainium app on the phone watches the repo's releases and installs each
new one. Without them it is a debug APK, kept as a run artifact (see "The debug
build"). Nothing is uploaded to a store.

## How it fits together

| Piece | Where | What |
|---|---|---|
| The wrapper | `capacitor.config.json`, `android/` | Capacitor 8.5.3 (pinned; `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`), plus `@capacitor/app` 8.1.2 for the back button (the plugin has its own version line; its newest 8.x is 8.1.2). The app is one Android WebView that loads the built game from `dist/`. `android/` is the Gradle project `npx cap add android` made; `capacitor.build.gradle` and `capacitor.settings.gradle` in it are written by `npx cap sync android`, so rerun it after adding a plugin and commit the two files. |
| The copied game | `android/app/src/main/assets/public` | Written by `npx cap sync android`. Gitignored by Capacitor, so a built game never enters git through `android/`. |
| Version and signing | `android/app/build.gradle` | `versionCode` is the env `APP_VERSION_CODE` (the workflow run number, which only grows: Android refuses an update with a lower one). The release build is signed from `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_ALIAS`; without them it is unsigned. |
| The build | `.github/workflows/android.yml` | `npm ci`, `vite build`, `cap sync android`, then Gradle on `ubuntu-latest` with JDK 21 (the Capacitor modules compile at Java 21; JDK 17 fails). Triggers: a push to `main`, `apk-releases` or `mobile-apk`, and `workflow_dispatch` (Actions tab, any branch). **Three secrets set:** `assembleRelease`; on `main` a release tagged `build-<run>` holding `frontier-idle-<run>.apk`, releases past the newest 10 deleted; on another branch the signed APK as a run artifact. **Any of the three missing:** `assembleDebug`, uploaded as the run artifact `ksg-debug-apk`, no release. |

The app id is `io.github.oldmangibson.frontieridle`. Changing it makes a
different app: the phone keeps the old one and its save.

## What the phone build has

- **No licensed art in the APK.** The enemy battlers, the tile packs and the
  icon packs are gitignored (docs/AUTHORSHIP.md §9), so the Actions build has
  none of them: enemies show no picture, maps draw the node diagram, icons
  are emoji. The art reaches the phone as an art pack (docs/ART_PACK.md):
  `npm run art-pack` on the PC writes `art-pack/frontier-idle-art.zip`; copy
  it to the phone and use Import art pack once (on the floor 0 card's first
  step, or in the Menu after floor 0). The pack is kept in
  the app's storage, so APK updates keep it; uninstalling deletes it. Rerun
  and reimport when new art is added. A build made on this PC has the art
  built in; do not share that APK.
- **Its own save.** The save lives in the app's WebView storage, apart from
  any browser's. The header's Export and Import move a save between the two.
- **The desktop layout.** The phone layout (UI proposal A3) is not built.
- **Both orientations, keyboard resize.** The manifest sets no orientation lock
  (the phone's rotation setting decides) and `windowSoftInputMode=adjustResize`,
  so the page shrinks above the on-screen keyboard.
- **The back button** (`src/ui/lib/androidBack.ts`, started from `main.ts`).
  It sends the same Escape that closes every window, drawer and picker on the
  desktop, so the newest one closes. The welcome-back and fight-summary windows
  close on Escape too (they only closed on a tap outside before). The dare,
  evolve and prestige windows hold play until answered and ignore it, as they
  ignore Escape. With nothing open
  it moves the app to the background, like Home. It never exits the app: the
  idle loop would stop. Outside the Android app it does nothing.
- **Storage that survives launches.** Capacitor turns DOM storage on, so
  `localStorage` (the save) and IndexedDB (the art pack) persist across
  launches and across updates signed with the same key. The WebView's origin is
  `https://localhost`. Changing `server.androidScheme` or `server.hostname` in
  `capacitor.config.json` changes the origin and the save would look lost.
- **The end of the ladder.** Floors stop at 20. Once floor 20 is cleared the
  tower list on the map shows "Floor 21: not in this build." above floor 20, and
  the log says it once when the clear pays. It is read from the clear counters:
  no save field.

## The debug build

With no signing secrets in the repo (a fresh fork, or the keystore not set yet)
the workflow builds `assembleDebug` instead of failing. The APK is debug-signed
and installs like any other.

Getting it, on github.com:

1. Actions → the run of "Android APK" for the branch. A push to `main`,
   `apk-releases` or `mobile-apk` starts one; Run workflow starts one on any
   branch once the workflow file is on `main`.
2. Artifacts → `ksg-debug-apk` downloads a zip. Unzip it: it holds
   `frontier-idle-debug-<run>.apk`. GitHub keeps run artifacts for the
   repository's retention period (90 days unless changed).
3. Copy the APK to the phone (USB, a cloud drive, or download the zip on the
   phone and unzip it there).
4. Open the APK from a file manager. Android asks to allow "Install unknown
   apps" for that app: allow it once. Then Install.

Limits of the debug build:

- **A new debug APK cannot be installed over an older one.** Each run's
  runner generates its own debug key, so the signatures differ and Android
  refuses the update ("App not installed"). To move to a newer one: Menu →
  Export (saves the game as a file), uninstall the app, install the new APK,
  Import the file. The uninstall also deletes the art pack: import it again.
- **It cannot replace a release install, or the other way round.** Same app id,
  different key. Pick one path per phone.
- **No licensed art.** The enemy battlers, tile packs and icon packs are
  gitignored and the Actions checkout has none of them, so enemies show no
  picture, maps draw the node diagram and icons are emoji. Import the art pack
  as for the release build (`npm run art-pack` on the PC, copy
  `art-pack/frontier-idle-art.zip` to the phone, Import art pack on the floor 0
  card or in the Menu).
- **Version.** `versionCode` is the run number and `versionName` is
  `debug-<run>`.

Not checked (2026-11-12): this PC has JDK 17 and no Android SDK, so Gradle has
not run here. The debug path, the manifest change and the back button on a
device have been read and unit-tested only; the first Actions run is the first
build of them.

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
release install, and the other way round. A local debug build is signed with
this PC's own `~/.android/debug.keystore`, so it can be updated by later local
builds but not by an Actions one.

## Costs and upkeep

- Each run spends GitHub Actions minutes (a private repo on the free plan has
  2,000 a month). One run's length is in the Actions tab.
- Updating Capacitor: `npm i -E @capacitor/core@<v> @capacitor/android@<v>`,
  `npm i -E -D @capacitor/cli@<v>`, `npm i -E @capacitor/app@<newest 8.x>`, then
  `npx cap sync android`. A major version can change `android/`; read its
  migration notes. The CLI needs Node 22 or newer.
- The action versions in the workflow are pinned to exact tags.
