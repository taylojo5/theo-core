import { NextResponse } from "next/server";

/**
 * Health check endpoint for load balancers and monitoring
 * GET /api/health
 */
export async function GET() {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    environment: process.env.NODE_ENV,
  };

  return NextResponse.json(health);
}

