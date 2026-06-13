# GhostFix 👻

**Autonomous SRE Triage Agent**   Built for [Mind the Product World Product Day 2026](https://www.mindtheproduct.com/world-product-day)

> Stop babysitting bug reports. GhostFix fixes them for you.

🔗 **Live demo:** [ghostfix.vercel.app](https://ghostfix.vercel.app)

---

## What is GhostFix?

GhostFix is an AI-powered incident triage platform that ingests bug reports from any source, automatically identifies root causes using **Llama 3.3-70b via Groq**, and provisions a live **ghost environment** hotfix URL in under 3 seconds   no human intervention required.

When confidence is too low to auto-patch, GhostFix intelligently escalates to the right engineering team with full context, a 4-hour SLA target, and a one-click resolve flow. Every resolution can be saved back to the knowledge base, closing the self-learning loop.

---

## Key Features

| Feature | Description |
|---|---|
| **AI Triage** | Llama 3.3-70b identifies root cause, affected module, and fix summary |
| **RAG Knowledge Base** | Searches `historical_fixes` before calling the AI   repeat issues resolved instantly |
| **Ghost Environments** | Unique hotfix URL provisioned per ticket at `/patch/[slug]` |
| **Intelligent Escalation** | Low-confidence tickets escalate to the right team with full context |
| **Self-Learning Loop** | Resolved escalations can be saved back to the KB for future use |
| **Real-Time Dashboard** | Paginated live view of all tickets with status, module, and AI summary |
| **Source-Agnostic** | Accepts reports via web form, REST API, Slack, email, or any webhook |
| **Novus.ai Analytics** | Full event instrumentation   8 tracked events across the entire pipeline |

---

## Tech Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **Database:** Supabase (PostgreSQL)
- **AI:** Groq SDK   `llama-3.3-70b-versatile` (JSON mode)
- **UI:** Tailwind CSS + base-ui components
- **Analytics:** Novus.ai (Pendo)
- **Deployment:** Vercel (auto-deploy from GitHub `main`)

---

## How It Works

```
Bug Report Submitted
        │
        ▼
POST /api/ingest
        │
        ├─ 1. Save ticket to Supabase (status: pending)
        │
        ├─ 2. Search historical_fixes for past resolutions (RAG)
        │       └─ Keyword extraction → ILIKE OR filter → up to 3 matches
        │
        ├─ 3. Run Llama 3.3-70b triage
        │       └─ System prompt + historical context + issue text
        │       └─ JSON: { failing_module, fix_summary, confidence_score, ... }
        │
        └─ 4. confidence ≥ 0.7 → status: patched + ghost env URL
                           < 0.7 → status: escalated → /escalate/[id]
```

**Self-learning loop:**
```
Escalated ticket → Engineer reviews at /escalate/[id]
                 → Writes resolution note
                 → Checks "Save to KB"
                 → Inserts into historical_fixes
                 → Future identical issues auto-resolved by RAG ✓
```

---

## Tracked Novus Events

| Event | Fired When |
|---|---|
| `dashboard_data_loaded` | Engineer opens the dashboard |
| `ticket_ingested` | Ticket successfully saved to Supabase |
| `ai_triage_completed` | Groq returns triage result |
| `ghost_environment_provisioned` | Ticket auto-patched, ghost URL generated |
| `ticket_escalated` | Confidence too low, routed to engineer |
| `ticket_ingestion_failed` | Pipeline error |
| `ticket_resolved` | Engineer marks escalated ticket as resolved |
| `fix_saved_to_kb` | Engineer saves resolution to knowledge base |

---

## Running Locally

```bash
# Install dependencies
npm install

# Copy env vars
cp env.example .env.local
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY

# Start dev server (requires Node v20+)
npm run dev
```

---

## API

### `POST /api/ingest`

Submit a bug report.

```bash
curl -X POST https://ghostfix.vercel.app/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-ghostfix-secret: dev-secret" \
  -d '{
    "issue_text": "Payment checkout crashes with 500 error when Stripe webhook fires",
    "source": "API",
    "user_email": "eng@company.com"
  }'
```

**Response:**
```json
{
  "ticket_id": "uuid",
  "status": "patched",
  "triage": {
    "failing_module": "Stripe Payment Gateway",
    "fix_summary": "...",
    "confidence_score": 0.95,
    "matched_historical_fix": true,
    "historical_matches_found": 2
  },
  "ghost_environment": {
    "url": "https://ghostfix.vercel.app/patch/a3f7c91b...",
    "message": "Ghost environment provisioned"
  }
}
```

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page (live stats from Supabase)
│   ├── dashboard/page.tsx          # Triage command center (paginated)
│   ├── patch/[slug]/page.tsx       # Ghost environment landing page
│   ├── escalate/[id]/page.tsx      # Engineer escalation review page
│   └── api/
│       ├── ingest/route.ts         # Main AI triage pipeline
│       └── resolve/route.ts        # Mark escalated ticket as resolved
├── components/
│   └── dashboard/
│       ├── submit-ticket-dialog.tsx  # 4-step AI thinking timeline UI
│       ├── pendo-tracker.tsx         # Novus dashboard_data_loaded event
│       └── refresh-button.tsx        # Manual dashboard refresh
└── lib/supabase/
    ├── server.ts                   # Supabase client (service role)
    └── types.ts                    # TypeScript types for DB rows
```

---

*Built with ❤️ for Mind the Product World Product Day 2026 · Powered by [Novus.ai](https://novus.pendo.io)*

