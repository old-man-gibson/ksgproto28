/**
 * Types for the FACET core, the plain-JS files beside this one.
 *
 * Those files are a copy (MANIFEST.json says where the master lives) and are
 * never edited here. They have no exports: each publishes into
 * `globalThis.Facet`, so these are ambient declarations, and `load.ts` pulls
 * the files in with bare side-effect imports. Only the members this game calls
 * are typed; a member used for the first time gets its line here.
 */

/** One cell of a document: a value the ability keeps (FACET-SPEC §3; facet.cells.js). */
export interface FacetCell {
  key: string;
  label?: string;
  icon?: string;
  hold?: 'none' | 'one' | 'many';
  level?: 'none' | 'int' | 'real';
  /** An Expr; read it with `Facet.evalExpr`. */
  cap?: unknown;
  floor?: number;
  tier?: string;
  /**
   * Display hint for a game's ability readout: 'bar' (value of cap), 'signedPct',
   * 'count', or 'plusPct' / 'minusPct' (the value is in percent points).
   */
  show?: string;
  status?: { desc?: string; [field: string]: unknown };
  /**
   * Display hint: what a short readout shows after the label instead of the
   * bare number. `text` with {v} as the value x `scale`, rounded; `base`
   * names the bare number for a longer readout.
   */
  line?: { text: string; scale?: number; base?: string };
  /** False for a counter no modifier reads: it gets no carrier status, so it never moves the stat cache. */
  carrier?: boolean;
  /** Written by the core; saved with the document. */
  state?: { v: number; n: number; [field: string]: unknown };
  [field: string]: unknown;
}

/** A number a readout shows beside the cells: a quantity the ability reads. */
export interface FacetInput {
  q: string;
  label: string;
  show?: string;
}

/** A FACET document: the stored form of one ability (FACET-SPEC §3). */
export interface FacetDoc {
  id?: string;
  v?: number;
  cells?: FacetCell[];
  clauses: unknown[];
  /**
   * Display hints. `hit` is what the feed calls the ability's damage lines
   * ('strike' when unset); `desc` is what the ability does, for the Ability
   * tab and a branch's pick screen.
   */
  reading?: {
    name?: string;
    icon?: string;
    inputs?: FacetInput[];
    hit?: string;
    desc?: string;
    /**
     * An option the player picks (Weakest Weapon Master's stance): the pick is
     * written to cell `want`, and the document copies it into cell `active`.
     */
    choice?: {
      label: string;
      want: string;
      active: string;
      options: { v: number; name: string; icon: string; desc: string }[];
    };
  };
  /** Bank keys this document may evolve into, written by the core's `evolve` effect; saved with it. */
  offer?: string[];
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
  /** One game minute: fires `on: 'minute'` clauses. */
  minute(ref: string): void;
  event(id: string, ref: string, detail?: Record<string, unknown>): void;
  tierEnd(tier: string, ref: string): void;
  /** A hash over attached document ids and cell states; '' when nothing is attached. */
  fingerprint(ref: string): string;
  serialize(facet: FacetDoc): FacetDoc;
  hydrate(record: FacetDoc): FacetDoc;
  /** The branch `key` of a document's offer, built from the bank with the shared cells carried; null when not on offer. */
  evolve(doc: FacetDoc, key: string): FacetDoc | null;
  idOf(facet: FacetDoc): string;
  readQ(ref: string, id: string): FacetRead;
  /** One write to a cell (verbs: add, set, reset, …), carrier status included. */
  cellStep(cell: FacetCell, verb: string, arg: unknown, ctx: { ref: string; facet: FacetDoc; bindings: Record<string, unknown> }): unknown;
  /** Walks an Expr (a cell's cap, say) for a bearer and a document. */
  evalExpr(node: unknown, ctx: { ref: string; facet: FacetDoc | null; bindings: Record<string, unknown> }): number;
  registry: { ids(): string[] };
  /** The ability bank (facet.bank.js): templates a grant copies. */
  bank?: Record<string, FacetDoc>;
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
