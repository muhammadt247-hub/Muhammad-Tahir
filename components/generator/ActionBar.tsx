'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Download,
  Square,
  Pause,
  Play,
  Trash2,
  Loader2,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Wand2,
  Layers,
  Clock,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ActionBarProps {
  totalFiles: number;
  doneCount: number;
  failedCount: number;
  pendingCount?: number;
  generatingCount?: number;
  isGenerating: boolean;
  isPaused?: boolean;
  isAnalyzingSimilarity?: boolean;
  hasResults: boolean;
  mode: 'metadata' | 'prompt';
  similarCount?: number;
  similarClusterCount?: number;
  similarExcludedCount?: number;
  under4MpExcludedCount?: number;
  totalExcludedCount?: number;
  needsPreviewCount?: number;
  convertingVectorCount?: number;
  libraryExcludedCount?: number;
  similarDeleteCount?: number;
  blockedCount?: number;
  currentFilename?: string;
  currentImageIndex?: number;
  currentKeyInfo?: string;
  isCoolingDown?: boolean;
  cooldownSecondsRemaining?: number;
  cooldownText?: string;
  statusMessage?: string;
  onGenerateAll: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop: () => void;
  onClearAll: () => void;
  onDeleteSimilar?: () => void;
  onExportCsv: () => void;
  onEmbedMetadata?: () => void;
  onFixSimilarTitles?: () => void;
  onReviewClusters?: () => void;
  onOpenReport?: () => void;
  onFixAllIssues?: () => void;
  readyCount?: number;
  attentionCount?: number;
  attentionItems?: { id: string; filename: string; reason: string }[];
  onExportReadyCsv?: () => void;
  similarityStrictness?: string;
  isFixingAll?: boolean;
}

export function ActionBar({
  totalFiles,
  doneCount,
  failedCount,
  pendingCount: explicitPendingCount,
  generatingCount,
  isGenerating,
  isPaused = false,
  isAnalyzingSimilarity = false,
  hasResults,
  mode,
  similarCount = 0,
  similarClusterCount = 0,
  similarExcludedCount = 0,
  under4MpExcludedCount = 0,
  totalExcludedCount,
  needsPreviewCount = 0,
  convertingVectorCount = 0,
  libraryExcludedCount = 0,
  similarDeleteCount = 0,
  blockedCount = 0,
  currentFilename,
  currentImageIndex,
  currentKeyInfo,
  isCoolingDown = false,
  cooldownSecondsRemaining = 0,
  cooldownText,
  statusMessage,
  onGenerateAll,
  onPause,
  onResume,
  onStop,
  onClearAll,
  onDeleteSimilar,
  onExportCsv,
  onEmbedMetadata,
  onFixSimilarTitles,
  onReviewClusters,
  onOpenReport,
  onFixAllIssues,
  readyCount = 0,
  attentionCount = 0,
  attentionItems = [],
  onExportReadyCsv,
  similarityStrictness = 'strict',
  isFixingAll = false,
}: ActionBarProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  const isAnalyzing = isAnalyzingSimilarity && similarityStrictness !== 'off';

  const excludedTotal = totalExcludedCount !== undefined ? totalExcludedCount : similarExcludedCount;
  const pendingCount =
    explicitPendingCount ??
    Math.max(0, totalFiles - doneCount - failedCount - excludedTotal);

  let generateDisabledReason: string | undefined = undefined;
  if (totalFiles === 0) {
    generateDisabledReason = 'Upload files to begin.';
  } else if (convertingVectorCount > 0) {
    generateDisabledReason = `Converting ${convertingVectorCount} vector file${convertingVectorCount === 1 ? '' : 's'}... Please wait.`;
  } else if (isAnalyzing) {
    generateDisabledReason = 'Checking for similar images...';
  } else if (pendingCount === 0) {
    if (needsPreviewCount > 0) {
      generateDisabledReason = `${needsPreviewCount} vector file(s) need a preview image. Add preview to generate.`;
    } else if (excludedTotal > 0) {
      if (under4MpExcludedCount > 0 && under4MpExcludedCount === excludedTotal) {
        generateDisabledReason = `0 ready: ${excludedTotal} excluded (below 4 MP). Change the size check or click Include all.`;
      } else if (under4MpExcludedCount > 0) {
        const otherExcluded = Math.max(0, excludedTotal - under4MpExcludedCount);
        generateDisabledReason = `0 ready: ${excludedTotal} excluded (below 4 MP: ${under4MpExcludedCount}, similar: ${otherExcluded}). Change the size check or click Include all.`;
      } else {
        generateDisabledReason = `0 ready: ${excludedTotal} excluded (similar). Click Include all.`;
      }
    } else if (doneCount === totalFiles) {
      generateDisabledReason = 'All images are already generated.';
    } else {
      generateDisabledReason = 'No pending images ready to generate.';
    }
  }

  // Status text determination
  let statusText = 'Upload files to begin.';
  let progressPercent = 0;

  if (totalFiles > 0) {
    progressPercent = Math.min(100, Math.round(((doneCount + failedCount) / totalFiles) * 100));

    if (convertingVectorCount > 0) {
      statusText = `Converting ${convertingVectorCount} vector file${convertingVectorCount === 1 ? '' : 's'}...`;
    } else if (isAnalyzingSimilarity) {
      statusText = 'Checking for similar images...';
    } else if (cooldownText) {
      statusText = cooldownText;
    } else if (statusMessage) {
      statusText = statusMessage;
    } else if (isGenerating) {
      if (isPaused) {
        statusText = `Paused · ${doneCount} of ${totalFiles} completed (${pendingCount} pending)`;
      } else {
        const imgNum = currentImageIndex && currentImageIndex > 0 ? currentImageIndex : doneCount + 1;
        statusText = currentFilename
          ? `Image ${imgNum} of ${totalFiles}: ${currentFilename}`
          : `Processing Image ${imgNum} of ${totalFiles}...`;
      }
    } else if (!isGenerating && pendingCount === 0 && generateDisabledReason) {
      if (doneCount > 0) {
        statusText = `${doneCount} completed · ${generateDisabledReason}`;
      } else {
        statusText = generateDisabledReason;
      }
    } else if (doneCount > 0) {
      const parts: string[] = [`${doneCount} completed`];
      if (pendingCount > 0) parts.push(`${pendingCount} pending`);
      if (failedCount > 0) parts.push(`${failedCount} failed`);
      if (excludedTotal > 0) parts.push(`${excludedTotal} skipped`);
      if (needsPreviewCount > 0) parts.push(`${needsPreviewCount} need preview`);
      statusText = parts.join(' · ');
    } else {
      statusText = `${pendingCount} ready to process sequentially`;
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

  const actionsDisabled = isAnalyzing || (isGenerating && !isPaused);
  const similarityTooltip = isAnalyzing ? 'Similarity check in progress' : undefined;

  return (
    <div className="space-y-2">
      {/* Deep Similarity Cluster Banner */}
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

      {/* Auto-Finish Summary Card */}
      {hasResults && (
        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                  {readyCount} ready for CSV
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono text-xs">
                  {attentionCount} need attention
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Batch complete. Ready files can be exported immediately; problem files do not block export.
              </p>
            </div>
            <button
              type="button"
              onClick={onExportReadyCsv || onExportCsv}
              disabled={readyCount === 0 || isGenerating || isAnalyzingSimilarity}
              className="h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 bg-emerald-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV (ready files only)</span>
            </button>
          </div>

          {attentionCount > 0 && attentionItems && attentionItems.length > 0 && (
            <div className="border-t border-border/40 pt-3 space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span>Files needing attention ({attentionItems.length}):</span>
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                {attentionItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border/30">
                    <span className="font-mono truncate max-w-[220px] sm:max-w-[320px] text-foreground">{item.filename}</span>
                    <span className="text-muted-foreground text-[11px] truncate max-w-[200px] sm:max-w-[300px]">{item.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl glass-card border border-border/50 shadow-sm">
        {/* Left: Progress bar & Status text & Badges */}
        <div className="flex-1 min-w-[200px] space-y-2.5">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                {isGenerating ? (
                  isPaused ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">Paused</span>
                  ) : (
                    <span className="text-primary font-semibold flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Sequential Processing
                    </span>
                  )
                ) : doneCount === totalFiles && totalFiles > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Complete</span>
                ) : (
                  'Batch Progress'
                )}
              </span>
              <span>{progressPercent}% ({doneCount}/{totalFiles})</span>
            </div>
            <div className="h-2 rounded-full bg-accent overflow-hidden w-full">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isAnalyzingSimilarity
                    ? 'bg-orange-500 animate-pulse'
                    : isPaused
                    ? 'bg-amber-500'
                    : 'bg-primary'
                }`}
                style={{ width: isAnalyzingSimilarity ? '100%' : `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Status text + Key stats pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-foreground font-medium">
            {isAnalyzingSimilarity && (
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
            )}

            {/* Current Active Image (e.g. Image 3 of 20) */}
            {isGenerating && !isPaused && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[11px] font-bold">
                Image {currentImageIndex && currentImageIndex > 0 ? currentImageIndex : doneCount + 1} of {totalFiles}
              </span>
            )}

            {/* Active API Key in use */}
            {isGenerating && currentKeyInfo && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground font-mono text-[11px] border border-border/50">
                <KeyRound className="h-3 w-3 text-primary" />
                <span className="truncate max-w-[170px]">{currentKeyInfo}</span>
              </span>
            )}

            {/* Cooldown or Delay countdown timer */}
            {cooldownText ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11px] font-semibold animate-pulse border border-amber-500/20">
                <Clock className="h-3 w-3" />
                {cooldownText}
              </span>
            ) : isPaused ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-medium">
                <Pause className="h-3 w-3" />
                Paused · Progress preserved
              </span>
            ) : (
              <span className="font-semibold truncate max-w-[320px]">{statusText}</span>
            )}

            {/* Total / Completed / Pending / Failed counters */}
            {totalFiles > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono shrink-0 ml-auto sm:ml-0">
                <span className="px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground font-semibold">
                  Total: {totalFiles}
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                  Done: {doneCount}
                </span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                    Pending: {pendingCount}
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive font-semibold flex items-center gap-0.5">
                    <AlertTriangle className="h-2.5 w-2.5" /> Failed: {failedCount}
                  </span>
                )}
                {blockedCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive font-semibold">
                    Blocked: {blockedCount}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Fix All Issues Button */}
          {onFixAllIssues && (blockedCount > 0 || similarCount > 0) && !actionsDisabled && (
            <button
              type="button"
              onClick={onFixAllIssues}
              disabled={isFixingAll}
              className="h-10 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-primary/15 text-primary hover:bg-primary/25 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {isFixingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>{isFixingAll ? 'Fixing issues...' : 'Fix all issues'}</span>
            </button>
          )}

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

          {/* Delete Similar Button */}
          {totalFiles > 0 && onDeleteSimilar && (
            <button
              type="button"
              onClick={onDeleteSimilar}
              disabled={isGenerating || isAnalyzingSimilarity || similarDeleteCount === 0}
              title={similarDeleteCount === 0 ? 'No similar files to delete' : `Delete ${similarDeleteCount} similar files`}
              className="h-10 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-destructive/15 text-destructive hover:bg-destructive/25 border border-destructive/20 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <span className="relative inline-flex items-center justify-center w-4 h-4">
                <Layers className="h-4 w-4 opacity-75" />
                <Trash2 className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 text-destructive" />
              </span>
              <span>Delete similar ({similarDeleteCount})</span>
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

          {/* Pause / Resume / Stop / Generate All Controls */}
          {isGenerating ? (
            <div className="flex items-center gap-2">
              {isPaused ? (
                <button
                  type="button"
                  onClick={onResume}
                  className="h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 bg-emerald-600 text-white hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPause}
                  className="h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 bg-amber-500 text-white hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Pause className="h-4 w-4" />
                  <span>Pause</span>
                </button>
              )}
              <button
                type="button"
                onClick={onStop}
                className="h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity shadow-sm"
              >
                <Square className="h-4 w-4 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          ) : (
            <div title={generateDisabledReason} className="inline-block">
              <button
                type="button"
                onClick={onGenerateAll}
                disabled={totalFiles === 0 || isAnalyzingSimilarity || pendingCount === 0}
                className="h-10 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {doneCount > 0 && pendingCount > 0
                    ? `Resume (${pendingCount} pending)`
                    : 'Generate All'}
                </span>
              </button>
            </div>
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
