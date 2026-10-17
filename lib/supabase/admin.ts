import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !serviceRoleKey) {
    // Return a dummy client in fallback mode to prevent top-level build errors
    return createClient('https://dummy-project.supabase.co', 'sb_secret_dummy_key_do_not_use', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}

export const createAdminClient = getAdminClient;
