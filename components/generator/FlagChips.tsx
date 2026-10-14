'use client';

import React from 'react';
import { AiVisualFlags } from '@/lib/generator/queue';
import { AlertTriangle, UserCheck, Home, Tag, Type, Newspaper } from 'lucide-react';

interface FlagChipsProps {
  flags?: AiVisualFlags;
  flagReasons?: string[];
}

export function FlagChips({ flags, flagReasons = [] }: FlagChipsProps) {
  if (!flags) return null;

  const tooltipText = "AI detection is not perfect. You decide before uploading.";

  const activeChips: { label: string; icon: React.ReactNode; reasonKey: string }[] = [];

  if (flags.identifiablePerson) {
    activeChips.push({
      label: 'Possible model release needed',
      icon: <UserCheck className="h-3 w-3" />,
      reasonKey: 'person',
    });
  }

  if (flags.privateProperty) {
    activeChips.push({
      label: 'Possible property release needed',
      icon: <Home className="h-3 w-3" />,
      reasonKey: 'property',
    });
  }

  if (flags.visibleLogoOrBrand) {
    activeChips.push({
      label: 'Logo or brand visible. Review before upload',
      icon: <Tag className="h-3 w-3" />,
      reasonKey: 'logo',
    });
  }

  if (flags.visibleText) {
    activeChips.push({
      label: 'Text visible in image',
      icon: <Type className="h-3 w-3" />,
      reasonKey: 'text',
    });
  }

  if (flags.possibleEditorial) {
    activeChips.push({
      label: 'May count as editorial content',
      icon: <Newspaper className="h-3 w-3" />,
      reasonKey: 'editorial',
    });
  }

  if (activeChips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {activeChips.map((chip, idx) => (
        <span
          key={idx}
          title={tooltipText}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 shadow-2xs"
        >
          {chip.icon}
          <span>{chip.label}</span>
        </span>
      ))}
    </div>
  );
}
