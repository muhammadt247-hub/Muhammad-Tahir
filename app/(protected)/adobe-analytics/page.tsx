'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import {
  Asset,
  SearchMode,
  SortOption,
  ContentTypeFilter,
  AiFilter,
  SearchResult,
} from '@/types/asset';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { SearchCard } from '@/components/analytics/SearchCard';
import { ResultsHeader } from '@/components/analytics/ResultsHeader';
import { ResultsGrid } from '@/components/analytics/ResultsGrid';
import { Pagination } from '@/components/analytics/Pagination';
import { DemoBanner } from '@/components/analytics/DemoBanner';
import { MoodboardsDialog } from '@/components/analytics/MoodboardsDialog';
import { PromptDialog } from '@/components/analytics/PromptDialog';
import { exportAssetsToCsv, exportAssetsToXlsx, exportAssetsToJson } from '@/lib/csv';
import { extractFileId, extractContributorId } from '@/lib/format';
import { toast } from 'sonner';

function AdobeAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addSearch } = useSearchHistory();

  // URL State parameters
  const urlMode = (searchParams.get('mode') as SearchMode) || 'keyword';
  const urlQuery = searchParams.get('q') || searchParams.get('query') || '';
  const urlSort = (searchParams.get('sort') as SortOption) || 'nb_downloads';
  const urlType = (searchParams.get('type') as ContentTypeFilter) || 'all';
  const urlAi = (searchParams.get('ai') as AiFilter) || 'all';
  const urlPage = parseInt(searchParams.get('page') || '1', 10) || 1;

  // Local state
  const [mode, setMode] = useState<SearchMode>(urlMode);
  const [query, setQuery] = useState(urlQuery);
  const [sort, setSort] = useState<SortOption>(urlSort);
  const [contentType, setContentType] = useState<ContentTypeFilter>(urlType);
  const [ai, setAi] = useState<AiFilter>(urlAi);
  const [currentPage, setCurrentPage] = useState(urlPage);

  // Results & status state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAI, setTotalAI] = useState(0);
  const [totalNonAI, setTotalNonAI] = useState(0);
  const [isDemo, setIsDemo] = useState(false);
  const [fileIdSuggestion, setFileIdSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Dialog states
  const [moodboardsOpen, setMoodboardsOpen] = useState(false);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [promptAsset, setPromptAsset] = useState<Asset | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);
  const filterDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Update URL search parameters
  const updateUrl = useCallback(
    (newParams: {
      mode?: SearchMode;
      query?: string;
      sort?: SortOption;
      contentType?: ContentTypeFilter;
      ai?: AiFilter;
      page?: number;
    }) => {
      const sp = new URLSearchParams();
      const currentMode = newParams.mode ?? mode;
      const currentQuery = newParams.query ?? query;
      const currentSort = newParams.sort ?? sort;
      const currentType = newParams.contentType ?? contentType;
      const currentAi = newParams.ai ?? ai;
      const pageVal = newParams.page ?? currentPage;

      if (currentMode) sp.set('mode', currentMode);
      if (currentQuery) sp.set('q', currentQuery);
      if (currentSort && currentSort !== 'nb_downloads') sp.set('sort', currentSort);
      if (currentType && currentType !== 'all') sp.set('type', currentType);
      if (currentAi && currentAi !== 'all') sp.set('ai', currentAi);
      if (pageVal > 1) sp.set('page', String(pageVal));

      const searchStr = sp.toString();
      const targetUrl = searchStr ? `/adobe-analytics?${searchStr}` : '/adobe-analytics';
      router.replace(targetUrl, { scroll: false });
    },
    [router, mode, query, sort, contentType, ai, currentPage]
  );

  // Execute Search Function
  const executeSearch = useCallback(
    async (
      q: string,
      m: SearchMode = mode,
      s: SortOption = sort,
      t: ContentTypeFilter = contentType,
      a: AiFilter = ai,
      p: number = 1
    ) => {
      let trimmed = q.trim();
      if (m === 'file') {
        trimmed = extractFileId(trimmed);
      } else if (m === 'contributor') {
        trimmed = extractContributorId(trimmed);
      }

      if (!trimmed) {
        setAssets([]);
        setTotal(0);
        setHasSearched(false);
        setFileIdSuggestion(null);
        return;
      }

      setLoading(true);
      setError(null);
      setHasSearched(true);
      setFileIdSuggestion(null);

      try {
        const params = new URLSearchParams({
          mode: m,
          query: trimmed,
          sort: s,
          contentType: t,
          ai: a,
          page: String(p),
          limit: m === 'file' ? '1' : '32',
        });

        const res = await fetch(`/api/stock/search?${params.toString()}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Failed to fetch assets (${res.status})`);
        }

        const data: SearchResult = await res.json();
        setAssets(data.assets || []);
        setTotal(data.total || 0);
        setTotalAI(data.totalAI || 0);
        setTotalNonAI(data.totalNonAI || 0);
        setIsDemo(Boolean(data.isDemo));
        setFileIdSuggestion(data.fileIdSuggestion || null);

        // Accumulate unique items into allAssets
        setAllAssets((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          const newItems = (data.assets || []).filter((item) => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });

        addSearch(trimmed, m);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to search stock assets';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [mode, sort, contentType, ai, addSearch]
  );

  // Initial load from URL or probe demo status
  useEffect(() => {
    if (urlQuery) {
      const timer = setTimeout(() => {
        executeSearch(urlQuery, urlMode, urlSort, urlType, urlAi, urlPage);
      }, 0);
      return () => clearTimeout(timer);
    } else {
      // Check if server is running in demo mode to show the demo banner
      fetch('/api/stock/search?mode=keyword&query=test&limit=1')
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data.isDemo === 'boolean') {
            setIsDemo(data.isDemo);
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Form submit handler
  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let sanitized = query.trim();
    if (mode === 'file') {
      sanitized = extractFileId(sanitized);
    } else if (mode === 'contributor') {
      sanitized = extractContributorId(sanitized);
    }

    if (!sanitized) {
      toast.error(
        mode === 'keyword'
          ? 'Please enter a search keyword'
          : mode === 'file'
          ? 'Please enter an Adobe Stock File ID or link'
          : 'Please enter a contributor ID'
      );
      return;
    }

    setQuery(sanitized);
    setCurrentPage(1);
    updateUrl({ mode, query: sanitized, sort, contentType, ai, page: 1 });
    executeSearch(sanitized, mode, sort, contentType, ai, 1);
  };

  // Filter change handlers (auto re-runs with debounce 250ms)
  const handleSortChange = (newSort: SortOption) => {
    setSort(newSort);
    setCurrentPage(1);
    updateUrl({ sort: newSort, page: 1 });
    if (query.trim()) {
      if (filterDebounceTimer.current) clearTimeout(filterDebounceTimer.current);
      filterDebounceTimer.current = setTimeout(() => {
        executeSearch(query.trim(), mode, newSort, contentType, ai, 1);
      }, 250);
    }
  };

  const handleContentTypeChange = (newType: ContentTypeFilter) => {
    setContentType(newType);
    setCurrentPage(1);
    updateUrl({ contentType: newType, page: 1 });
    if (query.trim()) {
      if (filterDebounceTimer.current) clearTimeout(filterDebounceTimer.current);
      filterDebounceTimer.current = setTimeout(() => {
        executeSearch(query.trim(), mode, sort, newType, ai, 1);
      }, 250);
    }
  };

  const handleAiChange = (newAi: AiFilter) => {
    setAi(newAi);
    setCurrentPage(1);
    updateUrl({ ai: newAi, page: 1 });
    if (query.trim()) {
      if (filterDebounceTimer.current) clearTimeout(filterDebounceTimer.current);
      filterDebounceTimer.current = setTimeout(() => {
        executeSearch(query.trim(), mode, sort, contentType, newAi, 1);
      }, 250);
    }
  };

  // Pagination page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    updateUrl({ page: newPage });
    executeSearch(query.trim(), mode, sort, contentType, ai, newPage);
    // Smooth-scroll back to results header
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Mode change
  const handleModeChange = (newMode: SearchMode) => {
    setMode(newMode);
    setQuery('');
    setAssets([]);
    setTotal(0);
    setHasSearched(false);
    setFileIdSuggestion(null);
    updateUrl({ mode: newMode, query: '', page: 1 });
  };

  // Contributor selection from asset card or single file card
  const handleSelectContributor = (contributorId: string) => {
    const cleanId = extractContributorId(contributorId);
    setMode('contributor');
    setQuery(cleanId);
    setCurrentPage(1);
    setFileIdSuggestion(null);
    updateUrl({ mode: 'contributor', query: cleanId, page: 1 });
    executeSearch(cleanId, 'contributor', sort, contentType, ai, 1);
  };

  // File ID switch (e.g. from contributor suggestion card)
  const handleSearchFileId = (fileId: string) => {
    const cleanId = extractFileId(fileId);
    setMode('file');
    setQuery(cleanId);
    setCurrentPage(1);
    setFileIdSuggestion(null);
    updateUrl({ mode: 'file', query: cleanId, page: 1 });
    executeSearch(cleanId, 'file', sort, contentType, ai, 1);
  };

  // Keyword selection from empty state or card chip
  const handleSelectKeyword = (kw: string) => {
    setMode('keyword');
    setQuery(kw);
    setCurrentPage(1);
    setFileIdSuggestion(null);
    updateUrl({ mode: 'keyword', query: kw, page: 1 });
    executeSearch(kw, 'keyword', sort, contentType, ai, 1);
  };

  // Fetch more pages and export directly
  const handleFetchMoreAndExport = async (pagesToFetch: number, format: 'csv' | 'xlsx' | 'json') => {
    if (!query.trim()) return;

    toast.info(`Fetching ${pagesToFetch} additional pages for export...`);
    const fetched: Asset[] = [...allAssets];

    try {
      for (let p = 1; p <= pagesToFetch; p++) {
        const params = new URLSearchParams({
          mode,
          query: query.trim(),
          sort,
          contentType,
          ai,
          page: String(p),
          limit: '32',
        });
        const res = await fetch(`/api/stock/search?${params.toString()}`);
        if (res.ok) {
          const data: SearchResult = await res.json();
          const existingIds = new Set(fetched.map((i) => i.id));
          for (const item of data.assets || []) {
            if (!existingIds.has(item.id)) {
              fetched.push(item);
              existingIds.add(item.id);
            }
          }
        }
      }

      const filtersDesc = `Sort: ${sort}, Content: ${contentType}, AI: ${ai}`;
      if (format === 'csv') {
        exportAssetsToCsv(fetched, query.trim(), filtersDesc);
      } else if (format === 'xlsx') {
        exportAssetsToXlsx(fetched, query.trim(), filtersDesc);
      } else {
        exportAssetsToJson(fetched, query.trim());
      }
      toast.success(`Exported ${fetched.length} total assets`);
    } catch {
      toast.error('Failed to export additional pages');
    }
  };

  const totalPages = Math.ceil(total / 32);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* 1.1 Hero Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 mb-2">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              MARKET RESEARCH
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Adobe Analytics
          </h1>

          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl leading-relaxed">
            Search and analyze top-performing assets on Adobe Stock. Discover what sells, explore trends, and inspect specific assets by File ID or Contributor.
          </p>
        </div>
      </div>

      {/* Demo Data Banner (when running without ADOBE_STOCK_API_KEY) */}
      <DemoBanner isMockData={isDemo} />

      {/* 1.2 Search Card */}
      <SearchCard
        mode={mode}
        query={query}
        sort={sort}
        contentType={contentType}
        ai={ai}
        loading={loading}
        onModeChange={handleModeChange}
        onQueryChange={setQuery}
        onSortChange={handleSortChange}
        onContentTypeChange={handleContentTypeChange}
        onAiChange={handleAiChange}
        onSubmit={handleFormSubmit}
        onOpenMoodboards={() => setMoodboardsOpen(true)}
        assets={assets}
        allAssets={allAssets}
        onFetchMoreAndExport={handleFetchMoreAndExport}
      />

      {/* 1.3 Results Header & 1.4 Results Grid */}
      <div ref={resultsRef} className="space-y-6 pt-2">
        {hasSearched && query.trim() && (
          <ResultsHeader
            mode={mode}
            query={query}
            total={total}
            totalAI={totalAI}
            totalNonAI={totalNonAI}
            isDemo={isDemo}
          />
        )}

        <ResultsGrid
          assets={assets}
          loading={loading}
          error={error}
          mode={mode}
          query={query}
          isDemo={isDemo}
          fileIdSuggestion={fileIdSuggestion}
          onRetry={() => executeSearch(query.trim(), mode, sort, contentType, ai, currentPage)}
          onOpenPrompt={(asset) => {
            setPromptAsset(asset);
            setPromptDialogOpen(true);
          }}
          onSelectContributor={handleSelectContributor}
          onSelectKeyword={handleSelectKeyword}
          onSwitchToFileTab={handleSearchFileId}
        />

        {/* Pagination (only in keyword & contributor modes) */}
        {hasSearched && mode !== 'file' && assets.length > 0 && totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            disabled={loading}
          />
        )}
      </div>

      {/* Moodboards Manager Dialog */}
      <MoodboardsDialog
        open={moodboardsOpen}
        onOpenChange={setMoodboardsOpen}
      />

      {/* Generate Image Prompt Dialog */}
      <PromptDialog
        asset={promptAsset}
        open={promptDialogOpen}
        onOpenChange={setPromptDialogOpen}
      />
    </div>
  );
}

export default function AdobeAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8 max-w-7xl mx-auto py-12 text-center text-muted-foreground">
          Loading Adobe Stock Analytics...
        </div>
      }
    >
      <AdobeAnalyticsContent />
    </Suspense>
  );
}
