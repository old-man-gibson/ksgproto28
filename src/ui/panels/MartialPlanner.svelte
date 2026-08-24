<script lang="ts">
  import { gs, game, ui } from '../state.svelte';
  import { POSITIONS, TECHNIQUES } from '../../core/registry';
  import { ANY_POSITION_COLOR, TECHNIQUE_LIST, WEAPON_FAMILIES } from '../../core/data/martial.data';
  import {
    knownPositions,
    positionGraph,
    techniqueBenched,
    techniqueDisplayName,
    techniqueExit,
    techniqueKnown,
    techniquesForFamilies,
    entryPositions,
    type PositionEdge,
  } from '../../core/systems/martial';
  import { activeRotation } from '../../core/systems/combat';
  import { equippedTags } from '../../core/systems/conditions';
  import type { TechniqueDef } from '../../core/types';
  import { condsText } from '../lib/format';
  import { describeCondition } from '../../core/systems/triggers';
  import EntryConfigModal from '../lib/EntryConfigModal.svelte';

  /**
   * The position-graph planner: the loadout arranged ON the graph instead of
   * in a flat list. Positions are nodes, each known technique is an edge from
   * its entry position(s) to its exit, and the whole thing is a MAP — never a
   * script (MARTIAL.md §9). Nothing here lets the player say "A then B": the
   * edges only report which moves happen to leave you where others start, and
   * the fight still assembles every chain out of that.
   *
   * All geometry lives here (presentation); which edges exist at all is
   * core's answer — positionGraph reads entryPositions/techniqueExit, so
   * mastery `addFrom`, chosen forks and rune surgery are already folded in.
   *
   * DEFERRED (designer: "not a pressing problem"): per-technique TRIGGERS are
   * not drawn. When they arrive they belong on the edge itself — a trigger is
   * a property of one node's firing, not of the pair — as a glyph on the
   * stroke beside the arrowhead. They must stay decoration: the moment the
   * graph can express "this fires after that", it has become a script.
   */

  const PREFIX = 'technique:';

  // ---------- Geometry ----------
  // Positions are seated on a ring. The five universal ones get fixed seats so
  // the graph doesn't reshuffle under the player; anything content adds later
  // (runes may grant private positions — §10) lands after them automatically.
  const SEATING = ['neutral', 'coiled', 'off_balance', 'guarded', 'extended'];
  // Only positions the player has a way of reaching are drawn — an undiscovered
  // seat would otherwise sit on the graph advertising a technique they have
  // never met. Derived, so a newly learned move lights its position up.
  const ringIds = $derived.by(() => {
    const known = new Set(knownPositions(gs).map((p) => p.id));
    return [
      ...SEATING.filter((id) => known.has(id)),
      ...[...known].filter((id) => !SEATING.includes(id)),
    ];
  });

  const VIEW_W = 480;
  const VIEW_H = 430;
  const CX = 240;
  const CY = 206;
  /** Radius the position nodes sit on. */
  const RING = 112;
  const NODE_R = 27;
  /** Radius the 'any'-entry reflexes orbit at — outside the graph, by nature. */
  const REFLEX_RING = 186;
  const CHIP_R = 13;
  /** Angular spread between reflexes that share an exit. */
  const REFLEX_FAN = 0.22;
  /** How far an arrow stops short of its target node, so the head stays clear. */
  const HEAD_GAP = 9;
  /** Base sideways bow; a→b and b→a bow to opposite sides and never overlap. */
  const BOW = 17;
  /** Extra bow per parallel edge between the same two positions. */
  const LANE_STEP = 15;

  interface Seat {
    x: number;
    y: number;
    a: number;
  }

  // Seats follow the ring, which grows as positions are discovered — computing
  // these once would leave a newly revealed seat with nowhere to sit.
  const NODE_AT: Record<string, Seat> = $derived.by(() => {
    const seats: Record<string, Seat> = {};
    ringIds.forEach((id, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / ringIds.length;
      seats[id] = { x: CX + RING * Math.cos(a), y: CY + RING * Math.sin(a), a };
    });
    return seats;
  });

  /** Step `dist` from p toward q — used to trim edges to the node rims. */
  function toward(p: { x: number; y: number }, q: { x: number; y: number }, dist: number) {
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * dist, y: p.y + (dy / len) * dist };
  }

  /** A bowed arc between two seats, fanned so parallel edges stay readable. */
  function arcPath(a: Seat, b: Seat, lane: number, lanes: number): string {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // Always bow to the LEFT of travel, so the two directions of a pair split.
    const nx = dy / len;
    const ny = -dx / len;
    const off = BOW + (lane - (lanes - 1) / 2) * LANE_STEP;
    const c = { x: (a.x + b.x) / 2 + nx * off, y: (a.y + b.y) / 2 + ny * off };
    const s = toward(a, c, NODE_R);
    const e = toward(b, c, NODE_R + HEAD_GAP);
    return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} Q ${c.x.toFixed(1)} ${c.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
  }

  /** A technique that exits where it entered (Flowing Thrust, Crosscut): a loop. */
  function loopPath(n: Seat, lane: number): string {
    const ox = Math.cos(n.a);
    const oy = Math.sin(n.a);
    const px = -oy;
    const py = ox;
    const reach = (1.6 + lane * 0.5) * NODE_R;
    const at = (o: number, p: number) => ({ x: n.x + ox * o + px * p, y: n.y + oy * o + py * p });
    const s = at(NODE_R * 0.5, NODE_R * 0.87);
    const e = at(NODE_R * 0.5, -NODE_R * 0.87);
    const c1 = at(reach, NODE_R * 1.5);
    const c2 = at(reach, -NODE_R * 1.5);
    return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
  }

  // ---------- What the graph is showing ----------

  /** Techniques in the rotation right now, in the order they'll be considered. */
  const planned = $derived(
    activeRotation(gs)
      .filter((id) => id.startsWith(PREFIX))
      .map((id) => TECHNIQUES[id.slice(PREFIX.length)])
      .filter((t): t is TechniqueDef => !!t && !techniqueBenched(gs, t.id)),
  );

  /**
   * What the selected weapon groups would put on the graph, plus the universal
   * (family-less) moves. Anything already in the plan is added back in even if
   * its family is deselected — the filter narrows what you're CONSIDERING, and
   * must never hide what you're actually fighting with.
   */
  const pool = $derived.by(() => {
    const byFamily = techniquesForFamilies(ui.plannerFamilies);
    const seen = new Set(byFamily.map((t) => t.id));
    return [...byFamily, ...planned.filter((t) => !seen.has(t.id))];
  });

  const edges = $derived(positionGraph(gs, pool));
  const posEdges = $derived(edges.filter((e) => e.from !== null));
  const reflexEdges = $derived(edges.filter((e) => e.from === null));

  type PlanState = 'planned' | 'benched' | 'locked';

  /** Where a technique stands: in the rotation, held back, or not yet known. */
  function planStateOf(t: TechniqueDef): PlanState {
    if (!techniqueKnown(gs, t)) return 'locked';
    return techniqueBenched(gs, t.id) ? 'benched' : 'planned';
  }

  interface Drawn {
    edge: PositionEdge;
    key: string;
    d: string;
    stroke: string;
  }

  const drawn = $derived.by(() => {
    const total = new Map<string, number>();
    for (const e of posEdges) {
      const k = `${e.from}>${e.to}`;
      total.set(k, (total.get(k) ?? 0) + 1);
    }
    const used = new Map<string, number>();
    const out: Drawn[] = [];
    for (const e of posEdges) {
      const a = NODE_AT[e.from!];
      const b = NODE_AT[e.to];
      if (!a || !b) continue; // content naming a position the ring doesn't seat
      const k = `${e.from}>${e.to}`;
      const lane = used.get(k) ?? 0;
      used.set(k, lane + 1);
      out.push({
        edge: e,
        key: `${e.def.id}:${e.from}`,
        d: e.from === e.to ? loopPath(a, lane) : arcPath(a, b, lane, total.get(k)!),
        // A loop's two ends share a colour, so a gradient would be invisible.
        stroke: e.from === e.to ? POSITIONS[e.to].color : `url(#pg-grad-${e.from}-${e.to})`,
      });
    }
    return out;
  });

  /** One gradient per ordered pair: edges enter on entry colour, leave on exit. */
  const gradients = $derived.by(() => {
    const seen = new Map<string, { key: string; a: Seat; b: Seat; from: string; to: string }>();
    for (const e of posEdges) {
      if (e.from === e.to) continue;
      const key = `${e.from}-${e.to}`;
      const a = NODE_AT[e.from!];
      const b = NODE_AT[e.to];
      if (!a || !b || seen.has(key)) continue;
      seen.set(key, { key, a, b, from: e.from!, to: e.to });
    }
    return [...seen.values()];
  });

  /**
   * Reflexes answer from wherever the fight left you, so they get no entry
   * node — they orbit the graph on their own ring and point inward at the
   * only thing about them that IS a position: where they leave you.
   */
  const reflexChips = $derived.by(() => {
    const byExit = new Map<string, PositionEdge[]>();
    for (const e of reflexEdges) {
      const list = byExit.get(e.to) ?? [];
      list.push(e);
      byExit.set(e.to, list);
    }
    const out: { edge: PositionEdge; x: number; y: number; d: string; node: Seat }[] = [];
    for (const [exit, list] of byExit) {
      const node = NODE_AT[exit];
      if (!node) continue;
      list.forEach((e, i) => {
        const a = node.a + (i - (list.length - 1) / 2) * REFLEX_FAN;
        const at = { x: CX + REFLEX_RING * Math.cos(a), y: CY + REFLEX_RING * Math.sin(a) };
        const s = toward(at, node, CHIP_R + 3);
        const t = toward(node, at, NODE_R + HEAD_GAP);
        out.push({
          edge: e,
          x: at.x,
          y: at.y,
          node,
          d: `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} L ${t.x.toFixed(1)} ${t.y.toFixed(1)}`,
        });
      });
    }
    return out;
  });

  // ---------- Hover: what does this technique touch? ----------
  // Hovering a move pulses its entry position(s) inward and its exit outward —
  // the two halves of "where must I be" and "where does this leave me".

  let hot = $state<string | null>(null);
  const hotDef = $derived(hot ? (TECHNIQUES[hot] ?? null) : null);
  const hotEntry = $derived.by(() => {
    if (!hotDef) return new Set<string>();
    const from = entryPositions(gs, hotDef);
    return new Set<string>(from === 'any' ? [] : from);
  });
  const hotExit = $derived(hotDef ? techniqueExit(gs, hotDef) : null);

  // ---------- Commands ----------
  // The planner never grants: adding is un-benching something already in the
  // ledger, and the weapon-group filter is a view — it equips nothing.

  function addToPlan(t: TechniqueDef): void {
    if (!techniqueKnown(gs, t)) return;
    game.setSkillEnabled(`${PREFIX}${t.id}`, true);
    openFamily = null;
  }

  function discard(t: TechniqueDef): void {
    game.setSkillEnabled(`${PREFIX}${t.id}`, false);
  }

  function toggleFamily(id: string): void {
    const at = ui.plannerFamilies.indexOf(id);
    if (at >= 0) ui.plannerFamilies.splice(at, 1);
    else ui.plannerFamilies.push(id);
  }

  /** Fill the filter from what's actually in hand — the obvious starting point. */
  function selectHeld(): void {
    const held = equippedTags(gs);
    ui.plannerFamilies = WEAPON_FAMILIES.filter((f) => held.has(f.id)).map((f) => f.id);
  }

  let openFamily = $state<string | null>(null);
  function familyTechniques(id: string): TechniqueDef[] {
    return TECHNIQUE_LIST.filter((t) => t.family === id);
  }

  // ---------- Arranging ----------
  // Dragging writes through moveSkillTo, the same primitive the Active Skills
  // list uses: one order, one door into it. Order is priority — first eligible
  // entry wins the swing — and never a sequence.

  let dragging = $state<string | null>(null);
  let dropTarget = $state<string | null>(null);

  function onDrop(beforeId: string | null): void {
    if (dragging) game.moveSkillTo(dragging, beforeId);
    dragging = null;
    dropTarget = null;
  }

  // ---------- Configuring one move ----------
  // The graph is where the detail lives: double-click a move (or hit ⚙) and
  // its window opens on the whole thing — reflex, positions, mastery, and the
  // trigger conditions you want to narrow it with. Those conditions are a
  // firing POLICY for one node, never an order; see the §9 note above.

  let configId = $state<string | null>(null);

  /** The player's own overlay on a technique, if they've set one. */
  function overlayOf(t: TechniqueDef) {
    const trigger = gs.skillTriggers[`${PREFIX}${t.id}`];
    if (!trigger || (!trigger.event && trigger.conditions.length === 0)) return null;
    return [
      ...(trigger.event ? [trigger.event] : []),
      ...trigger.conditions.map((c) => describeCondition(c, gs)),
    ].join(' · ');
  }
</script>

<div class="panel planner">
  <button class="planner-toggle" onclick={() => (ui.plannerOpen = !ui.plannerOpen)}>
    {ui.plannerOpen ? '▾' : '▸'} 🕸️ Position Planner
    <span class="dim small">— your loadout, drawn on the graph</span>
  </button>

  {#if ui.plannerOpen}
    <!-- Weapon groups: a lens, not a loadout. Picking one shows what that
         family would put on the graph; it never equips or grants anything. -->
    <div class="families">
      <span class="dim small">Weapon groups:</span>
      {#each WEAPON_FAMILIES as f (f.id)}
        {@const on = ui.plannerFamilies.includes(f.id)}
        <span class="fam-wrap">
          <button
            class="fam"
            class:on
            title="Click to filter · double-click to list {f.name} techniques"
            onclick={() => toggleFamily(f.id)}
            ondblclick={() => (openFamily = openFamily === f.id ? null : f.id)}
          >
            {f.icon} {f.name}
          </button>
          <button
            class="fam-more"
            aria-label="List {f.name} techniques"
            onclick={() => (openFamily = openFamily === f.id ? null : f.id)}>▾</button
          >

          {#if openFamily === f.id}
            <!-- The family's whole roster. Known moves can join the plan;
                 unknown ones show what makes you ELIGIBLE to learn them —
                 never how close the counter is (crystallization stays a
                 surprise, MARTIAL.md §10). -->
            <div class="drop">
              <div class="drop-head small">{f.icon} {f.name} techniques</div>
              {#each familyTechniques(f.id) as t (t.id)}
                {@const st = planStateOf(t)}
                <div
                  class="drop-row"
                  class:locked={st === 'locked'}
                  onmouseenter={() => (hot = t.id)}
                  onmouseleave={() => (hot = null)}
                  role="presentation"
                >
                  <span class="drop-name">{t.icon} {techniqueDisplayName(gs, t)}</span>
                  {#if st === 'locked'}
                    <span class="dim small">🔒 {condsText(t.unlock) || 'not yet known'}</span>
                  {:else if st === 'planned'}
                    <span class="small in-plan">in plan</span>
                  {:else}
                    <button class="tiny" onclick={() => addToPlan(t)}>+ Add</button>
                  {/if}
                </div>
              {:else}
                <div class="dim small drop-row">No techniques for this group yet.</div>
              {/each}
            </div>
          {/if}
        </span>
      {/each}
      <button class="tiny held" onclick={selectHeld}>⚔ What I'm holding</button>
      {#if ui.plannerFamilies.length > 0}
        <button class="tiny" onclick={() => (ui.plannerFamilies = [])}>Clear</button>
      {/if}
    </div>

    <div class="board">
      <div class="graph-wrap">
        <svg viewBox="0 0 {VIEW_W} {VIEW_H}" class="graph" aria-label="Position graph">
          <defs>
            {#each ringIds as id (id)}
              <marker
                id="pg-arrow-{id}"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" fill={POSITIONS[id].color} />
              </marker>
            {/each}
            {#each gradients as g (g.key)}
              <linearGradient
                id="pg-grad-{g.key}"
                gradientUnits="userSpaceOnUse"
                x1={g.a.x}
                y1={g.a.y}
                x2={g.b.x}
                y2={g.b.y}
              >
                <stop offset="0%" stop-color={POSITIONS[g.from].color} />
                <stop offset="100%" stop-color={POSITIONS[g.to].color} />
              </linearGradient>
            {/each}
            {#each reflexChips as c (c.edge.def.id)}
              <linearGradient
                id="pg-any-{c.edge.def.id}"
                gradientUnits="userSpaceOnUse"
                x1={c.x}
                y1={c.y}
                x2={c.node.x}
                y2={c.node.y}
              >
                <stop offset="0%" stop-color={ANY_POSITION_COLOR} />
                <stop offset="100%" stop-color={POSITIONS[c.edge.to].color} />
              </linearGradient>
            {/each}
          </defs>

          <!-- The reflex orbit: everything on it fires from anywhere. -->
          {#if reflexChips.length > 0}
            <circle cx={CX} cy={CY} r={REFLEX_RING} class="orbit" />
          {/if}

          {#each drawn as e (e.key)}
            {@const st = planStateOf(e.edge.def)}
            <path
              class="edge {st}"
              class:hot={hot === e.edge.def.id}
              d={e.d}
              stroke={e.stroke}
              marker-end="url(#pg-arrow-{e.edge.to})"
              onmouseenter={() => (hot = e.edge.def.id)}
              onmouseleave={() => (hot = null)}
              role="presentation"
            >
              <title
                >{techniqueDisplayName(gs, e.edge.def)}: {POSITIONS[e.edge.from!]?.name} → {POSITIONS[
                  e.edge.to
                ]?.name}</title
              >
            </path>
          {/each}

          {#each reflexChips as c (c.edge.def.id)}
            {@const st = planStateOf(c.edge.def)}
            {@const on = hot === c.edge.def.id}
            <g
              class="reflex {st}"
              class:hot={on}
              onmouseenter={() => (hot = c.edge.def.id)}
              onmouseleave={() => (hot = null)}
              role="presentation"
            >
              <path
                class="edge any {st}"
                class:hot={on}
                d={c.d}
                stroke="url(#pg-any-{c.edge.def.id})"
                marker-end="url(#pg-arrow-{c.edge.to})"
              />
              <circle cx={c.x} cy={c.y} r={CHIP_R} class="chip" />
              <text x={c.x} y={c.y + 4} text-anchor="middle" class="chip-icon">{c.edge.def.icon}</text
              >
              <title
                >{techniqueDisplayName(gs, c.edge.def)}: from anywhere → {POSITIONS[c.edge.to]
                  ?.name}</title
              >
            </g>
          {/each}

          {#each ringIds as id (id)}
            {@const p = POSITIONS[id]}
            {@const n = NODE_AT[id]}
            {@const isEntry = hotEntry.has(id)}
            {@const isExit = hotExit === id}
            <g class="node" class:entry={isEntry} class:exit={isExit} style="--pc: {p.color}">
              {#if isEntry}
                <!-- Pulses INWARD: this is where the move has to find you. -->
                <circle cx={n.x} cy={n.y} r={NODE_R} class="pulse in" />
              {/if}
              {#if isExit}
                <!-- Pulses OUTWARD: this is where the move throws you. -->
                <circle cx={n.x} cy={n.y} r={NODE_R} class="pulse out" />
              {/if}
              <circle cx={n.x} cy={n.y} r={NODE_R} class="disc" />
              <text x={n.x} y={n.y + 2} text-anchor="middle" class="node-icon">{p.icon}</text>
              <text x={n.x} y={n.y + NODE_R + 15} text-anchor="middle" class="node-name">
                {p.name}
              </text>
              <title>{p.name} — {p.desc}</title>
            </g>
          {/each}
        </svg>

        <p class="dim small legend">
          <b class="k planned">━</b> in your plan · <b class="k benched">╌</b> known, benched ·
          <b class="k locked">╌</b> not yet learned · the outer ring answers from anywhere.
        </p>
        <p class="dim small directive">
          A map, not a script: the graph only shows which moves happen to leave you where others
          begin. The fight still decides the order.
        </p>
      </div>

      <!-- The plan itself. Order is priority (first eligible wins the swing),
           and dragging writes through the same moveSkillTo the Active Skills
           list uses — one order, one door into it. -->
      <div class="plan">
        <h4>
          In the plan
          <span class="dim small">— drag to set priority · double-click to configure</span>
        </h4>
        {#if planned.length === 0}
          <p class="dim small">
            Nothing in the rotation. Open a weapon group above (double-click it) and add what you
            know.
          </p>
        {:else}
          <div
            class="plan-list"
            ondragover={(e) => e.preventDefault()}
            ondrop={() => onDrop(null)}
            role="list"
          >
            {#each planned as t (t.id)}
              {@const id = `${PREFIX}${t.id}`}
              {@const from = entryPositions(gs, t)}
              {@const exit = POSITIONS[techniqueExit(gs, t)]}
              <div
                class="plan-row"
                class:dragging={dragging === id}
                class:drop-before={dropTarget === id && dragging !== id}
                class:hot={hot === t.id}
                role="listitem"
                draggable="true"
                ondragstart={() => (dragging = id)}
                ondragend={() => {
                  dragging = null;
                  dropTarget = null;
                }}
                ondragover={(e) => {
                  e.preventDefault();
                  dropTarget = id;
                }}
                ondragleave={() => {
                  if (dropTarget === id) dropTarget = null;
                }}
                ondrop={(e) => {
                  e.stopPropagation();
                  onDrop(id);
                }}
                onmouseenter={() => (hot = t.id)}
                onmouseleave={() => (hot = null)}
                ondblclick={() => (configId = id)}
              >
                <span class="grip dim" title="Drag to reorder">⠿</span>
                <span class="plan-name">
                  {t.icon}
                  {techniqueDisplayName(gs, t)}
                  {#if overlayOf(t)}
                    <span class="tuned" title="Your conditions: {overlayOf(t)}">⚡</span>
                  {/if}
                </span>
                <span class="flow small">
                  {#if from === 'any'}
                    <span class="pos-pill" style="--pc: {ANY_POSITION_COLOR}">any</span>
                  {:else}
                    {#each from as p (p)}
                      <span class="pos-pill" style="--pc: {POSITIONS[p]?.color ?? ANY_POSITION_COLOR}"
                        >{POSITIONS[p]?.icon}</span
                      >
                    {/each}
                  {/if}
                  <span class="dim">→</span>
                  <span class="pos-pill" style="--pc: {exit?.color ?? ANY_POSITION_COLOR}"
                    >{exit?.icon}</span
                  >
                </span>
                <button
                  class="tiny cog"
                  onclick={() => (configId = id)}
                  aria-label="Configure {t.name}"
                  title="When should this fire?">⚙</button
                >
                <button
                  class="tiny x"
                  onclick={() => discard(t)}
                  aria-label="Discard {t.name} from the plan"
                  title="Bench it — keeps its reps, leaves the rotation">✕</button
                >
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

{#if configId}
  <EntryConfigModal id={configId} onclose={() => (configId = null)} />
{/if}

<style>
  .planner {
    margin-top: 12px;
  }

  .planner-toggle {
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 2px 0;
    font-weight: 600;
  }

  .families {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
    margin: 8px 0;
  }

  /* Each group chip carries its own dropdown, so the menu is anchored to it. */
  .fam-wrap {
    position: relative;
    display: inline-flex;
  }

  button.fam {
    padding: 1px 8px;
    font-size: 11.5px;
    border-radius: 999px 0 0 999px;
    border-right: none;
  }

  button.fam.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 16%, var(--bg-raised));
  }

  button.fam-more {
    padding: 1px 5px;
    font-size: 10px;
    border-radius: 0 999px 999px 0;
    color: var(--text-dim);
  }

  .drop {
    position: absolute;
    top: calc(100% + 3px);
    left: 0;
    z-index: 20;
    min-width: 230px;
    background: var(--bg-panel);
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 5px 0;
    box-shadow: 0 6px 20px rgb(0 0 0 / 45%);
  }

  .drop-head {
    padding: 1px 9px 4px;
    color: var(--text-dim);
    border-bottom: 1px solid var(--border);
    margin-bottom: 3px;
  }

  .drop-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 2px 9px;
    font-size: 12px;
    white-space: nowrap;
  }

  /* Locked rows already carry --text-dim requirement text; fading the row on
     top of that made the one thing you came to read the hardest to read. */
  .drop-row.locked {
    opacity: 0.78;
  }

  .drop-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .in-plan {
    color: var(--xp);
  }

  /* Graph left, plan right; they stack on a narrow screen, graph first. */
  .board {
    display: grid;
    grid-template-columns: minmax(280px, 480px) 1fr;
    gap: 12px;
    align-items: start;
  }

  @media (max-width: 860px) {
    .board {
      grid-template-columns: 1fr;
    }
  }

  .graph {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }

  /* The "from anywhere" ring: reflexes orbit the graph rather than sitting in
     it, because no position is their home. */
  .orbit {
    fill: none;
    stroke: var(--border);
    stroke-width: 1;
    stroke-dasharray: 2 6;
    opacity: 0.7;
  }

  .edge {
    fill: none;
    stroke-width: 2.2;
    stroke-linecap: round;
    pointer-events: stroke;
    cursor: help;
  }

  /* Widen the invisible hit area without fattening the line. */
  .edge:hover {
    stroke-width: 3;
  }

  .edge.benched {
    stroke-width: 1.6;
    stroke-dasharray: 6 4;
    opacity: 0.5;
  }

  .edge.locked {
    stroke-width: 1.4;
    stroke-dasharray: 2 4;
    opacity: 0.24;
  }

  .edge.hot {
    stroke-width: 3.6;
    opacity: 1;
  }

  .edge.any {
    stroke-width: 1.8;
    stroke-dasharray: 5 4;
  }

  .edge.any.hot {
    stroke-width: 3;
  }

  .reflex {
    cursor: help;
  }

  .chip {
    fill: var(--bg-raised);
    stroke: var(--border);
    stroke-width: 1;
  }

  .reflex.planned .chip {
    stroke: color-mix(in srgb, #6b7280 70%, var(--text));
  }

  .reflex.locked {
    opacity: 0.35;
  }

  .reflex.benched {
    opacity: 0.6;
  }

  .reflex.hot .chip {
    stroke: var(--accent);
    stroke-width: 2;
  }

  .chip-icon {
    font-size: 13px;
    pointer-events: none;
  }

  .disc {
    fill: color-mix(in srgb, var(--pc) 18%, var(--bg-raised));
    stroke: var(--pc);
    stroke-width: 2;
  }

  .node.entry .disc,
  .node.exit .disc {
    stroke-width: 3;
  }

  .node-icon {
    font-size: 19px;
    pointer-events: none;
  }

  .node-name {
    font-size: 11px;
    fill: var(--text-dim);
    pointer-events: none;
  }

  /* Entry pulses inward (find me here), exit pulses outward (this is where it
     throws you). Same ring, opposite directions — the two halves of a move. */
  .pulse {
    fill: none;
    stroke: var(--pc);
    stroke-width: 2.5;
    transform-box: fill-box;
    transform-origin: center;
    pointer-events: none;
  }

  .pulse.in {
    animation: pg-in 1.1s ease-out infinite;
  }

  .pulse.out {
    animation: pg-out 1.1s ease-out infinite;
  }

  @keyframes pg-in {
    0% {
      transform: scale(2);
      opacity: 0;
    }
    45% {
      opacity: 0.85;
    }
    100% {
      transform: scale(1);
      opacity: 0;
    }
  }

  @keyframes pg-out {
    0% {
      transform: scale(1);
      opacity: 0.85;
    }
    100% {
      transform: scale(2);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pulse.in,
    .pulse.out {
      animation: none;
      opacity: 0.75;
    }
    .pulse.out {
      transform: scale(1.45);
    }
  }

  .legend,
  .directive {
    margin: 4px 0 0;
  }

  .legend .k {
    font-size: 13px;
  }

  .k.planned {
    color: var(--text);
  }

  .k.benched {
    opacity: 0.55;
  }

  .k.locked {
    opacity: 0.3;
  }

  .directive {
    font-style: italic;
    opacity: 0.75;
  }

  .plan h4 {
    margin: 0 0 6px;
    font-size: 13px;
  }

  .plan-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .plan-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 7px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-raised);
    font-size: 12px;
    min-width: 0;
  }

  .plan-row.hot {
    border-color: var(--accent);
  }

  .plan-row.dragging {
    opacity: 0.45;
  }

  .plan-row.drop-before {
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .plan-name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* A quiet mark that this move carries conditions of the player's own. */
  .tuned {
    color: var(--xp);
    font-size: 10px;
  }

  .tiny.cog {
    color: var(--text-dim);
    border: none;
    background: none;
  }

  .grip {
    cursor: grab;
    font-size: 13px;
    line-height: 1;
    user-select: none;
  }

  .flow {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex: 0 0 auto;
  }

  .pos-pill {
    display: inline-block;
    padding: 0 5px 1px;
    border: 1px solid var(--pc);
    border-radius: 999px;
    background: color-mix(in srgb, var(--pc) 16%, transparent);
    font-size: 10.5px;
    line-height: 1.5;
  }

  .tiny {
    padding: 1px 6px;
    font-size: 11px;
    line-height: 1.4;
  }

  .tiny.x {
    color: var(--text-dim);
    border: none;
    background: none;
  }

  .tiny.held {
    margin-left: 4px;
  }
</style>
