export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
    anonKey &&
    url.trim().length > 0 &&
    anonKey.trim().length > 0 &&
    !url.includes('placeholder')
  );
}

export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const winOrigin = window.location.origin;
    if (winOrigin && !winOrigin.includes('0.0.0.0') && !winOrigin.includes('localhost')) {
      return winOrigin;
    }
  }
  // Keep localhost only as a fallback when NEXT_PUBLIC_SITE_URL is missing in development
  return 'http://localhost:3000';
}

export function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || '',
  };
}


