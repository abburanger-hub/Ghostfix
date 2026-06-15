// POST /api/teams/[id]/members   — add a member by email
// DELETE /api/teams/[id]/members — remove a member by email

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json() as { email?: string };
    const { email } = body;

    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("team_members").insert({
      team_id: id,
      email: email.trim(),
      role: "member",
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `${email} is already a member of this team.` },
          { status: 409 },
        );
      }
      throw error;
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[GhostFix] POST /api/teams/[id]/members:", err);
    return NextResponse.json({ error: "Failed to add member." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json() as { email?: string };
    const { email } = body;
    if (!email?.trim()) {
      return NextResponse.json({ error: "email is required." }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", id)
      .eq("email", email.trim())
      .neq("role", "owner"); // never remove the owner

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[GhostFix] DELETE /api/teams/[id]/members:", err);
    return NextResponse.json({ error: "Failed to remove member." }, { status: 500 });
  }
}
