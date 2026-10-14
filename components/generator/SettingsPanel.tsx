'use client';

import React from 'react';
import { GeneratorSettings } from '@/types/generator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PLATFORMS } from '@/config/platforms';
import { Sparkles, SlidersHorizontal, Check } from 'lucide-react';

interface SettingsPanelProps {
  settings: GeneratorSettings;
  onChange: (settings: GeneratorSettings) => void;
  disabled?: boolean;
}

export function SettingsPanel({
  settings,
  onChange,
  disabled = false,
}: SettingsPanelProps) {
  const update = (partial: Partial<GeneratorSettings>) => {
    onChange({ ...settings, ...partial });
  };

  const togglePlatform = (platformId: 'adobe' | 'shutterstock' | 'freepik' | 'generic') => {
    const current = settings.platforms;
    let next: ('adobe' | 'shutterstock' | 'freepik' | 'generic')[];
    if (current.includes(platformId)) {
      if (current.length === 1) return; // Keep at least one platform selected
      next = current.filter((p) => p !== platformId);
    } else {
      next = [...current, platformId];
    }
    update({ platforms: next });
  };

  const primaryPlatform = PLATFORMS[settings.platforms[0]] || PLATFORMS.adobe;

  return (
    <div className="glass-card rounded-2xl p-6 border border-border/50 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Generation Rules &amp; Targets</h3>
            <p className="text-xs text-muted-foreground">
              Configure output structure and marketplace specifications.
            </p>
          </div>
        </div>

        {/* AI Toggle */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-orange-500" />
            Content is AI Generated
          </span>
          <Switch
            checked={settings.isAi}
            onCheckedChange={(val) => update({ isAi: val })}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Target Platforms Multi-Select */}
      <div className="space-y-2">
        <Label className="text-xs">
          Target Marketplaces (Export multi-platform ZIP or individual CSVs)
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(['adobe', 'shutterstock', 'freepik', 'generic'] as const).map((pId) => {
            const isSelected = settings.platforms.includes(pId);
            const spec = PLATFORMS[pId];
            return (
              <button
                key={pId}
                type="button"
                disabled={disabled}
                onClick={() => togglePlatform(pId)}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border/60 bg-background/50 hover:bg-accent text-muted-foreground'
                }`}
              >
                <span>{spec.name}</span>
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border/60 bg-background'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders: Title Length & Keyword Count */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
        {/* Title Length Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <Label>Target Title Length</Label>
            <span className="font-mono font-bold text-foreground">
              {settings.titleLength} characters
            </span>
          </div>
          <Slider
            min={20}
            max={primaryPlatform.maxTitleLength}
            step={5}
            value={[settings.titleLength]}
            onValueChange={([val]) => update({ titleLength: val })}
            disabled={disabled}
          />
          <p className="text-[10px] text-muted-foreground">
            Recommended: 60-100 characters for Adobe Stock &amp; Shutterstock SEO ranking.
          </p>
        </div>

        {/* Keyword Count Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <Label>Target Keyword Count</Label>
            <span className="font-mono font-bold text-foreground">
              {settings.keywordCount} tags
            </span>
          </div>
          <Slider
            min={10}
            max={primaryPlatform.maxKeywordsCount}
            step={1}
            value={[settings.keywordCount]}
            onValueChange={([val]) => update({ keywordCount: val })}
            disabled={disabled}
          />
          <p className="text-[10px] text-muted-foreground">
            Max allowed: {primaryPlatform.maxKeywordsCount} tags ({primaryPlatform.name} limit).
          </p>
        </div>
      </div>

      {/* Tone & Language & Category */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="space-y-1.5">
          <Label>Output Language</Label>
          <Select
            value={settings.language}
            onValueChange={(val) => update({ language: val })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="English">English (US)</SelectItem>
              <SelectItem value="Spanish">Spanish</SelectItem>
              <SelectItem value="German">German</SelectItem>
              <SelectItem value="French">French</SelectItem>
              <SelectItem value="Portuguese">Portuguese</SelectItem>
              <SelectItem value="Italian">Italian</SelectItem>
              <SelectItem value="Japanese">Japanese</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Title &amp; Keyword Tone</Label>
          <Select
            value={settings.tone}
            onValueChange={(val) => update({ tone: val })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Commercial & Objective">Commercial &amp; Objective</SelectItem>
              <SelectItem value="Descriptive & Narrative">Descriptive &amp; Narrative</SelectItem>
              <SelectItem value="Editorial & Journalistic">Editorial &amp; Journalistic</SelectItem>
              <SelectItem value="Minimalist & Direct">Minimalist &amp; Direct</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select
            value={settings.category || 'auto'}
            onValueChange={(val) => update({ category: val === 'auto' ? '' : val })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Auto-detect category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect from image</SelectItem>
              {primaryPlatform.categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Prefix / Suffix and Must Include / Never Use */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div className="space-y-1.5">
          <Label>Must Include Keywords</Label>
          <Input
            value={settings.mustInclude}
            onChange={(e) => update({ mustInclude: e.target.value })}
            placeholder="e.g. 4k render, isolated, modern"
            disabled={disabled}
            className="text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Never Use Words (Negative Filter)</Label>
          <Input
            value={settings.neverUse}
            onChange={(e) => update({ neverUse: e.target.value })}
            placeholder="e.g. stock, watermark, ugly, brand"
            disabled={disabled}
            className="text-xs"
          />
        </div>
      </div>

      {/* Title Prefix / Suffix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Title Prefix (Optional)</Label>
          <Input
            value={settings.titlePrefix}
            onChange={(e) => update({ titlePrefix: e.target.value })}
            placeholder="e.g. High angle shot of"
            disabled={disabled}
            className="text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Title Suffix (Optional)</Label>
          <Input
            value={settings.titleSuffix}
            onChange={(e) => update({ titleSuffix: e.target.value })}
            placeholder="e.g. on transparent background"
            disabled={disabled}
            className="text-xs"
          />
        </div>
      </div>

      {/* Custom AI Instructions */}
      <div className="space-y-1.5 pt-2">
        <Label>Custom Prompt Directives</Label>
        <Textarea
          value={settings.customInstructions}
          onChange={(e) => update({ customInstructions: e.target.value })}
          placeholder="e.g. Focus keywords on corporate B2B terminology, avoid generic travel tags, emphasize ethnic diversity..."
          disabled={disabled}
          className="text-xs min-h-[60px]"
        />
      </div>
    </div>
  );
}
