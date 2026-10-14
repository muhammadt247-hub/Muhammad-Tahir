'use client';

import { useLocalStorage } from './useLocalStorage';
import { Moodboard } from '@/types/moodboard';
import { Asset } from '@/types/asset';
import { useCallback, useEffect } from 'react';

const DEFAULT_BOARDS: Moodboard[] = [
  {
    id: 'default-favorites',
    name: 'Favorites',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assets: [],
  },
];

export function useMoodboards() {
  const [boards, setBoards] = useLocalStorage<Moodboard[]>('moodboards', DEFAULT_BOARDS);

  useEffect(() => {
    if (!boards || boards.length === 0) {
      setBoards(DEFAULT_BOARDS);
    }
  }, [boards, setBoards]);

  const createBoard = useCallback(
    (name: string): string => {
      const trimmed = name.trim() || 'New Board';
      const newId = 'board_' + Date.now();
      const newBoard: Moodboard = {
        id: newId,
        name: trimmed,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assets: [],
      };
      setBoards((prev) => [newBoard, ...(prev || [])]);
      return newId;
    },
    [setBoards]
  );

  const renameBoard = useCallback(
    (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      setBoards((prev) =>
        prev.map((b) =>
          b.id === id ? { ...b, name: trimmed, updatedAt: new Date().toISOString() } : b
        )
      );
    },
    [setBoards]
  );

  const duplicateBoard = useCallback(
    (id: string) => {
      setBoards((prev) => {
        const target = prev.find((b) => b.id === id);
        if (!target) return prev;
        const copy: Moodboard = {
          ...target,
          id: 'board_' + Date.now(),
          name: `${target.name} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          assets: [...target.assets],
        };
        return [copy, ...prev];
      });
    },
    [setBoards]
  );

  const deleteBoard = useCallback(
    (id: string) => {
      setBoards((prev) => {
        const filtered = prev.filter((b) => b.id !== id);
        return filtered.length > 0 ? filtered : DEFAULT_BOARDS;
      });
    },
    [setBoards]
  );

  const addAssetToBoard = useCallback(
    (boardId: string, asset: Asset) => {
      setBoards((prev) =>
        prev.map((b) => {
          if (b.id !== boardId) return b;
          if (b.assets.some((a) => a.id === asset.id)) return b;
          return {
            ...b,
            updatedAt: new Date().toISOString(),
            assets: [asset, ...b.assets],
          };
        })
      );
    },
    [setBoards]
  );

  const removeAssetFromBoard = useCallback(
    (boardId: string, assetId: string) => {
      setBoards((prev) =>
        prev.map((b) => {
          if (b.id !== boardId) return b;
          return {
            ...b,
            updatedAt: new Date().toISOString(),
            assets: b.assets.filter((a) => a.id !== assetId),
          };
        })
      );
    },
    [setBoards]
  );

  const toggleAssetInBoard = useCallback(
    (boardId: string, asset: Asset) => {
      setBoards((prev) =>
        prev.map((b) => {
          if (b.id !== boardId) return b;
          const exists = b.assets.some((a) => a.id === asset.id);
          return {
            ...b,
            updatedAt: new Date().toISOString(),
            assets: exists
              ? b.assets.filter((a) => a.id !== asset.id)
              : [asset, ...b.assets],
          };
        })
      );
    },
    [setBoards]
  );

  const isAssetInBoard = useCallback(
    (boardId: string, assetId: string): boolean => {
      const board = boards.find((b) => b.id === boardId);
      return board ? board.assets.some((a) => a.id === assetId) : false;
    },
    [boards]
  );

  const isAssetInAnyBoard = useCallback(
    (assetId: string): boolean => {
      return boards.some((b) => b.assets.some((a) => a.id === assetId));
    },
    [boards]
  );

  const clearBoard = useCallback(
    (boardId: string) => {
      setBoards((prev) =>
        prev.map((b) => (b.id === boardId ? { ...b, assets: [], updatedAt: new Date().toISOString() } : b))
      );
    },
    [setBoards]
  );

  return {
    boards: boards || DEFAULT_BOARDS,
    createBoard,
    renameBoard,
    duplicateBoard,
    deleteBoard,
    addAssetToBoard,
    removeAssetFromBoard,
    toggleAssetInBoard,
    isAssetInBoard,
    isAssetInAnyBoard,
    clearBoard,
  };
}
