<script lang="ts">
  /**
   * A draggable divider between two panes.
   *
   * It governs ONE pane's width and reports the new value; the parent owns the
   * number so it can persist it. `invert` says the governed pane sits after the
   * handle, where dragging right has to shrink it rather than grow it.
   *
   * The visible line is 1px but the grab area is 9px — a 1px hit target is a
   * cruel joke, and a splitter you have to aim at is worse than none.
   */
  interface Props {
    size: number;
    onsize: (next: number) => void;
    /** Double-click restores this. */
    onreset?: () => void;
    min?: number;
    max?: number;
    invert?: boolean;
    label?: string;
  }
  let { size, onsize, onreset, min = 160, max = 900, invert = false, label = 'Resize panel' }: Props =
    $props();

  let dragging = $state(false);
  let startX = 0;
  let startSize = 0;

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  function down(ev: PointerEvent): void {
    if (ev.button !== 0) return;
    ev.preventDefault();
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    dragging = true;
    startX = ev.clientX;
    startSize = size;
  }

  function move(ev: PointerEvent): void {
    if (!dragging) return;
    const delta = ev.clientX - startX;
    onsize(clamp(invert ? startSize - delta : startSize + delta));
  }

  function key(ev: KeyboardEvent): void {
    const step = ev.shiftKey ? 48 : 12;
    if (ev.key === 'ArrowLeft') onsize(clamp(size + (invert ? step : -step)));
    else if (ev.key === 'ArrowRight') onsize(clamp(size + (invert ? -step : step)));
    else return;
    ev.preventDefault();
  }
</script>

<!--
  A focusable `separator` IS the ARIA window-splitter pattern — with
  aria-valuenow/min/max it is a widget, not decoration. Svelte's accessibility
  rules only know the decorative kind, hence the two suppressions.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="splitter"
  class:dragging
  role="separator"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuenow={Math.round(size)}
  aria-valuemin={min}
  aria-valuemax={max}
  tabindex="0"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={() => (dragging = false)}
  onpointercancel={() => (dragging = false)}
  ondblclick={() => onreset?.()}
  onkeydown={key}
>
  <span class="grip"></span>
</div>

<style>
  .splitter {
    flex: 0 0 auto;
    width: 9px;
    margin: 0 -4px; /* overlap the neighbours so no layout gap appears */
    cursor: col-resize;
    background: transparent;
    border: none;
    padding: 0;
    position: relative;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
  }

  .grip {
    width: 1px;
    height: 100%;
    background: var(--border);
    transition: background 0.12s, width 0.12s;
  }

  .splitter:hover .grip,
  .splitter:focus-visible .grip,
  .splitter.dragging .grip {
    background: var(--accent);
    width: 2px;
  }

  .splitter:focus {
    outline: none;
  }

  /* While dragging, the pointer is captured here, so the cursor must not flicker
     back to whatever it passes over. */
  .splitter.dragging {
    cursor: col-resize;
  }
</style>
