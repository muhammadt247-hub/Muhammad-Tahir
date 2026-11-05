'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { MARKETPLACE_ENABLED, formatPkr } from '@/lib/marketplace/shared';

interface PrivateRow {
  vendor_price: number | string;
  commission: number | string;
  vendor_paid_at: string | null;
}

interface OrderRow {
  id: string;
  order_no: string;
  product_name: string;
  package_title: string;
  vendor_name: string;
  price: number | string;
  customer_name: string;
  customer_whatsapp: string;
  customer_email: string | null;
  notes: string | null;
  status: string;
  delivery_hours: number;
  confirm_hours: number;
  problem_reason: string | null;
  created_at: string;
  delivery_due_at: string | null;
  confirm_deadline_at: string | null;
  mp_order_private: PrivateRow | PrivateRow[] | null;
}

const STATUS_LABEL: Record<string, string> = {
  requested: 'New request',
  awaiting_payment: 'Waiting for payment',
  payment_confirmed: 'Paid, timer running',
  with_vendor: 'With vendor',
  received_checked: 'Received and checked',
  delivered: 'Delivered, waiting customer',
  completed: 'Completed',
  disputed: 'Problem reported',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

interface Action {
  to: string;
  label: string;
  danger?: boolean;
}

// The buttons shown for each status (the database enforces the same rules)
const ACTIONS: Record<string, Action[]> = {
  requested: [
    { to: 'awaiting_payment', label: 'Payment details sent' },
    { to: 'cancelled', label: 'Cancel', danger: true },
  ],
  awaiting_payment: [
    { to: 'payment_confirmed', label: 'Payment received' },
    { to: 'cancelled', label: 'Cancel', danger: true },
  ],
  payment_confirmed: [
    { to: 'with_vendor', label: 'Sent to vendor' },
    { to: 'refunded', label: 'Refund', danger: true },
  ],
  with_vendor: [
    { to: 'received_checked', label: 'Received and checked' },
    { to: 'refunded', label: 'Refund', danger: true },
  ],
  received_checked: [
    { to: 'delivered', label: 'Delivered to customer' },
    { to: 'refunded', label: 'Refund', danger: true },
  ],
  delivered: [
    { to: 'completed', label: 'Mark completed' },
    { to: 'refunded', label: 'Refund', danger: true },
  ],
  disputed: [
    { to: 'with_vendor', label: 'Send back to vendor' },
    { to: 'completed', label: 'Mark completed' },
    { to: 'refunded', label: 'Refund', danger: true },
  ],
};

const FILTERS: { key: string; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'problems', label: 'Problems' },
  { key: 'payout', label: 'To pay vendor' },
  { key: 'done', label: 'Finished' },
  { key: 'all', label: 'All' },
];

const CLOSED = ['completed', 'cancelled', 'refunded'];

function getPrivate(o: OrderRow): PrivateRow | null {
  const p = o.mp_order_private;
  return Array.isArray(p) ? p[0] ?? null : p;
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

// A live clock that ticks every second: 23:59:41 left, or 00:12:05 late (red)
function Countdown({ target, label }: { target: string; label: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = new Date(target).getTime() - now;
  const late = diff < 0;
  const total = Math.floor(Math.abs(diff) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return (
    <div
      className={
        'inline-flex items-center gap-2 rounded-xl border px-3 py-2 ' +
        (late
          ? 'border-red-500/40 bg-red-500/10 text-red-600'
          : 'border-border/60 bg-muted/50 text-foreground')
      }
    >
      <Clock className="h-4 w-4" />
      <div className="leading-tight">
        <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
        <div className="font-mono text-lg font-extrabold tabular-nums">
          {pad2(h)}:{pad2(m)}:{pad2(sec)}
          <span className="ml-1.5 text-xs font-semibold">{late ? 'late' : 'left'}</span>
        </div>
        <div className="text-[11px] text-muted-foreground">Due {formatDate(target)}</div>
      </div>
    </div>
  );
}

function onlyDigits(v: string): string {
  return v.replace(/[^0-9]/g, '');
}

export default function MarketplaceAdminPage() {
  if (!MARKETPLACE_ENABLED) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-2">
        <h1 className="text-2xl font-extrabold text-foreground">Marketplace</h1>
        <p className="text-sm text-muted-foreground">This page is not available yet.</p>
      </div>
    );
  }
  return <AdminOrders />;
}

function AdminOrders() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState('open');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const adminCheck = await supabase.rpc('mp_is_admin');
      if (adminCheck.error) throw new Error(adminCheck.error.message);
      if (adminCheck.data !== true) {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(true);
      const { data, error: err } = await supabase
        .from('mp_orders')
        .select(
          'id, order_no, product_name, package_title, vendor_name, price, customer_name, customer_whatsapp, customer_email, notes, status, delivery_hours, confirm_hours, problem_reason, created_at, delivery_due_at, confirm_deadline_at, mp_order_private(vendor_price, commission, vendor_paid_at)'
        )
        .order('created_at', { ascending: false })
        .limit(200);
      if (err) throw new Error(err.message);
      setOrders((data ?? []) as unknown as OrderRow[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (o: OrderRow, a: Action) => {
    if (busyId) return;
    if (a.danger && !window.confirm(a.label + ' order ' + o.order_no + '? This cannot be undone.')) return;
    setBusyId(o.id);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.rpc('mp_admin_set_status', {
        p_order: o.id,
        p_new: a.to,
        p_note: null,
      });
      if (err) throw new Error(err.message);
      toast.success(o.order_no + ': ' + (STATUS_LABEL[a.to] ?? a.to));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not change the status');
    } finally {
      setBusyId(null);
    }
  };

  const markVendorPaid = async (o: OrderRow) => {
    if (busyId) return;
    if (!window.confirm('Mark the vendor as paid for ' + o.order_no + '?')) return;
    setBusyId(o.id);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.rpc('mp_admin_mark_vendor_paid', { p_order: o.id });
      if (err) throw new Error(err.message);
      toast.success(o.order_no + ': vendor marked as paid');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusyId(null);
    }
  };

  const visible = useMemo(() => {
    return orders.filter((o) => {
      const p = getPrivate(o);
      if (filter === 'open') return !CLOSED.includes(o.status);
      if (filter === 'problems') return o.status === 'disputed';
      if (filter === 'payout') return o.status === 'completed' && !p?.vendor_paid_at;
      if (filter === 'done') return CLOSED.includes(o.status);
      return true;
    });
  }, [orders, filter]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 pb-12">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-2">
        <h1 className="text-2xl font-extrabold text-foreground">Admin only</h1>
        <p className="text-sm text-muted-foreground">{error ?? 'You do not have access to this page.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Marketplace orders</h1>
        <Button size="sm" variant="outline" onClick={() => load()}>
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ' +
              (filter === f.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent')
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs font-semibold text-red-600 break-words">{error}</p>}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
          No orders here.
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((o) => {
            const p = getPrivate(o);
            const actions = ACTIONS[o.status] ?? [];
            const waText =
              'Hello ' + o.customer_name + ', this is OrbinexaCSV about your order ' + o.order_no + '.';
            return (
              <div
                key={o.id}
                className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-extrabold text-foreground">{o.order_no}</span>
                    <Badge variant={o.status === 'disputed' ? 'ai' : 'category'}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(o.created_at)}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div className="space-y-0.5">
                    <p className="font-bold text-foreground">
                      {o.product_name} ({o.package_title})
                    </p>
                    <p className="text-muted-foreground">Vendor: {o.vendor_name}</p>
                    <p className="text-muted-foreground">
                      Customer price: <span className="font-bold text-foreground">{formatPkr(Number(o.price))}</span>
                    </p>
                    {p && (
                      <p className="text-muted-foreground">
                        Vendor price {formatPkr(Number(p.vendor_price))} | Your commission{' '}
                        {formatPkr(Number(p.commission))}
                      </p>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-foreground">{o.customer_name}</p>
                    <p className="text-muted-foreground">{o.customer_whatsapp}</p>
                    {o.customer_email && <p className="text-muted-foreground break-all">{o.customer_email}</p>}
                    {o.notes && <p className="text-muted-foreground break-words">Notes: {o.notes}</p>}
                  </div>
                </div>

                {(o.delivery_due_at || o.confirm_deadline_at) && (
                  <div className="flex flex-wrap gap-3">
                    {o.delivery_due_at && ['payment_confirmed', 'with_vendor', 'received_checked', 'disputed'].includes(o.status) && (
                      <Countdown target={o.delivery_due_at} label="Delivery time" />
                    )}
                    {o.confirm_deadline_at && o.status === 'delivered' && (
                      <Countdown target={o.confirm_deadline_at} label="Customer must confirm in" />
                    )}
                  </div>
                )}

                {o.problem_reason && (
                  <div className="rounded-xl bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300 break-words">
                    Problem reported: {o.problem_reason}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {actions.map((a) => (
                    <Button
                      key={a.to}
                      size="sm"
                      variant={a.danger ? 'outline' : 'default'}
                      disabled={busyId === o.id}
                      onClick={() => changeStatus(o, a)}
                    >
                      {a.label}
                    </Button>
                  ))}
                  {o.status === 'completed' &&
                    (p?.vendor_paid_at ? (
                      <span className="text-xs font-semibold text-green-600">
                        Vendor paid {formatDate(p.vendor_paid_at)}
                      </span>
                    ) : (
                      <Button size="sm" disabled={busyId === o.id} onClick={() => markVendorPaid(o)}>
                        Vendor paid
                      </Button>
                    ))}
                  <a
                    href={'https://wa.me/' + onlyDigits(o.customer_whatsapp) + '?text=' + encodeURIComponent(waText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                  >
                    WhatsApp customer
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
