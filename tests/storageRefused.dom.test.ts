import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';

// Where the browser refuses its storage the game saves to memory (core/save/save.ts
// `browserStorage`). That must not look like a save: the boot logs one danger line
// and the Menu's Save row says the save does not persist. `storagePersists` is the
// flag; here it is false.

vi.mock('../src/core/save/save', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/core/save/save')>()),
  storagePersists: false,
}));

const { gs } = await import('../src/ui/state.svelte');
const { default: SystemMenu } = await import('../src/ui/SystemMenu.svelte');

let app: ReturnType<typeof mount> | undefined;
afterEach(() => {
  if (app) unmount(app);
  app = undefined;
});

describe('storage the browser refuses', () => {
  it('logs one danger line at boot', () => {
    const lines = gs.log.filter((l) => l.msg.includes('Storage: this browser refuses site data'));
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe('danger');
  });

  it('the Menu’s Save row says the save does not persist, and a save reads as kept in memory', () => {
    app = mount(SystemMenu, { target: document.body });
    flushSync();
    (document.querySelector('.sysmenu-open') as HTMLButtonElement).click();
    flushSync();
    const row = [...document.querySelectorAll('.sysmenu-row')].find((r) => r.textContent?.includes('Save:'))!;
    expect(row.textContent).toContain('does not persist');
    expect(row.textContent).not.toContain('writes the game to this browser');
    (row.querySelector('button') as HTMLButtonElement).click();
    flushSync();
    expect(row.textContent).toContain('Kept in memory at');
    expect(row.textContent).not.toContain('Saved at');
  });
});
