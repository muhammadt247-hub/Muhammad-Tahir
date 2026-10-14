'use client';

import React, { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { SettingsDialog } from './SettingsDialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ProfileCardProps {
  collapsed?: boolean;
}

export function ProfileCard({ collapsed }: ProfileCardProps) {
  const { settings } = useSettings();
  const [openSettings, setOpenSettings] = useState(false);

  const initial = (settings.displayName || 'M').charAt(0).toUpperCase();

  if (collapsed) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpenSettings(true)}
              className="relative mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 text-white font-bold text-sm shadow-md transition-transform hover:scale-105"
            >
              {initial}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {settings.displayName} • Settings
          </TooltipContent>
        </Tooltip>
        <SettingsDialog open={openSettings} onOpenChange={setOpenSettings} />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/50 bg-background/50 p-2 transition-colors hover:border-border">
        <button
          onClick={() => setOpenSettings(true)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus:outline-none"
        >
          {/* Avatar */}
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 font-bold text-white shadow-sm text-sm">
            {initial}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
          </div>

          {/* User info */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {settings.displayName}
            </p>
            <p className="truncate text-[10px] font-medium text-muted-foreground mt-0.5">
              Local workspace
            </p>
          </div>
        </button>

        {/* Settings button */}
        <button
          onClick={() => setOpenSettings(true)}
          title="Open Workspace Settings"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
      </div>

      <SettingsDialog open={openSettings} onOpenChange={setOpenSettings} />
    </>
  );
}
