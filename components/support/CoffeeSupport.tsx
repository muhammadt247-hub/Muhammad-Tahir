'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Copy, X } from 'lucide-react';
import { COFFEE_IMAGE_1, COFFEE_IMAGE_2 } from './coffee-images';

// Skrill account that receives the coffee payments
export const SKRILL_EMAIL = 'donjhonoo786@gmail.com';
// Any button on the site can open the payment window with: window.dispatchEvent(new Event(OPEN_COFFEE_EVENT))
export const OPEN_COFFEE_EVENT = 'open-coffee-dialog';

const SHOW_AFTER_MS = 5 * 60 * 1000; // popup appears after 5 minutes
const START_KEY = 'orbinexa_coffee_start';
const CLOSED_KEY = 'orbinexa_coffee_closed';

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // ignore storage problems
  }
}

export function CoffeeSupport() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const lastSpokenRef = useRef(0);

  // Open the payment window when any button sends the event
  useEffect(() => {
    const open = () => setDialogOpen(true);
    window.addEventListener(OPEN_COFFEE_EVENT, open);
    return () => window.removeEventListener(OPEN_COFFEE_EVENT, open);
  }, []);

  // Show the popup once, 5 minutes after the user started using the site
  useEffect(() => {
    if (!user) {
      setPopupVisible(false);
      return;
    }
    if (readSession(CLOSED_KEY) === '1') return;

    let start = Number(readSession(START_KEY));
    if (!start) {
      start = Date.now();
      writeSession(START_KEY, String(start));
    }

    const check = () => {
      if (readSession(CLOSED_KEY) === '1') return;
      if (Date.now() - start >= SHOW_AFTER_MS) setPopupVisible(true);
    };
    check();
    const timer = window.setInterval(check, 5000);
    return () => window.clearInterval(timer);
  }, [user]);

  const speak = useCallback(() => {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const now = Date.now();
      if (now - lastSpokenRef.current < 10000) return; // not more than once every 10 seconds
      lastSpokenRef.current = now;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('Buy me a coffee, please!');
      utterance.rate = 1;
      utterance.pitch = 1.1;
      utterance.volume = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch {
      // sound is optional
    }
  }, []);

  const closePopup = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    writeSession(CLOSED_KEY, '1');
    setPopupVisible(false);
    setHovered(false);
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SKRILL_EMAIL);
      toast.success('Skrill email copied!');
    } catch {
      toast.error('Could not copy. Please select the email and copy it.');
    }
  };

  return (
    <>
      {popupVisible && (
        <div className="fixed bottom-4 right-4 z-40 w-[230px] sm:w-[300px] animate-in fade-in slide-in-from-bottom-4 duration-500">
          <button
            type="button"
            onClick={closePopup}
            aria-label="Close"
            className="absolute -top-3 -left-3 z-10 h-7 w-7 rounded-full bg-black text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
          >
            <X className="h-4 w-4" />
          </button>
          <div
            role="button"
            tabIndex={0}
            aria-label="Buy me a coffee"
            onClick={() => setDialogOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setDialogOpen(true);
            }}
            onMouseEnter={() => {
              setHovered(true);
              speak();
            }}
            onMouseLeave={() => setHovered(false)}
            className="relative cursor-pointer rounded-3xl bg-white p-3 shadow-2xl border border-black/10 transition-transform duration-300 ease-out hover:scale-110 origin-bottom-right"
          >
            <div className="relative w-full" style={{ aspectRatio: '420 / 408' }}>
              {/* Image 1 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={COFFEE_IMAGE_1}
                alt="Buy me a coffee"
                draggable={false}
                className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${hovered ? 'opacity-0' : 'opacity-100'}`}
              />
              {/* Image 2 (shown on hover) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={COFFEE_IMAGE_2}
                alt=""
                draggable={false}
                className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}
              />
            </div>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Buy me a coffee ☕</DialogTitle>
            <DialogDescription className="text-xs">
              Thank you for supporting OrbinexaCSV! You can send any amount with Skrill.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-border/60 bg-accent/40 p-3 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Skrill email
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate rounded-lg bg-background px-3 py-2 text-xs font-semibold text-foreground border border-border/60 select-all">
                  {SKRILL_EMAIL}
                </code>
                <Button type="button" onClick={copyEmail} size="sm" className="gap-1.5 text-xs font-semibold shrink-0">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </div>
            </div>

            <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
              <li>Open your Skrill account (website or app).</li>
              <li>Choose <span className="font-semibold text-foreground">Send money</span>.</li>
              <li>Paste the email above and type the amount.</li>
              <li>Confirm. Thank you!</li>
            </ol>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
