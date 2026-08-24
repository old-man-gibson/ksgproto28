/**
 * The pinboard's dev-only backend, as a Vite plugin.
 *
 * A deliberately smaller sibling to `forge/server/plugin.ts`. The forge has to
 * load real modules and edit TypeScript ASTs because it writes game data; the
 * board writes exactly one frontmatter line in a markdown file, so all the
 * machinery it needs is in `cards.ts`.
 *
 * The rule that shapes it: **the board is a view, the files are the truth.**
 * Nothing here holds state, nothing caches, and every read goes to disk — so a
 * card edited in a text editor is correct on the board's next refresh, and
 * deleting `board/` costs a rendering rather than a backlog.
 *
 * `apply: 'serve'` — none of this exists in a production build.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Connect, Plugin } from 'vite';
import {
  bodyOf,
  KINDS,
  newCard,
  PLANS_DIR,
  readCards,
  setBody,
  setField,
  setList,
  STATUSES,
  today,
  type Kind,
  type Status,
} from './cards';

const API = '/__board/api';

function send(res: Parameters<Connect.NextHandleFunction>[1], status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req: Parameters<Connect.NextHandleFunction>[0]): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

/** Card ids are filenames. Nothing exotic gets to be one. */
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function board(): Plugin {
  let rootDir = process.cwd();

  const fileFor = (id: string): string => {
    if (!SAFE_ID.test(id)) throw new Error(`Not a usable card id: ${id} (kebab-case, a-z0-9 only)`);
    return path.join(rootDir, PLANS_DIR, `${id}.md`);
  };

  /**
   * Every write leaves a timestamped copy behind first — the same bargain the
   * forge makes, and for the same reason: this repo has no git, so "undo" only
   * exists if we put it somewhere. Cards share `.forge-backups/` rather than
   * inventing a second graveyard.
   */
  const backup = async (id: string, text: string): Promise<string> => {
    const dir = path.join(rootDir, '.forge-backups');
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `${id}.${stamp}.md`;
    await fs.writeFile(path.join(dir, name), text, 'utf8');
    return `.forge-backups/${name}`;
  };

  return {
    name: 'ksg-board',
    apply: 'serve',

    configResolved(config) {
      rootDir = config.root;
    },

    configureServer(dev) {
      dev.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith(API)) return next();
        const route = url.split('?')[0].slice(API.length);

        try {
          // ---------- Every card on disk ----------
          if (route === '/cards') {
            const cards = await readCards(rootDir);
            return send(res, 200, {
              cards,
              statuses: STATUSES,
              kinds: KINDS,
              // The system vocabulary is whatever the cards actually use, so a
              // new system needs no registration anywhere — write it on a card
              // and it exists. (Contrast the forge, where a new registry is two
              // deliberate steps; there the vocabulary is load-bearing.)
              systems: [...new Set(cards.map((c) => c.system))].sort(),
            });
          }

          // ---------- Move a card between columns ----------
          if (route === '/status' && req.method === 'POST') {
            const { id, status } = (await readBody(req)) as { id: string; status: Status };
            if (!STATUSES.includes(status)) {
              return send(res, 400, { error: `Unknown status: ${String(status)}` });
            }
            const file = fileFor(id);
            const before = await fs.readFile(file, 'utf8');
            let after = setField(before, 'status', status);
            after = setField(after, 'updated', today());
            if (after === before) return send(res, 200, { ok: true, unchanged: true });

            const saved = await backup(id, before);
            await fs.writeFile(file, after, 'utf8');
            return send(res, 200, { ok: true, backup: saved });
          }

          // ---------- Write a card's fields and prose ----------
          if (route === '/save' && req.method === 'POST') {
            const patch = (await readBody(req)) as {
              id: string;
              /** The prose the editor started from. Absent means "not editing prose". */
              baseBody?: string;
              title?: string;
              system?: string;
              parent?: string;
              invariants?: string[];
              done?: string[];
              body?: string;
            };

            const file = fileFor(patch.id);
            const before = await fs.readFile(file, 'utf8');

            /*
             * The board is not the only thing that writes these files — a text
             * editor and Claude both do. So a prose write is only allowed if
             * what is on disk still matches what the editor was shown. Losing
             * design prose to a silent overwrite is the one failure this whole
             * tool cannot be allowed to have, and there is no git to undo it.
             *
             * Field edits skip the check on purpose: they are single lines and
             * cheap to redo, and blocking them would make the board fight the
             * editor over a title.
             */
            if (patch.body !== undefined) {
              if (patch.baseBody === undefined) {
                return send(res, 400, { error: 'A prose write must say what it was based on.' });
              }
              if (bodyOf(before) !== patch.baseBody) {
                return send(res, 409, {
                  error: `${patch.id} changed on disk since you opened it — reload before saving, or your edit would erase theirs.`,
                  conflict: true,
                  body: bodyOf(before),
                });
              }
            }

            let after = before;
            for (const key of ['title', 'system', 'parent'] as const) {
              const value = patch[key];
              if (value !== undefined) after = setField(after, key, value.trim());
            }
            for (const key of ['invariants', 'done'] as const) {
              const value = patch[key];
              if (value !== undefined) after = setList(after, key, value);
            }
            if (patch.body !== undefined) {
              const trimmed = patch.body.replace(/\s+$/, '');
              after = setBody(after, trimmed ? `\n${trimmed}\n` : '\n');
            }

            if (after === before) return send(res, 200, { ok: true, unchanged: true });

            after = setField(after, 'updated', today());
            const saved = await backup(patch.id, before);
            await fs.writeFile(file, after, 'utf8');
            return send(res, 200, { ok: true, backup: saved });
          }

          // ---------- Capture something, without leaving the board ----------
          if (route === '/create' && req.method === 'POST') {
            const body = (await readBody(req)) as {
              id: string;
              title: string;
              kind: Kind;
              system: string;
              parent: string;
            };
            const file = fileFor(body.id);
            if (await fs.access(file).then(() => true, () => false)) {
              return send(res, 409, { error: `A card called ${body.id} already exists.` });
            }
            await fs.writeFile(
              file,
              newCard({
                id: body.id,
                title: body.title || body.id,
                kind: KINDS.includes(body.kind) ? body.kind : 'story',
                system: body.system || 'meta',
                parent: body.parent || '',
              }),
              'utf8',
            );
            return send(res, 200, { ok: true, file: `${PLANS_DIR}/${body.id}.md` });
          }

          return send(res, 404, { error: `No board route ${route}` });
        } catch (err) {
          return send(res, 500, { error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  };
}
