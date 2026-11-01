import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
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

export default defineConfig({
  // The forge and the board are dev-only plugins (apply: 'serve') and neither
  // forge/index.html nor board/index.html is a build input, so `vite build`
  // produces exactly the game it always did.
  plugins: [svelte(), forge(), board()],
  base: './',
  server: { watch: { ignored: unwatched } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
