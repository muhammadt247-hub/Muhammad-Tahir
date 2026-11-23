import { createClient } from './client';

// Keeps the login fresh BEFORE a long batch sends its next request.
//
// Why: the login token lasts 1 hour. If it runs out in the middle of a batch, several images reach the
// server at the same moment and each one tries to renew the login with the same renewal key. Supabase
// sees the key used twice, treats it as an attack ("refresh_token_already_used") and logs the person out.
// Renewing once here in the browser (one renewal at a time, a few minutes early) means the server never
// has to renew, so that can not happen.

const RENEW_WHEN_LEFT_MS = 10 * 60 * 1000; // renew when less than 10 minutes are left
let renewing: Promise<void> | null = null;

export function ensureFreshLogin(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (renewing) return renewing;
  renewing = (async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const expiresAt = data.session?.expires_at;
      if (!data.session || !expiresAt) return;
      if (expiresAt * 1000 - Date.now() < RENEW_WHEN_LEFT_MS) {
        await supabase.auth.refreshSession();
      }
    } catch {
      // Never block the request: if renewing fails, the server answers and the normal retry runs.
    } finally {
      renewing = null;
    }
  })();
  return renewing;
}
