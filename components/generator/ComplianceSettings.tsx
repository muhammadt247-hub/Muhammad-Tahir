'use client';

import React, { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Shield,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  Info,
  Languages,
  Layers,
  CheckSquare,
  Database,
  BrainCircuit,
  Zap,
  Sliders,
} from 'lucide-react';
import { GeneratorSavedSettings } from '@/lib/generator/db';
import { CONTRIBUTOR_LANGUAGES } from '@/config/compliance';
import { SimilarityStrictness } from '@/config/similarity';
import { BlockedWordsDialog } from './BlockedWordsDialog';
import { LibraryManageDialog } from './LibraryManageDialog';

interface ComplianceSettingsProps {
  settings: GeneratorSavedSettings;
  onUpdate: (partial: Partial<GeneratorSavedSettings>) => void;
  disabled?: boolean;
  onLibraryChanged?: () => void;
}

export function ComplianceSettings({
  settings,
  onUpdate,
  disabled = false,
  onLibraryChanged,
}: ComplianceSettingsProps) {
  const [confirmDisableGuardOpen, setConfirmDisableGuardOpen] = useState(false);
  const [confirmDisableSimilarityOpen, setConfirmDisableSimilarityOpen] = useState(false);
  const [blockedWordsOpen, setBlockedWordsOpen] = useState(false);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);

  const handleComplianceToggle = (checked: boolean) => {
    if (!checked) {
      setConfirmDisableGuardOpen(true);
    } else {
      onUpdate({ complianceGuard: true });
    }
  };

  const confirmDisableGuard = () => {
    onUpdate({ complianceGuard: false });
    setConfirmDisableGuardOpen(false);
  };

  const handleStrictnessChange = (level: SimilarityStrictness) => {
    if (level === 'off') {
      setConfirmDisableSimilarityOpen(true);
    } else {
      onUpdate({ similarityStrictness: level });
    }
  };

  const confirmDisableSimilarity = () => {
    onUpdate({ similarityStrictness: 'off' });
    setConfirmDisableSimilarityOpen(false);
  };

  const strictness = settings.similarityStrictness || 'strict';

  return (
    <>
      <div className="glass-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <Accordion type="single" collapsible defaultValue="compliance-settings">
          <AccordionItem value="compliance-settings" className="border-none">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-primary flex items-center justify-center shrink-0">
                  <Shield className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-foreground leading-tight">
                    Compliance & Similarity Guard
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {settings.complianceGuard && strictness !== 'off'
                      ? 'Account & spam protection active'
                      : 'Guards partially paused'}
                  </p>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-4 pb-4 pt-1 space-y-4">
              {/* 1. Toggle Compliance Guard */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-accent/20 border border-border/40">
                <div className="space-y-0.5 pr-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                    <span>Compliance Guard</span>
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    Block trademarks, brand names, and protect against rejections.
                  </p>
                </div>
                <Switch
                  checked={settings.complianceGuard}
                  onCheckedChange={handleComplianceToggle}
                  disabled={disabled}
                  aria-label="Toggle Compliance Guard"
                />
              </div>

              {/* 2. Blocked words button */}
              <div className="flex items-center justify-between">
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Blocklist & Custom Terms</p>
                  <p className="text-[10px] text-muted-foreground">
                    {settings.customBlockedWords?.length || 0} custom word(s) configured
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBlockedWordsOpen(true)}
                  disabled={disabled}
                  className="px-3 py-1.5 rounded-lg border border-border/60 hover:bg-accent text-xs font-semibold text-foreground transition-colors shadow-2xs"
                >
                  Blocked words...
                </button>
              </div>

              {/* 3. Title Uniqueness */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Title Uniqueness</span>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {settings.titleUniqueness || 'normal'}
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-accent/20 border border-border/40 text-xs">
                  {(['strict', 'normal', 'relaxed'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => onUpdate({ titleUniqueness: level })}
                      disabled={disabled}
                      className={`py-1.5 rounded-lg font-semibold capitalize transition-colors ${
                        (settings.titleUniqueness || 'normal') === level
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Flag near-identical titles across batch items before submission.
                </p>
              </div>

              {/* --- STEP 8: DEEP SIMILARITY GUARD CONTROLS --- */}
              <div className="pt-2 border-t border-border/40 space-y-3">
                {/* 1. Similarity Strictness Select */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span>Similarity Strictness</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {strictness}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-accent/20 border border-border/40 text-[11px]">
                    {(['strict', 'balanced', 'relaxed', 'off'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => handleStrictnessChange(lvl)}
                        disabled={disabled}
                        className={`py-1 rounded-lg font-semibold capitalize transition-colors ${
                          strictness === lvl
                            ? lvl === 'off'
                              ? 'bg-destructive text-destructive-foreground shadow-xs'
                              : 'bg-primary text-primary-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Excludes near-duplicate images from CSV and embeds so only the best is kept.
                  </p>
                </div>

                {/* 2. Toggle Deep AI Check */}
                <div className="flex items-center justify-between py-1">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                      <span>Deep AI check</span>
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      Uses Gemini to review borderline groups and choose the best image. Uses your API keys.
                    </p>
                  </div>
                  <Switch
                    checked={settings.deepAiCheck ?? true}
                    onCheckedChange={(checked) => onUpdate({ deepAiCheck: checked })}
                    disabled={disabled || strictness === 'off'}
                    aria-label="Toggle Deep AI check"
                  />
                </div>

                {/* 3. Toggle Remember my exported images + Manage Library Button */}
                <div className="space-y-1.5 p-2.5 rounded-xl bg-accent/20 border border-border/30">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 pr-2">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Database className="h-3.5 w-3.5 text-primary" />
                        <span>Remember my exported images</span>
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        Stores fingerprints (never photos) to prevent submitting duplicates in future sessions.
                      </p>
                    </div>
                    <Switch
                      checked={settings.rememberExportedImages ?? true}
                      onCheckedChange={(checked) => onUpdate({ rememberExportedImages: checked })}
                      disabled={disabled}
                      aria-label="Toggle Remember my exported images"
                    />
                  </div>

                  <div className="pt-1 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLibraryDialogOpen(true)}
                      className="h-6 px-2.5 text-[11px] font-semibold text-foreground border-border/60 hover:bg-accent"
                    >
                      Manage library...
                    </Button>
                  </div>
                </div>

                {/* 4. Toggle Skip AI generation for excluded images */}
                <div className="flex items-center justify-between py-1">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      <span>Skip AI generation for excluded images</span>
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      Similar images are not sent to Gemini for metadata, saving requests.
                    </p>
                  </div>
                  <Switch
                    checked={settings.skipAiGenerationForExcluded ?? true}
                    onCheckedChange={(checked) => onUpdate({ skipAiGenerationForExcluded: checked })}
                    disabled={disabled || strictness === 'off'}
                    aria-label="Toggle Skip AI generation for excluded images"
                  />
                </div>

                {/* 5. Toggle Show similarity scores */}
                <div className="flex items-center justify-between py-1">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 opacity-70" />
                      <span>Show similarity scores</span>
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      Display detailed breakdown (pHash, SSIM, color, quality metrics) on cards.
                    </p>
                  </div>
                  <Switch
                    checked={settings.showSimilarityScores ?? false}
                    onCheckedChange={(checked) => onUpdate({ showSimilarityScores: checked })}
                    disabled={disabled}
                    aria-label="Toggle Show similarity scores"
                  />
                </div>
              </div>

              {/* 5. Contributor Language */}
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Languages className="h-3.5 w-3.5 opacity-70" />
                  <span>Contributor Language</span>
                </label>
                <select
                  value={settings.contributorLanguage || 'en'}
                  onChange={(e) => onUpdate({ contributorLanguage: e.target.value })}
                  disabled={disabled}
                  className="w-full px-3 py-1.5 rounded-xl bg-accent/30 border border-border/50 text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none"
                >
                  {CONTRIBUTOR_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  AI will generate all titles and keywords strictly in this single language.
                </p>
              </div>

              {/* 6. Generative AI Batch Toggle & Reminder */}
              <div className="space-y-2 pt-1 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span>These files are generative AI</span>
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      Removes &quot;generative AI&quot; phrases from metadata.
                    </p>
                  </div>
                  <Switch
                    checked={settings.isAiBatch || false}
                    onCheckedChange={(checked) => onUpdate({ isAiBatch: checked })}
                    disabled={disabled}
                    aria-label="Toggle Generative AI Batch"
                  />
                </div>

                {settings.isAiBatch && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 text-amber-700 dark:text-amber-400">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <CheckSquare className="h-3.5 w-3.5" />
                      <span>Adobe Portal Reminder</span>
                    </div>
                    <p className="text-[11px] leading-snug">
                      Tick &quot;Created using generative AI tools&quot; for these files in the Adobe Contributor Portal. The checkbox labels them, so DOCTORx removes the phrase &quot;generative AI&quot; from titles and keywords.
                    </p>
                  </div>
                )}
              </div>

              {/* 7. Adobe Limit Info Note */}
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-accent/20 border border-border/30 text-[11px] text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                <p className="leading-tight">
                  Adobe may limit how many AI files you can submit. Check your Contributor Portal for your current limit.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Confirmation Dialog When Turning Off Compliance Guard */}
      <Dialog open={confirmDisableGuardOpen} onOpenChange={setConfirmDisableGuardOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Disable Compliance Guard?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-foreground/80 leading-relaxed pt-2">
              Without the Guard, files with brand names or banned terms can be exported and rejected by Adobe, risking your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmDisableGuardOpen(false)}
              className="text-xs"
            >
              Keep Guard ON
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmDisableGuard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold"
            >
              Turn Off Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog When Turning Off Similarity Strictness */}
      <Dialog open={confirmDisableSimilarityOpen} onOpenChange={setConfirmDisableSimilarityOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Disable Similarity Guard?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-foreground/80 leading-relaxed pt-2">
              Without this guard, near-identical files can be rejected as spam and repeated cases can risk your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmDisableSimilarityOpen(false)}
              className="text-xs"
            >
              Keep Guard ON
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmDisableSimilarity}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold"
            >
              Turn Off Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocked Words Management Dialog */}
      <BlockedWordsDialog
        open={blockedWordsOpen}
        onOpenChange={setBlockedWordsOpen}
        customWords={settings.customBlockedWords || []}
        onUpdateCustomWords={(words) => onUpdate({ customBlockedWords: words })}
      />

      {/* Library Management Dialog */}
      <LibraryManageDialog
        open={libraryDialogOpen}
        onOpenChange={setLibraryDialogOpen}
        onLibraryChanged={onLibraryChanged}
      />
    </>
  );
}
