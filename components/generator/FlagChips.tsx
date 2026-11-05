'use client';

import React from 'react';
import { AiVisualFlags } from '@/lib/generator/queue';
import { AlertTriangle, UserCheck, Home, Tag, Type, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlagChipsProps {
  flags?: AiVisualFlags;
  flagReasons?: string[];
}

export function FlagChips({ flags, flagReasons = [] }: FlagChipsProps) {
  if (!flags) return null;

  const tooltipText = "AI detection is not perfect. You decide before uploading.";

  const activeChips: { label: string; icon: React.ReactNode; reasonKey: string; reasonDetail?: string }[] = [];

  if (flags.identifiablePerson) {
    activeChips.push({
      label: 'Possible model release needed',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300 shrink-0" />,
      reasonKey: 'person',
      bgClass: 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800 font-bold',
    });
  }

  if (flags.privateProperty) {
    activeChips.push({
      label: 'Possible property release needed',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300 shrink-0" />,
      reasonKey: 'property',
      bgClass: 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800 font-bold',
    });
  }

  if (flags.visibleTextOrLogo || flags.visibleLogoOrBrand || flags.visibleText) {
    const textOrLogoReason = flagReasons.find((r) =>
      /text|logo|brand|sign|letter|word|trademark/i.test(r)
    );
    activeChips.push({
      label: 'Text or logo visible. Review before upload.',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-700 dark:text-orange-300 shrink-0" />,
      reasonKey: 'text_or_logo',
      reasonDetail: textOrLogoReason,
      bgClass: 'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-950 dark:text-orange-100 dark:border-orange-800 font-bold',
    });
  }

  if (flags.possibleEditorial) {
    activeChips.push({
      label: 'May count as editorial content',
      icon: <Newspaper className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300 shrink-0" />,
      reasonKey: 'editorial',
      bgClass: 'bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800 font-semibold',
    });
  }

  if (activeChips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {activeChips.map((chip, idx) => (
        <span
          key={idx}
          title={tooltipText}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] shadow-2xs border',
            chip.bgClass
          )}
        >
          {chip.icon}
          <span>{chip.label}</span>
        </span>
      ))}
    </div>
  );
}
