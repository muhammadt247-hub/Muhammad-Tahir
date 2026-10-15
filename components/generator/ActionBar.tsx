'use client';

import React, { useState } from 'react';
import {
  Trash2,
  Sparkles,
  Square,
  FileText,
  Download,
  Layers,
  Wand2,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ActionBarProps {
  totalFiles: number;
  doneCount: number;
  failedCount: number;
  generatingCount?: number;
  isGenerating: boolean;
  isAnalyzingSimilarity?: boolean;
  hasResults: boolean;
  mode: 'metadata' | 'prompt';
  similarCount?: number;
  similarClusterCount?: number;
  similarExcludedCount?: number;
  libraryExcludedCount?: number;
  blockedCount?: number;
  onGenerateAll: () => void;
  onStop: () => void;
  onClearAll: () => void;
  onExportCsv: () => void;
  onEmbedMetadata?: () => void;
  onFixSimilarTitles?: () => void;
  onReviewClusters?: () => void;
  onOpenReport?: () => void;
}

export function ActionBar({
  totalFiles,
  doneCount,
  failedCount,
  generatingCount,
  isGenerating,
  isAnalyzingSimilarity = false,
  hasResults,
  mode,
  similarCount = 0,
  similarClusterCount = 0,
  similarExcludedCount = 0,
  libraryExcludedCount = 0,
  blockedCount = 0,
  onGenerateAll,
  onStop,
  onClearAll,
  onExportCsv,
  onEmbedMetadata,
  onFixSimilarTitles,
  onReviewClusters,
  onOpenReport,
}: ActionBarProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  // Status text determination (Requirement 5)
  let statusText = 'Upload files to begin.';
  let progressPercent = 0;

  if (totalFiles > 0) {
    if (isAnalyzingSimilarity) {
      statusText = 'Checking for similar images...';
    } else if (isGenerating) {
      const activeGen =
        generatingCount ??
        Math.max(1, totalFiles - similarExcludedCount - doneCount - failedCount);
      const parts: string[] = [];
      parts.push(`${activeGen} generating`);
      if (libraryExcludedCount > 0) {
        parts.push(`${libraryExcludedCount} skipped (already exported)`);
      } else if (similarExcludedCount > 0) {
        parts.push(`${similarExcludedCount} skipped`);
      }
      parts.push(`${similarCount} similar titles`);
      statusText = parts.join(' · ');
      progressPercent = Math.round(((doneCount + failedCount) / totalFiles) * 100);
    } else if (doneCount > 0) {
      const parts: string[] = [];
      parts.push(`${doneCount} generated`);
      if (libraryExcludedCount > 0) {
        parts.push(`${libraryExcludedCount} skipped (already exported)`);
      } else if (similarExcludedCount > 0) {
        parts.push(`${similarExcludedCount} skipped`);
      }
      parts.push(`${similarCount} similar titles`);
      statusText = parts.join(' · ');
      progressPercent = Math.round((doneCount / totalFiles) * 100);
    } else {
      const activeReady = Math.max(0, totalFiles - similarExcludedCount);
      const parts: string[] = [];
      parts.push(`${activeReady} ready`);
      if (libraryExcludedCount > 0) {
        parts.push(`${libraryExcludedCount} skipped (already exported)`);
      } else if (similarExcludedCount > 0) {
        parts.push(`${similarExcludedCount} skipped`);
      }
      parts.push(`${similarCount} similar titles`);
      statusText = parts.join(' · ');
      progressPercent = 0;
    }
  }

  const handleClearClick = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setConfirmClear(false);
    onClearAll();
  };

  const actionsDisabled = isAnalyzingSimilarity || isGenerating;
  const similarityTooltip = isAnalyzingSimilarity ? 'Similarity check in progress' : undefined;

  return (
    <div className="space-y-2">
      {/* Step 8 Deep Similarity Cluster Banner */}
      {similarClusterCount > 0 && onReviewClusters && !isAnalyzingSimilarity && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-orange-500/10 border border-primary/25 text-foreground text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 shrink-0 text-primary" />
            <p className="leading-snug">
              <span className="font-bold">{similarClusterCount} similar group{similarClusterCount === 1 ? '' : 's'}</span> detected ({similarExcludedCount} duplicate image{similarExcludedCount === 1 ? '' : 's'} excluded from export to protect your account).
            </p>
          </div>
          <button
            type="button"
            onClick={onReviewClusters}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-[11px] hover:opacity-90 transition-opacity shrink-0 self-start sm:self-auto shadow-2xs"
          >
            Review similar groups
          </button>
        </div>
      )}

      {/* Main Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl glass-card border border-border/50 shadow-sm">
        {/* Left: Progress bar & Status text & Compliance summary */}
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <div className="h-1.5 rounded-full bg-accent overflow-hidden w-full">
            <div
              className={`h-full transition-all duration-300 rounded-full ${isAnalyzingSimilarity ? 'bg-orange-500 animate-pulse' : 'bg-primary'}`}
              style={{ width: isAnalyzingSimilarity ? '100%' : `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground font-medium truncate">
            {isAnalyzingSimilarity && (
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
            )}
            <span className="font-semibold">{statusText}</span>
            {blockedCount > 0 && (
              <span className="text-destructive font-bold flex items-center gap-1">
                • {blockedCount} blocked
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Fix Similar Titles Button */}
          {similarCount > 0 && onFixSimilarTitles && !actionsDisabled && (
            <button
              type="button"
              onClick={onFixSimilarTitles}
              className="h-10 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 transition-colors"
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span>Fix similar titles</span>
            </button>
          )}

          {/* Compliance Report Trigger */}
          {hasResults && onOpenReport && !actionsDisabled && (
            <button
              type="button"
              onClick={onOpenReport}
              className={`h-10 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                blockedCount > 0
                  ? 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20'
                  : 'bg-card border-border/60 hover:bg-accent text-foreground'
              }`}
            >
              {blockedCount > 0 ? (
                <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              )}
              <span>Report</span>
            </button>
          )}

          {/* Clear All */}
          {totalFiles > 0 && (
            <button
              type="button"
              onClick={handleClearClick}
              disabled={isGenerating || isAnalyzingSimilarity}
              className="h-10 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{confirmClear ? 'Confirm Clear?' : 'Clear'}</span>
            </button>
          )}

          {/* Generate All / Stop */}
          {isGenerating ? (
            <button
              type="button"
              onClick={onStop}
              className="h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity shadow-sm"
            >
              <Square className="h-4 w-4 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onGenerateAll}
              disabled={totalFiles === 0 || isAnalyzingSimilarity}
              title={similarityTooltip}
              className="h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:pointer-events-none"
            >
              <Sparkles className="h-4 w-4" />
              <span>Generate All</span>
            </button>
          )}

          {/* Embed Metadata (Metadata mode only) */}
          {mode === 'metadata' && (
            <Button
              type="button"
              variant="outline"
              onClick={onEmbedMetadata}
              disabled={!hasResults || isGenerating || isAnalyzingSimilarity}
              title={similarityTooltip}
              className="h-10 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Embed</span>
            </Button>
          )}

          {/* Export CSV */}
          <Button
            type="button"
            variant="outline"
            onClick={onExportCsv}
            disabled={!hasResults || isGenerating || isAnalyzingSimilarity}
            title={similarityTooltip}
            className="h-10 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
