'use client';

// The small robot button at the bottom LEFT of every page (the coffee button and notifications are on the right).
// The chat window is only downloaded when someone opens it, so pages do not get slower.

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { RobotIcon } from '@/components/assistant/RobotIcon';

const AssistantPanel = dynamic(() => import('@/components/assistant/AssistantPanel').then((m) => m.AssistantPanel), {
  ssr: false,
  loading: () => (
    <div className="fixed bottom-20 left-4 z-50 rounded-2xl border border-border/60 bg-card px-4 py-3 text-xs text-muted-foreground shadow-xl">
      Starting the assistant...
    </div>
  ),
});

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  return (
    <>
      {everOpened && <AssistantPanel open={open} onClose={() => setOpen(false)} />}
      <button
        type="button"
        onClick={() => {
          setEverOpened(true);
          setOpen((o) => !o);
        }}
        aria-label={open ? 'Close the Orbinexa AI Assistant' : 'Open the Orbinexa AI Assistant'}
        aria-expanded={open}
        title="Orbinexa AI Assistant"
        className="robot-launcher group fixed bottom-4 left-4 z-40 grid h-12 w-12 place-items-center rounded-2xl border border-primary/40 bg-card/90 shadow-lg shadow-primary/20 backdrop-blur-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-14 sm:w-14"
      >
        <RobotIcon size={32} animated={!open} />
        {!open && (
          <span className="pointer-events-none absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-background" aria-hidden="true" />
        )}
      </button>
    </>
  );
}
