// =============================================================================
// GhostFix — Knowledge Base Browser
// Route: /kb
//
// Server Component — lists every entry in the historical_fixes table so
// judges can see the self-learning loop producing real artefacts.
// =============================================================================

export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Ghost,
  BookOpen,
  Sparkles,
  ArrowLeft,
  Database,
  Shield,
  Code2,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface KBEntry {
  id: string;
  error_signature: string;
  proposed_solution: string;
  mock_patch_code: string;
  /** Optional — only present if the column was added later */
  created_at?: string | null;
}

// ---------------------------------------------------------------------------
// Demo fallback — shown when Supabase keys are missing
// ---------------------------------------------------------------------------
const DEMO_ENTRIES: KBEntry[] = [
  {
    id: "kb-demo-1",
    error_signature: "Users report 502 Bad Gateway on the checkout page after load spikes above 500 rps. Cart service crashes with OOM.",
    proposed_solution: "Increase cart service memory limit from 512MB to 2GB and add horizontal pod autoscaling (HPA) at 70% CPU threshold.",
    mock_patch_code: "// Module: Cart Service\n// Engineer resolution:\n// Increase memory limit and add HPA",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "kb-demo-2",
    error_signature: "SMTP credentials rotated last week — mailer worker stopped sending email notifications after the rotation.",
    proposed_solution: "Re-point mailer to SMTP_USER_V2 and SMTP_PASS_V2 env vars. Rotate the old credentials out of Vault.",
    mock_patch_code: "// Module: Mailer Worker\n// Engineer resolution:\n// Update SMTP env var references",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "kb-demo-3",
    error_signature: "File uploads larger than 10MB silently fail with a 413 from the API gateway.",
    proposed_solution: "Raise API gateway payload limit from 10MB to 100MB and add missing CORS header on the storage endpoint.",
    mock_patch_code: "// Module: Upload Gateway\n// Engineer resolution:\n// Update gateway payload limit config",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the module name from the mock_patch_code header comment */
function extractModule(patchCode: string): string {
  const match = patchCode.match(/\/\/\s*Module:\s*(.+)/);
  return match?.[1]?.trim() ?? "Unknown Module";
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Sub-component: Single KB entry card
// ---------------------------------------------------------------------------
function KBCard({ entry, index }: { entry: KBEntry; index: number }) {
  const module = extractModule(entry.mock_patch_code);
  const patchPreview = entry.mock_patch_code
    .split("\n")
    .filter((l) => !l.startsWith("//"))
    .join("\n")
    .trim();

  // Show first 3 lines of actual patch code (strip the comment headers)
  const codeLines = entry.mock_patch_code
    .split("\n")
    .filter((l) => l.startsWith("//"))
    .slice(2); // skip "Module:" and "Engineer resolution:" header lines

  return (
    <div className="group rounded-2xl border border-border/40 bg-card/40 transition-all hover:border-border/70 hover:bg-card/60 overflow-hidden">
      {/* Card header */}
      <div className="flex items-start gap-4 px-5 py-4 border-b border-border/30">
        {/* Index badge */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 mt-0.5">
          <span className="font-mono text-xs font-bold text-violet-400">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        {/* Module + date */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-medium text-indigo-300">
              <Database className="size-2.5" />
              {module}
            </span>
            {entry.created_at && (
              <span className="text-[11px] text-muted-foreground/50">
                {formatDate(entry.created_at)} · {formatTime(entry.created_at)}
              </span>
            )}
          </div>

          {/* Error signature — what triggered this fix */}
          <p className="text-xs leading-relaxed text-muted-foreground/70 line-clamp-2">
            <span className="font-medium text-muted-foreground/50 uppercase tracking-widest text-[10px] mr-1.5">
              Trigger:
            </span>
            {entry.error_signature}
          </p>
        </div>
      </div>

      {/* Solution + patch */}
      <div className="divide-y divide-border/20">
        {/* Proposed solution */}
        <div className="flex items-start gap-3 px-5 py-3.5">
          <Shield className="mt-0.5 size-3.5 shrink-0 text-emerald-400/70" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
              Proposed Fix
            </p>
            <p className="text-sm leading-relaxed text-foreground/80">
              {entry.proposed_solution}
            </p>
          </div>
        </div>

        {/* Patch code preview */}
        <div className="flex items-start gap-3 px-5 py-3.5">
          <Code2 className="mt-0.5 size-3.5 shrink-0 text-violet-400/70" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
              Patch Preview
            </p>
            <pre className="overflow-x-auto rounded-lg border border-border/30 bg-zinc-950/60 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-foreground/60 whitespace-pre-wrap break-words">
              {entry.mock_patch_code.trim()}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function KBPage() {
  let entries: KBEntry[] = [];
  let fetchError = false;
  let isDemo = false;

  const hasRealKeys =
    process.env.SUPABASE_URL &&
    !process.env.SUPABASE_URL.includes("placeholder") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder");

  if (!hasRealKeys) {
    entries = DEMO_ENTRIES;
    isDemo = true;
  } else {
    try {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase
        .from("historical_fixes")
        .select("id, error_signature, proposed_solution, mock_patch_code, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      entries = (data as KBEntry[]) ?? [];
    } catch {
      fetchError = true;
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ═══ NAV ══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600 shadow-lg shadow-indigo-500/25">
              <Ghost className="size-[18px] text-white" />
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
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="hidden items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex"
            >
              <ArrowLeft className="size-3" />
              Dashboard
            </Link>
            <div className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5">
              <BookOpen className="size-3 text-violet-400" />
              <span className="text-xs font-medium text-violet-400">Knowledge Base</span>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ MAIN ═════════════════════════════════════════════════════════ */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25">
              <BookOpen className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Knowledge Base
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Self-learning loop — every engineer resolution saves a fix for future AI triage
              </p>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex items-center gap-2 rounded-full border border-border/50 bg-muted/20 px-3 py-1.5">
              <Sparkles className="size-3 text-violet-400" />
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{entries.length}</span>
                {" "}fix{entries.length !== 1 ? "es" : ""} in the knowledge base
              </span>
            </div>
            {isDemo && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/8 px-3 py-1.5 text-[11px] font-medium text-amber-400">
                Demo data — connect Supabase to see real KB entries
              </span>
            )}
          </div>
        </div>

        {/* How it works callout */}
        <div className="mb-8 rounded-2xl border border-violet-500/20 bg-violet-500/5 px-5 py-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-400" />
            <div>
              <p className="text-sm font-medium text-violet-300">
                How the self-learning loop works
              </p>
              <p className="mt-1 text-xs leading-relaxed text-violet-400/70">
                When an escalated ticket is resolved by an engineer, they can opt to
                &ldquo;Save fix to knowledge base&rdquo;. GhostFix stores the error pattern and
                solution here. The next time a similar bug is reported, the AI retrieves
                this entry via RAG and produces a higher-confidence, grounded diagnosis —
                without any re-training.
              </p>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-violet-400/60">
                <span className="rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 font-mono">
                  Bug reported
                </span>
                <ChevronRight className="size-3" />
                <span className="rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 font-mono">
                  AI triage
                </span>
                <ChevronRight className="size-3" />
                <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-amber-400">
                  Escalated
                </span>
                <ChevronRight className="size-3" />
                <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-emerald-400">
                  Engineer resolves → saves here
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Error state */}
        {fetchError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-8 text-center">
            <p className="text-sm font-medium text-red-400">
              Failed to load knowledge base
            </p>
            <p className="mt-1 text-xs text-red-400/60">
              Check your Supabase environment variables and try again.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!fetchError && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-border/50 bg-muted/20">
              <BookOpen className="size-8 text-muted-foreground/30" />
            </div>
            <div className="max-w-sm">
              <p className="font-medium text-foreground/60">
                Knowledge base is empty
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Resolve an escalated ticket on the{" "}
                <Link
                  href="/dashboard"
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  dashboard
                </Link>{" "}
                and check &ldquo;Save fix to knowledge base&rdquo; to add the first entry.
                The AI will use it automatically next time.
              </p>
            </div>
          </div>
        )}

        {/* KB entries */}
        {!fetchError && entries.length > 0 && (
          <div className="space-y-4">
            {entries.map((entry, i) => (
              <KBCard key={entry.id} entry={entry} index={i} />
            ))}
          </div>
        )}

        {/* Footer CTA */}
        {!fetchError && entries.length > 0 && (
          <div className="mt-8 flex justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back to Triage Command Center
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
