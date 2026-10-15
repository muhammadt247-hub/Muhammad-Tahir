'use client';

import React, { useState } from 'react';
import { Clock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface BatchCardProps {
  delaySeconds: number;
  onDelayChange: (delaySeconds: number) => void;
  disabled?: boolean;
}

const PRESET_DELAYS = [5, 6, 10, 15];

export function BatchCard({
  delaySeconds = 10,
  onDelayChange,
  disabled = false,
}: BatchCardProps) {
  const [customValue, setCustomValue] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(!PRESET_DELAYS.includes(delaySeconds));

  const handlePresetClick = (seconds: number) => {
    setIsCustomMode(false);
    setCustomValue('');
    onDelayChange(seconds);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomValue(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      onDelayChange(parsed);
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-border/50 p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-foreground leading-tight">Inter-Image Delay</h2>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5">
                <ShieldCheck className="h-2.5 w-2.5" /> Sequential
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Wait time after each image to prevent API rate limits
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-primary font-mono bg-primary/10 px-2.5 py-1 rounded-lg">
          {delaySeconds}s wait
        </span>
      </div>

      {/* Preset Pills + Custom Input */}
      <div className="space-y-2 pt-1">
        <div className="grid grid-cols-4 gap-1.5">
          {PRESET_DELAYS.map((sec) => (
            <button
              key={sec}
              type="button"
              disabled={disabled}
              onClick={() => handlePresetClick(sec)}
              className={cn(
                'py-1.5 px-2 rounded-xl text-xs font-semibold transition-all border text-center',
                !isCustomMode && delaySeconds === sec
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card/70 border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {sec}s {sec === 10 && <span className="text-[9px] opacity-80">(Def)</span>}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsCustomMode(true);
              setCustomValue(String(delaySeconds));
            }}
            className={cn(
              'px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all shrink-0',
              isCustomMode
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
            )}
          >
            Custom delay
          </button>
          {isCustomMode && (
            <div className="flex items-center gap-1.5 flex-1">
              <Input
                type="number"
                min="0"
                max="120"
                step="1"
                placeholder="Seconds"
                value={customValue}
                onChange={handleCustomChange}
                disabled={disabled}
                className="h-7 text-xs rounded-lg px-2 w-20 font-mono"
              />
              <span className="text-[11px] text-muted-foreground">seconds</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
