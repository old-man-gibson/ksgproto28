<script lang="ts">
  import { resolveRune } from '../../core/systems/runes';
  import { gs, game, ui, view } from '../state.svelte';
  import { MATERIALS, RARITIES, STATUSES } from '../../core/registry';
  import { itemDefOf } from '../../core/systems/assembly';
  import { QUALITY_TIERS, QUALITY_ORDER, qualityRank } from '../../core/data/quality.data';
  import type { StackRef } from '../../core/systems/equipment';
  import { RESOURCES } from '../../core/data/resources.data';
  import { consumableSpec, cooldownLeft, heldConsumables } from '../../core/systems/consumables';
  import { eatButton } from '../lib/meals';
  import { subsystemUnlocked } from '../../core/systems/unlocks';
  import {
    activeCoating,
    brewGrade,
    canUseFlask,
    flaskCooldownLeft,
    resolveBrew,
  } from '../../core/systems/alchemy';
  import { BREW_FORMS } from '../../core/data/alchemy.data';
  import { gradesHeld } from '../../core/systems/disciplines';
  import { runeSellPrice } from '../../core/systems/runes';
  import type { QualityTier, RarityId } from '../../core/types';
  import {
    DAMAGE_TYPE_NAMES,
    SLOT_NAMES,
    runeContextFor,
    type ItemInstance,
    type SlotId,
  } from '../../core/types';
  import {
    itemName,
    sellPrice,
    canEquip,
    materialSellPrice,
    gradedUnitPrice,
    HAND_SLOTS,
    WIELD_NAMES,
    allowedSlots,
    armsFrom,
    handTakenBy,
    isTelekinetic,
    wieldNote,
    wieldOf,
    wieldScale,
  } from '../../core/systems/equipment';
  import { bearerGrants } from '../../core/systems/mutagens';
  import { telekineticGrip } from '../../core/systems/combat';
  import {
    arrangeInventory,
    categoriesPresent,
    itemCategory,
    rarityAtMost,
    isMaxRarity,
    itemRarity,
    stackKey,
    SORT_LABELS,
    type ItemStack,
    type SortMode,
  } from '../../core/systems/inventory';
  import { describeMod, describeRuneEffect, fmt, pct, condsText } from '../lib/format';
  import Tip from '../lib/Tip.svelte';
  import Modal from '../lib/Modal.svelte';
  import CollectionSection, {
    type CollEntry,
    type TierChip,
  } from '../lib/CollectionSection.svelte';

  const grants = $derived(bearerGrants(gs));
  /**
   * The slots to draw. Hands are conditional: a body shows the arms it HAS,
   * plus any hand still holding something after those arms went away — so
   * shedding a gene can never strand a weapon somewhere unreachable.
   */
  const slots = $derived(
    (Object.keys(SLOT_NAMES) as SlotId[]).filter((s) => {
      const hand = HAND_SLOTS.indexOf(s);
      return hand < 0 || hand < armsFrom(grants) || !!gs.equipment[s];
    }),
  );
  const sortModes = Object.keys(SORT_LABELS) as SortMode[];

  /**
   * Every price row reads THIS number rather than calling into the stat block:
   * a hundred inventory rows then depend on one primitive, and reprice exactly
   * when charisma-flavoured gold gain changes instead of on every stat nudge.
   */
  const goldGain = $derived(view.stats.goldGain);

  /** Ghost glyphs for empty equipment slots. */
  const SLOT_ICONS: Record<SlotId, string> = {
    weapon: '⚔️',
    offhand: '🛡️',
    hand3: '🤚',
    hand4: '🤚',
    hand5: '🤚',
    hand6: '🤚',
    head: '🪖',
    chest: '🎽',
    hands: '🧤',
    legs: '👖',
    feet: '🥾',
    back: '🧥',
    accessory: '💍',
  };

  const materialStacks = $derived(Object.entries(gs.materials).filter(([, qty]) => qty > 0));

  /** Everything usable, best grade first. */
  const provisions = $derived(heldConsumables(gs));
  /** Runes ride the runecarving shutter: no runes, sockets or pips while it is shut. */
  const runesOpen = $derived(subsystemUnlocked(gs, 'runecarving'));

  /**
   * Flasks, grouped by the sequence that made them. Grouping by SEQUENCE rather
   * than by name is deliberate: two brews can read the same and be different
   * work, and the recipe is the identity of the thing.
   */
  const flaskGroups = $derived.by(() => {
    const groups: {
      key: string;
      index: number;
      qty: number;
      flask: (typeof gs.flasks)[number];
      spec: ReturnType<typeof resolveBrew>;
    }[] = [];
    (gs.flasks ?? []).forEach((flask, index) => {
      const key = flask.steps.map((s) => `${s.id}:${s.quality}`).join('>');
      const held = groups.find((g) => g.key === key);
      if (held) held.qty += 1;
      else groups.push({ key, index, qty: 1, flask, spec: resolveBrew(flask) });
    });
    return groups;
  });
  const flaskCooling = $derived(flaskCooldownLeft(gs));
  /** The oil on the blade actually in hand, if any. */
  const coated = $derived(activeCoating(gs));

  /**
   * What using one would do, in words. Instant effects are stated as the whole
   * amount; sustained ones name the condition and how long it runs, since that
   * is the difference a player actually needs to see before choosing.
   */
  /** A grade word for graded stock only: an ungraded card or salve has no "Fair". */
  function gradeWord(id: string, quality: QualityTier): string {
    return MATERIALS[id]?.graded ? `${QUALITY_TIERS[quality].name} ` : '';
  }

  function provisionTip(id: string, quality: QualityTier): string[] {
    const def = MATERIALS[id];
    const spec = consumableSpec(id);
    const grade = QUALITY_TIERS[quality];
    const lines = [`${def?.icon ?? '📦'} ${gradeWord(id, quality)}${def?.name ?? id}`];
    if (def?.desc) lines.push(def.desc);

    for (const r of spec?.restore ?? []) {
      const flat = (r.flat ?? 0) * grade.mult;
      const share = (r.ofMax ?? 0) * grade.mult;
      const parts = [flat ? fmt(flat) : '', share ? pct(share) + ' of max' : '']
        .filter(Boolean)
        .join(' + ');
      lines.push(`· Restores ${parts} ${RESOURCES[r.resource].name} at once`);
    }
    for (const g of spec?.grants ?? []) {
      const sdef = STATUSES[g.id];
      if (!sdef) continue;
      const secs = sdef.duration ? `${Math.round(sdef.duration / 10)}s` : 'until cured';
      lines.push(`· ${sdef.icon} ${sdef.name} for ${secs}`);
      for (const r of sdef.restores ?? []) {
        const per = ((r.flat ?? 0) + (r.ofMax ?? 0) * 100) * (g.intensity ?? 1) * grade.mult;
        if (per > 0) lines.push(`  ${RESOURCES[r.resource].name} restored steadily over that time`);
      }
      for (const m of sdef.mods ?? []) {
        lines.push(`  ${describeMod({ ...m, value: m.value * (g.intensity ?? 1) * grade.mult })}`);
      }
    }
    if (grade.mult < 0) lines.push('· Spoiled — this will do you harm');
    if (spec?.food) lines.push('· Eaten between fights. Pressed during a fight, it waits and is eaten when the fight ends.');
    const left = cooldownLeft(gs, id);
    if (left > 0) lines.push(`· Not ready for another ${(left / 10).toFixed(1)}s`);
    return lines;
  }
  /**
   * Everything the player could socket right now: catalogue runes from the
   * stackable pool AND runes they carved themselves. A carving is one of a
   * kind, so each is its own entry referenced by position in the carved pile —
   * which is why this is derived from live state rather than held anywhere.
   */
  const socketable = $derived([
    ...Object.entries(gs.runes)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ ref: id, rune: resolveRune(id), qty, carved: false })),
    ...(gs.carved ?? []).map((carving, i) => ({
      ref: `carved:${i}`,
      rune: resolveRune(carving),
      qty: 1,
      carved: true,
    })),
  ]);
  const invStacks = $derived(arrangeInventory(gs.inventory, ui.invSort, ui.invGroup));

  // ---------- Collection entries (runes, provisions, materials) ----------
  //
  // These three sections share one grid/select/housekeeping component; each
  // just maps its own data into CollEntry. Quality drives the housekeeping
  // axis, so anything graded (provisions, and the carvings among runes) can be
  // swept ≤ a grade, while ungraded things (catalogue runes, materials) are
  // still hand-selectable.
  const QUALITY_CHIPS: TierChip[] = QUALITY_ORDER.map((q) => ({
    rank: qualityRank(q),
    label: QUALITY_TIERS[q].name,
    color: QUALITY_TIERS[q].color,
  }));
  const QUALITY_WARN = qualityRank('c');

  /** A carved rune wears its stone's grade; a catalogue rune has none. */
  function runeTierRank(ref: string, carved: boolean): number | undefined {
    if (!carved) return undefined;
    const q = gs.carved?.[Number(ref.slice(7))]?.stone.quality;
    return q ? qualityRank(q) : undefined;
  }

  const runeEntries = $derived<CollEntry[]>(
    socketable.map((o) => {
      const rank = runeTierRank(o.ref, o.carved);
      return {
        key: o.ref,
        icon: o.rune.icon,
        label: `${o.rune.name}${o.qty > 1 ? ` ×${fmt(o.qty)}` : ''}`,
        qty: o.qty,
        value: runeSellPrice(gs, o.ref, goldGain) * o.qty,
        tierRank: rank,
        tint: rank != null ? QUALITY_TIERS[QUALITY_ORDER[rank]].color : 'var(--accent)',
      };
    }),
  );

  const provisionEntries = $derived<CollEntry[]>(
    provisions.map((p) => ({
      key: `${p.def.id}|${p.quality}`,
      icon: p.def.icon,
      label: `${gradeWord(p.def.id, p.quality)}${p.def.name} ×${fmt(p.qty)}`,
      qty: p.qty,
      value: gradedUnitPrice(gs, p.def.id, p.quality, goldGain) * p.qty,
      tierRank: qualityRank(p.quality),
      tint: QUALITY_TIERS[p.quality].color,
      dim: cooldownLeft(gs, p.def.id) > 0,
    })),
  );

  const materialEntries = $derived<CollEntry[]>(
    materialStacks.map(([id, qty]) => ({
      key: id,
      icon: MATERIALS[id]?.icon ?? '📦',
      label: `${MATERIALS[id]?.name ?? id} ×${fmt(qty)}`,
      qty,
      value: materialSellPrice(gs, id, goldGain) * qty,
    })),
  );

  /** Provision entry key ⇄ (id, quality). */
  function provRef(key: string): { id: string; quality: QualityTier } {
    const [id, quality] = key.split('|');
    return { id, quality: quality as QualityTier };
  }
  function provisionSel(key: string): Selection {
    const { id, quality } = provRef(key);
    return { kind: 'provision', id, quality };
  }

  // What the detail window is showing. Equipment cells carry their slot so the
  // window can offer Unequip instead of Equip.
  type Selection =
    | { kind: 'equipped'; slot: SlotId }
    | { kind: 'inventory'; uid: number; key: string }
    | { kind: 'rune'; id: string }
    | { kind: 'material'; id: string }
    | { kind: 'provision'; id: string; quality: QualityTier }
    | { kind: 'ingredients' }
    | { kind: 'slotPicker'; slot: SlotId };

  let selected = $state<Selection | null>(null);

  /**
   * The ingredients pouch: graded raw materials (herbs, gels, cuts) held in
   * stock. Finished dishes are graded too but show under Provisions, so they
   * are kept out here. Visible anywhere — no bench required to check the larder.
   */
  const ingredients = $derived(
    Object.keys(gs.stock ?? {})
      .map((id) => ({ def: MATERIALS[id], grades: gradesHeld(gs, id) }))
      .filter((e) => e.def && !e.def.consumable && e.grades.length > 0),
  );

  /**
   * The open window tracks the item it was opened on, not the stack it sat in,
   * because both can shift underneath it: socketing a rune moves that item into
   * a stack of its own (follow the uid), while selling one of a stack retires
   * that uid (fall back to the identical siblings).
   */
  const openStack = $derived.by(() => {
    if (selected?.kind !== 'inventory') return null;
    const { uid, key } = selected;
    return (
      invStacks.find((s) => s.items.some((i) => i.uid === uid)) ??
      invStacks.find((s) => stackKey(s.item) === key) ??
      null
    );
  });
  const openEquipped = $derived(
    selected?.kind === 'equipped' ? (gs.equipment[selected.slot] ?? null) : null,
  );

  $effect(() => {
    // Selling the last of a stack, or unequipping, leaves nothing to show.
    if (selected?.kind === 'inventory' && !openStack) selected = null;
    if (selected?.kind === 'equipped' && !openEquipped) selected = null;
    // A rune sold or dumped down to nothing (carved runes are one-of-a-kind).
    if (selected?.kind === 'rune') {
      const ref = selected.id;
      if (!socketable.some((o) => o.ref === ref)) selected = null;
    }
  });

  function rarityColor(item: ItemInstance): string {
    return RARITIES[itemRarity(item)]?.color ?? 'var(--border)';
  }

  // A cell's single click opens the window and its double click equips. The
  // browser sends click-click-dblclick, so the first click waits to see whether
  // a second one is coming, and the dblclick undoes any window it did open.
  let pending: ReturnType<typeof setTimeout> | null = null;

  function cellClick(open: () => void) {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      open();
    }, 260);
  }

  function cellDblClick(act: () => void) {
    if (pending) clearTimeout(pending);
    pending = null;
    selected = null;
    act();
  }

  function equipStack(stack: ItemStack, slot?: SlotId) {
    if (canEquip(gs, stack.item)) game.equip(stack.item.uid, slot);
  }

  /** Slots this piece could go into — more than one only for hand gear. */
  function equipTargets(item: ItemInstance): SlotId[] {
    return allowedSlots(itemDefOf(item), armsFrom(grants));
  }

  /** The other hand(s) an already-equipped piece could move to. */
  function otherHands(item: ItemInstance, worn: SlotId): SlotId[] {
    return equipTargets(item).filter((s) => s !== worn);
  }

  /** "(60%)" when a hand isn't where the piece belongs; '' at full effect. */
  function fitNote(item: ItemInstance, slot: SlotId): string {
    const scale = wieldScale(itemDefOf(item), slot);
    return scale < 1 ? ` (${Math.round(scale * 100)}%)` : '';
  }

  /** Moving hands is an unequip-and-equip: the piece goes via the pack. */
  function swapHand(item: ItemInstance, hand: SlotId) {
    const from = (Object.keys(gs.equipment) as SlotId[]).find(
      (s) => gs.equipment[s]?.uid === item.uid,
    );
    if (!from) return;
    game.unequip(from);
    game.equip(item.uid, hand);
    selected = { kind: 'equipped', slot: hand };
  }

  /**
   * Gear that can't roll any better is gone for good once sold, and the grid
   * makes it a one-click mistake. Everything else sells without ceremony.
   */
  function confirmSale(items: ItemInstance[]): boolean {
    const peak = items.filter(isMaxRarity);
    if (peak.length === 0) return true;
    const what = peak.length === 1 ? itemName(peak[0]) : `${peak.length} items`;
    return confirm(`${what} — max rune slots and a bonus, as good as it gets. Sell anyway?`);
  }

  function sell(items: ItemInstance[]) {
    if (!confirmSale(items)) return;
    game.sellMany(items.map((i) => i.uid));
  }

  function sellStack(stack: ItemStack, all: boolean) {
    sell(all ? [...stack.items] : [stack.item]);
  }

  /** Throwing something away is irreversible and pays nothing — always ask. */
  function confirmDump(what: string): boolean {
    return confirm(`Dump ${what}? Gone for good — no gold for it.`);
  }

  // ---------- Pouch housekeeping ----------
  //
  // Clear out the low grades in one go. A threshold picks everything at or
  // below a grade; below the warn line it acts at once (that IS the point of
  // quick housekeeping), but reaching above it — where the good stock lives —
  // always asks first, whether selling or dumping.
  const HOUSEKEEP_WARN: QualityTier = 'c';
  let keepGrade = $state<QualityTier | null>(null);

  /** Grades actually present in the pouch, worst → best, for the threshold picker. */
  const pouchGrades = $derived(
    QUALITY_ORDER.filter((q) => ingredients.some((ing) => ing.grades.some((g) => g.quality === q))),
  );

  /** Every (id, grade, qty) in the pouch at or below the chosen threshold. */
  const housekeepMatches = $derived.by(() => {
    if (!keepGrade) return [] as { id: string; quality: QualityTier; qty: number }[];
    const cap = qualityRank(keepGrade);
    return ingredients.flatMap((ing) =>
      ing.grades
        .filter((g) => qualityRank(g.quality) <= cap)
        .map((g) => ({ id: ing.def.id, quality: g.quality, qty: g.qty })),
    );
  });
  const housekeepUnits = $derived(housekeepMatches.reduce((s, e) => s + e.qty, 0));
  const housekeepValue = $derived(
    housekeepMatches.reduce((s, e) => s + gradedUnitPrice(gs, e.id, e.quality, goldGain) * e.qty, 0),
  );

  function housekeep(action: 'sell' | 'dump') {
    if (!keepGrade || housekeepMatches.length === 0) return;
    const refs: StackRef[] = housekeepMatches.map((e) => ({ id: e.id, quality: e.quality }));
    const reachesGood = qualityRank(keepGrade) > qualityRank(HOUSEKEEP_WARN);
    const upTo = QUALITY_TIERS[keepGrade].name;
    if (action === 'dump') {
      if (
        reachesGood &&
        !confirm(`Dump ${housekeepUnits} ingredients up to ${upTo} grade? Gone for good — no gold.`)
      )
        return;
      game.discardStackablesBatch(refs, 'ingredient');
    } else {
      if (
        reachesGood &&
        !confirm(`Sell ${housekeepUnits} ingredients up to ${upTo} grade for ${fmt(housekeepValue)} gold?`)
      )
        return;
      game.sellStackablesBatch(refs, 'ingredient');
    }
  }

  // ---------- Selection mode ----------
  //
  // Ticking items off in the grid and acting on the lot, instead of opening
  // every stack in turn. Selection is by uid but always whole stacks, since a
  // stack's members are interchangeable. Held loosely: uids that leave the
  // inventory are simply not found again, so nothing needs pruning.
  let selectMode = $state(false);
  let picked = $state(new Set<number>());

  const pickedItems = $derived(gs.inventory.filter((i) => picked.has(i.uid)));
  const pickedValue = $derived(pickedItems.reduce((sum, i) => sum + sellPrice(gs, i, goldGain), 0));

  function stackPicked(stack: ItemStack): boolean {
    return stack.items.every((i) => picked.has(i.uid));
  }

  function togglePick(stack: ItemStack) {
    const next = new Set(picked);
    const on = !stackPicked(stack);
    for (const item of stack.items) {
      if (on) next.add(item.uid);
      else next.delete(item.uid);
    }
    picked = next;
    // A hand edit means the selection no longer matches the chips — drop the
    // filter highlight so it never claims more than it holds.
    filterCats = new Set();
    filterRarity = null;
  }

  function setSelectMode(on: boolean) {
    selectMode = on;
    picked = new Set();
    filterCats = new Set();
    filterRarity = null;
    if (on) selected = null;
  }

  function pickAll() {
    filterCats = new Set();
    filterRarity = null;
    picked = new Set(gs.inventory.map((i) => i.uid));
  }

  function sellPicked() {
    const lot = [...pickedItems];
    if (!confirmSale(lot)) return;
    game.sellMany(lot.map((i) => i.uid));
    picked = new Set();
  }

  // Quick-select by filter, not by adding. Two axes narrow the selection
  // together — categories (OR within: swords OR daggers) AND a rarity ceiling.
  // Toggling any chip recomputes the whole selection from the active filters,
  // so "Swords" then "≤ Common" lands on swords that are common, not everything.
  const RARITY_ORDER: RarityId[] = ['common', 'uncommon', 'rare', 'epic'];
  const invCategories = $derived(categoriesPresent(gs.inventory));
  const invRarities = $derived(RARITY_ORDER.filter((r) => gs.inventory.some((i) => itemRarity(i) === r)));

  let filterCats = $state(new Set<string>());
  let filterRarity = $state<RarityId | null>(null);
  const filtersActive = $derived(filterCats.size > 0 || filterRarity !== null);

  function matchesFilters(i: ItemInstance): boolean {
    if (filterCats.size && !filterCats.has(itemCategory(i).key)) return false;
    if (filterRarity && !rarityAtMost(i, filterRarity)) return false;
    return true;
  }

  /** Recompute the selection to exactly what the active filters admit. */
  function syncFilterSelection() {
    picked = filtersActive
      ? new Set(gs.inventory.filter(matchesFilters).map((i) => i.uid))
      : new Set();
  }

  function toggleCat(key: string) {
    const next = new Set(filterCats);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    filterCats = next;
    syncFilterSelection();
  }

  function toggleRarity(r: RarityId) {
    filterRarity = filterRarity === r ? null : r;
    syncFilterSelection();
  }

  function clearFilters() {
    filterCats = new Set();
    filterRarity = null;
    picked = new Set();
  }

  // ---------- Empty-slot picker ----------
  //
  // Clicking a bare slot offers what could go there. Everything that fits the
  // slot is listed; pieces whose requirements aren't met come along but can't
  // be chosen, so you can see what you're working toward.
  function slotCandidates(slot: SlotId): ItemStack[] {
    return invStacks.filter((s) => equipTargets(s.item).includes(slot));
  }

  function equipInto(item: ItemInstance, slot: SlotId) {
    if (!canEquip(gs, item)) return;
    game.equip(item.uid, slot);
    selected = { kind: 'equipped', slot };
  }

  // ---------- Provisions ----------
  const provisionQty = $derived.by(() => {
    const sel = selected;
    if (sel?.kind !== 'provision') return 0;
    const p = provisions.find((x) => x.def.id === sel.id && x.quality === sel.quality);
    return p?.qty ?? 0;
  });

  $effect(() => {
    // Using or dumping the last of a provision leaves nothing to show.
    if (selected?.kind === 'provision' && provisionQty === 0) selected = null;
    // Forget the housekeeping threshold once the pouch is closed.
    if (selected?.kind !== 'ingredients' && keepGrade !== null) keepGrade = null;
  });
</script>

{#snippet itemTip(item: ItemInstance, count = 1)}
  {@const def = itemDefOf(item)}
  {@const context = runeContextFor(def.slot)}
  {@const empty = (item.slots ?? 0) - (item.runes?.length ?? 0)}
  <div class="tip-line tip-base">
    {def.icon}
    {itemName(item)}{count > 1 ? ` ×${count}` : ''} — {SLOT_NAMES[def.slot]}
    {#if HAND_SLOTS.includes(def.slot)}· {WIELD_NAMES[wieldOf(def)]}{/if}
  </div>
  {#if def.desc}<div class="tip-line tip-sub">{def.desc}</div>{/if}
  {#if wieldOf(def) === 'two_handed'}
    <div class="tip-line tip-sub">Fills both hands — nothing may be held alongside it.</div>
  {/if}
  {#if def.mainHand}
    <div class="tip-line">🤜 Main hand — {def.mainHand.desc}</div>
  {/if}
  {#if def.offHand}
    <div class="tip-line">🤛 Off hand — {def.offHand.desc}</div>
  {/if}
  {#each def.mods as mod}<div class="tip-line">{describeMod(mod)}</div>{/each}
  {#if item.affix}
    {#each item.affix.mods as mod}
      <div class="tip-line">{describeMod(mod)} — {item.affix.name}</div>
    {/each}
  {/if}
  {#if def.bonusDamage}
    <div class="tip-line">
      on hit: +{fmt(def.bonusDamage.value)} {DAMAGE_TYPE_NAMES[def.bonusDamage.type]}
    </div>
  {/if}
  {#each item.runes ?? [] as ref}
    {@const rune = resolveRune(ref)}
    <div class="tip-line">
      {rune.icon} {rune.name}: {describeRuneEffect(rune.effects[context])}
    </div>
  {/each}
  {#if runesOpen && empty > 0}
    <div class="tip-line tip-sub">{empty} empty rune slot{empty > 1 ? 's' : ''}</div>
  {/if}
  {#if def.requirements?.length}
    <div class="tip-line tip-sub">Requires {condsText(def.requirements)}</div>
  {/if}
  <div class="tip-line tip-total">Sells for {fmt(sellPrice(gs, item, goldGain))} 🪙</div>
{/snippet}

<!--
  One grid tile: icon, rune pips, and optional stack-count / lock badges.
  `mark` is null outside selection mode; inside it, the tile ticks on the first
  click rather than waiting to see whether a double-click is coming.
-->
{#snippet cell(
  item: ItemInstance,
  count: number,
  locked: boolean,
  mark: boolean | null,
  onopen: () => void,
  ontoggle: () => void,
)}
  {@const def = itemDefOf(item)}
  {@const peak = isMaxRarity(item)}
  <Tip block>
    <button
      class="cell"
      class:locked
      class:peak
      class:marked={mark}
      aria-label="{itemName(item)}{count > 1 ? ` ×${count}` : ''}"
      aria-pressed={mark ?? undefined}
      style="--rar: {rarityColor(item)}"
      onclick={() => (mark === null ? cellClick(onopen) : onopen())}
      ondblclick={() => mark === null && cellDblClick(ontoggle)}
    >
      <span class="icon">{def.icon}</span>
      <!-- A solid star marks gear that cannot roll better — the sale it guards. -->
      {#if item.affix}<span class="star">{peak ? '★' : '✦'}</span>{/if}
      <!-- The tick takes over the lock's corner; requirements don't matter to a bulk sale. -->
      {#if mark}<span class="tick">✓</span>{:else if locked}<span class="lock">🔒</span>{/if}
      {#if count > 1}<span class="count">{count}</span>{/if}
      {#if runesOpen && (item.slots ?? 0) > 0}
        <span class="pips">
          {#each { length: item.slots ?? 0 } as _, i (i)}
            <span class="pip" class:filled={i < (item.runes?.length ?? 0)}></span>
          {/each}
        </span>
      {/if}
    </button>
    {#snippet tip()}{@render itemTip(item, count)}{/snippet}
  </Tip>
{/snippet}

<!-- Rune sockets, editable. Used inside the detail window. -->
{#snippet sockets(item: ItemInstance)}
  {@const def = itemDefOf(item)}
  {@const context = runeContextFor(def.slot)}
  {@const socketed = item.runes ?? []}
  {#if runesOpen && (item.slots ?? 0) > 0}
    <div class="win-section">
      <div class="small dim">Rune slots</div>
      {#each socketed as ref, i (i)}
        {@const rune = resolveRune(ref)}
        <div class="socket filled">
          <span>{rune.icon} {rune.name}</span>
          <span class="small">{describeRuneEffect(rune.effects[context])}</span>
          <button class="small" onclick={() => game.unsocketRune(item.uid, i)}>Remove</button>
        </div>
      {/each}
      {#each { length: (item.slots ?? 0) - socketed.length } as _, i (i)}
        <select
          class="socket-select"
          disabled={socketable.length === 0}
          title={socketable.length === 0
            ? 'No runes owned — monsters drop them, and you can carve your own'
            : 'Socket a rune'}
          onchange={(e) => {
            const picked = e.currentTarget.value;
            e.currentTarget.value = '';
            if (picked) game.socketRune(item.uid, picked);
          }}
        >
          <option value="">◇ empty rune slot</option>
          {#each socketable as opt (opt.ref)}
            <option value={opt.ref}>
              {opt.rune.icon} {opt.rune.name}{opt.qty > 1 ? ` ×${opt.qty}` : ''} → {describeRuneEffect(
                opt.rune.effects[context],
              )}
            </option>
          {/each}
        </select>
      {/each}
    </div>
  {/if}
{/snippet}

<!-- Shared body of the item window: identity, mods, requirements, sockets. -->
{#snippet itemDetail(item: ItemInstance, worn: SlotId | null = null)}
  {@const def = itemDefOf(item)}
  {#if def.desc}<p class="small dim desc">{def.desc}</p>{/if}
  {#if HAND_SLOTS.includes(def.slot)}
    <div class="small dim wield">
      {WIELD_NAMES[wieldOf(def)]}{wieldOf(def) === 'two_handed' ? ' — fills both hands' : ''}
      {#if worn && wieldNote(def, worn)}
        <span class="misfit">· {wieldNote(def, worn)}</span>
      {/if}
    </div>
    {#if worn && isTelekinetic(grants, worn)}
      <div class="small wield floating">
        🌀 Not held — it hangs in the air and strikes on its own. No guard, no footwork, no
        riposte; it rolls to hit, and its own edge, enchant and runes are what land, amplified
        ×{telekineticGrip(gs).toFixed(2)} by the mind holding it (Wisdom).
      </div>
    {/if}
  {/if}
  {#if def.mainHand}<div class="mod hand">🤜 Main hand — {def.mainHand.desc}</div>{/if}
  {#if def.offHand}<div class="mod hand">🤛 Off hand — {def.offHand.desc}</div>{/if}
  <div class="win-section">
    {#each def.mods as mod}<div class="mod">{describeMod(mod)}</div>{/each}
    {#if item.affix}
      {#each item.affix.mods as mod}
        <div class="mod affix">{describeMod(mod)} — {item.affix.name}</div>
      {/each}
    {/if}
    {#if def.bonusDamage}
      <div class="mod">
        on hit: +{fmt(def.bonusDamage.value)} {DAMAGE_TYPE_NAMES[def.bonusDamage.type]}
      </div>
    {/if}
    {#if def.mods.length === 0 && !item.affix && !def.bonusDamage}
      <div class="small dim">No stat bonuses.</div>
    {/if}
  </div>
  {#if def.requirements?.length}
    <div class="small reqs" class:met={canEquip(gs, item)}>
      {canEquip(gs, item) ? '✔' : '🔒'} Requires {condsText(def.requirements)}
    </div>
  {/if}
  {@render sockets(item)}
{/snippet}

{#snippet itemTitle(item: ItemInstance, count: number)}
  {@const def = itemDefOf(item)}
  <div class="win-title" style="color: {rarityColor(item)}">
    {def.icon}
    {itemName(item)}{count > 1 ? ` ×${count}` : ''}
  </div>
  <div class="small dim">
    {RARITIES[itemRarity(item)]?.name || 'Common'} · {SLOT_NAMES[def.slot]} · {fmt(sellPrice(gs, item, goldGain))} 🪙{isMaxRarity(
      item,
    )
      ? ' · ★ maxed'
      : ''}
  </div>
{/snippet}

<!-- Tooltips for the shared collection sections. -->
{#snippet runeEntryTip(e: CollEntry)}
  {@const rune = resolveRune(e.key)}
  {@const carved = e.key.startsWith('carved:')}
  <div class="tip-line tip-base">{rune.icon} {rune.name}{e.qty > 1 ? ` ×${fmt(e.qty)}` : ''}</div>
  {#if carved}<div class="tip-line tip-sub">Carved by you</div>{/if}
  {#if rune.desc}<div class="tip-line tip-sub">{rune.desc}</div>{/if}
  <div class="tip-line">⚔️ {describeRuneEffect(rune.effects.weapon)}</div>
  <div class="tip-line">🛡️ {describeRuneEffect(rune.effects.armor)}</div>
  <div class="tip-line">💍 {describeRuneEffect(rune.effects.accessory)}</div>
  <div class="tip-line tip-total">Sells for {fmt(e.value)} 🪙</div>
{/snippet}

{#snippet provisionEntryTip(e: CollEntry)}
  {@const p = provRef(e.key)}
  {#each provisionTip(p.id, p.quality) as line, i}
    <div class="tip-line" class:tip-base={i === 0} class:tip-sub={line.startsWith('·')}>{line}</div>
  {/each}
  <div class="tip-line tip-sub">Click to inspect · double-click to use</div>
{/snippet}

{#snippet materialEntryTip(e: CollEntry)}
  {@const def = MATERIALS[e.key]}
  <div class="tip-line tip-base">{def?.icon ?? '📦'} {def?.name ?? e.key} ×{fmt(e.qty)}</div>
  {#if def?.desc}<div class="tip-line tip-sub">{def.desc}</div>{/if}
  <div class="tip-line tip-total">Stack sells for {fmt(e.value)} 🪙</div>
{/snippet}

<div class="panel">
  <h2>🎒 Equipment</h2>
  <p class="small dim hint">
    Hover for details, click to open, double-click to equip or unequip. Use ☑ Select below to act
    on several at once.
  </p>
  <div class="grid">
    {#each slots as slot (slot)}
      {@const item = gs.equipment[slot]}
      {#if item}
        {@render cell(item, 1, false, null, () => (selected = { kind: 'equipped', slot }), () =>
          game.unequip(slot),
        )}
      {:else}
        {@const twoHander = handTakenBy(gs, grants, slot)}
        {@const fits = twoHander ? 0 : slotCandidates(slot).length}
        {@const floats = isTelekinetic(grants, slot)}
        <Tip block>
          <button
            class="cell empty"
            class:blocked={!!twoHander}
            class:floats
            disabled={!!twoHander}
            aria-label="{SLOT_NAMES[slot]} — empty"
            onclick={() => (selected = { kind: 'slotPicker', slot })}
          >
            <span class="icon">{twoHander ? '🚫' : floats ? '🌀' : SLOT_ICONS[slot]}</span>
            {#if fits > 0}<span class="count">{fits}</span>{/if}
          </button>
          {#snippet tip()}
            <div class="tip-line tip-base">{SLOT_NAMES[slot]}</div>
            {#if floats}
              <div class="tip-line tip-sub">
                🌀 Floating weapon slot — a weapon here attacks on its own timer, and your action bar
                is free for something else. Wisdom sets the multiplier: ×{telekineticGrip(
                  gs,
                ).toFixed(2)} on what it lands.
              </div>
            {/if}
            {#if twoHander}
              <div class="tip-line tip-sub">
                Taken by {itemDefOf(twoHander)?.name} — it needs both hands.
              </div>
            {:else if fits > 0}
              <div class="tip-line tip-sub">Empty — {fits} piece{fits > 1 ? 's' : ''} fit. Click to equip.</div>
            {:else}
              <div class="tip-line tip-sub">Empty — nothing in the pack fits.</div>
            {/if}
          {/snippet}
        </Tip>
      {/if}
    {/each}
  </div>
</div>

<div class="panel" style="margin-top: 12px">
  <h3>Inventory <span class="dim small">({gs.inventory.length})</span></h3>
  {#if gs.inventory.length === 0}
    <p class="dim">Nothing in the pack. Monsters drop equipment; exploring turns up the odd coin.</p>
  {:else}
    <div class="toolbar small">
      <span class="dim">Sort</span>
      {#each sortModes as mode (mode)}
        <button
          class="small"
          class:selected={ui.invSort === mode}
          onclick={() => (ui.invSort = mode)}
        >
          {SORT_LABELS[mode]}
        </button>
      {/each}
      <button
        class="small group"
        class:selected={ui.invGroup}
        onclick={() => (ui.invGroup = !ui.invGroup)}
      >
        ⧉ Group duplicates
      </button>
      <button class="small" class:selected={selectMode} onclick={() => setSelectMode(!selectMode)}>
        ☑ Select
      </button>
    </div>
    {#if selectMode}
      <div class="toolbar select-bar small">
        <span class:dim={pickedItems.length === 0}>
          {pickedItems.length} selected · {fmt(pickedValue)} 🪙
        </span>
        <button class="small" onclick={pickAll}>All</button>
        <button
          class="small"
          disabled={pickedItems.length === 0 && !filtersActive}
          onclick={clearFilters}
        >
          Clear
        </button>
        <button class="small danger" disabled={pickedItems.length === 0} onclick={sellPicked}>
          Sell {pickedItems.length} ({fmt(pickedValue)} 🪙)
        </button>
        <button class="small done" onclick={() => setSelectMode(false)}>Done</button>
      </div>
      <!--
        Filter chips narrow the selection together: categories OR each other,
        then AND the rarity ceiling. Toggling any one recomputes the selection.
      -->
      <div class="toolbar chips small">
        <span class="dim">Filter</span>
        {#each invCategories as cat (cat.key)}
          <button
            class="small chip"
            class:selected={filterCats.has(cat.key)}
            onclick={() => toggleCat(cat.key)}
          >
            {cat.label}
          </button>
        {/each}
        {#if invRarities.length}<span class="chip-sep"></span>{/if}
        {#each invRarities as r (r)}
          <button
            class="small chip rar"
            class:selected={filterRarity === r}
            style="--rar: {RARITIES[r]?.color}"
            onclick={() => toggleRarity(r)}
          >
            ≤ {RARITIES[r]?.name || 'Common'}
          </button>
        {/each}
      </div>
    {/if}
    <div class="grid">
      {#each invStacks as stack (stack.key)}
        {@render cell(
          stack.item,
          stack.items.length,
          !canEquip(gs, stack.item),
          selectMode ? stackPicked(stack) : null,
          () =>
            selectMode
              ? togglePick(stack)
              : (selected = { kind: 'inventory', uid: stack.item.uid, key: stackKey(stack.item) }),
          () => equipStack(stack),
        )}
      {/each}
    </div>
  {/if}
</div>

{#if runesOpen}
<CollectionSection
  title="🔮 Runes"
  entries={runeEntries}
  noun="rune"
  empty="Runes socket into equipment rune slots — the same rune grants different powers in a weapon, armor, or an accessory. Monsters occasionally drop them, and a carving bench makes your own."
  hint="Only your carvings carry a grade; catalogue runes have none."
  tiers={QUALITY_CHIPS}
  warnRank={QUALITY_WARN}
  entryTip={runeEntryTip}
  onOpen={(key) => (selected = { kind: 'rune', id: key })}
  onSell={(keys) => game.sellRunesBatch(keys)}
  onDump={(keys) => game.discardRunesBatch(keys)}
/>
{/if}

<CollectionSection
  title="🍽️ Provisions"
  entries={provisionEntries}
  noun="provision"
  empty="Food, potions and salves live here. Cook at a bench, or find them out in the world."
  hint="Click to inspect, double-click to use."
  tiers={QUALITY_CHIPS}
  warnRank={QUALITY_WARN}
  entryTip={provisionEntryTip}
  onOpen={(key) => (selected = provisionSel(key))}
  onPrimary={(key) => { const p = provRef(key); game.eat(p.id, p.quality); }}
  onSell={(keys) => game.sellStackablesBatch(keys.map(provRef), 'provision')}
  onDump={(keys) => game.discardStackablesBatch(keys.map(provRef), 'provision')}
>
  {#snippet headerExtra()}
    {#if ingredients.length > 0}
      <button class="small" onclick={() => (selected = { kind: 'ingredients' })}>
        🧺 Ingredients ({ingredients.length})
      </button>
    {/if}
  {/snippet}
</CollectionSection>

<!--
  The satchel. Flasks are not stackable stock: each one remembers the sequence
  that made it, so identical sequences are grouped here rather than merged, and
  the tooltip can always show the recipe. Which button you get is decided by the
  brew, not by you — a bomb has no drink option.
-->
{#if flaskGroups.length > 0 || coated}
  <div class="panel satchel">
    <h3>⚗️ Satchel</h3>
    <div class="small dim">
      Flasks and Fumes are thrown and need a fight. Elixirs, Draughts, Salves and Oils work anywhere. One shared cooldown.
      {#if flaskCooling > 0}· ready in {(flaskCooling / 10).toFixed(1)}s{/if}
    </div>
    {#if coated}
      <!-- An oil is spent state, not stock: it lives on the blade and is
           measured in blows, so it gets its own line rather than a flask card. -->
      <div class="coated small">
        🛢️ Weapon oil: <b>{coated.spec.name}</b>, {coated.coat.blowsLeft} blow{coated.coat.blowsLeft === 1 ? '' : 's'} left
      </div>
    {/if}
    <div class="flasks">
      {#each flaskGroups as g (g.key)}
        {@const can = canUseFlask(gs, g.index)}
        <Tip>
          <div class="flask" style="--tint: {QUALITY_TIERS[brewGrade(g.spec)].color}">
            <span class="flask-icon">{g.spec.icon}</span>
            <span class="flask-name">{g.spec.name}{g.qty > 1 ? ` ×${g.qty}` : ''}</span>
            <button class="small" disabled={!can.ok} onclick={() => game.useFlask(g.index)}>
              {BREW_FORMS[g.spec.form].verb}
            </button>
          </div>
          {#snippet tip()}
            <div class="tip-line tip-base">{g.spec.icon} {g.spec.name}</div>
            <div class="tip-line tip-sub">
              {g.flask.steps.map((s) => MATERIALS[s.id]?.name ?? s.id).join(' → ')}
            </div>
            <div class="tip-line">{BREW_FORMS[g.spec.form].desc}</div>
            {#each g.spec.strikes as s}
              <div class="tip-line">💥 {Math.round(s.power)} {s.type}</div>
            {/each}
            {#each g.spec.restore as r}
              <div class="tip-line">💚 restores {Math.round(r.amount)} {r.resource}</div>
            {/each}
            {#each g.spec.grants as gr}
              <div class="tip-line">
                ✨ {STATUSES[gr.id]?.name ?? gr.id} for {((gr.duration as number) / 10).toFixed(0)}s
              </div>
            {/each}
            {#each g.spec.inflicts as inf}
              <div class="tip-line">☠️ inflicts {STATUSES[inf.id]?.name ?? inf.id}</div>
            {/each}
            {#each g.spec.cures as c}<div class="tip-line">🩹 clears {c}</div>{/each}
            {#if !can.ok}<div class="tip-line tip-sub">🔒 {can.reason}</div>{/if}
          {/snippet}
        </Tip>
      {/each}
    </div>
  </div>
{/if}

<CollectionSection
  title="Materials"
  entries={materialEntries}
  noun="material"
  empty="Monster parts, herbs, lumber — anything you gather or skin piles up here."
  canDump={false}
  entryTip={materialEntryTip}
  onOpen={(key) => (selected = { kind: 'material', id: key })}
  onSell={(keys) => game.sellStackablesBatch(keys.map((id) => ({ id, quality: 'c' as QualityTier })), 'material')}
/>

{#if selected?.kind === 'equipped' && openEquipped}
  {@const item = openEquipped}
  {@const slot = selected.slot}
  <Modal onclose={() => (selected = null)}>
    {#snippet title()}{@render itemTitle(item, 1)}{/snippet}
    {@render itemDetail(item, slot)}
    <div class="win-buttons">
      <button onclick={() => game.unequip(slot)}>Unequip</button>
      {#each otherHands(item, slot) as hand}
        <button onclick={() => swapHand(item, hand)}>
          Move to {hand === 'weapon' ? 'main hand' : 'off hand'}{fitNote(item, hand)}
        </button>
      {/each}
    </div>
  </Modal>
{:else if selected?.kind === 'inventory' && openStack}
  {@const stack = openStack}
  <Modal onclose={() => (selected = null)}>
    {#snippet title()}{@render itemTitle(stack.item, stack.items.length)}{/snippet}
    {@render itemDetail(stack.item)}
    <div class="win-buttons">
      {#each equipTargets(stack.item) as hand, i}
        <button disabled={!canEquip(gs, stack.item)} onclick={() => equipStack(stack, hand)}>
          {i === 0 && equipTargets(stack.item).length === 1
            ? 'Equip'
            : `Equip · ${hand === 'weapon' ? 'main hand' : 'off hand'}`}{fitNote(stack.item, hand)}
        </button>
      {/each}
      <button onclick={() => sellStack(stack, false)}>
        Sell ({fmt(sellPrice(gs, stack.item, goldGain))} 🪙)
      </button>
      {#if stack.items.length > 1}
        <button onclick={() => sellStack(stack, true)}>
          Sell all ×{stack.items.length}
        </button>
      {/if}
    </div>
  </Modal>
{:else if selected?.kind === 'rune'}
  {@const ref = selected.id}
  {@const entry = socketable.find((o) => o.ref === ref)}
  {@const rune = entry?.rune ?? resolveRune(ref)}
  <Modal onclose={() => (selected = null)}>
    {#snippet title()}
      <div class="win-title">{rune.icon} {rune.name}</div>
      <div class="small dim">
        {entry?.carved ? 'carved by you' : `×${fmt(entry?.qty ?? 0)} held`}
      </div>
    {/snippet}
    {#if rune.desc}<p class="small dim desc">{rune.desc}</p>{/if}
    <div class="win-section">
      <div class="mod">⚔️ In a weapon: {describeRuneEffect(rune.effects.weapon)}</div>
      <div class="mod">🛡️ In armor: {describeRuneEffect(rune.effects.armor)}</div>
      <div class="mod">💍 In an accessory: {describeRuneEffect(rune.effects.accessory)}</div>
    </div>
    <p class="small dim">Open a piece of gear with empty rune slots to socket this.</p>
    <div class="win-buttons">
      <button onclick={() => game.sellRune(ref)}>Sell ({fmt(runeSellPrice(gs, ref, goldGain))} 🪙)</button>
      <button class="ghost" onclick={() => confirmDump(rune.name) && game.discardRune(ref)}>
        Discard
      </button>
    </div>
  </Modal>
{:else if selected?.kind === 'material'}
  {@const id = selected.id}
  {@const def = MATERIALS[id]}
  {@const qty = gs.materials[id] ?? 0}
  <Modal onclose={() => (selected = null)}>
    {#snippet title()}
      <div class="win-title">{def?.icon ?? '📦'} {def?.name ?? id}</div>
      <div class="small dim">×{fmt(qty)} · {fmt(materialSellPrice(gs, id, goldGain))} 🪙 each</div>
    {/snippet}
    {#if def?.desc}<p class="small dim desc">{def.desc}</p>{/if}
    <div class="win-buttons">
      <button onclick={() => { game.sellMaterial(id); selected = null; }}>
        Sell all ({fmt(materialSellPrice(gs, id, goldGain) * qty)} 🪙)
      </button>
    </div>
  </Modal>
{:else if selected?.kind === 'provision'}
  {@const id = selected.id}
  {@const quality = selected.quality}
  {@const def = MATERIALS[id]}
  {@const eating = eatButton(gs, id, quality)}
  <Modal onclose={() => (selected = null)}>
    {#snippet title()}
      <div class="win-title" style="color: {QUALITY_TIERS[quality].color}">
        {def?.icon ?? '🍽️'} {gradeWord(id, quality)}{def?.name ?? id}
      </div>
      <div class="small dim">×{fmt(provisionQty)} held · {fmt(gradedUnitPrice(gs, id, quality, goldGain))} 🪙 each</div>
    {/snippet}
    <div class="win-section">
      {#each provisionTip(id, quality).slice(1) as line}
        <div class="small" class:dim={line.startsWith('·')}>{line}</div>
      {/each}
    </div>
    <div class="win-buttons">
      <!-- A dish pressed in a fight waits for its end. The tooltip says what the
           press will do, and which dish a fourth one replaces. -->
      {#snippet eatPress()}
        <button
          disabled={eating.disabled}
          onclick={() => (eating.cancels ? game.cancelQueuedMeal() : game.eat(id, quality))}
        >
          {eating.label}
        </button>
      {/snippet}
      {#if eating.tip.length > 0}
        <Tip block>
          {@render eatPress()}
          {#snippet tip()}
            {#each eating.tip as line}<div class="tip-line">{line}</div>{/each}
          {/snippet}
        </Tip>
      {:else}
        {@render eatPress()}
      {/if}
      <button onclick={() => game.sellStackable(id, quality, 1)}>
        Sell ({fmt(gradedUnitPrice(gs, id, quality, goldGain))} 🪙)
      </button>
      {#if provisionQty > 1}
        <button onclick={() => game.sellStackable(id, quality, provisionQty)}>
          Sell all ×{fmt(provisionQty)}
        </button>
      {/if}
      <button
        class="ghost"
        onclick={() =>
          confirmDump(`${QUALITY_TIERS[quality].name} ${def?.name ?? id}`) &&
          game.discardStackable(id, quality, 1)}
      >
        Discard
      </button>
    </div>
    {#if eating.replaces}
      <div class="small dim">{eating.replaces}.</div>
    {/if}
  </Modal>
{:else if selected?.kind === 'ingredients'}
  <Modal wide onclose={() => (selected = null)}>
    {#snippet title()}
      <div class="win-title">🧺 Ingredients Pouch</div>
      <div class="small dim">Raw stock for cooking and crafting, best grade first.</div>
    {/snippet}
    {#if ingredients.length === 0}
      <p class="small dim">Empty. Forage, skin and gather to fill it.</p>
    {:else}
      <!-- Bulk housekeeping: clear everything up to a chosen grade at once. -->
      <div class="housekeep">
        <span class="dim">Everything up to</span>
        {#each pouchGrades as q (q)}
          <button
            class="small chip"
            class:selected={keepGrade === q}
            style="--rar: {QUALITY_TIERS[q].color}"
            onclick={() => (keepGrade = keepGrade === q ? null : q)}
          >
            {QUALITY_TIERS[q].name}
          </button>
        {/each}
        {#if keepGrade}
          <span class="hk-count">
            {fmt(housekeepUnits)} · {fmt(housekeepValue)} 🪙
            {#if qualityRank(keepGrade) > qualityRank(HOUSEKEEP_WARN)}<span class="hk-warn">⚠ good stock</span>{/if}
          </span>
          <button class="small" disabled={housekeepUnits === 0} onclick={() => housekeep('sell')}>
            Sell ≤ {QUALITY_TIERS[keepGrade].name}
          </button>
          <button class="small ghost" disabled={housekeepUnits === 0} onclick={() => housekeep('dump')}>
            Dump ≤ {QUALITY_TIERS[keepGrade].name}
          </button>
        {/if}
      </div>
      <div class="pouch-grid">
        {#each ingredients as ing (ing.def.id)}
          <div class="pouch-item">
            <div class="pouch-name">
              <span class="icon-sm">{ing.def.icon}</span> {ing.def.name}
            </div>
            {#if ing.def.desc}<div class="small dim ellip">{ing.def.desc}</div>{/if}
            <div class="grade-rows">
              {#each ing.grades as g (g.quality)}
                <div class="grade-row small" style="--tint: {QUALITY_TIERS[g.quality].color}">
                  <span class="grade-name">{QUALITY_TIERS[g.quality].name}</span>
                  <span class="dim">×{fmt(g.qty)}</span>
                  <span class="spacer"></span>
                  <button class="small" onclick={() => game.sellStackable(ing.def.id, g.quality, g.qty)}>
                    Sell ({fmt(gradedUnitPrice(gs, ing.def.id, g.quality, goldGain) * g.qty)} 🪙)
                  </button>
                  <button
                    class="small ghost"
                    onclick={() =>
                      confirmDump(`${fmt(g.qty)}× ${QUALITY_TIERS[g.quality].name} ${ing.def.name}`) &&
                      game.discardStackable(ing.def.id, g.quality, g.qty)}
                  >
                    Dump
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </Modal>
{:else if selected?.kind === 'slotPicker'}
  {@const slot = selected.slot}
  {@const candidates = slotCandidates(slot)}
  <Modal onclose={() => (selected = null)}>
    {#snippet title()}
      <div class="win-title">{SLOT_ICONS[slot]} Equip — {SLOT_NAMES[slot]}</div>
      <div class="small dim">
        {candidates.length === 0 ? 'Nothing in the pack fits here' : `${candidates.length} piece${candidates.length > 1 ? 's' : ''} fit`}
      </div>
    {/snippet}
    {#if candidates.length === 0}
      <p class="small dim">Loot, buy or craft something for this slot.</p>
    {:else}
      <div class="pick-list">
        {#each candidates as s (s.key)}
          {@const d = itemDefOf(s.item)}
          {@const ok = canEquip(gs, s.item)}
          <button class="pick" disabled={!ok} onclick={() => equipInto(s.item, slot)}>
            <span class="icon-sm" style="color: {rarityColor(s.item)}">{d.icon}</span>
            <span class="pick-name">
              {itemName(s.item)}{s.items.length > 1 ? ` ×${s.items.length}` : ''}{fitNote(s.item, slot)}
            </span>
            <span class="pick-mods small dim">
              {#each d.mods.slice(0, 2) as mod}{describeMod(mod)} {/each}
              {#if s.item.affix}<span class="affix">✦{s.item.affix.name}</span>{/if}
            </span>
            {#if !ok}<span class="small reqs">🔒</span>{/if}
          </button>
        {/each}
      </div>
    {/if}
  </Modal>
{/if}

<style>
  .hint {
    margin: -4px 0 10px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    gap: 8px;
  }

  /* Tip wraps every cell; keep the wrapper transparent to the grid. */
  .grid > :global(.tip-target) {
    display: block;
    border-bottom: none;
  }

  .cell {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border-radius: 8px;
    border: 1px solid var(--rar, var(--border));
    background: var(--bg-raised);
    cursor: pointer;
  }

  .cell:hover {
    background: var(--bg-hover);
  }

  .cell.locked {
    opacity: 0.65;
  }

  .cell.marked {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 18%, var(--bg-raised));
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .tick {
    position: absolute;
    top: 0;
    left: 3px;
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
  }

  .wield {
    margin: 0 0 6px;
  }

  .misfit {
    color: var(--danger);
  }

  .mod.hand {
    color: var(--accent);
  }

  .wield.floating {
    color: var(--accent);
  }

  .cell.empty.blocked {
    opacity: 0.4;
  }

  .cell.empty.floats {
    border-style: dotted;
    border-color: var(--accent);
  }

  .cell.empty {
    border-style: dashed;
  }

  .cell.empty:disabled {
    cursor: default;
  }

  .cell.empty .icon {
    opacity: 0.28;
    filter: grayscale(1);
  }

  .icon {
    font-size: 24px;
    line-height: 1;
  }

  .count {
    position: absolute;
    right: 2px;
    bottom: 2px;
    font-size: 10.5px;
    font-weight: 600;
    line-height: 1;
    padding: 1px 3px;
    border-radius: 4px;
    background: rgb(0 0 0 / 60%);
    color: var(--text);
  }

  .star {
    position: absolute;
    top: 1px;
    right: 3px;
    font-size: 9px;
    color: var(--accent);
  }

  .cell.peak .star {
    font-size: 11px;
    text-shadow: 0 0 5px var(--accent);
  }

  .lock {
    position: absolute;
    top: 1px;
    left: 2px;
    font-size: 9px;
  }

  .pips {
    position: absolute;
    left: 3px;
    bottom: 3px;
    display: flex;
    gap: 2px;
  }

  .pip {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    border: 1px solid var(--accent);
  }

  .pip.filled {
    background: var(--accent);
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    margin-bottom: 10px;
  }

  .toolbar button {
    padding: 3px 8px;
  }

  .toolbar .group {
    margin-left: auto;
  }

  .select-bar {
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 6px 8px;
    background: color-mix(in srgb, var(--accent) 7%, transparent);
  }

  .select-bar .danger {
    border-color: #5d3030;
    color: var(--danger);
  }

  .select-bar .done {
    margin-left: auto;
  }

  /* ---- detail window ---- */

  .win-title {
    font-weight: 600;
  }

  .desc {
    margin: 0 0 8px;
  }

  .win-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
  }

  .mod {
    font-size: 13px;
    color: var(--xp);
  }

  .mod.affix {
    color: var(--accent);
  }

  .reqs {
    color: var(--danger);
    margin-bottom: 10px;
  }

  .reqs.met {
    color: var(--xp);
  }

  .socket {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: space-between;
    border: 1px solid var(--accent);
    border-radius: 6px;
    padding: 3px 4px 3px 8px;
    color: var(--accent);
  }

  .socket-select {
    font: inherit;
    font-size: 12px;
    color: var(--text-dim);
    background: var(--bg-raised);
    border: 1px dashed var(--border);
    border-radius: 6px;
    padding: 3px 5px;
    width: 100%;
  }

  .win-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .win-buttons .ghost,
  .grade-row .ghost,
  .pouch-item .ghost {
    border-color: #5d3030;
    color: var(--danger);
  }

  /* ---- quick-select chips ---- */

  .chips {
    margin: -4px 0 10px;
  }

  .chip {
    padding: 2px 8px;
    border-radius: 999px;
  }

  .chip.rar {
    border-color: var(--rar);
  }

  /* An active rarity chip keeps its own colour rather than the generic accent. */
  .chip.rar.selected {
    border-color: var(--rar);
    background: color-mix(in srgb, var(--rar) 22%, var(--bg-raised));
  }

  .chip-sep {
    width: 1px;
    align-self: stretch;
    background: var(--border);
    margin: 2px 3px;
  }

  /* ---- ingredients pouch ---- */

  .housekeep {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding-bottom: 10px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }

  .housekeep .chip {
    border-color: var(--rar);
  }

  .housekeep .chip.selected {
    border-color: var(--rar);
    background: color-mix(in srgb, var(--rar) 22%, var(--bg-raised));
  }

  .hk-count {
    margin-left: auto;
    color: var(--text-dim);
    font-size: 12px;
  }

  .hk-warn {
    color: var(--danger);
    margin-left: 4px;
  }

  .pouch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 10px;
    align-content: start;
  }

  .pouch-item {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
  }

  .pouch-name {
    font-weight: 600;
  }

  .ellip {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .icon-sm {
    font-size: 18px;
  }

  .grade-rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 4px;
  }

  .grade-row {
    display: flex;
    align-items: center;
    gap: 8px;
    border-left: 3px solid var(--tint);
    padding: 2px 0 2px 8px;
  }

  .grade-name {
    color: var(--tint);
    font-weight: 600;
  }

  .grade-row .spacer {
    flex: 1;
  }

  /* ---- empty-slot picker ---- */

  .pick-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .pick {
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    padding: 6px 8px;
    width: 100%;
  }

  .pick-name {
    font-weight: 600;
    flex-shrink: 0;
  }

  .pick-mods {
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .pick-mods .affix {
    color: var(--accent);
  }

  /* The satchel: one row per brew, because a flask is a decision rather than
     a stack of interchangeable stock. */
  .satchel {
    margin-top: 12px;
  }

  .coated {
    margin-top: 6px;
    padding: 4px 8px;
    border-left: 2px solid var(--accent);
    color: var(--text-dim);
  }

  .flasks {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 7px;
  }

  .flask {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 4px 8px;
    border: 1px solid var(--tint, var(--border));
    border-radius: 6px;
    background: color-mix(in srgb, var(--tint) 12%, var(--bg-raised));
  }

  .flask-icon {
    font-size: 16px;
    line-height: 1;
  }

  .flask-name {
    font-size: 12px;
    white-space: nowrap;
  }
</style>
