'use client';

import React from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { SimilarityProgress } from '@/lib/similarity/pipeline';

interface SimilarityProgressCardProps {
  progress: SimilarityProgress;
}

export function SimilarityProgressCard({ progress }: SimilarityProgressCardProps) {
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
        <span className="text-[11px] font-mono text-primary font-bold">
          Step {progress.step} of {progress.totalSteps} · {progress.processedCount} / {progress.totalCount}
        </span>
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
