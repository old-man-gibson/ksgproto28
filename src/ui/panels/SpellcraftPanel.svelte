<script lang="ts">
  import { gs, game, view } from '../state.svelte';
  import { ARCANE_WORDS, MIRACLES, maxSentenceWords, miraclesOf } from '../../core/data/spellcraft.data';
  import {
    DEITIES,
    DEITY_LIST,
    DEITY_TAGS,
    DEITY_TAG_CATEGORIES,
  } from '../../core/data/deities.data';
  import { deityArt } from '../lib/deityArt';
  import TagPicker from '../lib/TagPicker.svelte';
  import type { DeityTagDef } from '../../core/types';
  import {
    MAX_STACK,
    WORD_MASTERY,
    arcaneLevel,
    masteredTier,
    splitWordId,
    wordLevel,
    wordUses,
  } from '../../core/systems/arcane';
  import { WORD_MILESTONE_LEVELS, WORD_POWER_PER_LEVEL, wordSkillId } from '../../core/data/wordskills.data';
  import { SKILLS } from '../../core/registry';
  import { sumMods } from '../lib/format';
  import { checkMiracle, devotionLevel, favorWith, miracleSpec } from '../../core/systems/divine';
  import { deitiesInRelation, deityGroups, queryDeities } from '../../core/systems/deities';
  import {
    MAX_PSI_MEMORIZED,
    checkShape,
    deriveShape,
    psiAxes,
    psiAxisCap,
    psiBiasFrom,
    psiMemorized,
    psiTier,
    psionicsLevel,
    recogniseShape,
    shapeKey,
    shapeSpec,
    shapeTotal,
  } from '../../core/systems/psionic';
  import { PSI_AXIS_LIST, PSI_QUANTITY_LIST } from '../../core/data/spellcraft.data';
  import {
    BASE_PREPARED,
    PREPARED_PER_LEVELS,
    preparedCap,
    canCastUtility,
    checkInscription,
    isUtilityWorking,
    preparedSpells,
    resolveSpell,
    utilityCooldown,
  } from '../../core/systems/spellcraft';
  import type {
    ArcaneWordDef,
    ArcaneWordKind,
    CraftedSpell,
    PsiQuantityId,
    PsionicShape,
    SpellSpec,
  } from '../../core/types';
  import { TPS } from '../../core/engine/loop';
  import { trueMax } from '../../core/systems/resources';
  // A spell describes itself the same way everywhere — the grimoire, the
  // combat card's tooltip and the config window all read these.
  import { specLines, targetLabel } from '../lib/format';
  import { deityKnown, subsystemUnlocked, wordUnlocked } from '../../core/systems/unlocks';
  import Tip from '../lib/Tip.svelte';

  /**
   * The spellcrafting table: one piece of furniture, three schools.
   *
   * The arcane bench is the star — a sentence strip the player builds by
   * dragging word tiles around, because word ORDER is the mechanic and a thing
   * whose order matters should be a thing you can physically rearrange. The
   * divine and psionic benches are the seeds of their own systems: a ledger of
   * favor and litanies, and three dials on a budget.
   */

  let { large = false }: { large?: boolean } = $props();

  let tab = $state<'arcane' | 'divine' | 'psionic'>('arcane');

  // ---------- Arcane: the sentence under construction ----------

  let sentence = $state<string[]>([]);
  const level = $derived(arcaneLevel(gs));
  const cap = $derived(maxSentenceWords(level));
  // checkInscription = legal speech AND not already written (the floor 0 word
  // is in every new grimoire, and it is the first thing a newcomer tries).
  const check = $derived(sentence.length ? checkInscription(gs, sentence) : null);
  /** A sentence the pool cannot pay for inscribes fine and then never casts. */
  const overPool = $derived.by(() => {
    const cost = check?.ok ? (check.spec?.manaCost ?? 0) : 0;
    const pool = trueMax(view.stats, 'mana');
    return cost > pool ? { cost, pool } : null;
  });

  /** The full lexicon, locked words included — a locked word is a goal. */
  const KIND_ORDER: ArcaneWordKind[] = ['noun', 'verb', 'adverb', 'conjunction', 'target'];
  const KIND_LABEL: Record<ArcaneWordKind, string> = {
    noun: 'Nouns — the substance',
    verb: 'Verbs — what it does',
    adverb: 'Adverbs — how it is spoken',
    conjunction: 'Conjunctions — how clauses relate',
    target: 'Targets — where it is sent',
  };
  const lexicon = $derived(
    KIND_ORDER.map((kind) => ({
      kind,
      // A locked word is not shown greyed — it is not shown at all. The
      // starter lexicon (systems/unlocks.ts) is the whole vocabulary until
      // content teaches more; an empty kind row simply doesn't render.
      words: Object.values(ARCANE_WORDS)
        .filter((w) => w.kind === kind && wordUnlocked(gs, w.id))
        .sort((a, b) => (a.minLevel ?? 0) - (b.minLevel ?? 0)),
    })),
  );

  const known = (w: ArcaneWordDef) => (w.minLevel ?? 0) <= level;

  /** How deep a word is worn, in numerals. Tier 1 wears nothing. */
  const TIER_MARK: Record<number, string> = { 2: 'II', 3: 'III' };

  /**
   * What practising this word deeply gives back, in words — every milestone
   * of a word grants the same thing, so one reading covers all three.
   */
  function wordGift(wordId: string): string | null {
    const bonus = SKILLS[wordSkillId(wordId)]?.milestones?.[0]?.bonus;
    return bonus?.length ? sumMods(bonus) : null;
  }

  /** "flame ✓ · blaze (7/15)" — what folding this word further would take. */
  function masteryLine(w: ArcaneWordDef, deep: number, uses: number): string {
    return (w.stacked ?? [])
      .map((name, i) => `${name} ${deep >= i + 2 ? '✓' : `(${uses}/${WORD_MASTERY[i]})`}`)
      .join(' · ');
  }

  // Drag state: either a tile already in the sentence (its index) or a fresh
  // word from the palette (its id). `overIndex` is where it would land.
  let dragIndex = $state<number | null>(null);
  let dragWord = $state<string | null>(null);
  let overIndex = $state<number | null>(null);

  function speak(id: string) {
    if (sentence.length >= cap) return;
    sentence = [...sentence, id];
  }

  function unspeak(index: number) {
    sentence = sentence.filter((_, i) => i !== index);
  }

  /**
   * Peel one layer off a folded word: blaze → flame → fire → gone. The
   * mirror of dragging twins together, so a stack built by accident can be
   * taken back apart without clearing the whole sentence.
   */
  function unstack(index: number) {
    const tok = splitWordId(sentence[index] ?? '');
    if (!tok.id) return;
    if (tok.tier <= 1) {
      unspeak(index);
      return;
    }
    const next = [...sentence];
    next[index] = tok.tier - 1 > 1 ? `${tok.id}:${tok.tier - 1}` : tok.id;
    sentence = next;
  }

  /**
   * Whether what is being dragged would MERGE into the tile at `index`
   * rather than land beside it: same word, tiers that still fit, and a
   * mastery deep enough to speak the result as one word.
   *
   * Merging is gated on mastery because it FREES A SLOT — collapsing "fire
   * fire" into "flame" is exactly the privilege the mastery ladder sells.
   * Ungated, every sentence would merge and the ladder would mean nothing.
   */
  function mergeInto(index: number): { id: string; tier: number } | null {
    const target = sentence[index];
    if (!target) return null;
    const dragged = dragIndex !== null ? sentence[dragIndex] : dragWord;
    if (!dragged || dragIndex === index) return null;
    const a = splitWordId(target);
    const b = splitWordId(dragged);
    if (a.id !== b.id) return null;
    const w = ARCANE_WORDS[a.id];
    // Addresses and conjunctions have no deeper form to become.
    if (!w?.stacked) return null;
    const tier = a.tier + b.tier;
    if (tier > MAX_STACK) return null;
    if (masteredTier(gs, a.id) < tier) return null;
    return { id: a.id, tier };
  }

  /** Fold the dragged word into the tile at `index`, deepening it. */
  function merge(index: number, into: { id: string; tier: number }) {
    const next = [...sentence];
    next[index] = `${into.id}:${into.tier}`;
    // Take the source tile out AFTER writing, so indices stay honest.
    if (dragIndex !== null) next.splice(dragIndex, 1);
    sentence = next;
    dragIndex = null;
    dragWord = null;
    overIndex = null;
  }

  /** Drop at `index` (sentence.length = append): move a tile or place a word. */
  function dropAt(index: number) {
    if (dragIndex !== null) {
      const moved = [...sentence];
      const [tile] = moved.splice(dragIndex, 1);
      moved.splice(index > dragIndex ? index - 1 : index, 0, tile);
      sentence = moved;
    } else if (dragWord && sentence.length < cap) {
      const placed = [...sentence];
      placed.splice(index, 0, dragWord);
      sentence = placed;
    }
    dragIndex = null;
    dragWord = null;
    overIndex = null;
  }

  function inscribe() {
    if (game.inscribeArcane(sentence)) sentence = [];
  }

  // ---------- Divine: the shelf of powers ----------

  /** Which god is opened in place, if any. */
  let openGod = $state<string | null>(null);
  let godTags = $state<string[]>([]);
  let godSearch = $state('');

  /** Only aspects some power actually carries — an axis nobody uses is noise. */
  function axisOptions(axis: DeityTagDef['category']) {
    const carried = new Set(DEITY_LIST.flatMap((d) => d.tags));
    return Object.values(DEITY_TAGS).filter((t) => t.category === axis && carried.has(t.id));
  }

  function setAxisTags(axis: DeityTagDef['category'], next: string[]) {
    godTags = [...godTags.filter((t) => DEITY_TAGS[t]?.category !== axis), ...next];
  }

  const godGroups = $derived(
    // Unknown gods are absent, not silhouetted (yet) — the deities-must-be-met
    // design owns the silhouette treatment when it lands. Favor already only
    // accrues with known gods (grantFavorAll), so nothing hidden is earning.
    deityGroups(queryDeities({ search: godSearch, tags: godTags }).filter((d) => deityKnown(gs, d.id))),
  );

  // ---------- Psionic: the wheel ----------

  let shape = $state<PsionicShape>({});
  const psiCap = $derived(psiAxisCap(gs));
  const openAxes = $derived(psiAxes(gs));
  const spent = $derived(shapeTotal(shape));
  const shapeCheck = $derived(checkShape(gs, shape));
  /*
   * The preview reads what you are WEARING, because that is the working you
   * would actually cast. The grimoire lists the bare shape (resolveSpell is
   * memoised and gear-blind), so the two can differ — deliberately: the book
   * records the combination, the bench shows it in your hands.
   */
  const bias = $derived(psiBiasFrom(view.stats));
  const shapePreview = $derived(spent > 0 ? shapeSpec(shape, psiTier(gs), bias) : null);

  /*
   * The readouts are the point of the wheel. The axes are only what a player
   * SPENDS; these are what the resolver actually reads, so watching them move
   * as the dials turn is the difference between a space and a guessing game.
   * Each is shown against the widest value this mind could reach, so the bar
   * says "how far along this quantity am I" rather than an unanchored number.
   */
  const reading = $derived(deriveShape(shape, bias));
  const quantityMax: Record<PsiQuantityId, (cap: number) => number> = {
    pressure: (cap) => cap * 2,
    momentum: (cap) => cap * cap,
    inertia: (cap) => cap,
    acuity: (cap) => cap,
    awareness: (cap) => cap * cap,
    coherence: () => 3,
    purchase: (cap) => cap,
    inward: () => 1,
  };

  /**
   * The name waiting one tier up, if any — so a mind that has found a region
   * it cannot yet hold is told what it is reaching for rather than silently
   * refused at the Shape button.
   */
  const outOfReach = $derived.by(() => {
    if (spent === 0) return null;
    const full = recogniseShape(shape, 12, bias);
    return full && (full.tier ?? 0) > psiTier(gs) ? full : null;
  });

  /**
   * A shape that costs more focus than the mind can ever hold. Said at the
   * bench, because the alternative is inscribing something that looks fine and
   * then discovering at a greyed-out button that it can never be cast.
   */
  const tooWide = $derived.by(() => {
    const cost = shapePreview?.focusCost ?? 0;
    const ceiling = view.stats.maxFocus;
    return cost > ceiling ? { cost, ceiling } : null;
  });

  /** Click ring r of an axis: inject r points; clicking the held ring clears. */
  function setAxis(axis: (typeof PSI_AXIS_LIST)[number]['id'], ring: number) {
    shape = { ...shape, [axis]: (shape[axis] ?? 0) === ring ? 0 : ring };
  }

  // Shapes held in mind — recalling one only fills the wheel; nothing is cast
  // or inscribed by it (see systems/psionic.ts).
  const memorized = $derived(psiMemorized(gs));
  const alreadyHeld = $derived(memorized.some((m) => shapeKey(m.shape) === shapeKey(shape)));

  /** The allocation itself, for a chip's hover — "what is in this one again?" */
  function psiShapeSummary(s: PsionicShape): string {
    return (
      PSI_AXIS_LIST.filter((a) => (s[a.id] ?? 0) > 0)
        .map((a) => `${a.icon} ${a.name} ${s[a.id]}`)
        .join(' · ') || 'an empty shape'
    );
  }

  // Annular-sector geometry for the wheel: 8 wedges, one ring per point.
  // The rings stop short of the edge to leave a lane for the axis labels —
  // an unlabelled wheel means counting wedges to find the one you want.
  const TAU = Math.PI * 2;
  const WHEEL_R0 = 8;
  const WHEEL_R1 = 38;
  const LABEL_R = 44;

  /** Where an axis's label sits: the middle of its wedge, just outside the rings. */
  function labelAt(i: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
    const mid = -TAU / 4 + ((i + 0.5) * TAU) / PSI_AXIS_LIST.length;
    const x = 50 + LABEL_R * Math.cos(mid);
    const y = 50 + LABEL_R * Math.sin(mid);
    // Wedges on the flanks would run their text off the edge; hang it inward.
    const cos = Math.cos(mid);
    return { x, y, anchor: cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle' };
  }
  function arcPath(i: number, ring: number, rings: number): string {
    const gap = 0.035;
    const a0 = -TAU / 4 + (i * TAU) / PSI_AXIS_LIST.length + gap;
    const a1 = -TAU / 4 + ((i + 1) * TAU) / PSI_AXIS_LIST.length - gap;
    const step = (WHEEL_R1 - WHEEL_R0) / rings;
    const r0 = WHEEL_R0 + (ring - 1) * step + 0.5;
    const r1 = WHEEL_R0 + ring * step - 0.5;
    const p = (a: number, r: number) =>
      `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
    return `M ${p(a0, r0)} L ${p(a0, r1)} A ${r1} ${r1} 0 0 1 ${p(a1, r1)} L ${p(a1, r0)} A ${r0} ${r0} 0 0 0 ${p(a0, r0)} Z`;
  }

  // ---------- The grimoire ----------

  let renaming = $state<number | null>(null);
  let renameText = $state('');

  const prepared = $derived(preparedSpells(gs).length);

  const SCHOOL_ICON = { arcane: '🪄', divine: '🙏', psionic: '🧠' } as const;

  function sourceLine(spell: CraftedSpell): string {
    const src = spell.source;
    if (src.school === 'arcane') return `“${src.words.map((w) => ARCANE_WORDS[w]?.word ?? w).join(' ')}”`;
    if (src.school === 'divine') {
      const deity = DEITIES[MIRACLES[src.litany]?.deity ?? ''];
      return deity ? `an aspect of ${deity.name}` : 'received whole';
    }
    return (
      Object.entries(src.shape)
        .filter(([, n]) => (n ?? 0) > 0)
        .map(([a, n]) => `${a} ${n}`)
        .join(' · ') || 'an empty shape'
    );
  }

  function startRename(spell: CraftedSpell) {
    renaming = spell.uid;
    renameText = spell.name ?? resolveSpell(spell).name;
  }

  function commitRename() {
    if (renaming !== null) game.renameSpell(renaming, renameText);
    renaming = null;
  }
</script>

{#snippet spellStats(spec: SpellSpec)}
  <div class="stat-row small">
    <span>{targetLabel(spec)}</span>
    <!-- Each school spends its own pool, so only show what this one costs. -->
    {#if spec.manaCost > 0}<span>💧 {spec.manaCost} mana</span>{/if}
    {#if spec.focusCost}<span>🧠 {spec.focusCost.toFixed(2)} focus</span>{/if}
    {#if spec.staminaCost}<span>🌬️ {spec.staminaCost} stamina</span>{/if}
    <span>⏱️ every {(spec.cooldown / TPS).toFixed(1)}s</span>
  </div>
  {#each specLines(spec) as line}
    <div class="small spec-line">{line}</div>
  {/each}
{/snippet}

<div class="spellcraft" class:panel={!large} class:large>
  <div class="tabs">
    <button class:selected={tab === 'arcane'} onclick={() => (tab = 'arcane')}>
      🪄 Arcane <span class="small dim">Lv {level}</span>
    </button>
    <button class:selected={tab === 'divine'} onclick={() => (tab = 'divine')}>
      🙏 Divine <span class="small dim">Lv {devotionLevel(gs)}</span>
    </button>
    <!-- Shuttered until content lifts the flag (systems/unlocks.ts): the
         table shows two schools to a new player, not a spoiler of the third. -->
    {#if subsystemUnlocked(gs, 'psionics')}
      <button class:selected={tab === 'psionic'} onclick={() => (tab = 'psionic')}>
        🧠 Psionic <span class="small dim">Lv {psionicsLevel(gs)}</span>
      </button>
    {/if}
  </div>

  {#if tab === 'arcane'}
    <!--
      The sentence strip. Order IS the spell, so the strip is a physical thing:
      tiles drag to reorder, palette words drag (or click) in, a click throws a
      word out. Each tile is a drop target that inserts before itself; the
      strip's tail appends.
    -->
    <div class="small dim">
      A spell is a sentence. Word order matters: <i>fire pierce</i> leads with the substance,
      <i>pierce fire</i> with the action — same words, different spells. Saying a word again
      deepens it: <i>fire fire</i> is <i>flame</i>, a third makes <i>blaze</i> — stronger than
      the sum, and costlier still. Drag a word onto its twin to fold them into one word (a
      numeral on a pill says how deep you have mastered it); right-click a folded word to peel
      a layer back off. Addresses never deepen; nothing survives a fourth saying.
    </div>

    <div
      class="strip"
      role="group"
      aria-label="Spell sentence"
      ondragover={(e) => {
        e.preventDefault();
        overIndex = sentence.length;
      }}
      ondrop={(e) => {
        e.preventDefault();
        dropAt(overIndex ?? sentence.length);
      }}
    >
      {#each sentence as id, i (i)}
        {@const tok = splitWordId(id)}
        {@const w = ARCANE_WORDS[tok.id]}
        {@const label = tok.tier > 1 ? (w?.stacked?.[tok.tier - 2] ?? w?.word) : w?.word}
        {@const fuses = overIndex === i ? mergeInto(i) : null}
        <button
          class="tile kind-{w?.kind}"
          class:drop-before={overIndex === i && !fuses}
          class:fusing={!!fuses}
          class:dragging={dragIndex === i}
          draggable="true"
          ondragstart={() => (dragIndex = i)}
          ondragend={() => {
            dragIndex = null;
            overIndex = null;
          }}
          ondragover={(e) => {
            e.preventDefault();
            e.stopPropagation();
            overIndex = i;
          }}
          ondrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Dropped onto its own twin: deepen instead of reordering.
            const fold = mergeInto(i);
            if (fold) merge(i, fold);
            else dropAt(i);
          }}
          onclick={() => unspeak(i)}
          oncontextmenu={(e) => {
            e.preventDefault();
            unstack(i);
          }}
          title={tok.tier > 1
            ? 'Right-click to peel one layer off · click to remove · drag to reorder'
            : 'Click to remove · drag to reorder, or onto its twin to deepen'}
        >
          {w?.icon} {label}
          {#if tok.tier > 1}<span class="tier-mark">{TIER_MARK[tok.tier]}</span>{/if}
        </button>
      {/each}
      {#if sentence.length === 0}
        <span class="small dim strip-hint">drag words here, or click them below</span>
      {/if}
      <span class="cap-note small dim">{sentence.length}/{cap} words</span>
    </div>

    <div class="result">
      {#if check?.ok && check.spec}
        <div class="preview">
          <b>{check.spec.icon} {check.spec.name}</b>
          {@render spellStats(check.spec)}
        </div>
      {:else if check}
        <div class="small dim">🔒 {check.reason}</div>
      {:else}
        <div class="small dim">The table is quiet.</div>
      {/if}
      {#if overPool}
        <div class="small out-of-reach too-wide">
          💧 Costs <b>{overPool.cost}</b> mana and your pool holds <b>{overPool.pool}</b>. It can be
          inscribed, but it will not cast until Intelligence raises the pool.
        </div>
      {/if}
    </div>

    <div class="bench-actions">
      <button disabled={!check?.ok} onclick={inscribe}>🪄 Inscribe</button>
      <button class="small" onclick={() => (sentence = [])}>Clear</button>
    </div>

    <div class="palette">
      {#each lexicon.filter((g) => g.words.length > 0) as group (group.kind)}
        <div class="group">
          <div class="small dim group-head">{KIND_LABEL[group.kind]}</div>
          <div class="words">
            {#each group.words as w (w.id)}
              <Tip>
                <button
                  class="tile kind-{w.kind}"
                  class:locked={!known(w)}
                  disabled={!known(w) || sentence.length >= cap}
                  draggable={known(w)}
                  ondragstart={() => (dragWord = w.id)}
                  ondragend={() => {
                    dragWord = null;
                    overIndex = null;
                  }}
                  onclick={() => speak(w.id)}
                >
                  {w.icon} {known(w) ? w.word : `Lv ${w.minLevel}`}
                  <!-- One pill per word. The numeral is how deep this word is
                       MASTERED — how far it may be folded in the strip. -->
                  {#if known(w) && masteredTier(gs, w.id) > 1}
                    <span class="tier-mark">{TIER_MARK[masteredTier(gs, w.id)]}</span>
                  {/if}
                  <!-- ...and the badge is how well it is PRACTISED, which is a
                       different thing entirely: mastery says what you may fold,
                       practice says how hard the word lands. -->
                  {#if known(w) && wordLevel(gs, w.id) > 0}
                    <span class="word-lv">{wordLevel(gs, w.id)}</span>
                  {/if}
                </button>
                {#snippet tip()}
                  <div class="tip-line tip-base">{w.icon} {w.word}</div>
                  <div class="tip-line tip-sub">
                    {w.kind}{w.mana ? ` · ${w.mana} mana` : ''}{!known(w) ? ` · needs Arcana ${w.minLevel}` : ''}
                  </div>
                  {#if w.desc}<div class="tip-line">{w.desc}</div>{/if}
                  {#if known(w)}
                    {@const lv = wordLevel(gs, w.id)}
                    {@const next = WORD_MILESTONE_LEVELS.find((m) => m > lv)}
                    <div class="tip-line tip-sub">
                      Practice {lv} — this word lands {Math.round(lv * WORD_POWER_PER_LEVEL * 100)}% harder
                    </div>
                    {#if wordGift(w.id)}
                      <div class="tip-line tip-sub">
                        {#if next}
                          Practice {next}: {wordGift(w.id)}
                        {:else}
                          Fully practised — {wordGift(w.id)}, thrice over
                        {/if}
                      </div>
                    {/if}
                  {/if}
                  {#if w.stacked && known(w)}
                    {@const deep = masteredTier(gs, w.id)}
                    {@const uses = wordUses(gs, w.id)}
                    <div class="tip-line tip-sub">
                      Mastery {TIER_MARK[deep] ?? 'I'} — {masteryLine(w, deep, uses)}
                    </div>
                    <div class="tip-line">
                      {deep > 1
                        ? `Drag one onto another in the sentence to fold them into ${w.stacked[0]}.`
                        : `Inscribe with "${w.word}" in ${WORD_MASTERY[0]} different sentences to learn to fold it.`}
                    </div>
                  {/if}
                {/snippet}
              </Tip>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {:else if tab === 'divine'}
    <div class="small dim">
      Miracles are received, never composed — each is an aspect of one deity's power, bought
      with favor earned in their sight. Deeds done for others earn it today; deity-aligned
      deeds and altars will, in time. Hostile powers refuse to be <i>prepared</i> together.
    </div>

    <!-- Filters, in the bestiary's idiom: a tag ORs within its axis and ANDs
         across them, and the search reads names, epithets and character. -->
    <div class="shelf-filters">
      {#each DEITY_TAG_CATEGORIES as axis (axis.id)}
        {@const options = axisOptions(axis.id)}
        {#if options.length}
          <TagPicker
            label={axis.name}
            {options}
            multi
            selected={godTags.filter((t) => DEITY_TAGS[t]?.category === axis.id)}
            onchange={(next) => setAxisTags(axis.id, next)}
          />
        {/if}
      {/each}
      <input class="god-search" placeholder="Search the powers…" bind:value={godSearch} />
      {#if godTags.length || godSearch.trim()}
        <button class="tiny" onclick={() => { godTags = []; godSearch = ''; }}>clear</button>
      {/if}
    </div>

    {#each godGroups as group (group.pantheon?.id ?? 'alone')}
      <div class="pantheon">
        <!-- A pantheon names itself; the unaffiliated get a quieter heading,
             since standing alone is a statement rather than a category. -->
        <div class="pantheon-head small">
          {#if group.pantheon}
            <b>{group.pantheon.icon} {group.pantheon.name}</b>
            {#if group.pantheon.desc}<span class="dim">{group.pantheon.desc}</span>{/if}
          {:else if godGroups.length > 1}
            <span class="dim">Standing alone</span>
          {/if}
        </div>

        <div class="god-grid">
          {#each group.deities as deity (deity.id)}
            {#if openGod === deity.id}
              <!-- Opened in place: the tile becomes a full-width panel, which
                   pushes everything after it down the shelf. -->
              {@const friends = deitiesInRelation(deity.id, 'synergy')}
              {@const foes = deitiesInRelation(deity.id, 'hostile')}
              <div class="god-open">
                <div class="god-open-head">
                  <button
                    class="god-portrait open"
                    onclick={() => (openGod = null)}
                    title="Close"
                    aria-label="Close {deity.name}"
                  >
                    {#if deityArt(deity)}
                      <img src={deityArt(deity)} alt={deity.name} />
                    {:else}
                      <span class="god-glyph">{deity.icon}</span>
                    {/if}
                  </button>

                  <div class="god-ident">
                    <div class="god-name">
                      <b>{deity.name}</b>
                      <span class="dim epithet">{deity.epithet}</span>
                    </div>
                    <div class="chips">
                      {#each deity.tags as t (t)}
                        <span class="chip">{DEITY_TAGS[t]?.icon ?? ''} {DEITY_TAGS[t]?.name ?? t}</span>
                      {/each}
                    </div>
                    <div class="standing small">
                      <span>🕊️ Favor <b>{favorWith(gs, deity.id)}</b></span>
                      <span class="dim">·</span>
                      <span>🙏 Devotion <b>Lv {devotionLevel(gs)}</b></span>
                    </div>
                    <div class="small dim">{deity.desc}</div>
                    {#if friends.length || foes.length}
                      <div class="small relations">
                        {#if friends.length}
                          <span class="rel-good">✨ {friends.map((d) => d.name).join(', ')}</span>
                        {/if}
                        {#if foes.length}
                          <span class="rel-bad">⚡ {foes.map((d) => d.name).join(', ')}</span>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>

                <div class="miracles">
                  {#each miraclesOf(deity.id) as miracle (miracle.id)}
                    {@const c = checkMiracle(gs, miracle.id)}
                    {@const spec = miracleSpec(miracle.id)}
                    <div class="card" class:owned={c.reason === 'Already received'}>
                      <div class="card-head">
                        <b>{miracle.icon} {miracle.name}</b>
                        <span class="small dim">
                          {miracle.favorCost} favor{miracle.minLevel ? ` · Devotion ${miracle.minLevel}` : ''}
                        </span>
                      </div>
                      <div class="small dim">{miracle.desc}</div>
                      {#if spec}{@render spellStats(spec)}{/if}
                      {#if c.reason === 'Already received'}
                        <div class="small owned-note">✅ In your grimoire</div>
                      {:else}
                        <button class="small" disabled={!c.ok} onclick={() => game.learnMiracle(miracle.id)}>
                          {c.ok ? '🙏 Receive' : `🔒 ${c.reason}`}
                        </button>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {:else}
              <button class="god-tile" onclick={() => (openGod = deity.id)}>
                <span class="god-portrait">
                  {#if deityArt(deity)}
                    <img src={deityArt(deity)} alt={deity.name} />
                  {:else}
                    <span class="god-glyph">{deity.icon}</span>
                  {/if}
                </span>
                <span class="god-label">
                  <b>{deity.name}</b>
                  <span class="dim epithet small">{deity.epithet}</span>
                </span>
                <span class="god-favor small">🕊️ {favorWith(gs, deity.id)}</span>
              </button>
            {/if}
          {/each}
        </div>
      </div>
    {/each}

    {#if godGroups.length === 0}
      <div class="small dim">No power answers to that.</div>
    {/if}
  {:else}
    <div class="small dim">
      No words, no prayers — will, injected along axes. Click a ring to set how much power an
      axis holds. The axes are not the working: they are terms, and what you shape is read off
      the QUANTITIES below them — mass held still is a wall, the same mass in motion is a
      hammer. Vitality aims the whole working: turned outward that hammer is thrown, turned
      inward it is your own speed. Some regions of that space have names. Greyed axes await
      teachers.
    </div>
    <div class="favor">
      🧠 <b>{spent}</b> points · cap {psiCap}/axis · teacher tier {psiTier(gs) || 'none'}
      {#if spent > 0}
        <!-- The aim. Every quantity has an outward face and an inward one;
             this is the split between them, and vitality is the dial. -->
        · aimed <b>{Math.round((1 - reading.inward) * 100)}%</b> outward
        / <b>{Math.round(reading.inward * 100)}%</b> inward
      {/if}
    </div>

    <!-- The box is wider than the wheel: the rim labels live in that margin,
         and the flank ones need the most room. -->
    <svg class="wheel" viewBox="-20 -3 140 108" role="group" aria-label="Psionic shaping wheel">
      {#each PSI_AXIS_LIST as axis, i (axis.id)}
        {@const open = openAxes.includes(axis.id)}
        {#each Array.from({ length: psiCap }, (_, r) => r + 1) as ring (ring)}
          <path
            d={arcPath(i, ring, psiCap)}
            class="seg"
            class:held={open && (shape[axis.id] ?? 0) >= ring}
            class:locked={!open}
            style="--axis: {axis.color}"
            role="button"
            tabindex={open ? 0 : -1}
            aria-label={`${axis.name} ${ring}`}
            onclick={() => open && setAxis(axis.id, ring)}
            onkeydown={(e) => e.key === 'Enter' && open && setAxis(axis.id, ring)}
          />
        {/each}
      {/each}
      <!-- Each wedge says what it is, on the rim: no counting round the wheel
           to find which one is Mass, and the held count reads at a glance. -->
      {#each PSI_AXIS_LIST as axis, i (axis.id)}
        {@const open = openAxes.includes(axis.id)}
        {@const at = labelAt(i)}
        <text
          class="axis-label"
          class:locked={!open}
          x={at.x}
          y={at.y}
          text-anchor={at.anchor}
          style="--axis: {axis.color}"
        >
          <tspan>{axis.icon}</tspan>
          <tspan class="axis-name" dx="0.8">{axis.name}</tspan>
          <tspan class="axis-count" dx="1">{open ? (shape[axis.id] ?? 0) : '🔒'}</tspan>
        </text>
      {/each}
    </svg>
    <div class="legend">
      {#each PSI_AXIS_LIST as axis (axis.id)}
        {@const open = openAxes.includes(axis.id)}
        <Tip>
          <span class="legend-item" class:dim={!open}>
            <span class="dot" style="background: {axis.color}"></span>
            {axis.icon} {axis.name} <b>{open ? (shape[axis.id] ?? 0) : '🔒'}</b>
          </span>
          {#snippet tip()}
            <div class="tip-line tip-base">{axis.icon} {axis.name}</div>
            <div class="tip-line">{axis.desc}</div>
            {#if !open}<div class="tip-line tip-sub">A teacher must open this axis.</div>{/if}
          {/snippet}
        </Tip>
      {/each}
    </div>

    <!-- What the resolver reads. These move as the dials turn; every part of
         the working below is a function of one of them. -->
    <div class="quantities">
      {#each PSI_QUANTITY_LIST as q (q.id)}
        {@const value = reading[q.id]}
        {@const fill = Math.min(1, value / quantityMax[q.id](psiCap))}
        <Tip>
          <div class="quantity" class:zero={value <= 0}>
            <div class="q-head">
              <span>{q.icon} {q.name}</span>
              <b>{value.toFixed(q.decimals)}</b>
            </div>
            <div class="q-bar"><div class="q-fill" style="width: {fill * 100}%"></div></div>
          </div>
          {#snippet tip()}
            <div class="tip-line tip-base">{q.icon} {q.name}</div>
            <div class="tip-line tip-sub">{q.formula}</div>
            <div class="tip-line">{q.desc}</div>
          {/snippet}
        </Tip>
      {/each}
    </div>

    <div class="result">
      {#if shapeCheck.ok && shapePreview}
        <div class="preview">
          <b>{shapePreview.icon} {shapePreview.name}</b>
          {#if shapePreview.desc}<div class="small dim">{shapePreview.desc}</div>{/if}
          {@render spellStats(shapePreview)}
        </div>
      {:else}
        <div class="small dim">🔒 {shapeCheck.reason}</div>
      {/if}
      {#if outOfReach}
        <div class="small dim out-of-reach">
          🔒 This shape settles toward <b>{outOfReach.icon} {outOfReach.name}</b> — a region your
          mind cannot hold until a teacher raises you to tier {outOfReach.tier}.
        </div>
      {/if}
      {#if tooWide}
        <div class="small out-of-reach too-wide">
          🧠 Wider than you can hold: it asks <b>{tooWide.cost.toFixed(2)}</b> focus and your mind
          holds <b>{tooWide.ceiling}</b>. You may shape it, but nothing will cast it until
          Charisma widens you.
        </div>
      {/if}
    </div>

    <!-- Shapes held in mind. A psionic reallocates rather than looks things
         up, so getting back to an allocation you already know must not mean
         re-dialling eight axes. -->
    <div class="memorized">
      <div class="small dim">
        🧠 Held in mind <span class="dim">{memorized.length}/{MAX_PSI_MEMORIZED}</span>
        {#if memorized.length === 0}
          — memorise an allocation to switch back to it in one click.
        {/if}
      </div>
      <div class="mem-row">
        {#each memorized as mem, i (mem.name + i)}
          {@const active = shapeKey(mem.shape) === shapeKey(shape)}
          <span class="mem-chip" class:active>
            <button
              class="mem-load"
              title={psiShapeSummary(mem.shape)}
              onclick={() => (shape = { ...mem.shape })}
            >
              {mem.name}
            </button>
            <button class="mem-drop" title="Forget this shape" onclick={() => game.forgetPsiShape(i)}>
              ×
            </button>
          </span>
        {/each}
      </div>
    </div>

    <div class="bench-actions">
      <button disabled={!shapeCheck.ok || !!outOfReach} onclick={() => game.shapePsionic(shape)}>
        🧠 Shape
      </button>
      <button
        disabled={!shapeCheck.ok || memorized.length >= MAX_PSI_MEMORIZED || alreadyHeld}
        title={alreadyHeld ? 'You already hold this allocation in mind' : 'Hold this allocation in mind'}
        onclick={() => game.memorizePsiShape(shape)}
      >
        📌 Memorise
      </button>
      <button disabled={spent === 0} onclick={() => (shape = {})}>Clear</button>
    </div>
  {/if}

  <!-- The grimoire: every crafted spell, whatever school made it. Prepared
       spells join the combat rotation; the cap keeps that a choice. -->
  <div class="grimoire">
    <div class="grim-head">
      <h4>📖 Grimoire</h4>
      <Tip>
        <span class="small dim">{prepared}/{preparedCap(gs)} prepared for combat</span>
        {#snippet tip()}
          <div class="tip-line tip-base">Pages you can hold ready</div>
          <div class="tip-line tip-sub">
            {BASE_PREPARED} to begin with, and one more for every {PREPARED_PER_LEVELS} levels
            of Arcana, Psionics or Devotion — each counted on its own.
          </div>
          <div class="tip-line">
            A page earned studying one school may hold a working from any of them.
          </div>
        {/snippet}
      </Tip>
    </div>
    {#if gs.grimoire.length === 0}
      <div class="small dim">Empty. Whatever you craft here, whichever school, is written into it.</div>
    {:else}
      {#each gs.grimoire as spell (spell.uid)}
        {@const spec = resolveSpell(spell)}
        <div class="spell-row" class:prep={spell.prepared}>
          <span class="school" title={spec.school}>{SCHOOL_ICON[spec.school]}</span>
          <div class="spell-main">
            {#if renaming === spell.uid}
              <input
                class="rename"
                bind:value={renameText}
                onkeydown={(e) => e.key === 'Enter' && commitRename()}
                onblur={commitRename}
              />
            {:else}
              <Tip>
                <b>{spec.icon} {spec.name}</b>
                {#snippet tip()}
                  <div class="tip-line tip-base">{spec.icon} {spec.name}</div>
                  <div class="tip-line tip-sub">{sourceLine(spell)}</div>
                  {#each specLines(spec) as line}<div class="tip-line">{line}</div>{/each}
                  <div class="tip-line tip-sub">
                    {targetLabel(spec)}
                    {#if spec.focusCost}· 🧠 {spec.focusCost.toFixed(2)}{:else}· 💧 {spec.manaCost}{/if}
                    · ⏱️ {(spec.cooldown / TPS).toFixed(1)}s
                  </div>
                {/snippet}
              </Tip>
              <span class="small dim src">{sourceLine(spell)}</span>
            {/if}
          </div>
          <button
            class="tiny"
            class:selected={spell.prepared}
            onclick={() => game.prepareSpell(spell.uid, !spell.prepared)}
          >
            {spell.prepared ? '⚔️ prepared' : 'prepare'}
          </button>
          <!-- A working that lands on you needs no enemy: cast it between
               fights for the road and the workbench. -->
          {#if isUtilityWorking(spec)}
            {@const ready = utilityCooldown(gs, spell.uid)}
            {@const check = canCastUtility(gs, spell.uid)}
            <button
              class="tiny"
              disabled={!check.ok}
              title={check.ok ? `Cast ${spec.name} on yourself` : check.reason}
              onclick={() => game.castUtility(spell.uid)}
            >
              {ready > 0 ? `⏳ ${(ready / TPS).toFixed(0)}s` : '✨ cast'}
            </button>
          {/if}
          <button class="tiny" onclick={() => startRename(spell)} title="Rename">✏️</button>
          <button class="tiny" onclick={() => game.forgetSpell(spell.uid)} title="Forget">🗑️</button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .spellcraft {
    max-width: 520px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .spellcraft.large {
    max-width: none;
    min-width: 560px;
  }

  .tabs {
    display: flex;
    gap: 6px;
  }

  .tabs button {
    padding: 4px 10px;
  }

  /* ----- the sentence strip ----- */

  .strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-height: 46px;
    padding: 8px;
    border: 1px dashed var(--border);
    border-radius: 8px;
    background: var(--bg-panel);
    position: relative;
  }

  .strip-hint {
    padding: 4px;
  }

  .cap-note {
    margin-left: auto;
    align-self: flex-end;
  }

  .tile {
    padding: 4px 10px;
    border-radius: 14px;
    border: 1px solid var(--tint, var(--border));
    background: color-mix(in srgb, var(--tint, var(--border)) 12%, var(--bg-raised));
    cursor: grab;
    white-space: nowrap;
  }

  .tile.dragging {
    opacity: 0.4;
  }

  .tile.drop-before {
    box-shadow: -3px 0 0 0 var(--accent);
  }

  /* About to fold into its twin: the tile swells rather than making room. */
  .tile.fusing {
    box-shadow: 0 0 0 2px var(--accent);
    transform: scale(1.08);
  }

  .tier-mark {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.5px;
    opacity: 0.75;
    vertical-align: super;
    margin-left: 1px;
  }

  /* Practice sits low and quiet, so it never reads as part of the numeral. */
  .word-lv {
    font-size: 9px;
    font-weight: 700;
    opacity: 0.6;
    vertical-align: sub;
    margin-left: 2px;
  }

  .tile.locked {
    opacity: 0.45;
    cursor: default;
  }

  /* Mastered tier vocabulary: denser, darker, worn like a medal. */
  .tile.deep {
    border-style: double;
    border-width: 3px;
    padding: 2px 8px;
    font-size: 12.5px;
  }

  .tile.deep.locked {
    border-style: dashed;
    border-width: 1px;
    font-size: 11px;
  }

  .kind-noun {
    --tint: var(--accent);
  }

  .kind-verb {
    --tint: var(--xp);
  }

  .kind-adverb {
    --tint: var(--manaburn);
  }

  .kind-target {
    --tint: var(--mana);
  }

  .kind-conjunction {
    --tint: var(--spirit);
  }

  /* ----- palette ----- */

  .palette {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-head {
    margin-bottom: 4px;
  }

  .words {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  /* ----- preview + actions ----- */

  .result {
    min-height: 30px;
  }

  .preview {
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: 6px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .stat-row {
    display: flex;
    gap: 12px;
    color: var(--text-dim);
  }

  .spec-line {
    color: var(--text);
  }

  .bench-actions {
    display: flex;
    gap: 8px;
  }

  /* ----- divine ----- */

  .favor {
    font-size: 15px;
  }

  /* The shelf: filters, then a pantheon at a time. */
  .shelf-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .god-search {
    font: inherit;
    font-size: 12px;
    color: var(--text);
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px 8px;
    min-width: 140px;
    flex: 1;
  }

  .pantheon {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .pantheon-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .pantheon-head:empty {
    display: none;
  }

  /*
   * Portraits in a grid. An opened god replaces its own tile with a panel
   * spanning every column, so the powers after it are pushed down the shelf
   * rather than the whole page changing under the hand.
   */
  .god-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
    align-items: start;
  }

  .god-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 6px 6px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    text-align: center;
  }

  .god-tile:hover {
    border-color: var(--accent);
    background: var(--bg-raised);
  }

  .god-portrait {
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 8px;
    background: var(--bg);
    border: 1px solid var(--border);
  }

  .god-portrait img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .god-glyph {
    font-size: 34px;
    line-height: 1;
  }

  .god-label {
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }

  .god-favor {
    color: var(--text-dim);
  }

  /* Opened in place. */
  .god-open {
    grid-column: 1 / -1;
    border: 1px solid var(--accent);
    border-radius: 10px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--bg-panel);
  }

  .god-open-head {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .god-portrait.open {
    width: 132px;
    flex-shrink: 0;
    cursor: pointer;
  }

  .god-portrait.open:hover {
    border-color: var(--accent);
  }

  .god-portrait.open .god-glyph {
    font-size: 56px;
  }

  .god-ident {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .god-name {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 15px;
  }

  .standing {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .miracles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 8px;
  }

  @media (max-width: 640px) {
    .god-open-head {
      flex-direction: column;
    }
    .god-portrait.open {
      width: 100%;
    }
  }

  .epithet {
    font-style: italic;
  }

  .deity-favor {
    margin-left: auto;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chip {
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 10px;
    border: 1px solid var(--border);
    color: var(--text-dim);
  }

  .relations {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .rel-good {
    color: var(--xp);
  }

  .rel-bad {
    color: var(--danger);
  }

  .card {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .card.owned {
    border-color: var(--xp);
  }

  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .card button {
    align-self: flex-start;
  }

  .owned-note {
    color: var(--xp);
  }

  /* ----- psionic: the wheel ----- */

  .wheel {
    width: 380px;
    max-width: 100%;
    align-self: center;
  }

  .seg {
    fill: var(--bg-raised);
    stroke: var(--border);
    stroke-width: 0.3;
    cursor: pointer;
    transition: fill 0.1s;
  }

  /* A mouse click focuses the segment and leaves the browser's focus ring
     behind; suppress it for pointer focus but keep it for keyboard users. */
  .seg:focus:not(:focus-visible) {
    outline: none;
  }

  .seg:focus-visible {
    outline: 1.5px solid var(--accent);
    outline-offset: 1px;
  }

  .seg:hover:not(.locked) {
    fill: color-mix(in srgb, var(--axis) 35%, var(--bg-raised));
  }

  .seg.held {
    fill: var(--axis);
    stroke: color-mix(in srgb, var(--axis) 60%, black);
  }

  .seg.locked {
    fill: var(--bg-panel);
    cursor: default;
    opacity: 0.5;
  }

  /* Rim labels: the wheel names its own wedges. */
  .axis-label {
    font-size: 4.2px;
    fill: var(--text);
    dominant-baseline: middle;
    pointer-events: none;
    user-select: none;
  }

  .axis-label.locked {
    opacity: 0.45;
  }

  .axis-label .axis-name {
    fill: color-mix(in srgb, var(--axis) 75%, var(--text));
  }

  .axis-label .axis-count {
    font-weight: 700;
    fill: var(--axis);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    justify-content: center;
  }

  /* ----- psionic: shapes held in mind ----- */

  .memorized {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .mem-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .mem-chip {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--border);
    border-radius: 5px;
    overflow: hidden;
    background: var(--bg-raised);
  }

  .mem-chip.active {
    border-color: var(--accent);
  }

  .mem-load {
    background: none;
    border: none;
    color: var(--text);
    font-size: 12px;
    padding: 3px 7px;
    cursor: pointer;
  }

  .mem-load:hover {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
  }

  .mem-drop {
    background: none;
    border: none;
    border-left: 1px solid var(--border);
    color: var(--text-dim);
    font-size: 12px;
    padding: 3px 6px;
    cursor: pointer;
  }

  .mem-drop:hover {
    background: color-mix(in srgb, var(--danger, #e05555) 30%, transparent);
    color: var(--text);
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12.5px;
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
  }

  /* ----- psionic: the derived readouts ----- */

  .quantities {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
    gap: 6px 12px;
  }

  .quantity {
    display: flex;
    flex-direction: column;
    gap: 3px;
    cursor: help;
  }

  /* A quantity at zero is still a statement about the shape, so it stays
     listed and legible — just quiet. */
  .quantity.zero {
    opacity: 0.42;
  }

  .q-head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    white-space: nowrap;
  }

  .q-bar {
    height: 3px;
    border-radius: 2px;
    background: var(--bg-raised);
    overflow: hidden;
  }

  .q-fill {
    height: 100%;
    background: var(--spirit);
    transition: width 0.12s;
  }

  .out-of-reach {
    margin-top: 6px;
  }

  /* Not a lock — the shape is legal. It just has nowhere to be cast from. */
  .too-wide {
    color: var(--focus);
  }

  button.tiny {
    padding: 2px 8px;
    font-size: 12px;
  }

  /* ----- grimoire ----- */

  .grimoire {
    border-top: 1px solid var(--border);
    padding-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .grim-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .grim-head h4 {
    margin: 0;
  }

  .spell-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 6px;
  }

  .spell-row.prep {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .spell-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .src {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rename {
    font: inherit;
    color: var(--text);
    background: var(--bg-raised);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: 2px 6px;
  }

  .small {
    font-size: 12.5px;
  }

  .dim {
    color: var(--text-dim);
  }
</style>
