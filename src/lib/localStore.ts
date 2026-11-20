/**
 * Fallback storage for environments without localStorage (Node, tests).
 * Metro picks `localStore.web.ts` on web and `localStore.native.ts` on native.
 */
const memory = new Map<string, string>();

export function getItem(key: string): string | null {
  return memory.get(key) ?? null;
}

export function setItem(key: string, value: string): void {
  memory.set(key, value);
}
