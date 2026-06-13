// =============================================================================
// GhostFix — Resolve Ticket API
// PATCH /api/resolve
//
// Marks an escalated ticket as "resolved" — called from the engineer
// review page when the on-call engineer confirms the fix is done.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TicketStatus } from "@/lib/supabase/types";

export async function PATCH(request: NextRequest) {
  let body: { ticket_id?: string; engineer_note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { ticket_id, engineer_note } = body;

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

  return NextResponse.json({ success: true, ticket_id, status: "resolved" });
}
