'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock, Search, ShieldCheck, Store, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import {
  MARKETPLACE_ENABLED,
  MpProduct,
  MpListing,
  RawListingRow,
  SortKey,
  toListing,
  formatPkr,
  formatHours,
  sortListings,
  getBadges,
} from '@/lib/marketplace/shared';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'price', label: 'Lowest price' },
  { key: 'speed', label: 'Fastest delivery' },
  { key: 'verified', label: 'Verified first' },
];

export default function MarketplacePage() {
  if (!MARKETPLACE_ENABLED) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-2">
        <h1 className="text-2xl font-extrabold text-foreground">Marketplace</h1>
        <p className="text-sm text-muted-foreground">This page is not available yet.</p>
      </div>
    );
  }
  return <MarketplaceHome />;
}

function MarketplaceHome() {
  const [products, setProducts] = useState<MpProduct[]>([]);
  const [listings, setListings] = useState<MpListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('price');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const [p, l] = await Promise.all([
          supabase
            .from('mp_products')
            .select('id, name, slug, category, description, image_url')
            .order('name'),
          supabase
            .from('mp_listings')
            .select('id, title, price, delivery_hours, vendor_id, product_id, mp_vendors(id, name, slug, verified)')
            .order('price'),
        ]);
        if (cancelled) return;
        if (p.error) throw new Error(p.error.message);
        if (l.error) throw new Error(l.error.message);
        setProducts((p.data ?? []) as MpProduct[]);
        setListings(((l.data ?? []) as unknown as RawListingRow[]).map(toListing));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the marketplace');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const listingsByProduct = useMemo(() => {
    const map: Record<string, MpListing[]> = {};
    for (const l of listings) {
      if (!map[l.product_id]) map[l.product_id] = [];
      map[l.product_id].push(l);
    }
    return map;
  }, [listings]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q)
    );
  }, [products, query]);

  const selected = products.find((p) => p.id === selectedId) ?? null;
  const selectedListings = useMemo(
    () => (selected ? sortListings(listingsByProduct[selected.id] ?? [], sort) : []),
    [selected, listingsByProduct, sort]
  );
  const badges = useMemo(() => getBadges(selectedListings), [selectedListings]);

  const openProduct = (id: string) => {
    setSelectedId(id);
    try {
      window.scrollTo({ top: 0 });
    } catch {
      // not important
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-2">
        <h1 className="text-xl font-extrabold text-foreground">Could not load the marketplace</h1>
        <p className="text-sm text-muted-foreground break-words">{error}</p>
      </div>
    );
  }

  // ---------- Compare view: all vendors for one product ----------
  if (selected) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> All packages
        </button>

        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{selected.name}</h1>
          {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Sort by</span>
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setSort(o.key)}
              className={
                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ' +
                (sort === o.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent')
              }
            >
              {o.label}
            </button>
          ))}
        </div>

        {selectedListings.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
            No vendors are offering this package yet.
          </div>
        ) : (
          <div className="space-y-3">
            {selectedListings.map((l) => (
              <div
                key={l.id}
                className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-base font-bold text-foreground">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      {l.vendor?.name ?? 'Vendor'}
                    </span>
                    {l.vendor?.verified && (
                      <Badge variant="nonAi">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </Badge>
                    )}
                    {(badges[l.id] ?? []).map((b) => (
                      <Badge key={b} variant="ai">
                        {b}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" /> {l.title}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Delivery within {formatHours(l.delivery_hours)}
                    </span>
                    <span>New vendor, no ratings yet</span>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                  <div className="text-xl font-extrabold text-foreground">{formatPkr(l.price)}</div>
                  <Button
                    size="sm"
                    onClick={() => toast.info('Ordering opens in the next step of the build.')}
                  >
                    Order
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------- Home view: all packages ----------
  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">Marketplace</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Compare trusted vendors for AI tools and digital subscriptions. You pay only through OrbinexaCSV,
          and we check every delivery before it reaches you.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search packages..."
          className="pl-9"
        />
      </div>

      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
          No packages found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((p) => {
            const list = listingsByProduct[p.id] ?? [];
            const lowest = list.length > 0 ? Math.min(...list.map((l) => l.price)) : null;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => openProduct(p.id)}
                className="text-left rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-bold text-foreground">{p.name}</h2>
                  {p.category && <Badge variant="category">{p.category}</Badge>}
                </div>
                {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    {list.length} {list.length === 1 ? 'vendor' : 'vendors'}
                  </span>
                  {lowest !== null ? (
                    <span className="text-sm font-bold text-foreground">From {formatPkr(lowest)}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No offers yet</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
