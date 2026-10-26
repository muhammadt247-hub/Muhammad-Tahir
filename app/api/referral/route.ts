import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: code, error: codeError } = await supabase.rpc('get_or_create_my_referral_code');
  if (codeError || !code) {
    console.error('referral code error:', codeError?.message);
    return NextResponse.json({ error: 'referral_unavailable' }, { status: 500 });
  }

  const { data: stats } = await supabase.rpc('my_referral_stats');
  const row = Array.isArray(stats) ? stats[0] : stats;

  return NextResponse.json({
    code,
    friends: Number(row?.friends) || 0,
    creditsEarned: Number(row?.credits_earned) || 0,
    maxFriends: Number(row?.max_friends) || 10,
  });
}
