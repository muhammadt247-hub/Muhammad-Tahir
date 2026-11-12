// OrbinexaCSV Marketplace: helpers shared by the marketplace pages.

// The marketplace only shows when this setting is exactly "true".
// On the live site the setting is not set, so the page stays hidden.
export const MARKETPLACE_ENABLED = process.env.NEXT_PUBLIC_MARKETPLACE_ENABLED === 'true';

export interface MpProduct {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  image_url: string | null;
}

export interface MpVendorInfo {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
}

export interface MpListing {
  id: string;
  title: string;
  price: number;
  delivery_hours: number;
  vendor_id: string;
  product_id: string;
  has_warranty: boolean;
  warranty_text: string | null;
  duration_months: number | null;
  description: string | null;
  // set only while an offer is running: price is the offer price, original_price the normal one
  original_price: number | null;
  offer_percent: number | null;
  offer_ends_at: string | null;
  vendor: MpVendorInfo | null;
}

// One row as it comes from the database (the vendor can arrive as an object or a list of one)
export interface RawListingRow {
  id: string;
  title: string;
  price: number | string;
  delivery_hours: number;
  vendor_id: string;
  product_id: string;
  has_warranty?: boolean | null;
  warranty_text?: string | null;
  duration_months?: number | null;
  description?: string | null;
  offer_price?: number | string | null;
  offer_percent?: number | null;
  offer_ends_at?: string | null;
  mp_vendors: MpVendorInfo | MpVendorInfo[] | null;
}

export type SortKey = 'price' | 'speed' | 'verified' | 'rating';

// Vendor score numbers (from the database function mp_vendor_scores)
export interface VendorScore {
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

export interface VendorReview {
  rating: number;
  comment: string | null;
  created_at: string;
  customer_label: string | null;
}

export function toListing(row: RawListingRow): MpListing {
  const v = Array.isArray(row.mp_vendors) ? row.mp_vendors[0] ?? null : row.mp_vendors;
  const offerOn =
    row.offer_price != null && !!row.offer_ends_at && new Date(row.offer_ends_at).getTime() > Date.now() && Number(row.offer_price) < Number(row.price);
  return {
    id: row.id,
    title: row.title,
    price: offerOn ? Number(row.offer_price) : Number(row.price),
    original_price: offerOn ? Number(row.price) : null,
    offer_percent: offerOn ? row.offer_percent ?? null : null,
    offer_ends_at: offerOn ? row.offer_ends_at ?? null : null,
    delivery_hours: row.delivery_hours,
    vendor_id: row.vendor_id,
    product_id: row.product_id,
    has_warranty: row.has_warranty === true,
    warranty_text: row.warranty_text ?? null,
    duration_months: row.duration_months ?? null,
    description: row.description ?? null,
    vendor: v ?? null,
  };
}

export function formatPkr(value: number): string {
  return 'Rs ' + Math.round(value).toLocaleString('en-US');
}

export function formatHours(hours: number): string {
  if (hours < 24) return hours + (hours === 1 ? ' hour' : ' hours');
  const days = Math.round(hours / 24);
  return days + (days === 1 ? ' day' : ' days');
}

export function sortListings(
  list: MpListing[],
  key: SortKey,
  scores: Record<string, VendorScore> = {}
): MpListing[] {
  const copy = [...list];
  copy.sort((a, b) => {
    if (key === 'rating') {
      const ar = scores[a.vendor_id]?.avg_rating;
      const br = scores[b.vendor_id]?.avg_rating;
      const av = ar === null || ar === undefined ? -1 : Number(ar);
      const bv = br === null || br === undefined ? -1 : Number(br);
      if (av !== bv) return bv - av;
      return a.price - b.price;
    }
    if (key === 'speed') {
      if (a.delivery_hours !== b.delivery_hours) return a.delivery_hours - b.delivery_hours;
      return a.price - b.price;
    }
    if (key === 'verified') {
      const av = a.vendor?.verified ? 1 : 0;
      const bv = b.vendor?.verified ? 1 : 0;
      if (av !== bv) return bv - av;
      return a.price - b.price;
    }
    if (a.price !== b.price) return a.price - b.price;
    return a.delivery_hours - b.delivery_hours;
  });
  return copy;
}

// Badges per listing id: "Lowest price" and "Fastest" (only when there is something to compare)
export function getBadges(list: MpListing[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (list.length < 2) return result;
  const prices = list.map((l) => l.price);
  const hours = list.map((l) => l.delivery_hours);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minHours = Math.min(...hours);
  const maxHours = Math.max(...hours);
  for (const l of list) {
    const badges: string[] = [];
    // A badge only shows when the vendors are really different
    if (maxPrice !== minPrice && l.price === minPrice) badges.push('Lowest price');
    if (maxHours !== minHours && l.delivery_hours === minHours) badges.push('Fastest');
    result[l.id] = badges;
  }
  return result;
}

// ---------- Orders ----------

// Orders WhatsApp number (digits only, with country code)
export const ORDERS_WHATSAPP = '923216757002';

export interface OrderMessageInput {
  orderNo: string;
  customerName: string;
  customerWhatsapp: string;
  customerEmail: string;
  productName: string;
  packageTitle: string;
  vendorName: string;
  price: number;
  notes: string;
}

// Builds the ready-to-send WhatsApp message. It never contains the vendor cost or commission.
export function buildOrderMessage(o: OrderMessageInput): string {
  const lines = [
    'NEW ORDER - OrbinexaCSV',
    'Order ID: ' + o.orderNo,
    '',
    'Customer: ' + o.customerName,
    'WhatsApp: ' + o.customerWhatsapp,
  ];
  if (o.customerEmail) lines.push('Email: ' + o.customerEmail);
  lines.push(
    '',
    'Package: ' + o.productName + ' (' + o.packageTitle + ')',
    'Vendor: ' + o.vendorName,
    'Price: ' + formatPkr(o.price),
  );
  if (o.notes) lines.push('', 'Notes: ' + o.notes);
  lines.push('', 'I want to pay. Please send payment details.');
  return lines.join('\n');
}

export function buildWhatsAppLink(message: string): string {
  return 'https://wa.me/' + ORDERS_WHATSAPP + '?text=' + encodeURIComponent(message);
}