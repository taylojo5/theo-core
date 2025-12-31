// ═══════════════════════════════════════════════════════════════════════════
// Calendar Structured Logger
// Centralized logging for Calendar integration with structured output
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log levels for the Calendar logger
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Structured log entry for Calendar operations
 */
export interface CalendarLogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  userId?: string;
  operationId?: string;
}

/**
 * Log handler function type
 */
type LogHandler = (entry: CalendarLogEntry) => void;

// ─────────────────────────────────────────────────────────────
// Logger Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Logger configuration options
 */
interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Include stack traces for errors */
  includeStackTraces: boolean;
  /** Include debug logs (set false in production) */
  enableDebug: boolean;
  /** Custom log handler (defaults to console) */
  handler?: LogHandler;
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: process.env.NODE_ENV === "production" ? "info" : "debug",
  includeStackTraces: process.env.NODE_ENV !== "production",
  enableDebug: process.env.NODE_ENV !== "production",
};

// ─────────────────────────────────────────────────────────────
// Calendar Logger Class
// ─────────────────────────────────────────────────────────────

/**
 * Structured logger for Calendar integration operations
 *
 * Provides consistent logging format across all Calendar-related code,
 * with support for structured data, error formatting, and log levels.
 *
 * @example
 * ```typescript
 * // Basic logging
 * calendarLogger.info("Starting full sync", { userId, eventCount: 100 });
 *
 * // Error logging with automatic formatting
 * calendarLogger.error("Sync failed", { userId }, error);
 *
 * // Debug logging (only in development)
 * calendarLogger.debug("Processing batch", { batchIndex: 5, eventCount: 20 });
 * ```
 */
class CalendarLogger {
  private config: LoggerConfig;
  private component: string;
  private operationId?: string;

  constructor(component: string, config: Partial<LoggerConfig> = {}) {
    this.component = component;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a child logger with a different component name
   */
  child(component: string): CalendarLogger {
    const childLogger = new CalendarLogger(component, this.config);
    childLogger.operationId = this.operationId;
    return childLogger;
  }

  /**
   * Set an operation ID for correlation
   */
  withOperationId(operationId: string): CalendarLogger {
    const logger = new CalendarLogger(this.component, this.config);
    logger.operationId = operationId;
    return logger;
  }

  /**
   * Log at debug level (development only)
   */
  debug(message: string, data?: Record<string, unknown>): void {
    if (this.config.enableDebug) {
      this.log("debug", message, data);
    }
  }

  /**
   * Log at info level
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  /**
   * Log at warn level
   */
  warn(message: string, data?: Record<string, unknown>, error?: unknown): void {
    this.log("warn", message, data, error);
  }

  /**
   * Log at error level
   */
  error(
    message: string,
    data?: Record<string, unknown>,
    error?: unknown
  ): void {
    this.log("error", message, data, error);
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: unknown
  ): void {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.config.minLevel]) {
      return;
    }

    const entry: CalendarLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      operationId: this.operationId,
    };

    if (data) {
      // Extract userId if present for easier querying
      if ("userId" in data && typeof data.userId === "string") {
        entry.userId = data.userId;
      }
      entry.data = data;
    }

    if (error) {
      entry.error = this.formatError(error);
    }

    // Use custom handler or default console output
    if (this.config.handler) {
      this.config.handler(entry);
    } else {
      this.outputToConsole(entry);
    }
  }

  /**
   * Format an error for structured output
   */
  private formatError(error: unknown): CalendarLogEntry["error"] {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: this.config.includeStackTraces ? error.stack : undefined,
      };
    }

    if (typeof error === "string") {
      return {
        name: "Error",
        message: error,
      };
    }

    return {
      name: "UnknownError",
      message: String(error),
    };
  }

  /**
   * Output a log entry to the console
   */
  private outputToConsole(entry: CalendarLogEntry): void {
    const prefix = `[${entry.component}]`;
    const contextParts: string[] = [];

    if (entry.userId) {
      contextParts.push(`user=${entry.userId}`);
    }
    if (entry.operationId) {
      contextParts.push(`op=${entry.operationId}`);
    }

    const context =
      contextParts.length > 0 ? ` (${contextParts.join(", ")})` : "";
    const logMessage = `${prefix}${context} ${entry.message}`;

    const consoleMethod = this.getConsoleMethod(entry.level);

    if (entry.data || entry.error) {
      const details: Record<string, unknown> = {};
      if (entry.data) {
        Object.assign(details, entry.data);
      }
      if (entry.error) {
        details.error = entry.error;
      }
      consoleMethod(logMessage, details);
    } else {
      consoleMethod(logMessage);
    }
  }

  /**
   * Get the appropriate console method for a log level
   */
  private getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
    switch (level) {
      case "debug":
        return console.debug;
      case "info":
        return console.info;
      case "warn":
        return console.warn;
      case "error":
        return console.error;
      default:
        return console.log;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Pre-configured Loggers
// ─────────────────────────────────────────────────────────────

/** Main Calendar integration logger */
export const calendarLogger = new CalendarLogger("Calendar");

/** Logger for sync operations */
export const syncLogger = new CalendarLogger("CalendarSync");

/** Logger for the sync worker */
export const workerLogger = new CalendarLogger("CalendarWorker");

/** Logger for the scheduler */
export const schedulerLogger = new CalendarLogger("CalendarScheduler");

/** Logger for event actions (create, update, delete, respond) */
export const actionsLogger = new CalendarLogger("CalendarActions");

/** Logger for the Calendar API client */
export const clientLogger = new CalendarLogger("CalendarClient");

/** Logger for webhook operations */
export const webhookLogger = new CalendarLogger("CalendarWebhook");

/** Logger for embeddings operations */
export const embeddingsLogger = new CalendarLogger("CalendarEmbeddings");

/** Pre-configured logger for Calendar API routes */
export const apiLogger = new CalendarLogger("CalendarAPI");

/** Logger for approval workflow */
export const approvalLogger = new CalendarLogger("CalendarApproval");

// ─────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────

/**
 * Create a custom Calendar logger
 */
export function createCalendarLogger(
  component: string,
  config?: Partial<LoggerConfig>
): CalendarLogger {
  return new CalendarLogger(component, config);
}

export { CalendarLogger };
