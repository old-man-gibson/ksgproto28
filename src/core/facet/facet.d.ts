/**
 * Types for the FACET core, the plain-JS files beside this one.
 *
 * Those files are a copy (MANIFEST.json says where the master lives) and are
 * never edited here. They have no exports: each publishes into
 * `globalThis.Facet`, so these are ambient declarations, and `load.ts` pulls
 * the files in with bare side-effect imports. Only the members this game calls
 * are typed; a member used for the first time gets its line here.
 */

/** A FACET document: the stored form of one ability (FACET-SPEC §3). */
export interface FacetDoc {
  id?: string;
  v?: number;
  cells?: unknown[];
  clauses: unknown[];
  reading?: { name?: string; icon?: string };
  [field: string]: unknown;
}

/** One row of the quantity registry (FACET-SPEC §4.1; the core's `normalise` lists every field). */
export interface FacetQuantity {
  id: string;
  label?: string;
  kind?: string;
  namespace?: string;
  from?: string[];
  feeds?: string[];
  gates?: string[];
  nul?: number;
  clamp?: [number | null, number | null];
  nullifiable?: boolean;
  writable?: boolean;
  sealed?: boolean;
  mortalRole?: string | null;
  /** The stat name a status modifier uses for this number, or null when none can. */
  modStat?: string | null;
  modOps?: ('add' | 'mult')[];
}

/** What `Facet.readQ` returns: the value, or why there is none. */
export interface FacetRead {
  ok: boolean;
  value: number;
  nulled: boolean;
}

/**
 * The adapter a game hands to `Facet.install`. The core checks the member list
 * itself (facet.core.js `REQUIRED`, `CAP_REQUIRED`) and names what is missing,
 * so the members are typed loosely here; host.ts documents each one.
 */
export interface FacetHost {
  id: string;
  ticksPerSecond: number;
  caps: Record<string, boolean>;
  [member: string]: unknown;
}

export interface FacetCore {
  /** Every module the core expects; `install` refuses to run with one missing. */
  MODULES: string[];
  _mods: Record<string, boolean>;
  install(host: FacetHost): FacetCore;
  uninstall(): void;
  ready(): boolean;
  host(): FacetHost | null;
  attach(ref: string, facets: FacetDoc[]): unknown[];
  detach(ref: string): void;
  tick(ref: string): void;
  event(id: string, ref: string, detail?: Record<string, unknown>): void;
  tierEnd(tier: string, ref: string): void;
  /** A hash over attached document ids and cell states; '' when nothing is attached. */
  fingerprint(ref: string): string;
  serialize(facet: FacetDoc): FacetDoc;
  hydrate(record: FacetDoc): FacetDoc;
  idOf(facet: FacetDoc): string;
  readQ(ref: string, id: string): FacetRead;
  registry: { ids(): string[] };
}

type FacetAssert = (cond: unknown, msg?: string) => void;

declare global {
  // `var` is what puts a name on globalThis in a declaration.
  // eslint-disable-next-line no-var
  var Facet: FacetCore;
  /** The core's own test corpus (facet.cases.js), runner-agnostic. */
  // eslint-disable-next-line no-var
  var FacetCases: Record<string, (assert: FacetAssert, host: FacetHost) => void>;
  /** The stand-in host the corpus runs against. */
  // eslint-disable-next-line no-var
  var FacetFakeHost: (over?: Partial<FacetHost>) => FacetHost;
}
