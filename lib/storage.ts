let currentUserId: string | null = null;

export function setActiveUserId(userId: string | null) {
  currentUserId = userId;
}

export function getActiveUserId(): string | null {
  return currentUserId;
}

export function getStoragePrefix(): string {
  if (currentUserId) {
    return `doctorx_u_${currentUserId}_`;
  }
  return 'doctorx_v1_';
}

export function getStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  try {
    const prefix = getStoragePrefix();
    let raw = window.localStorage.getItem(`${prefix}${key}`);

    // If not found in user-namespaced storage, check if legacy storage exists to seamlessly migrate
    if (raw === null && prefix !== 'doctorx_v1_') {
      const legacyRaw = window.localStorage.getItem(`doctorx_v1_${key}`);
      if (legacyRaw !== null) {
        window.localStorage.setItem(`${prefix}${key}`, legacyRaw);
        raw = legacyRaw;
      }
    }

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
    const prefix = getStoragePrefix();
    window.localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
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
    const prefix = getStoragePrefix();
    window.localStorage.removeItem(`${prefix}${key}`);
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
    const prefix = getStoragePrefix();
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith(prefix) || key.startsWith('doctorx_v1_'))) {
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
  const prefix = getStoragePrefix();
  const data: Record<string, unknown> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      try {
        data[key.replace(prefix, '')] = JSON.parse(window.localStorage.getItem(key) || 'null');
      } catch {
        data[key.replace(prefix, '')] = window.localStorage.getItem(key);
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
