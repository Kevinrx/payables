import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

// Public, unauthenticated demo — a local wordlist deters casual vandalism, no API round-trip.
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export function containsProfanity(text: string | null | undefined): boolean {
  if (!text) return false;
  return matcher.hasMatch(text);
}

// Returns the label of the first profane field (for use directly in an error message), or null.
export function findProfaneField(
  fields: Record<string, string | null | undefined>
): string | null {
  for (const [label, value] of Object.entries(fields)) {
    if (containsProfanity(value)) return label;
  }
  return null;
}
