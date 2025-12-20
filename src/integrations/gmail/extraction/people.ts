// ═══════════════════════════════════════════════════════════════════════════
// Email People Extraction
// Extract people from email content and link to Person entities
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { Person } from "@prisma/client";
import type {
  ExtractedPerson,
  PersonRole,
  PeopleExtractionOptions,
  EmailInput,
} from "./types";
import { parseEmailAddress } from "../utils";

// ─────────────────────────────────────────────────────────────
// Email Pattern for Body Extraction
// ─────────────────────────────────────────────────────────────

/** Regex pattern for email addresses in text */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Regex for "Name <email>" pattern */
const NAME_EMAIL_REGEX =
  /([^<,;\n]+?)\s*<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/g;

// ─────────────────────────────────────────────────────────────
// People Extraction
// ─────────────────────────────────────────────────────────────

/**
 * Extract all people from an email
 *
 * @param email - The email to extract people from
 * @param options - Extraction options
 * @returns Array of extracted people
 */
export async function extractPeople(
  email: EmailInput,
  options: PeopleExtractionOptions = {}
): Promise<ExtractedPerson[]> {
  const { linkToExisting = true, createMissing = false } = options;

  const people: Map<string, ExtractedPerson> = new Map();

  // Extract from header fields
  addPerson(people, email.fromEmail, email.fromName, "sender", 1.0);

  for (const to of email.toEmails) {
    const parsed = parseEmailAddress(to);
    addPerson(people, parsed.email, parsed.name, "recipient", 1.0);
  }

  for (const cc of email.ccEmails) {
    const parsed = parseEmailAddress(cc);
    addPerson(people, parsed.email, parsed.name, "cc", 1.0);
  }

  for (const bcc of email.bccEmails) {
    const parsed = parseEmailAddress(bcc);
    addPerson(people, parsed.email, parsed.name, "bcc", 1.0);
  }

  if (email.replyTo) {
    const parsed = parseEmailAddress(email.replyTo);
    addPerson(people, parsed.email, parsed.name, "reply_to", 0.95);
  }

  // Extract from body content
  if (email.bodyText) {
    await extractPeopleFromBody(
      email.bodyText,
      people,
      options.minMentionConfidence ?? 0.6
    );
  }

  // Link to existing Person entities if requested
  if (linkToExisting) {
    await linkToPersonEntities(email.userId, people);
  }

  // Create missing Person entities if requested
  if (createMissing) {
    await createMissingPersons(email.userId, people);
  }

  return Array.from(people.values());
}

/**
 * Extract and link the sender from an email
 *
 * @param email - The email
 * @returns Extracted sender with optional link
 */
export async function extractSender(
  email: EmailInput
): Promise<ExtractedPerson> {
  const sender: ExtractedPerson = {
    email: email.fromEmail.toLowerCase(),
    name: email.fromName ?? undefined,
    role: "sender",
    confidence: 1.0,
  };

  // Try to link to existing Person
  const existingPerson = await findPersonByEmail(email.userId, email.fromEmail);
  if (existingPerson) {
    sender.linkedPersonId = existingPerson.id;
    sender.linkedPerson = existingPerson;
  }

  return sender;
}

/**
 * Find all recipients (to, cc, bcc) from an email
 */
export async function extractRecipients(
  email: EmailInput
): Promise<ExtractedPerson[]> {
  const recipients: ExtractedPerson[] = [];

  for (const to of email.toEmails) {
    const parsed = parseEmailAddress(to);
    recipients.push({
      email: parsed.email.toLowerCase(),
      name: parsed.name,
      role: "recipient",
      confidence: 1.0,
    });
  }

  for (const cc of email.ccEmails) {
    const parsed = parseEmailAddress(cc);
    recipients.push({
      email: parsed.email.toLowerCase(),
      name: parsed.name,
      role: "cc",
      confidence: 1.0,
    });
  }

  for (const bcc of email.bccEmails) {
    const parsed = parseEmailAddress(bcc);
    recipients.push({
      email: parsed.email.toLowerCase(),
      name: parsed.name,
      role: "bcc",
      confidence: 1.0,
    });
  }

  // Link to existing Persons
  for (const recipient of recipients) {
    const person = await findPersonByEmail(email.userId, recipient.email);
    if (person) {
      recipient.linkedPersonId = person.id;
      recipient.linkedPerson = person;
    }
  }

  return recipients;
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Add a person to the map (deduplicating by email)
 */
function addPerson(
  people: Map<string, ExtractedPerson>,
  email: string,
  name: string | null | undefined,
  role: PersonRole,
  confidence: number
): void {
  if (!email) return;

  const normalizedEmail = email.toLowerCase().trim();

  // Skip invalid emails
  if (!isValidEmail(normalizedEmail)) return;

  // Check if already exists
  if (people.has(normalizedEmail)) {
    const existing = people.get(normalizedEmail)!;
    // Update if this has a name and existing doesn't
    if (name && !existing.name) {
      existing.name = name;
    }
    // Don't downgrade role (sender > recipient > cc > bcc > mentioned)
    return;
  }

  people.set(normalizedEmail, {
    email: normalizedEmail,
    name: name ?? undefined,
    role,
    confidence,
  });
}

/**
 * Extract people mentioned in email body
 */
async function extractPeopleFromBody(
  bodyText: string,
  people: Map<string, ExtractedPerson>,
  minConfidence: number
): Promise<void> {
  // Extract "Name <email>" patterns first
  const nameEmailMatches = bodyText.matchAll(NAME_EMAIL_REGEX);
  for (const match of nameEmailMatches) {
    const [, name, email] = match;
    addPerson(people, email, name.trim(), "mentioned", 0.85);
  }

  // Extract standalone email addresses
  const emailMatches = bodyText.match(EMAIL_REGEX) ?? [];
  for (const email of emailMatches) {
    // Lower confidence for standalone emails in body
    addPerson(people, email, undefined, "mentioned", 0.7);
  }

  // Filter out low-confidence mentions
  for (const [email, person] of people) {
    if (person.role === "mentioned" && person.confidence < minConfidence) {
      people.delete(email);
    }
  }
}

/**
 * Link extracted people to existing Person entities
 */
async function linkToPersonEntities(
  userId: string,
  people: Map<string, ExtractedPerson>
): Promise<void> {
  const emails = Array.from(people.keys());

  if (emails.length === 0) return;

  // Batch lookup for efficiency
  const existingPersons = await db.person.findMany({
    where: {
      userId,
      email: { in: emails },
      deletedAt: null,
    },
  });

  // Create lookup map
  const personsByEmail = new Map<string, Person>();
  for (const person of existingPersons) {
    if (person.email) {
      personsByEmail.set(person.email.toLowerCase(), person);
    }
  }

  // Link extracted people to Person entities
  for (const [email, extractedPerson] of people) {
    const person = personsByEmail.get(email);
    if (person) {
      extractedPerson.linkedPersonId = person.id;
      extractedPerson.linkedPerson = person;
    }
  }
}

/**
 * Create Person entities for unlinked people
 */
async function createMissingPersons(
  userId: string,
  people: Map<string, ExtractedPerson>
): Promise<void> {
  for (const [, extractedPerson] of people) {
    // Skip if already linked
    if (extractedPerson.linkedPersonId) continue;

    // Skip mentioned people (too low confidence to auto-create)
    if (extractedPerson.role === "mentioned") continue;

    try {
      const person = await db.person.create({
        data: {
          userId,
          name: extractedPerson.name || extractedPerson.email,
          email: extractedPerson.email,
          source: "gmail",
          type: "contact",
          importance: 5,
          metadata: {
            autoCreated: true,
            createdFrom: "email",
          },
        },
      });

      extractedPerson.linkedPersonId = person.id;
      extractedPerson.linkedPerson = person;
    } catch (error) {
      // Likely duplicate email - skip silently
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        // Try to find the existing person
        const existing = await findPersonByEmail(userId, extractedPerson.email);
        if (existing) {
          extractedPerson.linkedPersonId = existing.id;
          extractedPerson.linkedPerson = existing;
        }
      }
    }
  }
}

/**
 * Find a Person by email
 */
async function findPersonByEmail(
  userId: string,
  email: string
): Promise<Person | null> {
  return db.person.findFirst({
    where: {
      userId,
      email: email.toLowerCase(),
      deletedAt: null,
    },
  });
}

/**
 * Check if an email address is valid
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get unique email addresses from extracted people
 */
export function getUniqueEmails(people: ExtractedPerson[]): string[] {
  return [...new Set(people.map((p) => p.email))];
}

/**
 * Get people by role
 */
export function getPeopleByRole(
  people: ExtractedPerson[],
  role: PersonRole
): ExtractedPerson[] {
  return people.filter((p) => p.role === role);
}

/**
 * Get linked Person IDs
 */
export function getLinkedPersonIds(people: ExtractedPerson[]): string[] {
  return people.filter((p) => p.linkedPersonId).map((p) => p.linkedPersonId!);
}
