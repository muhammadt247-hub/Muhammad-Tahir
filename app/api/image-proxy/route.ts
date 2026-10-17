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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    const parsed = new URL(imageUrl);
    const isAllowed = ALLOWED_HOSTS.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h)
    );

    if (!isAllowed) {
      return NextResponse.json({ error: 'Host not allowed in proxy' }, { status: 403 });
    }

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'OrbinexaCSV-Toolkit/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    // 5 MB cap
    if (buffer.byteLength > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image exceeds 5MB size limit' }, { status: 413 });
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Proxy fetch error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
