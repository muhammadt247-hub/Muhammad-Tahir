'use client';

import React, { useEffect, useState } from 'react';
import { Shield, Store, ShoppingBag, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function MarketplaceAdminPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('mp_orders')
        .select('*, mp_listings(title, price, mp_vendors(name))')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setOrders(data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/marketplace">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" /> Marketplace Admin
            </h1>
            <p className="text-sm text-muted-foreground">Manage customer orders and vendor listings.</p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchOrders} disabled={loading} className="gap-2 rounded-xl">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-foreground">Recent Orders</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="pb-3 font-semibold">Order No</th>
                  <th className="pb-3 font-semibold">Customer</th>
                  <th className="pb-3 font-semibold">WhatsApp</th>
                  <th className="pb-3 font-semibold">Listing / Vendor</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="py-3 font-mono font-medium">{o.order_no}</td>
                    <td className="py-3 font-semibold">{o.customer_name}</td>
                    <td className="py-3 text-muted-foreground">{o.customer_whatsapp}</td>
                    <td className="py-3">
                      <div className="font-medium">{o.mp_listings?.title || 'Listing'}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.mp_listings?.mp_vendors?.name || 'Vendor'}
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/15 text-primary">
                        {o.status || 'pending'}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
