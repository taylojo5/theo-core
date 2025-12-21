// ═══════════════════════════════════════════════════════════════════════════
// Gmail Test Fixtures - Contacts
// Mock Google Contacts data for testing
// ═══════════════════════════════════════════════════════════════════════════

import type { GoogleContact, ParsedContact } from "@/integrations/gmail";

// ─────────────────────────────────────────────────────────────
// Google Contact Fixtures
// ─────────────────────────────────────────────────────────────

/**
 * Full contact with all fields
 */
export const fullContact: GoogleContact = {
  resourceName: "people/c123456789",
  etag: "%EgMBBgkQLDg=",
  names: [
    {
      displayName: "John Smith",
      givenName: "John",
      familyName: "Smith",
    },
  ],
  emailAddresses: [
    { value: "john.smith@example.com", type: "work" },
    { value: "johnsmith@personal.com", type: "home" },
  ],
  phoneNumbers: [
    { value: "+1-555-123-4567", type: "mobile" },
    { value: "+1-555-987-6543", type: "work" },
  ],
  organizations: [
    {
      name: "Example Corp",
      title: "Software Engineer",
    },
  ],
  photos: [
    {
      url: "https://lh3.googleusercontent.com/photo123",
      default: false,
    },
  ],
  addresses: [
    {
      formattedValue: "123 Main St, San Francisco, CA 94105",
      type: "work",
    },
  ],
  birthdays: [
    {
      date: {
        year: 1990,
        month: 5,
        day: 15,
      },
    },
  ],
  biographies: [
    {
      value: "Senior developer working on cloud infrastructure.",
    },
  ],
};

/**
 * Minimal contact with only email
 */
export const minimalContact: GoogleContact = {
  resourceName: "people/c987654321",
  etag: "%EgMBBgkQLA==",
  emailAddresses: [{ value: "minimal@example.com" }],
};

/**
 * Contact with just name (no email)
 */
export const nameOnlyContact: GoogleContact = {
  resourceName: "people/c111222333",
  etag: "%EgMBBgkQLB==",
  names: [
    {
      displayName: "No Email Person",
      givenName: "No Email",
      familyName: "Person",
    },
  ],
  phoneNumbers: [{ value: "+1-555-000-0000" }],
};

/**
 * Contact with organization but no name
 */
export const orgOnlyContact: GoogleContact = {
  resourceName: "people/c444555666",
  etag: "%EgMBBgkQLC==",
  emailAddresses: [{ value: "support@company.com" }],
  organizations: [
    {
      name: "Company Support",
    },
  ],
};

/**
 * Contact with multiple emails
 */
export const multipleEmailContact: GoogleContact = {
  resourceName: "people/c777888999",
  etag: "%EgMBBgkQLD==",
  names: [
    {
      displayName: "Multi Email User",
      givenName: "Multi",
      familyName: "User",
    },
  ],
  emailAddresses: [
    { value: "primary@example.com", type: "work" },
    { value: "secondary@example.com", type: "home" },
    { value: "other@example.com", type: "other" },
  ],
};

// ─────────────────────────────────────────────────────────────
// Contact List Response Fixtures
// ─────────────────────────────────────────────────────────────

export const contactListResponse = {
  contacts: [fullContact, minimalContact, multipleEmailContact],
  nextPageToken: "token_page_2",
  totalItems: 150,
};

export const contactListPage2Response = {
  contacts: [nameOnlyContact, orgOnlyContact],
  nextPageToken: undefined,
  totalItems: 150,
};

// ─────────────────────────────────────────────────────────────
// Expected Parsed Contacts
// ─────────────────────────────────────────────────────────────

export const expectedParsedFullContact: ParsedContact = {
  resourceName: "people/c123456789",
  etag: "%EgMBBgkQLDg=",
  name: "John Smith",
  firstName: "John",
  lastName: "Smith",
  email: "john.smith@example.com",
  emails: ["john.smith@example.com", "johnsmith@personal.com"],
  phone: "+1-555-123-4567",
  phones: ["+1-555-123-4567", "+1-555-987-6543"],
  company: "Example Corp",
  title: "Software Engineer",
  photoUrl: "https://lh3.googleusercontent.com/photo123",
  address: "123 Main St, San Francisco, CA 94105",
  birthday: new Date(1990, 4, 15), // May 15, 1990
  notes: "Senior developer working on cloud infrastructure.",
};

export const expectedParsedMinimalContact: ParsedContact = {
  resourceName: "people/c987654321",
  etag: "%EgMBBgkQLA==",
  name: "minimal@example.com", // Falls back to email
  firstName: undefined,
  lastName: undefined,
  email: "minimal@example.com",
  emails: ["minimal@example.com"],
  phone: undefined,
  phones: [],
  company: undefined,
  title: undefined,
  photoUrl: undefined,
  address: undefined,
  birthday: undefined,
  notes: undefined,
};

// ─────────────────────────────────────────────────────────────
// Contact Sync Test Data
// ─────────────────────────────────────────────────────────────

/**
 * Contacts for sync testing - includes various edge cases
 */
export const syncTestContacts: GoogleContact[] = [
  fullContact,
  minimalContact,
  nameOnlyContact, // Should be skipped if requireEmail is true
  multipleEmailContact,
  {
    resourceName: "people/c999111222",
    etag: "%EgMBBgkQLE==",
    names: [
      {
        displayName: "Duplicate Email",
        givenName: "Duplicate",
        familyName: "Email",
      },
    ],
    // Same email as minimalContact - test deduplication
    emailAddresses: [{ value: "minimal@example.com" }],
  },
  orgOnlyContact,
];

/**
 * Expected sync results for syncTestContacts with requireEmail: true
 */
export const expectedSyncWithEmailRequired = {
  total: 6,
  skipped: 1, // nameOnlyContact has no email
  // Actual created/updated depends on existing data
};
