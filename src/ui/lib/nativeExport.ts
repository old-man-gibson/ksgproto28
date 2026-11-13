import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Saving a file out of the Android app (docs/ANDROID.md). The WebView drops a
 * download link made from a blob, so there the Export button writes the JSON to
 * the app's cache folder and opens the Android share sheet on it: the player
 * picks Files, Drive or a message to keep the file. Android does not say which
 * choice was made, so the game cannot tell the player the file is saved.
 *
 * The cache file stays until Android clears the app's cache; the next export on
 * the same day replaces it.
 */

/** True inside the Android app, where `exportSave` shares a file instead of clicking a download link. */
export const sharesFiles = (): boolean => Capacitor.isNativePlatform();

/** What dismissing the share sheet looks like: the plugin rejects with this text. */
const DISMISSED = /cancel/i;

export type ShareResult = { ok: true } | { ok: false; dismissed: boolean; reason: string };

/** Write `data` to `name` in the cache folder and open the share sheet on it. Never throws. */
export async function shareTextFile(name: string, data: string): Promise<ShareResult> {
  try {
    const { uri } = await Filesystem.writeFile({
      path: name,
      data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: name, dialogTitle: 'Save the game file', files: [uri] });
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, dismissed: DISMISSED.test(reason), reason };
  }
}
