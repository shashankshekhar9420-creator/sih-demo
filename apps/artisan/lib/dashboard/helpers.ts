// Pure helpers shared across dashboard features. No DB/IO.

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round2(((current - previous) / previous) * 100);
}

export function daysBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

/** Sorted day keys for last N days ending at `now` (inclusive). */
export function lastNDayKeys(now: Date, n: number): string[] {
  const keys: string[] = [];
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - i);
    keys.push(toDateKey(d));
  }
  return keys;
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = m.get(k);
    if (arr) arr.push(item);
    else m.set(k, [item]);
  }
  return m;
}
