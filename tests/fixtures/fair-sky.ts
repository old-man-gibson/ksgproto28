// Imported for its effect, like ./shelved-world: empties SKY_RULES for the test
// file that imports it (each file has its own module graph).
//
// SKY_RULES put a status on whoever stands under an open sky: snow chills, rain
// wets, gale buffets. Every open-sky place carries them, Threshold and floor 0
// included, and the new game starts on a winter morning. A test whose subject
// is gathering, brewing or pacing, not weather, would then measure the weather:
// a slowed action bar moves a gather count or a coating's wear-off by one.
// Those files import this and run under a sky that does nothing; the rules
// themselves are tested in tests/sky.test.ts.
import { SKY_RULES } from '../../src/core/data/climate.data';

for (const kind of Object.keys(SKY_RULES) as (keyof typeof SKY_RULES)[]) delete SKY_RULES[kind];
