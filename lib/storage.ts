const STORAGE_PREFIX = 'doctorx_v1_';

export function getStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[DOCTORx Storage] Failed reading key "${key}":`, error);
    return defaultValue;
  }
}

export function setStorageItem<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[DOCTORx Storage] Failed writing key "${key}":`, error);
    return false;
  }
}

export function removeStorageItem(key: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    return true;
  } catch (error) {
    console.warn(`[DOCTORx Storage] Failed removing key "${key}":`, error);
    return false;
  }
}

export function clearAllDoctorXStorage(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    return true;
  } catch (error) {
    console.warn('[DOCTORx Storage] Failed clearing storage:', error);
    return false;
  }
}

export function exportAllDoctorXData(): string {
  if (typeof window === 'undefined') return '{}';
  const data: Record<string, unknown> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      try {
        data[key.replace(STORAGE_PREFIX, '')] = JSON.parse(window.localStorage.getItem(key) || 'null');
      } catch {
        data[key.replace(STORAGE_PREFIX, '')] = window.localStorage.getItem(key);
      }
    }
  }
  return JSON.stringify(data, null, 2);
}

export function importDoctorXData(jsonString: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const data = JSON.parse(jsonString) as Record<string, unknown>;
    for (const [key, val] of Object.entries(data)) {
      setStorageItem(key, val);
    }
    return true;
  } catch (error) {
    console.warn('[DOCTORx Storage] Failed importing data:', error);
    return false;
  }
}
