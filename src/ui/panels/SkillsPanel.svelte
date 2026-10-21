<script lang="ts">
  import { gs, game, ui } from '../state.svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { ActiveSpec, AttributeId, Milestone, TechniqueDef } from '../../core/types';
  import { STAT_NAMES } from '../../core/types';
  import { ATTRIBUTE_LIST, ATTRIBUTE_TRAINING } from '../../core/data/attributes.data';
  import { attrXpNeeded, effectiveAttrs } from '../../core/systems/attributes';
  import {
    REVEAL_FRACTION,
    skillCap,
    skillXpNeeded,
    skillTierName,
    skillTreeByCategory,
    type SkillTreeNode,
  } from '../../core/systems/skills';
  import {
    chosenFork,
    clearFork,
    entryPositions,
    forkAvailable,
    forkOptions,
    masteryTier,
    masteryTierName,
    resetTechnique,
    techniqueDisplayName,
    techniqueExecutions,
    techniqueExit,
    techniqueForm,
    techniquesUnderSkill,
  } from '../../core/systems/martial';
  import { ANY_POSITION_COLOR } from '../../core/data/martial.data';
  import type { ForkArchetypeDef, TechniqueForm } from '../../core/types';
  import { POSITIONS, SPOTS } from '../../core/registry';
  import { TRIGGER_EVENTS } from '../../core/systems/triggers';
  import { describeMod, condText, modCondition, techniqueMoveText, ticksToTime, sumMods } from '../lib/format';
  import { endowmentBonus, hasForesight, hasWayfinding, talentBonus } from '../../core/systems/legacy';
  import { trainingSpots } from '../../core/systems/actions';
  import { activityName } from '../lib/navigation';
  import GoButton from '../lib/GoButton.svelte';

  /**
   * Talent's bar under the XP bar (PRESTIGE.md §4). One lap of the bar is
   * 100% of bonus; each lap wears the next colour, starting yellow, so the
   * fill reads as "how far into this hundred" and the colour as "which
   * hundred". Wraps around the palette past the last colour.
   */
  const TALENT_LAP_COLORS = ['#e6c84a', '#f0883e', '#e5534b', '#d65db1', '#9b6ef3', '#4c8ff0', '#3fc9d6', '#57c46b', '#f2f2f2'];
  function talentBar(bonus: number): { width: number; color: string } {
    const pct = bonus * 100;
    const lap = Math.max(0, Math.ceil(pct / 100) - 1);
    return { width: pct - lap * 100, color: TALENT_LAP_COLORS[lap % TALENT_LAP_COLORS.length] };
  }
  function talentPct(bonus: number): string {
    const pct = bonus * 100;
    return pct < 1 ? pct.toFixed(2) : pct < 100 ? pct.toFixed(1) : pct.toFixed(0);
  }

  const sections = $derived(skillTreeByCategory(gs));
  const eff = $derived(effectiveAttrs(gs));

  /** Earned milestone bonuses as one readable line, e.g. "+3 Strength, +2% Strength". */
  function milestoneTotal(reached: Milestone[]): string {
    return sumMods(reached.flatMap((m) => m.bonus)) || 'none yet';
  }

  function trainingTier(attr: AttributeId, level: number): string {
    let name = '';
    for (const t of ATTRIBUTE_TRAINING[attr].tierNames) {
      if (level >= t.level) name = t.name;
    }
    return name;
  }

  // Fold state lives in the ui store so it survives leaving the tab (see the
  // note there). Arrays rather than Sets: the store is plain reactive data.
  const isOpen = (id: string) => ui.skillsOpen.includes(id);

  function toggle(id: string) {
    const at = ui.skillsOpen.indexOf(id);
    if (at >= 0) ui.skillsOpen.splice(at, 1);
    else ui.skillsOpen.push(id);
  }

  const techIsOpen = (id: string) => ui.techOpen.includes(id);

  function toggleTech(id: string) {
    const at = ui.techOpen.indexOf(id);
    if (at >= 0) ui.techOpen.splice(at, 1);
    else ui.techOpen.push(id);
  }

  /** Every skill id in a subtree — what "expand all" has to name. */
  function allIds(nodes: SkillTreeNode[]): string[] {
    return nodes.flatMap((n) =>
      n.state === 'unlocked' ? [n.def.id, ...allIds(n.children)] : [],
    );
  }

  function setSection(nodes: SkillTreeNode[], open: boolean) {
    const ids = allIds(nodes);
    // Braces are load-bearing: without them the `else` binds to the INNER if
    // and "expand" wipes the section the moment it meets an already-open row.
    if (open) {
      for (const id of ids) {
        if (!ui.skillsOpen.includes(id)) ui.skillsOpen.push(id);
      }
    } else {
      ui.skillsOpen = ui.skillsOpen.filter((id) => !ids.includes(id));
    }
  }

  /** What a folded skill is hiding, so there is a reason to open it. */
  function foldedSummary(node: SkillTreeNode): string {
    const techs = techniquesUnderSkill(gs, node.def.id).length;
    const kids = node.children.length;
    const parts: string[] = [];
    if (techs) parts.push(`${techs} 🥋`);
    if (kids) parts.push(`${kids} branch${kids === 1 ? '' : 'es'}`);
    return parts.join(' · ');
  }

  /**
   * Which rows have just taken XP, so they can flash.
   *
   * Diffed here rather than pushed from core: XP arrives in a steady trickle
   * from a dozen places (a swing, a game minute of weather, a completed job),
   * and none of them should have to know a panel is watching. Reading the
   * ledger and noticing it moved costs one pass over a few dozen numbers.
   *
   * The point is legibility for FOLDED rows especially — practice flows up the
   * parent chain, so a collapsed Fighting lighting up is how you learn that
   * the sword you are swinging is feeding it.
   */
  // A SvelteSet, not a plain one in $state: adding an id wakes only the row
  // that id belongs to. Reassigning a plain Set would invalidate every row's
  // class binding on every pulse, which with a steady XP trickle is the whole
  // panel re-checking itself several times a second.
  const gaining = new SvelteSet<string>();
  const lastXp = new Map<string, number>();

  $effect(() => {
    for (const [id, s] of Object.entries(gs.skills)) {
      const seen = lastXp.get(id);
      // A level-up resets xp toward zero, so only a RISE counts as a gain;
      // the level bar moving is its own signal. `undefined` on first pass, so
      // opening the tab does not light every row you have ever trained.
      if (seen !== undefined && s.xp > seen) gaining.add(id);
      lastXp.set(id, s.xp);
    }
  });

  function countNodes(nodes: SkillTreeNode[]): { unlocked: number; total: number } {
    let unlocked = 0;
    let total = 0;
    for (const n of nodes) {
      total += 1;
      if (n.state === 'unlocked') unlocked += 1;
      const sub = countNodes(n.children);
      unlocked += sub.unlocked;
      total += sub.total;
    }
    return { unlocked, total };
  }

  /** Entry-side identity color: the first entry position's, or the 'any' gray. */
  function entryColor(t: TechniqueDef): string {
    const from = entryPositions(gs, t);
    return from === 'any' ? ANY_POSITION_COLOR : (POSITIONS[from[0]]?.color ?? ANY_POSITION_COLOR);
  }

  /** What choosing this archetype does, for the fork button tooltip. */
  function forkText(arch: ForkArchetypeDef): string {
    const parts: string[] = [];
    if (arch.hits) parts.push(`${arch.hits} hits`);
    if (arch.damageMult) parts.push(`damage ×${arch.damageMult}`);
    if (arch.cooldownMult) parts.push(`cooldown ×${arch.cooldownMult}`);
    if (arch.splashAdd) parts.push(`+${Math.round(arch.splashAdd * 100)}% splash`);
    if (arch.durationMult) parts.push(`duration ×${arch.durationMult}`);
    if (arch.staminaMult) parts.push(`stamina ×${arch.staminaMult}`);
    if (arch.exitTo) parts.push(`exits ${POSITIONS[arch.exitTo]?.name ?? arch.exitTo}`);
    return parts.join(' · ');
  }

  // ---- DEV-only technique parameter overrides (stripped from production
  // builds with the debug panel — App only serves this in import.meta.env.DEV,
  // and the block below is compiled out the same way). ----
  const DEV = import.meta.env.DEV;
  let dbgReps = $state(1000);
  const FORMS: TechniqueForm[] = ['rough', 'canonical', 'syncretic'];
  function dbgSetReps(t: TechniqueDef, n: number) {
    const held = gs.techniques[t.id];
    if (held) held.executions = Math.max(0, Math.round(n));
  }
  function dbgSetForm(t: TechniqueDef, form: TechniqueForm) {
    const held = gs.techniques[t.id];
    if (held) held.form = form;
  }

  function techniqueTrigger(t: TechniqueDef): string | null {
    if (!t.trigger?.event && !(t.trigger?.conditions.length)) return null;
    if (t.trigger.event) {
      return TRIGGER_EVENTS.find((e) => e.id === t.trigger!.event)?.name ?? t.trigger.event;
    }
    return 'When its opening shows';
  }

  const techId = (t: TechniqueDef) => `technique:${t.id}`;
  const techniqueOn = (t: TechniqueDef) => gs.skillTriggers[techId(t)]?.enabled !== false;

  function activeSummary(spec: ActiveSpec): string {
    switch (spec.type) {
      case 'strike':
        return `${Math.round(spec.damageMult * 100)}% weapon damage · ${ticksToTime(spec.cooldown)} cooldown`;
      case 'spell':
        return `${Math.round(spec.power * 100)}% spell power${spec.damageType ? ` as ${spec.damageType}` : ''} · ${ticksToTime(spec.cooldown)} cooldown`;
      case 'buff':
        return `${spec.mods.map((m) => describeMod(m)).join(', ')} for ${ticksToTime(spec.duration)} · ${ticksToTime(spec.cooldown)} cooldown`;
      case 'gene': {
        // A body's own tool. It reads an arbitrary stat, so the stat is the
        // headline — "160% of your Armor" says more than any damage figure.
        // Two shapes: priced per point of an unbounded stat, or a flat blow
        // MULTIPLIED by a bounded one (see priceGeneAbility).
        const parts: string[] = [];
        if (spec.power !== undefined && spec.fromStat !== undefined) {
          parts.push(`${Math.round(spec.power * 100)}% of your ${STAT_NAMES[spec.fromStat]}`);
        }
        if (spec.scalesWithSpeed) parts.push('scaled by Speed');
        if (spec.amplifiedBy) parts.push(`amplified by your ${STAT_NAMES[spec.amplifiedBy]}`);
        if (spec.flat) parts.push(`+${spec.flat}`);
        if (spec.splashAll) parts.push('all enemies');
        else if (spec.splash) parts.push(`${Math.round(spec.splash * 100)}% splash`);
        if (spec.execute) parts.push('finishes the failing');
        return `${parts.join(' · ')} · ${ticksToTime(spec.cooldown)} cooldown`;
      }
    }
  }
</script>

<div class="panel">
  <h2>📜 Skills</h2>
  {#if sections.length === 0}
    <p class="dim">
      No skills yet — they manifest through action. Try sparring at the training grounds, or hunt
      something.
    </p>
  {/if}

  <!-- Shared by attribute training and regular skills: both read the same level-gated list. -->
  {#snippet milestoneLine(list: Milestone[], level: number)}
    {@const reached = list.filter((m) => level >= m.level)}
    {@const upcoming = list.find((m) => level < m.level)}
    <!-- The next milestone is news only once it is close: 90% of its level,
         or any distance once Foresight is bought. -->
    {@const next = upcoming && (hasForesight(gs) || level >= upcoming.level * REVEAL_FRACTION) ? upcoming : null}
    <div class="milestones">
      Milestones ({reached.length}/{list.length}):
      {milestoneTotal(reached)}
      {#if next}· next: {next.bonus.map((m) => describeMod(m)).join(', ')} at Lv {next.level}{/if}
    </div>
  {/snippet}

  <!-- Where to train it, with go links (the Wayfinding boon). Known ground
       only: the list grows as the map does. -->
  {#snippet trainsAt(target: { skill: string } | { attr: AttributeId })}
    {#if hasWayfinding(gs)}
      {@const spots = trainingSpots(gs, target)}
      {#if spots.length}
        <div class="trains-at">
          <span class="dim">Trains at:</span>
          {#each spots.slice(0, 6) as t (t.spot + ':' + t.activity)}
            <span class="where">
              {activityName(t.spot, t.activity)} <span class="dim">· {SPOTS[t.spot].name}</span>
              <GoButton spot={t.spot} activity={t.activity} />
            </span>
          {/each}
          {#if spots.length > 6}<span class="dim">+{spots.length - 6} more</span>{/if}
        </div>
      {/if}
    {/if}
  {/snippet}

  {#snippet skillNode(node: SkillTreeNode)}
    {@const def = node.def}
    {#if node.state === 'unlocked'}
      {@const s = gs.skills[def.id]}
      {@const tier = skillTierName(def.id, s.level)}
      {@const nodeOpen = isOpen(def.id)}
      {@const folded = foldedSummary(node)}
      {@const talent = talentBonus(gs, def.id)}
      {@const tbar = talentBar(talent)}
      <div class="skill-block">
        <!-- The glow clears itself when it finishes rather than on a timer, so
             a steady trickle of XP is a slow repeating pulse and a quiet skill
             costs nothing at all. -->
        <button
          class="row"
          class:gaining={gaining.has(def.id)}
          onanimationend={(e) => {
            if (e.target === e.currentTarget) gaining.delete(def.id);
          }}
          onclick={() => toggle(def.id)}
        >
          <span class="chev dim">{nodeOpen ? '▾' : '▸'}</span>
          <span class="s-icon">{def.icon}</span>
          <span class="name">{def.name}</span>
          {#if tier}<span class="tier small">「{tier}」</span>{/if}
          <!-- Passive is the default state of a skill; only Active is news. -->
          {#if def.kind === 'active'}<span class="chip chip-active">Active</span>{/if}
          <!-- Folded, the row still says what is inside — otherwise a branch
               with six techniques under it looks identical to a leaf. -->
          {#if !nodeOpen && folded}<span class="folded small dim">{folded}</span>{/if}
          {#if s.level >= skillCap(gs, def.id)}
            <!-- At the ceiling further XP is discarded; the ceiling itself
                 only rises through quests, events or prestige. -->
            <span class="lvl">Lv {s.level}</span>
            <span class="xp maxed" title="At its ceiling — further experience is lost. Some rewards raise it.">
              MAX
              {#if talent > 0}
                <span class="bar talent" style="height: 3px" title="Talent: +{talentPct(talent)}% gain">
                  <span class="fill" style="width: {tbar.width}%; background: {tbar.color}"></span>
                </span>
              {/if}
            </span>
          {:else}
            <span class="lvl">Lv {s.level}</span>
            <span class="xp">
              <span class="bar" style="height: 5px">
                <span
                  class="fill"
                  style="width: {(s.xp / skillXpNeeded(def.id, s.level)) * 100}%; background: var(--skill)"
                ></span>
              </span>
              <!-- Talent under XP: one lap per 100% of bonus, a new colour
                   each lap (yellow first). Absent until a past run carried
                   the skill through a prestige. -->
              {#if talent > 0}
                <span class="bar talent" style="height: 3px" title="Talent: +{talentPct(talent)}% gain">
                  <span class="fill" style="width: {tbar.width}%; background: {tbar.color}"></span>
                </span>
              {/if}
            </span>
          {/if}
        </button>
        <!-- One gate over the lot: detail, the technique roster and the child
             branches all fold together, because a skill you have collapsed is
             one you are not currently thinking about. -->
        {#if nodeOpen}
          <div class="detail small">
            <div class="byline">
              <span class="dim">{def.desc}</span>
              {#if gs.prestige.count > 0}
                <span class="talent-line" style="color: {talentBar(talentBonus(gs, def.id)).color}">
                  Talent: +{talentPct(talentBonus(gs, def.id))}% gain
                </span>
              {/if}
            </div>
            {#if def.effects?.length}
              <div class="effects">
                {#each def.effects as mod}
                  <span>
                    {describeMod(mod, s.level)}{modCondition(mod)}
                  </span>
                {/each}
              </div>
            {/if}
            {#if def.milestones?.length}
              {@render milestoneLine(def.milestones, s.level)}
            {/if}
            {#if def.active}
              <div class="active-info">⚡ {activeSummary(def.active)} — fired automatically by style priority.</div>
            {/if}
            {@render trainsAt({ skill: def.id })}
          </div>
        <!-- Learned techniques that call this skill home: the roster. Toggling
             one benches it — it leaves the combat rotation but keeps its reps.
             Each folds on its own: collapsed is one line that still names the
             flow, because the flow is how you read the graph. -->
        {#each techniquesUnderSkill(gs, def.id) as t (t.id)}
          {@const on = techniqueOn(t)}
          {@const tier = masteryTier(gs, t)}
          {@const tierName = masteryTierName(t, tier)}
          {@const rough = techniqueForm(gs, t.id) === 'rough'}
          {@const trig = techniqueTrigger(t)}
          {@const from = entryPositions(gs, t)}
          {@const exit = POSITIONS[techniqueExit(gs, t)]}
          {@const tOpen = techIsOpen(t.id)}
          <div class="technique" class:benched={!on} style="--entry-c: {entryColor(t)}">
            <div class="tech-head">
              <button class="tech-toggle" onclick={() => toggleTech(t.id)}>
                <span class="chev dim">{tOpen ? '▾' : '▸'}</span>
                <span class="s-icon">{t.icon}</span>
                <span class="tech-name">{techniqueDisplayName(gs, t)}</span>
                {#if !tOpen}
                  <!-- Icon-only pills: the whole point of the folded row is
                       that the flow still reads at a glance. -->
                  <span class="flow compact">
                    {#if from === 'any'}
                      <span class="pos-pill" style="--pc: {ANY_POSITION_COLOR}">✳</span>
                    {:else}
                      {#each from as p (p)}
                        <span class="pos-pill" style="--pc: {POSITIONS[p]?.color ?? ANY_POSITION_COLOR}">
                          {POSITIONS[p]?.icon ?? p}
                        </span>
                      {/each}
                    {/if}
                    <span class="dim">→</span>
                    <span class="pos-pill" style="--pc: {exit?.color ?? ANY_POSITION_COLOR}">
                      {exit?.icon ?? '?'}
                    </span>
                  </span>
                {:else}
                  <span class="chip chip-tech">🥋 Technique</span>
                {/if}
              </button>
              <span class="tech-reps small dim">
                {techniqueExecutions(gs, t.id)} reps{tierName ? ` · ${tierName}` : ''}{rough
                  ? ' · rough'
                  : ''}
              </span>
              <button class="tiny bench" class:on onclick={() => game.setSkillEnabled(techId(t), !on)}>
                {on ? '⚔️ In rotation' : 'Benched'}
              </button>
            </div>
            {#if tOpen}
            <div class="tech-detail small">
              <div class="dim">{t.desc}</div>
              <div class="tech-lines">
                <span class="flow">
                  {#if from === 'any'}
                    <span class="pos-pill" style="--pc: {ANY_POSITION_COLOR}">anywhere</span>
                  {:else}
                    {#each from as p (p)}
                      <span class="pos-pill" style="--pc: {POSITIONS[p]?.color ?? ANY_POSITION_COLOR}">
                        {POSITIONS[p]?.icon} {POSITIONS[p]?.name ?? p}
                      </span>
                    {/each}
                  {/if}
                  <span class="dim">→</span>
                  <span class="pos-pill" style="--pc: {exit?.color ?? ANY_POSITION_COLOR}">
                    {exit?.icon} {exit?.name ?? techniqueExit(gs, t)}
                  </span>
                </span>
                {#if trig}<span>⚡ {trig}</span>{/if}
                <span class="tech-move">{techniqueMoveText(gs, t)}</span>
              </div>
              {#if chosenFork(gs, t)}
                {@const fork = chosenFork(gs, t)!}
                <div class="fork-held">{fork.icon} {fork.name} — {fork.desc}</div>
              {:else if forkAvailable(gs, t)}
                <!-- The Honed choice: practice earned a form. Permanent. -->
                <div class="fork-choice">
                  <span class="fork-head">✨ Honed — choose its form (permanent):</span>
                  {#each forkOptions(gs, t) as arch (arch.id)}
                    <button
                      class="small fork-opt"
                      title={`${arch.desc}\n${forkText(arch)}`}
                      onclick={() => game.chooseFork(t.id, arch.id)}
                    >
                      {arch.icon} {arch.name} <span class="dim">({forkText(arch)})</span>
                    </button>
                  {/each}
                </div>
              {/if}
              {#if DEV}
                <!-- 🐞 Parameter overrides for testing thresholds/forks/forms. -->
                <div class="dbg">
                  <span class="dim">🐞</span>
                  <input type="number" min="0" max="99999" bind:value={dbgReps} title="Reps" />
                  <button class="tiny" onclick={() => dbgSetReps(t, dbgReps)}>Set reps</button>
                  {#each FORMS as f (f)}
                    <button
                      class="tiny"
                      class:on={techniqueForm(gs, t.id) === f}
                      onclick={() => dbgSetForm(t, f)}
                    >
                      {f}
                    </button>
                  {/each}
                  {#if gs.techniques[t.id]?.path}
                    <button class="tiny" onclick={() => clearFork(gs, t.id)}>Clear fork</button>
                  {/if}
                  <button class="tiny danger" onclick={() => resetTechnique(gs, t.id)}>Reset</button>
                </div>
              {/if}
            </div>
            {/if}
          </div>
        {/each}
        {#if node.children.length > 0}
          <div class="children">
            {#each node.children as child (child.def.id)}
              {@render skillNode(child)}
            {/each}
          </div>
        {/if}
        {/if}
      </div>
    {:else}
      <div class="skill-block">
        <div class="row hinted">
          <span class="chev"></span>
          <span class="s-icon">❓</span>
          <span class="name dim">???</span>
          <span class="reqs small dim">might manifest: {def.unlock.map(condText).join(', ')}</span>
        </div>
      </div>
    {/if}
  {/snippet}

  <div class="category">
    <h3>🏋️ Attributes <span class="dim small">trained like skills — bonuses shown in the sidebar</span></h3>
    <div class="cat-body">
    {#each ATTRIBUTE_LIST as attr (attr.id)}
      {@const a = gs.attrs[attr.id]}
      {@const training = ATTRIBUTE_TRAINING[attr.id]}
      {@const tier = trainingTier(attr.id, a.level)}
      {@const attrOpen = isOpen(`attr_${attr.id}`)}
      {@const effVal = Math.round(eff[attr.id])}
      {@const endowment = endowmentBonus(gs, attr.id)}
      {@const ebar = talentBar(endowment)}
      <div class="skill-block">
        <button class="row" onclick={() => toggle(`attr_${attr.id}`)}>
          <span class="chev dim">{attrOpen ? '▾' : '▸'}</span>
          <span class="s-icon">{attr.icon}</span>
          <span class="name">{training.name}</span>
          {#if tier}<span class="tier small">「{tier}」</span>{/if}
          <span class="chip">Training</span>
          <span class="lvl">Lv {a.level}</span>
          <span class="xp">
            <span class="bar" style="height: 5px">
              <span
                class="fill"
                style="width: {(a.xp / attrXpNeeded(a.level)) * 100}%; background: var(--xp)"
              ></span>
            </span>
            <!-- Endowment under XP, talent's twin: same laps, same colours. -->
            {#if endowment > 0}
              <span class="bar talent" style="height: 3px" title="Endowment: +{talentPct(endowment)}% gain">
                <span class="fill" style="width: {ebar.width}%; background: {ebar.color}"></span>
              </span>
            {/if}
          </span>
        </button>
        {#if attrOpen}
          <div class="detail small">
            <div class="byline">
              <span class="dim">{training.desc}</span>
              {#if gs.prestige.count > 0}
                <span class="talent-line" style="color: {ebar.color}">
                  Endowment: +{talentPct(endowment)}% gain
                </span>
              {/if}
            </div>
            <div class="effects">
              <span>
                Effective {attr.name}: {effVal}{effVal !== a.level ? ` (trained ${a.level})` : ''}
              </span>
            </div>
            {#if training.milestones?.length}
              {@render milestoneLine(training.milestones, a.level)}
            {/if}
            {@render trainsAt({ attr: attr.id })}
            <div class="ranks">
              {#each training.tierNames as rank (rank.level)}
                {@const reached = a.level >= rank.level}
                <div class="rank" class:reached>
                  <span class="rank-name">
                    {reached ? '✦' : '·'} {rank.name}
                    <span class="dim">(Lv {rank.level})</span>
                  </span>
                  {#if rank.bonus?.length}
                    <span class="rank-bonus" class:dim={!reached}>
                      {rank.bonus.map((m) => describeMod(m)).join(', ')}
                    </span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/each}
    </div>
  </div>

  {#each sections as section (section.category.id)}
    {@const count = countNodes(section.nodes)}
    <div class="category">
      <h3>
        {section.category.icon}
        {section.category.name}
        <span class="dim small">{count.unlocked}/{count.total}</span>
        <!-- A whole category at once — the fastest way back to a readable page. -->
        <span class="fold-all">
          <button class="tiny" onclick={() => setSection(section.nodes, true)}>Expand all</button>
          <button class="tiny" onclick={() => setSection(section.nodes, false)}>Collapse all</button>
        </span>
      </h3>
      <div class="cat-body">
        {#each section.nodes as node (node.def.id)}
          {@render skillNode(node)}
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .category {
    margin-bottom: 16px;
  }

  .category h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 4px;
    margin-bottom: 8px;
  }

  .fold-all {
    margin-left: auto;
    display: flex;
    gap: 4px;
    font-weight: 400;
  }

  /*
   * Density: each category flows its ROOT blocks into balanced columns
   * (CSS multi-column — masonry for free, no JS), and a whole tree —
   * Fighting with every school under it — stays together in one column via
   * break-inside. Rows themselves are slimmed: a skill is one thin line,
   * detail on demand.
   */
  .cat-body {
    columns: 2 360px;
    column-gap: 10px;
  }

  .cat-body > .skill-block {
    break-inside: avoid;
    margin-bottom: 6px;
  }

  .skill-block {
    margin-bottom: 1px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px 8px;
    text-align: left;
    font-size: 13.5px;
  }

  /*
   * A row that just took XP: a soft bloom that fades out, nothing else. The
   * glow lives on a pseudo-element whose OPACITY animates — the shadow itself
   * is painted once and the fade runs on the compositor, so a dozen rows
   * pulsing costs no layout and no repaint. Animating box-shadow directly
   * would repaint the row every frame instead.
   */
  .row {
    position: relative;
  }

  .row.gaining::after {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: 6px;
    pointer-events: none;
    box-shadow: 0 0 8px 1px color-mix(in srgb, var(--xp) 32%, transparent);
    animation: xp-glow 900ms ease-out forwards;
  }

  @keyframes xp-glow {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  /*
   * Anyone who would rather not have things pulsing at them. The animation
   * still RUNS (instantly) so animationend fires and the class is cleared —
   * `animation: none` would leave the glow stuck on forever.
   */
  @media (prefers-reduced-motion: reduce) {
    .row.gaining::after {
      animation-duration: 1ms;
    }
  }

  .row.hinted {
    opacity: 0.65;
    border-style: dashed;
    cursor: default;
  }

  .chev {
    width: 12px;
    flex-shrink: 0;
  }

  .s-icon {
    flex-shrink: 0;
  }

  .name {
    font-weight: 600;
    white-space: nowrap;
  }

  .tier {
    color: var(--accent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chip {
    font-size: 10.5px;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1px 7px;
    color: var(--text-dim);
    flex-shrink: 0;
  }

  .chip-active {
    color: var(--accent);
    border-color: var(--accent);
  }

  .lvl {
    margin-left: auto;
    color: var(--accent);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .xp {
    width: 64px;
    flex-shrink: 0;
  }

  .xp .bar {
    display: block;
    position: relative;
    background: var(--bg-sunken);
    border-radius: 3px;
    overflow: hidden;
  }

  .xp .fill {
    display: block;
    height: 100%;
    border-radius: 3px;
  }

  .xp .bar.talent {
    margin-top: 2px;
  }

  .byline {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
  }

  .talent-line {
    white-space: nowrap;
    flex-shrink: 0;
  }

  .xp.maxed {
    text-align: center;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: var(--skill);
  }

  .reqs {
    margin-left: auto;
    text-align: right;
  }

  .detail {
    padding: 6px 10px 8px 30px;
  }

  .effects {
    margin-top: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 3px 14px;
    color: var(--xp);
  }

  .active-info {
    margin-top: 4px;
    color: var(--accent);
  }

  .trains-at {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-top: 4px;
  }

  .trains-at .where {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .milestones {
    margin-top: 4px;
    color: var(--xp);
  }

  .ranks {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rank {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    opacity: 0.55;
  }

  .rank.reached {
    opacity: 1;
  }

  .rank.reached .rank-name {
    color: var(--accent);
  }

  .rank-bonus {
    color: var(--xp);
    text-align: right;
    white-space: nowrap;
  }

  .children {
    margin-left: 12px;
    padding-left: 7px;
    border-left: 2px solid var(--border);
    margin-top: 1px;
  }

  /* A technique row under its home skill: part of the tree, but visibly a
     move rather than a skill — no level, no XP bar, a bench switch instead.
     The left edge wears its entry position's color, same as its pills. */
  .technique {
    margin: 2px 0 2px 19px;
    padding: 3px 8px 5px;
    border: 1px solid var(--border);
    border-left: 3px solid var(--entry-c, var(--accent));
    border-radius: 6px;
    background: var(--bg-raised);
  }

  .technique.benched {
    opacity: 0.55;
    border-left-color: var(--border);
  }

  .flow {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 3px;
  }

  .pos-pill {
    display: inline-block;
    padding: 0 6px 1px;
    border: 1px solid var(--pc);
    border-radius: 999px;
    background: color-mix(in srgb, var(--pc) 16%, transparent);
    font-size: 10.5px;
    line-height: 1.5;
    white-space: nowrap;
    color: var(--text);
  }

  .tech-head {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
  }

  /* The fold handle takes the row's slack so the whole line is clickable,
     while the reps readout and the bench switch stay put on the right. */
  .tech-toggle {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 7px;
    background: none;
    border: none;
    padding: 2px 0;
    text-align: left;
    font: inherit;
    color: inherit;
  }

  .tech-name {
    font-weight: 600;
    white-space: nowrap;
  }

  /* Folded: icon-only pills, so the flow still reads without the words. */
  .flow.compact .pos-pill {
    padding: 0 4px 1px;
    font-size: 11px;
  }

  .chip-tech {
    color: var(--stamina, var(--accent));
    border-color: var(--stamina, var(--accent));
  }

  .tech-reps {
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* What a folded skill is hiding, sat next to its name. */
  .folded {
    white-space: nowrap;
  }

  .tiny.bench {
    padding: 1px 8px;
    font-size: 11px;
    flex-shrink: 0;
  }

  .tiny.bench.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--bg-raised));
  }

  .tech-detail {
    padding: 2px 2px 0 22px;
  }

  .tech-lines {
    margin-top: 2px;
    display: flex;
    flex-wrap: wrap;
    gap: 2px 14px;
    color: var(--xp);
  }

  .tech-move {
    color: var(--accent);
  }

  .fork-held {
    margin-top: 3px;
    color: var(--accent);
  }

  .fork-choice {
    margin-top: 4px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
  }

  .fork-head {
    color: var(--xp);
    font-weight: 600;
  }

  .fork-opt {
    border-color: var(--accent);
  }

  .dbg {
    margin-top: 5px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    opacity: 0.85;
  }

  .dbg input {
    width: 70px;
    font: inherit;
    font-size: 11.5px;
    color: var(--text);
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 1px 5px;
  }

  .tiny {
    padding: 1px 6px;
    font-size: 11px;
    line-height: 1.4;
  }

  .tiny.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--bg-raised));
  }

  .tiny.danger {
    border-color: var(--danger, #e05555);
  }

  .tier {
    max-width: 150px;
  }

  .detail {
    padding: 4px 8px 6px 24px;
  }
</style>
