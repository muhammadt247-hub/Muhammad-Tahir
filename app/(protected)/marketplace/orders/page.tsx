'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { MARKETPLACE_ENABLED, ORDERS_WHATSAPP, formatPkr } from '@/lib/marketplace/shared';

interface MyOrder {
  id: string;
  order_no: string;
  product_name: string;
  package_title: string;
  vendor_name: string;
  price: number | string;
  status: string;
  problem_reason: string | null;
  created_at: string;
  delivery_due_at: string | null;
  confirm_deadline_at: string | null;
}

// Simple words for the customer
const STATUS_TEXT: Record<string, { label: string; help: string }> = {
  requested: {
    label: 'Order received',
    help: 'Send your order on WhatsApp. We will reply with the payment details.',
  },
  awaiting_payment: {
    label: 'Waiting for your payment',
    help: 'Please pay using the details we sent you on WhatsApp.',
  },
  payment_confirmed: {
    label: 'Payment confirmed',
    help: 'Your delivery time has started. We are preparing your order.',
  },
  with_vendor: {
    label: 'Being prepared',
    help: 'Your order is being prepared with the vendor.',
  },
  received_checked: {
    label: 'Checked, almost ready',
    help: 'We received your package and checked it. It is on its way to you.',
  },
  delivered: {
    label: 'Delivered, please check',
    help: 'Please check your package. If everything works, press Confirm. If not, report a problem.',
  },
  completed: { label: 'Completed', help: 'Thank you for your order.' },
  disputed: {
    label: 'Problem reported',
    help: 'We are looking into your problem and will contact you on WhatsApp.',
  },
  cancelled: { label: 'Cancelled', help: 'This order was cancelled.' },
  refunded: { label: 'Refunded', help: 'This order was refunded.' },
};

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
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
      </div>
    </div>
  );
}

export default function MyOrdersPage() {
  if (!MARKETPLACE_ENABLED) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-2">
        <h1 className="text-2xl font-extrabold text-foreground">My orders</h1>
        <p className="text-sm text-muted-foreground">This page is not available yet.</p>
      </div>
    );
  }
  return <MyOrders />;
}

function MyOrders() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setError('Please log in to see your orders.');
        return;
      }
      const { data, error: err } = await supabase
        .from('mp_orders')
        .select(
          'id, order_no, product_name, package_title, vendor_name, price, status, problem_reason, created_at, delivery_due_at, confirm_deadline_at'
        )
        .eq('customer_id', uid)
        .order('created_at', { ascending: false })
        .limit(100);
      if (err) throw new Error(err.message);
      setOrders((data ?? []) as MyOrder[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (o: MyOrder, fn: string, args: Record<string, unknown>, okText: string) => {
    if (busyId) return;
    setBusyId(o.id);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.rpc(fn, args);
      if (err) throw new Error(err.message);
      toast.success(okText);
      setReportingId(null);
      setReason('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  };

  const confirmOrder = (o: MyOrder) => {
    if (!window.confirm('Is everything working? Press OK to confirm and complete this order.')) return;
    run(o, 'mp_customer_confirm', { p_order: o.id }, 'Thank you! Order completed.');
  };

  const cancelOrder = (o: MyOrder) => {
    if (!window.confirm('Cancel order ' + o.order_no + '?')) return;
    run(o, 'mp_customer_cancel', { p_order: o.id }, 'Order cancelled.');
  };

  const sendReport = (o: MyOrder) => {
    if (reason.trim().length < 10) {
      toast.error('Please describe the problem (at least 10 characters).');
      return;
    }
    run(o, 'mp_customer_report', { p_order: o.id, p_reason: reason.trim() }, 'Problem reported. We will contact you.');
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 pb-12">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">My orders</h1>
        <Link
          href="/marketplace"
          className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to marketplace
        </Link>
      </div>

      {error && <p className="text-sm font-semibold text-red-600 break-words">{error}</p>}

      {!error && orders.length === 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
          You have no orders yet.
        </div>
      )}

      <div className="space-y-4">
        {orders.map((o) => {
          const info = STATUS_TEXT[o.status] ?? { label: o.status, help: '' };
          const waText = 'Hello, I have a question about my order ' + o.order_no + '.';
          return (
            <div
              key={o.id}
              className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-extrabold text-foreground">{o.order_no}</span>
                  <Badge variant={o.status === 'disputed' ? 'ai' : 'category'}>{info.label}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(o.created_at)}</span>
              </div>

              <div className="text-sm space-y-0.5">
                <p className="font-bold text-foreground">
                  {o.product_name} ({o.package_title})
                </p>
                <p className="text-muted-foreground">Vendor: {o.vendor_name}</p>
                <p className="text-muted-foreground">
                  Price: <span className="font-bold text-foreground">{formatPkr(Number(o.price))}</span>
                </p>
              </div>

              {info.help && <p className="text-xs text-muted-foreground">{info.help}</p>}

              {o.delivery_due_at && ['payment_confirmed', 'with_vendor', 'received_checked', 'disputed'].includes(o.status) && (
                <Countdown target={o.delivery_due_at} label="Delivery time left" />
              )}
              {o.confirm_deadline_at && o.status === 'delivered' && (
                <Countdown target={o.confirm_deadline_at} label="Please confirm within" />
              )}

              {o.problem_reason && (
                <div className="rounded-xl bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300 break-words">
                  Your report: {o.problem_reason}
                </div>
              )}

              {reportingId === o.id && (
                <div className="space-y-2">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Tell us what is wrong..."
                    className="w-full rounded-xl border border-border/60 bg-background p-3 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busyId === o.id} onClick={() => sendReport(o)}>
                      Send report
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReportingId(null);
                        setReason('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {o.status === 'delivered' && reportingId !== o.id && (
                  <>
                    <Button size="sm" disabled={busyId === o.id} onClick={() => confirmOrder(o)}>
                      Confirm, all good
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === o.id}
                      onClick={() => setReportingId(o.id)}
                    >
                      Report a problem
                    </Button>
                  </>
                )}
                {['requested', 'awaiting_payment'].includes(o.status) && (
                  <Button size="sm" variant="outline" disabled={busyId === o.id} onClick={() => cancelOrder(o)}>
                    Cancel order
                  </Button>
                )}
                <a
                  href={'https://wa.me/' + ORDERS_WHATSAPP + '?text=' + encodeURIComponent(waText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                >
                  Message us on WhatsApp
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
