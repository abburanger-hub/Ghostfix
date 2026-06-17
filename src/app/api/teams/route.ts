// GET /api/teams         — list all teams (with members + repo)
// POST /api/teams        — create a new team

export const dynamic = "force-dynamic"; // never cache — Supabase reads must be fresh

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data: teams, error } = await supabase
      .from("teams")
      .select(`
        id, name, slug, owner_email, created_at,
        team_members ( id, email, role, created_at ),
        team_repos   ( id, repo_owner, repo_name, default_branch, modules, created_at )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ teams: teams ?? [] });
  } catch (err) {
    console.error("[GhostFix] GET /api/teams:", err);
    return NextResponse.json({ error: "Failed to fetch teams." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { name?: string; owner_email?: string };
    const { name, owner_email } = body;

    if (!name?.trim() || !owner_email?.trim()) {
      return NextResponse.json(
        { error: "name and owner_email are required." },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner_email)) {
      return NextResponse.json({ error: "Invalid owner_email." }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const slug = slugify(name.trim());

    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .insert({ name: name.trim(), slug, owner_email: owner_email.trim() })
      .select()
      .single();

    if (teamErr) {
      if (teamErr.code === "23505") {
        return NextResponse.json(
          { error: `A team named "${name.trim()}" already exists.` },
          { status: 409 },
        );
      }
      throw teamErr;
    }

    // Auto-add the owner as a member
    await supabase.from("team_members").insert({
      team_id: team.id,
      email: owner_email.trim(),
      role: "owner",
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (err) {
    console.error("[GhostFix] POST /api/teams:", err);
    return NextResponse.json({ error: "Failed to create team." }, { status: 500 });
  }
}
