import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, getSiteUrl } from '@/lib/supabase/config';
import { NextResponse, type NextRequest } from 'next/server';
import { claimReferralIfAny } from '@/lib/referral';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/generator';

  const baseUrl = getSiteUrl();

  // Security check: validate safe redirect target
  const safeNext =
    next.startsWith('/') && !next.startsWith('//') ? next : '/generator';

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const newUser = data?.user;
        if (newUser) {
          await claimReferralIfAny(newUser.id, newUser.user_metadata?.referral_code);
        }
        // Successfully exchanged email code for authenticated session!
        return NextResponse.redirect(`${baseUrl}${safeNext}`);
      }
      console.error('Exchange code error:', error.message);
    } catch (err) {
      console.error('Unexpected auth callback error:', err);
    }
  }

  // If code exchange failed or expired, return to login with helpful error query
  return NextResponse.redirect(`${baseUrl}/login?error=auth-callback-failed`);
}

