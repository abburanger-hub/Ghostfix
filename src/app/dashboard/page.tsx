// =============================================================================
// GhostFix — SRE Triage Command Center Dashboard
// Route: /dashboard
//
// Server Component — data is fetched at request time via the Supabase
// service-role client. Renders a polished dark-mode SaaS dashboard.
// =============================================================================

// Force this route to always render dynamically (never cache at build time)
// Without this, Next.js will statically generate the page at deploy time and
// serve the same stale snapshot on every subsequent request.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IncomingTicketRow, TicketStatus } from "@/lib/supabase/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import RefreshButton from "@/components/dashboard/refresh-button";
import SubmitTicketDialog from "@/components/dashboard/submit-ticket-dialog";
import PendoDashboardTracker from "@/components/dashboard/pendo-tracker";
import ScrollToHighlight from "@/components/dashboard/scroll-to-highlight";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  ExternalLink,
  Ghost,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  ArrowUpRight,
  Cpu,
  Shield,
  Inbox,
  BookOpen,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Utility: relative time formatter (runs server-side at render time)
// ---------------------------------------------------------------------------
function formatTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diffMs / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (secs < 60) return `${secs}s ago`;
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Status config — drives badge colour + left border colour on each row
// ---------------------------------------------------------------------------
const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; badgeCls: string; dotCls: string; rowBorderCls: string }
> = {
  pending: {
    label: "Pending",
    badgeCls:
      "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
    dotCls: "bg-zinc-400",
    rowBorderCls: "border-l-zinc-500/30",
  },
  analyzing: {
    label: "Analyzing",
    badgeCls:
      "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    dotCls: "bg-amber-400 animate-pulse",
    rowBorderCls: "border-l-amber-500/50",
  },
  patched: {
    label: "Patched",
    badgeCls:
      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    dotCls: "bg-emerald-400",
    rowBorderCls: "border-l-emerald-500/50",
  },
  resolved: {
    label: "Resolved",
    badgeCls:
      "bg-teal-500/10 text-teal-400 border border-teal-500/20",
    dotCls: "bg-teal-400",
    rowBorderCls: "border-l-teal-500/50",
  },
  escalated: {
    label: "Escalated",
    badgeCls:
      "bg-red-500/10 text-red-400 border border-red-500/20",
    dotCls: "bg-red-400",
    rowBorderCls: "border-l-red-500/50",
  },
};

// ---------------------------------------------------------------------------
// Sub-components (pure, no hooks — safe inside Server Component file)
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: TicketStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.badgeCls}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${cfg.dotCls}`} />
      {cfg.label}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  // Colour map for common source names — falls back to neutral grey
  const colourMap: Record<string, string> = {
    "Web Form":   "border-blue-500/20 bg-blue-500/10 text-blue-400",
    "API":        "border-violet-500/20 bg-violet-500/10 text-violet-400",
    "Slack":      "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    "Email":      "border-amber-500/20 bg-amber-500/10 text-amber-400",
  };
  const cls =
    colourMap[source] ??
    "border-zinc-500/20 bg-zinc-500/10 text-zinc-400";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {source}
    </span>
  );
}

function ActionButton({ ticket }: { ticket: IncomingTicketRow }) {
  if (ticket.generated_ghost_link) {
    return (
      <a
        href={ticket.generated_ghost_link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/20 hover:text-emerald-300"
      >
        <ExternalLink className="size-3" />
        View Ghost Env
      </a>
    );
  }
  if (ticket.status === "escalated") {
    return (
      <Link
        href={`/escalate/${ticket.id}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-300"
      >
        <AlertTriangle className="size-3" />
        Review
      </Link>
    );
  }
  if (ticket.status === "analyzing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs font-medium text-amber-400/60 select-none">
        <Zap className="size-3 animate-pulse" />
        Analyzing…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground/40 select-none">
      <Clock className="size-3" />
      Queued
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------
interface StatCardProps {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ReactNode;
  cardCls?: string;
  valueCls?: string;
  subCls?: string;
}

function StatCard({
  label,
  value,
  sub,
  icon,
  cardCls = "",
  valueCls = "",
  subCls = "text-muted-foreground",
}: StatCardProps) {
  return (
    <Card className={`border-border/50 backdrop-blur-sm ${cardCls}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className={`text-xs ${subCls}`}>
            {label}
          </CardDescription>
          <div className="rounded-lg p-1.5 bg-muted/60">{icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold tracking-tight ${valueCls}`}>
          {value}
        </div>
        <p className={`mt-1 text-xs ${subCls}`}>{sub}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
      <div className="relative">
        <div className="flex size-20 items-center justify-center rounded-2xl border border-border/50 bg-muted/20 shadow-inner">
          <Ghost className="size-10 text-muted-foreground/30" />
        </div>
        <div className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border border-border/50 bg-card text-xs font-bold text-muted-foreground">
          0
        </div>
      </div>
      <div className="max-w-sm">
        <p className="font-medium text-foreground/60">
          No tickets intercepted yet
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Click{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-indigo-400">
            + New Ticket
          </code>{" "}
          above to submit your first bug report, or send a{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-indigo-400">
            POST /api/ingest
          </code>{" "}
          webhook. GhostFix will triage it with AI and appear here instantly.
        </p>
        <div className="mt-4 rounded-xl border border-border/40 bg-muted/20 p-3 text-left">
          <p className="mb-2 font-mono text-[10px] text-muted-foreground/60">
            # Quick test with curl
          </p>
          <p className="font-mono text-[11px] leading-relaxed text-indigo-300">
            {`curl -X POST /api/ingest \\`}
            <br />
            {`  -H "Content-Type: application/json" \\`}
            <br />
            {`  -d '{"source":"API",`}
            <br />
            {`       "user_email":"you@co.com",`}
            <br />
            {`       "issue_text":"504 on dashboard"}'`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------
function ErrorState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
        <AlertTriangle className="size-10 text-red-400" />
      </div>
      <div>
        <p className="font-medium text-red-400">Database connection failed</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Check{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-red-300">
            SUPABASE_URL
          </code>{" "}
          and{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-red-300">
            SUPABASE_SERVICE_ROLE_KEY
          </code>{" "}
          in{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            .env.local
          </code>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo seed data — shown when Supabase is not yet connected (no real keys).
// Replace real keys in .env.local to switch to live data automatically.
// ---------------------------------------------------------------------------
const DEMO_TICKETS: IncomingTicketRow[] = [
  {
    id: "demo-1",
    source: "Web Form",
    user_email: "sarah.chen@acmecorp.com",
    issue_text: "Dashboard is completely blank and returning a 504 Gateway Timeout since 09:15 AM. Affecting all users in the EU region.",
    status: "patched",
    failing_module: "AppTier",
    triage_summary: "Reset the AppTier connection pool and increase timeout from 2s to 5s to prevent cascade failures under load.",
    generated_ghost_link: "https://ghostfix.vercel.app/patch/a3f7c91b4d2e8056f1a0c3b7d9e2f415",
    created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  },
  {
    id: "demo-2",
    source: "API",
    user_email: "marcus.lee@acmecorp.com",
    issue_text: "Getting 'Session expired' errors every 10 minutes even though I'm actively using the app. Very disruptive.",
    status: "patched",
    failing_module: "Auth Service",
    triage_summary: "Add 300s clock-skew tolerance to JWT verification to eliminate false session expiry caused by server time drift.",
    generated_ghost_link: "https://ghostfix.vercel.app/patch/b7e2f3a1c5d9e0f4b8a2c6d0e1f3a7b9",
    created_at: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
  },
  {
    id: "demo-3",
    source: "Web Form",
    user_email: "priya.patel@acmecorp.com",
    issue_text: "File uploads larger than ~10MB silently fail — no error message, just hangs at 99% and times out.",
    status: "patched",
    failing_module: "Upload Gateway",
    triage_summary: "Raise API gateway payload limit from 10MB to 100MB and add missing CORS header on the storage endpoint.",
    generated_ghost_link: "https://ghostfix.vercel.app/patch/c9d4e2f1a6b8c0d3e5f7a1b4c8d2e6f0",
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: "demo-4",
    source: "Slack",
    user_email: "james.okonkwo@acmecorp.com",
    issue_text: "Email notifications stopped sending yesterday afternoon. Tickets marked as sent in the UI but users never receive them.",
    status: "escalated",
    failing_module: "Mailer Worker",
    triage_summary: "SMTP credentials rotated last week — re-point mailer to updated SMTP_USER_V2 and SMTP_PASS_V2 env vars.",
    generated_ghost_link: null,
    created_at: new Date(Date.now() - 1000 * 60 * 31).toISOString(),
  },
  {
    id: "demo-5",
    source: "Email",
    user_email: "nina.vasquez@acmecorp.com",
    issue_text: "The analytics export keeps spinning and never downloads. Started after last Tuesday's deployment.",
    status: "analyzing",
    failing_module: null,
    triage_summary: null,
    generated_ghost_link: null,
    created_at: new Date(Date.now() - 1000 * 60 * 44).toISOString(),
  },
  {
    id: "demo-6",
    source: "Web Form",
    user_email: "tom.brightwell@acmecorp.com",
    issue_text: "Two-factor auth QR code isn't loading on the security settings page. Shows a broken image icon.",
    status: "pending",
    failing_module: null,
    triage_summary: null,
    generated_ghost_link: null,
    created_at: new Date(Date.now() - 1000 * 60 * 58).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Page — Server Component
// ---------------------------------------------------------------------------
const PAGE_SIZE = 10;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; highlight?: string }>;
}) {
  const { page: pageParam, highlight } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  // ── Fetch tickets ─────────────────────────────────────────────────────────
  let tickets: IncomingTicketRow[] = [];
  let totalCount = 0;
  let statPatched = 0;
  let statPipeline = 0;
  let statEscalated = 0;
  let fetchError = false;
  let isDemo = false;

  const hasRealKeys =
    process.env.SUPABASE_URL &&
    !process.env.SUPABASE_URL.includes("placeholder") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder");

  if (!hasRealKeys) {
    // No real Supabase keys — show demo data so the UI is fully visible
    tickets = DEMO_TICKETS;
    totalCount    = DEMO_TICKETS.length;
    statPatched   = DEMO_TICKETS.filter(t => t.status === "patched" || t.status === "resolved").length;
    statPipeline  = DEMO_TICKETS.filter(t => t.status === "pending"  || t.status === "analyzing").length;
    statEscalated = DEMO_TICKETS.filter(t => t.status === "escalated").length;
    isDemo = true;
  } else {
    try {
      const supabase = createServerSupabaseClient();

      // Run all 4 count queries in parallel for accurate stats across ALL pages
      const [
        { count: allCount },
        { count: patchedCount },
        { count: pipelineCount },
        { count: escalatedCount },
      ] = await Promise.all([
        supabase.from("incoming_tickets").select("*", { count: "exact", head: true }),
        supabase.from("incoming_tickets").select("*", { count: "exact", head: true }).in("status", ["patched", "resolved"]),
        supabase.from("incoming_tickets").select("*", { count: "exact", head: true }).in("status", ["pending", "analyzing"]),
        supabase.from("incoming_tickets").select("*", { count: "exact", head: true }).eq("status", "escalated"),
      ]);
      totalCount   = allCount     ?? 0;
      statPatched  = patchedCount  ?? 0;
      statPipeline = pipelineCount ?? 0;
      statEscalated = escalatedCount ?? 0;

      // Then fetch just this page
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("incoming_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        fetchError = true;
      } else {
        tickets = (data as IncomingTicketRow[]) ?? [];
      }
    } catch {
      fetchError = true;
    }
  }

  // ── Compute stats (from full DB counts, not just current page) ───────────
  const total    = isDemo ? DEMO_TICKETS.length : totalCount;
  const patched  = isDemo ? statPatched  : statPatched;
  const inPipeline = isDemo ? statPipeline : statPipeline;
  const escalated  = isDemo ? statEscalated : statEscalated;
  const patchRate = total > 0 ? Math.round((patched / total) * 100) : 0;

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const pageStart = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, total);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Fire dashboard_data_loaded track event on every page mount */}
      <PendoDashboardTracker
        total={total}
        patched={patched}
        inPipeline={inPipeline}
        escalated={escalated}
        patchRate={patchRate}
        isDemo={isDemo}
      />
      {/* Scroll new ticket into view if navigated from the submit dialog */}
      <ScrollToHighlight ticketId={highlight} />

      {/* ═══ TOP NAV BAR ═══════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600 shadow-lg shadow-indigo-500/25">
              <Ghost className="size-[18px] text-white" />
              {/* subtle glow ring */}
              <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-violet-300 bg-clip-text text-sm font-semibold tracking-tight text-transparent">
                GhostFix
              </span>
              <span className="text-[10px] text-muted-foreground/70">
                Autonomous SRE Triage
              </span>
            </div>
            <span className="ml-1 hidden rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-400 sm:inline-flex">
              Alpha
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* KB link */}
            <Link
              href="/kb"
              className="hidden items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/8 px-3 py-1.5 text-xs font-medium text-violet-400 transition-colors hover:border-violet-500/40 hover:bg-violet-500/15 sm:flex"
            >
              <BookOpen className="size-3" />
              Knowledge Base
            </Link>
            {total > 0 && (
              <div className="hidden items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1.5 sm:flex">
                <Activity className="size-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {patchRate}%
                  </span>{" "}
                  auto-patch rate
                </span>
              </div>
            )}
            {/* Live indicator */}
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-3 py-1.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-400">
                Live
              </span>
            </div>
            <SubmitTicketDialog />
            <RefreshButton />
          </div>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ══════════════════════════════════════════════════ */}
      <main className="w-full px-4 py-8 sm:px-6 lg:px-8">

        {/* Page title */}
        <div className="mb-8">
          <div className="flex items-end gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              Triage Command Center
            </h1>
            {total > 0 && (
              <span className="mb-0.5 text-sm text-muted-foreground">
                {total} ticket{total !== 1 ? "s" : ""} total
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time AI pipeline · Intercept → Diagnose → Deploy hotfix →
            Unblock users
          </p>
        </div>

        {/* Demo mode banner */}
        {isDemo && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-indigo-500/25 bg-indigo-500/8 px-4 py-3">
            <Zap className="mt-0.5 size-4 shrink-0 text-indigo-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-indigo-300">
                Demo Mode — Sample data displayed
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-indigo-400/70">
                Add your real{" "}
                <code className="rounded bg-indigo-500/20 px-1 py-0.5 font-mono text-[11px] text-indigo-300">
                  SUPABASE_URL
                </code>{" "}
                and{" "}
                <code className="rounded bg-indigo-500/20 px-1 py-0.5 font-mono text-[11px] text-indigo-300">
                  SUPABASE_SERVICE_ROLE_KEY
                </code>{" "}
                to{" "}
                <code className="rounded bg-indigo-500/20 px-1 py-0.5 font-mono text-[11px] text-indigo-300">
                  .env.local
                </code>{" "}
                to connect your live database.
              </p>
            </div>
          </div>
        )}

        {/* ═══ KPI STAT CARDS ═════════════════════════════════════════════ */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Intercepted"
            value={total}
            sub="All time this session"
            icon={<Inbox className="size-4 text-muted-foreground" />}
            cardCls="bg-card/50"
          />
          <StatCard
            label="Auto-Patched"
            value={patched}
            sub={`${patchRate}% resolution rate`}
            icon={<CheckCircle2 className="size-4 text-emerald-400" />}
            cardCls="border-emerald-500/20 bg-emerald-500/[0.04]"
            valueCls="text-emerald-400"
            subCls="text-emerald-500/60"
          />
          <StatCard
            label="In Pipeline"
            value={inPipeline}
            sub="Pending or analyzing"
            icon={<Zap className="size-4 text-amber-400" />}
            cardCls="border-amber-500/20 bg-amber-500/[0.04]"
            valueCls="text-amber-400"
            subCls="text-amber-500/60"
          />
          <StatCard
            label="Escalated"
            value={escalated}
            sub="Needs engineer review"
            icon={<AlertTriangle className="size-4 text-red-400" />}
            cardCls="border-red-500/20 bg-red-500/[0.04]"
            valueCls="text-red-400"
            subCls="text-red-500/60"
          />
        </div>

        {/* ═══ MAIN TABLE CARD ════════════════════════════════════════════ */}
        <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
          {/* Card header */}
          <CardHeader className="border-b border-border/40 px-6 pb-4 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Incoming Tickets
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  Live feed from any source · Triaged by GhostFix AI
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                <Cpu className="size-3.5" />
                <span>Llama 3.3 · Groq</span>
              </div>
            </div>
          </CardHeader>

          {/* Card body */}
          <CardContent className="p-0">
            {fetchError ? (
              <ErrorState />
            ) : tickets.length === 0 ? (
              <EmptyState />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b-border/40 hover:bg-transparent">
                    <TableHead className="w-[80px] pl-6 text-xs font-medium text-muted-foreground/70">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        Time
                      </div>
                    </TableHead>
                    <TableHead className="w-[80px] text-xs font-medium text-muted-foreground/70">
                      Source
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground/70">
                      Issue
                    </TableHead>
                    <TableHead className="w-[140px] text-xs font-medium text-muted-foreground/70">
                      <div className="flex items-center gap-1">
                        <Cpu className="size-3" />
                        Module
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground/70">
                      <div className="flex items-center gap-1">
                        <Shield className="size-3" />
                        Fix Summary
                      </div>
                    </TableHead>
                    <TableHead className="w-[115px] text-xs font-medium text-muted-foreground/70">
                      Status
                    </TableHead>
                    <TableHead className="w-[155px] pr-6 text-right text-xs font-medium text-muted-foreground/70">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {tickets.map((ticket) => {
                    const cfg =
                      STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.pending;
                    const isHighlighted = ticket.id === highlight;
                    return (
                      <TableRow
                        key={ticket.id}
                        id={isHighlighted ? "highlighted-ticket" : undefined}
                        className={`group border-b-border/30 border-l-2 transition-colors hover:bg-white/[0.02] ${cfg.rowBorderCls} ${
                          isHighlighted
                            ? "bg-indigo-500/[0.07] ring-1 ring-inset ring-indigo-500/30 animate-in fade-in-0 duration-700"
                            : ""
                        }`}
                      >
                        {/* Time */}
                        <TableCell className="pl-6 font-mono text-[11px] text-muted-foreground/60 tabular-nums">
                          {isHighlighted && (
                            <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-indigo-400">
                              <span className="relative flex size-1.5">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                                <span className="relative inline-flex size-1.5 rounded-full bg-indigo-500" />
                              </span>
                              Just triaged
                            </span>
                          )}
                          {formatTimeAgo(ticket.created_at)}
                        </TableCell>

                        {/* Source */}
                        <TableCell>
                          <SourceBadge source={ticket.source} />
                        </TableCell>

                        {/* Issue + email */}
                        <TableCell className="max-w-[200px]">
                          <p
                            className="truncate text-sm text-foreground/80"
                            title={ticket.issue_text}
                          >
                            {ticket.issue_text}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/40">
                            {ticket.user_email}
                          </p>
                        </TableCell>

                        {/* Failing module */}
                        <TableCell>
                          {ticket.failing_module ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-indigo-300">
                              {ticket.failing_module}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/30">
                              —
                            </span>
                          )}
                        </TableCell>

                        {/* Triage summary */}
                        <TableCell className="max-w-[240px]">
                          {ticket.triage_summary ? (
                            <p
                              className="truncate text-xs leading-relaxed text-muted-foreground group-hover:text-muted-foreground/80"
                              title={ticket.triage_summary}
                            >
                              {ticket.triage_summary}
                            </p>
                          ) : (
                            <span className="text-xs italic text-muted-foreground/30">
                              Pending AI analysis…
                            </span>
                          )}
                        </TableCell>

                        {/* Status badge */}
                        <TableCell>
                          <StatusBadge status={ticket.status} />
                        </TableCell>

                        {/* Action button */}
                        <TableCell className="pr-6 text-right">
                          <ActionButton ticket={ticket} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* ── Pagination bar ─────────────────────────────────────── */}
            {!fetchError && tickets.length > 0 && (
              <div className="flex flex-col items-center gap-3 border-t border-border/40 px-6 py-4 sm:flex-row sm:justify-between">
                {/* Page info */}
                <p className="text-xs text-muted-foreground/60">
                  Showing{" "}
                  <span className="font-medium text-foreground/70">
                    {pageStart}–{pageEnd}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground/70">{total}</span>{" "}
                  ticket{total !== 1 ? "s" : ""}
                </p>

                {/* Prev / Page pills / Next */}
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/dashboard?page=${currentPage - 1}`}
                    aria-disabled={!hasPrev}
                    className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      hasPrev
                        ? "border-border/50 text-foreground/70 hover:border-border hover:bg-muted/30 hover:text-foreground"
                        : "pointer-events-none border-border/20 text-muted-foreground/25"
                    }`}
                  >
                    <ChevronLeft className="size-3" />
                    Prev
                  </Link>

                  {/* Page number pills — hide when only 1 page */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <Link
                          key={p}
                          href={`/dashboard?page=${p}`}
                          className={`inline-flex size-7 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                            p === currentPage
                              ? "border border-indigo-500/40 bg-indigo-500/20 text-indigo-300"
                              : "border border-transparent text-muted-foreground/50 hover:border-border/40 hover:text-foreground/70"
                          }`}
                        >
                          {p}
                        </Link>
                      ))}
                    </div>
                  )}

                  <Link
                    href={`/dashboard?page=${currentPage + 1}`}
                    aria-disabled={!hasNext}
                    className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      hasNext
                        ? "border-border/50 text-foreground/70 hover:border-border hover:bg-muted/30 hover:text-foreground"
                        : "pointer-events-none border-border/20 text-muted-foreground/25"
                    }`}
                  >
                    Next
                    <ChevronRight className="size-3" />
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ FOOTER ═════════════════════════════════════════════════════ */}
        <div className="mt-6 flex flex-col items-center justify-between gap-2 text-[11px] text-muted-foreground/40 sm:flex-row">
          <span>
            GhostFix · Autonomous SRE Triage Agent · World Product Day 2026
          </span>
          <a
            href="https://novus.pendo.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition-colors hover:text-muted-foreground/70"
          >
            Powered by Novus.ai
            <ArrowUpRight className="size-3" />
          </a>
        </div>
      </main>
    </div>
  );
}
