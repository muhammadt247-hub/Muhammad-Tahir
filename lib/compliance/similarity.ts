import { GeneratorItemState, SimilarTitleMatch } from '@/lib/generator/queue';

const COMMON_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
  'is', 'are', 'was', 'were', 'it', 'its', 'as', 'from', 'into', 'onto'
]);

/**
 * Basic Porter-like suffix stripper for lightweight English stemming
 */
function simpleStem(word: string): string {
  if (word.length <= 4) return word;
  if (word.endsWith('ing')) return word.slice(0, -3);
  if (word.endsWith('tion')) return word.slice(0, -4);
  if (word.endsWith('ed')) return word.slice(0, -2);
  if (word.endsWith('ly')) return word.slice(0, -2);
  if (word.endsWith('es')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * Normalizes title into filtered, stemmed word tokens
 */
export function tokenizeTitle(title: string): string[] {
  if (!title) return [];
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !COMMON_STOP_WORDS.has(w))
    .map(simpleStem);
}

/**
 * Generates character trigrams from text
 */
function getTrigrams(text: string): Map<string, number> {
  const clean = `  ${text.toLowerCase().replace(/[^a-z0-9]/g, ' ')}  `;
  const map = new Map<string, number>();
  for (let i = 0; i <= clean.length - 3; i++) {
    const tri = clean.substring(i, i + 3);
    map.set(tri, (map.get(tri) || 0) + 1);
  }
  return map;
}

/**
 * Jaccard similarity between two token sets
 */
function jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Cosine similarity between character trigram frequency maps
 */
function cosineTrigramSimilarity(textA: string, textB: string): number {
  const mapA = getTrigrams(textA);
  const mapB = getTrigrams(textB);
  if (mapA.size === 0 || mapB.size === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [, val] of mapA) {
    normA += val * val;
  }
  for (const [, val] of mapB) {
    normB += val * val;
  }

  for (const [tri, countA] of mapA) {
    const countB = mapB.get(tri);
    if (countB) {
      dotProduct += countA * countB;
    }
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

/**
 * Calculates similarity between two titles taking the higher of Jaccard or Cosine
 */
export function calculateTitleSimilarity(titleA: string, titleB: string): number {
  if (!titleA || !titleB) return 0;
  if (titleA.trim().toLowerCase() === titleB.trim().toLowerCase()) return 1.0;

  const tokensA = tokenizeTitle(titleA);
  const tokensB = tokenizeTitle(titleB);

  const jaccard = jaccardSimilarity(tokensA, tokensB);
  const cosine = cosineTrigramSimilarity(titleA, titleB);

  return Math.max(jaccard, cosine);
}

/**
 * Checks if two titles share the exact same first 4 words
 */
function checkSameFirstFourWords(titleA: string, titleB: string): boolean {
  const wordsA = titleA.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).slice(0, 4);
  const wordsB = titleB.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).slice(0, 4);

  if (wordsA.length < 4 || wordsB.length < 4) return false;
  return wordsA.join(' ') === wordsB.join(' ');
}

/**
 * Checks keyword overlap percentage
 */
export function calculateKeywordOverlap(kwsA: string[], kwsB: string[]): number {
  if (!kwsA || !kwsB || kwsA.length === 0 || kwsB.length === 0) return 0;
  const setA = new Set(kwsA.map((k) => k.toLowerCase().trim()));
  const setB = new Set(kwsB.map((k) => k.toLowerCase().trim()));

  let matches = 0;
  for (const k of setA) {
    if (setB.has(k)) matches++;
  }

  const minLen = Math.min(setA.size, setB.size);
  return minLen > 0 ? matches / minLen : 0;
}

/**
 * Scans a list of items for title similarities and keyword overlaps.
 * Supports Strict (0.55), Normal (0.65), Relaxed (0.75) thresholds.
 * Highly optimized for up to 200 items.
 */
export function computeBatchSimilarities(
  items: GeneratorItemState[],
  uniqueness: 'strict' | 'normal' | 'relaxed' = 'normal'
): Map<string, SimilarTitleMatch[]> {
  const thresholdMap = {
    strict: 0.55,
    normal: 0.65,
    relaxed: 0.75,
  };
  const threshold = thresholdMap[uniqueness] || 0.65;
  const results = new Map<string, SimilarTitleMatch[]>();

  // Only run title similarity on items that have a real generated title (never filename as title)
  const activeItems = items.filter(
    (item) =>
      item.status === 'done' &&
      Boolean(item.title?.trim()) &&
      item.title.trim() !== item.fileData.originalName
  );

  if (activeItems.length < 2) {
    return results;
  }

  // Pre-tokenize and pre-trigram
  const prepared = activeItems.map((item) => ({
    id: item.id,
    filename: item.fileData.originalName,
    title: item.title.trim(),
    tokens: tokenizeTitle(item.title.trim()),
    keywords: item.keywords || [],
    firstFourWords: item.title.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).slice(0, 4).join(' ') || '',
  }));

  // Track first 4 words occurrences
  const firstFourCount = new Map<string, number>();
  for (const p of prepared) {
    if (p.firstFourWords.split(' ').length >= 4) {
      firstFourCount.set(p.firstFourWords, (firstFourCount.get(p.firstFourWords) || 0) + 1);
    }
  }

  for (let i = 0; i < prepared.length; i++) {
    const itemA = prepared[i];
    const matches: SimilarTitleMatch[] = [];

    // Check if more than 3 items start with the same first 4 words
    if (
      itemA.firstFourWords &&
      (firstFourCount.get(itemA.firstFourWords) || 0) > 3
    ) {
      matches.push({
        otherId: '',
        otherFilename: `${firstFourCount.get(itemA.firstFourWords)} items share opening words: "${itemA.firstFourWords}"`,
        score: 0.8,
        reason: 'same_opening_words',
      });
    }

    for (let j = 0; j < prepared.length; j++) {
      if (i === j) continue;
      const itemB = prepared[j];
      // Never show a file as similar to itself
      if (
        itemA.id === itemB.id ||
        itemA.filename.toLowerCase().trim() === itemB.filename.toLowerCase().trim()
      ) {
        continue;
      }

      // Check title similarity
      if (itemA.title && itemB.title) {
        const score = calculateTitleSimilarity(itemA.title, itemB.title);
        if (score >= threshold) {
          matches.push({
            otherId: itemB.id,
            otherFilename: itemB.filename,
            score: Number(score.toFixed(2)),
            reason: 'high_similarity',
          });
          continue;
        }
      }

      // Check keyword overlap (> 80%)
      if (itemA.keywords.length > 5 && itemB.keywords.length > 5) {
        const overlap = calculateKeywordOverlap(itemA.keywords, itemB.keywords);
        if (overlap >= 0.8) {
          matches.push({
            otherId: itemB.id,
            otherFilename: itemB.filename,
            score: Number(overlap.toFixed(2)),
            reason: 'keyword_overlap',
          });
        }
      }
    }

    if (matches.length > 0) {
      results.set(itemA.id, matches);
    }
  }

  return results;
}
