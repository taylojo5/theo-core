# ═══════════════════════════════════════════════════════════════════════════
# Theo Production Dockerfile
# Multi-stage build for optimized Next.js deployment
# ═══════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────
# Base: Node.js Alpine
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# ─────────────────────────────────────────────────────────────
# Dependencies: Install node_modules
# ─────────────────────────────────────────────────────────────
FROM base AS deps

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# ─────────────────────────────────────────────────────────────
# Builder: Build the Next.js application
# ─────────────────────────────────────────────────────────────
FROM base AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma client (if using Prisma)
RUN npx prisma generate 2>/dev/null || true

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Runner: Production image
# ─────────────────────────────────────────────────────────────
FROM base AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Set correct permissions for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema for migrations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set hostname
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]

