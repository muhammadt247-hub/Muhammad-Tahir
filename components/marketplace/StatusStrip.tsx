'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { statusImageUrl } from '@/lib/marketplace/shared';

export type StatusKind = 'offer' | 'stock' | 'news';

interface StatusRow {
  id: string;
  vendor_id: string;
  vendor_name: string;
  title: string;
  body: string;
  kind: StatusKind;
  icon: string | null;
  image_path: string | null;
  product_id: string | null;
  listing_title: string | null;
  created_at: string;
  expires_at: string;
}

const SHOW_MS = 10000; // each status is shown for 10 seconds
const SEEN_KEY = 'mp_seen_status';

export const KIND_INFO: Record<StatusKind, { label: string; big: string; pill: string; bg: string; icon: string }> = {
  offer: { label: 'Special offer', big: 'Offer', pill: 'bg-rose-100 text-rose-700', bg: 'from-rose-500 to-orange-500', icon: '🔥' },
  stock: { label: 'New stock', big: 'New stock', pill: 'bg-emerald-100 text-emerald-700', bg: 'from-emerald-500 to-teal-600', icon: '📦' },
  news: { label: 'News from the vendor', big: 'News', pill: 'bg-sky-100 text-sky-700', bg: 'from-sky-500 to-indigo-600', icon: '📢' },
};

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + ' min ago';
  const h = Math.round(mins / 60);
  return h + (h === 1 ? ' hour ago' : ' hours ago');
}

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

// The round picture or icon of one status
export function StatusRound({ s, size }: { s: Pick<StatusRow, 'image_path' | 'icon' | 'kind'>; size: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'h-full w-full' : 'h-9 w-9';
  if (s.image_path) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={statusImageUrl(s.image_path)} alt="" draggable={false} className={`${box} rounded-full object-cover`} />;
  }
  return (
    <span className={`${box} grid place-items-center rounded-full bg-gradient-to-br ${KIND_INFO[s.kind].bg} ${size === 'lg' ? 'text-4xl' : 'text-lg'}`}>
      {s.icon || KIND_INFO[s.kind].icon}
    </span>
  );
}

// Offers, new stock and news from vendors, as round icons with a short title (like stories).
// Each one plays for 10 seconds. Press and hold to pause, tap the right side for next, the left side for back.
export function StatusStrip({ onOpenProduct }: { onOpenProduct?: (productId: string) => void }) {
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [openVendor, setOpenVendor] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const pressAt = useRef(0);

  useEffect(() => {
    setSeen(readSeen());
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await createClient().rpc('mp_active_statuses');
        if (!cancelled && !error) setRows((data ?? []) as StatusRow[]);
      } catch {
        // a bonus feature: the page works without it
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const vendors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; items: StatusRow[] }>();
    rows.forEach((r) => {
      const v = map.get(r.vendor_id) ?? { id: r.vendor_id, name: r.vendor_name, items: [] };
      v.items.push(r);
      map.set(r.vendor_id, v);
    });
    return Array.from(map.values());
  }, [rows]);

  const open = vendors.find((v) => v.id === openVendor) ?? null;
  const current = open ? open.items[Math.min(idx, open.items.length - 1)] : null;

  const close = useCallback(() => {
    setOpenVendor(null);
    setIdx(0);
    setProgress(0);
    setPaused(false);
  }, []);

  const next = useCallback(() => {
    if (!open) return;
    setProgress(0);
    if (idx + 1 >= open.items.length) close();
    else setIdx(idx + 1);
  }, [open, idx, close]);

  const back = useCallback(() => {
    setProgress(0);
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    if (!current) return;
    setSeen((prev) => {
      if (prev.has(current.id)) return prev;
      const n = new Set(prev);
      n.add(current.id);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(n).slice(-200)));
      } catch {
        // ignore
      }
      return n;
    });
  }, [current]);

  useEffect(() => {
    if (!open || paused) return;
    const t = setInterval(() => setProgress((p) => p + 50 / SHOW_MS), 50);
    return () => clearInterval(t);
  }, [open, paused]);

  useEffect(() => {
    if (progress >= 1) next();
  }, [progress, next]);

  if (vendors.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-base font-extrabold text-foreground">Offers &amp; news from vendors</h2>
        <p className="text-xs text-muted-foreground">Tap a circle to see today&apos;s offers, new stock and news. Each one plays for 10 seconds.</p>
      </div>
      <div className="flex gap-5 overflow-x-auto pb-1">
        {vendors.map((v) => {
          const latest = v.items[v.items.length - 1];
          const allSeen = v.items.every((s) => seen.has(s.id));
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                const firstNew = v.items.findIndex((s) => !seen.has(s.id));
                setIdx(firstNew > 0 ? firstNew : 0);
                setProgress(0);
                setPaused(false);
                setOpenVendor(v.id);
              }}
              className="flex w-24 shrink-0 flex-col items-center gap-1.5 text-center"
            >
              <span
                className={
                  'h-20 w-20 rounded-full p-[3px] ' +
                  (allSeen ? 'bg-muted-foreground/30' : 'bg-gradient-to-br from-primary via-orange-400 to-amber-300')
                }
              >
                <span className="block h-full w-full rounded-full bg-card p-[2px]">
                  <StatusRound s={latest} size="lg" />
                </span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${KIND_INFO[latest.kind].pill}`}>{KIND_INFO[latest.kind].big}</span>
              <span className="line-clamp-2 w-full text-xs font-bold leading-tight text-foreground">{latest.title}</span>
              <span className="w-full truncate text-[11px] text-muted-foreground">{v.name}</span>
            </button>
          );
        })}
      </div>

      {open && current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-0 sm:p-4" onClick={close}>
          <div
            className="mp-pop relative flex h-full w-full max-w-xl select-none flex-col overflow-hidden bg-neutral-900 text-white sm:h-[min(94vh,820px)] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* progress bars, one per status */}
            <div className="absolute inset-x-0 top-0 z-20 flex gap-1.5 p-3">
              {open.items.map((s, i) => (
                <div key={s.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/30">
                  <div className="h-full bg-white" style={{ width: (i < idx ? 100 : i === idx ? Math.min(100, progress * 100) : 0) + '%' }} />
                </div>
              ))}
            </div>
            <div className="absolute inset-x-0 top-5 z-20 flex items-center justify-between px-4 pt-1">
              <div className="flex items-center gap-3">
                <span className="block h-11 w-11 overflow-hidden rounded-full ring-2 ring-white/70">
                  <StatusRound s={current} size="lg" />
                </span>
                <div className="leading-tight">
                  <div className="text-base font-extrabold">{open.name}</div>
                  <div className="text-xs text-white/75">{timeAgo(current.created_at)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${KIND_INFO[current.kind].pill}`}>{KIND_INFO[current.kind].label}</span>
                <button type="button" onClick={close} aria-label="Close" className="rounded-full bg-black/40 p-2 hover:bg-black/60">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* the status itself: hold to pause, tap the sides to move */}
            <div
              className="relative flex flex-1 items-center justify-center"
              onPointerDown={() => {
                pressAt.current = Date.now();
                setPaused(true);
              }}
              onPointerUp={(e) => {
                setPaused(false);
                if (Date.now() - pressAt.current < 250) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (e.clientX - rect.left < rect.width / 3) back();
                  else next();
                }
              }}
              onPointerCancel={() => setPaused(false)}
              onPointerLeave={() => setPaused(false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {current.image_path ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={statusImageUrl(current.image_path)} alt="" draggable={false} className="h-full w-full object-contain" />
                  <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-6 pb-6 pt-24 text-center">
                    <h3 className="text-3xl font-extrabold leading-tight sm:text-4xl">{current.title}</h3>
                    {current.body && <p className="text-lg leading-snug text-white/90 sm:text-xl">{current.body}</p>}
                  </div>
                </>
              ) : (
                <div className={`flex h-full w-full flex-col items-center justify-center gap-5 bg-gradient-to-br ${KIND_INFO[current.kind].bg} px-8 pt-16 text-center`}>
                  <span className="text-8xl">{current.icon || KIND_INFO[current.kind].icon}</span>
                  <h3 className="text-4xl font-extrabold leading-tight sm:text-5xl">{current.title}</h3>
                  {current.body && <p className="text-xl leading-snug text-white/95 sm:text-2xl">{current.body}</p>}
                </div>
              )}
            </div>

            <div className="z-20 space-y-2 bg-neutral-900 px-5 pb-4 pt-3 text-center">
              {current.product_id && onOpenProduct && (
                <button
                  type="button"
                  onClick={() => {
                    const id = current.product_id as string;
                    close();
                    onOpenProduct(id);
                  }}
                  className="w-full rounded-xl bg-white py-3 text-base font-extrabold text-neutral-900 hover:bg-white/90"
                >
                  See this package{current.listing_title ? `: ${current.listing_title}` : ''}
                </button>
              )}
              <p className="text-xs text-white/65">{paused ? 'Paused. Let go to continue.' : 'Press and hold to pause. Tap the right side for the next one.'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
