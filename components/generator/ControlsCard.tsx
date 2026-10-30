'use client';

import React from 'react';
import { Sliders, Key, Layers, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AI_CONFIG } from '@/config/ai';
import { GROK_MODELS, DEFAULT_GROK_MODEL } from '@/config/models';
import { AiProvider } from '@/lib/generator/db';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ControlsCardProps {
  mode: 'metadata' | 'prompt';
  onModeChange: (mode: 'metadata' | 'prompt') => void;
  provider: AiProvider;
  onProviderChange: (provider: AiProvider) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  onOpenApiKeys: () => void;
  hasCustomKeys?: boolean;
  disabled?: boolean;
}

export function ControlsCard({
  mode,
  onModeChange,
  provider,
  onProviderChange,
  selectedModel,
  onModelChange,
  onOpenApiKeys,
  hasCustomKeys = false,
  disabled = false,
}: ControlsCardProps) {
  const models = provider === 'grok' ? GROK_MODELS : AI_CONFIG.AVAILABLE_MODELS;
  const currentModelValue = selectedModel || (provider === 'grok' ? DEFAULT_GROK_MODEL : AI_CONFIG.DEFAULT_MODEL);

  return (
    <div className="glass-card rounded-2xl border border-border/50 p-4 space-y-3.5 shadow-sm overflow-visible">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-foreground shrink-0 shadow-xs">
            <Sliders className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground leading-tight">Controls</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[180px]">
              {provider === 'grok' ? 'Groq Provider' : 'Google Gemini Provider'}
            </p>
          </div>
        </div>

        {/* API Keys Pill Button */}
        <button
          type="button"
          onClick={onOpenApiKeys}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold px-3 py-1.5 shadow-sm transition-all hover:opacity-90 pop-10"
          title="Configure API Keys"
        >
          <Key className="h-3.5 w-3.5" />
          <span>API Keys</span>
          {hasCustomKeys && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />}
        </button>
      </div>

      {/* Provider Switch & Model Dropdown */}
      <div className="space-y-2 pt-0.5">
        <div className="flex items-center justify-between gap-2">
          {/* Provider Pill Switch */}
          <div className="inline-flex p-0.5 rounded-lg bg-accent/70 border border-border/40 select-none shrink-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onProviderChange('gemini')}
              className={cn(
                'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all',
                provider === 'gemini'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Gemini
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onProviderChange('grok')}
              className={cn(
                'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all',
                provider === 'grok'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Groq
            </button>
          </div>

          {/* Model Dropdown for the Selected Provider */}
          <div className="flex-1 min-w-0">
            <Select
              value={currentModelValue}
              onValueChange={onModelChange}
              disabled={disabled}
            >
              <SelectTrigger className="w-full h-8 text-xs rounded-xl bg-background/80 border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name || m.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Segmented Control */}
      <div className="rounded-xl bg-accent/70 p-1 flex select-none">
        <button
          type="button"
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
          type="button"
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
