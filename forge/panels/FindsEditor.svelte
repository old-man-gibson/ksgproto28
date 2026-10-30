<script lang="ts">
  /**
   * A spot's finds laid out along its exploration as a threshold track.
   *
   * `at` is a SHARE of exploreTicks, not a tick count, which is the one thing
   * that is impossible to feel while reading numbers in a data file — so this
   * drags them along a 0→100% bar and prints the tick each one lands on. The
   * payload fields are not a union (one find is "a pouch — 12 gold and a key"),
   * so every one of them is an independent toggle rather than a mode switch.
   */
  import { store } from '../lib/store.svelte';
  import RefPicker from '../lib/RefPicker.svelte';
  import TagInput from '../lib/TagInput.svelte';
  import type { SpotDef, SpotFind, UnlockCondition } from '../../src/core/types';

  interface Props {
    spotId: string;
  }
  let { spotId }: Props = $props();

  const spot = $derived(store.get<SpotDef>('spot', spotId));
  const finds = $derived(spot?.finds ?? []);
  const exploreTicks = $derived(spot?.exploreTicks ?? 0);
  const hiddenOut = $derived((spot?.connections ?? []).filter((c) => c.hidden));

  let open = $state<string | null>(null);
  let trackEl = $state<HTMLDivElement | undefined>();
  let dragId = $state<string | null>(null);
  /** Distinguishes a drag from a click on release; never rendered. */
  let moved = false;

  $effect(() => {
    if (spotId) open = null;
  });

  /** Tags any skill claims — a tag nobody claims trains nothing at all. */
  const claimedTags = $derived.by(() => {
    const tags = new Set<string>();
    for (const s of store.list<{ tags?: string[] }>('skill')) for (const t of s.tags ?? []) tags.add(t);
    return tags;
  });

  const dupIds = $derived.by(() => {
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const f of finds) (seen.has(f.id) ? dup : seen).add(f.id);
    return dup;
  });

  const sharedAt = $derived.by(() => {
    const count = new Map<number, number>();
    for (const f of finds) count.set(f.at, (count.get(f.at) ?? 0) + 1);
    return count;
  });

  const round2 = (v: number) => Math.round(v * 100) / 100;

  const ATTRS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  /** The UnlockCondition variants, with the field each one carries. */
  const CONDITION_KINDS = [
    { type: 'skill', label: 'skill level' },
    { type: 'attr', label: 'attribute level' },
    { type: 'stat', label: 'counter at least' },
    { type: 'statMax', label: 'counter at most' },
    { type: 'equippedTag', label: 'equipped tag' },
    { type: 'quest', label: 'quest completed' },
    { type: 'boon', label: 'prestige boon owned' },
  ];

  /** A correctly shaped condition for the chosen variant — never a half one. */
  function blankCondition(type: string): UnlockCondition {
    switch (type) {
      case 'attr':
        return { type: 'attr', attr: 'str', level: 10 };
      case 'stat':
        return { type: 'stat', key: '', value: 10 };
      case 'statMax':
        return { type: 'statMax', key: '', value: 1 };
      case 'equippedTag':
        return { type: 'equippedTag', tag: '' };
      case 'quest':
        return { type: 'quest', id: '' };
      case 'boon':
        return { type: 'boon', id: '' };
      default:
        return { type: 'skill', id: '', level: 5 };
    }
  }

  function yieldsNothing(f: SpotFind): boolean {
    return !(f.material || f.item || f.rune || f.gold || f.spot || f.path || f.skillXp || f.desc);
  }

  function put(fid: string, path: (string | number)[], value: unknown): void {
    store.set('spot', [spotId, 'finds', `#id=${fid}`, ...path], value);
  }

  function drop(fid: string, path: (string | number)[]): void {
    store.del('spot', [spotId, 'finds', `#id=${fid}`, ...path]);
  }

  /**
   * Blank number fields must never write NaN. `clearable` fields drop the key
   * instead; the rest keep their old value, because deleting one slot of
   * `gold: [min, max]` would splice the pair down to a single number.
   */
  function putNum(fid: string, path: (string | number)[], raw: string, clearable: boolean): void {
    const v = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(v)) {
      if (clearable) drop(fid, path);
      return;
    }
    put(fid, path, v);
  }

  function toggle(fid: string, key: string, on: boolean, blank: unknown): void {
    if (on) put(fid, [key], blank);
    else drop(fid, [key]);
  }

  function setAt(fid: string, at: number): void {
    put(fid, ['at'], Math.min(1, Math.max(0.01, round2(at))));
  }

  /** First free hundredth past the deepest find, so a new one lands alone. */
  function nextSlot(): number {
    if (finds.length === 0) return 0.25;
    const used = new Set(finds.map((f) => round2(f.at)));
    let v = Math.min(1, round2(Math.max(...finds.map((f) => f.at)) + 0.15));
    while (used.has(v) && v > 0.01) v = round2(v - 0.01);
    return v;
  }

  function addFind(): void {
    const taken = new Set(finds.map((f) => f.id));
    let n = finds.length + 1;
    while (taken.has(`find_${n}`)) n++;
    const fid = `find_${n}`;
    put(fid, [], { id: fid, at: nextSlot(), desc: '' });
    open = fid;
  }

  function removeFind(fid: string): void {
    drop(fid, []);
    if (open === fid) open = null;
  }

  function rename(f: SpotFind, next: string): void {
    const trimmed = next.trim();
    if (!trimmed || trimmed === f.id) return;
    put(f.id, ['id'], trimmed);
    if (open === f.id) open = trimmed;
  }

  // ---------- Dragging ----------

  function startDrag(ev: PointerEvent, fid: string): void {
    if (ev.button !== 0) return;
    ev.preventDefault();
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    dragId = fid;
    moved = false;
  }

  function onMove(ev: PointerEvent): void {
    if (!dragId || !trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    const next = Math.min(1, Math.max(0.01, round2((ev.clientX - rect.left) / Math.max(1, rect.width))));
    const current = finds.find((f) => f.id === dragId);
    if (!current || current.at === next) return;
    moved = true;
    put(dragId, ['at'], next);
  }

  function endDrag(): void {
    if (dragId && !moved) open = open === dragId ? null : dragId;
    dragId = null;
  }

  function onMarkerKey(ev: KeyboardEvent, f: SpotFind): void {
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      setAt(f.id, f.at + (ev.key === 'ArrowLeft' ? -0.01 : 0.01));
    } else if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      open = open === f.id ? null : f.id;
    }
  }

  function spotName(id: string): string {
    return store.get<SpotDef>('spot', id)?.name ?? id;
  }
</script>

<div class="finds">
  <div class="head">
    <span class="dim">{finds.length} find{finds.length === 1 ? '' : 's'}</span>
    {#if finds.length > 0 && !exploreTicks}
      <span class="pill bad">no exploreTicks</span>
    {/if}
    <span class="grow"></span>
    <button class="tiny" onclick={addFind}>+ find</button>
  </div>

  <div class="track" bind:this={trackEl}>
    {#each [0.25, 0.5, 0.75] as g (g)}
      <div class="grid" style="left: {g * 100}%"></div>
    {/each}
    {#each finds as f, i (i)}
      <button
        class="marker"
        class:lane2={i % 2 === 1}
        class:on={open === f.id}
        class:dragging={dragId === f.id}
        class:empty-payload={yieldsNothing(f)}
        style="left: {Math.min(1, Math.max(0, f.at)) * 100}%"
        title="{f.id} — {Math.round(f.at * 100)}%"
        aria-label="Find {f.id} at {Math.round(f.at * 100)} percent"
        onpointerdown={(ev) => startDrag(ev, f.id)}
        onpointermove={onMove}
        onpointerup={endDrag}
        onpointercancel={() => (dragId = null)}
        onkeydown={(ev) => onMarkerKey(ev, f)}
      >
        <span class="pin">◆</span>
        <span class="pct">{Math.round(f.at * 100)}%</span>
      </button>
    {/each}
  </div>
  <div class="ruler">
    <span>0%</span><span class="grow"></span><span>50%</span><span class="grow"></span>
    <span>100%{exploreTicks ? ` · ${exploreTicks}t` : ''}</span>
  </div>

  {#if finds.length === 0}
    <div class="empty">Nothing to find here yet.</div>
  {/if}

  {#each finds as f, i (i)}
    {#if open === f.id}
      {@const base = ['spot', spotId, 'finds', `#id=${f.id}`]}
      <div class="card find-card">
        <div class="row">
          <div class="field grow">
            <label for="find-id-{i}">id</label>
            <input
              id="find-id-{i}"
              class="mono"
              value={f.id}
              spellcheck="false"
              onchange={(ev) => rename(f, ev.currentTarget.value)}
            />
          </div>
          <div class="field pctfield">
            <label for="find-at-{i}">at %</label>
            <input
              id="find-at-{i}"
              type="number"
              min="1"
              max="100"
              step="1"
              value={Math.round(f.at * 100)}
              onchange={(ev) => {
                const v = Number(ev.currentTarget.value);
                if (!Number.isFinite(v)) return;
                if (v < 1 || v > 100) {
                  const clamped = Math.min(100, Math.max(1, Math.round(v)));
                  store.say(`at is a share of the search, 1–100% — ${v}% clamped to ${clamped}%`, 'warn');
                }
                setAt(f.id, v / 100);
              }}
            />
          </div>
          <button class="tiny danger" onclick={() => removeFind(f.id)} title="Delete find">✕</button>
        </div>

        <div class="notes">
          <span class="dim">
            {exploreTicks ? `fires at ${Math.round(f.at * exploreTicks)} of ${exploreTicks} ticks` : 'set exploreTicks on the spot to see this in ticks'}
          </span>
          {#if dupIds.has(f.id)}
            <span class="bad">⚠ another find here already uses this id</span>
          {/if}
          {#if (sharedAt.get(f.at) ?? 0) > 1}
            <span class="warn">⚠ shares {Math.round(f.at * 100)}% with another find — they stutter out one tick apart</span>
          {/if}
          {#if yieldsNothing(f)}
            <span class="bad">⚠ yields nothing at all — no payload and no log line</span>
          {/if}
        </div>

        <div class="opt">
          <label class="check">
            <input
              type="checkbox"
              checked={f.desc !== undefined}
              onchange={(ev) => toggle(f.id, 'desc', ev.currentTarget.checked, '')}
            />
            desc
          </label>
          {#if f.desc !== undefined}
            <textarea
              class="desc"
              value={f.desc}
              placeholder="The log line players read."
              onchange={(ev) => put(f.id, ['desc'], ev.currentTarget.value)}
            ></textarea>
          {/if}
        </div>

        <div class="opt">
          <label class="check">
            <input
              type="checkbox"
              checked={f.material !== undefined}
              onchange={(ev) => toggle(f.id, 'material', ev.currentTarget.checked, { id: '', qty: 1 })}
            />
            material
          </label>
          {#if f.material}
            <div class="row">
              <div class="grow">
                <RefPicker
                  kind="material"
                  value={f.material.id}
                  clearable={false}
                  onchange={(v) => put(f.id, ['material', 'id'], v ?? '')}
                />
              </div>
              <input
                class="num"
                type="number"
                min="1"
                placeholder="1"
                value={f.material.qty ?? ''}
                onchange={(ev) =>
                  putNum(f.id, ['material', 'qty'], ev.currentTarget.value, f.material?.qty !== undefined)}
              />
            </div>
          {/if}
        </div>

        <div class="opt">
          <label class="check">
            <input
              type="checkbox"
              checked={f.item !== undefined}
              onchange={(ev) => toggle(f.id, 'item', ev.currentTarget.checked, '')}
            />
            item
          </label>
          {#if f.item !== undefined}
            <RefPicker kind="item" value={f.item} clearable={false} onchange={(v) => put(f.id, ['item'], v ?? '')} />
          {/if}
        </div>

        <div class="opt">
          <label class="check">
            <input
              type="checkbox"
              checked={f.rune !== undefined}
              onchange={(ev) => toggle(f.id, 'rune', ev.currentTarget.checked, '')}
            />
            rune
          </label>
          {#if f.rune !== undefined}
            <RefPicker kind="rune" value={f.rune} clearable={false} onchange={(v) => put(f.id, ['rune'], v ?? '')} />
          {/if}
        </div>

        <div class="opt">
          <label class="check">
            <input
              type="checkbox"
              checked={f.gold !== undefined}
              onchange={(ev) => toggle(f.id, 'gold', ev.currentTarget.checked, [1, 5])}
            />
            gold
          </label>
          {#if f.gold}
            <div class="row">
              <input
                class="num"
                type="number"
                min="0"
                value={f.gold[0] ?? ''}
                onchange={(ev) => putNum(f.id, ['gold', 0], ev.currentTarget.value, false)}
              />
              <span class="dim">to</span>
              <input
                class="num"
                type="number"
                min="0"
                value={f.gold[1] ?? ''}
                onchange={(ev) => putNum(f.id, ['gold', 1], ev.currentTarget.value, false)}
              />
              <span class="hint">inclusive roll</span>
            </div>
          {/if}
        </div>

        <div class="opt">
          <label class="check">
            <input
              type="checkbox"
              checked={f.spot !== undefined}
              onchange={(ev) => toggle(f.id, 'spot', ev.currentTarget.checked, '')}
            />
            spot rumor
          </label>
          {#if f.spot !== undefined}
            <RefPicker
              kind="spot"
              value={f.spot}
              clearable={false}
              filter={(def) => def.id !== spotId}
              onchange={(v) => put(f.id, ['spot'], v ?? '')}
            />
          {/if}
        </div>

        <div class="opt">
          <label class="check">
            <input
              type="checkbox"
              disabled={hiddenOut.length === 0 && f.path === undefined}
              checked={f.path !== undefined}
              onchange={(ev) => toggle(f.id, 'path', ev.currentTarget.checked, hiddenOut[0]?.to ?? '')}
            />
            path
          </label>
          {#if hiddenOut.length === 0}
            <div class="hint bad">
              No hidden connection leaves this spot, so there is nothing for a find to open.
            </div>
          {:else if f.path !== undefined}
            <select value={f.path} onchange={(ev) => put(f.id, ['path'], ev.currentTarget.value)}>
              {#each hiddenOut as c, ci (ci)}
                <option value={c.to}>{spotName(c.to)}</option>
              {/each}
              {#if !hiddenOut.some((c) => c.to === f.path)}
                <option value={f.path}>{f.path} — not a hidden edge here</option>
              {/if}
            </select>
          {/if}
        </div>

        <div class="opt">
          <label class="check">
            <input
              type="checkbox"
              checked={f.skillXp !== undefined}
              onchange={(ev) => toggle(f.id, 'skillXp', ev.currentTarget.checked, { tags: [], xp: 10 })}
            />
            skillXp
          </label>
          {#if f.skillXp}
            <TagInput
              values={f.skillXp.tags ?? []}
              suggestions={[...claimedTags]}
              placeholder="skill tag…"
              isValid={(t) => claimedTags.has(t)}
              onchange={(next) => put(f.id, ['skillXp', 'tags'], next)}
            />
            <div class="row">
              <span class="hint grow">tags, not skill ids — a tag no skill claims trains nothing</span>
              <input
                class="num"
                type="number"
                min="1"
                value={f.skillXp.xp ?? ''}
                onchange={(ev) => putNum(f.id, ['skillXp', 'xp'], ev.currentTarget.value, false)}
              />
            </div>
          {/if}
        </div>

        <!--
          `requires` gates the find on preparation rather than on depth. Unmet,
          it waits — unclaimed and unlogged — so listing the conditions here is
          the only way to see WHY a find never turned up.
        -->
        <div class="opt">
          <label class="check">
            <input
              type="checkbox"
              checked={f.requires !== undefined}
              onchange={(ev) =>
                toggle(f.id, 'requires', ev.currentTarget.checked, [
                  { type: 'skill', id: '', level: 5 },
                ])}
            />
            requires
          </label>
          {#if f.requires}
            {#each f.requires as cond, i (i)}
              <div class="row cond">
                <select
                  class="kind"
                  value={cond.type}
                  onchange={(ev) => put(f.id, ['requires', i], blankCondition(ev.currentTarget.value))}
                >
                  {#each CONDITION_KINDS as k (k.type)}<option value={k.type}>{k.label}</option>{/each}
                </select>
                {#if cond.type === 'skill' || cond.type === 'quest'}
                  <div class="grow">
                    <RefPicker
                      kind={cond.type === 'skill' ? 'skill' : 'quest'}
                      value={cond.id}
                      onchange={(v) => put(f.id, ['requires', i, 'id'], v ?? '')}
                    />
                  </div>
                {:else if cond.type === 'attr'}
                  <select
                    class="grow"
                    value={cond.attr}
                    onchange={(ev) => put(f.id, ['requires', i, 'attr'], ev.currentTarget.value)}
                  >
                    {#each ATTRS as a (a)}<option value={a}>{a}</option>{/each}
                  </select>
                {:else if cond.type === 'equippedTag'}
                  <input
                    class="grow"
                    value={cond.tag}
                    placeholder="equipped tag…"
                    onchange={(ev) => put(f.id, ['requires', i, 'tag'], ev.currentTarget.value)}
                  />
                {:else if cond.type === 'boon'}
                  <input
                    class="grow"
                    value={cond.id}
                    placeholder="prestige boon id…"
                    onchange={(ev) => put(f.id, ['requires', i, 'id'], ev.currentTarget.value)}
                  />
                {:else}
                  <input
                    class="grow"
                    value={cond.key}
                    placeholder="counter key…"
                    onchange={(ev) => put(f.id, ['requires', i, 'key'], ev.currentTarget.value)}
                  />
                {/if}
                {#if cond.type !== 'equippedTag' && cond.type !== 'quest' && cond.type !== 'boon'}
                  <input
                    class="num"
                    type="number"
                    value={cond.type === 'skill' || cond.type === 'attr' ? cond.level : cond.value}
                    onchange={(ev) =>
                      putNum(
                        f.id,
                        ['requires', i, cond.type === 'skill' || cond.type === 'attr' ? 'level' : 'value'],
                        ev.currentTarget.value,
                        false,
                      )}
                  />
                {/if}
                <button class="kill" title="remove" onclick={() => drop(f.id, ['requires', i])}>✕</button>
              </div>
            {/each}
            <div class="row">
              <span class="hint grow">all must hold; unmet, the find waits rather than being skipped</span>
              <button
                class="tiny"
                onclick={() => put(f.id, ['requires', (f.requires ?? []).length], { type: 'skill', id: '', level: 5 })}
              >
                ＋ condition
              </button>
            </div>
          {/if}
        </div>

        <code class="path dim">{base.join(' › ')}</code>
      </div>
    {/if}
  {/each}
</div>

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .track {
    position: relative;
    height: 46px;
    margin: 8px 0 2px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: linear-gradient(90deg, #10151f, #1b2438);
    touch-action: none;
  }

  .grid {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--border);
  }

  .marker {
    position: absolute;
    top: 3px;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    padding: 1px 3px;
    background: transparent;
    border: none;
    border-radius: 5px;
    cursor: ew-resize;
    color: var(--find);
    line-height: 1.05;
  }

  .marker.lane2 {
    top: 22px;
  }

  .marker:hover:not(:disabled),
  .marker.on {
    background: rgba(251, 191, 36, 0.14);
    border-color: transparent;
  }

  .marker.on .pin {
    text-shadow: 0 0 6px var(--find);
  }

  .marker.dragging {
    cursor: grabbing;
  }

  .marker.empty-payload {
    color: var(--bad);
  }

  .pin {
    font-size: 13px;
  }

  .pct {
    font-size: 9.5px;
    color: var(--dim);
    font-family: var(--mono);
  }

  .ruler {
    display: flex;
    font-size: 10px;
    color: var(--dimmer);
    font-family: var(--mono);
    margin-bottom: 8px;
  }

  .find-card {
    padding: 10px;
    margin-bottom: 8px;
    background: var(--bg);
  }

  .notes {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11px;
    line-height: 1.35;
    margin: 4px 0 8px;
  }

  .notes .bad {
    color: var(--bad);
  }

  .notes .warn {
    color: var(--warn);
  }

  .opt {
    border-top: 1px solid var(--border);
    padding: 6px 0 4px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--dim);
    cursor: pointer;
  }

  .num {
    width: 74px;
    flex: none;
  }

  /*
   * A condition row is [kind ▾][what ▾][level][✕]. The global `select` rule
   * says width: 100%, which as a flex basis is THE WHOLE ROW — the kind
   * dropdown hogged it and crushed the skill/attribute picker beside it (a
   * `.grow`, whose basis is 0) down to a sliver. The kind select sizes to its
   * longest label instead, the picker gets a real minimum, and a pane too
   * narrow for both wraps the picker onto its own line rather than starving it.
   */
  .cond {
    flex-wrap: wrap;
  }

  .cond .kind {
    flex: 0 0 auto;
    width: auto;
  }

  .cond .grow {
    min-width: 150px;
  }

  .pctfield {
    width: 76px;
  }

  .desc {
    min-height: 44px;
    font-size: 12.5px;
  }

  .hint {
    font-size: 11px;
    color: var(--dimmer);
    line-height: 1.35;
  }

  .hint.bad {
    color: var(--bad);
  }

  .path {
    display: block;
    margin-top: 8px;
    font-size: 10.5px;
    opacity: 0.65;
    overflow-wrap: anywhere;
  }
</style>
