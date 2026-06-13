// =============================================================================
// GhostFix — Escalation Review Page
// Route: /escalate/[id]
//
// Shown when a ticket's AI confidence was too low for auto-patching.
// Gives the on-call engineer full context: the original report, AI's
// best-guess analysis, confidence score, and a "Mark as Resolved" button.
// =============================================================================

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IncomingTicketRow } from "@/lib/supabase/types";
import Link from "next/link";
import {
  Ghost,
  AlertTriangle,
  ArrowLeft,
  Cpu,
  Shield,
  Clock,
  Mail,
  User,
  Activity,
  HardHat,
  CheckCircle2,
  Info,
} from "lucide-react";
import ResolveButton from "./resolve-button";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const secs  = Math.floor(diffMs / 1000);
  const mins  = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (secs < 60)  return `${secs}s ago`;
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Derive an engineer "handle" from the reporter's email domain
function inferTeam(email: string, module: string | null): string {
  if (module) {
    const m = module.toLowerCase();
    if (m.includes("auth") || m.includes("jwt"))   return "Identity & Auth Team";
    if (m.includes("payment") || m.includes("stripe")) return "Payments Team";
    if (m.includes("dashboard") || m.includes("api")) return "Platform Team";
    if (m.includes("mail") || m.includes("smtp"))   return "Notifications Team";
    if (m.includes("upload") || m.includes("storage")) return "Infrastructure Team";
    if (m.includes("worker") || m.includes("queue")) return "Backend Team";
  }
  const domain = email.split("@")[1]?.split(".")[0] ?? "Engineering";
  return `${domain.charAt(0).toUpperCase() + domain.slice(1)} Engineering`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function EscalatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let ticket: IncomingTicketRow | null = null;

  const hasRealKeys =
    process.env.SUPABASE_URL &&
    !process.env.SUPABASE_URL.includes("placeholder") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder");

  if (hasRealKeys) {
    try {
      const supabase = createServerSupabaseClient();
      const { data } = await supabase
        .from("incoming_tickets")
        .select("*")
        .eq("id", id)
        .single();
      ticket = data as IncomingTicketRow | null;
    } catch {
      // show fallback UI
    }
  }

  const isResolved = ticket?.status === "resolved";
  const team = inferTeam(
    ticket?.user_email ?? "user@company.com",
    ticket?.failing_module ?? null
  );

  // ── confidence score is not stored in the DB so we show a visual note
  // that AI flagged this for human review
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to Dashboard
          </Link>

          {/* Status pill */}
          {isResolved ? (
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-3 py-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Resolved</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/8 px-3 py-1.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-red-500" />
              </span>
              <span className="text-xs font-medium text-red-400">Needs Engineer Review</span>
            </div>
          )}
        </div>
      </header>

      <main className="w-full px-4 py-8 sm:px-6 lg:px-8">

        {/* ── HERO ── */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 via-orange-500 to-amber-500 shadow-xl shadow-red-500/25">
              <Ghost className="size-10 text-white" />
            </div>
            <div className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full border-2 border-background bg-red-500 shadow-md">
              <AlertTriangle className="size-4 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isResolved ? "Ticket Resolved" : "Escalated — Fix On Hold"}
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {isResolved
              ? "This ticket has been marked as resolved by the engineering team."
              : "GhostFix AI confidence was too low to safely auto-patch. This ticket has been escalated to your engineering team for manual review."}
          </p>

          {/* Ticket ID badge */}
          <div className="mt-4 flex items-center gap-2 rounded-full border border-border/50 bg-muted/20 px-4 py-1.5">
            <span className="font-mono text-[11px] text-muted-foreground/60">
              ticket/{id.slice(0, 8)}...{id.slice(-8)}
            </span>
          </div>
        </div>

        <div className="mx-auto max-w-5xl grid gap-6 lg:grid-cols-3">

          {/* ── LEFT COL: Ticket details ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Original report */}
            <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
              <div className="border-b border-border/40 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-amber-400" />
                  <h2 className="text-sm font-semibold">Original Bug Report</h2>
                </div>
              </div>
              <div className="divide-y divide-border/30">

                {/* Reporter info */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/40 border border-border/40">
                    <User className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                      Reported By
                    </p>
                    <p className="mt-0.5 font-mono text-sm text-foreground/80">
                      {ticket?.user_email ?? "—"}
                    </p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                      Source
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-foreground/70">
                      {ticket?.source ?? "—"}
                    </p>
                  </div>
                </div>

                {/* Issue text */}
                <div className="px-5 py-4">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                    Issue Description
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                    {ticket?.issue_text ?? "No issue text available."}
                  </p>
                </div>

                {/* Timestamps */}
                <div className="flex items-center gap-2 px-5 py-3">
                  <Clock className="size-3.5 shrink-0 text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground/50">
                    Received {ticket ? formatDate(ticket.created_at) : "—"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground/40">
                    {ticket ? formatTimeAgo(ticket.created_at) : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Analysis */}
            <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
              <div className="border-b border-border/40 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Cpu className="size-4 text-indigo-400" />
                  <h2 className="text-sm font-semibold">AI Analysis</h2>
                  <span className="ml-auto rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                    Low Confidence
                  </span>
                </div>
              </div>
              <div className="divide-y divide-border/30">

                {/* Identified module */}
                <div className="flex items-start gap-3 px-5 py-4">
                  <Cpu className="mt-0.5 size-4 shrink-0 text-indigo-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                      Suspected Module
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold text-indigo-300">
                      {ticket?.failing_module ?? "Unable to identify"}
                    </p>
                  </div>
                </div>

                {/* AI's best guess fix */}
                <div className="flex items-start gap-3 px-5 py-4">
                  <Shield className="mt-0.5 size-4 shrink-0 text-violet-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                      AI Best-Guess Fix
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground/70">
                      {ticket?.triage_summary
                        ? ticket.triage_summary.replace(/^\[Engineer resolved\]\s*/, "")
                        : "AI could not determine a reliable fix. Manual investigation required."}
                    </p>
                  </div>
                </div>

                {/* Why it was escalated */}
                <div className="flex items-start gap-3 px-5 py-4 bg-amber-500/[0.03]">
                  <Info className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                      Why Escalated
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-400/70">
                      GhostFix AI confidence score was below the 70% threshold
                      required for safe auto-patching. Applying an uncertain patch
                      could make things worse — so the ticket was handed to your
                      engineering team instead.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COL: Engineer assignment + actions ── */}
          <div className="space-y-4">

            {/* Engineer on call card */}
            <div className="rounded-2xl border border-border/40 bg-card/40 overflow-hidden">
              <div className="border-b border-border/40 bg-muted/20 px-5 py-3">
                <div className="flex items-center gap-2">
                  <HardHat className="size-4 text-amber-400" />
                  <p className="text-xs font-semibold text-foreground/80">
                    Assigned Team
                  </p>
                </div>
              </div>
              <div className="px-5 py-4 space-y-4">
                {/* Team */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                    Escalated To
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground/80">
                    {team}
                  </p>
                </div>
                {/* Module */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                    Module Under Review
                  </p>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-indigo-300">
                    {ticket?.failing_module ?? "Unknown Module"}
                  </span>
                </div>
                {/* Status */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                    Fix Status
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {isResolved ? (
                      <>
                        <span className="size-2 rounded-full bg-emerald-400" />
                        <span className="text-sm font-medium text-emerald-400">Resolved</span>
                      </>
                    ) : (
                      <>
                        <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-sm font-medium text-amber-400">Fix On Hold</span>
                      </>
                    )}
                  </div>
                </div>
                {/* Reporter */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                    Awaiting Fix
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground/70 truncate">
                    {ticket?.user_email ?? "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* SLA notice */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
              <div className="flex items-start gap-2">
                <Activity className="mt-0.5 size-4 shrink-0 text-amber-400" />
                <div>
                  <p className="text-xs font-semibold text-amber-300">
                    SLA Notice
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-400/60">
                    Escalated tickets are expected to be triaged within
                    <span className="font-semibold text-amber-400"> 4 hours</span>.
                    Please review the AI analysis and apply a manual fix, then
                    mark as resolved below.
                  </p>
                </div>
              </div>
            </div>

            {/* Mark as Resolved */}
            {!isResolved && ticket && (
              <ResolveButton ticketId={ticket.id} />
            )}

            {/* Already resolved */}
            {isResolved && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-5 py-4">
                <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    Ticket Closed
                  </p>
                  <p className="text-xs text-emerald-400/60">
                    Marked as resolved by the engineering team.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="mt-10 text-center text-[11px] text-muted-foreground/30">
          GhostFix · Autonomous SRE Triage · Escalation Review{" "}
          <span className="font-mono">{id.slice(0, 8)}</span>
        </div>
      </main>
    </div>
  );
}
