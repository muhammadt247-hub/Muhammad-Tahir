'use client';

import React, { useState } from 'react';
import { ResultCard } from './ResultCard';
import { GeneratorItemState } from '@/lib/generator/queue';
import { PlatformConfig } from '@/config/platforms';
import { Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResultListProps {
  items: GeneratorItemState[];
  mode: 'metadata' | 'prompt';
  platformSpec: PlatformConfig;
  showSimilarityScores?: boolean;
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
  showSimilarityScores = false,
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
      {/* Cards list */}
      <div className="space-y-4">
        {displayedItems.map((item) => (
          <ResultCard
            key={item.id}
            item={item}
            mode={mode}
            platformSpec={platformSpec}
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
