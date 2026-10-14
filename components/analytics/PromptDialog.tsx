'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Asset } from '@/types/asset';
import { PromptDeconstruction } from '@/types/generator';
import { getStorageItem, setStorageItem } from '@/lib/storage';
import { toast } from 'sonner';
import {
  Sparkles,
  Copy,
  RefreshCw,
  Check,
  ChevronDown,
  Layers,
  Palette,
  Camera,
  Sun,
  Maximize2,
  Bookmark,
} from 'lucide-react';
import { SaveToBoardPopover } from './SaveToBoardPopover';
import { useRouter } from 'next/navigation';

interface PromptDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PromptDialog({ asset, open, onOpenChange }: PromptDialogProps) {
  const router = useRouter();
  const [targetGenerator, setTargetGenerator] = useState('midjourney');
  const [detailLevel, setDetailLevel] = useState<'short' | 'standard' | 'detailed'>('standard');
  const [includeNegative, setIncludeNegative] = useState(true);
  const [aspectRatio, setAspectRatio] = useState('3:2');
  const [language, setLanguage] = useState('English');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PromptDeconstruction | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showNegative, setShowNegative] = useState(false);

  const cacheKey = asset ? `prompt_cache_${asset.id}_${targetGenerator}_${detailLevel}` : '';

  const generatePrompt = useCallback(async () => {
    if (!asset) return;

    // Check localStorage cache first
    const cached = getStorageItem<PromptDeconstruction | null>(cacheKey, null);
    if (cached) {
      setResult(cached);
      setEditedPrompt(cached.detailedPrompt || cached.shortPrompt);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: asset.thumbnail_url,
          title: asset.title,
          keywords: asset.keywords,
          targetGenerator,
          detailLevel,
          includeNegative,
          aspectRatio,
          language,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData?.error?.message || `HTTP ${res.status}`);
      }

      const data: PromptDeconstruction = await res.json();
      setResult(data);
      setEditedPrompt(data.detailedPrompt || data.shortPrompt);

      // Save to cache (cap at 200 entries)
      setStorageItem(cacheKey, data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze asset prompt';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [asset, cacheKey, targetGenerator, detailLevel, includeNegative, aspectRatio, language]);

  useEffect(() => {
    let ignore = false;
    let timer: NodeJS.Timeout | null = null;

    if (open && asset) {
      const loadPrompt = async () => {
        const cached = getStorageItem<PromptDeconstruction | null>(cacheKey, null);
        if (cached) {
          if (!ignore) {
            setResult(cached);
            setEditedPrompt(cached.detailedPrompt || cached.shortPrompt);
          }
          return;
        }

        setLoading(true);
        setError(null);

        try {
          const res = await fetch('/api/prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: asset.thumbnail_url,
              title: asset.title,
              keywords: asset.keywords,
              targetGenerator,
              detailLevel,
              includeNegative,
              aspectRatio,
              language,
            }),
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData?.error?.message || `HTTP ${res.status}`);
          }

          const data: PromptDeconstruction = await res.json();
          if (!ignore) {
            setResult(data);
            setEditedPrompt(data.detailedPrompt || data.shortPrompt);
          }
          setStorageItem(cacheKey, data);
        } catch (err: unknown) {
          if (!ignore) {
            const msg = err instanceof Error ? err.message : 'Failed to analyze asset prompt';
            setError(msg);
            toast.error(msg);
          }
        } finally {
          if (!ignore) {
            setLoading(false);
          }
        }
      };

      timer = setTimeout(() => {
        loadPrompt();
      }, 0);
    }

    return () => {
      ignore = true;
      if (timer) clearTimeout(timer);
    };
  }, [open, asset, cacheKey, targetGenerator, detailLevel, includeNegative, aspectRatio, language]);

  const handleCopyPrompt = () => {
    if (!editedPrompt) return;
    navigator.clipboard.writeText(editedPrompt);
    setCopiedPrompt(true);
    toast.success('Prompt copied to clipboard');
    setTimeout(() => setCopiedPrompt(false), 1500);
  };

  const handleCopyJson = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopiedJson(true);
    toast.success('Full prompt JSON copied');
    setTimeout(() => setCopiedJson(false), 1500);
  };

  const handleUseInGenerator = () => {
    if (!asset) return;
    setStorageItem('generator_imported_prompt', {
      title: asset.title,
      prompt: editedPrompt,
      keywords: asset.keywords,
      isAi: true,
    });
    toast.success('Prompt transferred to Metadata Generator');
    onOpenChange(false);
    router.push('/generator');
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-xl">Reverse Image Prompt</DialogTitle>
              <DialogDescription className="text-xs">
                Multimodal AI visual deconstruction for text-to-image generators
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-2">
          {/* Left Column: Thumbnail & Source Metadata */}
          <div className="md:col-span-5 space-y-4">
            <div className="relative aspect-[3/2] w-full rounded-xl overflow-hidden border border-border/50 bg-muted/40 shadow-sm">
              <Image
                src={asset.thumbnail_url}
                alt={asset.title}
                fill
                className="object-contain"
                referrerPolicy="no-referrer"
                unoptimized
              />
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                <span className="rounded-full bg-background/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-foreground border border-border/50">
                  {asset.content_type}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border backdrop-blur-md text-white ${
                    asset.is_generative_ai
                      ? 'bg-orange-800/90 border-orange-700/50'
                      : 'bg-emerald-500/90 border-emerald-500/50'
                  }`}
                >
                  {asset.is_generative_ai ? 'AI Generated' : 'Non-AI'}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground line-clamp-2 tracking-tight">
                {asset.title}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                by {asset.creator_name} • ID #{asset.id}
              </p>
            </div>

            {/* Quick Generator Controls */}
            <div className="rounded-xl border border-border/50 bg-background/50 p-3.5 space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-[10px]">Target Generator</Label>
                <Select value={targetGenerator} onValueChange={setTargetGenerator}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="midjourney">Midjourney v6</SelectItem>
                    <SelectItem value="flux">FLUX.1 / Stable Diffusion XL</SelectItem>
                    <SelectItem value="gemini">Gemini / Imagen 3</SelectItem>
                    <SelectItem value="dalle">DALL·E 3 / GPT Image</SelectItem>
                    <SelectItem value="universal">Universal Text-to-Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Detail Level</Label>
                  <Select
                    value={detailLevel}
                    onValueChange={(val) => setDetailLevel(val as 'short' | 'standard' | 'detailed')}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="detailed">Very Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px]">Aspect Ratio</Label>
                  <Select value={aspectRatio} onValueChange={setAspectRatio}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3:2">3:2 (Standard)</SelectItem>
                      <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                      <SelectItem value="1:1">1:1 (Square)</SelectItem>
                      <SelectItem value="9:16">9:16 (Story)</SelectItem>
                      <SelectItem value="4:5">4:5 (Portrait)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-medium text-foreground">Include Negative Prompt</span>
                <Switch
                  checked={includeNegative}
                  onCheckedChange={setIncludeNegative}
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={generatePrompt}
                disabled={loading}
                className="w-full h-8 text-xs gap-1.5"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                Regenerate Prompt
              </Button>
            </div>
          </div>

          {/* Right Column: Generated Output */}
          <div className="md:col-span-7 flex flex-col space-y-4">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3 rounded-xl border border-dashed border-border/60 bg-muted/20 min-h-[320px]">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm font-semibold text-foreground">Analyzing image with Gemini Vision...</p>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Deconstructing composition, lighting, camera angles, color palette, and stylistic tokens.
                </p>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive min-h-[320px]">
                <p className="text-sm font-semibold">Deconstruction failed</p>
                <p className="text-xs text-center">{error}</p>
                <Button size="sm" variant="outline" onClick={generatePrompt}>
                  Try Again
                </Button>
              </div>
            ) : result ? (
              <div className="space-y-4 flex-1 flex flex-col">
                {/* Main Prompt Textarea */}
                <div className="space-y-1.5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-foreground font-bold">
                      Main Generative Prompt
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      {editedPrompt.length} characters
                    </span>
                  </div>
                  <Textarea
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    className="min-h-[140px] text-sm leading-relaxed rounded-xl font-normal"
                    placeholder="Generated prompt..."
                  />
                </div>

                {/* Midjourney Flags if present */}
                {result.midjourneyFlags && targetGenerator === 'midjourney' && (
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs font-mono text-muted-foreground">
                    <span className="font-semibold text-foreground mr-1">Flags:</span>
                    {result.midjourneyFlags}
                  </div>
                )}

                {/* Semantic Analysis Chips */}
                <div className="space-y-2 rounded-xl border border-border/50 bg-card/60 p-3 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Visual Breakdown
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    {result.lighting && (
                      <div className="flex items-start gap-1.5">
                        <Sun className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-muted-foreground">Lighting:</span>{' '}
                          <span className="text-foreground">{result.lighting}</span>
                        </div>
                      </div>
                    )}
                    {result.composition && (
                      <div className="flex items-start gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-muted-foreground">Composition:</span>{' '}
                          <span className="text-foreground">{result.composition}</span>
                        </div>
                      </div>
                    )}
                    {result.cameraOrLens && (
                      <div className="flex items-start gap-1.5">
                        <Camera className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-muted-foreground">Camera/Lens:</span>{' '}
                          <span className="text-foreground">{result.cameraOrLens}</span>
                        </div>
                      </div>
                    )}
                    {result.suggestedAspectRatio && (
                      <div className="flex items-start gap-1.5">
                        <Maximize2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-muted-foreground">Aspect:</span>{' '}
                          <span className="text-foreground">{result.suggestedAspectRatio}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Color Palette */}
                  {result.colorPalette && result.colorPalette.length > 0 && (
                    <div className="pt-2 border-t border-border/40 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Palette className="h-3 w-3" /> Palette:
                      </span>
                      {result.colorPalette.map((col, idx) => {
                        const isHex = col.startsWith('#');
                        return (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background px-2 py-0.5 text-[10px]"
                          >
                            {isHex && (
                              <span
                                className="h-2.5 w-2.5 rounded-full border border-black/10 shrink-0"
                                style={{ backgroundColor: col }}
                              />
                            )}
                            <span className="font-mono">{col}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Style keywords */}
                  {result.styleKeywords && result.styleKeywords.length > 0 && (
                    <div className="pt-2 border-t border-border/40 flex flex-wrap gap-1">
                      {result.styleKeywords.map((tag, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Collapsible Negative Prompt */}
                {result.negativePrompt && (
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <button
                      onClick={() => setShowNegative(!showNegative)}
                      className="flex w-full items-center justify-between p-2.5 text-xs font-semibold text-muted-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <span>Negative Prompt</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          showNegative ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {showNegative && (
                      <div className="p-3 bg-background/50 text-xs font-mono text-muted-foreground border-t border-border/40">
                        {result.negativePrompt}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 mt-auto">
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCopyPrompt}
                      className="gap-1.5 h-9 text-xs"
                    >
                      {copiedPrompt ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy Prompt
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleCopyJson}
                      className="gap-1.5 h-9 text-xs"
                    >
                      {copiedJson ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy JSON
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <SaveToBoardPopover asset={asset}>
                      <Button variant="outline" size="sm" className="h-9 text-xs gap-1">
                        <Bookmark className="h-3.5 w-3.5" />
                        Save to Board
                      </Button>
                    </SaveToBoardPopover>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleUseInGenerator}
                      className="h-9 text-xs gap-1"
                    >
                      Use in Generator &rarr;
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
