// GET /api/users — returns list of signed-up GhostFix users (email + id)
// Uses service role to read from Supabase Auth admin API.

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;

    const users = (data.users ?? [])
      .filter((u) => !!u.email)
      .map((u) => ({
        id: u.id,
        email: u.email!,
        job_role: (u.user_metadata?.job_role as string | undefined) ?? "",
      }))
      .sort((a, b) => a.email.localeCompare(b.email));

    return NextResponse.json({ users });
  } catch (err) {
    console.error("[GhostFix] GET /api/users:", err);
    return NextResponse.json({ users: [] });
  }
}
