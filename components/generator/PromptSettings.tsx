'use client';

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { LengthSlider } from './LengthSlider';
import { OptionToggle } from './OptionToggle';
import { GeneratorSavedSettings } from '@/lib/generator/db';
import {
  Type,
  AlignLeft,
  Ban,
  Sun,
  Camera,
  Download,
} from 'lucide-react';

interface PromptSettingsProps {
  settings: GeneratorSavedSettings;
  onUpdate: (partial: Partial<GeneratorSavedSettings>) => void;
  disabled?: boolean;
}

export function PromptSettings({
  settings,
  onUpdate,
  disabled = false,
}: PromptSettingsProps) {
  return (
    <div className="glass-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
      <Accordion type="single" collapsible defaultValue="prompt-settings">
        <AccordionItem value="prompt-settings" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-primary shrink-0">
                <Type className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-foreground">Prompt Settings</span>
            </div>
          </AccordionTrigger>

          <AccordionContent className="px-4 pb-4 space-y-4">
            {/* 1. Prompt Length Slider */}
            <div className="pt-2">
              <LengthSlider
                label="Prompt Length"
                icon={<AlignLeft className="h-3.5 w-3.5" />}
                value={settings.promptLength}
                min={100}
                max={1000}
                unit="chars"
                showWordCount
                onChange={(val) => onUpdate({ promptLength: val })}
                disabled={disabled}
              />
            </div>

            {/* 2. Options Section */}
            <div className="pt-3 border-t border-border/30 space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block px-1">
                OPTIONS
              </label>

              {/* Prompt Prefix */}
              <OptionToggle
                label="Prefix"
                checked={settings.isPromptPrefixEnabled}
                onCheckedChange={(val) => onUpdate({ isPromptPrefixEnabled: val })}
                disabled={disabled}
              >
                <input
                  type="text"
                  value={settings.promptPrefix}
                  onChange={(e) => onUpdate({ promptPrefix: e.target.value })}
                  placeholder="e.g. Masterpiece, high detail"
                  disabled={disabled}
                  className="w-full rounded-xl bg-accent/70 text-sm border border-border/40 focus:ring-2 focus:ring-primary/20 focus:outline-none px-3.5 py-2"
                />
              </OptionToggle>

              {/* Prompt Suffix */}
              <OptionToggle
                label="Suffix"
                checked={settings.isPromptSuffixEnabled}
                onCheckedChange={(val) => onUpdate({ isPromptSuffixEnabled: val })}
                disabled={disabled}
              >
                <input
                  type="text"
                  value={settings.promptSuffix}
                  onChange={(e) => onUpdate({ promptSuffix: e.target.value })}
                  placeholder="e.g. 8k resolution, cinematic lighting"
                  disabled={disabled}
                  className="w-full rounded-xl bg-accent/70 text-sm border border-border/40 focus:ring-2 focus:ring-primary/20 focus:outline-none px-3.5 py-2"
                />
              </OptionToggle>

              {/* Negative Prompt Words */}
              <OptionToggle
                label="Negative Prompt Words"
                icon={<Ban className="h-3.5 w-3.5" />}
                checked={settings.isNegativePromptWordsEnabled}
                onCheckedChange={(val) => onUpdate({ isNegativePromptWordsEnabled: val })}
                disabled={disabled}
              >
                <input
                  type="text"
                  value={settings.negativePromptWords}
                  onChange={(e) => onUpdate({ negativePromptWords: e.target.value })}
                  placeholder="Words to exclude from prompts"
                  disabled={disabled}
                  className="w-full rounded-xl bg-accent/70 text-sm border border-border/40 focus:ring-2 focus:ring-primary/20 focus:outline-none px-3.5 py-2"
                />
              </OptionToggle>

              {/* White Background */}
              <OptionToggle
                label="White Background"
                icon={<Sun className="h-3.5 w-3.5" />}
                checked={settings.whiteBackground}
                onCheckedChange={(val) => onUpdate({ whiteBackground: val })}
                disabled={disabled}
              />

              {/* Camera Parameters */}
              <OptionToggle
                label="Camera Parameters"
                icon={<Camera className="h-3.5 w-3.5" />}
                checked={settings.cameraParams}
                onCheckedChange={(val) => onUpdate({ cameraParams: val })}
                disabled={disabled}
              />

              <div className="pt-2 border-t border-border/20">
                {/* Auto CSV Download */}
                <OptionToggle
                  label="Auto CSV Download"
                  icon={<Download className="h-3.5 w-3.5" />}
                  checked={settings.autoCsvDownload}
                  onCheckedChange={(val) => onUpdate({ autoCsvDownload: val })}
                  disabled={disabled}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
