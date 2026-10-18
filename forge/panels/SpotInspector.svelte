<script lang="ts">
  /**
   * Everything about one spot, in the order you need it: what it is, where it
   * sits, what it hands over, and what reaches it.
   *
   * The incoming-connection list is read-only on purpose — it exists because the
   * map draws DECLARED edges only, so "who points at me" is the one question the
   * canvas cannot answer at a glance, and the answer is what makes deleting a
   * spot dangerous.
   */
  import { store } from '../lib/store.svelte';
  import { idProblem, validate } from '../lib/validate';
  import { requestRename } from '../lib/rename';
  import Field from '../lib/Field.svelte';
  import RefPicker from '../lib/RefPicker.svelte';
  import TagInput from '../lib/TagInput.svelte';
  import FindsEditor from './FindsEditor.svelte';
  import type { Selection } from '../lib/selection';
  import type { ActivityDef, AttributeId, Connection, NpcDef, SpotDef } from '../../src/core/types';

  interface Props {
    id: string;
    onselect: (s: Selection) => void;
  }
  let { id, onselect }: Props = $props();

  /** Kinds you can place by hand — `craft` is synthesized from `recipes`. */
  const KINDS = ['train', 'hunt', 'rest', 'explore', 'search', 'gather', 'job'] as const;
  type PlaceableKind = (typeof KINDS)[number];
  const ATTRS: AttributeId[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  /** One table serving three schools: legal furniture that resolves to no discipline. */
  const SPECIAL_BENCHES = ['spelltable'];

  const spot = $derived(store.get<SpotDef>('spot', id));
  const activities = $derived(spot?.activities ?? []);
  const encounters = $derived(spot?.encounters ?? []);
  const connections = $derived(spot?.connections ?? []);
  const npcsHere = $derived(store.list<NpcDef>('npc').filter((n) => n.spotId === id));
  const issues = $derived(
    validate(store).filter((i) => i.subject.kind === 'spot' && i.subject.id === id),
  );

  const incoming = $derived.by(() => {
    const rows: { from: SpotDef; conn: Connection }[] = [];
    for (const s of Object.values(store.all<SpotDef>('spot'))) {
      if (s.id === id) continue;
      for (const c of s.connections ?? []) if (c.to === id) rows.push({ from: s, conn: c });
    }
    return rows;
  });

  const benchSuggestions = $derived(
    [...Object.keys(store.all('discipline')), ...SPECIAL_BENCHES].sort(),
  );

  let newKind = $state<PlaceableKind>('gather');
  let confirming = $state(false);
  // The id field edits an OVERLAY (null = showing the real id): validation
  // runs on every keystroke, but the rename itself only fires on commit
  // (blur/Enter), because half an id is always invalid.
  let idEdit = $state<string | null>(null);
  $effect(() => {
    // Neither a pending delete confirmation nor a half-typed rename must
    // survive a jump to another spot.
    if (id) {
      confirming = false;
      idEdit = null;
    }
  });
  const idIssue = $derived(
    idEdit === null || idEdit.trim() === id ? null : idProblem(store, 'spot', idEdit.trim()),
  );

  function renameSpot(): void {
    if (idEdit === null) return;
    const next = requestRename('spot', id, idEdit);
    if (next) onselect({ type: 'spot', id: next });
  }

  /** Markup keeps away from generic calls — `store.get<T>` confuses the parser there. */
  function spotOf(sid: string): SpotDef | undefined {
    return store.get<SpotDef>('spot', sid);
  }

  function set(path: (string | number)[], value: unknown): void {
    store.set('spot', [id, ...path], value);
  }

  function del(path: (string | number)[]): void {
    store.del('spot', [id, ...path]);
  }

  /** Blank number fields clear the key rather than writing NaN into the data. */
  function setNum(path: (string | number)[], raw: string, present: boolean): void {
    const v = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(v)) {
      if (present) del(path);
      return;
    }
    set(path, v);
  }

  function setCoord(axis: 'x' | 'y', raw: string): void {
    const v = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(v)) return;
    const max = axis === 'x' ? 100 : 75;
    const clamped = Math.min(max, Math.max(0, v));
    if (clamped !== v) store.say(`${axis} clamped to 0–${max} — the map canvas ends there`, 'warn');
    set(['map'], { ...(spot?.map ?? { x: 50, y: 37 }), [axis]: clamped });
  }

  function setList(key: 'benches' | 'recipes', next: string[]): void {
    if (next.length) set([key], next);
    else if (spot?.[key]) del([key]);
  }

  // ---------- Activities ----------

  function blankActivity(kind: PlaceableKind, actId: string): ActivityDef {
    switch (kind) {
      case 'train':
        return { id: actId, kind: 'train', attr: 'str', name: 'Train', icon: '💪' };
      case 'hunt':
        return { id: actId, kind: 'hunt', name: 'Hunt', icon: '🗡️' };
      case 'rest':
        return { id: actId, kind: 'rest', name: 'Rest', icon: '🔥' };
      case 'explore':
        return { id: actId, kind: 'explore', name: 'Explore', icon: '🔍' };
      case 'search':
        return { id: actId, kind: 'search', name: 'Search', icon: '🔎', ticksPer: 50, rewards: [{ id: 'coins', weight: 1, gold: [1, 3] }] };
      case 'gather':
        return { id: actId, kind: 'gather', material: '', ticksPer: 20, name: 'Gather', icon: '🧺' };
      case 'job':
        return { id: actId, kind: 'job', gold: 5, ticksPer: 20, name: 'Work', icon: '💰' };
    }
  }

  function addActivity(): void {
    const taken = new Set(activities.map((a) => a.id));
    let actId = `${id}_${newKind}`;
    let n = 2;
    while (taken.has(actId)) actId = `${id}_${newKind}_${n++}`;
    set(['activities', `#id=${actId}`], blankActivity(newKind, actId));
  }

  function setAct(actId: string, key: string, value: unknown): void {
    set(['activities', `#id=${actId}`, key], value);
  }

  function setSearchRewards(actId: string, raw: string): void {
    try {
      const rewards: unknown = JSON.parse(raw);
      if (!Array.isArray(rewards) || rewards.some((r) => !r || typeof r !== 'object' || !r.id || !(r.weight > 0))) throw new Error('Use an array of rewards, each with an id and positive weight.');
      setAct(actId, 'rewards', rewards);
    } catch (error) {
      store.say(`Search rewards: ${error instanceof Error ? error.message : 'invalid JSON'}`, 'warn');
    }
  }

  function setActNum(actId: string, key: string, raw: string): void {
    const v = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(v)) return;
    setAct(actId, key, v);
  }

  // ---------- Deletion ----------

  function removeSpot(): void {
    store.del('spot', [id]);
    onselect(null);
    store.say(`Deleted ${id} — check the issue list for anything left pointing at it`, 'warn');
  }
</script>

{#if !spot}
  <div class="empty">No spot called <code>{id}</code> — it may have just been deleted.</div>
{:else}
  <div class="head">
    <span class="big">{spot.icon || '📍'}</span>
    <div class="grow">
      <div class="title">{spot.name || id}</div>
      <code class="dim">{id}</code>
    </div>
  </div>

  {#if issues.length}
    <div class="issues">
      {#each issues as issue, i (i)}
        <div class="issue {issue.severity}">
          <span>{issue.severity === 'error' ? '⛔' : '⚠'}</span>
          <span class="grow">{issue.message}</span>
        </div>
      {/each}
    </div>
  {/if}

  <div class="section">Identity</div>

  <Field
    label="id"
    problem={idIssue}
    hint="Rename moves every reference with it — staged, review the diff before applying."
  >
    <input
      class="mono"
      spellcheck="false"
      value={idEdit ?? id}
      oninput={(ev) => (idEdit = ev.currentTarget.value)}
      onchange={renameSpot}
    />
  </Field>

  <div class="row">
    <div class="grow">
      <Field label="name">
        <input value={spot.name ?? ''} onchange={(ev) => set(['name'], ev.currentTarget.value)} />
      </Field>
    </div>
    <Field label="icon">
      <input
        class="icon-input"
        value={spot.icon ?? ''}
        maxlength="4"
        onchange={(ev) => set(['icon'], ev.currentTarget.value)}
      />
    </Field>
  </div>

  <Field label="area" problem={store.get('area', spot.areaId) ? null : `no area '${spot.areaId}'`}>
    <RefPicker
      kind="area"
      value={spot.areaId}
      clearable={false}
      onchange={(v) => set(['areaId'], v ?? '')}
    />
  </Field>

  <Field label="desc">
    <textarea value={spot.desc ?? ''} onchange={(ev) => set(['desc'], ev.currentTarget.value)}></textarea>
  </Field>

  <label class="check">
    <input
      type="checkbox"
      checked={!!spot.waypoint}
      onchange={(ev) => (ev.currentTarget.checked ? set(['waypoint'], true) : del(['waypoint']))}
    />
    waypoint — fast-travel hub
  </label>

  <label class="check">
    <input
      type="checkbox"
      checked={!!spot.forced}
      onchange={(ev) => (ev.currentTarget.checked ? set(['forced'], true) : del(['forced']))}
    />
    forced — arriving starts a fight with no way out (needs encounters)
  </label>

  <Field
    label="fightLimit"
    hint="Wins before the spot is CLEARED: hunts find nothing, forced stops forcing. Blank = endless."
  >
    <input
      type="number"
      min="1"
      value={spot.fightLimit ?? ''}
      onchange={(ev) => {
        const raw = ev.currentTarget.value.trim();
        const v = Number(raw);
        if (raw === '' || !Number.isFinite(v) || v <= 0) del(['fightLimit']);
        else set(['fightLimit'], v);
      }}
    />
  </Field>

  <div class="section">Position</div>

  <div class="row">
    <div class="grow">
      <Field label="x" problem={(spot.map?.x ?? 0) < 0 || (spot.map?.x ?? 0) > 100 ? 'outside 0–100' : null}>
        <input
          type="number"
          step="0.5"
          value={spot.map?.x ?? ''}
          onchange={(ev) => setCoord('x', ev.currentTarget.value)}
        />
      </Field>
    </div>
    <div class="grow">
      <Field label="y" problem={(spot.map?.y ?? 0) < 0 || (spot.map?.y ?? 0) > 75 ? 'outside 0–75' : null}>
        <input
          type="number"
          step="0.5"
          value={spot.map?.y ?? ''}
          onchange={(ev) => setCoord('y', ev.currentTarget.value)}
        />
      </Field>
    </div>
  </div>

  <div class="section">Exploration</div>

  <Field label="exploreTicks" hint="Ticks of combing for 100%. Every find's depth is a share of this.">
    <input
      type="number"
      min="0"
      value={spot.exploreTicks ?? ''}
      onchange={(ev) => setNum(['exploreTicks'], ev.currentTarget.value, spot?.exploreTicks !== undefined)}
    />
  </Field>

  <FindsEditor spotId={id} />

  <div class="section">Activities</div>

  {#if activities.length === 0}
    <div class="empty">Nothing to do here.</div>
  {/if}
  {#each activities as act, i (i)}
    <div class="line">
      <input
        class="icon-cell"
        value={act.icon ?? ''}
        maxlength="4"
        aria-label="Activity icon"
        onchange={(ev) => setAct(act.id, 'icon', ev.currentTarget.value)}
      />
      <input
        class="grow"
        value={act.name ?? ''}
        aria-label="Activity name"
        onchange={(ev) => setAct(act.id, 'name', ev.currentTarget.value)}
      />
      <span class="pill">{act.kind}</span>
      <button class="tiny danger" title="Remove activity" onclick={() => del(['activities', `#id=${act.id}`])}>
        ✕
      </button>
    </div>
    {#if act.kind === 'search'}
      <label class="line sub">Ticks per search
        <input type="number" min="1" value={act.ticksPer} onchange={(ev) => setActNum(act.id, 'ticksPer', ev.currentTarget.value)} />
      </label>
      <label class="line sub">Reward table (JSON)
        <textarea aria-label="Search reward table" rows="8" value={JSON.stringify(act.rewards, null, 2)} onchange={(ev) => setSearchRewards(act.id, ev.currentTarget.value)}></textarea>
      </label>
      <p class="dim small">Each reward has id and weight; optional limit caps awards per run, guaranteedBy prevents long droughts. Payload: gold, material, item, rune, keyItem, skillXp or stat.</p>
    {:else if act.kind === 'gather'}
      <div class="line sub">
        <span class="lbl">material</span>
        <div class="grow">
          <RefPicker
            kind="material"
            value={act.material}
            clearable={false}
            onchange={(v) => setAct(act.id, 'material', v ?? '')}
          />
        </div>
        <span class="lbl">every</span>
        <input
          class="num"
          type="number"
          min="1"
          aria-label="Ticks per gather"
          value={act.ticksPer ?? ''}
          onchange={(ev) => setActNum(act.id, 'ticksPer', ev.currentTarget.value)}
        />
      </div>
    {:else if act.kind === 'job'}
      <div class="line sub">
        <span class="lbl">gold</span>
        <input
          class="num"
          type="number"
          min="0"
          aria-label="Gold per cycle"
          value={act.gold ?? ''}
          onchange={(ev) => setActNum(act.id, 'gold', ev.currentTarget.value)}
        />
        <span class="lbl">every</span>
        <input
          class="num"
          type="number"
          min="1"
          aria-label="Ticks per cycle"
          value={act.ticksPer ?? ''}
          onchange={(ev) => setActNum(act.id, 'ticksPer', ev.currentTarget.value)}
        />
        <span class="grow"></span>
      </div>
    {:else if act.kind === 'train'}
      <div class="line sub">
        <span class="lbl">attr</span>
        <select
          class="num"
          aria-label="Trained attribute"
          value={act.attr ?? ''}
          onchange={(ev) => ev.currentTarget.value && setAct(act.id, 'attr', ev.currentTarget.value)}
        >
          {#if !act.attr}<option value="">—</option>{/if}
          {#each ATTRS as a (a)}<option value={a}>{a}</option>{/each}
        </select>
        <span class="lbl grow">
          {act.attrXp ? 'also splits XP via attrXp (edit in the data file)' : ''}
        </span>
      </div>
    {/if}
  {/each}

  <div class="line add">
    <select bind:value={newKind} aria-label="Activity kind to add">
      {#each KINDS as k (k)}<option value={k}>{k}</option>{/each}
    </select>
    <button class="tiny" onclick={addActivity}>+ activity</button>
    <span class="grow"></span>
    <span class="hint">Deep tuning (factors, tags, attrXp) stays in the data file.</span>
  </div>

  <div class="section">Encounters</div>

  {#if encounters.length === 0}
    <div class="empty">Nothing spawns here.</div>
  {/if}
  {#each encounters as enc, i (i)}
    <div class="line">
      <div class="grow">
        <RefPicker
          kind="monster"
          value={enc.monsterId}
          clearable={false}
          onchange={(v) => set(['encounters', i, 'monsterId'], v ?? '')}
        />
      </div>
      <span class="lbl">w</span>
      <input
        class="tiny-num"
        type="number"
        min="0"
        aria-label="Spawn weight"
        value={enc.weight ?? ''}
        onchange={(ev) => setNum(['encounters', i, 'weight'], ev.currentTarget.value, false)}
      />
      <span class="lbl">lv</span>
      <input
        class="tiny-num"
        type="number"
        min="1"
        aria-label="Minimum level"
        value={enc.level?.[0] ?? ''}
        onchange={(ev) => setNum(['encounters', i, 'level', 0], ev.currentTarget.value, false)}
      />
      <input
        class="tiny-num"
        type="number"
        min="1"
        aria-label="Maximum level"
        value={enc.level?.[1] ?? ''}
        onchange={(ev) => setNum(['encounters', i, 'level', 1], ev.currentTarget.value, false)}
      />
      <button
        class="tiny"
        title={enc.once
          ? 'once — slain here one time, never rolled again (a find setting slain:* to 0 resurrects it). Click for endless.'
          : 'endless — rolls forever. Click to make it once-only.'}
        onclick={() =>
          enc.once ? del(['encounters', i, 'once']) : set(['encounters', i, 'once'], true)}
      >
        {enc.once ? '1×' : '∞'}
      </button>
      <button class="tiny danger" title="Remove encounter" onclick={() => del(['encounters', i])}>✕</button>
    </div>
  {/each}
  <div class="line add">
    <button
      class="tiny"
      onclick={() => set(['encounters', encounters.length], { monsterId: '', weight: 10, level: [1, 3] })}
    >
      + encounter
    </button>
  </div>

  <div class="section">Benches &amp; recipes</div>

  <Field label="benches" hint="Discipline ids, plus 'spelltable' — the one bench that is furniture.">
    <TagInput
      values={spot.benches ?? []}
      suggestions={benchSuggestions}
      placeholder="bench…"
      isValid={(v) => SPECIAL_BENCHES.includes(v) || !!store.get('discipline', v)}
      onchange={(next) => setList('benches', next)}
    />
  </Field>

  <Field label="recipes">
    <TagInput
      values={spot.recipes ?? []}
      suggestions={Object.keys(store.all('recipe'))}
      placeholder="recipe…"
      isValid={(v) => !!store.get('recipe', v)}
      onchange={(next) => setList('recipes', next)}
    />
  </Field>

  <div class="section">Connections</div>

  {#if connections.length === 0}
    <div class="empty">Declares no way out.</div>
  {/if}
  {#each connections as c, i (i)}
    <button class="edge" onclick={() => onselect({ type: 'edge', from: id, to: c.to })}>
      <span class="arrow">→</span>
      <span class="ico">{spotOf(c.to)?.icon ?? '❔'}</span>
      <span class="grow name" class:bad={!spotOf(c.to)}>{spotOf(c.to)?.name ?? c.to}</span>
      {#if c.oneWay}<span class="pill oneway">one-way</span>{/if}
      {#if c.hidden}<span class="pill hidden">hidden</span>{/if}
      <span class="ticks">{c.ticks ?? '—'}t</span>
    </button>
  {/each}

  <div class="section">Points here</div>

  {#if incoming.length === 0}
    <div class="empty">Nothing declares a way in.</div>
  {/if}
  {#each incoming as row, i (i)}
    <button class="edge in" onclick={() => onselect({ type: 'edge', from: row.from.id, to: id })}>
      <span class="arrow">←</span>
      <span class="ico">{row.from.icon || '📍'}</span>
      <span class="grow name">{row.from.name}</span>
      {#if row.conn.oneWay}<span class="pill oneway">one-way</span>{/if}
      {#if row.conn.hidden}<span class="pill hidden">hidden</span>{/if}
      <span class="ticks">{row.conn.ticks ?? '—'}t</span>
    </button>
  {/each}

  <div class="section">NPCs here</div>

  {#if npcsHere.length === 0}
    <div class="empty">Nobody stands here.</div>
  {/if}
  {#each npcsHere as npc (npc.id)}
    <button class="edge" onclick={() => onselect({ type: 'npc', id: npc.id })}>
      <span class="ico">{npc.icon || '🧑'}</span>
      <span class="grow name">{npc.name}</span>
      <code class="dim">{npc.id}</code>
    </button>
  {/each}

  <div class="section">Danger</div>

  {#if confirming}
    <div class="confirm">
      <div>
        Delete <b>{spot.name}</b>?
        {#if incoming.length}
          <span class="bad">
            {incoming.length} other spot{incoming.length === 1 ? '' : 's'} still point{incoming.length === 1 ? 's' : ''}
            at it — those connections become dangling refs the linter will flag.
          </span>
        {:else}
          Nothing points at it.
        {/if}
      </div>
      <div class="row">
        <button class="tiny" onclick={() => (confirming = false)}>Cancel</button>
        <button class="tiny danger" onclick={removeSpot}>Delete for real</button>
      </div>
    </div>
  {:else}
    <button class="danger wide" onclick={() => (confirming = true)}>Delete spot</button>
  {/if}
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .big {
    font-size: 26px;
    line-height: 1;
  }

  .title {
    font-size: 15px;
    font-weight: 600;
  }

  .issues {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 10px;
  }

  .issue {
    display: flex;
    gap: 7px;
    padding: 5px 9px;
    font-size: 11.5px;
    line-height: 1.35;
    background: var(--bg3);
  }

  .issue + .issue {
    border-top: 1px solid var(--border);
  }

  .issue.error {
    color: #ffc4c4;
  }

  .issue.warn {
    color: #f4dda4;
  }

  .icon-input {
    width: 62px;
    text-align: center;
    font-size: 20px;
    padding: 2px;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    color: var(--dim);
    cursor: pointer;
    margin: 2px 0 4px;
  }

  .line {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .line.sub {
    margin: -1px 0 7px 0;
    padding-left: 10px;
    border-left: 2px solid var(--border);
  }

  .line.add {
    margin: 4px 0 2px;
  }

  .icon-cell {
    width: 42px;
    text-align: center;
    flex: none;
  }

  .num {
    width: 78px;
    flex: none;
  }

  .tiny-num {
    width: 54px;
    flex: none;
    padding: 5px 4px;
    text-align: center;
  }

  .lbl {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--dimmer);
    white-space: nowrap;
  }

  .hint {
    font-size: 11px;
    color: var(--dimmer);
    text-align: right;
    line-height: 1.3;
  }

  .edge {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    text-align: left;
    padding: 5px 8px;
    margin-bottom: 3px;
    background: var(--bg3);
    font-size: 12.5px;
  }

  .edge.in {
    background: transparent;
    border-style: dashed;
  }

  .edge .arrow {
    color: var(--dimmer);
  }

  .edge .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .edge .name.bad {
    color: var(--bad);
  }

  .edge .ticks {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--dim);
  }

  .pill.oneway {
    color: var(--oneway);
    border-color: rgba(240, 168, 104, 0.4);
  }

  .pill.hidden {
    color: var(--hidden);
    border-color: rgba(167, 139, 250, 0.4);
  }

  .confirm {
    border: 1px solid var(--bad);
    border-radius: 8px;
    padding: 10px;
    font-size: 12px;
    line-height: 1.4;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .confirm .bad {
    color: var(--bad);
  }

  .wide {
    width: 100%;
  }
</style>
