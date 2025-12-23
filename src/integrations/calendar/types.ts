// ═══════════════════════════════════════════════════════════════════════════
// Calendar Integration Types
// TypeScript type definitions for Google Calendar API interactions
// ═══════════════════════════════════════════════════════════════════════════

import {
  CALENDAR_ACCESS_ROLES,
  ATTENDEE_RESPONSE_STATUS,
  EVENT_VISIBILITY,
  EVENT_STATUS,
} from "./constants";

// ─────────────────────────────────────────────────────────────
// Calendar Types
// ─────────────────────────────────────────────────────────────

/**
 * A Google Calendar as returned by CalendarList.list API
 */
export interface GoogleCalendar {
  /** Calendar identifier */
  id: string;
  /** Title of the calendar */
  summary: string;
  /** Description of the calendar */
  description?: string;
  /** Geographic location of the calendar as free-form text */
  location?: string;
  /** The time zone of the calendar */
  timeZone?: string;
  /** The effective access role the authenticated user has on the calendar */
  accessRole: CalendarAccessRole;
  /** Whether the calendar has been selected in the UI */
  selected?: boolean;
  /** Whether the calendar is the primary calendar */
  primary?: boolean;
  /** Whether the calendar content shows up in the UI */
  hidden?: boolean;
  /** The main color of the calendar */
  backgroundColor?: string;
  /** The foreground color for text on the calendar */
  foregroundColor?: string;
  /** Whether this calendar is deleted from the calendar list */
  deleted?: boolean;
  /** ETag of the resource */
  etag?: string;
}

/**
 * Calendar access role values
 */
export type CalendarAccessRole =
  (typeof CALENDAR_ACCESS_ROLES)[keyof typeof CALENDAR_ACCESS_ROLES];

// ─────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────

/**
 * A Google Calendar event as returned by the API
 */
export interface GoogleEvent {
  /** Unique identifier for the event */
  id: string;
  /** Calendar identifier where the event belongs */
  calendarId?: string;
  /** Status of the event */
  status?: EventStatus;
  /** URL of the event */
  htmlLink?: string;
  /** Title of the event */
  summary?: string;
  /** Description of the event */
  description?: string;
  /** Geographic location of the event */
  location?: string;
  /** Color ID of the event */
  colorId?: string;
  /** Creator of the event */
  creator?: EventCreator;
  /** Organizer of the event */
  organizer?: EventOrganizer;
  /** Start time of the event */
  start: EventDateTime;
  /** End time of the event */
  end: EventDateTime;
  /** Whether the end time is unspecified */
  endTimeUnspecified?: boolean;
  /** Recurrence rules for recurring events */
  recurrence?: string[];
  /** ID of the recurring event this is an instance of */
  recurringEventId?: string;
  /** Original start time of the event (for recurring event instances) */
  originalStartTime?: EventDateTime;
  /** Transparency of the event (affects free/busy status) */
  transparency?: "opaque" | "transparent";
  /** Visibility of the event */
  visibility?: EventVisibility;
  /** iCalendar UID */
  iCalUID?: string;
  /** Sequence number for updates */
  sequence?: number;
  /** List of attendees */
  attendees?: EventAttendee[];
  /** Whether attendees may be modified */
  attendeesOmitted?: boolean;
  /** Extended properties of the event */
  extendedProperties?: EventExtendedProperties;
  /** URL for Google Hangout/Meet */
  hangoutLink?: string;
  /** Conference data for video conferencing */
  conferenceData?: ConferenceData;
  /** Gadget preferences */
  gadget?: EventGadget;
  /** Whether anyone can invite themselves */
  anyoneCanAddSelf?: boolean;
  /** Whether guests can invite others */
  guestsCanInviteOthers?: boolean;
  /** Whether guests can modify the event */
  guestsCanModify?: boolean;
  /** Whether guests can see other guests */
  guestsCanSeeOtherGuests?: boolean;
  /** Whether this is a private copy */
  privateCopy?: boolean;
  /** Whether this is a locked event */
  locked?: boolean;
  /** Reminders for the event */
  reminders?: EventReminders;
  /** Source of the event */
  source?: EventSource;
  /** Attachments to the event */
  attachments?: EventAttachment[];
  /** Event type (default, outOfOffice, focusTime) */
  eventType?: EventType;
  /** Creation time */
  created?: string;
  /** Last modification time */
  updated?: string;
  /** ETag of the resource */
  etag?: string;
}

/**
 * Event status values
 */
export type EventStatus =
  (typeof EVENT_STATUS)[keyof typeof EVENT_STATUS];

/**
 * Event visibility values
 */
export type EventVisibility =
  (typeof EVENT_VISIBILITY)[keyof typeof EVENT_VISIBILITY];

/**
 * Event type values
 */
export type EventType = "default" | "outOfOffice" | "focusTime" | "workingLocation";

// ─────────────────────────────────────────────────────────────
// Event Participant Types
// ─────────────────────────────────────────────────────────────

/**
 * Event creator information
 */
export interface EventCreator {
  /** Creator's ID (only for resource calendars) */
  id?: string;
  /** Creator's email address */
  email?: string;
  /** Creator's display name */
  displayName?: string;
  /** Whether this is the authenticated user */
  self?: boolean;
}

/**
 * Event organizer information
 */
export interface EventOrganizer {
  /** Organizer's ID (only for resource calendars) */
  id?: string;
  /** Organizer's email address */
  email?: string;
  /** Organizer's display name */
  displayName?: string;
  /** Whether this is the authenticated user */
  self?: boolean;
}

/**
 * Event attendee information
 */
export interface EventAttendee {
  /** Attendee's ID (only for resource calendars) */
  id?: string;
  /** Attendee's email address */
  email: string;
  /** Attendee's display name */
  displayName?: string;
  /** Whether this is the organizer */
  organizer?: boolean;
  /** Whether this is the authenticated user */
  self?: boolean;
  /** Whether this is a resource (room, etc.) */
  resource?: boolean;
  /** Whether this is an optional attendee */
  optional?: boolean;
  /** Response status */
  responseStatus?: AttendeeResponseStatus;
  /** Comment from the attendee */
  comment?: string;
  /** Number of additional guests */
  additionalGuests?: number;
}

/**
 * Attendee response status values
 */
export type AttendeeResponseStatus =
  (typeof ATTENDEE_RESPONSE_STATUS)[keyof typeof ATTENDEE_RESPONSE_STATUS];

// ─────────────────────────────────────────────────────────────
// DateTime Types
// ─────────────────────────────────────────────────────────────

/**
 * Event date/time information
 * Either date or dateTime will be present, but not both
 */
export interface EventDateTime {
  /** Date (for all-day events) in format YYYY-MM-DD */
  date?: string;
  /** DateTime (for timed events) in RFC3339 format */
  dateTime?: string;
  /** Time zone */
  timeZone?: string;
}

// ─────────────────────────────────────────────────────────────
// Conference Types
// ─────────────────────────────────────────────────────────────

/**
 * Conference data for video meetings
 */
export interface ConferenceData {
  /** Type of conference solution */
  createRequest?: {
    requestId: string;
    conferenceSolutionKey: {
      type: string;
    };
    status?: {
      statusCode: string;
    };
  };
  /** Entry points for joining the conference */
  entryPoints?: ConferenceEntryPoint[];
  /** Conference solution information */
  conferenceSolution?: {
    key: {
      type: string;
    };
    name?: string;
    iconUri?: string;
  };
  /** Conference ID */
  conferenceId?: string;
  /** Signature of the conference data */
  signature?: string;
  /** Notes about the conference */
  notes?: string;
}

/**
 * Conference entry point
 */
export interface ConferenceEntryPoint {
  /** Entry point type */
  entryPointType: "video" | "phone" | "sip" | "more";
  /** URI for joining */
  uri?: string;
  /** Label for the entry point */
  label?: string;
  /** PIN for phone entry */
  pin?: string;
  /** Access code */
  accessCode?: string;
  /** Meeting code */
  meetingCode?: string;
  /** Passcode */
  passcode?: string;
  /** Password */
  password?: string;
}

// ─────────────────────────────────────────────────────────────
// Reminder Types
// ─────────────────────────────────────────────────────────────

/**
 * Event reminder settings
 */
export interface EventReminders {
  /** Whether to use the default reminders for this calendar */
  useDefault: boolean;
  /** Override reminders if not using defaults */
  overrides?: EventReminder[];
}

/**
 * Individual reminder
 */
export interface EventReminder {
  /** Reminder delivery method */
  method: "email" | "popup";
  /** Minutes before event start */
  minutes: number;
}

// ─────────────────────────────────────────────────────────────
// Extended Properties & Attachments
// ─────────────────────────────────────────────────────────────

/**
 * Extended properties for custom data
 */
export interface EventExtendedProperties {
  /** Properties visible only to the owner */
  private?: Record<string, string>;
  /** Properties visible to all attendees */
  shared?: Record<string, string>;
}

/**
 * Event source information
 */
export interface EventSource {
  /** URL of the source */
  url: string;
  /** Title of the source */
  title?: string;
}

/**
 * Event gadget (deprecated but may still appear)
 */
export interface EventGadget {
  type?: string;
  title?: string;
  link?: string;
  iconLink?: string;
  width?: number;
  height?: number;
  display?: string;
  preferences?: Record<string, string>;
}

/**
 * Event attachment
 */
export interface EventAttachment {
  /** URL link to the attachment */
  fileUrl: string;
  /** Title of the attachment */
  title?: string;
  /** MIME type */
  mimeType?: string;
  /** Icon URL */
  iconLink?: string;
  /** File ID (for Google Drive) */
  fileId?: string;
}

// ─────────────────────────────────────────────────────────────
// List Response Types
// ─────────────────────────────────────────────────────────────

/**
 * Response from CalendarList.list API
 */
export interface CalendarListResponse {
  /** List of calendars */
  items: GoogleCalendar[];
  /** Token for next page */
  nextPageToken?: string;
  /** Sync token for incremental sync */
  nextSyncToken?: string;
  /** ETag of the collection */
  etag?: string;
}

/**
 * Response from Events.list API
 */
export interface EventListResponse {
  /** List of events */
  items: GoogleEvent[];
  /** Summary (calendar name) */
  summary?: string;
  /** Description */
  description?: string;
  /** Time zone */
  timeZone?: string;
  /** Access role for this calendar */
  accessRole?: CalendarAccessRole;
  /** Token for next page */
  nextPageToken?: string;
  /** Sync token for incremental sync */
  nextSyncToken?: string;
  /** Default reminders */
  defaultReminders?: EventReminder[];
  /** ETag of the collection */
  etag?: string;
  /** Updated timestamp */
  updated?: string;
}

// ─────────────────────────────────────────────────────────────
// Watch/Webhook Types
// ─────────────────────────────────────────────────────────────

/**
 * Response from setting up a watch channel
 */
export interface WatchResponse {
  /** A UUID for the channel */
  id: string;
  /** ID identifying the watched resource */
  resourceId: string;
  /** URI of the watched resource */
  resourceUri: string;
  /** Webhook expiration time */
  expiration: string;
  /** Token to identify this channel */
  token?: string;
}

/**
 * Webhook notification from Google
 */
export interface WebhookNotification {
  /** Channel ID */
  channelId: string;
  /** Resource ID */
  resourceId: string;
  /** Resource state */
  resourceState: "sync" | "exists" | "not_exists";
  /** Message number */
  messageNumber?: string;
  /** Resource URI */
  resourceUri?: string;
  /** Expiration time */
  expiration?: string;
}

// ─────────────────────────────────────────────────────────────
// Client Options Types
// ─────────────────────────────────────────────────────────────

/**
 * Options for listing calendars
 */
export interface ListCalendarsOptions {
  /** Maximum number to return */
  maxResults?: number;
  /** Page token for pagination */
  pageToken?: string;
  /** Only show hidden calendars */
  showHidden?: boolean;
  /** Sync token for incremental sync */
  syncToken?: string;
}

/**
 * Options for listing events
 */
export interface ListEventsOptions {
  /** Calendar ID */
  calendarId?: string;
  /** Maximum results per page */
  maxResults?: number;
  /** Page token for pagination */
  pageToken?: string;
  /** Filter by start time (lower bound) */
  timeMin?: string;
  /** Filter by end time (upper bound) */
  timeMax?: string;
  /** Filter by update time */
  updatedMin?: string;
  /** Sync token for incremental sync */
  syncToken?: string;
  /** Whether to include deleted events */
  showDeleted?: boolean;
  /** Whether to expand recurring events */
  singleEvents?: boolean;
  /** Order by */
  orderBy?: "startTime" | "updated";
  /** Search query */
  q?: string;
  /** Time zone */
  timeZone?: string;
  /** Maximum attendees to include */
  maxAttendees?: number;
}

// ─────────────────────────────────────────────────────────────
// Input Types (for creating/updating)
// ─────────────────────────────────────────────────────────────

/**
 * Input for creating a new event
 */
export interface EventCreateInput {
  /** Event title */
  summary: string;
  /** Event description */
  description?: string;
  /** Location */
  location?: string;
  /** Start time */
  start: EventDateTime;
  /** End time */
  end: EventDateTime;
  /** Time zone */
  timeZone?: string;
  /** Attendees to invite */
  attendees?: Array<{ email: string; optional?: boolean }>;
  /** Whether to add Google Meet */
  conferenceDataVersion?: number;
  /** Create conference */
  createConference?: boolean;
  /** Reminders */
  reminders?: EventReminders;
  /** Recurrence rules */
  recurrence?: string[];
  /** Visibility */
  visibility?: EventVisibility;
  /** Whether guests can invite others */
  guestsCanInviteOthers?: boolean;
  /** Whether guests can see other guests */
  guestsCanSeeOtherGuests?: boolean;
  /** Event color ID */
  colorId?: string;
}

/**
 * Input for updating an event
 */
export interface EventUpdateInput {
  /** Event title */
  summary?: string;
  /** Event description */
  description?: string;
  /** Location */
  location?: string;
  /** Start time */
  start?: EventDateTime;
  /** End time */
  end?: EventDateTime;
  /** Attendees */
  attendees?: Array<{ email: string; optional?: boolean; responseStatus?: AttendeeResponseStatus }>;
  /** Reminders */
  reminders?: EventReminders;
  /** Recurrence rules */
  recurrence?: string[];
  /** Visibility */
  visibility?: EventVisibility;
  /** Status */
  status?: EventStatus;
  /** Event color ID */
  colorId?: string;
}

// ─────────────────────────────────────────────────────────────
// Sync Types
// ─────────────────────────────────────────────────────────────

/**
 * Calendar sync options
 */
export interface CalendarSyncOptions {
  /** Only sync specific calendar IDs */
  calendarIds?: string[];
  /** Exclude specific calendar IDs */
  excludeCalendarIds?: string[];
  /** Start date for event sync range */
  timeMin?: Date;
  /** End date for event sync range */
  timeMax?: Date;
  /** Maximum events to sync */
  maxEvents?: number;
  /** Whether to force full sync (ignore sync token) */
  forceFullSync?: boolean;
}

/**
 * Sync status values
 */
export type CalendarSyncStatus =
  | "idle"
  | "syncing"
  | "full_sync"
  | "incremental_sync"
  | "error"
  | "paused";

// ─────────────────────────────────────────────────────────────
// Action Types
// ─────────────────────────────────────────────────────────────

/**
 * Types of calendar actions that require approval
 */
export type CalendarActionType = "create" | "update" | "delete" | "respond";

/**
 * Approval status values
 */
export type CalendarApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "executed"
  | "failed";

// ─────────────────────────────────────────────────────────────
// Quota Types
// ─────────────────────────────────────────────────────────────

/**
 * Calendar API quota units
 * Different operations consume different quota amounts
 */
export const CALENDAR_QUOTA_UNITS = {
  // Read operations
  "calendarList.list": 1,
  "calendarList.get": 1,
  "events.list": 1,
  "events.get": 1,
  "events.instances": 1,
  "settings.list": 1,
  "settings.get": 1,
  "colors.get": 1,
  "freebusy.query": 1,

  // Write operations
  "events.insert": 2,
  "events.update": 2,
  "events.patch": 2,
  "events.delete": 2,
  "events.move": 2,
  "events.quickAdd": 2,

  // Watch operations
  "events.watch": 2,
  "calendarList.watch": 2,
  "channels.stop": 1,
} as const;

export type CalendarOperation = keyof typeof CALENDAR_QUOTA_UNITS;

