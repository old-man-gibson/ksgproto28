<script lang="ts">
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';
  import { gs, view } from '../state.svelte';
  import { MONSTERS, RARITIES, STATUSES } from '../../core/registry';
  import { MONSTER_ACTION_BAR, eligibleEncounters, fightsKey, spotCleared } from '../../core/systems/combat';
  import { monsterMind, monsterStats } from '../../core/systems/monsterStats';
  import { huntRest, restTarget, restingForFight } from '../../core/systems/huntrest';
  import { hpFraction } from '../../core/systems/health';
  import { visibleStatuses } from '../../core/systems/statuses';
  import { effectiveStyleDef } from '../../core/systems/styles';
  import type { MonsterInstance, SpotDef } from '../../core/types';
  import SceneBackdrop from './SceneBackdrop.svelte';
  import RaidTrack from './RaidTrack.svelte';
  import Tip from './Tip.svelte';
  import { enemyArt } from './enemyArt';
  import { sceneFor } from './scenes';
  import { fmt, ticksToTime } from './format';

  /**
   * The fight, drawn: the place behind it, you on the left, the formation on
   * the right in its slots, and the fight's events as motion — a lunge when a
   * bar fires, a flash and a number when a blow lands, a fade when something
   * dies. Everything here is read off the state between ticks (hp and bar
   * deltas), so the core stays ignorant of it and no animation can ever
   * disagree with the numbers.
   */
  let { spot, foeTip }: { spot: SpotDef; foeTip: Snippet<[MonsterInstance, number]> } = $props();

  const scene = $derived(sceneFor(spot));
  const stats = $derived(view.stats);
  const style = $derived(effectiveStyleDef(gs));
  const cleared = $derived(spotCleared(gs, spot));
  const canHunt = $derived(spot.activities.some((a) => a.kind === 'hunt'));
  const nobodyLeft = $derived(!cleared && canHunt && eligibleEncounters(gs, spot).length === 0);
  const hunting = $derived(spot.activities.find((a) => a.id === gs.activity)?.kind === 'hunt');

  /** Where each formation slot stands on the stage: % from left, % from the floor, size. */
  const WIDE_SLOTS = [
    { x: 60, y: 11, s: 1 },
    { x: 73, y: 31, s: 0.8 },
    { x: 88, y: 27, s: 0.8 },
    { x: 78, y: 6, s: 0.86 },
    { x: 90, y: 9, s: 0.84 },
  ];
  // A phone-width stage: the front foe moves left and the back rank climbs,
  // so no plate sits on another's.
  const NARROW_SLOTS = [
    { x: 51, y: 9, s: 1 },
    { x: 73, y: 38, s: 0.8 },
    { x: 90, y: 31, s: 0.8 },
    { x: 75, y: 3, s: 0.86 },
    { x: 91, y: 6, s: 0.84 },
  ];
  let stageWidth = $state(800);
  const SLOTS = $derived(stageWidth <= 560 ? NARROW_SLOTS : WIDE_SLOTS);
  const PLAYER = $derived(stageWidth <= 560 ? { x: 16, y: 9 } : { x: 20, y: 11 });

  // ---------- identity & motion ----------

  const ids = new WeakMap<object, number>();
  let nextId = 1;
  const idOf = (m: object): number => {
    let id = ids.get(m);
    if (id === undefined) {
      id = nextId++;
      ids.set(m, id);
    }
    return id;
  };

  interface Floater {
    id: number;
    x: number;
    y: number;
    text: string;
    kind: 'dmg' | 'crit' | 'heal' | 'hurt' | 'note';
  }
  interface Ghost {
    id: number;
    slot: number;
    icon: string;
    art: string | null;
    name: string;
  }
  interface Seen {
    hp: number;
    bar: number;
    slot: number;
    icon: string;
    art: string | null;
    name: string;
  }

  let floaters = $state<Floater[]>([]);
  let ghosts = $state<Ghost[]>([]);
  /** Short-lived pose per actor id (0 = the player): 'hit' | 'lunge' | 'spawn'. */
  let pose = $state<Record<number, string>>({});
  let banner = $state<string | null>(null);

  let floaterSeq = 1;
  const seen = new Map<number, Seen>();
  let last: { hp: number; bar: number; dodges: number; fights: number; fight: typeof gs.combat } = {
    hp: -1,
    bar: 0,
    dodges: 0,
    fights: -1,
    fight: null,
  };

  function float(x: number, y: number, text: string, kind: Floater['kind']) {
    const f = { id: floaterSeq++, x: x + (Math.random() * 6 - 3), y, text, kind };
    floaters = [...floaters.slice(-14), f];
    setTimeout(() => (floaters = floaters.filter((o) => o.id !== f.id)), 1100);
  }
  function strike(id: number, what: string, ms: number) {
    pose = { ...pose, [id]: what };
    setTimeout(() => {
      if (pose[id] === what) {
        const { [id]: _, ...rest } = pose;
        pose = rest;
      }
    }, ms);
  }
  function bury(g: Ghost) {
    ghosts = [...ghosts, g];
    setTimeout(() => (ghosts = ghosts.filter((o) => o.id !== g.id)), 800);
  }

  // Once per tick: compare what stands now with what stood last tick.
  $effect(() => {
    void gs.totalTicks;
    untrack(observe);
  });

  function observe() {
    const c = gs.combat;
    const present = new Set<number>();
    if (c) {
      c.enemies.forEach((m, slot) => {
        if (!m) return;
        const id = idOf(m);
        present.add(id);
        const before = seen.get(id);
        const at = SLOTS[slot];
        if (!before) {
          if (last.fight || seen.size > 0 || last.hp >= 0) strike(id, 'spawn', 420);
        } else {
          const lost = before.hp - m.hp;
          if (lost > 0.5) {
            const crit = lost > stats.damage * 1.6;
            float(at.x, at.y + 30 * at.s, `${crit ? '' : '−'}${fmt(lost)}${crit ? '!' : ''}`, crit ? 'crit' : 'dmg');
            strike(id, 'hit', 260);
          } else if (lost < -0.5) {
            float(at.x, at.y + 30 * at.s, `+${fmt(-lost)}`, 'heal');
          }
          if (before.bar - m.bar > MONSTER_ACTION_BAR * 0.5) strike(id, 'lunge', 320);
        }
        seen.set(id, {
          hp: m.hp,
          bar: m.bar,
          slot,
          icon: m.icon,
          art: MONSTERS[m.defId] ? enemyArt(MONSTERS[m.defId]) : null,
          name: m.name,
        });
      });
    }
    // Whoever was here and is not now went down — unless the fight ended
    // some other way (fled, knocked out), in which case they simply leave.
    const died = !!c || gs.lastFight?.outcome === 'won';
    for (const [id, s] of seen) {
      if (present.has(id)) continue;
      if (died) {
        const at = SLOTS[s.slot];
        if (s.hp > 0.5) float(at.x, at.y + 30 * at.s, `−${fmt(s.hp)}`, 'dmg');
        bury({ id, slot: s.slot, icon: s.icon, art: s.art, name: s.name });
      }
      seen.delete(id);
    }

    // You. Read off the fight that stood LAST tick, not the one standing now:
    // the blow that ends a fight nulls `gs.combat` in the same tick it lands,
    // and the old object still holds the bar that swing emptied.
    const hp = gs.resources.hp ?? 0;
    const dodges = gs.stats['combat:dodges'] ?? 0;
    if (last.fight) {
      if (last.hp - hp > 0.5) {
        float(PLAYER.x, PLAYER.y + 34, `−${fmt(last.hp - hp)}`, 'hurt');
        strike(0, 'hit', 260);
      }
      if (last.bar - last.fight.playerBar > stats.actionBar * 0.5) strike(0, 'lunge', 320);
      if (dodges > last.dodges) float(PLAYER.x, PLAYER.y + 40, 'dodge', 'note');
    }

    // A nest's budget spent: say so, large, once.
    const fights = spot.fightLimit ? (gs.stats[fightsKey(spot.id)] ?? 0) : -1;
    if (spot.fightLimit && last.fights >= 0 && last.fights < spot.fightLimit && fights >= spot.fightLimit) {
      banner = `${spot.name} cleared`;
      setTimeout(() => (banner = null), 4200);
    }

    last = { hp, bar: c?.playerBar ?? 0, dodges, fights, fight: c };
  }

  // A new place is a new stage: nothing carries across a road.
  $effect(() => {
    void spot.id;
    untrack(() => {
      seen.clear();
      ghosts = [];
      floaters = [];
      banner = null;
      last = { ...last, fights: -1, fight: null };
    });
  });

  const hpPct = (m: MonsterInstance) => Math.max(0, Math.min(100, (m.hp / monsterStats(m).maxHp) * 100));
  const barPct = (m: MonsterInstance) => Math.min(100, (m.bar / MONSTER_ACTION_BAR) * 100);
  const mindPct = (m: MonsterInstance) =>
    Math.max(0, Math.min(100, ((m.mana ?? 0) / Math.max(1, monsterMind(m).max)) * 100));
  /**
   * What stands on the stage when there is no portrait. A goblin warband's
   * icons name its JOBS (🔱 🏹 🪬) — right for a log line, wrong for a body —
   * so a goblin draws as a goblin and wears its job as a badge.
   */
  const glyph = (m: MonsterInstance): { body: string; badge: string | null } => {
    const tags = MONSTERS[m.defId]?.tags ?? [];
    if (tags.includes('goblin') && m.icon !== '👺' && m.icon !== '👹') {
      return { body: tags.includes('large') ? '👹' : '👺', badge: m.icon };
    }
    if (tags.includes('undead') && tags.includes('humanoid') && m.icon !== '💀') {
      return { body: '💀', badge: m.range === 'ranged' ? '🏹' : m.icon };
    }
    return { body: m.icon, badge: null };
  };
  const sizeOf = (m: MonsterInstance): number => {
    const tags = MONSTERS[m.defId]?.tags ?? [];
    if (tags.includes('huge') || tags.includes('gargantuan')) return 1.3;
    if (tags.includes('large')) return 1.15;
    if (tags.includes('small') || tags.includes('tiny')) return 0.85;
    return 1;
  };
  const playerHp = $derived(Math.max(0, Math.min(100, ((gs.resources.hp ?? 0) / stats.maxHp) * 100)));
  const playerBar = $derived(gs.combat ? Math.min(100, (gs.combat.playerBar / stats.actionBar) * 100) : 0);
</script>

<div class="stage scene-{scene}" class:fighting={!!gs.combat} bind:clientWidth={stageWidth}>
  <SceneBackdrop {scene} />

  <div class="hud-top">
    <span class="where">{spot.icon} {spot.name}</span>
    <!-- The feed announces a forced fight once; this stays up for its whole
         length, because "why is every travel button dead" deserves a
         standing answer rather than a scrolled-away line. -->
    {#if gs.combat?.forced}<span class="forced-chip">⚔️ No retreat</span>{/if}
    <span class="grow"></span>
    {#if spot.fightLimit}<RaidTrack {spot} />{/if}
  </div>

  <!-- You -->
  <div
    class="actor player"
    class:hit={pose[0] === 'hit'}
    class:lunge={pose[0] === 'lunge'}
    style="left:{PLAYER.x}%; bottom:{PLAYER.y}%; z-index:50"
  >
    <div class="hud">
      <div class="name">You <span class="stance" title={style.name}>{style.icon}</span></div>
      <div class="meter hp"><div style="width:{playerHp}%"></div></div>
      <div class="meter act"><div style="width:{playerBar}%"></div></div>
    </div>
    <div class="body">
      <svg class="hero" viewBox="0 0 64 92" aria-label="You">
        <path d="M20,32 L44,32 L52,84 L12,84 Z" fill="#7a2230" />
        <rect x="23" y="62" width="7" height="24" rx="2" fill="#39414f" />
        <rect x="34" y="62" width="7" height="24" rx="2" fill="#39414f" />
        <rect x="20" y="31" width="24" height="34" rx="5" fill="#8d98ab" />
        <rect x="20" y="52" width="24" height="4" fill="#5b4a33" />
        <circle cx="32" cy="22" r="10" fill="#b3bdcc" />
        <rect x="24" y="21" width="16" height="3" rx="1.5" fill="#1d222b" />
        <path d="M32,12 Q40,2 46,8 Q38,8 34,14 Z" fill="var(--accent)" />
        <path d="M8,44 Q8,38 16,36 Q24,38 24,44 Q24,58 16,64 Q8,58 8,44 Z" fill="#4c5d7e" stroke="var(--accent)" stroke-width="1.6" />
        <g class="blade">
          <path d="M44,50 L60,8" stroke="#e6edf6" stroke-width="3.2" stroke-linecap="round" />
          <path d="M40,46 L50,52" stroke="#b08a3e" stroke-width="3" stroke-linecap="round" />
          <path d="M44,50 L41,57" stroke="#5b4a33" stroke-width="3" stroke-linecap="round" />
        </g>
      </svg>
      <div class="shadow"></div>
    </div>
  </div>

  <!-- The formation -->
  {#if gs.combat}
    {#each gs.combat.enemies as m, slot (m ? idOf(m) : `empty-${slot}`)}
      {#if m}
        {@const at = SLOTS[slot]}
        {@const id = idOf(m)}
        {@const art = MONSTERS[m.defId] ? enemyArt(MONSTERS[m.defId]) : null}
        {@const rarity = RARITIES[m.rarity]}
        <div
          class="actor enemy"
          class:front={slot === 0}
          class:hit={pose[id] === 'hit'}
          class:lunge={pose[id] === 'lunge'}
          class:spawn={pose[id] === 'spawn'}
          style="left:{at.x}%; bottom:{at.y}%; --s:{at.s * sizeOf(m)}; z-index:{60 - Math.round(at.y)}; --rar:{rarity.color}"
        >
          <Tip block>
            <div class="hud">
              <div class="name" style="color:{m.rarity === 'common' ? 'var(--text)' : rarity.color}">
                {m.name} <span class="lv">Lv {m.level}</span>
              </div>
              <div class="meter hp"><div style="width:{hpPct(m)}%"></div></div>
              {#if m.mana !== undefined}
                <!-- A burned mind: what manaburn has left of it. Below zero it cannot cast. -->
                <div class="meter mind" class:debt={m.mana < 0}><div style="width:{mindPct(m)}%"></div></div>
              {/if}
              <div class="meter act"><div style="width:{barPct(m)}%"></div></div>
              <div class="chips">
                {#if m.range === 'ranged'}<span title="Ranged">🏹</span>{/if}
                {#each visibleStatuses(m) as held (held.id)}<span title={STATUSES[held.id].name}>{STATUSES[held.id].icon}</span>{/each}
              </div>
            </div>
            <div class="body">
              {#if m.modifier === 'boss' || m.modifier === 'demiboss' || MONSTERS[m.defId]?.tags.includes('unique')}
                <div class="aura"></div>
              {/if}
              {#if art}
                <img class="sprite art" src={art} alt={m.name} />
              {:else}
                {@const g = glyph(m)}
                <div class="sprite emoji">{g.body}{#if g.badge}<span class="badge">{g.badge}</span>{/if}</div>
              {/if}
              {#if m.rarity !== 'common'}<div class="ring"></div>{/if}
              <div class="shadow"></div>
            </div>
            {#snippet tip()}{@render foeTip(m, slot)}{/snippet}
          </Tip>
        </div>
      {/if}
    {/each}
  {/if}

  {#each ghosts as g (g.id)}
    {@const at = SLOTS[g.slot]}
    <div class="actor enemy dying" style="left:{at.x}%; bottom:{at.y}%; --s:{at.s}">
      <div class="body">
        {#if g.art}<img class="sprite art" src={g.art} alt={g.name} />{:else}<div class="sprite emoji">{g.icon}</div>{/if}
      </div>
    </div>
  {/each}

  {#each floaters as f (f.id)}
    <div class="floater {f.kind}" style="left:{f.x}%; bottom:{f.y}%">{f.text}</div>
  {/each}

  {#if !gs.combat}
    <div class="idle">
      {#if gs.recovering}
        💫 Recovering from a knockout. Hunting resumes when you are steady.
      {:else if hunting && restingForFight(gs)}
        🛌 Resting before the next fight: HP {Math.floor(hpFraction(gs, stats) * 100)}% of
        {Math.round(restTarget(huntRest(gs)) * 100)}%.
      {:else if cleared}
        🏞️ {spot.name} is cleared. Nothing here fights any more.
      {:else if nobodyLeft}
        🍃 Nothing stirs at {spot.name}.
      {:else if hunting}
        🔍 Searching for the next fight{gs.respawnTimer > 0 ? ` — ${ticksToTime(gs.respawnTimer)}` : '…'}
      {:else if canHunt}
        Choose a hunt in the Location tab to fight here.
      {:else}
        Nothing to fight at {spot.name}.
      {/if}
    </div>
  {/if}

  {#if banner}
    <div class="banner">🏆 {banner}</div>
  {/if}
</div>

<style>
  .stage {
    container-type: inline-size;
    position: relative;
    height: 290px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: #0b0e12;
    user-select: none;
  }

  .hud-top {
    position: absolute;
    top: 8px;
    left: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 75;
  }
  .grow {
    flex: 1;
  }
  .where {
    font-size: 12px;
    padding: 3px 9px;
    border-radius: 999px;
    background: color-mix(in srgb, #000 50%, transparent);
    color: var(--text);
  }
  .forced-chip {
    font-size: 12px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
    animation: pulse 1.4s ease-in-out infinite;
    background: color-mix(in srgb, var(--danger) 22%, #000);
    color: var(--danger);
    border: 1px solid var(--danger);
  }
  @keyframes pulse {
    50% { filter: brightness(1.35); }
  }

  /* ---------- actors ---------- */
  .actor {
    position: absolute;
    transform: translateX(-50%) scale(var(--s, 1));
    transform-origin: bottom center;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 20;
  }
  .hud {
    width: 132px;
    margin-bottom: 4px;
    text-align: center;
    filter: drop-shadow(0 1px 2px #000);
  }
  .name {
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px #000, 0 0 6px #000;
  }
  .lv {
    opacity: 0.75;
    font-weight: 400;
  }
  .meter {
    height: 6px;
    margin-top: 2px;
    border-radius: 3px;
    background: color-mix(in srgb, #000 65%, transparent);
    overflow: hidden;
    border: 1px solid color-mix(in srgb, #000 70%, transparent);
  }
  .meter > div {
    height: 100%;
    transition: width 0.18s ease-out;
  }
  .meter.hp > div {
    background: linear-gradient(#ff7a6b, var(--hp));
  }
  .meter.act {
    height: 3px;
  }
  .meter.act > div {
    background: var(--action);
    transition: none; /* fills every tick; easing would lag behind the reset */
  }
  .meter.mind {
    height: 3px;
  }
  .meter.mind > div {
    background: var(--manaburn);
  }
  .meter.mind.debt {
    border-color: var(--manaburn);
  }
  .chips {
    display: flex;
    justify-content: center;
    gap: 3px;
    font-size: 11px;
    min-height: 14px;
    margin-top: 1px;
  }
  .stance {
    font-size: 11px;
  }

  .body {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .sprite {
    position: relative;
    z-index: 2;
    animation: idle 2.6s ease-in-out infinite;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.6));
  }
  .emoji {
    font-size: 58px;
    line-height: 1;
  }
  .badge {
    position: absolute;
    right: -10px;
    bottom: -2px;
    font-size: 24px;
    filter: drop-shadow(0 2px 2px #000);
  }
  .art {
    height: 92px;
    width: auto;
    image-rendering: auto;
  }
  .hero {
    width: 64px;
    height: 92px;
    position: relative;
    z-index: 2;
    animation: idle 2.8s ease-in-out infinite;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.6));
  }
  .shadow {
    width: 70px;
    height: 12px;
    margin-top: -8px;
    border-radius: 50%;
    background: radial-gradient(rgba(0, 0, 0, 0.6), transparent 70%);
  }
  .ring {
    position: absolute;
    bottom: -4px;
    width: 76px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid var(--rar);
    box-shadow: 0 0 10px var(--rar);
    opacity: 0.85;
  }
  .aura {
    position: absolute;
    bottom: 0;
    width: 110px;
    height: 110px;
    border-radius: 50%;
    background: radial-gradient(color-mix(in srgb, #ffd36b 45%, transparent), transparent 65%);
    animation: aura 2s ease-in-out infinite;
  }
  @keyframes aura {
    50% { transform: scale(1.12); opacity: 0.7; }
  }
  @keyframes idle {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  /* A front-slot foe reads as the one you are fighting. */
  .enemy:not(.front) .hud {
    opacity: 0.85;
  }
  .enemy:not(.front) .sprite {
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.6)) brightness(0.82);
  }

  /* ---------- events ---------- */
  .enemy.lunge .sprite {
    animation: lunge-left 0.32s ease-out;
  }
  .player.lunge .hero {
    animation: lunge-right 0.32s ease-out;
  }
  @keyframes lunge-left {
    35% { transform: translateX(-30px) scale(1.06); }
  }
  @keyframes lunge-right {
    35% { transform: translateX(30px) rotate(6deg); }
  }
  .actor.hit .sprite,
  .actor.hit .hero {
    animation: hit 0.26s linear;
  }
  @keyframes hit {
    0% { filter: brightness(2.6) drop-shadow(0 0 8px #fff); transform: translateX(0); }
    25% { transform: translateX(5px); }
    50% { transform: translateX(-4px); filter: brightness(1.5) sepia(1) hue-rotate(-40deg) saturate(4); }
    100% { transform: translateX(0); }
  }
  .enemy.spawn {
    animation: appear 0.42s ease-out;
  }
  @keyframes appear {
    from { opacity: 0; transform: translateX(-50%) translateY(10px) scale(calc(var(--s, 1) * 0.7)); }
  }
  .enemy.dying {
    pointer-events: none;
    animation: die 0.8s ease-in forwards;
  }
  @keyframes die {
    0% { opacity: 1; filter: brightness(2.4); }
    30% { filter: brightness(1) grayscale(0.6); }
    100% {
      opacity: 0;
      filter: grayscale(1) blur(2px);
      transform: translateX(-50%) translateY(16px) rotate(-8deg) scale(calc(var(--s, 1) * 0.85));
    }
  }

  .floater {
    position: absolute;
    z-index: 80;
    transform: translateX(-50%);
    font-weight: 800;
    font-size: 17px;
    pointer-events: none;
    text-shadow: 0 2px 0 #000, 0 0 6px #000;
    animation: rise 1.1s ease-out forwards;
    white-space: nowrap;
  }
  .floater.dmg {
    color: #fff4d6;
  }
  .floater.crit {
    color: #ffd36b;
    font-size: 24px;
  }
  .floater.hurt {
    color: #ff6b6b;
  }
  .floater.heal {
    color: #6fe39a;
  }
  .floater.note {
    color: #9fd4ff;
    font-size: 13px;
    font-style: italic;
  }
  @keyframes rise {
    0% { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.7); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.15); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-46px) scale(1); }
  }

  .idle {
    position: absolute;
    left: 50%;
    bottom: 42%;
    transform: translateX(-20%);
    max-width: 55%;
    z-index: 70;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 13px;
    background: color-mix(in srgb, #000 55%, transparent);
    color: var(--text);
    text-align: center;
  }

  .banner {
    position: absolute;
    left: 50%;
    top: 34%;
    transform: translate(-50%, -50%);
    z-index: 90;
    padding: 10px 26px;
    border-radius: 10px;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: #fff4d6;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, #000 75%, transparent) 15%, color-mix(in srgb, #000 75%, transparent) 85%, transparent);
    border-top: 1px solid #ffd36b;
    border-bottom: 1px solid #ffd36b;
    text-shadow: 0 0 12px #ffb347;
    animation: banner 4.2s ease-out forwards;
    white-space: nowrap;
  }
  @keyframes banner {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(1.4); }
    10% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    85% { opacity: 1; }
    100% { opacity: 0; }
  }

  /*
   * A phone-width stage: shorter, smaller bodies and plates, and the back
   * rank shows bars without names — five name plates cannot share 360px.
   * The front foe and you keep yours.
   */
  @container (max-width: 560px) {
    .hud {
      width: 96px;
    }
    .name {
      font-size: 10.5px;
    }
    .enemy:not(.front) .name,
    .enemy:not(.front) .chips span {
      display: none;
    }
    .enemy:not(.front) .hud {
      width: 64px;
    }
    .emoji {
      font-size: 42px;
    }
    .badge {
      font-size: 18px;
      right: -8px;
    }
    .art {
      height: 70px;
    }
    .hero {
      width: 48px;
      height: 70px;
    }
    .shadow {
      width: 52px;
    }
    .ring {
      width: 56px;
    }
    .floater {
      font-size: 14px;
    }
    .floater.crit {
      font-size: 19px;
    }
    .banner {
      font-size: 16px;
      padding: 8px 16px;
    }
    .idle {
      left: 34%;
      max-width: 62%;
      font-size: 12px;
      transform: none;
    }
    .where {
      display: none;
    }
  }

  @media (max-width: 700px) {
    .stage {
      height: 250px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stage * {
      animation-duration: 0.01ms !important;
    }
  }
</style>
