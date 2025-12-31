# Theo Infrastructure & Deployment

> **Status**: Draft v0.1  
> **Last Updated**: December 2024

## Overview

This document covers Theo's infrastructure strategy:

- **Local Development**: Docker Compose for instant, reproducible dev environment
- **Staging**: AWS deployment for testing and validation
- **Production**: AWS deployment with high availability and security

---

## Local Development

### Philosophy

One command to rule them all. Developers should be able to clone the repo and have a fully functional environment in under 2 minutes.

```bash
# Clone and start everything
git clone git@github.com:your-org/theo-core.git
cd theo-core
pnpm install
docker compose up -d
pnpm dev
```

### Docker Compose Stack

```yaml
# docker-compose.yml
version: "3.8"

services:
  # ─────────────────────────────────────────────────────────────
  # PostgreSQL with pgvector
  # ─────────────────────────────────────────────────────────────
  postgres:
    image: pgvector/pgvector:pg16
    container_name: theo-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: theo
      POSTGRES_PASSWORD: theo_dev_password
      POSTGRES_DB: theo_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U theo -d theo_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─────────────────────────────────────────────────────────────
  # Redis (Cache, Sessions, Queues)
  # ─────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: theo-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─────────────────────────────────────────────────────────────
  # Redis Commander (Optional: Redis GUI)
  # ─────────────────────────────────────────────────────────────
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: theo-redis-ui
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      REDIS_HOSTS: local:redis:6379
    depends_on:
      - redis
    profiles:
      - tools

  # ─────────────────────────────────────────────────────────────
  # pgAdmin (Optional: PostgreSQL GUI)
  # ─────────────────────────────────────────────────────────────
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: theo-pgadmin
    restart: unless-stopped
    ports:
      - "5050:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@theo.local
      PGADMIN_DEFAULT_PASSWORD: admin
      PGADMIN_CONFIG_SERVER_MODE: "False"
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    depends_on:
      - postgres
    profiles:
      - tools

  # ─────────────────────────────────────────────────────────────
  # LocalStack (AWS Services Emulation)
  # ─────────────────────────────────────────────────────────────
  localstack:
    image: localstack/localstack:latest
    container_name: theo-localstack
    restart: unless-stopped
    ports:
      - "4566:4566" # LocalStack Gateway
      - "4510-4559:4510-4559" # External services
    environment:
      SERVICES: s3,sqs,ses,secretsmanager
      DEBUG: 0
      DATA_DIR: /var/lib/localstack/data
    volumes:
      - localstack_data:/var/lib/localstack
      - /var/run/docker.sock:/var/run/docker.sock
    profiles:
      - aws

  # ─────────────────────────────────────────────────────────────
  # Mailpit (Email Testing)
  # ─────────────────────────────────────────────────────────────
  mailpit:
    image: axllent/mailpit:latest
    container_name: theo-mailpit
    restart: unless-stopped
    ports:
      - "1025:1025" # SMTP
      - "8025:8025" # Web UI
    profiles:
      - tools

volumes:
  postgres_data:
  redis_data:
  pgadmin_data:
  localstack_data:

networks:
  default:
    name: theo-network
```

### Database Initialization Script

```sql
-- scripts/init-db.sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create schemas for organization
CREATE SCHEMA IF NOT EXISTS context;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS integrations;
```

### Local Environment Variables

```bash
# .env.local (git-ignored, copy from .env.example)

# ─────────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://theo:theo_dev_password@localhost:5432/theo_dev"

# ─────────────────────────────────────────────────────────────
# Redis
# ─────────────────────────────────────────────────────────────
REDIS_URL="redis://localhost:6379"

# ─────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-change-in-production"

# ─────────────────────────────────────────────────────────────
# Google OAuth (dev credentials)
# ─────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID="your-dev-client-id"
GOOGLE_CLIENT_SECRET="your-dev-client-secret"

# ─────────────────────────────────────────────────────────────
# Slack OAuth (dev credentials)
# ─────────────────────────────────────────────────────────────
SLACK_CLIENT_ID="your-dev-client-id"
SLACK_CLIENT_SECRET="your-dev-client-secret"

# ─────────────────────────────────────────────────────────────
# AI
# ─────────────────────────────────────────────────────────────
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."

# ─────────────────────────────────────────────────────────────
# Feature Flags (local dev)
# ─────────────────────────────────────────────────────────────
ENABLE_GMAIL_SYNC="true"
ENABLE_SLACK_SYNC="true"
ENABLE_AGENT_ACTIONS="true"
```

### NPM Scripts for Dev Workflow

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:all": "docker compose up -d && pnpm dev",
    "dev:tools": "docker compose --profile tools up -d",
    "dev:aws": "docker compose --profile aws up -d",

    "db:start": "docker compose up -d postgres redis",
    "db:stop": "docker compose down",
    "db:reset": "docker compose down -v && docker compose up -d postgres redis && pnpm db:push",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "tsx scripts/seed.ts",

    "docker:clean": "docker compose down -v --remove-orphans",
    "docker:logs": "docker compose logs -f"
  }
}
```

### Quick Start Guide

```bash
# 1. First-time setup
pnpm install                    # Install dependencies
cp .env.example .env.local      # Create local env file
docker compose up -d            # Start PostgreSQL + Redis
pnpm db:push                    # Apply database schema
pnpm db:seed                    # (Optional) Seed sample data

# 2. Daily development
pnpm dev:all                    # Start everything

# 3. With optional tools (pgAdmin, Redis Commander)
pnpm dev:tools

# 4. Reset everything
pnpm docker:clean && pnpm db:reset
```

---

## AWS Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS CLOUD                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         EDGE / CDN                                   │    │
│  │                                                                      │    │
│  │  ┌──────────────────────┐    ┌──────────────────────┐              │    │
│  │  │    CloudFront        │    │     Route 53         │              │    │
│  │  │    (CDN + WAF)       │    │   (DNS + Health)     │              │    │
│  │  └──────────────────────┘    └──────────────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         COMPUTE                                      │    │
│  │                                                                      │    │
│  │  ┌──────────────────────────────────────────────────────────────┐  │    │
│  │  │                     ECS Fargate Cluster                       │  │    │
│  │  │                                                               │  │    │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │  │    │
│  │  │  │   Next.js   │  │   Worker    │  │   Cron      │          │  │    │
│  │  │  │   Service   │  │   Service   │  │   Service   │          │  │    │
│  │  │  │  (2+ tasks) │  │  (2+ tasks) │  │  (1 task)   │          │  │    │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘          │  │    │
│  │  └──────────────────────────────────────────────────────────────┘  │    │
│  │                                                                      │    │
│  │  ┌──────────────────────┐    ┌──────────────────────┐              │    │
│  │  │   Application LB     │    │   Auto Scaling       │              │    │
│  │  └──────────────────────┘    └──────────────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         DATA                                         │    │
│  │                                                                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │    │
│  │  │   RDS       │  │ ElastiCache │  │     S3      │                 │    │
│  │  │ PostgreSQL  │  │   Redis     │  │   Buckets   │                 │    │
│  │  │  (Primary   │  │  (Cluster)  │  │             │                 │    │
│  │  │  + Replica) │  │             │  │             │                 │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     SUPPORTING SERVICES                              │    │
│  │                                                                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │    │
│  │  │  SQS     │  │   SES    │  │ Secrets  │  │CloudWatch│           │    │
│  │  │ (Queues) │  │ (Email)  │  │ Manager  │  │(Logs/Mon)│           │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Environment Comparison

| Component    | Local Dev          | Staging              | Production                    |
| ------------ | ------------------ | -------------------- | ----------------------------- |
| **Compute**  | Next.js dev server | ECS Fargate (1 task) | ECS Fargate (2+ tasks)        |
| **Database** | Docker PostgreSQL  | RDS db.t3.small      | RDS db.r6g.large + replica    |
| **Redis**    | Docker Redis       | ElastiCache t3.micro | ElastiCache r6g.large cluster |
| **Storage**  | Local filesystem   | S3 bucket            | S3 bucket + CloudFront        |
| **Queue**    | BullMQ (Redis)     | SQS                  | SQS                           |
| **Email**    | Mailpit            | SES (sandbox)        | SES (production)              |
| **Secrets**  | .env.local         | Secrets Manager      | Secrets Manager               |
| **Logs**     | Console            | CloudWatch           | CloudWatch                    |
| **Domain**   | localhost:3000     | staging.theo.app     | theo.app                      |

---

## AWS Resources Detail

### VPC & Networking

```hcl
# Terraform pseudo-code for VPC structure

# VPC with 3 AZs for high availability
vpc "theo" {
  cidr_block = "10.0.0.0/16"

  # Public subnets (for ALB, NAT)
  public_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]

  # Private subnets (for ECS, RDS)
  private_subnets = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]

  # Database subnets (isolated)
  database_subnets = ["10.0.21.0/24", "10.0.22.0/24", "10.0.23.0/24"]
}
```

### RDS PostgreSQL

```yaml
# Staging
RDS Staging:
  Engine: PostgreSQL 16
  Instance: db.t3.small
  Storage: 20GB gp3
  MultiAZ: false
  Backup: 7 days
  Extensions: [uuid-ossp, pgcrypto, vector]

# Production
RDS Production:
  Engine: PostgreSQL 16
  Instance: db.r6g.large
  Storage: 100GB gp3 (auto-scaling to 500GB)
  MultiAZ: true
  ReadReplica: 1
  Backup: 30 days
  Extensions: [uuid-ossp, pgcrypto, vector]
  PerformanceInsights: enabled
```

### ElastiCache Redis

```yaml
# Staging
ElastiCache Staging:
  Engine: Redis 7
  NodeType: cache.t3.micro
  NumCacheClusters: 1

# Production
ElastiCache Production:
  Engine: Redis 7
  NodeType: cache.r6g.large
  NumCacheClusters: 2 # Primary + Replica
  AutomaticFailover: enabled
  AtRestEncryption: true
  InTransitEncryption: true
```

### ECS Fargate Services

```yaml
# Service: theo-web (Next.js application)
theo-web:
  Image: ECR:theo-core:latest
  CPU: 512 # 0.5 vCPU
  Memory: 1024 # 1GB
  DesiredCount:
    Staging: 1
    Production: 2
  HealthCheck:
    Path: /api/health
    Interval: 30s
  AutoScaling:
    MinCapacity: 2
    MaxCapacity: 10
    TargetCPU: 70%
    TargetMemory: 80%

# Service: theo-worker (Background jobs)
theo-worker:
  Image: ECR:theo-worker:latest
  CPU: 256
  Memory: 512
  DesiredCount:
    Staging: 1
    Production: 2
  Command: ["node", "dist/worker.js"]

# Service: theo-cron (Scheduled tasks)
theo-cron:
  Image: ECR:theo-core:latest
  CPU: 256
  Memory: 512
  DesiredCount: 1
  ScheduledTasks:
    - sync-gmail: "rate(15 minutes)"
    - sync-slack: "rate(5 minutes)"
    - cleanup: "cron(0 3 * * ? *)"
```

### S3 Buckets

```yaml
Buckets:
  theo-uploads-{env}:
    Purpose: User file uploads
    Versioning: enabled
    Lifecycle:
      - TransitionToIA: 90 days
      - TransitionToGlacier: 365 days

  theo-exports-{env}:
    Purpose: User data exports
    Versioning: enabled
    Lifecycle:
      - Expiration: 30 days

  theo-assets-{env}:
    Purpose: Static assets (CDN origin)
    PublicAccess: via CloudFront only
```

### Secrets Manager

```yaml
Secrets:
  theo/{env}/database:
    - DATABASE_URL

  theo/{env}/redis:
    - REDIS_URL

  theo/{env}/auth:
    - NEXTAUTH_SECRET

  theo/{env}/google:
    - GOOGLE_CLIENT_ID
    - GOOGLE_CLIENT_SECRET

  theo/{env}/slack:
    - SLACK_CLIENT_ID
    - SLACK_CLIENT_SECRET
    - SLACK_SIGNING_SECRET

  theo/{env}/ai:
    - OPENAI_API_KEY
    - ANTHROPIC_API_KEY
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: theo-core

jobs:
  # ─────────────────────────────────────────────────────────────
  # Test & Build
  # ─────────────────────────────────────────────────────────────
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - run: pnpm install
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  # ─────────────────────────────────────────────────────────────
  # Build Docker Image
  # ─────────────────────────────────────────────────────────────
  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging'
    outputs:
      image_tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ secrets.ECR_REGISTRY }}/${{ env.ECR_REPOSITORY }}:${{ github.sha }}
            ${{ secrets.ECR_REGISTRY }}/${{ env.ECR_REPOSITORY }}:${{ github.ref_name }}

  # ─────────────────────────────────────────────────────────────
  # Deploy to Staging
  # ─────────────────────────────────────────────────────────────
  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/staging'
    environment: staging
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster theo-staging \
            --service theo-web \
            --force-new-deployment

      - name: Run migrations
        run: |
          aws ecs run-task \
            --cluster theo-staging \
            --task-definition theo-migrate \
            --launch-type FARGATE

  # ─────────────────────────────────────────────────────────────
  # Deploy to Production
  # ─────────────────────────────────────────────────────────────
  deploy-production:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Deploy to ECS (Blue/Green)
        run: |
          aws deploy create-deployment \
            --application-name theo-production \
            --deployment-group-name theo-web \
            --revision revisionType=AppSpecContent,appSpecContent={...}
```

### Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine AS base
RUN corepack enable pnpm

# ─────────────────────────────────────────────────────────────
# Dependencies
# ─────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ─────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

# ─────────────────────────────────────────────────────────────
# Production
# ─────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

---

## Monitoring & Observability

### CloudWatch Configuration

```yaml
Dashboards:
  theo-overview:
    Widgets:
      - ECS CPU/Memory utilization
      - RDS connections & IOPS
      - Redis cache hit rate
      - ALB request count & latency
      - Error rate (5xx responses)

Alarms:
  Critical:
    - HighCPU: > 90% for 5 minutes
    - HighMemory: > 90% for 5 minutes
    - High5xxRate: > 5% for 3 minutes
    - DatabaseConnections: > 80% max

  Warning:
    - HighCPU: > 70% for 10 minutes
    - HighLatency: p99 > 2s for 5 minutes
    - QueueDepth: > 1000 messages
```

### Log Groups

```yaml
LogGroups:
  /ecs/theo-web:
    Retention: 30 days

  /ecs/theo-worker:
    Retention: 30 days

  /rds/theo:
    Retention: 90 days

  /theo/audit:
    Retention: 365 days # Compliance requirement
```

---

## Cost Estimation

### Monthly Costs (Approximate)

| Resource          | Staging      | Production   |
| ----------------- | ------------ | ------------ |
| ECS Fargate       | $30          | $150         |
| RDS PostgreSQL    | $25          | $300         |
| ElastiCache Redis | $15          | $200         |
| ALB               | $20          | $25          |
| CloudFront        | $5           | $50          |
| S3                | $5           | $20          |
| Secrets Manager   | $5           | $10          |
| CloudWatch        | $10          | $50          |
| **Total**         | **~$115/mo** | **~$805/mo** |

_Note: AI API costs (OpenAI/Anthropic) are usage-based and not included._

---

## Disaster Recovery

### Backup Strategy

| Data            | Backup Frequency        | Retention   | RTO     | RPO      |
| --------------- | ----------------------- | ----------- | ------- | -------- |
| RDS (automated) | Daily                   | 30 days     | 4 hours | 24 hours |
| RDS (manual)    | Weekly                  | 90 days     | 4 hours | 7 days   |
| S3              | Continuous (versioning) | 90 days     | 1 hour  | 0        |
| Secrets         | On change               | 30 versions | 1 hour  | 0        |

### Recovery Procedures

```bash
# Restore RDS from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier theo-prod-restored \
  --db-snapshot-identifier theo-prod-2024-12-19

# Point-in-time recovery
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier theo-prod \
  --target-db-instance-identifier theo-prod-restored \
  --restore-time 2024-12-19T10:00:00Z
```

---

## Security Checklist

### Network

- [ ] VPC with private subnets for compute/data
- [ ] Security groups with minimal ingress
- [ ] NAT Gateway for outbound traffic
- [ ] VPC Flow Logs enabled

### Data

- [ ] RDS encryption at rest (KMS)
- [ ] Redis encryption at rest & in transit
- [ ] S3 bucket encryption
- [ ] Secrets in Secrets Manager (not env vars)

### Access

- [ ] IAM roles with least privilege
- [ ] No long-lived access keys
- [ ] MFA for AWS console access
- [ ] CloudTrail enabled

### Application

- [ ] HTTPS only (redirect HTTP)
- [ ] Security headers via CloudFront
- [ ] WAF rules for common attacks
- [ ] Rate limiting on API

---

## Runbooks

### Deploying a Hotfix

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-fix main

# 2. Make fix, commit, push
git commit -m "fix: critical issue"
git push origin hotfix/critical-fix

# 3. Merge to main (triggers deploy)
gh pr create --base main --title "Hotfix: Critical Issue"
gh pr merge --squash

# 4. Verify deployment
aws ecs describe-services --cluster theo-production --services theo-web
```

### Scaling Up for Traffic

```bash
# Increase ECS desired count
aws ecs update-service \
  --cluster theo-production \
  --service theo-web \
  --desired-count 5

# Or adjust auto-scaling
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/theo-production/theo-web \
  --policy-name theo-scale-out \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 50.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    }
  }'
```

### Database Maintenance

```bash
# Create manual snapshot before maintenance
aws rds create-db-snapshot \
  --db-instance-identifier theo-production \
  --db-snapshot-identifier theo-prod-pre-maintenance-$(date +%Y%m%d)

# Run migrations
aws ecs run-task \
  --cluster theo-production \
  --task-definition theo-migrate \
  --launch-type FARGATE \
  --network-configuration '{...}'
```
