'use client';

import React from 'react';
import { Asset, SearchMode } from '@/types/asset';
import { AssetCard } from './AssetCard';
import { AssetCardSkeleton } from './AssetCardSkeleton';
import { EmptyState } from './EmptyState';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, User } from 'lucide-react';

interface ResultsGridProps {
  assets: Asset[];
  loading: boolean;
  error: string | null;
  mode?: SearchMode;
  query?: string;
  isDemo?: boolean;
  fileIdSuggestion?: string | null;
  onRetry: () => void;
  onOpenPrompt: (asset: Asset) => void;
  onSelectContributor: (contributorId: string) => void;
  onSelectKeyword: (kw: string) => void;
  onSwitchToFileTab?: (fileId: string) => void;
}

export function ResultsGrid({
  assets,
  loading,
  error,
  mode = 'keyword',
  query = '',
  isDemo = false,
  fileIdSuggestion = null,
  onRetry,
  onOpenPrompt,
  onSelectContributor,
  onSelectKeyword,
  onSwitchToFileTab,
}: ResultsGridProps) {
  // Loading State
  if (loading) {
    if (mode === 'file') {
      return (
        <div className="max-w-[420px] mx-auto w-full">
          <AssetCardSkeleton />
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <AssetCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-destructive/20 bg-destructive/5 space-y-4">
        <div className="w-12 h-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-foreground">Failed to load stock data</h3>
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        </div>
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  // Contributor Mode with detected File ID suggestion
  if (mode === 'contributor' && fileIdSuggestion) {
    return (
      <EmptyState
        mode={mode}
        query={query}
        fileIdSuggestion={fileIdSuggestion}
        onSwitchToFileTab={onSwitchToFileTab}
      />
    );
  }

  // File ID Mode Single Card Result
  if (mode === 'file') {
    if (assets.length === 0) {
      return (
        <EmptyState
          mode={mode}
          query={query}
          isDemo={isDemo}
          onSelectKeyword={onSelectKeyword}
        />
      );
    }

    const singleAsset = assets[0];
    return (
      <div className="max-w-[420px] mx-auto w-full space-y-4 pt-2">
        <AssetCard
          asset={singleAsset}
          onOpenPrompt={onOpenPrompt}
          onSelectContributor={onSelectContributor}
          isDemo={isDemo}
        />
        <Button
          onClick={() => onSelectContributor(singleAsset.creator_id)}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11 rounded-xl gap-2 shadow-sm transition-all"
        >
          <User className="h-4 w-4" />
          <span>More from this contributor</span>
        </Button>
      </div>
    );
  }

  // General Empty State
  if (assets.length === 0) {
    return (
      <EmptyState
        mode={mode}
        query={query}
        isDemo={isDemo}
        onSelectKeyword={onSelectKeyword}
      />
    );
  }

  // Keyword & Contributor Grid
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          onOpenPrompt={onOpenPrompt}
          onSelectContributor={onSelectContributor}
          isDemo={isDemo}
        />
      ))}
    </div>
  );
}
