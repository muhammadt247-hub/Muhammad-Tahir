'use client';

import React from 'react';
import { Loader2, X } from 'lucide-react';
import { SimilarityProgress } from '@/lib/similarity/pipeline';

interface SimilarityProgressCardProps {
  progress: SimilarityProgress;
  onCancel?: () => void;
}

export function SimilarityProgressCard({ progress, onCancel }: SimilarityProgressCardProps) {
  const percentage = progress.totalCount > 0
    ? Math.min(100, Math.round((progress.processedCount / progress.totalCount) * 100))
    : 0;

  return (
    <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-primary/30 shadow-xs space-y-2.5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
          <span>Checking for similar images...</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-primary font-bold">
            Step {progress.step} of {progress.totalSteps} · {progress.processedCount} / {progress.totalCount}
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-2 py-1 rounded-lg bg-destructive/15 text-destructive text-[11px] font-bold hover:bg-destructive/25 transition-colors flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              <span>Cancel check</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="h-2 w-full rounded-full bg-accent/40 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.max(5, percentage)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{progress.message}</span>
          <span>{percentage}%</span>
        </div>
      </div>
    </div>
  );
}
