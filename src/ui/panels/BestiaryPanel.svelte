<script lang="ts">
  import { gs } from '../state.svelte';
  import type { BestiaryFactDef, DropEntry, MonsterDef, MonsterTagCategory } from '../../core/types';
  import { DAMAGE_TYPE_NAMES, MONSTER_TAG_CATEGORIES, PHYSICAL_TYPES } from '../../core/types';
  import {
    AREAS,
    BESTIARY_FACTS,
    ITEMS,
    MATERIALS,
    MONSTERS,
    MONSTER_TAGS,
    RUNES,
    SPOTS,
    TIERS,
  } from '../../core/registry';
  import {
    bestiaryInsight,
    bestiaryProgress,
    COMMON_DROP_WEIGHT,
    dropChance,
    entryOf,
    factChance,
    groupByTaxon,
    habitatNeeded,
    isDiscovered,
    knowsFact,
    monsterProfile,
    monsterTags,
    queryMonsters,
    tagsInUse,
  } from '../../core/systems/bestiary';
  import { enemyArt } from '../lib/enemyArt';
  import TagPicker from '../lib/TagPicker.svelte';
  import { fmt, pct } from '../lib/format';

  let search = $state('');
  let selectedTags = $state<string[]>([]);
  let selectedId = $state<string | null>(null);
  let collapsed = $state(new Set<string>());

  const tagGroups = tagsInUse();
  // Only offer axes something in the book actually uses.
  const pickers = MONSTER_TAG_CATEGORIES.filter((c) => tagGroups[c.id]?.length).map((c) => ({
    ...c,
    options: tagGroups[c.id].map((id) => MONSTER_TAGS[id]),
  }));

  const progress = $derived(bestiaryProgress(gs));
  const insight = $derived(bestiaryInsight(gs));
  const filtering = $derived(selectedTags.length > 0 || search.trim().length > 0);

  // Filters and search only ever narrow what you KNOW — an undiscovered monster
  // would otherwise answer questions the book has not earned.
  const results = $derived(
    queryMonsters({ search, tags: selectedTags }).filter((def) => isDiscovered(gs, def.id)),
  );
  const shelves = $derived(groupByTaxon(results));
  const unknownCount = $derived(progress.total - progress.known);

  const selected = $derived(selectedId ? MONSTERS[selectedId] : null);
  const entry = $derived(selectedId ? entryOf(gs, selectedId) : undefined);

  // A search is a request to see the matches, so it overrides folded shelves.
  function isOpen(tag: string): boolean {
    return filtering || !collapsed.has(tag);
  }

  function toggleShelf(tag: string) {
    const next = new Set(collapsed);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    collapsed = next;
  }

  /** Swap one category's picks, leaving the other axes alone. */
  function setCategory(cat: MonsterTagCategory, next: string[]) {
    selectedTags = [
      ...selectedTags.filter((t) => MONSTER_TAGS[t]?.category !== cat),
      ...next,
    ];
  }

  function picked(cat: MonsterTagCategory): string[] {
    return selectedTags.filter((t) => MONSTER_TAGS[t]?.category === cat);
  }

  function clearFilters() {
    selectedTags = [];
    search = '';
  }

  function knows(factId: string): boolean {
    return selectedId ? knowsFact(gs, selectedId, factId) : false;
  }

  const fact = (id: string): BestiaryFactDef => BESTIARY_FACTS.find((f) => f.id === id)!;

  /** Locked-fact status line: what it takes to learn this. */
  function lockText(f: BestiaryFactDef): string {
    const kills = entry?.kills ?? 0;
    if (kills < f.minKills) return `Needs ${f.minKills} kills to even begin — ${kills}/${f.minKills}`;
    // Past the ceiling only happens when the book gains a new section after the
    // hunting is done; the next kill settles it.
    if (kills >= f.sureKills) return 'Certain on your next kill.';
    return `${pct(factChance(gs, f))} per kill · certain at ${f.sureKills} kills (${kills} so far)`;
  }

  function dropLabel(d: DropEntry): string {
    switch (d.kind) {
      case 'item':
        return `${ITEMS[d.id!]?.icon ?? '📦'} ${ITEMS[d.id!]?.name ?? d.id}`;
      case 'material':
        return `${MATERIALS[d.id!]?.icon ?? '🧩'} ${MATERIALS[d.id!]?.name ?? d.id}`;
      case 'rune':
        return `${RUNES[d.id!]?.icon ?? '🔷'} ${RUNES[d.id!]?.name ?? d.id}`;
      case 'gold':
        return `🪙 Gold ${d.qty ? `${d.qty[0]}–${d.qty[1]}` : ''}`;
      default:
        return '—';
    }
  }

  /** Drop rows for one half of the table, keeping the original indices. */
  function drops(def: MonsterDef, common: boolean) {
    return def.loot.entries
      .map((e, index) => ({ entry: e, index }))
      .filter(
        ({ entry: e }) =>
          e.kind !== 'nothing' &&
          (common ? e.weight >= COMMON_DROP_WEIGHT : e.weight < COMMON_DROP_WEIGHT),
      )
      .sort((a, b) => b.entry.weight - a.entry.weight);
  }

  function resistanceRows(def: MonsterDef) {
    return Object.entries(def.resistances ?? {})
      .filter(([, v]) => v !== 0)
      .sort((a, b) => b[1]! - a[1]!);
  }

  /**
   * Named quirks that sit alongside the numbers. Monsters have no ability
   * system yet, so these are read off the def; when real abilities land, this
   * is where they join their side of the sheet.
   */
  function offensiveAbilities(def: MonsterDef): { name: string; text: string }[] {
    const out = [];
    if (def.passive) {
      out.push({ name: 'Harmless', text: 'Goes through the motions of attacking; the blows never land.' });
    }
    if (!PHYSICAL_TYPES.has(def.damageType)) {
      out.push({
        name: `${DAMAGE_TYPE_NAMES[def.damageType]} Strikes`,
        text: `Armour does nothing — only ${DAMAGE_TYPE_NAMES[def.damageType].toLowerCase()} resistance blunts it.`,
      });
    }
    return out;
  }

  function defensiveAbilities(def: MonsterDef): { name: string; text: string }[] {
    const out = [];
    if (def.tags.includes('incorporeal')) {
      out.push({ name: 'Immaterial', text: 'Most of a weapon passes straight through it.' });
    }
    if (def.escorts?.length) {
      out.push({ name: 'Guarded', text: 'Rarely the first thing you get to swing at.' });
    }
    return out;
  }

  function spotName(id: string): string {
    const spot = SPOTS[id];
    if (!spot) return id;
    return `${spot.icon} ${spot.name}`;
  }

  function areaName(id: string): string {
    const spot = SPOTS[id];
    return spot ? (AREAS[spot.areaId]?.name ?? '') : '';
  }

  function range(lo: number, hi: number, digits = 0): string {
    const a = lo.toFixed(digits);
    const b = hi.toFixed(digits);
    return a === b ? a : `${a}–${b}`;
  }
</script>

{#snippet locked(f: BestiaryFactDef)}
  <p class="dim small hint">{f.hint}</p>
  <p class="dim small">🔒 {lockText(f)}</p>
{/snippet}

<div class="bestiary">
  <div class="panel head">
    <div class="titlerow">
      <h2>📖 Bestiary</h2>
      <span class="dim small">{progress.known} / {progress.total} recorded</span>
      <span class="dim small insight" title="Chance per kill of learning a fact of average difficulty. Raised by the Hunting skill, Intelligence and Wisdom.">
        🔎 Insight {pct(insight)} per kill · habitats need {habitatNeeded(gs)} sightings
      </span>
    </div>

    <div class="filterbar">
      {#each pickers as p (p.id)}
        <TagPicker
          label={p.name}
          options={p.options}
          multi={p.multi}
          selected={picked(p.id)}
          onchange={(next) => setCategory(p.id, next)}
        />
      {/each}
      <input class="search" type="search" placeholder="Search name or tag…" bind:value={search} />
      {#if filtering}
        <button class="small" onclick={clearFilters}>Clear</button>
      {/if}
    </div>
  </div>

  <div class="split">
    <!-- ---------- The shelf: taxonomy groups of portrait cards ---------- -->
    <div class="panel list">
      {#if results.length === 0}
        <p class="dim small">
          {filtering
            ? 'Nothing you have killed matches that.'
            : 'Empty. The first kill of anything opens its entry.'}
        </p>
      {/if}

      {#each shelves as shelf (shelf.tag)}
        {@const open = isOpen(shelf.tag)}
        <div class="shelf">
          <button class="shelfhead" onclick={() => toggleShelf(shelf.tag)} aria-expanded={open}>
            <span class="caret">{open ? '▾' : '▸'}</span>
            <span>{shelf.icon} {shelf.name}</span>
            <span class="dim small count">{shelf.defs.length}</span>
          </button>
          {#if open}
            <div class="cards">
              {#each shelf.defs as def (def.id)}
                {@const e = entryOf(gs, def.id)}
                {@const art = enemyArt(def)}
                <button
                  class="card"
                  class:selected={selectedId === def.id}
                  title="{def.name} — {TIERS[def.tier].name} · {e?.kills ?? 0} killed"
                  onclick={() => (selectedId = def.id)}
                >
                  <span class="art">
                    {#if art}<img src={art} alt="" />{:else}<span class="emoji">{def.icon}</span>{/if}
                  </span>
                  <span class="cardname">{def.name}</span>
                  <span class="dim small">{e?.facts.length ?? 0}/{BESTIARY_FACTS.length}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/each}

      {#if !filtering && unknownCount > 0}
        <div class="unknown dim small">
          ❔ {unknownCount} {unknownCount === 1 ? 'creature' : 'creatures'} still unrecorded.
        </div>
      {/if}
    </div>

    <!-- ---------- The page: one entry, laid out in four rows ---------- -->
    <div class="detail">
      {#if !selected}
        <div class="panel"><p class="dim small">Select an entry.</p></div>
      {:else}
        {@const def = selected}
        {@const art = enemyArt(def)}
        {@const profile = monsterProfile(def.id)}
        {@const offAbilities = offensiveAbilities(def)}
        {@const defAbilities = defensiveAbilities(def)}

        <!-- Row 1: portrait · identity · worth · haunts -->
        <div class="row1">
          <div class="panel cell portraitcell">
            <div class="portrait">
              {#if art}<img src={art} alt={def.name} />{:else}<span class="bigemoji">{def.icon}</span>{/if}
            </div>
          </div>

          <div class="panel cell">
            <h3>{def.name}</h3>
            <div class="dim small">
              {TIERS[def.tier].name} · found at level {range(profile.levels[0], profile.levels[1])} · {fmt(entry?.kills ?? 0)} killed
            </div>
            <div class="tags">
              {#each monsterTags(def) as tag}
                <span class="chip small static" title={MONSTER_TAGS[tag]?.desc ?? ''}>
                  {MONSTER_TAGS[tag]?.icon ?? ''} {MONSTER_TAGS[tag]?.name ?? tag}
                </span>
              {/each}
            </div>
          </div>

          <div class="panel cell" class:locked={!knows('rewards')}>
            <h4>🪙 Worth</h4>
            {#if knows('rewards')}
              <div class="stats col">
                <span>Experience <b>{range(profile.xp[0], profile.xp[1])}</b></span>
                <span>Coin <b>{profile.gold[1] > 0 ? range(profile.gold[0], profile.gold[1]) : 'none carried'}</b></span>
              </div>
            {:else}
              {@render locked(fact('rewards'))}
            {/if}
          </div>

          <div class="panel cell">
            <h4>🗺️ Haunts</h4>
            {#if entry && Object.keys(entry.seen).length > 0}
              <div class="res">
                {#each Object.entries(entry.seen).sort((a, b) => b[1] - a[1]) as [spotId, count]}
                  {@const confirmed = entry.spots.includes(spotId)}
                  <!-- You know you saw one here; what you have not established
                       is whether it lives here. That is what confirming buys. -->
                  <span class="resrow" class:unconfirmed={!confirmed} title={areaName(spotId)}>
                    {spotName(spotId)}
                    <b>
                      {confirmed
                        ? `den · ${fmt(count)} seen`
                        : `${count}/${habitatNeeded(gs)} seen`}
                    </b>
                  </span>
                {/each}
              </div>
            {:else}
              <p class="dim small">Never seen one in the wild.</p>
            {/if}
          </div>
        </div>

        <!-- Rows 2–4: paired halves of the sheet -->
        <div class="grid2">
          <div class="panel cell" class:locked={!knows('vitals')}>
            <h4>❤️ Vitals</h4>
            {#if knows('vitals')}
              <div class="stats">
                <span>Health <b>{range(profile.hp[0], profile.hp[1])}</b></span>
                <span>Evasion <b>{pct(profile.dodge)}</b></span>
              </div>
            {:else}
              {@render locked(fact('vitals'))}
            {/if}
          </div>

          <div class="panel cell" class:locked={!knows('defenses')}>
            <h4>🛡️ Defences</h4>
            {#if knows('defenses')}
              {@const rows = resistanceRows(def)}
              {#if rows.length === 0}
                <p class="dim small">No notable resistances or weaknesses.</p>
              {:else}
                <div class="res">
                  {#each rows as [type, value]}
                    <span class="resrow" class:weak={value! < 0}>
                      {DAMAGE_TYPE_NAMES[type as keyof typeof DAMAGE_TYPE_NAMES]}
                      <b>{value! > 0 ? `−${pct(value!, 0)} taken` : `+${pct(-value!, 0)} taken`}</b>
                    </span>
                  {/each}
                </div>
              {/if}
              {#if defAbilities.length}
                <div class="abilities">
                  {#each defAbilities as a}
                    <div class="ability"><b>{a.name}</b> <span class="dim">{a.text}</span></div>
                  {/each}
                </div>
              {/if}
            {:else}
              {@render locked(fact('defenses'))}
            {/if}
          </div>

          <div class="panel cell" class:locked={!knows('offense')}>
            <h4>⚔️ Offence</h4>
            {#if knows('offense')}
              <div class="stats">
                <span>Damage <b>{range(profile.damage[0], profile.damage[1], 1)}</b></span>
                <span>Type <b>{DAMAGE_TYPE_NAMES[def.damageType]}</b></span>
                <span>Strikes every <b>{profile.attackInterval.toFixed(1)}s</b></span>
                <span>Reach <b>{def.range === 'ranged' ? 'Ranged' : 'Melee'}</b></span>
              </div>
              {#if offAbilities.length}
                <div class="abilities">
                  {#each offAbilities as a}
                    <div class="ability"><b>{a.name}</b> <span class="dim">{a.text}</span></div>
                  {/each}
                </div>
              {/if}
            {:else}
              {@render locked(fact('offense'))}
            {/if}
          </div>

          <div class="panel cell" class:locked={!knows('behavior')}>
            <h4>🧠 Behaviour</h4>
            {#if knows('behavior')}
              <ul class="notes">
                <li>
                  {#if def.group?.max === 1}
                    Never travels with company — always met alone.
                  {:else if (def.group?.min ?? 1) > 1}
                    Comes in packs of {def.group!.min}–{def.group!.max ?? 5}.
                  {:else}
                    Turns up alone or in whatever crowd the area throws together.
                  {/if}
                </li>
                {#if def.escorts?.length}
                  <li>Escorted by {def.escorts.map((id) => MONSTERS[id]?.name ?? id).join(', ')}.</li>
                {/if}
                <li>
                  {def.range === 'ranged'
                    ? 'Fights from the back rank; jostled and slowed if forced to the front.'
                    : 'Fights up close, and loses bite when stuck behind its own line.'}
                </li>
              </ul>
            {:else}
              {@render locked(fact('behavior'))}
            {/if}
          </div>

          <div class="panel cell" class:locked={!knows('loot_common')}>
            <h4>🎒 Common Spoils</h4>
            {#if knows('loot_common')}
              {@const rows = drops(def, true)}
              {#if rows.length === 0}
                <p class="dim small">Nothing in this bracket.</p>
              {:else}
                <div class="res">
                  {#each rows as row}
                    <span class="resrow">
                      {dropLabel(row.entry)}{row.entry.qty && row.entry.kind !== 'gold'
                        ? ` ×${row.entry.qty[0]}–${row.entry.qty[1]}`
                        : ''}
                      <b>{pct(dropChance(def, row.index))}</b>
                    </span>
                  {/each}
                </div>
              {/if}
            {:else}
              {@render locked(fact('loot_common'))}
            {/if}
          </div>

          <div class="panel cell" class:locked={!knows('loot_rare')}>
            <h4>💎 Rare Spoils</h4>
            {#if knows('loot_rare')}
              {@const rows = drops(def, false)}
              {#if rows.length === 0}
                <p class="dim small">Nothing in this bracket.</p>
              {:else}
                <div class="res">
                  {#each rows as row}
                    <span class="resrow">
                      {dropLabel(row.entry)}{row.entry.qty && row.entry.kind !== 'gold'
                        ? ` ×${row.entry.qty[0]}–${row.entry.qty[1]}`
                        : ''}
                      <b>{pct(dropChance(def, row.index))}</b>
                    </span>
                  {/each}
                </div>
              {/if}
            {:else}
              {@render locked(fact('loot_rare'))}
            {/if}
          </div>
        </div>

        <!-- Field notes run the full width under the sheet. -->
        <div class="panel cell notesrow" class:locked={!knows('lore')}>
          <h4>📝 Field Notes</h4>
          {#if knows('lore')}
            <p class="lore">{def.desc ?? 'Nothing worth writing down.'}</p>
          {:else}
            {@render locked(fact('lore'))}
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* The page owns the tab's height so nothing above it scrolls: the header is
     fixed, and the shelf is the one region that moves. */
  .bestiary {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    min-height: 0;
    container-type: inline-size;
  }

  .head {
    flex-shrink: 0;
  }

  .titlerow {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }

  .titlerow h2 {
    margin: 0;
  }

  .insight {
    margin-left: auto;
    cursor: help;
  }

  .search {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    padding: 4px 8px;
    width: 180px;
  }

  .filterbar {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .chip {
    padding: 2px 8px;
    font-size: 12px;
    border-radius: 999px;
  }

  .chip.static {
    background: var(--bg-raised);
    cursor: default;
  }

  .split {
    display: grid;
    grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
    gap: 10px;
    flex: 1;
    min-height: 0;
  }

  /* When the tab itself is narrow, the shelf gives ground rather than starving
     the entry sheet into a single stacked column. */
  @container (max-width: 1000px) {
    .split {
      grid-template-columns: minmax(200px, 280px) minmax(0, 1fr);
    }

    .cards {
      grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    }
  }

  /* ---------- Shelf ---------- */

  .list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
    overflow-y: auto;
  }

  .shelfhead {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    text-align: left;
    padding: 4px 8px;
    background: var(--bg-raised);
    font-weight: 600;
    font-size: 13px;
  }

  .caret {
    width: 10px;
    color: var(--text-dim);
  }

  .count {
    margin-left: auto;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 6px;
    padding: 6px 2px 2px;
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 4px;
    background: var(--bg-raised);
    border-color: transparent;
  }

  .card:hover {
    background: var(--bg-hover);
  }

  .card.selected {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, var(--bg-raised));
  }

  .art {
    height: 54px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .art img {
    max-width: 100%;
    max-height: 54px;
    image-rendering: pixelated;
  }

  .emoji {
    font-size: 30px;
  }

  .cardname {
    font-size: 12px;
    line-height: 1.15;
    text-align: center;
    /* Two lines, then ellipsis — names vary wildly in length. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .unknown {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--border);
  }

  /* ---------- Entry page ---------- */

  .detail {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    min-height: 0;
    /* A safety valve, not a habit: the sheet is sized to fit, and only a very
       short window can make it move. */
    overflow-y: auto;
    /* The sheet reflows to the width of the PANE, which the sidebar and log
       squeeze far below the window width. */
    container-type: inline-size;
  }

  .row1 {
    display: grid;
    grid-template-columns: 132px minmax(160px, 1.3fr) minmax(110px, 0.7fr) minmax(140px, 1fr);
    gap: 10px;
    align-items: stretch;
  }

  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-items: stretch;
  }

  .cell {
    padding: 8px 10px;
    min-width: 0;
  }

  .cell h3 {
    margin: 0 0 2px;
  }

  .cell h4 {
    margin: 0 0 5px;
  }

  .cell.locked h4 {
    color: var(--text-dim);
  }

  .cell p {
    margin: 2px 0;
  }

  .portraitcell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
  }

  .portrait {
    width: 104px;
    height: 104px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .portrait img {
    max-width: 100%;
    max-height: 100%;
    image-rendering: pixelated;
  }

  .bigemoji {
    font-size: 60px;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }

  .hint {
    font-style: italic;
  }

  .lore {
    color: var(--text);
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    color: var(--text-dim);
    font-size: 13px;
  }

  .stats.col {
    flex-direction: column;
    gap: 2px;
  }

  .stats b {
    color: var(--text);
  }

  .notes {
    margin: 2px 0;
    padding-left: 18px;
    font-size: 13px;
  }

  .abilities {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid var(--border);
    font-size: 13px;
  }

  .ability b {
    color: var(--accent);
  }

  .res {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
  }

  .resrow {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: var(--text-dim);
    border-bottom: 1px dotted var(--border);
    padding-bottom: 1px;
  }

  .resrow b {
    color: var(--xp);
    white-space: nowrap;
  }

  .resrow.weak b {
    color: var(--danger);
  }

  .resrow.unconfirmed b {
    color: var(--text-dim);
  }

  /* Four across needs real room; below that the top row folds to
     portrait|identity over worth|haunts, and finally to one column. */
  @container (max-width: 620px) {
    .row1 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .portraitcell {
      padding: 6px;
    }
  }

  @container (max-width: 460px) {
    .row1,
    .grid2 {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 900px) {
    .split {
      grid-template-columns: 1fr;
    }
  }
</style>
