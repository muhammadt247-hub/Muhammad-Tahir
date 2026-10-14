'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SortOption, ContentTypeFilter, AiFilter } from '@/types/asset';

interface FilterBarProps {
  sort: SortOption;
  contentType: ContentTypeFilter;
  ai: AiFilter;
  onSortChange: (sort: SortOption) => void;
  onContentTypeChange: (type: ContentTypeFilter) => void;
  onAiChange: (ai: AiFilter) => void;
}

export function FilterBar({
  sort,
  contentType,
  ai,
  onSortChange,
  onContentTypeChange,
  onAiChange,
}: FilterBarProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/30">
      {/* 1. Sort By */}
      <div className="space-y-1.5">
        <Label>Sort By</Label>
        <Select
          value={sort}
          onValueChange={(val) => onSortChange(val as SortOption)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nb_downloads">Most Downloads</SelectItem>
            <SelectItem value="relevance">Relevance</SelectItem>
            <SelectItem value="creation">Newest (Upload Date)</SelectItem>
            <SelectItem value="featured">Featured</SelectItem>
            <SelectItem value="undiscovered">Undiscovered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 2. Content Type */}
      <div className="space-y-1.5">
        <Label>Content Type</Label>
        <Select
          value={contentType}
          onValueChange={(val) => onContentTypeChange(val as ContentTypeFilter)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Asset Types</SelectItem>
            <SelectItem value="photo">Photo / Image</SelectItem>
            <SelectItem value="illustration">Illustration</SelectItem>
            <SelectItem value="vector">Vector</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="3d">3D</SelectItem>
            <SelectItem value="template">Template</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 3. Generative AI */}
      <div className="space-y-1.5">
        <Label>Generative AI</Label>
        <Select
          value={ai}
          onValueChange={(val) => onAiChange(val as AiFilter)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Content (Include AI)</SelectItem>
            <SelectItem value="non_ai">Non-AI Only</SelectItem>
            <SelectItem value="ai_only">AI Generated Only</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
