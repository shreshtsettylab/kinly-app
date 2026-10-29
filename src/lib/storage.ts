const storagePrefix = 'kinly-demo';

// Some browsers block localStorage (private mode) or it can be full. Keep a copy
// in memory so the app still works for the current visit instead of crashing.
const memoryStore = new Map<string, string>();

function getItem(key: string): string | null {
  if (memoryStore.has(key)) return memoryStore.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setItem(key: string, value: string): void {
  memoryStore.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable — the in-memory copy above is used for this visit.
  }
}

export function readLocalCollection<T>(key: string, fallback: T[]): T[] {
  const stored = getItem(`${storagePrefix}:${key}`);
  if (!stored) {
    writeLocalCollection(key, fallback);
    return fallback;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    writeLocalCollection(key, fallback);
    return fallback;
  }
}

// Reads a collection without writing anything back — for backups, which must never change local data.
export function peekLocalCollection(key: string): unknown[] {
  const stored = getItem(`${storagePrefix}:${key}`);
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalCollection<T>(key: string, values: T[]): void {
  setItem(`${storagePrefix}:${key}`, JSON.stringify(values));
}

export function removeLocalCollection(key: string): void {
  const fullKey = `${storagePrefix}:${key}`;
  memoryStore.delete(fullKey);
  try {
    window.localStorage.removeItem(fullKey);
  } catch {
    // Storage unavailable — nothing was saved there to remove.
  }
}

export function createLocalId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
