import { SeoCheckItem, GeneratorItemState } from '@/lib/generator/queue';

const GENERIC_TITLE_PREFIXES = [
  'a photo of',
  'photo of',
  'an image of',
  'image of',
  'picture of',
  'a picture of',
  'beautiful',
  'stunning',
  'high quality',
  'close-up of',
  'vector of',
  'illustration of',
  'close up of',
  'top view of',
  'isolated',
];

export interface SeoAnalysisResult {
  score: number; // 0 - 100
  checklist: SeoCheckItem[];
  passedCount: number;
  totalCount: number;
}

/**
 * Calculates Adobe Stock SEO checklist score and breakdown for an item.
 */
export function calculateItemSeoScore(item: GeneratorItemState): SeoAnalysisResult {
  const checklist: SeoCheckItem[] = [];

  const title = (item.title || '').trim();
  const keywords = (item.keywords || []).map((k) => k.trim()).filter(Boolean);

  // 1. Title Length check (Optimal: 40-80 chars)
  const titleLen = title.length;
  if (titleLen >= 40 && titleLen <= 90) {
    checklist.push({
      id: 'title_length',
      name: 'Optimal title length (40-90 chars)',
      passed: true,
      reason: `Length is ${titleLen} characters (ideal balance of detail and search readability).`,
    });
  } else if (titleLen >= 25 && titleLen <= 120) {
    checklist.push({
      id: 'title_length',
      name: 'Acceptable title length',
      passed: true,
      reason: `Length is ${titleLen} characters (acceptable, though 40-90 is optimal).`,
    });
  } else {
    checklist.push({
      id: 'title_length',
      name: 'Title length issue',
      passed: false,
      reason: titleLen < 25 ? 'Title is too short (< 25 chars).' : 'Title is too long (> 120 chars).',
    });
  }

  // 2. Starts with main subject / who/what/where (No fluff prefix)
  const titleLower = title.toLowerCase();
  const hasFluffPrefix = GENERIC_TITLE_PREFIXES.some((prefix) =>
    titleLower.startsWith(prefix)
  );

  if (!hasFluffPrefix && title.length > 0) {
    checklist.push({
      id: 'title_subject_first',
      name: 'Subject-first title phrasing',
      passed: true,
      reason: 'Title opens directly with the primary subject or activity.',
    });
  } else {
    checklist.push({
      id: 'title_subject_first',
      name: 'Avoid filler opening words',
      passed: false,
      reason: 'Avoid generic openers like "A photo of", "Beautiful", "Stunning", or "High quality".',
    });
  }

  // 3. Comma limit in title (At most 2 commas)
  const commaCount = (title.match(/,/g) || []).length;
  if (commaCount <= 2) {
    checklist.push({
      id: 'title_commas',
      name: 'Natural punctuation (≤ 2 commas)',
      passed: true,
      reason: `Title contains ${commaCount} comma(s). Adobe penalizes titles structured as comma-separated tag lists.`,
    });
  } else {
    checklist.push({
      id: 'title_commas',
      name: 'Too many commas in title',
      passed: false,
      reason: `Found ${commaCount} commas. Adobe requires natural sentences, not keyword lists. Maximum 2 commas.`,
    });
  }

  // 4. No trailing period or punctuation clutter
  const hasTrailingPeriod = /[.!?]+$/.test(title);
  const hasProhibitedChars = /[#@*`"'{}[\]]/.test(title);
  if (!hasTrailingPeriod && !hasProhibitedChars) {
    checklist.push({
      id: 'title_clean_chars',
      name: 'Clean title formatting',
      passed: true,
      reason: 'No trailing periods, hashtags, quotation marks, or emojis.',
    });
  } else {
    checklist.push({
      id: 'title_clean_chars',
      name: 'Formatting clutter in title',
      passed: false,
      reason: hasTrailingPeriod
        ? 'Remove trailing period or punctuation at end of title.'
        : 'Remove hashtags, quotes, or special characters.',
    });
  }

  // 5. Keyword count (Adobe optimal: 25 - 49)
  const kwCount = keywords.length;
  if (kwCount >= 25 && kwCount <= 49) {
    checklist.push({
      id: 'keyword_count',
      name: 'Optimal keyword volume (25-49 tags)',
      passed: true,
      reason: `Contains ${kwCount} keywords (within Adobe's recommended 25-49 range).`,
    });
  } else if (kwCount >= 15 && kwCount <= 50) {
    checklist.push({
      id: 'keyword_count',
      name: 'Adequate keyword count (15-24 tags)',
      passed: true,
      reason: `Contains ${kwCount} keywords. Consider expanding toward 30-45 for higher discoverability.`,
    });
  } else {
    checklist.push({
      id: 'keyword_count',
      name: 'Keyword count out of range',
      passed: false,
      reason: kwCount < 15 ? `Only ${kwCount} keywords (minimum recommended is 15-25).` : `Exceeds Adobe Stock 49-tag ceiling (${kwCount} tags).`,
    });
  }

  // 6. Redundant singular / plural keywords
  const lowerKws = keywords.map((k) => k.toLowerCase());
  let hasPluralRedundancy = false;
  for (const k of lowerKws) {
    if (k.endsWith('s') && lowerKws.includes(k.slice(0, -1))) {
      hasPluralRedundancy = true;
      break;
    }
  }

  if (!hasPluralRedundancy) {
    checklist.push({
      id: 'no_redundant_plurals',
      name: 'No redundant singular/plural pairs',
      passed: true,
      reason: 'Adobe search automatically matches plurals; no wasted duplicate tags.',
    });
  } else {
    checklist.push({
      id: 'no_redundant_plurals',
      name: 'Redundant singular & plural detected',
      passed: false,
      reason: 'Contains both singular and plural forms of the same word (e.g. cat / cats). Keep only the primary form.',
    });
  }

  // 7. Compliance & Blocked terms check
  const blockedCount = (item.blockedTermsFound || []).filter((b) => !b.isAmbiguous).length;
  if (blockedCount === 0) {
    checklist.push({
      id: 'compliance_clear',
      name: 'Compliance check clear',
      passed: true,
      reason: 'No trademarked brands, living artist styles, or banned terms detected.',
    });
  } else {
    checklist.push({
      id: 'compliance_clear',
      name: 'Blocked terms detected',
      passed: false,
      reason: `${blockedCount} trademark or banned term(s) must be resolved before export.`,
    });
  }

  // 8. Title uniqueness & similarity check
  const similarCount = (item.similarTo || []).filter(
    (s) => s.reason === 'high_similarity' || s.reason === 'same_opening_words'
  ).length;

  if (similarCount === 0) {
    checklist.push({
      id: 'title_uniqueness',
      name: 'Distinctive title in batch',
      passed: true,
      reason: 'Title does not duplicate other items in this batch.',
    });
  } else {
    checklist.push({
      id: 'title_uniqueness',
      name: 'Near-identical title detected',
      passed: false,
      reason: 'Title is very similar or shares opening words with another file in this batch.',
    });
  }

  // Calculate score (0 - 100)
  const passedCount = checklist.filter((c) => c.passed).length;
  const totalCount = checklist.length;
  const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  return {
    score,
    checklist,
    passedCount,
    totalCount,
  };
}
