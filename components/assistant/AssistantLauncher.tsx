'use client';

// The small robot button at the bottom LEFT of every page (the coffee button and notifications are on the right).
// The chat window is only downloaded when someone opens it, so pages do not get slower.
// A small "Need help? Ask me" bubble (English + Urdu) sits next to the robot so everyone knows what it is for.

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { RobotMascot } from '@/components/assistant/RobotIcon';

const AssistantPanel = dynamic(() => import('@/components/assistant/AssistantPanel').then((m) => m.AssistantPanel), {
  ssr: false,
  loading: () => (
    <div className="fixed bottom-20 left-4 z-50 rounded-2xl border border-border/60 bg-card px-4 py-3 text-xs text-muted-foreground shadow-xl">
      Starting the assistant...
    </div>
  ),
});

const HINT_KEY = 'orbinexa-assistant-hint-hidden';

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  // Hidden until we know whether the person closed it earlier in this visit (avoids a flash)
  const [hintHidden, setHintHidden] = useState(true);

  useEffect(() => {
    let hidden = false;
    try {
      hidden = sessionStorage.getItem(HINT_KEY) === '1';
    } catch {
      /* private mode: just show it */
    }
    // small delay so the bubble appears after the page has settled
    const t = window.setTimeout(() => setHintHidden(hidden), 1200);
    return () => window.clearTimeout(t);
  }, []);

  const openChat = () => {
    setEverOpened(true);
    setOpen((o) => !o);
  };

  const hideHint = () => {
    setHintHidden(true);
    try {
      sessionStorage.setItem(HINT_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      {everOpened && <AssistantPanel open={open} onClose={() => setOpen(false)} />}

      {!open && !hintHidden && (
        <div className="robot-hint fixed bottom-10 left-[4.25rem] z-40 flex items-center sm:bottom-12 sm:left-[5.6rem]">
          <button
            type="button"
            onClick={openChat}
            data-no-pop
            className="relative rounded-2xl rounded-bl-md border border-primary/40 bg-card/95 py-1.5 pl-3 pr-7 text-left shadow-lg shadow-primary/15 backdrop-blur-md transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="block text-[13px] font-semibold leading-tight text-foreground">
              Need help? <span className="text-primary">Ask me</span> 👋
            </span>
            <span dir="rtl" className="block text-[12px] leading-snug text-muted-foreground">
              مدد چاہیے؟ مجھ سے پوچھیں
            </span>
          </button>
          <button
            type="button"
            onClick={hideHint}
            aria-label="Hide this help message"
            className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={openChat}
        aria-label={open ? 'Close the Orbinexa AI Assistant' : 'Open the Orbinexa AI Assistant. Ask for help'}
        aria-expanded={open}
        title="Need help? Ask the Orbinexa AI Assistant"
        className="robot-launcher group fixed bottom-1 left-2 z-40 block w-[56px] rounded-2xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:bottom-2 sm:left-3 sm:w-[70px] [&>svg]:h-auto [&>svg]:w-full"
      >
        <RobotMascot size={70} animated={!open} />
        {!open && (
          <span className="pointer-events-none absolute right-1 top-[18%] h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-background" aria-hidden="true" />
        )}
      </button>
    </>
  );
}
