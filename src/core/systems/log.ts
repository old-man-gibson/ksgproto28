import type {
  DamageReport,
  FeedEntry,
  FloatingAffliction,
  GameState,
  LogEntry,
  LogTally,
} from '../types';
import type { EventBus } from '../engine/events';

/**
 * A report of its own, sharing nothing with the one it came from.
 *
 * ⚠️ LOAD-BEARING. `appendFeed` folds ONE entry object into two lists — the
 * live feed and the fight's transcript — and the moment a report can be MERGED
 * rather than merely stored, a shared object is merged twice per blow and the
 * two lists corrupt each other. A four-blade rotation would read about 1.75×
 * its real total while the line's own text stayed correct, because the text is
 * rebuilt from the tally, which was already being copied for this exact reason.
 */
function cloneReport(r: DamageReport): DamageReport {
  return { ...r, steps: r.steps.map((s) => ({ ...s })), slices: r.slices.map((s) => ({ ...s })) };
}

/**
 * Two reports of one running line, added up.
 *
 * SLICES ACCUMULATE and STEPS ARE REPLACED, which is the same contract a flurry
 * already ships: the slices say what N blows did to the target, the steps say
 * how ONE of them was arrived at. Newest-wins on steps rather than
 * oldest-sticks, because the only term that varies across a rotation is the
 * crit — pinning the tooltip to the first blow would describe a swing that did
 * not crit under a line that says it did, and would go stale the moment a blade
 * was swapped mid-fight.
 *
 * Rates (`resistance`, `pierced`) are taken from the newest slice rather than
 * summed: they are shares of a blow, and two of them do not make a bigger one.
 *
 * Written here rather than reusing combat.ts's `addSlice` on purpose — combat.ts
 * already imports this module, and borrowing that helper would close a cycle for
 * the sake of six lines.
 */
function mergeReport(prev: DamageReport | undefined, next: DamageReport): DamageReport {
  if (!prev) return cloneReport(next);
  const slices = prev.slices.map((s) => ({ ...s }));
  for (const add of next.slices) {
    const seen = slices.find((s) => s.type === add.type && s.source === add.source);
    if (!seen) {
      slices.push({ ...add });
      continue;
    }
    seen.raw += add.raw;
    seen.armor += add.armor;
    seen.resisted += add.resisted;
    seen.dealt += add.dealt;
    if (seen.warded !== undefined || add.warded !== undefined) {
      seen.warded = (seen.warded ?? 0) + (add.warded ?? 0);
    }
    seen.resistance = add.resistance;
    seen.pierced = add.pierced;
  }
  return {
    ...next,
    steps: next.steps.map((s) => ({ ...s })),
    slices,
    hits: prev.hits + next.hits,
    crit: prev.crit || next.crit,
    total: prev.total + next.total,
  };
}

/** How many lines the feed keeps. Grouping is what makes this go far. */
export const LOG_MAX = 60;

/**
 * How many lines the *fight* feed keeps.
 *
 * Shorter than the activity log because it is read live, mid-encounter — which
 * is why folding matters here more than it does there. It was TEN, on the
 * assumption that folding would make ten go a long way; it does not, because
 * folding only reaches the newest entry and any interleaved line breaks a run.
 * Ten lines of a Vashkāra fight covered about four seconds.
 *
 * The pane scrolls, so this is scrollback rather than what fits on screen.
 */
export const FEED_MAX = 40;

/**
 * Rounded for display only. Counts arrive as integers and are unaffected; a
 * running damage total does not, and must be allowed to accumulate at full
 * precision — rounding each tick's fraction as it lands would floor a slow
 * bleed to nothing and report zero for damage the bearer really took.
 */
function renderTally(t: LogTally): string {
  const qty = Math.round(t.qty);
  if (t.style === 'amount') return `${qty} ${t.label}`;
  return qty > 1 ? `${t.label} ×${qty}` : t.label;
}

/** "🔨 Crafted 🪨 Iron Ingot ×12" or "🧺 Gathered: 🌿 Herb ×4, 🪵 Hardwood ×2". */
export function renderLine(prefix: string, tally: LogTally[]): string {
  return `${prefix} ${tally.map(renderTally).join(', ')}`.trim();
}

/**
 * Append a line, folding a repeat into the one above it. Only the newest entry
 * can absorb a repeat, so anything logged in between — a level-up, a monster,
 * running out of materials — ends the run and starts a fresh line. Each thing
 * the run produced keeps its own count, so an activity with several outputs
 * reads as one line listing all of them.
 */
export function appendLog(state: GameState, entry: LogEntry): void {
  const last = state.log[state.log.length - 1];
  if (entry.group && last?.group === entry.group && last.prefix !== undefined && last.tally) {
    for (const add of entry.tally ?? []) {
      const seen = last.tally.find((t) => t.label === add.label);
      if (seen) seen.qty += add.qty;
      else last.tally.push({ ...add });
    }
    last.msg = renderLine(last.prefix, last.tally);
    last.t = entry.t; // the line is as recent as its latest contribution
    return;
  }
  state.log.push(entry);
  if (state.log.length > LOG_MAX) state.log.splice(0, state.log.length - LOG_MAX);
}

/**
 * Emit a groupable line. Consecutive emissions sharing `group` collapse into
 * a single running tally rather than one line per repetition.
 */
export function logRepeat(
  bus: EventBus,
  opts: { group: string; prefix: string; tally: LogTally[]; kind?: string },
): void {
  bus.emit({
    type: 'log',
    msg: renderLine(opts.prefix, opts.tally),
    kind: opts.kind,
    group: opts.group,
    prefix: opts.prefix,
    tally: opts.tally,
  });
}

/**
 * The fight feed's version of `logRepeat` — same folding rule, different
 * surface. It lives here rather than beside `feed()` in combat.ts so that
 * anything ticking conditions can reach it: the player's afflictions burn
 * down in actions.ts, outside the combat path entirely, because bleeding out
 * while chopping wood is a real outcome.
 *
 * Folding mutates the newest entry in place, which is deliberately invisible
 * to `stepToEvent` (game.ts): "⏭ Next" treats a repeated tick as nothing new
 * to say and runs on to something that is.
 */
export function feedRepeat(
  state: GameState,
  opts: { group: string; prefix: string; tally: LogTally[]; damage?: DamageReport },
): void {
  appendFeed(state, {
    text: renderLine(opts.prefix, opts.tally),
    group: opts.group,
    prefix: opts.prefix,
    // Copied, not aliased: the caller rebuilds its tally every tick and the
    // folded line goes on accumulating into whatever it was given first.
    tally: opts.tally.map((t) => ({ ...t })),
    ...(opts.damage ? { damage: opts.damage } : {}),
  });
}

/**
 * How many folded lines a fight keeps for its notebook transcript.
 *
 * Deeper than the live feed because this one is read afterwards rather than
 * over your shoulder — but still a CAP, not a recording. Folding and floating
 * runs are what make it cover a real fight: a poison phase that would have been
 * eighty lines is one of them.
 *
 * ⚠️ Must stay ABOVE `FEED_MAX`. The whole point of the transcript is that it
 * remembers what the live feed has already dropped, and a shallower one would
 * quietly make "Last fight" the lesser record.
 */
export const TRANSCRIPT_MAX = 60;

/**
 * AFFLICTIONS DO NOT GET LINES OF THEIR OWN.
 *
 * Folding (`feedRepeat`) only reaches the NEWEST entry, so a bleed running
 * across an exchange was broken by every swing in between: one running line,
 * then a swing, then a fresh running line, then a swing. A long poison still
 * shouldered the fight that caused it out of a ten-line feed, which is the
 * exact problem folding was added to solve.
 *
 * So an affliction run is not an entry at all. It accumulates here, is drawn
 * against whatever line is newest, and settles onto that line only when it
 * ends — after which it rides down the feed with it as new lines push in
 * above. What the poison cost you stays beside the exchange it was burning
 * through, instead of being spread over every line the fight produced.
 */
export function feedFloating(
  state: GameState,
  opts: { group: string; prefix: string; tally: LogTally[]; ids: string[]; damage?: DamageReport },
): void {
  // NOT `(state.floatingFeed ??= [])` — under Svelte's proxy the expression
  // yields the RAW array, so everything pushed through it goes unnoticed.
  if (!state.floatingFeed) state.floatingFeed = [];
  let run = state.floatingFeed.find((f) => f.group === opts.group);
  if (!run) {
    run = { group: opts.group, prefix: opts.prefix, tally: [], ids: [] };
    state.floatingFeed.push(run);
    run = state.floatingFeed[state.floatingFeed.length - 1];
  }
  for (const add of opts.tally) {
    const seen = run.tally.find((t) => t.label === add.label);
    if (seen) seen.qty += add.qty;
    else run.tally.push({ ...add });
  }
  for (const id of opts.ids) if (!run.ids.includes(id)) run.ids.push(id);
  // A run that reports damage accumulates its working the same way it
  // accumulates its total — one merge rule for both, so a running line and a
  // folded one can never explain themselves differently.
  if (opts.damage) run.report = mergeReport(run.report, opts.damage);
}

/** Whether a run is still going — i.e. anyone still holds what feeds it. */
export function floatingRun(state: GameState, group: string): FloatingAffliction | undefined {
  return state.floatingFeed?.find((f) => f.group === group);
}

/**
 * The run is over. Freeze its total onto the newest line in each list, where it
 * will ride down as the feed fills above it.
 */
export function settleFloating(state: GameState, group: string): void {
  const live = state.floatingFeed ?? [];
  const at = live.findIndex((f) => f.group === group);
  if (at < 0) return;
  const [run] = live.splice(at, 1);
  if (!run.tally.length) return;
  // Nothing to stick to — the run outlived every line there was, so it becomes
  // one rather than being dropped on the floor.
  if (!state.combatFeed.length) {
    appendFeed(state, { text: renderLine(run.prefix, run.tally) });
    return;
  }
  stick(state.combatFeed, run);
  if (state.fight) stick(state.fight.transcript, run);
}

function stick(list: FeedEntry[], run: FloatingAffliction): void {
  const last = list[list.length - 1];
  if (!last) return;
  if (!last.afflictions) last.afflictions = [];
  last.afflictions.push({
    prefix: run.prefix,
    tally: run.tally.map((t) => ({ ...t })),
    // Each list settles its own copy, for the same reason each folds its own.
    ...(run.report ? { report: cloneReport(run.report) } : {}),
  });
}

/**
 * The one door a fight line goes through, so the live feed and the fight's own
 * transcript can never disagree about what happened.
 *
 * The transcript is written straight onto `state.fight` rather than through the
 * ledger module, because it is an array on the state and reaching for it here
 * keeps log.ts free of a cycle. A missing ledger simply means nothing is being
 * tallied yet, which is not this module's problem to fix.
 */
export function appendFeed(state: GameState, entry: FeedEntry): void {
  fold(state.combatFeed, entry, FEED_MAX);
  if (state.fight) fold(state.fight.transcript, entry, TRANSCRIPT_MAX);
}

/**
 * A transcript with its working stripped out, for the SAVE.
 *
 * A damage report is a live hover affordance — you read it during, or just
 * after, the exchange it explains, and in memory the transcript keeps every one
 * of them. On disk it must not: a report runs about a kilobyte, and three of
 * them cost more than every other thing a kept fight remembers put together.
 * Measured, not guessed — a four-blade fight fell from 3.9 KB to 1.7 KB.
 *
 * Stripped at the persistence boundary rather than at the write boundary, so
 * nothing in the running game is made poorer to make the save smaller.
 */
export function transcriptForSave(entries: FeedEntry[]): FeedEntry[] {
  return entries.map((e) => {
    const { damage: _dropped, ...rest } = e;
    if (!e.afflictions?.length) return rest;
    return {
      ...rest,
      afflictions: e.afflictions.map(({ report: _r, ...run }) => run),
    };
  });
}

/** Append into one feed list, folding a repeat into the newest entry. */
function fold(list: FeedEntry[], entry: FeedEntry, max: number): void {
  const last = list[list.length - 1];
  if (entry.group && last?.group === entry.group && last.prefix !== undefined && last.tally) {
    for (const add of entry.tally ?? []) {
      const seen = last.tally.find((t) => t.label === add.label);
      if (seen) seen.qty += add.qty;
      else last.tally.push({ ...add });
    }
    last.text = renderLine(last.prefix, last.tally);
    // A run opened by a MISS has a tally and no report, so the first landing
    // strike is what installs one — `mergeReport` handles the absent side.
    if (entry.damage) last.damage = mergeReport(last.damage, entry.damage);
    return;
  }
  // Each list owns its copy — the two fold independently and trim at different
  // depths, so a shared entry object would let one list's fold rewrite the
  // other's history. The report is copied for the same reason and, now that it
  // accumulates, with teeth: see `cloneReport`.
  list.push({
    ...entry,
    tally: entry.tally?.map((t) => ({ ...t })),
    ...(entry.damage ? { damage: cloneReport(entry.damage) } : {}),
  });
  if (list.length > max) list.splice(0, list.length - max);
}
