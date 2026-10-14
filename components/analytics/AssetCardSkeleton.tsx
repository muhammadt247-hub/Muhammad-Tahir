import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function AssetCardSkeleton() {
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 overflow-hidden flex flex-col shadow-sm">
      {/* 3:2 aspect thumbnail */}
      <div className="relative aspect-[3/2] w-full bg-muted/60">
        <Skeleton className="w-full h-full rounded-none" />
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="absolute top-2 right-2">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="absolute bottom-2 left-2">
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="absolute bottom-2 right-2">
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />

        <div className="flex items-center gap-2 pt-1">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-20" />
        </div>

        <div className="flex flex-wrap gap-1 pt-1">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40 mt-auto">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-2.5 w-10" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-2.5 w-12" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-0 flex items-center justify-between gap-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
