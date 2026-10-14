'use client';

import React from 'react';
import { Search, Sparkles, TrendingUp, KeyRound, FileSearch, ArrowRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchMode } from '@/types/asset';

interface EmptyStateProps {
  mode?: SearchMode;
  query?: string;
  isDemo?: boolean;
  fileIdSuggestion?: string | null;
  onSelectKeyword?: (kw: string) => void;
  onSwitchToFileTab?: (fileId: string) => void;
}

const EXAMPLE_KEYWORDS = [
  'green energy',
  'business meeting',
  'abstract background',
  'christmas icons',
  'cybersecurity network',
  'sustainable architecture',
  'artificial intelligence',
  'minimalist interior',
];

export function EmptyState({
  mode = 'keyword',
  query = '',
  isDemo = false,
  fileIdSuggestion = null,
  onSelectKeyword,
  onSwitchToFileTab,
}: EmptyStateProps) {
  // 1. Contributor mode with detected File ID suggestion
  if (mode === 'contributor' && fileIdSuggestion) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileSearch className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground">
              This looks like a File ID. Search it in the File ID tab?
            </h3>
            <p className="text-sm text-muted-foreground">
              Number <span className="font-mono font-semibold text-foreground">#{fileIdSuggestion}</span> matches the format of an Adobe Stock File ID rather than a contributor profile.
            </p>
          </div>
        </div>
        {onSwitchToFileTab && (
          <Button
            onClick={() => onSwitchToFileTab(fileIdSuggestion)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 h-11 rounded-xl gap-2 shrink-0 shadow-sm"
          >
            <span>Search in File ID Tab</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  // 2. File ID mode in Demo Mode (needs live data)
  if (mode === 'file' && isDemo) {
    return (
      <div className="flex flex-col items-center justify-center p-10 sm:p-14 text-center rounded-2xl border border-dashed border-primary/30 bg-card/40 space-y-5 max-w-2xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
          <KeyRound className="h-7 w-7" />
        </div>

        <div className="space-y-2 max-w-lg">
          <h3 className="text-xl font-bold text-foreground">
            File ID search needs live data. Add ADOBE_STOCK_API_KEY to use it.
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Adobe Stock File ID lookup requires live API access. In demo mode, fake images are never shown for specific file numbers to preserve data integrity.
          </p>
        </div>

        <div className="w-full max-w-md p-3.5 rounded-xl bg-muted/60 border border-border/50 text-left font-mono text-xs text-muted-foreground space-y-1">
          <div className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
            Configuration (.env.local)
          </div>
          <code className="block text-primary font-bold select-all">
            ADOBE_STOCK_API_KEY=your_adobe_api_key_here
          </code>
        </div>
      </div>
    );
  }

  // 3. File ID mode with live data but no result found
  if (mode === 'file' && query) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/60 bg-card/40 space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
          <FileSearch className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-foreground">
            No asset found for File ID #{query}
          </h3>
          <p className="text-xs text-muted-foreground">
            Please verify the number or link from Adobe Stock and try again.
          </p>
        </div>
      </div>
    );
  }

  // 4. File ID mode before searching
  if (mode === 'file') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/60 bg-card/40 space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <FileSearch className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-foreground">
            Search by File ID
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Paste any Adobe Stock File ID (e.g. 2063124677) or link to inspect its metadata and creator.
          </p>
        </div>
      </div>
    );
  }

  // 5. Contributor ID mode with no results found
  if (mode === 'contributor' && query) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/60 bg-card/40 space-y-4 max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
          <User className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-foreground">
            No contributor assets found for #{query}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Find the Contributor ID in a profile link: <code className="text-foreground font-mono bg-muted px-1 py-0.5 rounded">stock.adobe.com/contributor/ID/name</code>. A number from a &apos;FILE #&apos; is a File ID, use the File ID tab.
          </p>
        </div>
      </div>
    );
  }

  // 6. Default Keyword Mode
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/60 bg-card/40 space-y-6">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
        <Search className="h-7 w-7 opacity-80" />
      </div>

      <div className="space-y-1.5 max-w-md">
        <h3 className="text-xl font-bold text-foreground">
          Ready to Explore Microstock Trends
        </h3>
        <p className="text-sm text-muted-foreground">
          Enter a keyword or Contributor ID above to discover bestsellers, download metrics, and AI semantic distributions.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> Popular Research Topics
        </p>
        <div className="flex flex-wrap justify-center gap-2 max-w-lg">
          {EXAMPLE_KEYWORDS.map((kw) => (
            <button
              key={kw}
              onClick={() => onSelectKeyword && onSelectKeyword(kw)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/80 hover:bg-accent hover:border-primary/40 px-3 py-1.5 text-xs font-medium text-foreground transition-all duration-200 active:scale-95 shadow-xs"
            >
              <span>{kw}</span>
              <Sparkles className="h-3 w-3 text-primary opacity-60" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
