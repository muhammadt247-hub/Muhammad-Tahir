import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/generator';

  // Security check: validate safe redirect target
  const safeNext =
    next.startsWith('/') && !next.startsWith('//') ? next : '/generator';

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // Successfully exchanged email code for authenticated session!
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
      console.error('Exchange code error:', error.message);
    } catch (err) {
      console.error('Unexpected auth callback error:', err);
    }
  }

  // If code exchange failed or expired, return to login with helpful error query
  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
