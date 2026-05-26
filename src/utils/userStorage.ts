/**
 * Утилиты для работы с localStorage, привязанного к конкретному пользователю.
 * Ключи вида: "u_{userId}_{key}"
 */

export function uKey(userId: number | string, key: string): string {
  return `u_${userId}_${key}`;
}

export function uGet<T>(userId: number | string, key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(uKey(userId, key));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function uSet(userId: number | string, key: string, value: unknown): void {
  try {
    localStorage.setItem(uKey(userId, key), JSON.stringify(value));
  } catch { /* ignore */ }
}

export function uRemove(userId: number | string, key: string): void {
  try {
    localStorage.removeItem(uKey(userId, key));
  } catch { /* ignore */ }
}
