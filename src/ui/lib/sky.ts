import type { GameState } from '../../core/types';
import { SKILLS } from '../../core/registry';
import {
  DARK_DODGE_PENALTY,
  DARK_MISS_CHANCE,
  MOONLIGHT_MAX,
  MOONLIGHT_THROUGH,
  moonlightOn,
} from '../../core/systems/exposure';

/**
 * The text behind the header's dark chip, shared by the desktop header
 * (App.svelte) and the phone dock's sky line (SkyStrip.svelte).
 */

/** The dark chip's moonlight line; empty where the dark is not the open sky's. */
export function moonLine(moon: ReturnType<typeof moonlightOn>): string {
  if (!moon) return '';
  const cut = Math.round(MOONLIGHT_MAX * moon.lit * 100);
  if (cut > 0) return `\nMoonlight: −${cut}% darkness`;
  if (moon.kind && MOONLIGHT_THROUGH[moon.kind] === 0) return `\nMoonlight: none (${moon.kind})`;
  return '\nMoonlight: none';
}

/**
 * What the dark costs now, Darkvision's offset and the moon's. `dark` is
 * `darknessFactor(gs)`: 0 (you can see fine) to 1. Lines are separated by "\n".
 */
export function darkText(state: GameState, dark: number): string {
  const dodge = Math.round(DARK_DODGE_PENALTY * dark * 100);
  const miss = Math.round(DARK_MISS_CHANCE * dark * 100);
  const level = state.skills.darkvision?.level ?? 0;
  const seen = level > 0 ? ` · ${SKILLS.darkvision.name} ${level} is buying it back` : '';
  return `You are fighting in the dark: −${dodge}% dodge, +${miss}% chance of your attacks missing${seen}${moonLine(moonlightOn(state))}`;
}
