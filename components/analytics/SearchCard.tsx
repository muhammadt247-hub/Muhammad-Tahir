'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SearchMode,
  SortOption,
  ContentTypeFilter,
  AiFilter,
  Asset,
  SearchParams,
} from '@/types/asset';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { ExportMenu } from './ExportMenu';
import { FilterBar } from './FilterBar';
import { Search, Heart, Loader2, History, X } from 'lucide-react';
import { extractFileId, extractContributorId } from '@/lib/format';

interface SearchCardProps {
  mode: SearchMode;
  query: string;
  sort: SortOption;
  contentType: ContentTypeFilter;
  ai: AiFilter;
  loading: boolean;
  onModeChange: (mode: SearchMode) => void;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: SortOption) => void;
  onContentTypeChange: (type: ContentTypeFilter) => void;
  onAiChange: (ai: AiFilter) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onOpenMoodboards: () => void;
  assets: Asset[];
  allAssets: Asset[];
  onFetchMoreAndExport: (pagesToFetch: number, format: 'csv' | 'xlsx' | 'json') => Promise<void>;
}

export function SearchCard({
  mode,
  query,
  sort,
  contentType,
  ai,
  loading,
  onModeChange,
  onQueryChange,
  onSortChange,
  onContentTypeChange,
  onAiChange,
  onSubmit,
  onOpenMoodboards,
  assets,
  allAssets,
  onFetchMoreAndExport,
}: SearchCardProps) {
  const { history, removeSearch, clearHistory } = useSearchHistory();
  const [showHistory, setShowHistory] = useState(false);
  const containerRef = useRef<HTMLFormElement>(null);

  // Close history on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter history items by current mode
  const currentHistory = history.filter((h) => h.mode === mode);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (mode === 'contributor') {
      // If user pasted a profile link or complex string, extract numeric ID
      if (val.includes('contributor') || val.includes('/') || val.includes('.')) {
        val = extractContributorId(val);
      }
    } else if (mode === 'file') {
      // If user pasted a URL, stock link, or "FILE #...", extract numeric file ID
      if (val.includes('http') || val.includes('/') || val.includes('#') || val.toLowerCase().includes('file')) {
        val = extractFileId(val);
      }
    }
    onQueryChange(val);
  };

  const handleHistoryClick = (histQuery: string) => {
    onQueryChange(histQuery);
    setShowHistory(false);
  };

  const filtersDescription = `Sort: ${sort}, Content: ${contentType}, AI: ${ai}`;

  return (
    <div className="glass-card rounded-2xl p-6 border border-border/50 shadow-sm space-y-6">
      {/* Row 1: Mode Switch & Moodboards Trigger */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
        {/* Three Tabs: Keyword, File ID, Contributor ID */}
        <Tabs
          value={mode}
          onValueChange={(val) => onModeChange(val as SearchMode)}
          className="w-full sm:w-auto"
        >
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex">
            <TabsTrigger value="keyword">Search by Keyword</TabsTrigger>
            <TabsTrigger value="file">Search by File ID</TabsTrigger>
            <TabsTrigger value="contributor">Search by Contributor ID</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Moodboards Button */}
        <Button
          variant="outline"
          onClick={onOpenMoodboards}
          className="h-10 px-4 rounded-xl text-sm font-medium gap-2 border-border/50 bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors w-full sm:w-auto justify-center"
        >
          <Heart className="h-4 w-4 text-primary fill-primary/20" />
          <span>Moodboards</span>
        </Button>
      </div>

      {/* Row 2: Search Form */}
      <div className="space-y-2">
        <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-4" ref={containerRef}>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={handleInputChange}
              onFocus={() => setShowHistory(true)}
              placeholder={
                mode === 'keyword'
                  ? 'Search for vectors, photos, illustrations...'
                  : mode === 'file'
                  ? 'Paste an Adobe Stock File ID or link...'
                  : 'Enter Adobe Stock Contributor ID...'
              }
              className="pl-12 h-12 sm:h-14 rounded-xl text-base sm:text-lg bg-background/50 border border-border/50 w-full focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary shadow-xs"
            />

            {/* Search History Dropdown */}
            {showHistory && currentHistory.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl border border-border/60 bg-popover p-2 shadow-xl animate-in fade-in-0 zoom-in-95">
                <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <History className="h-3 w-3" /> Recent Searches
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearHistory();
                    }}
                    className="hover:underline text-[9px]"
                  >
                    Clear All
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5 mt-1">
                  {currentHistory.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleHistoryClick(item.query)}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-accent text-foreground transition-colors group"
                    >
                      <span className="truncate">{item.query}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSearch(item.query, item.mode);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Button Group: Analyze & Download */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Analyze Button */}
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 sm:h-14 px-6 sm:px-8 rounded-xl text-sm sm:text-base font-semibold gap-2 relative overflow-hidden group shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  <span>Analyze</span>
                </>
              )}
              {/* Subtle sheen sweep on hover */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
            </Button>

            {/* Download Dropdown */}
            <ExportMenu
              assets={assets}
              allAssets={allAssets}
              currentQuery={query}
              filtersDescription={filtersDescription}
              searchParams={{ mode, query, sort, contentType, ai }}
              onFetchMoreAndExport={onFetchMoreAndExport}
              disabled={loading || assets.length === 0}
            />
          </div>
        </form>

        {/* Mode-specific Helper Text */}
        {mode === 'contributor' && (
          <p className="text-xs text-muted-foreground pl-1">
            Find the Contributor ID in a profile link: <code className="text-foreground/90 font-mono text-[11px] bg-muted/60 px-1 py-0.5 rounded">stock.adobe.com/contributor/ID/name</code>. A number from a &apos;FILE #&apos; is a File ID, use the File ID tab.
          </p>
        )}
        {mode === 'file' && (
          <p className="text-xs text-muted-foreground pl-1">
            Enter an Adobe Stock File ID (e.g. <code className="text-foreground/90 font-mono text-[11px] bg-muted/60 px-1 py-0.5 rounded">2063124677</code>) or paste any asset URL.
          </p>
        )}
      </div>

      {/* Row 3: Filter Grid (Shown in Keyword & Contributor modes) */}
      {mode !== 'file' && (
        <FilterBar
          sort={sort}
          contentType={contentType}
          ai={ai}
          onSortChange={onSortChange}
          onContentTypeChange={onContentTypeChange}
          onAiChange={onAiChange}
        />
      )}
    </div>
  );
}
