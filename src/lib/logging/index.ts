// ═══════════════════════════════════════════════════════════════════════════
// Structured Logger
// Generic structured logging utility for the application
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log levels
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Structured log entry
 */
export interface LogEntry {
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
}

// ─────────────────────────────────────────────────────────────
// Logger Configuration
// ─────────────────────────────────────────────────────────────

interface LoggerConfig {
  minLevel: LogLevel;
  includeStackTraces: boolean;
  enableDebug: boolean;
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
// Logger Class
// ─────────────────────────────────────────────────────────────

class Logger {
  private config: LoggerConfig;
  private component: string;

  constructor(component: string, config: Partial<LoggerConfig> = {}) {
    this.component = component;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a child logger with a different component name
   */
  child(component: string): Logger {
    return new Logger(`${this.component}.${component}`, this.config);
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

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: unknown
  ): void {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.config.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
    };

    if (data) {
      entry.data = data;
    }

    if (error) {
      entry.error = this.formatError(error);
    }

    this.outputToConsole(entry);
  }

  private formatError(error: unknown): LogEntry["error"] {
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

  private outputToConsole(entry: LogEntry): void {
    const prefix = `[${entry.component}]`;
    const logMessage = `${prefix} ${entry.message}`;

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
// Factory Function
// ─────────────────────────────────────────────────────────────

// Cache of loggers by component name
const loggerCache = new Map<string, Logger>();

/**
 * Get a logger for a component
 * Cached for reuse
 */
export function getLogger(component: string): Logger {
  let logger = loggerCache.get(component);
  if (!logger) {
    logger = new Logger(component);
    loggerCache.set(component, logger);
  }
  return logger;
}

/**
 * Create a new logger (not cached)
 */
export function createLogger(
  component: string,
  config?: Partial<LoggerConfig>
): Logger {
  return new Logger(component, config);
}

export { Logger };

