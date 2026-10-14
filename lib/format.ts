export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '—';
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatCompact(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '—';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

export function relativeTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30.44);
    const diffYears = Math.floor(diffDays / 365.25);

    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffMonths === 1) return '1 month ago';
    if (diffMonths < 12) return `${diffMonths} months ago`;
    if (diffYears === 1) return '1 year ago';
    return `${diffYears} years ago`;
  } catch {
    return dateStr;
  }
}

/**
 * Extracts numeric Adobe Stock File ID from plain number, URL, or string
 * e.g. 2063124677, https://stock.adobe.com/stock-photo/id/2063124677, /images/.../2063124677, FILE #2063124677
 */
export function extractFileId(input: string | undefined | null): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  // 1. Pure digits
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // 2. URL with stock-photo/id/<id> or /id/<id>
  const idMatch = trimmed.match(/(?:stock-photo\/id\/|\/id\/)(\d+)/i);
  if (idMatch && idMatch[1]) return idMatch[1];

  // 3. URL with /images/.../<id> or /images/<id>
  const imagesMatch = trimmed.match(/\/images\/(?:[^\/\?#]+\/)?(\d+)/i);
  if (imagesMatch && imagesMatch[1]) return imagesMatch[1];

  // 4. URL with /media/<id>, /file/<id>, /asset/<id>
  const mediaMatch = trimmed.match(/(?:\/media\/|\/file\/|\/asset\/)(\d+)/i);
  if (mediaMatch && mediaMatch[1]) return mediaMatch[1];

  // 5. FTCDN thumbnail URL: 500_F_<id>
  const ftcdnMatch = trimmed.match(/500_F_(\d+)/i);
  if (ftcdnMatch && ftcdnMatch[1]) return ftcdnMatch[1];

  // 6. "FILE #" or "FILE:" or "ASSET #" prefix
  const filePrefixMatch = trimmed.match(/(?:file\s*#?|asset\s*#?)\s*:?\s*(\d+)/i);
  if (filePrefixMatch && filePrefixMatch[1]) return filePrefixMatch[1];

  // 7. Embedded isolated 6-12 digit sequence in URL or path
  if (trimmed.includes('/') || trimmed.includes('.') || trimmed.includes(':') || trimmed.includes('?')) {
    const digitsInUrl = trimmed.match(/\b(\d{6,12})\b/);
    if (digitsInUrl && digitsInUrl[1]) return digitsInUrl[1];
  }

  // 8. Fallback: extract all digits
  const fallbackDigits = trimmed.replace(/\D/g, '');
  return fallbackDigits || trimmed;
}

/**
 * Extracts numeric Adobe Stock Contributor ID from plain number, URL, or string
 * e.g. 20485912, stock.adobe.com/contributor/20485912/name
 */
export function extractContributorId(input: string | undefined | null): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  // 1. Pure digits
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Profile URL with /contributor/<id>/...
  const contribMatch = trimmed.match(/(?:contributor|creator|author)\/(\d+)/i);
  if (contribMatch && contribMatch[1]) {
    return contribMatch[1];
  }

  // 3. Fallback: extract all digits
  const onlyDigits = trimmed.replace(/\D/g, '');
  return onlyDigits || trimmed;
}

