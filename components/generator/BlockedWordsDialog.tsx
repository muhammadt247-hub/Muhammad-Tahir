'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { BUILT_IN_BLOCKLIST } from '@/config/compliance';
import { Search, Plus, Trash2, ShieldAlert, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

interface BlockedWordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customWords: string[];
  onUpdateCustomWords: (words: string[]) => void;
}

export function BlockedWordsDialog({
  open,
  onOpenChange,
  customWords,
  onUpdateCustomWords,
}: BlockedWordsDialogProps) {
  const [activeTab, setActiveTab] = useState<'builtin' | 'custom'>('builtin');
  const [searchQuery, setSearchQuery] = useState('');
  const [newWordInput, setNewWordInput] = useState('');

  // Filter built-in blocklist by search
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return BUILT_IN_BLOCKLIST;

    return BUILT_IN_BLOCKLIST.map((cat) => ({
      ...cat,
      terms: cat.terms.filter((t) => t.toLowerCase().includes(q)),
    })).filter((cat) => cat.terms.length > 0);
  }, [searchQuery]);

  const handleAddCustomWord = () => {
    const trimmed = newWordInput.trim().toLowerCase();
    if (!trimmed) return;

    if (customWords.map((w) => w.toLowerCase()).includes(trimmed)) {
      toast.warning(`"${trimmed}" is already in your custom blocklist.`);
      return;
    }

    const updated = [...customWords, trimmed];
    onUpdateCustomWords(updated);
    setNewWordInput('');
    toast.success(`Added "${trimmed}" to custom blocklist.`);
  };

  const handleRemoveCustomWord = (word: string) => {
    const updated = customWords.filter((w) => w.toLowerCase() !== word.toLowerCase());
    onUpdateCustomWords(updated);
    toast.info(`Removed "${word}" from custom blocklist.`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Blocked Words & Trademarks
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Terms blocked from titles and keywords to protect your stock contributor account.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('builtin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'builtin'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            Built-in Blocklist ({BUILT_IN_BLOCKLIST.reduce((sum, c) => sum + c.terms.length, 0)}+)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'custom'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            My Custom Words ({customWords.length})
          </button>
        </div>

        {/* Built-in Tab */}
        {activeTab === 'builtin' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3 pt-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search blocked brands, artists, characters..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-accent/40 border border-border/50 text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Grouped Category Lists */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {filteredCategories.length === 0 ? (
                <p className="text-center py-8 text-xs text-muted-foreground">
                  No blocked terms matching &quot;{searchQuery}&quot;
                </p>
              ) : (
                filteredCategories.map((cat) => (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span>{cat.name}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          ({cat.terms.length})
                        </span>
                      </h4>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{cat.description}</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {cat.terms.map((term, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-medium border border-border/40"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Custom Tab */}
        {activeTab === 'custom' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3 pt-2">
            {/* Add Custom Word Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newWordInput}
                onChange={(e) => setNewWordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomWord();
                  }
                }}
                placeholder="Enter a brand, word, or phrase to block..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-accent/40 border border-border/50 text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomWord}
                disabled={!newWordInput.trim()}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-40 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Word</span>
              </button>
            </div>

            {/* Custom Words List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {customWords.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold">No custom blocked words yet.</p>
                  <p className="text-[11px]">
                    Add any competitor names, client-restricted terms, or local trademarks.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {customWords.map((word, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-foreground text-xs font-medium shadow-2xs"
                    >
                      <span>{word}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomWord(word)}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                        title="Remove word"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
