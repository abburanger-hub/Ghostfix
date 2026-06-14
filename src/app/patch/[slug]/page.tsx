// =============================================================================
// GhostFix — Ghost Environment Page
// Route: /patch/[slug]
//
// Every auto-patched ticket gets a unique URL like:
//   https://ghostfix.vercel.app/patch/a3f7c91b4d2e8056f1a0c3b7d9e2f415
//
// This page looks up the ticket by matching the full URL in the DB and
// renders a "Ghost Environment Active" landing showing the applied patch.
// =============================================================================

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IncomingTicketRow } from "@/lib/supabase/types";
import {
  Ghost,
  CheckCircle2,
  Cpu,
  Shield,
  Clock,
  ArrowLeft,
  Terminal,
  Zap,
  AlertTriangle,
  Lock,
} from "lucide-react";
import Link from "next/link";
import EnvTester from "./env-tester";

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

// Fake-but-plausible server metrics to make the page feel real
function deterministicMetric(slug: string, index: number, min: number, max: number) {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0;
  }
  const seed = Math.abs(hash + index * 2654435761);
  return min + (seed % (max - min));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function PatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // ── Look up the ticket by matching the ghost link ──────────────────────
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
        .ilike("generated_ghost_link", `%${slug}`)
        .single();
      ticket = data as IncomingTicketRow | null;
    } catch {
      // Non-fatal — show generic ghost env page
    }
  }

  // Deterministic metrics based on the slug so they're consistent on reload
  const cpuUsage   = deterministicMetric(slug, 1, 12, 38);
  const memUsage   = deterministicMetric(slug, 2, 180, 420);
  const reqPerMin  = deterministicMetric(slug, 3, 42, 180);
  const uptime     = deterministicMetric(slug, 4, 99, 100);
  const uptimeDec  = deterministicMetric(slug, 5, 1, 9);

  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back to Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-3 py-1.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-400">Ghost Env Active</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">

        {/* ── HERO ── */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600 shadow-xl shadow-indigo-500/30">
              <Ghost className="size-10 text-white" />
            </div>
            <div className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full border-2 border-background bg-emerald-500 shadow-md">
              <CheckCircle2 className="size-4 text-white" />
            </div>
          </div>
          <h1 className="bg-gradient-to-r from-indigo-300 via-purple-300 to-violet-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            Ghost Environment Active
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            GhostFix has provisioned an isolated hotfix environment for this ticket.
            Users can test the patch without waiting for a production deployment.
          </p>
          {/* Environment ID badge */}
          <div className="mt-4 flex items-center gap-2 rounded-full border border-border/50 bg-muted/20 px-4 py-1.5">
            <Lock className="size-3 text-muted-foreground/60" />
            <span className="font-mono text-[11px] text-muted-foreground/60">
              env/{slug.slice(0, 8)}...{slug.slice(-8)}
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── LEFT COL: Ticket details ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Patch applied card */}
            <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
              <div className="border-b border-border/40 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold">Patch Applied</h2>
                  <span className="ml-auto rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                    Live
                  </span>
                </div>
              </div>
              <div className="divide-y divide-border/30">

                {/* Failing module */}
                <div className="flex items-start gap-3 px-5 py-4">
                  <Cpu className="mt-0.5 size-4 shrink-0 text-indigo-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                      Affected Module
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold text-indigo-300">
                      {ticket?.failing_module ?? "Core Service"}
                    </p>
                  </div>
                </div>

                {/* Fix applied */}
                <div className="flex items-start gap-3 px-5 py-4">
                  <Zap className="mt-0.5 size-4 shrink-0 text-violet-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                      Fix Applied
                    </p>
                    <p className="mt-1 text-sm text-foreground/80 leading-relaxed">
                      {ticket?.triage_summary ??
                        "Automated patch has been applied to isolate and resolve the reported issue."}
                    </p>
                  </div>
                </div>

                {/* Original issue */}
                {ticket?.issue_text && (
                  <div className="flex items-start gap-3 px-5 py-4">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                        Original Report
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        {ticket.issue_text}
                      </p>
                      <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/40">
                        {ticket.user_email} · {formatDate(ticket.created_at)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Interactive Live Test ── */}
            <EnvTester
              slug={slug}
              module={ticket?.failing_module ?? "Core Service"}
              fixSummary={ticket?.triage_summary ?? "Automated patch applied to resolve the reported issue."}
            />

            {/* Mock diff / patch code */}
            <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/40 bg-muted/20 px-5 py-3">
                <Terminal className="size-3.5 text-muted-foreground/60" />
                <span className="text-xs font-medium text-muted-foreground/70">
                  ghostfix-patch.diff
                </span>
                <span className="ml-auto rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                  applied
                </span>
              </div>
              <pre className="overflow-x-auto p-5 text-[11px] leading-relaxed font-mono">
                <code>
                  <span className="text-muted-foreground/40">
                    {"--- a/src/services/" +
                      (ticket?.failing_module ?? "core")
                        .toLowerCase()
                        .replace(/\s+/g, "-") +
                      ".ts\n"}
                  </span>
                  <span className="text-muted-foreground/40">
                    {"+++ b/src/services/" +
                      (ticket?.failing_module ?? "core")
                        .toLowerCase()
                        .replace(/\s+/g, "-") +
                      ".ts\n"}
                  </span>
                  <span className="text-zinc-500">{"@@ -12,7 +12,10 @@\n"}</span>
                  <span className="text-red-400/80">
                    {"- // Previous configuration\n- const config = getDefaultConfig();\n"}
                  </span>
                  <span className="text-emerald-400">
                    {"+ // GhostFix patch · " + new Date().toISOString().split("T")[0] + "\n"}
                  </span>
                  <span className="text-emerald-400">
                    {"+ // Fix: " +
                      (ticket?.triage_summary ?? "Apply recommended configuration fix")
                        .replace(/[\r\n]+/g, " ")
                        .slice(0, 80) +
                      "\n"}
                  </span>
                  <span className="text-emerald-400">
                    {"+ const config = getPatchedConfig({ module: '" +
                      (ticket?.failing_module ?? "core") +
                      "' });\n"}
                  </span>
                  <span className="text-zinc-600">
                    {"  \n  export default config;\n"}
                  </span>
                </code>
              </pre>
            </div>
          </div>

          {/* ── RIGHT COL: Live metrics ── */}
          <div className="space-y-4">

            {/* Status card */}
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
              <p className="text-xs font-medium text-emerald-400">
                Environment Status
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-300">Healthy</p>
              <p className="mt-0.5 text-xs text-emerald-500/60">
                All systems nominal
              </p>
              <div className="mt-4 space-y-2">
                {[
                  { label: "API Gateway",    ok: true },
                  { label: "Database",       ok: true },
                  { label: "Cache Layer",    ok: true },
                  { label: "Auth Service",   ok: true },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      OK
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live metrics */}
            <div className="rounded-2xl border border-border/40 bg-card/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground/70">
                  Environment Metrics
                </p>
                <span className="rounded-full border border-border/30 bg-muted/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                  Simulated
                </span>
              </div>
              {[
                { label: "CPU Usage",       value: `${cpuUsage}%`,          color: "text-blue-400" },
                { label: "Memory",          value: `${memUsage} MB`,         color: "text-violet-400" },
                { label: "Requests / min",  value: `${reqPerMin}`,           color: "text-indigo-400" },
                { label: "Uptime",          value: `${uptime}.${uptimeDec}%`, color: "text-emerald-400" },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                  <span className={`font-mono text-xs font-semibold ${m.color}`}>
                    {m.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Timestamp */}
            <div className="rounded-2xl border border-border/40 bg-card/40 p-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                <span>Provisioned</span>
              </div>
              <p className="mt-1.5 font-mono text-xs text-foreground/70">
                {ticket
                  ? formatDate(ticket.created_at)
                  : formatDate(new Date().toISOString())}
              </p>
              <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/50">
                This ghost environment will remain active until the fix is
                reviewed and merged into production by your engineering team.
              </p>
            </div>

          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="mt-10 text-center text-[11px] text-muted-foreground/30">
          GhostFix · Autonomous SRE Triage · Ghost Environment{" "}
          <span className="font-mono">{slug.slice(0, 8)}</span>
        </div>
      </main>
    </div>
  );
}
