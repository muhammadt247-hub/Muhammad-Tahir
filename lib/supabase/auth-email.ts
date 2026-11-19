import { ORDERS_WHATSAPP } from '@/lib/marketplace/shared';

// Clear messages for sign-up / confirmation email problems.
// A slow mail server can make Supabase time out (504) even though the account was created,
// so a time-out is treated as "account made, email may be late" instead of a failure.

type AuthErr = { message?: string; status?: number; code?: string; name?: string } | null | undefined;

export function isSlowEmailError(error: AuthErr): boolean {
  if (!error) return false;
  const m = (error.message || '').toLowerCase();
  // Only server time-outs. "No internet" (status 0 / Failed to fetch) is NOT treated as slow email,
  // because then the account was probably never created.
  return (
    error.status === 504 ||
    error.code === 'request_timeout' ||
    (error.name === 'AuthRetryableFetchError' && (error.status ?? 0) >= 500) ||
    /timeout|timed out|deadline|gateway/.test(m)
  );
}

export function friendlyEmailError(error: AuthErr): string {
  if (!error) return 'Something went wrong. Please try again.';
  const m = (error.message || '').toLowerCase();
  if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
    const secs = m.match(/after (\d+) seconds?/);
    return secs ? `Please wait ${secs[1]} seconds, then press Resend again.` : 'Too many emails were sent. Please wait a minute, then try again.';
  }
  if (isSlowEmailError(error)) return 'Our email server is slow right now. Your email may arrive in a few minutes. If not, press Resend.';
  if (/invalid.*email|email.*invalid/.test(m)) return 'This email address does not look right. Please check it.';
  return error.message || 'Something went wrong. Please try again.';
}

// WhatsApp link to OrbinexaCSV with a ready message, for people whose confirmation email never arrives
export function whatsappHelpLink(email: string): string {
  const msg =
    'Hello OrbinexaCSV, I signed up with this email: ' +
    (email.trim() || '(my email)') +
    ' but I did not get the confirmation email. Please activate my account.';
  return 'https://wa.me/' + ORDERS_WHATSAPP + '?text=' + encodeURIComponent(msg);
}

export const EMAIL_TIPS = [
  'It can take up to 5 minutes to arrive.',
  'Check your Spam, Junk and Promotions folders.',
  'If it is in Spam, press "Not spam" so the next emails arrive in your inbox.',
];
