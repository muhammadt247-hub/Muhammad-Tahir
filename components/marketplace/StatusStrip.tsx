'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { statusImageUrl } from '@/lib/marketplace/shared';

interface StatusRow {
  id: string;
  vendor_id: string;
  vendor_name: string;
  body: string;
  image_path: string | null;
  created_at: string;
  expires_at: string;
}

const SHOW_MS = 10000; // each status is shown for 10 seconds
const SEEN_KEY = 'mp_seen_status';

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

// Round vendor icons with 24-hour updates (like stories). Each one plays for 10 seconds.
// Press and hold to pause, tap the right side for next, tap the left side for back.
export function StatusStrip() {
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

  // remember what was watched
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

  // 10-second timer that stops while the viewer holds the screen
  useEffect(() => {
    if (!open || paused) return;
    const t = setInterval(() => {
      setProgress((p) => p + 50 / SHOW_MS);
    }, 50);
    return () => clearInterval(t);
  }, [open, paused]);

  useEffect(() => {
    if (progress >= 1) next();
  }, [progress, next]);

  if (vendors.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor updates</p>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {vendors.map((v) => {
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
              className="flex w-16 shrink-0 flex-col items-center gap-1.5"
            >
              <span
                className={
                  'grid h-14 w-14 place-items-center rounded-full p-[3px] ' +
                  (allSeen ? 'bg-muted-foreground/30' : 'bg-gradient-to-br from-primary to-orange-400')
                }
              >
                <span className="grid h-full w-full place-items-center rounded-full bg-card text-base font-extrabold text-primary">
                  {v.name.slice(0, 2).toUpperCase()}
                </span>
              </span>
              <span className="w-full truncate text-center text-[11px] font-semibold text-foreground">{v.name}</span>
            </button>
          );
        })}
      </div>

      {open && current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-0 sm:p-4" onClick={close}>
          <div
            className="mp-pop relative flex h-full w-full max-w-md select-none flex-col overflow-hidden bg-neutral-900 text-white sm:h-[min(88vh,760px)] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* progress bars, one per status */}
            <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-2">
              {open.items.map((s, i) => (
                <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                  <div
                    className="h-full bg-white"
                    style={{ width: (i < idx ? 100 : i === idx ? Math.min(100, progress * 100) : 0) + '%' }}
                  />
                </div>
              ))}
            </div>
            <div className="absolute inset-x-0 top-4 z-20 flex items-center justify-between px-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-xs font-extrabold">
                  {open.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-bold">{open.name}</div>
                  <div className="text-[11px] text-white/70">{timeAgo(current.created_at)}</div>
                </div>
              </div>
              <button type="button" onClick={close} aria-label="Close" className="rounded-full bg-black/30 p-1.5 hover:bg-black/50">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* the status itself: hold to pause, tap sides to move */}
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
                  {current.body && (
                    <div className="absolute inset-x-0 bottom-10 bg-gradient-to-t from-black/80 to-transparent px-5 pb-2 pt-10 text-center text-base font-semibold">
                      {current.body}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-orange-500 px-8 text-center text-2xl font-extrabold leading-snug">
                  {current.body}
                </div>
              )}
            </div>
            <div className="z-20 px-4 pb-3 pt-2 text-center text-[11px] text-white/70">
              {paused ? 'Paused. Let go to continue.' : 'Press and hold to pause. Tap the right side for next.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
