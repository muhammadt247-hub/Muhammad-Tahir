'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Trash2,
  Copy,
  RotateCcw,
  Sparkles,
  Check,
  AlertCircle,
  Plus,
  X,
  FileCheck,
  ShieldAlert,
  AlertTriangle,
  Layers,
  Wand2,
  CheckCircle2,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { GeneratorItemState } from '@/lib/generator/queue';
import { PlatformConfig } from '@/config/platforms';
import { ScoreBadge } from './ScoreBadge';
import { FlagChips } from './FlagChips';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SIMILARITY_HONESTY_NOTE } from '@/config/similarity';

interface ResultCardProps {
  item: GeneratorItemState;
  mode: 'metadata' | 'prompt';
  platformSpec: PlatformConfig;
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
  if (bytes <= 0) return '0 KB';
  return (bytes / 1024).toFixed(1) + ' KB';
}

export function ResultCard({
  item,
  mode,
  platformSpec,
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

  const titleLength = (item.title || '').length;
  const maxTitle = platformSpec.maxTitleLength;
  const isTitleOverLimit = titleLength > maxTitle;

  const keywordsCount = (item.keywords || []).length;
  const maxKeywords = platformSpec.maxKeywordsCount;

  const handleAddKeyword = () => {
    const trimmed = newKeywordInput.trim();
    if (!trimmed) return;
    const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
    const updated = [...(item.keywords || [])];

    for (const p of parts) {
      if (!updated.map((k) => k.toLowerCase()).includes(p.toLowerCase())) {
        updated.push(p);
      }
    }

    onUpdate({ keywords: updated });
    setNewKeywordInput('');
  };

  const handleRemoveKeyword = (index: number) => {
    const updated = [...(item.keywords || [])];
    updated.splice(index, 1);
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
    const text = `Title: ${item.title || ''}\nDescription: ${
      item.description || ''
    }\nKeywords: ${(item.keywords || []).join(', ')}`;
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

  // Highest similarity match for score display
  const topSimilarPair = item.similarPairDetails?.[0];
  const q = item.fingerprint?.quality;

  return (
    <div
      id={`result-card-${item.id}`}
      className={cn(
        'flex flex-col md:flex-row rounded-2xl bg-card shadow-xl overflow-hidden border transition-all duration-300 relative',
        isExcluded
          ? 'border-destructive/40 bg-muted/20 opacity-80'
          : isKeptBest
          ? 'border-emerald-500/50 shadow-emerald-500/5'
          : hardBlockedTerms.length > 0
          ? 'border-destructive/60 hover:border-destructive shadow-destructive/5'
          : 'border-border/50 hover:border-border'
      )}
    >
      {/* Top Banner on Card */}
      {isExcluded && (
        <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded-md bg-destructive text-destructive-foreground text-[10px] font-bold shadow-xs">
          Excluded from Export
        </div>
      )}

      {isKeptBest && !isExcluded && (
        <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
          <Check className="h-3 w-3" />
          <span>Kept (Best in Group)</span>
        </div>
      )}

      {/* Left Column: Preview & File Info (md:w-1/3) */}
      <div className="md:w-1/3 p-4 flex flex-col justify-between border-b md:border-b-0 md:border-r border-border/40 bg-accent/10">
        <div className="space-y-3">
          {/* Square Image Preview */}
          <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-muted/20 border border-border/40 flex items-center justify-center">
            <Image
              src={item.fileData.previewUrl}
              alt={item.fileData.originalName}
              fill
              className="object-contain p-1"
              unoptimized
            />

            {/* Trash Delete Button */}
            <button
              type="button"
              onClick={onDelete}
              title="Remove file"
              aria-label="Remove file"
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-destructive text-white transition-colors backdrop-blur-xs shadow-xs z-10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* File Name & Dimensions */}
          <div className="min-w-0">
            <p
              className="text-xs font-semibold text-foreground truncate"
              title={item.fileData.originalName}
            >
              {item.fileData.originalName}
            </p>
            {/* Size Comparison Line */}
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              {formatBytes(item.fileData.originalSize)} ➔{' '}
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {formatBytes(item.fileData.compressedSize)}
              </span>
            </p>
          </div>
        </div>

        {/* Status Tag & SEO Badge */}
        <div className="pt-3 flex items-center justify-between gap-1 flex-wrap">
          <div>
            {item.status === 'working' && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary animate-pulse">
                <Sparkles className="h-3 w-3 animate-spin" /> Generating...
              </span>
            )}
            {item.status === 'done' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" /> Ready
              </span>
            )}
            {item.status === 'queued' && (
              <span className="text-[11px] text-muted-foreground font-medium">
                Queued
              </span>
            )}
          </div>

          {item.status === 'done' && mode === 'metadata' && (
            <ScoreBadge score={item.seoScore} checklist={item.seoChecklist} />
          )}
        </div>
      </div>

      {/* Right Column: Editable Results (md:w-2/3) */}
      <div className="md:w-2/3 p-4 flex flex-col justify-between space-y-4">
        {/* Loading State: Skeletons */}
        {item.status === 'working' && (
          <div className="space-y-3 animate-pulse py-2">
            <div className="h-4 bg-accent rounded-md w-3/4" />
            <div className="h-16 bg-accent rounded-xl w-full" />
            <div className="h-20 bg-accent rounded-xl w-full" />
          </div>
        )}

        {/* Failure State: Red Inline Message with Retry */}
        {item.status === 'failed' && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 space-y-2 text-destructive">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="h-4 w-4" />
              <span>Generation failed</span>
            </div>
            <p className="text-xs opacity-90">
              {item.errorMessage || 'An error occurred during Gemini AI processing.'}
            </p>
            <button
              type="button"
              onClick={onRegenerate}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Main Content Area */}
        {item.status !== 'working' && item.status !== 'failed' && (
          <div className="space-y-3.5">
            {/* Step 8 Winner Banner */}
            {isKeptBest && !isExcluded && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs">
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold">
                    Kept: Selected as single best image in similar group
                  </span>
                </div>
                {item.aiReviewReason && (
                  <span className="text-[11px] text-muted-foreground truncate max-w-[200px]" title={item.aiReviewReason}>
                    {item.aiReviewReason}
                  </span>
                )}
              </div>
            )}

            {/* Step 8 Similarity Exclusion Banner */}
            {isExcluded && (
              <div className="flex flex-wrap items-center justify-between p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="font-semibold truncate">
                    Excluded: {item.excludedReason || 'Similar to another image'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-auto">
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

            {/* Visual Release & Copyright Advisories */}
            {mode === 'metadata' && (
              <FlagChips flags={item.flags} flagReasons={item.flagReasons} />
            )}

            {/* Blocked Term Red Alert */}
            {hardBlockedTerms.length > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span className="font-semibold truncate">
                    Blocked term: <span className="font-bold underline">{hardBlockedTerms.map((b) => b.term).join(', ')}</span>
                  </span>
                </div>
                {onFixTitle && (
                  <button
                    type="button"
                    onClick={() => onFixTitle(item.id, hardBlockedTerms[0]?.term)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive text-destructive-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity shrink-0"
                  >
                    <Wand2 className="h-3 w-3" />
                    <span>Fix title</span>
                  </button>
                )}
              </div>
            )}

            {/* Ambiguous Term Amber Warning */}
            {ambiguousTerms.length > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="text-[11px]">
                    Check: <span className="font-semibold">{ambiguousTerms.map((a) => a.term).join(', ')}</span> (verify natural use)
                  </span>
                </div>
                {onApproveIssue && (
                  <button
                    type="button"
                    onClick={() => onApproveIssue(item.id, ambiguousTerms[0]?.term)}
                    className="px-2.5 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 text-[10px] font-bold transition-colors shrink-0"
                  >
                    This is fine
                  </button>
                )}
              </div>
            )}

            {/* Similar Title Amber Chip */}
            {item.similarTo && item.similarTo.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.similarTo.map((sim, i) => (
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

            {/* Metadata Mode Content */}
            {mode === 'metadata' ? (
              <>
                {/* 1. Title Input with Length Counter */}
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
                      'w-full px-3 py-2 rounded-xl bg-accent/30 border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all',
                      isTitleOverLimit ? 'border-destructive/80' : 'border-border/60'
                    )}
                  />
                </div>

                {/* 2. Description Input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={item.description || ''}
                    onChange={(e) => onUpdate({ description: e.target.value })}
                    placeholder="Detailed commercial description..."
                    className="w-full px-3 py-2 rounded-xl bg-accent/30 border border-border/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all"
                  />
                </div>

                {/* 3. Keyword Chips Container with Live Count */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-foreground">
                      Keywords
                    </label>
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

                  {/* Chips Scrollable Area */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl bg-accent/20 border border-border/40">
                    {(item.keywords || []).map((kw, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-card border border-border/60 text-xs font-medium text-foreground shadow-2xs group hover:border-primary/40 transition-colors"
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
                    ))}

                    {/* Inline Add Keyword Input */}
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
                        className="w-24 px-2 py-0.5 text-xs bg-transparent border-none text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0"
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
              /* Prompt Mode Content */
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
                  rows={4}
                  value={item.prompt || ''}
                  onChange={(e) => onUpdate({ prompt: e.target.value })}
                  placeholder="Generated image generation prompt..."
                  className="w-full px-3 py-2 rounded-xl bg-accent/30 border border-border/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all font-mono"
                />
              </div>
            )}

            {/* Debug Similarity Scores Accordion */}
            {showSimilarityScores && (item.fingerprint || topSimilarPair) && (
              <div className="rounded-xl border border-border/50 bg-accent/15 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setShowDebugScores(!showDebugScores)}
                  className="w-full flex items-center justify-between px-3 py-2 font-semibold text-muted-foreground hover:text-foreground text-[11px]"
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span>Similarity & Quality Metrics (Debug View)</span>
                  </span>
                  {showDebugScores ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {showDebugScores && (
                  <div className="p-3 pt-0 border-t border-border/30 space-y-2 text-[10px] font-mono text-muted-foreground">
                    {topSimilarPair && (
                      <div className="p-2 rounded-lg bg-background/60 border border-border/40 space-y-1">
                        <div className="flex justify-between font-bold text-foreground">
                          <span>Top Match: {topSimilarPair.otherFilename}</span>
                          <span className="text-primary">{Math.round(topSimilarPair.totalSimilarity * 100)}% Sim</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                          <span>pHash: {Math.round(topSimilarPair.pHashSim * 100)}%</span>
                          <span>dHash: {Math.round(topSimilarPair.dHashSim * 100)}%</span>
                          <span>Region: {Math.round(topSimilarPair.regionSim * 100)}%</span>
                          <span>Color Hist: {Math.round(topSimilarPair.colorSim * 100)}%</span>
                          <span>SSIM: {Math.round(topSimilarPair.ssim * 100)}%</span>
                        </div>
                      </div>
                    )}

                    {q && (
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 p-2 rounded-lg bg-background/40">
                        <span>Focus Sharpness: {q.sharpness}</span>
                        <span>Exposure Score: {q.exposureScore}</span>
                        <span>Clipped Shadows: {Math.round(q.clippedShadows * 100)}%</span>
                        <span>Clipped Highlights: {Math.round(q.clippedHighlights * 100)}%</span>
                        <span>Noise Estimate: {q.noiseEstimate}</span>
                        <span>Overall Q-Score: {Math.round(q.overallQualityScore * 100)}%</span>
                      </div>
                    )}

                    <div className="flex items-start gap-1.5 pt-1 text-[9px] text-muted-foreground/80 not-italic">
                      <Info className="h-3 w-3 shrink-0 text-primary mt-0.5" />
                      <span>{SIMILARITY_HONESTY_NOTE}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom Per-Card Action Buttons */}
        <div className="pt-2 border-t border-border/30 flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={item.status === 'working'}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-border/50 hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Regenerate</span>
          </button>

          <div className="flex items-center gap-2">
            {mode === 'metadata' ? (
              <>
                <button
                  type="button"
                  onClick={handleCopyTitle}
                  disabled={!item.title}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                >
                  {copiedTitle ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>Copy title</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAll}
                  disabled={!item.title && !item.keywords?.length}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {copiedAll ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>Copy all</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleCopyPrompt}
                disabled={!item.prompt}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                {copiedPrompt ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>Copy prompt</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
