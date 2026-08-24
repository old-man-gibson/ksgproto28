<script lang="ts">
  /**
   * A generic editor for one registry entry.
   *
   * Nothing in this repo describes the content types at runtime, so the editor
   * is driven by the *shape of the live value*: whatever the data file actually
   * holds decides which control appears. That is why one component serves all
   * eighteen registries, and why it keeps working the day a field is added to a
   * type — the forge loads the real objects, so the new field just shows up.
   *
   * Key names are the only schema available, so they carry the reference
   * inference: `monsterId` is picked from the monster registry, not typed.
   *
   * Two things it deliberately will not do: rename an entry (every reference to
   * it would have to move at the same time) and edit a function — the server
   * sends those as a marker, and a hand-written closure is not the forge's
   * business.
   */
  import { store } from '../lib/store.svelte';
  import { idProblem, validate } from '../lib/validate';
  import { requestRename } from '../lib/rename';
  import { api, type PathStep } from '../lib/api';
  import Field from '../lib/Field.svelte';
  import RefPicker from '../lib/RefPicker.svelte';
  import TagInput from '../lib/TagInput.svelte';
  import MonsterPreview from './MonsterPreview.svelte';
  import { TAG_VOCABULARIES, templateFor } from '../lib/templates';
  import { refAllowFor, refKindFor } from '../lib/refs';
  import { parseObjectLiteral } from '../lib/literal';

  interface Props {
    kind: string;
    id: string;
    /** Fired when a STAGED entry is renamed, so the browser can follow it. */
    onrename?: (nextId: string) => void;
  }
  let { kind, id, onrename }: Props = $props();

  type Shape =
    | 'string'
    | 'number'
    | 'boolean'
    | 'strings'
    | 'numbers'
    | 'objects'
    | 'object'
    | 'empty'
    | 'opaque'
    | 'nothing'
    | 'json';

  interface Node {
    key: string;
    value: unknown;
    /** Full store path, entry id included. */
    path: PathStep[];
    /** Owning key, so `material: { id }` knows `id` means a material. */
    parentKey?: string;
    depth: number;
  }

  // Reference tables live in lib/refs.ts: the picker and the RENAMER must
  // agree on what counts as a reference, or renaming an id quietly misses
  // the very fields this editor draws pickers for.

  const PINNED = ['name', 'icon'];
  const MARKERS = ['__fn', '__num', '__map', '__set', '__circular'];
  const LONG_TEXT = new Set(['desc', 'flavor', 'lore']);

  let open = $state<Record<string, boolean>>({});
  let adding = $state<string | null>(null);
  /**
   * The empty list currently opened for typing. Held here rather than written
   * as a placeholder `''`: seeding the array to keep the editor open leaves a
   * blank chip sitting in the data until someone notices it, and a blank chip
   * is indistinguishable from a bug.
   */
  let typing = $state<string | null>(null);
  let newKey = $state('');
  let newType = $state<'text' | 'number' | 'flag' | 'list' | 'group'>('text');
  let showSource = $state(false);
  let source = $state<{ file: string; text: string | null } | null>(null);
  let sourceError = $state<string | null>(null);

  const cat = $derived(store.entry(kind));
  const def = $derived(store.get<Record<string, unknown>>(kind, id) ?? {});
  const icon = $derived(typeof def.icon === 'string' ? def.icon : (cat?.icon ?? '•'));
  const title = $derived(typeof def.name === 'string' ? def.name : id);
  /** The `// TODO:` / `// SPEC:` lines above this entry in the data file. */
  const notes = $derived(store.notes(kind, id));

  const rootKeys = $derived.by(() => {
    const keys = Object.keys(def).filter((k) => k !== 'id');
    const pinned = PINNED.filter((k) => keys.includes(k));
    return [...pinned, ...keys.filter((k) => !pinned.includes(k))];
  });

  /**
   * Fields carried by every entry of this kind — the closest thing to a
   * required-field list, and the guard on offering to delete one.
   */
  const requiredKeys = $derived.by(() => {
    const defs = Object.values(store.all<Record<string, unknown>>(kind));
    if (defs.length === 0) return new Set<string>();
    let keys = Object.keys(defs[0] ?? {});
    for (const d of defs.slice(1)) keys = keys.filter((k) => k in (d ?? {}));
    return new Set(keys);
  });

  /** Keys other entries of this kind use, offered when adding a field. */
  const siblingKeys = $derived.by(() => {
    const seen = new Set<string>();
    for (const other of Object.values(store.all<Record<string, unknown>>(kind))) {
      for (const k of Object.keys(other ?? {})) seen.add(k);
    }
    return [...seen].sort();
  });

  /**
   * What every field name MEANS in this kind, learned from the corpus: its
   * observed shape (majority wins on conflict) and an example value. This is
   * the schema the forge doesn't have — and the reason adding a known field
   * can never again create `ticks: '80'` because someone left the type
   * dropdown on "text".
   */
  const fieldIndex = $derived.by(() => {
    const counts = new Map<string, Map<string, { n: number; example: unknown }>>();
    const visit = (v: unknown, depth: number): void => {
      if (!v || typeof v !== 'object' || depth > 4 || isMarker(v)) return;
      if (Array.isArray(v)) {
        for (const e of v) visit(e, depth + 1);
        return;
      }
      for (const [k, child] of Object.entries(v)) {
        const s = shapeOf(child);
        // 'empty' is the absence of evidence, not evidence of shape — letting
        // it win would teach the index that `tags` is a mystery whenever some
        // entry happens to have none.
        if (s !== 'nothing' && s !== 'opaque' && s !== 'empty') {
          const byShape = counts.get(k) ?? new Map<string, { n: number; example: unknown }>();
          const cur = byShape.get(s) ?? { n: 0, example: child };
          cur.n++;
          byShape.set(s, cur);
          counts.set(k, byShape);
        }
        visit(child, depth + 1);
      }
    };
    for (const def of Object.values(store.all<Record<string, unknown>>(kind))) visit(def, 0);

    const out = new Map<string, { shape: string; example: unknown; uses: number }>();
    for (const [k, byShape] of counts) {
      let best: [string, { n: number; example: unknown }] | null = null;
      let total = 0;
      for (const entry of byShape) {
        total += entry[1].n;
        if (!best || entry[1].n > best[1].n) best = entry;
      }
      if (best) out.set(k, { shape: best[0], example: best[1].example, uses: total });
    }
    return out;
  });

  /** What the field-name box currently names, if the corpus knows it. */
  const knownField = $derived(fieldIndex.get(newKey.trim()));

  /**
   * Fields whose legal values come from somewhere authoritative rather than
   * from whatever content happens to use today. Worth listing explicitly: the
   * corpus can only ever show values already in use, so a damage type nothing
   * deals yet would be missing from a corpus-only list — and the whole point
   * of a dropdown is to show what's *possible*.
   */
  const META_ENUMS: Record<string, (m: Record<string, unknown>) => string[]> = {
    damageType: (m) => Object.keys((m.resStatByType ?? {}) as object),
    tier: (m) => Object.keys((m.tiers ?? {}) as object),
    rarity: (m) => Object.keys((m.rarities ?? {}) as object),
    base: (m) => Object.keys((m.xpBase ?? {}) as object),
    rate: (m) => Object.keys((m.xpRate ?? {}) as object),
    attr: (m) => ((m.attributes ?? []) as { id: string }[]).map((a) => a.id),
    category: (m) => ((m.skillCategories ?? []) as { id: string }[]).map((c) => c.id),
    resource: (m) => ((m.resources ?? []) as { id: string }[]).map((r) => r.id),
    terrain: (m) => (m.terrains ?? []) as string[],
    // No runtime source — this pair IS the Modifier op union.
    op: () => ['add', 'mult'],
  };

  /** Every string value each field name carries across this registry. */
  const enumIndex = $derived.by(() => {
    const seen = new Map<string, Map<string, number>>();
    const visit = (v: unknown, depth: number): void => {
      if (!v || typeof v !== 'object' || depth > 4 || isMarker(v)) return;
      if (Array.isArray(v)) {
        for (const e of v) visit(e, depth + 1);
        return;
      }
      for (const [k, child] of Object.entries(v)) {
        if (typeof child === 'string' && child) {
          const counts = seen.get(k) ?? new Map<string, number>();
          counts.set(child, (counts.get(child) ?? 0) + 1);
          seen.set(k, counts);
        }
        visit(child, depth + 1);
      }
    };
    for (const def of Object.values(store.all<Record<string, unknown>>(kind))) visit(def, 0);
    return seen;
  });

  /**
   * Every tag equipment actually carries, plus the pseudo-tag the game adds for
   * empty hands — `equippedTags` in systems/attributes.ts unions the `tags` of
   * whatever is worn and adds 'unarmed' when the weapon slot is empty.
   */
  const equipmentTags = $derived.by(() => {
    const tags = new Set<string>(['unarmed']);
    for (const item of Object.values(store.all<{ tags?: string[] }>('item'))) {
      for (const t of item.tags ?? []) tags.add(t);
    }
    return [...tags].sort();
  });

  /**
   * Suggestion pools for fields whose real vocabulary is far wider than this
   * registry's corpus. These never CLOSE a field — a tag is free-form, and the
   * item that would justify a new one may not be written yet.
   *
   * `tag` under `unlock` is unambiguous: `equippedTag` is the only unlock
   * condition carrying a `tag`, and it is matched against equipped items.
   */
  function openVocab(key: string, parentKey?: string): string[] {
    if (key === 'tag' && parentKey === 'unlock') return equipmentTags;
    return [];
  }

  /**
   * The options for a field, or undefined when it isn't an enum at all, plus
   * whether that list is the WHOLE domain or merely what content happens to use
   * today. Falls back to the corpus for unions with no runtime list (`slot`,
   * `kind`, `type`, `wield`), which is owner- and context-aware for free: `kind`
   * on a drop entry and `kind` on an activity simply see different values.
   *
   * `closed` is the important half. Only an authoritative source — a real
   * registry or a union spelled out in META_ENUMS — knows every legal value, and
   * only those may be offered as a closed `<select>`. A corpus-derived list can
   * never be more than a suggestion: it is built from existing entries, so by
   * construction it cannot contain the value a NEW entry wants to introduce, and
   * locking the field to it makes the editor refuse the exact thing an authoring
   * tool exists to do. Equipment tags showed 5 of the 30 items actually carry.
   *
   * The current value is always included even when unknown, so opening an
   * entry can never quietly rewrite it.
   */
  function enumOptions(
    key: string,
    current: string,
    parentKey?: string,
  ): { options: string[]; closed: boolean } | undefined {
    const authoritative = META_ENUMS[key]?.(store.meta as Record<string, unknown>) ?? [];
    const observed = enumIndex.get(key);
    const suggested = openVocab(key, parentKey);
    let options = authoritative;
    let closed = options.length > 0;

    if (!closed) {
      const pool = [...(observed?.keys() ?? []), ...suggested];
      if (pool.length === 0) return undefined;
      if (suggested.length === 0) {
        // No wider source to draw on, so the corpus has to justify itself:
        // few values repeated across many entries is what a union looks like;
        // free text (desc, name, icon) never is.
        const distinct = observed!.size;
        const total = [...observed!.values()].reduce((a, b) => a + b, 0);
        if (distinct > 12 || total < 4 || distinct > total / 2) return undefined;
      }
      options = [...new Set(pool)];
    } else if (observed) {
      options = [...new Set([...options, ...observed.keys()])];
    }
    if (current && !options.includes(current)) options = [...options, current];
    return { options, closed };
  }

  /**
   * What an EMPTY list should become, learned from entries that aren't empty.
   * This is what stops `tags: []` offering "text items / numbers / groups" when
   * every other item in the registry plainly shows it holds strings — and it
   * covers every such field at once, including ones added later.
   */
  function emptyListShape(key: string): { shape: string; element: unknown } | undefined {
    const known = fieldIndex.get(key);
    if (!known) return undefined;
    if (known.shape === 'strings') return { shape: 'strings', element: '' };
    if (known.shape === 'numbers') return { shape: 'numbers', element: 0 };
    if (known.shape === 'objects') {
      const sample = Array.isArray(known.example) ? known.example[0] : undefined;
      const element = blankLike(sample);
      if (element !== undefined) return { shape: 'objects', element };
    }
    return undefined;
  }

  const SHAPE_LABEL: Record<string, string> = {
    string: 'text',
    number: 'number',
    boolean: 'true/false',
    strings: 'text list',
    numbers: 'number list',
    objects: 'group list',
    object: 'group',
    empty: 'list',
    json: 'list',
  };

  /** A creation blank matching an observed shape — never the wrong JS type. */
  function blankOf(shape: string, example: unknown): unknown {
    switch (shape) {
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'strings':
      case 'numbers':
      case 'objects':
      case 'empty':
      case 'json':
        return [];
      case 'object':
        return blankLike(example) ?? {};
      default:
        return '';
    }
  }

  // (`blankOf` leans on the component's existing `blankLike` for group shapes.)

  /** Values already in use under each string-array key, for TagInput's datalist. */
  const tagSuggestions = $derived.by(() => {
    const byKey = new Map<string, Set<string>>();
    const visit = (v: unknown, key: string, depth: number): void => {
      if (!v || typeof v !== 'object' || depth > 4 || isMarker(v)) return;
      if (Array.isArray(v)) {
        if (v.length && v.every((e) => typeof e === 'string')) {
          const set = byKey.get(key) ?? new Set<string>();
          for (const s of v as string[]) if (s.length <= 40) set.add(s);
          byKey.set(key, set);
          return;
        }
        for (const e of v) visit(e, key, depth + 1);
        return;
      }
      for (const [k, child] of Object.entries(v)) visit(child, k, depth + 1);
    };
    for (const other of Object.values(store.all(kind))) visit(other, '', 0);
    const out = new Map<string, string[]>();
    // A long tail is free-form prose, not a vocabulary — suggesting it is noise.
    for (const [k, set] of byKey) if (set.size <= 120) out.set(k, [...set].sort());
    return out;
  });

  const myIssues = $derived(
    validate(store).filter((i) => i.subject.kind === kind && i.subject.id === id),
  );

  /** Complaints that name a field, so the offending input can wear them. */
  const fieldProblems = $derived.by(() => {
    const map = new Map<string, string>();
    for (const i of myIssues) {
      if (!i.path?.length) continue;
      const key = String(i.path[0]);
      if (!map.has(key)) map.set(key, i.message);
    }
    return map;
  });

  /** The rest are about the entry as a whole and belong at the top. */
  const entryProblems = $derived(myIssues.filter((i) => !i.path?.length));

  // ---------- Shape ----------

  function isMarker(v: unknown): boolean {
    return !!v && typeof v === 'object' && MARKERS.some((m) => m in (v as object));
  }

  function isPlainObject(v: unknown): boolean {
    return !!v && typeof v === 'object' && !Array.isArray(v) && !isMarker(v);
  }

  function shapeOf(v: unknown): Shape {
    if (v === null || v === undefined) return 'nothing';
    if (typeof v === 'string') return 'string';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'boolean') return 'boolean';
    if (Array.isArray(v)) {
      if (v.length === 0) return 'empty';
      if (v.every((e) => typeof e === 'string')) return 'strings';
      if (v.every((e) => typeof e === 'number')) return 'numbers';
      if (v.every(isPlainObject)) return 'objects';
      return 'json';
    }
    if (isMarker(v)) return 'opaque';
    return 'object';
  }

  function markerText(v: unknown): string {
    const m = v as Record<string, unknown>;
    if ('__fn' in m) return `ƒ ${m.__fn}()`;
    if ('__num' in m) return String(m.__num);
    if ('__map' in m) return `Map(${(m.__map as unknown[]).length})`;
    if ('__set' in m) return `Set(${(m.__set as unknown[]).length})`;
    return 'circular reference';
  }

  const refKind = (key: string, parentKey?: string) => refKindFor(kind, key, parentKey);
  const refAllow = (key: string) => refAllowFor(kind, key);

  /**
   * A registry-backed vocabulary for a string list, when one exists. Without
   * this, `monster.tags` suggests only tags already in use and silently
   * accepts anything — but the content linter demands every tag be registered
   * in MONSTER_TAGS, so an invented one fails the build rather than joining
   * the registry.
   */
  function tagVocab(key: string): { ids: string[]; note: string } | undefined {
    const spec = TAG_VOCABULARIES[`${kind}.${key}`];
    if (!spec) return undefined;
    const registry = (store.meta as Record<string, unknown>)[spec.metaKey] as
      | Record<string, { category?: string }>
      | undefined;
    if (!registry) return undefined;
    const ids = Object.entries(registry)
      .filter(([, d]) => !spec.excludeCategory || d?.category !== spec.excludeCategory)
      .map(([id]) => id);
    return { ids, note: spec.note };
  }

  // ---------- Colors ----------

  const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

  /**
   * A color is recognised by its key OR its value: `color:`/`tint:` even when
   * blank (so a fresh scaffold still gets the picker), and any exact hex
   * literal wherever it hides. Key-first matters — a bench slot whose ID is
   * the string 'color' must not trip this, and it can't: its key is `id`.
   */
  function isColorField(key: string, value: string): boolean {
    const k = key.toLowerCase();
    if (k === 'color' || k === 'colour' || k === 'tint' || k.endsWith('color')) return true;
    return HEX_COLOR.test(value.trim());
  }

  /**
   * What the native picker can display: exactly #rrggbb. Shorthand expands,
   * alpha is dropped, anything else falls back to grey — the picker
   * approximates, the text field keeps the truth.
   */
  function pickerHex(value: string): string {
    const v = value.trim();
    if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v)) return v.slice(0, 7).toLowerCase();
    const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
    if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
    return '#888888';
  }

  // ---------- Casts, so the markup stays free of them ----------

  const asStrings = (v: unknown) => v as string[];
  const asNumbers = (v: unknown) => v as number[];
  const asObjects = (v: unknown) => v as Record<string, unknown>[];
  const asObject = (v: unknown) => v as Record<string, unknown>;

  // ---------- Writing ----------

  function set(path: PathStep[], value: unknown): void {
    store.set(kind, path, value);
  }

  function writeNumber(raw: string, path: PathStep[]): void {
    // A half-typed or cleared box must never land NaN in the data file.
    if (raw.trim() === '') return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    set(path, n);
  }

  /**
   * How to address one element of an array of objects. The `#key=value` form
   * survives edits to the elements around it; a numeric index does not, so it
   * is the fallback for shapes with nothing to key on.
   */
  function elementStep(el: Record<string, unknown>, i: number): PathStep {
    if (typeof el.id === 'string' && el.id) return `#id=${el.id}`;
    if (typeof el.to === 'string' && el.to) return `#to=${el.to}`;
    return i;
  }

  /**
   * `id` and `to` are what the `#key=value` path form looks elements up BY, so
   * they commit on blur: rewriting one per keystroke would stage an op per
   * character, each addressing its element by the half-typed name it just wrote.
   */
  function isPathKey(key: string): boolean {
    return key === 'id' || key === 'to';
  }

  function elementLabel(el: Record<string, unknown>, i: number): string {
    for (const k of ['name', 'id', 'to', 'kind', 'type']) {
      if (typeof el[k] === 'string' && el[k]) return el[k] as string;
    }
    return `#${i}`;
  }

  function blankLike(sample: unknown): unknown {
    if (typeof sample === 'string') return '';
    if (typeof sample === 'number') return 0;
    if (typeof sample === 'boolean') return false;
    if (Array.isArray(sample)) return [];
    if (isPlainObject(sample) && !isMarker(sample)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(sample as object)) {
        const blank = blankLike(v);
        if (blank !== undefined) out[k] = blank;
      }
      return out;
    }
    return undefined;
  }

  /** A new element shaped like the ones already there, so it prints correctly. */
  /*
   * Pasting a literal into a list.
   *
   * The benches (the psionic wheel, and whatever follows it) hand you the
   * exact source text a data file wants — `{ cast: { school: 'psionic',
   * shape: { force: 6 } } }`. Without this the only way in was to add the
   * fields one at a time and retype the numbers, which is precisely the
   * piece-by-piece grind this panel exists to remove.
   */
  let pasting = $state<string | null>(null);
  let pasteText = $state('');
  let pasteError = $state<string | null>(null);

  const PASTE_HINT = "{ cast: { school: 'psionic', shape: { force: 6, mass: 5 } } }";

  function openPaste(slot: string): void {
    pasting = slot;
    pasteText = '';
    pasteError = null;
  }

  function applyPaste(path: PathStep[], index: number): void {
    const read = parseObjectLiteral(pasteText);
    if (!read.ok) {
      pasteError = read.error;
      return;
    }
    set([...path, index], read.value);
    pasting = null;
    pasteText = '';
    pasteError = null;
  }

  function addElement(path: PathStep[], arr: Record<string, unknown>[]): void {
    const sample: Record<string, unknown> = {};
    for (const el of arr) {
      for (const [k, v] of Object.entries(el)) if (!(k in sample)) sample[k] = v;
    }
    const blank = (blankLike(sample) ?? {}) as Record<string, unknown>;
    if (typeof sample.id === 'string') {
      const taken = new Set(arr.map((e) => e.id));
      let n = 1;
      while (taken.has(`new_${n}`)) n++;
      blank.id = `new_${n}`;
    }
    set([...path, arr.length], blank);
  }

  function singular(key: string): string {
    if (key.endsWith('ies')) return `${key.slice(0, -3)}y`;
    if (key.endsWith('sses') || key.endsWith('xes')) return key.slice(0, -2);
    return key.replace(/s$/, '');
  }

  function keysOf(el: Record<string, unknown>): string[] {
    const keys = Object.keys(el);
    const pinned = ['id', ...PINNED].filter((k) => keys.includes(k));
    return [...pinned, ...keys.filter((k) => !pinned.includes(k))];
  }

  function isOpen(key: string, dflt: boolean): boolean {
    return open[key] ?? dflt;
  }

  function toggle(key: string, dflt: boolean): void {
    open[key] = !isOpen(key, dflt);
  }

  function commitField(path: PathStep[], have: string[]): void {
    const name = newKey.trim();
    if (have.includes(name)) {
      store.say(`'${name}' is already on this entry`, 'bad');
      return;
    }

    // A name the corpus knows arrives with the corpus's shape — the type
    // dropdown cannot mistype a known field, and its casing is by definition
    // right. Only a genuinely NEW name faces the style police: field names
    // here are lowerCamelCase (plus bare digits, for tier-keyed groups like
    // `mastery`), and `explore_ticks` in a file full of `exploreTicks` is a
    // bug the IDE would catch later. Catch it now instead.
    const known = fieldIndex.get(name);
    if (!known && !/^[a-z][a-zA-Z0-9]*$/.test(name) && !/^\d+$/.test(name)) {
      store.say(`'${name}' — field names are lowerCamelCase ('exploreTicks', not 'explore_ticks')`, 'bad');
      return;
    }

    const blank = known
      ? blankOf(known.shape, known.example)
      : newType === 'number'
        ? 0
        : newType === 'flag'
          ? false
          : newType === 'list'
            ? []
            : newType === 'group'
              ? {}
              : '';
    set([...path, name], blank);
    if (!known) store.say(`'${name}' is new — no other ${kind} carries it. Intended?`, 'warn');
    adding = null;
    newKey = '';
  }

  /** Everything currently pointing at this entry — what a rename has to move. */
  const inbound = $derived(store.references(kind, id));

  // The id edits an OVERLAY (null = showing the real id) so shape/uniqueness
  // problems show as you type; the rename itself (blast-radius confirm and
  // all — see lib/rename.ts) only fires on commit.
  let idEdit = $state<string | null>(null);
  $effect(() => {
    // A half-typed rename must not survive a jump to another entry.
    if (id) idEdit = null;
  });
  const idIssue = $derived(
    idEdit === null || idEdit.trim() === id ? null : idProblem(store, kind, idEdit.trim()),
  );

  function rename(): void {
    if (idEdit === null) return;
    const next = requestRename(kind, id, idEdit);
    if (next) onrename?.(next);
  }

  async function copyId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(id);
      store.say(`${id} copied`, 'ok');
    } catch {
      store.say('Clipboard refused — copy it from the field', 'warn');
    }
  }

  function removeEntry(): void {
    const question = `Delete ${kind} '${id}'?\n\nAnything referencing it breaks — check the cross-references first. The edit is staged, not written.`;
    if (!window.confirm(question)) return;
    store.del(kind, [id]);
    store.say(`Deleted ${id} — staged, review the diff before applying`, 'warn');
  }

  // The exact text on disk, which is the point: staged edits are NOT in here,
  // so this is what the forge is about to rewrite.
  $effect(() => {
    if (!showSource) return;
    const forKind = kind;
    const forId = id;
    let alive = true;
    source = null;
    sourceError = null;
    api
      .source(forKind, [forId])
      .then((r) => {
        if (alive) source = { file: r.file, text: r.source };
      })
      .catch((e) => {
        if (alive) sourceError = e instanceof Error ? e.message : String(e);
      });
    return () => {
      alive = false;
    };
  });
</script>

{#snippet addField(path: PathStep[], have: string[], suggest: string[])}
  {@const slot = 'add:' + path.join('.')}
  {#if adding === slot}
    <div class="row addf">
      <input
        class="grow"
        placeholder="field name"
        spellcheck="false"
        list="forge-keys"
        bind:value={newKey}
        onkeydown={(e) => e.key === 'Enter' && commitField(path, have)}
      />
      {#if !knownField}
        <select bind:value={newType}>
          <option value="text">text</option>
          <option value="number">number</option>
          <option value="flag">true/false</option>
          <option value="list">list</option>
          <option value="group">group</option>
        </select>
      {/if}
      <button class="tiny primary" onclick={() => commitField(path, have)}>add</button>
      <button class="tiny ghost" onclick={() => (adding = null)}>✕</button>
    </div>
    {#if newKey.trim()}
      <div class="addf-hint" class:fresh={!knownField}>
        {#if knownField}
          known field — {SHAPE_LABEL[knownField.shape] ?? knownField.shape}, used {knownField.uses}×
          {#if knownField.shape === 'string' || knownField.shape === 'number'}
            (e.g. <code>{JSON.stringify(knownField.example)?.slice(0, 40)}</code>)
          {/if}
        {:else}
          new field — no {kind} has it; lowerCamelCase, pick the type
        {/if}
      </div>
    {/if}
    <datalist id="forge-keys">
      {#each suggest.filter((s) => !have.includes(s)) as s (s)}<option value={s}></option>{/each}
    </datalist>
  {:else}
    <button
      class="tiny ghost addbtn"
      onclick={() => {
        adding = slot;
        newKey = '';
      }}
    >
      ＋ field
    </button>
  {/if}
{/snippet}

{#snippet node(n: Node)}
  {@const shape = shapeOf(n.value)}
  {@const ref = refKind(n.key, n.parentKey)}
  {@const vocab = n.depth === 0 ? tagVocab(n.key) : undefined}
  {@const slot = n.path.join('.')}
  {@const problem = n.depth === 0 ? (fieldProblems.get(n.key) ?? null) : null}
  {@const removable = n.depth > 0 || !requiredKeys.has(n.key)}

  {#if shape === 'objects' || shape === 'object'}
    {@const list = shape === 'objects' ? asObjects(n.value) : []}
    {@const dflt = shape === 'object' ? n.depth < 3 : list.length <= 4}
    <div class="group">
      <div class="ghead">
        <button class="tw" onclick={() => toggle(slot, dflt)}>
          {isOpen(slot, dflt) ? '▾' : '▸'}
          <b>{n.key}</b>
          <span class="dim">{shape === 'objects' ? `${list.length} item${list.length === 1 ? '' : 's'}` : 'group'}</span>
        </button>
        <span class="grow"></span>
        {#if problem}<span class="pill bad">⚠</span>{/if}
        {#if removable}
          <button class="kill" title="remove {n.key}" onclick={() => store.del(kind, n.path)}>✕</button>
        {/if}
      </div>

      {#if isOpen(slot, dflt)}
        <div class="gbody">
          {#if problem}<div class="banner">⚠ {problem}</div>{/if}

          {#if shape === 'objects'}
            {@const union = [...new Set(list.flatMap((e) => Object.keys(e)))]}
            {#each list as el, i}
              {@const step = elementStep(el, i)}
              <div class="el">
                <div class="el-head">
                  <code class="dim">{elementLabel(el, i)}</code>
                  <span class="grow"></span>
                  <button class="tiny ghost danger" onclick={() => store.del(kind, [...n.path, step])}>
                    remove
                  </button>
                </div>
                {#each keysOf(el) as k (k)}
                  {@render node({
                    key: k,
                    value: el[k],
                    path: [...n.path, step, k],
                    parentKey: n.key,
                    depth: n.depth + 1,
                  })}
                {/each}
                {@render addField([...n.path, step], Object.keys(el), union)}
              </div>
            {/each}
            {@const tpl = templateFor(kind, n.key)}
            <div class="row wrapx">
              {#if tpl}
                {#each tpl.variants as v (v.id)}
                  <button class="tiny" onclick={() => set([...n.path, list.length], v.make())}>
                    ＋ {tpl.variants.length > 1 ? v.label : tpl.noun}
                  </button>
                {/each}
              {:else}
                <button class="tiny" onclick={() => addElement(n.path, list)}>
                  ＋ add {singular(n.key)}
                </button>
              {/if}
              {@render pasteControl(n.path, list.length)}
            </div>
          {:else}
            {@const obj = asObject(n.value)}
            {#each Object.keys(obj) as k (k)}
              {@render node({
                key: k,
                value: obj[k],
                path: [...n.path, k],
                parentKey: n.key,
                depth: n.depth + 1,
              })}
            {/each}
            {@render addField(n.path, Object.keys(obj), [])}
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <div class="slot">
      {#if shape === 'boolean'}
        <label class="check">
          <input
            type="checkbox"
            checked={n.value === true}
            onchange={(e) => set(n.path, e.currentTarget.checked)}
          />
          <span>{n.key}</span>
        </label>
        {#if problem}<div class="banner">⚠ {problem}</div>{/if}
      {:else if shape === 'opaque'}
        <Field label={n.key} hint="a function in the source — the forge leaves it alone">
          <code class="ro">{markerText(n.value)}</code>
        </Field>
      {:else if shape === 'nothing'}
        <Field label={n.key} hint="null">
          <code class="ro">null</code>
        </Field>
      {:else if shape === 'number'}
        <Field label={n.key} {problem}>
          <input
            type="number"
            step="any"
            value={n.value}
            oninput={(e) => writeNumber(e.currentTarget.value, n.path)}
          />
        </Field>
      {:else if shape === 'string'}
        {@const text = n.value as string}
        <Field label={n.key} {problem} hint={ref ? `${ref} id` : undefined}>
          {#if ref}
            {@const allow = refAllow(n.key)}
            <RefPicker kind={ref} value={text} {allow} onchange={(v) => set(n.path, v ?? '')} />
            {#if allow?.includes(text)}
              <!-- The sentinel and the list are different SHAPES in the data, so
                   swapping between them is a button rather than a typing exercise. -->
              <button class="tiny ghost" onclick={() => set(n.path, [''])}>
                use a list of {ref}s instead
              </button>
            {/if}
          {:else if isColorField(n.key, text)}
            <!-- The native color input IS the preview: its face wears the value.
                 The text box stays authoritative — it holds shorthand or alpha
                 hex the picker cannot represent, and never gets rewritten just
                 because the picker had to approximate it. -->
            <div class="row">
              <input
                type="color"
                class="swatch"
                title={text || 'pick a color'}
                value={pickerHex(text)}
                oninput={(e) => set(n.path, e.currentTarget.value)}
              />
              <input
                class="mono grow"
                value={text}
                spellcheck="false"
                placeholder="#rrggbb"
                oninput={(e) => set(n.path, e.currentTarget.value)}
              />
            </div>
          {:else if enumOptions(n.key, text, n.parentKey)}
            {@const en = enumOptions(n.key, text, n.parentKey)!}
            {@const unknown = !!text && !META_ENUMS[n.key] && (enumIndex.get(n.key)?.get(text) ?? 0) <= 1}
            {#if en.closed}
              <!-- A closed union: typing into it can only ever produce a value
                   the typechecker rejects, so it gets a list instead. -->
              <select
                class:odd={unknown}
                value={text}
                onchange={(e) => set(n.path, e.currentTarget.value)}
              >
                {#if !text}<option value="">— pick one —</option>{/if}
                {#each en.options as o (o)}<option value={o}>{o}</option>{/each}
              </select>
            {:else}
              <!-- Learned from existing entries, so it CANNOT contain the value
                   a new entry wants to introduce. Suggestions, never a cage. -->
              <input
                class:odd={unknown}
                value={text}
                spellcheck="false"
                list={`vocab-${slot}`}
                placeholder="type anything — {en.options.length} in use"
                oninput={(e) => set(n.path, e.currentTarget.value)}
              />
              <datalist id={`vocab-${slot}`}>
                {#each en.options as o (o)}<option value={o}></option>{/each}
              </datalist>
            {/if}
          {:else if LONG_TEXT.has(n.key) || text.length > 80}
            <textarea value={text} oninput={(e) => set(n.path, e.currentTarget.value)}></textarea>
          {:else}
            <input
              value={text}
              spellcheck="false"
              class:mono={isPathKey(n.key)}
              oninput={(e) => {
                if (!isPathKey(n.key)) set(n.path, e.currentTarget.value);
              }}
              onchange={(e) => set(n.path, e.currentTarget.value)}
            />
          {/if}
        </Field>
      {:else if shape === 'empty' && templateFor(kind, n.key)}
        <!--
          A list the game defines exactly: offer its real shape instead of
          asking the author to rebuild it from "group" and guesswork.
        -->
        {@const tpl = templateFor(kind, n.key)!}
        <Field label={n.key} {problem} hint={tpl.hint}>
          <div class="row wrapx">
            {#each tpl.variants as v (v.id)}
              <button class="tiny" onclick={() => set([...n.path, 0], v.make())}>
                ＋ {tpl.variants.length > 1 ? v.label : tpl.noun}
              </button>
            {/each}
            {@render pasteControl(n.path, 0)}
          </div>
        </Field>
      {:else if shape === 'strings' || (shape === 'empty' && (ref || vocab || typing === slot || emptyListShape(n.key)?.shape === 'strings'))}
        {@const values = asStrings(n.value)}
        <Field label={n.key} {problem} hint={ref ? `${ref} ids` : vocab?.note}>
          {#if ref}
            {@const allow = refAllow(n.key)}
            <div class="col reflist">
              {#each values as v, i}
                <div class="row">
                  <div class="grow">
                    <RefPicker
                      kind={ref}
                      value={v}
                      {allow}
                      onchange={(next) =>
                        next === undefined
                          ? store.del(kind, [...n.path, i])
                          : set([...n.path, i], next)}
                    />
                  </div>
                  <button class="kill" title="remove" onclick={() => store.del(kind, [...n.path, i])}>✕</button>
                </div>
              {/each}
              <div class="row">
                <button class="tiny" onclick={() => set([...n.path, values.length], '')}>＋ {ref}</button>
                {#each allow ?? [] as sentinel (sentinel)}
                  <button
                    class="tiny ghost"
                    title="Replaces the whole list — a different shape in the data"
                    onclick={() => set(n.path, sentinel)}
                  >
                    set to “{sentinel}”
                  </button>
                {/each}
              </div>
            </div>
          {:else}
            <div class="row">
              <div class="grow">
                <TagInput
                  {values}
                  onchange={(next) => set(n.path, next)}
                  suggestions={vocab?.ids ?? tagSuggestions.get(n.key) ?? []}
                  isValid={vocab ? (t) => vocab.ids.includes(t) : undefined}
                />
              </div>
              {#if typing === slot && values.length === 0}
                <!-- Opened by mistake: nothing was written, so backing out is free. -->
                <button class="tiny ghost" title="not a text list" onclick={() => (typing = null)}>
                  ✕
                </button>
              {/if}
            </div>
          {/if}
        </Field>
      {:else if shape === 'numbers' || (shape === 'empty' && emptyListShape(n.key)?.shape === 'numbers')}
        {@const values = asNumbers(n.value)}
        <Field label={n.key} {problem}>
          <div class="nums">
            {#each values as v, i}
              <input
                class="num"
                type="number"
                step="any"
                value={v}
                oninput={(e) => writeNumber(e.currentTarget.value, [...n.path, i])}
              />
            {/each}
            <button class="tiny ghost" title="append" onclick={() => set([...n.path, values.length], 0)}>＋</button>
            {#if values.length}
              <button
                class="tiny ghost"
                title="drop last"
                onclick={() => store.del(kind, [...n.path, values.length - 1])}
              >
                −
              </button>
            {/if}
          </div>
        </Field>
      {:else if shape === 'empty' && emptyListShape(n.key)?.shape === 'objects'}
        <!--
          No template for this one, but other entries show what its elements
          look like — so offer that rather than an empty group.
        -->
        {@const el = emptyListShape(n.key)!.element}
        <Field label={n.key} {problem} hint="shaped like the {singular(n.key)}s on other {cat?.label?.toLowerCase() ?? 'entries'}">
          <button class="tiny" onclick={() => set([...n.path, 0], el)}>＋ {singular(n.key)}</button>
        </Field>
      {:else if shape === 'empty'}
        <!--
          An EMPTY LIST, so these choose what goes in it — not what the field
          becomes. Naming them "text/number/group" read as the latter, which is
          how a `name: string` ended up as `name: ['…']`.
        -->
        <Field label={n.key} hint="empty list — what goes in it?">
          <div class="row">
            <button class="tiny" onclick={() => (typing = slot)}>＋ text items</button>
            <button class="tiny" onclick={() => set([...n.path, 0], 0)}>＋ numbers</button>
            <button class="tiny" onclick={() => set([...n.path, 0], {})}>＋ groups</button>
          </div>
        </Field>
      {:else}
        <Field label={n.key} {problem} hint="mixed shape — edited as JSON">
          <textarea
            class="mono"
            value={JSON.stringify(n.value)}
            onchange={(e) => {
              try {
                set(n.path, JSON.parse(e.currentTarget.value));
              } catch {
                store.say(`${n.key}: not valid JSON, left alone`, 'bad');
              }
            }}
          ></textarea>
        </Field>
      {/if}

      {#if removable}
        <button class="kill float" title="remove {n.key}" onclick={() => store.del(kind, n.path)}>✕</button>
      {/if}
    </div>
  {/if}
{/snippet}

<!--
  Paste a `{ … }` literal straight into a list. The benches copy source text in
  exactly this form, so tuning a working ends in a paste rather than a
  transcription. See lib/literal.ts for what it will and will not read.
-->
{#snippet pasteControl(path: PathStep[], index: number)}
  {@const slot = 'paste:' + path.join('.')}
  {#if pasting === slot}
    <div class="col paste">
      <textarea
        class="mono"
        rows="3"
        spellcheck="false"
        placeholder={PASTE_HINT}
        bind:value={pasteText}
      ></textarea>
      <div class="row">
        <button class="tiny primary" onclick={() => applyPaste(path, index)}>Add</button>
        <button class="tiny ghost" onclick={() => (pasting = null)}>Cancel</button>
        {#if pasteError}<span class="bad">{pasteError}</span>{/if}
      </div>
    </div>
  {:else}
    <button class="tiny ghost" title="Paste an object literal copied from a bench" onclick={() => openPaste(slot)}>
      ⎘ paste
    </button>
  {/if}
{/snippet}

<div class="entry">
  <header class="ehead">
    <span class="ico">{icon}</span>
    <b class="title">{title}</b>
    <input
      class="mono idedit"
      class:bad={!!idIssue}
      value={idEdit ?? id}
      spellcheck="false"
      title={idIssue ??
        (inbound.length
          ? `Rename — ${inbound.length} reference(s) will move with it`
          : 'Rename — nothing points at this yet')}
      oninput={(e) => (idEdit = e.currentTarget.value)}
      onchange={rename}
    />
    {#if inbound.length}
      <span class="pill" title="things pointing at this id">← {inbound.length}</span>
    {/if}
    <button class="tiny ghost" title="copy id" onclick={copyId}>⧉</button>
    <span class="grow"></span>
    <button class="tiny" class:on={showSource} onclick={() => (showSource = !showSource)}>
      View source
    </button>
    <button class="tiny danger" onclick={removeEntry}>Delete</button>
  </header>

  {#if entryProblems.length}
    <div class="banner top">
      {#each entryProblems as p, i (i)}
        <div>{p.severity === 'error' ? '⛔' : '⚠'} {p.message}</div>
      {/each}
    </div>
  {/if}

  <!-- Notes to your future self. Each lands as a `// TODO:` / `// SPEC:` line
       directly above the entry in the data file — a comment, not game data. -->
  <div class="notes">
    <label class="note-row">
      <span class="note-tag todo">📌 TODO</span>
      <input
        value={notes.TODO ?? ''}
        placeholder="what's unfinished here — written as // TODO: above the entry"
        spellcheck="false"
        onchange={(e) => store.setNote(kind, id, 'TODO', e.currentTarget.value)}
      />
    </label>
    <label class="note-row">
      <span class="note-tag spec">📋 SPEC</span>
      <input
        value={notes.SPEC ?? ''}
        placeholder="how it's meant to work — written as // SPEC: above the entry"
        spellcheck="false"
        onchange={(e) => store.setNote(kind, id, 'SPEC', e.currentTarget.value)}
      />
    </label>
  </div>

  <!-- A monster's rotation is the one place the data does not say what it
       means: a cast is a sentence, and its damage lives in the composer. -->
  {#if kind === 'monster'}
    <MonsterPreview {def} />
  {/if}

  {#if showSource}
    <div class="src">
      <div class="src-head">
        <code class="dim">{source?.file ?? cat?.file}</code>
        <span class="grow"></span>
        <span class="dim">on disk — staged edits are not in here</span>
      </div>
      {#if sourceError}
        <div class="empty" style="color: var(--bad)">{sourceError}</div>
      {:else if !source}
        <div class="empty">Reading…</div>
      {:else if source.text === null}
        <div class="empty">Not found in the file — this entry is still only staged.</div>
      {:else}
        <pre class="mono">{source.text}</pre>
      {/if}
    </div>
  {/if}

  <div class="fields">
    {#each rootKeys as key (key)}
      {@render node({ key, value: def[key], path: [id, key], depth: 0 })}
    {/each}
    {@render addField([id], Object.keys(def), siblingKeys)}
  </div>
</div>

<style>
  /* The paste box wants the whole row: a literal is wider than a chip. */
  .paste {
    width: 100%;
    gap: 5px;
  }

  .paste textarea {
    width: 100%;
    font-size: 11px;
    line-height: 1.4;
    resize: vertical;
  }

  .paste .bad {
    color: var(--bad);
    font-size: 11px;
  }

  .entry {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Only this entry uses the value — either the first of its kind, or a typo. */
  select.odd {
    border-color: var(--warn);
  }

  .idedit {
    width: 15em;
    flex: 0 0 auto;
    padding: 2px 6px;
    font-size: 12px;
    border-style: dashed;
  }

  .idedit.bad {
    border-color: var(--bad);
    color: var(--bad);
  }

  .wrapx {
    flex-wrap: wrap;
  }

  .addf-hint {
    font-size: 11px;
    color: var(--ok);
    margin-top: 3px;
    line-height: 1.4;
  }

  .addf-hint.fresh {
    color: var(--warn);
  }

  /* The native color input, dressed to match the other controls. Its face is
     the preview, so it must not be shrunk into an unreadable sliver. */
  .swatch {
    flex: 0 0 auto;
    width: 40px;
    height: 29px;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg);
    cursor: pointer;
  }

  .swatch:hover {
    border-color: var(--accent);
  }

  .ehead {
    display: flex;
    align-items: center;
    gap: 7px;
    padding-bottom: 9px;
    border-bottom: 1px solid var(--border);
  }

  .ehead .ico {
    font-size: 17px;
  }

  .title {
    font-size: 15px;
  }

  .notes {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 8px 0 2px;
  }

  .note-row {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .note-row input {
    flex: 1;
    font-size: 12px;
  }

  /* Quiet until they hold something — notes are margins, not the page. */
  .note-row input::placeholder {
    color: var(--dimmer);
    opacity: 0.7;
  }

  .note-tag {
    flex-shrink: 0;
    width: 62px;
    font-size: 10.5px;
    letter-spacing: 0.5px;
  }

  .note-tag.todo {
    color: var(--warn);
  }

  .note-tag.spec {
    color: var(--accent);
  }


  button.on {
    border-color: var(--accent);
    color: var(--accent);
  }

  .banner {
    border: 1px solid rgba(248, 113, 113, 0.4);
    background: rgba(248, 113, 113, 0.08);
    color: #ffc4c4;
    border-radius: 6px;
    padding: 5px 9px;
    font-size: 11.5px;
    line-height: 1.45;
    margin-bottom: 7px;
  }

  .banner.top {
    margin-bottom: 0;
  }

  /* ---------- Source ---------- */

  .src {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    background: #0b0e15;
  }

  .src-head {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg3);
    padding: 4px 9px;
    font-size: 11px;
  }

  .src pre {
    padding: 9px 11px;
    max-height: 340px;
    overflow: auto;
    line-height: 1.5;
    white-space: pre;
    color: #b9c6da;
  }

  /* ---------- Fields ---------- */

  .fields {
    display: flex;
    flex-direction: column;
  }

  .slot {
    position: relative;
  }

  .kill {
    border: none;
    background: none;
    color: var(--dimmer);
    font-size: 12px;
    line-height: 1;
    padding: 2px 5px;
    border-radius: 5px;
  }

  .kill:hover {
    color: var(--bad);
    background: none;
  }

  .kill.float {
    position: absolute;
    top: 0;
    right: 0;
    opacity: 0;
  }

  .slot:hover .kill.float,
  .kill.float:focus-visible {
    opacity: 1;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 9px;
    font-size: 12.5px;
    cursor: pointer;
  }

  .ro {
    display: block;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 5px 8px;
    color: var(--dimmer);
    word-break: break-word;
  }

  .nums {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
  }

  .num {
    width: 88px;
  }

  .reflist {
    gap: 4px;
  }

  /* ---------- Nested groups ---------- */

  .group {
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 9px;
    background: var(--bg2);
  }

  .ghead {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 7px 3px 3px;
  }

  .tw {
    display: flex;
    align-items: center;
    gap: 6px;
    border: none;
    background: none;
    padding: 4px 6px;
    font-size: 12px;
    color: var(--dim);
  }

  .tw:hover {
    background: none;
    color: var(--text);
  }

  .tw b {
    color: var(--text);
  }

  .gbody {
    padding: 2px 10px 9px;
  }

  .el {
    border-left: 2px solid var(--border);
    padding: 4px 0 2px 10px;
    margin-bottom: 8px;
  }

  .el-head {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 5px;
  }

  .addf {
    margin: 2px 0 9px;
  }

  .addf select {
    width: auto;
    font-size: 12px;
    padding: 4px 6px;
  }

  .addbtn {
    color: var(--dimmer);
    font-size: 11px;
    padding: 2px 6px;
    align-self: flex-start;
    margin-bottom: 6px;
  }
</style>
