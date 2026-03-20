# AGENTS.md — LUNAS-OS Autonomous Operations

> Multi-agent orchestration for construction cleanup operations.
> Self-evolving system that learns from every intake, dispatch, and completion.

---

## Architecture

```
                     ┌──────────────┐
                     │   LUNAS AI   │
                     │   (Master)   │
                     │   L4 Trust   │
                     └──────┬───────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
    ┌───────────┐    ┌───────────┐    ┌───────────┐
    │ SCHEDULER │    │ DISPATCH  │    │  INSIGHT   │
    │  Agent    │    │  Agent    │    │  Agent     │
    │ L3 (Act)  │    │ L3 (Act)  │    │ L2 (Learn) │
    └───────────┘    └───────────┘    └───────────┘
          │                 │                 │
          ▼                 ▼                 ▼
    ┌───────────┐    ┌───────────┐    ┌───────────┐
    │  Convex   │    │  Convex   │    │  RAG KB   │
    │  Queries  │    │ Mutations │    │  Vector   │
    └───────────┘    └───────────┘    └───────────┘
                            │
                     ┌──────┴───────┐
                     │  FOREMAN UI  │
                     │  (Chat/Voice)│
                     └──────────────┘
```

---

## Agent Registry

### Master (LUNAS AI Chat Widget)

| Property | Value |
|----------|-------|
| Role | Orchestrator, user interface, final authority |
| Trust | L4 (Autonomous within guardrails) |
| Model | GPT-5.4 Nano (via OpenRouter/OpenAI) |
| Interface | Chat widget + voice (Web Speech API) |
| Delegates to | Scheduler, Dispatch, Insight agents |

**Responsibilities**:
- Answer questions about schedule, jobs, crews, billing
- Execute assignments, reschedules, dispatches on command
- Route complex multi-step operations to sub-agents
- Maintain conversation context across interactions
- Log all decisions to audit trail

---

### Scheduler Agent

| Property | Value |
|----------|-------|
| Role | Optimize crew assignments and scheduling |
| Trust | L3 (Act with logging) |
| Trigger | New intake received, daily at 5 AM |
| Model | GPT-5.4 Nano |

**Responsibilities**:
- Analyze incoming jobs vs crew capacity (`capacityPerDay`)
- Suggest optimal foreman-crew pairings based on:
  - Service type ↔ crew skills
  - Geographic clustering (community proximity)
  - Workload balance across foremen
  - Historical assignment success rates
- Auto-assign if confidence > 0.85, else flag for human review

**Decision Schema**:
```yaml
action: "auto_assign_foreman"
input:
  jobId: "jrs_abc123"
  service: "Clean Final"
  community: "Caprock"
  lot: "42"
confidence: 0.92
output:
  foremanName: "Anahi"
  crewName: "Carmen"
  reason: "Anahi handles 78% of Caprock jobs, Carmen's crew has capacity"
```

---

### Dispatch Agent

| Property | Value |
|----------|-------|
| Role | Batch and send daily dispatches |
| Trust | L3 (Act with logging) |
| Trigger | Daily at 6 AM, or manual "dispatch all" command |
| Model | GPT-5.4 Nano |

**Responsibilities**:
- Group assigned jobs into dispatch batches by crew
- Verify all jobs have foreman + crew before dispatch
- Create dispatch batch records in Convex
- Generate run sheets (PDF) for each crew
- Flag anomalies (double-booked lots, missing walk times)

---

### Insight Agent

| Property | Value |
|----------|-------|
| Role | Learn from operations, distill patterns |
| Trust | L2 (Read + Write to knowledge base) |
| Trigger | After batch completion, weekly on Sundays |
| Model | GPT-5.4 Nano |

**Responsibilities**:
- Analyze completed jobs for patterns
- Track per-community service frequency
- Identify builder ordering patterns (seasonality, lot sequences)
- Detect pricing anomalies in blue book entries
- Ingest learned patterns into RAG knowledge base
- Generate weekly operational summaries

**Learning Loop**:
```
Completed Jobs → Pattern Analysis → Insight Extraction
    → RAG Ingest → Future Query Enhancement
    → Better Suggestions → Better Outcomes
    → More Completed Jobs (cycle continues)
```

---

## Trust Tiers

| Tier | Level | Capabilities | Examples |
|------|-------|-------------|----------|
| L1 | Observe | Read-only queries | "What's on the schedule?" |
| L2 | Suggest | Read + write to knowledge base | "Based on patterns, Anahi usually handles this" |
| L3 | Act | Execute mutations with logging | Auto-assign foreman, create dispatch batch |
| L4 | Autonomous | Full operations with guardrails | Run daily dispatch pipeline end-to-end |

### Guardrails (apply at all trust tiers)

- **Never delete** job requests or dispatch batches without human confirmation
- **Never modify** billing/payment data autonomously
- **Always log** every write operation to `aiDecisionLog`
- **Always show** confidence score for autonomous decisions
- **Escalate** to human when confidence < 0.70
- **Rate limit**: Max 50 autonomous mutations per hour

---

## Self-Evolution Protocol

### Pattern Recognition → Skill Creation

When the AI identifies a repeating pattern (3+ occurrences):

1. **Detect**: Same community + service type → same foreman assigned
2. **Extract**: "Anahi handles 78% of Caprock Clean Final jobs"
3. **Store**: Ingest as RAG knowledge: `"For Caprock Clean Final jobs, default to Anahi"`
4. **Apply**: Next time a Caprock Clean Final intake arrives, auto-suggest Anahi
5. **Validate**: Track if the suggestion was accepted or overridden
6. **Refine**: If overridden >30% of the time, lower confidence and re-learn

### Knowledge Distillation

The RAG knowledge base acts as the system's "compressed model":

```
Cloud Model (GPT-5.4 Nano)
    │
    ├─ Reasons over live data (queries)
    ├─ Makes decisions (mutations)
    ├─ Generates insights (patterns)
    │
    ▼
RAG Knowledge Base (Convex Vector Store)
    │
    ├─ Stores operational patterns
    ├─ Stores community-foreman affinities
    ├─ Stores builder ordering patterns
    ├─ Stores pricing benchmarks
    │
    ▼
Future Queries (enhanced with retrieved context)
    │
    └─ Better answers with fewer tokens
       (RAG provides context that the model
        would otherwise need to reason about)
```

This is **soft distillation** — the cloud model's reasoning gets persisted as structured knowledge, making future queries cheaper and faster.

### Insight Ingestion Pipeline

```typescript
// Scheduled: runs weekly
async function weeklyInsightPipeline() {
    // 1. Query completed jobs from past week
    const jobs = await getCompletedJobs({ lastDays: 7 });

    // 2. Analyze patterns with GPT-5.4 Nano
    const insights = await analyzePatterns(jobs);

    // 3. Ingest into RAG knowledge base
    for (const insight of insights) {
        await rag.add({
            namespace: "operations",
            text: insight.text,
        });
    }

    // 4. Log the learning event
    await logDecision({
        action: "weekly_insight_ingest",
        input: JSON.stringify({ jobCount: jobs.length }),
        output: JSON.stringify({ insightCount: insights.length }),
        confidence: 1.0,
        source: "scheduled",
    });
}
```

---

## Decision Audit Trail

Every autonomous action is logged to `aiDecisionLog` table:

| Field | Purpose |
|-------|---------|
| `action` | What was done (e.g., "auto_assign_foreman") |
| `input` | JSON — what triggered the decision |
| `output` | JSON — what action was taken |
| `confidence` | 0.0 - 1.0 — how certain the AI was |
| `approved` | Whether a human approved (null = autonomous) |
| `approvedBy` | User ID if human-approved |
| `source` | "chat" / "auto" / "scheduled" |
| `createdAt` | Timestamp |

### Confidence Thresholds

| Confidence | Action |
|-----------|--------|
| > 0.85 | Auto-execute, log |
| 0.70 - 0.85 | Execute but notify admin |
| 0.50 - 0.70 | Suggest only, require approval |
| < 0.50 | Do not suggest, flag for human review |

---

## Scheduled Agents (Future — Convex Cron Jobs)

| Schedule | Agent | Task |
|----------|-------|------|
| Daily 5:00 AM | Scheduler | Auto-assign unassigned jobs for today |
| Daily 6:00 AM | Dispatch | Generate and send dispatch batches |
| Daily 8:00 PM | Insight | Log daily completion metrics |
| Weekly Sunday | Insight | Run full pattern analysis + RAG ingest |
| Monthly 1st | Insight | Generate operational report |

---

## Model Strategy

| Layer | Model | Purpose | Cost |
|-------|-------|---------|------|
| Chat Widget | GPT-5.4 Nano | User interaction, tool calling | $0.20/M in |
| RAG Embeddings | text-embedding-3-small | Vector search | $0.02/M tokens |
| Complex Reasoning | GPT-5.4 Mini (future) | Multi-step planning | $1.10/M in |
| Local Inference | Distilled model (future) | Offline crew app | Free (CPU) |

### Model Distillation Pipeline (nanochat + 0wav inspired)

**Goal**: Train a small local model (LUNAS-Nano) from operational data, deploy to CPU for $0 inference on routine queries.

**Pipeline**:
```
Decision Logs (Convex) → Export JSONL → 3-Stage Curriculum SFT → GGUF Quantize → Ollama Deploy
```

**Step 1: Data Collection** (`convex/distillation.ts`)
- High-confidence decisions (>0.85) become "gold" training examples (weight 2.0x)
- Conversation threads with successful tool use become SFT pairs
- Export: `pnpm tsx scripts/export-training-data.ts`

**Step 2: Training** (nanochat pipeline on H100/A100)
- 3-stage curriculum (0wav pattern):
  - Foundation: uniform weights, learn general patterns (20 epochs)
  - Enrichment: cosine ramp quality weights (30 epochs)
  - Precision: gold boost 1.5x, full quality (50 epochs)
- Architecture: nanochat depth-12 (GPT-1 class, ~5 min on H100)
- Config: `training/config.yaml`

**Step 3: Quantization**
- Convert to GGUF q4_0 (4-bit, smallest, fast on CPU)
- ~50MB model file for CPU inference

**Step 4: Deployment** (`training/Modelfile`)
```bash
ollama create lunas-nano -f training/Modelfile
ollama run lunas-nano "What's on the schedule?"
```

**Step 5: Routing**
- Local model handles: schedule lookups, entity queries, status checks
- Cloud model handles: write operations, multi-step reasoning, RAG search, low-confidence queries
- ATLAS-style routing scorer decides which model to use per query

---

## Evaluation & Red-Teaming (promptfoo)

### Eval Harness (`evals/promptfooconfig.yaml`)
- 25+ test cases covering all 17 tools
- Schedule queries, foreman assignment, RAG search, dispatch, bilingual, edge cases
- Assertion types: tool selection, content quality, LLM rubric, latency, cost
- Run: `npx promptfoo eval -c evals/promptfooconfig.yaml`

### Red Team (`evals/promptfoo-redteam.yaml`)
- RBAC attacks (role-based access control bypass)
- Prompt injection (via job notes, community names)
- Data exfiltration (builder pricing cross-leak)
- Hallucination detection (invented job IDs)
- OWASP LLM Top 10 coverage
- Bilingual attack vectors (EN/ES)
- Run: `npx promptfoo redteam run -c evals/promptfoo-redteam.yaml`

### Continuous Monitoring
- Weekly eval runs via cron
- PR-gated evals: any change to `lib/ai/*` triggers eval
- 95% pass rate quality gate
- Compare local vs cloud model performance

---

## Integration Points

| System | Direction | Purpose |
|--------|-----------|---------|
| Convex | Read/Write | All data operations |
| OpenRouter/OpenAI | Outbound | LLM inference (cloud) |
| Ollama (future) | Local | CPU inference (distilled model) |
| promptfoo | Eval | AI testing, red-team, monitoring |
| Twilio (existing) | Outbound | SMS notifications to foremen |
| Email (existing) | Outbound | Dispatch PDFs to crews |
| RAG Vector Store | Read/Write | Knowledge persistence |

---

## Security

- All tool calls go through the Next.js API route (server-side only)
- Convex mutations require valid function references (type-safe)
- No raw database access from the client
- OpenRouter/OpenAI keys stored in env vars, never client-exposed
- Decision audit log is append-only (no delete mutations exposed)
- Rate limiting on chat API route prevents token abuse
- Red-team eval runs weekly to detect new vulnerabilities
- RBAC enforcement: write tools require ADMIN role context
