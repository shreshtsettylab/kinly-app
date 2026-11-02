// Each account keeps its own Kinly data on this device, and people who aren't signed in have a
// separate guest space. So signing out hides your data, signing back in brings it back, and
// someone else signing in on the same computer never sees it.
const GUEST_PREFIX = 'kinly-demo';
const accountPrefix = (userId: string) => `kinly-u-${userId}`;
let storagePrefix = GUEST_PREFIX;

// Every collection Kinly keeps for a space.
const COLLECTIONS = ['people', 'plans', 'goals', 'reflections', 'profile', 'checkins', 'settings', 'usage', 'flags'];

// Some browsers block localStorage (private mode) or it can be full. Keep a copy
// in memory so the app still works for the current visit instead of crashing.
const memoryStore = new Map<string, string>();

// Points reads and writes at the signed-in account's space, or the guest space when signed out.
export function setStorageScope(userId: string | null): void {
  storagePrefix = userId ? accountPrefix(userId) : GUEST_PREFIX;
}

// The first time someone signs in on this device, anything they made before signing in moves
// into their account's space, so nothing is lost. It never overwrites an account's existing data.
export function adoptGuestData(userId: string): boolean {
  const target = accountPrefix(userId);
  if (COLLECTIONS.some((key) => getItem(`${target}:${key}`) !== null)) return false;
  const hasContent = ['people', 'plans', 'goals', 'reflections', 'checkins'].some((key) => {
    try { return (JSON.parse(getItem(`${GUEST_PREFIX}:${key}`) ?? '[]') as unknown[]).length > 0; } catch { return false; }
  });
  if (!hasContent) return false;
  for (const key of COLLECTIONS) {
    const value = getItem(`${GUEST_PREFIX}:${key}`);
    if (value === null) continue;
    setItem(`${target}:${key}`, value);
    removeItem(`${GUEST_PREFIX}:${key}`);
  }
  return true;
}

// True when any space on this device has Kinly data, so the home page can say "Open Kinly".
export function deviceHasKinlyData(): boolean {
  try {
    if (window.localStorage.getItem(`${GUEST_PREFIX}:people`) !== null) return true;
    for (let index = 0; index < window.localStorage.length; index++) if (window.localStorage.key(index)?.startsWith('kinly-u-')) return true;
  } catch {
    // Storage unavailable — treat the device as new.
  }
  return false;
}

function removeItem(key: string): void {
  memoryStore.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable — nothing was saved there to remove.
  }
}

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
  removeItem(`${storagePrefix}:${key}`);
}

export function createLocalId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
