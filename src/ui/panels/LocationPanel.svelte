<script lang="ts">
  import KeyItems from '../KeyItems.svelte';
  import { gs, game, ui, view } from '../state.svelte';
  import { getSpot, MATERIALS, RECIPES } from '../../core/registry';
  import { locationBreadcrumb } from '../../core/systems/locations';
  import {
    activityCost,
    activityFactorInfo,
    activityFillRate,
    activityOutputMult,
    activitySpeedMult,
    attrXpWeights,
    currentActivity,
    exploreProgress,
    claimedFinds,
  } from '../../core/systems/actions';
  import type { ActivityDef } from '../../core/types';
  import Tip from '../lib/Tip.svelte';
  import {
    canAfford,
    recipeCostText,
    recipeResultIcon,
    recipeResultName,
    recipeHidden,
    recipeUnlocked,
  } from '../../core/systems/crafting';
  import { npcsAt, availableQuests, canTurnIn, hasMet } from '../../core/systems/quests';
  import { buyPrice, lineIcon, lineName, lineQuality, visibleLines } from '../../core/systems/shops';
  import { runeSlotRange } from '../../core/systems/runes';
  import { ITEMS } from '../../core/registry';
  import { SLOT_NAMES } from '../../core/types';
  import { QUALITY_TIERS } from '../../core/registry';
  import { WIELD_NAMES, wieldOf } from '../../core/systems/wield';
  import { DAMAGE_TYPE_NAMES } from '../../core/types';
  import type { NpcDef } from '../../core/types';
  import { RESOURCES } from '../../core/data/resources.data';
  import { describeMod, grantLine, fmt } from '../lib/format';
  import { stockOf } from '../../core/systems/disciplines';
  import type { ShopLine } from '../../core/types';
  import { QUESTS, SKILLS, STYLES } from '../../core/registry';
  import { ticksToTime, condsText, factorLabel, attrSplitText } from '../lib/format';
  import MapCard from '../MapCard.svelte';
  import SceneBackdrop from '../lib/SceneBackdrop.svelte';
  import RaidTrack from '../lib/RaidTrack.svelte';
  import { sceneFor } from '../lib/scenes';
  import DestinationPreview from './DestinationPreview.svelte';
  import { visibleBenches } from '../lib/navigation';
  import BenchPanel from './BenchPanel.svelte';
  import AnvilPanel from './AnvilPanel.svelte';
  import { loadOnAnvil } from '../lib/anvil.svelte';
  import { placementText } from '../lib/anvilView';
  import type { Placement as ForgePlacement } from '../../core/types';
  import SpellcraftPanel from './SpellcraftPanel.svelte';
  import AscentPanel from './AscentPanel.svelte';
  import Modal from '../lib/Modal.svelte';
  import { DISCIPLINES } from '../../core/data/disciplines.data';
  import { conditionsMet } from '../../core/systems/conditions';
  import { subsystemUnlocked } from '../../core/systems/unlocks';
  import { POSITIONS, TECHNIQUES } from '../../core/data/martial.data';
  import { declaredPositions, lessonState, techniqueForm, unreachedEntries } from '../../core/systems/martial';

  /** A position as the planner shows it: icon and name. */
  function positionLabel(id: string): string {
    const p = POSITIONS[id];
    return p ? `${p.icon} ${p.name}` : id;
  }
  import { tutorialScreen } from '../lib/tutorialFocus';

  /** Which workbench is open, if any. */
  let openBench = $state<string | null>(null);
  /** The ware whose card was clicked — the detail window reads the live shelf by index. */
  let openWare = $state<{ npc: NpcDef; index: number } | null>(null);
  const wareLine = $derived(openWare ? visibleLines(gs, openWare.npc)[openWare.index] : undefined);

  /** One restore entry as words: "+25 HP", "+10% of max Mana". */
  function restoreText(r: { resource: string; flat?: number; ofMax?: number }): string {
    const name = RESOURCES[r.resource as keyof typeof RESOURCES]?.name ?? r.resource;
    const bits: string[] = [];
    if (r.flat) bits.push(`+${fmt(r.flat)}`);
    if (r.ofMax) bits.push(`+${Math.round(r.ofMax * 100)}% of max`);
    return `${bits.join(' and ')} ${name}`;
  }

  const spot = $derived(getSpot(gs.spot));

  /** Floor 0's pointer (lib/tutorialFocus.ts): `activity:<id>` lights that button. */
  const tutorialTarget = $derived(tutorialScreen(gs)?.target ?? null);

  const visibleBenchIds = $derived(visibleBenches(gs, spot));
  /** The assembling bench standing here, if any: a recipe line can be opened on it. */
  const anvilId = $derived(visibleBenchIds.find((id) => DISCIPLINES[id]?.assembles));

  /** "Open on anvil": load a recipe line's parts and open the bench. */
  function openOnAnvil(forge: ForgePlacement) {
    if (!anvilId) return;
    loadOnAnvil(gs, forge);
    openBench = anvilId;
  }

  // "Go & open" from the map: open the bench once standing at its spot. Any
  // other stop (a cancelled or redirected journey) drops the request.
  $effect(() => {
    const want = ui.benchOnArrival;
    if (!want || gs.travel) return;
    if (want.spot === gs.spot) openBench = want.bench;
    ui.benchOnArrival = null;
  });
  const explorePct = $derived(exploreProgress(gs, spot));
  // What the spot still owes you, and how much further to the next one. The
  // finds themselves stay secret — the tick says "there is something here",
  // not what it is.
  const unclaimedFinds = $derived(
    (spot.finds ?? []).filter((f) => !claimedFinds(gs, spot.id).includes(f.id)),
  );
  const foundCount = $derived((spot.finds ?? []).length - unclaimedFinds.length);
  const nextFind = $derived(
    [...unclaimedFinds].sort((a, b) => a.at - b.at).find((f) => f.at > explorePct),
  );
  const recipes = $derived(
    (spot.recipes ?? []).map((rid) => RECIPES[rid]).filter((r) => r && !recipeHidden(gs, r)),
  );
  const npcs = $derived(npcsAt(gs.spot));

  /** How many of a ware you already hold — graded wares count only the grade on sale. */
  function heldOf(line: ShopLine): number {
    if (line.kind === 'item') return gs.inventory.filter((i) => i.defId === line.id).length;
    if (MATERIALS[line.id]?.graded) return stockOf(gs, line.id, lineQuality(line));
    return gs.materials[line.id] ?? 0;
  }

  /**
   * What a card says under the name. Items: slot, quality, rune slots.
   * Quality is reserved — equipment has no grades yet, so it reads "—"
   * until that system lands and this one line starts reading it.
   * Graded materials show the grade on sale instead.
   */
  function wareFacts(line: ShopLine): { label: string; value: string }[] {
    if (line.kind === 'item') {
      const def = ITEMS[line.id];
      if (!def) return [];
      const [lo, hi] = runeSlotRange(def);
      return [
        { label: 'slot', value: SLOT_NAMES[def.slot] },
        { label: 'quality', value: '—' },
        // Runes ride the runecarving shutter.
        ...(subsystemUnlocked(gs, 'runecarving')
          ? [{ label: 'runes', value: lo === hi ? `${hi}` : `${lo}–${hi}` }]
          : []),
      ];
    }
    const def = MATERIALS[line.id];
    if (!def?.graded) return [];
    return [{ label: 'quality', value: QUALITY_TIERS[lineQuality(line)].name }];
  }

  const stats = $derived(view.stats);
  const activeAct = $derived(currentActivity(gs));
  const actCost = $derived(activeAct ? activityCost(activeAct, stats) : 0);
  const actEta = $derived(
    activeAct && actCost > 0
      ? Math.max(0, (actCost - gs.activityProgress) / activityFillRate(activeAct, stats, gs))
      : 0,
  );

  function dialogueLine(lines: string[]): string {
    return lines[Math.floor(gs.totalTicks / 300) % lines.length];
  }

  /** ETA of one completion cycle for any activity, in ticks (0 for cycle-less kinds). */
  function activityEtaTicks(act: ActivityDef): number {
    const cost = activityCost(act, stats);
    return cost > 0 ? cost / activityFillRate(act, stats, gs) : 0;
  }

  /** This NPC's quests the player has active (for turn-in / progress hints). */
  function activeFor(npcQuests: string[]) {
    return npcQuests
      .map((id) => QUESTS[id])
      .filter((q) => q && gs.quests[q.id]?.status === 'active');
  }
</script>

{#snippet actBtn(act: ActivityDef)}
  {@const pointed = tutorialTarget === `activity:${act.id}`}
  <button
    class:selected={gs.activity === act.id}
    class:tutorial-target={pointed}
    class:tutorial-glow={pointed}
    disabled={gs.recovering || !!gs.combat?.forced}
    onclick={() => game.selectActivity(gs.activity === act.id ? null : act.id)}
  >
    {act.icon} {act.name}
  </button>
{/snippet}

{#snippet activityTip(act: ActivityDef)}
  {@const info = activityFactorInfo(act)}
  {@const eta = activityEtaTicks(act)}
  {@const trained = attrSplitText(attrXpWeights(act))}
  <div class="tip-line tip-base">{act.icon} {act.name}</div>

  <!-- What this task actually does. -->
  {#if act.kind === 'train'}
    <div class="tip-line">Trains {trained}</div>
  {:else if act.kind === 'gather'}
    <div class="tip-line">
      Gathers {MATERIALS[act.material]?.icon ?? '📦'} {MATERIALS[act.material]?.name ?? act.material}
    </div>
  {:else if act.kind === 'job'}
    <div class="tip-line">Pays {act.gold} gold per shift</div>
  {:else if act.kind === 'craft'}
    <div class="tip-line">
      Crafts {recipeResultIcon(RECIPES[act.recipe])} {recipeResultName(RECIPES[act.recipe])}
    </div>
  {:else if act.kind === 'hunt'}
    <div class="tip-line">Seeks out monsters to fight here</div>
  {:else if act.kind === 'search'}
    <div class="tip-line">Repeatedly searches this room. Each completed search yields one result; some discoveries can only be found once.</div>
  {:else if act.kind === 'rest'}
    <div class="tip-line">Recovers HP steadily</div>
  {:else if act.kind === 'explore'}
    <div class="tip-line">Searches the area, turning things up as you go</div>
    {#if unclaimedFinds.length > 0}
      <div class="tip-line">
        🔎 {unclaimedFinds.length} still to find here{nextFind
          ? `, next at ${Math.round(nextFind.at * 100)}%`
          : ''}
      </div>
    {/if}
    {#if (spot.connections ?? []).some((c) => c.hidden)}
      <div class="tip-line">🚪 Hidden paths lead out of here</div>
    {/if}
  {/if}

  {#if trained && act.kind !== 'train'}
    <div class="tip-line">🏋️ Trains {trained}</div>
  {/if}

  {#if info.staticTime}
    <div class="tip-line">⏱️ Fixed duration — your speed doesn't change it</div>
  {:else if info.speed.length}
    <div class="tip-line">
      ⚡ Speed ×{activitySpeedMult(gs, stats, act).toFixed(2)} — {info.speed.map(factorLabel).join(', ')}
    </div>
  {/if}
  {#if info.output.length}
    <div class="tip-line">
      🎁 Output ×{activityOutputMult(gs, stats, act).toFixed(2)} — {info.output.map(factorLabel).join(', ')}
    </div>
  {/if}
  {#if eta > 0}
    <div class="tip-line tip-total">≈ {ticksToTime(eta)} per cycle</div>
  {/if}
{/snippet}

<MapCard />

{#if gs.travel}
  {@const dest = getSpot(gs.travel.to)}
  <div class="panel" style="margin-top: 12px">
    <h2>
      🥾 Traveling to {gs.discovered.includes(dest.id) ? `${dest.icon} ${dest.name}` : '❓ an unknown place'}
    </h2>
    <div class="bar" style="height: 18px">
      <div
        class="fill"
        style="width: {((gs.travel.total - gs.travel.ticksLeft) / gs.travel.total) * 100}%; background: var(--mana)"
      ></div>
      <div class="label">{ticksToTime(gs.travel.ticksLeft)} remaining</div>
    </div>
  </div>
  <!-- Where the journey ends, read ahead: plan the arrival while walking. -->
  <DestinationPreview />
{:else}
  <div class="panel place" style="margin-top: 12px">
    <!-- The place, painted: the same backdrop its fights are drawn against. -->
    <div class="place-banner">
      <SceneBackdrop scene={sceneFor(spot)} />
      <div class="place-title">
        <div class="small crumb">{locationBreadcrumb(gs.spot)}</div>
        <h2>{spot.icon} {spot.name}</h2>
      </div>
      {#if spot.fightLimit}
        <div class="place-raid"><RaidTrack {spot} /></div>
      {/if}
    </div>
    <p class="dim">{spot.desc}</p>

    <KeyItems />
    <h3>Activities</h3>
    <div class="btn-grid">
      {#each spot.activities as act}
        <Tip>
          {@render actBtn(act)}
          {#snippet tip()}{@render activityTip(act)}{/snippet}
        </Tip>
      {/each}
    </div>

    {#if activeAct && actCost > 0}
      <div class="explore small" title="Fills at your Speed — rewards land when the bar completes">
        <span class="dim">{activeAct.icon} Next:</span>
        <div class="bar" style="flex: 1; height: 10px">
          <div
            class="fill action-fill"
            style="width: {Math.min(100, (gs.activityProgress / actCost) * 100)}%; background: var(--action)"
          ></div>
        </div>
        <span>{ticksToTime(actEta)}</span>
      </div>
    {/if}

    {#if spot.exploreTicks}
      <div class="explore small">
        <span class="dim">Exploration:</span>
        <div class="bar" style="flex: 1; height: 10px">
          <div class="fill" style="width: {explorePct * 100}%; background: #7de0c3"></div>
          <!--
            Ticks for finds the spot still owes you. Claimed ones are dropped
            rather than dimmed: a mark that never moves reads as a bug, and the
            bar's job is to say how much further, not to keep a trophy shelf.
          -->
          {#each unclaimedFinds as f (f.id)}
            <div class="find-tick" style="left: {f.at * 100}%" title="Something to find here"></div>
          {/each}
        </div>
        <span>{Math.floor(explorePct * 100)}%</span>
      </div>
      {#if foundCount > 0 || unclaimedFinds.length > 0}
        <div class="small dim" style="margin-top: 2px">
          🔎 Found {foundCount} of {(spot.finds ?? []).length} here{nextFind
            ? ` — next at ${Math.round(nextFind.at * 100)}%`
            : ''}
        </div>
      {/if}
    {/if}
  </div>

  {#if npcs.length > 0}
    <div class="panel" style="margin-top: 12px">
      <h3>People</h3>
      {#each npcs as npc (npc.id)}
        <div class="npc">
          <div class="npc-head">
            <span><b>{npc.icon} {npc.name}</b></span>
            <span class="dim small">“{dialogueLine(npc.dialogue)}”</span>
            <!-- A first greeting stamps met:<id> — what talk objectives read.
                 Once made it is a fact about the save, so the button becomes
                 a quiet checkmark rather than staying clickable. -->
            {#if hasMet(gs, npc.id)}
              <span class="met small" title="You have made this acquaintance">🤝 met</span>
            {:else}
              <button class="small" onclick={() => game.talkTo(npc.id)}>🤝 Say hello</button>
            {/if}
          </div>
          {#each availableQuests(gs, npc) as quest (quest.id)}
            <div class="quest-row">
              <div>
                <b>📜 {quest.name}</b>
                <div class="dim small">{quest.desc}</div>
              </div>
              <button class="small" onclick={() => game.acceptQuest(quest.id)}>Accept</button>
            </div>
          {/each}
          {#each activeFor(npc.quests) as quest (quest.id)}
            <div class="quest-row">
              <div>
                <b>📜 {quest.name}</b>
                <div class="dim small">{canTurnIn(gs, quest) ? 'Ready to turn in!' : 'In progress — see the Quests tab.'}</div>
              </div>
              <button class="small" disabled={!canTurnIn(gs, quest)} onclick={() => game.turnInQuest(quest.id)}>
                Turn In
              </button>
            </div>
          {/each}
          <!--
            A teacher's lessons (NpcDef.teaches, systems/martial.ts). Each one
            shows the positions it links, because the point of the first two is
            that they chain: neutral → coiled, coiled → extended.
          -->
          {#if npc.teaches?.length}
            <div class="lessons">
              <b class="small">🥋 Training</b>
              {#each npc.teaches as lesson ('technique' in lesson ? lesson.technique : lesson.school)}
                {@const tech = 'technique' in lesson ? TECHNIQUES[lesson.technique] : undefined}
                {@const school = 'school' in lesson ? SKILLS[lesson.school] : undefined}
                {@const status = lessonState(gs, lesson)}
                {#if school}
                  <!-- A school lesson: the skill and the stance it opens. -->
                  {@const stance = Object.values(STYLES).find((s) => s.skill === school.id)}
                  <div class="quest-row">
                    <div>
                      <b>{school.icon} {school.name}</b>
                      <span class="dim small">School{stance ? ` · ${stance.name} stance` : ''}</span>
                      {#if stance}<div class="dim small">{stance.desc}</div>{/if}
                      {#if status === 'held' && lesson.requires}
                        <div class="dim small">Needs {condsText(lesson.requires)}</div>
                      {/if}
                    </div>
                    {#if status === 'taught'}
                      <span class="met small">✓ learned</span>
                    {:else}
                      <button class="small" disabled={status === 'held'} onclick={() => game.learnSchoolFromTeacher(npc.id, school.id)}>
                        Learn
                      </button>
                    {/if}
                  </div>
                {:else if tech && 'technique' in lesson}
                  {@const from = declaredPositions(tech)}
                  <div class="quest-row">
                    <div>
                      <b>{tech.icon} {tech.name}</b>
                      <span class="dim small">
                        {from === 'any' ? 'Any position' : from.map(positionLabel).join(' or ')}
                        → {positionLabel(tech.to)}
                      </span>
                      <div class="dim small">{tech.desc}</div>
                      {#if status === 'held'}
                        {@const missing = unreachedEntries(gs, tech)}
                        {#if lesson.requires && !conditionsMet(gs, lesson.requires)}
                          <div class="dim small">Needs {condsText(lesson.requires)}</div>
                        {/if}
                        {#if missing.length}
                          <div class="dim small">Needs a technique that leads into {missing.map(positionLabel).join(' or ')} first</div>
                        {/if}
                      {/if}
                    </div>
                    {#if status === 'taught'}
                      <span class="met small">✓ learned</span>
                    {:else}
                      <button class="small" disabled={status === 'held'} onclick={() => game.learnFromTeacher(npc.id, tech.id)}>
                        {techniqueForm(gs, tech.id) === 'rough' ? 'Refine' : 'Learn'}
                      </button>
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
          <!--
            The counter. Prices derive from value (systems/shops.ts); a stranger
            pays more, so the hello above is also the discount. Buying never
            beats selling back — the no-arbitrage floor is inside buyPrice.
          -->
          {#if npc.shop}
            {@const shelf = visibleLines(gs, npc)}
            {#if shelf.length}
              <div class="shop">
                <div class="shop-head">
                  <b>🪙 {npc.shop.name}</b>
                  <span class="dim small">
                    {hasMet(gs, npc.id) ? 'known customer' : 'stranger prices — say hello'} · {Math.floor(gs.gold)} gold on you
                  </span>
                </div>
                <div class="ware-grid">
                  {#each shelf as line, i (`${line.kind}:${line.id}:${i}`)}
                    {@const price = buyPrice(gs, npc.id, line, stats.goldGain)}
                    {@const held = heldOf(line)}
                    <div
                      class="ware-card"
                      class:unaffordable={gs.gold < price}
                      role="button"
                      tabindex="0"
                      onclick={() => (openWare = { npc, index: i })}
                      onkeydown={(e) => e.key === 'Enter' && (openWare = { npc, index: i })}
                    >
                      <div class="ware-top">
                        <span class="ware-icon">{lineIcon(line)}</span>
                        <span class="ware-title">
                          <b>{lineName(line)}</b>
                          {#if held > 0}<span class="dim small">have {held}</span>{/if}
                        </span>
                      </div>
                      {#if wareFacts(line).length}
                        <div class="ware-facts small">
                          {#each wareFacts(line) as f (f.label)}
                            <span><span class="dim">{f.label}</span> {f.value}</span>
                          {/each}
                        </div>
                      {/if}
                      <div class="ware-foot">
                        <span class="ware-price">{price} 🪙</span>
                        <span class="ware-btns">
                          <button class="small" disabled={gs.gold < price} onclick={(e) => { e.stopPropagation(); game.buy(npc.id, i, 1); }}>Buy</button>
                          {#if line.kind === 'material' && !MATERIALS[line.id]?.consumable?.teaches}
                            <button class="small" disabled={gs.gold < price} onclick={(e) => { e.stopPropagation(); game.buy(npc.id, i, 5); }}>×5</button>
                          {/if}
                        </span>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!--
    Modular crafting benches standing at this spot. They are furniture: you walk
    up to one and it opens, rather than every bench in the room competing for
    space on the page.
  -->
  {#if visibleBenchIds.length}
    <div class="panel" style="margin-top: 12px">
      <h3>🛠️ Workbenches</h3>
      <div class="btn-grid">
        {#each visibleBenchIds as benchId (benchId)}
          {@const bench = DISCIPLINES[benchId]}
          {#if benchId === 'spelltable'}
            <!-- Not a discipline: one table, three schools (see SpellcraftPanel). -->
            <button class="bench-open" onclick={() => (openBench = benchId)}>
              <span class="bench-icon">🔮</span>
              <span class="bench-label">
                <b>Spellcrafting Table</b>
                <span class="small dim"
                  >Arcane · Divine{subsystemUnlocked(gs, 'psionics') ? ' · Psionic' : ''}</span
                >
              </span>
            </button>
          {:else if bench}
            <button class="bench-open" onclick={() => (openBench = benchId)}>
              <span class="bench-icon">{bench.icon}</span>
              <span class="bench-label">
                <b>{bench.benchName ?? bench.name}</b>
                <span class="small dim">{bench.name} · Lv {gs.skills[bench.skill]?.level ?? 0}</span>
              </span>
            </button>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <!--
  One ware, in full. The card says what you need to decide; this says
  everything the ware knows about itself — mods, hands, requirements,
  tags, what a consumable does. Reads the shelf live so a purchase
  updates the "have" line without closing the window.
-->
{#if openWare && wareLine}
  {@const line = wareLine}
  {@const vendor = openWare.npc}
  {@const price = buyPrice(gs, vendor.id, line, stats.goldGain)}
  <Modal onclose={() => (openWare = null)}>
    {#snippet title()}
      <div class="win-title">{lineIcon(line)} {lineName(line)}</div>
      <div class="small dim">{vendor.shop?.name} · {vendor.name}</div>
    {/snippet}
    <div class="ware-detail">
      {#if line.kind === 'item'}
        {@const def = ITEMS[line.id]}
        {#if def}
          {@const [lo, hi] = runeSlotRange(def)}
          {#if def.desc}<div class="dim">{def.desc}</div>{/if}
          <div class="facts small">
            <span><span class="dim">slot</span> {SLOT_NAMES[def.slot]}</span>
            {#if def.slot === 'weapon' || def.slot === 'offhand'}
              <span><span class="dim">wield</span> {WIELD_NAMES[wieldOf(def)]}</span>
            {/if}
            <span><span class="dim">quality</span> —</span>
            {#if subsystemUnlocked(gs, 'runecarving')}
              <span><span class="dim">rune slots</span> {lo === hi ? hi : `${lo}–${hi}`} (rolled on purchase)</span>
            {/if}
          </div>
          <div class="section">Stats</div>
          {#if def.mods.length === 0 && !def.bonusDamage && !def.mainHand && !def.offHand}
            <div class="dim small">No modifiers.</div>
          {/if}
          {#each def.mods as mod}<div class="mod">{describeMod(mod)}</div>{/each}
          {#if def.bonusDamage}
            <div class="mod">on hit: +{fmt(def.bonusDamage.value)} {DAMAGE_TYPE_NAMES[def.bonusDamage.type]}</div>
          {/if}
          {#if def.mainHand}<div class="mod">🤜 Main hand — {def.mainHand.desc}</div>{/if}
          {#if def.offHand}<div class="mod">🤛 Off hand — {def.offHand.desc}</div>{/if}
          {#if def.requirements?.length}
            <div class="section">Requires</div>
            <div class="mod">{conditionsMet(gs, def.requirements) ? "✔" : "🔒"} {condsText(def.requirements)}</div>
          {/if}
          {#if def.tags.length}
            <div class="section">Tags</div>
            <div class="tags">{#each def.tags as t}<span class="tag">{t}</span>{/each}</div>
          {/if}
        {/if}
      {:else}
        {@const def = MATERIALS[line.id]}
        {#if def}
          {#if def.desc}<div class="dim">{def.desc}</div>{/if}
          {#if def.graded}
            <div class="facts small">
              <span><span class="dim">quality</span> {QUALITY_TIERS[lineQuality(line)].name} (sold at this grade only)</span>
            </div>
          {/if}
          {#if def.consumable}
            {@const c = def.consumable}
            <div class="section">On use</div>
            {#each c.restore ?? [] as r}<div class="mod">{restoreText(r)}</div>{/each}
            {#each c.grants ?? [] as g}<div class="mod">{grantLine(g)}</div>{/each}
            {#if c.cures?.length}<div class="mod">cures: {c.cures.join(", ")}</div>{/if}
            {#if c.cooldown}<div class="mod dim">cooldown {ticksToTime(c.cooldown)}</div>{/if}
          {/if}
          {#if def.craftTags?.length}
            <div class="section">Tags</div>
            <div class="tags">{#each def.craftTags as t}<span class="tag">{t}</span>{/each}</div>
          {/if}
        {/if}
      {/if}
      <div class="ware-buy">
        <span>
          <b>{price} 🪙</b>
          <span class="dim small">· {Math.floor(gs.gold)} on you · have {heldOf(line)}</span>
        </span>
        <span class="ware-btns">
          <button class="small" disabled={gs.gold < price} onclick={() => game.buy(vendor.id, openWare!.index, 1)}>Buy</button>
          {#if line.kind === 'material' && !MATERIALS[line.id]?.consumable?.teaches}
            <button class="small" disabled={gs.gold < price} onclick={() => game.buy(vendor.id, openWare!.index, 5)}>×5</button>
          {/if}
        </span>
      </div>
    </div>
  </Modal>
{/if}

{#if openBench === 'spelltable'}
    <Modal wide onclose={() => (openBench = null)}>
      {#snippet title()}
        <div class="win-title">🔮 Spellcrafting Table</div>
        <div class="small dim">
          Three schools of magic, one table. What you craft here is written into your grimoire.
        </div>
      {/snippet}
      <SpellcraftPanel large />
    </Modal>
  {:else if openBench}
    {@const bench = DISCIPLINES[openBench]}
    <Modal wide fill={!!bench.assembles} onclose={() => (openBench = null)}>
      {#snippet title()}
        <div class="win-title">{bench.icon} {bench.benchName ?? bench.name}</div>
        <div class="small dim">{bench.desc}</div>
      {/snippet}
      {#if bench.assembles}
        <AnvilPanel />
      {:else}
        <BenchPanel disciplineId={openBench} large />
      {/if}
    </Modal>
  {/if}

  {#if recipes.length > 0}
    <div class="panel" style="margin-top: 12px">
      <h3>⚒️ Crafting</h3>
      <div class="recipes">
        {#each recipes as recipe (recipe.id)}
          {@const unlocked = recipeUnlocked(gs, recipe)}
          {@const affordable = canAfford(gs, recipe)}
          <!-- A line with parts shows them under the button; the button stays the craft. -->
          <div class="recipe-card">
            <button
              class="recipe"
              class:selected={gs.activity === `craft_${recipe.id}`}
              disabled={!unlocked || gs.recovering || !!gs.combat?.forced}
              title={unlocked ? '' : `Requires ${condsText(recipe.unlock)}`}
              onclick={() =>
                game.selectActivity(
                  gs.activity === `craft_${recipe.id}` ? null : `craft_${recipe.id}`,
                )}
            >
              <span>
                {unlocked ? recipeResultIcon(recipe) : '🔒'}
                {recipeResultName(recipe)}
              </span>
              <span class="small cost" class:short={!affordable}>
                {unlocked ? recipeCostText(gs, recipe) : `Requires ${condsText(recipe.unlock)}`}
              </span>
            </button>
            {#if recipe.forge}
              {@const forge = recipe.forge}
              <div class="recipe-parts small">
                <span class="dim">{placementText(forge)}</span>
                {#if anvilId}
                  <button class="small" onclick={() => openOnAnvil(forge)}>Open on anvil</button>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- The ladder, wherever a stack is reachable: the hub spot or any floor. -->
  <AscentPanel />
{/if}

<style>
  .place {
    padding-top: 0;
    overflow: hidden;
  }
  .place-banner {
    position: relative;
    height: 120px;
    margin: 0 -14px 10px;
    border-bottom: 1px solid var(--border);
  }
  .place-title {
    position: absolute;
    left: 14px;
    bottom: 8px;
    z-index: 2;
    text-shadow: 0 2px 4px #000, 0 0 10px #000;
  }
  .place-title h2 {
    margin: 0;
    font-size: 1.45rem;
  }
  .place-title .crumb {
    color: color-mix(in srgb, var(--text) 80%, transparent);
  }
  .place-raid {
    position: absolute;
    right: 12px;
    top: 10px;
    z-index: 2;
  }

  /* A bench reads as a piece of furniture in the room, not a menu item. */
  .bench-open {
    display: flex;
    align-items: center;
    gap: 9px;
    text-align: left;
    padding: 8px 12px;
  }

  .bench-icon {
    font-size: 20px;
  }

  .bench-label {
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }

  .btn-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  /* Activity buttons wrapped in a Tip: let the wrapper size to the button, no text underline. */
  .btn-grid > :global(.tip-target) {
    display: inline-flex;
    border-bottom: none;
  }

  .explore {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  /* A notch on the exploration bar where the spot still owes you something. */
  .find-tick {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: #fbbf24;
    opacity: 0.85;
    pointer-events: none;
  }

  .action-fill {
    transition: none; /* fills every tick; easing would lag behind the reset */
  }

  .recipes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }

  /* A card is as tall as its own lines: a recipe with no parts is not stretched to its neighbour's. */
  .recipe-card {
    display: flex;
    flex-direction: column;
    align-self: start;
    gap: 4px;
  }

  .recipe {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    text-align: left;
  }

  /* The parts a recipe line is made of, and the way onto the anvil with them. */
  .recipe-parts {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    padding: 0 2px;
  }

  .recipe-parts button {
    padding: 2px 7px;
  }

  .cost {
    color: var(--text-dim);
  }

  .cost.short {
    color: var(--danger);
  }

  .npc {
    margin-bottom: 12px;
  }

  .npc-head {
    display: flex;
    gap: 10px;
    align-items: baseline;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }

  .met {
    color: var(--text-dim);
  }

  .quest-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    margin-top: 6px;
  }

  .shop {
    margin-top: 8px;
  }

  .lessons {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }

  .shop-head {
    display: flex;
    gap: 10px;
    align-items: baseline;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }

  .ware-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 6px;
  }

  .ware-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 8px;
    min-width: 0;
  }

  .ware-card.unaffordable {
    opacity: 0.7;
  }

  .ware-top {
    display: flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
  }

  .ware-icon {
    font-size: 18px;
    flex: none;
  }

  .ware-title {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
  }

  .ware-title b {
    overflow-wrap: anywhere;
  }

  .ware-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 8px;
  }

  .ware-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    margin-top: auto;
  }

  .ware-price {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .ware-btns {
    display: flex;
    gap: 4px;
  }

  .ware-card {
    cursor: pointer;
  }

  .ware-card:hover {
    border-color: var(--text-dim);
  }

  .ware-detail {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 280px;
  }

  .ware-detail .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
  }

  .ware-detail .section {
    margin-top: 4px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-dim);
  }

  .ware-detail .mod {
    padding-left: 8px;
  }

  .ware-detail .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .ware-detail .tag {
    font-size: 12px;
    padding: 1px 6px;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-dim);
  }

  .ware-buy {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }
</style>
