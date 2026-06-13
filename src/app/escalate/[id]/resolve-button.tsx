"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

export default function ResolveButton({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleResolve() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/resolve", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticketId,
          ...(note.trim() ? { engineer_note: note.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setStatus("done");
      // Refresh the page to show the resolved state
      setTimeout(() => router.refresh(), 800);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-5 py-4 animate-in fade-in-0 zoom-in-95 duration-300">
        <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
        <div>
          <p className="text-sm font-semibold text-emerald-300">Marked as Resolved</p>
          <p className="text-xs text-emerald-400/60">Updating dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 overflow-hidden">
      <div className="border-b border-border/40 bg-muted/20 px-5 py-3">
        <p className="text-xs font-semibold text-foreground/80">Engineer Action</p>
      </div>
      <div className="px-5 py-4 space-y-3">
        {/* Optional note toggle */}
        {!showNote ? (
          <button
            onClick={() => setShowNote(true)}
            className="text-[11px] text-indigo-400/70 underline underline-offset-2 hover:text-indigo-400 transition-colors"
          >
            + Add resolution note (optional)
          </button>
        ) : (
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
              Resolution Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Rolled back the config change in PR #481…"
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"
            />
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            <AlertTriangle className="size-3 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Resolve button */}
        <button
          onClick={handleResolve}
          disabled={status === "loading"}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition-all hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Resolving…
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4" />
              Mark as Resolved
            </>
          )}
        </button>
        <p className="text-[10px] leading-relaxed text-muted-foreground/40 text-center">
          This will update the ticket status to resolved and close it in the dashboard.
        </p>
      </div>
    </div>
  );
}
