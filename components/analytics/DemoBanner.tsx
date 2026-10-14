'use client';

import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface DemoBannerProps {
  isMockData: boolean;
}

export function DemoBanner({ isMockData }: DemoBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!isMockData || dismissed) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-foreground shadow-xs animate-in fade-in-0 duration-300">
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertCircle className="h-4 w-4 text-primary shrink-0" />
        <span className="font-medium truncate">
          Demo data. Add <code className="font-mono font-bold bg-primary/20 px-1 py-0.5 rounded text-[11px]">ADOBE_STOCK_API_KEY</code> to use live Adobe Stock data.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title="Dismiss banner"
        aria-label="Dismiss banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
