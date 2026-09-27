<script lang="ts" module>
  /** Only one touch card at a time, across every Tip: opening one closes the last. */
  const touchCard: { close: (() => void) | null } = { close: null };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  // `block` targets wrap non-text content (e.g. resource bars): full-width,
  // no dotted underline. Default targets are inline text (attributes, stats).
  let { children, tip, block = false }: { children: Snippet; tip: Snippet; block?: boolean } =
    $props();

  let show = $state(false);
  let x = $state(0);
  let y = $state(0);
  /** Touch: a full-width card under (or over) the target instead of a side popup. */
  let wide = $state(false);
  let target: HTMLElement;

  function enter(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    wide = false;
    x = Math.max(8, Math.min(rect.right + 10, window.innerWidth - 320));
    y = Math.min(rect.top - 4, window.innerHeight - 260);
    show = true;
  }
  function leave(e: PointerEvent) {
    if (e.pointerType !== 'touch') show = false;
  }

  // ---------- touch: tap to toggle, long-press on controls ----------
  //
  // Hover does not exist on a phone, and the tooltips carry every stat
  // breakdown in the game. A tap on plain content toggles the card; a tap on
  // a control inside the target stays the control's (a button still presses),
  // and a long press shows the card there instead — without pressing.

  const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"]';
  const LONG_PRESS_MS = 450;
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let longPressed = false;

  function openTouch() {
    const rect = target.getBoundingClientRect();
    wide = true;
    x = 8;
    const below = rect.bottom + 6;
    y = below + 180 < window.innerHeight ? below : Math.max(8, rect.top - 186);
    if (touchCard.close && touchCard.close !== hide) touchCard.close();
    touchCard.close = hide;
    show = true;
  }
  function hide() {
    show = false;
    if (touchCard.close === hide) touchCard.close = null;
  }

  function down(e: PointerEvent) {
    if (e.pointerType !== 'touch') return;
    longPressed = false;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      longPressed = true;
      openTouch();
    }, LONG_PRESS_MS);
  }
  function up() {
    clearTimeout(pressTimer);
  }
  function click(e: MouseEvent) {
    // The click after a long press belongs to the card, not the control.
    if (longPressed) {
      longPressed = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!matchMedia('(hover: none)').matches) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    if (show) hide();
    else openTouch();
  }

  // A tap anywhere else puts the card away; scrolling does too.
  $effect(() => {
    if (!show || !wide) return;
    const away = (e: PointerEvent) => {
      if (!target.contains(e.target as Node)) hide();
    };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('scroll', hide, true);
    };
  });

  /**
   * The popup lives on <body>, not where the target is. `position: fixed` is
   * only fixed to the viewport while no ancestor has a transform — and the
   * battle stage positions and scales every combatant with one, which would
   * pin a foe's card inside the stage and clip it. Moved out, it never can be.
   */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
</script>

<span
  class="tip-target"
  class:block
  role="note"
  bind:this={target}
  onpointerenter={enter}
  onpointerleave={leave}
  onpointerdown={down}
  onpointerup={up}
  onpointercancel={up}
  onclickcapture={click}
  oncontextmenu={(e) => longPressed && e.preventDefault()}
>
  {@render children()}
</span>
{#if show}
  <div class="tip-pop" class:wide use:portal style="left: {x}px; top: {y}px">
    {@render tip()}
  </div>
{/if}

<style>
  .tip-target {
    cursor: help;
    border-bottom: 1px dotted color-mix(in srgb, var(--text-dim) 60%, transparent);
  }

  .tip-target.block {
    display: block;
    border-bottom: none;
  }

  .tip-pop {
    position: fixed;
    z-index: 100;
    min-width: 200px;
    max-width: 310px;
    background: var(--bg-panel);
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 8px 11px;
    font-size: 12px;
    line-height: 1.45;
    box-shadow: 0 6px 20px rgb(0 0 0 / 45%);
    pointer-events: none;
  }

  .tip-pop.wide {
    width: calc(100vw - 16px);
    max-width: calc(100vw - 16px);
    min-width: 0;
    font-size: 13px;
  }

  @media (hover: none) {
    .tip-target {
      -webkit-touch-callout: none;
    }
  }
</style>
