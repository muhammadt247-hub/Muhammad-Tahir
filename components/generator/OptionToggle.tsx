'use client';

import React from 'react';
import { Switch } from '@/components/ui/switch';

interface OptionToggleProps {
  label: string;
  icon?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function OptionToggle({
  label,
  icon,
  checked,
  onCheckedChange,
  disabled = false,
  children,
}: OptionToggleProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-accent/40 transition-colors">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
          <span className="text-[13px] font-medium text-foreground truncate">{label}</span>
        </div>

        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-label={label}
        />
      </div>

      {checked && children && <div className="px-3 pt-0 pb-1">{children}</div>}
    </div>
  );
}
