'use client';

import React from 'react';
import { UploadCloud } from 'lucide-react';
import { DropZone } from './DropZone';

interface UploadCardProps {
  onFilesSelected: (files: File[]) => void;
  currentCount: number;
  maxFiles?: number;
  disabled?: boolean;
}

export function UploadCard({
  onFilesSelected,
  currentCount,
  maxFiles = 200,
  disabled = false,
}: UploadCardProps) {
  return (
    <div className="glass-card rounded-2xl border border-border/50 p-4 space-y-4 shadow-sm overflow-visible">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-primary shrink-0 shadow-xs">
          <UploadCloud className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground leading-tight">Upload Files</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {currentCount > 0 ? `${currentCount} / ${maxFiles} loaded` : `Ready for up to ${maxFiles} files`}
          </p>
        </div>
      </div>

      <DropZone
        onFilesSelected={onFilesSelected}
        currentCount={currentCount}
        maxFiles={maxFiles}
        disabled={disabled}
      />
    </div>
  );
}
