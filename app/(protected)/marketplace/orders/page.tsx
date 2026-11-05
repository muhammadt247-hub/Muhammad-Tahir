'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Clock, MessageSquare, RefreshCw, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import {
  MARKETPLACE_ENABLED,
  formatPkr,
  buildWhatsAppLink,
} from '@/lib/marketplace/shared';
import Link from 'next/link';

interface UserOrderRow {
  id: string;
  order_no: string;
  product_name: string;
  package_title: string;
  vendor_name: string;
  price: number;
  status: string;
  created_at: string;
  delivery_due_at: string | null;
  confirm_deadline_at: string | null;
  problem_reason: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  requested: 'New request',
  awaiting_payment: 'Waiting for payment',
  payment_confirmed: 'Payment confirmed, processing',
  with_vendor: 'In progress with vendor',
  received_checked: 'Received & quality checked',
  delivered: 'Delivered',
  completed: 'Completed',
  disputed: 'Problem reported',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export default function UserOrdersPage() {
  if (!MARKETPLACE_ENABLED) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-2">
        <h1 className="text-2xl font-extrabold text-foreground">Marketplace</h1>
        <p className="text-sm text-muted-foreground">This page is not available yet.</p>
      </div>
    );
  }
  return <OrdersContent />;
}

function OrdersContent() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<UserOrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('mp_orders')
        .select('id, order_no, product_name, package_title, vendor_name, price, status, created_at, delivery_due_at, confirm_deadline_at, problem_reason')
        .order('created_at', { ascending: false });

      if (err) throw new Error(err.message);
      setOrders((data ?? []) as unknown as UserOrderRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelivery = async (orderId: string, orderNo: string) => {
    if (busyId) return;
    if (!window.confirm('Confirm that you received your order ' + orderNo + ' in good condition?')) return;
    setBusyId(orderId);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.rpc('mp_customer_confirm', { p_order: orderId });
      if (err) throw new Error(err.message);
      toast.success('Order completed successfully! Thank you.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not confirm order');
    } finally {
      setBusyId(null);
    }
  };

  const reportProblem = async (orderId: string, orderNo: string) => {
    if (busyId) return;
    const reason = window.prompt('Please describe the problem with order ' + orderNo + ':');
    if (!reason || !reason.trim()) return;
    setBusyId(orderId);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.rpc('mp_customer_dispute', {
        p_order: orderId,
        p_reason: reason.trim(),
      });
      if (err) throw new Error(err.message);
      toast.success('Problem reported. Support will review it shortly.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not report problem');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/marketplace">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-primary" /> My Orders
            </h1>
            <p className="text-sm text-muted-foreground">Track your marketplace purchases and delivery status.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => load()} disabled={loading} className="gap-2 rounded-xl">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-12 text-center space-y-4">
          <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
          <h2 className="text-lg font-bold text-foreground">No orders yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            You haven't placed any marketplace orders yet. Explore our verified packages to get started.
          </p>
          <Link href="/marketplace">
            <Button className="rounded-xl font-bold">Browse Marketplace</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const waMsg = 'Hello, I have a question regarding my order ' + o.order_no + ' (' + o.product_name + ').';
            const waLink = buildWhatsAppLink(waMsg);
            return (
              <div
                key={o.id}
                className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{o.order_no}</span>
                    <Badge variant="category">{STATUS_LABEL[o.status] ?? o.status}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-foreground">
                      {o.product_name} <span className="font-normal text-muted-foreground">({o.package_title})</span>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Vendor: {o.vendor_name}</p>
                  </div>
                  <div className="text-xl font-extrabold text-foreground">{formatPkr(Number(o.price))}</div>
                </div>

                {o.problem_reason && (
                  <div className="rounded-xl bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                    <span className="font-bold">Problem note:</span> {o.problem_reason}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
                  <div className="flex items-center gap-2">
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-bold text-white hover:opacity-90"
                    >
                      <MessageSquare className="w-4 h-4" /> Support on WhatsApp
                    </a>
                  </div>

                  <div className="flex items-center gap-2">
                    {o.status === 'delivered' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === o.id}
                          onClick={() => reportProblem(o.id, o.order_no)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Report problem
                        </Button>
                        <Button
                          size="sm"
                          disabled={busyId === o.id}
                          onClick={() => confirmDelivery(o.id, o.order_no)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Confirm receipt & complete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
