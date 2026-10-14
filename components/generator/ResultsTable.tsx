'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { GeneratorItem } from '@/types/generator';
import { PLATFORMS } from '@/config/platforms';
import { KeywordEditor } from './KeywordEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  RefreshCw,
  Copy,
  Trash2,
  Check,
  AlertTriangle,
  Search,
  Filter,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface ResultsTableProps {
  items: GeneratorItem[];
  platformId: 'adobe' | 'shutterstock' | 'freepik' | 'generic';
  onUpdateItem: (id: string, partial: Partial<GeneratorItem>) => void;
  onDeleteItem: (id: string) => void;
  onRegenerateItem: (id: string) => void;
  onRegenerateFailed: () => void;
  onBulkTrimKeywords: (max: number) => void;
  onBulkRemoveDuplicates: () => void;
  onBulkFindReplace: (find: string, replace: string) => void;
  isGenerating: boolean;
}

export function ResultsTable({
  items,
  platformId,
  onUpdateItem,
  onDeleteItem,
  onRegenerateItem,
  onRegenerateFailed,
  onBulkTrimKeywords,
  onBulkRemoveDuplicates,
  onBulkFindReplace,
  isGenerating,
}: ResultsTableProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'done' | 'failed' | 'working'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [editingKeywordsId, setEditingKeywordsId] = useState<string | null>(null);

  const spec = PLATFORMS[platformId] || PLATFORMS.adobe;

  const handleCopyRow = (item: GeneratorItem) => {
    const text = `Title: ${item.title}\nKeywords: ${item.keywords.join(', ')}`;
    navigator.clipboard.writeText(text);
    toast.success(`Copied metadata for ${item.filename}`);
  };

  const handleApplyFindReplace = () => {
    if (!findText) return;
    onBulkFindReplace(findText, replaceText);
    toast.success(`Replaced "${findText}" with "${replaceText}"`);
    setShowFindReplace(false);
    setFindText('');
    setReplaceText('');
  };

  // Filter items
  let filteredItems = items;
  if (filterStatus !== 'all') {
    filteredItems = filteredItems.filter((i) => i.status === filterStatus);
  }
  if (searchFilter.trim()) {
    const q = searchFilter.toLowerCase();
    filteredItems = filteredItems.filter(
      (i) =>
        i.filename.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        i.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }

  const failedCount = items.filter((i) => i.status === 'failed').length;

  return (
    <div className="space-y-4">
      {/* Bulk Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/50 bg-card/60 shadow-xs">
        {/* Left: Filter and Search */}
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter by filename or keyword..."
              className="h-8 pl-8 text-xs rounded-xl"
            />
          </div>

          <div className="flex items-center gap-1 border border-border/50 rounded-xl p-0.5 bg-background/50">
            {(['all', 'done', 'working', 'failed'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium capitalize transition-colors ${
                  filterStatus === st
                    ? 'bg-foreground text-background shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Bulk Action Utilities */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {failedCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onRegenerateFailed}
              disabled={isGenerating}
              className="h-8 text-xs gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Retry {failedCount} Failed
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkRemoveDuplicates()}
            className="h-8 text-xs"
            title="Deduplicate keywords on every row"
          >
            Deduplicate Tags
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkTrimKeywords(spec.maxKeywordsCount)}
            className="h-8 text-xs"
            title={`Trim all rows to ${spec.maxKeywordsCount} tags`}
          >
            Trim to {spec.maxKeywordsCount} Tags
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFindReplace(!showFindReplace)}
            className="h-8 text-xs"
          >
            Find &amp; Replace
          </Button>
        </div>
      </div>

      {/* Find & Replace Bar */}
      {showFindReplace && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5 animate-in fade-in-0">
          <Input
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            placeholder="Find text..."
            className="h-8 text-xs bg-background"
          />
          <Input
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="Replace with..."
            className="h-8 text-xs bg-background"
          />
          <Button size="sm" onClick={handleApplyFindReplace} className="h-8 text-xs shrink-0">
            Replace All
          </Button>
        </div>
      )}

      {/* Results Table */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="py-3 px-3 w-16">Preview</th>
                <th className="py-3 px-3 w-40">Filename &amp; Status</th>
                <th className="py-3 px-3 min-w-[240px]">Title &amp; Length</th>
                <th className="py-3 px-3 min-w-[240px]">Keywords ({spec.name})</th>
                <th className="py-3 px-3 w-28">Category</th>
                <th className="py-3 px-3 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredItems.map((item) => {
                const titleLength = item.title.length;
                const isTitleTooLong = titleLength > spec.maxTitleLength;
                const isTitleTooShort = titleLength < spec.minTitleLength && titleLength > 0;
                const isKeywordsOverLimit = item.keywords.length > spec.maxKeywordsCount;
                const isKeywordsUnderLimit = item.keywords.length < spec.minKeywordsCount && item.keywords.length > 0;

                const hasWarning = isTitleTooLong || isTitleTooShort || isKeywordsOverLimit || isKeywordsUnderLimit;

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-muted/20 ${
                      hasWarning ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    {/* Thumbnail */}
                    <td className="py-2.5 px-3 align-top">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted/60 border border-border/40 shrink-0">
                        {item.previewUrl ? (
                          <Image
                            src={item.previewUrl}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                            CSV
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Filename & Status */}
                    <td className="py-2.5 px-3 align-top">
                      <p className="font-semibold text-foreground truncate max-w-[140px]" title={item.filename}>
                        {item.filename}
                      </p>

                      <div className="mt-1 flex items-center gap-1.5">
                        {item.status === 'working' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-orange-500 font-semibold animate-pulse">
                            <RefreshCw className="h-3 w-3 animate-spin" /> Generating...
                          </span>
                        ) : item.status === 'done' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            <Check className="h-3 w-3" /> Done
                          </span>
                        ) : item.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-destructive font-semibold">
                            <AlertTriangle className="h-3 w-3" /> Error
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Queued</span>
                        )}
                      </div>

                      {item.error && (
                        <p className="text-[10px] text-destructive line-clamp-1 mt-0.5" title={item.error}>
                          {item.error}
                        </p>
                      )}
                    </td>

                    {/* Title */}
                    <td className="py-2.5 px-3 align-top space-y-1">
                      <textarea
                        value={item.title}
                        onChange={(e) => onUpdateItem(item.id, { title: e.target.value })}
                        disabled={item.status === 'working'}
                        className="w-full text-xs p-2 rounded-lg border border-border/60 bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary min-h-[52px] resize-y"
                        placeholder="Title will be generated..."
                      />
                      <div className="flex items-center justify-between text-[10px]">
                        <span
                          className={`font-mono font-medium ${
                            isTitleTooLong
                              ? 'text-amber-500 font-bold'
                              : isTitleTooShort
                              ? 'text-amber-500'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {titleLength} / {spec.maxTitleLength} chars
                          {isTitleTooLong && ' (Exceeds limit!)'}
                        </span>
                        {item.isAi && (
                          <span className="text-[9px] text-orange-600 dark:text-orange-400 font-semibold">
                            AI tagged
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Keywords */}
                    <td className="py-2.5 px-3 align-top space-y-1">
                      {editingKeywordsId === item.id ? (
                        <div className="space-y-1">
                          <KeywordEditor
                            keywords={item.keywords}
                            onChange={(kw) => onUpdateItem(item.id, { keywords: kw })}
                            maxKeywords={spec.maxKeywordsCount}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingKeywordsId(null)}
                            className="h-6 text-[10px] px-2"
                          >
                            Done Editing
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <div
                            onClick={() => setEditingKeywordsId(item.id)}
                            className="flex flex-wrap gap-1 max-h-16 overflow-y-auto cursor-pointer p-1 rounded-lg border border-transparent hover:border-border/50 hover:bg-muted/30 transition-colors"
                            title="Click to edit tags"
                          >
                            {item.keywords.map((kw, i) => (
                              <span
                                key={i}
                                className="rounded-full bg-muted/60 px-1.5 py-0.2 text-[10px] text-muted-foreground border border-border/30"
                              >
                                {kw}
                              </span>
                            ))}
                            {item.keywords.length === 0 && (
                              <span className="text-[11px] text-muted-foreground italic">
                                No keywords
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px] mt-1 text-muted-foreground">
                            <span
                              className={isKeywordsOverLimit ? 'text-amber-500 font-bold' : ''}
                            >
                              {item.keywords.length} / {spec.maxKeywordsCount} tags
                            </span>
                            <button
                              onClick={() => setEditingKeywordsId(item.id)}
                              className="text-primary hover:underline text-[10px]"
                            >
                              Edit tags
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-3 align-top">
                      <select
                        value={item.category}
                        onChange={(e) => onUpdateItem(item.id, { category: e.target.value })}
                        className="w-full text-xs p-1.5 rounded-lg border border-border/60 bg-background/50 focus:outline-none"
                      >
                        <option value="">Auto</option>
                        {spec.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 align-top text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onRegenerateItem(item.id)}
                          disabled={item.status === 'working' || isGenerating}
                          title="Regenerate single row"
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopyRow(item)}
                          title="Copy Title &amp; Keywords"
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteItem(item.id)}
                          disabled={item.status === 'working'}
                          title="Delete row"
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
