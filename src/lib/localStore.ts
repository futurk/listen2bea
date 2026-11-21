/**
 * Storage fallback for web, Node and tests. Metro picks `localStore.native.ts`
 * on native platforms, where the expo-sqlite localStorage polyfill is installed.
 */
const memory = new Map<string, string>();

export function getItem(key: string): string | null {
  try {
    const storage = globalThis.localStorage;
    if (storage) {
      return storage.getItem(key);
    }
  } catch {
    // Storage can be unavailable (private mode, quota); fall back to memory.
  }

  return memory.get(key) ?? null;
}

export function setItem(key: string, value: string): void {
  try {
    const storage = globalThis.localStorage;
    if (storage) {
      storage.setItem(key, value);
      return;
    }
  } catch {
    // Fall through to the in-memory store.
  }

  memory.set(key, value);
}
