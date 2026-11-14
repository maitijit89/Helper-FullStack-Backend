const STOP_WORDS = new Set([
  'a',
  'about',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'was',
  'were',
  'will',
  'with',
  'buy',
  'get',
  'need',
  'want',
]);

/**
 * Escapes special regular expression metacharacters to safely use user input in RegExp queries
 * Preventing ReDoS and unhandled SyntaxError attacks
 */
export function escapeRegex(text: any): string {
  if (typeof text !== 'string') {
    return '';
  }
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Computes Levenshtein edit distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;

  if (al === 0) return bl;
  if (bl === 0) return al;

  const matrix: number[][] = [];

  for (let i = 0; i <= al; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= bl; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );

      // Damerau transposition check
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }

  return matrix[al][bl];
}

/**
 * Computes similarity ratio between 0.0 and 1.0
 */
export function calculateSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return Math.max(0, 1.0 - dist / maxLen);
}

/**
 * Normalizes, strips punctuation, and extracts meaningful search tokens
 */
export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t));
}

/**
 * Finds the closest matching dictionary term for a misspelled token
 */
export function findClosestTerm(
  token: string,
  dictionary: string[],
  maxAllowedDistance: number = 2
): string | null {
  const lower = token.toLowerCase();
  let bestMatch: string | null = null;
  let minDistance = Infinity;

  for (const dictTerm of dictionary) {
    const lowerDict = dictTerm.toLowerCase();
    if (lowerDict === lower) {
      return dictTerm;
    }

    const dist = levenshteinDistance(lower, lowerDict);
    if (dist <= maxAllowedDistance && dist < minDistance) {
      minDistance = dist;
      bestMatch = dictTerm;
    }
  }

  return bestMatch;
}
