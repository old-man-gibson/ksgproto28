<script lang="ts">
  /**
   * The lookup half of the reference column: one search over everything the
   * game can NAME — content entries, and the identifier vocabulary that isn't
   * a registry (trigger events, counters, stat keys, tags, damage types…).
   *
   * The vocabulary exists because knowing a thing is possible is not the same
   * as knowing what to type: "a technique that fires on a parry" is
   * `trigger: { event: 'onParry' }` gated by the `combat:parries` counter, and
   * neither string is discoverable from inside an editor field. Every term
   * peeks to a copy-ready snippet showing exactly how content calls it.
   *
   * Entry peeks show the DATA FILE text, comments and all, because that is the
   * densest honest reference there is.
   */
  import { api } from '../lib/api';
  import { store } from '../lib/store.svelte';
  import type { SpotDef } from '../../src/core/types';

  interface Props {
    onnavigate: (kind: string, id: string) => void;
  }
  let { onnavigate }: Props = $props();

  const ENTRY_MAX = 25;
  const TERM_MAX = 40;

  interface Term {
    group: string;
    icon: string;
    id: string;
    name?: string;
    desc?: string;
    /** How content actually calls it — the copy-ready part. */
    snippet?: string;
  }

  interface EntryHit {
    kind: string;
    kindLabel: string;
    id: string;
    name: string;
    icon: string;
  }

  type Peek = { type: 'entry'; kind: string; id: string } | { type: 'term'; term: Term };

  let query = $state('');
  let group = $state<string | null>(null);
  let peek = $state<Peek | null>(null);
  let source = $state<string | null>(null);
  let sourceError = $state<string | null>(null);

  // ---------- The vocabulary ----------

  /** What a `*` counter varies over — harvested keys can't say, so this does. */
  const DYNAMIC_COUNTERS: Record<string, string> = {
    'kills:*': 'per monster — e.g. kills:forest_rat',
    'kills:tag:*': 'per monster tag — e.g. kills:tag:beast',
    'gather:*': 'per material — e.g. gather:common_herb',
    'forged:*': 'per item class, forged at the anvil or by a recipe line — e.g. forged:sword',
    'attr:*': 'highest level reached, per attribute — e.g. attr:str',
    'used:*': 'per weapon family — e.g. used:sword',
  };

  const vocab = $derived.by(() => {
    const meta = store.meta as Record<string, unknown>;
    const terms: Term[] = [];

    for (const e of (meta.triggerEvents ?? []) as { id: string; name: string }[]) {
      terms.push({
        group: 'Trigger events',
        icon: '🔔',
        id: e.id,
        name: e.name,
        desc: 'Gates a technique or skill trigger to the short window after this happens in combat.',
        snippet: `trigger: { event: '${e.id}', conditions: [] }`,
      });
    }

    for (const s of (meta.triggerSubjects ?? []) as { id: string; name?: string; kind?: string }[]) {
      terms.push({
        group: 'Trigger subjects',
        icon: '🎚️',
        id: s.id,
        name: s.name,
        desc: `Something a trigger condition can read${s.kind === 'enum' ? " (enum — use op 'is'/'isNot')" : ''}.`,
        snippet:
          s.kind === 'enum'
            ? `conditions: [{ subject: '${s.id}', op: 'is', value: '…' }]`
            : `conditions: [{ subject: '${s.id}', op: '<=', value: 50 }]`,
      });
    }

    for (const c of (meta.counters ?? []) as { key: string; files: string[] }[]) {
      terms.push({
        group: 'Counters',
        icon: '🔢',
        id: c.key,
        desc: `${DYNAMIC_COUNTERS[c.key] ?? 'A lifetime tally in state.stats.'} Bumped in ${c.files.join(', ')}.`,
        snippet: `{ type: 'stat', key: '${c.key}', value: 100 }        // unlock / title\nlearn: { self: { stat: '${c.key}', count: 60 } }   // self-taught technique`,
      });
    }

    for (const [id, label] of Object.entries((meta.statNames ?? {}) as Record<string, string>)) {
      terms.push({
        group: 'Stat keys',
        icon: '📊',
        id,
        name: label,
        desc: 'A derived stat every Modifier pipeline can move — equipment, titles, styles, statuses, effects. Append `:tag` to scope it to work carrying that tag.',
        snippet: `{ stat: '${id}', op: 'mult', value: 0.05 }                 // everywhere\n{ stat: '${id}:leatherwork', op: 'mult', value: 0.05 }  // only tagged work`,
      });
    }

    for (const a of (meta.attributes ?? []) as { id: string; name: string }[]) {
      terms.push({
        group: 'Attributes',
        icon: '💪',
        id: a.id,
        name: a.name,
        snippet: `{ type: 'attr', attr: '${a.id}', level: 10 }   // unlock condition\nattrXp: { ${a.id}: 0.5 }                      // activity training split`,
      });
    }

    for (const [id, resStat] of Object.entries((meta.resStatByType ?? {}) as Record<string, string>)) {
      terms.push({
        group: 'Damage types',
        icon: '🗡️',
        id,
        desc: `Resisted by the '${resStat}' stat.`,
        snippet: `damageType: '${id}'\nresistances: { ${id}: 0.5 }   // half damage; negative = vulnerable`,
      });
    }

    // Tags: what skills CLAIM decides what training pays into; what activities
    // EMIT decides where a skill can manifest. Both sides matter.
    const claimed = new Map<string, string[]>();
    for (const s of store.list<{ id: string; tags?: string[] }>('skill')) {
      for (const t of s.tags ?? []) claimed.set(t, [...(claimed.get(t) ?? []), s.id]);
    }
    const emitted = new Set<string>();
    for (const sp of store.list<SpotDef>('spot')) {
      for (const a of sp.activities ?? []) for (const t of (a as { tags?: string[] }).tags ?? []) emitted.add(t);
    }
    for (const t of new Set([...claimed.keys(), ...emitted])) {
      const owners = claimed.get(t);
      terms.push({
        group: 'Skill tags',
        icon: '🏷️',
        id: t,
        desc: owners
          ? `Claimed by ${owners.join(', ')}${emitted.has(t) ? ' · emitted by activities' : ''}.`
          : 'Emitted by activities but claimed by NO skill — XP sent here goes nowhere.',
        snippet: `tags: ['${t}']`,
      });
    }

    for (const c of (meta.skillCategories ?? []) as { id: string; name: string; icon: string }[]) {
      terms.push({ group: 'Skill categories', icon: c.icon, id: c.id, name: c.name, snippet: `category: '${c.id}'` });
    }

    // XP curve vocabulary. These are string unions in the types, so they are
    // erased at runtime and invisible to every other part of the forge — but
    // the tables that give them meaning are plain data, so the actual numbers
    // can be shown rather than just the names.
    for (const [id, cost] of Object.entries((meta.xpBase ?? {}) as Record<string, number>)) {
      terms.push({
        group: 'XP base tiers',
        icon: '📗',
        id,
        desc: `Base cost ${cost} — what one level of a skill of this calibre is worth.`,
        snippet: `progression: [{ from: 1, base: '${id}', rate: 'normal' }]`,
      });
    }
    for (const [id, mult] of Object.entries((meta.xpRate ?? {}) as Record<string, number>)) {
      terms.push({
        group: 'XP growth rates',
        icon: '📈',
        id,
        desc: `Cost compounds ×${mult} per level within a band. Named for the LEARNER: 'fast' means levels arrive fast, i.e. the smallest multiplier.`,
        snippet: `progression: [{ from: 1, base: 'novice', rate: '${id}' }]`,
      });
    }
    for (const [id, bands] of Object.entries(
      (meta.progressions ?? {}) as Record<string, { from: number; base: string; rate: string }[]>,
    )) {
      terms.push({
        group: 'Named XP curves',
        icon: '🪜',
        id,
        desc: bands.map((b) => `from ${b.from}: ${b.base}/${b.rate}`).join(' · '),
        // Skills point at a named curve rather than spelling out bands, so
        // that is the snippet worth copying.
        snippet: `progression: PROGRESSIONS.${id}`,
      });
    }

    for (const r of (meta.resources ?? []) as { id: string; name?: string }[]) {
      terms.push({ group: 'Resources', icon: '🫙', id: r.id, name: r.name, snippet: `resource: '${r.id}'` });
    }

    const record = (metaKey: string, groupName: string, icon: string, field: string) => {
      for (const def of Object.values((meta[metaKey] ?? {}) as Record<string, { id: string; name?: string }>)) {
        terms.push({ group: groupName, icon, id: def.id, name: def.name || undefined, snippet: `${field}: '${def.id}'` });
      }
    };
    record('tiers', 'Monster tiers', '🪜', 'tier');
    record('modifierTiers', 'Modifier tiers', '👑', 'modifierWeights key');
    record('rarities', 'Rarities', '💠', 'rarity');

    // Enums nothing exports: harvested from how content already uses them, so
    // they are real by construction.
    const inUse = (pick: (def: Record<string, unknown>) => unknown): Map<string, number> => {
      const seen = new Map<string, number>();
      for (const cat of store.catalog) {
        for (const def of Object.values(store.all<Record<string, unknown>>(cat.kind))) {
          for (const v of [pick(def)].flat(2)) {
            if (typeof v === 'string' && v) seen.set(v, (seen.get(v) ?? 0) + 1);
          }
        }
      }
      return seen;
    };
    const enumGroup = (groupName: string, icon: string, uses: Map<string, number>, snippet: (id: string) => string) => {
      for (const [id, n] of uses) {
        terms.push({ group: groupName, icon, id, desc: `Used ${n}× in current content.`, snippet: snippet(id) });
      }
    };
    enumGroup(
      'Unlock condition types',
      '🔓',
      inUse((d) => ((d.unlock as { type?: string }[] | undefined) ?? []).map((u) => u.type)),
      (id) => `unlock: [{ type: '${id}', … }]`,
    );
    enumGroup(
      'Quest objective types',
      '🎯',
      inUse((d) => ((d.objectives as { type?: string }[] | undefined) ?? []).map((o) => o.type)),
      (id) => `objectives: [{ type: '${id}', count: 1, desc: '…' }]`,
    );
    enumGroup(
      'Activity kinds',
      '⚙️',
      inUse((d) => ((d.activities as { kind?: string }[] | undefined) ?? []).map((a) => a.kind)),
      (id) => `{ id: '…', kind: '${id}', name: '…', icon: '…' }`,
    );

    return terms;
  });

  const groups = $derived.by(() => {
    const counts = new Map<string, { icon: string; n: number }>();
    for (const t of vocab) {
      const g = counts.get(t.group) ?? { icon: t.icon, n: 0 };
      g.n++;
      counts.set(t.group, g);
    }
    return [...counts].map(([name, g]) => ({ name, ...g }));
  });

  // ---------- Search ----------

  /**
   * The query plus its rough inflections, so 'parry' still finds
   * `combat:parries` and 'dodge' finds `combat:dodges`. Deliberately crude —
   * a real stemmer would be overkill for a vocabulary this small.
   */
  function variants(q: string): string[] {
    const out = new Set([q]);
    if (q.endsWith('y')) out.add(q.slice(0, -1) + 'i'); // parry → parri(es)
    if (q.endsWith('ies')) out.add(q.slice(0, -3) + 'y');
    if (q.endsWith('s')) out.add(q.slice(0, -1));
    out.add(q + 's');
    return [...out];
  }

  function matches(hay: string, vs: string[]): boolean {
    const h = hay.toLowerCase();
    return vs.some((v) => h.includes(v));
  }

  const entryHits = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [] as EntryHit[];
    const vs = variants(q);
    const out: EntryHit[] = [];
    for (const cat of store.catalog) {
      for (const [id, def] of Object.entries(store.all<Record<string, unknown>>(cat.kind))) {
        const name = typeof def?.name === 'string' ? def.name : id;
        const desc = typeof def?.desc === 'string' ? def.desc : '';
        if (matches(id, vs) || matches(name, vs) || matches(desc, vs)) {
          out.push({ kind: cat.kind, kindLabel: cat.label, id, name, icon: (def?.icon as string) ?? cat.icon });
          if (out.length >= ENTRY_MAX) return out;
        }
      }
    }
    return out;
  });

  const termHits = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (q.length >= 2) {
      const vs = variants(q);
      return vocab
        .filter((t) => matches(t.id, vs) || matches(t.name ?? '', vs) || matches(t.desc ?? '', vs))
        .slice(0, TERM_MAX);
    }
    if (group) return vocab.filter((t) => t.group === group);
    return [] as Term[];
  });

  const peekedEntry = $derived(
    peek?.type === 'entry' ? store.get<Record<string, unknown>>(peek.kind, peek.id) : undefined,
  );

  $effect(() => {
    if (peek?.type !== 'entry') return;
    const target = peek;
    let alive = true;
    source = null;
    sourceError = null;
    api
      .source(target.kind, [target.id])
      .then((r) => {
        if (alive) source = r.source;
      })
      .catch((e) => {
        if (alive) sourceError = e instanceof Error ? e.message : String(e);
      });
    return () => {
      alive = false;
    };
  });

  function copySnippet(term: Term): void {
    navigator.clipboard?.writeText(term.snippet ?? term.id).then(
      () => store.say('Snippet copied', 'ok'),
      () => store.say('Clipboard refused — select it by hand', 'warn'),
    );
  }
</script>

<div class="lookup">
  <input
    placeholder="Search everything — content, triggers, counters, stats…"
    spellcheck="false"
    bind:value={query}
    oninput={() => (group = null)}
    onkeydown={(e) => {
      if (e.key === 'Enter') {
        if (entryHits.length > 0) peek = { type: 'entry', kind: entryHits[0].kind, id: entryHits[0].id };
        else if (termHits.length > 0) peek = { type: 'term', term: termHits[0] };
      } else if (e.key === 'Escape') {
        query = '';
        group = null;
        peek = null;
      }
    }}
  />

  {#if peek?.type === 'entry'}
    <div class="peek">
      <div class="row head">
        <b class="grow ttl">{(peekedEntry?.icon as string) ?? ''} {(peekedEntry?.name as string) ?? peek.id}</b>
        <button class="tiny" onclick={() => peek?.type === 'entry' && onnavigate(peek.kind, peek.id)}>open →</button>
        <button class="tiny ghost" aria-label="Close the peek" onclick={() => (peek = null)}>✕</button>
      </div>
      <code class="dim">{peek.kind} · {peek.id}</code>
      {#if source}
        <pre class="mono src scroll">{source}</pre>
      {:else if sourceError}
        <div class="dim note">{sourceError}</div>
      {:else if peekedEntry}
        <!-- Not on disk yet (a staged add), so the live value stands in. -->
        <pre class="mono src scroll">{JSON.stringify(peekedEntry, null, 2)}</pre>
        <div class="dim note">staged — not written to the file yet</div>
      {/if}
    </div>
  {:else if peek?.type === 'term'}
    {@const t = peek.term}
    <div class="peek">
      <div class="row head">
        <b class="grow ttl">{t.icon} {t.name ?? t.id}</b>
        <span class="pill">{t.group}</span>
        <button class="tiny ghost" aria-label="Close the peek" onclick={() => (peek = null)}>✕</button>
      </div>
      <code class="dim">{t.id}</code>
      {#if t.desc}<div class="note">{t.desc}</div>{/if}
      {#if t.snippet}
        <pre class="mono src snippet">{t.snippet}</pre>
        <button class="tiny" onclick={() => copySnippet(t)}>📋 copy snippet</button>
      {/if}
    </div>
  {/if}

  {#if entryHits.length > 0 || termHits.length > 0}
    <div class="hits">
      {#if group && !query.trim()}
        <div class="row group-head">
          <b>{group}</b>
          <span class="grow"></span>
          <button class="tiny ghost" onclick={() => (group = null)}>← groups</button>
        </div>
      {/if}
      {#each entryHits as r (r.kind + ':' + r.id)}
        <button
          class="hit"
          class:on={peek?.type === 'entry' && peek.kind === r.kind && peek.id === r.id}
          onclick={() => (peek = { type: 'entry', kind: r.kind, id: r.id })}
        >
          <span class="ico">{r.icon}</span>
          <span class="grow txt"><span class="nm">{r.name}</span> <code class="dim">{r.id}</code></span>
          <span class="pill">{r.kindLabel}</span>
        </button>
      {/each}
      {#each termHits as t (t.group + ':' + t.id)}
        <button
          class="hit"
          class:on={peek?.type === 'term' && peek.term.id === t.id && peek.term.group === t.group}
          onclick={() => (peek = { type: 'term', term: t })}
        >
          <span class="ico">{t.icon}</span>
          <span class="grow txt"><span class="nm">{t.name ?? t.id}</span> <code class="dim">{t.id}</code></span>
          <span class="pill vocab">{t.group}</span>
        </button>
      {/each}
      {#if entryHits.length >= ENTRY_MAX || termHits.length >= TERM_MAX}
        <div class="dim note">capped — narrow the search</div>
      {/if}
    </div>
  {:else if query.trim().length >= 2}
    <div class="empty">Nothing matches.</div>
  {:else if !peek}
    <div class="dim note">
      Search content and the game's vocabulary in one box, or browse a group:
    </div>
    <div class="chips">
      {#each groups as g (g.name)}
        <button class="chip" onclick={() => (group = g.name)}>
          {g.icon} {g.name} <span class="dim">{g.n}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .lookup {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }

  .peek {
    display: flex;
    flex-direction: column;
    gap: 5px;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px;
    background: var(--bg);
  }

  .ttl {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .src {
    max-height: 46vh;
    overflow: auto;
    background: #0b0e15;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px;
    font-size: 11.5px;
    line-height: 1.5;
    white-space: pre;
  }

  .snippet {
    max-height: none;
    color: #a5d6ff;
  }

  .peek > .tiny {
    align-self: flex-start;
  }

  .hits {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 0;
  }

  .group-head {
    padding: 2px 2px 4px;
  }

  .hit {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    border: none;
    background: transparent;
    border-radius: 6px;
    padding: 4px 7px;
    text-align: left;
    font-size: 12.5px;
  }

  .hit:hover {
    background: var(--bg3);
  }

  .hit.on {
    background: rgba(108, 158, 255, 0.14);
  }

  .hit .ico {
    width: 16px;
    text-align: center;
    flex-shrink: 0;
  }

  .hit .txt {
    display: flex;
    align-items: baseline;
    gap: 6px;
    overflow: hidden;
  }

  .hit .nm {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pill.vocab {
    color: var(--accent2);
    border-color: rgba(167, 139, 250, 0.4);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .chip {
    font-size: 11.5px;
    padding: 3px 9px;
    border-radius: 99px;
  }

  .note {
    font-size: 11px;
    line-height: 1.45;
  }
</style>
