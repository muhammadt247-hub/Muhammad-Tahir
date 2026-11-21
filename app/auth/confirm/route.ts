import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, getSiteUrl } from '@/lib/supabase/config';
import { claimReferralIfAny } from '@/lib/referral';

// Confirmation link from the email: https://orbinexacsv.com/auth/confirm?token_hash=...&type=email
// Unlike the old link, this works on ANY device or browser (signed up on a computer, opened the email on a phone),
// and the link shows our own website address, which spam filters trust more.
const TYPES: EmailOtpType[] = ['email', 'signup', 'recovery', 'invite', 'magiclink', 'email_change'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type') ?? 'email';
  const type = (TYPES as string[]).includes(rawType) ? (rawType as EmailOtpType) : 'email';
  const next = searchParams.get('next') ?? (type === 'recovery' ? '/reset-password' : '/generator');
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/generator';
  const base = getSiteUrl();

  if (!isSupabaseConfigured()) return NextResponse.redirect(`${base}/login`);

  if (tokenHash) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) {
        const user = data?.user;
        if (user && type !== 'recovery') await claimReferralIfAny(user.id, user.user_metadata?.referral_code);
        return NextResponse.redirect(`${base}${safeNext}`);
      }
      console.error('Email confirm error:', error.message);
    } catch (err) {
      console.error('Unexpected email confirm error:', err);
    }
  }
  return NextResponse.redirect(`${base}/login?error=auth-callback-failed`);
}
