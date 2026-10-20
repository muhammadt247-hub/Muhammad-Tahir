'use client';

import React, { useState } from 'react';
import { ResultCard } from './ResultCard';
import { GeneratorItemState } from '@/lib/generator/queue';
import { PlatformConfig } from '@/config/platforms';
import { Image as ImageIcon, ChevronLeft, ChevronRight, Database, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResultListProps {
  items: GeneratorItemState[];
  mode: 'metadata' | 'prompt';
  platformSpec: PlatformConfig;
  minSizeCheck?: 'exclude' | 'warn' | 'off';
  showSimilarityScores?: boolean;
  alreadyExportedCount?: number;
  totalExcludedCount?: number;
  under4MpExcludedCount?: number;
  similarExcludedCount?: number;
  onIncludeAll?: () => void;
  onIncludeBelow4MpOnly?: () => void;
  onIgnoreLibraryAndGenerate?: () => void;
  onClearLibrary?: () => void;
  onUpdateItem: (id: string, updated: Partial<GeneratorItemState>) => void;
  onDeleteItem: (id: string) => void;
  onRegenerateItem: (id: string) => void;
  onFixTitle?: (id: string, term?: string) => void;
  onApproveIssue?: (id: string, issue: string) => void;
  onScrollToItem?: (targetId: string) => void;
  onKeepInstead?: (id: string) => void;
  onIncludeAnyway?: (id: string) => void;
}

export function ResultList({
  items,
  mode,
  platformSpec,
  minSizeCheck = 'exclude',
  showSimilarityScores = false,
  alreadyExportedCount = 0,
  totalExcludedCount = 0,
  under4MpExcludedCount = 0,
  similarExcludedCount = 0,
  onIncludeAll,
  onIncludeBelow4MpOnly,
  onIgnoreLibraryAndGenerate,
  onClearLibrary,
  onUpdateItem,
  onDeleteItem,
  onRegenerateItem,
  onFixTitle,
  onApproveIssue,
  onScrollToItem,
  onKeepInstead,
  onIncludeAnyway,
}: ResultListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Empty State
  if (items.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-dashed border-border/60 p-12 text-center flex flex-col items-center justify-center space-y-3 min-h-[300px]">
        <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-muted-foreground shadow-xs">
          <ImageIcon className="h-8 w-8 text-primary/70" />
        </div>
        <div className="space-y-1 max-w-sm">
          <h3 className="text-lg font-bold text-foreground">
            Your generated results will appear here.
          </h3>
          <p className="text-sm text-muted-foreground">
            Upload some files and click &ldquo;Generate All&rdquo; to get started.
          </p>
        </div>
      </div>
    );
  }

  // Windowed rendering when > 50 items
  const totalPages = Math.ceil(items.length / pageSize);
  const isWindowed = items.length > 50;
  const displayedItems = isWindowed
    ? items.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : items;

  return (
    <div className="space-y-4">
      {/* Top of file list banner: N files were already exported */}
      {alreadyExportedCount > 0 && onIgnoreLibraryAndGenerate && onClearLibrary && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs shadow-xs">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Database className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <span className="font-bold">{alreadyExportedCount}</span> {alreadyExportedCount === 1 ? 'file was' : 'files were'} already exported.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={onIgnoreLibraryAndGenerate}
              className="h-7 text-xs font-semibold px-3"
            >
              Ignore library for this batch
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onClearLibrary}
              className="h-7 text-xs px-3"
            >
              Clear library
            </Button>
          </div>
        </div>
      )}

      {/* Requirement 3: Excluded files banner */}
      {(totalExcludedCount ?? 0) > 0 && onIncludeAll && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/25 text-xs shadow-xs">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
            <span>
              <span className="font-bold">{totalExcludedCount}</span>{' '}
              {totalExcludedCount === 1 ? 'file is' : 'files are'} excluded (below 4 MP: {under4MpExcludedCount ?? 0}, similar: {similarExcludedCount ?? 0})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={onIncludeAll}
              className="h-7 text-xs font-semibold px-3"
            >
              Include all
            </Button>
            {(under4MpExcludedCount ?? 0) > 0 && onIncludeBelow4MpOnly && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onIncludeBelow4MpOnly}
                className="h-7 text-xs px-3 font-semibold border-destructive/30 hover:bg-destructive/10 text-destructive"
              >
                Include only the below-4 MP ones
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Cards list (vertical stack of side-by-side cards) */}
      <div className="space-y-4">
        {displayedItems.map((item) => (
          <ResultCard
            key={item.id}
            item={item}
            mode={mode}
            platformSpec={platformSpec}
            minSizeCheck={minSizeCheck}
            showSimilarityScores={showSimilarityScores}
            onUpdate={(updated) => onUpdateItem(item.id, updated)}
            onDelete={() => onDeleteItem(item.id)}
            onRegenerate={() => onRegenerateItem(item.id)}
            onFixTitle={onFixTitle}
            onApproveIssue={onApproveIssue}
            onScrollToItem={onScrollToItem}
            onKeepInstead={onKeepInstead}
            onIncludeAnyway={onIncludeAnyway}
          />
        ))}
      </div>

      {/* Pagination controls for windowed list > 50 */}
      {isWindowed && totalPages > 1 && (
        <div className="flex items-center justify-between p-4 rounded-2xl glass-card border border-border/50">
          <p className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} -{' '}
            {Math.min(currentPage * pageSize, items.length)} of {items.length} items
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 rounded-xl gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </Button>
            <span className="text-xs font-semibold px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 rounded-xl gap-1 text-xs"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
