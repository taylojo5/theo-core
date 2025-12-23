# Theo

**Theo is your thoughtful personal assistant** — a private-by-default app that helps you stay organized, think clearly, and take the next right step.

Theo is built as a **Next.js app today**, with a clean path to evolve into a platform that connects to **integrations and micro-services** (calendar, email, tasks, notes, CRM, etc.) over time.

---

## Quick Start

### Prerequisites

- **Node.js 20+** (recommended)
- **Docker** and **Docker Compose** (for local databases)
- npm (included with Node.js)

### Setup

```bash
# 1. Clone the repository
git clone git@github.com:your-org/theo-core.git
cd theo-core

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env.local
# Edit .env.local with your API keys

# 4. Start databases (PostgreSQL + Redis)
docker compose up -d

# 5. Set up database schema
npm run db:push

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see Theo.

---

## Development Commands

### Application

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js development server |
| `npm run dev:all` | Start Docker services + Next.js |
| `npm run build` | Build for production |
| `npm run start` | Start production server |

### Database

| Command | Description |
|---------|-------------|
| `npm run db:start` | Start PostgreSQL + Redis containers |
| `npm run db:stop` | Stop Docker containers |
| `npm run db:reset` | Reset database (destructive!) |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Create and run migrations |
| `npm run db:studio` | Open Prisma Studio GUI |

### Code Quality

| Command | Description |
|---------|-------------|
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run type-check` | Run TypeScript type checking |
| `npm run format` | Format code with Prettier |
| `npm run test` | Run tests with Vitest |

### Docker

| Command | Description |
|---------|-------------|
| `npm run dev:tools` | Start with pgAdmin + Redis Commander |
| `npm run docker:clean` | Remove all containers and volumes |
| `npm run docker:logs` | Tail Docker container logs |

---

## Project Structure

```
theo-core/
├── src/
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # React components
│   │   ├── ui/                 # Base UI components
│   │   ├── chat/               # Chat interface
│   │   └── shared/             # Shared components
│   ├── lib/                    # Core libraries
│   │   ├── db/                 # Database client
│   │   ├── auth/               # Authentication
│   │   ├── agent/              # Agentic framework
│   │   └── utils/              # Utilities
│   ├── integrations/           # External integrations
│   │   ├── gmail/              # Gmail integration
│   │   ├── slack/              # Slack integration
│   │   └── types.ts            # Shared integration types
│   ├── services/               # Business logic
│   │   ├── context/            # Context management
│   │   ├── audit/              # Audit logging
│   │   └── skills/             # Skill implementations
│   └── types/                  # TypeScript types
├── prisma/                     # Database schema
├── docs/                       # Documentation
├── scripts/                    # Utility scripts
└── tests/                      # Test files
```

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with pgvector
- **Cache**: Redis
- **ORM**: Prisma
- **Testing**: Vitest

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./docs/ARCHITECTURE.md) | System design overview |
| [Database Schema](./docs/DATABASE_SCHEMA.md) | Data model details |
| [Integrations](./docs/INTEGRATIONS.md) | Gmail, Slack integration plans |
| [Agentic Framework](./docs/AGENTIC_FRAMEWORK.md) | Agent behavior & audit system |
| [Infrastructure](./docs/INFRASTRUCTURE.md) | AWS deployment & Docker setup |
| [Scaffolding Plan](./docs/SCAFFOLDING_PLAN.md) | Implementation roadmap |
| [Build Log](./docs/BUILD_LOG.md) | Implementation history & decisions |

---

## What Theo Does (Today)

- A clean, fast UI for interacting with Theo
- A foundation for chat + structured "assistant actions"
- A place to centralize your preferences, projects, and context

## What Theo Will Become (Roadmap)

- Connectors to services you already use (Google, Microsoft, Slack, etc.)
- "Skills" that handle specific workflows (planning, follow-ups, summaries)
- Micro-services for heavy/isolated concerns (sync, indexing, retrieval, automation)
- Strong privacy controls: **data minimization**, **least privilege**, **auditable actions**

---

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `NEXTAUTH_SECRET` | Auth encryption secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `SLACK_CLIENT_ID` | Slack OAuth client ID |
| `SLACK_CLIENT_SECRET` | Slack OAuth secret |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |

---

## License

MIT License - see [LICENSE](./LICENSE) for details.
