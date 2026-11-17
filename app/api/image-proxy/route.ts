import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = [
  't3.ftcdn.net',
  't4.ftcdn.net',
  'as1.ftcdn.net',
  'as2.ftcdn.net',
  'stock.adobe.com',
  'images.unsplash.com',
  'picsum.photos',
];

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB cap
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

// Only plain https addresses on the allowed image hosts (no other ports, no user:password@)
function isAllowedUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
  const host = u.hostname.toLowerCase();
  return ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h)) ? u : null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    const first = isAllowedUrl(imageUrl);
    if (!first) {
      return NextResponse.json({ error: 'Host not allowed in proxy' }, { status: 403 });
    }

    // Follow redirects ourselves, so a redirect can never lead outside the allowed hosts
    let target: URL = first;
    let response: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      response = await fetch(target.toString(), {
        headers: { 'User-Agent': 'OrbinexaCSV-Toolkit/1.0' },
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status < 300 || response.status >= 400) break;
      const location: string | null = response.headers.get('location');
      const nextUrl: URL | null = location ? isAllowedUrl(new URL(location, target).toString()) : null;
      if (!nextUrl) {
        return NextResponse.json({ error: 'Redirect to a host that is not allowed' }, { status: 403 });
      }
      if (hop === MAX_REDIRECTS) {
        return NextResponse.json({ error: 'Too many redirects' }, { status: 502 });
      }
      target = nextUrl;
    }

    if (!response || !response.ok) {
      return NextResponse.json({ error: `Upstream error: HTTP ${response?.status ?? 0}` }, { status: 502 });
    }

    // Images only: never pass through HTML or scripts
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/') || contentType.includes('svg')) {
      return NextResponse.json({ error: 'Not an image' }, { status: 415 });
    }

    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) {
      return NextResponse.json({ error: 'Image exceeds 5MB size limit' }, { status: 413 });
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Image exceeds 5MB size limit' }, { status: 413 });
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Content-Disposition': 'inline',
      },
    });
  } catch (err: unknown) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return NextResponse.json({ error: timedOut ? 'Image took too long to load' : 'Proxy fetch error' }, { status: timedOut ? 504 : 500 });
  }
}
