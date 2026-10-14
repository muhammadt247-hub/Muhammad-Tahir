'use client';

import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface KeywordEditorProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  maxKeywords?: number;
}

export function KeywordEditor({
  keywords,
  onChange,
  maxKeywords = 49,
}: KeywordEditorProps) {
  const [inputVal, setInputVal] = useState('');

  const handleAdd = () => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    // Split by comma in case user pastes multiple
    const parts = trimmed
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const set = new Set(keywords);
    parts.forEach((p) => {
      if (set.size < maxKeywords) {
        set.add(p);
      }
    });

    onChange(Array.from(set));
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (kw: string) => {
    onChange(keywords.filter((k) => k !== kw));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto p-1.5 rounded-xl border border-border/50 bg-background/50">
        {keywords.map((kw, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-foreground border border-border/40"
          >
            <span>{kw}</span>
            <button
              type="button"
              onClick={() => handleRemove(kw)}
              className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}

        {keywords.length === 0 && (
          <span className="text-xs text-muted-foreground italic p-1">
            No keywords yet
          </span>
        )}
      </div>

      {keywords.length < maxKeywords && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type keyword and press Enter..."
            className="flex-1 h-8 rounded-lg border border-border/60 bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="flex h-8 items-center gap-1 rounded-lg border border-border/60 bg-muted/60 px-2.5 text-xs font-semibold hover:bg-muted"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      )}
    </div>
  );
}
