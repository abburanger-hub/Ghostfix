// =============================================================================
// GhostFix — Resolve Ticket API
// PATCH /api/resolve
//
// Marks an escalated ticket as "resolved" — called from the engineer
// review page when the on-call engineer confirms the fix is done.
//
// Optionally saves the resolution to the historical_fixes knowledge base
// when save_to_kb: true — closing the self-learning loop.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TicketStatus } from "@/lib/supabase/types";

export async function PATCH(request: NextRequest) {
  let body: {
    ticket_id?: string;
    engineer_note?: string;
    save_to_kb?: boolean;
    issue_text?: string;
    failing_module?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { ticket_id, engineer_note, save_to_kb, issue_text, failing_module } = body;

  if (!ticket_id || typeof ticket_id !== "string") {
    return NextResponse.json(
      { error: "Missing required field: ticket_id" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("incoming_tickets")
    .update({
      status: "resolved" satisfies TicketStatus,
      // Append engineer note to the triage_summary if provided
      ...(engineer_note
        ? {
            triage_summary: `[Engineer resolved] ${engineer_note}`,
          }
        : {}),
    })
    .eq("id", ticket_id)
    .eq("status", "escalated"); // safety — only resolve escalated tickets

  if (error) {
    console.error("[GhostFix] resolve error:", error);
    return NextResponse.json(
      { error: "Failed to update ticket.", detail: error.message },
      { status: 500 }
    );
  }

  // ── Save to Knowledge Base ────────────────────────────────────────────────
  // When the engineer opts in, we write their fix into historical_fixes so the
  // RAG pipeline can surface it automatically for future similar issues.
  let kbSaved = false;
  if (save_to_kb && engineer_note?.trim() && issue_text?.trim()) {
    const { error: kbError } = await supabase.from("historical_fixes").insert({
      error_signature: issue_text.trim(),
      proposed_solution: engineer_note.trim(),
      mock_patch_code: `// Module: ${failing_module ?? "unknown"}\n// Engineer resolution:\n// ${engineer_note.trim().replace(/\n/g, "\n// ")}`,
    });
    if (kbError) {
      // Non-fatal — ticket is already resolved, just log the KB miss
      console.error("[GhostFix] KB insert error:", kbError);
    } else {
      kbSaved = true;
      console.log("[GhostFix] ✓ Fix saved to knowledge base for:", issue_text.slice(0, 80));
    }
  }

  return NextResponse.json({ success: true, ticket_id, status: "resolved", kb_saved: kbSaved });
}
