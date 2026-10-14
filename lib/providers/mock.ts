import { Asset, SearchParams, SearchResult } from '@/types/asset';
import { extractFileId } from '@/lib/format';
import { StockProvider } from './types';

// Deterministic seed helper
function pseudoRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 42;
}

const SAMPLE_CATEGORIES = [
  'Business',
  'Technology',
  'Graphic Resources',
  'The Environment',
  'Landscapes',
  'Lifestyle',
  'People',
  'Animals',
  'Industry',
  'Science',
];

const CONTENT_TYPES = ['Photo/Image', 'Vector', 'Illustration', '3D'];

const CONTRIBUTORS = [
  { id: '20485912', name: 'Microstock Pro Studio' },
  { id: '19842100', name: 'Elena Rostova Visuals' },
  { id: '20894562', name: 'Nordic Creative Lab' },
  { id: '20194833', name: 'PixelForge Design' },
  { id: '20773911', name: 'Alexander Wright' },
  { id: '19482910', name: 'Aura Graphics' },
  { id: '21094822', name: 'Vibrant Motion Media' },
  { id: '20582914', name: 'Zenith Vector Works' },
];

const KEYWORD_POOLS: Record<string, string[]> = {
  general: [
    'background', 'abstract', 'design', 'modern', 'concept', 'vector', 'illustration',
    'graphic', 'digital', 'wallpaper', 'art', 'creative', 'pattern', 'element', 'texture',
    'technology', 'futuristic', 'light', 'isolated', 'white', 'flat', 'minimal', 'banner',
    'template', 'symbol', 'icon', 'color', 'composition', 'professional', 'commercial'
  ],
  business: [
    'business', 'office', 'corporate', 'meeting', 'team', 'work', 'success', 'finance',
    'strategy', 'professional', 'people', 'handshake', 'growth', 'company', 'management',
    'marketing', 'consulting', 'partnership', 'executive', 'workspace', 'career'
  ],
  tech: [
    'artificial intelligence', 'data', 'cloud', 'cyber', 'network', 'code', 'connection',
    'machine learning', 'future', 'server', 'neural', 'algorithm', 'software', 'virtual',
    'automation', 'interface', 'analytics', 'information', 'smart', 'security'
  ],
  nature: [
    'green', 'eco', 'sustainable', 'nature', 'environment', 'energy', 'solar', 'renewable',
    'organic', 'planet', 'earth', 'ecology', 'clean', 'leaf', 'forest', 'climate', 'wind'
  ],
};

function generateDeterministicSvgThumbnail(id: string, title: string, isAi: boolean, rand: () => number): string {
  const hues = [25, 35, 45, 15, 270, 160, 340, 30];
  const h1 = hues[Math.floor(rand() * hues.length)];
  const h2 = (h1 + 60 + Math.floor(rand() * 40)) % 360;
  
  const shapes = [];
  for (let i = 0; i < 4; i++) {
    const cx = 50 + rand() * 300;
    const cy = 40 + rand() * 180;
    const r = 30 + rand() * 80;
    const opacity = (0.2 + rand() * 0.4).toFixed(2);
    shapes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="hsl(${h2} 80% 65% / ${opacity})" filter="blur(20px)" />`);
  }

  const cleanTitle = title.replace(/[<>&"]/g, '').slice(0, 36);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <defs>
      <linearGradient id="bg_${id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${h1} 45% 18%)" />
        <stop offset="50%" stop-color="hsl(${(h1+30)%360} 35% 12%)" />
        <stop offset="100%" stop-color="hsl(${h2} 50% 10%)" />
      </linearGradient>
    </defs>
    <rect width="600" height="400" fill="url(#bg_${id})" />
    ${shapes.join('\n')}
    <g opacity="0.15">
      <path d="M0,200 Q150,${100 + rand()*100} 300,200 T600,200" fill="none" stroke="#fff" stroke-width="2" />
      <path d="M0,260 Q150,${180 + rand()*80} 300,260 T600,260" fill="none" stroke="#fff" stroke-width="1.5" />
    </g>
    <rect x="24" y="310" width="552" height="64" rx="8" fill="rgba(0,0,0,0.4)" backdrop-filter="blur(8px)" />
    <text x="40" y="348" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600">${cleanTitle}...</text>
    <text x="40" y="365" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">ASSET #${id} • ${isAi ? 'GENERATIVE AI' : 'NON-AI'} • 4K RENDER</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export class MockStockProvider implements StockProvider {
  async search(params: SearchParams): Promise<SearchResult> {
    const rawQuery = (params.query || 'stock assets').trim();

    // 1. In demo mode, File ID search must NOT return a fake image. Show empty state.
    if (params.mode === 'file') {
      return {
        assets: [],
        total: 0,
        totalAI: 0,
        totalNonAI: 0,
        page: 1,
        pageSize: 1,
        isDemo: true,
      };
    }

    const isContributor = params.mode === 'contributor';

    // 2. In Contributor mode, detect if the number/URL is actually an Adobe Stock File ID
    if (isContributor) {
      const cleanDigits = extractFileId(rawQuery);
      const isLikelyFileId =
        rawQuery.toLowerCase().includes('stock-photo') ||
        rawQuery.toLowerCase().includes('/images/') ||
        rawQuery.toLowerCase().includes('file') ||
        (cleanDigits.length >= 9 && cleanDigits.length <= 11);

      if (isLikelyFileId && cleanDigits) {
        return {
          assets: [],
          total: 0,
          totalAI: 0,
          totalNonAI: 0,
          page: 1,
          pageSize: params.limit || 32,
          isDemo: true,
          fileIdSuggestion: cleanDigits,
        };
      }
    }

    const seed = stringToSeed(rawQuery + (params.sort || 'downloads'));
    const rand = pseudoRandom(seed);

    const pageSize = params.limit || 32;
    const page = params.page || 1;
    const totalCount = isContributor ? 3420 : 8004824;
    const totalAI = isContributor ? 1240 : 2837445;
    const totalNonAI = totalCount - totalAI;

    // Generate up to 256 deterministic items in memory
    const generatedAssets: Asset[] = [];
    const poolSize = 256;

    const baseTitles = [
      'futuristic glowing neural network abstract background banner',
      'minimal modern business workplace desk with laptop and coffee',
      'green renewable clean energy wind turbines and solar panel landscape',
      'collaborative corporate team meeting discussing marketing strategy',
      'isometric cloud computing technology servers and cybersecurity',
      'abstract colorful 3d geometric shapes composition on dark backdrop',
      'happy diverse business colleagues shaking hands in modern office',
      'dynamic liquid fluid gradient wavy background with copy space',
      'smart city with autonomous electric vehicles and connected infrastructure',
      'creative artist desk workspace with tablet sketches and color swatches',
      'sustainable zero emission electric car charging station at sunrise',
      'modern medical laboratory scientist working with robotic microscope',
      'financial market stock graph charts and data visualization dashboard',
      'luxury architectural villa interior living room with panoramic glass wall',
      'vibrant tropical monstera palm leaves botanical pattern seamless vector',
      'organic coffee beans roasting process in artisan cafe roasting room',
    ];

    for (let i = 0; i < poolSize; i++) {
      const assetRand = pseudoRandom(seed + i * 37);
      const id = String(500000000 + (seed % 100000000) + i * 1947);
      
      const isAi = assetRand() > 0.64; // ~36% AI assets
      const titleTemplate = baseTitles[i % baseTitles.length];
      const titlePrefix = isAi ? 'AI generated ' : '';
      const queryWord = isContributor ? 'portfolio' : rawQuery;
      const title = `${titlePrefix}${queryWord} ${titleTemplate}`.trim();

      const creator = isContributor
        ? { id: rawQuery.replace(/[^0-9]/g, '') || '20485912', name: 'Studio Nordic Apex' }
        : CONTRIBUTORS[Math.floor(assetRand() * CONTRIBUTORS.length)];

      const category = SAMPLE_CATEGORIES[Math.floor(assetRand() * SAMPLE_CATEGORIES.length)];
      const contentType = CONTENT_TYPES[Math.floor(assetRand() * CONTENT_TYPES.length)];

      // Upload dates between 2018 and 2026
      const yearsAgo = Math.floor(assetRand() * 7);
      const monthsAgo = Math.floor(assetRand() * 11);
      const daysAgo = Math.floor(assetRand() * 28);
      const d = new Date();
      d.setFullYear(d.getFullYear() - yearsAgo);
      d.setMonth(d.getMonth() - monthsAgo);
      d.setDate(d.getDate() - daysAgo);

      // Downloads
      const baseDownloads = Math.floor(50 + assetRand() * 12500);
      const nbDownloads = params.sort === 'nb_downloads' ? Math.max(120, baseDownloads - i * 18) : baseDownloads;

      // Keywords
      const keywordsSet = new Set<string>();
      if (!isContributor) {
        rawQuery.toLowerCase().split(/\s+/).forEach((w) => w && keywordsSet.add(w));
      }
      keywordsSet.add(contentType.toLowerCase());
      keywordsSet.add(category.toLowerCase());
      
      const pool = KEYWORD_POOLS.general;
      while (keywordsSet.size < 22) {
        keywordsSet.add(pool[Math.floor(assetRand() * pool.length)]);
      }

      const keywords = Array.from(keywordsSet);

      generatedAssets.push({
        id,
        title: title.charAt(0).toUpperCase() + title.slice(1),
        creator_name: creator.name,
        creator_id: creator.id,
        category,
        content_type: contentType,
        is_generative_ai: isAi,
        thumbnail_url: generateDeterministicSvgThumbnail(id, title, isAi, assetRand),
        thumbnail_width: 600,
        thumbnail_height: 400,
        creation_date: d.toISOString(),
        nb_downloads: nbDownloads,
        keywords,
        details_url: `https://stock.adobe.com/images/${id}`,
      });
    }

    // Apply filtering
    let filtered = generatedAssets;

    if (params.ai === 'non_ai') {
      filtered = filtered.filter((a) => !a.is_generative_ai);
    } else if (params.ai === 'ai_only') {
      filtered = filtered.filter((a) => a.is_generative_ai);
    }

    if (params.contentType && params.contentType !== 'all') {
      const typeMap: Record<string, string> = {
        photo: 'Photo/Image',
        illustration: 'Illustration',
        vector: 'Vector',
        '3d': '3D',
      };
      const target = typeMap[params.contentType];
      if (target) {
        filtered = filtered.filter((a) => a.content_type === target);
      }
    }

    // Sort
    if (params.sort === 'creation') {
      filtered.sort((a, b) => new Date(b.creation_date).getTime() - new Date(a.creation_date).getTime());
    } else if (params.sort === 'nb_downloads') {
      filtered.sort((a, b) => (b.nb_downloads || 0) - (a.nb_downloads || 0));
    }

    const startIndex = (page - 1) * pageSize;
    const pageAssets = filtered.slice(startIndex, startIndex + pageSize);

    return {
      assets: pageAssets,
      total: totalCount,
      totalAI,
      totalNonAI,
      page,
      pageSize,
      isDemo: true,
    };
  }
}
