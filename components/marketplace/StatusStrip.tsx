'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface StatusRow {
  id: string;
  vendor_id: string;
  vendor_name: string;
  body: string;
  created_at: string;
  expires_at: string;
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + ' min ago';
  const h = Math.round(mins / 60);
  return h + (h === 1 ? ' hour ago' : ' hours ago');
}

// Round vendor icons with 24-hour updates (like stories). Shows nothing when there are no updates.
export function StatusStrip() {
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [openVendor, setOpenVendor] = useState<string | null>(null);

  useEffect(() => {
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

  if (vendors.length === 0) return null;
  const open = vendors.find((v) => v.id === openVendor) ?? null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor updates</p>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {vendors.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setOpenVendor(v.id)}
            className="flex w-16 shrink-0 flex-col items-center gap-1.5"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-primary to-orange-400 p-[3px]">
              <span className="grid h-full w-full place-items-center rounded-full bg-card text-base font-extrabold text-primary">
                {v.name.slice(0, 2).toUpperCase()}
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px] font-semibold text-foreground">{v.name}</span>
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setOpenVendor(null)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-2xl border border-border/60 bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-sm font-extrabold text-primary">
                  {open.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="font-bold text-foreground">{open.name}</span>
              </div>
              <button type="button" onClick={() => setOpenVendor(null)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2">
              {open.items.map((s) => (
                <div key={s.id} className="rounded-xl bg-muted/50 p-3">
                  <p className="break-words text-sm text-foreground">{s.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(s.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
