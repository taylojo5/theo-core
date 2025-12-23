// ═══════════════════════════════════════════════════════════════════════════
// Email Topic Categorization
// Categorize emails by topic/type using keyword analysis
// ═══════════════════════════════════════════════════════════════════════════

import type {
  ExtractedTopic,
  TopicCategory,
  TopicExtractionOptions,
  EmailInput,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Topic Keyword Definitions
// ─────────────────────────────────────────────────────────────

/**
 * Keywords associated with each topic category
 * Weights indicate how strongly a keyword suggests the category
 */
const TOPIC_KEYWORDS: Record<
  TopicCategory,
  Array<{ keyword: string; weight: number }>
> = {
  work: [
    { keyword: "project", weight: 0.8 },
    { keyword: "meeting", weight: 0.7 },
    { keyword: "deadline", weight: 0.8 },
    { keyword: "client", weight: 0.7 },
    { keyword: "report", weight: 0.7 },
    { keyword: "presentation", weight: 0.7 },
    { keyword: "team", weight: 0.6 },
    { keyword: "office", weight: 0.6 },
    { keyword: "quarterly", weight: 0.8 },
    { keyword: "stakeholder", weight: 0.8 },
    { keyword: "deliverable", weight: 0.9 },
    { keyword: "milestone", weight: 0.8 },
    { keyword: "status update", weight: 0.9 },
    { keyword: "sprint", weight: 0.9 },
    { keyword: "roadmap", weight: 0.8 },
  ],

  personal: [
    { keyword: "family", weight: 0.8 },
    { keyword: "birthday", weight: 0.9 },
    { keyword: "anniversary", weight: 0.9 },
    { keyword: "vacation", weight: 0.7 },
    { keyword: "weekend", weight: 0.5 },
    { keyword: "holiday", weight: 0.6 },
    { keyword: "dinner", weight: 0.5 },
    { keyword: "party", weight: 0.6 },
    { keyword: "wedding", weight: 0.9 },
    { keyword: "friend", weight: 0.6 },
  ],

  finance: [
    { keyword: "invoice", weight: 0.95 },
    { keyword: "payment", weight: 0.9 },
    { keyword: "receipt", weight: 0.9 },
    { keyword: "transaction", weight: 0.9 },
    { keyword: "bank", weight: 0.8 },
    { keyword: "account", weight: 0.6 },
    { keyword: "balance", weight: 0.7 },
    { keyword: "statement", weight: 0.7 },
    { keyword: "refund", weight: 0.9 },
    { keyword: "billing", weight: 0.9 },
    { keyword: "subscription", weight: 0.7 },
    { keyword: "credit card", weight: 0.9 },
    { keyword: "expense", weight: 0.8 },
    { keyword: "budget", weight: 0.8 },
    { keyword: "payroll", weight: 0.9 },
  ],

  travel: [
    { keyword: "flight", weight: 0.95 },
    { keyword: "hotel", weight: 0.95 },
    { keyword: "booking", weight: 0.7 },
    { keyword: "reservation", weight: 0.8 },
    { keyword: "itinerary", weight: 0.95 },
    { keyword: "airport", weight: 0.9 },
    { keyword: "boarding pass", weight: 0.95 },
    { keyword: "trip", weight: 0.7 },
    { keyword: "travel", weight: 0.8 },
    { keyword: "airline", weight: 0.9 },
    { keyword: "check-in", weight: 0.7 },
    { keyword: "departure", weight: 0.8 },
    { keyword: "arrival", weight: 0.8 },
  ],

  scheduling: [
    { keyword: "meeting", weight: 0.9 },
    { keyword: "appointment", weight: 0.9 },
    { keyword: "calendar", weight: 0.9 },
    { keyword: "schedule", weight: 0.8 },
    { keyword: "invite", weight: 0.7 },
    { keyword: "rsvp", weight: 0.9 },
    { keyword: "reschedule", weight: 0.95 },
    { keyword: "cancel", weight: 0.6 },
    { keyword: "confirm", weight: 0.5 },
    { keyword: "available", weight: 0.5 },
    { keyword: "time slot", weight: 0.9 },
    { keyword: "zoom", weight: 0.7 },
    { keyword: "google meet", weight: 0.8 },
    { keyword: "teams", weight: 0.6 },
  ],

  project: [
    { keyword: "launch", weight: 0.8 },
    { keyword: "release", weight: 0.8 },
    { keyword: "version", weight: 0.7 },
    { keyword: "feature", weight: 0.7 },
    { keyword: "bug", weight: 0.8 },
    { keyword: "issue", weight: 0.6 },
    { keyword: "task", weight: 0.6 },
    { keyword: "jira", weight: 0.9 },
    { keyword: "github", weight: 0.9 },
    { keyword: "pull request", weight: 0.95 },
    { keyword: "code review", weight: 0.95 },
    { keyword: "deployment", weight: 0.9 },
    { keyword: "production", weight: 0.7 },
    { keyword: "staging", weight: 0.9 },
  ],

  support: [
    { keyword: "support", weight: 0.8 },
    { keyword: "help", weight: 0.5 },
    { keyword: "ticket", weight: 0.9 },
    { keyword: "issue", weight: 0.6 },
    { keyword: "problem", weight: 0.6 },
    { keyword: "error", weight: 0.7 },
    { keyword: "fix", weight: 0.5 },
    { keyword: "resolved", weight: 0.7 },
    { keyword: "customer service", weight: 0.9 },
    { keyword: "feedback", weight: 0.6 },
    { keyword: "complaint", weight: 0.8 },
    { keyword: "case number", weight: 0.95 },
  ],

  newsletter: [
    { keyword: "newsletter", weight: 0.95 },
    { keyword: "unsubscribe", weight: 0.95 },
    { keyword: "subscribe", weight: 0.8 },
    { keyword: "weekly update", weight: 0.9 },
    { keyword: "monthly digest", weight: 0.9 },
    { keyword: "breaking news", weight: 0.8 },
    { keyword: "latest news", weight: 0.8 },
    { keyword: "update your preferences", weight: 0.95 },
    { keyword: "view in browser", weight: 0.9 },
    { keyword: "email preferences", weight: 0.9 },
  ],

  social: [
    { keyword: "invitation", weight: 0.7 },
    { keyword: "event", weight: 0.6 },
    { keyword: "party", weight: 0.8 },
    { keyword: "gathering", weight: 0.7 },
    { keyword: "celebration", weight: 0.8 },
    { keyword: "networking", weight: 0.7 },
    { keyword: "meetup", weight: 0.8 },
    { keyword: "conference", weight: 0.7 },
    { keyword: "webinar", weight: 0.8 },
    { keyword: "happy hour", weight: 0.9 },
  ],

  legal: [
    { keyword: "contract", weight: 0.95 },
    { keyword: "agreement", weight: 0.8 },
    { keyword: "terms", weight: 0.6 },
    { keyword: "legal", weight: 0.9 },
    { keyword: "attorney", weight: 0.95 },
    { keyword: "lawyer", weight: 0.95 },
    { keyword: "signature", weight: 0.7 },
    { keyword: "nda", weight: 0.95 },
    { keyword: "compliance", weight: 0.8 },
    { keyword: "policy", weight: 0.6 },
    { keyword: "disclosure", weight: 0.8 },
  ],

  health: [
    { keyword: "appointment", weight: 0.5 },
    { keyword: "doctor", weight: 0.9 },
    { keyword: "medical", weight: 0.95 },
    { keyword: "prescription", weight: 0.95 },
    { keyword: "pharmacy", weight: 0.9 },
    { keyword: "hospital", weight: 0.95 },
    { keyword: "clinic", weight: 0.9 },
    { keyword: "health", weight: 0.6 },
    { keyword: "insurance claim", weight: 0.9 },
    { keyword: "test results", weight: 0.8 },
  ],

  education: [
    { keyword: "course", weight: 0.8 },
    { keyword: "class", weight: 0.6 },
    { keyword: "lecture", weight: 0.9 },
    { keyword: "assignment", weight: 0.8 },
    { keyword: "grade", weight: 0.8 },
    { keyword: "exam", weight: 0.9 },
    { keyword: "certificate", weight: 0.7 },
    { keyword: "enrollment", weight: 0.9 },
    { keyword: "tuition", weight: 0.9 },
    { keyword: "scholarship", weight: 0.95 },
    { keyword: "learning", weight: 0.5 },
    { keyword: "webinar", weight: 0.5 },
  ],

  shopping: [
    { keyword: "order", weight: 0.7 },
    { keyword: "shipping", weight: 0.9 },
    { keyword: "delivery", weight: 0.8 },
    { keyword: "tracking", weight: 0.8 },
    { keyword: "package", weight: 0.8 },
    { keyword: "purchase", weight: 0.8 },
    { keyword: "cart", weight: 0.9 },
    { keyword: "checkout", weight: 0.9 },
    { keyword: "discount", weight: 0.7 },
    { keyword: "coupon", weight: 0.9 },
    { keyword: "sale", weight: 0.6 },
    { keyword: "shipped", weight: 0.9 },
    { keyword: "out for delivery", weight: 0.95 },
  ],

  other: [],
};

// ─────────────────────────────────────────────────────────────
// Sender-Based Categorization
// ─────────────────────────────────────────────────────────────

/** Email domains that strongly indicate categories */
const DOMAIN_CATEGORIES: Record<string, TopicCategory> = {
  // Shopping
  "amazon.com": "shopping",
  "ebay.com": "shopping",
  "etsy.com": "shopping",
  "shopify.com": "shopping",

  // Travel
  "booking.com": "travel",
  "airbnb.com": "travel",
  "expedia.com": "travel",
  "delta.com": "travel",
  "united.com": "travel",
  "southwest.com": "travel",
  "marriott.com": "travel",
  "hilton.com": "travel",

  // Finance
  "paypal.com": "finance",
  "stripe.com": "finance",
  "chase.com": "finance",
  "bankofamerica.com": "finance",
  "wellsfargo.com": "finance",
  "venmo.com": "finance",

  // Social
  "linkedin.com": "social",
  "facebook.com": "social",
  "meetup.com": "social",
  "eventbrite.com": "social",

  // Project
  "github.com": "project",
  "atlassian.com": "project",
  "notion.so": "project",
  "slack.com": "work",

  // Scheduling
  "calendly.com": "scheduling",
  "zoom.us": "scheduling",
  "google.com": "scheduling",

  // Newsletter
  "substack.com": "newsletter",
  "mailchimp.com": "newsletter",
  "convertkit.com": "newsletter",
};

// ─────────────────────────────────────────────────────────────
// Topic Extraction
// ─────────────────────────────────────────────────────────────

/**
 * Extract topics from an email
 *
 * @param email - The email to analyze
 * @param options - Extraction options
 * @returns Array of extracted topics
 */
export function extractTopics(
  email: EmailInput,
  options: TopicExtractionOptions = {}
): ExtractedTopic[] {
  const { maxTopics = 3, minConfidence = 0.3 } = options;

  // Combine all text for analysis
  const text = [email.subject ?? "", email.snippet ?? "", email.bodyText ?? ""]
    .join(" ")
    .toLowerCase();

  // Score each category
  const categoryScores = new Map<TopicCategory, CategoryScore>();

  // Score based on keywords
  for (const [category, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (category === "other") continue;

    const score = scoreCategory(text, keywords);
    if (score.score > 0) {
      categoryScores.set(category as TopicCategory, score);
    }
  }

  // Boost score based on sender domain
  const senderDomain = extractDomain(email.fromEmail);
  if (senderDomain && DOMAIN_CATEGORIES[senderDomain]) {
    const category = DOMAIN_CATEGORIES[senderDomain];
    const existing = categoryScores.get(category);
    if (existing) {
      existing.score = Math.min(1, existing.score + 0.3);
    } else {
      categoryScores.set(category, {
        score: 0.6,
        keywords: [senderDomain],
      });
    }
  }

  // Convert to topics and filter
  const topics: ExtractedTopic[] = [];

  for (const [category, score] of categoryScores) {
    if (score.score >= minConfidence) {
      topics.push({
        name: formatCategoryName(category),
        category,
        confidence: score.score,
        keywords: score.keywords.slice(0, 5), // Top 5 keywords
      });
    }
  }

  // Sort by confidence and limit
  topics.sort((a, b) => b.confidence - a.confidence);

  return topics.slice(0, maxTopics);
}

/**
 * Get the primary topic category for an email
 */
export function getPrimaryTopic(email: EmailInput): TopicCategory {
  const topics = extractTopics(email, { maxTopics: 1, minConfidence: 0.2 });

  if (topics.length > 0) {
    return topics[0].category;
  }

  return "other";
}

/**
 * Check if an email matches a specific topic category
 */
export function matchesTopic(
  email: EmailInput,
  category: TopicCategory,
  threshold: number = 0.4
): boolean {
  const topics = extractTopics(email, { maxTopics: 10, minConfidence: 0 });
  const topic = topics.find((t) => t.category === category);

  return topic !== undefined && topic.confidence >= threshold;
}

// ─────────────────────────────────────────────────────────────
// Helper Types and Functions
// ─────────────────────────────────────────────────────────────

interface CategoryScore {
  score: number;
  keywords: string[];
}

/**
 * Score a category based on keyword matches
 */
function scoreCategory(
  text: string,
  keywords: Array<{ keyword: string; weight: number }>
): CategoryScore {
  let totalScore = 0;
  const matchedKeywords: string[] = [];

  for (const { keyword, weight } of keywords) {
    // Count occurrences
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "gi");
    const matches = text.match(regex);

    if (matches) {
      // Diminishing returns for multiple matches
      const count = Math.min(matches.length, 3);
      const keywordScore = weight * (1 + (count - 1) * 0.2);
      totalScore += keywordScore;
      matchedKeywords.push(keyword);
    }
  }

  // Normalize score (max is roughly the sum of all weights)
  const maxPossibleScore = keywords.reduce((sum, k) => sum + k.weight, 0);
  const normalizedScore = Math.min(1, totalScore / (maxPossibleScore * 0.3));

  return {
    score: normalizedScore,
    keywords: matchedKeywords,
  };
}

/**
 * Extract domain from email address
 */
function extractDomain(email: string): string | null {
  const match = email.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Format category name for display
 */
function formatCategoryName(category: TopicCategory): string {
  const names: Record<TopicCategory, string> = {
    work: "Work",
    personal: "Personal",
    finance: "Finance",
    travel: "Travel",
    scheduling: "Scheduling",
    project: "Project",
    support: "Support",
    newsletter: "Newsletter",
    social: "Social",
    legal: "Legal",
    health: "Health",
    education: "Education",
    shopping: "Shopping",
    other: "Other",
  };

  return names[category] ?? category;
}

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get all topic categories
 */
export function getAllCategories(): TopicCategory[] {
  return Object.keys(TOPIC_KEYWORDS) as TopicCategory[];
}

/**
 * Check if a category is a valid TopicCategory
 */
export function isValidCategory(category: string): category is TopicCategory {
  return category in TOPIC_KEYWORDS;
}
