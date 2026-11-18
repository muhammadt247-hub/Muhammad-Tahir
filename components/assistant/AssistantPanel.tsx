'use client';

// Chat window of the Orbinexa AI Assistant. Loaded only when the robot button is first pressed.
// Answers come from /api/assistant. Links are real site pages only, and nothing is ever bought from here.

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eraser, Send, Store, X } from 'lucide-react';
import { RobotIcon } from '@/components/assistant/RobotIcon';

type Action = { label: string; href: string };
type Pkg = {
  id: string;
  tool: string;
  title: string;
  vendor: string;
  price: number;
  originalPrice: number | null;
  offerPercent: number | null;
  deliveryHours: number;
  href: string;
};
type VendorCard = { name: string; lowest: number; packages: number; href: string };
type OfferPost = { vendor: string; title: string; text: string; endsAt: string; href: string };
type Msg = { role: 'user' | 'assistant'; text: string; actions?: Action[]; packages?: Pkg[]; vendors?: VendorCard[]; offerPosts?: OfferPost[] };

const WELCOME =
  "Hello! I'm your Orbinexa AI Assistant. I can help you explore tools, compare packages, find vendor offers, purchase services, and navigate the website. What would you like to do today?";
const SUGGESTIONS = [
  'Show me the cheapest CapCut package',
  'Show me current offers',
  'Which vendor has the lowest price?',
  'How do I generate CSV metadata?',
  'How can I improve my Adobe Stock keywords?',
  'Take me to the CSV generator',
];
const STORE_KEY = 'orbinexa-assistant-chat';
const fmt = (n: number) => 'Rs ' + Math.round(n).toLocaleString('en-US');

// Only links inside this site (never another website)
const safeHref = (h: string) => (typeof h === 'string' && h.startsWith('/') && !h.startsWith('//') ? h : '/');

function loadChat(): Msg[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    const v = raw ? (JSON.parse(raw) as Msg[]) : [];
    return Array.isArray(v) ? v.slice(-30) : [];
  } catch {
    return [];
  }
}

export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(loadChat);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // remember the conversation for this browser tab only
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      // not important
    }
  }, [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const q = text.trim().slice(0, 600);
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: 'user', text: q }];
    setMessages(next);
    setInput('');
    setBusy(true);
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    const timer = setTimeout(() => ctl.abort(), 25_000);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctl.signal,
        body: JSON.stringify({ messages: next.slice(-8).map((m) => ({ role: m.role, text: m.text.slice(0, 600) })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((m) => [...m, { role: 'assistant', text: data?.error || 'Sorry, something went wrong. Please try again.' }]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text: String(data.reply || ''),
            actions: Array.isArray(data.actions) ? data.actions : [],
            packages: Array.isArray(data.packages) ? data.packages : [],
            vendors: Array.isArray(data.vendors) ? data.vendors : [],
            offerPosts: Array.isArray(data.offerPosts) ? data.offerPosts : [],
          },
        ]);
      }
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'The assistant is not answering right now. Please try again in a moment.' }]);
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  };

  const go = (href: string) => {
    router.push(safeHref(href));
    // on phones the chat covers the page, so close it to show where we went
    if (typeof window !== 'undefined' && window.innerWidth < 640) onClose();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Orbinexa AI Assistant"
      className="fixed bottom-[5.5rem] right-3 z-50 flex h-[min(600px,calc(100dvh-8rem))] w-[min(390px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-black/40 animate-in fade-in slide-in-from-bottom-2 sm:right-4 sm:bottom-[6.5rem]"
    >
      {/* header */}
      <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-primary/15 to-transparent px-4 py-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-background/60">
          <RobotIcon size={30} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">Orbinexa AI Assistant</p>
          <p className="text-[11px] text-muted-foreground">Answers from the site and live marketplace data</p>
        </div>
        <button
          type="button"
          onClick={() => setMessages([])}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Clear conversation"
          title="Clear conversation"
        >
          <Eraser className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close assistant"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* messages */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
        <Bubble role="assistant" text={WELCOME} />
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-foreground hover:bg-primary/20"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="space-y-2">
            <Bubble role={m.role} text={m.text} />
            {m.packages && m.packages.length > 0 && (
              <div className="space-y-1.5 pl-1">
                {m.packages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => go(p.href)}
                    data-no-pop
                    className="flex w-full items-center gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-left hover:border-primary/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{p.tool}</p>
                      <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                        <Store className="h-3 w-3 shrink-0" /> {p.vendor} · {p.title}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-extrabold text-foreground">{fmt(p.price)}</p>
                      {p.originalPrice !== null && <p className="text-[10px] text-muted-foreground line-through">{fmt(p.originalPrice)}</p>}
                    </div>
                    <span className="shrink-0 rounded-lg bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground">View</span>
                  </button>
                ))}
                <p className="pl-1 text-[10px] text-muted-foreground">Open a package to see details and press Order. You pay only OrbinexaCSV.</p>
              </div>
            )}
            {m.vendors && m.vendors.length > 0 && (
              <div className="space-y-1.5 pl-1">
                {m.vendors.map((v) => (
                  <button
                    key={v.href}
                    type="button"
                    onClick={() => go(v.href)}
                    data-no-pop
                    className="flex w-full items-center gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-left hover:border-primary/50"
                  >
                    <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{v.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{v.packages} packages</span>
                    <span className="shrink-0 text-sm font-extrabold text-foreground">from {fmt(v.lowest)}</span>
                  </button>
                ))}
              </div>
            )}
            {m.offerPosts && m.offerPosts.length > 0 && (
              <div className="space-y-1.5 pl-1">
                {m.offerPosts.map((o) => (
                  <button
                    key={o.href + o.title}
                    type="button"
                    onClick={() => go(o.href)}
                    data-no-pop
                    className="w-full rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-left hover:border-primary"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Offer · {o.vendor}</p>
                    <p dir="auto" className="text-sm font-semibold text-foreground line-clamp-2">{o.title}</p>
                    <p dir="auto" className="text-xs text-muted-foreground line-clamp-2">{o.text}</p>
                  </button>
                ))}
              </div>
            )}
            {m.actions && m.actions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pl-1">
                {m.actions.map((a) => (
                  <button
                    key={a.href + a.label}
                    type="button"
                    onClick={() => go(a.href)}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
                  >
                    {a.label} <ArrowRight className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 pl-1 text-xs text-muted-foreground" role="status">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
            </span>
            Thinking...
          </div>
        )}
      </div>

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-border/60 p-3"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 600))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          dir="auto"
          placeholder="Ask about tools, packages, offers..."
          aria-label="Your message"
          className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const mine = role === 'user';
  return (
    <div className={'flex ' + (mine ? 'justify-end' : 'justify-start gap-2')}>
      {!mine && (
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10">
          <RobotIcon size={20} />
        </div>
      )}
      <p
        dir="auto"
        className={
          'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed ' +
          (mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted/60 text-foreground')
        }
      >
        {text}
      </p>
    </div>
  );
}
