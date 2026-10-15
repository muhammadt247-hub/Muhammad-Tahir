'use client';

import React from 'react';
import { Sliders, Key, Layers, Type } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ControlsCardProps {
  mode: 'metadata' | 'prompt';
  onModeChange: (mode: 'metadata' | 'prompt') => void;
  selectedModel: string;
  onOpenApiKeys: () => void;
  hasCustomKeys?: boolean;
}

export function ControlsCard({
  mode,
  onModeChange,
  selectedModel,
  onOpenApiKeys,
  hasCustomKeys = false,
}: ControlsCardProps) {
  return (
    <div className="glass-card rounded-2xl border border-border/50 p-4 space-y-4 shadow-sm overflow-visible">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-foreground shrink-0 shadow-xs">
            <Sliders className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground leading-tight">Controls</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[180px]">
              {selectedModel ? selectedModel : 'Google Gemini'}
            </p>
          </div>
        </div>

        {/* API Keys Pill Button */}
        <button
          onClick={onOpenApiKeys}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold px-3 py-1.5 shadow-sm transition-all hover:opacity-90 pop-10"
          title="Configure Gemini API Keys"
        >
          <Key className="h-3.5 w-3.5" />
          <span>API Keys</span>
          {hasCustomKeys && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />}
        </button>
      </div>

      {/* Segmented Control */}
      <div className="rounded-xl bg-accent/70 p-1 flex select-none">
        <button
          onClick={() => onModeChange('metadata')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-all rounded-lg',
            mode === 'metadata'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Layers className="h-4 w-4" />
          <span>Metadata</span>
        </button>

        <button
          onClick={() => onModeChange('prompt')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold transition-all rounded-lg',
            mode === 'prompt'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Type className="h-4 w-4" />
          <span>Prompt</span>
        </button>
      </div>
    </div>
  );
}
