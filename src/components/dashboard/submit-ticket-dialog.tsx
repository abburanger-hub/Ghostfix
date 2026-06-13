"use client";

// =============================================================================
// GhostFix — Submit Ticket Dialog
// Client Component — handles form state, live AI thinking steps, result display.
// =============================================================================

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Ghost,
  Cpu,
  Zap,
  Shield,
  ExternalLink,
  Sparkles,
  Database,
  BookOpen,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase =
  | "idle"        // form visible, waiting for input
  | "saving"      // step 1 — writing ticket to DB
  | "searching"   // step 2 — RAG: searching historical fixes
  | "analyzing"   // step 3 — Groq AI triage running
  | "deploying"   // step 4 — generating ghost environment
  | "done"        // result ready
  | "error";      // something failed

interface TriageResult {
  ticket_id: string;
  status: "patched" | "escalated";
  triage: {
    failing_module: string;
    fix_summary: string;
    confidence_score: number;
    matched_historical_fix: boolean;
    historical_matches_found: number;
  };
  ghost_environment: {
    url: string | null;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Step configuration — drives the animated thinking timeline
// ---------------------------------------------------------------------------

const STEPS: { phase: Phase; icon: React.ReactNode; label: string; sub: string }[] = [
  {
    phase: "saving",
    icon: <Database className="size-3.5" />,
    label: "Saving ticket",
    sub: "Writing to Supabase with status pending…",
  },
  {
    phase: "searching",
    icon: <BookOpen className="size-3.5" />,
    label: "Searching knowledge base",
    sub: "Querying historical_fixes for past resolutions…",
  },
  {
    phase: "analyzing",
    icon: <Cpu className="size-3.5" />,
    label: "Running AI triage",
    sub: "Llama 3.3-70b analyzing root cause via Groq…",
  },
  {
    phase: "deploying",
    icon: <Ghost className="size-3.5" />,
    label: "Provisioning ghost environment",
    sub: "Generating unique hotfix environment URL…",
  },
];

const PHASE_ORDER: Phase[] = ["idle", "saving", "searching", "analyzing", "deploying", "done", "error"];

function phaseIndex(p: Phase) {
  return PHASE_ORDER.indexOf(p);
}

// ---------------------------------------------------------------------------
// Source options
// ---------------------------------------------------------------------------
const SOURCES = ["Web Form", "API", "Slack", "Email", "GitHub", "Jira", "PagerDuty"];

// ---------------------------------------------------------------------------
// Sub-component: Thinking timeline
// ---------------------------------------------------------------------------
function ThinkingTimeline({ currentPhase }: { currentPhase: Phase }) {
  return (
    <div className="mt-4 space-y-2.5">
      {STEPS.map((step, i) => {
        const stepIdx = phaseIndex(step.phase);
        const currentIdx = phaseIndex(currentPhase);

        const isDone    = currentIdx > stepIdx;
        const isActive  = currentIdx === stepIdx;
        const isPending = currentIdx < stepIdx;

        return (
          <div
            key={step.phase}
            className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-all duration-500 ${
              isActive
                ? "border-indigo-500/40 bg-indigo-500/8 shadow-sm shadow-indigo-500/10"
                : isDone
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-border/30 bg-muted/10 opacity-40"
            }`}
          >
            {/* Icon / spinner / check */}
            <div
              className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border ${
                isActive
                  ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-400"
                  : isDone
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-border/30 bg-muted/20 text-muted-foreground/30"
              }`}
            >
              {isActive ? (
                <Loader2 className="size-3 animate-spin" />
              ) : isDone ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <span className="text-[10px] font-bold tabular-nums">{i + 1}</span>
              )}
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <p
                className={`text-xs font-medium ${
                  isActive
                    ? "text-indigo-300"
                    : isDone
                    ? "text-emerald-400"
                    : "text-muted-foreground/40"
                }`}
              >
                {step.label}
                {isActive && (
                  <span className="ml-1.5 inline-flex gap-0.5">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="inline-block size-1 rounded-full bg-indigo-400"
                        style={{ animation: `bounce 1.2s ${d * 0.2}s infinite` }}
                      />
                    ))}
                  </span>
                )}
              </p>
              <p
                className={`mt-0.5 text-[10px] ${
                  isActive
                    ? "text-indigo-400/60"
                    : isDone
                    ? "text-emerald-500/50"
                    : "text-muted-foreground/25"
                }`}
              >
                {step.sub}
              </p>
            </div>

            {/* Arrow for active step */}
            {isActive && (
              <ChevronRight className="mt-1 size-3 shrink-0 animate-pulse text-indigo-400/60" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Result card
// ---------------------------------------------------------------------------
function ResultCard({
  result,
  onReset,
  onClose,
}: {
  result: TriageResult;
  onReset: () => void;
  onClose: () => void;
}) {
  const isPatched = result.status === "patched";
  const conf = Math.round(result.triage.confidence_score * 100);

  return (
    <div className="space-y-4">
      {/* Status hero */}
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
          isPatched
            ? "border-emerald-500/30 bg-emerald-500/8"
            : "border-red-500/30 bg-red-500/8"
        }`}
      >
        {isPatched ? (
          <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
        ) : (
          <AlertTriangle className="size-5 shrink-0 text-red-400" />
        )}
        <div>
          <p
            className={`text-sm font-semibold ${
              isPatched ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {isPatched
              ? "Ghost environment provisioned ✓"
              : "Escalated to engineering team"}
          </p>
          <p
            className={`text-xs ${
              isPatched ? "text-emerald-400/60" : "text-red-400/60"
            }`}
          >
            {isPatched
              ? "User can test the hotfix immediately at the URL below"
              : "Confidence too low for automated patching — needs human review"}
          </p>
        </div>
      </div>

      {/* AI analysis breakdown */}
      <div className="rounded-xl border border-border/40 bg-card/30 divide-y divide-border/30">
        {/* Failing module */}
        <div className="flex items-start gap-3 px-4 py-3">
          <Cpu className="mt-0.5 size-3.5 shrink-0 text-indigo-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
              Failing Module
            </p>
            <p className="mt-0.5 font-mono text-xs font-semibold text-indigo-300">
              {result.triage.failing_module}
            </p>
          </div>
        </div>

        {/* Fix summary */}
        <div className="flex items-start gap-3 px-4 py-3">
          <Shield className="mt-0.5 size-3.5 shrink-0 text-violet-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
              Recommended Fix
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">
              {result.triage.fix_summary}
            </p>
          </div>
        </div>

        {/* Confidence row */}
        <div className="px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
            AI Confidence
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
              <div
                className={`h-full rounded-full transition-all ${
                  conf >= 80
                    ? "bg-emerald-500"
                    : conf >= 50
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${conf}%` }}
              />
            </div>
            <span
              className={`shrink-0 text-xs font-bold tabular-nums ${
                conf >= 80
                  ? "text-emerald-400"
                  : conf >= 50
                  ? "text-amber-400"
                  : "text-red-400"
              }`}
            >
              {conf}%
            </span>
          </div>
        </div>

        {/* RAG knowledge base row */}
        <div className="flex items-center gap-2 px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 shrink-0">
            Knowledge Base
          </p>
          <div className="flex items-center gap-1 ml-auto">
            {result.triage.matched_historical_fix ? (
              <>
                <Sparkles className="size-3 shrink-0 text-violet-400" />
                <span className="text-[11px] font-medium text-violet-400 whitespace-nowrap">
                  {result.triage.historical_matches_found} historical match
                  {result.triage.historical_matches_found !== 1 ? "es" : ""} used
                </span>
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground/40">
                No prior matches — general AI knowledge used
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ghost environment link */}
      {result.ghost_environment.url && (
        <a
          href={result.ghost_environment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/12 group"
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-emerald-300">
              Ghost Environment URL
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-emerald-500/60">
              {result.ghost_environment.url}
            </p>
          </div>
          <ExternalLink className="size-4 shrink-0 text-emerald-400 group-hover:text-emerald-300" />
        </a>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={onReset}
        >
          Submit another
        </Button>
        <Button size="sm" className="flex-1 text-xs" onClick={onClose}>
          View in dashboard
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dialog Component
// ---------------------------------------------------------------------------
export default function SubmitTicketDialog() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<TriageResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Form fields
  const [source, setSource] = useState("Web Form");
  const [email, setEmail] = useState("");
  const [issueText, setIssueText] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  function resetForm() {
    setPhase("idle");
    setResult(null);
    setErrorMsg("");
    setEmail("");
    setIssueText("");
    setSource("Web Form");
  }

  function handleClose(openState: boolean) {
    setOpen(openState);
    if (!openState) {
      // Abort any in-flight request
      abortRef.current?.abort();
      // Small delay so the dialog close animation doesn't flash the reset
      setTimeout(resetForm, 300);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase !== "idle") return;

    // Basic client-side validation
    if (!email.trim() || !issueText.trim()) return;

    abortRef.current = new AbortController();

    try {
      // ── Step 1: saving ───────────────────────────────────────────────
      setPhase("saving");
      await delay(600);

      // ── Step 2: searching knowledge base ────────────────────────────
      setPhase("searching");
      await delay(700);

      // ── Step 3: AI analyzing (actual API call happens here) ──────────
      setPhase("analyzing");

      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ghostfix-secret": "dev-secret",
        },
        body: JSON.stringify({
          source,
          user_email: email.trim(),
          issue_text: issueText.trim(),
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }

      // ── Step 4: deploying ghost env ──────────────────────────────────
      setPhase("deploying");
      await delay(500);

      const data = await response.json() as TriageResult;

      setResult(data);
      setPhase("done");

      // ── Fire Novus track events ──────────────────────────────────────────
      if (typeof pendo !== "undefined") {
        // Every successful submission
        pendo.track("ticket_ingested", {
          source,
          status: data.status,
          confidence_score: data.triage.confidence_score,
          matched_historical_fix: data.triage.matched_historical_fix,
          historical_matches_found: data.triage.historical_matches_found,
        });

        // AI completed its analysis
        pendo.track("ai_triage_completed", {
          failing_module: data.triage.failing_module,
          confidence_score: data.triage.confidence_score,
          matched_historical_fix: data.triage.matched_historical_fix,
          auto_patch_viable: data.status === "patched",
          source,
        });

        // Outcome: patched or escalated
        if (data.status === "patched") {
          pendo.track("ghost_environment_provisioned", {
            source,
            confidence_score: data.triage.confidence_score,
            matched_historical_fix: data.triage.matched_historical_fix,
            failing_module: data.triage.failing_module,
          });
        } else {
          pendo.track("ticket_escalated", {
            source,
            confidence_score: data.triage.confidence_score,
            failing_module: data.triage.failing_module,
            matched_historical_fix: data.triage.matched_historical_fix,
          });
        }
      }

      // Refresh the dashboard table in the background
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;

      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";

      // Fire ingestion failure event
      if (typeof pendo !== "undefined") {
        pendo.track("ticket_ingestion_failed", {
          source,
          error: msg,
        });
      }

      setErrorMsg(msg);
      setPhase("error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500 border-0"
          >
            <Plus className="size-3.5" />
            New Ticket
          </Button>
        }
      />

      <DialogContent className="w-full max-w-[calc(100%-2rem)] sm:max-w-xl border-border/50 bg-card/95 backdrop-blur-xl p-0 gap-0 overflow-visible">
        {/* ── Header ── */}
        <DialogHeader className="border-b border-border/40 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/25">
              <Ghost className="size-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold leading-none">
                Submit Bug Report
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                GhostFix AI will triage it in real time
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5">
          {/* ── FORM ── */}
          {phase === "idle" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Source selector */}
              <div className="space-y-1.5">
                <Label htmlFor="source" className="text-xs text-muted-foreground">
                  Source
                </Label>
                <select
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s} className="bg-card text-foreground">
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-muted-foreground">
                  Reporter Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="dev@yourcompany.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-9 text-sm"
                />
              </div>

              {/* Issue description */}
              <div className="space-y-1.5">
                <Label htmlFor="issue" className="text-xs text-muted-foreground">
                  Issue Description
                </Label>
                <Textarea
                  id="issue"
                  placeholder="Describe the bug in detail — e.g. 'Dashboard is returning 504 errors since the last deployment. All EU users affected.'"
                  value={issueText}
                  onChange={(e) => setIssueText(e.target.value)}
                  required
                  rows={4}
                  className="resize-none text-sm"
                />
                <p className="text-[10px] text-muted-foreground/50">
                  Be specific — the more detail, the higher the AI confidence score.
                </p>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-0 hover:from-indigo-500 hover:to-violet-500"
                disabled={!email.trim() || !issueText.trim()}
              >
                <Zap className="size-3.5" />
                Submit to GhostFix AI
              </Button>
            </form>
          )}

          {/* ── AI THINKING VIEW ── */}
          {(phase === "saving" ||
            phase === "searching" ||
            phase === "analyzing" ||
            phase === "deploying") && (
            <div>
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-indigo-400" />
                <p className="text-sm font-medium text-indigo-300">
                  GhostFix AI is working…
                </p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Watch the pipeline process your ticket in real time
              </p>
              <ThinkingTimeline currentPhase={phase} />
            </div>
          )}

          {/* ── RESULT ── */}
          {phase === "done" && result && (
            <ResultCard
              result={result}
              onReset={resetForm}
              onClose={() => setOpen(false)}
            />
          )}

          {/* ── ERROR ── */}
          {phase === "error" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-300">
                    Submission failed
                  </p>
                  <p className="mt-0.5 text-xs text-red-400/70">{errorMsg}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={resetForm}
              >
                Try again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Tiny helper — adds an artificial delay so the user can see each step animate
// ---------------------------------------------------------------------------
function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
