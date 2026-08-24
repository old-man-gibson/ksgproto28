import type { NoteEvent } from '../../core/types';
import { BAR_UNITS, DEFAULT_BPM, ticksPerUnit, TICKS_PER_UNIT } from '../../core/data/music.data';
import { soundedEvents } from '../../core/systems/music';
import { MS_PER_TICK } from '../../core/engine/loop';

/**
 * The bard's voice: Web Audio synthesis for the music system. UI-side only —
 * the core neither knows nor cares that sheets are audible; this module reads
 * the same NoteEvent data the classifiers do and turns it into plucked,
 * lute-ish tones (triangle oscillator, fast attack, exponential decay,
 * gentle lowpass).
 *
 * Timing is the game's own: one bar takes TICKS_PER_BAR ticks on the stage,
 * so audio uses the identical seconds-per-unit and the sound you hear IS the
 * performance's clock. Within a bar, notes are scheduled sample-accurately on
 * the AudioContext timeline — syncopation is audible, not just measured.
 *
 * Autoplay policy: the context is created and resumed ONLY from user-gesture
 * handlers (`ensureAudio` in the Perform/Listen/mute clicks). `playBar` never
 * creates one — a performance resumed from a loaded save stays silent until
 * the player next touches the stage, which beats a pile-up of stale notes
 * firing the moment a later click unlocks the context.
 */

/** Real seconds one grid unit occupies at ♩=bpm — the game's own unit clock. */
export function secondsPerUnit(bpm: number): number {
  return (ticksPerUnit(bpm) * MS_PER_TICK) / 1000;
}

/** Seconds per unit at the default tempo (12.5 ms). */
export const SECONDS_PER_UNIT = (TICKS_PER_UNIT * MS_PER_TICK) / 1000;
/** Seconds of one COMMON-TIME bar at the default tempo. */
export const SECONDS_PER_BAR = SECONDS_PER_UNIT * BAR_UNITS;

/** Middle C — pitch 0 on the staff. */
const C4_HZ = 261.6256;

export function freqOf(pitch: number): number {
  return C4_HZ * Math.pow(2, pitch / 12);
}

const MUTE_KEY = 'ksg:music-muted';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}

const live = new Set<Voice>();

/**
 * Create (or wake) the audio context. Call ONLY from a click/key handler —
 * browser autoplay rules make any other call site a silent no-op forever.
 */
export function ensureAudio(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return; // no audio device / very old browser — the game plays on, silently
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    // No shared tone filter: every VOICE brings its own cutoff, and a global
    // one here would quietly muffle the bright ones (a driven sawtooth that
    // cannot get past 2.4 kHz is not a guitar, it is a kazoo).
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(on: boolean): void {
  muted = on;
  try {
    localStorage.setItem(MUTE_KEY, on ? '1' : '0');
  } catch {
    // storage full/unavailable — the preference just won't persist
  }
  if (ctx && master) {
    master.gain.setTargetAtTime(on ? 0 : 1, ctx.currentTime, 0.02);
  }
}

/**
 * The voices. Each is a tiny subtractive patch — waveform, envelope, filter,
 * and optionally a waveshaper for drive or a detuned second oscillator for
 * thickness. A plucked lute and a sustained horn are genuinely different
 * instruments here, not the same tone at different volumes.
 *
 * These are a LISTENING preference, deliberately not part of a Composition:
 * real instruments are a designed thing (gear, or a structure at the base —
 * see MUSIC.md §Open), and hard-coding a voice into the sheet now would
 * pre-empt that. What you pick here is what your ear gets.
 */
export interface VoiceDef {
  id: string;
  name: string;
  icon: string;
  wave: OscillatorType;
  /** Seconds to reach full loudness — 0.01 plucks, 0.08 breathes. */
  attack: number;
  /** Level the tone falls to after its initial decay (1 = fully sustained). */
  sustain: number;
  /** Seconds that fall takes. */
  decay: number;
  /** Seconds of tail after the note ends. */
  release: number;
  /** Lowpass corner, Hz. */
  cutoff: number;
  level: number;
  /** Waveshaper drive — 0 is clean, 1 is a wall of amplifier. */
  drive?: number;
  /** Cents of detune on a doubled oscillator; absent = one oscillator. */
  detune?: number;
}

export const VOICES: Record<string, VoiceDef> = {
  lute: { id: 'lute', name: 'Lute', icon: '🪕', wave: 'triangle', attack: 0.012, sustain: 0.1, decay: 1.4, release: 0.06, cutoff: 2400, level: 0.2 },
  pipe: { id: 'pipe', name: 'Pipe', icon: '🎶', wave: 'sine', attack: 0.06, sustain: 0.85, decay: 0.4, release: 0.12, cutoff: 3200, level: 0.24 },
  bell: { id: 'bell', name: 'Bell', icon: '🔔', wave: 'sine', attack: 0.004, sustain: 0.05, decay: 2.4, release: 0.4, cutoff: 5000, level: 0.22, detune: 6 },
  horn: { id: 'horn', name: 'Horn', icon: '📯', wave: 'sawtooth', attack: 0.05, sustain: 0.8, decay: 0.5, release: 0.1, cutoff: 1600, level: 0.16, detune: 8 },
  /** For music that wants to be a problem. Sawtooth into hard drive. */
  growl: { id: 'growl', name: 'Growl', icon: '🎸', wave: 'sawtooth', attack: 0.004, sustain: 0.75, decay: 0.18, release: 0.05, cutoff: 2600, level: 0.13, drive: 0.85, detune: 11 },
};

const VOICE_KEY = 'ksg:music-voice';
let voiceId = (typeof localStorage !== 'undefined' && localStorage.getItem(VOICE_KEY)) || 'lute';

export function currentVoice(): VoiceDef {
  return VOICES[voiceId] ?? VOICES.lute;
}

export function setVoice(id: string): void {
  if (!VOICES[id]) return;
  voiceId = id;
  try {
    localStorage.setItem(VOICE_KEY, id);
  } catch {
    // storage unavailable — the preference just won't persist
  }
}

/** Waveshaper curve: a soft-clip whose knee `drive` sets. Cached per drive. */
const CURVES = new Map<number, Float32Array<ArrayBuffer>>();
function driveCurve(drive: number): Float32Array<ArrayBuffer> {
  const cached = CURVES.get(drive);
  if (cached) return cached;
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = drive * 90;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  CURVES.set(drive, curve);
  return curve;
}

/** One tone in the chosen voice: attack, fall to sustain, release at the end. */
function pluck(at: number, freq: number, durSec: number): void {
  if (!ctx || !master) return;
  const v = currentVoice();
  const gain = ctx.createGain();
  const end = at + durSec;
  const g = gain.gain;
  g.setValueAtTime(0.0001, at);
  g.exponentialRampToValueAtTime(v.level, at + v.attack);
  // Fall toward the sustain level — a lute keeps falling all the way, a
  // pipe barely falls at all. Long notes reach the floor before they end.
  g.exponentialRampToValueAtTime(
    Math.max(0.0002, v.level * v.sustain),
    at + Math.min(durSec, v.attack + v.decay),
  );
  g.exponentialRampToValueAtTime(0.0001, end + v.release);

  // Per-voice colour, then the shared master chain.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = v.cutoff;
  if (v.drive) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = driveCurve(v.drive);
    shaper.oversample = '2x';
    tone.connect(shaper);
    shaper.connect(gain);
  } else {
    tone.connect(gain);
  }
  gain.connect(master);

  const oscs: OscillatorNode[] = [];
  for (const cents of v.detune ? [-v.detune, v.detune] : [0]) {
    const osc = ctx.createOscillator();
    osc.type = v.wave;
    osc.frequency.value = freq;
    osc.detune.value = cents;
    osc.connect(tone);
    osc.start(at);
    osc.stop(end + v.release + 0.05);
    oscs.push(osc);
  }
  const voice: Voice = { osc: oscs[0], gain };
  live.add(voice);
  oscs[oscs.length - 1].onended = () => live.delete(voice);
}

/**
 * Schedule already-folded sounded events (see soundedEvents — a tied group
 * is ONE event with one length, so the ear hears exactly what the analysis
 * read). Rests are what they are on the page: scheduled silence. Notes get
 * 92% of their length — the little gap is what makes repeated notes
 * articulate instead of smearing into one tone.
 */
/**
 * The pedal: one tone held under everything, in the current voice's colour
 * but with an envelope that actually sustains (a lute's pluck would have
 * died long before the piece did) and at a lower level, because it is the
 * floor the melody stands on, not the melody.
 */
function pedalTone(at: number, freq: number, durSec: number): void {
  if (!ctx || !master) return;
  const v = currentVoice();
  const gain = ctx.createGain();
  const level = v.level * 0.55;
  const g = gain.gain;
  g.setValueAtTime(0.0001, at);
  g.exponentialRampToValueAtTime(level, at + Math.max(0.05, v.attack * 3));
  g.setValueAtTime(level, at + durSec);
  g.exponentialRampToValueAtTime(0.0001, at + durSec + 0.25);

  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = v.cutoff * 0.8;
  tone.connect(gain);
  gain.connect(master);

  // Two slightly detuned oscillators however the voice is set: a drone
  // wants to beat a little, or it reads as a test tone.
  const oscs: OscillatorNode[] = [];
  for (const cents of [-(v.detune ?? 4), v.detune ?? 4]) {
    const osc = ctx.createOscillator();
    osc.type = v.wave;
    osc.frequency.value = freq;
    osc.detune.value = cents;
    osc.connect(tone);
    osc.start(at);
    osc.stop(at + durSec + 0.3);
    oscs.push(osc);
  }
  const voice: Voice = { osc: oscs[0], gain };
  live.add(voice);
  oscs[oscs.length - 1].onended = () => live.delete(voice);
}

function scheduleSounded(
  events: { pitch: number | null; units: number; at: number }[],
  bpm: number,
  pedal: number | null = null,
  pedalUnits = 0,
): void {
  if (!ctx || !master) return; // never created here — see the header note
  if (ctx.state === 'suspended') void ctx.resume();
  const spu = secondsPerUnit(bpm);
  const t0 = ctx.currentTime + 0.03;
  for (const e of events) {
    if (e.pitch === null) continue;
    pluck(t0 + e.at * spu, freqOf(e.pitch), e.units * spu * 0.92);
  }
  if (pedal !== null && pedalUnits > 0) {
    pedalTone(t0, freqOf(pedal), pedalUnits * spu);
  }
}

/**
 * Sound one bar of a running performance. Takes the performed bars FROM
 * here on, so a note tied across the barline is scheduled at its true full
 * length instead of being re-struck when the next bar comes round; only the
 * events that actually begin inside this bar are played.
 */
export function playBar(
  barsFromHere: NoteEvent[][],
  barUnits = BAR_UNITS,
  bpm = DEFAULT_BPM,
  pedal: number | null = null,
): void {
  // The pedal is re-struck per bar during a live performance rather than
  // held for the whole set: the stage schedules bar by bar so a pause or an
  // interruption can actually stop it.
  scheduleSounded(soundedEvents(barsFromHere).filter((e) => e.at < barUnits), bpm, pedal, barUnits);
}

/**
 * Audition a whole stretch front to back (the Listen button). Positions are
 * absolute across the bars handed in, so meter and ties both come out right.
 */
export function playSheet(
  bars: NoteEvent[][],
  bpm = DEFAULT_BPM,
  pedal: number | null = null,
  totalUnits = 0,
): void {
  scheduleSounded(soundedEvents(bars), bpm, pedal, totalUnits);
}

/** Cut everything currently sounding, with a short fade instead of a click. */
export function stopMusic(): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const { osc, gain } of live) {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.08);
    try {
      osc.stop(now + 0.1);
    } catch {
      // already stopped
    }
  }
  live.clear();
}
