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
    ? 'Hello, I applied as a vendor on OrbinexaCSV. My vendor name is ' + vendor.name + '. Please check my application.'
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
            <label className="text-xs font-semibold text-foreground">Your real shop or business name (private)</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Example: Ali Digital Store" />
            <p className="text-[11px] text-muted-foreground">
              Only OrbinexaCSV sees this. Customers will see a brand name that the website makes for you, like ZYRO or VYNE. You cannot change it.
            </p>
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
            <label className="text-xs font-semibold text-foreground">Tell us about your shop (private)</label>
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

          <p className="text-xs text-muted-foreground">
            Your vendor name is <span className="font-bold text-foreground">{vendor.name}</span>. Customers see only this name. It was made by the website and cannot be changed.
          </p>

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
              You are approved. Add your packages below. Customers see them right away. You can change or pause a package at any time.
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

      {vendor && vendor.status === 'approved' && <MyPackages />}
    </div>
  );
}

const OTHER = '__other__';

interface ProductOption {
  id: string;
  name: string;
}

interface MyListing {
  id: string;
  product_id: string;
  product_name: string;
  title: string;
  vendor_price: number | string | null;
  delivery_hours: number;
  has_warranty: boolean;
  warranty_text: string | null;
  duration_months: number | null;
  is_custom: boolean;
  status: string;
}

// Quick buttons only. The vendor can type any package name or duration they like.
const DURATIONS: { label: string; months: number }[] = [
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
];

const DELIVERY_CHOICES: { hours: number; label: string }[] = [
  { hours: 1, label: 'Within 1 hour' },
  { hours: 3, label: 'Within 3 hours' },
  { hours: 6, label: 'Within 6 hours' },
  { hours: 12, label: 'Within 12 hours' },
  { hours: 24, label: 'Within 1 day' },
  { hours: 48, label: 'Within 2 days' },
  { hours: 72, label: 'Within 3 days' },
  { hours: 168, label: 'Within 7 days' },
];

function money(v: number | string | null): string {
  if (v === null || v === undefined) return '-';
  return 'Rs ' + Math.round(Number(v)).toLocaleString('en-US');
}

function MyPackages() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [rows, setRows] = useState<MyListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [productId, setProductId] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [pkgTitle, setPkgTitle] = useState('');
  const [price, setPrice] = useState('');
  const [hours, setHours] = useState(24);
  const [warranty, setWarranty] = useState(false);
  const [warrantyText, setWarrantyText] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const [p, l] = await Promise.all([
        supabase.from('mp_products').select('id, name').order('name'),
        supabase.rpc('mp_vendor_my_listings'),
      ]);
      if (p.error) throw new Error(p.error.message);
      if (l.error) throw new Error(l.error.message);
      setProducts((p.data ?? []) as ProductOption[]);
      setRows((l.data ?? []) as MyListing[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your packages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setProductId('');
    setNewProductName('');
    setPkgTitle('');
    setPrice('');
    setHours(24);
    setWarranty(false);
    setWarrantyText('');
    setFormOpen(false);
  };

  const startEdit = (r: MyListing) => {
    setEditingId(r.id);
    setProductId(r.product_id);
    setPkgTitle(r.title);
    setPrice(r.vendor_price === null ? '' : String(Math.round(Number(r.vendor_price))));
    setHours(r.delivery_hours);
    setWarranty(r.has_warranty);
    setWarrantyText(r.warranty_text ?? '');
    setFormOpen(true);
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // not important
    }
  };

  const save = async (override?: { row: MyListing; status: string }) => {
    if (busy) return;
    let args: Record<string, unknown>;
    if (override) {
      const r = override.row;
      args = {
        p_listing: r.id,
        p_product: r.product_id,
        p_title: r.title,
        p_vendor_price: Number(r.vendor_price),
        p_delivery_hours: r.delivery_hours,
        p_has_warranty: r.has_warranty,
        p_warranty_text: r.warranty_text,
        p_duration_months: r.duration_months,
        p_is_custom: r.is_custom,
        p_status: override.status,
      };
    } else {
      const title = pkgTitle.trim();
      const preset = DURATIONS.find((d) => d.label.toLowerCase() === title.toLowerCase());
      if (!productId) return toast.error('Please choose a product.');
      if (productId === OTHER && newProductName.trim().length < 2) return toast.error('Please write the product name.');
      if (title.length < 2) return toast.error('Please write the package duration or name.');
      const num = Number(price);
      if (!num || num <= 0) return toast.error('Please enter your price.');
      args = {
        p_listing: editingId,
        p_product: productId,
        p_title: title,
        p_vendor_price: num,
        p_delivery_hours: hours,
        p_has_warranty: warranty,
        p_warranty_text: warranty ? warrantyText.trim() || null : null,
        p_duration_months: preset ? preset.months : null,
        p_is_custom: !preset,
        p_status: editingId ? rows.find((x) => x.id === editingId)?.status ?? 'active' : 'active',
      };
    }
    setBusy(true);
    try {
      const supabase = createClient();
      if (!override && args.p_product === OTHER) {
        const made = await supabase.rpc('mp_vendor_add_product', { p_name: newProductName.trim() });
        if (made.error) throw new Error(made.error.message);
        args = { ...args, p_product: made.data as string };
      }
      const { error: err } = await supabase.rpc('mp_vendor_save_listing', args);
      if (err) throw new Error(err.message);
      toast.success(override ? 'Package updated.' : editingId ? 'Package saved.' : 'Package added. Customers can see it now.');
      if (!override) resetForm();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the package');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold text-foreground">My packages</h2>
        {!formOpen && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            Add a package
          </Button>
        )}
      </div>

      {error && <p className="text-sm font-semibold text-red-600 break-words">{error}</p>}

      {formOpen && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 shadow-sm">
          <h3 className="text-base font-bold text-foreground">{editingId ? 'Change package' : 'New package'}</h3>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={!!editingId}
              className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm"
            >
              <option value="">Choose a product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {!editingId && <option value={OTHER}>Other (I will write the product name)</option>}
            </select>
            {productId === OTHER && (
              <Input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                maxLength={40}
                placeholder="Write the product name, for example: Midjourney Pro"
              />
            )}
            <p className="text-[11px] text-muted-foreground">Your product is not in the list? Choose Other and write its name.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Package duration or name (you write it)</label>
            <Input
              value={pkgTitle}
              onChange={(e) => setPkgTitle(e.target.value)}
              maxLength={40}
              placeholder="Example: 45 days, 2 months, or Team plan (5 seats)"
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground">Quick fill:</span>
              {DURATIONS.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setPkgTitle(d.label)}
                  className="px-3 py-1 rounded-full text-xs font-semibold border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Your price (Rs)</label>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                maxLength={8}
                placeholder="Example: 600"
              />
              <p className="text-[11px] text-muted-foreground">This is the amount you receive. OrbinexaCSV adds its own fee for the customer.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Delivery time</label>
              <select
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm"
              >
                {DELIVERY_CHOICES.map((c) => (
                  <option key={c.hours} value={c.hours}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <input type="checkbox" checked={warranty} onChange={(e) => setWarranty(e.target.checked)} />
              This package has a warranty
            </label>
            {warranty && (
              <Input
                value={warrantyText}
                onChange={(e) => setWarrantyText(e.target.value)}
                maxLength={80}
                placeholder="Example: 30 days warranty, free replacement"
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => save()}>
              {busy ? 'Saving...' : editingId ? 'Save changes' : 'Add package'}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!error && rows.length === 0 && !formOpen && (
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          You have no packages yet. Press Add a package to start selling.
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {r.product_name} ({r.title})
                </span>
                <Badge variant={r.status === 'active' ? 'nonAi' : 'category'}>{r.status === 'active' ? 'Live' : 'Paused'}</Badge>
                {r.has_warranty && (
                  <Badge variant="nonAi">
                    <ShieldCheck className="h-3 w-3" /> {r.warranty_text || 'Warranty'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Your price {money(r.vendor_price)} | Delivery within {r.delivery_hours < 24 ? r.delivery_hours + ' h' : Math.round(r.delivery_hours / 24) + ' day(s)'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => startEdit(r)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => save({ row: r, status: r.status === 'active' ? 'paused' : 'active' })}
              >
                {r.status === 'active' ? 'Pause' : 'Make live'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
