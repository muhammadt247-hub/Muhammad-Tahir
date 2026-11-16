'use client';

// Admin-only views for the marketplace: money summary, per-vendor payouts, vendor scores, and all vendor statuses.
// Everything here reads data that only admins can see (the database checks mp_is_admin()).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { formatPkr } from '@/lib/marketplace/shared';

export interface MoneyRow {
  status: string;
  vendor_name: string;
  price: number | string;
  vendor_price: number | null;
  commission: number | null;
  vendor_paid_at: string | null;
}

// ---------- money summary ----------

export function MoneySummary({ rows }: { rows: MoneyRow[] }) {
  const s = useMemo(() => {
    let sales = 0, commission = 0, owed = 0, paidOut = 0, open = 0;
    for (const r of rows) {
      if (r.status === 'completed') {
        sales += Number(r.price) || 0;
        commission += Number(r.commission) || 0;
        if (r.vendor_paid_at) paidOut += Number(r.vendor_price) || 0;
        else owed += Number(r.vendor_price) || 0;
      } else if (!['cancelled', 'refunded'].includes(r.status)) {
        open += Number(r.price) || 0;
      }
    }
    return { sales, commission, owed, paidOut, open };
  }, [rows]);
  const card = (label: string, value: number, hint: string, strong = false) => (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={'mt-1 text-xl font-extrabold tabular-nums ' + (strong ? 'text-primary' : 'text-foreground')}>{formatPkr(value)}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {card('Completed sales', s.sales, 'What customers paid')}
      {card('Your commission', s.commission, 'From completed orders', true)}
      {card('To pay vendors', s.owed, 'Completed, not paid yet')}
      {card('Open orders', s.open, 'Still in progress')}
    </div>
  );
}

// ---------- per-vendor payouts ----------

export function PayoutTotals({ rows }: { rows: MoneyRow[] }) {
  const list = useMemo(() => {
    const m = new Map<string, { orders: number; amount: number }>();
    for (const r of rows) {
      if (r.status !== 'completed' || r.vendor_paid_at) continue;
      const e = m.get(r.vendor_name) ?? { orders: 0, amount: 0 };
      e.orders += 1;
      e.amount += Number(r.vendor_price) || 0;
      m.set(r.vendor_name, e);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].amount - a[1].amount);
  }, [rows]);
  if (list.length === 0) return null;
  const total = list.reduce((t, [, e]) => t + e.amount, 0);
  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 space-y-2">
      <p className="text-sm font-bold text-foreground">Amount to pay each vendor</p>
      <div className="divide-y divide-border/60">
        {list.map(([name, e]) => (
          <div key={name} className="flex items-center justify-between py-2 text-sm">
            <span className="font-semibold text-foreground">{name}</span>
            <span className="text-muted-foreground">
              {e.orders} {e.orders === 1 ? 'order' : 'orders'} ·{' '}
              <span className="font-extrabold text-foreground tabular-nums">{formatPkr(e.amount)}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="text-right text-xs font-bold text-foreground">Total: {formatPkr(total)}</p>
      <p className="text-[11px] text-muted-foreground">After you pay a vendor, press "Vendor paid" on each of their orders below.</p>
    </div>
  );
}

// ---------- vendor scores ----------

interface ScoreRow {
  vendor_id: string;
  orders_window: number;
  completed_total: number;
  review_count: number;
  avg_rating: number | null;
  completion_pct: number | null;
  ontime_pct: number | null;
  complaints_pct: number | null;
  score: number | null;
  is_new: boolean;
}

export function VendorScores() {
  const [rows, setRows] = useState<(ScoreRow & { name: string })[] | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const [sc, vs, st] = await Promise.all([
          supabase.rpc('mp_vendor_scores'),
          supabase.from('mp_vendors').select('id, name'),
          supabase.from('mp_settings').select('value').eq('key', 'score_days').maybeSingle(),
        ]);
        if (sc.error) throw new Error(sc.error.message);
        const names = new Map((vs.data ?? []).map((v: { id: string; name: string }) => [v.id, v.name]));
        if (st.data?.value) setDays(Number(st.data.value) || 30);
        setRows(
          ((sc.data ?? []) as ScoreRow[])
            .map((r) => ({ ...r, name: names.get(r.vendor_id) ?? 'Vendor' }))
            .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load scores');
      }
    })();
  }, []);

  const pct = (v: number | null) => (v === null || v === undefined ? '–' : `${Number(v).toFixed(0)}%`);
  if (error) return <p className="text-xs font-semibold text-red-600">{error}</p>;
  if (!rows) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  if (rows.length === 0)
    return <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">No approved vendors yet.</div>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Scores use the last {days} days. Score = rating 30% + completed 25% + on time 20% + few complaints 15%. A vendor is
        &quot;New&quot; until 5 completed orders.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.vendor_id} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-foreground">{r.name}</span>
                {r.is_new && <Badge variant="category">New</Badge>}
              </div>
              <span className="text-2xl font-extrabold tabular-nums text-primary">{r.score === null ? '–' : Number(r.score).toFixed(0)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="Rating" value={r.avg_rating === null ? '–' : `${Number(r.avg_rating).toFixed(1)} ★ (${r.review_count})`} />
              <Stat label="Completed" value={pct(r.completion_pct)} />
              <Stat label="On time" value={pct(r.ontime_pct)} />
              <Stat label="Complaints" value={pct(r.complaints_pct)} />
              <Stat label={`Orders (${days} days)`} value={String(r.orders_window)} />
              <Stat label="Completed (all time)" value={String(r.completed_total)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

// ---------- all vendor statuses ----------

interface StatusRow {
  id: string;
  vendor_name: string;
  title: string | null;
  body: string | null;
  kind: string | null;
  icon: string | null;
  image_path: string | null;
  listing_title: string | null;
  created_at: string;
  expires_at: string;
}

const KIND_LABEL: Record<string, string> = { offer: 'Offer', stock: 'New stock', news: 'News' };

export function StatusModeration() {
  const [rows, setRows] = useState<StatusRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.rpc('mp_active_statuses');
      if (err) throw new Error(err.message);
      setRows(((data ?? []) as StatusRow[]).slice().reverse());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load statuses');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (s: StatusRow) => {
    if (busy) return;
    if (!window.confirm(`Remove this status from ${s.vendor_name}? Buyers will not see it any more.`)) return;
    setBusy(s.id);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.rpc('mp_vendor_delete_status', { p_id: s.id });
      if (err) throw new Error(err.message);
      toast.success('Status removed');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove');
    } finally {
      setBusy(null);
    }
  };

  const imageUrl = (path: string) => createClient().storage.from('mp-status').getPublicUrl(path).data.publicUrl;
  const left = (iso: string) => {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return 'ended';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  };

  if (error) return <p className="text-xs font-semibold text-red-600">{error}</p>;
  if (!rows) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  if (rows.length === 0)
    return <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">No vendor statuses are live right now.</div>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Every status buyers can see right now (newest first). Each one lasts 24 hours. Remove anything that breaks the rules.
      </p>
      {rows.map((s) => (
        <div key={s.id} className="flex gap-3 rounded-2xl border border-border/60 bg-card p-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-primary/60 bg-muted flex items-center justify-center text-2xl">
            {s.image_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl(s.image_path)} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{s.icon || '📢'}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-extrabold text-foreground">{s.vendor_name}</span>
              {s.kind && <Badge variant="category">{KIND_LABEL[s.kind] ?? s.kind}</Badge>}
              <span className="text-[11px] text-muted-foreground">{left(s.expires_at)}</span>
            </div>
            {s.title && <p className="text-sm font-bold text-foreground break-words">{s.title}</p>}
            {s.body && <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{s.body}</p>}
            {s.listing_title && <p className="text-[11px] text-muted-foreground">Linked package: {s.listing_title}</p>}
          </div>
          <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => remove(s)} aria-label="Remove status">
            {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      ))}
    </div>
  );
}
