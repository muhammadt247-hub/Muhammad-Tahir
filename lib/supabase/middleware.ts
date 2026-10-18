import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured, getSupabaseEnv } from './config';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // Static files and internal Next.js assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/auth/signout') ||
    pathname === '/icon.svg' ||
    pathname.includes('.')
  ) {
    return supabaseResponse;
  }

  const isProtectedApi =
    pathname.startsWith('/api/generate') ||
    pathname.startsWith('/api/similarity') ||
    pathname.startsWith('/api/prompt') ||
    pathname.startsWith('/api/stock/search') ||
    pathname.startsWith('/api/image-proxy');

  // If Supabase is not configured, handle gracefully without crashing
  if (!isSupabaseConfigured()) {
    if (isProtectedApi) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Please log in.' } },
        { status: 401 }
      );
    }

    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Always use supabase.auth.getUser() on the server for the check, not getSession
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Protect API routes: /api/generate, /api/similarity, /api/prompt, /api/stock/search, /api/image-proxy
  if (isProtectedApi) {
    if (!user) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Please log in.' } },
        { status: 401 }
      );
    }
    return supabaseResponse;
  }

  // 2. Root path: "/" -> "/generator" when logged in and "/login" when logged out
  if (pathname === '/') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = user ? '/generator' : '/login';
    return NextResponse.redirect(redirectUrl);
  }

  // 3. Logged-in visitors who open /login or /signup go to /generator
  if (pathname === '/login' || pathname === '/signup') {
    if (user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/generator';
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  // 4. Protect /generator, /adobe-analytics, /tools and /account: logged-out visitors go to /login?next=<path>
  const isProtectedPage =
    pathname === '/generator' ||
    pathname.startsWith('/generator/') ||
    pathname === '/adobe-analytics' ||
    pathname.startsWith('/adobe-analytics/') ||
    pathname === '/tools' ||
    pathname.startsWith('/tools/') ||
    pathname === '/account' ||
    pathname.startsWith('/account/');

  if (isProtectedPage && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    const nextPath = pathname + request.nextUrl.search;
    redirectUrl.searchParams.set('next', nextPath);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
