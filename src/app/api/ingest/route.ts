// =============================================================================
// GhostFix — Webhook Ingestion Route
// POST /api/ingest
//
// Accepts bug reports from any source (Web Form, API, Slack, Email, etc.)
// Pipeline:
//   1. Validate the incoming payload and (optionally) the webhook secret.
//   2. Persist the raw ticket to Supabase with status = 'pending'.
//   3. Run AI triage via analyzeTicketWithAI() → status = 'analyzing'.
//   4. Generate a unique Ghost environment URL → status = 'patched'.
//   5. Update the ticket row with the final AI summary + ghost link.
//   6. Return a structured JSON response to the webhook caller.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IncomingTicketRow, TicketSource, TicketStatus } from "@/lib/supabase/types";
import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The exact shape the webhook caller must send */
interface IngestPayload {
  /** Natural-language bug description from the user */
  issue_text: string;
  /** Which tool sent the webhook */
  source: TicketSource;
  /** Reporter's email — used to send the ghost link back to them */
  user_email: string;
}

/** Shape of a row returned from the historical_fixes knowledge base */
interface HistoricalFix {
  error_signature: string;
  proposed_solution: string;
  mock_patch_code: string;
}

/** What the AI triage function resolves to */
interface TriageResult {
  /** The module/component the AI identified as the root cause */
  failing_module: string;
  /** One-sentence plain-English fix description */
  fix_summary: string;
  /** 0–1 float representing the AI's confidence in the diagnosis */
  confidence_score: number;
  /** Whether the AI found a strong enough match to warrant auto-patching */
  auto_patch_viable: boolean;
  /** True when the answer was grounded in a past team resolution (RAG hit) */
  matched_historical_fix: boolean;
}

// ---------------------------------------------------------------------------
// Helper: Generate a unique Ghost environment URL
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically random 16-byte hex slug and appends it to
 * the configured base URL, producing a unique temporary hotfix environment
 * link for the affected user.
 *
 * Example output: https://ghostfix.app/patch/a3f7c91b4d2e8056f1a0c3b7d9e2f415
 */
function generateGhostLink(): string {
  const slug = randomBytes(16).toString("hex"); // 32-char hex string
  const base =
    process.env.GHOST_ENV_BASE_URL?.replace(/\/$/, "") ??
    "https://ghostfix.app/patch";
  return `${base}/${slug}`;
}

// ---------------------------------------------------------------------------
// Helper: Optional webhook secret verification
// ---------------------------------------------------------------------------

/**
 * If GHOSTFIX_WEBHOOK_SECRET is set, this validates that the caller included
 * it as the value of the `x-ghostfix-secret` header.
 * Returns true when the secret is absent (open mode) or matches.
 */
function isWebhookAuthorized(request: NextRequest): boolean {
  const expectedSecret = process.env.GHOSTFIX_WEBHOOK_SECRET;
  if (!expectedSecret) return true; // secret not configured → allow all

  const providedSecret = request.headers.get("x-ghostfix-secret");
  return providedSecret === expectedSecret;
}

// ---------------------------------------------------------------------------
// RAG: Fetch historical context from the team knowledge base
// ---------------------------------------------------------------------------

/**
 * fetchHistoricalContext
 *
 * Queries the historical_fixes table for past resolutions that share keywords
 * with the incoming issue. Returns up to 3 matches which are injected into the
 * AI prompt so the model reasons from your team's real documented solutions
 * first, before falling back to general LLM knowledge.
 *
 * No extra DB functions needed — uses ILIKE keyword search across both columns.
 */
async function fetchHistoricalContext(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  issue_text: string
): Promise<HistoricalFix[]> {
  // Common words that appear in almost every bug report — skip them
  const STOP_WORDS = new Set([
    "this", "that", "with", "from", "have", "been", "they", "will",
    "would", "could", "should", "after", "before", "about", "getting",
    "showing", "throwing", "every", "even", "though", "very", "just",
    "still", "when", "then", "also", "both", "each", "more", "some",
  ]);

  // Extract the 5 most meaningful domain keywords from the issue description
  const keywords = issue_text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !STOP_WORDS.has(w))
    .slice(0, 5);

  if (keywords.length === 0) return [];

  // Build an OR filter searching both columns for any extracted keyword
  // e.g. "error_signature.ilike.%payment%,proposed_solution.ilike.%payment%"
  const orFilter = keywords
    .flatMap((kw) => [
      `error_signature.ilike.%${kw}%`,
      `proposed_solution.ilike.%${kw}%`,
    ])
    .join(",");

  const { data, error } = await supabase
    .from("historical_fixes")
    .select("error_signature, proposed_solution, mock_patch_code")
    .or(orFilter)
    .limit(3);

  if (error) {
    console.warn("[GhostFix] Historical context fetch failed:", error.message);
    return [];
  }

  return (data as HistoricalFix[]) ?? [];
}

// ---------------------------------------------------------------------------
// Core AI Triage Function
// ---------------------------------------------------------------------------

/**
 * analyzeTicketWithAI
 *
 * Sends the raw bug report to Llama 3 via Groq (free tier — no billing needed).
 * Groq's API is OpenAI-compatible so the SDK usage is near-identical.
 *
 * Free limits: 30 req/min · 14,400 req/day — more than enough for a hackathon.
 * Sign up & get your free key at: https://console.groq.com
 *
 * @param issue_text  The raw user-submitted bug description
 * @returns           A structured TriageResult, or a safe fallback on error
 */
async function analyzeTicketWithAI(
  issue_text: string,
  historicalContext: HistoricalFix[] = []
): Promise<TriageResult> {
  const client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  // ── Build the RAG context block if historical matches were found ──────────
  const hasHistory = historicalContext.length > 0;
  const historyBlock = hasHistory
    ? historicalContext
        .map(
          (fix, i) =>
            `[Match ${i + 1}]\n` +
            `Error Pattern : ${fix.error_signature}\n` +
            `Known Fix     : ${fix.proposed_solution}\n` +
            `Patch Preview : ${fix.mock_patch_code.slice(0, 300)}`
        )
        .join("\n\n")
    : "";

  const systemPrompt = `
You are an expert SRE (Site Reliability Engineer) assistant and autonomous triage agent.
Your job is to analyze incoming user bug reports and identify the root cause as precisely as possible.
${
  hasHistory
    ? `
TEAM KNOWLEDGE BASE — PAST RESOLUTIONS (use as primary evidence, highest priority):
Your engineering team has already solved similar issues before. Always prefer these documented fixes over general LLM knowledge.

${historyBlock}

When a historical match applies, set confidence_score to 0.95 or above and set matched_historical_fix to true.
`
    : ""
}
You MUST respond with a valid JSON object and nothing else. Follow this exact schema:
{
  "failing_module": "<string: the specific software module, service, or component that is broken>",
  "fix_summary": "<string: exactly one sentence describing the most likely fix for the issue>",
  "confidence_score": <number: a float between 0.0 and 1.0 representing your confidence in this diagnosis>,
  "auto_patch_viable": <boolean: true if the issue is well-understood enough to apply an automated hotfix, false if it needs human investigation>,
  "matched_historical_fix": <boolean: true ONLY if you used a past resolution from the knowledge base above, false otherwise>
}

Rules:
- Be specific with failing_module. Do NOT write "unknown" — make your best educated inference.
- fix_summary must be one sentence, under 25 words, and actionable.
- confidence_score above 0.7 means auto_patch_viable should generally be true.
- If the report is too vague to diagnose, set confidence_score below 0.4 and auto_patch_viable to false.
- matched_historical_fix must be false when no knowledge base entries were provided.
`.trim();

  const userPrompt = `
Bug report submitted by a user:
---
${issue_text}
---
Analyze this report and return the JSON triage result.
`.trim();

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile", // Free via Groq — faster than GPT-4o-mini
      response_format: { type: "json_object" },
      temperature: 0.2, // low temperature = more deterministic SRE analysis
      max_tokens: 256,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(rawContent) as Partial<TriageResult>;

    // Validate and normalise the response before trusting it
    return {
      failing_module:
        typeof parsed.failing_module === "string" && parsed.failing_module
          ? parsed.failing_module
          : "Unidentified Module",
      fix_summary:
        typeof parsed.fix_summary === "string" && parsed.fix_summary
          ? parsed.fix_summary
          : "Manual investigation required — the AI could not determine a specific fix.",
      confidence_score:
        typeof parsed.confidence_score === "number"
          ? Math.min(1, Math.max(0, parsed.confidence_score))
          : 0.5,
      auto_patch_viable:
        typeof parsed.auto_patch_viable === "boolean"
          ? parsed.auto_patch_viable
          : false,
      matched_historical_fix:
        typeof parsed.matched_historical_fix === "boolean"
          ? parsed.matched_historical_fix
          : false,
    };
  } catch (err) {
    // If the Groq call fails for any reason, return a safe fallback
    // so the rest of the pipeline still completes and the ticket is saved.
    console.error("[GhostFix] analyzeTicketWithAI error:", err);
    return {
      failing_module: "AI Triage Unavailable",
      fix_summary:
        "AI analysis failed — ticket has been escalated to the engineering team.",
      confidence_score: 0,
      auto_patch_viable: false,
      matched_historical_fix: false,
    };
  }
}

// ---------------------------------------------------------------------------
// POST /api/ingest
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // ── 1. Webhook authorization ─────────────────────────────────────────────
  if (!isWebhookAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized: invalid or missing x-ghostfix-secret header." },
      { status: 401 }
    );
  }

  // ── 2. Parse + validate the request body ─────────────────────────────────
  let payload: IngestPayload;
  try {
    payload = (await request.json()) as IngestPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  const { issue_text, source, user_email } = payload;

  if (!issue_text || typeof issue_text !== "string" || !issue_text.trim()) {
    return NextResponse.json(
      { error: "Missing required field: issue_text must be a non-empty string." },
      { status: 400 }
    );
  }
  // source is free-text — "Web Form", "API", "Slack", "Email", etc.
  // Only require it to be a non-empty string.
  if (!source || typeof source !== "string" || !source.trim()) {
    return NextResponse.json(
      { error: "Missing required field: source must be a non-empty string (e.g. 'Web Form', 'API')." },
      { status: 400 }
    );
  }
  if (!user_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_email)) {
    return NextResponse.json(
      { error: "Missing or invalid field: user_email must be a valid email address." },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  // ── 3. Insert the raw ticket with status = 'pending' ─────────────────────
  const { data: newTicket, error: insertError } = await supabase
    .from("incoming_tickets")
    .insert({
      source: source as string,
      user_email,
      issue_text: issue_text.trim(),
      status: "pending",
      generated_ghost_link: null,
    })
    .select()
    .single();

  if (insertError || !newTicket) {
    console.error("[GhostFix] Supabase insert error:", insertError);
    return NextResponse.json(
      { error: "Failed to persist ticket to database.", detail: insertError?.message },
      { status: 500 }
    );
  }

  const ticketId = (newTicket as IncomingTicketRow).id;

  // Mark as 'analyzing' so the dashboard shows triage is in progress
  await supabase
    .from("incoming_tickets")
    .update({ status: "analyzing" satisfies TicketStatus })
    .eq("id", ticketId);

  // ── 4. Fetch historical context from knowledge base (RAG) ────────────────
  //  Query historical_fixes for past resolutions that match this issue's
  //  keywords — these are injected into the AI prompt as grounding evidence.
  const historicalContext = await fetchHistoricalContext(supabase, issue_text.trim());

  // ── 5. Run AI triage — grounded in team knowledge base when matches found ─
  const triage = await analyzeTicketWithAI(issue_text.trim(), historicalContext);

  // ── 6. Determine final status + ghost link ───────────────────────────────
  //
  //  auto_patch_viable = true  → we "deploy" a ghost environment
  //                              (simulated: generate unique URL + set 'patched')
  //  auto_patch_viable = false → confidence too low, escalate to engineers
  //
  const ghostLink = triage.auto_patch_viable ? generateGhostLink() : null;
  const finalStatus = triage.auto_patch_viable ? "patched" : "escalated";

  // ── 6. Update the ticket row with AI results + ghost link ────────────────
  const { error: updateError } = await supabase
    .from("incoming_tickets")
    .update({
      status: finalStatus satisfies TicketStatus,
      failing_module: triage.failing_module,
      triage_summary: triage.fix_summary,
      generated_ghost_link: ghostLink,
    })
    .eq("id", ticketId);

  if (updateError) {
    console.error("[GhostFix] Supabase update error:", updateError);
    // Non-fatal — the ticket is still saved. Log and continue.
  }

  // ── 7. Return structured response to the webhook caller ──────────────────
  return NextResponse.json(
    {
      success: true,
      ticket_id: ticketId,
      status: finalStatus,
      triage: {
        failing_module: triage.failing_module,
        fix_summary: triage.fix_summary,
        confidence_score: triage.confidence_score,
        matched_historical_fix: triage.matched_historical_fix,
        historical_matches_found: historicalContext.length,
      },
      ghost_environment: ghostLink
        ? {
            url: ghostLink,
            message: `A patched environment has been provisioned. The user at ${user_email} can test the fix immediately at the URL above while your engineering team reviews the generated pull request.`,
          }
        : {
            url: null,
            message: `Confidence score too low (${triage.confidence_score.toFixed(2)}) for automated patching. Ticket escalated to the engineering team for manual review.`,
          },
    },
    { status: 200 }
  );
}

// ---------------------------------------------------------------------------
// GET /api/ingest — Health check (useful for uptime monitors + Novus tracking)
// ---------------------------------------------------------------------------
export async function GET() {
  return NextResponse.json(
    {
      service: "GhostFix Ingestion API",
      status: "healthy",
      ai_provider: "Groq / Llama-3.3-70b-versatile (free)",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
