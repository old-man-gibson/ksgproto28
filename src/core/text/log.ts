/**
 * Runtime message lines: what the log says when something happens, and why a
 * bench or a spell refuses. The templates live in `log.text.ts`, keyed, so
 * the words can be edited in one place without touching the system that
 * fires them.
 *
 * `text('combat.appears', { what, level })` fills `{what}` and `{level}`. A
 * placeholder the call site does not supply stays as written (`{level}`), so
 * a template edited to name something the code never passes is visible in
 * the log rather than silently blank.
 */

import { LOG_TEXT } from './log.text';

export type LogKey = keyof typeof LOG_TEXT;

export function text(key: LogKey, params?: Record<string, unknown>): string {
  const template: string = LOG_TEXT[key];
  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (whole, name: string) => {
    const v = params[name];
    return v === undefined ? whole : String(v);
  });
}

/** The placeholder names a template mentions, for the totality test. */
export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]);
}
