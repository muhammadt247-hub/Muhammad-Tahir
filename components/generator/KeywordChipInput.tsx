'use client';

import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface KeywordChipInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function KeywordChipInput({
  keywords,
  onChange,
  placeholder = 'Type keyword & press Enter...',
  disabled = false,
}: KeywordChipInputProps) {
  const [inputVal, setInputVal] = useState('');

  const addKeyword = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
    const updated = [...keywords];

    for (const p of parts) {
      if (!updated.map((k) => k.toLowerCase()).includes(p.toLowerCase())) {
        updated.push(p);
      }
    }

    onChange(updated);
    setInputVal('');
  };

  const removeKeyword = (index: number) => {
    const next = [...keywords];
    next.splice(index, 1);
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword(inputVal);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 rounded-xl bg-accent/70 text-sm border border-border/40 focus:ring-2 focus:ring-primary/20 focus:outline-none px-3.5 py-2"
        />
        <button
          type="button"
          onClick={() => addKeyword(inputVal)}
          disabled={disabled || !inputVal.trim()}
          className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 rounded-xl border border-border/30 bg-accent/20">
          {keywords.map((kw, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5"
            >
              <span>{kw}</span>
              <button
                type="button"
                onClick={() => removeKeyword(idx)}
                className="hover:text-primary-foreground hover:bg-primary rounded-full p-0.5 transition-colors"
                title={`Remove ${kw}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
