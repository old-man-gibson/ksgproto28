import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchForWorkspaceRoot } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { forge } from './forge/server/plugin';
import { board } from './board/server/plugin';

// This checkout's own .claude folder. Its worktrees/ holds a full copy of the
// project per agent or session branch (37 on 2026-10-25); watching them made
// the dev server too slow to serve the first page: 84 s for main.ts against
// 38 s with them ignored. Only THIS root's .claude is skipped: a glob like
// '**/.claude/**' would also match every file of a server started inside a
// worktree, whose own root sits under .claude/worktrees/.
//
// The third-party art packs are skipped for the same reason: 30,536 files
// (2026-11-01) that the watcher stats one by one at startup, queued ahead of
// every module read. A cold start served its first page in 43 s with them
// watched and 6.4 s without. Nothing needs them watched: the game reaches
// them only through the generated lists (enemyArt.gen.ts, icons/art.gen.ts,
// tilemaps/sheets.gen.ts), which sit outside these folders and are watched,
// and the forge scans the tile packs on request. A file changed in a pack
// shows after a page reload.
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const UNWATCHED = [
  '.claude',
  path.join('src', 'assets', 'enemies'),
  path.join('src', 'assets', 'packs'),
  path.join('src', 'assets', 'tilemaps'),
].map((dir) => path.resolve(ROOT, dir).toLowerCase());
const unwatched = (file: string) => {
  const p = path.resolve(file).toLowerCase();
  return UNWATCHED.some((dir) => p === dir || p.startsWith(dir + path.sep));
};

// A worktree links node_modules (and the gitignored art) in from the main
// checkout. Vite resolves the link to its real path, which sits outside the
// worktree's root, and the dev server then refuses the files: every
// @fontsource face falls back to the next font in its stack (2026-11-05).
// Allowing the real paths of the linked folders serves them. In the main
// checkout each real path is the folder itself, so nothing changes there.
const LINKED = [
  'node_modules',
  path.join('src', 'assets', 'enemies'),
  path.join('src', 'assets', 'packs'),
  path.join('src', 'assets', 'tilemaps'),
];
const linkedReal = LINKED.flatMap((dir) => {
  try {
    return [fs.realpathSync(path.resolve(ROOT, dir))];
  } catch {
    return [];
  }
});

export default defineConfig({
  // The forge and the board are dev-only plugins (apply: 'serve') and neither
  // forge/index.html nor board/index.html is a build input, so `vite build`
  // produces exactly the game it always did.
  plugins: [svelte(), forge(), board()],
  base: './',
  server: {
    watch: { ignored: unwatched },
    fs: { allow: [searchForWorkspaceRoot(ROOT), ...linkedReal] },
  },
  test: {
    projects: [
      // The game and its pure view code, in plain node.
      {
        extends: true,
        test: {
          name: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: [...configDefaults.exclude, 'tests/**/*.dom.test.ts'],
          environment: 'node',
        },
      },
      // Components mounted for real, in jsdom (`*.dom.test.ts`). The `browser`
      // condition makes Svelte resolve its client build, which has `mount`.
      {
        extends: true,
        resolve: { conditions: ['browser'] },
        test: { name: 'dom', include: ['tests/**/*.dom.test.ts'], environment: 'jsdom' },
      },
    ],
  },
});
