import type { GameState, ItemInstance } from '../types';
import { FLOORS, ITEMS, MONSTERS, QUESTS, SKILLS, SPOTS, STYLES } from '../registry';
import { runeClassOf } from '../systems/runes';
import { getDerivedStats } from '../systems/derived';
import { settleLevels } from '../systems/progression';
import { skillProgression } from '../systems/skills';
import { ATTRIBUTE_PROGRESSION } from '../data/progression.data';
import { DEITIES } from '../data/deities.data';
import { ARCANE_WORDS } from '../data/spellcraft.data';
import { TECHNIQUE_LIST } from '../data/martial.data';
import { freshMutagenState, startingKit } from '../data/mutagens.data';
import { freshPrestigeState } from '../data/prestige.data';
import { conditionsMet } from '../systems/conditions';
import { floorXpKey, levelFromXp, questLevelXp } from '../systems/levels';
import { KILL_LEVEL_XP_RATE } from '../data/levels.data';

/**
 * Save migrations. When SAVE_VERSION bumps, add an entry keyed by the OLD
 * version that upgrades a save to the next version. Applied in sequence.
 */
export const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => void> = {
  // v1 → v2: Willpower becomes Wisdom (progress preserved), Charisma added,
  // super-attribute fusion list introduced.
  1: (raw) => {
    const attrs = raw.attrs as Record<string, { level: number; xp: number }>;
    attrs.wis = attrs.wis ?? attrs.wil ?? { level: 1, xp: 0 };
    delete attrs.wil;
    attrs.cha = attrs.cha ?? { level: 1, xp: 0 };
    const stats = raw.stats as Record<string, number>;
    if (stats && stats['attr:wil'] !== undefined) {
      stats['attr:wis'] = stats['attr:wil'];
      delete stats['attr:wil'];
    }
    if (raw.activity === 'train_wil') raw.activity = 'train_wis';
    raw.fused = raw.fused ?? [];
    raw.version = 2;
  },
  // v2 → v3: equipment slot 'body' renamed to 'chest'; stackable materials added.
  2: (raw) => {
    const eq = raw.equipment as Record<string, unknown> | undefined;
    if (eq && eq.body !== undefined) {
      eq.chest = eq.chest ?? eq.body;
      delete eq.body;
    }
    raw.materials = raw.materials ?? {};
    raw.version = 3;
  },
  // v3 → v4: quest tracking introduced.
  3: (raw) => {
    raw.quests = raw.quests ?? {};
    raw.version = 4;
  },
  // v4 → v5: multi-leg travel plans introduced.
  4: (raw) => {
    raw.travelPlan = raw.travelPlan ?? [];
    raw.version = 5;
  },
  // v5 → v6: action bars — activityProgress changed meaning from ticks to
  // speed-units, so in-flight progress is reset (at most one cycle lost).
  5: (raw) => {
    raw.activityProgress = 0;
    raw.version = 6;
  },
  // v6 → v7: titles introduced.
  6: (raw) => {
    raw.titles = raw.titles ?? [];
    raw.title = raw.title ?? null;
    raw.version = 7;
  },
  // v7 → v8: rune system. Existing gear gets its size class's median slot
  // count (deterministic — migrations must not consume the RNG stream).
  7: (raw) => {
    raw.runes = raw.runes ?? {};
    const median = { small: 1, medium: 1, large: 2 } as const;
    const backfill = (item: ItemInstance | undefined | null) => {
      if (!item || item.slots !== undefined) return;
      const def = ITEMS[item.defId];
      item.slots = def ? median[runeClassOf(def)] : 0;
      item.runes = item.runes ?? [];
    };
    for (const item of (raw.inventory as ItemInstance[]) ?? []) backfill(item);
    for (const item of Object.values((raw.equipment as Record<string, ItemInstance>) ?? {})) {
      backfill(item);
    }
    raw.version = 8;
  },
  // v8 → v9: stamina/mana/spirit resource pools. Start full at each pool's
  // attribute-derived max (all other fields exist by now, so derived stats read).
  8: (raw) => {
    const stats = getDerivedStats(raw as unknown as GameState);
    raw.stamina = raw.stamina ?? stats.maxStamina;
    raw.mana = raw.mana ?? stats.maxMana;
    raw.spirit = raw.spirit ?? stats.maxSpirit;
    raw.version = 9;
  },
  // v9 → v10: player-defined skill rotation + per-skill trigger conditions, and
  // the fight feed moved out of the (transient) encounter so it outlives fights.
  9: (raw) => {
    raw.skillOrder = raw.skillOrder ?? [];
    raw.skillTriggers = raw.skillTriggers ?? {};
    raw.combatFeed = raw.combatFeed ?? [];
    raw.version = 10;
  },
  // v10 → v11: schools are no longer separately selectable — they take over
  // their stance's slot from the loadout. A save that selected a school folds
  // back to that stance, which re-manifests the school on the next read.
  10: (raw) => {
    const selected = STYLES[raw.style as string];
    raw.style = selected ? (selected.replaces ?? selected.id) : 'balanced';
    raw.version = 11;
  },
  // v11 → v12: the bestiary. Knowledge is earned from here on — past kills
  // taught the player nothing they wrote down, so the book starts empty.
  11: (raw) => {
    raw.bestiary = raw.bestiary ?? {};
    raw.version = 12;
  },
  // v12 → v13: fighting styles burn stamina. Old saves start unlocked (a full
  // bar clears the lock anyway) with no ramped momentum in any live fight.
  12: (raw) => {
    raw.staminaLock = raw.staminaLock ?? 'none';
    const combat = raw.combat as Record<string, unknown> | null | undefined;
    if (combat) combat.momentum = combat.momentum ?? 0;
    raw.version = 13;
  },
  // v13 → v14: per-skill XP curves. Levels are untouched, but banked XP was
  // measured against the old flat curve — under the new one a remainder may
  // already cover the next level (or several), so it is settled here rather
  // than sitting unspent until the next XP tick.
  13: (raw) => {
    const skills = raw.skills as Record<string, { level: number; xp: number }>;
    for (const [id, s] of Object.entries(skills ?? {})) settleLevels(s, skillProgression(id));
    const attrs = raw.attrs as Record<string, { level: number; xp: number }>;
    for (const a of Object.values(attrs ?? {})) settleLevels(a, ATTRIBUTE_PROGRESSION);
    raw.version = 14;
  },
  // v14 → v15: novelty learning. Counters are seeded from the bestiary rather
  // than started at zero — a hunter who has killed five hundred wolves already
  // knows what a wolf is, and must not be paid first-sighting rates for them.
  14: (raw) => {
    const novelty: Record<string, Record<string, number>> = {};
    const bestiary = raw.bestiary as Record<string, { kills?: number }> | undefined;
    const skills = raw.skills as Record<string, unknown> | undefined;
    for (const id of Object.keys(skills ?? {})) {
      if (SKILLS[id]?.novelty?.domain !== 'bestiary') continue;
      const counts: Record<string, number> = {};
      for (const [monsterId, entry] of Object.entries(bestiary ?? {})) {
        if (entry?.kills) counts[monsterId] = entry.kills;
      }
      novelty[id] = counts;
    }
    raw.novelty = novelty;
    raw.version = 15;
  },
  // v15 → v16: exertion became opt-in. Saves start with it OFF — the toggle
  // sits under the stance grid, and swinging now costs a small upkeep either
  // way, so nobody is quietly spending reserves they didn't ask to spend.
  15: (raw) => {
    raw.exerting = raw.exerting ?? false;
    raw.version = 16;
  },
  // v16 → v17: pools became a registry (see data/resources.data.ts) instead of
  // four named fields, so a new resource can be declared without the engine
  // learning its name. Values carry over untouched; the stamina lockout keeps
  // its meaning under generic names ('winded' → low, 'exhausted' → empty).
  16: (raw) => {
    raw.resources = {
      hp: (raw.hp as number) ?? 50,
      stamina: (raw.stamina as number) ?? 0,
      mana: (raw.mana as number) ?? 0,
      spirit: (raw.spirit as number) ?? 0,
    };
    const lock = raw.staminaLock as string | undefined;
    raw.resourceLocks = { stamina: lock === 'winded' ? 'low' : lock === 'exhausted' ? 'empty' : 'none' };
    delete raw.hp;
    delete raw.stamina;
    delete raw.mana;
    delete raw.spirit;
    delete raw.staminaLock;
    raw.version = 17;
  },
  // v17 → v18: status conditions. Nobody arrives already poisoned.
  17: (raw) => {
    raw.statuses = raw.statuses ?? [];
    raw.version = 18;
  },
  // v18 → v19: conditions track the worst SINGLE application alongside the
  // accumulated total (see StatusDot.fromPeak). An affliction from before the
  // split has no record of it, so its total stands in.
  18: (raw) => {
    for (const held of (raw.statuses as { intensity: number; peak?: number }[]) ?? []) {
      held.peak = held.peak ?? held.intensity;
    }
    raw.version = 19;
  },
  // v19 → v20: modular crafting. Graded materials are stocked per quality, and
  // runes you carve yourself are kept as the combination that made them.
  19: (raw) => {
    raw.carved = raw.carved ?? [];
    raw.stock = raw.stock ?? {};
    raw.version = 20;
  },
  // v20 → v21: consumables. Nothing is on cooldown for a returning player.
  20: (raw) => {
    raw.useCooldowns = raw.useCooldowns ?? {};
    raw.version = 21;
  },
  // v21 → v22: spellcraft. The grimoire starts empty and nobody has yet done
  // anything the divine considered worth remembering.
  21: (raw) => {
    raw.grimoire = raw.grimoire ?? [];
    raw.favor = raw.favor ?? 0;
    raw.version = 22;
  },
  // v22 → v23: the pantheon. Favor becomes standing with EACH deity; the old
  // pool was earned from the divine generally, so every deity honours it —
  // purchasing power is preserved rather than assigned to a god the player
  // never chose.
  22: (raw) => {
    const old = typeof raw.favor === 'number' ? raw.favor : 0;
    const favor: Record<string, number> = {};
    if (old > 0) for (const id of Object.keys(DEITIES)) favor[id] = old;
    raw.favor = favor;
    raw.version = 23;
  },
  // v23 → v24: psionic axes. Saves from the three-axis era had grip from the
  // start, so they keep it — new minds begin with force and reach alone.
  23: (raw) => {
    raw.psi = raw.psi ?? { axes: ['force', 'reach', 'grip'], tier: 0 };
    raw.version = 24;
  },
  // v24 → v25: martial techniques. The legacy actives dissolve — heavy swing
  // and active dodge return as techniques the moment their (identical) unlock
  // conditions hold, and fireball's job belongs to the grimoire now — so their
  // skill entries, rotation slots and triggers are swept rather than left to
  // dangle. Practice counters start at zero: reflexes are trained from here on.
  24: (raw) => {
    raw.techniques = raw.techniques ?? {};
    raw.drilling = raw.drilling ?? [];
    const gone = ['heavy_swing', 'active_dodge', 'fireball'];
    const skills = raw.skills as Record<string, unknown> | undefined;
    for (const id of gone) delete skills?.[id];
    raw.skillOrder = ((raw.skillOrder as string[]) ?? []).filter((id) => !gone.includes(id));
    const triggers = raw.skillTriggers as Record<string, unknown> | undefined;
    for (const id of gone) delete triggers?.[id];
    const combat = raw.combat as Record<string, unknown> | null | undefined;
    if (combat) combat.position = combat.position ?? 'neutral';
    raw.version = 25;
  },
  // v25 → v26: knowledge became a ledger. Under v25 a technique was "known"
  // whenever its conditions held, so anything this save currently qualifies
  // for is grandfathered in as CANONICAL (these fighters learned under the
  // old dispensation — they are not sent back to the counters), keeping any
  // executions already banked. From here on, new knowledge arrives rough
  // (self-learned) or canonical (taught).
  25: (raw) => {
    const ledger = (raw.techniques ??= {}) as Record<
      string,
      { executions: number; form?: string }
    >;
    for (const held of Object.values(ledger)) held.form = held.form ?? 'canonical';
    const state = raw as unknown as GameState;
    for (const def of TECHNIQUE_LIST) {
      if (ledger[def.id]) continue;
      if (!def.unlock || conditionsMet(state, def.unlock)) {
        ledger[def.id] = { executions: 0, form: 'canonical' };
      }
    }
    raw.version = 26;
  },
  // v26 → v27: weapon states. Nobody arrives with a knife already hidden, and
  // a live fight's grounded slot backfills empty (transient anyway).
  26: (raw) => {
    raw.sheathed = raw.sheathed ?? null;
    const combat = raw.combat as Record<string, unknown> | null | undefined;
    if (combat) combat.grounded = combat.grounded ?? null;
    raw.version = 27;
  },
  // v27 → v28: the alembic. Nobody has brewed anything yet, so the satchel
  // simply starts empty; the Alchemy skill arrives through the ordinary unlock
  // path the moment its herbalism requirement is met.
  27: (raw) => {
    raw.flasks = raw.flasks ?? [];
    raw.version = 28;
  },
  // v28 → v29: savable combat loadouts. Nobody arrives with plans on file.
  28: (raw) => {
    raw.loadouts = raw.loadouts ?? [];
    raw.version = 29;
  },
  // v29 → v30: loadouts widen to a whole fighting identity — prepared spells
  // and worn equipment join the rotation plan. Plans saved before this backfill
  // to empty (a v29 loadout never touched either), which reapplies as a no-op.
  29: (raw) => {
    for (const loadout of (raw.loadouts as Record<string, unknown>[]) ?? []) {
      loadout.spells = loadout.spells ?? [];
      loadout.equipment = loadout.equipment ?? {};
    }
    raw.version = 30;
  },
  // v30 → v31: exploring a spot now turns things up along the way, not only at
  // the end. Nothing is pre-claimed: a spot you had already combed hands over
  // its new finds the next time you explore it, one per tick, which reads as
  // looking again with fresh eyes rather than as a lump sum.
  30: (raw) => {
    raw.finds = raw.finds ?? {};
    raw.version = 31;
  },
  // v31 → v32: Focus, the psionic pool — one per school, keyed to the attribute
  // that school runs on (understand/believe/will = INT/WIS/CHA). Arrives full,
  // like every pool added since v9. The same change re-weights maxSpirit toward
  // WIS, which needs no migration: pool maxima are derived, and `tickResources`
  // clamps anything now over its ceiling on the very first tick.
  31: (raw) => {
    const pools = (raw.resources ?? {}) as Record<string, number>;
    pools.focus = pools.focus ?? getDerivedStats(raw as unknown as GameState).maxFocus;
    raw.resources = pools;
    raw.version = 32;
  },
  // v32 → v33: weapon oils. A roused oil now coats a blade instead of making a
  // salve, so the blade needs somewhere to carry it. Nobody's edge is oiled yet.
  32: (raw) => {
    raw.coating = raw.coating ?? null;
    raw.version = 33;
  },
  // v33 → v34: mutagens. A returning character gets exactly what a new one
  // gets — open, with the starting kit, and an empty catalogue (see
  // freshMutagenState, and the ALPHA note on why it arrives open).
  //
  // Nothing is seeded from what the player already holds, and deliberately: a
  // full bestiary is what LETS you collect genes, never a claim that you did.
  // Genes and mutagens live in `stock` alongside every other graded component,
  // so there is no separate inventory to backfill either.
  33: (raw) => {
    raw.mutagens = raw.mutagens ?? freshMutagenState();
    raw.version = 34;
  },
  // v34 → v35: open the chromosomes that were already shut.
  //
  // v34 arrived locked, waiting on an unlock quest that does not exist yet, so
  // every save made under it has a system nobody can reach — and a bench that
  // hides itself. Relaxing v34's default could not fix them: a migration runs
  // once, and changing what it produces never reaches a save that already ran
  // it. Hence a step of its own.
  //
  // Conservative on purpose. It opens the flag and grants the starting kit only
  // where nothing has been established, so a chromosome somebody has already
  // spent connections on is left exactly as it is.
  34: (raw) => {
    const mut = (raw.mutagens ?? freshMutagenState()) as {
      unlocked: boolean;
      chromosome: { established: string[] };
    };
    mut.unlocked = true;
    if (!mut.chromosome.established.length) mut.chromosome.established = startingKit();
    raw.mutagens = mut;
    raw.version = 35;
  },

  // v35 → v36: the fight ledger. Nothing to convert — an existing save has no
  // record of the fights it has already had, and inventing one would be worse
  // than an empty window. The first encounter after loading fills it.
  35: (raw) => {
    raw.fight = null;
    raw.lastFight = null;
    raw.version = 36;
  },

  // v36 → v37: the combat notebook, and a transcript on the ledger. A v36
  // ledger predates the transcript, so it gets an empty one rather than being
  // discarded — its numbers are still true, it just has no play-by-play.
  36: (raw) => {
    const last = raw.lastFight as { transcript?: unknown } | null;
    if (last && !Array.isArray(last.transcript)) last.transcript = [];
    raw.notebook = [];
    raw.version = 37;
  },
  // v37 → v38: somewhere to be thrown when a fight cannot be fled. An existing
  // character is standing somewhere; if that somewhere is a haven, seed both
  // slots from it, otherwise leave them empty and let the world's first haven
  // catch the first fall.
  37: (raw) => {
    const here = typeof raw.spot === 'string' ? raw.spot : null;
    const spot = here ? SPOTS[here] : undefined;
    const rests = spot?.activities.filter((a) => a.kind === 'rest') ?? [];
    const usable = rests.length > 0;
    const unconditional = rests.some((a) => !('requires' in a) || !a.requires?.length);
    raw.safeSpots = {
      nearest: usable ? here : null,
      unconditional: unconditional ? here : null,
    };
    raw.version = 38;
  },
  // v38 → v39: approach bonuses. Nobody was mid-sneak when this shipped.
  38: (raw) => {
    raw.pendingApproach = raw.pendingApproach ?? null;
    raw.version = 39;
  },
  // v39 → v40: 'skewered' became 'perforated', freeing the name for the
  // condition that actually has a blade left in it. A player carrying the old
  // id would otherwise hold a condition no registry can look up — invisible,
  // unremovable, and still counted. Rename it in place, keeping its clock.
  39: (raw) => {
    for (const held of (raw.statuses as { id: string }[]) ?? []) {
      if (held.id === 'skewered') held.id = 'perforated';
    }
    raw.version = 40;
  },
  // v40 → v41: written music. Nobody owned a sheet or was mid-set before it.
  40: (raw) => {
    raw.compositions = raw.compositions ?? [];
    raw.performance = raw.performance ?? null;
    raw.version = 41;
  },
  // v41 → v42: time signatures. Every existing sheet was written in common
  // time — it just never had to say so. (The grid also went 48 → 240 units
  // per bar, which no save noticed: notes store duration IDS, not units.)
  41: (raw) => {
    for (const comp of (raw.compositions as { meter?: string }[]) ?? []) {
      comp.meter = comp.meter ?? 'common';
    }
    raw.version = 42;
  },
  // v42 → v43: repeat marks. Nothing written before this repeated anything;
  // ties need no migration at all, being an absent flag on existing notes.
  42: (raw) => {
    for (const comp of (raw.compositions as { repeats?: unknown[] }[]) ?? []) {
      comp.repeats = comp.repeats ?? [];
    }
    raw.version = 43;
  },
  // v43 → v44: tempo. Everything written before this played at ♩=80, which
  // is exactly what the stage was already giving it.
  43: (raw) => {
    for (const comp of (raw.compositions as { bpm?: number }[]) ?? []) {
      comp.bpm = comp.bpm ?? 80;
    }
    raw.version = 44;
  },
  // v44 → v45: the pedal tone. Every sheet written before it was one voice.
  44: (raw) => {
    for (const comp of (raw.compositions as { pedal?: number | null }[]) ?? []) {
      comp.pedal = comp.pedal ?? null;
    }
    raw.version = 45;
  },
  // v45 → v46: drought protection (engine/mercy.ts). An old save starts with a
  // clean slate rather than credit for the misses it already ate — the counts
  // were never recorded, and inventing them would hand out a drop on the next
  // kill for a drought the player has already finished suffering.
  45: (raw) => {
    raw.mercy = raw.mercy ?? {};
    raw.version = 46;
  },
  // v46 → v47: subsystem shutters (systems/unlocks.ts). Five systems now
  // render only once their `flag:unlock_*` counter lifts. A save from before
  // the shutters has seen all five — hiding a tab that holds the player's own
  // compositions would be confiscation, not a lock — so it keeps them all.
  // New games start with the flags unset and earn them from content.
  46: (raw) => {
    const stats = (raw.stats as Record<string, number> | undefined) ?? {};
    raw.stats = stats;
    for (const id of ['runecarving', 'music', 'genes', 'psionics', 'wuxin']) {
      stats[`flag:unlock_${id}`] = stats[`flag:unlock_${id}`] ?? 1;
    }
    raw.version = 47;
  },
  // v47 → v48: the starter lexicon and the known gods (systems/unlocks.ts).
  // Words and deities now render only when unlocked/known; a pre-48 save has
  // spoken and worshipped freely, so it keeps the whole lexicon and pantheon.
  // New games open with eleven words and two gods.
  47: (raw) => {
    const stats = (raw.stats as Record<string, number> | undefined) ?? {};
    raw.stats = stats;
    for (const id of Object.keys(ARCANE_WORDS)) {
      stats[`flag:word:${id}`] = stats[`flag:word:${id}`] ?? 1;
    }
    for (const id of Object.keys(DEITIES)) {
      stats[`met:deity:${id}`] = stats[`met:deity:${id}`] ?? 1;
    }
    raw.version = 48;
  },
  // v48 → v49: the countryside outside Threshold is SHELVED (data/shelved/),
  // and the hold left the tower for a map of its own behind the first
  // prestige. A save standing on a place that no longer exists wakes at the
  // Foot with its journey cancelled; every list that names spots or quests is
  // pruned to what the registry still knows. Content-agnostic on purpose: it
  // reads the registry, so any future removal is covered by the same rule.
  // Counters keyed by old spot ids (`fights:*`, `explored`) are left alone —
  // they are inert, and a revived map would want them back.
  48: (raw) => {
    const known = (id: unknown): id is string => typeof id === 'string' && id in SPOTS;
    const spotLost = !known(raw.spot);
    if (spotLost) {
      // The Foot, not STARTING_SPOT: since v53 a new life opens in the
      // tutorial cell, and a save from the countryside has no business there.
      raw.spot = 'ascent_foot';
      raw.activity = null;
      raw.pendingApproach = null;
    }
    const travel = raw.travel as { from?: unknown; to?: unknown } | null | undefined;
    if (travel && (!known(travel.from) || !known(travel.to))) raw.travel = null;
    const plan = Array.isArray(raw.travelPlan) ? (raw.travelPlan as unknown[]) : [];
    if (spotLost || raw.travel === null || !plan.every(known)) raw.travelPlan = [];
    const discovered = Array.isArray(raw.discovered) ? (raw.discovered as unknown[]) : [];
    const kept = discovered.filter(known);
    if (!kept.includes(raw.spot as string)) kept.push(raw.spot as string);
    raw.discovered = kept;
    const safe = raw.safeSpots as { nearest?: unknown; unconditional?: unknown } | undefined;
    if (safe) {
      if (!known(safe.nearest)) safe.nearest = null;
      if (!known(safe.unconditional)) safe.unconditional = null;
    }
    const quests = (raw.quests as Record<string, unknown> | undefined) ?? {};
    for (const id of Object.keys(quests)) if (!(id in QUESTS)) delete quests[id];
    raw.quests = quests;
    raw.version = 49;
  },
  // v49 → v50: prestige (systems/prestige.ts). The legacy block starts
  // empty: an old save has never prestiged, whatever it has cleared. If it
  // stands past band 1 already, the tab simply appears on load.
  49: (raw) => {
    raw.prestige = raw.prestige ?? freshPrestigeState();
    raw.version = 50;
  },
  // v50 → v51: talent (the auto prestige boon) needs each skill's peak level
  // from past runs. A v50 save (the day's sandbox only) recorded none; it
  // starts remembering from its next prestige.
  50: (raw) => {
    const prestige =
      (raw.prestige as { count?: number; purchases?: Record<string, number>; peakLevels?: unknown } | undefined) ??
      freshPrestigeState();
    prestige.peakLevels = prestige.peakLevels ?? {};
    // Talent's free rank comes with the first prestige; a save that already
    // has one gets it here, the way `prestigeNow` would have given it.
    prestige.purchases = prestige.purchases ?? {};
    if ((prestige.count ?? 0) > 0 && !(prestige.purchases.talent > 0)) prestige.purchases.talent = 1;
    raw.prestige = prestige;
    raw.version = 51;
  },
  // v51 → v52: endowment, talent's twin for attributes — peak trained attribute
  // levels, and the free rank for any save that has already prestiged.
  51: (raw) => {
    const prestige =
      (raw.prestige as { count?: number; purchases?: Record<string, number>; peakAttrs?: unknown } | undefined) ??
      freshPrestigeState();
    prestige.peakAttrs = prestige.peakAttrs ?? {};
    prestige.purchases = prestige.purchases ?? {};
    if ((prestige.count ?? 0) > 0 && !(prestige.purchases.endowment > 0)) prestige.purchases.endowment = 1;
    raw.prestige = prestige;
    raw.version = 52;
  },
  // v52 → v53: navigation — journey intents, resume-on-return, banked idle
  // time. All start empty; an old save's journey in flight simply arrives
  // with nothing queued.
  52: (raw) => {
    raw.travelIntent = raw.travelIntent ?? null;
    raw.resumeActivity = raw.resumeActivity ?? {};
    raw.bonusTime = raw.bonusTime ?? { banked: 0, spending: false };
    raw.version = 53;
  },
  // v53 → v54: floor 0, the tutorial. A save from before it has already
  // played the opening the tutorial replaces, so it is stamped done — the
  // same confiscation rule as the v47 shutters: a panel explaining a fight to
  // someone standing on floor 3 would be a regression, not onboarding.
  53: (raw) => {
    const stats = (raw.stats as Record<string, number> | undefined) ?? {};
    stats['flag:tutorial_done'] = Math.max(1, stats['flag:tutorial_done'] ?? 0);
    raw.stats = stats;
    raw.version = 54;
  },
  // v54 → v55: two more alpha shutters (user, 2026-10-17) — the martial
  // planner and the kitchen side-benches (systems/unlocks.ts). A save from
  // before has had both, so it keeps them, exactly as v47 did for the first
  // five. New games open with them shut. No field changes.
  54: (raw) => {
    const stats = (raw.stats as Record<string, number> | undefined) ?? {};
    raw.stats = stats;
    for (const id of ['martial', 'prep']) {
      stats[`flag:unlock_${id}`] = stats[`flag:unlock_${id}`] ?? 1;
    }
    raw.version = 55;
  },
  // v55 → v56: character level (systems/levels.ts). Back-paid from the
  // record: every kill at its monster's base XP (the level scaling at the
  // time is not on record, so this undercounts), each completed quest's
  // level XP, each cleared floor's clear XP, stamped so it never pays twice.
  55: (raw) => {
    const stats = (raw.stats as Record<string, number> | undefined) ?? {};
    raw.stats = stats;
    let xp = 0;
    for (const [key, n] of Object.entries(stats)) {
      if (!key.startsWith('kills:')) continue;
      const def = MONSTERS[key.slice('kills:'.length)];
      if (def && n > 0) xp += def.xp * n * KILL_LEVEL_XP_RATE;
    }
    const quests = (raw.quests as Record<string, { status?: string }> | undefined) ?? {};
    for (const [id, q] of Object.entries(quests)) {
      if (q?.status === 'done' && QUESTS[id]) xp += questLevelXp(QUESTS[id]);
    }
    for (const floor of Object.values(FLOORS)) {
      if (!floor.clearXp || !floor.clear?.length) continue;
      const cleared = floor.clear.every((c) => c.type === 'stat' && (stats[c.key] ?? 0) >= c.value);
      if (!cleared) continue;
      xp += floor.clearXp;
      stats[floorXpKey(floor.id)] = 1;
    }
    const { level, xp: rest } = levelFromXp(xp);
    raw.level = level;
    raw.levelXp = rest;
    raw.version = 56;
  },
};

export function migrate(raw: Record<string, unknown>, targetVersion: number): GameState {
  let version = typeof raw.version === 'number' ? raw.version : 1;
  while (version < targetVersion) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`No migration from save version ${version}`);
    step(raw);
    version = raw.version as number;
  }
  return raw as unknown as GameState;
}
