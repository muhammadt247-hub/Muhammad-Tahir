import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, getSupabaseEnv } from '@/lib/supabase/config';

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();
  if (!isSupabaseConfigured()) {
    return createServerClient(
      'https://dummy-project.supabase.co',
      'sb_publishable_dummy_key_do_not_use',
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {},
        },
      }
    );
  }
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
        }
      },
    },
  });
}

export async function requireUser(): Promise<User | NextResponse> {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Please log in.' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Please log in.' } },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return user;
  } catch {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Please log in.' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
