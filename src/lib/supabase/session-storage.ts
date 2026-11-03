import * as SecureStore from 'expo-secure-store';

/**
 * Keeps the Supabase session (access + refresh token) in the iOS Keychain /
 * Android Keystore instead of plain AsyncStorage.
 *
 * Some iOS versions reject Keychain values over ~2 KB and a session can be
 * larger than that, so values are split into chunks under `<key>.0`, `<key>.1`, …
 * with the chunk count stored under `<key>.n`.
 */
const CHUNK_SIZE = 1800;

// SecureStore keys may only contain letters, digits, ".", "-" and "_".
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

async function removeChunks(base: string) {
  const count = Number(await SecureStore.getItemAsync(`${base}.n`)) || 0;
  await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${base}.${i}`)));
  await SecureStore.deleteItemAsync(`${base}.n`);
}

export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const base = safeKey(key);
    const count = Number(await SecureStore.getItemAsync(`${base}.n`)) || 0;
    if (!count) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${base}.${i}`))
    );
    // A missing chunk means a partial write; treat the session as gone.
    if (parts.some((part) => part == null)) return null;
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const base = safeKey(key);
    await removeChunks(base);
    const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, 'g')) ?? [''];
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(`${base}.${i}`, chunk)));
    await SecureStore.setItemAsync(`${base}.n`, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    await removeChunks(safeKey(key));
  },
};
