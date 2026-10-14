'use client';

import React, { useState } from 'react';
import { SeoCheckItem } from '@/lib/generator/queue';
import { Check, X, ShieldCheck, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score?: number;
  checklist?: SeoCheckItem[];
}

export function ScoreBadge({ score, checklist = [] }: ScoreBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (score === undefined) return null;

  const tooltipText = "This score checks Adobe's published rules and good metadata practice. It cannot predict ranking or sales.";

  // Score color tiers
  const isHigh = score >= 80;
  const isMid = score >= 60 && score < 80;
  const isLow = score < 60;

  const badgeBg = isHigh
    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    : isMid
    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
    : 'bg-destructive/15 text-destructive border-destructive/30';

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={tooltipText}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-transform hover:scale-105 cursor-pointer shadow-2xs',
          badgeBg
        )}
      >
        <ShieldCheck className="h-3 w-3" />
        <span>SEO {score}/100</span>
      </button>

      {/* Checklist Popover */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl bg-card border border-border/80 shadow-2xl p-3.5 space-y-3 text-xs animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Adobe Metadata Checklist</span>
              </div>
              <span className={cn('px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border', badgeBg)}>
                {score}/100
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {checklist.length === 0 ? (
                <p className="text-muted-foreground text-[11px]">No checklist data available.</p>
              ) : (
                checklist.map((item) => (
                  <div key={item.id} className="flex items-start gap-2">
                    {item.passed ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-destructive/20 text-destructive flex items-center justify-center shrink-0 mt-0.5">
                        <X className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={cn('font-semibold leading-tight text-[11px]', item.passed ? 'text-foreground' : 'text-destructive')}>
                        {item.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        {item.reason}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Honesty disclaimer footer */}
            <div className="pt-2 border-t border-border/40 flex items-start gap-1.5 text-[10px] text-muted-foreground">
              <Info className="h-3 w-3 shrink-0 mt-0.5 opacity-70" />
              <p className="leading-tight">{tooltipText}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
