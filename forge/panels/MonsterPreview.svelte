<script lang="ts">
  /**
   * What a monster's rotation actually does, at a level you choose.
   *
   * Authoring a cast is the one place in the forge where the data does not
   * say what it means: `{ cast: { school: 'arcane', words: ['fire:3'] } }` is
   * a sentence, and its damage lives in the composer, not in the entry. So
   * this reads the staged rotation through the GAME's own functions —
   * `baseMonsterAttrs` → `statsFromAttrs` → `specForSource` — rather than
   * restating any formula. monsterStats.ts keeps exactly one copy of them and
   * this must not become a second.
   *
   * Two things it deliberately says out loud, because both are easy to get
   * wrong while authoring:
   *
   *  - **Cost is advisory.** `castMonsterWorking` never charges a monster for
   *    a working, in any school. The number answers "would this be fair in the
   *    PLAYER's hands", which is the real question when deciding whether a
   *    goblin gets `fire:3`. Which purse it comes out of varies — arcane
   *    spends mana, psionics focus — so the column reads whichever applies.
   *  - **Damage is pre-mitigation.** Strikes land through `incomingSlice`, so
   *    the player's armor and resistances still have their say. There is no
   *    player here to have them.
   */
  import type { MonsterDef, SpellSource, SpellSpec, StatusApplication } from '../../src/core/types';
  import { baseMonsterAttrs, statsFromAttrs, MONSTER_ACTION_BAR } from '../../src/core/systems/monsterStats';
  import { specForSource } from '../../src/core/systems/spellcraft';
  import { splitWordId } from '../../src/core/systems/arcane';
  import { ARCANE_WORDS } from '../../src/core/data/spellcraft.data';
  import { STATUSES, TECHNIQUES } from '../../src/core/registry';
  import { TPS } from '../../src/core/engine/loop';

  interface Props {
    def: Record<string, unknown>;
  }
  let { def }: Props = $props();

  let level = $state(1);
  /** What the classification axes multiply a specimen by (elite, tier…). */
  let statMult = $state(1);

  const attrs = $derived(baseMonsterAttrs(def as unknown as MonsterDef, level));
  const scaled = $derived(
    Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, v * statMult])),
  );
  const stats = $derived(statsFromAttrs(scaled as typeof attrs));

  const rotation = $derived((def.rotation ?? []) as { cast?: SpellSource; technique?: string }[]);

  /** "blaze pierce" — the sentence as the composer will read it. */
  function sentenceOf(source: SpellSource): string {
    if (source.school !== 'arcane') return '';
    return source.words
      .map((raw) => {
        const { id, tier } = splitWordId(raw);
        const w = ARCANE_WORDS[id];
        if (!w) return `⚠ ${raw}`;
        return tier > 1 ? (w.stacked?.[tier - 2] ?? `${w.word}×${tier}`) : w.word;
      })
      .join(' ');
  }

  /** Expected damage of one working, before anything of the player's answers it. */
  function castDamage(spec: SpellSpec): number {
    let total = 0;
    for (const s of spec.strikes) total += s.power * (s.hits ?? 1);
    return total * stats.spellPower;
  }

  /**
   * "Tainted ×2 · 9s" — magnitude and lifetime, both of which an application
   * may state or leave to the condition's own defaults. A duration of `null`
   * on either means the thing waits for a removal rule instead of a clock.
   */
  function statusLine(apps: StatusApplication[] | undefined): string {
    return (apps ?? [])
      .map((a) => {
        const def = STATUSES[a.id];
        if (!def) return `⚠ ${a.id}`;
        const parts = [def.name];
        // Composed intensities are rarely round — the grip, depth and stack
        // dials all multiply into them.
        parts.push(`×${n(a.intensity ?? 1)}`);
        const life = a.duration ?? def.duration;
        if (life === 'permanent' || life === null) parts.push('· until removed');
        else parts.push(`· ${n(life / TPS)}s`);
        if (a.chance !== undefined && a.chance < 1) parts.push(`(${Math.round(a.chance * 100)}%)`);
        return parts.join(' ');
      })
      .join(', ');
  }

  const rows = $derived(
    rotation.map((entry, index) => {
      if (entry.cast) {
        const spec = specForSource(entry.cast);
        const damage = castDamage(spec);
        const seconds = spec.cooldown / TPS;
        return {
          index,
          kind: 'cast' as const,
          icon: spec.icon,
          name: spec.name,
          sentence: sentenceOf(entry.cast),
          // A sentence the composer could not read falls back to FADED, which
          // is the forge's cue that a word id is wrong — monsters never go
          // through checkSentence, so nothing else would have told you.
          // A counterspell does none of those things on its own turn — it
          // springs inside YOUR casting instead (ARCANE.md §14) — so it is
          // read, not faded.
          faded: spec.strikes.length === 0 && !spec.heal && !spec.grants?.length && !spec.counter,
          trap: !!spec.counter,
          damage,
          perSecond: seconds > 0 ? damage / seconds : damage,
          seconds,
          // Each school spends its own pool — arcane mana, psionic focus —
          // and a column headed "mana" reading '—' on a shape that plainly
          // costs something looks like a bug rather than a different purse.
          cost: spec.manaCost || spec.focusCost || 0,
          pool: spec.manaCost ? 'mana' : spec.focusCost ? 'focus' : '',
          inflicts: [
            ...spec.strikes.flatMap((s) => s.inflicts ?? []),
            ...(spec.afflicts ?? []),
          ],
          heal: spec.heal ?? 0,
        };
      }
      // A technique swings the monster's ARM, so its damage comes off `damage`
      // rather than `spellPower` — the cooldown lives on the move, not the def.
      const tech = TECHNIQUES[entry.technique ?? ''];
      const seconds = (tech?.move.cooldown ?? 0) / TPS;
      const damage = (tech?.move.damageMult ?? 0) * stats.damage;
      return {
        index,
        kind: 'technique' as const,
        icon: tech?.icon ?? '⚠',
        name: tech?.name ?? `⚠ ${entry.technique}`,
        sentence: '',
        faded: !tech,
        damage,
        perSecond: seconds > 0 ? damage / seconds : damage,
        seconds,
        cost: 0,
        pool: '',
        inflicts: [],
        heal: 0,
      };
    }),
  );

  const n = (v: number, places = 1) => (Math.round(v * 10 ** places) / 10 ** places).toString();
  /** Ticks between swings, from the bar fill rate — the basic attack's cadence. */
  const swing = $derived(stats.speed > 0 ? MONSTER_ACTION_BAR / stats.speed / TPS : 0);
</script>

<div class="preview">
  <div class="phead">
    <b>Field test</b>
    <label>
      level
      <input type="range" min="1" max="60" bind:value={level} />
      <span class="mono lv">{level}</span>
    </label>
    <label title="what the classification axes multiply a specimen by — elite, tier">
      ×
      <input class="mono mult" type="number" min="0.1" step="0.1" bind:value={statMult} />
    </label>
  </div>

  <div class="stats mono">
    <span><i>hp</i> {n(stats.maxHp, 0)}</span>
    <span><i>damage</i> {n(stats.damage)}</span>
    <span title="1.5 + INT × 1.1 — every strike's power is multiplied by this">
      <i>spell</i> {n(stats.spellPower)}
    </span>
    <span title="seconds between actions"><i>swing</i> {n(swing, 2)}s</span>
    <span><i>dodge</i> {n(stats.dodge * 100)}%</span>
  </div>

  {#if rows.length === 0}
    <div class="empty">No rotation — this one only swings.</div>
  {:else}
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>working</th>
          <th class="num" title="expected damage per use, before the player's armor and resistances">
            hit
          </th>
          <th class="num" title="that damage spread over its own cooldown">/s</th>
          <th class="num">cd</th>
          <th class="num" title="monsters never pay for a working — this is what it would cost the PLAYER">
            cost
          </th>
        </tr>
      </thead>
      <tbody>
        {#each rows as r (r.index)}
          <tr class:faded={r.faded}>
            <td class="mono dim">{r.index}</td>
            <td>
              <span class="ico">{r.icon}</span>
              {r.name}
              {#if r.sentence}<code class="say">“{r.sentence}”</code>{/if}
              {#if r.faded}<span class="warn">unreadable — check the ids</span>{/if}
              {#if 'trap' in r && r.trap}<span class="tag">🪤 counterspell — springs on your casting</span>{/if}
              {#if r.heal}<span class="tag">heals {n(r.heal * stats.spellPower)}</span>{/if}
              {#if r.inflicts.length}<span class="tag">{statusLine(r.inflicts)}</span>{/if}
            </td>
            <td class="num mono">{r.damage ? n(r.damage) : '—'}</td>
            <td class="num mono">{r.damage ? n(r.perSecond) : '—'}</td>
            <td class="num mono">{n(r.seconds)}s</td>
            <td class="num mono dim" title={r.pool}>{r.cost ? n(r.cost) : '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <div class="foot">
      Damage is pre-mitigation, and the roll varies ±10%. Entries are read
      top-down and the first one ready fires, so a short cooldown high in the
      list starves everything under it.
    </div>
  {/if}
</div>

<style>
  .preview {
    border: 1px solid var(--line);
    border-radius: 6px;
    margin: 10px 0;
    padding: 8px 10px 6px;
    background: var(--panel-2, transparent);
  }

  .phead {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
  }

  .phead label {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--dim);
  }

  .phead input[type='range'] {
    width: 130px;
  }

  .lv {
    min-width: 18px;
    color: var(--text);
  }

  .mult {
    width: 52px;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    font-size: 11.5px;
    margin: 6px 0 2px;
  }

  .stats i {
    font-style: normal;
    color: var(--dimmer);
    margin-right: 3px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
    margin-top: 4px;
  }

  th {
    text-align: left;
    font-weight: 500;
    color: var(--dimmer);
    border-bottom: 1px solid var(--line);
    padding: 2px 4px;
  }

  td {
    padding: 3px 4px;
    border-bottom: 1px solid var(--line-soft, transparent);
    vertical-align: top;
  }

  .num {
    text-align: right;
    white-space: nowrap;
  }

  tr.faded td {
    opacity: 0.6;
  }

  .say {
    color: var(--dim);
    margin-left: 4px;
  }

  .tag {
    color: var(--dimmer);
    font-size: 10.5px;
    margin-left: 6px;
  }

  .warn {
    color: var(--bad);
    margin-left: 6px;
    font-size: 10.5px;
  }

  .ico {
    margin-right: 2px;
  }

  .empty,
  .foot {
    color: var(--dimmer);
    font-size: 11px;
    margin-top: 5px;
    line-height: 1.35;
  }
</style>
