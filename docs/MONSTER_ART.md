# Monster art

Every monster in `src/core/data/monsters.data.ts` names a battler in `art`, so
the battle stage, the bestiary and the festival royale draw a portrait and
never the emoji `icon` (the icon stays as the fallback for a build with no art
and no art pack). This page records which file each of the 78 monsters that had
none was given (2026-11-13) and why. The other 53 were mapped earlier (slimes,
the floor 0 to 3 archive, Death Knight, Paladin X, Psionic Slime) and are not
changed here.

The files are the licensed Ækashics/Librarium battlers in `src/assets/enemies/`
(gitignored, redistribution forbidden: [AUTHORSHIP §9](AUTHORSHIP.md)). This
page holds filenames only. How the files reach a build and the Android app:
[ART_PACK.md](ART_PACK.md).

## How the stage draws them

`BattleStage.svelte` draws every portrait at a fixed 92 px height, width by
aspect, and multiplies it by the monster's size tag: `small` 0.85, `large`
1.15, `huge` and `gargantuan` 1.3. The file's own pixel size changes nothing.
So "bigger" comes from the tags and from how elaborate the picture is: a
`Boss …` file for a boss, keeper or champion, a plain one for the rank and file.

The royale field map (`RoyaleField.svelte`) is an SVG and draws every
fighter, cache and den as its emoji `icon`, with or without `art`. Only the
fight stage and the bestiary draw the portrait. That map is unchanged here.

## Rules used

1. Match by name or role first (wolf, goblin, cobra, scorpion, golem, mummy,
   harpy, pirate, marine), then look at the picture.
2. A monster family may share a creature series (the three Ore Eater growth
   stages are two worms, an armoured worm and the Boss Death Worm; the sea
   beast and its brood are both red tentacle bodies).
3. No two different monsters of one floor, or of one fight, share a file.
   Across floors a series repeats (Mercenary Axe on floor 16, Sword Brute on
   floor 11).
4. Bosses, keepers and champions get a `Boss …` file or the grandest file of
   their series. Humans get human battlers.
5. A filename with a glob character (`* ? [ ] { } ( ) ! + @ \`) cannot be named:
   `scripts/enemyArt.ts` throws. A comma is allowed.

Shared before this change, left as is: the four basic slimes
(`slime_base_basic.png`: Cell, Slime, Cage-Bred, Suspiciously Large), and the
Malgeri slimes, guardian, king and legionary, which reuse the file of the
matching slime from another floor.

## Mapping

| Monster | File | Reason |
| --- | --- | --- |
| toll_collector_golem | Rock golem | Plain stone golem for a basic-tier gate boss. |
| forest_rat | Essential Animal Monsters - Firece Rat | Single large rat. |
| young_wolf | Hunter Pet Wolf | Small grey wolf, the young end of the wolf line. |
| wolf | Forest Wolf | Full-size forest wolf. |
| boar | Wild Boar | Bulky bristled boar, large. |
| cliff_hawk | Hunter Pet Hawk | Plain hawk in flight; wind element needs no effect art. |
| cave_spider | Essential Animal Monsters - Poisonous Spider | Spider with glowing venom sacs, toxic. |
| stone_golem | Golem Diamond | Faceted stone body; elite and large. |
| giant_spider_queen | Forest Imperial Widow | Largest plain spider of the set, huge. |
| goblin | Goblin Grunt | Base goblin of the goblin series. |
| goblin_boss | Boss Goblin King | Legendary goblin: the goblin series' boss file. |
| goblin_raid_leader | Goblin Flag Bearer | A leader marked by a flag, veteran. |
| goblin_warchief | Boss Champion Goblin | Armoured goblin, elite and large. |
| goblin_firetongue | Goblin Mage | Goblin with a staff, ranged fire caster. |
| goblin_witch_doctor | Goblin Sorcerer | Shaman with staff and furs, healer. |
| hobgoblin | Forest Goblin Sword | Larger goblin with a sword, veteran. |
| hobgoblin_champion | Boss Orc Chief Grunt | Orc-sized champion, elite and large. |
| training_dummy | Training Dummies Swordie | Dummy file in the folder, armed variant. |
| benchmark_dummy | Wooden Doll Warriors A | Neutral wooden mannequin: the baseline post. |
| reinforced_post | Enchanted Chess Piece Tower | Black armoured rook: armour 100. |
| swaying_post | Training Dummies Assassin | Hooded dummy: the evasion post. |
| flopping_post | Static Turrets B | The one post that attacks: a turret. |
| warded_post | Arcane Crystal Magic Circle | Crystal in a ring: the elemental ward. |
| mending_post | Earth Mandrake | Plant: the regenerating post. |
| ph_siege_raider | Mercenary Sword Brute | Floor 11 attacker with a sword, slashing. |
| ph_siege_brute | Orc Axe Warrior | Large axe bruiser, bludgeoning. |
| ph_siege_captain | Boss The Conqueror | Floor 11 wave boss: huge-sword fighter. |
| ph_corsair | Pirates Swashbuckler Talon | Cutlass and shield pirate. |
| ph_bandit_thug | Thief Rogue Berserker | Bare-chested axe bandit, bludgeoning. |
| ph_bandit_archer | Thief Rogue Crossbow | Crossbow bandit, ranged. |
| ph_bandit_cutthroat | Bandit Daggers | Dagger bandit, dirty stab. |
| ph_bandit_chief | Boss Gnoll Bandit Lord | Named "Bandit Lord"; large and elite. |
| ph_camp_demon | Boss Amalgamate | Fused mass: "absorbed the bandits". |
| ph_rogue_beast_young | Werewolf Rigel | Pale werewolf, before its change. |
| ph_rogue_beast_final | Boss Vampiric Beast Hakan | Dark hulking werewolf, after its change. |
| ph_death_squire | Skeleton Knight Debon | Armoured skeleton: a lower rank than the Death Knight. |
| ph_ore_eater_1 | Insects Giant Bug Death Worm A | Stage 1: pale grub with a mouth. |
| ph_ore_eater_2 | Cave Dweller Worm | Stage 2: larger toothed worm. |
| ph_ore_eater_3 | Insects Giant Bug Death Worm B | Stage 3: armoured worm sitting in ore. |
| ph_ore_eater_4 | Boss Death Worm | Stage 4: spiked giant worm, gargantuan. |
| ph_reef_eel | Essential Animal Monsters - Burly Snake | Long pale body; the folder has no eel. |
| ph_deep_serpent | Dragons Sea Dragon | Coiled blue sea serpent, large. |
| ph_brood_matron | Underwater Corruption Octopus | Red tentacle body, the sea beast's brood. |
| ph_sea_beast | Boss Calthusian Sea Dragon | Larger red tentacle body, the same family, huge. |
| ph_pirate_cutthroat | Pirate Bandit | Striped pirate with two blades. |
| ph_pirate_gunner | Bandit Flintlock | Pistol and cutlass, bandana. |
| ph_pirate_captain | Pirate Captain | Exact role. |
| ph_pirate_king | Boss Pirate Captain | Coat, epaulettes, hook: the grander captain. |
| ph_convoy_guard | Town Guard B | Plumed spear guard. |
| ph_navy_marine | Human Soldier C | Blue armour for the navy. |
| ph_navy_frigate | Heroes Duelist Natalia | Officer with a long sword. |
| ph_galleon_master | Boss Mythical Knight Goldnharl | Silver admiral with cape; the galleon's master. |
| ph_port_warden | Cephalo Pirate Lord | Raider lord holding the port; large. |
| ph_room_brawler | Villager Riot Machete | Hooded machete fighter in the dark room. |
| ph_room_bruiser | Medieval Bandit Dagger Gun | Broad heavy fighter, large. |
| ph_room_last | Boss Blade Master | Armoured scythe knight: the last of the nine. |
| ph_survivor_blade | Rogue Twin Dagger | Twin-dagger fighter, piercing. |
| ph_survivor_brute | Mercenary Axe | Axe fighter, large. |
| ph_survivor_champion | Boss Ascended Daimyo | Armoured katana champion, slashing. |
| ph_den_harpy | Wind Harpy | Harpy with wings spread, the nest. |
| ph_den_serpent | Colossal Snake | Poison-coloured cobra for the pool. |
| ph_den_wolf | Spirit Beast Wolf | Tawny wolf, the forest den. |
| ph_den_bear | Predatory Animals Grizzly Bear | Plain large bear. |
| ph_den_hound | Update Diamond Dog | Dog with spikes, the village yard. |
| malgeri_goblin | Goblin Raider | Small goblin with a blade. |
| malgeri_goblin_chief | Goblin Spider Rider | Chief mounted on a spider, among the caves. |
| malgeri_cave_spider | Cave Monsters Earth Spider | Spiked cave spider. |
| malgeri_brood_queen | Boss Insect Queen | Winged spider queen, huge. |
| malgeri_ridge_wolf | Mountain Winter Wolf | White mountain wolf, elite. |
| malgeri_cairn_brute | Obsidian Golem | Dark stone body, large construct. |
| malgeri_hollow_seer | Darkness Cultist Mage | Hooded dark caster with orbs. |
| ph_scarab | Insects Scarab | Small beetle. |
| ph_cobra | Egypt Cobra | Hooded cobra. |
| ph_scorpion | Desert Scorpion | Scorpion. |
| ph_mummy | Egypt Mummy B | Wrapped mummy. |
| ph_sand_colossus | Desert Sand Colossus | Exact name, large. |
| ph_sabaket | Boss Anubis, God Of Death | The Weigher at the Door: Anubis. |
| ph_roadstead_crew | Egypt Knight | Shield and sickle sailor of the delta; three at once. |

## Adding a portrait

Name the file in `art:`, run `npm run enemy-art` (rewrites
`src/ui/lib/enemyArt.gen.ts`), then `npm run art-pack` to repack. Details:
[CONTENT_GUIDE §4a](CONTENT_GUIDE.md) and [ART_PACK.md](ART_PACK.md).

## Size

All 131 monsters name 119 distinct files, 14.6 MB. The whole art pack
(portraits, icons, tile sheets, 139 files) is 16.5 MB.
