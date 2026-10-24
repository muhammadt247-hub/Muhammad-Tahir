// Helper to trim text to maxLength at a word boundary
export function trimAtWordBoundary(text: string, maxLength: number): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const sub = trimmed.substring(0, maxLength);
  const lastSpace = sub.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.4) {
    return sub.substring(0, lastSpace).trim();
  }
  return sub.trim();
}

// Clean an AI-written title: keep only letters, numbers, spaces, hyphens and apostrophes,
// collapse spaces, and remove a word that repeats right after itself.
export function cleanTitleText(text: string): string {
  if (!text) return '';
  const stripped = text
    .replace(/[^\p{L}\p{N}\s'\u2019-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = stripped.split(' ');
  const out: string[] = [];
  for (const w of words) {
    if (out.length > 0 && out[out.length - 1].toLowerCase() === w.toLowerCase()) continue;
    out.push(w);
  }
  return out.join(' ').trim();
}

// Simple singular form used only to spot singular/plural duplicates (icon / icons)
function singularKey(word: string): string {
  const w = word.toLowerCase();
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && /(s|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

const KEYWORD_STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'on', 'and', 'with', 'for', 'in', 'at', 'to']);

// Remove exact and singular/plural duplicates, and allow at most 2 keywords sharing the same root word.
export function dedupeKeywordsSmart(keywords: string[]): string[] {
  const seenFull = new Set<string>();
  const rootCount = new Map<string, number>();
  const result: string[] = [];

  for (const raw of keywords) {
    const kw = raw.trim().toLowerCase();
    if (!kw) continue;
    const fullKey = kw.split(/\s+/).map(singularKey).join(' ');
    if (seenFull.has(fullKey)) continue;

    const roots = kw
      .split(/\s+/)
      .filter((t) => !KEYWORD_STOP_WORDS.has(t))
      .map(singularKey);
    if (roots.some((r) => (rootCount.get(r) || 0) >= 2)) continue;

    seenFull.add(fullKey);
    for (const r of new Set(roots)) rootCount.set(r, (rootCount.get(r) || 0) + 1);
    result.push(kw);
  }
  return result;
}

export interface PostProcessMetadataOptions {
  titleMaxLength: number;
  keywordsMaxCount: number;
  hasAlphaChannel?: boolean;
  isPrefixEnabled?: boolean;
  titlePrefix?: string;
  isSuffixEnabled?: boolean;
  titleSuffix?: string;
  isNegativeTitleWordsEnabled?: boolean;
  negativeTitleWords?: string;
  isNegativeKeywordsEnabled?: boolean;
  negativeKeywords?: string;
  isAdditionalKeywordsEnabled?: boolean;
  additionalKeywords?: string[];
}

export function postProcessMetadata<
  T extends {
    title: string;
    description?: string;
    keywords: string[];
    flags?: Record<string, unknown>;
    flagReasons?: string[];
  }
>(
  item: T,
  options: PostProcessMetadataOptions
): T & {
  title: string;
  description?: string;
  keywords: string[];
  flags: Record<string, unknown>;
  flagReasons: string[];
} {
  let title = cleanTitleText(item.title || '');

  // 1. Filter negative title words
  if (options.isNegativeTitleWordsEnabled && options.negativeTitleWords) {
    const banned = options.negativeTitleWords
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);

    for (const b of banned) {
      const reg = new RegExp(`\\b${b}\\b`, 'gi');
      title = title.replace(reg, '').replace(/\s{2,}/g, ' ').trim();
    }
  }

  // 2. Apply prefix & suffix
  const prefix = options.isPrefixEnabled && options.titlePrefix ? `${options.titlePrefix.trim()} ` : '';
  const suffix = options.isSuffixEnabled && options.titleSuffix ? ` ${options.titleSuffix.trim()}` : '';
  title = `${prefix}${title}${suffix}`.trim();

  // 3. Add transparent background phrase if transparent PNG
  if (options.hasAlphaChannel) {
    const phrase = 'isolated on transparent background';
    if (!title.toLowerCase().includes('transparent')) {
      if (title.length + phrase.length + 2 <= options.titleMaxLength) {
        title = `${title}, ${phrase}`;
      }
    }
  }

  // 4. Enforce title length limit at word boundary
  title = trimAtWordBoundary(title, options.titleMaxLength);

  // 5. Clean and post-process keywords
  let keywords = dedupeKeywordsSmart((item.keywords || []).map((k) => k.trim()).filter(Boolean));

  // Deduplicate case-insensitively while preserving original capitalization
  const seen = new Set<string>();
  const deduplicated: string[] = [];
  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      deduplicated.push(kw);
    }
  }
  keywords = deduplicated;

  // Filter negative keywords
  if (options.isNegativeKeywordsEnabled && options.negativeKeywords) {
    const bannedKws = new Set(
      options.negativeKeywords
        .split(',')
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean)
    );
    keywords = keywords.filter((k) => !bannedKws.has(k.toLowerCase()));
  }

  // Add transparent background keyword if applicable
  if (options.hasAlphaChannel) {
    const extraAlphaTags = ['isolated on transparent background', 'transparent background'];
    for (const tag of extraAlphaTags) {
      if (!keywords.map((k) => k.toLowerCase()).includes(tag.toLowerCase())) {
        keywords.unshift(tag);
      }
    }
  }

  // Merge additional keywords if enabled
  if (options.isAdditionalKeywordsEnabled && options.additionalKeywords && options.additionalKeywords.length > 0) {
    for (const extra of options.additionalKeywords) {
      const trimmedExtra = extra.trim();
      if (trimmedExtra && !keywords.map((k) => k.toLowerCase()).includes(trimmedExtra.toLowerCase())) {
        keywords.push(trimmedExtra);
      }
    }
  }

  // Keyword relevance check (Requirement 3):
  // Remove "ai" and "artificial intelligence" unless the image clearly shows the concept, using AI flags
  const flags = (item as { flags?: Record<string, unknown> }).flags || {};
  const aiKeywords = new Set(['ai', 'artificial intelligence', 'a.i.', 'artificial-intelligence']);
  const textToCheck = `${title} ${item.description || ''}`.toLowerCase();
  const visualShowsAiConcept =
    Boolean(flags.showsAiConcept) ||
    /\b(robot|robotics|cyborg|humanoid|android|neural network|machine learning|deep learning|cybernetic|synthetic intelligence|digital brain|microchip)\b/i.test(
      textToCheck
    );

  if (!visualShowsAiConcept) {
    keywords = keywords.filter((k) => !aiKeywords.has(k.trim().toLowerCase()));
  }

  // Cut keywords to max count
  keywords = keywords.slice(0, options.keywordsMaxCount);

  // Synchronize visibleTextOrLogo flag
  const updatedFlags = {
    identifiablePerson: false,
    privateProperty: false,
    visibleLogoOrBrand: false,
    visibleText: false,
    visibleTextOrLogo: false,
    possibleEditorial: false,
    showsAiConcept: false,
    ...flags,
  };
  if (updatedFlags.visibleText || updatedFlags.visibleLogoOrBrand) {
    updatedFlags.visibleTextOrLogo = true;
  }

  return {
    ...item,
    title,
    description: item.description,
    keywords,
    flags: updatedFlags,
    flagReasons: (item as { flagReasons?: string[] }).flagReasons || [],
  };
}

export interface PostProcessPromptOptions {
  promptMaxLength: number;
  promptPrefix?: string;
  isPromptPrefixEnabled?: boolean;
  promptSuffix?: string;
  isPromptSuffixEnabled?: boolean;
  negativePromptWords?: string;
  isNegativePromptWordsEnabled?: boolean;
  whiteBackground?: boolean;
  cameraParams?: boolean;
}

export function postProcessPrompt(
  prompt: string,
  options: PostProcessPromptOptions
): string {
  let result = prompt || '';

  // Filter negative words
  if (options.isNegativePromptWordsEnabled && options.negativePromptWords) {
    const banned = options.negativePromptWords
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);

    for (const b of banned) {
      const reg = new RegExp(`\\b${b}\\b`, 'gi');
      result = result.replace(reg, '').replace(/\s{2,}/g, ' ').trim();
    }
  }

  // Apply white background detail if enabled
  if (options.whiteBackground && !result.toLowerCase().includes('white background')) {
    result = `${result}, isolated on a pure white background`;
  }

  // Apply camera details if enabled
  if (options.cameraParams && !result.toLowerCase().includes('lens') && !result.toLowerCase().includes('aperture')) {
    result = `${result}, shot with 50mm f/1.8 lens, high dynamic range, crisp sharp focus`;
  }

  // Apply prefix & suffix
  const prefix = options.isPromptPrefixEnabled && options.promptPrefix ? `${options.promptPrefix.trim()} ` : '';
  const suffix = options.isPromptSuffixEnabled && options.promptSuffix ? ` ${options.promptSuffix.trim()}` : '';
  result = `${prefix}${result}${suffix}`.trim();

  // Enforce max length at word boundary
  return trimAtWordBoundary(result, options.promptMaxLength);
}