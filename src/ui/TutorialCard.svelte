<script lang="ts">
  import { gs, game, importSave } from './state.svelte';
  import { ARCANE_WORDS } from '../core/data/spellcraft.data';
  import {
    TUTORIAL_RACK,
    TUTORIAL_SHIELD,
    TUTORIAL_SPELLS,
    TUTORIAL_STEP_LIST,
  } from '../core/data/tutorial.data';
  import { tutorialStep, tutorialStepIndex } from '../core/systems/tutorial';
  import { styleSlots, styleUnlocked } from '../core/systems/styles';
  import { specForSource } from '../core/systems/spellcraft';
  import { ITEMS } from '../core/registry';
  import type { TutorialWeapon } from '../core/types';
  import { describeMod, exertionLines, ticksToTime } from './lib/format';
  import Tip from './lib/Tip.svelte';

  /**
   * The tutorial's one panel: the first step the world says is not done, its
   * text, and — on three of them — the choice it hands out. Rendered above
   * the tabs while `flag:tutorial_done` is 0 (see systems/tutorial.ts), so it
   * is readable from whichever tab the step sends the player to.
   *
   * The choices call Game methods and nothing else; every step's completion
   * is read back from the save, never from a local "clicked" flag, which is
   * what makes the panel honest about a player who wandered ahead.
   *
   * `target` is the step's pointer (lib/tutorialFocus.ts); `choice` lights
   * the widget on this card.
   */
  let { target = null }: { target?: string | null } = $props();

  const step = $derived(tutorialStep(gs));
  const pointed = $derived(target === 'choice');
  const index = $derived(tutorialStepIndex(gs));
  const total = TUTORIAL_STEP_LIST.length;

  // The rack: a weapon and, beside a one-handed pick, a shield.
  const weapons: TutorialWeapon[] = ['sword', 'spear', 'dagger', 'hammer', 'unarmed'];
  let weapon = $state<TutorialWeapon>('sword');
  let shield = $state(false);
  const oneHanded = $derived(TUTORIAL_RACK[weapon]?.hands === 'one');

  function rackLabel(w: TutorialWeapon): string {
    const id = TUTORIAL_RACK[w]?.item;
    const def = id ? ITEMS[id] : null;
    return def ? `${def.icon} ${def.name}` : '👊 Unarmed';
  }

  function rackFacts(w: TutorialWeapon): string[] {
    const id = TUTORIAL_RACK[w]?.item;
    const def = id ? ITEMS[id] : null;
    if (!def) return ['No weapon. Both hands free; damage is your bare figure.'];
    const hands = TUTORIAL_RACK[w].hands === 'two' ? 'Two-handed' : 'One-handed';
    return [hands, ...def.mods.map((m) => describeMod(m))];
  }

  const shieldDef = ITEMS[TUTORIAL_SHIELD];

  // Stances: the same roster the Combat tab shows, unlocked ones only.
  const slots = $derived(styleSlots(gs).filter((s) => styleUnlocked(gs, s.stance)));

  // Spells: the three words, each resolved as the one-word sentence it becomes.
  const spells = $derived(
    TUTORIAL_SPELLS.map((word) => {
      const spec = specForSource({ school: 'arcane', words: [word] });
      return { word, def: ARCANE_WORDS[word], spec };
    }),
  );

  /**
   * The offer to a returning player: on the first step only, so it is seen
   * once, on a new save, and gone with the first pick from the rack. Derived
   * from the step like everything else here — nothing is stored. Skipping is
   * two clicks; the second one is the real button. Import sits beside it
   * because the top bar's save buttons wait for the end of the tutorial.
   */
  const offer = $derived(step?.id === TUTORIAL_STEP_LIST[0].id);
  let confirmingSkip = $state(false);
  let fileInput = $state<HTMLInputElement>();

  function onImportChange(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) importSave(file);
    (ev.target as HTMLInputElement).value = '';
  }
</script>

{#if step}
  <section class="tutorial" aria-label="Floor 0, step {index} of {total}">
    <div class="head">
      <span class="count">{index}/{total}</span>
      <h3 class="title">{step.title}</h3>
    </div>
    <p class="body">{step.desc}</p>

    {#if step.choice === 'weapon'}
      <div class="choice" class:tutorial-target={pointed} class:tutorial-glow={pointed}>
        <div class="row">
          {#each weapons as w (w)}
            <Tip>
              <button class:selected={weapon === w} onclick={() => (weapon = w)}>{rackLabel(w)}</button>
              {#snippet tip()}
                {#each rackFacts(w) as line}<div class="tip-line">{line}</div>{/each}
              {/snippet}
            </Tip>
          {/each}
        </div>
        <div class="row">
          <label class="small" class:dim={!oneHanded}>
            <input type="checkbox" bind:checked={shield} disabled={!oneHanded} />
            Take the {shieldDef?.icon} {shieldDef?.name} too ({shieldDef?.mods.map((m) => describeMod(m)).join(', ')})
            {#if !oneHanded}— needs a free hand{/if}
          </label>
          <button class="go" onclick={() => game.chooseTutorialWeapon(weapon, shield && oneHanded)}>
            Take {rackLabel(weapon)}{shield && oneHanded ? ' and the shield' : ''}
          </button>
        </div>
      </div>
    {:else if step.choice === 'stance'}
      <div class="choice" class:tutorial-target={pointed} class:tutorial-glow={pointed}>
        <div class="row">
          {#each slots as slot (slot.stance.id)}
            <Tip>
              <button class:selected={gs.style === slot.stance.id} onclick={() => game.chooseTutorialStance(slot.stance.id)}>
                {slot.stance.icon} {slot.stance.name}
              </button>
              {#snippet tip()}
                <div class="tip-line tip-base">{slot.stance.desc}</div>
                {#each slot.stance.mods as mod}<div class="tip-line">{describeMod(mod)}</div>{/each}
                <div class="tip-line tip-sub">Exertion:</div>
                {#each exertionLines(slot.stance.exertion) as line}<div class="tip-line">{line}</div>{/each}
              {/snippet}
            </Tip>
          {/each}
        </div>
      </div>
    {:else if step.choice === 'spell'}
      <div class="choice" class:tutorial-target={pointed} class:tutorial-glow={pointed}>
        <div class="row">
          {#each spells as s (s.word)}
            <Tip>
              <button onclick={() => game.chooseTutorialSpell(s.word)}>
                {s.def.icon} {s.spec.name} — {s.spec.manaCost} mana
              </button>
              {#snippet tip()}
                <div class="tip-line tip-base">{s.def.desc}</div>
                <div class="tip-line">Costs {s.spec.manaCost} mana, cooldown {ticksToTime(s.spec.cooldown)}</div>
                {#if s.def.element}<div class="tip-line">Damage type: {s.def.element}</div>{/if}
              {/snippet}
            </Tip>
          {/each}
        </div>
      </div>
    {/if}

    {#if offer}
      <div class="offer small">
        {#if confirmingSkip}
          <span>Skip floor 0: you start at the Foot of the Ascent with a rusty sword in your pack.</span>
          <button class="small danger" onclick={() => game.skipTutorial()}>Skip floor 0</button>
          <button class="small" onclick={() => (confirmingSkip = false)}>Cancel</button>
        {:else}
          <span class="dim">Played before?</span>
          <button class="small" onclick={() => (confirmingSkip = true)}>Skip floor 0</button>
          <button class="small" onclick={() => fileInput?.click()}>Import a save</button>
        {/if}
        <input type="file" accept="application/json" bind:this={fileInput} onchange={onImportChange} hidden />
      </div>
    {/if}
  </section>
{/if}

<style>
  /* Not a panel: a heavier frame, a tinted ground and the step number in a
     solid badge, so it does not read as one more block of the page. Sticky
     for the narrow layout, where the page scrolls (App.svelte); inert in
     the wide one, where only the tab body scrolls. Colours are app.css
     tokens so the display themes restyle it. */
  .tutorial {
    position: sticky;
    top: 4px;
    z-index: 4;
    background: color-mix(in srgb, var(--accent) 16%, var(--bg-panel));
    border: 2px solid var(--accent);
    border-radius: 8px;
    padding: 10px 14px 12px;
    box-shadow: 0 4px 16px rgb(0 0 0 / 45%);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .count {
    flex: none;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--accent);
    color: var(--bg);
    font-weight: 700;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .title {
    margin: 0;
    color: var(--accent);
  }

  .body {
    margin: 6px 0 0;
    font-size: 16px;
    line-height: 1.4;
  }

  .offer {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .choice {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .go {
    border-color: var(--accent);
  }

  .danger {
    border-color: var(--danger);
  }

  .tip-line {
    margin: 2px 0;
  }

  .tip-base {
    font-weight: 600;
  }

  .tip-sub {
    color: var(--text-dim);
    margin-top: 4px;
  }
</style>
