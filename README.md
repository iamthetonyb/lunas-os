# LUNAS-OS

Construction cleanup management platform with AI-powered scheduling, dispatch, and operations intelligence.

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org/)
[![Convex](https://img.shields.io/badge/Convex-1.34-ff6b35)](https://convex.dev/)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Required: NEXT_PUBLIC_CONVEX_URL, AUTH_SECRET
# AI: OPENROUTER_API_KEY or OPENAI_API_KEY

# Start Convex + Next.js dev servers
npx convex dev &
pnpm dev
```

App runs at **http://localhost:4010**

**Dev credentials:** `dispatcher@lunas.com` / `password`

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Backend | Convex (real-time DB, functions, cron jobs) |
| Auth | NextAuth v5 (credentials + bcrypt) |
| AI | GPT-5.4 Nano via OpenRouter, Vercel AI SDK |
| Knowledge | Convex RAG (`@convex-dev/rag`, text-embedding-3-small) |
| i18n | react-i18next (English + Spanish) |
| Eval | promptfoo (25+ test cases, red-team, OWASP LLM Top 10) |
| Deploy | Vercel |

---

## Project Structure

```
lunas-os/
├── app/                  # Next.js App Router pages
│   ├── dashboard/        # Stats, charts, recent activity
│   ├── intake/           # Job request intake + editing
│   ├── schedule/         # Crew scheduling + calendar
│   ├── dispatch/         # Batch dispatch + run sheets
│   ├── blue-book/        # Builder payment tracking
│   ├── invoicing/        # Invoice generation
│   ├── contracts/        # Rate management
│   ├── extra-work/       # Extra work orders
│   └── api/              # API routes (chat, auth, PDF export)
├── components/           # React components + UI library
├── convex/               # Backend functions + schema
│   ├── schema.ts         # Database schema (all tables)
│   ├── queries.ts        # Read operations
│   ├── mutations.ts      # Write operations
│   ├── ai.ts             # RAG search, decision logging
│   ├── insights.ts       # Insight Agent (pattern analysis)
│   ├── distillation.ts   # Training data collection
│   └── crons.ts          # Scheduled agent jobs
├── lib/ai/               # AI tools, system prompt, config
├── evals/                # promptfoo eval + red-team configs
├── training/             # Model distillation pipeline
├── scripts/              # Seed, export, utility scripts
└── public/locales/       # i18n translation files (en/es)
```

---

## AI System

See [AGENTS.md](./AGENTS.md) for full architecture.

**Chat Widget**: Embedded AI assistant with 17 tools — schedule lookup, foreman assignment, dispatch, intake creation, RAG knowledge search, decision auditing.

**Agents**:
- **Scheduler** — auto-assigns foremen/crews based on capacity, community affinity, workload balance
- **Dispatch** — batches and sends daily dispatch run sheets
- **Insight** — weekly pattern analysis, RAG knowledge ingestion, confidence calibration

**Self-Evolution**:
- Decision logs feed a distillation pipeline (nanochat SFT + 0wav curriculum training)
- High-confidence decisions become training data for a local CPU model (LUNAS-Nano)
- promptfoo evals gate model deployments (90% pass rate required)

---

## Environment Variables

```env
# Required
NEXT_PUBLIC_CONVEX_URL=       # From Convex dashboard
AUTH_SECRET=                  # Random string for NextAuth

# AI (one required for chat)
OPENROUTER_API_KEY=           # OpenRouter (recommended)
OPENAI_API_KEY=               # Or direct OpenAI

# Optional
RESEND_API_KEY=               # Email dispatch
TWILIO_ACCOUNT_SID=           # SMS notifications
TWILIO_AUTH_TOKEN=
TWILIO_FROM=
UPLOADTHING_SECRET=           # File uploads
```

---

## Scripts

```bash
# Development
pnpm dev                      # Next.js dev server (port 4010)
npx convex dev                # Convex dev server (hot reload)

# Build & Deploy
pnpm build                    # Production build
npx convex deploy --cmd 'next build'  # Deploy Convex + build

# AI & Evaluation
pnpm tsx scripts/seed-rag-knowledge.ts          # Seed RAG knowledge base
pnpm tsx scripts/export-training-data.ts        # Export training JSONL
npx promptfoo eval -c evals/promptfooconfig.yaml      # Run AI evals
npx promptfoo redteam run -c evals/promptfoo-redteam.yaml  # Red team

# Data
pnpm tsx scripts/seed-convex-from-backup.ts     # Seed from PG backup
pnpm tsx scripts/seed-convex-crews.ts           # Seed crew data
```

---

## Deployment (Vercel)

1. Set env vars in Vercel dashboard (`NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `AUTH_SECRET`, AI keys)
2. Build command: `npx convex deploy --cmd 'next build'`
3. `npx vercel --prod`

---

## License

Proprietary. All rights reserved.
