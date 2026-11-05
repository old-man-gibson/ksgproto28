# Art pack

The licensed art (enemy portraits, icons, tile sheets) is gitignored
([AUTHORSHIP §9](AUTHORSHIP.md)), so a build made from git has none of it: the
Android APK built on GitHub Actions shows emoji instead of pictures and icons,
and the node diagram instead of tile maps. The art pack puts the art back
without putting it in git. On the PC one command writes a zip of the art the
game uses. In the game, Import art pack stores that zip in the browser's own
storage once. From then on the game uses a file from the pack wherever the
bundle lacks it. The code keeps updating from git; the pack stays.

## Make the zip

```
npm run art-pack
npm run art-pack -- --from D:/ksgproto28/src/assets
```

Writes `art-pack/frontier-idle-art.zip` (gitignored). Needs node 22.18 or
later: the script loads `src/ui/lib/artPack/format.ts` with node's type
stripping, the same module the game unzips with.

- Wanted files: the path literals in the glob calls of the three generated
  lists, `src/ui/lib/enemyArt.gen.ts`, `src/ui/lib/icons/art.gen.ts` and
  `src/ui/lib/tilemaps/sheets.gen.ts`. Name new art the usual way (`npm run
  enemy-art`, `npm run icons`, the forge's Tiles mode) and rerun `art-pack`.
- A file's key is its path relative to `src/assets`, forward slashes:
  `enemies/Book Monster.png`.
- `--from <dir>` is the assets root to read (default `src/assets`). A worktree
  without art packs the main checkout's. It only reads.
- Prints the file count, the total size and each wanted file missing on disk.
  Writes the zip if any file was found.
- The zip holds `manifest.json` (`{ "format": 1, "made": "<ISO date>", "files":
  [{ "key", "bytes" }] }`) and each file under its key, stored without
  compression.

## Import it

Menu, Import art pack, choose the zip. The game checks that it is a zip, that
the manifest says `format` 1 and that every manifest key is in the zip at the
stated size. A file that fails leaves the old pack as it was and the status
line reads `Art pack: not an art pack zip.` A good file replaces the old pack in
one IndexedDB transaction. The status line reads `Art pack: 61 files, made
2026-11-05.` or `Art pack: none.` Remove art pack deletes the stored pack.

The Menu button is hidden on floor 0; a fresh save gets it after the tutorial.

## How the game uses it

- Storage: the IndexedDB database `frontier-idle-art` (stores `files`,
  `meta`), apart from the save. The save and localStorage are not touched.
- Startup reads the manifest only. A file's Blob is read on its first lookup
  and turned into an object URL, so a pack costs memory for the art on screen.
- One resolver (`resolveArt` in `src/ui/lib/artPack/artPack.svelte.ts`) serves
  enemy portraits, icons and tile sheets: the bundled URL first, the pack's URL
  second, nothing third (the emoji, the node diagram). A picture drawn before
  the pack finishes loading switches when its URL arrives, without a reload.
- Deity portraits (`src/assets/deities`) are not part of it: they are not
  licensed and are committed.
- No IndexedDB, no pack or a storage error: the game behaves as without a pack.

## What survives

| Event | Pack |
| --- | --- |
| Reload, new build, app update | Stays |
| Uninstall, Clear storage, clearing site data | Gone; import again |
| A different origin (another port, another host) | Separate; import there |

Where it lives: IndexedDB of the page's origin, which is a browser origin or the
Android app's own. After an import the game asks the browser to keep the storage
(`navigator.storage.persist()`); the answer is not used, so a browser may still
evict it under storage pressure.

## License

The zip holds licensed pixels (Ækashics battlers, Clockwork Raven icons, Epic
RPG World tiles). It goes only to the user's own devices. Never commit it,
attach it to a release or share it. `art-pack/` is in `.gitignore`.
