'use client';

import React from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { DuplicateGroup } from '@/lib/compliance/phash';
import { GeneratorItemState } from '@/lib/generator/queue';
import { Copy, Layers, Check, ShieldAlert, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DuplicatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: DuplicateGroup[];
  items: GeneratorItemState[];
  onToggleExclude: (itemId: string, exclude: boolean) => void;
  onKeepFirstExcludeRest: (group: DuplicateGroup) => void;
}

export function DuplicatesDialog({
  open,
  onOpenChange,
  groups,
  items,
  onToggleExclude,
  onKeepFirstExcludeRest,
}: DuplicatesDialogProps) {
  const itemMap = new Map(items.map((i) => [i.id, i]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Review Near-Duplicate Images ({groups.length} groups)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Adobe strictly penalizes near-identical submissions. Uncheck redundant files to exclude them from export.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pt-3 pr-1">
          {groups.map((group, groupIdx) => {
            const groupItems = group.itemIds
              .map((id) => itemMap.get(id))
              .filter((it): it is GeneratorItemState => it !== undefined);

            return (
              <div
                key={group.groupId || groupIdx}
                className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[11px] border border-amber-500/25">
                      Group {groupIdx + 1}
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {groupItems.length} similar files detected
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onKeepFirstExcludeRest(group)}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    <span>Keep first / Exclude rest</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {groupItems.map((item, idx) => {
                    const isExcluded = !!item.isExcluded;

                    return (
                      <div
                        key={item.id}
                        onClick={() => onToggleExclude(item.id, !isExcluded)}
                        className={`group relative flex flex-col rounded-xl border p-2 cursor-pointer transition-all ${
                          isExcluded
                            ? 'opacity-50 bg-muted/30 border-dashed border-border'
                            : 'bg-accent/10 border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-muted/30 mb-2">
                          <Image
                            src={item.fileData.previewUrl}
                            alt={item.fileData.originalName}
                            fill
                            className="object-contain"
                            unoptimized
                          />

                          {/* Checkbox badge */}
                          <div
                            className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-md flex items-center justify-center text-[10px] shadow-sm transition-colors ${
                              !isExcluded
                                ? 'bg-primary text-primary-foreground font-bold'
                                : 'bg-black/40 text-muted-foreground border border-white/20'
                            }`}
                          >
                            {!isExcluded && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>

                          {isExcluded && (
                            <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
                              <span className="px-2 py-0.5 rounded bg-muted/90 text-foreground font-bold text-[10px] shadow-sm border border-border">
                                Excluded
                              </span>
                            </div>
                          )}
                        </div>

                        <p
                          className="text-[11px] font-semibold text-foreground truncate"
                          title={item.fileData.originalName}
                        >
                          {item.fileData.originalName}
                        </p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                          {item.title || 'Untitled'}
                        </p>

                        <div className="pt-1.5 mt-auto flex items-center justify-between text-[10px]">
                          <span className={!isExcluded ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-muted-foreground'}>
                            {!isExcluded ? 'Included' : 'Excluded'}
                          </span>
                          {idx === 0 && (
                            <span className="text-[9px] font-bold text-primary">
                              (Primary)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="pt-3 border-t border-border/50">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Done Reviewing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
