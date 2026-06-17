// POST /api/teams/[id]/repo — connect or update a GitHub repo for a team

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json() as {
      repo_owner?: string;
      repo_name?: string;
      default_branch?: string;
      github_pat?: string;
      modules?: string[];
    };

    const { repo_owner, repo_name, github_pat, modules } = body;
    const default_branch = body.default_branch?.trim() || "main";

    if (!repo_owner?.trim() || !repo_name?.trim() || !github_pat?.trim()) {
      return NextResponse.json(
        { error: "repo_owner, repo_name, and github_pat are required." },
        { status: 400 },
      );
    }

    // Quick sanity-check the PAT by hitting the repo endpoint
    const checkRes = await fetch(
      `https://api.github.com/repos/${repo_owner.trim()}/${repo_name.trim()}`,
      {
        headers: {
          Authorization: `token ${github_pat.trim()}`,
          Accept: "application/vnd.github+json",
        },
      },
    );
    if (!checkRes.ok) {
      return NextResponse.json(
        { error: `GitHub repo not accessible: ${checkRes.status}. Check repo name and PAT.` },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient();

    // Delete existing row first (more reliable than upsert for UNIQUE-on-column constraints)
    await supabase.from("team_repos").delete().eq("team_id", id);

    const { data: inserted, error } = await supabase
      .from("team_repos")
      .insert({
        team_id: id,
        repo_owner: repo_owner.trim(),
        repo_name: repo_name.trim(),
        default_branch,
        github_pat: github_pat.trim(),
        modules: modules ?? [],
      })
      .select("id, repo_owner, repo_name, default_branch, modules, created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, repo: inserted }, { status: 201 });
  } catch (err) {
    console.error("[GhostFix] POST /api/teams/[id]/repo:", err);
    return NextResponse.json({ error: "Failed to connect repo." }, { status: 500 });
  }
}
