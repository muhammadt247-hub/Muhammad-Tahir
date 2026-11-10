'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Store } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { MARKETPLACE_ENABLED, ORDERS_WHATSAPP } from '@/lib/marketplace/shared';

interface MyVendor {
  id: string;
  name: string;
  about: string | null;
  status: string;
  verified: boolean;
}

export default function VendorPage() {
  if (!MARKETPLACE_ENABLED) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-2">
        <h1 className="text-2xl font-extrabold text-foreground">Vendor page</h1>
        <p className="text-sm text-muted-foreground">This page is not available yet.</p>
      </div>
    );
  }
  return <VendorHome />;
}

function VendorHome() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(true);
  const [vendor, setVendor] = useState<MyVendor | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [about, setAbout] = useState('');
  const [products, setProducts] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setLoggedIn(false);
        return;
      }
      setLoggedIn(true);
      const { data, error: err } = await supabase
        .from('mp_vendors')
        .select('id, name, about, status, verified')
        .eq('owner_id', uid)
        .maybeSingle();
      if (err) throw new Error(err.message);
      setVendor((data as MyVendor | null) ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your vendor page');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (busy) return;
    if (name.trim().length < 2) return toast.error('Please write your shop name.');
    if (whatsapp.replace(/[^0-9]/g, '').length < 10) return toast.error('Please write your WhatsApp number with country code.');
    if (about.trim().length < 10) return toast.error('Please tell us a little about your shop (at least 10 characters).');
    if (products.trim().length < 3) return toast.error('Please write what you sell.');
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.rpc('mp_vendor_apply', {
        p_name: name.trim(),
        p_whatsapp: whatsapp.trim(),
        p_about: about.trim(),
        p_products: products.trim(),
      });
      if (err) throw new Error(err.message);
      toast.success('Application sent. Now tap the green WhatsApp button to tell us.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send your application');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-12">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-3">
        <h1 className="text-2xl font-extrabold text-foreground">Become a vendor</h1>
        <p className="text-sm text-muted-foreground">Please sign up or log in first, then come back to this page.</p>
        <Link href="/login" className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Log in
        </Link>
      </div>
    );
  }

  const waText = vendor
    ? 'Hello, I applied as a vendor on OrbinexaCSV. Shop name: ' + vendor.name + '. Please check my application.'
    : '';

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Vendor page</h1>
        <Link href="/marketplace" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
          Back to marketplace
        </Link>
      </div>

      {error && <p className="text-sm font-semibold text-red-600 break-words">{error}</p>}

      {!vendor && !error && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-foreground">Apply to sell on OrbinexaCSV</h2>
            <p className="text-xs text-muted-foreground">
              Fill in this form. We will check your request and tell you on WhatsApp. Customers pay only OrbinexaCSV, and we pay you after each order is completed.
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Shop name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Example: Ali Digital Store" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Your WhatsApp number (with country code)</label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={20} placeholder="+92 300 1234567" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">What do you sell?</label>
            <Input value={products} onChange={(e) => setProducts(e.target.value)} maxLength={500} placeholder="Example: CapCut Pro, ChatGPT Plus, Canva Pro" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Tell us about your shop</label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="How long have you been selling? How do you deliver?"
              className="w-full rounded-xl border border-border/60 bg-background p-3 text-sm"
            />
          </div>
          <Button disabled={busy} onClick={submit}>
            {busy ? 'Sending...' : 'Send my application'}
          </Button>
        </div>
      )}

      {vendor && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-lg font-extrabold text-foreground">
              <Store className="h-5 w-5 text-muted-foreground" />
              {vendor.name}
            </span>
            {vendor.verified && (
              <Badge variant="nonAi">
                <ShieldCheck className="h-3 w-3" /> Verified
              </Badge>
            )}
            <Badge variant={vendor.status === 'approved' ? 'nonAi' : 'category'}>
              {vendor.status === 'pending' && 'Pending'}
              {vendor.status === 'approved' && 'Approved'}
              {vendor.status === 'suspended' && 'Suspended'}
              {vendor.status === 'rejected' && 'Not approved'}
            </Badge>
          </div>

          {vendor.status === 'pending' && (
            <>
              <p className="text-sm text-muted-foreground">
                Your application is waiting for approval. Tap the green button to message us on WhatsApp so we see it quickly.
              </p>
              <a
                href={'https://wa.me/' + ORDERS_WHATSAPP + '?text=' + encodeURIComponent(waText)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md bg-[#25D366] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
              >
                Tell us on WhatsApp
              </a>
            </>
          )}
          {vendor.status === 'approved' && (
            <p className="text-sm text-muted-foreground">
              You are approved. Your package tools (add packages, offers and status updates) are coming in the next update.
            </p>
          )}
          {vendor.status === 'suspended' && (
            <p className="text-sm text-muted-foreground">Your shop is paused. Please contact us on WhatsApp.</p>
          )}
          {vendor.status === 'rejected' && (
            <p className="text-sm text-muted-foreground">Your application was not approved. Please contact us on WhatsApp if you have a question.</p>
          )}
        </div>
      )}
    </div>
  );
}
