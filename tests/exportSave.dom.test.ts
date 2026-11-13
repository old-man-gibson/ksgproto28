import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Export in the Android app writes the save to the cache folder and opens the
// share sheet (ui/lib/nativeExport.ts); in a browser it clicks a download link.
// `exportSave` picks (ui/state.svelte.ts). The plugins are stubs: the bridge is
// native, and what is checked is what is asked of them.

const filesystem = vi.hoisted(() => ({ writeFile: vi.fn() }));
const share = vi.hoisted(() => ({ share: vi.fn() }));
const core = vi.hoisted(() => ({ native: false }));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: filesystem,
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));
vi.mock('@capacitor/share', () => ({ Share: share }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => core.native } }));

const { shareTextFile } = await import('../src/ui/lib/nativeExport');
const { exportSave, game } = await import('../src/ui/state.svelte');

const NAME = /^frontier-idle-save-\d{4}-\d{2}-\d{2}\.json$/;

beforeEach(() => {
  vi.clearAllMocks();
  core.native = false;
});
afterEach(() => vi.restoreAllMocks());

/** Run `exportSave` and let its promise settle. */
async function exported(): Promise<string[]> {
  const logs: string[] = [];
  const off = game.bus.on('log', (e) => logs.push(e.msg));
  exportSave();
  await new Promise((r) => setTimeout(r, 0));
  off();
  return logs;
}

describe('shareTextFile', () => {
  it('writes the text to the cache folder, then opens the share sheet on that file', async () => {
    filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/save.json' });
    share.share.mockResolvedValue({});
    expect(await shareTextFile('save.json', '{"a":1}')).toEqual({ ok: true });
    expect(filesystem.writeFile).toHaveBeenCalledWith({
      path: 'save.json',
      data: '{"a":1}',
      directory: 'CACHE',
      encoding: 'utf8',
    });
    expect(share.share.mock.calls[0][0].files).toEqual(['file:///cache/save.json']);
  });

  it('reports a dismissed sheet as dismissed, not as a failure of the file', async () => {
    filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/save.json' });
    share.share.mockRejectedValue(new Error('Share canceled'));
    expect(await shareTextFile('save.json', '{}')).toMatchObject({ ok: false, dismissed: true });
  });

  it('reports a write that failed, with its reason, and never throws', async () => {
    filesystem.writeFile.mockRejectedValue(new Error('disk full'));
    expect(await shareTextFile('save.json', '{}')).toEqual({ ok: false, dismissed: false, reason: 'disk full' });
    expect(share.share).not.toHaveBeenCalled();
  });
});

describe('exportSave', () => {
  it('on Android shares the save as a dated JSON file and clicks no download link', async () => {
    core.native = true;
    filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/x.json' });
    share.share.mockResolvedValue({});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const logs = await exported();
    const written = filesystem.writeFile.mock.calls[0][0];
    expect(written.path).toMatch(NAME);
    expect(() => JSON.parse(written.data)).not.toThrow();
    expect(JSON.parse(written.data).version).toBeGreaterThan(0);
    expect(share.share).toHaveBeenCalledTimes(1);
    expect(click).not.toHaveBeenCalled();
    expect(logs).toEqual([]);
  });

  it('on Android says so in the log when the file could not be written', async () => {
    core.native = true;
    filesystem.writeFile.mockRejectedValue(new Error('disk full'));
    const logs = await exported();
    expect(logs).toEqual(['❌ Save export failed: disk full']);
  });

  it('on Android says nothing when the player dismisses the share sheet', async () => {
    core.native = true;
    filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/x.json' });
    share.share.mockRejectedValue(new Error('Share canceled'));
    expect(await exported()).toEqual([]);
  });

  it('in a browser clicks a download link for the same dated name, and shares nothing', async () => {
    const urls: Blob[] = [];
    vi.stubGlobal('URL', {
      createObjectURL: (b: Blob) => {
        urls.push(b);
        return 'blob:x';
      },
      revokeObjectURL: () => {},
    });
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    await exported();
    vi.unstubAllGlobals();
    expect(click).toHaveBeenCalledTimes(1);
    expect(names[0]).toMatch(NAME);
    expect(urls).toHaveLength(1);
    expect(filesystem.writeFile).not.toHaveBeenCalled();
    expect(share.share).not.toHaveBeenCalled();
  });
});
