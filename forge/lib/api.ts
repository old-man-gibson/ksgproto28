/** Thin client for the forge's dev-server routes (see server/plugin.ts). */

export type PathStep = string | number;

export interface CatalogEntry {
  kind: string;
  label: string;
  icon: string;
  file: string;
  root: string;
  keyOrder?: string;
  exportName: string;
  hint?: string;
}

export type NoteMarker = 'TODO' | 'SPEC';

export type PatchOp =
  | { op: 'set'; kind: string; path: PathStep[]; value: unknown }
  | { op: 'delete'; kind: string; path: PathStep[] }
  | { op: 'add'; kind: string; key: string; value: unknown }
  | { op: 'rename'; kind: string; from: string; to: string }
  | { op: 'reorder'; kind: string; key: string; anchor: string; before: boolean }
  | { op: 'note'; kind: string; key: string; marker: NoteMarker; text: string | null };

export interface DiffLine {
  kind: 'ctx' | 'add' | 'del';
  text: string;
  n: number;
}

export interface Hunk {
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

export interface FileChange {
  file: string;
  hunks: Hunk[];
  stat: { added: number; removed: number };
  unchanged: boolean;
}

export interface PatchResult {
  dryRun: boolean;
  notes: string[];
  changes: FileChange[];
  backups?: string[];
}

export interface VerifyResult {
  ok: boolean;
  failures: { name: string; message: string }[];
  raw: string;
}

const API = '/__forge/api';

async function call<T>(route: string, body?: unknown): Promise<T> {
  const res = await fetch(API + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok || json.error) throw new Error(json.error ?? `${route} failed (${res.status})`);
  return json;
}

export const api = {
  catalog: () => call<{ catalog: CatalogEntry[] }>('/catalog'),
  registry: () =>
    call<{ data: Record<string, Record<string, unknown>>; meta: Record<string, unknown> }>('/registry'),
  source: (kind: string, path: PathStep[]) =>
    call<{ file: string; source: string | null }>('/source', { kind, path }),
  patch: (ops: PatchOp[], dryRun = false) => call<PatchResult>('/patch', { ops, dryRun }),
  verify: () => call<VerifyResult>('/verify', {}),
  backups: () => call<{ backups: string[] }>('/backups'),
  restore: (backup: string, file: string) => call<{ ok: boolean }>('/restore', { backup, file }),
};
