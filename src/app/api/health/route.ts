import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isRedisHealthy } from "@/lib/redis";

/**
 * Health check endpoint for load balancers and monitoring
 * GET /api/health
 */
export async function GET() {
  const checks = {
    database: false,
    redis: false,
  };

  // Check database
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check Redis
  try {
    checks.redis = await isRedisHealthy();
  } catch {
    checks.redis = false;
  }

  // System is healthy if database is up
  // Redis is optional (rate limiting has memory fallback)
  const healthy = checks.database;
  const degraded = checks.database && !checks.redis;

  const health = {
    status: healthy ? (degraded ? "degraded" : "healthy") : "unhealthy",
    checks,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    environment: process.env.NODE_ENV,
  };

  return NextResponse.json(health, { status: healthy ? 200 : 503 });
}
