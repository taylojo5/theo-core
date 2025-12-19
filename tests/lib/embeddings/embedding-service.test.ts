// ═══════════════════════════════════════════════════════════════════════════
// Embedding Service - Unit Tests
// Tests for vector embedding generation and storage
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EmbeddingError,
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  DEFAULT_CHUNKING_OPTIONS,
} from "@/lib/embeddings/types";
import { EmbeddingService } from "@/lib/embeddings/embedding-service";
import type { EmbeddingProvider, EmbeddingResult, BatchEmbeddingResult } from "@/lib/embeddings/types";

// ─────────────────────────────────────────────────────────────
// Mock Provider
// ─────────────────────────────────────────────────────────────

function createMockProvider(): EmbeddingProvider {
  return {
    generateEmbedding: vi.fn().mockResolvedValue({
      embedding: new Array(1536).fill(0.1),
      model: DEFAULT_EMBEDDING_MODEL,
      tokensUsed: 10,
    } as EmbeddingResult),
    generateEmbeddings: vi.fn().mockImplementation(async (texts: string[]) => ({
      embeddings: texts.map(() => new Array(1536).fill(0.1)),
      model: DEFAULT_EMBEDDING_MODEL,
      totalTokensUsed: texts.length * 10,
    } as BatchEmbeddingResult)),
    getModel: vi.fn().mockReturnValue(DEFAULT_EMBEDDING_MODEL),
    getDimensions: vi.fn().mockReturnValue(1536),
  };
}

// ─────────────────────────────────────────────────────────────
// EmbeddingError Tests
// ─────────────────────────────────────────────────────────────

describe("EmbeddingError", () => {
  describe("constructor", () => {
    it("creates error with all properties", () => {
      const error = new EmbeddingError("test message", "api_error", true, 1000);
      
      expect(error.message).toBe("test message");
      expect(error.type).toBe("api_error");
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(1000);
      expect(error.name).toBe("EmbeddingError");
    });

    it("defaults retryable to false", () => {
      const error = new EmbeddingError("test", "api_error");
      expect(error.retryable).toBe(false);
    });
  });

  describe("static factory methods", () => {
    it("creates rate limited error", () => {
      const error = EmbeddingError.rateLimited(5000);
      
      expect(error.type).toBe("rate_limit");
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(5000);
      expect(error.message).toContain("5000ms");
    });

    it("creates invalid input error", () => {
      const error = EmbeddingError.invalidInput("bad input");
      
      expect(error.type).toBe("invalid_input");
      expect(error.retryable).toBe(false);
      expect(error.message).toBe("bad input");
    });

    it("creates API error", () => {
      const error = EmbeddingError.apiError("server error");
      
      expect(error.type).toBe("api_error");
      expect(error.retryable).toBe(true);
    });

    it("creates network error", () => {
      const error = EmbeddingError.networkError("connection failed");
      
      expect(error.type).toBe("network_error");
      expect(error.retryable).toBe(true);
    });

    it("creates content too long error", () => {
      const error = EmbeddingError.contentTooLong(50000, 32000);
      
      expect(error.type).toBe("content_too_long");
      expect(error.retryable).toBe(false);
      expect(error.message).toContain("50000");
      expect(error.message).toContain("32000");
    });

    it("creates empty content error", () => {
      const error = EmbeddingError.emptyContent();
      
      expect(error.type).toBe("empty_content");
      expect(error.retryable).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Constants Tests
// ─────────────────────────────────────────────────────────────

describe("Embedding Constants", () => {
  describe("DEFAULT_EMBEDDING_MODEL", () => {
    it("is text-embedding-3-small", () => {
      expect(DEFAULT_EMBEDDING_MODEL).toBe("text-embedding-3-small");
    });
  });

  describe("EMBEDDING_DIMENSIONS", () => {
    it("has correct dimensions for each model", () => {
      expect(EMBEDDING_DIMENSIONS["text-embedding-3-small"]).toBe(1536);
      expect(EMBEDDING_DIMENSIONS["text-embedding-3-large"]).toBe(3072);
      expect(EMBEDDING_DIMENSIONS["text-embedding-ada-002"]).toBe(1536);
    });
  });

  describe("DEFAULT_CHUNKING_OPTIONS", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_CHUNKING_OPTIONS.maxTokens).toBe(8000);
      expect(DEFAULT_CHUNKING_OPTIONS.overlapTokens).toBe(100);
      expect(DEFAULT_CHUNKING_OPTIONS.separator).toBe("sentence");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// EmbeddingService Tests
// ─────────────────────────────────────────────────────────────

describe("EmbeddingService", () => {
  let service: EmbeddingService;
  let mockProvider: EmbeddingProvider;

  beforeEach(() => {
    mockProvider = createMockProvider();
    service = new EmbeddingService(mockProvider);
  });

  describe("generateEmbedding", () => {
    it("generates embedding for text", async () => {
      const result = await service.generateEmbedding("hello world");
      
      expect(result).toHaveLength(1536);
      expect(mockProvider.generateEmbedding).toHaveBeenCalledWith(
        "hello world",
        undefined
      );
    });

    it("passes options to provider", async () => {
      const options = { model: "text-embedding-3-large" as const };
      await service.generateEmbedding("test", options);
      
      expect(mockProvider.generateEmbedding).toHaveBeenCalledWith("test", options);
    });
  });

  describe("generateEmbeddings", () => {
    it("generates embeddings for multiple texts", async () => {
      const texts = ["hello", "world", "test"];
      const result = await service.generateEmbeddings(texts);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(1536);
      expect(mockProvider.generateEmbeddings).toHaveBeenCalledWith(
        texts,
        undefined
      );
    });

    it("handles empty array", async () => {
      const result = await service.generateEmbeddings([]);
      
      expect(result).toEqual([]);
    });
  });

  describe("chunkContent", () => {
    it("returns single chunk for short content", () => {
      const content = "This is a short piece of content.";
      const chunks = service.chunkContent(content);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(content);
    });

    it("chunks long content by sentences", () => {
      // Create content that exceeds chunk size
      const sentence = "This is a sentence. ";
      const content = sentence.repeat(2000);
      
      const chunks = service.chunkContent(content, { maxTokens: 100 });
      
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(100 * 4 + 500); // Some buffer for overlap
      });
    });

    it("uses paragraph separator when specified", () => {
      const content = "Paragraph one.\n\nParagraph two.\n\nParagraph three.";
      const chunks = service.chunkContent(content, { 
        separator: "paragraph",
        maxTokens: 10 
      });
      
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it("uses word separator when specified", () => {
      const content = "word1 word2 word3 word4 word5";
      const chunks = service.chunkContent(content, { 
        separator: "word",
        maxTokens: 2 
      });
      
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("respects overlap between chunks", () => {
      const words = Array(100).fill("word").map((w, i) => `${w}${i}`).join(" ");
      const chunks = service.chunkContent(words, { 
        separator: "word",
        maxTokens: 20,
        overlapTokens: 5
      });
      
      // With overlap, some content should appear in adjacent chunks
      if (chunks.length >= 2) {
        // There should be some overlap between chunks
        const lastWordsOfFirst = chunks[0].split(" ").slice(-5);
        const firstWordsOfSecond = chunks[1].split(" ").slice(0, 5);
        
        // At least some overlap should exist
        const hasOverlap = lastWordsOfFirst.some(w => 
          firstWordsOfSecond.includes(w)
        );
        expect(hasOverlap || chunks.length === 1).toBe(true);
      }
    });

    it("handles empty content", () => {
      const chunks = service.chunkContent("");
      expect(chunks).toEqual([""]);
    });

    it("trims chunks", () => {
      const content = "  hello world  ";
      const chunks = service.chunkContent(content);
      
      expect(chunks[0]).toBe("hello world");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Content Processing Tests
// ─────────────────────────────────────────────────────────────

describe("Content Processing", () => {
  let service: EmbeddingService;
  let mockProvider: EmbeddingProvider;

  beforeEach(() => {
    mockProvider = createMockProvider();
    service = new EmbeddingService(mockProvider);
  });

  describe("sentence chunking", () => {
    it("splits on sentence boundaries", () => {
      const content = "First sentence. Second sentence! Third sentence? Fourth.";
      const chunks = service.chunkContent(content, { 
        separator: "sentence",
        maxTokens: 5
      });
      
      // Each chunk should contain complete sentences
      chunks.forEach(chunk => {
        // Sentences should end with proper punctuation
        const trimmed = chunk.trim();
        if (trimmed.length > 0) {
          // Either ends with punctuation or is the last chunk
          expect(
            trimmed.endsWith(".") || 
            trimmed.endsWith("!") || 
            trimmed.endsWith("?") ||
            chunks.indexOf(chunk) === chunks.length - 1
          ).toBe(true);
        }
      });
    });
  });

  describe("paragraph chunking", () => {
    it("preserves paragraph structure", () => {
      const content = `
        First paragraph with multiple sentences. More content here.
        
        Second paragraph also with content. And more here.
        
        Third paragraph.
      `;
      
      const chunks = service.chunkContent(content, { 
        separator: "paragraph",
        maxTokens: 20
      });
      
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Edge Cases Tests
// ─────────────────────────────────────────────────────────────

describe("Edge Cases", () => {
  let service: EmbeddingService;
  let mockProvider: EmbeddingProvider;

  beforeEach(() => {
    mockProvider = createMockProvider();
    service = new EmbeddingService(mockProvider);
  });

  describe("special characters", () => {
    it("handles unicode content", async () => {
      const unicodeText = "Hello 世界 🌍 Привет مرحبا";
      await service.generateEmbedding(unicodeText);
      
      expect(mockProvider.generateEmbedding).toHaveBeenCalledWith(
        unicodeText,
        undefined
      );
    });

    it("handles newlines and tabs", async () => {
      const textWithWhitespace = "Line 1\nLine 2\tTabbed";
      await service.generateEmbedding(textWithWhitespace);
      
      expect(mockProvider.generateEmbedding).toHaveBeenCalled();
    });
  });

  describe("very long content", () => {
    it("chunks content that exceeds token limit", () => {
      // Create content that's definitely longer than limit
      // Use sentences so the sentence splitter works properly
      const veryLongContent = "This is a sentence that should be long enough. ".repeat(500);
      
      const chunks = service.chunkContent(veryLongContent, { maxTokens: 50 });
      
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe("content with only whitespace", () => {
    it("trims whitespace-only content", () => {
      const chunks = service.chunkContent("   \n\t  ");
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe("");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Provider Error Handling Tests
// ─────────────────────────────────────────────────────────────

describe("Provider Error Handling", () => {
  it("propagates provider errors", async () => {
    const errorProvider: EmbeddingProvider = {
      generateEmbedding: vi.fn().mockRejectedValue(
        EmbeddingError.apiError("API failed")
      ),
      generateEmbeddings: vi.fn().mockRejectedValue(
        EmbeddingError.apiError("API failed")
      ),
      getModel: vi.fn().mockReturnValue(DEFAULT_EMBEDDING_MODEL),
      getDimensions: vi.fn().mockReturnValue(1536),
    };

    const service = new EmbeddingService(errorProvider);

    await expect(service.generateEmbedding("test")).rejects.toThrow(
      EmbeddingError
    );
  });

  it("handles rate limit errors", async () => {
    const rateLimitProvider: EmbeddingProvider = {
      generateEmbedding: vi.fn().mockRejectedValue(
        EmbeddingError.rateLimited(5000)
      ),
      generateEmbeddings: vi.fn(),
      getModel: vi.fn().mockReturnValue(DEFAULT_EMBEDDING_MODEL),
      getDimensions: vi.fn().mockReturnValue(1536),
    };

    const service = new EmbeddingService(rateLimitProvider);

    try {
      await service.generateEmbedding("test");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(EmbeddingError);
      expect((error as EmbeddingError).type).toBe("rate_limit");
      expect((error as EmbeddingError).retryable).toBe(true);
    }
  });
});

