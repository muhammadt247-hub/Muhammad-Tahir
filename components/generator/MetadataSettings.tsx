'use client';

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PlatformGrid } from './PlatformGrid';
import { LengthSlider } from './LengthSlider';
import { OptionToggle } from './OptionToggle';
import { KeywordChipInput } from './KeywordChipInput';
import { PlatformId, PLATFORM_SPECS } from '@/config/platforms';
import { GeneratorSavedSettings } from '@/lib/generator/db';
import {
  Sliders,
  AlignLeft,
  Tag,
  Hash,
  Ban,
  Plus,
  Download,
  Lightbulb,
} from 'lucide-react';

interface MetadataSettingsProps {
  settings: GeneratorSavedSettings;
  onUpdate: (partial: Partial<GeneratorSavedSettings>) => void;
  disabled?: boolean;
}

export function MetadataSettings({
  settings,
  onUpdate,
  disabled = false,
}: MetadataSettingsProps) {
  const currentSpec = PLATFORM_SPECS[settings.platform];

  const handlePlatformChange = (platform: PlatformId) => {
    const spec = PLATFORM_SPECS[platform];
    const newTitleLength = Math.min(settings.titleLength, spec.maxTitleLength);
    const newKeywordsCount = Math.min(settings.keywordsCount, spec.maxKeywordsCount);

    const defaultMinSizeCheck = platform === 'adobe-stock' ? 'exclude' : 'warn';

    onUpdate({
      platform,
      titleLength: newTitleLength,
      keywordsCount: newKeywordsCount,
      minSizeCheck: defaultMinSizeCheck,
    });
  };

  return (
    <div className="glass-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
      <Accordion type="single" collapsible defaultValue="metadata-settings">
        <AccordionItem value="metadata-settings" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-primary shrink-0">
                <Sliders className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-foreground">Metadata Settings</span>
            </div>
          </AccordionTrigger>

          <AccordionContent className="px-4 pb-4 space-y-4 data-[state=open]:overflow-visible overflow-visible">
            {/* 1. Export Platform Grid */}
            <div className="pt-2">
              <PlatformGrid
                platform={settings.platform}
                onPlatformChange={handlePlatformChange}
                disabled={disabled}
              />
            </div>

            {/* 2. Title Length Slider */}
            <div className="pt-3 border-t border-border/30">
              <LengthSlider
                label="Title Length"
                icon={<AlignLeft className="h-3.5 w-3.5" />}
                value={Math.min(settings.titleLength, currentSpec.maxTitleLength)}
                min={currentSpec.minTitleLength}
                max={currentSpec.maxTitleLength}
                unit="chars"
                showWordCount
                onChange={(val) => onUpdate({ titleLength: val })}
                disabled={disabled}
              />
            </div>

            {/* 3. Description (Only for General & Shutterstock) */}
            {currentSpec.hasDescription && (
              <div className="pt-3 border-t border-border/30">
                <div className="flex items-center justify-between bg-accent/50 rounded-xl px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                    <span>Description</span>
                  </div>
                  <span className="text-muted-foreground text-[11px]">
                    150 chars (~25 words) <span className="opacity-70">(fixed)</span>
                  </span>
                </div>
              </div>
            )}

            {/* 4. Keywords Count Slider */}
            <div className="pt-3 border-t border-border/30">
              <LengthSlider
                label="Keywords Count"
                icon={<Hash className="h-3.5 w-3.5" />}
                value={Math.min(settings.keywordsCount, currentSpec.maxKeywordsCount)}
                min={currentSpec.minKeywordsCount}
                max={currentSpec.maxKeywordsCount}
                unit="keywords"
                onChange={(val) => onUpdate({ keywordsCount: val })}
                disabled={disabled}
              />
            </div>

            {/* 5. Options Section */}
            <div className="pt-3 border-t border-border/30 space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block px-1">
                OPTIONS
              </label>

              {/* Title Prefix */}
              <OptionToggle
                label="Title Prefix"
                checked={settings.isPrefixEnabled}
                onCheckedChange={(val) => onUpdate({ isPrefixEnabled: val })}
                disabled={disabled}
              >
                <input
                  type="text"
                  value={settings.titlePrefix}
                  onChange={(e) => onUpdate({ titlePrefix: e.target.value })}
                  placeholder="e.g. Minimalist"
                  disabled={disabled}
                  className="w-full rounded-xl bg-accent/70 text-sm border border-border/40 focus:ring-2 focus:ring-primary/20 focus:outline-none px-3.5 py-2"
                />
              </OptionToggle>

              {/* Title Suffix */}
              <OptionToggle
                label="Title Suffix"
                checked={settings.isSuffixEnabled}
                onCheckedChange={(val) => onUpdate({ isSuffixEnabled: val })}
                disabled={disabled}
              >
                <input
                  type="text"
                  value={settings.titleSuffix}
                  onChange={(e) => onUpdate({ titleSuffix: e.target.value })}
                  placeholder="e.g. 4K Illustration"
                  disabled={disabled}
                  className="w-full rounded-xl bg-accent/70 text-sm border border-border/40 focus:ring-2 focus:ring-primary/20 focus:outline-none px-3.5 py-2"
                />
              </OptionToggle>

              {/* Negative Title Words */}
              <OptionToggle
                label="Negative Title Words"
                icon={<Ban className="h-3.5 w-3.5" />}
                checked={settings.isNegativeTitleWordsEnabled}
                onCheckedChange={(val) => onUpdate({ isNegativeTitleWordsEnabled: val })}
                disabled={disabled}
              >
                <input
                  type="text"
                  value={settings.negativeTitleWords}
                  onChange={(e) => onUpdate({ negativeTitleWords: e.target.value })}
                  placeholder="Comma-separated words to ban from titles"
                  disabled={disabled}
                  className="w-full rounded-xl bg-accent/70 text-sm border border-border/40 focus:ring-2 focus:ring-primary/20 focus:outline-none px-3.5 py-2"
                />
              </OptionToggle>

              {/* Negative Keywords */}
              <OptionToggle
                label="Negative Keywords"
                icon={<Ban className="h-3.5 w-3.5" />}
                checked={settings.isNegativeKeywordsEnabled}
                onCheckedChange={(val) => onUpdate({ isNegativeKeywordsEnabled: val })}
                disabled={disabled}
              >
                <input
                  type="text"
                  value={settings.negativeKeywords}
                  onChange={(e) => onUpdate({ negativeKeywords: e.target.value })}
                  placeholder="Comma-separated keywords to ban"
                  disabled={disabled}
                  className="w-full rounded-xl bg-accent/70 text-sm border border-border/40 focus:ring-2 focus:ring-primary/20 focus:outline-none px-3.5 py-2"
                />
              </OptionToggle>

              {/* Additional Keywords */}
              <OptionToggle
                label="Additional Keywords"
                icon={<Plus className="h-3.5 w-3.5" />}
                checked={settings.isAdditionalKeywordsEnabled}
                onCheckedChange={(val) => onUpdate({ isAdditionalKeywordsEnabled: val })}
                disabled={disabled}
              >
                <KeywordChipInput
                  keywords={settings.additionalKeywords}
                  onChange={(keywords) => onUpdate({ additionalKeywords: keywords })}
                  disabled={disabled}
                />
              </OptionToggle>

              <div className="pt-2 border-t border-border/20 space-y-2">
                {/* Auto CSV Download */}
                <OptionToggle
                  label="Auto CSV Download"
                  icon={<Download className="h-3.5 w-3.5" />}
                  checked={settings.autoCsvDownload}
                  onCheckedChange={(val) => onUpdate({ autoCsvDownload: val })}
                  disabled={disabled}
                />

                {/* Auto Embed */}
                <OptionToggle
                  label="Auto Embed"
                  icon={<Download className="h-3.5 w-3.5" />}
                  checked={settings.autoEmbed}
                  onCheckedChange={(val) => onUpdate({ autoEmbed: val })}
                  disabled={disabled}
                />
              </div>
            </div>

            {/* 6. Note Box */}
            <div className="text-[10px] text-muted-foreground/80 bg-accent/40 rounded-lg px-3 py-2 flex items-start gap-2 border border-border/20">
              <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span>&ldquo;isolated on transparent background&rdquo; is auto-added for transparent PNGs.</span>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
