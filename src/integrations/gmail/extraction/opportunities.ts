// ═══════════════════════════════════════════════════════════════════════════
// Email Opportunity Extraction
// Extract opportunities and potential engagements from email content
// ═══════════════════════════════════════════════════════════════════════════

import type {
  ExtractedOpportunity,
  OpportunityType as ExtractedOpportunityType,
  OpportunityIndicator,
  OpportunityExtractionOptions,
  ExtractedPerson,
} from "./types";
import { extractDates } from "./dates";

// ─────────────────────────────────────────────────────────────
// Opportunity Detection Patterns
// ─────────────────────────────────────────────────────────────

/** Patterns that suggest networking opportunities */
const NETWORKING_PATTERNS = [
  /\b(?:would you like to )?connect\b/i,
  /\blet['']?s (?:catch up|meet|connect|chat)\b/i,
  /\bintroduce you to\b/i,
  /\bi['']?d like to introduce\b/i,
  /\bmeet\s+(?:with\s+)?(?:my|our)\s+(?:team|colleague|friend)\b/i,
  /\bnetworking (?:event|opportunity|session)\b/i,
  /\bgreat opportunity to connect\b/i,
  /\bcoffee\s+(?:chat|meeting|catch[- ]?up)\b/i,
  /\bhappy hour\b/i,
  /\blunch and learn\b/i,
];

/** Patterns that suggest business opportunities */
const BUSINESS_PATTERNS = [
  /\b(?:business|partnership)\s+opportunity\b/i,
  /\bpotential (?:client|customer|partner)\b/i,
  /\bnew (?:lead|prospect|deal)\b/i,
  /\brfp\b/i,
  /\brequest for proposal\b/i,
  /\b(?:sales|business)\s+lead\b/i,
  /\bpipeline\b/i,
  /\bpricing\s+(?:discussion|proposal|quote)\b/i,
  /\bdemo\s+request\b/i,
  /\binbound\s+inquiry\b/i,
  /\b(?:interested in|inquiring about)\s+(?:your|our)\s+(?:product|service|solution)\b/i,
];

/** Patterns that suggest learning opportunities */
const LEARNING_PATTERNS = [
  /\b(?:free|online)?\s*(?:webinar|workshop|course|training|seminar)\b/i,
  /\blearning opportunity\b/i,
  /\bconference\b/i,
  /\bsummit\b/i,
  /\bmasterclass\b/i,
  /\bcertification\b/i,
  /\bskill[- ]?building\b/i,
  /\bprofessional development\b/i,
  /\bmentorship\b/i,
  /\bmentor(?:ing)?\s+(?:program|opportunity)\b/i,
];

/** Patterns that suggest career opportunities */
const CAREER_PATTERNS = [
  /\bjob\s+(?:opportunity|opening|posting)\b/i,
  /\bwe['']?re\s+hiring\b/i,
  /\bcareer\s+opportunity\b/i,
  /\bopen\s+(?:position|role)\b/i,
  /\binterested in (?:your|a)\s+(?:resume|background|experience)\b/i,
  /\brecruiter\b/i,
  /\bhead\s*hunter\b/i,
  /\btalent\s+acquisition\b/i,
  /\bperfect (?:fit|candidate)\b/i,
  /\bexciting role\b/i,
];

/** Patterns that suggest social opportunities */
const SOCIAL_PATTERNS = [
  /\b(?:you['']?re\s+)?invited\b/i,
  /\binvitation\b/i,
  /\bparty\b/i,
  /\bcelebration\b/i,
  /\bgathering\b/i,
  /\bget[- ]?together\b/i,
  /\bevent\s+(?:this|next)\b/i,
  /\bjoin us (?:for|at)\b/i,
  /\brsvp\b/i,
];

/** Patterns that suggest collaboration opportunities */
const COLLABORATION_PATTERNS = [
  /\b(?:collaborate|collaboration)\b/i,
  /\bjoint\s+(?:project|venture|effort)\b/i,
  /\bco[- ]?author\b/i,
  /\bwork together\b/i,
  /\bteam up\b/i,
  /\bpartner\s+(?:with|on)\b/i,
  /\bopen[- ]?source\s+contribution\b/i,
  /\bcontribute to\b/i,
  /\bspeaking\s+opportunity\b/i,
  /\bguest\s+(?:post|blog|article|speaker)\b/i,
  /\bpodcast\s+(?:interview|guest)\b/i,
];

/** Patterns that suggest investment opportunities */
const INVESTMENT_PATTERNS = [
  /\binvestment\s+opportunity\b/i,
  /\bfunding\s+(?:round|opportunity)\b/i,
  /\bstartup\b/i,
  /\bequity\b/i,
  /\bangel\s+invest(?:or|ing|ment)?\b/i,
  /\bventure\s+capital\b/i,
  /\bseed\s+(?:funding|round)\b/i,
  /\bpre[- ]?seed\b/i,
  /\bseries\s+[a-z]\b/i,
];

/** Keywords that increase opportunity confidence */
const OPPORTUNITY_KEYWORDS = [
  "opportunity",
  "chance",
  "potential",
  "possibility",
  "prospect",
  "opening",
  "invitation",
  "invite",
  "interested",
  "exciting",
  "exclusive",
  "limited",
  "deadline",
  "act now",
  "don't miss",
  "last chance",
];

/** Phrases that suggest time-limited opportunities */
const URGENCY_PATTERNS = [
  /\bact (?:now|fast|quickly)\b/i,
  /\blimited (?:time|spots?|availability)\b/i,
  /\bdeadline\b/i,
  /\b(?:ends?|expires?|closing)\s+(?:soon|today|tomorrow)\b/i,
  /\blast (?:chance|day|opportunity)\b/i,
  /\bdon['']?t miss\b/i,
  /\bhurry\b/i,
  /\bonly\s+\d+\s+(?:spots?|seats?|places?)\b/i,
];

// ─────────────────────────────────────────────────────────────
// Opportunity Extraction
// ─────────────────────────────────────────────────────────────

/**
 * Extract opportunities from email body
 *
 * @param bodyText - The email body text
 * @param options - Extraction options
 * @returns Array of extracted opportunities
 */
export function extractOpportunities(
  bodyText: string,
  options: OpportunityExtractionOptions = {}
): ExtractedOpportunity[] {
  if (!bodyText || bodyText.trim().length === 0) {
    return [];
  }

  const minConfidence = options.minConfidence ?? 0.5;
  const opportunities: ExtractedOpportunity[] = [];

  // Split into paragraphs for analysis
  const paragraphs = bodyText.split(/\n\n+/);

  for (const paragraph of paragraphs) {
    const analysis = analyzeParagraph(paragraph);

    if (analysis.isOpportunity && analysis.confidence >= minConfidence) {
      const opportunity: ExtractedOpportunity = {
        title: analysis.title,
        description: paragraph.trim(),
        type: analysis.type,
        indicators: analysis.indicators,
        confidence: analysis.confidence,
        potentialValue: analysis.potentialValue,
        hasUrgency: analysis.hasUrgency,
      };

      // Extract expiration date if mentioned
      const dates = extractDates(paragraph, { futureOnly: true });
      if (dates.length > 0) {
        opportunity.expiresAt = dates[0];
      }

      opportunities.push(opportunity);
    }
  }

  // Also check subject line if it's passed in the context
  // Subject analysis would be done at the processor level

  // Deduplicate similar opportunities
  return deduplicateOpportunities(opportunities);
}

/**
 * Extract opportunities with associated people
 *
 * @param bodyText - The email body text
 * @param people - People extracted from the email
 * @param options - Extraction options
 * @returns Opportunities with related people
 */
export function extractOpportunitiesWithPeople(
  bodyText: string,
  people: ExtractedPerson[],
  options: OpportunityExtractionOptions = {}
): ExtractedOpportunity[] {
  const opportunities = extractOpportunities(bodyText, options);

  // Try to associate opportunities with people
  for (const opportunity of opportunities) {
    // Check if any person is mentioned in the opportunity description
    for (const person of people) {
      const namePattern = new RegExp(`\\b${escapeRegex(person.name || "")}\\b`, "i");
      const emailPattern = person.email
        ? new RegExp(escapeRegex(person.email), "i")
        : null;

      if (
        (person.name && namePattern.test(opportunity.description)) ||
        (emailPattern && emailPattern.test(opportunity.description))
      ) {
        opportunity.relatedPerson = person;
        break; // Take the first match
      }
    }
  }

  return opportunities;
}

/**
 * Check if email content contains opportunity indicators
 */
export function containsOpportunityPatterns(text: string): boolean {
  const allPatterns = [
    ...NETWORKING_PATTERNS,
    ...BUSINESS_PATTERNS,
    ...LEARNING_PATTERNS,
    ...CAREER_PATTERNS,
    ...SOCIAL_PATTERNS,
    ...COLLABORATION_PATTERNS,
    ...INVESTMENT_PATTERNS,
  ];

  return allPatterns.some((pattern) => pattern.test(text));
}

/**
 * Get the primary opportunity type from a piece of text
 */
export function getPrimaryOpportunityType(text: string): ExtractedOpportunityType | null {
  const typeScores: Record<ExtractedOpportunityType, number> = {
    networking: countMatches(text, NETWORKING_PATTERNS),
    business: countMatches(text, BUSINESS_PATTERNS),
    learning: countMatches(text, LEARNING_PATTERNS),
    career: countMatches(text, CAREER_PATTERNS),
    social: countMatches(text, SOCIAL_PATTERNS),
    collaboration: countMatches(text, COLLABORATION_PATTERNS),
    investment: countMatches(text, INVESTMENT_PATTERNS),
    general: 0,
  };

  const maxType = Object.entries(typeScores).reduce(
    (max, [type, score]) => (score > max.score ? { type: type as ExtractedOpportunityType, score } : max),
    { type: "general" as ExtractedOpportunityType, score: 0 }
  );

  return maxType.score > 0 ? maxType.type : null;
}

// ─────────────────────────────────────────────────────────────
// Private Helpers
// ─────────────────────────────────────────────────────────────

interface ParagraphAnalysis {
  isOpportunity: boolean;
  type: ExtractedOpportunityType;
  title: string;
  indicators: OpportunityIndicator[];
  confidence: number;
  potentialValue?: string;
  hasUrgency: boolean;
}

/**
 * Analyze a paragraph for opportunity indicators
 */
function analyzeParagraph(paragraph: string): ParagraphAnalysis {
  const indicators: OpportunityIndicator[] = [];
  let confidence = 0;
  let type: ExtractedOpportunityType = "general";

  // Check for each type of opportunity
  if (NETWORKING_PATTERNS.some((p) => p.test(paragraph))) {
    indicators.push("networking_phrase");
    type = "networking";
    confidence += 0.3;
  }

  if (BUSINESS_PATTERNS.some((p) => p.test(paragraph))) {
    indicators.push("business_phrase");
    type = "business";
    confidence += 0.35;
  }

  if (LEARNING_PATTERNS.some((p) => p.test(paragraph))) {
    indicators.push("learning_phrase");
    type = "learning";
    confidence += 0.3;
  }

  if (CAREER_PATTERNS.some((p) => p.test(paragraph))) {
    indicators.push("career_phrase");
    type = "career";
    confidence += 0.35;
  }

  if (SOCIAL_PATTERNS.some((p) => p.test(paragraph))) {
    indicators.push("social_phrase");
    type = "social";
    confidence += 0.25;
  }

  if (COLLABORATION_PATTERNS.some((p) => p.test(paragraph))) {
    indicators.push("collaboration_phrase");
    type = "collaboration";
    confidence += 0.3;
  }

  if (INVESTMENT_PATTERNS.some((p) => p.test(paragraph))) {
    indicators.push("investment_phrase");
    type = "investment";
    confidence += 0.35;
  }

  // Check for opportunity keywords
  const lowerParagraph = paragraph.toLowerCase();
  const keywordMatches = OPPORTUNITY_KEYWORDS.filter((kw) =>
    lowerParagraph.includes(kw.toLowerCase())
  );
  if (keywordMatches.length > 0) {
    indicators.push("opportunity_keyword");
    confidence += 0.15 * Math.min(keywordMatches.length, 3);
  }

  // Check for urgency
  const hasUrgency = URGENCY_PATTERNS.some((p) => p.test(paragraph));
  if (hasUrgency) {
    indicators.push("urgency_indicator");
    confidence += 0.1;
  }

  // Extract a title from the first sentence or first N characters
  const title = extractTitle(paragraph);

  // Determine potential value based on type and content
  const potentialValue = determinePotentialValue(type, paragraph);

  // Cap confidence at 1.0
  confidence = Math.min(confidence, 1.0);

  return {
    isOpportunity: indicators.length > 0 && confidence >= 0.25,
    type,
    title,
    indicators,
    confidence,
    potentialValue,
    hasUrgency,
  };
}

/**
 * Extract a title from a paragraph
 */
function extractTitle(paragraph: string): string {
  // Try to get the first sentence
  const firstSentence = paragraph.match(/^[^.!?]+[.!?]?/);
  if (firstSentence) {
    const title = firstSentence[0].trim();
    // Truncate if too long
    return title.length > 100 ? title.substring(0, 97) + "..." : title;
  }

  // Fallback to first N characters
  return paragraph.length > 100 ? paragraph.substring(0, 97) + "..." : paragraph;
}

/**
 * Determine potential value based on opportunity type
 */
function determinePotentialValue(
  type: ExtractedOpportunityType,
  _paragraph: string
): string | undefined {
  switch (type) {
    case "networking":
      return "Expand professional network, potential future collaborations";
    case "business":
      return "Potential revenue, new client/partner relationship";
    case "learning":
      return "Skill development, professional growth";
    case "career":
      return "Career advancement, new position";
    case "social":
      return "Relationship building, community engagement";
    case "collaboration":
      return "Joint project, shared expertise, increased visibility";
    case "investment":
      return "Financial opportunity, portfolio diversification";
    default:
      return undefined;
  }
}

/**
 * Deduplicate similar opportunities
 */
function deduplicateOpportunities(
  opportunities: ExtractedOpportunity[]
): ExtractedOpportunity[] {
  const unique: ExtractedOpportunity[] = [];

  for (const opp of opportunities) {
    const isDuplicate = unique.some(
      (existing) =>
        existing.type === opp.type &&
        similarity(existing.title, opp.title) > 0.7
    );

    if (!isDuplicate) {
      unique.push(opp);
    }
  }

  return unique;
}

/**
 * Count pattern matches in text
 */
function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter((p) => p.test(text)).length;
}

/**
 * Calculate simple string similarity
 */
function similarity(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 1;

  const aWords = new Set(aLower.split(/\s+/));
  const bWords = new Set(bLower.split(/\s+/));

  const intersection = new Set([...aWords].filter((w) => bWords.has(w)));
  const union = new Set([...aWords, ...bWords]);

  return intersection.size / union.size;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

