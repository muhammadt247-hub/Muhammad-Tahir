import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStockProvider } from '@/lib/providers';
import { checkRateLimit } from '@/lib/rate-limit';
import { getCached, setCached } from '@/lib/cache';
import { SearchResult } from '@/types/asset';

const SearchQuerySchema = z.object({
  mode: z.enum(['keyword', 'file', 'contributor']).default('keyword'),
  query: z.string().default(''),
  sort: z.enum(['nb_downloads', 'relevance', 'creation', 'featured', 'undiscovered']).default('nb_downloads'),
  contentType: z.enum(['all', 'photo', 'illustration', 'vector', 'video', '3d', 'template', 'audio']).default('all'),
  ai: z.enum(['all', 'non_ai', 'ai_only']).default('all'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(32),
});

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rate = checkRateLimit(ip, 120, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Please retry in ${rate.resetIn} seconds.`,
          },
        },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const parsed = SearchQuerySchema.safeParse({
      mode: searchParams.get('mode') || undefined,
      query: searchParams.get('query') || undefined,
      sort: searchParams.get('sort') || undefined,
      contentType: searchParams.get('contentType') || undefined,
      ai: searchParams.get('ai') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_PARAMETERS',
            message: parsed.error.issues.map((i) => i.message).join(', '),
          },
        },
        { status: 400 }
      );
    }

    const params = parsed.data;
    const cacheKey = `stock_search_${params.mode}_${params.query}_${params.sort}_${params.contentType}_${params.ai}_${params.page}_${params.limit}`;

    const cachedResult = getCached<SearchResult>(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult, {
        headers: { 'X-Cache': 'HIT' },
      });
    }

    const provider = getStockProvider();
    const result = await provider.search(params);

    // Cache in memory for 5 minutes (300,000 ms)
    setCached(cacheKey, result, 300_000);

    return NextResponse.json(result, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error: unknown) {
    console.error('[Stock Search API Error]:', error);
    const message = error instanceof Error ? error.message : 'Internal Stock API Error';
    return NextResponse.json(
      {
        error: {
          code: 'STOCK_SEARCH_FAILED',
          message,
        },
      },
      { status: 500 }
    );
  }
}
