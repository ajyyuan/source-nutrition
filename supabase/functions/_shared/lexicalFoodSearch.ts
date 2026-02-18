export type CanonicalFoodLookupItem = {
  canonical_id: string;
  canonical_name: string;
};

export type CanonicalFoodSuggestion = CanonicalFoodLookupItem & {
  lexical_score: number;
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokenize = (value: string) =>
  normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

const scoreCandidate = (query: string, candidateName: string) => {
  const normalizedQuery = normalizeText(query);
  const normalizedCandidate = normalizeText(candidateName);

  if (!normalizedQuery || !normalizedCandidate) {
    return 0;
  }

  let score = 0;
  if (normalizedCandidate === normalizedQuery) {
    score += 1.2;
  } else if (normalizedCandidate.startsWith(`${normalizedQuery} `)) {
    score += 0.95;
  } else if (normalizedCandidate.startsWith(normalizedQuery)) {
    score += 0.85;
  } else if (normalizedCandidate.includes(` ${normalizedQuery} `)) {
    score += 0.75;
  } else if (
    normalizedCandidate.endsWith(` ${normalizedQuery}`) ||
    normalizedCandidate.includes(normalizedQuery)
  ) {
    score += 0.6;
  }

  const queryTokens = tokenize(normalizedQuery);
  const candidateTokenSet = new Set(tokenize(normalizedCandidate));
  if (!queryTokens.length || !candidateTokenSet.size) {
    return score;
  }

  const overlap = queryTokens.filter((token) => candidateTokenSet.has(token)).length;
  if (!overlap) {
    return score;
  }

  const precision = overlap / queryTokens.length;
  const recall = overlap / candidateTokenSet.size;
  const tokenF1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  score += tokenF1 * 0.7;

  if (queryTokens.length === 1 && candidateTokenSet.has(queryTokens[0])) {
    score += 0.15;
  }

  return score;
};

export const rankCanonicalFoodSuggestions = (
  query: string,
  foods: CanonicalFoodLookupItem[],
  limit = 8
): CanonicalFoodSuggestion[] => {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  const boundedLimit = Math.max(1, Math.min(Math.round(limit), 12));
  return foods
    .map((food) => ({
      canonical_id: food.canonical_id,
      canonical_name: food.canonical_name,
      lexical_score: scoreCandidate(trimmed, food.canonical_name)
    }))
    .filter((candidate) => candidate.lexical_score > 0.2)
    .sort((a, b) => {
      if (b.lexical_score !== a.lexical_score) {
        return b.lexical_score - a.lexical_score;
      }
      if (a.canonical_name.length !== b.canonical_name.length) {
        return a.canonical_name.length - b.canonical_name.length;
      }
      return a.canonical_name.localeCompare(b.canonical_name);
    })
    .slice(0, boundedLimit);
};
