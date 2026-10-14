import React from 'react';
import { formatNumber } from '@/lib/format';
import { SearchMode } from '@/types/asset';
import { Sparkles, AlertCircle } from 'lucide-react';

interface ResultsHeaderProps {
  mode: SearchMode;
  query: string;
  total: number;
  totalAI?: number;
  totalNonAI?: number;
  isDemo?: boolean;
}

export function ResultsHeader({
  mode,
  query,
  total,
  totalAI = 0,
  totalNonAI = 0,
  isDemo = false,
}: ResultsHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2">
      {/* Title & Demo Notice */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {mode === 'keyword' ? (
            <>
              Results for <span className="text-primary font-bold">&quot;{query}&quot;</span>
            </>
          ) : mode === 'file' ? (
            <>
              File <span className="text-primary font-bold">#{query}</span>
            </>
          ) : (
            <>
              Contributor <span className="text-primary font-bold">#{query}</span>
            </>
          )}
        </h2>

        {isDemo && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-medium">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Demo results. These are not real Adobe Stock assets.</span>
          </div>
        )}
      </div>

      {/* Stat Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Total Assets Pill */}
        <div className="inline-flex items-center border border-border/60 bg-background/50 rounded-full px-3 py-1 text-xs sm:text-sm font-medium text-foreground shadow-xs">
          {mode === 'file' ? `${total} Asset Found` : `${formatNumber(total)}+ Assets Found`}
        </div>

        {mode !== 'file' && (
          <>
            {/* Non-AI Pill */}
            <div className="inline-flex items-center border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 rounded-full px-3 py-1 text-xs sm:text-sm font-medium shadow-xs">
              {formatNumber(totalNonAI)}+ Non-AI
            </div>

            {/* AI Pill */}
            <div className="inline-flex items-center border border-orange-700/30 text-orange-700 dark:text-orange-400 bg-orange-700/5 rounded-full px-3 py-1 text-xs sm:text-sm font-medium gap-1 shadow-xs">
              <Sparkles className="h-3.5 w-3.5" />
              {formatNumber(totalAI)}+ AI
            </div>
          </>
        )}
      </div>
    </div>
  );
}
