// ═══════════════════════════════════════════════════════════════════════════
// Entity Matching Utilities
// Fuzzy matching, similarity scoring, and disambiguation for entity resolution
// ═══════════════════════════════════════════════════════════════════════════

import type { ResolutionCandidate } from "./types";

// ─────────────────────────────────────────────────────────────
// String Normalization
// ─────────────────────────────────────────────────────────────

/**
 * Normalize a string for comparison
 * - Lowercase
 * - Remove extra whitespace
 * - Remove common titles/honorifics
 * - Normalize unicode characters
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize a name for comparison
 * Removes common titles and handles name variations
 */
export function normalizeName(name: string): string {
  const titles = [
    "mr",
    "mrs",
    "ms",
    "miss",
    "dr",
    "prof",
    "professor",
    "sir",
    "madam",
  ];

  let normalized = normalizeString(name);

  // Remove common titles
  for (const title of titles) {
    const pattern = new RegExp(`^${title}\\.?\\s+`, "i");
    normalized = normalized.replace(pattern, "");
  }

  return normalized.trim();
}

/**
 * Extract name parts (first, middle, last)
 */
export function extractNameParts(name: string): {
  first: string;
  middle: string[];
  last: string;
  full: string;
} {
  const normalized = normalizeName(name);
  const parts = normalized.split(/\s+/);

  if (parts.length === 0) {
    return { first: "", middle: [], last: "", full: "" };
  }

  if (parts.length === 1) {
    return { first: parts[0], middle: [], last: "", full: normalized };
  }

  return {
    first: parts[0],
    middle: parts.slice(1, -1),
    last: parts[parts.length - 1],
    full: normalized,
  };
}

// ─────────────────────────────────────────────────────────────
// Similarity Algorithms
// ─────────────────────────────────────────────────────────────

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Calculate normalized Levenshtein similarity (0-1)
 * Higher = more similar
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const normalizedA = normalizeString(a);
  const normalizedB = normalizeString(b);

  if (normalizedA === normalizedB) return 1;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);

  return 1 - distance / maxLength;
}

/**
 * Calculate Jaro-Winkler similarity (0-1)
 * Better for short strings like names
 */
export function jaroWinklerSimilarity(a: string, b: string): number {
  const normalizedA = normalizeString(a);
  const normalizedB = normalizeString(b);

  if (normalizedA === normalizedB) return 1;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0;

  const matchWindow =
    Math.floor(Math.max(normalizedA.length, normalizedB.length) / 2) - 1;

  const aMatches: boolean[] = new Array(normalizedA.length).fill(false);
  const bMatches: boolean[] = new Array(normalizedB.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < normalizedA.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, normalizedB.length);

    for (let j = start; j < end; j++) {
      if (bMatches[j] || normalizedA[i] !== normalizedB[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < normalizedA.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (normalizedA[i] !== normalizedB[k]) transpositions++;
    k++;
  }

  // Jaro similarity
  const jaro =
    (matches / normalizedA.length +
      matches / normalizedB.length +
      (matches - transpositions / 2) / matches) /
    3;

  // Winkler modification - boost for common prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(4, normalizedA.length, normalizedB.length); i++) {
    if (normalizedA[i] === normalizedB[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Check if one string contains another (partial match)
 */
export function containsMatch(query: string, target: string): boolean {
  const normalizedQuery = normalizeString(query);
  const normalizedTarget = normalizeString(target);

  return normalizedTarget.includes(normalizedQuery);
}

/**
 * Calculate partial match score (0-1)
 * Based on how much of the query matches the target
 */
export function partialMatchScore(query: string, target: string): number {
  const normalizedQuery = normalizeString(query);
  const normalizedTarget = normalizeString(target);

  if (normalizedTarget.includes(normalizedQuery)) {
    return normalizedQuery.length / normalizedTarget.length;
  }

  // Check if target contains query
  if (normalizedQuery.includes(normalizedTarget)) {
    return normalizedTarget.length / normalizedQuery.length;
  }

  return 0;
}

// ─────────────────────────────────────────────────────────────
// Name Matching
// ─────────────────────────────────────────────────────────────

/**
 * Calculate name similarity using multiple methods
 * Returns a composite score (0-1)
 */
export function nameSimilarity(query: string, name: string): number {
  const queryParts = extractNameParts(query);
  const nameParts = extractNameParts(name);

  // Exact match gets perfect score
  if (queryParts.full === nameParts.full) {
    return 1.0;
  }

  // First name only match (single word query matching first name)
  if (
    queryParts.first &&
    queryParts.first === nameParts.first &&
    queryParts.last === ""
  ) {
    return 0.85;
  }

  // Single word query that matches the last name
  // (when query has no last name but its first matches the target's last)
  if (
    queryParts.first &&
    queryParts.last === "" &&
    queryParts.first === nameParts.last
  ) {
    return 0.8;
  }

  // Last name only match (for multi-word queries where first is empty)
  if (
    queryParts.last &&
    queryParts.last === nameParts.last &&
    queryParts.first === ""
  ) {
    return 0.8;
  }

  // First + last name match (ignoring middle)
  if (
    queryParts.first === nameParts.first &&
    queryParts.last === nameParts.last &&
    queryParts.first !== "" &&
    queryParts.last !== ""
  ) {
    return 0.95;
  }

  // Use Jaro-Winkler for fuzzy matching
  const fullScore = jaroWinklerSimilarity(queryParts.full, nameParts.full);

  // Also check first name similarity if present
  let firstNameScore = 0;
  if (queryParts.first && nameParts.first) {
    firstNameScore = jaroWinklerSimilarity(queryParts.first, nameParts.first);
  }

  // Check if single-word query matches target's last name fuzzily
  let lastNameScore = 0;
  if (queryParts.first && queryParts.last === "" && nameParts.last) {
    lastNameScore = jaroWinklerSimilarity(queryParts.first, nameParts.last);
    if (lastNameScore > 0.85) {
      lastNameScore *= 0.85; // Slightly lower confidence for fuzzy last name match
    }
  }

  // Return the best of full name, first name, or last name match
  return Math.max(fullScore, firstNameScore * 0.9, lastNameScore);
}

/**
 * Check if a query could be a nickname or abbreviation
 */
export function couldBeNickname(query: string, fullName: string): boolean {
  const normalizedQuery = normalizeString(query);
  const nameParts = extractNameParts(fullName);

  // Check common nickname patterns
  // 1. First few letters of first name
  if (
    nameParts.first.startsWith(normalizedQuery) &&
    normalizedQuery.length >= 2
  ) {
    return true;
  }

  // 2. Common nickname substitutions
  const nicknameMap: Record<string, string[]> = {
    william: ["will", "bill", "billy", "liam"],
    robert: ["rob", "bob", "bobby", "robbie"],
    richard: ["rick", "dick", "richie"],
    elizabeth: ["liz", "beth", "betsy", "lizzy"],
    jennifer: ["jen", "jenny"],
    michael: ["mike", "mikey"],
    james: ["jim", "jimmy", "jamie"],
    katherine: ["kate", "kathy", "katie", "kat"],
    christopher: ["chris"],
    nicholas: ["nick", "nicky"],
    alexander: ["alex"],
    benjamin: ["ben", "benny"],
    daniel: ["dan", "danny"],
    david: ["dave", "davy"],
    joseph: ["joe", "joey"],
    margaret: ["maggie", "meg", "peggy"],
    patricia: ["pat", "patty", "tricia"],
    rebecca: ["becky", "becca"],
    samantha: ["sam", "sammy"],
    stephanie: ["steph"],
    thomas: ["tom", "tommy"],
    timothy: ["tim", "timmy"],
    victoria: ["vicky", "vic", "tori"],
  };

  const firstNameLower = nameParts.first.toLowerCase();
  const nicknames = nicknameMap[firstNameLower];
  if (nicknames && nicknames.includes(normalizedQuery)) {
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────
// Email Matching
// ─────────────────────────────────────────────────────────────

/**
 * Extract username from email address
 */
export function extractEmailUsername(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex === -1) return email;
  return email.substring(0, atIndex).toLowerCase();
}

/**
 * Check if a name matches an email username
 */
export function nameMatchesEmail(name: string, email: string): boolean {
  const username = extractEmailUsername(email);
  const nameParts = extractNameParts(name);

  // Common email patterns:
  // firstname.lastname
  // firstnamelastname
  // firstname_lastname
  // f.lastname
  // firstnamel

  // Build patterns, handling single-word names where last is empty
  const patterns: string[] = [nameParts.first];
  
  if (nameParts.last) {
    patterns.push(
      `${nameParts.first}.${nameParts.last}`,
      `${nameParts.first}${nameParts.last}`,
      `${nameParts.first}_${nameParts.last}`,
      nameParts.last
    );
    
    // Only add initial-based patterns if both parts exist
    if (nameParts.first[0]) {
      patterns.push(`${nameParts.first[0]}.${nameParts.last}`);
    }
    if (nameParts.last[0]) {
      patterns.push(`${nameParts.first}${nameParts.last[0]}`);
    }
  }

  return patterns.some(
    (pattern) => pattern && username.includes(pattern.toLowerCase())
  );
}

// ─────────────────────────────────────────────────────────────
// Title/Description Matching
// ─────────────────────────────────────────────────────────────

/**
 * Calculate text similarity for titles/descriptions
 * Uses word overlap and fuzzy matching
 */
export function textSimilarity(query: string, text: string): number {
  const queryWords = normalizeString(query).split(/\s+/);
  const textWords = normalizeString(text).split(/\s+/);

  if (queryWords.length === 0 || textWords.length === 0) {
    return 0;
  }

  // Calculate word overlap
  let matchedWords = 0;
  for (const queryWord of queryWords) {
    if (queryWord.length < 2) continue; // Skip very short words

    // Check for exact or fuzzy match in text words
    for (const textWord of textWords) {
      if (textWord === queryWord) {
        matchedWords++;
        break;
      }
      if (jaroWinklerSimilarity(queryWord, textWord) > 0.85) {
        matchedWords += 0.8;
        break;
      }
    }
  }

  const overlapScore = matchedWords / queryWords.length;

  // Also consider string similarity of the full text
  const stringSimilarity = jaroWinklerSimilarity(query, text);

  // Combine scores with more weight on word overlap
  return overlapScore * 0.7 + stringSimilarity * 0.3;
}

// ─────────────────────────────────────────────────────────────
// Disambiguation
// ─────────────────────────────────────────────────────────────

/**
 * Sort candidates by confidence and generate labels
 */
export function rankCandidates(
  candidates: ResolutionCandidate[]
): ResolutionCandidate[] {
  return [...candidates].sort((a, b) => b.confidence - a.confidence);
}

/**
 * Generate a disambiguation question for ambiguous matches
 */
export function generateDisambiguationQuestion(
  entityType: string,
  query: string,
  candidates: ResolutionCandidate[]
): string {
  const ranked = rankCandidates(candidates);
  const options = ranked
    .slice(0, 5)
    .map((c, i) => `${i + 1}. ${c.label}`)
    .join(", ");

  switch (entityType) {
    case "person":
      return `I found multiple people matching "${query}". Did you mean: ${options}?`;
    case "event":
      return `I found multiple events matching "${query}". Which one did you mean: ${options}?`;
    case "task":
      return `I found multiple tasks matching "${query}". Which one: ${options}?`;
    case "email":
      return `I found multiple emails matching "${query}". Which one: ${options}?`;
    case "place":
    case "location":
      return `I found multiple places matching "${query}". Which one: ${options}?`;
    case "deadline":
      return `I found multiple deadlines matching "${query}". Which one: ${options}?`;
    case "routine":
      return `I found multiple routines matching "${query}". Which one: ${options}?`;
    case "open_loop":
      return `I found multiple open loops matching "${query}". Which one: ${options}?`;
    case "project":
      return `I found multiple projects matching "${query}". Which one: ${options}?`;
    case "note":
      return `I found multiple notes matching "${query}". Which one: ${options}?`;
    default:
      return `Multiple matches found for "${query}": ${options}. Which one did you mean?`;
  }
}

/**
 * Generate a "not found" message with suggestions
 */
export function generateNotFoundMessage(
  entityType: string,
  query: string
): string {
  switch (entityType) {
    case "person":
      return `I couldn't find anyone named "${query}" in your contacts. Would you like me to add them?`;
    case "event":
      return `I couldn't find any event matching "${query}". Could you provide more details?`;
    case "task":
      return `I couldn't find any task matching "${query}". Would you like me to create one?`;
    case "email":
      return `I couldn't find any email matching "${query}". Could you be more specific about the subject or sender?`;
    case "place":
    case "location":
      return `I couldn't find any place matching "${query}". Could you provide more details about the location?`;
    case "deadline":
      return `I couldn't find any deadline matching "${query}". Could you be more specific about the deadline?`;
    case "routine":
      return `I couldn't find any routine matching "${query}". Would you like me to create one?`;
    case "open_loop":
      return `I couldn't find any open loop matching "${query}". Would you like me to create one?`;
    case "project":
      return `I couldn't find any project matching "${query}". Would you like me to create one?`;
    case "note":
      return `I couldn't find any note matching "${query}". Would you like me to create one?`;
    default:
      return `I couldn't find "${query}". Could you provide more details?`;
  }
}

