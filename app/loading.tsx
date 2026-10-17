import React from 'react';
import { LogoMark } from '@/components/Logo';

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 animate-pulse">
        <LogoMark size={36} />
      </div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider animate-pulse">
        Loading OrbinexaCSV Toolkit...
      </p>
    </div>
  );
}
