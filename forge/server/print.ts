/**
 * Printing JS values back out as TypeScript source that looks like the rest of
 * `src/core/data/*.data.ts` — 2-space indent, single quotes, unquoted keys
 * where the key is a plain identifier, trailing commas on anything multiline.
 *
 * This is deliberately NOT `JSON.stringify` with a reviver: the data files are
 * read by a human far more often than by the forge, and double-quoted keys
 * would announce "a machine wrote this" on every line it touched.
 */

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function printKey(key: string): string {
  if (IDENT.test(key)) return key;
  // Numeric keys (groupWeights: { 1: 100 }) stay bare; everything else quotes.
  if (/^\d+$/.test(key)) return key;
  return printString(key);
}

export function printString(value: string): string {
  // Only the two characters that could end or escape the literal. Typographic
  // apostrophes and emoji are left exactly as authored — the data files are
  // full of both and mangling them into escapes would be vandalism.
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function printNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Cannot print non-finite number: ${value}`);
  // Kill float noise like 0.30000000000000004 that arrives from a slider.
  return String(Number(value.toFixed(6)));
}

/** True when a value is small enough to sit on one line without hurting. */
function isShort(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every((v) => v === null || typeof v !== 'object');
  return false;
}

export interface PrintOpts {
  /** Spaces already in front of the line this value starts on. */
  indent?: number;
  /** Force one line, however long — for inserting into a single-line literal. */
  compact?: boolean;
  /**
   * Keys whose object/array values stay on one line even when they'd normally
   * break — `map: { x: 50, y: 22 }` reads worse over three lines.
   */
  inlineKeys?: Set<string>;
  /** Emit properties in this order first, then anything else as-is. */
  keyOrder?: string[];
}

const DEFAULT_INLINE = new Set(['map', 'level', 'gold', 'result', 'material', 'qty']);

/**
 * Print a value as a TypeScript expression.
 *
 * `indent` is the column the value STARTS at, so nested lines are indented
 * relative to it and the caller can drop the result straight in after `key: `.
 */
export function printValue(value: unknown, opts: PrintOpts = {}): string {
  const indent = opts.indent ?? 0;
  const inlineKeys = opts.inlineKeys ?? DEFAULT_INLINE;
  const pad = ' '.repeat(indent);
  const inner = ' '.repeat(indent + 2);

  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return printString(value);
  if (typeof value === 'number') return printNumber(value);
  if (typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (opts.compact || (value.every(isShort) && value.length <= 8)) {
      const oneLine = `[${value.map((v) => printValue(v, { ...opts, indent: 0 })).join(', ')}]`;
      if (opts.compact || oneLine.length + indent <= 96) return oneLine;
    }
    const items = value.map((v) => inner + printValue(v, { ...opts, indent: indent + 2 }));
    return `[\n${items.join(',\n')},\n${pad}]`;
  }

  if (typeof value === 'object') {
    const entries = orderedEntries(value as Record<string, unknown>, opts.keyOrder);
    if (entries.length === 0) return '{}';

    const oneLine = `{ ${entries
      .map(([k, v]) => `${printKey(k)}: ${printValue(v, { ...opts, indent: 0 })}`)
      .join(', ')} }`;
    if (opts.compact) return oneLine;
    // 98 rather than 80: the data files routinely run to ~100 columns for one
    // activity or connection per line, and matching that is the point.
    if (entries.every(([, v]) => isShort(v)) && oneLine.length + indent <= 98) return oneLine;

    const lines = entries.map(([k, v]) => {
      // A field with its own known shape switches to that shape's order, so
      // the elements of `finds: [...]` print id-first even though the object
      // around them is being printed in spot order.
      const childOrder = KEY_ORDER[ORDER_BY_FIELD[k] ?? ''] ?? opts.keyOrder;
      const nested = inlineKeys.has(k) && typeof v === 'object' && v !== null && !Array.isArray(v)
        ? printValue(v, { ...opts, indent: 0, keyOrder: childOrder, inlineKeys: new Set([...inlineKeys, k]) })
        : printValue(v, { ...opts, indent: indent + 2, keyOrder: childOrder });
      return `${inner}${printKey(k)}: ${nested}`;
    });
    return `{\n${lines.join(',\n')},\n${pad}}`;
  }

  throw new Error(`Cannot print value of type ${typeof value}`);
}

/**
 * Entries with `keyOrder` first (in that order), then the rest in insertion
 * order. Keeps `id, name, icon` at the top of every entry the forge writes,
 * matching how the data files are written by hand.
 */
function orderedEntries(
  obj: Record<string, unknown>,
  keyOrder?: string[],
): [string, unknown][] {
  const present = Object.entries(obj).filter(([, v]) => v !== undefined);
  if (!keyOrder?.length) return present;
  const rank = new Map(keyOrder.map((k, i) => [k, i]));
  return present.sort(([a], [b]) => {
    const ra = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return 0; // stable: equal ranks keep insertion order
  });
}

/**
 * Fields whose contents have their own shape. Printing a spot switches to
 * `find` order inside `finds`, `connection` order inside `connections`, and so
 * on — without this, the outer entity's field order leaks into its children.
 */
export const ORDER_BY_FIELD: Record<string, string> = {
  finds: 'find',
  exploreGates: 'gate',
  connections: 'connection',
  activities: 'activity',
  encounters: 'encounter',
  objectives: 'objective',
  loot: 'drop',
  rewards: 'rewards',
};

/** Field order the forge writes for each known entity shape. */
export const KEY_ORDER: Record<string, string[]> = {
  spot: [
    'id', 'name', 'icon', 'areaId', 'tags', 'map', 'waypoint', 'forced', 'fightLimit', 'caged', 'activities',
    'encounters', 'modifierWeights', 'groupWeights', 'exploreTicks', 'finds', 'exploreGates',
    'recipes', 'benches', 'connections',
  ],
  find: ['id', 'at', 'material', 'item', 'rune', 'gold', 'spot', 'path', 'skillXp', 'stat', 'requires'],
  gate: ['at', 'requires'],
  connection: ['to', 'ticks', 'oneWay', 'hidden', 'forced', 'requires', 'label', 'returnLabel', 'approach'],
  npc: ['id', 'name', 'icon', 'spotId', 'quests'],
  area: ['id', 'name', 'regionId', 'tags'],
  region: ['id', 'name', 'terrain', 'sheltered', 'tags', 'world'],
  tower: ['id', 'name', 'icon', 'hubSpot', 'direction', 'foreknown'],
  band: ['id', 'name', 'towerId', 'index', 'clearsToAdvance'],
  floor: ['id', 'name', 'towerId', 'bandId', 'index', 'areaId', 'landing', 'gate', 'clear', 'personal', 'persists'],
  monster: ['id', 'name', 'icon', 'tier', 'tags', 'damageType', 'attrs', 'growth', 'resistances', 'xp', 'gold', 'loot'],
  quest: ['id', 'name', 'icon', 'giver', 'objectives', 'rewards', 'unlock'],
  item: ['id', 'name', 'icon', 'slot', 'tags', 'value', 'mods', 'requires'],
  material: ['id', 'name', 'icon', 'value', 'tags'],
  recipe: ['id', 'name', 'icon', 'ticks', 'xp', 'cost', 'alts', 'result', 'unlock'],
  activity: ['id', 'kind', 'attr', 'material', 'recipe', 'gold', 'ticksPer', 'name', 'icon', 'tags', 'staticTime', 'speedFactors', 'outputFactors', 'outputCap', 'attrXp'],
  encounter: ['monsterId', 'weight', 'level', 'daypart', 'boss', 'window', 'once', 'requires'],
  objective: ['type', 'monsterId', 'recipeId', 'discipline', 'materialId', 'spotId', 'npcId', 'key', 'value', 'count', 'qty'],
  drop: ['kind', 'id', 'chance', 'qty'],
  rewards: ['gold', 'favor', 'materials', 'items', 'skillXp'],
};
