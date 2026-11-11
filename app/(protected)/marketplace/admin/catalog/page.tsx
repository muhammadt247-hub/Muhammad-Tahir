'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { MARKETPLACE_ENABLED, formatPkr } from '@/lib/marketplace/shared';

interface Product {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  status: string;
}

interface VendorPrivate {
  whatsapp: string | null;
  notes: string | null;
}

interface Vendor {
  id: string;
  name: string;
  slug: string;
  about: string | null;
  status: string;
  verified: boolean;
  mp_vendor_private: VendorPrivate | VendorPrivate[] | null;
}

interface Listing {
  id: string;
  vendor_id: string;
  product_id: string;
  title: string;
  price: number | string;
  delivery_hours: number;
  status: string;
  has_warranty?: boolean | null;
  warranty_text?: string | null;
  description?: string | null;
  mp_listing_costs: { vendor_price: number | string } | { vendor_price: number | string }[] | null;
}

type Tab = 'listings' | 'products' | 'vendors';

const SELECT_CLASS = 'h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm';

function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'item';
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

function firstOf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

// One package of a vendor, with fields the admin can fix by hand
function PackageEditor({ l, productLabel, onSaved }: { l: Listing; productLabel: string; onSaved: () => void }) {
  const cost = firstOf(l.mp_listing_costs);
  const [title, setTitle] = useState(l.title);
  const [hasWarranty, setHasWarranty] = useState(!!l.has_warranty);
  const [warrantyText, setWarrantyText] = useState(l.warranty_text ?? '');
  const [hours, setHours] = useState(String(l.delivery_hours));
  const [vendorPrice, setVendorPrice] = useState(cost ? String(Math.round(Number(cost.vendor_price))) : '');
  const [status, setStatus] = useState(l.status);
  const [details, setDetails] = useState(l.description ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const t = title.trim();
    const h = Number(hours);
    if (t.length < 2) return toast.error('Package name is too short.');
    if (!h || h < 1) return toast.error('Delivery hours must be 1 or more.');
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from('mp_listings')
        .update({
          title: t,
          has_warranty: hasWarranty,
          warranty_text: hasWarranty ? warrantyText.trim() || null : null,
          description: details.trim() || null,
          delivery_hours: h,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', l.id);
      if (err) throw new Error(err.message);
      const vp = Number(vendorPrice);
      if (vendorPrice !== '' && vp > 0 && (!cost || Math.round(Number(cost.vendor_price)) !== Math.round(vp))) {
        const pr = await supabase.rpc('mp_set_listing_price', { p_listing: l.id, p_vendor_price: vp });
        if (pr.error) throw new Error(pr.error.message);
      }
      toast.success('Package saved.');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the package');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background p-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">{productLabel}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-foreground">Package name</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-foreground">Vendor price (Rs)</label>
          <Input value={vendorPrice} onChange={(e) => setVendorPrice(e.target.value)} inputMode="numeric" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-foreground">Delivery hours</label>
          <Input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-foreground">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT_CLASS}>
            <option value="active">active (customers see it)</option>
            <option value="paused">paused (hidden)</option>
            <option value="pending">pending</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-foreground">
        <input type="checkbox" checked={hasWarranty} onChange={(e) => setHasWarranty(e.target.checked)} />
        Has warranty
      </label>
      {hasWarranty && <Input value={warrantyText} onChange={(e) => setWarrantyText(e.target.value)} maxLength={80} placeholder="Warranty text" />}
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-foreground">Package details (customers read this)</label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, 3000))}
          rows={8}
          className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-mono"
        />
      </div>
      <Button size="sm" disabled={saving} onClick={save}>
        {saving ? 'Saving...' : 'Save package'}
      </Button>
    </div>
  );
}

export default function CatalogPage() {
  if (!MARKETPLACE_ENABLED) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-2">
        <h1 className="text-2xl font-extrabold text-foreground">Marketplace</h1>
        <p className="text-sm text-muted-foreground">This page is not available yet.</p>
      </div>
    );
  }
  return <Catalog />;
}

function Catalog() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('listings');
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [openVendors, setOpenVendors] = useState<Record<string, boolean>>({});
  const [alerts, setAlerts] = useState<{ id: string; vendor_id: string; field: string; content: string; reason: string; seen: boolean; created_at: string }[]>([]);
  const [busy, setBusy] = useState(false);

  // product form
  const [pName, setPName] = useState('');
  const [pCategory, setPCategory] = useState('');
  const [pDesc, setPDesc] = useState('');

  // vendor form
  const [vName, setVName] = useState('');
  const [vAbout, setVAbout] = useState('');
  const [vWhatsapp, setVWhatsapp] = useState('');
  const [vNotes, setVNotes] = useState('');
  const [vVerified, setVVerified] = useState(false);

  // listing form
  const [lProduct, setLProduct] = useState('');
  const [lVendor, setLVendor] = useState('');
  const [lTitle, setLTitle] = useState('');
  const [lCost, setLCost] = useState('');
  const [lHours, setLHours] = useState('24');

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
      const [p, v, l] = await Promise.all([
        supabase.from('mp_products').select('id, name, slug, category, description, status').order('name'),
        supabase
          .from('mp_vendors')
          .select('id, name, slug, about, status, verified, mp_vendor_private(whatsapp, notes)')
          .order('name'),
        supabase
          .from('mp_listings')
          .select('id, vendor_id, product_id, title, price, delivery_hours, status, has_warranty, warranty_text, description, mp_listing_costs(vendor_price)')
          .order('created_at', { ascending: false }),
      ]);
      if (p.error) throw new Error(p.error.message);
      if (v.error) throw new Error(v.error.message);
      if (l.error) throw new Error(l.error.message);
      setProducts((p.data ?? []) as Product[]);
      setVendors((v.data ?? []) as unknown as Vendor[]);
      setListings((l.data ?? []) as unknown as Listing[]);
      const al = await supabase
        .from('mp_vendor_alerts')
        .select('id, vendor_id, field, content, reason, seen, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      setAlerts((al.data ?? []) as typeof alerts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // links like /marketplace/admin/catalog?tab=vendors open the Vendors tab directly
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'vendors' || t === 'products' || t === 'listings') setTab(t);
  }, []);

  const productName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of products) m[p.id] = p.name;
    return m;
  }, [products]);

  const vendorName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const v of vendors) m[v.id] = v.name;
    return m;
  }, [vendors]);

  // Runs one action, shows a toast, reloads the lists
  const act = async (okText: string, fn: () => Promise<void>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    try {
      await fn();
      toast.success(okText);
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  };

  // ---------- Products ----------
  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = pName.trim();
    if (name.length < 2) {
      toast.error('Enter the product name.');
      return;
    }
    const ok = await act('Product added', async () => {
      const supabase = createClient();
      const base = slugify(name);
      const row = {
        name,
        category: pCategory.trim() || null,
        description: pDesc.trim() || null,
        status: 'active',
      };
      let res = await supabase.from('mp_products').insert({ ...row, slug: base });
      if (res.error && res.error.code === '23505') {
        res = await supabase.from('mp_products').insert({ ...row, slug: base + '-' + randomSuffix() });
      }
      if (res.error) throw new Error(res.error.message);
    });
    if (ok) {
      setPName('');
      setPCategory('');
      setPDesc('');
    }
  };

  const setProductStatus = (p: Product, status: 'active' | 'hidden') =>
    act(p.name + ' is now ' + status, async () => {
      const { error: err } = await createClient().from('mp_products').update({ status }).eq('id', p.id);
      if (err) throw new Error(err.message);
    });

  // ---------- Vendors ----------
  const addVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = vName.trim();
    if (name.length < 2) {
      toast.error('Enter the vendor name.');
      return;
    }
    const ok = await act('Vendor added', async () => {
      const supabase = createClient();
      const base = slugify(name);
      const row = {
        name,
        about: vAbout.trim() || null,
        status: 'approved',
        verified: vVerified,
      };
      let res = await supabase.from('mp_vendors').insert({ ...row, slug: base }).select('id').single();
      if (res.error && res.error.code === '23505') {
        res = await supabase
          .from('mp_vendors')
          .insert({ ...row, slug: base + '-' + randomSuffix() })
          .select('id')
          .single();
      }
      if (res.error || !res.data) throw new Error(res.error?.message ?? 'Could not add the vendor');
      const priv = await supabase.from('mp_vendor_private').insert({
        vendor_id: res.data.id,
        whatsapp: vWhatsapp.trim() || null,
        notes: vNotes.trim() || null,
      });
      if (priv.error) throw new Error(priv.error.message);
    });
    if (ok) {
      setVName('');
      setVAbout('');
      setVWhatsapp('');
      setVNotes('');
      setVVerified(false);
    }
  };

  const setVendorStatus = (v: Vendor, status: 'approved' | 'suspended') =>
    act(v.name + ' is now ' + status, async () => {
      const { error: err } = await createClient().from('mp_vendors').update({ status }).eq('id', v.id);
      if (err) throw new Error(err.message);
    });

  const toggleVerified = (v: Vendor) =>
    act(v.name + (v.verified ? ' is no longer verified' : ' is now verified'), async () => {
      const { error: err } = await createClient().from('mp_vendors').update({ verified: !v.verified }).eq('id', v.id);
      if (err) throw new Error(err.message);
    });

  // ---------- Listings ----------
  const addListing = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = Number(lCost);
    const hours = Number(lHours);
    if (!lProduct || !lVendor) {
      toast.error('Choose a product and a vendor.');
      return;
    }
    if (lTitle.trim().length < 1) {
      toast.error('Enter the package title, for example 1 month.');
      return;
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      toast.error('Enter the vendor price.');
      return;
    }
    if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
      toast.error('Delivery hours must be between 1 and 720.');
      return;
    }
    const ok = await act('Package added', async () => {
      const supabase = createClient();
      const ins = await supabase
        .from('mp_listings')
        .insert({
          vendor_id: lVendor,
          product_id: lProduct,
          title: lTitle.trim(),
          price: 0,
          delivery_hours: hours,
          status: 'active',
        })
        .select('id')
        .single();
      if (ins.error || !ins.data) {
        const dup = ins.error?.code === '23505';
        throw new Error(dup ? 'This vendor already has a package with that title.' : ins.error?.message ?? 'Could not add');
      }
      const priced = await supabase.rpc('mp_set_listing_price', { p_listing: ins.data.id, p_vendor_price: cost });
      if (priced.error) {
        // do not leave a package without a price
        await supabase.from('mp_listings').delete().eq('id', ins.data.id);
        throw new Error(priced.error.message);
      }
    });
    if (ok) {
      setLTitle('');
      setLCost('');
    }
  };

  const changePrice = async (l: Listing) => {
    const input = window.prompt('New vendor price (Rs) for ' + l.title + ':');
    if (input === null) return;
    const cost = Number(input);
    if (!Number.isFinite(cost) || cost <= 0) {
      toast.error('Enter a number bigger than 0.');
      return;
    }
    await act('Price updated', async () => {
      const { error: err } = await createClient().rpc('mp_set_listing_price', {
        p_listing: l.id,
        p_vendor_price: cost,
      });
      if (err) throw new Error(err.message);
    });
  };

  const setListingStatus = (l: Listing, status: 'active' | 'paused') =>
    act('Package is now ' + status, async () => {
      const { error: err } = await createClient().from('mp_listings').update({ status }).eq('id', l.id);
      if (err) throw new Error(err.message);
    });

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 pb-12">
        <Skeleton className="h-10 w-64" />
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

  const previewCost = Number(lCost);
  const previewPrice = Number.isFinite(previewCost) && previewCost > 0 ? Math.ceil(previewCost * 1.05) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Marketplace catalog</h1>
        <Link
          href="/marketplace/admin"
          className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to orders
        </Link>
      </div>

      {error && <p className="text-xs font-semibold text-red-600 break-words">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['listings', 'Packages and prices'],
            ['products', 'Products'],
            ['vendors', 'Vendors'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ' +
              (tab === key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* ---------------- PACKAGES AND PRICES ---------------- */}
      {tab === 'listings' && (
        <div className="space-y-6">
          <form
            onSubmit={addListing}
            className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm space-y-4"
          >
            <h2 className="text-lg font-bold text-foreground">Add a package</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Product</label>
                <select className={SELECT_CLASS} value={lProduct} onChange={(e) => setLProduct(e.target.value)}>
                  <option value="">Choose...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Vendor</label>
                <select className={SELECT_CLASS} value={lVendor} onChange={(e) => setLVendor(e.target.value)}>
                  <option value="">Choose...</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Package title</label>
                <Input
                  value={lTitle}
                  onChange={(e) => setLTitle(e.target.value)}
                  placeholder="1 month"
                  maxLength={80}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Vendor price (Rs)</label>
                <Input
                  value={lCost}
                  onChange={(e) => setLCost(e.target.value)}
                  placeholder="600"
                  inputMode="decimal"
                  maxLength={12}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Delivery time (hours)</label>
                <Input
                  value={lHours}
                  onChange={(e) => setLHours(e.target.value)}
                  inputMode="numeric"
                  maxLength={3}
                />
              </div>
              <div className="flex items-end text-sm text-muted-foreground">
                {previewPrice !== null ? (
                  <span>
                    Customer will pay about{' '}
                    <span className="font-bold text-foreground">{formatPkr(previewPrice)}</span> (your commission
                    included)
                  </span>
                ) : (
                  <span>The customer price is worked out for you.</span>
                )}
              </div>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving...' : 'Add package'}
            </Button>
          </form>

          <div className="space-y-3">
            {listings.length === 0 && (
              <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
                No packages yet.
              </div>
            )}
            {listings.map((l) => {
              const cost = firstOf(l.mp_listing_costs);
              const costNum = cost ? Number(cost.vendor_price) : null;
              return (
                <div
                  key={l.id}
                  className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {productName[l.product_id] ?? 'Product'} ({l.title})
                      </span>
                      <Badge variant={l.status === 'active' ? 'nonAi' : 'category'}>{l.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Vendor: {vendorName[l.vendor_id] ?? 'Vendor'} | Delivery: {l.delivery_hours}h
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vendor price {costNum !== null ? formatPkr(costNum) : '-'} | Customer price{' '}
                      <span className="font-bold text-foreground">{formatPkr(Number(l.price))}</span>
                      {costNum !== null && <> | Your commission {formatPkr(Number(l.price) - costNum)}</>}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => changePrice(l)}>
                      Change price
                    </Button>
                    {l.status === 'active' ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setListingStatus(l, 'paused')}>
                        Pause
                      </Button>
                    ) : (
                      <Button size="sm" disabled={busy} onClick={() => setListingStatus(l, 'active')}>
                        Activate
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- PRODUCTS ---------------- */}
      {tab === 'products' && (
        <div className="space-y-6">
          <form
            onSubmit={addProduct}
            className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm space-y-4"
          >
            <h2 className="text-lg font-bold text-foreground">Add a product</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Product name</label>
                <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="CapCut Pro" maxLength={80} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Category (optional)</label>
                <Input
                  value={pCategory}
                  onChange={(e) => setPCategory(e.target.value)}
                  placeholder="Video editing"
                  maxLength={60}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-foreground">Short description (optional)</label>
                <Input value={pDesc} onChange={(e) => setPDesc(e.target.value)} maxLength={300} />
              </div>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving...' : 'Add product'}
            </Button>
          </form>

          <div className="space-y-3">
            {products.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{p.name}</span>
                    {p.category && <Badge variant="category">{p.category}</Badge>}
                    <Badge variant={p.status === 'active' ? 'nonAi' : 'category'}>{p.status}</Badge>
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                </div>
                {p.status === 'active' ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setProductStatus(p, 'hidden')}>
                    Hide
                  </Button>
                ) : (
                  <Button size="sm" disabled={busy} onClick={() => setProductStatus(p, 'active')}>
                    Show
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- VENDORS ---------------- */}
      {tab === 'vendors' && (
        <div className="space-y-6">
          {alerts.length > 0 && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-foreground">Vendor warnings</h2>
                {alerts.some((a) => !a.seen) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const supabase = createClient();
                      const { error: err } = await supabase.from('mp_vendor_alerts').update({ seen: true }).eq('seen', false);
                      if (err) return toast.error(err.message);
                      toast.success('Marked as seen.');
                      load();
                    }}
                  >
                    Mark all as seen
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">These vendors tried to write contact details or a real name. It was blocked and not saved.</p>
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    title="Click to see this vendor and edit his packages"
                    onClick={() => {
                      setOpenVendors((o) => ({ ...o, [a.vendor_id]: true }));
                      setTimeout(() => document.getElementById('vendor-' + a.vendor_id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.currentTarget as HTMLElement).click();
                    }}
                    className={'cursor-pointer hover:bg-accent/40 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm ' + (a.seen ? 'opacity-60' : '')}
                  >
                    <span className="font-bold">{vendors.find((v) => v.id === a.vendor_id)?.name ?? 'Vendor'}</span>
                    {' tried to write '}
                    <span className="font-semibold">{a.reason}</span>
                    {' in '}
                    <span className="font-semibold">{a.field.replace('_', ' ')}</span>
                    {': '}
                    <span className="break-all">&quot;{a.content}&quot;</span>
                    <span className="block text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString()} · tap to open this vendor</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <form
            onSubmit={addVendor}
            className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm space-y-4"
          >
            <h2 className="text-lg font-bold text-foreground">Add a vendor</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Vendor name (customers see this)</label>
                <Input value={vName} onChange={(e) => setVName(e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">About (customers see this, optional)</label>
                <Input value={vAbout} onChange={(e) => setVAbout(e.target.value)} maxLength={300} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Vendor WhatsApp (only you see this)</label>
                <Input value={vWhatsapp} onChange={(e) => setVWhatsapp(e.target.value)} maxLength={30} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Private notes (only you see this)</label>
                <Input value={vNotes} onChange={(e) => setVNotes(e.target.value)} maxLength={500} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={vVerified} onChange={(e) => setVVerified(e.target.checked)} />
              Verified vendor
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving...' : 'Add vendor'}
            </Button>
          </form>

          <div className="space-y-3">
            {[...vendors]
              .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'))
              .map((v) => {
              const priv = firstOf(v.mp_vendor_private);
              const isOpen = !!openVendors[v.id];
              const vListings = listings.filter((x) => x.vendor_id === v.id);
              const vAlerts = alerts.filter((x) => x.vendor_id === v.id);
              return (
                <div
                  key={v.id}
                  id={'vendor-' + v.id}
                  className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm space-y-3"
                >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{v.name}</span>
                      <Badge variant={v.status === 'approved' ? 'nonAi' : 'category'}>{v.status}</Badge>
                      {v.verified && <Badge variant="ai">Verified</Badge>}
                    </div>
                    {v.about && <p className="text-xs text-muted-foreground">{v.about}</p>}
                    {priv?.whatsapp && <p className="text-xs text-muted-foreground">WhatsApp: {priv.whatsapp}</p>}
                    {priv?.notes && <p className="text-xs text-muted-foreground break-words">Notes: {priv.notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setOpenVendors((o) => ({ ...o, [v.id]: !o[v.id] }))}>
                      {isOpen ? 'Hide details' : v.status === 'pending' ? 'Read full request' : 'View details'}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => toggleVerified(v)}>
                      {v.verified ? 'Remove verified' : 'Make verified'}
                    </Button>
                    {v.status === 'approved' ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setVendorStatus(v, 'suspended')}>
                        Suspend
                      </Button>
                    ) : (
                      <Button size="sm" disabled={busy} onClick={() => setVendorStatus(v, 'approved')}>
                        Approve
                      </Button>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-foreground">Full request (only you see this)</h3>
                      <p className="text-xs text-muted-foreground">Public name customers see: <span className="font-semibold text-foreground">{v.name}</span></p>
                      <p className="text-xs text-muted-foreground">Status: <span className="font-semibold text-foreground">{v.status}</span>{v.verified ? ' · Verified' : ''}</p>
                      {priv?.whatsapp && <p className="text-xs text-muted-foreground">WhatsApp: <span className="font-semibold text-foreground">{priv.whatsapp}</span></p>}
                      {v.about && <p className="text-xs text-muted-foreground">About (public): {v.about}</p>}
                      {priv?.notes ? (
                        <p className="text-xs text-foreground whitespace-pre-line break-words rounded-lg bg-background border border-border/60 p-2">{priv.notes}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No private notes.</p>
                      )}
                    </div>
                    {vAlerts.length > 0 && (
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-foreground">Warnings for this vendor ({vAlerts.length})</h3>
                        {vAlerts.map((a) => (
                          <p key={a.id} className="text-xs text-foreground break-words rounded-lg bg-red-500/10 p-2">
                            <span className="font-semibold">{a.field.replace('_', ' ')}</span> ({a.reason}): &quot;{a.content}&quot;
                            <span className="block text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-foreground">Packages of this vendor ({vListings.length})</h3>
                      {vListings.length === 0 && <p className="text-xs text-muted-foreground">No packages yet.</p>}
                      {vListings.map((l) => (
                        <PackageEditor key={l.id + l.title + l.status} l={l} productLabel={productName[l.product_id] ?? 'Product'} onSaved={load} />
                      ))}
                    </div>
                  </div>
                )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
