<script lang="ts" module>
  /** Only one touch card at a time, across every Tip: opening one closes the last. */
  const touchCard: { close: (() => void) | null } = { close: null };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cardTop } from './tipPlace';
  import { LAYER, pushOverlay } from './overlays';

  // `block` targets wrap non-text content (e.g. resource bars): full-width,
  // no dotted underline. Default targets are inline text (attributes, stats).
  // `touchOnly` wraps a control that keeps its own `title` for a mouse: no hover
  // card, no dotted underline, no help cursor; only a touch gets the card.
  let {
    children,
    tip,
    block = false,
    touchOnly = false,
  }: { children: Snippet; tip: Snippet; block?: boolean; touchOnly?: boolean } = $props();

  let show = $state(false);
  let x = $state(0);
  let y = $state(0);
  /** Touch: a full-width card under (or over) the target instead of a side popup. */
  let wide = $state(false);
  let target: HTMLElement;
  let card = $state<HTMLElement>();

  function enter(e: PointerEvent) {
    if (e.pointerType === 'touch' || touchOnly) return;
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
    wide = true;
    x = 8;
    y = 8;
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

  /**
   * Under the target, or over it when the card does not fit below, and never
   * outside the window: measured once the card is on the page, since its height
   * is its content's. A card taller than the window scrolls inside itself.
   */
  function fit() {
    if (!card) return;
    const rect = target.getBoundingClientRect();
    y = cardTop(rect.top, rect.bottom, card.offsetHeight, window.innerHeight);
  }
  $effect(() => {
    if (card && wide) fit();
  });

  // The touch card is an overlay: Escape and the Android back button put it
  // away through the stack (lib/overlays.ts), over every window. The hover
  // popup is not one: it goes with the pointer.
  $effect(() => {
    if (show && wide) return pushOverlay(LAYER.tip, hide);
  });

  // A tap anywhere else puts the card away; scrolling does too, except inside
  // the card itself, which a tall one scrolls.
  $effect(() => {
    if (!show || !wide) return;
    const away = (e: PointerEvent) => {
      const at = e.target as Node;
      if (!target.contains(at) && !card?.contains(at)) hide();
    };
    const scrolled = (e: Event) => {
      if (e.target !== card) hide();
    };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('scroll', scrolled, true);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('scroll', scrolled, true);
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
  class:touch-only={touchOnly}
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
  <div class="tip-pop" class:wide bind:this={card} use:portal style="left: {x}px; top: {y}px">
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

  .tip-target.touch-only {
    cursor: inherit;
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
    box-shadow: 0 6px 20px var(--lift);
    pointer-events: none;
  }

  /* The touch card: the window's width less 8px a side (and the notch's
     insets), as tall as its text up to the window, scrolling past that. */
  .tip-pop.wide {
    width: calc(100vw - 16px - var(--safe-left) - var(--safe-right));
    max-width: none;
    min-width: 0;
    margin-left: var(--safe-left);
    max-height: calc(100vh - 16px);
    max-height: calc(100dvh - 16px);
    overflow-y: auto;
    overscroll-behavior: contain;
    font-size: 13px;
    pointer-events: auto;
  }

  /* The lines inside a card, whoever writes them: plain (a figure), base (the
     heading), total (the sum, ruled off) and sub (a section label). They were
     in Sidebar.svelte; the sidebar is not on every layout (docs/PHONE.md). */
  :global(.tip-line) {
    color: var(--xp-ink);
  }

  :global(.tip-line.tip-base) {
    color: var(--text-dim);
    margin-bottom: 2px;
  }

  :global(.tip-line.tip-total) {
    color: var(--accent);
    font-weight: 600;
    border-top: 1px solid var(--border);
    margin-top: 3px;
    padding-top: 3px;
  }

  :global(.tip-line.tip-sub) {
    color: var(--text-dim);
    margin-top: 4px;
  }

  /* A long press shows the card: the browser's own selection and callout stay out of its way. */
  @media (hover: none) {
    .tip-target {
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
  }
</style>
