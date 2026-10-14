'use client';

import React, { useState } from 'react';
import { Bookmark, Plus, Check } from 'lucide-react';
import { Asset } from '@/types/asset';
import { useMoodboards } from '@/hooks/useMoodboards';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SaveToBoardPopoverProps {
  asset: Asset;
  children: React.ReactNode;
}

export function SaveToBoardPopover({ asset, children }: SaveToBoardPopoverProps) {
  const { boards, createBoard, toggleAssetInBoard, isAssetInBoard } = useMoodboards();
  const [newBoardName, setNewBoardName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    const id = createBoard(newBoardName.trim());
    toggleAssetInBoard(id, asset);
    setNewBoardName('');
    setCreating(false);
    toast.success(`Saved to "${newBoardName.trim()}"`);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3 rounded-2xl shadow-xl">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Bookmark className="h-3.5 w-3.5" />
              Save to Board
            </span>
          </div>

          {/* List of Boards */}
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {boards.map((board) => {
              const inBoard = isAssetInBoard(board.id, asset.id);
              return (
                <button
                  key={board.id}
                  onClick={() => {
                    toggleAssetInBoard(board.id, asset);
                    if (!inBoard) {
                      toast.success(`Added to "${board.name}"`);
                    } else {
                      toast.info(`Removed from "${board.name}"`);
                    }
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors text-left',
                    inBoard
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-accent text-foreground'
                  )}
                >
                  <span className="truncate flex-1">{board.name}</span>
                  <div
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                      inBoard
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border/60 bg-background'
                    )}
                  >
                    {inBoard && <Check className="h-3 w-3" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Create New Board Inline */}
          {creating ? (
            <form onSubmit={handleCreate} className="space-y-2 pt-1 border-t border-border/40">
              <Input
                autoFocus
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="Board name..."
                className="h-8 text-xs rounded-lg"
              />
              <div className="flex gap-1.5">
                <Button type="submit" size="sm" className="h-7 text-xs flex-1">
                  Create &amp; Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreating(false)}
                  className="h-7 text-xs px-2"
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border/60 p-2 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors justify-center"
            >
              <Plus className="h-3.5 w-3.5" />
              New Moodboard
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
