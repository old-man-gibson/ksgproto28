<script lang="ts">
  import { DEBUG_SETTLE_KEY, gs, game } from '../state.svelte';
  import { AFFIXES, FLOORS, ITEMS, MATERIALS, RUNES, SKILLS } from '../../core/registry';
  import { raiseStat } from '../../core/systems/achievements';
  import { stashToken } from '../../core/systems/stash';
  import { STRONGHOLD_KEY } from '../../core/data/prestige.data';
  import { QUALITY_ORDER, QUALITY_TIERS } from '../../core/data/quality.data';
  import { createItem, grantRune } from '../../core/systems/runes';
  import { grantGraded, isGraded } from '../../core/systems/disciplines';
  import { fmt } from '../lib/format';
  import type { QualityTier } from '../../core/types';
  import { DEITIES, DEITY_LIST } from '../../core/data/deities.data';
  import { ARCANE_WORDS, PSI_AXIS_LIST } from '../../core/data/spellcraft.data';
  import { grantFavor } from '../../core/systems/deities';
  import { grantLevelXp } from '../../core/systems/levels';
  import { recordKill } from '../../core/systems/bestiary';
  import { MONSTERS } from '../../core/registry';
  import { LOCKABLE_SUBSYSTEMS, unlockKey, wordUnlockKey } from '../../core/systems/unlocks';
  import { learnPsiAxis, raisePsiTier } from '../../core/systems/psionic';
  import { TECHNIQUES, TECHNIQUE_LIST } from '../../core/data/martial.data';
  import { learnTechnique, resetTechnique } from '../../core/systems/martial';
  import type { TechniqueForm } from '../../core/types';
  import { BASELINE_LAYOUT, MAIN_GENES, MUTATIONS, NUCLEASES } from '../../core/data/mutagens.data';
  import {
    SWAP_COOLDOWN_KEY,
    edgeKey,
    fuse,
    fusionOf,
    setSkipSettling,
    settlingLeft,
    skippingSettling,
    unlockMutagens,
  } from '../../core/systems/mutagens';

  /**
   * Developer tools. Stripped from production builds — App.svelte only mounts
   * this behind `import.meta.env.DEV`, so nothing here can reach a deployed
   * game even by accident.
   *
   * Everything writes through the same functions the game itself uses
   * (`createItem`, `grantRune`, `grantGraded`) rather than poking state
   * directly, so a debug-spawned item is indistinguishable from a looted one —
   * which is the only way testing with them proves anything.
   */

  let { onClose }: { onClose: () => void } = $props();

  const itemList = Object.values(ITEMS).sort((a, b) => a.name.localeCompare(b.name));
  const materialList = Object.values(MATERIALS).sort((a, b) => a.name.localeCompare(b.name));
  const runeList = Object.values(RUNES).sort((a, b) => a.name.localeCompare(b.name));
  const skillList = Object.values(SKILLS).sort((a, b) => a.name.localeCompare(b.name));

  // ---- Specific item ----
  let itemId = $state(itemList[0]?.id ?? '');
  let itemQty = $state(1);
  /** '' = no affix; otherwise an index into AFFIXES. */
  let affixIdx = $state<string>('');
  /** '' = roll it normally, as a drop would. */
  let slotCount = $state<string>('');

  // ---- Materials ----
  let matId = $state(materialList[0]?.id ?? '');
  let matQty = $state(10);
  let matQuality = $state<QualityTier>('c');

  // ---- Runes ----
  let runeId = $state(runeList[0]?.id ?? '');
  let runeQty = $state(1);

  // ---- Skills ----
  let skillId = $state('runecarving');
  let skillLevel = $state(25);

  let note = $state('');
  const say = (msg: string) => (note = msg);

  function giveItem(defId: string, qty = 1, affix?: number, slots?: number) {
    for (let i = 0; i < qty; i++) {
      const item = createItem(gs, defId);
      if (affix !== undefined && AFFIXES[affix]) item.affix = AFFIXES[affix];
      if (slots !== undefined) {
        item.slots = slots;
        item.runes = [];
      }
      gs.inventory.push(item);
    }
  }

  function giveChosenItem() {
    const affix = affixIdx === '' ? undefined : Number(affixIdx);
    const slots = slotCount === '' ? undefined : Number(slotCount);
    giveItem(itemId, itemQty, affix, slots);
    say(`+${itemQty} ${ITEMS[itemId]?.name}`);
  }

  /** One plain example of every item — the fastest way to eyeball equipment. */
  function giveAllItems() {
    for (const def of itemList) giveItem(def.id, 1);
    say(`+${itemList.length} items (one of each)`);
  }

  /** One of everything, affixed and fully socketed — for testing the extremes. */
  function giveAllItemsLoaded() {
    for (const def of itemList) {
      giveItem(def.id, 1, Math.floor(Math.random() * AFFIXES.length), 4);
    }
    say(`+${itemList.length} items (affixed, 4 slots)`);
  }

  function giveMaterial() {
    if (isGraded(matId)) grantGraded(gs, matId, matQuality, matQty);
    else gs.materials[matId] = (gs.materials[matId] ?? 0) + matQty;
    say(`+${matQty} ${MATERIALS[matId]?.name}`);
  }

  /** Every material, at every grade — enough to exercise any bench. */
  function giveAllMaterials(qty = 20) {
    for (const mat of materialList) {
      if (mat.graded) for (const q of QUALITY_ORDER) grantGraded(gs, mat.id, q, qty);
      else gs.materials[mat.id] = (gs.materials[mat.id] ?? 0) + qty;
    }
    say(`+${qty} of every material, every grade`);
  }

  function giveRune() {
    grantRune(gs, game.bus, runeId, runeQty);
    say(`+${runeQty} ${RUNES[runeId]?.name}`);
  }

  function giveAllRunes(qty = 3) {
    for (const rune of runeList) grantRune(gs, game.bus, rune.id, qty, true);
    say(`+${qty} of every rune`);
  }

  function setSkill() {
    gs.skills[skillId] = { level: skillLevel, xp: 0 };
    say(`${SKILLS[skillId]?.name} → level ${skillLevel}`);
  }

  function giveGold(amount: number) {
    gs.gold += amount;
    say(`+${fmt(amount)} gold`);
  }

  function giveLevelXp(amount: number) {
    grantLevelXp(gs, game.bus, amount);
    say(`+${fmt(amount)} level XP`);
  }

  // ---- The ladder and the Vermin Festival ----

  /**
   * Stamp the counters every floor below `clearTo` clears on, as if climbed.
   * Past floor 11 the stronghold is marked held too, as a real climb past it
   * has been: its wave ends the run, and only later runs reach the harbor.
   */
  let clearTo = $state(15);
  function clearBelow() {
    const top = Math.max(1, Math.floor(clearTo));
    for (const floor of Object.values(FLOORS)) {
      if (floor.bandId === undefined || floor.index >= top) continue;
      for (const c of floor.clear ?? []) if (c.type === 'stat') raiseStat(gs, game.bus, c.key, c.value);
    }
    if (top > 11) {
      gs.prestige.stronghold = true;
      raiseStat(gs, game.bus, STRONGHOLD_KEY, 1);
    }
    say(`Floors 1–${top - 1} cleared${top > 11 ? ', stronghold held' : ''}: the ladder reaches floor ${top}.`);
  }

  let attrLevel = $state(60);
  function setAttrs() {
    for (const a of Object.keys(gs.attrs) as (keyof typeof gs.attrs)[]) gs.attrs[a].level = attrLevel;
    say(`Every attribute → ${attrLevel}`);
  }

  /** Move the festival clock on by a day (it runs only while the game does). */
  function festivalDay() {
    const run = gs.festival?.run;
    if (!run || run.phase !== 'prep') return say('No festival hub phase in progress.');
    run.clock += 14_400;
    say('Festival clock +1 day.');
  }

  /** A festival token into the stronghold stash, as the hundredth win of a run puts one. */
  function giveToken() {
    stashToken(gs, Math.floor(Math.random() * 0x100000000));
    say('A festival token is in the stronghold stash (Prestige tab).');
  }

  // ---- Spellcraft ----
  let favorDeity = $state(DEITY_LIST[0]?.id ?? '');
  let favorAmount = $state(10);

  function giveFavor(all: boolean) {
    if (all) for (const d of DEITY_LIST) grantFavor(gs, d.id, favorAmount);
    else grantFavor(gs, favorDeity, favorAmount);
    say(`+${favorAmount} favor ${all ? 'with every deity' : `with ${DEITIES[favorDeity]?.name}`}`);
  }

  /**
   * Mastery counts DISTINCT sentences in the arcana ledger, so seed it with
   * synthetic combo keys — one imaginary sentence per use, per word.
   */
  function masterAllWords(uses = 20) {
    const counts = ((gs.novelty.arcana ??= {}));
    for (const w of Object.values(ARCANE_WORDS)) {
      for (let i = 0; i < uses; i++) counts[`arcane:${w.id},debugseed${i}`] = 1;
    }
    say(`every word credited with ${uses} distinct sentences — all tiers speakable`);
  }

  /**
   * Kill every species `kills` times through `recordKill`, so the book fills
   * the way hunting fills it: entries, facts at their `sureKills`, the log
   * lines. Habitats stay empty — those come from sightings at a spot.
   */
  function recordAllCreatures(kills = 20) {
    for (const id of Object.keys(MONSTERS)) {
      for (let i = 0; i < kills; i++) recordKill(gs, game.bus, id);
    }
    say(`every creature recorded with ${kills} kills`);
  }

  /** Lift every alpha shutter (`flag:unlock_<id>`, unlocks.ts): tabs and benches appear. */
  function openAllSubsystems() {
    for (const id of LOCKABLE_SUBSYSTEMS) gs.stats[unlockKey(id)] = 1;
    say(`opened ${LOCKABLE_SUBSYSTEMS.join(', ')}`);
  }

  /** Lift the starter-lexicon shutter for every word (`flag:word:<id>`, unlocks.ts). */
  function unlockAllWords() {
    for (const w of Object.values(ARCANE_WORDS)) gs.stats[wordUnlockKey(w.id)] = 1;
    say('every arcane word unlocked');
  }

  function openAllPsi() {
    for (const axis of PSI_AXIS_LIST) learnPsiAxis(gs, axis.id);
    say('every psionic axis opened');
  }

  // ---- Martial ----
  let techId = $state(TECHNIQUE_LIST[0]?.id ?? '');
  let techForm = $state<TechniqueForm>('canonical');
  let techReps = $state(0);

  function learnTech() {
    const def = TECHNIQUES[techId];
    if (!def) return;
    learnTechnique(gs, def, techForm);
    // Debug may set forms freely — learnTechnique itself never downgrades.
    gs.techniques[techId].form = techForm;
    if (techReps > 0) gs.techniques[techId].executions = techReps;
    say(`${def.name} learned (${techForm}${techReps ? `, ${techReps} reps` : ''})`);
  }

  function learnAllTech() {
    for (const def of TECHNIQUE_LIST) learnTechnique(gs, def, 'canonical');
    say(`all ${TECHNIQUE_LIST.length} techniques learned (canonical)`);
  }

  function resetTech() {
    resetTechnique(gs, techId);
    say(`${TECHNIQUES[techId]?.name} reset — unknown again`);
  }

  function resetAllTech() {
    for (const def of TECHNIQUE_LIST) resetTechnique(gs, def.id);
    say('every technique reset');
  }

  /** The self-learn counters, force-fed — crystallization fires next combat tick. */
  function feedCounters(n: number) {
    for (const key of ['combat:attacks', 'combat:crits', 'combat:dodges', 'combat:parries', 'combat:hitsTaken']) {
      gs.stats[key] = (gs.stats[key] ?? 0) + n;
    }
    say(`+${n} to every martial counter`);
  }

  function setPsiTier(tier: number) {
    raisePsiTier(gs, tier);
    say(`psionic teacher tier → ${tier}`);
  }

  // ---- Mutagens ----
  const geneList = Object.values(MAIN_GENES).sort((a, b) => a.name.localeCompare(b.name));
  const mutagenList = Object.values(MUTATIONS).sort((a, b) => a.name.localeCompare(b.name));

  let lowerArm = $state<'g' | 'i'>('g');
  let geneQuality = $state<QualityTier>('c');
  let biomatterQty = $state(500);

  /**
   * The quest hands out the starting kit, so this is the quest — nothing here
   * writes `unlocked` by hand, or the two paths could drift.
   */
  function openMutagens() {
    unlockMutagens(gs, game.bus, lowerArm);
    say(`chromosome opened — centromere, d, and ${lowerArm}`);
  }

  /** Every connection paid for, so the whole graph is there to cut at. */
  function wireChromosome() {
    const c = gs.mutagens.chromosome;
    for (const e of BASELINE_LAYOUT.edges) {
      const key = edgeKey(e.a, e.b);
      if (!c.established.includes(key)) c.established.push(key);
    }
    say(`all ${BASELINE_LAYOUT.edges.length} connections established`);
  }

  /** One of each, ungraded — a nuclease carries no magnitude to have a grade. */
  function giveNucleases(qty = 5) {
    for (const n of Object.values(NUCLEASES)) {
      gs.materials[n.id] = (gs.materials[n.id] ?? 0) + qty;
    }
    say(`+${qty} of every nuclease`);
  }

  /**
   * Fuse every legal pairing at the chosen grade, going through the real `fuse`
   * so a debug-made fused mutagen is indistinguishable from an earned one.
   */
  function fuseEverything() {
    gs.materials.biomatter = (gs.materials.biomatter ?? 0) + 5000;
    let made = 0;
    for (const n of Object.values(NUCLEASES)) {
      gs.materials[n.id] = (gs.materials[n.id] ?? 0) + 200;
      for (const m of Object.values(MUTATIONS)) {
        if (m.rekey || !fusionOf(n.id, m.id)) continue;
        grantGraded(gs, m.id, geneQuality, 1);
        if (fuse(gs, game.bus, n.id, m.id, geneQuality)) made += 1;
      }
    }
    say(`fused ${made} pairings at ${QUALITY_TIERS[geneQuality].name}`);
  }

  function giveBiomatter() {
    gs.materials.biomatter = (gs.materials.biomatter ?? 0) + biomatterQty;
    say(`+${fmt(biomatterQty)} biomatter`);
  }

  /**
   * Genes and mutagens ARE graded materials, so they go in through the same
   * door as everything else — a debug-spawned gene is indistinguishable from a
   * harvested one, which is the only way testing with them proves anything.
   */
  function giveGenes(qty = 4) {
    for (const def of [...geneList, ...mutagenList]) grantGraded(gs, def.id, geneQuality, qty);
    say(`+${qty} of every gene and mutagen at ${QUALITY_TIERS[geneQuality].name}`);
  }

  function giveGenesEveryGrade(qty = 4) {
    for (const def of [...geneList, ...mutagenList]) {
      for (const q of QUALITY_ORDER) grantGraded(gs, def.id, q, qty);
    }
    say(`+${qty} of every gene and mutagen, every grade`);
  }

  /** Open, wired, stocked and skilled — one click to a chromosome worth playing with. */
  /**
   * The centromere's settling period, switched off.
   *
   * Persisted outside the save, because it configures the RULES rather than
   * the character — a real save must never
   * carry it. state.svelte.ts pushes the stored value into the core at boot,
   * so it survives a reload without opening this panel.
   */
  let skipSettle = $state(skippingSettling());
  /**
   * Ticks still to run. Reads `skipSettle` as well as the state, deliberately:
   * `settlingLeft` consults a MODULE flag, which Svelte cannot track, so
   * without naming the reactive local here the button below would keep saying
   * whatever it said before the toggle was flipped.
   */
  const settling = $derived(skipSettle ? 0 : settlingLeft(gs));
  function toggleSkipSettle() {
    skipSettle = !skipSettle;
    setSkipSettling(skipSettle);
    if (skipSettle) localStorage.setItem(DEBUG_SETTLE_KEY, '1');
    else localStorage.removeItem(DEBUG_SETTLE_KEY);
    say(skipSettle ? 'centromere swaps settle instantly' : 'centromere swaps have to take again');
  }

  /** Clear a settling period already running, without changing the rule. */
  function clearSettling() {
    if (gs.useCooldowns) delete gs.useCooldowns[SWAP_COOLDOWN_KEY];
    say('the body has taken');
  }

  function primeMutagens() {
    unlockMutagens(gs, game.bus, lowerArm);
    wireChromosome();
    gs.skills.geneshaping = { level: 40, xp: 0 };
    gs.materials.biomatter = (gs.materials.biomatter ?? 0) + 2000;
    giveGenesEveryGrade();
    say('mutagens primed: open, fully wired, Geneshaping 40, everything stocked');
  }
</script>

<div class="debug">
  <div class="head">
    <b>🐞 Debug</b>
    <span class="dim small">dev build only</span>
    <button class="small" onclick={onClose}>Close</button>
  </div>

  <div class="row">
    <button onclick={giveAllItems}>One of every item</button>
    <button onclick={giveAllItemsLoaded}>…affixed &amp; 4-socketed</button>
  </div>

  <div class="section">
    <div class="label">Specific item</div>
    <div class="row">
      <select bind:value={itemId}>
        {#each itemList as def (def.id)}
          <!-- A forged class stub mints that class's exemplar (createItem): said so, since "Katana" is also a shop item. -->
          <option value={def.id}>{def.icon} {def.name}{def.id.startsWith('forged:') ? ' (forged exemplar)' : ''}</option>
        {/each}
      </select>
      <input type="number" min="1" max="999" bind:value={itemQty} title="How many" />
    </div>
    <div class="row">
      <select bind:value={affixIdx} title="Prefix">
        <option value="">no prefix</option>
        {#each AFFIXES as affix, i (affix.name)}
          <option value={String(i)}>{affix.name}</option>
        {/each}
      </select>
      <select bind:value={slotCount} title="Rune slots">
        <option value="">roll slots</option>
        {#each [0, 1, 2, 3, 4] as n (n)}
          <option value={String(n)}>{n} slot{n === 1 ? '' : 's'}</option>
        {/each}
      </select>
      <button onclick={giveChosenItem}>Give</button>
    </div>
    <div class="dim small">
      Equipment has no rarity of its own — prefix and rune slots are the axes that vary.
    </div>
  </div>

  <div class="section">
    <div class="label">Materials</div>
    <div class="row">
      <select bind:value={matId}>
        {#each materialList as mat (mat.id)}
          <option value={mat.id}>{mat.icon} {mat.name}{mat.graded ? ' ⭐' : ''}</option>
        {/each}
      </select>
      <input type="number" min="1" max="9999" bind:value={matQty} />
      <select bind:value={matQuality} disabled={!isGraded(matId)} title="Grade">
        {#each [...QUALITY_ORDER].reverse() as q (q)}
          <option value={q}>{QUALITY_TIERS[q].name}</option>
        {/each}
      </select>
      <button onclick={giveMaterial}>Give</button>
    </div>
    <div class="row">
      <button onclick={() => giveAllMaterials()}>Every material, every grade</button>
    </div>
  </div>

  <div class="section">
    <div class="label">Runes</div>
    <div class="row">
      <select bind:value={runeId}>
        {#each runeList as rune (rune.id)}
          <option value={rune.id}>{rune.icon} {rune.name}</option>
        {/each}
      </select>
      <input type="number" min="1" max="99" bind:value={runeQty} />
      <button onclick={giveRune}>Give</button>
      <button onclick={() => giveAllRunes()}>All</button>
    </div>
  </div>

  <div class="section">
    <div class="label">Skills &amp; gold</div>
    <div class="row">
      <select bind:value={skillId}>
        {#each skillList as skill (skill.id)}
          <option value={skill.id}>{skill.icon} {skill.name}</option>
        {/each}
      </select>
      <input type="number" min="0" max="200" bind:value={skillLevel} />
      <button onclick={setSkill}>Set level</button>
    </div>
    <div class="row">
      <button onclick={() => giveGold(1000)}>+1k gold</button>
      <button onclick={() => giveGold(1_000_000)}>+1M gold</button>
      <button onclick={() => giveLevelXp(100)}>+100 level XP</button>
      <button onclick={() => giveLevelXp(1000)}>+1k level XP</button>
      <button onclick={() => recordAllCreatures()}>Record every creature</button>
      <button onclick={openAllSubsystems}>Open locked systems</button>
    </div>
  </div>

  <div class="section">
    <div class="label">Spellcraft</div>
    <div class="row">
      <select bind:value={favorDeity}>
        {#each DEITY_LIST as d (d.id)}
          <option value={d.id}>{d.icon} {d.name}</option>
        {/each}
      </select>
      <input type="number" min="1" max="999" bind:value={favorAmount} />
      <button onclick={() => giveFavor(false)}>Favor</button>
      <button onclick={() => giveFavor(true)}>All deities</button>
    </div>
    <div class="row">
      <button onclick={unlockAllWords}>Unlock every word</button>
      <button onclick={() => masterAllWords()}>Master every word</button>
      <button onclick={openAllPsi}>Open all psi axes</button>
      {#each [4, 8, 12] as t (t)}
        <button onclick={() => setPsiTier(t)}>Tier {t}</button>
      {/each}
    </div>
    <div class="dim small">
      Word mastery writes the arcana novelty ledger; psi gates write state.psi — both exactly
      what teachers and practice will write.
    </div>
  </div>

  <div class="section">
    <div class="label">Ladder &amp; Vermin Festival</div>
    <div class="row">
      <input type="number" min="1" max="99" bind:value={clearTo} title="First floor left uncleared" />
      <button onclick={clearBelow}>Clear every floor below</button>
      <input type="number" min="1" max="999" bind:value={attrLevel} title="Attribute level" />
      <button onclick={setAttrs}>Set every attribute</button>
      <button onclick={festivalDay}>Festival clock +1 day</button>
      <button onclick={giveToken}>Festival token</button>
    </div>
    <div class="dim small">
      Clearing stamps the counters each floor's clear reads; climb with the ladder as usual. 11 tests
      the stronghold, 12 the harbor, 15 the festival (it starts in the dark room), 18 the desert.
    </div>
  </div>

  <div class="section">
    <div class="label">Martial techniques</div>
    <div class="row">
      <select bind:value={techId}>
        {#each TECHNIQUE_LIST as t (t.id)}
          <option value={t.id}>{t.icon} {t.name}</option>
        {/each}
      </select>
      <select bind:value={techForm} title="Form">
        <option value="rough">rough</option>
        <option value="canonical">canonical</option>
        <option value="syncretic">syncretic</option>
      </select>
    </div>
    <div class="row">
      <input type="number" min="0" max="99999" bind:value={techReps} title="Reps (0 = keep)" />
      <button onclick={learnTech}>Learn / set</button>
      <button onclick={resetTech}>Reset</button>
    </div>
    <div class="row">
      <button onclick={learnAllTech}>Learn all (canonical)</button>
      <button onclick={resetAllTech}>Reset all</button>
      <button onclick={() => feedCounters(1000)}>+1k counters</button>
    </div>
    <div class="dim small">
      Per-card overrides (reps, form, fork clear) live on each technique row in the Skills tab.
      Rungs: 10 / 100 / 1,000 (fork) / 10,000.
    </div>
  </div>

  <div class="section">
    <div class="label">Mutagens</div>
    <div class="row">
      <button onclick={primeMutagens}>Prime everything</button>
      <select bind:value={lowerArm} title="Which lower arm the starting kit grants">
        <option value="g">g — attacks</option>
        <option value="i">i — defenses</option>
      </select>
    </div>
    <div class="row">
      <button onclick={openMutagens} disabled={gs.mutagens.unlocked}>
        {gs.mutagens.unlocked ? 'Already open' : 'Open the system'}
      </button>
      <button onclick={wireChromosome}>Wire every edge</button>
    </div>
    <div class="row">
      <select bind:value={geneQuality} title="Grade">
        {#each QUALITY_ORDER as q (q)}
          <option value={q}>{QUALITY_TIERS[q].name}</option>
        {/each}
      </select>
      <button onclick={() => giveGenes()}>Give all at grade</button>
      <button onclick={() => giveGenesEveryGrade()}>Every grade</button>
    </div>
    <div class="row">
      <input type="number" min="1" max="99999" bind:value={biomatterQty} />
      <button onclick={giveBiomatter}>Biomatter</button>
    </div>
    <div class="row">
      <!-- The culture bench cannot fuse yet (it has no slot for an ungraded
           reagent), so this is the only way to reach a rekeyed body in play. -->
      <button onclick={() => giveNucleases()}>Give every nuclease</button>
      <button onclick={fuseEverything}>Fuse all pairings</button>
    </div>
    <div class="row">
      <label class="small" title="Survives a reload — stored outside the save">
        <input type="checkbox" checked={skipSettle} onchange={toggleSkipSettle} />
        Centromere swaps settle instantly
      </label>
      <button onclick={clearSettling} disabled={settling <= 0}>
        {settling > 0 ? `Clear ${(settling / 10).toFixed(0)}s settling` : 'Not settling'}
      </button>
    </div>
    <div class="dim small">
      Genes and mutagens are graded materials, so they also appear in the Materials picker above.
      Nothing drops until the system is open, and only the <b>slimoid</b> line has species that
      exist — the rest are authored ahead of their monsters.
    </div>
  </div>

  {#if note}<div class="note small">{note}</div>{/if}
</div>

<style>
  .debug {
    position: fixed;
    right: 14px;
    bottom: 14px;
    z-index: 200;
    width: 340px;
    max-height: 78vh;
    overflow-y: auto;
    padding: 12px;
    border: 1px solid var(--accent);
    border-radius: 10px;
    background: var(--bg-panel);
    box-shadow: 0 10px 34px rgb(0 0 0 / 55%);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .head button {
    margin-left: auto;
  }

  .section {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }

  .label {
    font-size: 11px;
    color: var(--text-dim);
    margin-bottom: 4px;
  }

  .row {
    display: flex;
    gap: 5px;
    align-items: center;
    margin-bottom: 4px;
  }

  .row select {
    flex: 1;
    min-width: 0;
  }

  .row input[type='number'] {
    width: 62px;
  }

  .note {
    margin-top: 9px;
    padding: 4px 8px;
    border-radius: 5px;
    background: color-mix(in srgb, var(--xp) 18%, transparent);
    color: var(--text);
  }
</style>
