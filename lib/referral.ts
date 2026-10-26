import 'server-only';
import { getAdminClient } from '@/lib/supabase/admin';

export async function claimReferralIfAny(userId: string, rawCode: unknown): Promise<string> {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{6,12}$/.test(code)) return 'no_code';
  try {
    const { data, error } = await getAdminClient().rpc('claim_referral', {
      p_referred: userId,
      p_code: code,
    });
    if (error) {
      console.error('claim_referral failed:', error.message);
      return 'error';
    }
    return String(data);
  } catch (err) {
    console.error('claim_referral crashed:', err);
    return 'error';
  }
}
