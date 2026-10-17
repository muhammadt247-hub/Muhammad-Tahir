import { Asset, SearchParams, SearchResult } from '@/types/asset';
import { extractFileId, extractContributorId } from '@/lib/format';
import { StockProvider } from './types';

const ADOBE_SEARCH_ENDPOINT = 'https://stock.adobe.io/Rest/Media/1/Search/Files';

interface AdobeStockMediaItem {
  id: number;
  title?: string;
  creator_name?: string;
  creator_id?: number;
  category?: { id?: number; name?: string } | number | string;
  keywords?: { name: string }[] | string[];
  thumbnail_url?: string;
  thumbnail_110_url?: string;
  thumbnail_240_url?: string;
  thumbnail_500_url?: string;
  thumbnail_1000_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  creation_date?: string;
  content_type?: string;
  is_generative_ai?: boolean | number;
  nb_downloads?: number;
  details_url?: string;
}

interface AdobeStockSearchResponse {
  nb_results: number;
  files?: AdobeStockMediaItem[];
}

export class AdobeStockOfficialProvider implements StockProvider {
  private apiKey: string;
  private productName: string;

  constructor(apiKey: string, productName: string = 'OrbinexaCSV/1.0') {
    this.apiKey = apiKey;
    this.productName = productName;
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const limit = params.limit || 32;
    const page = params.page || 1;
    const offset = (page - 1) * limit;

    const queryParams = new URLSearchParams();
    queryParams.append('locale', 'en_US');
    queryParams.append('search_parameters[limit]', String(limit));
    queryParams.append('search_parameters[offset]', String(offset));

    if (params.mode === 'file') {
      const cleanId = extractFileId(params.query);
      queryParams.set('search_parameters[limit]', '1');
      queryParams.set('search_parameters[offset]', '0');
      queryParams.append('search_parameters[media_id]', cleanId || params.query);
    } else if (params.mode === 'contributor') {
      const cleanId = extractContributorId(params.query);
      queryParams.append('search_parameters[creator_id]', cleanId || params.query);
    } else {
      queryParams.append('search_parameters[words]', params.query || 'background');
    }

    // Sort order
    if (params.sort) {
      queryParams.append('search_parameters[order]', params.sort);
    } else {
      queryParams.append('search_parameters[order]', 'nb_downloads');
    }

    // Content types
    if (params.contentType && params.contentType !== 'all') {
      const typeKey = `search_parameters[filters][content_type:${params.contentType}]`;
      queryParams.append(typeKey, '1');
    }

    // Generative AI filter
    if (params.ai === 'non_ai') {
      queryParams.append('search_parameters[filters][is_generative_ai]', '0');
    } else if (params.ai === 'ai_only') {
      queryParams.append('search_parameters[filters][is_generative_ai]', '1');
    }

    // Result columns
    const columns = [
      'id',
      'title',
      'creator_name',
      'creator_id',
      'category',
      'keywords',
      'thumbnail_url',
      'thumbnail_500_url',
      'thumbnail_width',
      'thumbnail_height',
      'creation_date',
      'content_type',
      'is_generative_ai',
      'nb_downloads',
      'details_url',
      'nb_results',
    ];
    columns.forEach((col) => queryParams.append('result_columns[]', col));

    const response = await fetch(`${ADOBE_SEARCH_ENDPOINT}?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'x-api-key': this.apiKey,
        'x-product': this.productName,
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Adobe Stock API HTTP ${response.status}: ${errText}`);
    }

    const data: AdobeStockSearchResponse = await response.json();
    const files = data.files || [];

    // If contributor search yielded 0 results, check if the ID is actually a valid File ID
    if (params.mode === 'contributor' && files.length === 0) {
      const cleanId = extractFileId(params.query);
      if (cleanId.length >= 6) {
        try {
          const checkParams = new URLSearchParams();
          checkParams.append('locale', 'en_US');
          checkParams.append('search_parameters[limit]', '1');
          checkParams.append('search_parameters[media_id]', cleanId);
          columns.forEach((col) => checkParams.append('result_columns[]', col));
          const checkRes = await fetch(`${ADOBE_SEARCH_ENDPOINT}?${checkParams.toString()}`, {
            method: 'GET',
            headers: {
              'x-api-key': this.apiKey,
              'x-product': this.productName,
            },
          });
          if (checkRes.ok) {
            const checkData: AdobeStockSearchResponse = await checkRes.json();
            if (checkData.files && checkData.files.length > 0) {
              return {
                assets: [],
                total: 0,
                totalAI: 0,
                totalNonAI: 0,
                page,
                pageSize: limit,
                isDemo: false,
                fileIdSuggestion: cleanId,
              };
            }
          }
        } catch {
          // ignore check error
        }
      }
    }

    const assets: Asset[] = files.map((file) => {
      let keywords: string[] = [];
      if (Array.isArray(file.keywords)) {
        keywords = file.keywords.map((k) => (typeof k === 'string' ? k : k.name)).filter(Boolean);
      }

      let category = 'General';
      if (file.category) {
        if (typeof file.category === 'object' && file.category.name) {
          category = file.category.name;
        } else {
          category = String(file.category);
        }
      }

      const isAi = file.is_generative_ai === true || file.is_generative_ai === 1;
      const thumb =
        file.thumbnail_500_url ||
        file.thumbnail_url ||
        file.thumbnail_240_url ||
        `https://as1.ftcdn.net/v2/jpg/00/00/00/00/500_F_${file.id}.jpg`;

      return {
        id: String(file.id),
        title: file.title || `Adobe Stock Asset #${file.id}`,
        creator_name: file.creator_name || 'Contributor',
        creator_id: String(file.creator_id || ''),
        category,
        content_type: file.content_type || 'Photo/Image',
        is_generative_ai: isAi,
        thumbnail_url: thumb,
        thumbnail_width: file.thumbnail_width || 500,
        thumbnail_height: file.thumbnail_height || 333,
        creation_date: file.creation_date || new Date().toISOString(),
        nb_downloads: file.nb_downloads,
        keywords,
        details_url: file.details_url || `https://stock.adobe.com/images/${file.id}`,
      };
    });

    // Run parallel count for AI split if not already filtered
    let totalAI = 0;
    let totalNonAI = 0;
    const total = data.nb_results || 0;

    if (!params.ai || params.ai === 'all') {
      try {
        const aiCountParams = new URLSearchParams(queryParams);
        aiCountParams.set('search_parameters[limit]', '1');
        aiCountParams.set('search_parameters[offset]', '0');
        aiCountParams.set('search_parameters[filters][is_generative_ai]', '1');

        const aiRes = await fetch(`${ADOBE_SEARCH_ENDPOINT}?${aiCountParams.toString()}`, {
          method: 'GET',
          headers: {
            'x-api-key': this.apiKey,
            'x-product': this.productName,
          },
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          totalAI = aiData.nb_results || 0;
          totalNonAI = Math.max(0, total - totalAI);
        }
      } catch {
        // Fallback rough estimate
        totalAI = Math.round(total * 0.35);
        totalNonAI = total - totalAI;
      }
    } else if (params.ai === 'ai_only') {
      totalAI = total;
      totalNonAI = 0;
    } else {
      totalAI = 0;
      totalNonAI = total;
    }

    return {
      assets,
      total,
      totalAI,
      totalNonAI,
      page,
      pageSize: limit,
      isDemo: false,
    };
  }
}
