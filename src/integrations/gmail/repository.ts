// ═══════════════════════════════════════════════════════════════════════════
// Gmail Email Repository
// Database operations for email storage and retrieval
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { Email, EmailLabel, GmailSyncState, Prisma } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type CreateEmailInput = Omit<
  Prisma.EmailCreateInput,
  "user" | "createdAt" | "updatedAt"
> & {
  userId: string;
};

export type UpsertEmailInput = CreateEmailInput;

export type UpdateEmailInput = Partial<
  Omit<Prisma.EmailUpdateInput, "user" | "createdAt" | "updatedAt" | "gmailId">
>;

export interface EmailSearchQuery {
  query?: string;
  fromEmail?: string;
  toEmail?: string;
  labelIds?: string[];
  isRead?: boolean;
  isStarred?: boolean;
  isImportant?: boolean;
  hasAttachments?: boolean;
  startDate?: Date;
  endDate?: Date;
  threadId?: string;
  limit?: number;
  offset?: number;
  orderBy?: "internalDate" | "receivedAt" | "updatedAt";
  orderDirection?: "asc" | "desc";
}

export interface EmailSearchResult {
  emails: Email[];
  total: number;
  hasMore: boolean;
}

export type CreateLabelInput = Omit<
  Prisma.EmailLabelCreateInput,
  "user" | "createdAt" | "updatedAt"
> & {
  userId: string;
};

export type SyncStateUpdate = Partial<
  Omit<
    Prisma.GmailSyncStateUpdateInput,
    "user" | "createdAt" | "updatedAt" | "id"
  >
>;

// ─────────────────────────────────────────────────────────────
// Email Repository
// ─────────────────────────────────────────────────────────────

export const emailRepository = {
  /**
   * Create a new email record
   */
  create: async (input: CreateEmailInput): Promise<Email> => {
    const { userId, ...data } = input;
    return db.email.create({
      data: {
        ...data,
        user: { connect: { id: userId } },
      },
    });
  },

  /**
   * Upsert an email (create or update based on gmailId)
   */
  upsert: async (input: UpsertEmailInput): Promise<Email> => {
    const { userId, gmailId, ...data } = input;
    return db.email.upsert({
      where: { gmailId },
      create: {
        ...data,
        gmailId,
        user: { connect: { id: userId } },
      },
      update: {
        ...data,
        updatedAt: new Date(),
      },
    });
  },

  /**
   * Bulk upsert emails for efficient sync
   */
  upsertMany: async (inputs: UpsertEmailInput[]): Promise<number> => {
    // Use transactions for atomicity
    const results = await db.$transaction(
      inputs.map((input) => {
        const { userId, gmailId, ...data } = input;
        return db.email.upsert({
          where: { gmailId },
          create: {
            ...data,
            gmailId,
            user: { connect: { id: userId } },
          },
          update: {
            ...data,
            updatedAt: new Date(),
          },
        });
      })
    );
    return results.length;
  },

  /**
   * Find an email by Gmail ID
   */
  findByGmailId: async (gmailId: string): Promise<Email | null> => {
    return db.email.findUnique({
      where: { gmailId },
    });
  },

  /**
   * Find an email by Gmail ID for a specific user
   */
  findByUserAndGmailId: async (
    userId: string,
    gmailId: string
  ): Promise<Email | null> => {
    return db.email.findFirst({
      where: {
        userId,
        gmailId,
      },
    });
  },

  /**
   * Find all emails in a thread
   */
  findByThread: async (userId: string, threadId: string): Promise<Email[]> => {
    return db.email.findMany({
      where: {
        userId,
        threadId,
      },
      orderBy: {
        internalDate: "asc",
      },
    });
  },

  /**
   * Search emails with various filters
   */
  search: async (
    userId: string,
    query: EmailSearchQuery
  ): Promise<EmailSearchResult> => {
    const {
      query: textQuery,
      fromEmail,
      toEmail,
      labelIds,
      isRead,
      isStarred,
      isImportant,
      hasAttachments,
      startDate,
      endDate,
      threadId,
      limit = 50,
      offset = 0,
      orderBy = "internalDate",
      orderDirection = "desc",
    } = query;

    const where: Prisma.EmailWhereInput = {
      userId,
    };

    // Text search (subject and snippet)
    if (textQuery) {
      where.OR = [
        { subject: { contains: textQuery, mode: "insensitive" } },
        { snippet: { contains: textQuery, mode: "insensitive" } },
        { fromName: { contains: textQuery, mode: "insensitive" } },
        { fromEmail: { contains: textQuery, mode: "insensitive" } },
      ];
    }

    // Email filters
    if (fromEmail) {
      where.fromEmail = { contains: fromEmail, mode: "insensitive" };
    }

    if (toEmail) {
      where.toEmails = { has: toEmail };
    }

    if (labelIds && labelIds.length > 0) {
      where.labelIds = { hasSome: labelIds };
    }

    // Boolean filters
    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    if (isStarred !== undefined) {
      where.isStarred = isStarred;
    }

    if (isImportant !== undefined) {
      where.isImportant = isImportant;
    }

    if (hasAttachments !== undefined) {
      where.hasAttachments = hasAttachments;
    }

    // Thread filter
    if (threadId) {
      where.threadId = threadId;
    }

    // Date range
    if (startDate || endDate) {
      where.internalDate = {};
      if (startDate) {
        where.internalDate.gte = startDate;
      }
      if (endDate) {
        where.internalDate.lte = endDate;
      }
    }

    // Execute count and find in parallel
    const [total, emails] = await Promise.all([
      db.email.count({ where }),
      db.email.findMany({
        where,
        orderBy: {
          [orderBy]: orderDirection,
        },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      emails,
      total,
      hasMore: offset + emails.length < total,
    };
  },

  /**
   * Get recent emails for a user
   */
  getRecent: async (userId: string, limit = 20): Promise<Email[]> => {
    return db.email.findMany({
      where: { userId },
      orderBy: { internalDate: "desc" },
      take: limit,
    });
  },

  /**
   * Get unread email count
   */
  getUnreadCount: async (userId: string): Promise<number> => {
    return db.email.count({
      where: {
        userId,
        isRead: false,
        labelIds: { has: "INBOX" },
      },
    });
  },

  /**
   * Update an email
   */
  update: async (
    gmailId: string,
    data: UpdateEmailInput
  ): Promise<Email | null> => {
    try {
      return await db.email.update({
        where: { gmailId },
        data,
      });
    } catch {
      // Email might have been deleted
      return null;
    }
  },

  /**
   * Mark emails as read/unread
   */
  markRead: async (gmailIds: string[], isRead: boolean): Promise<number> => {
    const result = await db.email.updateMany({
      where: { gmailId: { in: gmailIds } },
      data: { isRead },
    });
    return result.count;
  },

  /**
   * Update labels for an email
   */
  updateLabels: async (
    gmailId: string,
    labelIds: string[]
  ): Promise<Email | null> => {
    try {
      return await db.email.update({
        where: { gmailId },
        data: { labelIds },
      });
    } catch {
      return null;
    }
  },

  /**
   * Delete an email by Gmail ID
   */
  delete: async (gmailId: string): Promise<boolean> => {
    try {
      await db.email.delete({
        where: { gmailId },
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Delete multiple emails by Gmail IDs
   */
  deleteMany: async (gmailIds: string[]): Promise<number> => {
    const result = await db.email.deleteMany({
      where: { gmailId: { in: gmailIds } },
    });
    return result.count;
  },

  /**
   * Delete all emails for a user
   */
  deleteAllForUser: async (userId: string): Promise<number> => {
    const result = await db.email.deleteMany({
      where: { userId },
    });
    return result.count;
  },

  /**
   * Get email count for a user
   */
  count: async (userId: string): Promise<number> => {
    return db.email.count({
      where: { userId },
    });
  },

  /**
   * Get emails by label
   */
  findByLabel: async (
    userId: string,
    labelId: string,
    limit = 50
  ): Promise<Email[]> => {
    return db.email.findMany({
      where: {
        userId,
        labelIds: { has: labelId },
      },
      orderBy: { internalDate: "desc" },
      take: limit,
    });
  },
};

// ─────────────────────────────────────────────────────────────
// Email Label Repository
// ─────────────────────────────────────────────────────────────

export const labelRepository = {
  /**
   * Create a new label
   */
  create: async (input: CreateLabelInput): Promise<EmailLabel> => {
    const { userId, ...data } = input;
    return db.emailLabel.create({
      data: {
        ...data,
        user: { connect: { id: userId } },
      },
    });
  },

  /**
   * Upsert a label
   */
  upsert: async (input: CreateLabelInput): Promise<EmailLabel> => {
    const { userId, gmailId, ...data } = input;
    return db.emailLabel.upsert({
      where: {
        userId_gmailId: { userId, gmailId },
      },
      create: {
        ...data,
        gmailId,
        user: { connect: { id: userId } },
      },
      update: {
        ...data,
        updatedAt: new Date(),
      },
    });
  },

  /**
   * Bulk upsert labels
   */
  upsertMany: async (inputs: CreateLabelInput[]): Promise<number> => {
    const results = await db.$transaction(
      inputs.map((input) => {
        const { userId, gmailId, ...data } = input;
        return db.emailLabel.upsert({
          where: {
            userId_gmailId: { userId, gmailId },
          },
          create: {
            ...data,
            gmailId,
            user: { connect: { id: userId } },
          },
          update: {
            ...data,
            updatedAt: new Date(),
          },
        });
      })
    );
    return results.length;
  },

  /**
   * Find all labels for a user
   */
  findAll: async (userId: string): Promise<EmailLabel[]> => {
    return db.emailLabel.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
  },

  /**
   * Find a label by Gmail ID
   */
  findByGmailId: async (
    userId: string,
    gmailId: string
  ): Promise<EmailLabel | null> => {
    return db.emailLabel.findUnique({
      where: {
        userId_gmailId: { userId, gmailId },
      },
    });
  },

  /**
   * Delete a label
   */
  delete: async (userId: string, gmailId: string): Promise<boolean> => {
    try {
      await db.emailLabel.delete({
        where: {
          userId_gmailId: { userId, gmailId },
        },
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Delete all labels for a user
   */
  deleteAllForUser: async (userId: string): Promise<number> => {
    const result = await db.emailLabel.deleteMany({
      where: { userId },
    });
    return result.count;
  },
};

// ─────────────────────────────────────────────────────────────
// Gmail Sync State Repository
// ─────────────────────────────────────────────────────────────

export const syncStateRepository = {
  /**
   * Get sync state for a user (creates if doesn't exist)
   */
  get: async (userId: string): Promise<GmailSyncState> => {
    return db.gmailSyncState.upsert({
      where: { userId },
      create: {
        user: { connect: { id: userId } },
      },
      update: {},
    });
  },

  /**
   * Update sync state
   */
  update: async (
    userId: string,
    data: SyncStateUpdate
  ): Promise<GmailSyncState> => {
    return db.gmailSyncState.upsert({
      where: { userId },
      create: {
        user: { connect: { id: userId } },
        syncStatus: (data.syncStatus as string) || "idle",
        historyId: data.historyId as string | undefined,
        lastSyncAt: data.lastSyncAt as Date | undefined,
        lastFullSyncAt: data.lastFullSyncAt as Date | undefined,
        syncError: data.syncError as string | undefined,
        emailCount: (data.emailCount as number) || 0,
        labelCount: (data.labelCount as number) || 0,
        contactCount: (data.contactCount as number) || 0,
        // Sync configuration fields - only include if defined to preserve schema defaults
        ...(data.syncLabels !== undefined && {
          syncLabels: data.syncLabels as string[],
        }),
        ...(data.excludeLabels !== undefined && {
          excludeLabels: data.excludeLabels as string[],
        }),
        ...(data.maxEmailAgeDays !== undefined && {
          maxEmailAgeDays: data.maxEmailAgeDays as number,
        }),
        ...(data.syncAttachments !== undefined && {
          syncAttachments: data.syncAttachments as boolean,
        }),
      },
      update: data,
    });
  },

  /**
   * Set sync status to syncing
   */
  startSync: async (userId: string): Promise<GmailSyncState> => {
    return db.gmailSyncState.upsert({
      where: { userId },
      create: {
        user: { connect: { id: userId } },
        syncStatus: "syncing",
      },
      update: {
        syncStatus: "syncing",
        syncError: null,
      },
    });
  },

  /**
   * Complete a sync successfully
   */
  completeSync: async (
    userId: string,
    historyId: string,
    isFullSync = false
  ): Promise<GmailSyncState> => {
    const now = new Date();
    const updateData: Prisma.GmailSyncStateUpdateInput = {
      syncStatus: "idle",
      syncError: null,
      historyId,
      lastSyncAt: now,
    };

    if (isFullSync) {
      updateData.lastFullSyncAt = now;
    }

    // Get updated email count
    const emailCount = await db.email.count({ where: { userId } });
    updateData.emailCount = emailCount;

    return db.gmailSyncState.upsert({
      where: { userId },
      create: {
        user: { connect: { id: userId } },
        syncStatus: "idle",
        historyId,
        lastSyncAt: now,
        lastFullSyncAt: isFullSync ? now : null,
        emailCount,
      },
      update: updateData,
    });
  },

  /**
   * Mark sync as failed
   */
  failSync: async (userId: string, error: string): Promise<GmailSyncState> => {
    return db.gmailSyncState.upsert({
      where: { userId },
      create: {
        user: { connect: { id: userId } },
        syncStatus: "error",
        syncError: error,
      },
      update: {
        syncStatus: "error",
        syncError: error,
      },
    });
  },

  /**
   * Check if a user has ever synced
   */
  hasEverSynced: async (userId: string): Promise<boolean> => {
    const state = await db.gmailSyncState.findUnique({
      where: { userId },
      select: { historyId: true },
    });
    return state?.historyId != null;
  },

  /**
   * Delete sync state for a user (for disconnect)
   */
  delete: async (userId: string): Promise<boolean> => {
    try {
      await db.gmailSyncState.delete({
        where: { userId },
      });
      return true;
    } catch {
      return false;
    }
  },
};
