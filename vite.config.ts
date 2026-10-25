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
const CLAUDE_DIR = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '.claude').toLowerCase();
const inClaudeDir = (file: string) => {
  const p = path.resolve(file).toLowerCase();
  return p === CLAUDE_DIR || p.startsWith(CLAUDE_DIR + path.sep);
};

export default defineConfig({
  // The forge and the board are dev-only plugins (apply: 'serve') and neither
  // forge/index.html nor board/index.html is a build input, so `vite build`
  // produces exactly the game it always did.
  plugins: [svelte(), forge(), board()],
  base: './',
  server: { watch: { ignored: inClaudeDir } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
