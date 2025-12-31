// ═══════════════════════════════════════════════════════════════════════════
// OpenAI Embedding Provider
// Generates vector embeddings using OpenAI's embedding API
// ═══════════════════════════════════════════════════════════════════════════

import OpenAI from "openai";
import {
  type EmbeddingProvider,
  type EmbeddingModel,
  type EmbeddingResult,
  type BatchEmbeddingResult,
  type GenerateEmbeddingOptions,
  type RateLimitConfig,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_RATE_LIMIT_CONFIG,
  EMBEDDING_DIMENSIONS,
  EmbeddingError,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

interface OpenAIProviderConfig {
  /** OpenAI API key (defaults to OPENAI_API_KEY env var) */
  apiKey?: string;
  /** Embedding model to use */
  model?: EmbeddingModel;
  /** Rate limit configuration */
  rateLimitConfig?: RateLimitConfig;
  /** Organization ID (optional) */
  organization?: string;
}

// ─────────────────────────────────────────────────────────────
// Provider Implementation
// ─────────────────────────────────────────────────────────────

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAI;
  private model: EmbeddingModel;
  private rateLimitConfig: RateLimitConfig;

  constructor(config: OpenAIProviderConfig = {}) {
    const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in config."
      );
    }

    this.client = new OpenAI({
      apiKey,
      organization: config.organization,
    });

    this.model = config.model ?? DEFAULT_EMBEDDING_MODEL;
    this.rateLimitConfig = config.rateLimitConfig ?? DEFAULT_RATE_LIMIT_CONFIG;
  }

  /**
   * Get the current model being used
   */
  getModel(): EmbeddingModel {
    return this.model;
  }

  /**
   * Get dimensions for the current model
   */
  getDimensions(): number {
    return EMBEDDING_DIMENSIONS[this.model];
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(
    text: string,
    options?: GenerateEmbeddingOptions
  ): Promise<EmbeddingResult> {
    // Validate input
    if (!text || text.trim().length === 0) {
      throw EmbeddingError.emptyContent();
    }

    const model = options?.model ?? this.model;

    try {
      const response = await this.executeWithRetry(async () => {
        return await this.client.embeddings.create({
          model,
          input: text,
          user: options?.user,
        });
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw EmbeddingError.apiError("No embedding returned from OpenAI");
      }

      return {
        embedding,
        model,
        tokensUsed: response.usage.total_tokens,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate embeddings for multiple texts (batched)
   * OpenAI supports up to 2048 texts per batch
   */
  async generateEmbeddings(
    texts: string[],
    options?: GenerateEmbeddingOptions
  ): Promise<BatchEmbeddingResult> {
    // Validate inputs
    if (texts.length === 0) {
      return {
        embeddings: [],
        model: options?.model ?? this.model,
        totalTokensUsed: 0,
      };
    }

    // Validate all texts - throw if any are empty to maintain 1:1 correspondence
    for (let i = 0; i < texts.length; i++) {
      if (!texts[i] || texts[i].trim().length === 0) {
        throw EmbeddingError.invalidInput(
          `Text at index ${i} is empty or whitespace-only. All texts must be non-empty to maintain 1:1 correspondence between inputs and outputs.`
        );
      }
    }

    const model = options?.model ?? this.model;

    try {
      // OpenAI batch limit is 2048 items
      const BATCH_SIZE = 2048;
      const allEmbeddings: number[][] = [];
      let totalTokens = 0;

      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);

        const response = await this.executeWithRetry(async () => {
          return await this.client.embeddings.create({
            model,
            input: batch,
            user: options?.user,
          });
        });

        // Sort by index to maintain order
        const sortedData = response.data.sort((a, b) => a.index - b.index);
        const batchEmbeddings = sortedData.map((d) => d.embedding);

        allEmbeddings.push(...batchEmbeddings);
        totalTokens += response.usage.total_tokens;
      }

      return {
        embeddings: allEmbeddings,
        model,
        totalTokensUsed: totalTokens,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Execute a function with exponential backoff retry
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    attempt: number = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        this.isRateLimitError(error) &&
        attempt < this.rateLimitConfig.maxRetries
      ) {
        const retryAfter = this.getRetryAfter(error);
        const delay = Math.min(
          retryAfter ??
            this.rateLimitConfig.initialRetryDelay * Math.pow(2, attempt),
          this.rateLimitConfig.maxRetryDelay
        );

        console.warn(
          `Rate limited by OpenAI, retrying in ${delay}ms (attempt ${attempt + 1}/${this.rateLimitConfig.maxRetries})`
        );

        await this.sleep(delay);
        return this.executeWithRetry(fn, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof OpenAI.APIError) {
      return error.status === 429;
    }
    return false;
  }

  /**
   * Get retry-after value from error
   */
  private getRetryAfter(error: unknown): number | undefined {
    if (error instanceof OpenAI.APIError) {
      const headers = error.headers;
      const retryAfter = headers?.["retry-after"];
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
          return seconds * 1000;
        }
      }
    }
    return undefined;
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: unknown): EmbeddingError {
    if (error instanceof EmbeddingError) {
      return error;
    }

    if (error instanceof OpenAI.APIError) {
      switch (error.status) {
        case 429:
          return EmbeddingError.rateLimited(this.getRetryAfter(error));
        case 400:
          return EmbeddingError.invalidInput(error.message);
        case 401:
        case 403:
          return new EmbeddingError(
            `Authentication error: ${error.message}`,
            "api_error",
            false
          );
        case 500:
        case 502:
        case 503:
        case 504:
          return EmbeddingError.apiError(
            `OpenAI server error: ${error.message}`
          );
        default:
          return EmbeddingError.apiError(error.message);
      }
    }

    if (error instanceof Error) {
      // Network errors
      if (
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("ENOTFOUND")
      ) {
        return EmbeddingError.networkError(error.message);
      }
      return EmbeddingError.apiError(error.message);
    }

    return EmbeddingError.apiError("Unknown error generating embedding");
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let defaultProvider: OpenAIEmbeddingProvider | null = null;

/**
 * Get the default OpenAI embedding provider
 * Creates a singleton instance using environment configuration
 */
export function getOpenAIProvider(): OpenAIEmbeddingProvider {
  if (!defaultProvider) {
    defaultProvider = new OpenAIEmbeddingProvider();
  }
  return defaultProvider;
}

/**
 * Create a new OpenAI embedding provider with custom configuration
 */
export function createOpenAIProvider(
  config: OpenAIProviderConfig
): OpenAIEmbeddingProvider {
  return new OpenAIEmbeddingProvider(config);
}
