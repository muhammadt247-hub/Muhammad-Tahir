'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export interface EmbedDialogStats {
  successCount: number;
  skippedCount: number;
  failedFiles: string[];
}

interface EmbedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: 'processing' | 'complete' | 'no-compatible';
  current: number;
  total: number;
  stats: EmbedDialogStats;
}

export function EmbedDialog({
  open,
  onOpenChange,
  status,
  current,
  total,
  stats,
}: EmbedDialogProps) {
  const isProcessing = status === 'processing';
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        // Prevent closing while actively processing
        if (!isProcessing) {
          onOpenChange(val);
        }
      }}
    >
      <DialogContent
        className="max-w-sm rounded-2xl p-6 space-y-4"
        onPointerDownOutside={(e) => {
          if (isProcessing) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isProcessing) e.preventDefault();
        }}
      >
        {/* 1. Processing Progress State */}
        {status === 'processing' && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>

            <div className="space-y-1">
              <DialogTitle className="text-lg font-bold text-foreground">
                Embedding Metadata...
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Processing {current} of {total} files. Please wait...
              </DialogDescription>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <div className="h-2 flex-1 rounded-full bg-accent overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200 rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-xs font-mono font-bold text-foreground shrink-0">
                {percent}%
              </span>
            </div>
          </div>
        )}

        {/* 2. Complete State */}
        {status === 'complete' && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <DialogHeader className="space-y-1 text-center sm:text-center">
              <DialogTitle className="text-lg font-bold text-foreground">
                Embedding Complete!
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                Successfully embedded metadata into {stats.successCount} file
                {stats.successCount === 1 ? '' : 's'}.
                {stats.skippedCount > 0 && (
                  <span className="block mt-1 text-muted-foreground/80">
                    ({stats.skippedCount} file{stats.skippedCount === 1 ? '' : 's'} were skipped)
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            {/* List any failed files */}
            {stats.failedFiles.length > 0 && (
              <div className="p-3 rounded-xl bg-destructive/10 text-left space-y-1 text-xs border border-destructive/20">
                <p className="font-semibold text-destructive">
                  {stats.failedFiles.length} file{stats.failedFiles.length === 1 ? '' : 's'} could not be processed:
                </p>
                <div className="max-h-24 overflow-y-auto font-mono text-[11px] text-destructive/90 space-y-0.5">
                  {stats.failedFiles.map((fn, idx) => (
                    <div key={idx} className="truncate">
                      • {fn}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-xl w-full font-semibold text-sm"
            >
              Close
            </Button>
          </div>
        )}

        {/* 3. No Compatible Files State */}
        {status === 'no-compatible' && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <DialogHeader className="space-y-1 text-center sm:text-center">
              <DialogTitle className="text-lg font-bold text-foreground">
                No Compatible Files
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
                Currently, metadata embedding is only supported for JPG, JPEG and PNG images.
                Vector files like SVG cannot embed metadata directly. Please download the CSV file
                to use alongside your vectors.
              </DialogDescription>
            </DialogHeader>

            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-xl w-full font-semibold text-sm"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
