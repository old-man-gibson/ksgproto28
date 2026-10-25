import type { ClassMatch, ItemClassDef, MaterialDef, PartKindDef, PartShape, RecipeDef } from '../types';
import { RES_STAT_BY_TYPE, SLOT_NAMES } from '../types';
import {
  enumeratePlacements,
  matchingClass,
  placementCost,
  placementKey,
  placementProblem,
  type SmithRegistries,
} from './assembly';

/**
 * The content rules of modular smithing, shared by the content tests and the
 * forge's live validation (the same arrangement as searchValidation.ts), so
 * what the forge flags is what `npm run verify` fails on.
 *
 * Every rule reads the registries it is GIVEN, not the live ones, so the forge
 * can check a half-edited table as it stands. tests/content.test.ts is the
 * authority; this is the one body of rules both layers call.
 */

export type SmithingRule =
  | 'parts'
  | 'materials'
  | 'classes'
  | 'exemplars'
  | 'total'
  | 'reachable'
  | 'last-class'
  | 'recipes';

export interface SmithingIssue {
  rule: SmithingRule;
  /** The registry kind the offender lives in, as the forge names it. */
  kind: 'part' | 'material' | 'itemClass' | 'recipe';
  id: string;
  message: string;
}

export interface SmithingContent {
  parts: Record<string, PartKindDef>;
  classes: Record<string, ItemClassDef>;
  materials: Record<string, MaterialDef>;
  recipes: Record<string, RecipeDef>;
}

export interface SmithingLintOptions {
  /**
   * Which materials the enumeration tries. 'all' is every accepted material of
   * every part — the test's setting, exhaustive. 'tags' is one per accepted
   * tag: every distinct classification at a fraction of the placements, and
   * what a validator that runs on every keystroke can afford.
   */
  materials?: 'all' | 'tags';
}

const SHAPES: ReadonlySet<PartShape> = new Set<PartShape>([
  'edge', 'point', 'mass', 'plate', 'bent', 'ring', 'bar', 'guard', 'cord',
]);
/** The shapes each role may have: a head is one of six, the rest have one. */
const SHAPES_OF_ROLE: Record<string, readonly PartShape[]> = {
  head: ['edge', 'point', 'mass', 'plate', 'bent', 'ring'],
  haft: ['bar'],
  guard: ['guard'],
  bind: ['cord'],
};
/** Most unmatched or unreached placements named in one message. */
const SAMPLE = 5;

function rangeProblem(range: unknown): string | null {
  if (!Array.isArray(range) || range.length !== 2) return 'a range is [min, max]';
  const [lo, hi] = range;
  if (typeof lo !== 'number' || typeof hi !== 'number' || !Number.isFinite(lo) || !Number.isFinite(hi)) {
    return 'a range holds finite numbers';
  }
  return lo > hi ? `the range [${lo}, ${hi}] is empty` : null;
}

/** The forgeable materials: a smith profile and ungraded stock. */
function forgeable(materials: Record<string, MaterialDef>): MaterialDef[] {
  return Object.values(materials).filter((m) => m.smith && !m.graded);
}

function clausesOf(def: ItemClassDef): ClassMatch[] {
  return Array.isArray(def.match) ? def.match : [def.match];
}

/** Rules 1–3: the shape of the data itself. */
function dataIssues(c: SmithingContent, out: SmithingIssue[]): void {
  const add = (rule: SmithingRule, kind: SmithingIssue['kind'], id: string, message: string) =>
    out.push({ rule, kind, id, message });
  const usable = forgeable(c.materials);
  const carried = new Set(usable.flatMap((m) => m.craftTags ?? []));
  const accepted = new Set(Object.values(c.parts).flatMap((p) => p.accepts));

  for (const part of Object.values(c.parts)) {
    if (!Number.isInteger(part.w) || part.w < 1 || !Number.isInteger(part.l) || part.l < 1) {
      add('parts', 'part', part.id, `w × l must be whole numbers of at least 1 (got ${part.w} × ${part.l})`);
    }
    if (part.qtyMax !== undefined && (!Number.isInteger(part.qtyMax) || part.qtyMax < 1)) {
      add('parts', 'part', part.id, 'qtyMax must be a whole number of at least 1');
    }
    if (!SHAPES_OF_ROLE[part.role]) add('parts', 'part', part.id, `unknown role '${part.role}'`);
    else if (!SHAPES_OF_ROLE[part.role].includes(part.shape)) {
      add('parts', 'part', part.id, `a ${part.role} cannot be shaped '${part.shape}'`);
    }
    if (!part.accepts?.length) add('parts', 'part', part.id, 'accepts no material tag, so it can never be placed');
    for (const tag of part.accepts ?? []) {
      if (!carried.has(tag)) add('parts', 'part', part.id, `accepts '${tag}', which no forgeable material carries`);
    }
  }

  for (const m of Object.values(c.materials)) {
    if (!m.smith) continue;
    const s = m.smith;
    const bad = (label: string, ok: boolean) => {
      if (!ok) add('materials', 'material', m.id, `smith.${label} is out of range`);
    };
    bad('rho', Number.isFinite(s.rho) && s.rho > 0);
    bad('hard', Number.isFinite(s.hard) && s.hard >= 0);
    bad('tough', Number.isFinite(s.tough) && s.tough >= 0);
    bad('unitCells', Number.isInteger(s.unitCells) && s.unitCells >= 1);
    if (!s.label) add('materials', 'material', m.id, 'smith.label is empty: a forged piece would have no material in its name');
    if (m.graded) add('materials', 'material', m.id, 'a graded material cannot be forged: the anvil spends plain stock');
    if (!(m.craftTags ?? []).some((t) => accepted.has(t))) {
      add('materials', 'material', m.id, 'has a smith profile but carries no tag any part accepts');
    }
  }

  const priorities = new Map<number, string>();
  for (const cls of Object.values(c.classes)) {
    if (!Number.isFinite(cls.priority)) add('classes', 'itemClass', cls.id, 'priority must be a finite number');
    else if (priorities.has(cls.priority)) {
      add('classes', 'itemClass', cls.id, `shares priority ${cls.priority} with '${priorities.get(cls.priority)}': the order between them is undefined`);
    } else priorities.set(cls.priority, cls.id);
    if (!(cls.slot in SLOT_NAMES)) add('classes', 'itemClass', cls.id, `unknown slot '${cls.slot}'`);
    if (cls.damageType && !(cls.damageType in RES_STAT_BY_TYPE)) {
      add('classes', 'itemClass', cls.id, `unknown damage type '${cls.damageType}'`);
    }
    if (cls.cover !== undefined && !(cls.cover > 0 && cls.cover <= 1)) {
      add('classes', 'itemClass', cls.id, 'cover is a share of the body: more than 0, at most 1');
    }
    if (cls.slot === 'weapon' && cls.cover !== undefined) {
      add('classes', 'itemClass', cls.id, 'a weapon class has no cover: its kernel branch ignores it');
    }
    if (cls.slot === 'weapon' && !cls.tags.length) {
      add('classes', 'itemClass', cls.id, 'a weapon needs its family tag first: it picks the combat skill');
    }
    const clauses = clausesOf(cls);
    clauses.forEach((m, i) => {
      const where = clauses.length > 1 ? ` (clause ${i + 1})` : '';
      const fail = (message: string) => add('classes', 'itemClass', cls.id, `${message}${where}`);
      if (m.head && m.head !== 'none') {
        const h = m.head;
        for (const shape of h.shape ?? []) if (!SHAPES.has(shape)) fail(`head.shape '${shape}' is not a shape`);
        for (const key of ['l', 'w', 'area', 'count'] as const) {
          const p = h[key] !== undefined ? rangeProblem(h[key]) : null;
          if (p) fail(`head.${key}: ${p}`);
        }
        for (const tag of h.mat ?? []) if (!carried.has(tag)) fail(`head.mat '${tag}' is carried by no forgeable material`);
      }
      for (const shape of m.anyHead ?? []) if (!SHAPES.has(shape)) fail(`anyHead '${shape}' is not a shape`);
      if (m.haft && typeof m.haft === 'object') {
        for (const key of ['l', 'w'] as const) {
          const p = m.haft[key] !== undefined ? rangeProblem(m.haft[key]) : null;
          if (p) fail(`haft.${key}: ${p}`);
        }
      }
    });
  }
}

/** Rules 4–7: what the table does to every placement the catalogue allows. */
function tableIssues(c: SmithingContent, opts: SmithingLintOptions, out: SmithingIssue[]): void {
  const reg: SmithRegistries = { classes: c.classes, parts: c.parts, materials: c.materials };
  const classes = Object.values(c.classes);
  if (!classes.length) return;

  // The last rule accepts everything, so the table has no hole.
  const last = classes.reduce((a, b) => (b.priority < a.priority ? b : a));
  if (!clausesOf(last).some((m) => Object.keys(m).length === 0)) {
    out.push({
      rule: 'last-class',
      kind: 'itemClass',
      id: last.id,
      message: 'the lowest-priority class must have an empty match: it is the rule that makes every placement resolve',
    });
  }

  for (const cls of classes) {
    const problem = placementProblem(cls.exemplar, reg);
    if (problem) {
      out.push({ rule: 'exemplars', kind: 'itemClass', id: cls.id, message: `exemplar cannot be placed: ${problem}` });
      continue;
    }
    const got = matchingClass(cls.exemplar, reg);
    if (got?.id !== cls.id) {
      out.push({
        rule: 'exemplars',
        kind: 'itemClass',
        id: cls.id,
        message: `exemplar (${placementKey(cls.exemplar)}) resolves to '${got?.id ?? 'nothing'}', not to itself`,
      });
    }
  }

  const reached = new Set<string>();
  const unmatched: string[] = [];
  let total = 0;
  for (const placement of enumeratePlacements({ parts: c.parts, materialDefs: c.materials, materials: opts.materials ?? 'all' })) {
    total++;
    const cls = matchingClass(placement, reg);
    if (cls) reached.add(cls.id);
    else if (unmatched.length < SAMPLE) unmatched.push(placementKey(placement));
  }
  if (unmatched.length) {
    out.push({
      rule: 'total',
      kind: 'itemClass',
      id: last.id,
      message: `placements that resolve to no class (the resolver must be total), e.g. ${unmatched.join('; ')}`,
    });
  }
  for (const cls of classes) {
    if (!reached.has(cls.id)) {
      out.push({
        rule: 'reachable',
        kind: 'itemClass',
        id: cls.id,
        message: `no placement of the ${total} the catalogue allows resolves to it: it needs a part that does not exist, or a rule above it takes everything it would`,
      });
    }
  }
}

/** Rule 8: a recipe made of parts costs what its cells cost. */
function recipeIssues(c: SmithingContent, out: SmithingIssue[]): void {
  const reg: SmithRegistries = { classes: c.classes, parts: c.parts, materials: c.materials };
  const bill = (cost: { id: string; qty: number }[]) =>
    cost
      .map((l) => `${l.qty} ${l.id}`)
      .sort()
      .join(', ');
  for (const r of Object.values(c.recipes)) {
    if (!r.forge) continue;
    const problem = placementProblem(r.forge, reg);
    if (problem) {
      out.push({ rule: 'recipes', kind: 'recipe', id: r.id, message: `forge placement cannot be placed: ${problem}` });
      continue;
    }
    const derived = bill(placementCost(r.forge, reg));
    const listed = bill(r.cost);
    if (derived !== listed) {
      out.push({
        rule: 'recipes',
        kind: 'recipe',
        id: r.id,
        message: `lists a cost of ${listed}, but its parts derive ${derived}`,
      });
    }
  }
}

let memo: { key: string; issues: SmithingIssue[] } | null = null;

/**
 * Every smithing content rule over the given registries. Memoised on the
 * content it actually reads, so the forge can call it on every keystroke and
 * pay for the enumeration only when a part, class, forgeable material or
 * forge recipe changed.
 */
export function smithingContentIssues(content: SmithingContent, opts: SmithingLintOptions = {}): SmithingIssue[] {
  const key = JSON.stringify([
    content.parts,
    content.classes,
    Object.values(content.materials)
      .filter((m) => m.smith)
      .map((m) => [m.id, m.craftTags, m.graded, m.smith]),
    Object.values(content.recipes)
      .filter((r) => r.forge)
      .map((r) => [r.id, r.cost, r.forge]),
    opts.materials ?? 'all',
  ]);
  if (memo?.key === key) return memo.issues;
  const issues: SmithingIssue[] = [];
  dataIssues(content, issues);
  // The table rules assume sane data (a part with w = 0 would loop nothing
  // useful); skip them while the data itself is broken so the message is the root cause.
  if (!issues.length) {
    tableIssues(content, opts, issues);
    recipeIssues(content, issues);
  }
  memo = { key, issues };
  return issues;
}
