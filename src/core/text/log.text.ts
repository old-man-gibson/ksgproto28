/**
 * Runtime log lines and refusal reasons, one template per key. `{name}` is a
 * placeholder filled by the call site (see text() in src/core/text/log.ts).
 * Edit the words here. A placeholder you remove stops printing; one the call
 * site does not supply prints as written, so it is easy to spot in the log.
 *
 * Sections follow the system that fires the line (src/core/systems/<name>.ts);
 * `common.*` lines fire from several. `<system>.reason.*` are the refusal
 * texts a bench, spell or shop gives back, shown after a lock icon.
 */
export const LOG_TEXT = {
  // ---------- common ----------
  'common.times': ' ×{qty}',
  'common.no_leaving_fight': '⛔ Cannot leave this fight.',
  'common.locked': '🔒 {reason}',
  'common.disengage': 'Disengaged.',

  // ---------- achievements ----------
  'achievements.claimed': '🏆 Achievement: {icon} {name} {tier}!',

  // ---------- actions ----------
  'actions.find_generic': '🔎 Found something at {spot}.',
  'actions.gate_generic': '⛔ Search stalls at {percent}%. Requirement not met.',
  'actions.explored_paths': '🗺️ {spot} fully explored. New path: {paths}.',
  'actions.explored': '🗺️ {spot} fully explored.',
  'actions.craft_locked': '🔒 You lack the skill to craft that.',
  'actions.started': '▶️ {name}',
  'actions.recovered': '💪 Recovered. Actions available again.',
  'actions.out_of_materials': '📭 Out of materials for {name}.',
  'actions.condition_detonates': '{icon} {name} detonates for {dealt} {type}!',
  'actions.condition_knocks_out': '💀 {name} knocks you out. Recovering.',
  'actions.condition_passed': '{icon} {name} has passed.',
  'actions.condition_fatal': '{icon} {name} knocks you out. You wake weakened.',
  'actions.find_marks_spot': '📍 Marked on your map: {icon} {name}',
  'actions.find_opens_path': '🚪 A way opens from {spot}: {label}.',

  // ---------- alchemy ----------
  'alchemy.applied': '{icon} Applied {name}{gained}.',
  'alchemy.drank': '{icon} Drank {name}{gained}.',
  'alchemy.gained': ': {list}',
  'alchemy.oiled': '{icon} {name} applied to {weapon}: {blows} blows{wiped}',
  'alchemy.oil_wiped': ', replacing the previous oil.',
  'alchemy.oil_done': '.',
  'alchemy.reason.too_short': 'An alembic needs at least two reagents',
  'alchemy.reason.not_a_reagent': '{name} is not a reagent',
  'alchemy.reason.reagent_level': '{name} needs Alchemy {level}',
  'alchemy.reason.no_such_flask': 'No such flask',
  'alchemy.reason.residue': 'Residue has no use',
  'alchemy.reason.no_weapon': 'No weapon in hand to oil',
  'alchemy.reason.no_target': 'No target',
  'alchemy.reason.cooldown': 'Hands busy for another {seconds}s',

  // ---------- arcane ----------
  'arcane.reason.no_noun_or_verb': 'A spell needs a noun or a verb',
  'arcane.reason.empty': 'The sentence is empty',
  'arcane.reason.too_many_words': 'Word limit is {max} (Arcana {level})',
  'arcane.reason.no_such_word': 'No such word: {word}',
  'arcane.reason.unknown_word': 'Unknown word: "{word}"',
  'arcane.reason.word_level': '"{word}" needs Arcana {level}',
  'arcane.reason.word_unearned': '"{name}" not yet earned: inscribe with "{word}" ({uses}/{need})',

  // ---------- benchwork ----------
  'benchwork.started': '▶️ {bench}: working{count}',
  'benchwork.until_stopped': ' until stopped',
  'benchwork.stopped': '⏹️ {bench}: {reason} ({done} done)',

  // ---------- bestiary ----------
  'bestiary.species_added': '📖 Bestiary: {icon} {name} added.',
  'bestiary.fact_learned': '📖 {icon} {name} learned for {monster}.',
  'bestiary.den_learned': '📖 Den located: {monster} at {spot}.',

  // ---------- combat ----------
  'combat.knocked_out_forced': '💫 {name} knocks you out.',
  'combat.knocked_out': '💫 {name} knocks you out. Recovering.',
  'combat.appears': '⚠️ {what} (Lv {level}) appears!',
  'combat.appear_group': '⚠️ {what} (Lv {level}) appear!',
  'combat.ambushed': '⚔️ Ambushed. No escape from this fight.',
  'combat.scavenged_gold': '🪙 Scavenged {gold} gold.',
  'combat.loot_material': '📦 {icon} {name}{grade} ×{qty}',
  'combat.loot_item': '📦 Loot: {icon} {item}',
  'combat.unique_slain': '🏆 {name} slain. It will not return.',
  'combat.keeper_slain': '👑 Keeper of {spot} slain.',
  'combat.defeated': '☠️ Defeated {name} (Lv {level}): +{gold} gold',
  'combat.defeated_no_gold': '☠️ Defeated {name} (Lv {level}).',
  'combat.spot_cleared': '🏞️ {spot} cleared. No encounters remain.',
  'combat.weapon_dropped': '⚡ Grip lost. {name} dropped.',

  // ---------- consumables ----------
  'consumables.reason.not_usable': 'Not usable',
  'consumables.reason.none_held': 'None held',
  'consumables.reason.cooldown': 'Ready in {seconds}s',
  'consumables.reason.recipe_known': 'Recipe already known',
  'consumables.reason.card_spent': 'Already done',
  'consumables.reason.technique_unreachable': 'No technique you know leads into {name}’s position yet',
  'consumables.word_learned': '📝 Word learned: {word}. It is on the Spellcrafting Table (castable once Arcana reaches its level).',
  'consumables.technique_learned': '📘 Technique learned: {name} (canonical form).',
  'consumables.card_used': '{icon} {verb}: {name}.',
  'consumables.votive_first': '🕯️ Votive token offered. Gods you meet later start with +{amount} favor too.',
  'consumables.votive_floating': '🕯️ Votive token offered: +1 unassigned favor. Place it on a god of your choice on the Divine tab.',
  'divine.favor_assigned': '🕊️ 1 unassigned favor placed with {deity}.',
  'consumables.recipe_learned': '📜 Recipe learned: {name}. It is listed on the bench that cooks it.',
  'consumables.used': '{icon} {verb} {grade} {name}.',

  // ---------- cooking ----------
  'cooking.reason.no_outcome': 'No recipe matches',
  'cooking.reason.board_empty': 'Board empty: choose an ingredient and a technique',
  'cooking.reason.no_such_technique': 'No such technique',
  'cooking.reason.technique_level': 'Technique needs Cooking {level}',
  'cooking.reason.not_preppable': 'Not a preppable ingredient',

  // ---------- disciplines ----------
  'disciplines.reason.slot_empty': '{slot} is empty',
  'disciplines.reason.wrong_slot': '{name} does not belong in {slot}',
  'disciplines.reason.no_stock_at_grade': 'You have no {name} of that grade',
  // ---------- activitydrops (systems/activitydrops.ts) ----------
  'activitydrops.found': '🎁 Rare find ({activity}): {icon} {name}.',

  // ---------- huntrest (systems/huntrest.ts) ----------
  'huntrest.resting': '🛌 HP {hp}%, below your {at}% threshold: resting before the next fight, until {to}%.',
  'huntrest.done': '⚔️ Rested. The hunt goes on.',
  'huntrest.stuck': '⚔️ HP is not recovering (a condition blocks it). The hunt goes on without resting.',

  // ---------- training (systems/training.ts) ----------
  'training.patched_first': '🩹 Cage keeper: "Hey kid, here. Train safely." HP full; bleeds and poisons cleared. The keeper does this after every win here while your six attributes total {cap} or less.',
  'training.patched': '🩹 The cage keeper patches you up: HP full.',
  'training.dare_held': '⏸️ The cage keeper stops the cages: a {name} is up. Play is held until you answer; the time is banked as bonus time.',
  'training.dare_taken': '⚔️ You step in with the {name}. No fleeing, and no patching up until it is over.',
  'training.dare_declined': 'You pass on the {name}. The cages carry on; the keeper asks again after {every} more wins.',

  'disciplines.reason.short_at_grade': 'You have {held} {name} of that grade; this layout uses {need}',
  'disciplines.reason.slot_locked': 'Slot locked',
  'disciplines.reason.no_outcome': 'No recipe matches these inputs',

  // ---------- divine ----------
  'divine.favor_gained': '🕊️ +{amount} favor with every god you know.',
  'divine.reason.no_such_miracle': 'No such miracle',
  'divine.reason.already_received': 'Already received',
  'divine.reason.devotion_level': 'Needs Devotion {level}',
  'divine.reason.favor_short': 'Needs {cost} favor with {deity} (you have {held})',
  'divine.received': '{icon} Received: {name} ({deity}).',

  // ---------- equipment ----------
  'equipment.equipped': 'Equipped {icon} {item}{note}.',
  'equipment.equip_note': ': {note}',
  'equipment.sold_units': 'Sold {units} {noun}{plural} for {total} gold.',
  'equipment.discarded_units': 'Discarded {units} {noun}{plural}.',
  'equipment.sold_one': 'Sold {item} for {total} gold.',
  'equipment.sold_uniform': 'Sold {item} ×{count} for {total} gold.',
  'equipment.sold_mixed': 'Sold {count} items for {total} gold.',
  'equipment.requirements_unmet': 'Requirements not met for {icon} {item}.',
  'equipment.wrong_slot': '{icon} {item} cannot be held there.',
  'equipment.sold_stack': 'Sold {icon} {grade}{name} ×{qty} for {price} gold.',
  'equipment.discarded_stack': 'Discarded {icon} {grade}{name} ×{qty}.',
  'equipment.sold_material': 'Sold {icon} {name} ×{qty} for {price} gold.',

  // ---------- game ----------
  'game.prestiged': '♻️ Prestige {count}: {points} points harvested.',
  'game.exerting_on': '🔥 Exerting: {style} spends stamina on every bonus it offers.',
  'game.exerting_off': '🍃 Holding back: stance bonuses off, minimal stamina spend.',
  'game.school_engaged': '{icon} {was} switched to {now}.',
  'game.school_released': '{was} reverted to {now}.',
  'game.style_changed': 'Combat style: {name}',
  'game.loadout_applied': '⚔️ Loadout applied: {name}',

  // ---------- locations ----------
  'locations.heading': '🥾 Heading to {name}{via}...',
  'locations.via': ' ({label})',
  'locations.setting_out': '🗺️ Setting out for {icon} {name}{legs}...',
  'locations.legs': ' ({legs} legs)',
  'locations.unknown_place': 'an undiscovered place',
  'locations.blocked': '🔒 Path locked.',
  'locations.discovered': '📍 Discovered: {icon} {name}',
  'locations.region_mapped': '🗺️ {region} mapped: {count} places added to the map.',
  'locations.arrived': 'You arrive at {name}.',
  'locations.route_blocked': 'Route blocked. Stopped here.',
  'locations.stop_requested': 'Stopping at the next halt.',
  'locations.caravan_unaffordable': 'Caravan fee is {cost} gold. Not enough gold.',
  'locations.fast_traveled': '⚡ Fast travel to {icon} {name}: −{cost} gold.',

  // ---------- martial ----------
  'martial.technique_learned': '🥋 Technique learned (rough): {icon} {name}.',
  'martial.technique_taught': '🥋 {teacher} teaches you {icon} {name} (canonical form).',
  'martial.technique_refined': '🥋 {teacher} corrects your {icon} {name}: canonical form, practice kept.',

  // ---------- music ----------
  'music.stopped': '⏹️ Performance stopped{reason}.',
  'music.stop_reason': ': {reason}',
  'music.reason.travelling': '🔒 Cannot perform while travelling.',
  'music.reason.no_moment': '🔒 Cannot perform now.',
  'music.reason.problem': '🔒 {problem}',
  'music.started': '🎵 Performing {name}.',
  'music.classified': '{icon} {name} reads as {reading}.',
  'music.lingers': '🎶 Lingering: {names}.',

  // ---------- mutagens ----------
  'mutagens.reason.histones_short': 'Needs {cost} histones; {held} held',
  'mutagens.reason.over_capacity': 'Needs {use} capacity; limit is {limit}',
  'mutagens.unlocked': '🧬 Geneshaping unlocked.',
  'mutagens.catalogued': '🧬 Catalogued: {name}.',
  'mutagens.gene_recovered': '🧬 {icon} {name} ({grade}) recovered.',
  'mutagens.mutagen_recovered': '🧫 {icon} {name} ({grade})',
  'mutagens.nuclease_recovered': '🧬 {icon} {name} recovered.',
  'mutagens.reason.not_unlocked': 'Geneshaping not unlocked',
  'mutagens.reason.refine_ceiling': 'Nothing refines past Divine',
  'mutagens.reason.refine_copies': 'Needs {copies} copies of the same grade',
  'mutagens.reason.refine_needs_biomatter': 'Needs {cost} biomatter',
  'mutagens.refined': '🧬 {icon} {name} refined to {grade}.',
  'mutagens.reason.not_a_nuclease': 'That is not a nuclease',
  'mutagens.reason.no_element': 'That mutation carries no element to write with',
  'mutagens.reason.no_nuclease_held': 'You hold no such nuclease',
  'mutagens.reason.none_held': 'You hold none of those',
  'mutagens.reason.fuse_needs_biomatter': 'Needs {cost} biomatter',
  'mutagens.fused': '🧬 {icon} {name} fused.',
  'mutagens.reason.bench_empty': 'Nothing on the bench to work on',
  'mutagens.reason.not_a_main_gene': 'That is not a main gene',
  'mutagens.reason.settling': 'Settling: {seconds}s left',
  'mutagens.reason.wear_needs_biomatter': 'Needs {cost} biomatter',
  'mutagens.gene_worn': '🧬 {icon} {name} worn ({cost} biomatter). Settling.',
  'mutagens.reason.already_own_sequence': 'Already wearing your own sequence',
  'mutagens.reason.no_such_socket': 'No such socket',
  'mutagens.reason.not_a_mutagen': 'That is not a mutagen',
  'mutagens.reason.socket_empty': 'That socket is empty',
  'mutagens.reason.no_edge': 'No edge between those',
  'mutagens.reason.already_established': 'Already established',
  'mutagens.edge_coiled': '🧵 Edge established: {a}–{b} ({cost} histones).',
  'mutagens.reason.edge_not_established': 'Edge not established',
  'mutagens.reason.already_cut': 'Already cut',
  'mutagens.reason.edge_not_cut': 'Edge not cut',

  // ---------- prestige ----------
  'prestige.boon_bought': '♻️ {icon} {name} rank {rank}: {cost} point{plural} spent.',

  // ---------- psionic ----------
  'psionic.reason.not_whole_points': 'Points must be whole and non-negative',
  'psionic.reason.no_such_axis': 'No such axis: {axis}',
  'psionic.reason.axis_locked': '{axis} needs a teacher',
  'psionic.reason.axis_cap': '{axis} cap is {cap} points (Psionics milestones raise it)',
  'psionic.reason.empty_shape': 'Shape is empty',

  // ---------- quests ----------
  'quests.completed': '🎉 Quest complete: {name}{rewards}',
  'quests.rewards': ': {list}',
  'quests.npc_met': '🤝 Met {name}.',
  'quests.accepted': '📜 Quest accepted: {name}',
  'quests.ready': '📜 "{name}" complete. Return to {giver} at {spot}.',

  // ---------- resources ----------
  'resources.stamina_low': '😮‍💨 Winded: no strength behind your blows until stamina recovers.',
  'resources.stamina_empty': '🥵 Spent: slowed until stamina recovers.',
  'resources.stamina_recovered': '💪 Recovered: stamina penalties gone.',

  // ---------- runecarving ----------
  'runecarving.carved_named': '{icon} Carved {name} (named rune).',
  'runecarving.carved': '{icon} Carved: {name}',
  'runecarving.reason.no_such_pattern': 'No such pattern',
  'runecarving.reason.pattern_level': '{name} needs Runecarving {level}',
  'runecarving.reason.nothing_chosen': 'No rune chosen to carve',
  'runecarving.reason.too_many_copies': 'A slab holds at most {max} copies of one pattern',
  'runecarving.reason.slab_grade': '{copies}× {name} needs a {grade} slab or better',
  'runecarving.reason.no_slab': 'No slab on the bench',
  'runecarving.reason.slab_refuse': "An F-grade slab can't be carved: it gives negative stats",
  'runecarving.reason.adornment_refuse': "{name} is F-grade and can't be used: it gives negative stats",
  'runecarving.slab_split': '💥 Slab split. The slab and materials are used up.',

  // ---------- runes ----------
  'runes.sold_many': 'Sold {count} rune{plural} for {price} gold.',
  'runes.discarded_many': 'Discarded {count} rune{plural}.',
  'runes.found': '{icon} Rune found: {name}{qty}',
  'runes.socketed': '{icon} Socketed {name} into {itemIcon} {item}.',
  'runes.sold': 'Sold {icon} {name} for {price} gold.',
  'runes.discarded': 'Discarded {icon} {name}.',

  // ---------- safety ----------
  'safety.wake': '{reason} You wake at {icon} {spot}.',

  // ---------- shops ----------
  'shops.bought': 'Bought {icon} {name}{qty} for {total} gold.',

  // ---------- skills ----------
  'skills.manifested': '✨ Skill manifested: {icon} {name}.',
  'skills.cap_raised': '⏫ {icon} {name} cap raised to Lv {cap}.',

  // ---------- spellcraft ----------
  'spellcraft.utility_cast': '{icon} {name}{effects}.',
  'spellcraft.effects': ': {list}',
  'spellcraft.reason.no_such_working': 'No such working',
  'spellcraft.reason.needs_target': '{name} needs a target',
  'spellcraft.reason.in_combat': 'In combat: prepare it instead',
  'spellcraft.reason.cooldown': '{name} on cooldown',
  'spellcraft.reason.not_enough_mana': 'Not enough mana',
  'spellcraft.reason.not_enough_focus': 'Not enough focus',
  'spellcraft.prepared_cap': '🔒 Prepared spell limit is {cap}.',
  'spellcraft.prepare_conflict': '⚡ {conflict}',
  'spellcraft.reason.already_inscribed': 'Already in your grimoire. Change or add a word to inscribe a new spell',
  'spellcraft.inscribed': '{icon} Inscribed: {name}',
  'spellcraft.already_shaped': '🔒 Shape already held.',
  'spellcraft.recognition_locked': '🔒 Shape matches {recognition}, which needs a teacher.',
  'spellcraft.shaped': '{icon} Shaped: {name}',

  // ---------- superattrs ----------
  'superattrs.fusion': '{icon} Fusion: {a} and {b} merge into {name} ({value}).',

  // ---------- titles ----------
  'titles.earned': '👑 Title earned: {icon} {name}.',
  'titles.worn': '👑 Title worn: {name}.',

  // ---------- towers ----------
  'towers.moving': '🗼 {verb} to {icon} {name}...',

  // ---------- tutorial ----------
  'levels.up': '⬆️ Level {level}: +{bonus} to every attribute.',
  'levels.floor': '🗼 {name} cleared for the first time this run: +{xp} level XP.',
  'tutorial.armed': '🎒 Taken from the rack and equipped: {list}.',
  'tutorial.unarmed': '👊 Nothing taken from the rack. Fighting unarmed.',
  'tutorial.stance': '🥋 Stance set: {icon} {name}. Change it on the Combat tab at any time.',
  'tutorial.spell': '📖 "{word}" written into your grimoire and prepared. Intelligence 2: mana pool 2.',
  'tutorial.skipped': '⏭️ Tutorial skipped. You stand at {icon} {name}.',
  'tutorial.done': '✅ Tutorial complete. Its panels are on the Quests tab under Guide. Next: The First Ascent (floor 1), from the Warden of the Foot.',
} as const;
