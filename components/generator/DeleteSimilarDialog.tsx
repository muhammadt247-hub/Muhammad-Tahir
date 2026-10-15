'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GeneratorItemState } from '@/lib/generator/queue';
import { SimilarityCluster } from '@/types/similarity';
import { Layers, Trash2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface DeleteSimilarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: GeneratorItemState[];
  clusters: SimilarityCluster[];
  onConfirmDelete: (deletedItems: GeneratorItemState[]) => void;
}

export function DeleteSimilarDialog({
  open,
  onOpenChange,
  items,
  clusters,
  onConfirmDelete,
}: DeleteSimilarDialogProps) {
  const [alsoRemoveExported, setAlsoRemoveExported] = useState(false);

  const itemMap = new Map<string, GeneratorItemState>(items.map((it) => [it.id, it]));

  // 1. Group similar-excluded items with their keepers
  interface ClusterGroup {
    keeper: GeneratorItemState;
    toRemove: GeneratorItemState[];
  }

  const groups: ClusterGroup[] = [];
  const handledIds = new Set<string>();

  // Process clusters
  for (const cluster of clusters) {
    const keeper = itemMap.get(cluster.winnerId) || itemMap.get(cluster.itemIds[0]);
    if (!keeper) continue;

    const toRemove: GeneratorItemState[] = [];
    for (const id of cluster.itemIds) {
      if (id === keeper.id) continue;
      const it = itemMap.get(id);
      if (it && it.isExcluded && !it.excludedReason?.startsWith('Already exported')) {
        toRemove.push(it);
        handledIds.add(it.id);
      }
    }

    if (toRemove.length > 0) {
      groups.push({ keeper, toRemove });
    }
  }

  // Any other similar-excluded items not in formal clusters (e.g. pairwise matches)
  const orphanSimilar = items.filter(
    (it) =>
      it.isExcluded &&
      !handledIds.has(it.id) &&
      !it.excludedReason?.startsWith('Already exported') &&
      it.excludedReason !== "Below Adobe's 4 MP minimum, likely refused"
  );

  if (orphanSimilar.length > 0) {
    // Attempt to find keeper by match name or fallback
    const keeperName = orphanSimilar[0]?.excludedReason?.replace(/^Similar to\s+/i, '') || 'Keeper';
    const keeper = items.find((it) => it.fileData.originalName === keeperName) || items.find((it) => !it.isExcluded);
    if (keeper) {
      groups.push({ keeper, toRemove: orphanSimilar });
    } else {
      groups.push({
        keeper: {
          ...orphanSimilar[0],
          fileData: { ...orphanSimilar[0].fileData, originalName: 'Selected best asset' },
        },
        toRemove: orphanSimilar,
      });
    }
  }

  // 2. Already exported items
  const exportedItems = items.filter(
    (it) => it.isExcluded && it.excludedReason?.startsWith('Already exported')
  );

  // Calculate items to delete
  const clusterItemsToDelete = groups.flatMap((g) => g.toRemove);
  const itemsToDelete = alsoRemoveExported
    ? [...clusterItemsToDelete, ...exportedItems]
    : clusterItemsToDelete.length > 0
    ? clusterItemsToDelete
    : exportedItems;

  const totalDeleteCount = itemsToDelete.length;

  const handleConfirm = () => {
    onConfirmDelete(itemsToDelete);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center">
              <Trash2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Delete Similar Files
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Remove redundant duplicate images from this batch to protect against spam rejection.
                Keeper images will not be deleted.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Groups List */}
        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
          {groups.length === 0 && exportedItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No similar or duplicate files found to remove.
            </div>
          ) : (
            groups.map((group, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-border/50 bg-accent/15 space-y-2.5"
              >
                {/* Keeper Header */}
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="truncate">
                      Keeping: <span className="font-bold underline">{group.keeper.fileData.originalName}</span>
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shrink-0 uppercase tracking-wider">
                    Keeper
                  </span>
                </div>

                {/* Thumbnail strip of files to be removed */}
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Removing {group.toRemove.length} duplicate file{group.toRemove.length === 1 ? '' : 's'}:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {group.toRemove.map((file) => (
                      <div
                        key={file.id}
                        className="p-1.5 rounded-lg border border-destructive/25 bg-destructive/5 space-y-1 relative group"
                      >
                        <div className="relative aspect-video w-full rounded bg-black/20 overflow-hidden">
                          <Image
                            src={file.fileData.previewUrl || file.fileData.aiDataUrl}
                            alt={file.fileData.originalName}
                            fill
                            className="object-contain"
                            unoptimized
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <p
                          className="text-[10px] font-medium text-foreground truncate"
                          title={file.fileData.originalName}
                        >
                          {file.fileData.originalName}
                        </p>
                        <span className="text-[9px] text-destructive block truncate">
                          {file.excludedReason || 'Similar to keeper'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Already Exported Section (if present) */}
          {exportedItems.length > 0 && alsoRemoveExported && (
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Already Exported Files ({exportedItems.length})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {exportedItems.map((file) => (
                  <div
                    key={file.id}
                    className="p-1.5 rounded-lg border border-amber-500/25 bg-card space-y-1"
                  >
                    <div className="relative aspect-video w-full rounded bg-black/20 overflow-hidden">
                      <Image
                        src={file.fileData.previewUrl || file.fileData.aiDataUrl}
                        alt={file.fileData.originalName}
                        fill
                        className="object-contain"
                        unoptimized
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <p
                      className="text-[10px] font-medium text-foreground truncate"
                      title={file.fileData.originalName}
                    >
                      {file.fileData.originalName}
                    </p>
                    <span className="text-[9px] text-amber-600 block truncate">
                      {file.excludedReason || 'Already exported'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Checkbox: Also remove files already exported */}
        {exportedItems.length > 0 && (
          <div className="pt-2 border-t border-border/40">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground font-medium select-none">
              <input
                type="checkbox"
                checked={alsoRemoveExported}
                onChange={(e) => setAlsoRemoveExported(e.target.checked)}
                className="h-4 w-4 rounded border-border/60 text-primary focus:ring-primary/20 accent-primary"
              />
              <span>
                Also remove files already exported ({exportedItems.length} file{exportedItems.length === 1 ? '' : 's'})
              </span>
            </label>
          </div>
        )}

        <DialogFooter className="pt-3 border-t border-border/40 flex items-center justify-between sm:justify-between w-full">
          <p className="text-[11px] text-muted-foreground">
            Files are removed from this session only. Your computer files are never modified.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={totalDeleteCount === 0}
              onClick={handleConfirm}
              className="text-xs font-semibold gap-1.5 bg-destructive text-destructive-foreground hover:opacity-90"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete {totalDeleteCount} file{totalDeleteCount === 1 ? '' : 's'}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
