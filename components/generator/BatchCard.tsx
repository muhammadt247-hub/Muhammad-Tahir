'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface BatchCardProps {
  batchMode: boolean;
  onBatchModeChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function BatchCard({ batchMode, onBatchModeChange, disabled = false }: BatchCardProps) {
  return (
    <div className="glass-card rounded-2xl border border-border/50 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground leading-tight">Batch Generation</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {batchMode ? '5 images per request (Faster)' : 'Process multiple at once'}
            </p>
          </div>
        </div>

        <Switch
          checked={batchMode}
          onCheckedChange={onBatchModeChange}
          disabled={disabled}
          aria-label="Toggle Batch Generation Mode"
        />
      </div>
    </div>
  );
}
