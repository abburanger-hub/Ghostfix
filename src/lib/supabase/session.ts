// Cookie-based Supabase client — reads the user's session from cookies.
// Use this in Server Components / middleware that need to know WHO is logged in.
// For trusted server operations (bypass RLS), keep using createServerSupabaseClient.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSessionSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — cookie mutation is a no-op, fine.
          }
        },
      },
    },
  );
}
