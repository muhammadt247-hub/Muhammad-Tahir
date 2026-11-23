import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { claimReferralIfAny } from '@/lib/referral';
import { checkRateLimit } from '@/lib/rate-limit';

// The code (6 to 10 numbers) from the confirmation email, typed on the "Check your email" screen.
// Useful when the link does not open or the email arrives on another device.
const Body = z.object({
  email: z.string().trim().email().max(200),
  code: z.string().trim().regex(/^[0-9]{6,10}$/),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Please enter the code from the email (numbers only).' }, { status: 400 });
  }

  // stop code guessing: 6 tries per 10 minutes per email, 20 per IP
  const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  const byEmail = checkRateLimit('verify-code:' + body.email.toLowerCase(), 6, 600_000);
  const byIp = checkRateLimit('verify-code-ip:' + ip, 20, 600_000);
  if (!byEmail.allowed || !byIp.allowed) {
    return NextResponse.json({ error: 'Too many tries. Please wait 10 minutes, or press Resend for a new code.' }, { status: 429 });
  }

  const supabase = await createClient();
  // newer emails use type "email"; older sign-up emails may still use "signup"
  let result = await supabase.auth.verifyOtp({ email: body.email, token: body.code, type: 'email' });
  if (result.error) result = await supabase.auth.verifyOtp({ email: body.email, token: body.code, type: 'signup' });
  if (result.error || !result.data?.user) {
    return NextResponse.json({ error: 'That code is wrong or has expired. Press Resend for a new one.' }, { status: 400 });
  }
  const user = result.data.user;
  await claimReferralIfAny(user.id, user.user_metadata?.referral_code);
  return NextResponse.json({ ok: true });
}
