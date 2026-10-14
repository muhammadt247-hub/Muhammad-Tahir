'use client';

import React from 'react';
import { PlatformId } from '@/config/platforms';
import { cn } from '@/lib/utils';
import { Globe, Layers, Image as ImageIcon, Flame } from 'lucide-react';

interface PlatformGridProps {
  platform: PlatformId;
  onPlatformChange: (platform: PlatformId) => void;
  disabled?: boolean;
}

const PLATFORM_BUTTONS: { id: PlatformId; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General', icon: <Globe className="h-3.5 w-3.5" /> },
  { id: 'adobe-stock', label: 'Adobe Stock', icon: <Layers className="h-3.5 w-3.5" /> },
  { id: 'shutterstock', label: 'Shutterstock', icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { id: 'freepik', label: 'FreePik', icon: <Flame className="h-3.5 w-3.5" /> },
];

export function PlatformGrid({ platform, onPlatformChange, disabled = false }: PlatformGridProps) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
        EXPORT PLATFORM
      </label>

      <div className="grid grid-cols-2 gap-2">
        {PLATFORM_BUTTONS.map((item) => {
          const isSelected = platform === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onPlatformChange(item.id)}
              className={cn(
                'h-10 rounded-xl text-xs font-medium px-2.5 flex items-center justify-between transition-all select-none',
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground border border-border/40'
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className={cn(
                    'w-5 h-5 rounded-md flex items-center justify-center shrink-0',
                    isSelected ? 'bg-white/20 text-white' : 'bg-accent text-muted-foreground'
                  )}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </div>

              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 ml-1.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
