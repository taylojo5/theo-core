// ═══════════════════════════════════════════════════════════════════════════
// Batch Operation Error Reporting
// Detailed error collection and reporting for batch database operations
// ═══════════════════════════════════════════════════════════════════════════

import { syncLogger } from "../logger";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type BatchOperationType = "create" | "update" | "upsert" | "delete";

export interface BatchItemError {
  /** Index in the original batch */
  index: number;
  /** Identifier of the failed item */
  itemId: string;
  /** Type of operation that failed */
  operation: BatchOperationType;
  /** Error message */
  message: string;
  /** Error code if available */
  code?: string;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Additional context */
  context?: Record<string, unknown>;
}

export interface BatchOperationResult<T> {
  /** Items that succeeded */
  succeeded: T[];
  /** Items that failed */
  failed: BatchItemError[];
  /** Total items in the batch */
  total: number;
  /** Number that succeeded */
  successCount: number;
  /** Number that failed */
  failCount: number;
  /** Whether any items succeeded (partial success) */
  partialSuccess: boolean;
  /** Duration in milliseconds */
  durationMs: number;
}

export interface BatchErrorReport {
  /** Batch operation identifier */
  batchId: string;
  /** Type of operation */
  operation: BatchOperationType;
  /** Total items attempted */
  totalItems: number;
  /** Number succeeded */
  succeeded: number;
  /** Number failed */
  failed: number;
  /** Success rate as percentage */
  successRate: number;
  /** Grouped errors by error code/type */
  errorGroups: ErrorGroup[];
  /** All individual errors */
  errors: BatchItemError[];
  /** Timestamp */
  timestamp: string;
  /** User ID if applicable */
  userId?: string;
}

export interface ErrorGroup {
  /** Error code or type */
  code: string;
  /** Number of occurrences */
  count: number;
  /** Sample error message */
  sampleMessage: string;
  /** Sample item IDs */
  sampleItemIds: string[];
  /** Whether these errors are retryable */
  retryable: boolean;
}

// ─────────────────────────────────────────────────────────────
// Error Classification
// ─────────────────────────────────────────────────────────────

/** Error codes for batch operations */
export const BATCH_ERROR_CODES = {
  UNIQUE_CONSTRAINT: "UNIQUE_CONSTRAINT",
  FOREIGN_KEY: "FOREIGN_KEY",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  TIMEOUT: "TIMEOUT",
  CONNECTION: "CONNECTION",
  UNKNOWN: "UNKNOWN",
} as const;

export type BatchErrorCode =
  (typeof BATCH_ERROR_CODES)[keyof typeof BATCH_ERROR_CODES];

/**
 * Classify an error into a batch error code
 */
export function classifyError(error: unknown): {
  code: BatchErrorCode;
  retryable: boolean;
} {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("unique constraint") ||
      message.includes("duplicate")
    ) {
      return { code: BATCH_ERROR_CODES.UNIQUE_CONSTRAINT, retryable: false };
    }

    if (message.includes("foreign key")) {
      return { code: BATCH_ERROR_CODES.FOREIGN_KEY, retryable: false };
    }

    if (
      message.includes("not found") ||
      message.includes("record to update not found")
    ) {
      return { code: BATCH_ERROR_CODES.NOT_FOUND, retryable: false };
    }

    if (message.includes("validation") || message.includes("invalid")) {
      return { code: BATCH_ERROR_CODES.VALIDATION, retryable: false };
    }

    if (message.includes("timeout") || message.includes("timed out")) {
      return { code: BATCH_ERROR_CODES.TIMEOUT, retryable: true };
    }

    if (
      message.includes("connection") ||
      message.includes("econnrefused") ||
      message.includes("econnreset")
    ) {
      return { code: BATCH_ERROR_CODES.CONNECTION, retryable: true };
    }
  }

  return { code: BATCH_ERROR_CODES.UNKNOWN, retryable: false };
}

// ─────────────────────────────────────────────────────────────
// Batch Error Collector
// ─────────────────────────────────────────────────────────────

export class BatchErrorCollector {
  private errors: BatchItemError[] = [];
  private operation: BatchOperationType;
  private startTime: number;

  constructor(operation: BatchOperationType) {
    this.operation = operation;
    this.startTime = Date.now();
  }

  /**
   * Add an error for a failed item
   */
  addError(
    index: number,
    itemId: string,
    error: unknown,
    context?: Record<string, unknown>
  ): void {
    const { code, retryable } = classifyError(error);
    const message = error instanceof Error ? error.message : String(error);

    this.errors.push({
      index,
      itemId,
      operation: this.operation,
      message,
      code,
      retryable,
      context,
    });
  }

  /**
   * Get all collected errors
   */
  getErrors(): BatchItemError[] {
    return [...this.errors];
  }

  /**
   * Get the count of errors
   */
  getErrorCount(): number {
    return this.errors.length;
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Get retryable errors
   */
  getRetryableErrors(): BatchItemError[] {
    return this.errors.filter((e) => e.retryable);
  }

  /**
   * Get retryable item IDs
   */
  getRetryableItemIds(): string[] {
    return this.getRetryableErrors().map((e) => e.itemId);
  }

  /**
   * Generate a detailed error report
   */
  generateReport(
    batchId: string,
    totalItems: number,
    userId?: string
  ): BatchErrorReport {
    const succeeded = totalItems - this.errors.length;
    const failed = this.errors.length;
    const successRate = totalItems > 0 ? (succeeded / totalItems) * 100 : 0;

    // Group errors by code
    const errorsByCode = new Map<string, BatchItemError[]>();
    for (const error of this.errors) {
      const code = error.code || BATCH_ERROR_CODES.UNKNOWN;
      if (!errorsByCode.has(code)) {
        errorsByCode.set(code, []);
      }
      errorsByCode.get(code)!.push(error);
    }

    const errorGroups: ErrorGroup[] = Array.from(errorsByCode.entries()).map(
      ([code, errors]) => ({
        code,
        count: errors.length,
        sampleMessage: errors[0]?.message || "Unknown error",
        sampleItemIds: errors.slice(0, 5).map((e) => e.itemId),
        retryable: errors[0]?.retryable || false,
      })
    );

    return {
      batchId,
      operation: this.operation,
      totalItems,
      succeeded,
      failed,
      successRate: Math.round(successRate * 100) / 100,
      errorGroups,
      errors: this.errors,
      timestamp: new Date().toISOString(),
      userId,
    };
  }

  /**
   * Log the error report
   */
  logReport(batchId: string, totalItems: number, userId?: string): void {
    if (!this.hasErrors()) {
      syncLogger.debug("Batch operation completed successfully", {
        batchId,
        operation: this.operation,
        totalItems,
        durationMs: Date.now() - this.startTime,
      });
      return;
    }

    const report = this.generateReport(batchId, totalItems, userId);

    syncLogger.warn("Batch operation completed with errors", {
      batchId,
      operation: this.operation,
      totalItems: report.totalItems,
      succeeded: report.succeeded,
      failed: report.failed,
      successRate: report.successRate,
      errorGroups: report.errorGroups.map((g) => ({
        code: g.code,
        count: g.count,
        retryable: g.retryable,
      })),
      durationMs: Date.now() - this.startTime,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Execute a batch operation with error collection
 */
export async function executeBatchWithErrorCollection<T, R>(
  items: T[],
  operation: BatchOperationType,
  processor: (item: T, index: number) => Promise<R>,
  getItemId: (item: T) => string,
  options: {
    batchId?: string;
    userId?: string;
    logErrors?: boolean;
  } = {}
): Promise<BatchOperationResult<R>> {
  const startTime = Date.now();
  const collector = new BatchErrorCollector(operation);
  const succeeded: R[] = [];
  const batchId = options.batchId || `batch-${Date.now()}`;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemId = getItemId(item);

    try {
      const result = await processor(item, i);
      succeeded.push(result);
    } catch (error) {
      collector.addError(i, itemId, error);
    }
  }

  if (options.logErrors) {
    collector.logReport(batchId, items.length, options.userId);
  }

  return {
    succeeded,
    failed: collector.getErrors(),
    total: items.length,
    successCount: succeeded.length,
    failCount: collector.getErrorCount(),
    partialSuccess: succeeded.length > 0 && collector.hasErrors(),
    durationMs: Date.now() - startTime,
  };
}

/**
 * Execute a batch operation in parallel with error collection
 */
export async function executeBatchParallelWithErrorCollection<T, R>(
  items: T[],
  operation: BatchOperationType,
  processor: (item: T, index: number) => Promise<R>,
  getItemId: (item: T) => string,
  options: {
    batchId?: string;
    userId?: string;
    logErrors?: boolean;
    concurrency?: number;
  } = {}
): Promise<BatchOperationResult<R>> {
  const startTime = Date.now();
  const collector = new BatchErrorCollector(operation);
  const succeeded: R[] = [];
  const batchId = options.batchId || `batch-${Date.now()}`;
  const concurrency = options.concurrency || 10;

  // Process in chunks for concurrency control
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkStartIndex = i;

    const results = await Promise.allSettled(
      chunk.map((item, chunkIndex) =>
        processor(item, chunkStartIndex + chunkIndex)
      )
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const item = chunk[j];
      const itemId = getItemId(item);
      const index = chunkStartIndex + j;

      if (result.status === "fulfilled") {
        succeeded.push(result.value);
      } else {
        collector.addError(index, itemId, result.reason);
      }
    }
  }

  if (options.logErrors) {
    collector.logReport(batchId, items.length, options.userId);
  }

  return {
    succeeded,
    failed: collector.getErrors(),
    total: items.length,
    successCount: succeeded.length,
    failCount: collector.getErrorCount(),
    partialSuccess: succeeded.length > 0 && collector.hasErrors(),
    durationMs: Date.now() - startTime,
  };
}
