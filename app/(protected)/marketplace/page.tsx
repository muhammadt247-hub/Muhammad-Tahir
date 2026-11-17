'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, ShieldCheck, Star, Store, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { RichDescription } from '@/components/marketplace/RichDescription';
import { detailsSummary } from '@/components/marketplace/PackageDetailsForm';
import { StatusStrip } from '@/components/marketplace/StatusStrip';
import { OrderDialog } from '@/components/marketplace/OrderDialog';
import { SearchBox } from '@/components/marketplace/SearchBox';
import { useDebounced } from '@/lib/marketplace/use-debounced';
import { Breadcrumbs } from '@/components/marketplace/Breadcrumbs';
import {
  matchesQuery,
  byPriceAsc,
  sortVendors,
  VENDOR_SORT_OPTIONS,
  VendorSortKey,
  VendorSummary,
} from '@/lib/marketplace/search';
import {
  MARKETPLACE_ENABLED,
  MpProduct,
  MpListing,
  RawListingRow,
  SortKey,
  VendorScore,
  VendorReview,
  toListing,
  formatPkr,
  formatHours,
  sortListings,
  getBadges,
} from '@/lib/marketplace/shared';


const PAGE_SIZE = 24;

type VendorRow = { id: string; name: string; verified: boolean; about: string | null };

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'price', label: 'Lowest price' },
  { key: 'speed', label: 'Fastest delivery' },
  { key: 'rating', label: 'Best rated' },
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
  const [ordering, setOrdering] = useState<MpListing | null>(null);
  const [scores, setScores] = useState<Record<string, VendorScore>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [vendorStatus, setVendorStatus] = useState<string | null>(null);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [tab, setTab] = useState<'packages' | 'vendors'>('packages');
  const [vendorQuery, setVendorQuery] = useState('');
  const [vendorSort, setVendorSort] = useState<VendorSortKey>('price_asc');
  const [openVendorId, setOpenVendorId] = useState<string | null>(null);
  const [focusListing, setFocusListing] = useState<string | null>(null);
  const [offerMore, setOfferMore] = useState({ key: '', n: PAGE_SIZE });
  const [vendorMore, setVendorMore] = useState({ key: '', n: PAGE_SIZE });
  const dq = useDebounced(query);
  const dvq = useDebounced(vendorQuery);

  // Who is looking at this page? Admin and vendors get their own buttons.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const adminCheck = await supabase.rpc('mp_is_admin');
        if (!cancelled && adminCheck.data === true) setIsAdmin(true);
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (uid) {
          const { data: v } = await supabase.from('mp_vendors').select('status').eq('owner_id', uid).maybeSingle();
          if (!cancelled && v) setVendorStatus((v as { status: string }).status);
        }
      } catch {
        // the buttons are a convenience, the page works without them
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [openReviews, setOpenReviews] = useState<string | null>(null);
  const [openDetails, setOpenDetails] = useState<string | null>(null);
  const [reviewList, setReviewList] = useState<VendorReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const toggleReviews = async (vendorId: string) => {
    if (openReviews === vendorId) {
      setOpenReviews(null);
      return;
    }
    setOpenReviews(vendorId);
    setReviewList([]);
    setReviewsLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.rpc('mp_vendor_reviews', { p_vendor: vendorId, p_limit: 10 });
      setReviewList((data ?? []) as VendorReview[]);
    } catch {
      setReviewList([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const [p, l, v] = await Promise.all([
          supabase
            .from('mp_products')
            .select('id, name, slug, category, description, image_url')
            .order('name'),
          supabase
            .from('mp_listings')
            .select('id, title, price, status, delivery_hours, vendor_id, product_id, has_warranty, warranty_text, duration_months, description, offer_price, offer_percent, offer_ends_at, mp_vendors(id, name, slug, verified, status)')
            .eq('status', 'active')
            .order('price'),
          supabase.from('mp_vendors').select('id, name, verified, about, status').eq('status', 'approved').order('name'),
        ]);
        if (cancelled) return;
        if (p.error) throw new Error(p.error.message);
        if (l.error) throw new Error(l.error.message);
        setProducts((p.data ?? []) as MpProduct[]);
        // only live packages of approved vendors (admins can read more rows; the shop shows what buyers see)
        setListings(
          ((l.data ?? []) as unknown as RawListingRow[])
            .filter((row) => {
              const vv = (Array.isArray(row.mp_vendors) ? row.mp_vendors[0] : row.mp_vendors) as { status?: string } | null | undefined;
              return !vv?.status || vv.status === 'approved';
            })
            .map(toListing)
        );
        if (!v.error) setVendors((v.data ?? []) as VendorRow[]);
        // Links from the home page sliders: /marketplace?product=..&listing=..  or  ?vendor=..
        try {
          const sp = new URLSearchParams(window.location.search);
          const prod = sp.get('product');
          const lst = sp.get('listing');
          const ven = sp.get('vendor');
          if (prod && (p.data ?? []).some((x) => (x as MpProduct).id === prod)) {
            setSelectedId(prod);
            if (lst) {
              setFocusListing(lst);
              setOpenDetails(lst);
            }
          } else if (ven && (v.data ?? []).some((x) => (x as VendorRow).id === ven)) {
            setTab('vendors');
            setOpenVendorId(ven);
          } else if (sp.get('tab') === 'vendors') {
            setTab('vendors');
          } else if (sp.get('q')) {
            setQuery(sp.get('q')!.slice(0, 80));
          }
        } catch {
          // not important
        }
        // Scores are a bonus: if they fail, the page still works
        try {
          const sc = await supabase.rpc('mp_vendor_scores');
          if (!cancelled && !sc.error) {
            const map: Record<string, VendorScore> = {};
            ((sc.data ?? []) as VendorScore[]).forEach((x) => {
              map[x.vendor_id] = x;
            });
            setScores(map);
          }
        } catch {
          // ignore
        }
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

  // Customers only see products that have at least one vendor package
  // Cheapest first (numbers, not text); products without packages are not shown
  const filteredProducts = useMemo(() => {
    const lowest = (id: string) => Math.min(...(listingsByProduct[id] ?? []).map((l) => Number(l.price)));
    return products
      .filter((p) => (listingsByProduct[p.id] ?? []).length > 0)
      .sort((a, b) => lowest(a.id) - lowest(b.id) || a.name.localeCompare(b.name));
  }, [products, listingsByProduct]);

  const productById = useMemo(() => {
    const map: Record<string, MpProduct> = {};
    for (const p of products) map[p.id] = p;
    return map;
  }, [products]);

  // Tool search: every matching package from every vendor, cheapest first
  const matchingOffers = useMemo(() => {
    const q = dq.trim();
    if (!q) return [];
    return listings
      .filter((l) => {
        const p = productById[l.product_id];
        return !!p && matchesQuery(p.name + ' ' + (p.category ?? '') + ' ' + l.title, q);
      })
      .sort(byPriceAsc);
  }, [dq, listings, productById]);
  const offerLimit = offerMore.key === dq ? offerMore.n : PAGE_SIZE;

  // Vendor list: lowest price comes from the vendor's real live packages
  const vendorSummaries = useMemo<VendorSummary[]>(() => {
    const byVendor: Record<string, MpListing[]> = {};
    for (const l of listings) {
      if (!productById[l.product_id]) continue;
      (byVendor[l.vendor_id] ??= []).push(l);
    }
    return vendors.map((v) => {
      const ls = (byVendor[v.id] ?? []).sort(byPriceAsc);
      const valid = ls.filter((l) => Number.isFinite(Number(l.price)) && Number(l.price) > 0);
      return { id: v.id, name: v.name, verified: v.verified, about: v.about, listings: ls, lowest: valid.length ? Number(valid[0].price) : null };
    });
  }, [vendors, listings, productById]);
  const shownVendors = useMemo(
    () => sortVendors(vendorSummaries.filter((v) => matchesQuery(v.name, dvq)), vendorSort),
    [vendorSummaries, dvq, vendorSort]
  );
  const vendorKey = dvq + '|' + vendorSort;
  const vendorLimit = vendorMore.key === vendorKey ? vendorMore.n : PAGE_SIZE;
  const openVendor = vendorSummaries.find((v) => v.id === openVendorId) ?? null;

  const selected = products.find((p) => p.id === selectedId) ?? null;
  const selectedListings = useMemo(
    () => (selected ? sortListings(listingsByProduct[selected.id] ?? [], sort, scores) : []),
    [selected, listingsByProduct, sort, scores]
  );
  const badges = useMemo(() => getBadges(selectedListings), [selectedListings]);


  useEffect(() => {
    if (!selectedId || !focusListing) return;
    const t = setTimeout(() => {
      document.getElementById('listing-' + focusListing)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => clearTimeout(t);
  }, [selectedId, focusListing]);

  const viewListing = (l: MpListing) => {
    setSelectedId(l.product_id);
    setFocusListing(l.id);
    setOpenDetails(l.id);
  };

  const switchTab = (t: 'packages' | 'vendors') => {
    setTab(t);
    setOpenVendorId(null);
    try {
      window.history.replaceState(null, '', t === 'vendors' ? '/marketplace?tab=vendors' : '/marketplace');
    } catch {
      // not important
    }
  };

  const backToShop = () => {
    setSelectedId(null);
    setFocusListing(null);
    try {
      if (window.location.search) window.history.replaceState(null, '', '/marketplace');
    } catch {
      // not important
    }
  };

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
        <Breadcrumbs items={[{ label: 'Marketplace', onClick: backToShop }, { label: selected.name }]} />
        <button
          type="button"
          onClick={backToShop}
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
                id={'listing-' + l.id}
                className={
                  'rounded-2xl border bg-card p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 scroll-mt-24 ' +
                  (focusListing === l.id ? 'border-primary ring-2 ring-primary/40' : 'border-border/60')
                }
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
                    {l.has_warranty && (
                      <Badge variant="nonAi">
                        <ShieldCheck className="h-3 w-3" /> {l.warranty_text ? l.warranty_text : 'Warranty included'}
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
                    {(() => {
                      const sc = scores[l.vendor_id];
                      if (!sc) return <span>New vendor, no ratings yet</span>;
                      return (
                        <>
                          {sc.review_count > 0 && sc.avg_rating !== null ? (
                            <button
                              type="button"
                              onClick={() => toggleReviews(l.vendor_id)}
                              className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline"
                            >
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              {Number(sc.avg_rating).toFixed(1)} ({sc.review_count}{' '}
                              {sc.review_count === 1 ? 'review' : 'reviews'})
                            </button>
                          ) : (
                            <span>No ratings yet</span>
                          )}
                          {sc.is_new ? (
                            <span className="font-semibold text-amber-600">New vendor</span>
                          ) : (
                            sc.score !== null && (
                              <span className="font-semibold text-foreground">Score {Math.round(Number(sc.score))}/100</span>
                            )
                          )}
                        </>
                      );
                    })()}
                  </div>
                  {detailsSummary(l.description) && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{detailsSummary(l.description)}</p>
                  )}
                  {l.description && (
                    <button
                      type="button"
                      onClick={() => setOpenDetails(openDetails === l.id ? null : l.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
                    >
                      {openDetails === l.id ? 'Hide package details' : 'See full package details'}
                    </button>
                  )}
                  {l.description && openDetails === l.id && (
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                      <RichDescription text={l.description} />
                    </div>
                  )}
                  {openReviews === l.vendor_id && (
                    <div className="rounded-xl bg-muted/40 p-3 space-y-2">
                      {reviewsLoading && <p className="text-xs text-muted-foreground">Loading reviews...</p>}
                      {!reviewsLoading && reviewList.length === 0 && (
                        <p className="text-xs text-muted-foreground">No reviews yet.</p>
                      )}
                      {reviewList.map((r, i) => (
                        <div key={i} className="text-xs">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                className={'h-3 w-3 ' + (n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')}
                              />
                            ))}
                            <span className="ml-1 font-semibold text-foreground">{r.customer_label ?? 'Customer'}</span>
                          </div>
                          {r.comment && <p className="text-muted-foreground break-words">{r.comment}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                  <div className="text-right">
                    {l.offer_percent !== null && l.original_price !== null && (
                      <div className="mb-0.5 flex items-center justify-end gap-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{l.offer_percent}% OFF</span>
                        <span className="text-xs font-medium text-muted-foreground line-through">{formatPkr(l.original_price)}</span>
                      </div>
                    )}
                    <div className="text-xl font-extrabold text-foreground">{formatPkr(l.price)}</div>
                    {l.offer_ends_at && (
                      <div className="text-[11px] text-muted-foreground">
                        Offer ends {new Date(l.offer_ends_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    )}
                  </div>
                  <Button size="sm" onClick={() => setOrdering(l)}>
                    Order
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {ordering && (
          <OrderDialog listing={ordering} productName={selected.name} onClose={() => setOrdering(null)} />
        )}
      </div>
    );
  }

  // ---------- Home view: all packages ----------
  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="space-y-3">
        <Breadcrumbs
          items={
            tab === 'vendors'
              ? openVendor
                ? [
                    { label: 'Marketplace', onClick: () => switchTab('packages') },
                    { label: 'Vendors', onClick: () => setOpenVendorId(null) },
                    { label: openVendor.name },
                  ]
                : [{ label: 'Marketplace', onClick: () => switchTab('packages') }, { label: 'Vendors' }]
              : [{ label: 'Marketplace', onClick: () => setQuery('') }, { label: 'Tools & packages' }]
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">Marketplace</h1>
          <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/generator"
            className="inline-flex h-9 items-center rounded-lg border border-border/60 px-4 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
          >
            CSV Generator
          </Link>
          <Link
            href="/marketplace/orders"
            className="inline-flex h-9 items-center rounded-lg border border-border/60 px-4 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
          >
            My orders
          </Link>
          <Link
            href="/marketplace/vendor"
            className="inline-flex h-9 items-center rounded-lg border border-border/60 px-4 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
          >
            {vendorStatus === null ? 'Become a vendor' : vendorStatus === 'approved' ? 'My vendor page' : 'My vendor application'}
          </Link>
          {isAdmin && (
            <>
              <Link
                href="/marketplace/admin"
                className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Admin orders
              </Link>
              <Link
                href="/marketplace/admin/catalog"
                className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Catalog
              </Link>
            </>
          )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Compare trusted vendors for AI tools and digital subscriptions. You pay only through OrbinexaCSV,
          and we check every delivery before it reaches you.
        </p>
      </div>

      <StatusStrip onOpenProduct={openProduct} />

      <div role="tablist" aria-label="Browse" className="inline-flex rounded-xl border border-border/60 bg-card p-1">
        {(['packages', 'vendors'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => switchTab(t)}
            className={
              'rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ' +
              (tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')
            }
          >
            {t === 'packages' ? 'Tools & packages' : 'Vendors'}
          </button>
        ))}
      </div>

      {tab === 'vendors' ? (
        openVendor ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setOpenVendorId(null)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> All vendors
            </button>
            <div className="space-y-1">
              <h2 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold text-foreground">
                {openVendor.name}
                {openVendor.verified && (
                  <Badge variant="nonAi">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </Badge>
                )}
              </h2>
              {openVendor.about && <p className="text-sm text-muted-foreground break-words">{openVendor.about}</p>}
              <p className="text-xs text-muted-foreground">
                {openVendor.listings.length} {openVendor.listings.length === 1 ? 'package' : 'packages'}, cheapest first
              </p>
            </div>
            {openVendor.listings.length === 0 ? (
              <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
                This vendor has no packages right now.
              </div>
            ) : (
              <div className="space-y-3">
                {openVendor.listings.map((l) => (
                  <OfferRow
                    key={l.id}
                    listing={l}
                    productName={productById[l.product_id]?.name ?? l.title}
                    onView={() => viewListing(l)}
                    onOrder={() => setOrdering(l)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchBox
                value={vendorQuery}
                onChange={setVendorQuery}
                placeholder="Search vendors by name..."
                label="Search vendors"
                className="sm:max-w-md"
              />
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                Sort by
                <select
                  value={vendorSort}
                  onChange={(e) => setVendorSort(e.target.value as VendorSortKey)}
                  className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground sm:flex-none"
                >
                  {VENDOR_SORT_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {shownVendors.length === 0 ? (
              <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
                {dvq.trim() ? <>No vendors match &quot;{dvq.trim()}&quot;. Try another name or clear the search.</> : 'No vendors yet.'}
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {shownVendors.slice(0, vendorLimit).map((v) => {
                    const sc = scores[v.id];
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setOpenVendorId(v.id)}
                        className="text-left rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="inline-flex items-center gap-1.5 text-lg font-bold text-foreground">
                            <Store className="h-4 w-4 text-muted-foreground" /> {v.name}
                          </h3>
                          {v.verified && (
                            <Badge variant="nonAi">
                              <ShieldCheck className="h-3 w-3" /> Verified
                            </Badge>
                          )}
                        </div>
                        {v.about && <p className="text-xs text-muted-foreground line-clamp-2 break-words">{v.about}</p>}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {v.listings.length} {v.listings.length === 1 ? 'package' : 'packages'}
                          </span>
                          {sc && sc.review_count > 0 && sc.avg_rating !== null && (
                            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {Number(sc.avg_rating).toFixed(1)}
                            </span>
                          )}
                          {(!sc || sc.is_new) && <span className="font-semibold text-amber-600">New vendor</span>}
                        </div>
                        <div className="pt-1 text-sm font-bold text-foreground">
                          {v.lowest !== null ? (
                            <>From {formatPkr(v.lowest)}</>
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground">No packages right now</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {shownVendors.length > vendorLimit && (
                  <div className="text-center">
                    <Button variant="outline" onClick={() => setVendorMore({ key: vendorKey, n: vendorLimit + PAGE_SIZE })}>
                      Show more vendors
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )
      ) : (
        <>
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search tools, e.g. ChatGPT, Canva, CapCut..."
            label="Search tools"
            className="max-w-xl"
          />
          {dq.trim() ? (
            matchingOffers.length === 0 ? (
              <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
                No tools match &quot;{dq.trim()}&quot;. Check the spelling, try a shorter name, or clear the search.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  {matchingOffers.length} {matchingOffers.length === 1 ? 'offer' : 'offers'} from all vendors · cheapest first
                </p>
                {matchingOffers.slice(0, offerLimit).map((l, i) => (
                  <OfferRow
                    key={l.id}
                    listing={l}
                    productName={productById[l.product_id]?.name ?? l.title}
                    cheapest={
                      i === 0 &&
                      matchingOffers.length > 1 &&
                      Number(l.price) < Number(matchingOffers[matchingOffers.length - 1].price)
                    }
                    onView={() => viewListing(l)}
                    onOrder={() => setOrdering(l)}
                  />
                ))}
                {matchingOffers.length > offerLimit && (
                  <div className="text-center">
                    <Button variant="outline" onClick={() => setOfferMore({ key: dq, n: offerLimit + PAGE_SIZE })}>
                      Show more offers
                    </Button>
                  </div>
                )}
              </div>
            )
          ) : filteredProducts.length === 0 ? (
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
                    <span className="text-sm font-bold text-foreground">
                      {list.some((x) => x.offer_percent !== null) && (
                        <span className="mr-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Offer</span>
                      )}
                      From {formatPkr(lowest)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No offers yet</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
        </>
      )}

      {ordering && (
        <OrderDialog
          listing={ordering}
          productName={productById[ordering.product_id]?.name ?? ordering.title}
          onClose={() => setOrdering(null)}
        />
      )}
    </div>
  );
}

// One package in search results or on a vendor's page
function OfferRow({
  listing: l,
  productName,
  cheapest = false,
  onView,
  onOrder,
}: {
  listing: MpListing;
  productName: string;
  cheapest?: boolean;
  onView: () => void;
  onOrder: () => void;
}) {
  const summary = detailsSummary(l.description);
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold text-foreground">{productName}</span>
          {cheapest && <Badge variant="ai">Lowest price</Badge>}
          {l.has_warranty && (
            <Badge variant="nonAi">
              <ShieldCheck className="h-3 w-3" /> {l.warranty_text ? l.warranty_text : 'Warranty included'}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            <Store className="h-3.5 w-3.5 text-muted-foreground" /> {l.vendor?.name ?? 'Vendor'}
            {l.vendor?.verified && <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-label="Verified" />}
          </span>
          <span className="inline-flex items-center gap-1">
            <Tag className="h-3.5 w-3.5" /> {l.title}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Delivery within {formatHours(l.delivery_hours)}
          </span>
        </div>
        {summary && <p className="text-sm text-muted-foreground line-clamp-2 break-words">{summary}</p>}
      </div>
      <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
        <div className="text-right">
          {l.offer_percent !== null && l.original_price !== null && (
            <div className="mb-0.5 flex items-center justify-end gap-2">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{l.offer_percent}% OFF</span>
              <span className="text-xs font-medium text-muted-foreground line-through">{formatPkr(l.original_price)}</span>
            </div>
          )}
          <div className="text-xl font-extrabold text-foreground">{formatPkr(l.price)}</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onView}>
            View details
          </Button>
          <Button size="sm" onClick={onOrder}>
            Order
          </Button>
        </div>
      </div>
    </div>
  );
}
