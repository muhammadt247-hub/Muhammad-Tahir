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
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRightLeft,
  Info,
  Check,
  Trash2,
} from 'lucide-react';
import { GeneratorItemState } from '@/lib/generator/queue';
import { SimilarityCluster } from '@/types/similarity';
import { SIMILARITY_HONESTY_NOTE } from '@/config/similarity';

interface SimilarityClustersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clusters: SimilarityCluster[];
  items: GeneratorItemState[];
  onSetWinner: (cluster: SimilarityCluster, newWinnerId: string) => void;
  onOverrideInclude: (itemId: string) => void;
  onDeleteClusterOthers?: (cluster: SimilarityCluster) => void;
}

export function SimilarityClustersDialog({
  open,
  onOpenChange,
  clusters,
  items,
  onSetWinner,
  onOverrideInclude,
  onDeleteClusterOthers,
}: SimilarityClustersDialogProps) {
  const itemMap = new Map<string, GeneratorItemState>(items.map((it) => [it.id, it]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>Similarity Clusters & Exclusions</span>
            </DialogTitle>
            <span className="text-xs px-2.5 py-1 rounded-full bg-orange-500/10 text-primary font-semibold border border-primary/25">
              {clusters.length} Cluster{clusters.length === 1 ? '' : 's'} Detected
            </span>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Adobe Stock rejects near-duplicate submissions as spam. DOCTORx identifies similar series and automatically keeps only the single best asset per cluster. Excluded images are never exported to CSV or ZIP.
          </DialogDescription>
        </DialogHeader>

        {/* Clusters List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {clusters.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-foreground">No similar image clusters found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                All images in this batch are sufficiently distinct to submit without risking spam rejections.
              </p>
            </div>
          ) : (
            clusters.map((cluster, cIdx) => {
              const clusterItems = cluster.itemIds
                .map((id) => itemMap.get(id))
                .filter(Boolean) as GeneratorItemState[];
              const winnerItem = itemMap.get(cluster.winnerId) || clusterItems[0];

              return (
                <div
                  key={cluster.clusterId}
                  className="rounded-2xl border border-border/60 bg-accent/15 overflow-hidden shadow-xs"
                >
                  {/* Cluster Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-accent/30 border-b border-border/40">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        Group {cIdx + 1}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        · {clusterItems.length} similar images
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {cluster.aiReviewed && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                          <Sparkles className="h-3 w-3" />
                          <span>Deep AI Reviewed</span>
                        </span>
                      )}

                      {onDeleteClusterOthers && clusterItems.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onDeleteClusterOthers(cluster)}
                          className="h-6 text-[10px] font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/60 gap-1 px-2"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete the others</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* AI Explanation / Quality Reason */}
                  {(cluster.aiExplanation || cluster.winnerReason) && (
                    <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>
                        <strong>Keeper Reason:</strong>{' '}
                        {cluster.aiExplanation || cluster.winnerReason}
                      </span>
                    </div>
                  )}

                  {/* Items in Cluster */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {clusterItems.map((item) => {
                      const isWinner = item.id === cluster.winnerId;
                      const isExcluded = item.isExcluded ?? !isWinner;
                      const q = item.fingerprint?.quality;

                      return (
                        <div
                          key={item.id}
                          className={`flex flex-col rounded-xl border p-2.5 transition-all ${
                            isWinner
                              ? 'border-emerald-500/60 bg-emerald-500/5 shadow-2xs'
                              : isExcluded
                              ? 'border-amber-500/40 bg-background/60 opacity-90'
                              : 'border-border/60 bg-background'
                          }`}
                        >
                          <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-black/30 border border-border/40 mb-2">
                            <Image
                              src={item.fileData.previewUrl || item.fileData.aiDataUrl}
                              alt={item.fileData.originalName}
                              fill
                              sizes="(max-width: 768px) 100vw, 33vw"
                              className="object-cover"
                              referrerPolicy="no-referrer"
                            />

                            {/* Badge */}
                            <div className="absolute top-2 left-2">
                              {isWinner ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                                  <Check className="h-3 w-3" />
                                  <span>Kept (Winner)</span>
                                </span>
                              ) : isExcluded ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-destructive/90 text-destructive-foreground shadow-xs">
                                  <span>Excluded</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-600 text-white shadow-xs">
                                  <span>Override (Included)</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Filename & Quality Stats */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-xs font-semibold text-foreground truncate" title={item.fileData.originalName}>
                              {item.fileData.originalName}
                            </p>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground font-mono">
                              {q && (
                                <>
                                  <span>{q.width}x{q.height}</span>
                                  <span>· Focus {Math.round(q.sharpness)}</span>
                                  <span>· Q-Score {Math.round(q.overallQualityScore * 100)}%</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="pt-2 mt-2 border-t border-border/30 flex items-center justify-between gap-1">
                            {!isWinner && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onSetWinner(cluster, item.id)}
                                className="h-7 text-[11px] px-2 text-foreground font-medium hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/40 w-full"
                              >
                                <ArrowRightLeft className="h-3 w-3 mr-1" />
                                <span>Keep this instead</span>
                              </Button>
                            )}

                            {isWinner && (
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 py-1 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Selected for export</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Honesty note and close footer */}
        <div className="p-4 border-t border-border/40 bg-accent/10 space-y-3">
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-orange-500/10 border border-primary/25 text-[11px] text-foreground/80">
            <Info className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
            <p className="leading-tight">{SIMILARITY_HONESTY_NOTE}</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs font-semibold ml-auto"
            >
              Done Reviewing
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
