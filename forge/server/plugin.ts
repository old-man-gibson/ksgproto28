/**
 * The forge's dev-only backend, as a Vite plugin.
 *
 * Two ideas carry the whole thing:
 *
 * 1. **The data is loaded, not parsed.** `ssrLoadModule` runs the real
 *    `registry.ts` through Vite's TS pipeline and hands back the actual
 *    objects the game uses. The forge can therefore never drift from the
 *    types — if you add a field, it shows up; if you rename an id, every
 *    reference to it is instantly wrong in the validator.
 * 2. **Writes are surgical.** Edits go through `edit.ts`, which replaces exact
 *    AST ranges. Comments, spacing and hand-formatting outside the edited node
 *    survive untouched.
 *
 * `apply: 'serve'` — none of this exists in a production build.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Connect, Plugin, ViteDevServer } from 'vite';
import { CATALOG, catalogFor, WRITABLE } from './catalog';
import {
  notesOf,
  reorderEntry,
  setNoteAt,
  sourceOf,
  type NoteMarker,
  type PathStep,
} from './edit';
import { diffLines, diffStat } from './diff';
import { routeOp, textFileFor } from './prose';

const API = '/__forge/api';

export type PatchOp =
  | { op: 'set'; kind: string; path: PathStep[]; value: unknown }
  | { op: 'delete'; kind: string; path: PathStep[] }
  | { op: 'add'; kind: string; key: string; value: unknown }
  | { op: 'rename'; kind: string; from: string; to: string }
  | { op: 'reorder'; kind: string; key: string; anchor: string; before: boolean }
  | { op: 'note'; kind: string; key: string; marker: NoteMarker; text: string | null };

interface PatchRequest {
  ops: PatchOp[];
  /** Produce the diff without touching disk. */
  dryRun?: boolean;
}

/**
 * Values that survive the trip to the browser. The registries hold the odd
 * function (skill progression curves, condition predicates) and those simply
 * become a marker — the forge shows them as read-only rather than pretending
 * it can edit a closure.
 */
function toJson(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'function') return { __fn: (value as { name?: string }).name || 'anonymous' };
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : { __num: String(value) };
  }
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return { __circular: true };
  seen.add(value as object);
  if (value instanceof Map) return { __map: [...value].map(([k, v]) => [toJson(k, seen), toJson(v, seen)]) };
  if (value instanceof Set) return { __set: [...value].map((v) => toJson(v, seen)) };
  if (Array.isArray(value)) return value.map((v) => toJson(v, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = toJson(v, seen);
  return out;
}

function send(res: Parameters<Connect.NextHandleFunction>[1], status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(json);
}

async function readBody(req: Parameters<Connect.NextHandleFunction>[0]): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export function forge(): Plugin {
  let server: ViteDevServer;
  let rootDir = process.cwd();

  /** Guarded read of a data file. */
  const readData = async (rel: string): Promise<string> => {
    if (!WRITABLE.has(rel)) throw new Error(`Refusing to read outside the content catalog: ${rel}`);
    return fs.readFile(path.join(rootDir, rel), 'utf8');
  };

  /**
   * Every write leaves a timestamped copy behind first. This repo has no git,
   * so "undo" means "the file that was there ten seconds ago" — and that only
   * exists if we put it there.
   */
  const backup = async (rel: string, text: string): Promise<string> => {
    const dir = path.join(rootDir, '.forge-backups');
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `${path.basename(rel, '.ts')}.${stamp}.ts`;
    await fs.writeFile(path.join(dir, name), text, 'utf8');
    return `.forge-backups/${name}`;
  };

  return {
    name: 'ksg-forge',
    apply: 'serve',

    configResolved(config) {
      rootDir = config.root;
    },

    configureServer(dev) {
      server = dev;

      dev.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith(API)) return next();
        const route = url.split('?')[0].slice(API.length);

        try {
          // ---------- What content kinds exist, and where they live ----------
          if (route === '/catalog') {
            return send(res, 200, { catalog: CATALOG });
          }

          // ---------- The real, live game data ----------
          if (route === '/registry') {
            const registry = await server.ssrLoadModule('/src/core/registry.ts');
            const attributes = await server.ssrLoadModule('/src/core/data/attributes.data.ts');
            const locations = await server.ssrLoadModule('/src/core/data/locations.data.ts');
            const types = await server.ssrLoadModule('/src/core/types.ts');
            const triggers = await server.ssrLoadModule('/src/core/systems/triggers.ts');
            const resources = await server.ssrLoadModule('/src/core/data/resources.data.ts');
            const progression = await server.ssrLoadModule('/src/core/data/progression.data.ts');
            const deities = await server.ssrLoadModule('/src/core/data/deities.data.ts');
            const climate = await server.ssrLoadModule('/src/core/data/climate.data.ts');
            const proseMod = await server.ssrLoadModule('/src/core/text/prose.ts');
            const exposure = await server.ssrLoadModule('/src/core/systems/exposure.ts');

            // The TODO/SPEC comment lines above each entry — these live in the
            // SOURCE, not in the loaded objects, so they come from a parse.
            const noteTexts = new Map<string, string>();
            const notes: Record<string, unknown> = {};
            for (const entry of CATALOG) {
              if (!noteTexts.has(entry.file)) noteTexts.set(entry.file, await readData(entry.file));
              notes[entry.kind] = notesOf(entry.file, noteTexts.get(entry.file)!, entry.root);
            }

            const data: Record<string, unknown> = {};
            for (const entry of CATALOG) {
              const mod = entry.module ? await server.ssrLoadModule(entry.module) : registry;
              const root = mod[entry.exportName];
              // A root that was never re-exported and a genuinely empty registry
              // are indistinguishable downstream, so a catalogued kind wired to
              // nothing just browses as "no entries yet" — which is how four
              // mutagen registries sat invisible. Say it out loud; the fix is
              // one line in registry.ts.
              if (root === undefined) {
                console.warn(
                  `[forge] '${entry.kind}' is catalogued, but ${entry.exportName} is not exported ` +
                    `from ${entry.module ?? 'src/core/registry.ts'} — it will browse as empty.`,
                );
              }
              data[entry.kind] = toJson(root ?? {});
            }

            return send(res, 200, {
              data,
              // Extras the editors need but that aren't editable registries.
              meta: toJson({
                startingSpot: locations.STARTING_SPOT,
                // Text-table keys that named no entry (src/core/text/prose.ts).
                proseOrphans: proseMod.PROSE_ORPHANS,
                attributes: attributes.ATTRIBUTE_LIST,
                statNames: types.STAT_NAMES,
                skillCategories: types.SKILL_CATEGORIES,
                resStatByType: types.RES_STAT_BY_TYPE,
                adjacency: [...(registry.ADJACENCY as Map<string, unknown[]>)].map(([k, v]) => [k, v]),
                tiers: registry.TIERS,
                modifierTiers: registry.MODIFIER_TIERS,
                rarities: registry.RARITIES,
                monsterTags: registry.MONSTER_TAGS,
                qualityOrder: registry.QUALITY_ORDER,
                // The game's identifier language, for the vocabulary lookup.
                triggerEvents: triggers.TRIGGER_EVENTS,
                triggerSubjects: (
                  triggers.TRIGGER_SUBJECT_LIST as { id: string; name?: string; kind?: string }[]
                ).map((s) => ({ id: s.id, name: s.name, kind: s.kind })),
                resources: resources.RESOURCE_LIST,
                counters: await harvestCounters(rootDir),
                xpBase: progression.XP_BASE,
                xpRate: progression.XP_RATE,
                progressions: progression.PROGRESSIONS,
                // Grouping vocabulary: deity tags carry `category`, and the
                // 'membership' ones say which pantheon a god is counted among.
                deityTags: deities.DEITY_TAGS,
                terrains: Object.keys(climate.TERRAIN_PROFILES as Record<string, unknown>),
                // Spot tag vocabulary, shaped like a registry for tagVocab.
                spotTags: Object.fromEntries([
                  ...[...(exposure.ELEMENT_TAGS as Set<string>)].map((t) => [t, { category: 'element' }]),
                  ...[...(exposure.PLACE_TAGS as Set<string>)].map((t) => [t, { category: 'place' }]),
                ]),
                notes,
              }),
            });
          }

          // ---------- Exact source text of one entry ----------
          if (route === '/source' && req.method === 'POST') {
            const { kind, path: entryPath } = (await readBody(req)) as {
              kind: string;
              path: PathStep[];
            };
            const entry = catalogFor(kind);
            const text = await readData(entry.file);
            return send(res, 200, {
              file: entry.file,
              source: sourceOf(entry.file, text, entry.root, entryPath),
            });
          }

          // ---------- Apply (or preview) a batch of edits ----------
          if (route === '/patch' && req.method === 'POST') {
            const { ops, dryRun } = (await readBody(req)) as PatchRequest;
            if (!Array.isArray(ops) || ops.length === 0) {
              return send(res, 400, { error: 'No ops supplied' });
            }

            // Group by file; each file is re-parsed between ops so ranges stay
            // valid, then written once at the end.
            const originals = new Map<string, string>();
            const working = new Map<string, string>();
            const notes: string[] = [];

            const load = async (file: string): Promise<string> => {
              if (!originals.has(file)) {
                const text = await readData(file);
                originals.set(file, text);
                working.set(file, text);
              }
              return working.get(file)!;
            };

            for (const op of ops) {
              const entry = catalogFor(op.kind);
              if (!WRITABLE.has(entry.file)) {
                return send(res, 400, { error: `Not writable: ${entry.file}` });
              }
              const current = await load(entry.file);
              if (op.op === 'note') {
                if (op.marker !== 'TODO' && op.marker !== 'SPEC') {
                  return send(res, 400, { error: `Unknown note marker: ${String(op.marker)}` });
                }
                const result = setNoteAt(entry.file, current, entry.root, op.key, op.marker, op.text);
                working.set(entry.file, result.text);
                notes.push(result.note);
                continue;
              }
              // Moving an entry is data-only: prose is keyed by id, so the text
              // file next door has nothing to follow.
              if (op.op === 'reorder') {
                const result = reorderEntry(entry.file, current, entry.root, op.key, op.anchor, op.before);
                working.set(entry.file, result.text);
                notes.push(result.note);
                continue;
              }
              // Prose fields live in the text file next door; one client op
              // may become a data edit plus several text edits (prose.ts).
              const textText = await load(textFileFor(entry.file));
              for (const edit of routeOp(op, entry, current, textText)) {
                const result = edit.apply(working.get(edit.file)!);
                working.set(edit.file, result.text);
                notes.push(result.note);
              }
            }

            const changes = [...working].map(([file, after]) => {
              const before = originals.get(file)!;
              const hunks = diffLines(before, after);
              return { file, hunks, stat: diffStat(hunks), unchanged: before === after };
            });

            if (dryRun) return send(res, 200, { dryRun: true, notes, changes });

            const backups: string[] = [];
            for (const [file, after] of working) {
              const before = originals.get(file)!;
              if (before === after) continue;
              backups.push(await backup(file, before));
              await fs.writeFile(path.join(rootDir, file), after, 'utf8');
            }
            return send(res, 200, { dryRun: false, notes, changes, backups });
          }

          // ---------- Run the content linter ----------
          if (route === '/verify' && req.method === 'POST') {
            const result = await runVitest(rootDir);
            return send(res, 200, result);
          }

          // ---------- List / restore backups ----------
          if (route === '/backups') {
            const dir = path.join(rootDir, '.forge-backups');
            const files = await fs.readdir(dir).catch(() => [] as string[]);
            return send(res, 200, { backups: files.sort().reverse().slice(0, 100) });
          }

          if (route === '/restore' && req.method === 'POST') {
            const { backup: name, file } = (await readBody(req)) as { backup: string; file: string };
            if (!WRITABLE.has(file)) return send(res, 400, { error: `Not writable: ${file}` });
            if (name.includes('/') || name.includes('\\') || name.includes('..')) {
              return send(res, 400, { error: 'Bad backup name' });
            }
            const from = path.join(rootDir, '.forge-backups', name);
            const text = await fs.readFile(from, 'utf8');
            const target = path.join(rootDir, file);
            // Restoring is itself a write, so it gets its own backup.
            await backup(file, await fs.readFile(target, 'utf8'));
            await fs.writeFile(target, text, 'utf8');
            return send(res, 200, { ok: true, file });
          }

          return send(res, 404, { error: `No forge route ${route}` });
        } catch (err) {
          return send(res, 500, { error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  };
}

/**
 * Counter keys some system actually bumps, harvested from the source itself so
 * the vocabulary can never drift from the code. A template key like
 * `kills:${defId}` collapses to `kills:*`; the file list says who bumps it,
 * which is where you look when a counter doesn't move.
 */
async function harvestCounters(
  rootDir: string,
): Promise<{ key: string; files: string[] }[]> {
  const found = new Map<string, Set<string>>();
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.ts')) {
        const text = await fs.readFile(full, 'utf8');
        for (const m of text.matchAll(
          /(?:bumpStat|raiseStat)\(state,\s*bus,\s*(?:'([^']+)'|`([^`]+)`)/g,
        )) {
          const key = m[1] ?? m[2]!.replace(/\$\{[^}]+\}/g, '*');
          const set = found.get(key) ?? new Set<string>();
          set.add(entry.name);
          found.set(key, set);
        }
      }
    }
  };
  await walk(path.join(rootDir, 'src', 'core'));
  return [...found]
    .map(([key, files]) => ({ key, files: [...files].sort() }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

interface VerifyResult {
  ok: boolean;
  failures: { name: string; message: string }[];
  raw: string;
}

/**
 * Run the content linter and pull the failures out. The forge mirrors most of
 * these rules client-side for instant feedback, but the test suite is the
 * authority — this is the button that asks it.
 */
function runVitest(cwd: string): Promise<VerifyResult> {
  return new Promise((resolve) => {
    const bin = path.join(cwd, 'node_modules', 'vitest', 'vitest.mjs');
    const child = spawn(process.execPath, [bin, 'run', 'tests/content.test.ts', '--reporter=json'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => resolve({ ok: false, failures: [], raw: `Could not run vitest: ${e.message}` }));
    child.on('close', (code) => {
      const failures: VerifyResult['failures'] = [];
      // The JSON reporter prints a single object; anything vitest logged around
      // it is noise, so find the object rather than parsing the whole stream.
      const start = out.indexOf('{');
      const end = out.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          const report = JSON.parse(out.slice(start, end + 1)) as {
            testResults?: { assertionResults?: { status: string; fullName: string; failureMessages?: string[] }[] }[];
          };
          for (const file of report.testResults ?? []) {
            for (const assertion of file.assertionResults ?? []) {
              if (assertion.status === 'failed') {
                failures.push({
                  name: assertion.fullName,
                  message: (assertion.failureMessages ?? []).join('\n').split('\n').slice(0, 6).join('\n'),
                });
              }
            }
          }
        } catch {
          /* fall through to raw output */
        }
      }
      resolve({ ok: code === 0, failures, raw: failures.length ? '' : (err || out).slice(-4000) });
    });
  });
}
