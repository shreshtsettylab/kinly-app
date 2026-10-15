const storagePrefix = 'kinly-demo';

export function readLocalCollection<T>(key: string, fallback: T[]): T[] {
  const stored = window.localStorage.getItem(`${storagePrefix}:${key}`);
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

export function writeLocalCollection<T>(key: string, values: T[]): void {
  window.localStorage.setItem(`${storagePrefix}:${key}`, JSON.stringify(values));
}

export function createLocalId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
