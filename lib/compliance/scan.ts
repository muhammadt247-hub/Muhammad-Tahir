import { BUILT_IN_BLOCKLIST, AMBIGUOUS_TERMS } from '@/config/compliance';
import { BlockedTermMatch } from '@/lib/generator/queue';

/**
 * Normalizes string for compliance matching:
 * - lowercases
 * - decomposes and removes diacritics
 * - normalizes punctuation
 */
function normalizeForMatch(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Escapes string for RegExp
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a regex pattern that matches the term as a whole word or phrase,
 * including possessive suffixes like 's or '
 */
function buildTermRegex(term: string): RegExp {
  const cleanTerm = escapeRegExp(term.trim());
  // Matches \bterm('s)?\b
  return new RegExp(`(?:^|\\b)${cleanTerm}(?:'s|’s)?(?:\\b|$)`, 'i');
}

/**
 * Strips known AI phrases from titles when Generative AI batch mode is enabled.
 */
export function stripAiPhrasesFromTitle(title: string): string {
  if (!title) return '';
  let cleaned = title;

  const aiCategory = BUILT_IN_BLOCKLIST.find((c) => c.id === 'ai_phrases');
  const aiPhrases = aiCategory ? aiCategory.terms : [
    'generative ai', 'ai generated', 'ai-generated', 'created with ai', 'made with ai',
    'midjourney', 'dall-e', 'dalle', 'stable diffusion', 'firefly'
  ];

  for (const phrase of aiPhrases) {
    const reg = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi');
    cleaned = cleaned.replace(reg, '');
  }

  // Also strip standalone "ai" if surrounded by punctuation or spaces
  cleaned = cleaned.replace(/\bAI\b/g, '');

  return cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*,\s*,+/g, ',')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .trim();
}

export interface FilterKeywordsResult {
  cleanKeywords: string[];
  removedCount: number;
  removedTerms: string[];
}

/**
 * Scans and filters banned terms from a list of keywords.
 * Removes blocked terms automatically.
 */
export function filterBannedKeywords(
  keywords: string[],
  customWords: string[] = [],
  isAiBatch: boolean = false
): FilterKeywordsResult {
  const removedTerms: string[] = [];
  const cleanKeywords: string[] = [];

  // Gather all blocked terms
  const allTermsWithCat: { term: string; category: string }[] = [];
  for (const cat of BUILT_IN_BLOCKLIST) {
    for (const t of cat.terms) {
      allTermsWithCat.push({ term: t.toLowerCase(), category: cat.name });
    }
  }

  for (const custom of customWords) {
    const t = custom.trim().toLowerCase();
    if (t) {
      allTermsWithCat.push({ term: t, category: 'Custom Blocklist' });
    }
  }

  for (const kw of keywords) {
    const normKw = normalizeForMatch(kw);
    if (!normKw) continue;

    let matchedTerm: string | null = null;

    // Check each blocked term
    for (const { term } of allTermsWithCat) {
      const rx = buildTermRegex(term);
      if (rx.test(normKw)) {
        // Exception: if ambiguous and not an AI batch keyword, allow or check
        if (AMBIGUOUS_TERMS.has(term) && normKw === term) {
          // If the keyword is exactly the ambiguous term (e.g. apple), we can keep it unless custom blocked
          const isCustom = customWords.map((c) => c.toLowerCase()).includes(term);
          if (!isCustom) {
            continue;
          }
        }
        matchedTerm = term;
        break;
      }
    }

    // If generative AI is ON, strip any AI labels
    if (isAiBatch) {
      const aiCat = BUILT_IN_BLOCKLIST.find((c) => c.id === 'ai_phrases');
      if (aiCat && aiCat.terms.some((t) => buildTermRegex(t).test(normKw))) {
        matchedTerm = normKw;
      }
    }

    if (matchedTerm) {
      removedTerms.push(kw);
    } else {
      cleanKeywords.push(kw);
    }
  }

  return {
    cleanKeywords,
    removedCount: removedTerms.length,
    removedTerms,
  };
}

export interface ScanComplianceResult {
  blockedTerms: BlockedTermMatch[];
  hasErrors: boolean; // red errors (item excluded from export until fixed)
  hasWarnings: boolean; // amber warnings (ambiguous terms user can approve)
}

/**
 * Scans title, description, and keywords for compliance issues.
 */
export function scanItemCompliance(
  title: string,
  keywords: string[],
  description: string = '',
  customWords: string[] = [],
  approvedTerms: string[] = [],
  isAiBatch: boolean = false
): ScanComplianceResult {
  const blockedTerms: BlockedTermMatch[] = [];
  const approvedSet = new Set(approvedTerms.map((t) => t.toLowerCase()));

  // Collect terms to check
  const termsToCheck: { term: string; category: string }[] = [];
  for (const cat of BUILT_IN_BLOCKLIST) {
    for (const t of cat.terms) {
      termsToCheck.push({ term: t.toLowerCase(), category: cat.name });
    }
  }
  for (const custom of customWords) {
    const t = custom.trim().toLowerCase();
    if (t) {
      termsToCheck.push({ term: t, category: 'Custom Blocklist' });
    }
  }

  const checkText = (text: string, field: 'title' | 'description' | 'keywords') => {
    if (!text) return;
    const norm = normalizeForMatch(text);

    for (const { term, category } of termsToCheck) {
      if (approvedSet.has(term)) continue;

      const rx = buildTermRegex(term);
      if (rx.test(norm)) {
        const isAmbiguous = AMBIGUOUS_TERMS.has(term) && !customWords.map((c) => c.toLowerCase()).includes(term);

        // Check if already recorded for this field
        const exists = blockedTerms.some(
          (b) => b.term.toLowerCase() === term && b.field === field
        );
        if (!exists) {
          blockedTerms.push({
            term,
            category,
            field,
            isAmbiguous,
          });
        }
      }
    }

    // Check generative AI phrases if isAiBatch is enabled
    if (isAiBatch) {
      const aiCat = BUILT_IN_BLOCKLIST.find((c) => c.id === 'ai_phrases');
      if (aiCat) {
        for (const t of aiCat.terms) {
          if (approvedSet.has(t)) continue;
          if (buildTermRegex(t).test(norm)) {
            const exists = blockedTerms.some(
              (b) => b.term.toLowerCase() === t && b.field === field
            );
            if (!exists) {
              blockedTerms.push({
                term: t,
                category: 'AI-Label Phrases',
                field,
                isAmbiguous: false,
              });
            }
          }
        }
      }
    }
  };

  checkText(title, 'title');
  if (description) checkText(description, 'description');

  for (const kw of keywords) {
    checkText(kw, 'keywords');
  }

  const hasErrors = blockedTerms.some((b) => !b.isAmbiguous);
  const hasWarnings = blockedTerms.some((b) => b.isAmbiguous);

  return {
    blockedTerms,
    hasErrors,
    hasWarnings,
  };
}
