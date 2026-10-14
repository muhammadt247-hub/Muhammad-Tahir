'use client';

import { useLocalStorage } from './useLocalStorage';
import { useCallback } from 'react';
import { SearchMode } from '@/types/asset';

export interface SearchHistoryItem {
  query: string;
  mode: SearchMode;
  timestamp: string;
}

export function useSearchHistory() {
  const [history, setHistory] = useLocalStorage<SearchHistoryItem[]>('search_history', []);

  const addSearch = useCallback(
    (query: string, mode: SearchMode) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      setHistory((prev) => {
        const filtered = prev.filter(
          (item) => !(item.query.toLowerCase() === trimmed.toLowerCase() && item.mode === mode)
        );
        const next: SearchHistoryItem = {
          query: trimmed,
          mode,
          timestamp: new Date().toISOString(),
        };
        return [next, ...filtered].slice(0, 20);
      });
    },
    [setHistory]
  );

  const removeSearch = useCallback(
    (query: string, mode: SearchMode) => {
      setHistory((prev) =>
        prev.filter((item) => !(item.query === query && item.mode === mode))
      );
    },
    [setHistory]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, [setHistory]);

  return {
    history,
    addSearch,
    removeSearch,
    clearHistory,
  };
}
