// ═══════════════════════════════════════════════════════════════════════════
// OpenAPI JSON Endpoint
// GET /api/openapi.json - Serves the OpenAPI specification
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { generateOpenAPIDocument } from "@/openapi";

// Cache the generated document in production
let cachedDocument: ReturnType<typeof generateOpenAPIDocument> | null = null;

export async function GET() {
  // Use cached document in production, regenerate in development
  if (process.env.NODE_ENV === "production" && cachedDocument) {
    return NextResponse.json(cachedDocument, {
      headers: {
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "Content-Type": "application/json",
      },
    });
  }

  const document = generateOpenAPIDocument();

  if (process.env.NODE_ENV === "production") {
    cachedDocument = document;
  }

  return NextResponse.json(document, {
    headers: {
      "Cache-Control":
        process.env.NODE_ENV === "production"
          ? "public, max-age=3600"
          : "no-cache",
      "Content-Type": "application/json",
    },
  });
}
