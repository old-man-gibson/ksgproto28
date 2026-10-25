import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { forge } from './forge/server/plugin';
import { board } from './board/server/plugin';

export default defineConfig({
  // The forge and the board are dev-only plugins (apply: 'serve') and neither
  // forge/index.html nor board/index.html is a build input, so `vite build`
  // produces exactly the game it always did.
  plugins: [svelte(), forge(), board()],
  base: './',
  // .claude/worktrees holds a full copy of the project per agent or session
  // branch (37 on 2026-10-25). Watching them made the dev server too slow to
  // serve the first page: 84 s for main.ts against 38 s with them ignored.
  server: { watch: { ignored: ['**/.claude/**'] } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
