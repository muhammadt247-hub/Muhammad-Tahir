import { createBrowserClient } from '@supabase/ssr';
import { isSupabaseConfigured, getSupabaseEnv } from './config';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const { url, anonKey } = getSupabaseEnv();

  if (!isSupabaseConfigured()) {
    // Return a dummy client in safe fallback mode to prevent crashing
    return createBrowserClient(
      'https://dummy-project.supabase.co',
      'sb_publishable_dummy_key_do_not_use'
    );
  }

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
