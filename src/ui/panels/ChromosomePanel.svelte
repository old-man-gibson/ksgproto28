<script lang="ts">
  import { gs, game } from '../state.svelte';
  import { QUALITY_TIERS, STATUSES } from '../../core/registry';
  import { gradesHeld } from '../../core/systems/disciplines';
  import { attrName } from '../../core/systems/attributes';
  import Tip from '../lib/Tip.svelte';
  import {
    describeGrant,
    describeMod,
    fmt,
    geneAbilityLines,
    geneArmNotes,
    modCondition,
    modEffective,
    mutagenLines,
    ticksToTime,
  } from '../lib/format';
  import type { MainGeneDef, Modifier, MutagenArm, MutagenDef, QualityTier } from '../../core/types';
  import { DAMAGE_TYPE_NAMES, STAT_NAMES } from '../../core/types';
  import { MAIN_GENES, MUTATIONS } from '../../core/data/mutagens.data';
  import type { RoutedContribution } from '../../core/systems/mutagens';
  import {
    abilityCarries,
    armDelivery,
    capacityLimit,
    capacityUsed,
    chromosomeOf,
    coefficientOf,
    contributionWeight,
    currentResolution,
    cutEdge,
    deliveredBy,
    edgeKey,
    establish,
    expressedMain,
    geneAbility,
    histoneCost,
    geneAbilityBase,
    isClamped,
    layoutOf,
    liveGrants,
    mutagenApproach,
    bearerGrants,
    placeMutagen,
    positionOf,
    pricesABlow,
    reaching,
    removeMutagen,
    restoreEdge,
    settlingLeft,
    showsGrade,
    slotMain,
    swapBiomatterCost,
    unslotMain,
  } from '../../core/systems/mutagens';

  /**
   * The chromosome.
   *
   * Everything here exists to make the graph READABLE, because that is a
   * mechanic rather than polish: the design goal is that players learn the
   * system well enough to game it, and nobody games what they cannot see
   * (docs/MUTAGENS.md §11). So the panel never reports a bare total — it draws
   * the resolved route of every effect, names what each hop did to it, and
   * highlights that path on the diagram when you point at it.
   */

  const CENTRE = '@';

  const chromo = $derived(chromosomeOf(gs));
  const layout = $derived(layoutOf(chromo));
  const res = $derived(currentResolution(gs));
  const used = $derived(capacityUsed(chromo));
  const limit = $derived(capacityLimit(gs));

  /** What is open for picking: a socket, the centromere, or nothing. */
  let picking = $state<string | null>(null);
  /** The route currently under the cursor, drawn lit on the diagram. */
  let lit = $state<RoutedContribution | null>(null);

  /**
   * ⚠️ These four glyphs are drawn on the diagram as the centromere's doors, so
   * NONE of them may be an icon a mutagen also wears. Active was 🔥, which is
   * Ember's icon — and an ember placed anywhere near the middle put two
   * identical flames a few pixels apart, one a socket and one a door. Check
   * MUTATIONS before changing any of these.
   */
  const ARMS: { id: MutagenArm; name: string; icon: string }[] = [
    { id: 'special', name: 'Special', icon: '✨' },
    { id: 'active', name: 'Active', icon: '⚡' },
    { id: 'attacks', name: 'Attacks', icon: '⚔️' },
    { id: 'defenses', name: 'Defenses', icon: '🛡️' },
  ];

  // NOT `state` — Svelte reads a bare `state` identifier as a store.
  const edgeState = (a: string, b: string) => {
    const key = edgeKey(a, b);
    if (chromo.cut.includes(key)) return 'cut';
    return chromo.established.includes(key) ? 'live' : 'open';
  };

  const at = (node: string) => positionOf(layout, node) ?? { x: 50, y: 50 };

  /**
   * Where a filled socket's letter badge sits: pushed straight OUT along the
   * line from the centromere.
   *
   * Anywhere fixed collides with something. The corner it started in walked
   * straight into the arm-door glyphs, which by construction sit on the inner
   * side of exactly the sockets nearest the middle. Outward is the one
   * direction nothing else ever occupies, and the viewBox is padded so the
   * outermost sockets have room for it.
   */
  const badgeAt = (s: { x: number; y: number }) => {
    const dx = s.x - layout.centre.x;
    const dy = s.y - layout.centre.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: s.x + (dx / len) * 5.8, y: s.y + (dy / len) * 5.8 };
  };

  /**
   * Where each of the centromere's four doors is, and which arm it opens onto.
   *
   * An effect lands in the arm carried by the EDGE it arrived on, which is the
   * central rule of routing and was invisible: the diagram drew four identical
   * lines into the middle. Placed just outside the circle along each edge, so
   * the glyph reads as belonging to that line rather than to the centromere.
   */
  const armDoors = $derived(
    layout.edges
      .filter((e) => e.arm && (e.a === CENTRE || e.b === CENTRE))
      .map((e) => {
        const outer = at(e.a === CENTRE ? e.b : e.a);
        const c = layout.centre;
        const dx = outer.x - c.x;
        const dy = outer.y - c.y;
        const len = Math.hypot(dx, dy) || 1;
        // Far enough out that the r=3.2 disc clears the r=8 centromere's rim
        // (8 + 3.2 = 11.2) with a hair to spare, and still short of the
        // nearest socket's r=5.4 circle.
        const OUT = 12.2;
        return {
          key: edgeKey(e.a, e.b),
          icon: ARMS.find((a) => a.id === e.arm)?.icon ?? '•',
          state: edgeState(e.a, e.b),
          x: c.x + (dx / len) * OUT,
          y: c.y + (dy / len) * OUT,
        };
      }),
  );

  /**
   * Everything the player holds, ONE ROW PER KIND with its grades as chips.
   *
   * Flattening to a row per (kind × grade) is how this started, and it means
   * nine mutations become sixty-three rows the moment a player owns a full set
   * — the list stops being readable exactly when it starts being useful.
   * Grades belong beside their kind because they are a choice WITHIN it.
   */
  function held(kind: 'gene' | 'mutagen') {
    const defs = kind === 'gene' ? MAIN_GENES : MUTATIONS;
    return Object.values(defs)
      .map((def) => ({ def, grades: gradesHeld(gs, def.id) }))
      .filter((row) => row.grades.length > 0);
  }

  /** The edges one route crossed, so the diagram can light exactly that path. */
  function routeEdges(c: RoutedContribution): string[] {
    const path = [c.from, ...c.through, CENTRE];
    return path.slice(0, -1).map((n, i) => edgeKey(n, path[i + 1]));
  }
  const routeLit = $derived(lit ? new Set(routeEdges(lit)) : new Set<string>());
  /** …and the sockets on it, so the lit path reads as a path and not as stripes. */
  const routeNodes = $derived(lit ? new Set([lit.from, ...lit.through]) : new Set<string>());

  /** Connections not yet paid for, with what each would cost to coil. */
  const unpaid = $derived(
    layout.edges
      .filter((e) => edgeState(e.a, e.b) === 'open')
      .map((e) => ({ edge: e, key: edgeKey(e.a, e.b), cost: histoneCost(e) }))
      .sort((x, y) => x.cost - y.cost),
  );

  /**
   * What a pickable thing does, whichever kind it is. A main gene carries its
   * own prose (`desc` is authoritative — several promise mechanisms that are
   * not built, and the words are the spec); a mutagen carries none, so its
   * lines come off its effect and transform.
   */
  function pickerLines(def: MainGeneDef | MutagenDef): string[] {
    if ('genus' in def) return def.desc ? [def.desc] : [];
    return mutagenLines(def);
  }

  function choose(id: string, quality: QualityTier) {
    if (picking === CENTRE) slotMain(gs, game.bus, { id, quality });
    else if (picking) placeMutagen(gs, game.bus, picking, { id, quality });
    picking = null;
  }

  function clear(socket: string) {
    if (socket === CENTRE) unslotMain(gs);
    else removeMutagen(gs, socket);
    picking = null;
  }

  /** Cycle a connection: unpaid → established → cut → live again. */
  function toggleEdge(a: string, b: string) {
    const s = edgeState(a, b);
    if (s === 'open') establish(gs, game.bus, a, b);
    else if (s === 'live') cutEdge(gs, game.bus, a, b);
    else restoreEdge(gs, a, b);
  }

  /** Ticks until the centromere can be touched again. */
  const settling = $derived(settlingLeft(gs));

  /** What the centromere expresses — bare when nothing is slotted, never nothing. */
  const expressed = $derived(expressedMain(chromo));
  const mainDef = $derived(MAIN_GENES[expressed.id]);
  const wearingBare = $derived(!chromo.main);
  const ability = $derived(geneAbility(gs));
  /**
   * The stat the ability is priced off, when it has one. Named here rather than
   * narrowed in the template: it is the answer to "why did routing into Active
   * not make my bite hurt more", and that answer deserves a name.
   */
  /**
   * Which stat governs the ability, and HOW — the two are different claims and
   * naming the wrong one sends a player stacking a stat the blow never reads.
   * A resistance is *amplified by*, never *priced off*: it is bounded, so past
   * the cap it stops paying and only the speed term keeps the blow growing.
   */
  const abilityScaling = $derived.by(() => {
    const spec = ability?.spec;
    if (spec?.type !== 'gene') return null;
    if (spec.amplifiedBy) return { verb: 'Amplified by', stat: STAT_NAMES[spec.amplifiedBy] };
    if (spec.fromStat) return { verb: 'Priced off', stat: STAT_NAMES[spec.fromStat] };
    // An attribute, not a derived stat — and it must be named through
    // `attrName`, because STAT_NAMES has no attribute ids in it and would have
    // advised the player to raise their "undefined".
    if (spec.fromAttr) return { verb: 'Priced off', stat: attrName(spec.fromAttr) };
    return null;
  });

  /**
   * What the resolved ability can actually READ — the engine's own answer
   * (`abilityCarries`), so the panel's chips, notes and arriving-type lines all
   * go quiet on exactly the abilities the Active arm cannot reach.
   */
  const abilitySpec = $derived(ability?.spec.type === 'gene' ? ability.spec : null);

  /**
   * WHAT THE GRAPH DID TO THE ABILITY — the gene's own tool against the one you
   * are actually swinging.
   *
   * The Active arm reaches the ability now (docs/MUTAGENS.md §12.3), and the
   * whole reason to route anything there is a change you can name. Derived by
   * comparing the resolved spec to the written one rather than by re-deriving
   * the rules, so a new grant in `applyActiveArm` shows up here for free.
   */
  const abilityChanges = $derived.by(() => {
    const now = ability?.spec;
    const was = geneAbilityBase(gs)?.spec;
    if (!now || !was || now.type !== 'gene' || was.type !== 'gene') return [];
    const out: string[] = [];
    if (now.damageType !== was.damageType) {
      // Only the WRITTEN type may be quoted as a "before". Defaulting the other
      // side to bludgeoning invented one: an ability the gene never gave a type
      // was reported as having been bludgeoning and re-typed away from it.
      const to = DAMAGE_TYPE_NAMES[now.damageType ?? 'bludgeoning'].toLowerCase();
      out.push(
        was.damageType
          ? `re-typed to ${to} — it was ${DAMAGE_TYPE_NAMES[was.damageType].toLowerCase()}`
          : `now lands as ${to}`,
      );
    }
    if (now.sure && !was.sure) out.push('cannot be dodged');
    if (now.splashAll && !was.splashAll) out.push('carries into every flanker');
    const had = new Set((was.inflicts ?? []).map((a) => a.id));
    for (const app of now.inflicts ?? []) {
      if (!had.has(app.id)) out.push(`now leaves ${STATUSES[app.id]?.name ?? app.id}`);
    }
    return out;
  });
  /** The gene's own words, split back into the arms they were written for. */
  const notes = $derived(geneArmNotes(mainDef.desc));

  /**
   * WHAT A NUCLEASE REWROTE, said out loud.
   *
   * The gene's `desc` is authored prose about the species — a troll is
   * "dangerously soft to fire" — and a rekeyed body makes that sentence false
   * while leaving it on screen. Naming the rewrite is the only honest fix: the
   * prose is still what the SPECIES is, and this is what YOURS is.
   */
  const rekeyed = $derived.by(() => {
    const now = res.main;
    const written = MAIN_GENES[expressed.id];
    if (!now || now === written) return [];
    const out: string[] = [];
    for (const arm of ARMS) {
      const before = written.base?.[arm.id] ?? [];
      const after = now.base?.[arm.id] ?? [];
      for (let i = 0; i < before.length; i++) {
        if (after[i] && after[i].stat !== before[i].stat) {
          out.push(`${describeMod(before[i])} → ${describeMod(after[i])}`);
        }
      }
    }
    const wasDouse = written.confers?.[0]?.removal?.[0]?.damageTypes ?? [];
    const nowDouse = now.confers?.[0]?.removal?.[0]?.damageTypes ?? [];
    for (let i = 0; i < wasDouse.length; i++) {
      if (nowDouse[i] && nowDouse[i] !== wasDouse[i]) {
        out.push(
          `interrupted by ${DAMAGE_TYPE_NAMES[nowDouse[i]].toLowerCase()}` +
            ` instead of ${DAMAGE_TYPE_NAMES[wasDouse[i]].toLowerCase()}`,
        );
      }
    }
    return out;
  });

  /**
   * Capabilities in words, and whether the game actually reads them.
   * `onehand:greatsword` and `arms:+2` are the two things a gene can do that no
   * number expresses; the mutagen family (`splits_target` and friends) is
   * authored and consumed by nobody yet, and a chip that says "your blows carry
   * into a second enemy" when they do not is worse than no chip at all.
   */
  const capabilities = $derived(
    [...bearerGrants(gs)].map((g) => ({
      ...describeGrant(g),
      // `liveGrants` is the narrower set — what some system will actually ask
      // about, given the arm it landed in. A `splits_target` in Attacks is a
      // real thing you own and a trick you do not have, and the chip has to
      // say both.
      live: live.has(g),
    })),
  );
  const live = $derived(liveGrants(gs));

  /** A modifier with its conditions attached — "(while bone)", "vs Slime". */
  const modText = (m: Modifier) => `${describeMod(m)}${modCondition(m)}`;

  /**
   * The base line, minus the zeroes.
   *
   * Bare's six attributes are all deliberately 0 (they are the shape prestige
   * will raise, docs/MUTAGENS.md §8), and printing "base: +0 Charisma" on the
   * body every new player is wearing is the panel's very first sentence about
   * itself. An honest empty is better than a truthful nothing.
   */
  const liveBase = (mods: Modifier[] | undefined) => (mods ?? []).filter((m) => m.value !== 0);

  /**
   * WHAT THE ARM ACTUALLY GIVES YOU. The one thing the panel never said.
   *
   * It drew the routes and the weights and left the player to multiply nine
   * numbers in their head; §11 asks for a system players can game, and nobody
   * games arithmetic they have to do themselves. Read straight off the same
   * function the stat pipeline consumes (`armDelivery` → `deliveredBy`), so the
   * figure here IS the figure on the character sheet.
   */
  function delivery(arm: MutagenArm) {
    const d = armDelivery(res, arm);
    // An arriving damage type is READ in Active, where it re-types the ability,
    // and nowhere else yet (docs/MUTAGENS.md §12.1). Same fact as `grantIsLive`
    // and the same trap if it is stated flatly: the panel would call the very
    // thing that just turned a bite cold "read by nothing".
    // …and an ability that lands no typed blow of its own — a volley, whose
    // strikes read each grip's own edge — reads no arriving type either, so its
    // types belong in the "carried faithfully, read by nothing" list below.
    const typesRead = arm === 'active' && !!abilitySpec && abilityCarries(abilitySpec).type;
    return {
      mods: d.mods,
      // Split, because they mean opposite things to a player deciding where to
      // put a mutagen: one is a thing you now have, the other is a thing the
      // graph carried faithfully to an arm where no system is listening.
      liveGrants: d.grants.map((g) => describeGrant(g, arm, abilitySpec)).filter((g) => g.live),
      inertGrants: d.grants.map((g) => describeGrant(g, arm, abilitySpec)).filter((g) => !g.live),
      liveTypes: typesRead ? d.types : [],
      inertTypes: typesRead ? [] : d.types,
      silent: d.silent,
    };
  }

  /** What one route put in the arm, already scaled by its own weight. */
  const routeMods = (c: RoutedContribution) => deliveredBy(c, res.ceiling);
  const weightOf = (c: RoutedContribution) => contributionWeight(c, res.ceiling);
  /**
   * The whole path as one list, centromere included — built here rather than
   * assembled out of three template fragments, which is what left "b → a→ d →
   * ◉" with its arrows spaced two different ways down the same card.
   */
  const pathOf = (c: RoutedContribution) => [c.from, ...c.through, '◉'];
</script>

<div class="chromo">
  <!-- Two bands rather than two columns. The identity line and the capacity
       bar are both short and belong side by side; the description, the traits
       and the ability are all prose-shaped and want the panel's full width.
       Stacked in one column they made a tall ragged block with the capacity
       bar stranded beside it. -->
  <div class="head panel">
    <div class="ident">
      <span class="big" class:dim={wearingBare}>{mainDef.icon}</span>
      <span class="titles">
        <b>{mainDef.name}</b>
        {#if showsGrade(expressed)}
          <span class="grade" style="color: {QUALITY_TIERS[expressed.quality].color}">
            {QUALITY_TIERS[expressed.quality].name}
          </span>
        {/if}
        <div class="small dim">
          {#if wearingBare}
            Your own sequence, unwritten-over. Everything still routes here.
          {:else}
            Weapon coefficient ×{coefficientOf(expressed).toFixed(2)} · one route may be worth up to
            ×{res.ceiling.toFixed(1)} before this body stops carrying more
          {/if}
        </div>
      </span>
    </div>
    <div class="about">
        <!-- Only the UNLABELLED remainder. Everything a gene says about a
             specific arm now lives on that arm's card, where it is next to the
             routes and numbers it describes — and the "Active:" sentence is
             dropped entirely when an ability block follows, since the derived
             figures below say the same thing with real numbers in them. -->
        {#if notes.rest}
          <div class="small gene-desc">{notes.rest}</div>
        {/if}
        {#if rekeyed.length}
          <!-- The prose above is what the SPECIES is. This is what yours is. -->
          <div class="small changed">🧬 A nuclease rewrote you: {rekeyed.join(' · ')}</div>
        {/if}
        <!-- Guarded so bare — no size, no capabilities — leaves no empty rail. -->
        {#if mainDef.size || capabilities.length > 0}
        <div class="traits">
          {#if mainDef.size}
            <span class="trait" title="Size decides what counts as smaller than you">
              📏 {mainDef.size}
            </span>
          {/if}
          {#each capabilities as cap (cap.text)}
            <span class="trait" class:cap-trait={cap.live} class:inert-trait={!cap.live}>
              {cap.text}{cap.live ? '' : ' · nothing reads this yet'}
            </span>
          {/each}
        </div>
        {/if}
        {#if ability}
          <!-- The body's tool, stated the way the combat card states it — the
               same `geneAbilityLines`, so the two can never disagree — plus the
               two things only this panel can say: how often it comes round, and
               that routing into the Active arm does NOT reach it. That second
               one is the trap the arm's name sets (docs/MUTAGENS.md §12.3), and
               a player pouring mutations into Active to sharpen their bite is
               owed the answer before they spend the capacity, not after. -->
          <div class="ability">
            <div class="ability-head">
              <b>{ability.icon} {ability.name}</b>
              <span class="small dim">⟳ every {ticksToTime(ability.spec.cooldown)}</span>
            </div>
            {#each geneAbilityLines(gs) as line}
              <div class="small">{line}</div>
            {/each}
            <div class="small dim">
              Fires from your combat rotation like any other active — order it, condition it or
              switch it off in the Combat tab.
            </div>
            {#if abilityChanges.length}
              <!-- The Active arm is the only arm whose contents alter an
                   ability rather than a stat, so what it altered is the one
                   thing the card must not make you infer. -->
              <div class="small changed">
                🧬 Your graph rewrote it: {abilityChanges.join(' · ')}
              </div>
            {/if}
            {#if abilityScaling}
              <div class="small reach">
                {abilityScaling.verb} your <b>{abilityScaling.stat}</b>, so anything raising that
                stat sharpens it — from any arm. Route a <b>type</b> into <b>Active</b> to re-type
                it, or a <b>condition</b> to make it leave one; magnitudes routed there land as
                stats instead.
              </div>
            {/if}
          </div>
        {/if}
    </div>
    <div class="cap">
      <div class="cap-bar" class:over={used.total > limit}>
        <div class="cap-fill" style="width: {Math.min(100, (used.total / limit) * 100)}%"></div>
      </div>
      <div class="small" class:dim={used.total <= limit} class:over-text={used.total > limit}>
        {used.total.toFixed(1)} / {limit.toFixed(1)} capacity
        · gene {used.main.toFixed(1)} · mutagens {used.mutations.toFixed(1)} · cuts {used.cuts.toFixed(1)}
      </div>
      {#if used.total > limit}
        <!-- Editing refuses anything that would not fit, so this only shows for
             a chromosome that was already over when the budget moved — a lost
             skill level, or a retune. Saying so beats a bar that reads full. -->
        <div class="small over-text">
          Over budget by {(used.total - limit).toFixed(1)}. Take something out before you can change anything else.
        </div>
      {/if}
    </div>
  </div>

  <div class="body">
    <div class="panel diagram">
      <!-- Padded past the layout's 0–100 coordinates so the outermost sockets
           have room for their letter badges, which sit outside the rim. -->
      <svg viewBox="-5 -5 110 110" role="img" aria-label="Chromosome">
        {#each layout.edges as e (edgeKey(e.a, e.b))}
          {@const s = edgeState(e.a, e.b)}
          {@const p = at(e.a)}
          {@const q = at(e.b)}
          {@const key = edgeKey(e.a, e.b)}
          <line
            class="edge {s}"
            class:lit={routeLit.has(key)}
            x1={p.x} y1={p.y} x2={q.x} y2={q.y}
            stroke-width={1 + e.length / 6}
            role="button"
            tabindex="0"
            aria-label="connection {e.a} to {e.b}, {s}"
            onclick={() => toggleEdge(e.a, e.b)}
            onkeydown={(ev) => ev.key === 'Enter' && toggleEdge(e.a, e.b)}
          />
        {/each}

        <!-- WHICH ARM EACH DOOR IS. The centromere has four of them and the
             edge you arrive on decides where an effect lands — that is the
             whole routing puzzle, and until now the diagram said nothing about
             it, so you learned it by placing something and reading the result.
             The glyph sits just outside the centromere circle, on the edge. -->
        {#each armDoors as door (door.key)}
          <!-- On its own disc, because an emoji at this size against two
               crossing lines and the centromere's rim was a smudge. -->
          <circle class="door-disc" class:door-dim={door.state !== 'live'} cx={door.x} cy={door.y} r="3.2" />
          <text
            x={door.x} y={door.y}
            text-anchor="middle" dominant-baseline="central"
            font-size="4.6" class="door" class:door-dim={door.state !== 'live'}
          >{door.icon}</text>
        {/each}

        {#each layout.sockets as s (s.id)}
          {@const gene = chromo.placed[s.id]}
          {@const def = gene ? MUTATIONS[gene.id] : null}
          <g
            class="socket"
            class:filled={!!def}
            class:picking={picking === s.id}
            class:on-route={routeNodes.has(s.id)}
            role="button"
            tabindex="0"
            aria-label="socket {s.id}{def ? `, ${def.name}` : ', empty'}"
            onclick={() => (picking = picking === s.id ? null : s.id)}
            onkeydown={(ev) => ev.key === 'Enter' && (picking = picking === s.id ? null : s.id)}
          >
            <circle cx={s.x} cy={s.y} r="5.4" />
            {#if def}
              <text x={s.x} y={s.y + 2} text-anchor="middle" font-size="5.5">{def.icon}</text>
              <!-- THE SOCKET'S NAME, on a filled socket too. Every route in the
                   panel is written "b → a → d → ◉", and a filled socket used to
                   drop its letter for its icon — so the moment the graph was
                   worth reading, the words and the picture stopped sharing a
                   vocabulary and no route could be traced by eye. -->
              {@const badge = badgeAt(s)}
              <circle class="tag-disc" cx={badge.x} cy={badge.y} r="2.6" />
              <text
                x={badge.x} y={badge.y} text-anchor="middle" dominant-baseline="central"
                font-size="3.2" class="tag"
              >{s.id}</text>
            {:else}
              <text x={s.x} y={s.y + 1.8} text-anchor="middle" font-size="4" class="tag">{s.id}</text>
            {/if}
          </g>
        {/each}

        <g
          class="socket centre"
          class:filled={!wearingBare}
          class:picking={picking === CENTRE}
          role="button"
          tabindex="0"
          aria-label="centromere"
          onclick={() => (picking = picking === CENTRE ? null : CENTRE)}
          onkeydown={(ev) => ev.key === 'Enter' && (picking = picking === CENTRE ? null : CENTRE)}
        >
          <circle cx={layout.centre.x} cy={layout.centre.y} r="8" />
          <text x={layout.centre.x} y={layout.centre.y + 2.6} text-anchor="middle" font-size="7">
            {mainDef.icon}
          </text>
        </g>
      </svg>

      <div class="legend small dim">
        <div>
          Click a socket to fill it, the centromere for a gene, a connection to establish · cut ·
          restore. Thicker lines are longer — <b>distance buys magnitude, hops buy character</b>.
        </div>
        <div>
          The four glyphs around the centromere are its <b>doors</b>: an effect lands in whichever
          arm it arrives through, so {ARMS.map((a) => a.icon).join(' · ')} mark where each connection
          delivers.
        </div>
      </div>
      {#if unpaid.length}
        <div class="small">
          <span class="dim">🧵 {fmt(gs.materials.histone ?? 0)} histones ·</span>
          {#each unpaid as u (u.key)}
            <button
              class="unpaid"
              class:afford={(gs.materials.histone ?? 0) >= u.cost}
              onclick={() => establish(gs, game.bus, u.edge.a, u.edge.b)}
            >{u.edge.a}–{u.edge.b} {u.cost}</button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="side">
      {#if picking}
        <div class="panel picker">
          <div class="row-head">
            <b>{picking === CENTRE ? 'Main gene' : `Socket ${picking}`}</b>
            <!-- Emptying sits in the HEADER, not under the list: taking a
                 mutagen back out is the most repeated action in this panel and
                 it used to be a scroll past everything you own. -->
            {#if picking === CENTRE ? !!chromo.main : !!chromo.placed[picking]}
              <button
                class="small"
                disabled={picking === CENTRE && settling > 0}
                onclick={() => clear(picking!)}
              >
                {picking === CENTRE ? '↩ Own sequence' : '✕ Empty it'}
              </button>
            {/if}
            <button class="small" onclick={() => (picking = null)}>Close</button>
          </div>
          {#if picking === CENTRE}
            <div class="small dim">
              {#if settling > 0}
                Still settling — {(settling / 10).toFixed(0)}s. A body has to take before it
                can be rewritten again.
              {:else}
                Rewriting the centromere spends biomatter and has to take.
                You hold {fmt(gs.materials.biomatter ?? 0)}.
              {/if}
            </div>
          {/if}
          {#each held(picking === CENTRE ? 'gene' : 'mutagen') as row (row.def.id)}
            <div class="opt-row">
              <span class="opt-name">{row.def.icon} {row.def.name}</span>
              <span class="grades">
                {#each row.grades as g (g.quality)}
                  {@const cost =
                    picking === CENTRE ? swapBiomatterCost({ id: row.def.id, quality: g.quality }) : 0}
                  {@const short = QUALITY_TIERS[g.quality].name}
                  <Tip>
                    <button
                      class="grade"
                      style="border-color: {QUALITY_TIERS[g.quality].color}; color: {QUALITY_TIERS[g.quality].color}"
                      disabled={picking === CENTRE &&
                        (settling > 0 || (gs.materials.biomatter ?? 0) < cost)}
                      onclick={() => choose(row.def.id, g.quality)}
                    >
                      {short.slice(0, 2)}<span class="qty">{g.qty}</span>
                    </button>
                    {#snippet tip()}
                      <div class="tip-line tip-base">{row.def.icon} {row.def.name} — {short}</div>
                      <!-- What the thing DOES, which neither picker said. A gene
                           states it in prose; a mutagen has none, so its lines
                           are derived from its effect and its transform. -->
                      {#each pickerLines(row.def) as line}
                        <div class="tip-line">{line}</div>
                      {/each}
                      <div class="tip-line tip-sub">{fmt(g.qty)} held</div>
                      {#if cost}
                        <div class="tip-line tip-sub">🩸 {fmt(cost)} biomatter to write</div>
                      {/if}
                    {/snippet}
                  </Tip>
                {/each}
              </span>
            </div>
          {:else}
            <div class="dim small">Nothing held that fits here.</div>
          {/each}
        </div>
      {/if}

      {#each ARMS as arm (arm.id)}
        {@const a = res.arms[arm.id]}
        {@const routes = reaching(res, arm.id)}
        {@const got = delivery(arm.id)}
        {@const base = liveBase(a.base)}
        <div class="panel arm">
          <div class="row-head">
            <b>{arm.icon} {arm.name}</b>
            <Tip>
              <span class="small dim">
                {routes.length} route{routes.length === 1 ? '' : 's'} · ×{a.weight.toFixed(2)}
              </span>
              {#snippet tip()}
                <div class="tip-line tip-base">How much is arriving here</div>
                <div class="tip-line">
                  Every route's strength added together — distance travelled, halved at each tie,
                  capped at the gene's ceiling of ×{res.ceiling.toFixed(1)}.
                </div>
                <div class="tip-line tip-sub">
                  It is a gauge, not a multiplier: what it does to any particular number is on the
                  "Delivers" line below.
                </div>
              {/snippet}
            </Tip>
          </div>
          <!-- What the gene itself says about THIS arm, beside the routes and
               numbers it is describing. The Active sentence is skipped only when
               the ability block above PRICES A BLOW — that is when the derived
               figures say the same thing with the real numbers in them. An
               ability that lands nothing of its own (a volley, a ward) has the
               gene's own sentence as its best prose, and dropping it left the
               arm described by numbers that were never about a blow. -->
          {#if notes.arms[arm.id] && !(arm.id === 'active' && abilitySpec && pricesABlow(abilitySpec))}
            <div class="small arm-note">{notes.arms[arm.id]}</div>
          {/if}
          {#if base.length}
            <!-- Through describeMod, like every other modifier in the game:
                 raw keys read as "resHeat +-0.25" where a negative value met a
                 hardcoded plus. It also gives them their real names. -->
            <div class="small line-base">
              <span class="label">The body itself</span>
              {#each base as m}
                {@const now = modEffective(gs, m)}
                <span class="chip">
                  {modText(m)}{#if now}<span class="now">→ {now}</span>{/if}
                </span>
              {/each}
            </div>
          {/if}

          <!-- WHAT ROUTING ACTUALLY GAVE YOU. The panel drew the paths and the
               weights and stopped one step short of the answer; this is that
               step, taken off the same function the character sheet reads. -->
          {#if routes.length}
            <div class="small delivers">
              <span class="label">Delivers</span>
              {#if got.mods.length}
                {#each got.mods as m}
                  {@const now = modEffective(gs, m)}
                  <span class="chip strong">
                    {modText(m)}{#if now}<span class="now">→ {now}</span>{/if}
                  </span>
                {/each}
              {:else}
                <span class="dim">
                  no stat at all — {got.silent === 1 ? 'the route below carries' : `all ${got.silent} routes below carry`}
                  only what is listed here
                </span>
              {/if}
            </div>
            {#if got.liveGrants.length || got.liveTypes.length}
              <div class="small grants">
                {[
                  ...got.liveTypes.map(
                    (t) => `🩸 ${DAMAGE_TYPE_NAMES[t].toLowerCase()} arrives — the heaviest route re-types the ability`,
                  ),
                  ...got.liveGrants.map((g) => g.text),
                ].join(' · ')}
              </div>
            {/if}
            <!-- Honest about the third of this system that is authored and read
                 by nobody (docs/MUTAGENS.md §12). Stating an outcome
                 confidently while it is inert would only make the panel lie
                 more legibly; saying so turns a silent dead end into a known
                 one, which is the difference a player can plan around. -->
            {#if got.inertGrants.length || got.inertTypes.length}
              <div class="small pending">
                also arriving:
                {[
                  ...got.inertGrants.map((g) => g.text.replace(/^[^ ]+ /, '')),
                  ...got.inertTypes.map((t) => `${DAMAGE_TYPE_NAMES[t].toLowerCase()} damage type`),
                ].join(' · ')} — carried faithfully, read by nothing
                {arm.id === 'active' ? 'yet' : 'in this arm'}
              </div>
            {/if}
          {/if}

          {#each routes as c (c.from + c.arm + c.through.join(''))}
            <!-- The route, not the number: where it started, what it passed
                 through, what it was by the time it arrived — and now what it
                 put in the arm, so "if I cut here I lose exactly this" is a
                 thing the panel answers rather than implies. -->
            <Tip block>
              {@const path = pathOf(c)}
              {@const mods = routeMods(c)}
              <!-- The path and what it delivered are one hover target, not two.
                   Split, pointing at the line that says "+7.5% Cold Res." lit
                   nothing on the diagram — which is precisely the moment a
                   player is asking "and where did THAT come from?". -->
              <div
                class="route-block"
                role="note"
                onmouseenter={() => (lit = c)}
                onmouseleave={() => (lit = null)}
              >
              <div class="route">
                <span class="path">
                  <span class="gicon">{c.gene.icon}</span>
                  {#each path as n, i}{#if i > 0}<span class="hop">→</span>{/if}<span
                      class="node"
                      class:from={i === 0}
                      class:centre-node={i === path.length - 1}
                    >{n}</span>{/each}
                </span>
                <span class="small nums">
                  {#if c.gain !== 1}<span class="split amp">×{c.gain.toFixed(2)} amp</span>{/if}
                  {#if c.share < 1}<span class="split">half</span>{/if}
                  {#if isClamped(c, res.ceiling)}<span class="split capped">capped</span>{/if}
                  <b>×{weightOf(c).toFixed(2)}</b>
                </span>
              </div>
              {#if mods.length}
                <div class="small route-gives">
                  {mods.map((m) => modText(m)).join(' · ')}
                </div>
              {:else}
                <div class="small route-gives dim">carries no stat — only what is listed above</div>
              {/if}
              </div>
              {#snippet tip()}
                <div class="tip-line tip-base">
                  {c.gene.icon} {c.gene.name}
                  <span style="color: {QUALITY_TIERS[c.quality].color}">
                    {QUALITY_TIERS[c.quality].name}
                  </span>
                </div>
                {#each c.notes as note}<div class="tip-line">{note}</div>{/each}
                <div class="tip-line tip-total">
                  ×{c.intensity.toFixed(2)} travelled{#if c.gain !== 1}
                    × {c.gain.toFixed(2)} amplified{/if}{#if isClamped(c, res.ceiling)}, held to the
                    gene's ceiling of ×{res.ceiling.toFixed(2)}{/if}{#if c.share < 1}
                    × {Math.round(c.share * 100)}% of the split{/if}
                  = <b>×{weightOf(c).toFixed(2)}</b> on everything it carries
                </div>
                <div class="tip-line tip-sub">
                  {QUALITY_TIERS[c.quality].name} works at {Math.round(
                    mutagenApproach(c.quality) * 100,
                  )}% strength — grade is a mutagen's only power axis.
                </div>
                {#each routeMods(c) as m}
                  <div class="tip-line">{modText(m)}</div>
                {/each}
                {#if c.arrived.type}
                  <div class="tip-line tip-sub">
                    arrives as <b>{DAMAGE_TYPE_NAMES[c.arrived.type].toLowerCase()}</b> — nothing
                    reads an arriving damage type yet
                  </div>
                {/if}
                {#each c.arrived.grants ?? [] as g}
                  {@const shown = describeGrant(g)}
                  <div class="tip-line">
                    {shown.text}{shown.live ? '' : ' — nothing reads this yet'}
                  </div>
                {/each}
                <div class="tip-line tip-sub">
                  {c.distance}μm over {c.hops} edge{c.hops === 1 ? '' : 's'}
                </div>
              {/snippet}
            </Tip>
          {:else}
            <div class="dim small">
              Nothing reaches this arm — no filled socket has a live path to its door.
            </div>
          {/each}
        </div>
      {/each}

      {#if res.stranded.length}
        <div class="panel small dim">
          Stranded, with no live route to the centromere: {res.stranded.join(', ')}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .chromo { display: flex; flex-direction: column; gap: 10px; }
  /* Two BANDS: identity + capacity across the top, everything prose-shaped
     across the full width beneath.
     Wrapping rather than a grid with a viewport media query — the panel is one
     column of a two-column body, so it goes narrow while the WINDOW is still
     wide, and a `max-width: 700px` rule never fires for the case that actually
     hurts. Wrapped, the capacity bar drops below the name exactly when there is
     no longer room beside it. */
  .head { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: flex-start; }
  .ident { flex: 1 1 240px; display: flex; align-items: center; gap: 10px; min-width: 0; }
  .about { flex: 1 1 100%; min-width: 0; }
  .titles { min-width: 0; }
  .big { font-size: 26px; }
  .grade { font-size: 11px; margin-left: 6px; }
  .cap { flex: 1 1 220px; min-width: 0; }
  .cap-bar { height: 7px; border-radius: 4px; background: var(--bg-deep, #0003); overflow: hidden; }
  .cap-fill { height: 100%; background: var(--accent); }
  .cap-bar.over .cap-fill { background: var(--danger); }
  .over-text { color: var(--danger); }

  .body { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
  .diagram { flex: 1 1 340px; min-width: 300px; }
  .diagram svg { width: 100%; height: auto; display: block; }
  .side { flex: 1 1 320px; min-width: 280px; display: flex; flex-direction: column; gap: 8px; }

  .edge { stroke: var(--text-dim); cursor: pointer; }
  .edge.open { stroke-dasharray: 2 2; opacity: 0.28; }
  .edge.live { opacity: 0.85; }
  .edge.cut { stroke: var(--danger); stroke-dasharray: 3 2; opacity: 0.7; }
  .edge.lit { stroke: var(--accent); opacity: 1; }
  .edge:hover { stroke: var(--accent); }

  .socket circle { fill: var(--bg-panel); stroke: var(--text-dim); stroke-width: 0.7; cursor: pointer; }
  .socket.filled circle { stroke: var(--accent); stroke-width: 1.1; }
  .socket.picking circle { stroke: var(--xp); stroke-width: 1.4; }
  .socket:hover circle { stroke: var(--accent); }
  /* A socket on the route under the cursor. Lit edges alone left the ends of
     the path ambiguous on the ring, where two routes share most of their run. */
  .socket.on-route circle { stroke: var(--accent); stroke-width: 1.6; }
  .socket .tag { fill: var(--text-dim); font-weight: 600; }
  .socket.on-route .tag { fill: var(--accent); }
  /* The letter badge rides its own disc so it stays readable over the icon. */
  .tag-disc { fill: var(--bg-deep, #111); stroke: var(--text-dim); stroke-width: 0.4; }
  .socket.filled .tag-disc { stroke: var(--accent); }
  /* Pointer-transparent so the glyph never steals a click from the edge it
     labels — the edge underneath is the cut/restore control. */
  .door, .door-disc, .tag-disc { pointer-events: none; }
  .door-disc { fill: var(--bg-panel); stroke: var(--accent); stroke-width: 0.5; opacity: 0.95; }
  .door-disc.door-dim { stroke: var(--text-dim); opacity: 0.5; }
  .door-dim { opacity: 0.4; }
  .centre circle { fill: var(--bg-panel); stroke-width: 1.2; }

  /* What the body IS, under its name — the description, its capabilities and
     the tool it hands you. Constrained so a long gene desc cannot push the
     capacity bar off the head panel. */
  .gene-desc { max-width: 82ch; line-height: 1.35; color: var(--text-dim); }
  .arm-note { margin: 1px 0 3px; line-height: 1.3; color: var(--text-dim); }
  .traits { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .trait {
    padding: 0 6px; font-size: 11px; line-height: 18px; border-radius: 4px;
    border: 1px solid var(--text-dim); color: var(--text-dim);
  }
  .cap-trait { border-color: var(--xp); color: var(--xp); }
  /* A capability nothing reads yet is still worth showing — it is what the
     mutagen you spent capacity on actually carried — but it must not wear the
     colour the working ones wear. */
  .inert-trait { border-style: dashed; opacity: 0.65; }

  .ability {
    margin-top: 6px; padding: 6px 9px; border-radius: 6px;
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    background: color-mix(in srgb, var(--accent) 7%, transparent);
  }
  .ability-head { display: flex; align-items: baseline; gap: 8px; }
  .ability-head .dim { margin-left: auto; }
  .reach { margin-top: 3px; color: var(--text-dim); line-height: 1.35; }

  .row-head { display: flex; align-items: center; gap: 8px; }
  .row-head button { margin-left: auto; }
  .row-head :global(.tip-target) { margin-left: auto; }

  /* The two answers, side by side and shaped alike: what the gene simply IS
     here, and what the graph put on top of it. Reading them as one sentence is
     the point — "the body itself … delivers …". */
  .line-base, .delivers { margin: 2px 0; line-height: 1.5; }
  .line-base { color: var(--text-dim); }
  .label {
    display: inline-block; margin-right: 6px; font-size: 10px; letter-spacing: 0.06em;
    text-transform: uppercase; opacity: 0.75;
  }
  .delivers .label { color: var(--accent); opacity: 1; }
  .chip { white-space: nowrap; }
  .chip.strong { color: var(--text); }
  /* The separator belongs TO the chip that follows it, not between the two.
     As its own element it could be the last thing on a line when the next chip
     wrapped, leaving a dot dangling at the end of a row. */
  .chip + .chip::before { content: '·'; opacity: 0.55; margin: 0 5px; }
  /* What a conversion rate comes to against your current sheet. The rate is
     the rule; this is the number you feel. */
  .now { opacity: 0.7; font-style: italic; margin-left: 5px; }
  .pending {
    margin: 2px 0; line-height: 1.4; opacity: 0.72;
    border-left: 2px dashed var(--text-dim); padding-left: 6px;
  }

  .route-block { border-radius: 5px; padding: 2px 0 3px; }
  .route-block:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .route {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 1px 5px 0;
  }
  .nums { margin-left: auto; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
  .split {
    font-size: 10px; padding: 0 4px; border-radius: 3px;
    border: 1px solid var(--text-dim); color: var(--text-dim);
  }
  .split.capped { border-color: var(--xp); color: var(--xp); }
  .split.amp { border-color: var(--accent); color: var(--accent); }
  /* What the graph did to the ability, next to the ability it did it to. */
  .changed { margin-top: 3px; color: var(--accent); line-height: 1.35; }
  /* What this one route put in the arm, under the path that carried it. */
  .route-gives {
    padding: 0 5px 4px 22px; color: var(--text-dim); line-height: 1.35;
  }
  /* Every node the same width, so the arrows in "b → a → d → ◉" line up down
     the card and a route can be read as a shape rather than parsed as text. */
  .gicon { display: inline-block; width: 16px; }
  .node {
    display: inline-block; min-width: 12px; text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600;
  }
  .node.from { color: var(--accent); }
  .centre-node { color: var(--xp); }

  /* One row per kind with its grades as chips. Flattened to a row per
     (kind × grade), nine mutations became sixty-three rows. */
  .opt-row { display: flex; align-items: center; gap: 8px; padding: 2px 5px; }
  .opt-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .grades { display: flex; flex-wrap: wrap; gap: 3px; margin-left: auto; }
  .grade {
    padding: 0 5px; font-size: 11px; line-height: 18px;
    border: 1px solid; border-radius: 4px; background: none; cursor: pointer;
  }
  .grade:hover:not(:disabled) { background: color-mix(in srgb, currentColor 20%, transparent); }
  .grade:disabled { opacity: 0.35; cursor: default; }
  .grade .qty { margin-left: 3px; opacity: 0.7; }
  .hop { display: inline-block; width: 13px; text-align: center; opacity: 0.5; }
  .grants { color: var(--xp); margin: 2px 0; }
  .legend { display: flex; flex-direction: column; gap: 3px; line-height: 1.4; }
  .picker { display: flex; flex-direction: column; gap: 3px; }

  .unpaid {
    margin: 2px 3px 0 0; padding: 1px 6px; font-size: 11px;
    border: 1px dashed var(--text-dim); border-radius: 4px;
    background: none; color: var(--text-dim); cursor: pointer;
  }
  .unpaid.afford { border-style: solid; border-color: var(--accent); color: var(--accent); }
</style>
