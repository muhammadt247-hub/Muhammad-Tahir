'use client';

import { useState, useCallback, useEffect } from 'react';
import { getStorageItem, setStorageItem } from '@/lib/storage';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    return getStorageItem<T>(key, initialValue);
  });

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `doctorx_v1_${key}` && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((current) => {
        const nextValue = value instanceof Function ? value(current) : value;
        setStorageItem(key, nextValue);
        return nextValue;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}
