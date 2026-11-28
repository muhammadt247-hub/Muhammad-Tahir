import { NextResponse, type NextRequest } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

export function checkRateLimit(
  identifier: string,
  limit: number = 60,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  // Forget old entries now and then, so the list never grows without end
  if (rateLimitMap.size > 5000) {
    for (const [k, r] of rateLimitMap) if (now > r.resetAt) rateLimitMap.delete(k);
  }
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true, remaining: limit - 1, resetIn: Math.ceil(windowMs / 1000) };
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: limit - record.count,
    resetIn: Math.ceil((record.resetAt - now) / 1000),
  };
}

// The visitor's address (first one when the host adds several)
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

// Returns a ready 429 answer when this visitor sent too many requests to one API, otherwise null
export function limitByIp(req: NextRequest, name: string, limit: number, windowMs = 60_000): NextResponse | null {
  const rate = checkRateLimit(name + ':' + clientIp(req), limit, windowMs);
  if (rate.allowed) return null;
  return NextResponse.json(
    { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please wait ' + rate.resetIn + ' seconds.' } },
    { status: 429, headers: { 'Retry-After': String(rate.resetIn) } }
  );
}
