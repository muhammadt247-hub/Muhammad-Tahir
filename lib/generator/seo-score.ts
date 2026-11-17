import { SeoCheckItem, GeneratorItemState } from '@/lib/generator/queue';
import { stripLabels } from '@/lib/generator/post-process';

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

const STOP_WORDS = new Set([
  'the', 'and', 'with', 'for', 'from', 'into', 'onto', 'over', 'under', 'near', 'behind', 'about', 'this', 'that',
  'their', 'its', 'his', 'her', 'are', 'is', 'on', 'in', 'at', 'of', 'to', 'by', 'a', 'an', 'or', 'as', 'while',
  'background', 'isolated', 'white', 'transparent', 'view', 'concept',
]);

const COLOR_WORDS = new Set([
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'violet', 'pink', 'brown', 'black', 'white',
  'gray', 'grey', 'beige', 'turquoise', 'teal', 'cyan', 'magenta', 'gold', 'golden', 'silver', 'navy',
]);

// Official limits per stock site (checked Nov 2026). "good" is a sensible range, not just the maximum.
const RULES: Record<string, { name: string; titleGood: [number, number]; titleMax: number; kwMin: number; kwMax: number; noCommas: boolean }> = {
  'adobe-stock': { name: 'Adobe Stock', titleGood: [35, 70], titleMax: 70, kwMin: 15, kwMax: 49, noCommas: true },
  shutterstock: { name: 'Shutterstock', titleGood: [40, 200], titleMax: 2048, kwMin: 7, kwMax: 50, noCommas: false },
  freepik: { name: 'Freepik', titleGood: [35, 100], titleMax: 100, kwMin: 5, kwMax: 50, noCommas: false },
  general: { name: 'General', titleGood: [40, 120], titleMax: 200, kwMin: 10, kwMax: 50, noCommas: false },
};

function stem(w: string): string {
  const x = w.toLowerCase();
  if (x.length > 4 && x.endsWith('ies')) return x.slice(0, -3) + 'y';
  if (x.length > 4 && x.endsWith('ing')) return x.slice(0, -3);
  if (x.length > 3 && x.endsWith('s') && !x.endsWith('ss')) return x.slice(0, -1);
  return x;
}

export interface SeoAnalysisResult {
  score: number; // 0 - 100
  checklist: SeoCheckItem[];
  passedCount: number;
  totalCount: number;
}

/**
 * Metadata quality checklist for one item, following the selected stock site's rules.
 * It never rewards more keywords for their own sake, and it flags keyword stuffing.
 */
export function calculateItemSeoScore(item: GeneratorItemState, platform: string = 'adobe-stock'): SeoAnalysisResult {
  const rules = RULES[platform] || RULES['adobe-stock'];
  const checklist: SeoCheckItem[] = [];
  const add = (id: string, passed: boolean, name: string, reason: string) => checklist.push({ id, name, passed, reason });

  const title = (item.title || '').trim();
  const keywords = (item.keywords || []).map((k) => k.trim()).filter(Boolean);
  const lowerKws = keywords.map((k) => k.toLowerCase());

  // 1. Title length for the selected site
  const titleLen = title.length;
  const [goodMin, goodMax] = rules.titleGood;
  if (titleLen > rules.titleMax) {
    add('title_length', false, 'Title too long', `${titleLen} characters. ${rules.name} allows at most ${rules.titleMax}. Shorten it to the main subject, action and setting.`);
  } else if (titleLen >= goodMin && titleLen <= goodMax) {
    add('title_length', true, `Good title length (${goodMin}-${goodMax})`, `${titleLen} characters, a good length for ${rules.name}.`);
  } else if (titleLen >= 20) {
    add('title_length', true, 'Acceptable title length', `${titleLen} characters. ${goodMin}-${goodMax} works best for ${rules.name}; add a detail such as setting, colour or action.`);
  } else {
    add('title_length', false, 'Title too short', `Only ${titleLen} characters. Describe who or what, doing what, and where.`);
  }

  // 2. Subject first, no filler opening
  const titleLower = title.toLowerCase();
  const hasFluffPrefix = GENERIC_TITLE_PREFIXES.some((p) => titleLower.startsWith(p));
  add(
    'title_subject_first',
    !hasFluffPrefix && titleLen > 0,
    hasFluffPrefix ? 'Avoid filler opening words' : 'Subject-first title',
    hasFluffPrefix
      ? 'Start with the main subject instead of words like "A photo of", "Beautiful", "Stunning" or "High quality".'
      : 'The title opens with the main subject.'
  );

  // 3. Punctuation: Adobe wants no commas at all; others accept a natural sentence
  const commaCount = (title.match(/,/g) || []).length;
  const commasOk = rules.noCommas ? commaCount === 0 : commaCount <= 2;
  add(
    'title_commas',
    commasOk,
    commasOk ? 'Natural title, not a keyword list' : 'Title reads like a keyword list',
    commasOk
      ? 'The title reads as a phrase, not a list of tags.'
      : rules.noCommas
        ? `${rules.name} titles should have no commas. Rewrite it as one plain phrase.`
        : `Found ${commaCount} commas. Write one natural sentence instead of a list.`
  );

  // 4. Clean characters, no AI labels or file types
  const hasTrailingPeriod = /[.!?]+$/.test(title);
  const hasProhibitedChars = /[#@*`"{}[\]]/.test(title);
  const labelsInTitle = stripLabels(title).length !== title.replace(/\s{2,}/g, ' ').length;
  const labelKws = keywords.filter((k) => stripLabels(k).length !== k.replace(/\s{2,}/g, ' ').length);
  const numbersInTitle = platform === 'freepik' && /\b\d+\b/.test(title.replace(/\b3d\b/gi, ''));
  const cleanOk = !hasTrailingPeriod && !hasProhibitedChars && !labelsInTitle && labelKws.length === 0 && !numbersInTitle;
  add(
    'title_clean_chars',
    cleanOk,
    cleanOk ? 'Clean wording' : 'Remove labels, file types or symbols',
    cleanOk
      ? 'No symbols, AI labels or file types in the title or keywords.'
      : labelsInTitle || labelKws.length
        ? 'Remove words like "AI generated", tool names or file types (JPG, EPS). Agencies use their own AI checkbox or tag instead.'
        : numbersInTitle
          ? 'Freepik titles should not contain numbers or dates (festivities are fine).'
          : 'Remove the trailing period, hashtags, quotes or special characters.'
  );

  // 5. Keyword count within the site's official range (more is not better)
  const kwCount = keywords.length;
  const countOk = kwCount >= rules.kwMin && kwCount <= rules.kwMax;
  add(
    'keyword_count',
    countOk,
    countOk ? 'Keyword count within limits' : 'Keyword count out of range',
    countOk
      ? `${kwCount} keywords (${rules.name} allows ${rules.kwMin}-${rules.kwMax}). Relevance matters more than quantity.`
      : kwCount < rules.kwMin
        ? `Only ${kwCount} keywords. Add relevant ones (subject, action, setting, concept) to reach at least ${rules.kwMin}.`
        : `${kwCount} keywords is over the ${rules.name} limit of ${rules.kwMax}. Remove the least relevant ones.`
  );

  // 6. Singular/plural pairs
  let pluralPair = '';
  for (const k of lowerKws) {
    if (k.endsWith('s') && lowerKws.includes(k.slice(0, -1))) {
      pluralPair = `${k.slice(0, -1)} / ${k}`;
      break;
    }
  }
  add(
    'no_redundant_plurals',
    !pluralPair,
    pluralPair ? 'Singular and plural of the same word' : 'No singular/plural duplicates',
    pluralPair ? `Keep only one of "${pluralPair}"; search already matches both.` : 'No wasted duplicate keywords.'
  );

  // 7. Keyword stuffing: the same word repeated across many keywords
  const rootCounts = new Map<string, number>();
  for (const k of lowerKws) {
    const roots = new Set(k.split(/[\s-]+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w)).map(stem));
    for (const r of roots) rootCounts.set(r, (rootCounts.get(r) || 0) + 1);
  }
  const stuffed = [...rootCounts.entries()].filter(([, n]) => n > 3).map(([w]) => w);
  const colourCount = lowerKws.filter((k) => COLOR_WORDS.has(k)).length;
  const colourSpam = platform === 'freepik' ? colourCount > 2 : colourCount > 5;
  add(
    'no_keyword_stuffing',
    stuffed.length === 0 && !colourSpam,
    stuffed.length || colourSpam ? 'Possible keyword stuffing' : 'No keyword stuffing',
    stuffed.length
      ? `"${stuffed.slice(0, 3).join('", "')}" appears in more than 3 keywords. Replace repeats with different relevant ideas.`
      : colourSpam
        ? `${colourCount} colour keywords. Keep the main colour (or "colorful") and use the space for other ideas.`
        : 'Keywords cover different ideas instead of repeating the same word.'
  );

  // 8. Title and keywords agree (relevance), and the main words lead the list
  const original = new Map<string, string>(); // stem -> word as written in the title (for the suggestion text)
  for (const w of titleLower.split(/[^a-z0-9]+/)) if (w.length > 3 && !STOP_WORDS.has(w) && !original.has(stem(w))) original.set(stem(w), w);
  const titleWords = [...original.keys()];
  const kwText = lowerKws.map((k) => k.split(/[\s-]+/).map(stem).join(' ')).join(' | ');
  const top10Text = lowerKws.slice(0, 10).map((k) => k.split(/[\s-]+/).map(stem).join(' ')).join(' | ');
  const covered = titleWords.filter((w) => new RegExp(`(^|[ |])${w}($|[ |])`).test(kwText));
  const inTop10 = titleWords.filter((w) => new RegExp(`(^|[ |])${w}($|[ |])`).test(top10Text));
  const coverage = titleWords.length ? covered.length / titleWords.length : 1;
  const relevanceOk = coverage >= 0.5 && (titleWords.length < 2 || inTop10.length >= Math.min(2, titleWords.length));
  const missing = titleWords.filter((w) => !covered.includes(w)).slice(0, 3).map((w) => original.get(w) || w);
  add(
    'title_keyword_match',
    relevanceOk,
    relevanceOk ? 'Title and keywords agree' : 'Title and keywords do not match well',
    relevanceOk
      ? 'The main words of the title are in the keywords, near the top.'
      : missing.length
        ? `Add the title's main words as keywords (for example "${missing.join('", "')}") and put them in the first 10.`
        : 'Move the main subject words of the title into the first 10 keywords.'
  );

  // 9. Compliance (trademarks, artists, banned terms found by the compliance scan)
  const blockedCount = (item.blockedTermsFound || []).filter((b) => !b.isAmbiguous).length;
  add(
    'compliance_clear',
    blockedCount === 0,
    blockedCount === 0 ? 'Compliance check clear' : 'Blocked terms detected',
    blockedCount === 0
      ? 'No trademarks, artist names or banned terms detected.'
      : `${blockedCount} trademark or banned term(s) must be removed before export.`
  );

  // 10. Distinct from other titles in the batch
  const similarCount = (item.similarTo || []).filter((s) => s.reason === 'high_similarity' || s.reason === 'same_opening_words').length;
  add(
    'title_uniqueness',
    similarCount === 0,
    similarCount === 0 ? 'Distinctive title in batch' : 'Near-identical title detected',
    similarCount === 0
      ? 'The title is different from the other files in this batch.'
      : 'The title is very similar to another file in this batch. Describe what is different in this image.'
  );

  const passedCount = checklist.filter((c) => c.passed).length;
  const totalCount = checklist.length;
  const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
  return { score, checklist, passedCount, totalCount };
}
