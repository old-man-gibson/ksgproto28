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
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
