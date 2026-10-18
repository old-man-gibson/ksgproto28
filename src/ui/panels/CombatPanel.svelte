<script lang="ts">
  import { gs, game, stepTicks, stepEvent, ui, view } from '../state.svelte';
  import { dropFight } from '../../core/systems/ledger';
  import { ITEMS, POSITIONS, RARITIES, SKILLS, STATUSES, STYLES, TECHNIQUES, TIERS, getSpot } from '../../core/registry';
  import { ANY_POSITION_COLOR, MAX_DRILLED, NEUTRAL_POSITION } from '../../core/data/martial.data';
  import {
    entryPositions,
    isDrilled,
    knownPositions,
    knownTechniques,
    masteryTier,
    masteryTierName,
    repsToNextTier,
    resolvedMove,
    techniqueDisplayName,
    techniqueExecutions,
    techniqueExit,
    techniqueForm,
    techniqueStatus,
    type TechniqueStatus,
  } from '../../core/systems/martial';
  import type { TechniqueDef } from '../../core/types';
  import {
    MONSTER_ACTION_BAR,
    POSITION_MODS,
    activeRotation,
    eligibleEncounters,
    spotCleared,
  } from '../../core/systems/combat';
  import { GENE_ACTIVE, expressedGene, geneAbility } from '../../core/systems/mutagens';
  import { monsterStats } from '../../core/systems/monsterStats';
  import { resourceLock } from '../../core/systems/resources';
  import { huntRest, restTarget, restingForFight } from '../../core/systems/huntrest';
  import { hpFraction } from '../../core/systems/health';
  import { escalationPrimed, statusForcingStyle, visibleStatuses } from '../../core/systems/statuses';
  import { STAT_NAMES, type MonsterInstance } from '../../core/types';
  import { styleUnlocked, styleSlots, effectiveStyleDef, stanceIdFor } from '../../core/systems/styles';
  import { TRIGGER_EVENTS, describeCondition } from '../../core/systems/triggers';
  import type { StyleSlot } from '../../core/systems/styles';
  import type { CombatStyleDef, DamageReport, LogTally } from '../../core/types';
  import {
    fmt,
    pct,
    ticksToTime,
    condsText,
    damageTipLines,
    describeMod,
    exertionLines,
    geneAbilityLanded,
    geneAbilityLines,
    modCondition,
    specLines,
    statusTipLines,
    targetLabel,
    techniqueMoveText,
  } from '../lib/format';
  import {
    canCastUtility,
    findSpell,
    isUtilityWorking,
    resolveSpell,
    utilityCooldown,
  } from '../../core/systems/spellcraft';
  import { renderLine } from '../../core/systems/log';
  import { TPS } from '../../core/engine/loop';
  import Tip from '../lib/Tip.svelte';
  import EntryConfigModal from '../lib/EntryConfigModal.svelte';
  import MartialPlanner from './MartialPlanner.svelte';

  /**
   * The rows of an affliction total worth drawing.
   *
   * Totals accumulate at full precision and round only for display, so a run
   * that has just started reads "0 poisoned" for its first few ticks — true,
   * and no use to anybody. A row appears once it has something to report.
   */
  const tallied = (tally: LogTally[]) => tally.filter((t) => Math.round(t.qty) !== 0);

  /** Which book an entry came out of — the whole word, in one glyph. */
  const SCHOOL_MARK: Record<string, string> = {
    arcane: '📖',
    divine: '⛩️',
    psionic: '🧠',
  };

  /**
   * One rotation entry, resolved for the card. An entry is a skill id, a
   * prepared grimoire spell (`grimoire:<uid>`) or a martial technique
   * (`technique:<id>`); all are ordered, triggered and toggled the same way,
   * so this resolves whichever identity the id carries into the same shape.
   *
   * `mark` + `cost` are the card's second line: the school glyph says what
   * kind of thing this is (the word "spell" is redundant beside 📖), and the
   * cost says what a cast takes. Durations never appear here — they are a
   * tooltip's job (⌛), because they answer a different question than "when
   * can I do this again?".
   */
  interface RotationEntry {
    icon: string;
    name: string;
    /** School glyph, or 🥋 for a technique. */
    mark: string;
    /** Cost (spells) or banked reps (techniques). Empty when there is none. */
    cost: string;
    /** Base cooldown in ticks — the right-hand slot when nothing is blocking. */
    cooldown?: number;
    /** Ticks left on a wind-up still being spoken, when one is (see `whenText`). */
    speaking?: number;
  }

  function rotationEntry(id: string): RotationEntry | null {
    if (id.startsWith('grimoire:')) {
      const spell = findSpell(gs, Number(id.slice('grimoire:'.length)));
      if (!spell) return null;
      const spec = resolveSpell(spell);
      // Each school spends its own pool — list only what this working costs.
      const costs = spec.manaCost > 0 ? [`💧${spec.manaCost}`] : [];
      if (spec.focusCost) costs.push(`🧠${spec.focusCost.toFixed(1)}`);
      if (spec.staminaCost) costs.push(`🫁${pct(spec.staminaCost, 0)}`);
      return {
        icon: spec.icon,
        name: spec.name,
        mark: SCHOOL_MARK[spec.school] ?? '📖',
        cost: costs.join(' '),
        cooldown: spec.cooldown,
      };
    }
    if (id.startsWith('technique:')) {
      const def = TECHNIQUES[id.slice('technique:'.length)];
      if (!def) return null;
      const move = resolvedMove(gs, def);
      // Reps are the technique's currency the way mana is a spell's: what the
      // move has cost you so far, and what it is still buying.
      return {
        icon: def.icon,
        name: techniqueDisplayName(gs, def),
        mark: '🥋',
        cost: fmt(techniqueExecutions(gs, def.id)),
        cooldown: move.cooldown,
      };
    }
    // The body's own tool. It is not a skill, so it has no SKILLS entry to look
    // itself up in — without this branch the row resolves to null and the whole
    // ability is invisible here even while it fires perfectly well in the fight.
    if (id === GENE_ACTIVE) {
      const ability = geneAbility(gs);
      if (!ability) return null;
      const landed = geneAbilityLanded(gs);
      return {
        icon: ability.icon,
        name: ability.name,
        mark: '🧬',
        // A gene's tool costs nothing, so the slot every other row spends on
        // mana or reps was blank. What belongs there is the figure the player
        // is actually ordering the rotation around — and it moves with the
        // chromosome, which is the only place routing shows up on an ability.
        cost: landed === null ? '' : `🗡️ ${fmt(landed)}`,
        cooldown: ability.spec.cooldown,
        // A wind-up stamps its cooldown the instant it begins, so the card read
        // as a spent ability while the blow was still three seconds out. The
        // pending clock is the truer answer and takes precedence below.
        speaking:
          gs.combat?.incantAt !== undefined
            ? Math.max(0, gs.combat.incantAt - gs.totalTicks)
            : undefined,
      };
    }
    const skill = SKILLS[id];
    return skill ? { icon: skill.icon, name: skill.name, mark: '', cost: '' } : null;
  }

  /**
   * The card's right-hand answer to "when does this go off?". A live blocker
   * wins (cooldown counting down, a position you are not in, a reflex with
   * nothing to answer); with nothing in the way it falls back to the move's
   * own cadence, which is the honest answer out of combat.
   */
  function whenText(
    status: TechniqueStatus | null,
    cd: number,
    off: boolean,
    base?: number,
    speaking?: number,
  ): string {
    if (off) return 'off';
    // A word still being said outranks the cooldown it already stamped: the
    // cooldown answers "when can you do this again", and the honest answer to
    // "what is happening" is that the blow has not landed yet.
    if (speaking !== undefined && speaking > 0) return `still speaking — ${ticksToTime(speaking)}`;
    if (cd > 0) return `⟳ ${ticksToTime(cd)}`;
    if (status && status.kind !== 'ready' && status.kind !== 'cooldown') {
      return status.kind === 'primed' ? 'primed' : statusText(status);
    }
    return base !== undefined ? `⟳ ${ticksToTime(base)}` : 'ready';
  }

  /** The drill line for a technique card: practice count, tier, drilled state. */
  function techniqueOf(id: string) {
    return id.startsWith('technique:') ? (TECHNIQUES[id.slice('technique:'.length)] ?? null) : null;
  }

  function spellOf(id: string) {
    return id.startsWith('grimoire:')
      ? (findSpell(gs, Number(id.slice('grimoire:'.length))) ?? null)
      : null;
  }

  /** Entry-side identity color: the first entry position's, or the 'any' gray. */
  function entryColor(t: TechniqueDef): string {
    const from = entryPositions(gs, t);
    return from === 'any' ? ANY_POSITION_COLOR : (POSITIONS[from[0]]?.color ?? ANY_POSITION_COLOR);
  }

  function exitColor(t: TechniqueDef): string {
    return POSITIONS[techniqueExit(gs, t)]?.color ?? ANY_POSITION_COLOR;
  }

  /** The card's left→right tint: enters on its entry color, leaves on its exit color. */
  function flowGradient(t: TechniqueDef): string {
    const from = `color-mix(in srgb, ${entryColor(t)} 15%, transparent)`;
    const to = `color-mix(in srgb, ${exitColor(t)} 15%, transparent)`;
    return `background: linear-gradient(90deg, ${from}, transparent 34%, transparent 66%, ${to});`;
  }

  /** Short phrases for "waiting for <event>" on a reactive technique's card. */
  const EVENT_SHORT: Record<string, string> = {
    onHit: 'a hit',
    onCrit: 'a crit',
    onParry: 'a parry',
    onDodge: 'a dodge',
    onEncounterStart: 'the bell',
  };

  /**
   * The card's answer to "what is this waiting for?", squeezed to fit one
   * line beside the name — ⏳ carries the "waiting" and the detail follows.
   * The unabbreviated version is the tooltip's and the config window's job.
   */
  /** What each weapon-state gate is missing, squeezed and spelled out. */
  type StateNeed = 'wielded' | 'grounded' | 'sheathed' | 'impaled' | 'readied';
  const STATE_SHORT: Record<StateNeed, string> = {
    wielded: 'no weapon',
    grounded: 'none down',
    sheathed: 'none hidden',
    impaled: 'none stuck',
    readied: 'none held',
  };
  const STATE_LONG: Record<StateNeed, string> = {
    wielded: 'Needs a weapon in hand.',
    grounded: 'Nothing grounded to take up.',
    sheathed: 'Needs a blade sheathed.',
    impaled: 'Nothing buried in anything to tear out.',
    readied: 'Needs a working held ready.',
  };

  function statusText(s: TechniqueStatus): string {
    switch (s.kind) {
      case 'off': return 'off';
      case 'unarmed': return `needs ${s.family}`;
      case 'state': return STATE_SHORT[s.needs];
      case 'cooldown': return ticksToTime(s.ticks);
      // The pills already name the entries; the hourglass says "not there yet".
      case 'position': return `⏳ ${s.from.map((p) => POSITIONS[p]?.icon ?? p).join('')}`;
      case 'trigger': return `⏳ ${s.event ? (EVENT_SHORT[s.event] ?? s.event) : 'its moment'}`;
      case 'gated': return 'held';
      case 'primed': return 'primed';
      default: return 'ready';
    }
  }

  /** The same answer, spelled out — for the card's tooltip. */
  function statusLong(s: TechniqueStatus): string {
    switch (s.kind) {
      case 'state': return STATE_LONG[s.needs];
      case 'position':
        return `Waiting to be ${s.from.map((p) => POSITIONS[p]?.name ?? p).join(' or ')}.`;
      case 'trigger':
        return `Waiting for ${s.event ? (EVENT_SHORT[s.event] ?? s.event) : 'its moment'}.`;
      case 'gated': return 'Held back by your own conditions.';
      default: return '';
    }
  }

  // The position strip: the graph made visible. Techniques badge the position
  // they enter from; 'any'-entry reflexes get their own line.
  const knownTechs = $derived(knownTechniques(gs));
  const curPos = $derived(gs.combat?.position ?? NEUTRAL_POSITION);
  function entrantsOf(posId: string): TechniqueDef[] {
    return knownTechs.filter((t) => {
      const from = entryPositions(gs, t);
      return from !== 'any' && from.includes(posId);
    });
  }
  const anywhere = $derived(knownTechs.filter((t) => entryPositions(gs, t) === 'any'));
  /** The working currently held ready, if any (the magiknight seat). */
  const readied = $derived.by(() => {
    const uid = gs.combat?.readiedSpell;
    const spell = uid ? findSpell(gs, uid) : null;
    return spell ? resolveSpell(spell) : null;
  });

  // ---- Loadouts ----
  let loadoutName = $state('');
  function saveLoadout() {
    game.saveLoadout(loadoutName);
    loadoutName = '';
  }

  // ---- Drag and drop ----
  let dragging = $state<string | null>(null);
  let dropTarget = $state<string | null>(null);

  function onDrop(beforeId: string | null) {
    if (dragging) game.moveSkillTo(dragging, beforeId);
    dragging = null;
    dropTarget = null;
  }

  const spot = $derived(getSpot(gs.spot));
  const canHunt = $derived(spot.activities.some((a) => a.kind === 'hunt'));
  // A finite spot with its budget spent, or a table with every line gated or
  // already slain: the hunt is willing, but nobody is coming.
  const cleared = $derived(spotCleared(gs, spot));
  const nobodyLeft = $derived(!cleared && canHunt && eligibleEncounters(gs, spot).length === 0);
  /** Actives in the order they'll actually be considered. */
  const rotation = $derived(activeRotation(gs));
  /**
   * The rotation as the panel actually shows it: benched techniques live under
   * their skill in the Skills tab, so they are hidden here — and every index,
   * arrow and drop target below works on THIS list, never on the full order.
   * (Reordering still writes through moveSkillTo, which moves an entry
   * relative to a visible neighbour and lets hidden ones travel along.)
   */
  const visibleRotation = $derived(
    rotation.filter((id) => {
      const tech = techniqueOf(id);
      return !(tech && gs.skillTriggers[id]?.enabled === false);
    }),
  );
  // One button per stance, always in the same place. A manifested school takes
  // over its stance's slot for as long as its weapon is held — no extra list.
  const slots = $derived(styleSlots(gs));
  const effective = $derived(effectiveStyleDef(gs));
  const stats = $derived(view.stats);

  /**
   * The stance wheel, row-major. Aggression sits at the top and defence at the
   * bottom (Frenzy opposite Brace); weight sits left and speed right (Cleave
   * opposite Flurry). Each corner is the blend of the two edges it touches,
   * and Neutral holds the middle.
   */
  const STANCE_GRID = [
    'crush', 'aggressive', 'quick',
    'cleave', 'balanced', 'multi',
    'finesse', 'defensive', 'evasive',
  ];
  /** Ramping stance bonus built up in the current fight (Quick, Ittou-ryu). */
  const momentum = $derived(gs.combat?.momentum ?? 0);
  const staminaLock = $derived(resourceLock(gs, 'stamina'));
  // A condition can take your footing away. When one has, the grid says so:
  // the stance you are actually locked into wears that condition's colour, the
  // one you PICKED keeps its usual highlight (it is still what you go back to),
  // and everything else greys out because none of it is available to you.
  const forcing = $derived(statusForcingStyle(gs));
  const forcedStance = $derived(forcing ? stanceIdFor(forcing.style) : null);
  const forcedColor = $derived(forcing?.def.color ?? 'var(--danger)');

  /** Which rotation entry has its config window open (see EntryConfigModal). */
  let configId = $state<string | null>(null);

  /** Ticks the last "Next line" step covered — the gap between two fight events. */
  let lastStep = $state<number | null>(null);
  let notebookOpen = $state(false);

  function schoolLevel(style: CombatStyleDef): number {
    return style.skill ? (gs.skills[style.skill]?.level ?? 0) : 0;
  }
</script>

{#snippet styleTip(slot: StyleSlot)}
  {@const unlocked = styleUnlocked(gs, slot.stance)}
  {@const style = slot.active}
  {@const level = schoolLevel(style)}
  <div class="tip-line tip-base">{style.desc}</div>
  {#each style.mods as mod}
    <div class="tip-line">{describeMod(mod, level)}{modCondition(mod)}</div>
  {/each}
  <div class="tip-line tip-sub">Exertion:</div>
  {#each exertionLines(style.exertion, level) as line}
    <div class="tip-line">{line}</div>
  {/each}
  {#if style.skill}
    <div class="tip-line tip-sub">
      Scales with {SKILLS[style.skill]?.name ?? style.skill} — Lv {level}
    </div>
  {/if}
  {#if style.replaces}
    <div class="tip-line tip-total">
      Your {STYLES[style.replaces]?.name ?? style.replaces} stance, mastered — it reverts if your
      loadout changes.
    </div>
  {/if}
  {#if !unlocked}
    <div class="tip-line tip-total">🔒 Requires {condsText(slot.stance.unlock)}</div>
  {/if}
{/snippet}

{#snippet styleButton(slot: StyleSlot)}
  {@const unlocked = styleUnlocked(gs, slot.stance)}
  {@const forced = forcedStance === slot.stance.id}
  {@const picked = gs.style === slot.stance.id}
  <button
    class="stance"
    class:selected={picked}
    class:school={!!slot.active.replaces}
    class:forced
    class:overridden={!!forcedStance && !forced && !picked}
    style={forced ? `--forced: ${forcedColor}` : undefined}
    disabled={!unlocked}
    onclick={() => game.setStyle(slot.stance.id)}
  >
    <span class="stance-icon">{unlocked ? slot.active.icon : '🔒'}</span>
    <span class="stance-name">{slot.active.name}</span>
    {#if forced}<span class="forced-mark">{forcing?.def.icon}</span>{/if}
  </button>
{/snippet}

{#snippet enemyTip(m: MonsterInstance, position: 'front' | 'back')}
  {@const mod = POSITION_MODS[position][m.range]}
  <div class="tip-line tip-base">
    {m.icon} {m.name} — Lv {m.level}{TIERS[m.tier].name ? ` · ${TIERS[m.tier].name}` : ''}
  </div>
  <div class="tip-line">
    {m.range === 'ranged' ? '🏹 Ranged' : '⚔ Melee'} · {position === 'front' ? 'front row' : 'back row'}
  </div>
  {#if mod.damage !== 1 || mod.fill !== 1}
    <div class="tip-line tip-sub">
      Out of place: {Math.round((1 - mod.damage) * 100)}% less damage, {Math.round((1 - mod.fill) * 100)}% slower
    </div>
  {:else if mod.stunPerTick > 0}
    <div class="tip-line tip-sub">Jostled up close — its attacks keep getting delayed</div>
  {:else}
    <div class="tip-line tip-sub">Well placed — fighting at full effect</div>
  {/if}
  <div class="tip-line tip-total">{fmt(Math.max(0, m.hp))} / {fmt(monsterStats(m).maxHp)} HP</div>
{/snippet}

<!-- A technique's flow as colored pills: entry position(s) → exit position.
     The same colors mark the strip chips and card tints, so "this card's right
     edge matches that card's left edge" IS the chain, at a glance. Icons only
     — a card is one line, and the names are a hover (or a click) away. -->
{#snippet flowPills(t: TechniqueDef)}
  {@const from = entryPositions(gs, t)}
  {@const exit = POSITIONS[techniqueExit(gs, t)]}
  <span class="flow small">
    {#if from === 'any'}
      <span class="pos-pill" style="--pc: {ANY_POSITION_COLOR}" title="From anywhere">any</span>
    {:else}
      {#each from as p (p)}
        <span
          class="pos-pill"
          style="--pc: {POSITIONS[p]?.color ?? ANY_POSITION_COLOR}"
          title="Enters from {POSITIONS[p]?.name ?? p}">{POSITIONS[p]?.icon}</span
        >
      {/each}
    {/if}
    <span class="dim">→</span>
    <span
      class="pos-pill"
      style="--pc: {exit?.color ?? ANY_POSITION_COLOR}"
      title="Leaves you {exit?.name ?? techniqueExit(gs, t)}">{exit?.icon}</span
    >
  </span>
{/snippet}

<!-- Where one damage number came from: the swing, its types, and what the
     target's armor and resistances took out of it. -->
{#snippet damageTip(report: DamageReport)}
  {#each damageTipLines(report) as line}
    <div
      class="tip-line"
      class:tip-base={line.kind === 'base'}
      class:tip-sub={line.kind === 'sub'}
      class:tip-note={line.kind === 'note'}
      class:tip-total={line.kind === 'total'}
    >
      {line.text}
    </div>
  {/each}
{/snippet}

{#snippet centreCard(m: MonsterInstance)}
  <Tip block>
    <div>
      <h3 style="color: {RARITIES[m.rarity].color}">
        {m.icon} {m.name}
        <span class="dim">Lv {m.level}{TIERS[m.tier].name ? ` · ${TIERS[m.tier].name}` : ''}</span>
        <span class="reach">{m.range === 'ranged' ? '🏹' : '⚔'}</span>
      </h3>
      <div class="bar" style="height: 16px">
        <div class="fill" style="width: {(m.hp / monsterStats(m).maxHp) * 100}%; background: var(--hp)"></div>
        <div class="label">{fmt(Math.max(0, m.hp))} / {fmt(monsterStats(m).maxHp)}</div>
      </div>
      {#if visibleStatuses(m).length}
        <div class="foe-afflictions">
          {#each visibleStatuses(m) as held (held.id)}
            <Tip>
              <span class="affliction" class:primed={escalationPrimed(m, held)}>{STATUSES[held.id].icon} {STATUSES[held.id].name}{#if held.stacks > 1}<span class="stacks">×{held.stacks}</span>{/if}</span>
              {#snippet tip()}
                {#each statusTipLines(m, held) as line, i}
                  <div class="tip-line" class:tip-base={i === 0} class:tip-sub={line.startsWith('—')}>{line}</div>
                {/each}
              {/snippet}
            </Tip>
          {/each}
        </div>
      {/if}
      <div class="bar action-bar">
        <div
          class="fill"
          style="width: {Math.min(100, (m.bar / MONSTER_ACTION_BAR) * 100)}%; background: var(--action)"
        ></div>
      </div>
    </div>
    {#snippet tip()}{@render enemyTip(m, 'front')}{/snippet}
  </Tip>
{/snippet}

{#snippet flankSlot(m: MonsterInstance | null)}
  <div class="flank-slot" class:empty={!m}>
    {#if m}
      <Tip block>
        <div>
          <div class="flank-head">
            <span class="flank-name">{m.icon} {m.name}</span>
            <span class="reach">{m.range === 'ranged' ? '🏹' : '⚔'}</span>
          </div>
          <div class="bar flank-bar">
            <div class="fill" style="width: {(m.hp / monsterStats(m).maxHp) * 100}%; background: var(--hp)"></div>
          </div>
          {#if visibleStatuses(m).length}
            <div class="flank-afflictions">
              {#each visibleStatuses(m) as held (held.id)}<span title={STATUSES[held.id].name}>{STATUSES[held.id].icon}</span>{/each}
            </div>
          {/if}
          <div class="bar flank-action">
            <div
              class="fill"
              style="width: {Math.min(100, (m.bar / MONSTER_ACTION_BAR) * 100)}%; background: var(--action)"
            ></div>
          </div>
        </div>
        {#snippet tip()}{@render enemyTip(m, 'back')}{/snippet}
      </Tip>
    {/if}
  </div>
{/snippet}

<div class="loadout">
<div class="panel">
  <h3>Combat Style</h3>
  <!-- The wheel: aggression up, defence down, heavy left, fast right, and
       Neutral in the middle. Neighbours share an instinct; opposites don't. -->
  <div class="stance-grid">
    {#each STANCE_GRID as id (id)}
      {@const slot = slots.find((s) => s.stance.id === id)}
      {#if slot}
        <Tip>
          {@render styleButton(slot)}
          {#snippet tip()}{@render styleTip(slot)}{/snippet}
        </Tip>
      {/if}
    {/each}
  </div>

  {#if forcing}
    <div class="forced-note" style="--forced: {forcedColor}">
      {forcing.def.icon} {forcing.def.name} — you are locked into
      {STYLES[forcedStance!]?.name ?? forcedStance}. Your stance returns when it does.
    </div>
  {/if}

  <!-- Fighting always costs a trickle; this is the switch for spending real
       reserves on what the stance can buy. -->
  <Tip block>
    <button class="exert" class:on={gs.exerting} onclick={() => game.setExerting(!gs.exerting)}>
      <span class="exert-mark">{gs.exerting ? '🔥' : '🍃'}</span>
      <span>
        <b>{gs.exerting ? 'Exerting' : 'Holding back'}</b>
        <span class="dim small">
          {#if !effective.exertion}
            — this stance has nothing to buy
          {:else if effective.exertion.drain}
            — {gs.exerting ? 'every blow empties the bar' : 'click to spend everything per blow'}
          {:else}
            — {gs.exerting ? 'spending' : 'click to spend'}
            {pct(effective.exertion.cost)} stamina per {effective.exertion.on === 'attack'
              ? 'attack'
              : 'blow taken'}
          {/if}
        </span>
      </span>
    </button>
    {#snippet tip()}
      <div class="tip-line tip-base">
        Swinging always costs a little stamina — less than you recover, so plain fighting keeps
        pace. Exerting spends real reserves for what your stance can buy.
      </div>
      {#each exertionLines(effective.exertion, schoolLevel(effective)) as line}
        <div class="tip-line">{line}</div>
      {/each}
      <div class="tip-line tip-total">
        Payoff ×{stats.staminaPower.toFixed(2)} · cost ×{stats.staminaEff.toFixed(2)}
      </div>
    {/snippet}
  </Tip>

  <!-- Concealed carry: only daggers sheathe. While hidden you are genuinely
       unarmed — tags, schools and stats all read bare hands. -->
  {#if gs.sheathed || (gs.equipment.weapon && (ITEMS[gs.equipment.weapon.defId]?.tags ?? []).includes('dagger'))}
    <button class="exert sheathe" class:on={!!gs.sheathed} onclick={() => game.toggleSheathe()}>
      <span class="exert-mark">{gs.sheathed ? '🫥' : '🔪'}</span>
      <span>
        <b>{gs.sheathed ? 'Concealed' : 'Carrying openly'}</b>
        <span class="dim small">
          {#if gs.sheathed}
            — {ITEMS[gs.sheathed.defId]?.name} hidden; you fight bare-handed until it matters
          {:else}
            — click to sheathe the dagger and fight as unarmed
          {/if}
        </span>
      </span>
    </button>
  {/if}

  <p class="dim small">
    {effective.desc}
    {#if effective.replaces}
      <span class="fallback">— this stance has become {effective.name} in your hands.</span>
    {/if}
  </p>
  <!-- Live stamina bargain: what the stance is (or isn't) buying right now. -->
  {#if staminaLock === 'empty'}
    <p class="small exhausted">
      🥵 Spent — every action bar fills 15% slower, and nothing is spent until your stamina is full.
    </p>
  {:else if staminaLock === 'low'}
    <p class="small winded">
      😮‍💨 Winded — fighting on technique alone until your stamina bar fills back up.
    </p>
  {/if}
  {#if effective.exertion?.ramp && momentum > 0}
    <p class="small momentum">
      ⏫ Momentum: +{pct(momentum)}
      {STAT_NAMES[effective.exertion.ramp.stat]} this fight (cap +{pct(effective.exertion.ramp.cap)})
    </p>
  {/if}
  <!-- The position strip: where the last exchange left you, and which known
       techniques enter from each position — the technique graph at a glance. -->
  {#if knownTechs.length > 0}
    <div class="pos-strip">
      {#each knownPositions(gs) as p (p.id)}
        {@const entrants = entrantsOf(p.id)}
        <Tip>
          <div class="pos-chip" class:current={!!gs.combat && curPos === p.id} style="--posc: {p.color}">
            <span class="pos-icon">{p.icon}</span>
            <span class="pos-name">{p.name}</span>
            <span class="pos-badges">
              {#each entrants as t (t.id)}{t.icon}{/each}
            </span>
          </div>
          {#snippet tip()}
            <div class="tip-line tip-base">{p.desc}</div>
            {#each entrants as t (t.id)}
              <div class="tip-line">
                {t.icon} {t.name} fires from here → {POSITIONS[t.to]?.name ?? t.to}
              </div>
            {/each}
            {#if entrants.length === 0}
              <div class="tip-line tip-sub">No known technique enters from here.</div>
            {/if}
            {#if gs.combat && curPos === p.id}
              <div class="tip-line tip-total">You are here. A plain swing recovers to Neutral.</div>
            {/if}
          {/snippet}
        </Tip>
      {/each}
    </div>
    {#if anywhere.length > 0}
      <p class="dim small anywhere">
        reflexes from anywhere:
        {#each anywhere as t (t.id)}<span title={t.name}> {t.icon}</span>{/each}
      </p>
    {/if}
    <!-- A working held at the edge of release: what it is, and the standing
         reminder that walking out of the seat loses it. -->
    {#if readied}
      <p class="small readied">
        🔮 Holding <b>{readied.name}</b> — a plain swing lets it go.
      </p>
    {/if}
    {#if gs.combat?.impaled}
      <p class="small grounded">
        🗡 Your {ITEMS[gs.combat.impaled.defId]?.name ?? 'weapon'} is buried in something.
      </p>
    {/if}
    {#if gs.combat?.grounded}
      <p class="small grounded">
        🤲 Your {ITEMS[gs.combat.grounded.defId]?.name ?? 'weapon'} lies in the dirt.
      </p>
    {/if}
  {/if}
</div>

<!-- Active skills — always listed, in rotation order, each configurable. -->
<div class="panel actives-panel">
  <h3>Active Skills</h3>
  {#if rotation.length === 0}
    <p class="dim small">No active skills learned yet — they manifest as you fight.</p>
  {:else}
    <p class="dim small hint">
      Fired top-down — drag a card to reorder. Click one to set when it fires; hover for the
      details. 🏋️ drills a technique — {MAX_DRILLED} slots, and only drilled ones bank reps.
      Benched techniques live under their skill in the Skills tab.
    </p>

    <!-- Loadouts: a whole fighting identity under one name — order, bench
         switches, drills, trigger conditions, prepared spells and worn gear.
         Applying one grants nothing: unknown entries stay inert. -->
    <div class="loadouts small">
      <span class="dim">Loadouts:</span>
      {#each gs.loadouts as l (l.name)}
        <span class="loadout-chip">
          <button class="tiny" onclick={() => game.applyLoadout(l.name)} title="Apply this plan">
            {l.name}
          </button>
          <button class="tiny x" onclick={() => game.deleteLoadout(l.name)} aria-label="Delete loadout">✕</button>
        </span>
      {/each}
      <input
        class="loadout-name"
        placeholder="name…"
        bind:value={loadoutName}
        onkeydown={(e) => { if (e.key === 'Enter') saveLoadout(); }}
      />
      <button class="tiny" onclick={saveLoadout} disabled={!loadoutName.trim()}>Save current</button>
    </div>
    <!-- One line per entry. Everything else — mastery, the baked reflex, the
         trigger editor — lives behind the card's tooltip and its config
         window, so a long rotation stays readable at a glance. -->
    <div class="actives" ondragover={(e) => e.preventDefault()} ondrop={() => onDrop(null)} role="list">
      {#each visibleRotation as id (id)}
        {@const entry = rotationEntry(id)}
        {@const tech = techniqueOf(id)}
        {@const status = tech ? techniqueStatus(gs, stats, tech) : null}
        {@const cd = gs.combat?.cooldowns[id] ?? 0}
        {@const trigger = gs.skillTriggers[id]}
        {@const off = trigger?.enabled === false}
        {@const tuned = !!trigger && (trigger.conditions.length > 0 || !!trigger.event)}
        {#if entry}
        <div
          class="active-skill"
          class:ready={status ? status.kind === 'primed' || status.kind === 'ready' : cd <= 0 && !off}
          class:disabled={off}
          class:dragging={dragging === id}
          class:drop-before={dropTarget === id && dragging !== id}
          style={tech ? flowGradient(tech) : undefined}
          role="listitem"
          draggable="true"
          ondragstart={() => (dragging = id)}
          ondragend={() => { dragging = null; dropTarget = null; }}
          ondragover={(e) => { e.preventDefault(); dropTarget = id; }}
          ondragleave={() => { if (dropTarget === id) dropTarget = null; }}
          ondrop={(e) => { e.stopPropagation(); onDrop(id); }}
        >
          <!-- Line 1: what it is. Line 2: what it costs and when it comes
               round again. Techniques carry their footwork and drill switch
               on the right of line 1 — nothing else has either. -->
          <div class="line1">
            <Tip>
              <button class="skill-name" onclick={() => (configId = id)}>
                <span class="nm">{entry.icon} {entry.name}</span>
                {#if tuned}<span class="tuned" title="You have set conditions on this">⚡</span>{/if}
              </button>
              {#snippet tip()}
                {#if tech}
                  {@const tierName = masteryTierName(tech, masteryTier(gs, tech))}
                  {@const toNext = repsToNextTier(gs, tech)}
                  <div class="tip-line tip-base">{tech.desc}</div>
                  <div class="tip-line">{techniqueMoveText(gs, tech)}</div>
                  <div class="tip-line tip-sub">
                    {techniqueExecutions(gs, tech.id)} reps{tierName ? ` · ${tierName}` : ''}{techniqueForm(
                      gs,
                      tech.id,
                    ) === 'rough'
                      ? ' · rough'
                      : ''}{toNext !== undefined && isDrilled(gs, tech.id)
                      ? ` · next in ${toNext}`
                      : ''}
                  </div>
                {:else if spellOf(id)}
                  <!-- A spell says what it DOES, same words as the grimoire. -->
                  {@const spec = resolveSpell(spellOf(id)!)}
                  {#if spec.desc}<div class="tip-line tip-base">{spec.desc}</div>{/if}
                  {#each specLines(spec) as line}
                    <div class="tip-line">{line}</div>
                  {/each}
                  <div class="tip-line tip-sub">
                    {targetLabel(spec)} · {entry.cost} · ⟳ every {ticksToTime(spec.cooldown)}
                  </div>
                {:else if id === GENE_ACTIVE}
                  <!-- A body's tool says what it reads off, because that is the
                       whole of what makes it different from a skill. -->
                  {#each geneAbilityLines(gs) as line}
                    <div class="tip-line">{line}</div>
                  {/each}
                  <div class="tip-line tip-sub">
                    From your {expressedGene(gs).name} · ⟳ every {ticksToTime(entry.cooldown ?? 0)} ·
                    rewrite the centromere in the Chromosome tab to change it
                  </div>
                {/if}
                {#if status && statusLong(status)}
                  <div class="tip-line">{statusLong(status)}</div>
                {/if}
                {#if tuned}
                  <div class="tip-line tip-total">
                    ⚡ {[
                      ...(trigger.event
                        ? [TRIGGER_EVENTS.find((e) => e.id === trigger.event)?.name ?? trigger.event]
                        : []),
                      ...trigger.conditions.map((c) => describeCondition(c, gs)),
                    ].join(' · ')}
                  </div>
                {/if}
                <div class="tip-line tip-sub">Click to set when it fires · drag to reorder.</div>
              {/snippet}
            </Tip>
            {#if tech}
              {@render flowPills(tech)}
              <button
                class="tiny drill"
                class:on={isDrilled(gs, tech.id)}
                onclick={() => game.toggleDrill(tech.id)}
                aria-label="Toggle drilling"
                title={isDrilled(gs, tech.id) ? 'Drilling — banking reps' : 'Not drilled — reps do not count'}
              >🏋️</button>
            {:else if spellOf(id)}
              <!-- A working that lands on you can be fired here and now, with
                   no fight on — the rotation only ever casts it mid-combat,
                   and walking to the spellcrafting table to put a haste on is
                   not a decision anyone wants to make. -->
              {@const spell = spellOf(id)!}
              {#if isUtilityWorking(resolveSpell(spell))}
                {@const check = canCastUtility(gs, spell.uid)}
                {@const waiting = utilityCooldown(gs, spell.uid)}
                <button
                  class="tiny cast"
                  disabled={!check.ok}
                  onclick={() => game.castUtility(spell.uid)}
                  aria-label="Cast on yourself now"
                  title={check.ok
                    ? `Cast ${resolveSpell(spell).name} on yourself now`
                    : (check.reason ?? '')}
                >{waiting > 0 ? '⏳' : '✨'}</button>
              {/if}
            {/if}
          </div>
          <div class="line2 small">
            <span class="mark dim">{entry.mark}{entry.cost ? ` ${entry.cost}` : ''}</span>
            <span class="when dim" class:primed={status?.kind === 'primed'}>
              {whenText(status, cd, off, entry.cooldown, entry.speaking)}
            </span>
          </div>
        </div>
        {/if}
      {/each}
    </div>
  {/if}

  {#if gs.combat && gs.combat.buffs.length > 0}
    <div class="small" style="margin-top: 6px">
      {#each gs.combat.buffs as buff}
        <span class="buff">▲ {buff.name} ({ticksToTime(buff.ticksLeft)})</span>
      {/each}
    </div>
  {/if}
</div>
</div>

{#if configId}
  <EntryConfigModal id={configId} onclose={() => (configId = null)} />
{/if}

<!-- The same loadout, arranged on the position graph instead of in a list.
     Collapsed by default: the list above stays the working surface, and the
     graph is where you go to see how the pieces connect. -->
<MartialPlanner />

<!-- Encounter — always on screen, showing a search state between fights. -->
<div class="panel" style="margin-top: 12px">
  {#if gs.combat}
    {@const e = gs.combat.enemies}
    {#if gs.combat.forced}
      <!-- The feed announced it once; this stays up for the fight's whole
           length, because "why is every travel button dead" deserves a
           standing answer rather than a scrolled-away line. -->
      <div class="no-retreat small">⚔️ No retreat — this fight ends on its feet or on yours.</div>
    {/if}
    <div class="formation">
      <div class="flank">
        {@render flankSlot(e[1])}
        {@render flankSlot(e[2])}
      </div>
      <div class="centre">
        {#if e[0]}{@render centreCard(e[0])}{/if}
      </div>
      <div class="flank">
        {@render flankSlot(e[3])}
        {@render flankSlot(e[4])}
      </div>
    </div>
  {:else}
    <h3 class="searching">🔍 Searching for encounter…</h3>
    <p class="dim small searching-note">
      {#if gs.recovering}
        💫 You're recovering from a knockout. Hunting resumes when you're steady.
      {:else if gs.activity && canHunt && restingForFight(gs)}
        🛌 Resting before the next fight: HP {Math.floor(hpFraction(gs, view.stats) * 100)}% of
        {Math.round(restTarget(huntRest(gs)) * 100)}%.
      {:else if cleared}
        🏞️ {spot.name} is cleared — nothing left here wants to fight.
      {:else if nobodyLeft}
        🍃 Nothing stirs at {spot.name} — whatever hunts here is gone, or not yet come.
      {:else if gs.activity && canHunt}
        Stalking the area for the next encounter{gs.respawnTimer > 0
          ? ` — ${ticksToTime(gs.respawnTimer)}`
          : ''}...
      {:else if canHunt}
        Select <b>Hunt</b> in the Location tab to seek out monsters here.
      {:else}
        No monsters near {spot.name}. Travel somewhere wilder to hunt.
      {/if}
    </p>
  {/if}
  <!-- The player's own rule between fights (systems/huntrest.ts). Applies to
       hunts only: forced fights and the keeper's dare start regardless. -->
  <div class="hunt-rest small">
    <label>
      Rest before the next fight when HP is below
      <select
        value={String(huntRest(gs).at)}
        onchange={(e) => game.setHuntRest(Number(e.currentTarget.value), huntRest(gs).toFull)}
      >
        <option value="0">off</option>
        {#each [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] as v (v)}
          <option value={String(v)}>{Math.round(v * 100)}%</option>
        {/each}
      </select>
    </label>
    {#if huntRest(gs).at > 0}
      <label>
        until
        <select
          value={huntRest(gs).toFull ? 'full' : 'at'}
          onchange={(e) => game.setHuntRest(huntRest(gs).at, e.currentTarget.value === 'full')}
        >
          <option value="full">full HP</option>
          <option value="at">the threshold</option>
        </select>
      </label>
    {/if}
  </div>
</div>

<!-- Fight feed — persists between encounters. Every line carrying a damage
     number explains it on hover, the same way attributes and stats do. -->
<div class="panel" style="margin-top: 12px">
  <div class="feed-head">
    <h3>Fight Feed</h3>
    <!-- Turn-based reading of the fight. The pause is global (see App.svelte),
         so walking an exchange tick by tick freezes everything else too. -->
    <div class="stepper">
      {#if gs.paused}
        <span class="frozen">⏸️ frozen · t{gs.totalTicks}</span>
      {/if}
      <button class="tiny" onclick={() => game.togglePause()} title="Freeze the whole world (Space or P)">
        {gs.paused ? '▶️ Resume' : '⏸️ Pause'}
      </button>
      <button class="tiny" onclick={() => stepTicks(1)} title="One tick — 100 ms (→)">+1</button>
      <button class="tiny" onclick={() => stepTicks(TPS)} title="One second (Shift + →)">+1s</button>
      <button
        class="tiny"
        onclick={() => (lastStep = stepEvent())}
        title="Run on until the fight says something new (N)"
      >
        ⏭ Next line
      </button>
      {#if lastStep !== null}
        <span class="dim" title="Game time the last “Next line” step covered">
          +{(lastStep / TPS).toFixed(1)}s
        </span>
      {/if}
      {#if gs.lastFight}
        <!-- Every finished fight is tallied, not just the ones that went badly:
             a win you nearly lost is worth reading too. -->
        <button
          class="tiny"
          onclick={() => (ui.defeat = gs.lastFight)}
          title="How the last fight actually went — what hit you, and what you stopped"
        >
          📋 Last fight
        </button>
      {/if}
      {#if gs.notebook.length > 0}
        <button
          class="tiny"
          onclick={() => (notebookOpen = !notebookOpen)}
          title="Fights you kept — read one while planning the rematch"
        >
          📓 Notebook ({gs.notebook.length})
        </button>
      {/if}
    </div>
  </div>
  {#if notebookOpen && gs.notebook.length > 0}
    <!-- The intel layer pointed at your own corpse: what actually killed you
         last time, read while you decide what to bring back. -->
    <ul class="notebook small">
      {#each gs.notebook as entry}
        <li>
          <button class="open" onclick={() => (ui.defeat = entry.ledger)}>
            <span class="mark">{entry.ledger.outcome === 'won' ? '⚔️' : '💫'}</span>
            <span class="who">
              {entry.ledger.foes.map((f) => f.name).join(', ') || 'No encounter'}
            </span>
            <span class="dim">
              {entry.ledger.incoming[0]
                ? `worst: ${entry.ledger.incoming[0].label}`
                : 'untouched'}
            </span>
          </button>
          <button
            class="tiny drop"
            title="Forget this fight"
            onclick={() => dropFight(gs, entry.id)}
          >
            ✕
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="small feed">
    {#if gs.combatFeed.length === 0 && !gs.floatingFeed?.length}
      <span class="dim">Nothing yet — the log fills as you fight.</span>
    {:else}
      <!-- AFFLICTIONS RIDE THE FEED, they do not fill it. A run still going is
           drawn here at the top against whatever line is newest, updating in
           place; when it ends it settles onto that line and travels down with
           it as new lines push in above. -->
      {#each gs.floatingFeed ?? [] as run (run.group)}
        {@const shown = tallied(run.tally)}
        {#if shown.length}
          <!-- A run that reports DAMAGE owes the same working an ordinary blow
               does — more so, because a running total is the one number nobody
               can check by eye. Its slices accumulate across the run. -->
          {#if run.report}
            <Tip>
              <div class="affliction running">
                {renderLine(run.prefix, shown)}
                <span class="still">still running</span>
              </div>
              {#snippet tip()}{@render damageTip(run.report!)}{/snippet}
            </Tip>
          {:else}
            <div class="affliction running">
              {renderLine(run.prefix, shown)}
              <span class="still">still running</span>
            </div>
          {/if}
        {/if}
      {/each}
      {#each [...gs.combatFeed].reverse() as entry}
        {#if entry.damage}
          <Tip>
            {entry.text}
            {#snippet tip()}{@render damageTip(entry.damage!)}{/snippet}
          </Tip>
        {:else}
          <div>{entry.text}</div>
        {/if}
        {#each entry.afflictions ?? [] as run}
          {@const shown = tallied(run.tally)}
          {#if shown.length}
            {#if run.report}
              <Tip>
                <div class="affliction">{renderLine(run.prefix, shown)}</div>
                {#snippet tip()}{@render damageTip(run.report!)}{/snippet}
              </Tip>
            {:else}
              <div class="affliction">{renderLine(run.prefix, shown)}</div>
            {/if}
          {/if}
        {/each}
      {/each}
    {/if}
  </div>
</div>

<style>
  .hunt-rest {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    align-items: center;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }
  .notebook {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .notebook li {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .notebook .open {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    min-width: 0;
  }

  .notebook .who {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .notebook .drop {
    color: var(--danger);
  }

  .feed-head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .feed-head h3 {
    margin: 0;
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    flex-wrap: wrap;
  }

  .stepper .frozen {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: var(--accent);
  }

  .foe-afflictions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .foe-afflictions :global(.tip-target) {
    border-bottom: none;
  }
  .affliction {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 0 6px 1px;
    border: 1px solid var(--danger, #e05555);
    border-radius: 999px;
    background: color-mix(in srgb, var(--danger, #e05555) 14%, transparent);
    font-size: 0.72rem;
    white-space: nowrap;
  }
  /* One dose from turning — see escalationPrimed. The pill pulses because
     nothing else about a capped condition looks any different. */
  .affliction.primed {
    animation: primed-pulse 1.15s ease-in-out infinite;
  }
  @keyframes primed-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 transparent;
      border-color: var(--danger, #e05555);
    }
    50% {
      box-shadow: 0 0 6px 1px color-mix(in srgb, var(--danger, #e05555) 55%, transparent);
      border-color: color-mix(in srgb, #fff 45%, var(--danger, #e05555));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .affliction.primed {
      animation: none;
      border-color: color-mix(in srgb, #fff 45%, var(--danger, #e05555));
      box-shadow: 0 0 5px 1px color-mix(in srgb, var(--danger, #e05555) 45%, transparent);
    }
  }
  .affliction .stacks {
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
  }
  .flank-afflictions {
    display: flex;
    gap: 2px;
    font-size: 0.7rem;
    line-height: 1;
    margin-top: 2px;
  }

  /* Styles and actives sit side by side above the encounter; on a narrow
     screen they stack, stance wheel first. */
  .loadout {
    display: grid;
    grid-template-columns: minmax(210px, 300px) 1fr;
    gap: 12px;
    align-items: start;
  }

  @media (max-width: 720px) {
    .loadout {
      grid-template-columns: 1fr;
    }
  }

  /* The stance wheel: three by three, Neutral in the middle. */
  .stance-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
    margin-bottom: 8px;
  }

  .stance-grid > :global(.tip-target) {
    display: block;
    border-bottom: none;
  }

  button.stance {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 7px 3px;
    line-height: 1.15;
  }

  .stance-icon {
    font-size: 17px;
  }

  .stance-name {
    font-size: 11px;
    text-align: center;
  }

  /* The exertion switch reads as a state, not a menu item. */
  button.exert {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    margin-bottom: 8px;
  }

  button.exert.on {
    border-color: var(--stamina);
    background: color-mix(in srgb, var(--stamina) 14%, var(--bg-raised));
  }

  .exert-mark {
    font-size: 16px;
  }

  /* A slot currently worn by a weapon school reads as elevated, not as a
     different button — it's the same stance, refined. */
  .stance-grid button.school {
    border-color: var(--accent);
  }

  /* Forced by a condition: it wears that condition's colour, and beats both
     the school border and the .selected highlight it may also be carrying. */
  .stance-grid button.stance.forced {
    border-color: var(--forced);
    background: color-mix(in srgb, var(--forced) 22%, var(--bg-raised));
    position: relative;
  }

  .forced-mark {
    position: absolute;
    top: 1px;
    right: 3px;
    font-size: 10px;
    line-height: 1;
  }

  /* Everything you cannot currently reach. The stance you PICKED is exempt —
     it keeps its highlight, because it is still what you return to. */
  .stance-grid button.stance.overridden {
    opacity: 0.32;
    filter: grayscale(0.8);
  }

  .forced-note {
    margin: -2px 0 8px;
    padding: 4px 8px;
    border-left: 2px solid var(--forced);
    background: color-mix(in srgb, var(--forced) 10%, transparent);
    border-radius: 0 4px 4px 0;
    font-size: 11.5px;
    color: var(--text-dim);
  }

  .fallback {
    color: var(--accent);
  }

  .winded,
  .exhausted,
  .momentum {
    margin: 0 0 6px;
  }

  /* The position strip: five chips, current one lit, entrant techniques badged. */
  .pos-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 4px;
  }

  .pos-strip > :global(.tip-target) {
    border-bottom: none;
    flex: 1;
  }

  .pos-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 4px 5px;
    border: 1px solid var(--border);
    /* The position's identity color rides the top edge — the same color its
       pills wear on every technique card. */
    border-top: 2px solid var(--posc, var(--border));
    border-radius: 6px;
    opacity: 0.55;
    line-height: 1.15;
  }

  .pos-chip.current {
    opacity: 1;
    border-color: var(--posc, var(--accent));
    background: color-mix(in srgb, var(--posc, var(--accent)) 16%, var(--bg-raised));
  }

  /* Entry/exit pills: the flow of a technique, wearing its positions' colors. */
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
  }

  .pos-icon {
    font-size: 14px;
  }

  .pos-name {
    font-size: 10px;
    white-space: nowrap;
  }

  /* Which techniques enter from this position; keeps chip height stable. */
  .pos-badges {
    font-size: 10px;
    min-height: 13px;
    letter-spacing: 1px;
  }

  .anywhere {
    margin: 0 0 6px;
  }

  .grounded {
    margin: 0 0 6px;
    color: var(--danger, #e05555);
  }

  /* Wears the spell-ready seat's own colour, so the line and the node match. */
  .readied {
    margin: 0 0 6px;
    color: #7de0c3;
  }

  button.exert.sheathe.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--bg-raised));
  }

  /* A primed reflex is about to answer — say so in the card's "when" slot. */
  .when.primed {
    color: var(--xp);
    font-weight: 600;
  }

  button.drill.on {
    border-color: var(--stamina);
    background: color-mix(in srgb, var(--stamina) 14%, var(--bg-raised));
  }

  /* Fire a self-affecting working right now, without a fight. Tinted with the
     pool it draws on, so it reads as spending something. */
  button.cast:not(:disabled) {
    border-color: var(--focus);
    background: color-mix(in srgb, var(--focus) 14%, var(--bg-raised));
  }

  button.cast:disabled {
    opacity: 0.45;
  }

  .winded {
    color: var(--stamina-winded);
  }

  .exhausted {
    color: var(--stamina-exhausted);
  }

  .momentum {
    color: var(--stamina);
  }

  /* Centre takes half the width; each side column holds two stacked flanks. */
  .formation {
    display: grid;
    grid-template-columns: 1fr 2fr 1fr;
    gap: 10px;
    align-items: center;
  }

  .flank {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .flank-slot {
    min-height: 34px;
  }

  .flank-slot.empty {
    border: 1px dashed var(--border);
    border-radius: 6px;
    opacity: 0.35;
  }

  /* Back-row enemies read as secondary to the one you're actually fighting. */
  .flank-slot :global(.tip-target) {
    opacity: 0.85;
  }

  .flank-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 4px;
    font-size: 11.5px;
  }

  .flank-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .flank-bar {
    height: 7px;
    margin-top: 2px;
  }

  .flank-action {
    height: 4px;
    margin-top: 2px;
  }

  .flank-action .fill,
  .flank-bar .fill {
    transition: none;
  }

  .reach {
    font-size: 11px;
    opacity: 0.75;
  }

  .searching {
    color: var(--text-dim);
    font-weight: 600;
  }

  .no-retreat {
    color: var(--danger);
    font-weight: 600;
    text-align: center;
    margin-bottom: 8px;
  }

  .searching-note {
    margin: 0;
  }

  .action-bar {
    height: 6px;
    margin-top: 4px;
  }

  .action-bar .fill {
    transition: none; /* fills every tick; easing would lag behind the reset */
  }

  .hint {
    margin: 0 0 8px;
  }

  .loadouts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
    margin-bottom: 8px;
  }

  /* NOTE: `.loadout` (singular) is the panel's two-column layout container —
     saved-plan chips carry their own name to avoid colliding with it. */
  .loadout-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    border: 1px solid var(--accent);
    border-radius: 999px;
    padding: 0 2px 0 4px;
  }

  .loadout-chip button.tiny {
    border: none;
    background: none;
    padding: 1px 4px;
  }

  .loadout-chip button.x {
    color: var(--text-dim);
  }

  .loadout-name {
    width: 110px;
    font: inherit;
    font-size: 11.5px;
    color: var(--text);
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 2px 6px;
  }

  /* Actives get their own grid beside the stance wheel. Cards are one line
     tall now — configuring one opens a window instead of expanding it — so
     they pack tighter and more of the rotation fits on screen. */
  /* One card per line beats two cramped ones: below ~300px the name, pills,
     status and controls stop fitting side by side and the card grows taller
     than the two-column saving is worth. */
  .actives {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 4px;
    align-items: start;
  }

  /*
   * Not-ready is signalled by the BORDER (ready wears the accent) and by
   * fading the name — never by fading the whole card. Line 2 is already
   * --text-dim, and a container opacity on top of that compounded into
   * something genuinely hard to read, on exactly the cards whose numbers you
   * most want ("how long until this is up?").
   */
  .active-skill {
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 2px 7px;
    /* A grid cell must not be widened by its content (long fork names, pills). */
    min-width: 0;
    overflow: hidden;
  }

  .active-skill:not(.ready) .skill-name {
    opacity: 0.68;
  }

  .active-skill.ready {
    border-color: var(--accent);
  }

  /* Switched off is the one state that recedes wholesale — you are not
     reading a card you have deliberately taken out of the rotation. */
  .active-skill.disabled {
    opacity: 0.6;
  }

  /* Line 1: name (shrinks), then the technique's footwork and drill switch. */
  .line1 {
    display: flex;
    align-items: center;
    gap: 5px;
    /* Cards are narrow grid cells: nothing inside may push past the edge. */
    min-width: 0;
  }

  /* The name is wrapped in a Tip (the card's whole detail lives in the
     tooltip now), so the flex child is the tip target, not the button. */
  .line1 > :global(.tip-target) {
    flex: 1 1 auto;
    min-width: 0;
    border-bottom: none;
    cursor: pointer;
  }

  .skill-name {
    width: 100%;
    min-width: 0;
    display: flex;
    flex-wrap: nowrap;
    gap: 0 5px;
    align-items: baseline;
    background: none;
    border: none;
    padding: 1px 0;
    text-align: left;
  }

  .skill-name .nm {
    flex: 0 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .line1 .flow,
  .line1 .drill,
  .skill-name .tuned {
    flex: 0 0 auto;
  }

  /* Line 2: the school mark and its cost, and — held to the far edge so it
     lines up down the column — when the thing comes round again. */
  .line2 {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    line-height: 1.3;
  }

  .line2 .mark {
    flex: 0 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .line2 .when {
    flex: 0 0 auto;
    margin-left: auto;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* A quiet mark that the player has narrowed this entry's firing. */
  .tuned {
    color: var(--xp);
    font-size: 10px;
  }

  /* The whole card is the drag handle now that the arrows are gone, so it
     wears the grab cursor rather than hiding the affordance in one glyph. */
  .active-skill {
    cursor: grab;
  }

  .active-skill.dragging {
    opacity: 0.45;
    cursor: grabbing;
  }

  /* Where the card will land. */
  .active-skill.drop-before {
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .tiny {
    padding: 1px 6px;
    font-size: 11px;
    line-height: 1.4;
  }

  .buff {
    color: #7de0c3;
    margin-right: 10px;
  }

  .feed {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 180px;
    overflow-y: auto;
  }

  /* A feed line with a breakdown behind it keeps the dotted hover hint, but
     sits flush like the plain lines around it. */
  .feed > :global(.tip-target) {
    align-self: flex-start;
  }

  /* An affliction total is a RIDER on a line, not a line: indented under the
     one it belongs to, so the feed still reads as one exchange per row. */
  .affliction {
    padding-left: 10px;
    border-left: 2px solid color-mix(in srgb, var(--danger) 50%, transparent);
    color: var(--text-dim);
    line-height: 1.35;
  }

  /* Still burning. Solid rather than dim, because it is the only line in the
     feed that is still changing while you look at it. */
  .affliction.running {
    border-left-color: var(--danger);
    color: var(--text);
  }

  .affliction .still {
    margin-left: 6px;
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.6;
  }

  /* Sub-detail under one damage-type row (what armor or resistance took). */
  :global(.tip-line.tip-note) {
    color: var(--text-dim);
    padding-left: 10px;
  }
</style>
