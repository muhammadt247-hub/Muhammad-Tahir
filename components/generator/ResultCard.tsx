'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  GeneratorItemState,
} from '@/lib/generator/queue';
import { PlatformConfig } from '@/config/platforms';
import {
  RotateCcw,
  Copy,
  Check,
  Trash2,
  AlertCircle,
  Plus,
  X,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ShieldAlert,
  Wand2,
  Loader2,
} from 'lucide-react';
import { FlagChips } from './FlagChips';
import { ScoreBadge } from './ScoreBadge';
import { SIMILARITY_HONESTY_NOTE } from '@/config/similarity';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ResultCardProps {
  item: GeneratorItemState;
  mode: 'metadata' | 'prompt';
  platformSpec: PlatformConfig;
  minSizeCheck?: 'exclude' | 'warn' | 'off';
  showSimilarityScores?: boolean;
  onUpdate: (updated: Partial<GeneratorItemState>) => void;
  onDelete: () => void;
  onRegenerate: () => void;
  onFixTitle?: (id: string, term?: string) => void;
  onApproveIssue?: (id: string, issue: string) => void;
  onScrollToItem?: (targetId: string) => void;
  onKeepInstead?: (id: string) => void;
  onIncludeAnyway?: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResultCard({
  item,
  mode,
  platformSpec,
  minSizeCheck = 'exclude',
  showSimilarityScores = false,
  onUpdate,
  onDelete,
  onRegenerate,
  onFixTitle,
  onApproveIssue,
  onScrollToItem,
  onKeepInstead,
  onIncludeAnyway,
}: ResultCardProps) {
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedKeywords, setCopiedKeywords] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showDebugScores, setShowDebugScores] = useState(false);

  // Platform constraints
  const maxTitle = platformSpec.maxTitleLength;
  const maxKeywords = platformSpec.maxKeywordsCount;
  const titleLength = (item.title || '').length;
  const isTitleOverLimit = titleLength > maxTitle;
  const keywordsCount = (item.keywords || []).length;

  const handleAddKeyword = () => {
    const raw = newKeywordInput.trim();
    if (!raw) return;

    const parts = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const currentKeywords = item.keywords || [];
    const updated = [...currentKeywords];

    for (const kw of parts) {
      if (!updated.includes(kw) && updated.length < maxKeywords) {
        updated.push(kw);
      }
    }

    onUpdate({ keywords: updated });
    setNewKeywordInput('');
  };

  const handleRemoveKeyword = (index: number) => {
    const updated = (item.keywords || []).filter((_, i) => i !== index);
    onUpdate({ keywords: updated });
  };

  const handleCopyTitle = () => {
    if (!item.title) return;
    navigator.clipboard.writeText(item.title);
    setCopiedTitle(true);
    toast.success('Title copied');
    setTimeout(() => setCopiedTitle(false), 2000);
  };

  const handleCopyKeywords = () => {
    if (!item.keywords || item.keywords.length === 0) return;
    navigator.clipboard.writeText(item.keywords.join(', '));
    setCopiedKeywords(true);
    toast.success('Keywords copied');
    setTimeout(() => setCopiedKeywords(false), 2000);
  };

  const handleCopyAll = () => {
    const descLine = platformSpec.hasDescription && item.description ? `Description: ${item.description}\n` : '';
    const text = `Title: ${item.title || ''}\n${descLine}Keywords: ${(item.keywords || []).join(', ')}`;
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    toast.success('All metadata copied');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyPrompt = () => {
    if (!item.prompt) return;
    navigator.clipboard.writeText(item.prompt);
    setCopiedPrompt(true);
    toast.success('Prompt copied');
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const isExcluded = !!item.isExcluded;
  const isKeptBest = !!item.isKeptBest;

  // Blocked terms separation
  const hardBlockedTerms = (item.blockedTermsFound || []).filter((b) => !b.isAmbiguous);
  const ambiguousTerms = (item.blockedTermsFound || []).filter((b) => b.isAmbiguous);

  // Resolution & Adobe Limits Check
  const width = item.fileData.width || 0;
  const height = item.fileData.height || 0;
  const megapixels = width > 0 && height > 0 ? (width * height) / 1_000_000 : 0;
  const isUnder4MpRaw = width > 0 && height > 0 && megapixels < 4.0;
  const isUnder4MpExcluded = minSizeCheck === 'exclude' && isUnder4MpRaw;
  const isUnder4MpWarn = minSizeCheck === 'warn' && isUnder4MpRaw;
  const isOver100Mp = megapixels > 100;
  const isOver45Mb = (item.fileData.originalSize || 0) > 45 * 1024 * 1024;
  const isAlreadyExported = item.excludedReason?.startsWith('Already exported');
  const hasGeneratedContent =
    item.status === 'done' &&
    Boolean(item.title?.trim()) &&
    item.title.trim() !== item.fileData.originalName;

  // Highest similarity match for score display
  const topSimilarPair = item.similarPairDetails?.[0];
  const q = item.fingerprint?.quality;

  // Determine Excluded Reason Text for status chip
  let excludedReasonText = item.excludedReason || 'Similar to another image';
  if (isUnder4MpExcluded) {
    excludedReasonText = "Below Adobe's 4 MP minimum, likely refused";
  } else if (isOver100Mp) {
    excludedReasonText = `Over Adobe's 100 MP limit (${megapixels.toFixed(1)} MP)`;
  } else if (isOver45Mb) {
    excludedReasonText = "Over Adobe's 45 MB limit";
  } else if (hardBlockedTerms.length > 0) {
    excludedReasonText = `Blocked trademark (${hardBlockedTerms[0]?.term})`;
  } else if (isAlreadyExported) {
    excludedReasonText = item.excludedReason || 'Already exported';
  }

  const itemIsEffectivelyExcluded =
    item.isExcluded &&
    !(minSizeCheck !== 'exclude' && item.excludedReason === "Below Adobe's 4 MP minimum, likely refused");

  const isAnyExclusion =
    itemIsEffectivelyExcluded || isUnder4MpExcluded || isOver100Mp || isOver45Mb || hardBlockedTerms.length > 0;
  const isReadyForExport = hasGeneratedContent && !isAnyExclusion;

  return (
    <div
      id={`result-card-${item.id}`}
      className={cn(
        'flex flex-col md:flex-row rounded-2xl bg-card shadow-md overflow-hidden border transition-all duration-300 relative scroll-mt-20',
        isAnyExclusion
          ? 'border-destructive/40 bg-muted/20 opacity-95'
          : isKeptBest
          ? 'border-emerald-500/50 shadow-emerald-500/5'
          : 'border-border/60 hover:border-border'
      )}
    >
      {/* 1. LEFT PICTURE AREA (Desktop: side-by-side left; Mobile: stacked top) */}
      <div className="relative aspect-video md:aspect-auto md:w-64 lg:w-72 md:shrink-0 bg-muted/40 border-b md:border-b-0 md:border-r border-border/40 overflow-hidden flex items-center justify-center min-h-[220px] md:min-h-0">
        <Image
          src={item.fileData.previewUrl || item.fileData.aiDataUrl}
          alt={item.fileData.originalName}
          fill
          className="object-contain p-2"
          unoptimized
          referrerPolicy="no-referrer"
        />

        {/* Badges on Image: Excluded, Amber Warn Chip, and Best of group (Top-Left) */}
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-1 items-start max-w-[70%]">
          {isUnder4MpWarn && !itemIsEffectivelyExcluded && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-bold shadow-xs truncate max-w-full">
              Below 4 MP, Adobe may refuse
            </span>
          )}

          {(itemIsEffectivelyExcluded || isUnder4MpExcluded) && (
            <span className="px-2 py-0.5 rounded-md bg-destructive text-destructive-foreground text-[10px] font-bold shadow-xs truncate max-w-full">
              {isUnder4MpExcluded
                ? '< 4 MP (Excluded)'
                : isAlreadyExported
                ? item.excludedReason
                : 'Excluded from Export'}
            </span>
          )}

          {isKeptBest && !itemIsEffectivelyExcluded && !isUnder4MpExcluded && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
              <Check className="h-3 w-3" />
              <span>Best of group</span>
            </span>
          )}
        </div>

        {/* Badges on Image: Score badge & Trash button (Top-Right) */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          {hasGeneratedContent && mode === 'metadata' && (
            <ScoreBadge score={item.seoScore} checklist={item.seoChecklist} />
          )}

          <button
            type="button"
            onClick={onDelete}
            title="Remove file"
            aria-label="Remove file"
            className="p-1.5 rounded-lg bg-black/60 hover:bg-destructive text-white transition-colors backdrop-blur-xs shadow-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Badges on Image: Flag chips along the bottom */}
        {mode === 'metadata' && (
          <div className="absolute bottom-2 left-2 right-2 z-20 flex flex-wrap gap-1 pointer-events-auto">
            <FlagChips flags={item.flags} flagReasons={item.flagReasons} />
          </div>
        )}
      </div>

      {/* 2. RIGHT CARD CONTENT & FIELDS (Desktop: side-by-side right; Mobile: stacked below) */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3.5 min-w-0">
        {/* File name and size line sit directly under the image */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs pb-1 border-b border-border/30">
          <p
            className="font-semibold text-foreground truncate max-w-[65%]"
            title={item.fileData.originalName}
          >
            {item.fileData.originalName}
          </p>
          <div className="text-[11px] font-mono flex items-center gap-1.5 text-muted-foreground">
            {width > 0 && height > 0 ? (
              <span
                className={cn(
                  'font-medium',
                  isUnder4MpExcluded || isOver100Mp
                    ? 'text-destructive font-bold'
                    : isUnder4MpWarn
                    ? 'text-amber-600 dark:text-amber-400 font-bold'
                    : 'text-foreground'
                )}
              >
                {width} × {height} ({megapixels.toFixed(1)} MP)
              </span>
            ) : null}
            <span>·</span>
            <span className={cn(isOver45Mb ? 'text-destructive font-bold' : '')}>
              {formatBytes(item.fileData.originalSize)}
            </span>
          </div>
        </div>

        {/* Working Progress & Stage Indicator */}
        {item.status === 'working' && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                <span className="text-xs font-semibold text-primary truncate">
                  {item.currentStage || 'Generating metadata with Gemini AI...'}
                </span>
              </div>
              {item.modelUsed && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary shrink-0">
                  {item.modelUsed}
                </span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-primary/15 overflow-hidden w-full">
              <div className="h-full bg-primary animate-pulse w-full rounded-full" />
            </div>
          </div>
        )}

        {/* Failed Banner with Full Diagnostics */}
        {item.status === 'failed' && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 space-y-2 text-destructive text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  {item.httpStatus ? `HTTP ${item.httpStatus}: ` : ''}
                  Generation Failed
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={onRegenerate}
                className="h-6 text-[10px] px-2.5 font-bold"
              >
                Retry
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed break-words opacity-95">
              {item.errorMessage || 'An error occurred during Gemini AI processing.'}
            </p>
            {item.errorDetails && (
              <p className="text-[10px] font-mono text-muted-foreground bg-background/60 p-2 rounded-lg border border-border/40 break-words">
                {item.errorDetails}
              </p>
            )}
          </div>
        )}

        {/* Action Banners & Warnings */}
        {item.status !== 'working' && item.status !== 'failed' && (
          <div className="space-y-2.5">
            {/* Exclusion Override / Keep Banner */}
            {itemIsEffectivelyExcluded && (
              <div className="flex flex-wrap items-center justify-between p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="font-semibold truncate">
                    {item.excludedReason?.startsWith('Already exported')
                      ? item.excludedReason
                      : `Excluded: ${item.excludedReason || 'Similar to another image'}`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  {onKeepInstead && (
                    <button
                      type="button"
                      onClick={() => onKeepInstead(item.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
                    >
                      <ArrowRightLeft className="h-3 w-3" />
                      <span>Keep this instead</span>
                    </button>
                  )}
                  {onIncludeAnyway && (
                    <button
                      type="button"
                      onClick={() => onIncludeAnyway(item.id)}
                      className="px-2 py-1 rounded-lg border border-destructive/40 text-destructive text-[11px] font-medium hover:bg-destructive/10 transition-colors"
                      title="Override exclusion and include in export"
                    >
                      Include anyway
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Resolution Check Red Alerts */}
            {isUnder4MpExcluded && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span className="font-semibold text-[11px]">
                    Below Adobe&apos;s 4 MP minimum, likely refused ({width} × {height} = {megapixels.toFixed(1)} MP)
                  </span>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground uppercase shrink-0">
                  Refused
                </span>
              </div>
            )}

            {/* Resolution Check Amber Warning (Warn only mode) */}
            {isUnder4MpWarn && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="font-semibold text-[11px]">
                    Below 4 MP, Adobe may refuse ({width} × {height} = {megapixels.toFixed(1)} MP)
                  </span>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 uppercase shrink-0">
                  Warning
                </span>
              </div>
            )}

            {(isOver100Mp || isOver45Mb) && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="font-semibold text-[11px]">
                    {isOver100Mp
                      ? `Over Adobe's 100 MP limit (${megapixels.toFixed(1)} MP)`
                      : `Over Adobe's 45 MB limit (${formatBytes(item.fileData.originalSize)})`}
                  </span>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground uppercase shrink-0">
                  Refused
                </span>
              </div>
            )}

            {/* Blocked Term Red Alert */}
            {hardBlockedTerms.length > 0 && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span className="font-semibold truncate text-[11px]">
                    Blocked term: <span className="font-bold underline">{hardBlockedTerms.map((b) => b.term).join(', ')}</span>
                  </span>
                </div>
                {onFixTitle && (
                  <button
                    type="button"
                    onClick={() => onFixTitle(item.id, hardBlockedTerms[0]?.term)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-destructive text-destructive-foreground text-[10px] font-semibold hover:opacity-90 shrink-0"
                  >
                    <Wand2 className="h-3 w-3" />
                    <span>Fix title</span>
                  </button>
                )}
              </div>
            )}

            {/* Ambiguous Term Warning */}
            {ambiguousTerms.length > 0 && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="text-[11px]">
                    Check: <span className="font-semibold">{ambiguousTerms.map((a) => a.term).join(', ')}</span>
                  </span>
                </div>
                {onApproveIssue && (
                  <button
                    type="button"
                    onClick={() => onApproveIssue(item.id, ambiguousTerms[0]?.term)}
                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 text-[10px] font-bold shrink-0"
                  >
                    This is fine
                  </button>
                )}
              </div>
            )}

            {/* Similar Title Amber Chips */}
            {hasGeneratedContent && item.similarTo && item.similarTo.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.similarTo
                  .filter((sim) => sim.otherId !== item.id && sim.otherFilename.toLowerCase().trim() !== item.fileData.originalName.toLowerCase().trim())
                  .map((sim, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (sim.otherId && onScrollToItem) {
                          onScrollToItem(sim.otherId);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-[10px] font-medium hover:bg-amber-500/20 transition-colors"
                    >
                      <Layers className="h-3 w-3" />
                      <span>
                        {sim.reason === 'same_opening_words'
                          ? sim.otherFilename
                          : `Similar title to: ${sim.otherFilename}`}
                      </span>
                    </button>
                  ))}
              </div>
            )}

            {/* Title (with counter) */}
            {mode === 'metadata' ? (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-foreground">Title</label>
                    <span
                      className={cn(
                        'text-[10px] font-mono',
                        isTitleOverLimit
                          ? 'text-destructive font-bold'
                          : 'text-muted-foreground'
                      )}
                    >
                      {titleLength}/{maxTitle} chars
                    </span>
                  </div>
                  <input
                    type="text"
                    value={item.title || ''}
                    onChange={(e) => onUpdate({ title: e.target.value })}
                    placeholder="Stock asset title..."
                    className={cn(
                      'w-full px-3 py-1.5 rounded-xl bg-accent/30 border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all',
                      isTitleOverLimit ? 'border-destructive/80' : 'border-border/60'
                    )}
                  />
                </div>

                {/* Description (ONLY if platformSpec.hasDescription is true) */}
                {platformSpec.hasDescription && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={item.description || ''}
                      onChange={(e) => onUpdate({ description: e.target.value })}
                      placeholder="Detailed commercial description..."
                      className="w-full px-3 py-1.5 rounded-xl bg-accent/30 border border-border/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all"
                    />
                  </div>
                )}

                {/* Keywords (chips) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-foreground">Keywords</label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {keywordsCount}/{maxKeywords} tags
                      </span>
                      {keywordsCount > 0 && (
                        <button
                          type="button"
                          onClick={handleCopyKeywords}
                          className="text-[10px] text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                        >
                          {copiedKeywords ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5" />}
                          <span>{copiedKeywords ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-xl bg-accent/20 border border-border/40 min-h-[38px] items-center">
                    {(item.keywords || []).length === 0 ? (
                      <span className="text-xs text-muted-foreground/60 italic py-0.5 px-1 select-none">
                        No keywords generated yet...
                      </span>
                    ) : (
                      (item.keywords || []).map((kw, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-card border border-border/60 text-xs font-medium text-foreground shadow-2xs group hover:border-primary/40 transition-colors"
                        >
                          <span className="text-[10px] text-muted-foreground/60 mr-0.5 font-mono">
                            {idx + 1}
                          </span>
                          <span>{kw}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveKeyword(idx)}
                            className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                            title="Remove keyword"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    )}

                    <div className="inline-flex items-center gap-1 ml-1">
                      <input
                        type="text"
                        value={newKeywordInput}
                        onChange={(e) => setNewKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            handleAddKeyword();
                          }
                        }}
                        placeholder="+ Add tag..."
                        className="w-20 px-1.5 py-0.5 text-xs bg-transparent border-none text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0"
                      />
                      {newKeywordInput.trim() && (
                        <button
                          type="button"
                          onClick={handleAddKeyword}
                          className="p-1 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                          title="Add tag"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Prompt Mode */
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-foreground">
                    Reverse-Engineered Prompt
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="text-[10px] text-primary hover:underline font-medium inline-flex items-center gap-1"
                  >
                    {copiedPrompt ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedPrompt ? 'Copied' : 'Copy prompt'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={item.prompt || ''}
                  onChange={(e) => onUpdate({ prompt: e.target.value })}
                  placeholder="Generated prompt..."
                  className="w-full px-3 py-1.5 rounded-xl bg-accent/30 border border-border/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all font-mono"
                />
              </div>
            )}

            {/* Debug Scores (if enabled) */}
            {showSimilarityScores && (item.fingerprint || topSimilarPair) && (
              <div className="rounded-xl border border-border/50 bg-accent/15 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setShowDebugScores(!showDebugScores)}
                  className="w-full flex items-center justify-between px-3 py-1.5 font-semibold text-muted-foreground hover:text-foreground text-[10px]"
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3 w-3 text-primary" />
                    <span>Similarity & Quality Metrics</span>
                  </span>
                  {showDebugScores ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {showDebugScores && (
                  <div className="p-2.5 pt-0 border-t border-border/30 space-y-1 text-[10px] font-mono text-muted-foreground">
                    {topSimilarPair && (
                      <div className="p-1.5 rounded bg-background/60 border border-border/40">
                        Top Match: {topSimilarPair.otherFilename} ({Math.round(topSimilarPair.totalSimilarity * 100)}%)
                      </div>
                    )}
                    {q && (
                      <div className="grid grid-cols-2 gap-1 p-1.5 rounded bg-background/40">
                        <span>Sharpness: {q.sharpness}</span>
                        <span>Score: {Math.round(q.overallQualityScore * 100)}%</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. BUTTONS (Regenerate, Copy title, Copy all) & VISIBLE FINAL STATUS CHIP (Requirement 2 & 4) */}
        <div className="pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 mt-auto">
          {/* Action buttons: Regenerate, Copy title, Copy all */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRegenerate}
              disabled={item.status === 'working'}
              className="h-7 text-xs font-semibold px-2.5 gap-1.5"
              title="Regenerate"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Regenerate</span>
            </Button>

            {mode === 'metadata' ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyTitle}
                  disabled={!item.title}
                  className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                >
                  {copiedTitle ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>Copy title</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyAll}
                  disabled={!item.title && !(item.keywords && item.keywords.length > 0)}
                  className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
                >
                  {copiedAll ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>Copy all</span>
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleCopyPrompt}
                disabled={!item.prompt}
                className="h-7 text-xs px-2 gap-1 text-primary hover:text-primary"
              >
                {copiedPrompt ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>Copy prompt</span>
              </Button>
            )}
          </div>

          {/* Visible Final Status Chip (Requirement 4) */}
          <div className="ml-auto flex items-center">
            {item.status === 'failed' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/15 text-destructive border border-destructive/30 text-[11px] font-semibold max-w-[280px]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate" title={item.errorMessage || 'Generation failed'}>
                  {item.httpStatus ? `HTTP ${item.httpStatus}` : 'Failed'}
                  {item.errorMessage ? `: ${item.errorMessage}` : ''}
                </span>
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="underline hover:opacity-80 ml-1 font-bold shrink-0"
                >
                  Retry
                </button>
              </span>
            ) : isAnyExclusion ? (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive border border-destructive/25 text-[11px] font-semibold max-w-[220px]"
                title={excludedReasonText}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Excluded ({excludedReasonText})</span>
              </span>
            ) : isReadyForExport ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Exported</span>
              </span>
            ) : item.status === 'working' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/25 text-[11px] font-semibold animate-pulse">
                <Sparkles className="h-3 w-3 animate-spin shrink-0" />
                <span>Generating...</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted text-muted-foreground border border-border/50 text-[10px] font-medium">
                Not generated
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
