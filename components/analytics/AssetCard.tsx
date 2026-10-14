'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Asset } from '@/types/asset';
import { formatNumber, formatDate, relativeTime } from '@/lib/format';
import { useMoodboards } from '@/hooks/useMoodboards';
import { SaveToBoardPopover } from './SaveToBoardPopover';
import {
  Sparkles,
  Bookmark,
  Clock,
  Wand2,
  User,
  Folder,
  Download,
  Calendar,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface AssetCardProps {
  asset: Asset;
  onOpenPrompt: (asset: Asset) => void;
  onSelectContributor: (contributorId: string) => void;
  isDemo?: boolean;
}

export const AssetCard = React.memo(function AssetCard({
  asset,
  onOpenPrompt,
  onSelectContributor,
  isDemo = false,
}: AssetCardProps) {
  const { isAssetInAnyBoard } = useMoodboards();
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedKeywords, setCopiedKeywords] = useState(false);
  const [imgError, setImgError] = useState(false);

  const isInMoodboard = isAssetInAnyBoard(asset.id);

  const handleCopyTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(asset.title);
    setCopiedTitle(true);
    toast.success('Title copied');
    setTimeout(() => setCopiedTitle(false), 1500);
  };

  const handleCopyKeywords = (e: React.MouseEvent) => {
    e.stopPropagation();
    const kwText = (asset.keywords || []).join(', ');
    navigator.clipboard.writeText(kwText);
    setCopiedKeywords(true);
    toast.success('Keywords copied');
    setTimeout(() => setCopiedKeywords(false), 1500);
  };

  const handleKeywordClick = (e: React.MouseEvent, kw: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(kw);
    toast.success(`Copied "${kw}"`);
  };

  const displayedKeywords = (asset.keywords || []).slice(0, 10);
  const remainingKeywords = Math.max(0, (asset.keywords || []).length - 10);

  return (
    <div className="rounded-lg border text-card-foreground shadow-sm overflow-hidden bg-card/60 border-border/50 flex flex-col group relative transition-all duration-500 hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-orange-500/5 hover:via-card/60 hover:to-emerald-500/5 hover:shadow-2xl hover:shadow-orange-500/10">
      {/* Image Area */}
      <div className="relative aspect-[3/2] overflow-hidden bg-muted/50 flex items-center justify-center">
        {imgError ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
            <span className="text-xs font-semibold">{asset.title}</span>
            <span className="text-[10px] mt-1 opacity-60">#{asset.id}</span>
          </div>
        ) : (
          <Image
            src={asset.thumbnail_url}
            alt={asset.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            unoptimized
          />
        )}

        {/* Top-Left Badge Stack */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start pointer-events-none">
          <span className="bg-background/90 hover:bg-background/95 backdrop-blur-md text-foreground border-border/50 shadow-sm capitalize text-[10px] font-semibold px-2 py-0.5 rounded-full border">
            {asset.content_type}
          </span>
          {asset.is_generative_ai ? (
            <span className="bg-orange-800/90 text-white border-orange-700/50 backdrop-blur-md shadow-sm text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" />
              AI Generated
            </span>
          ) : (
            <span className="bg-emerald-500/90 hover:bg-emerald-500 text-white border-emerald-500/50 backdrop-blur-md shadow-sm text-[10px] font-semibold px-2 py-0.5 rounded-full border">
              Non-AI
            </span>
          )}
        </div>

        {/* Top-Right Bookmark Button */}
        <div className="absolute top-2 right-2 z-10">
          <SaveToBoardPopover asset={asset}>
            <button
              title="Save to Moodboard"
              aria-label="Save to Moodboard"
              className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm backdrop-blur-md border transition-colors ${
                isInMoodboard
                  ? 'bg-primary text-primary-foreground border-primary shadow-md'
                  : 'bg-black/30 border-white/20 text-white hover:bg-black/50 hover:border-white/40'
              }`}
            >
              <Bookmark className={`h-4 w-4 ${isInMoodboard ? 'fill-current' : ''}`} />
            </button>
          </SaveToBoardPopover>
        </div>

        {/* Bottom-Left Prompt Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenPrompt(asset);
          }}
          title="Generate Image Prompt"
          aria-label="Generate Image Prompt"
          className="absolute bottom-2 left-2 bg-background/90 hover:bg-background backdrop-blur-md border-border/50 shadow-sm text-[10px] font-semibold px-2 py-0.5 gap-1 rounded-full border flex items-center text-foreground transition-transform hover:scale-105"
        >
          <Wand2 className="h-3 w-3 text-primary" />
          <span>Prompt</span>
        </button>

        {/* Bottom-Right Age Pill */}
        <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-md border-border/50 shadow-sm text-[10px] font-medium px-2 py-0.5 gap-1 rounded-full border flex items-center text-foreground pointer-events-none">
          <Clock className="h-3 w-3 opacity-60" />
          <span>{relativeTime(asset.creation_date)}</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        {/* Title */}
        <h3
          className="text-sm font-semibold leading-snug line-clamp-2 text-foreground tracking-tight"
          title={asset.title}
        >
          {asset.title}
        </h3>

        {/* Contributor Row */}
        <div className="flex items-center gap-2 text-sm">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <a
            href={`/adobe-analytics?mode=contributor&q=${encodeURIComponent(asset.creator_id)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Search by this Contributor in new tab"
            className="text-sm text-muted-foreground hover:text-primary truncate transition-colors"
          >
            {asset.creator_name}
          </a>
          <button
            onClick={() => onSelectContributor(asset.creator_id)}
            title="Search by this Contributor"
            aria-label="Search by this Contributor"
            className="rounded-md bg-muted/60 p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>

        {/* Category Row */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Folder className="h-3 w-3 shrink-0 opacity-60" />
          <span className="truncate">{asset.category || 'N/A'}</span>
        </div>

        {/* Keyword Chips (up to 10) */}
        <div className="flex flex-wrap gap-1 pt-1">
          {displayedKeywords.map((kw, i) => (
            <button
              key={i}
              onClick={(e) => handleKeywordClick(e, kw)}
              title={`Click to copy "${kw}"`}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40 hover:bg-accent hover:text-foreground transition-colors"
            >
              {kw}
            </button>
          ))}
          {remainingKeywords > 0 && (
            <span
              onClick={handleCopyKeywords}
              title="Click to copy all keywords"
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground border border-border/30 cursor-pointer hover:bg-muted/60"
            >
              +{remainingKeywords}
            </span>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40 mt-auto relative">
          {isDemo && (
            <span
              className="absolute top-1.5 right-0 text-[9px] font-bold tracking-wider px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              title="Demo Mode: Synthesized illustrative asset data"
            >
              DEMO
            </span>
          )}
          {/* Downloads */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Download className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-none text-foreground truncate">
                {formatNumber(asset.nb_downloads)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Downloads</p>
            </div>
          </div>

          {/* Upload Date */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-none text-foreground truncate">
                {formatDate(asset.creation_date)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Upload Date</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-0 flex items-center justify-between gap-2">
        {/* Open in Stock */}
        <a
          href={asset.details_url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Adobe Stock"
          className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-border/50 bg-background/50 hover:bg-accent px-3 text-xs font-semibold text-foreground transition-colors"
        >
          <span>Open in Stock</span>
          <ExternalLink className="h-3.5 w-3.5 opacity-60" />
        </a>

        {/* Right Icon Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyTitle}
            title="Copy Title"
            aria-label="Copy Title"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            {copiedTitle ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>

          <button
            onClick={handleCopyKeywords}
            title="Copy Keywords"
            aria-label="Copy Keywords"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            {copiedKeywords ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 rotate-180" />}
          </button>
        </div>
      </div>
    </div>
  );
});
