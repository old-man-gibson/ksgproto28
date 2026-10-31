/**
 * Loads the FACET core: one bare side-effect import per file, in MANIFEST.json
 * order (load order does not matter to the core; this order is only tidy).
 *
 * Bare imports only. A named import (`import { x } from './facet.core.js'`)
 * passes vitest and fails `vite build` and `vite dev`, because the files have
 * no exports; TypeScript does not check that a side-effect import's path
 * exists either, so `vite build` in `npm run verify` is the only gate on a
 * mistyped path here (FACET-SPEC §2.1).
 *
 * facet.cases.js is the core's test corpus and is not loaded by the game;
 * tests/facet.test.ts imports it.
 */
import './facet.core.js';
import './facet.data.js';
import './facet.registry.js';
import './facet.cells.js';
import './facet.relations.js';
import './facet.pipeline.js';
import './facet.gate.js';
import './facet.mortal.js';
import './facet.forge.js';
import './facet.oracle.js';
import './facet.compile.js';
