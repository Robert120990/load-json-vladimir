/**
 * Normalizes text for search: converts to lowercase, trims, and strips diacritics/accents.
 * E.g. "Raúl" -> "raul", "José" -> "jose"
 */
export function normalizeSearchText(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Checks if ALL words/tokens in the search query match somewhere in the target text or array of target texts.
 * E.g. Query: "raul sosa" matches "Raul Rafael Sosa Castellanos" -> true
 *      Query: "1101 caja" matches "110101 - Caja General" -> true
 *
 * @param target The target string or array of strings to search within.
 * @param searchQuery The search query entered by the user.
 * @returns true if every word in searchQuery is found in target.
 */
export function matchesSearchTokens(
  target: string | number | (string | number | null | undefined)[] | null | undefined,
  searchQuery: string
): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;

  const normalizedQuery = normalizeSearchText(searchQuery);
  const queryTokens = normalizedQuery.split(/\s+/).filter((token) => token.length > 0);

  if (queryTokens.length === 0) return true;

  let combinedTarget = '';
  if (Array.isArray(target)) {
    combinedTarget = target.map((t) => normalizeSearchText(t)).join(' ');
  } else {
    combinedTarget = normalizeSearchText(target);
  }

  // Every token must exist in the combined target text
  return queryTokens.every((token) => combinedTarget.includes(token));
}
