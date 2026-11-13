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
| The wrapper | `capacitor.config.json`, `android/` | Capacitor 8.5.3 (pinned; `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`), plus `@capacitor/app` 8.1.2 (back button, `pause`), `@capacitor/filesystem` 8.1.5 and `@capacitor/share` 8.0.3 (Export). The plugins have their own version lines; each was the newest stable 8.x on 2026-11-12, and each needs `@capacitor/core` 8.0 or newer. The app is one Android WebView that loads the built game from `dist/`. `android/` is the Gradle project `npx cap add android` made; `capacitor.build.gradle` and `capacitor.settings.gradle` in it are written by `npx cap sync android`, so rerun it after adding a plugin and commit the two files. |
| The copied game | `android/app/src/main/assets/public` | Written by `npx cap sync android`. Gitignored by Capacitor, so a built game never enters git through `android/`. |
| Version and signing | `android/app/build.gradle` | `versionCode` is the env `APP_VERSION_CODE` (the workflow run number, which only grows: Android refuses an update with a lower one). The release build is signed from `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_ALIAS`; without them it is unsigned. The debug build is signed with the committed `android/app/debug.keystore` (`signingConfigs.debug`). |
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
  any browser's. Export and Import (Menu) move a save between the two.
  **Export** cannot click a download link here (the WebView drops a blob
  link), so it writes `frontier-idle-save-<date>.json` to the app's cache
  folder and opens the Android share sheet on it
  (`src/ui/lib/nativeExport.ts`): choose Files, Drive or a message to keep it.
  Android does not say which choice was made, so the game does not claim the
  file is saved: open it from where you put it to check. Dismissing the sheet
  logs nothing; a failed write logs `Save export failed: <reason>`. A browser
  still downloads the file as before. **Import** is the file chooser and works
  as in a browser; it lists files typed `application/json`.
- **The phone layout.** Below 700 px wide the shell is the phone layout
  (docs/PHONE.md); the panels inside the screens are the desktop ones.
- **Both orientations, keyboard resize.** The manifest sets no orientation lock
  (the phone's rotation setting decides) and `windowSoftInputMode=adjustResize`,
  so the page shrinks above the on-screen keyboard.
- **The back button** (`src/ui/lib/androidBack.ts`, started from `main.ts`).
  One press closes exactly one overlay, the topmost, from the same stack
  Escape reads (see "Closing overlays"). With nothing open it writes the save
  and moves the app to the background, like Home. It never exits: the idle loop
  would stop. The dare, evolve and prestige windows hold play until answered:
  they take the press and do nothing, and nothing under them closes. While the
  boot catch-up runs (`ui.catchingUp`) back is ignored. Outside the Android
  app none of this is installed.
- **Storage that survives launches.** Capacitor turns DOM storage on, so
  `localStorage` (the save) and IndexedDB (the art pack) persist across
  launches and across updates signed with the same key. The WebView's origin is
  `https://localhost`. Changing `server.androidScheme` or `server.hostname` in
  `capacitor.config.json` changes the origin and the save would look lost.
- **The end of the ladder.** Floors stop at 20. Once floor 20 is cleared the
  tower list on the map shows "Floor 21: not in this build." above floor 20, and
  the log says it once when the clear pays. A clear that pays while the player is
  away cannot reach the log (it is suppressed during catch-up), so the welcome-back
  report carries the line instead (`OfflineSummary.ladderEnd`, as `firstCalm`).
  It is read from the clear counters: no save field.

## Closing overlays

`src/ui/lib/overlays.ts` keeps one stack of the open windows, drawers, cards and
pickers. Escape (one `keydown` listener, installed when the first overlay joins)
and the Android back button both call `closeTopOverlay()`, which closes the top
entry and nothing else. Nothing reads the DOM to find out what is open.

**Order.** An entry has a layer, the CSS z-index its overlay is drawn at, so the
top of the stack is what is on top of the screen. Within a layer the later
arrival is on top.

| `LAYER` | z-index | Who |
|---|---|---|
| `page` | none (page flow) | a picker or pick mode drawn in the screen body: the chromosome's socket picker, a picked rotation card or plan row, the family roster, the music cursor, a wuxin pick or drag |
| `drawer` | 9 | the log drawer, the map card, a tag picker's list |
| `report` | 10 | the welcome-back report |
| `window` | 20 | `lib/Modal.svelte` (the Menu, benches, the Cook's Book), the fight summary |
| `hold` | 30 | the dare, evolve and prestige windows: joined with `close: null` |
| `tip` | 100 | a touch tip card (`lib/Tip.svelte`) |

`tests/overlayLayers.test.ts` fails when a component's CSS z-index and its layer
differ (`page` has no z-index: it is below every drawn overlay, and the test checks
that it is under `drawer`). A window opened from another (a bench, then its Cook's
Book) sits on the same layer, later, so one press closes only the newer.

**Joining.** A component that closes on Escape or back joins while it is open and
leaves when it closes. `pushOverlay(layer, close)` returns the function that leaves:

```ts
// a window: join for its life
onMount(() => pushOverlay(LAYER.window, () => onclose()));

// a popup: join while it is open
$effect(() => {
  if (open) return pushOverlay(LAYER.drawer, () => (open = false));
});
```

`close` must make the overlay go away (clear the flag that shows it), or its entry
stays and blocks everything under it. Pass `null` as `close` for a window that
holds play: Escape and back do nothing while it is on top. A component must not
also read Escape itself, or one press closes two things.

**Pickers and pick modes inside a panel.** The layer a picker joins on is the layer of
whatever it is drawn in, and only the host knows it. `Modal` calls
`provideHostLayer(LAYER.window)` at init; a panel (or `TagPicker`) calls
`hostLayer(LAYER.page)` (`hostLayer(LAYER.drawer)` for the tag list) once at init,
never inside an effect, and joins with the second pattern above on a `$derived`
boolean for "is one open". Inside a `Modal` the picker is on the window layer, later
than its window, so back closes the picker and a second press the window; in the
screen body it is on the page layer, under every window, drawer and card, so a window
or the welcome-back report that opens over a pick closes first. The boolean matters:
an effect that reads the picked id itself rejoins when one pick replaces another and
moves the entry above a window opened since. Members: the bench and chromosome slot
pickers, the rotation card and plan row picks, the family roster, the spell tile
pick, the music pitch cursor, a wuxin pick or drag, `TagPicker`'s list. No panel
reads Escape itself (`tests/overlayLayers.test.ts` fails on one); the order is
`tests/pickOverlays.dom.test.ts`. The rule for a new panel is also in
[PHONE.md](PHONE.md) section 7.

## When the game saves

`src/ui/lib/saveTriggers.ts` writes the save (`save()`, the autosave's call) on
`beforeunload`, `pagehide` and the page going hidden (`visibilitychange`). The
Android app adds the App plugin's `pause` event and the back button, just before
it minimizes: Android can end a backgrounded app without a word, and the 30 s
autosave would then have lost up to 30 s of play.

- **Cost.** On 2026-11-12, a save of a run through floor 20 (42 KB of JSON) took
  4 to 6 ms through the reactive state, 0.3 ms from a plain object. A run of
  this size saves at that cost on every trigger.
- **Race with the autosave.** There is none: the autosave and every trigger run on
  the one JS thread, and a save is one synchronous serialize and write. Each
  trigger restarts the autosave clock, so the two do not fire back to back.
- **Not before the boot catch-up.** While `ui.catchingUp` is set the state is still
  the saved one and a write would reset `lastSaved`, losing the time away that the
  catch-up is about to credit. Every trigger, `beforeunload` included, skips then.
- **Several triggers in a row** (a page closing fires hidden, `pagehide` and
  `beforeunload`) write the save up to three times. Not deduplicated: each is a few
  ms and the last one wins.

## Time away while the app is alive

A phone asleep with the app's process alive is not the boot catch-up (that is a
process that ended, read back from `gs.lastSaved`). The frame pump
(`src/ui/lib/pump.ts`, started from `lib/runtime.ts`, which `main.ts` calls once the
app has mounted) measured the gap between frames with `performance.now()`, a
monotonic clock that stops while the device sleeps, so a night asleep was credited as
the few seconds the clock saw. It reads `Date.now()` as well on every call. When the
wall clock gained more than 5 s on the monotonic one, the surplus is sleep. A wall
clock that went backwards, or drift under 5 s, is not.

**One absence, one credit.** The 8 h cap and the report belong to one catch-up, so an
absence is cashed in one:

- **Page visible** (the screen is on, or a laptop woke): the gap is credited whole, the
  monotonic gap plus the sleep, through the catch-up whatever its size (the same capped
  detached run the boot makes, `catchUp` in `state.svelte.ts`, with its "Welcome back"
  report). A gap under a minute runs quietly with no report. It goes through the
  catch-up and not the tick loop because the loop's 30-tick valve drops most of a 5 to
  10 s gap (a 7 s sleep credited 3 s). From a minute the "Catching up" overlay is shown
  first (`ui.catchingUp`, as the boot does), a frame is painted, and then the run
  starts, so the WebView is not frozen with no word. Saves and the back button are
  blocked while it shows, as at boot.
- **Page hidden** (Android wakes a sleeping WebView for short windows in which the
  1 s interval fires): the sleep is **carried**, not credited, and what the monotonic
  clock saw is credited as usual. Crediting each window as it came gave three 7 h
  pieces 21 h, not the 8 h one gap gets, and a report of the last piece. A carried
  sleep also stops the pump's autosave: a save writes `gs.lastSaved`, and a process
  that ended before the credit would lose that time at the next boot. The save the
  hidden page made before the sleep left it where the boot credits from.
- **Back** (`resume` from the App plugin, the page turning visible): `pump.settle()`
  cashes everything carried plus the gap since the last call, as one absence, capped
  once, reported once. `settle()` counts the page as visible even when
  `document.visibilityState` still says hidden (the plugin's event can come first).

Nothing is counted twice. A call reads both clocks and moves both marks to now, and a
catch-up moves them again when it returns, so a gap is credited by one call and the
catch-up's own duration (17 to 29 s per 8 h on a developed save, more on a phone) is
never a second gap with a second report. While the overlay waits to paint the pump
does nothing (`busy`). The gap is measured from the pump's own wall mark, never earlier
than `gs.lastSaved`, so a hidden page that kept pumping (a throttled desktop tab, both
clocks running) is credited by its own clock and not again from `lastSaved`. A paused
world drops the gap and what was carried. A wall clock set forward credits up to the
cap, as it already did for the boot catch-up. An ordinary hidden gap the monotonic
clock saw over 10 s is still its own catch-up with its own report; a throttled tab
reports its last minute, not the whole time hidden.

`lib/runtime.ts` is the wiring: the pump starts after `boot()`, never before; the
`visibilitychange` and `resume` events settle it; the save triggers are blocked while a
catch-up is pending.

- **Checked.** `tests/pump.test.ts` moves fake clocks: the 8 h night through `settle`
  with a catch-up that itself takes 70 s (one report of the whole night, no second gap),
  three 7 h hidden pieces then `settle` (one catch-up of 21 h handed to the cap: 8 h
  credited, one report), 5.1, 7, 9.9 and 11 s asleep credited in full, resume plus
  visible plus a frame, a throttled tab, drift, a backwards clock, a paused world, the
  autosave, a catch-up that throws. `tests/runtime.dom.test.ts` runs the wiring on a
  fake frame loop and the App plugin's events. In the Browser pane (a `Date.now` offset
  and an overridden `visibilityState`): a 3 h jump showed the overlay, a painted frame
  about 220 ms later, then one "Welcome back ... 3h 0m" report; three 7 h jumps while
  hidden showed nothing, and returning showed one report, "8h 0m (capped at 8h)". Not on
  a device.

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

Updates install in place. Every debug APK, from Actions or from a PC, is
signed with the same key, `android/app/debug.keystore`, so a newer one installs
over an older one and keeps the save and the art pack. The key is the standard
Android debug key (alias `androiddebugkey`, store and key password `android`).
It is public, in the repo on purpose, and only for debug builds: anyone can sign
an APK with it, so it must never sign a release. `versionCode` must still grow:
Actions numbers it by run, and a local build is 1 unless `APP_VERSION_CODE` is
set, so a local build does not install over an Actions one.

Limits of the debug build:

- **It cannot replace a release install, or the other way round.** Same app id,
  different key. Pick one path per phone. Moving from debug to release (or back)
  means: Menu → Export, and keep the file where the share sheet offers (Files or
  Drive); **open it from there and confirm it exists and is not empty before
  uninstalling**, because the uninstall deletes the save and the art pack with
  nothing to get them back; then uninstall, install the other build, Menu →
  Import, and import the art pack again.
- **No licensed art.** The enemy battlers, tile packs and icon packs are
  gitignored and the Actions checkout has none of them, so enemies show no
  picture, maps draw the node diagram and icons are emoji. Import the art pack
  as for the release build (`npm run art-pack` on the PC, copy
  `art-pack/frontier-idle-art.zip` to the phone, Import art pack on the floor 0
  card or in the Menu).
- **Version.** `versionCode` is the run number and `versionName` is
  `debug-<run>`.

Not checked (2026-11-12): this PC has JDK 17 and no Android SDK, so Gradle has
not run here. The debug path, the debug signing block, the manifest change and
the back button on a device have been read and unit-tested only; the first
Actions run is the first build of them. `debug.keystore` was made with
`keytool -genkeypair -storetype PKCS12 -alias androiddebugkey -keyalg RSA
-keysize 2048 -validity 12000 -startdate 2020/01/01` and its listing checked
with `keytool -list`.

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
Lose the key and the next build cannot update the phone: export the save and
confirm the file exists (see "The debug build"), uninstall, install the new
build, import. Back the folder up outside the repo.

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
the same committed `debug.keystore` as an Actions one, so the two can update
each other as long as the later one has the higher `versionCode`.

## Costs and upkeep

- Each run spends GitHub Actions minutes (a private repo on the free plan has
  2,000 a month). One run's length is in the Actions tab.
- Updating Capacitor: `npm i -E @capacitor/core@<v> @capacitor/android@<v>`,
  `npm i -E -D @capacitor/cli@<v>`, `npm i -E @capacitor/app@<newest 8.x>`, then
  `npx cap sync android`. A major version can change `android/`; read its
  migration notes. The CLI needs Node 22 or newer.
- The action versions in the workflow are pinned to exact tags.
